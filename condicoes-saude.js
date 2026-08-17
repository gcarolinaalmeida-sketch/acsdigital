/* ============================================================================
   ACS Digital - Condições de Saúde (componente reutilizável)
   ----------------------------------------------------------------------------
   Um único lugar que define TODAS as condições de saúde do sistema, agrupadas
   como no e-SUS APS, e as funções pra renderizar/ler/preencher o seletor de
   chips. Isso evita duplicar a mesma lista de condições em cada tela.

   IMPORTANTE: os valores ('valor') de Hipertensão, Diabetes, Gestante e
   Acamado são os MESMOS que o resto do sistema já usa (busca.html,
   indicadores.html, prontuario.html, dashboard.js, roteiro.js). Não mude
   esses 4 valores sem atualizar todos os lugares que os comparam.

   Como usar em uma página:
   1. Inclua este arquivo via <script src="condicoes-saude.js"></script>
   2. No HTML, um container vazio: <div id="SEU_PREFIXOCondicoesWrap"></div>
   3. No JS: document.getElementById('SEU_PREFIXOCondicoesWrap').innerHTML = htmlSeletorCondicoesSaude('SEU_PREFIXO');
   4. Pra preencher no modo edição: marcarCondicoesSelecionadas('SEU_PREFIXO', ['Hipertensão', ...]); definirObsCondicoes('SEU_PREFIXO', texto);
   5. Pra ler ao salvar: obterCondicoesSelecionadas('SEU_PREFIXO') -> array de strings; obterObsCondicoes('SEU_PREFIXO') -> string
============================================================================ */

const GRUPOS_CONDICOES_SAUDE = [
  {
    grupo: 'Doenças Crônicas',
    icone: 'ph-heartbeat',
    tema: 'cronicas',
    itens: [
      { valor: 'Hipertensão', label: 'Hipertensão Arterial', emoji: '🫀', sigla: 'HAS' },
      { valor: 'Diabetes', label: 'Diabetes Mellitus', emoji: '🍬', sigla: 'DM' },
      { valor: 'Obesidade', label: 'Obesidade', emoji: '⚖️', sigla: 'Obesidade' },
      { valor: 'Asma', label: 'Asma', emoji: '🫁', sigla: 'Asma' },
      { valor: 'DPOC', label: 'DPOC', emoji: '💨', sigla: 'DPOC' },
      { valor: 'Doença renal', label: 'Doença renal', emoji: '🫘', sigla: 'D. Renal' },
      { valor: 'Doença respiratória', label: 'Doença respiratória', emoji: '🫁', sigla: 'D. Respiratória' },
      { valor: 'Doença cardíaca', label: 'Doença cardíaca', emoji: '❤️‍🩹', sigla: 'D. Cardíaca' },
      { valor: 'Infarto', label: 'Infarto (histórico)', emoji: '💔', sigla: 'Infarto' },
      { valor: 'AVC/Derrame', label: 'AVC/Derrame (histórico)', emoji: '🧠', sigla: 'AVC' },
      { valor: 'Câncer', label: 'Câncer', emoji: '🎗️', sigla: 'Câncer' },
    ],
  },
  {
    grupo: 'Saúde da Mulher',
    icone: 'ph-flower-lotus',
    tema: 'mulher',
    itens: [
      { valor: 'Gestante', label: 'Gestante', emoji: '🤰', sigla: 'Gestante' },
      { valor: 'Puérpera', label: 'Puérpera', emoji: '🍼', sigla: 'Puérpera' },
      { valor: 'Planejamento Familiar', label: 'Planejamento Familiar', emoji: '📋', sigla: 'Pl. Familiar' },
    ],
  },
  {
    grupo: 'Crianças e Adolescentes',
    icone: 'ph-baby',
    tema: 'crianca',
    itens: [
      { valor: 'Criança menor de 2 anos', label: 'Criança menor de 2 anos', emoji: '👶', sigla: '<2 anos' },
      { valor: 'Acompanhamento CD', label: 'Acompanhamento do crescimento e desenvolvimento', emoji: '📈', sigla: 'CD' },
      { valor: 'Vacinação em atraso', label: 'Vacinação em atraso', emoji: '💉', sigla: 'Vacina atrasada' },
    ],
  },
  {
    grupo: 'Idosos',
    icone: 'ph-person-simple-walk',
    tema: 'idoso',
    itens: [
      { valor: 'Idoso', label: 'Idoso', emoji: '👴', sigla: 'Idoso' },
      { valor: 'Idoso frágil', label: 'Idoso frágil', emoji: '🦯', sigla: 'Idoso frágil' },
      { valor: 'Acamado', label: 'Acamado', emoji: '🛏️', sigla: 'Acamado' },
      { valor: 'Domiciliado', label: 'Domiciliado (atendimento domiciliar)', emoji: '🏠', sigla: 'Domiciliado' },
    ],
  },
  {
    grupo: 'Doenças Transmissíveis',
    icone: 'ph-virus',
    tema: 'transmissivel',
    itens: [
      { valor: 'Tuberculose', label: 'Tuberculose', emoji: '🦠', sigla: 'TB' },
      { valor: 'Hanseníase', label: 'Hanseníase', emoji: '🩹', sigla: 'Hanseníase' },
      { valor: 'HIV/IST', label: 'HIV/IST', emoji: '🎗️', sigla: 'HIV/IST' },
    ],
  },
  {
    grupo: 'Saúde Mental e Vulnerabilidades',
    icone: 'ph-brain',
    tema: 'mental',
    itens: [
      { valor: 'Transtorno mental', label: 'Transtorno mental', emoji: '🧠', sigla: 'Saúde Mental' },
      { valor: 'Uso de álcool e outras drogas', label: 'Uso de álcool e outras drogas', emoji: '🍺', sigla: 'Uso de subst.' },
      { valor: 'Pessoa com deficiência', label: 'Pessoa com deficiência', emoji: '♿', sigla: 'PCD' },
      { valor: 'Violência doméstica', label: 'Violência doméstica', emoji: '⚠️', sigla: 'Violência' },
      { valor: 'Insegurança alimentar', label: 'Insegurança alimentar', emoji: '🍽️', sigla: 'Ins. Alimentar' },
      { valor: 'Beneficiário de programa social', label: 'Beneficiário de programa social', emoji: '🏛️', sigla: 'Prog. Social' },
      { valor: 'Bolsa Família', label: 'Bolsa Família', emoji: '🧾', sigla: 'Bolsa Família' },
    ],
  },
  {
    grupo: 'Hábitos e Fatores de Risco',
    icone: 'ph-cigarette',
    tema: 'habitos',
    itens: [
      { valor: 'Fumante', label: 'Fumante', emoji: '🚬', sigla: 'Fumante' },
    ],
  },
];

