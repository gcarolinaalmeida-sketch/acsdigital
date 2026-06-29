-- ============================================================================
-- ACS Digital - Restringir acesso ao banco a usuários autenticados
-- ----------------------------------------------------------------------------
-- ⚠️ NÃO RODE ISSO AINDA. Siga esta ordem, ou você fica sem acesso ao próprio
-- sistema (inclusive você):
--
--   1. No painel do Supabase: Authentication > Users > "Add user" - crie pelo
--      menos um usuário (e-mail + senha) pra equipe.
--   2. Suba login.html, auth.js e as páginas atualizadas pro seu GitHub Pages.
--   3. Abra login.html, entre com esse usuário, confirme que cai no Dashboard
--      e que os dados aparecem normalmente (RLS ainda está aberto pra "anon"
--      nesse momento, então isso é só testar o login em si).
--   4. SÓ DEPOIS de confirmar o passo 3, rode o SQL abaixo no SQL Editor do
--      Supabase.
--   5. Teste de novo: deslogada (aba anônima), você NÃO deve conseguir ver
--      nada. Logada, tudo deve continuar funcionando normalmente.
--
-- Se algo der errado depois de rodar e você precisar voltar atrás rapidamente,
-- o bloco "REVERTER" no final deste arquivo restaura o acesso público
-- (mesmo estado de hoje) - guarde esse arquivo.
-- ============================================================================

-- Garante que o RLS está ativado nas 4 tabelas
alter table familias enable row level security;
alter table cidadaos enable row level security;
alter table condicoes_saude enable row level security;
alter table visitas enable row level security;

-- Remove qualquer política antiga que esteja liberando acesso público
-- (ajuste os nomes abaixo se você tiver criado políticas com outros nomes -
-- para ver quais existem hoje, rode: select * from pg_policies where schemaname = 'public';)
drop policy if exists "Enable read access for all users" on familias;
drop policy if exists "Enable read access for all users" on cidadaos;
drop policy if exists "Enable read access for all users" on condicoes_saude;
drop policy if exists "Enable read access for all users" on visitas;
drop policy if exists "Enable insert for all users" on familias;
drop policy if exists "Enable insert for all users" on cidadaos;
drop policy if exists "Enable insert for all users" on condicoes_saude;
drop policy if exists "Enable insert for all users" on visitas;
drop policy if exists "leitura publica" on familias;
drop policy if exists "leitura publica" on cidadaos;
drop policy if exists "leitura publica" on condicoes_saude;
drop policy if exists "leitura publica" on visitas;

-- Cria políticas novas: tudo liberado (select/insert/update/delete), MAS
-- só para quem está autenticado (logado). "anon" (visitante sem login) não
-- bate em nenhuma política, então fica bloqueado por padrão.
create policy "acesso total para autenticados" on familias
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "acesso total para autenticados" on cidadaos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "acesso total para autenticados" on condicoes_saude
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "acesso total para autenticados" on visitas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================================
-- REVERTER (volta ao estado público de hoje, em caso de emergência)
-- ============================================================================
-- drop policy if exists "acesso total para autenticados" on familias;
-- drop policy if exists "acesso total para autenticados" on cidadaos;
-- drop policy if exists "acesso total para autenticados" on condicoes_saude;
-- drop policy if exists "acesso total para autenticados" on visitas;
--
-- create policy "leitura publica temporaria" on familias for all using (true) with check (true);
-- create policy "leitura publica temporaria" on cidadaos for all using (true) with check (true);
-- create policy "leitura publica temporaria" on condicoes_saude for all using (true) with check (true);
-- create policy "leitura publica temporaria" on visitas for all using (true) with check (true);
