-- ============================================================================
-- ACS Digital - Assinatura nas visitas
-- ----------------------------------------------------------------------------
-- Antes, o quadro de assinatura só travava a tela (obrigava assinar pra
-- salvar) mas o desenho em si nunca era gravado em lugar nenhum — era
-- descartado ao salvar. Agora a assinatura é opcional, e quando o paciente
-- assina, a imagem é salva de verdade (como PNG em base64) pra poder
-- aparecer no relatório de visitas.
-- ============================================================================

alter table visitas
  add column if not exists assinatura_base64 text,          -- imagem da assinatura (data:image/png;base64,...), ou null se não assinou
  add column if not exists assinatura_ausente_motivo text;   -- motivo opcional de não ter assinado (ex: "paciente acamado, não consegue")
