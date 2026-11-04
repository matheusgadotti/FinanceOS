require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

// ── CONFIGURAÇÃO ─────────────────────────────────────
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERRO: defina SUPABASE_URL e SUPABASE_SERVICE_KEY nas variáveis de ambiente.');
  process.exit(1);
}

// O JWT_SECRET assina os tokens de login. Se ele for fraco ou público,
// qualquer pessoa consegue gerar um token válido e entrar na conta de outro usuário.
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('ERRO: defina JWT_SECRET com pelo menos 32 caracteres aleatórios nas variáveis de ambiente.');
  console.error('Para gerar um: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
// Quantidade de proxies na frente do servidor (o Render usa proxy). Usado para descobrir o IP real do cliente.
const trustProxy = parseInt(process.env.TRUST_PROXY, 10);
app.set('trust proxy', Number.isNaN(trustProxy) ? 1 : trustProxy);
app.use(express.json({ limit: '100kb' }));
app.use(cors({ origin: '*' }));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// O Express 4 não captura erros de rotas async: sem isso, uma única
// requisição malformada derruba o servidor inteiro.
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Registra o erro real no log do servidor e devolve uma mensagem simples,
// sem expor detalhes internos do banco de dados.
function dbFail(res, error, message = 'Não foi possível concluir a operação') {
  console.error(error);
  return res.status(400).json({ error: message });
}

// ── LIMITE DE TENTATIVAS ─────────────────────────────
const tooMany = { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' };

// Login: 10 tentativas erradas por e-mail a cada 15 min (impede adivinhar senhas).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: req => 'login:' + String(req.body?.email || '').trim().toLowerCase(),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooMany,
});

// Cadastro: 20 contas por IP por hora.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooMany,
});

// Troca de senha: 5 tentativas erradas por usuário a cada 15 min.
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: req => 'pw:' + req.userId,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooMany,
});

// ── VALIDAÇÃO DE DADOS ───────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const INVALID = Symbol('invalid');
const isStr = v => typeof v === 'string';

// Cada validador devolve o valor (normalizado) ou INVALID.
const T = {
  str: max => v => (v === null || (isStr(v) && v.length <= max)) ? v : INVALID,
  num: () => v => (v === null || (typeof v === 'number' && Number.isFinite(v))) ? v : INVALID,
  int: (min, max) => v => (v === null || (Number.isInteger(v) && v >= min && v <= max)) ? v : INVALID,
  date: () => v => (v === null || v === '') ? null : (isStr(v) && DATE_RE.test(v)) ? v : INVALID,
  oneOf: (...opts) => v => opts.includes(v) ? v : INVALID,
  // IDs podem ser uuid (texto) ou número, dependendo de como a tabela foi criada.
  id: () => v => ((isStr(v) && v.length > 0 && v.length <= 64) || (Number.isInteger(v) && v > 0)) ? v : INVALID,
};
const round2 = n => Math.round(n * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

// Campos que cada tabela aceita. Qualquer outro campo enviado (como user_id ou id)
// é descartado, para que ninguém consiga mover dados para a conta de outra pessoa.
const SCHEMAS = {
  transactions: {
    description: T.str(255),
    value: T.num(),
    date: T.date(),
    type: T.oneOf('receita', 'gasto'),
    category: T.str(100),
    subcategory: T.str(100),
    obs: T.str(1000),
    installment_total: T.int(1, 600),
    installment_current: T.int(1, 600),
    installment_group: T.str(64),
  },
  investments: {
    name: T.str(150),
    type: T.str(50),
    value: T.num(),
    date: T.date(),
    yield: T.num(),
    yield_mode: T.oneOf('manual', 'pct', 'pctAnual'),
    yield_rate: T.num(),
    institution: T.str(150),
    value_updated_at: T.date(),
  },
  investment_movements: {
    investment_id: T.id(),
    amount: T.num(),
    date: T.date(),
    note: T.str(200),
  },
  goals: {
    name: T.str(150),
    target: T.num(),
    current: T.num(),
    deadline: T.date(),
  },
  categories: {
    name: T.str(100),
    type: T.oneOf('exp', 'rec'),
  },
  subcategories: {
    category_id: T.id(),
    name: T.str(100),
  },
  goal_contributions: {
    goal_id: T.id(),
    amount: T.num(),
    date: T.date(),
    note: T.str(200),
  },
};

function sanitize(body, schema) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Dados inválidos' };
  const data = {};
  for (const [key, check] of Object.entries(schema)) {
    if (!(key in body)) continue;
    const value = check(body[key]);
    if (value === INVALID) return { error: `Campo inválido: ${key}` };
    data[key] = value;
  }
  if (!Object.keys(data).length) return { error: 'Nenhum campo válido enviado' };
  return { data };
}

