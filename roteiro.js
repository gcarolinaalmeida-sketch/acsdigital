/* ============================================================================
   roteiro.js - ACS Digital
   ----------------------------------------------------------------------------
   Lógica COMPARTILHADA entre Dashboard (index.html), Mapa (mapa.html) e
   Agenda (agenda.html). Antes essa lógica estava duplicada em dashboard.js
   e mapa.html; foi extraída para cá para evitar que as duas cópias
   divirjam com o tempo.

   Depende de helpers globais definidos em config.js: calcularIdade(),
   formatarDataBR() e diasDesde(). Se eles não existirem, as funções
   "seguras" abaixo (com sufixo *Seguro/*Segura) fazem fallback automático.

   Depende também de branding.js (obterConfiguracaoLocal) para os valores
   configuráveis na tela "Configurações" - certifique-se de que branding.js
   é carregado ANTES deste arquivo.

   IMPORTANTE: ainda não existe uma tabela de agendamento real
   (ex.: "visitas_agendadas"). Por isso, calcularRoteiroDoDia() é uma
   HEURÍSTICA clínica, não uma agenda de verdade. Documentado também em
   calcularPrioridade(). Quando essa tabela existir, troque
   carregarFamiliasEnriquecidas()/calcularRoteiroDoDia() por uma query real.
============================================================================ */

const CAPACIDADE_DIARIA_PADRAO = obterConfiguracaoLocal().capacidadeDiaria;

// ----------------------------- Utilitários seguros ---------------------------
function diasDesdeSeguro(dataStr) {
  if (!dataStr) return Infinity;
  try {
    const r = diasDesde(dataStr);
    return r === null || r === undefined ? Infinity : r;
  } catch (e) {
    const d = new Date(dataStr);
    if (isNaN(d)) return Infinity;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }
}

function calcularIdadeSegura(dataNascimento) {
  if (!dataNascimento) return null;
  try { return calcularIdade(dataNascimento); }
  catch (e) {
    const nasc = new Date(dataNascimento);
    if (isNaN(nasc)) return null;
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
  }
}

function formatarDataSegura(dataStr) {
  if (!dataStr) return '—';
  try { return formatarDataBR(dataStr); }
  catch (e) {
    const d = new Date(dataStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('pt-BR');
  }
}

function inicioDoMesISO(referencia) {
  const d = referencia ? new Date(referencia) : new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function condicoesDe(cidadao) {
  return (cidadao.condicoes_saude || []).map(c => c.condicao);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function enderecoDe(f) {
  return [f.logradouro, f.numero].filter(Boolean).join(', ') || 'Endereço não informado';
}

function nomePrincipalDe(f) {
  const resp = f.membros.find(c => c.e_responsavel_familiar) || f.membros[0];
  return resp ? resp.nome : enderecoDe(f);
}

// ----------------------------- Cache local (resiliência offline) --------------
// Chave usada no localStorage para guardar os dados da última carga bem-sucedida.
// Se a próxima carga falhar (sem sinal, timeout, etc.), usamos esses dados em vez
// de deixar a tela travada em "Carregando..." pra sempre.
const CACHE_KEY = 'acsdigital_cache_dados';
const CACHE_MAX_IDADE_HORAS = 24; // ignora cache com mais de 24h (dado muito velho)
const TIMEOUT_SUPABASE_MS = 8000; // 8 segundos — tempo máximo de espera antes de usar o cache

function salvarCacheLocal(familiasEnriquecidas, visitas) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      familiasEnriquecidas,
      visitas,
    }));
  } catch (e) { /* localStorage cheio ou indisponível — segue sem cache */ }
}

function lerCacheLocal() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const idadeHoras = (Date.now() - parsed.ts) / 3600000;
    if (idadeHoras > CACHE_MAX_IDADE_HORAS) return null;
    return parsed;
  } catch (e) { return null; }
}

function idadeCacheTexto() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts } = JSON.parse(raw);
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 60) return `${mins} min atrás`;
    const horas = Math.round(mins / 60);
    return `${horas}h atrás`;
  } catch (e) { return null; }
}

