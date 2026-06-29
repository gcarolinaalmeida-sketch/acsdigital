/* ============================================================================
   auth.js - ACS Digital
   ----------------------------------------------------------------------------
   Inclua logo depois de config.js (e ANTES de branding.js/roteiro.js/scripts
   de página) em toda página que deve exigir login.

   IMPORTANTE - ORDEM DE ATIVAÇÃO (pra não trancar o acesso por engano):
     1. Crie pelo menos um usuário em Authentication > Users no painel do Supabase.
     2. Com o RLS ainda liberado pra "anon", confirme que o login funciona
        (abra login.html, entre com esse usuário, veja se cai no Dashboard).
     3. SÓ DEPOIS disso, rode o SQL de restrição de RLS (ver arquivo
        rls_restringir_autenticados.sql) pra exigir login de verdade.
============================================================================ */

// Verifica se existe uma sessão válida; se não houver, redireciona pro login.
// Retorna a sessão (ou null) - útil se a página quiser usar o e-mail do usuário.
async function protegerPagina() {
  try {
    const { data, error } = await db.auth.getSession();
    if (error || !data || !data.session) {
      const paginaAtual = window.location.pathname.split('/').pop();
      window.location.href = `login.html?retorno=${encodeURIComponent(paginaAtual)}`;
      return null;
    }
    return data.session;
  } catch (e) {
    console.error('Erro ao verificar sessão:', e);
    window.location.href = 'login.html';
    return null;
  }
}

async function fazerLogout() {
  try { await db.auth.signOut(); } catch (e) { console.error(e); }
  window.location.href = 'login.html';
}

// Adiciona o item "Sair" no fim do menu lateral, em todas as páginas que
// incluírem auth.js (evita repetir o HTML em cada arquivo .html).
function adicionarBotaoSair() {
  const nav = document.querySelector('.nav-links');
  if (!nav || document.getElementById('navSair')) return;
  const li = document.createElement('li');
  li.innerHTML = `<a href="#" id="navSair"><span class="nav-icon">🚪</span> Sair</a>`;
  nav.appendChild(li);
  document.getElementById('navSair').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Sair do ACS Digital?')) fazerLogout();
  });
}

document.addEventListener('DOMContentLoaded', adicionarBotaoSair);
