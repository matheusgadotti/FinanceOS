require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware de autenticação
function auth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}

// Health check
app.get('/', (req, res) => res.json({ status: 'FinanceOS API online' }));

// ── TRANSAÇÕES ──────────────────────────────────────
app.get('/transactions', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/transactions', auth, async (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [req.body];
  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.patch('/transactions/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('transactions')
    .update(req.body)
    .eq('id', req.params.id)
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.delete('/transactions/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

app.delete('/transactions/group/:group_id', auth, async (req, res) => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('installment_group', req.params.group_id);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

// ── INVESTIMENTOS ────────────────────────────────────
app.get('/investments', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/investments', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('investments')
    .insert(req.body)
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.patch('/investments/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('investments')
    .update(req.body)
    .eq('id', req.params.id)
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.delete('/investments/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('investments')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

// ── OBJETIVOS ────────────────────────────────────────
app.get('/goals', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/goals', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('goals')
    .insert(req.body)
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.patch('/goals/:id', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('investments')
    .update(req.body)
    .eq('id', req.params.id)
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.delete('/goals/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

// ── CATEGORIAS ───────────────────────────────────────
app.get('/categories', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('type').order('name');
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/categories', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('categories')
    .insert(req.body)
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.delete('/categories/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

// ── SUBCATEGORIAS ────────────────────────────────────
app.get('/subcategories', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('subcategories')
    .select('*')
    .order('name');
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/subcategories', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('subcategories')
    .insert(req.body)
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.delete('/subcategories/:id', auth, async (req, res) => {
  const { error } = await supabase
    .from('subcategories')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FinanceOS API rodando na porta ${PORT}`));