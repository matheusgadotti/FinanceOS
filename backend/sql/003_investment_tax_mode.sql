-- FinanceOS — como o imposto de renda de cada investimento é estimado
-- Rode uma vez no Supabase: painel do projeto → SQL Editor → New query → cole e clique em Run.
-- Pode rodar de novo sem problema.
--   regressiva = tabela regressiva de IR (CDB, Tesouro Direto, LC, fundos de renda fixa) + IOF antes de 30 dias
--   isento     = sem IR (LCI, LCA, CRI, CRA, debêntures incentivadas, poupança)
--   nenhum     = não estimar (ações, FII, cripto: o imposto depende das vendas do mês e é pago por DARF)
--   vazio      = automático, pelo tipo e pelo nome do investimento

alter table public.investments add column if not exists tax_mode text
  check (tax_mode in ('regressiva', 'isento', 'nenhum'));

notify pgrst, 'reload schema';
