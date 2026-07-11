-- ============================================================================
-- ACS Digital - Tabela "roteiro_dia"
-- ----------------------------------------------------------------------------
-- Guarda o roteiro do dia de forma editável: ordem das visitas, famílias
-- adicionadas manualmente (fora da heurística de prioridade) e o motivo/
-- prioridade/observação escolhidos ao adicionar. Sem essa tabela, o roteiro
-- era só calculado na hora (calcularRoteiroDoDia, em roteiro.js) e não podia
-- ser reordenado nem editado.
-- ============================================================================

create table if not exists roteiro_dia (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id) on delete cascade,
  data date not null default current_date,
  ordem integer not null default 0,
  motivo text,        -- null = item veio da heurística automática de prioridade
  prioridade text check (prioridade in ('Alta', 'Média', 'Baixa')),
  observacao text,
  created_at timestamptz not null default now(),
  unique (familia_id, data) -- evita duplicar a mesma família no roteiro do mesmo dia
);

create index if not exists idx_roteiro_dia_data on roteiro_dia (data);

-- --------------------------------------------------------------------------
-- RLS: escolha o bloco abaixo que corresponde ao estado atual do seu banco.
-- Se você AINDA NÃO rodou "rls_restringir_autenticados.sql", use o bloco A
-- (público, igual ao resto das tabelas hoje). Se já rodou, use o bloco B.
-- --------------------------------------------------------------------------

-- BLOCO A - acesso público (estado padrão de hoje, sem login obrigatório)
alter table roteiro_dia enable row level security;
create policy "leitura publica temporaria" on roteiro_dia for all using (true) with check (true);

-- BLOCO B - acesso restrito a autenticados (descomente e apague o BLOCO A
-- se você já rodou rls_restringir_autenticados.sql neste projeto)
-- drop policy if exists "leitura publica temporaria" on roteiro_dia;
-- create policy "acesso total para autenticados" on roteiro_dia
--   for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
