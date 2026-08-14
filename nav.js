/* ============================================================================
   nav.js — ACS Digital
   ----------------------------------------------------------------------------
   Gera a sidebar (desktop) e a barra inferior (iPad/celular) a partir de UMA
   lista só, para acabar com o copia-e-cola de navegação em cada página (era
   a maior causa de inconsistência: nomes, ícones e agrupamentos diferentes
   em cada arquivo).

   Uso: em cada página, deixe no <body>:
     <aside id="appSidebar"></aside>
     <nav id="appBottomNav" class="bottom-nav"></nav>
   e no fim do <body>:
     <script src="nav.js"></script>
     <script>renderizarNavegacao('dashboard');</script>
   passando a chave da página atual (ver NAV_ESTRUTURA abaixo).

   Depende de branding.js (obterConfiguracaoLocal) já carregado antes.
============================================================================ */

const NAV_ESTRUTURA = [
  {
    grupo: 'Principal',
    itens: [
      { chave: 'dashboard', label: 'Dashboard', href: 'index.html', icone: 'ph-squares-four' },
      { chave: 'roteiro', label: 'Meu Roteiro', href: 'meu-roteiro.html', icone: 'ph-map-pin-line' },
      { chave: 'agenda', label: 'Agenda', href: 'agenda.html', icone: 'ph-calendar-blank' },
    ],
  },
  {
    grupo: 'Território',
    itens: [
      { chave: 'familias', label: 'Famílias', href: 'familias.html', icone: 'ph-users' },
      { chave: 'mapa', label: 'Mapa', href: 'mapa.html', icone: 'ph-map-trifold' },
      { chave: 'visitas', label: 'Visitas', href: 'nova-visita.html', icone: 'ph-clipboard-text' },
    ],
  },
  {
    grupo: 'Acompanhamento',
    itens: [
      { chave: 'indicadores', label: 'Indicadores', href: 'indicadores.html', icone: 'ph-chart-line-up' },
      { chave: 'relatorios', label: 'Relatórios', href: 'relatorio-visitas.html', icone: 'ph-file-text' },
    ],
  },
  {
    grupo: 'Ferramentas',
    itens: [
      { chave: 'busca', label: 'Busca', href: 'busca.html', icone: 'ph-magnifying-glass' },
      { chave: 'receitas', label: 'Receitas', href: 'receitas.html', icone: 'ph-pill' },
    ],
  },
  {
    grupo: 'Sistema',
    itens: [
      { chave: 'configuracoes', label: 'Configurações', href: 'configuracoes.html', icone: 'ph-gear' },
    ],
  },
];

// Itens mostrados na barra inferior (iPad/celular) — só os 5 mais usados em campo.
const NAV_MOBILE = [
  { chave: 'dashboard', label: 'Início', href: 'index.html', icone: 'ph-house' },
  { chave: 'roteiro', label: 'Roteiro', href: 'meu-roteiro.html', icone: 'ph-map-pin' },
  { chave: 'familias', label: 'Famílias', href: 'familias.html', icone: 'ph-users' },
  { chave: 'mapa', label: 'Mapa', href: 'mapa.html', icone: 'ph-map-trifold' },
  { chave: 'busca', label: 'Busca', href: 'busca.html', icone: 'ph-magnifying-glass' },
];

function renderizarNavegacao(paginaAtiva) {
  const cfg = (typeof obterConfiguracaoLocal === 'function') ? obterConfiguracaoLocal() : { nomeUbs: 'UBS Guarda-Mor', microarea: 'Micro-área 03' };

  const sidebarEl = document.getElementById('appSidebar');
  if (sidebarEl) {
    const grupos = NAV_ESTRUTURA.map(g => `
      <div class="nav-group">
        <div class="nav-group-label">${g.grupo}</div>
        <ul class="nav-links">
          ${g.itens.map(i => `
            <li><a href="${i.href}" class="${i.chave === paginaAtiva ? 'active' : ''}"><i class="ph ${i.icone}"></i> ${i.label}</a></li>
          `).join('')}
        </ul>
      </div>
    `).join('');

    sidebarEl.innerHTML = `
      <div class="app-sidebar-header">
        <div class="app-sidebar-logo">A</div>
        <div>
          <h2>${cfg.nomeUbs}</h2>
          <span>${cfg.microarea}</span>
        </div>
      </div>
      ${grupos}
      <div class="app-sidebar-footer">
        <div class="app-sidebar-avatar">G</div>
        <div>
          <div class="who">Gabriela</div>
          <div class="role">Agente Comunitária de Saúde</div>
        </div>
      </div>
    `;
  }

  const bottomEl = document.getElementById('appBottomNav');
  if (bottomEl) {
    bottomEl.innerHTML = NAV_MOBILE.map(i => `
      <a href="${i.href}" class="${i.chave === paginaAtiva ? 'active' : ''}"><i class="ph ${i.icone}"></i>${i.label}</a>
    `).join('');
  }
}