// ----------------------------- Carregamento + enriquecimento -----------------
async function carregarFamiliasEnriquecidas() {
  // Tenta buscar do Supabase com timeout. Se falhar ou demorar demais, usa o cache.
  let dados = null;
  let usouCache = false;

  try {
    const promiseDados = Promise.all([
      db.from('familias').select('*, cidadaos(*, condicoes_saude(*))').order('logradouro'),
      db.from('visitas').select('familia_id, cidadao_id, data_visita, desfecho, observacoes, acompanhamentos').order('data_visita', { ascending: false }),
    ]);

    const promiseTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), TIMEOUT_SUPABASE_MS)
    );

    const [{ data: familias, error: erroFamilias }, { data: visitas, error: erroVisitas }]
      = await Promise.race([promiseDados, promiseTimeout]);

    if (erroFamilias || erroVisitas) throw (erroFamilias || erroVisitas);

    dados = { familias: familias || [], visitas: visitas || [] };
  } catch (e) {
    // Falha de rede ou timeout: tenta o cache
    const cache = lerCacheLocal();
    if (cache) {
      usouCache = true;
      // Avisa o usuário de forma não-invasiva (banner no topo da página, se existir)
      _mostrarAvisoOffline(idadeCacheTexto());
      return {
        familiasEnriquecidas: cache.familiasEnriquecidas,
        visitas: cache.visitas,
        usouCache: true,
      };
    }
    // Sem cache e sem rede: relança o erro pra mostrarErroGeral() tratar
    throw e;
  }

  const { familias, visitas } = dados;

  const visitasPorFamilia = new Map();
  visitas.forEach(v => {
    if (!v.familia_id) return;
    if (!visitasPorFamilia.has(v.familia_id)) visitasPorFamilia.set(v.familia_id, []);
    visitasPorFamilia.get(v.familia_id).push(v);
  });

  const hoje = hojeISO();
  const familiasEnriquecidas = familias.map(f => {
    const membros = f.cidadaos || [];
    const historico = visitasPorFamilia.get(f.id) || [];
    const ultimaVisita = historico[0]?.data_visita || null;
    const idades = membros.map(c => calcularIdadeSegura(c.data_nascimento)).filter(i => i !== null);

    return {
      ...f,
      membros,
      historico,
      diasDesdeUltimaVisita: diasDesdeSeguro(ultimaVisita),
      ultimaVisita,
      totalVisitas: historico.length,
      visitouHoje: historico.some(v => v.data_visita === hoje),
      temGestante: membros.some(c => condicoesDe(c).includes('Gestante')),
      temAcamado: membros.some(c => condicoesDe(c).includes('Acamado')),
      temHas: membros.some(c => condicoesDe(c).includes('Hipertensão')),
      temDm: membros.some(c => condicoesDe(c).includes('Diabetes')),
      temCriancaMenor2: idades.some(i => i < 2),
      temIdoso: idades.some(i => i >= 60),
      cadastroIncompleto: membros.some(c => !c.cpf || !c.cns),
    };
  });

  // Salva no cache local pra próxima vez sem sinal
  salvarCacheLocal(familiasEnriquecidas, visitas);

  return { familiasEnriquecidas, visitas, usouCache: false };
}

// Banner de aviso offline — só injeta se a página tiver o content-wrapper (todas as páginas do app têm).
function _mostrarAvisoOffline(idadeTexto) {
  if (document.getElementById('_avisoOffline')) return; // já existe
  const wrapper = document.querySelector('.content-wrapper');
  if (!wrapper) return;
  const banner = document.createElement('div');
  banner.id = '_avisoOffline';
  banner.style.cssText = `
    background: #FFF4E5; border: 1px solid #FF9500; border-radius: 10px;
    padding: 10px 16px; font-size: 13px; color: #111827;
    display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
  `;
  banner.innerHTML = `📶 <span>Sem conexão — exibindo dados salvos${idadeTexto ? ' de ' + idadeTexto : ''}. As alterações feitas agora <strong>não serão salvas</strong> até você reconectar.</span>`;
  wrapper.insertBefore(banner, wrapper.firstChild);
}


// ----------------------------- Heurística do roteiro --------------------------
// Critério: gestante/acamado > criança < 2 anos > HAS/DM > idoso > rotina,
// escalando para "urgente" quando o atraso desde a última visita é alto.
function calcularPrioridade(f) {
  const dias = f.diasDesdeUltimaVisita;
  let tipoPrincipal = null;
  let nivel = 'rotina';
  let peso = 0;

  if (f.temGestante) {
    tipoPrincipal = { emoji: '🤰', label: 'Gestante' };
    peso = 4;
    nivel = (dias === Infinity || dias > 20) ? 'urgente' : 'atencao';
  } else if (f.temAcamado) {
    tipoPrincipal = { emoji: '🛏️', label: 'Acamado' };
    peso = 3.5;
    nivel = (dias === Infinity || dias > 20) ? 'urgente' : 'atencao';
  } else if (f.temCriancaMenor2) {
    tipoPrincipal = { emoji: '👶', label: 'Criança < 2 anos' };
    peso = 3;
    nivel = (dias === Infinity || dias > 30) ? 'urgente' : 'atencao';
  } else if (f.temHas || f.temDm) {
    tipoPrincipal = f.temHas ? { emoji: '🫀', label: 'HAS' } : { emoji: '🍬', label: 'DM' };
    peso = 2;
    nivel = (dias === Infinity || dias > 60) ? 'urgente' : (dias > 30 ? 'atencao' : 'rotina');
  } else if (f.temIdoso) {
    tipoPrincipal = { emoji: '👴', label: 'Idoso' };
    peso = 1.5;
    nivel = (dias === Infinity || dias > 90) ? 'atencao' : 'rotina';
  } else {
    tipoPrincipal = { emoji: '🏠', label: 'Acompanhamento' };
    peso = 1;
    nivel = (dias === Infinity || dias > 120) ? 'atencao' : 'rotina';
  }

  if (dias !== Infinity && dias > 90) nivel = 'urgente';

  return { nivel, peso, tipoPrincipal, dias };
}

function calcularRoteiroDoDia(familias, capacidade = CAPACIDADE_DIARIA_PADRAO) {
  const comPrioridade = familias.map(f => ({ ...f, prio: calcularPrioridade(f) }));
  comPrioridade.sort((a, b) => {
    if (b.prio.peso !== a.prio.peso) return b.prio.peso - a.prio.peso;
    const da = a.prio.dias === Infinity ? 99999 : a.prio.dias;
    const db_ = b.prio.dias === Infinity ? 99999 : b.prio.dias;
    return db_ - da;
  });
  return comPrioridade.slice(0, capacidade);
}