// ── MIDDLEWARE JWT ───────────────────────────────────
function authJWT(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token não fornecido' });
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (!decoded.userId) throw new Error('Token sem usuário');
    req.userId = decoded.userId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

const signToken = userId => jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });

// bcrypt só considera os primeiros 72 bytes da senha.
const passwordTooLong = pw => Buffer.byteLength(pw, 'utf8') > 72;

// ── HEALTH ───────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'FinanceOS API online' }));

// ── AUTH ─────────────────────────────────────────────
app.post('/auth/register', registerLimiter, wrap(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!isStr(name) || !isStr(email) || !isStr(password) || !name.trim() || !email.trim() || !password)
    return res.status(400).json({ error: 'Preencha todos os campos' });
  if (name.trim().length > 100)
    return res.status(400).json({ error: 'O nome deve ter no máximo 100 caracteres' });
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail))
    return res.status(400).json({ error: 'E-mail inválido' });
  if (password.length < 6)
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
  if (passwordTooLong(password))
    return res.status(400).json({ error: 'A senha deve ter no máximo 72 caracteres' });

  const { data: existing } = await supabase
    .from('users').select('id').eq('email', cleanEmail).maybeSingle();
  if (existing)
    return res.status(400).json({ error: 'Este e-mail já está cadastrado' });

  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase
    .from('users')
    .insert({ name: name.trim(), email: cleanEmail, password_hash })
    .select('id, name, email')
    .single();
  if (error) return dbFail(res, error, 'Não foi possível criar a conta');

  // Criar categorias padrão para o novo usuário
  const defaultCatExp = ['Alimentação','Moradia','Transporte','Saúde','Educação','Lazer','Vestuário','Serviços','Outros'];
  const defaultCatRec = ['Salário','Freelance','Investimentos','Aluguel','Presente','Bônus','Outros'];
  const cats = [
    ...defaultCatExp.map(name => ({ name, type: 'exp', user_id: data.id })),
    ...defaultCatRec.map(name => ({ name, type: 'rec', user_id: data.id })),
  ];
  await supabase.from('categories').insert(cats);

  res.json({ token: signToken(data.id), user: { id: data.id, name: data.name, email: data.email } });
}));

app.post('/auth/login', loginLimiter, wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!isStr(email) || !isStr(password) || !email || !password)
    return res.status(400).json({ error: 'Preencha e-mail e senha' });

  const { data: user, error } = await supabase
    .from('users').select('id, name, email, password_hash')
    .eq('email', email.trim().toLowerCase()).maybeSingle();
  if (error || !user || !user.password_hash)
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid)
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });

  res.json({ token: signToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
}));

app.get('/auth/me', authJWT, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('users').select('id, name, email').eq('id', req.userId).single();
  if (error) return res.status(401).json({ error: 'Usuário não encontrado' });
  res.json(data);
}));

