-- ============================================================================
-- ACS Digital - Observações da seção "Condições de Saúde"
-- ----------------------------------------------------------------------------
-- Campo de observação livre sobre as condições de saúde marcadas no cadastro
-- do cidadão (ex: "hipertensão controlada, faz uso de losartana"). É um
-- campo por cidadão, não por condição individual.
-- ============================================================================

alter table cidadaos
  add column if not exists observacoes_condicoes_saude text;
