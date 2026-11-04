-- Fecha o acesso direto ao banco pela chave pública (anon) do Supabase.
--
-- Por quê: uma versão antiga do app acessava as tabelas direto do navegador com a
-- anon key, e essa chave ficou no histórico público do GitHub. Com o RLS desligado,
-- qualquer pessoa com a chave conseguia ler e alterar todas as tabelas.
--
-- O backend usa a chave service_role, que ignora o RLS, então o app continua
-- funcionando. Nenhuma política é necessária: todo acesso passa pelo backend.
--
-- Pode rodar mais de uma vez sem problema. Tabelas criadas no futuro também
-- precisam de "enable row level security" (as migrações 001 e 002 já fazem isso).

do $$
declare t text; p record;
begin
  foreach t in array array['users','transactions','categories','subcategories','goals',
                           'goal_contributions','investments','investment_movements'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy %I on public.%I', p.policyname, t);
      end loop;
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Conferência: todas as linhas devem mostrar rls_ligado = true, politicas = 0
-- e anon_pode_ler = false.
select c.relname as tabela,
       c.relrowsecurity as rls_ligado,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as politicas,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_pode_ler
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