app.patch('/auth/password', authJWT, passwordLimiter, wrap(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!isStr(current_password) || !isStr(new_password) || !current_password || !new_password)
    return res.status(400).json({ error: 'Preencha todos os campos' });
  if (new_password.length < 6)
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres' });
  if (passwordTooLong(new_password))
    return res.status(400).json({ error: 'A nova senha deve ter no máximo 72 caracteres' });

  const { data: user } = await supabase
    .from('users').select('password_hash').eq('id', req.userId).maybeSingle();
  if (!user || !user.password_hash)
    return res.status(401).json({ error: 'Usuário não encontrado' });
  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });

  const password_hash = await bcrypt.hash(new_password, 12);
  const { error } = await supabase.from('users').update({ password_hash }).eq('id', req.userId);
  if (error) return dbFail(res, error, 'Não foi possível alterar a senha');
  res.json({ success: true });
}));

// ── TRANSAÇÕES ──────────────────────────────────────
app.get('/transactions', authJWT, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('transactions').select('*')
    .eq('user_id', req.userId)
    .order('date', { ascending: false });
  if (error) return dbFail(res, error, 'Não foi possível carregar as transações');
  res.json(data);
}));

app.post('/transactions', authJWT, wrap(async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  if (!items.length || items.length > 600)
    return res.status(400).json({ error: 'Quantidade de transações inválida' });
  const payload = [];
  for (const item of items) {
    const { data, error } = sanitize(item, SCHEMAS.transactions);
    if (error) return res.status(400).json({ error });
    payload.push({ ...data, user_id: req.userId });
  }
  const { data, error } = await supabase
    .from('transactions').insert(payload).select();
  if (error) return dbFail(res, error, 'Não foi possível salvar a transação');
  res.json(data);
}));

app.patch('/transactions/:id', authJWT, wrap(async (req, res) => {
  const { data: fields, error: invalid } = sanitize(req.body, SCHEMAS.transactions);
  if (invalid) return res.status(400).json({ error: invalid });
  const { data, error } = await supabase
    .from('transactions').update(fields)
    .eq('id', req.params.id).eq('user_id', req.userId).select();
  if (error) return dbFail(res, error, 'Não foi possível atualizar a transação');
  res.json(data);
}));

app.delete('/transactions/:id', authJWT, wrap(async (req, res) => {
  const { error } = await supabase
    .from('transactions').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return dbFail(res, error, 'Não foi possível excluir a transação');
  res.json({ success: true });
}));

app.delete('/transactions/group/:group_id', authJWT, wrap(async (req, res) => {
  const { error } = await supabase
    .from('transactions').delete()
    .eq('installment_group', req.params.group_id).eq('user_id', req.userId);
  if (error) return dbFail(res, error, 'Não foi possível excluir as parcelas');
  res.json({ success: true });
}));

// ── INVESTIMENTOS ────────────────────────────────────
app.get('/investments', authJWT, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('investments').select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });
  if (error) return dbFail(res, error, 'Não foi possível carregar os investimentos');
  res.json(data);
}));

// Colunas criadas por migrações. Se a migração ainda não rodou no banco,
// a gravação é repetida sem elas em vez de falhar.
const OPTIONAL_INVESTMENT_COLS = ['value_updated_at'];
async function withOptionalCols(run, fields) {
  let r = await run(fields);
  const missing = r.error && /column|schema cache/i.test(r.error.message || '');
  if (missing && OPTIONAL_INVESTMENT_COLS.some(c => c in fields)) {
    const rest = { ...fields };
    OPTIONAL_INVESTMENT_COLS.forEach(c => delete rest[c]);
    r = Object.keys(rest).length ? await run(rest) : { data: [], error: null };
  }
  return r;
}

app.post('/investments', authJWT, wrap(async (req, res) => {
  const { data: fields, error: invalid } = sanitize(req.body, SCHEMAS.investments);
  if (invalid) return res.status(400).json({ error: invalid });
  const { data, error } = await withOptionalCols(f => supabase
    .from('investments').insert({ ...f, user_id: req.userId }).select(), fields);
  if (error) return dbFail(res, error, 'Não foi possível salvar o investimento');
  res.json(data);
}));

