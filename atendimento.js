/* ===== NXT SAC V2.5 - Atendimento (Fase 1) ===== */

(function() {
  var SCRIPT_URL = null;
  function resolverUrl() {
    if (SCRIPT_URL) return SCRIPT_URL;
    if (typeof GOOGLE_SCRIPT_URL !== 'undefined') {
      SCRIPT_URL = GOOGLE_SCRIPT_URL;
      return SCRIPT_URL;
    }
    throw new Error('GOOGLE_SCRIPT_URL nao definida — carregar formulario.js primeiro.');
  }

  var submetendo = false;

  window.initAtendimento = function() {
    var container = document.getElementById('atendimento-container');
    if (!container) return;
    container.innerHTML = buildFormHTML();
    setupListeners();
    console.log('Atendimento (Fase 1) inicializado');
  };

  function buildFormHTML() {
    return '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128221; Abertura de Atendimento</h2>' +
      '<p style="color:#9a9a9a;padding:1rem;">Form em construcao...</p>';
  }

  function setupListeners() {
    // Placeholder — listeners reais nas proximas tasks
  }

})();
