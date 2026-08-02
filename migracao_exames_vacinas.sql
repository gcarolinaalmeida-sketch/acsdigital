-- ============================================================================
-- ACS Digital - Exames e Vacinas
-- ----------------------------------------------------------------------------
-- Duas tabelas novas pra registrar exames e doses de vacina por cidadão.
-- Sem anexo de arquivo por enquanto (só o resultado em texto) — anexar PDF/foto
-- do exame fica pra depois, se quiser (precisa de Supabase Storage).
-- ============================================================================

create table if not exists exames (
  id bigint generated always as identity primary key,
  cidadao_id uuid not null references cidadaos(id) on delete cascade,
  tipo_exame text not null,
  data_exame date not null default current_date,
  resultado text,
  observacoes text,
  created_at timestamptz not null default now()
);

create index if not exists exames_cidadao_id_idx on exames(cidadao_id);
alter table exames enable row level security;
drop policy if exists "leitura publica temporaria" on exames;
create policy "leitura publica temporaria" on exames for all using (true) with check (true);
-- Se seu banco já exige login (rodou rls_restringir_autenticados.sql), troque a política acima por:
-- create policy "acesso total para autenticados" on exames for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists vacinas (
  id bigint generated always as identity primary key,
  cidadao_id uuid not null references cidadaos(id) on delete cascade,
  imunobiologico text not null,
  dose text,
  data_aplicacao date not null default current_date,
  proxima_dose date,
  observacoes text,
  created_at timestamptz not null default now()
);

create index if not exists vacinas_cidadao_id_idx on vacinas(cidadao_id);
alter table vacinas enable row level security;
drop policy if exists "leitura publica temporaria" on vacinas;
create policy "leitura publica temporaria" on vacinas for all using (true) with check (true);
-- create policy "acesso total para autenticados" on vacinas for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
