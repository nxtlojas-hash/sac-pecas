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
    var modelosOpts = '<option value="">Selecione...</option>';
    if (typeof CATALOGO_MODELOS !== 'undefined') {
      Object.keys(CATALOGO_MODELOS).forEach(function(id) {
        modelosOpts += '<option value="' + id + '">' + CATALOGO_MODELOS[id].nome + '</option>';
      });
    }

    return '' +
      '<form id="estForm" autocomplete="off">' +
        '<datalist id="estOperadoresList"></datalist>' +

        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Movimenta&ccedil;&atilde;o</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label for="estTipo">Tipo *</label>' +
              '<select id="estTipo" required>' +
                '<option value="">Selecione...</option>' +
                '<option value="Entrada">Entrada</option>' +
                '<option value="Saida">Sa&iacute;da</option>' +
                '<option value="Ajuste">Ajuste</option>' +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="estArmazem">Armaz&eacute;m *</label>' +
              '<select id="estArmazem" required>' +
                '<option value="">Selecione...</option>' +
                '<option value="Sumare">Sumar&eacute;</option>' +
                '<option value="Jaragua">Jaragu&aacute;</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Pe&ccedil;a</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label for="estModelo">Modelo *</label>' +
              '<select id="estModelo" required>' + modelosOpts + '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="estPeca">Pe&ccedil;a *</label>' +
              '<input type="text" id="estPeca" list="estPecasList" placeholder="Digite ou selecione" required>' +
              '<datalist id="estPecasList"></datalist>' +
            '</div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label for="estQtd">Quantidade *</label>' +
              '<input type="number" id="estQtd" min="1" step="1" required>' +
              '<span class="campo-aviso" style="display:none;color:#9a9a9a;font-size:0.85rem;" id="estDicaAjuste">Em Ajuste, use negativo (-N) para reduzir saldo.</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Origem e Operador</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:2 1 320px;">' +
              '<label for="estOrigem">Origem *</label>' +
              '<input type="text" id="estOrigem" list="estOrigensList" placeholder="Ex: Desmontagem moto NXT123 / Compra fornecedor / Perda" required>' +
              '<datalist id="estOrigensList">' +
                '<option value="Desmontagem moto">' +
                '<option value="Compra fornecedor">' +
                '<option value="Devolucao cliente">' +
                '<option value="Invent&aacute;rio inicial">' +
                '<option value="Perda">' +
                '<option value="Encontrado">' +
                '<option value="Ajuste manual">' +
              '</datalist>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="estOperador">Operador *</label>' +
              '<input type="text" id="estOperador" list="estOperadoresList" placeholder="Quem registrou?" required>' +
            '</div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:1 1 100%;">' +
              '<label for="estObs">Observa&ccedil;&otilde;es</label>' +
              '<textarea id="estObs" rows="2" placeholder="Opcional"></textarea>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem;">' +
          '<button type="button" class="btn-secundario" id="btnLimparEst">Limpar</button>' +
          '<button type="button" class="btn-primario" id="btnRegistrarEst">Registrar &#10148;</button>' +
        '</div>' +

        '<div id="estFeedback" style="margin-top:1rem;"></div>' +
      '</form>';
  }

  function setupFormMovimentar() {
    populateOperadoresDatalist();

    // Modelo muda -> popula datalist de pecas
    var modeloSel = document.getElementById('estModelo');
    if (modeloSel) {
      modeloSel.addEventListener('change', function() {
        popularDatalistPecas(modeloSel.value);
      });
    }

    // Tipo Ajuste -> mostra dica
    var tipoSel = document.getElementById('estTipo');
    var dica = document.getElementById('estDicaAjuste');
    if (tipoSel && dica) {
      tipoSel.addEventListener('change', function() {
        dica.style.display = (tipoSel.value === 'Ajuste') ? '' : 'none';
        // Em Ajuste, permite negativos no input quantidade
        var qtdInput = document.getElementById('estQtd');
        if (tipoSel.value === 'Ajuste') {
          qtdInput.removeAttribute('min');
        } else {
          qtdInput.setAttribute('min', '1');
        }
      });
    }

    document.getElementById('btnLimparEst').addEventListener('click', limparForm);
    document.getElementById('btnRegistrarEst').addEventListener('click', registrarMov);
  }

  function popularDatalistPecas(modelId) {
    var datalist = document.getElementById('estPecasList');
    if (!datalist) return;
    datalist.innerHTML = '';
    if (!modelId || typeof CATALOGO_MODELOS === 'undefined' || !CATALOGO_MODELOS[modelId]) return;
    var pecas = CATALOGO_MODELOS[modelId].pecas || [];
    pecas.forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p.nome;
      datalist.appendChild(opt);
    });
  }

  function getOperadores() {
    try {
      return JSON.parse(localStorage.getItem(LS_OPERADORES) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveOperador(nome) {
    var trimmed = (nome || '').trim();
    if (!trimmed) return;
    var lista = getOperadores();
    var existe = lista.some(function(n) { return n.toLowerCase() === trimmed.toLowerCase(); });
    if (existe) return;
    lista.push(trimmed);
    lista.sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); });
    localStorage.setItem(LS_OPERADORES, JSON.stringify(lista));
    populateOperadoresDatalist();
  }

  function populateOperadoresDatalist() {
    var dl = document.getElementById('estOperadoresList');
    if (!dl) return;
    dl.innerHTML = '';
    getOperadores().forEach(function(n) {
      var opt = document.createElement('option');
      opt.value = n;
      dl.appendChild(opt);
    });
  }

  function limparForm() {
    document.getElementById('estForm').reset();
    document.getElementById('estPecasList').innerHTML = '';
    document.getElementById('estDicaAjuste').style.display = 'none';
    document.getElementById('estQtd').setAttribute('min', '1');
    var fb = document.getElementById('estFeedback');
    if (fb) fb.innerHTML = '';
  }

  function registrarMov() {
    // Placeholder - implementado na Task E2.5
    console.log('registrarMov ainda nao implementado');
  }

  function mostrarFeedback(msg, tipo) {
    var el = document.getElementById('estFeedback');
    if (!el) return;
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.75rem 1rem;border-radius:6px;text-align:center;font-weight:600;">' + msg + '</div>';
  }

})();
