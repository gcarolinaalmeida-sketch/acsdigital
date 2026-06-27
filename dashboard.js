/* ============================================================================
   Dashboard - ACS Digital
   ----------------------------------------------------------------------------
   Este arquivo assume que `config.js` (carregado antes deste script) expõe:
     - db                -> cliente Supabase já configurado
     - formatarDataBR()  -> formata uma data ISO para dd/mm/aaaa
     - calcularIdade()   -> calcula idade em anos a partir da data de nasc.
     - diasDesde()       -> calcula quantos dias se passaram desde uma data

   Se algum desses helpers tiver outro nome em config.js, ajuste as chamadas
   correspondentes abaixo (estão concentradas nas funções utilitárias no topo).

   IMPORTANTE: ainda não existe uma tabela de agendamento (ex.: "visitas_agendadas").
   Por isso, o "roteiro do dia" é CALCULADO por heurística clínica (não é um
   dado real de agenda). O cálculo está isolado em calcularRoteiroDoDia() para
   ser facilmente substituído por uma query real quando essa tabela existir.
============================================================================ */

// ----------------------------- Configuração ---------------------------------
const CAPACIDADE_DIARIA = 12;       // quantas visitas cabem no roteiro de um dia
const TEMPO_MEDIO_VISITA_MIN = 20;  // minutos médios por visita, para estimar tempo restante
const META_MENSAL_VISITAS = 150;    // meta de visitas/mês (ideal: vir de uma tabela de metas no futuro)

