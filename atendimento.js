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
    var modelosOpts = '<option value="">Selecione (opcional)...</option>';
    if (typeof CATALOGO_MODELOS !== 'undefined') {
      Object.keys(CATALOGO_MODELOS).forEach(function(id) {
        modelosOpts += '<option value="' + CATALOGO_MODELOS[id].nome + '">' + CATALOGO_MODELOS[id].nome + '</option>';
      });
    }

    return '' +
      '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128221; Abertura de Atendimento</h2>' +
      '<form id="atForm" autocomplete="off">' +

        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Tipo de Atendimento</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:1 1 100%;">' +
              '<label for="atCategoria">Categoria *</label>' +
              '<select id="atCategoria" required>' +
                '<option value="">Selecione...</option>' +
                '<option value="Pos-venda">Pos-venda (Garantia, Assistencia, Pecas)</option>' +
                '<option value="Pre-venda">Pre-venda (Interesse, Cotacao)</option>' +
                '<option value="Outro">Outro (Reclamacao, Sugestao)</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="atMotivo">Motivo *</label>' +
              '<select id="atMotivo" required disabled>' +
                '<option value="">Selecione a categoria primeiro</option>' +
              '</select></div>' +
            '<div class="form-group"><label for="atOrigem">Origem *</label>' +
              '<select id="atOrigem" required>' +
                '<option value="">Selecione...</option>' +
                '<option value="WhatsApp">WhatsApp</option>' +
                '<option value="Telefone">Telefone</option>' +
                '<option value="Loja">Loja</option>' +
                '<option value="Site">Site</option>' +
                '<option value="Outro">Outro</option>' +
              '</select></div>' +
          '</div>' +
        '</div>' +

        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Cliente</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="atNome">Nome completo *</label>' +
              '<input type="text" id="atNome" required></div>' +
            '<div class="form-group"><label for="atTelefone">Telefone *</label>' +
              '<input type="text" id="atTelefone" placeholder="(00) 00000-0000" maxlength="15" required></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="atCpf">CPF / CNPJ (opcional)</label>' +
              '<input type="text" id="atCpf" placeholder="000.000.000-00"></div>' +
            '<div class="form-group" id="atNfRow" style="display:none;"><label for="atNotaFiscal">Nota Fiscal (NXT) *</label>' +
              '<input type="text" id="atNotaFiscal" placeholder="Numero da NF"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="atModelo">Modelo do Equipamento (opcional)</label>' +
              '<select id="atModelo">' + modelosOpts + '</select></div>' +
          '</div>' +
        '</div>' +

        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Descricao do Atendimento</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:1 1 100%;">' +
              '<label for="atDescricao">O que o cliente precisa? *</label>' +
              '<textarea id="atDescricao" rows="4" required></textarea>' +
            '</div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="atVendedor">Vendedor / Atendente *</label>' +
              '<input type="text" id="atVendedor" required></div>' +
          '</div>' +
        '</div>' +

        '<div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem;">' +
          '<button type="button" class="btn-secundario" id="btnLimparAt">Limpar</button>' +
          '<button type="button" class="btn-primario" id="btnAbrirAt">Abrir Atendimento &#10148;</button>' +
        '</div>' +

        '<div id="atFeedback" style="margin-top:1rem;"></div>' +
      '</form>';
  }

  function setupListeners() {
    // Placeholder — listeners reais nas proximas tasks
  }

})();