app.patch('/investments/:id', authJWT, wrap(async (req, res) => {
  const { data: fields, error: invalid } = sanitize(req.body, SCHEMAS.investments);
  if (invalid) return res.status(400).json({ error: invalid });
  const { data, error } = await withOptionalCols(f => supabase
    .from('investments').update(f)
    .eq('id', req.params.id).eq('user_id', req.userId).select(), fields);
  if (error) return dbFail(res, error, 'Não foi possível atualizar o investimento');
  res.json(data);
}));

app.delete('/investments/:id', authJWT, wrap(async (req, res) => {
  // Apaga as movimentações junto (a tabela também tem "on delete cascade").
  await supabase.from('investment_movements').delete()
    .eq('investment_id', req.params.id).eq('user_id', req.userId);
  const { error } = await supabase
    .from('investments').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return dbFail(res, error, 'Não foi possível excluir o investimento');
  res.json({ success: true });
}));

// ── APORTES E RESGATES DOS INVESTIMENTOS ─────────────
// Cada movimentação (positivo = aporte, negativo = resgate) atualiza o "value" do
// investimento, que guarda o total líquido aplicado. O resgate pode levar também
// o rendimento, então o "value" pode ficar negativo quando o investimento é encerrado.
app.get('/investment-movements', authJWT, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('investment_movements').select('*')
    .eq('user_id', req.userId)
    .order('date', { ascending: false }).order('created_at', { ascending: false });
  if (error) return dbFail(res, error, 'Não foi possível carregar as movimentações');
  res.json(data);
}));

app.post('/investment-movements', authJWT, wrap(async (req, res) => {
  const { data: fields, error: invalid } = sanitize(req.body, SCHEMAS.investment_movements);
  if (invalid) return res.status(400).json({ error: invalid });
  if (fields.investment_id == null || !fields.amount)
    return res.status(400).json({ error: 'Informe o investimento e um valor diferente de zero' });
  fields.amount = round2(fields.amount);

  const { data: inv } = await supabase
    .from('investments').select('id, value')
    .eq('id', fields.investment_id).eq('user_id', req.userId).maybeSingle();
  if (!inv) return res.status(404).json({ error: 'Investimento não encontrado' });

  const { data: rows, error } = await supabase
    .from('investment_movements')
    .insert({ ...fields, date: fields.date || today(), user_id: req.userId })
    .select();
  if (error) return dbFail(res, error, 'Não foi possível registrar a movimentação');

  const newValue = round2(parseFloat(inv.value || 0) + fields.amount);
  const { data: updated, error: upErr } = await supabase
    .from('investments').update({ value: newValue })
    .eq('id', inv.id).eq('user_id', req.userId).select();
  if (upErr) {
    await supabase.from('investment_movements').delete().eq('id', rows[0].id).eq('user_id', req.userId);
    return dbFail(res, upErr, 'Não foi possível atualizar o investimento');
  }
  res.json({ movement: rows[0], investment: updated[0] });
}));

app.delete('/investment-movements/:id', authJWT, wrap(async (req, res) => {
  const { data: m } = await supabase
    .from('investment_movements').select('id, investment_id, amount')
    .eq('id', req.params.id).eq('user_id', req.userId).maybeSingle();
  if (!m) return res.status(404).json({ error: 'Movimentação não encontrada' });

  const { data: inv } = await supabase
    .from('investments').select('id, value')
    .eq('id', m.investment_id).eq('user_id', req.userId).maybeSingle();
  if (!inv) return res.status(404).json({ error: 'Investimento não encontrado' });

  const { error } = await supabase
    .from('investment_movements').delete().eq('id', m.id).eq('user_id', req.userId);
  if (error) return dbFail(res, error, 'Não foi possível excluir a movimentação');
  const newValue = round2(parseFloat(inv.value || 0) - parseFloat(m.amount));
  const { data: updated, error: upErr } = await supabase
    .from('investments').update({ value: newValue })
    .eq('id', inv.id).eq('user_id', req.userId).select();
  if (upErr) return dbFail(res, upErr, 'A movimentação foi excluída, mas o investimento não foi atualizado. Recarregue a página.');
  res.json({ success: true, investment: updated[0] });
}));

