-- Execute no SQL Editor do Supabase (depois do schema.sql original e do
-- migracao_familias.sql, se ainda não tiver rodado).
-- ============================================================================
-- 1) Classificação de risco e vulnerabilidade no cadastro do cidadão
-- ============================================================================
alter table cidadaos
    add column if not exists classificacao_risco text,       -- 'Habitual' | 'Intermediário' | 'Alto Risco'
    add column if not exists vulnerabilidade text[],          -- ex: {'Mora sozinho(a)','Acamado sem cuidador','Situação de rua'}
    add column if not exists obs_risco_vulnerabilidade text;  -- observações livres da ACS

-- ============================================================================
-- 2) Tabela de receitas (medicamentos de uso contínuo que precisam ser
--    renovados periodicamente: a cada 30 dias, 60 dias ou 6 meses)
-- ============================================================================
create table if not exists receitas (
    id bigint generated always as identity primary key,
    cidadao_id bigint not null references cidadaos(id) on delete cascade,
    medicamento text not null,
    posologia text,
    tipo text not null check (tipo in ('30_dias', '60_dias', '6_meses')),
    data_ultima_renovacao date not null default current_date,
    ativa boolean not null default true,
    observacoes text,
    created_at timestamptz not null default now()
);

create index if not exists receitas_cidadao_id_idx on receitas(cidadao_id);

-- RLS: siga o mesmo padrão do restante do banco.
alter table receitas enable row level security;

-- Se você AINDA NÃO rodou o rls_restringir_autenticados.sql (ou seja, o banco
-- ainda está com leitura/escrita pública para "anon"), rode esta política:
create policy if not exists "leitura publica temporaria" on receitas
  for all using (true) with check (true);

-- Se você JÁ rodou o rls_restringir_autenticados.sql (banco exige login),
-- comente a política acima e descomente esta:
-- create policy "acesso total para autenticados" on receitas
--   for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
