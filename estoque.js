/* ===== NXT SAC V2.13 - Estoque (Movimentacoes Fase E2) ===== */

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
        '<button class="tab-interna" data-subtab="inventario" style="background:none;border:none;color:#9a9a9a;padding:0.5rem 1rem;cursor:pointer;font-weight:600;">Invent&aacute;rio</button>' +
        '<button class="tab-interna" data-subtab="saldo" style="background:none;border:none;color:#9a9a9a;padding:0.5rem 1rem;cursor:pointer;font-weight:600;">Saldo</button>' +
      '</div>' +
      '<div id="subtab-content"></div>';
  }

  function setupListeners() {
    document.querySelectorAll('.tab-interna').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (btn.disabled) return;
        document.querySelectorAll('.tab-interna').forEach(function(b) {
          b.classList.remove('active');
          b.style.color = '#9a9a9a';
          b.style.borderBottom = '';
        });
        btn.classList.add('active');
        btn.style.color = 'var(--cor-primaria)';
        btn.style.borderBottom = '2px solid var(--cor-primaria)';
        renderSubtab(btn.dataset.subtab);
      });
    });
    renderSubtab('movimentar');
  }

  function renderSubtab(name) {
    var container = document.getElementById('subtab-content');
    if (!container) return;
    if (name === 'movimentar') {
      container.innerHTML = buildFormMovimentarHTML();
      setupFormMovimentar();
    } else if (name === 'inventario') {
      container.innerHTML = buildInventarioHTML();
      setupInventario();
    } else if (name === 'saldo') {
      container.innerHTML = buildSaldoHTML();
      setupSaldo();
    }
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
    if (submetendo) return;

    var dados = {
      tipo: document.getElementById('estTipo').value,
      armazem: document.getElementById('estArmazem').value,
      modelo: document.getElementById('estModelo').selectedOptions[0] ? document.getElementById('estModelo').selectedOptions[0].textContent : '',
      peca: document.getElementById('estPeca').value.trim(),
      quantidade: parseInt(document.getElementById('estQtd').value),
      origem: document.getElementById('estOrigem').value.trim(),
      operador: document.getElementById('estOperador').value.trim(),
      observacoes: document.getElementById('estObs').value.trim()
    };

    if (!dados.tipo) return mostrarFeedback('Selecione o tipo', 'erro');
    if (!dados.armazem) return mostrarFeedback('Selecione o armazem', 'erro');
    if (!dados.modelo) return mostrarFeedback('Selecione o modelo', 'erro');
    if (!dados.peca) return mostrarFeedback('Informe a peca', 'erro');
    if (isNaN(dados.quantidade) || dados.quantidade === 0) return mostrarFeedback('Quantidade invalida', 'erro');
    if (dados.tipo !== 'Ajuste' && dados.quantidade < 0) return mostrarFeedback('Quantidade deve ser positiva (use Ajuste para reduzir saldo)', 'erro');
    if (!dados.origem) return mostrarFeedback('Informe a origem', 'erro');
    if (!dados.operador) return mostrarFeedback('Informe o operador', 'erro');

    submetendo = true;
    var btn = document.getElementById('btnRegistrarEst');
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    mostrarFeedback('Registrando movimentacao...', 'info');

    var payload = Object.assign({ action: 'registrar_movimentacao' }, dados);

    fetch(resolverUrl(), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    })
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (resp && resp.sucesso) {
          saveOperador(dados.operador);
          mostrarSucessoMov(resp, dados);
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
        btn.innerHTML = 'Registrar &#10148;';
      });
  }

  function mostrarSucessoMov(resp, dados) {
    var saldoTxt = (typeof resp.saldoAtual === 'number') ? ' Saldo atual em ' + resp.armazem + ': ' + resp.saldoAtual + ' un.' : '';
    limparForm();
    mostrarFeedback('OK ' + resp.id + ' - ' + dados.tipo + ' ' + Math.abs(dados.quantidade) + ' un de ' + dados.peca + '.' + saldoTxt, 'sucesso');
  }

  function mostrarFeedback(msg, tipo) {
    var el = document.getElementById('estFeedback');
    if (!el) return;
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.75rem 1rem;border-radius:6px;text-align:center;font-weight:600;">' + msg + '</div>';
  }

  // ============================================================
  // Sub-tab Inventario (Fase E3) - contagem em lote por armazem
  // ============================================================

  function buildInventarioHTML() {
    return '' +
      '<form id="invForm" autocomplete="off">' +
        '<datalist id="estOperadoresList"></datalist>' +
        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Configura&ccedil;&atilde;o do Invent&aacute;rio</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label for="invArmazem">Armaz&eacute;m *</label>' +
              '<select id="invArmazem" required>' +
                '<option value="">Selecione...</option>' +
                '<option value="Sumare">Sumar&eacute;</option>' +
                '<option value="Jaragua">Jaragu&aacute;</option>' +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="invOperador">Operador *</label>' +
              '<input type="text" id="invOperador" list="estOperadoresList" placeholder="Quem est&aacute; contando?" required>' +
            '</div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:1 1 100%;">' +
              '<label for="invObservacao">Observa&ccedil;&atilde;o (opcional)</label>' +
              '<input type="text" id="invObservacao" placeholder="Ex: Invent&aacute;rio fim do trim. Q2">' +
            '</div>' +
          '</div>' +
          '<div class="form-row" style="margin-top:0.5rem;">' +
            '<button type="button" class="btn-secundario" id="btnCarregarInv">&#128270; Carregar pe&ccedil;as</button>' +
            '<span style="color:#9a9a9a;font-size:0.85rem;margin-left:1rem;align-self:center;">Selecione armaz&eacute;m + operador, depois carregue a lista de pe&ccedil;as.</span>' +
          '</div>' +
        '</div>' +

        '<div id="invListaContainer" style="display:none;">' +
          '<div class="secao-form">' +
            '<div class="secao-form-titulo">Contagem F&iacute;sica</div>' +
            '<div style="padding:0.5rem 1rem;color:#9a9a9a;font-size:0.85rem;">' +
              'Digite a quantidade <strong>contada fisicamente</strong> em cada pe&ccedil;a. Linhas com diferen&ccedil;a ser&atilde;o destacadas.' +
            '</div>' +
            '<div id="invLista" style="max-height:60vh;overflow-y:auto;"></div>' +
          '</div>' +
          '<div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem;align-items:center;">' +
            '<span id="invResumo" style="color:#9a9a9a;font-size:0.9rem;margin-right:auto;"></span>' +
            '<button type="button" class="btn-secundario" id="btnLimparInv">Limpar</button>' +
            '<button type="button" class="btn-primario" id="btnConfirmarInv">Confirmar invent&aacute;rio &#10148;</button>' +
          '</div>' +
        '</div>' +

        '<div id="invFeedback" style="margin-top:1rem;"></div>' +
      '</form>';
  }

  var invPecas = []; // [{modelo, peca, atual}]

  function setupInventario() {
    populateOperadoresDatalist();
    document.getElementById('btnCarregarInv').addEventListener('click', carregarInventario);
    document.getElementById('btnLimparInv').addEventListener('click', limparInventario);
    document.getElementById('btnConfirmarInv').addEventListener('click', confirmarInventario);
  }

  function carregarInventario() {
    var armazem = document.getElementById('invArmazem').value;
    var operador = document.getElementById('invOperador').value.trim();
    if (!armazem) return mostrarFeedbackInv('Selecione o armazem', 'erro');
    if (!operador) return mostrarFeedbackInv('Informe o operador', 'erro');

    mostrarFeedbackInv('Carregando saldos...', 'info');

    // 1. Pega saldos da aba Estoque
    var url = resolverUrl() + '?action=listar_estoque';
    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (!resp || !resp.sucesso) {
          return mostrarFeedbackInv('Erro carregando estoque', 'erro');
        }
        // 2. Monta lista de TODAS as pecas do catalogo
        invPecas = [];
        var saldoMap = {};
        (resp.estoque || []).forEach(function(it) {
          var key = String(it.modelo).toLowerCase() + '|' + String(it.peca).toLowerCase();
          saldoMap[key] = (armazem === 'Sumare') ? (it.sumare || 0) : (it.jaragua || 0);
        });
        if (typeof CATALOGO_MODELOS !== 'undefined') {
          Object.keys(CATALOGO_MODELOS).forEach(function(modelId) {
            var nome = CATALOGO_MODELOS[modelId].nome;
            var pecas = CATALOGO_MODELOS[modelId].pecas || [];
            pecas.forEach(function(p) {
              var key = nome.toLowerCase() + '|' + p.nome.toLowerCase();
              invPecas.push({
                modelo: nome,
                peca: p.nome,
                atual: saldoMap[key] || 0
              });
            });
          });
        }

        renderListaInventario();
        document.getElementById('invListaContainer').style.display = '';
        mostrarFeedbackInv('Lista carregada com ' + invPecas.length + ' pe&ccedil;as. Comece a contar.', 'sucesso');
      })
      .catch(function(err) {
        mostrarFeedbackInv('Erro de rede: ' + err.message, 'erro');
      });
  }

  function renderListaInventario() {
    var div = document.getElementById('invLista');
    if (!div) return;
    var html = '<table style="width:100%;border-collapse:collapse;">' +
      '<thead style="position:sticky;top:0;background:#1c1c1c;z-index:1;">' +
      '<tr style="border-bottom:1px solid #2a2a2a;">' +
        '<th style="padding:0.5rem;text-align:left;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Modelo</th>' +
        '<th style="padding:0.5rem;text-align:left;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Pe&ccedil;a</th>' +
        '<th style="padding:0.5rem;text-align:center;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Saldo</th>' +
        '<th style="padding:0.5rem;text-align:center;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Contado</th>' +
        '<th style="padding:0.5rem;text-align:center;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Dif.</th>' +
      '</tr>' +
      '</thead><tbody>';

    invPecas.forEach(function(it, idx) {
      html += '<tr data-idx="' + idx + '" style="border-bottom:1px solid #222;">' +
        '<td style="padding:0.5rem;font-size:0.85rem;">' + escapeHtmlEst(it.modelo) + '</td>' +
        '<td style="padding:0.5rem;font-size:0.85rem;">' + escapeHtmlEst(it.peca) + '</td>' +
        '<td style="padding:0.5rem;text-align:center;color:#9a9a9a;">' + it.atual + '</td>' +
        '<td style="padding:0.5rem;text-align:center;">' +
          '<input type="number" min="0" step="1" data-idx="' + idx + '" class="inv-contado" style="width:80px;background:#161616;color:#fff;border:1px solid #2a2a2a;border-radius:4px;padding:0.25rem;text-align:center;">' +
        '</td>' +
        '<td class="inv-dif" data-idx="' + idx + '" style="padding:0.5rem;text-align:center;font-weight:700;">-</td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    div.innerHTML = html;

    // Listeners de cada input contado
    div.querySelectorAll('.inv-contado').forEach(function(inp) {
      inp.addEventListener('input', atualizarDifLinha);
    });

    atualizarResumoInv();
  }

  function atualizarDifLinha(e) {
    var idx = parseInt(e.target.dataset.idx);
    var contado = parseInt(e.target.value);
    var atual = invPecas[idx].atual;
    var difCell = document.querySelector('.inv-dif[data-idx="' + idx + '"]');
    var row = e.target.closest('tr');
    if (isNaN(contado)) {
      difCell.textContent = '-';
      difCell.style.color = '#9a9a9a';
      row.style.background = '';
    } else {
      var dif = contado - atual;
      difCell.textContent = (dif > 0 ? '+' : '') + dif;
      if (dif === 0) {
        difCell.style.color = '#9a9a9a';
        row.style.background = '';
      } else if (dif > 0) {
        difCell.style.color = '#22c55e';
        row.style.background = 'rgba(34,197,94,0.08)';
      } else {
        difCell.style.color = '#ef4444';
        row.style.background = 'rgba(239,68,68,0.08)';
      }
    }
    atualizarResumoInv();
  }

  function atualizarResumoInv() {
    var preenchidos = 0;
    var comDif = 0;
    document.querySelectorAll('.inv-contado').forEach(function(inp) {
      if (inp.value.trim() !== '') preenchidos++;
      var idx = parseInt(inp.dataset.idx);
      var contado = parseInt(inp.value);
      if (!isNaN(contado) && contado !== invPecas[idx].atual) comDif++;
    });
    var resumo = document.getElementById('invResumo');
    if (resumo) {
      resumo.textContent = preenchidos + '/' + invPecas.length + ' contados, ' + comDif + ' com diferenca';
    }
  }

  function limparInventario() {
    document.querySelectorAll('.inv-contado').forEach(function(inp) {
      inp.value = '';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    mostrarFeedbackInv('', '');
  }

  function confirmarInventario() {
    var armazem = document.getElementById('invArmazem').value;
    var operador = document.getElementById('invOperador').value.trim();
    var observacao = document.getElementById('invObservacao').value.trim();

    var contagens = [];
    document.querySelectorAll('.inv-contado').forEach(function(inp) {
      var contado = parseInt(inp.value);
      if (isNaN(contado)) return;
      var idx = parseInt(inp.dataset.idx);
      contagens.push({
        modelo: invPecas[idx].modelo,
        peca: invPecas[idx].peca,
        contado: contado
      });
    });

    if (contagens.length === 0) {
      return mostrarFeedbackInv('Preencha pelo menos 1 pe&ccedil;a contada', 'erro');
    }

    if (!confirm('Confirmar inventário? ' + contagens.length + ' peças contadas. Peças com diferença serão ajustadas.')) return;

    var btn = document.getElementById('btnConfirmarInv');
    btn.disabled = true;
    btn.textContent = 'Processando...';
    mostrarFeedbackInv('Processando ' + contagens.length + ' contagens...', 'info');

    fetch(resolverUrl(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'registrar_inventario_lote',
        armazem: armazem,
        operador: operador,
        observacao: observacao,
        contagens: contagens
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    })
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (resp && resp.sucesso) {
          saveOperador(operador);
          mostrarFeedbackInv('Invent&aacute;rio conclu&iacute;do: ' + resp.totalAjustes + ' ajustes feitos, ' + resp.totalUnidadesMovidas + ' un movidas.', 'sucesso');
          document.getElementById('invListaContainer').style.display = 'none';
          invPecas = [];
        } else {
          mostrarFeedbackInv('Erro: ' + (resp && resp.erro ? resp.erro : 'resposta invalida'), 'erro');
        }
      })
      .catch(function(err) {
        mostrarFeedbackInv('Erro de rede: ' + err.message, 'erro');
      })
      .finally(function() {
        btn.disabled = false;
        btn.innerHTML = 'Confirmar invent&aacute;rio &#10148;';
      });
  }

  function mostrarFeedbackInv(msg, tipo) {
    var el = document.getElementById('invFeedback');
    if (!el) return;
    if (!msg) { el.innerHTML = ''; return; }
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.75rem 1rem;border-radius:6px;text-align:center;font-weight:600;">' + msg + '</div>';
  }

  function escapeHtmlEst(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ============================================================
  // SUB-TAB SALDO (Fase E5)
  // ============================================================

  var saldosCache = []; // [{ modelo, peca, sumare, jaragua, ultimaAtualizacao }]

  function buildSaldoHTML() {
    return '' +
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Saldo Atual</div>' +
        '<div class="form-row" style="align-items:flex-end;">' +
          '<div class="form-group">' +
            '<label for="saldoModelo">Filtrar por modelo</label>' +
            '<select id="saldoModelo">' +
              '<option value="">Todos</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group" style="flex:2 1 200px;">' +
            '<label for="saldoBusca">Buscar pe&ccedil;a</label>' +
            '<input type="text" id="saldoBusca" placeholder="Digite para filtrar...">' +
          '</div>' +
          '<div class="form-group" style="flex:0 0 auto;">' +
            '<label for="saldoFiltroStatus">Status</label>' +
            '<select id="saldoFiltroStatus">' +
              '<option value="todos">Todos</option>' +
              '<option value="comSaldo">S&oacute; com saldo</option>' +
              '<option value="zerados">S&oacute; zerados</option>' +
              '<option value="negativos">S&oacute; negativos</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group" style="flex:0 0 auto;">' +
            '<button type="button" class="btn-secundario" id="btnRefreshSaldo">&#x21bb; Atualizar</button>' +
          '</div>' +
        '</div>' +
        '<div id="saldoResumo" style="padding:0.5rem 1rem;color:#9a9a9a;font-size:0.85rem;"></div>' +
        '<div id="saldoLista" style="max-height:65vh;overflow-y:auto;"></div>' +
      '</div>' +
      '<div id="saldoFeedback" style="margin-top:1rem;"></div>';
  }

  function setupSaldo() {
    // Popular dropdown de modelos
    var modeloSel = document.getElementById('saldoModelo');
    if (modeloSel && typeof CATALOGO_MODELOS !== 'undefined') {
      Object.keys(CATALOGO_MODELOS).forEach(function(id) {
        var opt = document.createElement('option');
        opt.value = CATALOGO_MODELOS[id].nome;
        opt.textContent = CATALOGO_MODELOS[id].nome;
        modeloSel.appendChild(opt);
      });
    }

    document.getElementById('btnRefreshSaldo').addEventListener('click', carregarSaldos);
    document.getElementById('saldoModelo').addEventListener('change', filtrarSaldos);
    document.getElementById('saldoBusca').addEventListener('input', filtrarSaldos);
    document.getElementById('saldoFiltroStatus').addEventListener('change', filtrarSaldos);

    carregarSaldos();
  }

  function carregarSaldos() {
    mostrarFeedbackSaldo('Carregando saldos...', 'info');
    var url = resolverUrl() + '?action=listar_estoque';
    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (!resp || !resp.sucesso) {
          return mostrarFeedbackSaldo('Erro carregando estoque', 'erro');
        }
        saldosCache = resp.estoque || [];
        filtrarSaldos();
        mostrarFeedbackSaldo('', '');
      })
      .catch(function(err) {
        mostrarFeedbackSaldo('Erro de rede: ' + err.message, 'erro');
      });
  }

  function filtrarSaldos() {
    var modeloFiltro = (document.getElementById('saldoModelo').value || '').toLowerCase();
    var busca = (document.getElementById('saldoBusca').value || '').toLowerCase().trim();
    var status = document.getElementById('saldoFiltroStatus').value;

    var filtrados = saldosCache.filter(function(it) {
      var total = (parseInt(it.sumare) || 0) + (parseInt(it.jaragua) || 0);
      if (modeloFiltro && String(it.modelo).toLowerCase() !== modeloFiltro) return false;
      if (busca && String(it.peca).toLowerCase().indexOf(busca) === -1) return false;
      if (status === 'comSaldo' && total === 0) return false;
      if (status === 'zerados' && total !== 0) return false;
      if (status === 'negativos') {
        if ((parseInt(it.sumare) || 0) >= 0 && (parseInt(it.jaragua) || 0) >= 0) return false;
      }
      return true;
    });

    renderSaldos(filtrados);
  }

  function renderSaldos(lista) {
    var div = document.getElementById('saldoLista');
    var resumo = document.getElementById('saldoResumo');
    if (!div) return;

    if (lista.length === 0) {
      div.innerHTML = '<div style="padding:2rem;text-align:center;color:#9a9a9a;">Nenhuma pe&ccedil;a encontrada com esses filtros.</div>';
      if (resumo) resumo.textContent = '0 pe&ccedil;as';
      return;
    }

    var totalSumare = 0, totalJaragua = 0;
    lista.forEach(function(it) {
      totalSumare += parseInt(it.sumare) || 0;
      totalJaragua += parseInt(it.jaragua) || 0;
    });

    if (resumo) {
      resumo.innerHTML = lista.length + ' pe&ccedil;as | Sumar&eacute;: <strong>' + totalSumare + '</strong> | Jaragu&aacute;: <strong>' + totalJaragua + '</strong> | Total: <strong>' + (totalSumare + totalJaragua) + '</strong>';
    }

    var html = '<table style="width:100%;border-collapse:collapse;">' +
      '<thead style="position:sticky;top:0;background:#1c1c1c;z-index:1;">' +
      '<tr style="border-bottom:1px solid #2a2a2a;">' +
        '<th style="padding:0.5rem;text-align:left;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Modelo</th>' +
        '<th style="padding:0.5rem;text-align:left;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Pe&ccedil;a</th>' +
        '<th style="padding:0.5rem;text-align:center;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Sumar&eacute;</th>' +
        '<th style="padding:0.5rem;text-align:center;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Jaragu&aacute;</th>' +
        '<th style="padding:0.5rem;text-align:center;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Total</th>' +
      '</tr>' +
      '</thead><tbody>';

    lista.forEach(function(it) {
      var sumare = parseInt(it.sumare) || 0;
      var jaragua = parseInt(it.jaragua) || 0;
      var total = sumare + jaragua;
      var corS = sumare < 0 ? '#ef4444' : (sumare === 0 ? '#5a5a5a' : '#fff');
      var corJ = jaragua < 0 ? '#ef4444' : (jaragua === 0 ? '#5a5a5a' : '#fff');
      html += '<tr style="border-bottom:1px solid #222;">' +
        '<td style="padding:0.5rem;font-size:0.85rem;">' + escapeHtmlEst(it.modelo) + '</td>' +
        '<td style="padding:0.5rem;font-size:0.85rem;">' + escapeHtmlEst(it.peca) + '</td>' +
        '<td style="padding:0.5rem;text-align:center;color:' + corS + ';font-weight:600;">' + sumare + '</td>' +
        '<td style="padding:0.5rem;text-align:center;color:' + corJ + ';font-weight:600;">' + jaragua + '</td>' +
        '<td style="padding:0.5rem;text-align:center;color:' + (total < 0 ? '#ef4444' : 'var(--cor-primaria)') + ';font-weight:700;">' + total + '</td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    div.innerHTML = html;
  }

  function mostrarFeedbackSaldo(msg, tipo) {
    var el = document.getElementById('saldoFeedback');
    if (!el) return;
    if (!msg) { el.innerHTML = ''; return; }
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.75rem 1rem;border-radius:6px;text-align:center;font-weight:600;">' + msg + '</div>';
  }

})();
