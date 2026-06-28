/* ============================================================================
   branding.js - ACS Digital
   ----------------------------------------------------------------------------
   Preferências configuráveis pelo usuário (tela "Configurações"), guardadas
   no localStorage do navegador/dispositivo. Não existe uma tabela de
   configurações no Supabase ainda, então isso é só LOCAL (não sincroniza
   entre o celular e o computador, por exemplo - se isso for necessário no
   futuro, vale criar uma tabela `configuracoes` e trocar as funções abaixo
   por leitura/escrita no banco).

   Deve ser incluído logo depois de config.js, e ANTES de roteiro.js,
   dashboard.js ou qualquer script de página, em todas as páginas.
============================================================================ */

const CONFIG_LOCAL_KEY = 'acsdigital_config';

const CONFIG_LOCAL_PADRAO = {
  nomeUbs: 'UBS Guarda-Mor',
  microarea: 'Micro-área 03',
  capacidadeDiaria: 12,
  tempoMedioVisita: 20,
  metaMensalVisitas: 150,
};

function obterConfiguracaoLocal() {
  try {
    const raw = localStorage.getItem(CONFIG_LOCAL_KEY);
    const salvo = raw ? JSON.parse(raw) : {};
    return { ...CONFIG_LOCAL_PADRAO, ...salvo };
  } catch (e) {
    return { ...CONFIG_LOCAL_PADRAO };
  }
}

function salvarConfiguracaoLocal(parcial) {
  const atual = obterConfiguracaoLocal();
  const novo = { ...atual, ...parcial };
  try { localStorage.setItem(CONFIG_LOCAL_KEY, JSON.stringify(novo)); }
  catch (e) { console.error('Não foi possível salvar as preferências:', e); }
  return novo;
}

function restaurarConfiguracaoPadrao() {
  try { localStorage.removeItem(CONFIG_LOCAL_KEY); } catch (e) { /* ignora */ }
  return { ...CONFIG_LOCAL_PADRAO };
}

// Aplica nome da UBS / micro-área no cabeçalho da sidebar, em todas as páginas.
function aplicarBrandingNaSidebar() {
  const cfg = obterConfiguracaoLocal();
  const h2 = document.querySelector('.sidebar-header h2');
  const span = document.querySelector('.sidebar-header span');
  if (h2) h2.textContent = cfg.nomeUbs;
  if (span) span.textContent = cfg.microarea;
}

document.addEventListener('DOMContentLoaded', aplicarBrandingNaSidebar);