// ----------------------------- Utilitários -----------------------------------
function diasDesdeSeguro(dataStr) {
  if (!dataStr) return Infinity;
  try { return diasDesde(dataStr); }
  catch (e) {
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

function inicioDoMesISO() {
  const d = new Date();
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

// ----------------------------- Saudação e data -------------------------------
function aplicarSaudacaoEData() {
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  // Nome fixo até existir autenticação de usuário no sistema.
  document.getElementById('heroSaudacao').textContent = `${saudacao}, Gabriela 👋`;
  document.getElementById('heroData').textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  });
}

// ----------------------------- Carregamento principal ------------------------
async function carregarDashboard() {
  aplicarSaudacaoEData();

  const [{ data: familias, error: erroFamilias },
         { data: visitas, error: erroVisitas }] = await Promise.all([
    db.from('familias').select('*, cidadaos(*, condicoes_saude(*))').order('logradouro'),
    db.from('visitas').select('familia_id, data_visita, desfecho').order('data_visita', { ascending: false }),
  ]);

  if (erroFamilias || erroVisitas) {
    console.error(erroFamilias, erroVisitas);
    mostrarErroGeral();
    return;
  }

  // ---- Enriquecer cada família com dados derivados (última visita, condições, etc.) ----
  const visitasPorFamilia = new Map();
  visitas.forEach(v => {
    if (!visitasPorFamilia.has(v.familia_id)) visitasPorFamilia.set(v.familia_id, []);
    visitasPorFamilia.get(v.familia_id).push(v);
  });

  const hoje = hojeISO();
  const familiasEnriquecidas = familias.map(f => {
    const membros = f.cidadaos || [];
    const historico = visitasPorFamilia.get(f.id) || [];
    const ultimaVisita = historico[0]?.data_visita || null; // já ordenado desc
    const idades = membros.map(c => calcularIdadeSegura(c.data_nascimento)).filter(i => i !== null);

    const temGestante = membros.some(c => condicoesDe(c).includes('Gestante'));
    const temAcamado = membros.some(c => condicoesDe(c).includes('Acamado'));
    const temHas = membros.some(c => condicoesDe(c).includes('Hipertensão'));
    const temDm = membros.some(c => condicoesDe(c).includes('Diabetes'));
    const temCriancaMenor2 = idades.some(i => i < 2);
    const temIdoso = idades.some(i => i >= 60);

    return {
      ...f,
      membros,
      diasDesdeUltimaVisita: diasDesdeSeguro(ultimaVisita),
      ultimaVisita,
      totalVisitas: historico.length,
      visitouHoje: historico.some(v => v.data_visita === hoje),
      temGestante, temAcamado, temHas, temDm, temCriancaMenor2, temIdoso,
      cadastroIncompleto: membros.some(c => !c.cpf || !c.cns),
    };
  });

  const roteiro = calcularRoteiroDoDia(familiasEnriquecidas);

  renderizarHeroEResumo(familiasEnriquecidas, roteiro, hoje);
  renderizarVisitasPrioritarias(roteiro);
  renderizarAlertas(familiasEnriquecidas);
  renderizarProximasVisitas(roteiro);
  renderizarMetas(familiasEnriquecidas, visitas);
  renderizarMapaResumo(familiasEnriquecidas, roteiro, hoje);
  renderizarIndicadores(familiasEnriquecidas);
  configurarBotaoRoteiro(roteiro);
}

function mostrarErroGeral() {
  const blocos = ['priorityGrid', 'alertsList', 'timelineList', 'goalsGrid', 'metricsGrid'];
  blocos.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<p class="estado-erro">Não foi possível carregar os dados agora. Verifique a conexão e tente novamente.</p>`;
  });
}

// ----------------------------- Heurística do roteiro --------------------------
// Calcula um nível de prioridade clínica + tipo principal para exibir no card.
// Critério documentado: gestante/acamado > criança < 2 anos > HAS/DM > rotina,
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

  // Atraso extremo escala qualquer tipo para urgente.
  if (dias !== Infinity && dias > 90) nivel = 'urgente';

  return { nivel, peso, tipoPrincipal, dias };
}

function calcularRoteiroDoDia(familias) {
  const comPrioridade = familias.map(f => ({ f, prio: calcularPrioridade(f) }));
  comPrioridade.sort((a, b) => {
    if (b.prio.peso !== a.prio.peso) return b.prio.peso - a.prio.peso;
    const da = a.prio.dias === Infinity ? 99999 : a.prio.dias;
    const db_ = b.prio.dias === Infinity ? 99999 : b.prio.dias;
    return db_ - da;
  });
  return comPrioridade.slice(0, CAPACIDADE_DIARIA).map(({ f, prio }) => ({ ...f, prio }));
}

function enderecoDe(f) {
  return [f.logradouro, f.numero].filter(Boolean).join(', ') || 'Endereço não informado';
}

function nomePrincipalDe(f) {
  const resp = f.membros.find(c => c.e_responsavel_familiar) || f.membros[0];
  return resp ? resp.nome : enderecoDe(f);
}

// ----------------------------- 1+2: Hero e resumo do dia ----------------------
function renderizarHeroEResumo(familias, roteiro, hoje) {
  const programadas = roteiro.length;
  const urgentes = roteiro.filter(f => f.prio.nivel === 'urgente').length;
  const retornos = roteiro.filter(f => f.totalVisitas > 0).length; // já tiveram visita antes (acompanhamento contínuo)
  const concluidasHoje = familias.filter(f => f.visitouHoje).length;
  const pendentes = Math.max(programadas - concluidasHoje, 0);
  const minutosRestantes = pendentes * TEMPO_MEDIO_VISITA_MIN;
  const horas = Math.floor(minutosRestantes / 60);
  const minutos = minutosRestantes % 60;
  const percentual = programadas > 0 ? Math.round((concluidasHoje / programadas) * 100) : 0;

  document.getElementById('heroVisitasHoje').textContent = programadas;
  document.getElementById('heroPercentual').textContent = percentual + '%';

  document.getElementById('sumProgramadas').textContent = programadas;
  document.getElementById('sumUrgentes').textContent = urgentes;
  document.getElementById('sumRetornos').textContent = retornos;
  document.getElementById('sumConcluidas').textContent = concluidasHoje;
  document.getElementById('sumPendentes').textContent = pendentes;
  document.getElementById('sumTempo').textContent = horas > 0 ? `${horas}h${minutos > 0 ? minutos + 'min' : ''}` : `${minutos}min`;

  const proxima = roteiro.find(f => !f.visitouHoje);
  const subEl = document.getElementById('roteiroSub');
  if (!proxima) {
    subEl.textContent = programadas === 0
      ? 'Nenhuma família cadastrada ainda — comece cadastrando o primeiro domicílio.'
      : 'Todas as visitas de hoje já foram concluídas. 🎉';
  } else {
    subEl.innerHTML = `Próxima parada: <strong>${escapeHtml(nomePrincipalDe(proxima))}</strong> · ${escapeHtml(enderecoDe(proxima))}`;
  }
}

function configurarBotaoRoteiro(roteiro) {
  const btn = document.getElementById('btnIniciarRoteiro');
  const proxima = roteiro.find(f => !f.visitouHoje) || roteiro[0];
  btn.addEventListener('click', () => {
    if (proxima) {
      window.location.href = `nova-visita.html?familia_id=${proxima.id}`;
    } else {
      window.location.href = 'familias.html';
    }
  });
  // Atalho "Nova Visita" também aponta direto para a próxima família prioritária (reduz cliques).
  const quickNovaVisita = document.getElementById('quickNovaVisita');
  if (proxima) quickNovaVisita.href = `nova-visita.html?familia_id=${proxima.id}`;
}

// ----------------------------- 5: Visitas prioritárias -------------------------
function renderizarVisitasPrioritarias(roteiro) {
  const grid = document.getElementById('priorityGrid');
  const destaque = roteiro.slice(0, 4);

  if (destaque.length === 0) {
    grid.innerHTML = `<p class="estado-vazio">Nenhuma família cadastrada ainda. Use "Nova Família" para começar.</p>`;
    return;
  }

  const labelNivel = { urgente: '● Urgente', atencao: '● Atenção', rotina: '● Rotina' };

  grid.innerHTML = destaque.map(f => {
    const ultimaVisitaTxt = f.ultimaVisita
      ? `Última visita: ${formatarDataSegura(f.ultimaVisita)} (há ${f.diasDesdeUltimaVisita} dia${f.diasDesdeUltimaVisita === 1 ? '' : 's'})`
      : 'Nunca visitada';
    return `
      <div class="priority-card nivel-${f.prio.nivel}">
        <div class="priority-top">
          <span class="priority-tag nivel-${f.prio.nivel}">${labelNivel[f.prio.nivel]}</span>
          <span class="priority-type-badge">${f.prio.tipoPrincipal.emoji} ${escapeHtml(f.prio.tipoPrincipal.label)}</span>
        </div>
        <div class="priority-name">${escapeHtml(nomePrincipalDe(f))}</div>
        <div class="priority-address">📍 ${escapeHtml(enderecoDe(f))}${f.bairro ? ' - ' + escapeHtml(f.bairro) : ''}</div>
        <div class="priority-lastvisit">${ultimaVisitaTxt}</div>
        <div class="priority-actions">
          <a class="btn-mini primary" href="nova-visita.html?familia_id=${f.id}">Iniciar visita</a>
          <a class="btn-mini ghost" href="mapa.html?familia_id=${f.id}">Ver rota</a>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------------------- 6: Alertas --------------------------------------
function renderizarAlertas(familias) {
  const lista = document.getElementById('alertsList');

  const gestantesAtrasadas = familias.filter(f => f.temGestante && f.diasDesdeUltimaVisita > 30);
  const cronicosAtrasados = familias.filter(f => (f.temHas || f.temDm) && f.diasDesdeUltimaVisita > 60);
  const cadastroIncompleto = familias.filter(f => f.cadastroIncompleto);
  const criancasSemAcompanhamento = familias.filter(f => f.temCriancaMenor2 && f.diasDesdeUltimaVisita > 60);
  const semNenhumaVisita = familias.filter(f => f.totalVisitas === 0);

  const itens = [
    {
      sev: 'sev-alta', icon: '🤰', titulo: 'Gestante sem visita há mais de 30 dias',
      sub: 'Acompanhamento pré-natal pode estar em risco', count: gestantesAtrasadas.length, href: 'familias.html',
    },
    {
      sev: 'sev-alta', icon: '🫀', titulo: 'Hipertenso ou diabético com retorno atrasado',
      sub: 'Mais de 60 dias sem visita à família', count: cronicosAtrasados.length, href: 'familias.html?filtro=hipertensos',
    },
    {
      sev: 'sev-media', icon: '⚠️', titulo: 'Cadastro incompleto',
      sub: 'Cidadãos sem CPF ou CNS registrado', count: cadastroIncompleto.length, href: 'familias.html?filtro=incompleto',
    },
    {
      sev: 'sev-media', icon: '👶', titulo: 'Criança sem acompanhamento',
      sub: 'Crianças menores de 2 anos sem visita há mais de 60 dias', count: criancasSemAcompanhamento.length, href: 'familias.html',
    },
    {
      sev: 'sev-baixa', icon: '🏠', titulo: 'Famílias nunca visitadas',
      sub: 'Sem nenhuma visita registrada no histórico', count: semNenhumaVisita.length, href: 'familias.html',
    },
    {
      sev: 'sev-baixa', icon: '💉', titulo: 'Vacina pendente',
      sub: 'Disponível quando o controle de vacinação for integrado', count: null, href: '#', disabled: true,
    },
  ];

  const visiveis = itens.filter(i => i.disabled || i.count > 0);

  if (visiveis.length === 0) {
    lista.innerHTML = `<p class="estado-vazio">Nenhum alerta pendente. Tudo em dia! ✅</p>`;
    return;
  }

  lista.innerHTML = visiveis.map(i => `
    <a class="alert-row ${i.disabled ? 'is-disabled' : ''}" href="${i.disabled ? '#' : i.href}">
      <span class="alert-icon ${i.sev}">${i.icon}</span>
      <span class="alert-text">
        <span class="alert-title">${escapeHtml(i.titulo)}</span>
        <span class="alert-sub">${escapeHtml(i.sub)}</span>
      </span>
      ${i.disabled ? '<span class="alert-count">Em breve</span>' : `<span class="alert-count">${i.count}</span><span class="alert-chevron">→</span>`}
    </a>
  `).join('');
}

// ----------------------------- 7: Próximas visitas -----------------------------
function renderizarProximasVisitas(roteiro) {
  const lista = document.getElementById('timelineList');
  const pendentesRoteiro = roteiro.filter(f => !f.visitouHoje);

  if (pendentesRoteiro.length === 0) {
    lista.innerHTML = `<p class="estado-vazio">Nenhuma visita pendente no roteiro de hoje.</p>`;
    return;
  }

  lista.innerHTML = pendentesRoteiro.slice(0, 6).map((f, idx) => `
    <div class="timeline-item">
      <div class="timeline-pos">${idx + 1}º</div>
      <div class="timeline-body">
        <div class="timeline-name">${f.prio.tipoPrincipal.emoji} ${escapeHtml(nomePrincipalDe(f))}</div>
        <div class="timeline-detail">${escapeHtml(enderecoDe(f))}${f.bairro ? ' - ' + escapeHtml(f.bairro) : ''}</div>
      </div>
    </div>
  `).join('');
}

// ----------------------------- 8: Metas ----------------------------------------
function renderizarMetas(familias, visitas) {
  const grid = document.getElementById('goalsGrid');
  const inicioMes = inicioDoMesISO();

  const visitasMes = visitas.filter(v => v.data_visita && new Date(v.data_visita).toISOString() >= inicioMes);
  const metaVisitas = { atual: visitasMes.length, meta: META_MENSAL_VISITAS };

  const todosCidadaos = familias.flatMap(f => f.membros);
  const gestantes = familias.filter(f => f.temGestante);
  const gestantesAcompanhadas = gestantes.filter(f => f.diasDesdeUltimaVisita <= 30);
  const metaGestantes = { atual: gestantesAcompanhadas.length, meta: gestantes.length };

  const condicoesTodas = todosCidadaos.flatMap(c => c.condicoes_saude || []);
  const hipertensos = condicoesTodas.filter(c => c.condicao === 'Hipertensão');
  const hipertensosComPA = hipertensos.filter(c => c.data_pressao_arterial && diasDesdeSeguro(c.data_pressao_arterial) <= 180);
  const metaHas = { atual: hipertensosComPA.length, meta: hipertensos.length };

  const metas = [
    { titulo: 'Visitas domiciliares no mês', ...metaVisitas },
    { titulo: 'Gestantes com visita nos últimos 30 dias', ...metaGestantes },
    { titulo: 'Hipertensos com aferição no semestre', ...metaHas },
  ];

  grid.innerHTML = metas.map(m => {
    const pct = m.meta > 0 ? Math.min(100, Math.round((m.atual / m.meta) * 100)) : 0;
    const restante = Math.max(m.meta - m.atual, 0);
    const corClasse = pct >= 70 ? '' : pct >= 40 ? 'warning' : 'danger';
    return `
      <div class="goal-card">
        <div class="goal-top">
          <span class="goal-title">${escapeHtml(m.titulo)}</span>
          <span class="goal-numbers">${m.atual} / ${m.meta}</span>
        </div>
        <div class="goal-track"><div class="goal-fill ${corClasse}" style="width:${pct}%;"></div></div>
        <div class="goal-footer"><span>${pct}% concluído</span><span><strong>${restante}</strong> restantes</span></div>
      </div>
    `;
  }).join('');
}

// ----------------------------- Mapa-resumo --------------------------------------
function renderizarMapaResumo(familias, roteiro, hoje) {
  const visitadasHoje = familias.filter(f => f.visitouHoje).length;
  const pendentes = roteiro.filter(f => !f.visitouHoje).length;
  const urgentes = roteiro.filter(f => f.prio.nivel === 'urgente' && !f.visitouHoje).length;

  document.getElementById('mapUrgentesTxt').textContent = `${urgentes} urgentes hoje`;
  document.getElementById('mapPendentesTxt').textContent = `${pendentes} pendentes`;
  document.getElementById('mapVisitadasTxt').textContent = `${visitadasHoje} visitadas hoje`;

  // Visual ilustrativo (não são coordenadas reais) - o mapa real fica em mapa.html.
  const visual = document.getElementById('mapVisual');
  const pontos = roteiro.slice(0, 10).map((f, i) => {
    const tipo = f.visitouHoje ? 'visitada' : (f.prio.nivel === 'urgente' ? 'urgente' : 'pendente');
    const top = 12 + ((i * 37) % 76);
    const left = 8 + ((i * 53) % 84);
    return `<span class="map-pin ${tipo}" style="top:${top}%; left:${left}%;" title="${escapeHtml(nomePrincipalDe(f))}"></span>`;
  }).join('');
  visual.innerHTML = pontos + `<span class="map-pin eu" style="top:50%; left:46%;" title="Minha localização"></span>`;
}

// ----------------------------- Indicadores --------------------------------------
async function renderizarIndicadores(familias) {
  const todosCidadaos = familias.flatMap(f => f.membros);
  const idades = todosCidadaos.map(c => calcularIdadeSegura(c.data_nascimento));
  const condicoesTodas = todosCidadaos.flatMap(c => c.condicoes_saude || []);

  const contagens = {
    'Famílias': { emoji: '👨‍👩‍👧‍👦', valor: familias.length },
    'Hipertensos (HAS)': { emoji: '🫀', valor: condicoesTodas.filter(c => c.condicao === 'Hipertensão').length },
    'Diabéticos (DM)': { emoji: '🍬', valor: condicoesTodas.filter(c => c.condicao === 'Diabetes').length },
    'Gestantes': { emoji: '🤰', valor: condicoesTodas.filter(c => c.condicao === 'Gestante').length },
    'Crianças < 2 anos': { emoji: '👶', valor: idades.filter(i => i !== null && i < 2).length },
    'Acamados': { emoji: '🛏️', valor: condicoesTodas.filter(c => c.condicao === 'Acamado').length },
    'Idosos (60+)': { emoji: '👴', valor: idades.filter(i => i !== null && i >= 60).length },
  };

  // Tendência real (famílias novas este mês) - só exibida se a coluna created_at existir.
  let familiasNovasMes = null;
  try {
    const { data, error } = await db.from('familias').select('id, created_at').gte('created_at', inicioDoMesISO());
    if (!error && data) familiasNovasMes = data.length;
  } catch (e) { /* coluna não existe ou query indisponível - segue sem tendência */ }

  const grid = document.getElementById('metricsGrid');
  grid.innerHTML = Object.entries(contagens).map(([label, info]) => {
    let trendHtml = '';
    if (label === 'Famílias' && familiasNovasMes !== null) {
      trendHtml = familiasNovasMes > 0
        ? `<div class="metric-trend up">↑ +${familiasNovasMes} este mês</div>`
        : `<div class="metric-trend">Nenhum cadastro novo este mês</div>`;
    }
    return `
      <div class="metric-card">
        <div class="metric-icon-label"><span class="emoji">${info.emoji}</span><span class="label">${escapeHtml(label)}</span></div>
        <div class="metric-value">${info.valor}</div>
        ${trendHtml}
      </div>
    `;
  }).join('');
}

// ----------------------------- Start --------------------------------------------
carregarDashboard();
