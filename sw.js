/* ============================================================================
   ACS Digital - Service Worker (Etapa 1: Roteiro + Nova Visita offline)
   ----------------------------------------------------------------------------
   Sem isso, o navegador não consegue nem ABRIR uma página que ainda não
   tinha sido carregada nesta sessão quando está sem internet — antes de
   qualquer JavaScript nosso rodar, o carregamento da própria página já
   falha. Este arquivo guarda uma cópia local das páginas/scripts do site
   pra que elas continuem abrindo mesmo sem sinal.

   IMPORTANTE: nunca intercepta chamadas para supabase.co nem métodos que
   não sejam GET — as chamadas reais ao banco precisam continuar falhando
   de verdade quando não há internet, pra que a lógica de cache/fila já
   existente em roteiro.js e offline.js funcione como esperado.
============================================================================ */

const CACHE_NAME = 'acsdigital-shell-v1';

// Páginas e scripts do próprio site (mesma origem) — cobertos pela Etapa 1.
const ASSETS_LOCAIS = [
  'meu-roteiro.html',
  'nova-visita.html',
  'config.js',
  'auth.js',
  'branding.js',
  'roteiro.js',
  'offline.js',
];

// Bibliotecas de terceiros (CDN) usadas nessas páginas — precisam ser
// cacheadas uma a uma em modo "no-cors", já que cache.addAll rejeita
// respostas opacas de origens diferentes.
const ASSETS_CDN = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/@phosphor-icons/web',
  'https://unpkg.com/lucide@latest',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.addAll(ASSETS_LOCAIS); } catch (e) { /* segue mesmo se algum arquivo local falhar */ }
    await Promise.all(ASSETS_CDN.map(async (url) => {
      try {
        const req = new Request(url, { mode: 'no-cors' });
        const res = await fetch(req);
        await cache.put(req, res);
      } catch (e) { /* sem internet na primeira instalação: tenta de novo em outra visita */ }
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca mexe em chamadas ao Supabase, nem em métodos que alteram dados —
  // isso é o que garante que a fila de pendências (offline.js) continue
  // funcionando exatamente como antes.
  if (event.request.method !== 'GET') return;
  if (url.hostname.endsWith('supabase.co')) return;

  event.respondWith((async () => {
    try {
      const resposta = await fetch(event.request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, resposta.clone()).catch(() => {});
      return resposta;
    } catch (e) {
      const cacheado = await caches.match(event.request);
      if (cacheado) return cacheado;
      throw e;
    }
  })());
});
