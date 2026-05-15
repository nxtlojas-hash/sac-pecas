/* ===== NXT SAC V2.6 - Estoque (Movimentacoes Fase E2) ===== */

(function() {
  var SCRIPT_URL = null;
  function resolverUrl() {
    if (SCRIPT_URL) return SCRIPT_URL;
    if (typeof GOOGLE_SCRIPT_URL !== 'undefined') {
      SCRIPT_URL = GOOGLE_SCRIPT_URL;
      return SCRIPT_URL;
    }
    throw new Error('GOOGLE_SCRIPT_URL nao definida - carregar formulario.js primeiro.');
  }

  var submetendo = false;
  var LS_OPERADORES = 'nxt-estoque-operadores';

  window.initEstoque = function() {
    var container = document.getElementById('estoque-container');
    if (!container) return;
    container.innerHTML = buildHTML();
    setupListeners();
    console.log('Estoque (Fase E2) inicializado');
  };

  function buildHTML() {
    return '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128230; Estoque de Pe&ccedil;as</h2>' +
      '<div class="tabs-internas" style="display:flex;gap:0.5rem;margin-bottom:1rem;border-bottom:1px solid #2a2a2a;">' +
        '<button class="tab-interna active" data-subtab="movimentar" style="background:none;border:none;color:var(--cor-primaria);padding:0.5rem 1rem;border-bottom:2px solid var(--cor-primaria);cursor:pointer;font-weight:600;">Movimentar</button>' +
        '<button class="tab-interna" data-subtab="saldo" disabled style="background:none;border:none;color:#5a5a5a;padding:0.5rem 1rem;cursor:not-allowed;">Saldo (em breve)</button>' +
        '<button class="tab-interna" data-subtab="inventario" disabled style="background:none;border:none;color:#5a5a5a;padding:0.5rem 1rem;cursor:not-allowed;">Invent&aacute;rio (em breve)</button>' +
      '</div>' +
      '<div id="subtab-movimentar"></div>';
  }

  function setupListeners() {
    document.getElementById('subtab-movimentar').innerHTML = buildFormMovimentarHTML();
    setupFormMovimentar();
  }

  function buildFormMovimentarHTML() {
    return '<p style="color:#9a9a9a;padding:1rem;">Form em construcao...</p>';
  }

  function setupFormMovimentar() {
    // Placeholder - implementado nas proximas tasks
  }

})();