// ── OBJETIVOS ────────────────────────────────────────
app.get('/goals', authJWT, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('goals').select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });
  if (error) return dbFail(res, error, 'Não foi possível carregar os objetivos');
  res.json(data);
}));

app.post('/goals', authJWT, wrap(async (req, res) => {
  const { data: fields, error: invalid } = sanitize(req.body, SCHEMAS.goals);
  if (invalid) return res.status(400).json({ error: invalid });
  const { data, error } = await supabase
    .from('goals').insert({ ...fields, user_id: req.userId }).select();
  if (error) return dbFail(res, error, 'Não foi possível salvar o objetivo');
  res.json(data);
}));

app.patch('/goals/:id', authJWT, wrap(async (req, res) => {
  const { data: fields, error: invalid } = sanitize(req.body, SCHEMAS.goals);
  if (invalid) return res.status(400).json({ error: invalid });
  const { data, error } = await supabase
    .from('goals').update(fields)
    .eq('id', req.params.id).eq('user_id', req.userId).select();
  if (error) return dbFail(res, error, 'Não foi possível atualizar o objetivo');
  res.json(data);
}));

app.delete('/goals/:id', authJWT, wrap(async (req, res) => {
  // Apaga o histórico de aportes junto (a tabela também tem "on delete cascade").
  await supabase.from('goal_contributions').delete()
    .eq('goal_id', req.params.id).eq('user_id', req.userId);
  const { error } = await supabase
    .from('goals').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return dbFail(res, error, 'Não foi possível excluir o objetivo');
  res.json({ success: true });
}));

// ── APORTES DOS OBJETIVOS ────────────────────────────
// Cada aporte (positivo = guardou, negativo = retirou) atualiza o "current" do objetivo.
app.get('/goal-contributions', authJWT, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('goal_contributions').select('*')
    .eq('user_id', req.userId)
    .order('date', { ascending: false }).order('created_at', { ascending: false });
  if (error) return dbFail(res, error, 'Não foi possível carregar o histórico de aportes');
  res.json(data);
}));

app.post('/goal-contributions', authJWT, wrap(async (req, res) => {
  const { data: fields, error: invalid } = sanitize(req.body, SCHEMAS.goal_contributions);
  if (invalid) return res.status(400).json({ error: invalid });
  if (fields.goal_id == null || !fields.amount)
    return res.status(400).json({ error: 'Informe o objetivo e um valor diferente de zero' });
  fields.amount = round2(fields.amount);

  const { data: goal } = await supabase
    .from('goals').select('id, current')
    .eq('id', fields.goal_id).eq('user_id', req.userId).maybeSingle();
  if (!goal) return res.status(404).json({ error: 'Objetivo não encontrado' });

  const newCurrent = round2(parseFloat(goal.current || 0) + fields.amount);
  if (newCurrent < 0)
    return res.status(400).json({ error: 'O valor retirado é maior que o valor guardado' });

  const { data: rows, error } = await supabase
    .from('goal_contributions')
    .insert({ ...fields, date: fields.date || today(), user_id: req.userId })
    .select();
  if (error) return dbFail(res, error, 'Não foi possível registrar o aporte');

  const { data: updated, error: upErr } = await supabase
    .from('goals').update({ current: newCurrent })
    .eq('id', goal.id).eq('user_id', req.userId).select();
  if (upErr) {
    // Desfaz o aporte para não deixar o histórico diferente do saldo.
    await supabase.from('goal_contributions').delete().eq('id', rows[0].id).eq('user_id', req.userId);
    return dbFail(res, upErr, 'Não foi possível atualizar o objetivo');
  }
  res.json({ contribution: rows[0], goal: updated[0] });
}));

