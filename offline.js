/* ============================================================================
   ACS Digital - Camada Offline (Etapa 1: Meu Roteiro + Nova Visita)
   ----------------------------------------------------------------------------
   Duas responsabilidades:
   1) Fila de pendências: visitas registradas sem internet ficam guardadas
      aqui (localStorage) e são enviadas pro Supabase sozinhas assim que a
      conexão voltar.
   2) Indicador visual: injeta um badge fixo mostrando quantas pendências
      existem, em qualquer página que inclua este arquivo.
   Inclua este arquivo DEPOIS de config.js (precisa do "db").
============================================================================ */

const FILA_PENDENCIAS_KEY = 'acs_fila_pendencias_v1';

function lerFilaPendencias() {
  try { return JSON.parse(localStorage.getItem(FILA_PENDENCIAS_KEY)) || []; }
  catch (e) { return []; }
}

function salvarFilaPendencias(fila) {
  try { localStorage.setItem(FILA_PENDENCIAS_KEY, JSON.stringify(fila)); }
  catch (e) { /* localStorage indisponível — segue sem fila, mas não quebra a página */ }
}

function enfileirarVisitaPendente(payload) {
  const fila = lerFilaPendencias();
  fila.push({
    id: 'pend_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    payload,
    criadoEm: Date.now(),
    tentativas: 0,
  });
  salvarFilaPendencias(fila);
  atualizarBadgePendencias();
}

function contarPendencias() { return lerFilaPendencias().length; }

let _sincronizandoFila = false;

async function sincronizarFilaPendencias() {
  if (_sincronizandoFila) return;
  if (typeof db === 'undefined') return;
  const fila = lerFilaPendencias();
  if (fila.length === 0) return;

  _sincronizandoFila = true;
  const restantes = [];
  let enviadasComSucesso = 0;

  for (const item of fila) {
    try {
      const { error } = await db.from('visitas').insert(item.payload);
      if (error) throw error;
      enviadasComSucesso++;
    } catch (e) {
      item.tentativas = (item.tentativas || 0) + 1;
      restantes.push(item);
    }
  }

  salvarFilaPendencias(restantes);
  _sincronizandoFila = false;
  atualizarBadgePendencias();

  if (enviadasComSucesso > 0) _mostrarToastSincronizado(enviadasComSucesso);
}

function _mostrarToastSincronizado(qtd) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: #1F9D63; color: white; padding: 12px 20px; border-radius: 12px;
    font-size: 13.5px; font-weight: 600; z-index: 9999; box-shadow: 0 6px 20px rgba(0,0,0,0.15);
    display: flex; align-items: center; gap: 8px;
  `;
  toast.innerHTML = `✓ ${qtd} visita${qtd === 1 ? '' : 's'} pendente${qtd === 1 ? '' : 's'} sincronizada${qtd === 1 ? '' : 's'} com sucesso`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function injetarIndicadorPendencias() {
  if (document.getElementById('_badgePendencias')) return;
  const badge = document.createElement('div');
  badge.id = '_badgePendencias';
  badge.style.cssText = `
    position: fixed; top: 14px; right: 14px; z-index: 9998; display: none;
    align-items: center; gap: 7px; background: #C0791C; color: white;
    padding: 8px 14px; border-radius: 20px; font-size: 12.5px; font-weight: 700;
    box-shadow: 0 4px 14px rgba(0,0,0,0.15);
  `;
  badge.innerHTML = `<span style="width:7px; height:7px; border-radius:50%; background:white; display:inline-block;"></span> <span id="_badgePendenciasTexto"></span>`;
  document.body.appendChild(badge);
  atualizarBadgePendencias();
}

function atualizarBadgePendencias() {
  const badge = document.getElementById('_badgePendencias');
  if (!badge) return;
  const n = contarPendencias();
  const texto = document.getElementById('_badgePendenciasTexto');
  if (n > 0) {
    texto.textContent = `${n} visita${n === 1 ? '' : 's'} aguardando envio`;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

window.addEventListener('online', sincronizarFilaPendencias);
document.addEventListener('DOMContentLoaded', () => {
  injetarIndicadorPendencias();
  if (navigator.onLine) sincronizarFilaPendencias();
});
setInterval(() => { if (navigator.onLine) sincronizarFilaPendencias(); }, 30000);
