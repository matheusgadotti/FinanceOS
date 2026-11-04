-- FinanceOS — aportes e resgates dos investimentos + data da última atualização do valor
-- Rode uma vez no Supabase: painel do projeto → SQL Editor → New query → cole e clique em Run.
-- Pode rodar de novo sem problema (não duplica nada).

-- Cria a tabela usando o mesmo tipo de ID das tabelas "users" e "investments" (uuid ou número).
do $$
declare
  user_id_type text;
  inv_id_type text;
begin
  select format_type(atttypid, atttypmod) into user_id_type
    from pg_attribute where attrelid = 'public.users'::regclass and attname = 'id';
  select format_type(atttypid, atttypmod) into inv_id_type
    from pg_attribute where attrelid = 'public.investments'::regclass and attname = 'id';

  execute format($sql$
    create table if not exists public.investment_movements (
      id             uuid primary key default gen_random_uuid(),
      user_id        %s not null references public.users(id) on delete cascade,
      investment_id  %s not null references public.investments(id) on delete cascade,
      amount         numeric(14,2) not null check (amount <> 0),  -- positivo = aporte, negativo = resgate
      date           date not null default current_date,
      note           text,
      created_at     timestamptz not null default now()
    )
  $sql$, user_id_type, inv_id_type);
end $$;

create index if not exists investment_movements_user_idx on public.investment_movements (user_id);
create index if not exists investment_movements_inv_idx on public.investment_movements (investment_id, date);

-- Bloqueia acesso direto pela chave pública do Supabase. O backend usa a chave de serviço e continua funcionando.
alter table public.investment_movements enable row level security;

-- Data em que o valor atual de um investimento manual foi atualizado pela última vez.
alter table public.investments add column if not exists value_updated_at date;

-- Faz a API do Supabase reconhecer a tabela e a coluna novas na hora.
notify pgrst, 'reload schema';