app.delete('/goal-contributions/:id', authJWT, wrap(async (req, res) => {
  const { data: c } = await supabase
    .from('goal_contributions').select('id, goal_id, amount')
    .eq('id', req.params.id).eq('user_id', req.userId).maybeSingle();
  if (!c) return res.status(404).json({ error: 'Aporte não encontrado' });

  const { data: goal } = await supabase
    .from('goals').select('id, current')
    .eq('id', c.goal_id).eq('user_id', req.userId).maybeSingle();
  if (!goal) return res.status(404).json({ error: 'Objetivo não encontrado' });

  const newCurrent = round2(parseFloat(goal.current || 0) - parseFloat(c.amount));
  if (newCurrent < 0)
    return res.status(400).json({ error: 'Não é possível excluir: o valor guardado ficaria negativo' });

  const { error } = await supabase
    .from('goal_contributions').delete().eq('id', c.id).eq('user_id', req.userId);
  if (error) return dbFail(res, error, 'Não foi possível excluir o aporte');
  const { data: updated, error: upErr } = await supabase
    .from('goals').update({ current: newCurrent })
    .eq('id', goal.id).eq('user_id', req.userId).select();
  if (upErr) return dbFail(res, upErr, 'O aporte foi excluído, mas o objetivo não foi atualizado. Recarregue a página.');
  res.json({ success: true, goal: updated[0] });
}));

// ── CATEGORIAS ───────────────────────────────────────
app.get('/categories', authJWT, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('categories').select('*')
    .eq('user_id', req.userId)
    .order('type').order('name');
  if (error) return dbFail(res, error, 'Não foi possível carregar as categorias');
  res.json(data);
}));

app.post('/categories', authJWT, wrap(async (req, res) => {
  const { data: fields, error: invalid } = sanitize(req.body, SCHEMAS.categories);
  if (invalid) return res.status(400).json({ error: invalid });
  const { data, error } = await supabase
    .from('categories').insert({ ...fields, user_id: req.userId }).select();
  if (error) return dbFail(res, error, 'Não foi possível salvar a categoria');
  res.json(data);
}));

app.delete('/categories/:id', authJWT, wrap(async (req, res) => {
  const { error } = await supabase
    .from('categories').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return dbFail(res, error, 'Não foi possível excluir a categoria');
  res.json({ success: true });
}));

// ── SUBCATEGORIAS ────────────────────────────────────
app.get('/subcategories', authJWT, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('subcategories').select('*')
    .eq('user_id', req.userId)
    .order('name');
  if (error) return dbFail(res, error, 'Não foi possível carregar as subcategorias');
  res.json(data);
}));

app.post('/subcategories', authJWT, wrap(async (req, res) => {
  const { data: fields, error: invalid } = sanitize(req.body, SCHEMAS.subcategories);
  if (invalid) return res.status(400).json({ error: invalid });
  // A categoria pai precisa pertencer ao próprio usuário.
  if (fields.category_id) {
    const { data: cat } = await supabase
      .from('categories').select('id')
      .eq('id', fields.category_id).eq('user_id', req.userId).maybeSingle();
    if (!cat) return res.status(400).json({ error: 'Categoria pai não encontrada' });
  }
  const { data, error } = await supabase
    .from('subcategories').insert({ ...fields, user_id: req.userId }).select();
  if (error) return dbFail(res, error, 'Não foi possível salvar a subcategoria');
  res.json(data);
}));

app.delete('/subcategories/:id', authJWT, wrap(async (req, res) => {
  const { error } = await supabase
    .from('subcategories').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return dbFail(res, error, 'Não foi possível excluir a subcategoria');
  res.json({ success: true });
}));

// ── ERROS ────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Dados muito grandes' });
  console.error(err);
  res.status(500).json({ error: 'Erro interno no servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FinanceOS API rodando na porta ${PORT}`));