// Lookup rápido: 'Hipertensão' -> { valor, label, emoji, sigla }
const CONDICOES_INFO_POR_VALOR = {};
GRUPOS_CONDICOES_SAUDE.forEach(g => g.itens.forEach(item => { CONDICOES_INFO_POR_VALOR[item.valor] = item; }));

function _escHtmlCond(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------
// Renderização do seletor (chips agrupados + observações)
// ---------------------------------------------------------------------
function htmlSeletorCondicoesSaude(idPrefix) {
  return `
    <div class="condicoes-selector" id="${idPrefix}CondicoesSelector">
      ${GRUPOS_CONDICOES_SAUDE.map(g => `
        <div class="condicoes-grupo" data-tema="${g.tema}">
          <div class="condicoes-grupo-titulo"><i class="ph ${g.icone}"></i> ${_escHtmlCond(g.grupo)}</div>
          <div class="condicoes-chips">
            ${g.itens.map(item => `
              <button type="button" class="condicao-chip" data-valor="${_escHtmlCond(item.valor)}">
                <span class="condicao-chip-emoji">${item.emoji}</span> ${_escHtmlCond(item.label)}
              </button>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <div class="condicoes-obs-row">
        <label>Observações sobre condições de saúde (opcional)</label>
        <textarea id="${idPrefix}ObsCondicoes" rows="2" placeholder="Ex: hipertensão controlada, faz uso de losartana..."></textarea>
      </div>
    </div>
  `;
}

// Um clique em qualquer chip (de qualquer instância do seletor) alterna a seleção.
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.condicao-chip');
  if (chip) chip.classList.toggle('selected');
});

function obterCondicoesSelecionadas(idPrefix) {
  const container = document.getElementById(idPrefix + 'CondicoesSelector');
  if (!container) return [];
  return Array.from(container.querySelectorAll('.condicao-chip.selected')).map(c => c.dataset.valor);
}

function marcarCondicoesSelecionadas(idPrefix, valores) {
  const container = document.getElementById(idPrefix + 'CondicoesSelector');
  if (!container) return;
  const set = new Set(valores || []);
  container.querySelectorAll('.condicao-chip').forEach(chip => {
    chip.classList.toggle('selected', set.has(chip.dataset.valor));
  });
}

function obterObsCondicoes(idPrefix) {
  const el = document.getElementById(idPrefix + 'ObsCondicoes');
  return el ? el.value.trim() : '';
}

function definirObsCondicoes(idPrefix, texto) {
  const el = document.getElementById(idPrefix + 'ObsCondicoes');
  if (el) el.value = texto || '';
}

function limparSeletorCondicoes(idPrefix) {
  marcarCondicoesSelecionadas(idPrefix, []);
  definirObsCondicoes(idPrefix, '');
}

// ---------------------------------------------------------------------
// Resumo em chips (pra cards de família / lista de moradores)
// ---------------------------------------------------------------------
function badgesResumoCondicoes(condicoesArray, limite = 4) {
  const distintas = Array.from(new Set(condicoesArray || []));
  if (distintas.length === 0) return '';
  const comInfo = distintas.map(v => CONDICOES_INFO_POR_VALOR[v] || { valor: v, label: v, emoji: '🏷️', sigla: v });
  const visiveis = comInfo.slice(0, limite);
  const restantes = comInfo.length - visiveis.length;
  let html = visiveis.map(i => `<span class="badge">${i.emoji} ${_escHtmlCond(i.sigla)}</span>`).join('');
  if (restantes > 0) html += `<span class="badge">+${restantes}</span>`;
  return html;
}
