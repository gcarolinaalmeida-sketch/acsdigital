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

   IMPORTANTE: ainda não existe uma tabela de agendamento real
   (ex.: "visitas_agendadas"). Por isso, calcularRoteiroDoDia() é uma
   HEURÍSTICA clínica, não uma agenda de verdade. Documentado também em
   calcularPrioridade(). Quando essa tabela existir, troque
   carregarFamiliasEnriquecidas()/calcularRoteiroDoDia() por uma query real.
============================================================================ */

const CAPACIDADE_DIARIA_PADRAO = 12;

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

// ----------------------------- Carregamento + enriquecimento -----------------
// Busca familias + visitas no Supabase e devolve as famílias já enriquecidas
// com dados derivados (última visita, condições, idade dos membros, etc.).
async function carregarFamiliasEnriquecidas() {
  const [{ data: familias, error: erroFamilias },
         { data: visitas, error: erroVisitas }] = await Promise.all([
    db.from('familias').select('*, cidadaos(*, condicoes_saude(*))').order('logradouro'),
    db.from('visitas').select('familia_id, cidadao_id, data_visita, desfecho, observacoes, acompanhamentos').order('data_visita', { ascending: false }),
  ]);

  if (erroFamilias || erroVisitas) {
    const erro = erroFamilias || erroVisitas;
    throw erro;
  }

  const visitasPorFamilia = new Map();
  (visitas || []).forEach(v => {
    if (!v.familia_id) return;
    if (!visitasPorFamilia.has(v.familia_id)) visitasPorFamilia.set(v.familia_id, []);
    visitasPorFamilia.get(v.familia_id).push(v);
  });

  const hoje = hojeISO();
  const familiasEnriquecidas = (familias || []).map(f => {
    const membros = f.cidadaos || [];
    const historico = visitasPorFamilia.get(f.id) || []; // já ordenado desc pela query
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

  return { familiasEnriquecidas, visitas: visitas || [] };
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
