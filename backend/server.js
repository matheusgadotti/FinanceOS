require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'financeos_secret';

// ── MIDDLEWARE JWT ───────────────────────────────────
function authJWT(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token não fornecido' });
  const token = header.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// ── HEALTH ───────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'FinanceOS API online' }));

// ── AUTH ─────────────────────────────────────────────
app.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Preencha todos os campos' });
  if (password.length < 6)
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });

  const { data: existing } = await supabase
    .from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
  if (existing)
    return res.status(400).json({ error: 'Este e-mail já está cadastrado' });

  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase
    .from('users')
    .insert({ name, email: email.toLowerCase(), password_hash })
    .select('id, name, email')
    .single();
  if (error) return res.status(400).json({ error: error.message });

  // Criar categorias padrão para o novo usuário
  const defaultCatExp = ['Alimentação','Moradia','Transporte','Saúde','Educação','Lazer','Vestuário','Serviços','Outros'];
  const defaultCatRec = ['Salário','Freelance','Investimentos','Aluguel','Presente','Bônus','Outros'];
  const cats = [
    ...defaultCatExp.map(name => ({ name, type: 'exp', user_id: data.id })),
    ...defaultCatRec.map(name => ({ name, type: 'rec', user_id: data.id })),
  ];
  await supabase.from('categories').insert(cats);

  const token = jwt.sign({ userId: data.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: data.id, name: data.name, email: data.email } });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Preencha e-mail e senha' });

  const { data: user, error } = await supabase
    .from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
  if (error || !user)
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid)
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/auth/me', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('users').select('id, name, email').eq('id', req.userId).single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.patch('/auth/password', authJWT, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Preencha todos os campos' });
  if (new_password.length < 6)
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres' });

  const { data: user } = await supabase
    .from('users').select('password_hash').eq('id', req.userId).single();
  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });

  const password_hash = await bcrypt.hash(new_password, 12);
  await supabase.from('users').update({ password_hash }).eq('id', req.userId);
  res.json({ success: true });
});

// ── TRANSAÇÕES ──────────────────────────────────────
app.get('/transactions', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('transactions').select('*')
    .eq('user_id', req.userId)
    .order('date', { ascending: false });
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/transactions', authJWT, async (req, res) => {
  const payload = Array.isArray(req.body)
    ? req.body.map(t => ({ ...t, user_id: req.userId }))
    : [{ ...req.body, user_id: req.userId }];
  const { data, error } = await supabase
    .from('transactions').insert(payload).select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.patch('/transactions/:id', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('transactions').update(req.body)
    .eq('id', req.params.id).eq('user_id', req.userId).select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.delete('/transactions/:id', authJWT, async (req, res) => {
  const { error } = await supabase
    .from('transactions').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

app.delete('/transactions/group/:group_id', authJWT, async (req, res) => {
  const { error } = await supabase
    .from('transactions').delete()
    .eq('installment_group', req.params.group_id).eq('user_id', req.userId);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

// ── INVESTIMENTOS ────────────────────────────────────
app.get('/investments', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('investments').select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/investments', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('investments').insert({ ...req.body, user_id: req.userId }).select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.patch('/investments/:id', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('investments').update(req.body)
    .eq('id', req.params.id).eq('user_id', req.userId).select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.delete('/investments/:id', authJWT, async (req, res) => {
  const { error } = await supabase
    .from('investments').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

// ── OBJETIVOS ────────────────────────────────────────
app.get('/goals', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('goals').select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/goals', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('goals').insert({ ...req.body, user_id: req.userId }).select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.patch('/goals/:id', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('goals').update(req.body)
    .eq('id', req.params.id).eq('user_id', req.userId).select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.delete('/goals/:id', authJWT, async (req, res) => {
  const { error } = await supabase
    .from('goals').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

// ── CATEGORIAS ───────────────────────────────────────
app.get('/categories', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('categories').select('*')
    .eq('user_id', req.userId)
    .order('type').order('name');
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/categories', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('categories').insert({ ...req.body, user_id: req.userId }).select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.delete('/categories/:id', authJWT, async (req, res) => {
  const { error } = await supabase
    .from('categories').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

// ── SUBCATEGORIAS ────────────────────────────────────
app.get('/subcategories', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('subcategories').select('*')
    .eq('user_id', req.userId)
    .order('name');
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/subcategories', authJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('subcategories').insert({ ...req.body, user_id: req.userId }).select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.delete('/subcategories/:id', authJWT, async (req, res) => {
  const { error } = await supabase
    .from('subcategories').delete()
    .eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FinanceOS API rodando na porta ${PORT}`));
