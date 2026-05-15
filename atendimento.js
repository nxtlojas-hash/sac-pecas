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

  var MOTIVOS_POR_CATEGORIA = {
    'Pos-venda': ['Garantia', 'Assistencia tecnica', 'Pecas / reposicao', 'Duvida sobre uso', 'Reclamacao'],
    'Pre-venda': ['Interesse em compra', 'Cotacao', 'Duvida sobre modelo', 'Agendar visita / test-ride'],
    'Outro':     ['Reclamacao geral', 'Sugestao', 'Elogio', 'Outro']
  };

  function setupListeners() {
    var tel = document.getElementById('atTelefone');
    if (tel && typeof aplicarMascaraTelefone === 'function') aplicarMascaraTelefone(tel);

    var cpf = document.getElementById('atCpf');
    if (cpf && typeof aplicarMascaraCPF === 'function') aplicarMascaraCPF(cpf);

    var cat = document.getElementById('atCategoria');
    if (cat) {
      cat.addEventListener('change', function() {
        popularMotivos(cat.value);
        toggleNF(cat.value);
      });
    }

    document.getElementById('btnLimparAt').addEventListener('click', limparForm);
    document.getElementById('btnAbrirAt').addEventListener('click', abrirAtendimento);
  }

  function popularMotivos(categoria) {
    var sel = document.getElementById('atMotivo');
    sel.innerHTML = '';
    if (!categoria || !MOTIVOS_POR_CATEGORIA[categoria]) {
      sel.disabled = true;
      sel.innerHTML = '<option value="">Selecione a categoria primeiro</option>';
      return;
    }
    sel.disabled = false;
    sel.innerHTML = '<option value="">Selecione...</option>';
    MOTIVOS_POR_CATEGORIA[categoria].forEach(function(m) {
      var opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      sel.appendChild(opt);
    });
  }

  function toggleNF(categoria) {
    var row = document.getElementById('atNfRow');
    var input = document.getElementById('atNotaFiscal');
    if (categoria === 'Pos-venda') {
      row.style.display = '';
      input.required = true;
    } else {
      row.style.display = 'none';
      input.required = false;
      input.value = '';
    }
  }

  function limparForm() {
    document.getElementById('atForm').reset();
    toggleNF('');
    popularMotivos('');
    var fb = document.getElementById('atFeedback');
    if (fb) fb.innerHTML = '';
  }

  function abrirAtendimento() {
    if (submetendo) return;

    var dados = {
      categoria: document.getElementById('atCategoria').value,
      motivo: document.getElementById('atMotivo').value,
      origem: document.getElementById('atOrigem').value,
      nomeCliente: document.getElementById('atNome').value.trim(),
      telefone: document.getElementById('atTelefone').value.trim(),
      cpfCnpj: document.getElementById('atCpf').value.trim(),
      notaFiscal: document.getElementById('atNotaFiscal').value.trim(),
      modeloEquipamento: document.getElementById('atModelo').value,
      descricao: document.getElementById('atDescricao').value.trim(),
      vendedor: document.getElementById('atVendedor').value.trim()
    };

    if (!dados.categoria) return mostrarFeedback('Selecione a categoria', 'erro');
    if (!dados.motivo) return mostrarFeedback('Selecione o motivo', 'erro');
    if (!dados.origem) return mostrarFeedback('Selecione a origem', 'erro');
    if (!dados.nomeCliente) return mostrarFeedback('Informe o nome do cliente', 'erro');
    if (!dados.telefone || dados.telefone.replace(/\D/g, '').length < 10) {
      return mostrarFeedback('Telefone invalido', 'erro');
    }
    if (!dados.descricao) return mostrarFeedback('Descreva o atendimento', 'erro');
    if (!dados.vendedor) return mostrarFeedback('Informe o vendedor/atendente', 'erro');
    if (dados.categoria === 'Pos-venda' && !dados.notaFiscal) {
      return mostrarFeedback('Nota fiscal e obrigatoria em pos-venda', 'erro');
    }

    submetendo = true;
    var btn = document.getElementById('btnAbrirAt');
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    mostrarFeedback('Abrindo atendimento...', 'info');

    var payload = Object.assign({ action: 'registrar_atendimento' }, dados);

    fetch(resolverUrl(), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    })
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (resp && resp.sucesso) {
          mostrarSucesso(resp.id, dados);
        } else {
          mostrarFeedback('Erro: ' + (resp && resp.erro ? resp.erro : 'resposta invalida'), 'erro');
        }
      })
      .catch(function(err) {
        mostrarFeedback('Erro de rede: ' + err.message, 'erro');
      })
      .finally(function() {
        submetendo = false;
        btn.disabled = false;
        btn.innerHTML = 'Abrir Atendimento &#10148;';
      });
  }

  function mostrarFeedback(msg, tipo) {
    var el = document.getElementById('atFeedback');
    if (!el) return;
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.75rem 1rem;border-radius:6px;text-align:center;font-weight:600;">' + msg + '</div>';
  }

  function mostrarSucesso(id, dados) {
    // Implementado na Task 1.6
    mostrarFeedback('Atendimento aberto! Protocolo: ' + id, 'sucesso');
    limparForm();
  }

})();
