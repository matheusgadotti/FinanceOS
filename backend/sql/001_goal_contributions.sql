-- FinanceOS — histórico de aportes dos objetivos
-- Rode uma vez no Supabase: painel do projeto → SQL Editor → New query → cole e clique em Run.
-- Pode rodar de novo sem problema (não duplica nada).

-- Cria a tabela usando o mesmo tipo de ID das tabelas "users" e "goals" (uuid ou número).
do $$
declare
  user_id_type text;
  goal_id_type text;
begin
  select format_type(atttypid, atttypmod) into user_id_type
    from pg_attribute where attrelid = 'public.users'::regclass and attname = 'id';
  select format_type(atttypid, atttypmod) into goal_id_type
    from pg_attribute where attrelid = 'public.goals'::regclass and attname = 'id';

  execute format($sql$
    create table if not exists public.goal_contributions (
      id          uuid primary key default gen_random_uuid(),
      user_id     %s not null references public.users(id) on delete cascade,
      goal_id     %s not null references public.goals(id) on delete cascade,
      amount      numeric(14,2) not null check (amount <> 0),  -- positivo = guardou, negativo = retirou
      date        date not null default current_date,
      note        text,
      created_at  timestamptz not null default now()
    )
  $sql$, user_id_type, goal_id_type);
end $$;

create index if not exists goal_contributions_user_idx on public.goal_contributions (user_id);
create index if not exists goal_contributions_goal_idx on public.goal_contributions (goal_id, date);

-- Bloqueia acesso direto pela chave pública do Supabase. O backend usa a chave de serviço e continua funcionando.
alter table public.goal_contributions enable row level security;
