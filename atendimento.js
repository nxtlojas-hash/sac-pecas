/* ===== NXT SAC V2.24 - Atendimento (Wizard Fase 2c-2f) ===== */

(function() {
  var SCRIPT_URL = null;
  function resolverUrl() {
    if (SCRIPT_URL) return SCRIPT_URL;
    if (typeof GOOGLE_SCRIPT_URL !== 'undefined') {
      SCRIPT_URL = GOOGLE_SCRIPT_URL;
      return SCRIPT_URL;
    }
    throw new Error('GOOGLE_SCRIPT_URL nao definida.');
  }

  var passo = 1;                  // 1..5
  var dados = {};                 // estado consolidado do wizard
  var clienteEncontrado = null;   // cliente identificado no passo 1 (ou null se novo)
  var motoSelecionada = null;     // moto da aba Motos Cliente vinculada no passo 1 (ou null)
  var submetendo = false;

  var MOTIVOS_POR_CATEGORIA = {
    'Pos-venda': ['Garantia', 'Assistencia tecnica', 'Pecas / reposicao', 'Duvida sobre uso', 'Reclamacao'],
    'Pre-venda': ['Interesse em compra', 'Cotacao', 'Duvida sobre modelo', 'Agendar visita / test-ride'],
    'Outro':     ['Reclamacao geral', 'Sugestao', 'Elogio', 'Outro']
  };

  window.initAtendimento = function() {
    var container = document.getElementById('atendimento-container');
    if (!container) return;
    passo = 1;
    dados = { acoes: [] };
    clienteEncontrado = null;
    motoSelecionada = null;

    // Se veio da aba Clientes com preFill, ja popula passo 1
    if (window.__preFillAtendimento) {
      dados.cliente = {
        nome: window.__preFillAtendimento.nome || '',
        telefone: window.__preFillAtendimento.telefone || '',
        cpfCnpj: window.__preFillAtendimento.cpfCnpj || '',
        notaFiscal: window.__preFillAtendimento.notaFiscal || '',
        modelo: window.__preFillAtendimento.modelo || ''
      };
      window.__preFillAtendimento = null;
    }

    container.innerHTML = buildShell();
    renderPasso();
    console.log('Atendimento Wizard inicializado');
  };

  function buildShell() {
    return '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128221; Novo Atendimento</h2>' +
      '<div id="atStepper" style="display:flex;gap:0.25rem;margin-bottom:1.5rem;"></div>' +
      '<div id="atPassoContainer"></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:1.5rem;gap:0.5rem;">' +
        '<button type="button" class="btn-secundario" id="btnVoltarPasso" style="visibility:hidden;">&larr; Voltar</button>' +
        '<button type="button" class="btn-primario" id="btnProxPasso">Pr&oacute;ximo &rarr;</button>' +
      '</div>' +
      '<div id="atFeedback" style="margin-top:1rem;"></div>';
  }

  function renderPasso() {
    renderStepper();
    var container = document.getElementById('atPassoContainer');
    if (passo === 1) container.innerHTML = htmlPasso1();
    else if (passo === 2) container.innerHTML = htmlPasso2();
    else if (passo === 3) container.innerHTML = htmlPasso3();
    else if (passo === 4) container.innerHTML = htmlPasso4();
    else if (passo === 5) container.innerHTML = htmlPasso5();

    document.getElementById('btnVoltarPasso').style.visibility = (passo > 1 && passo < 5) ? 'visible' : 'hidden';
    document.getElementById('btnProxPasso').textContent = passo === 4 ? 'Revisar e fechar →' : (passo === 5 ? '✓ Salvar atendimento' : 'Próximo →');
    document.getElementById('btnProxPasso').onclick = avancarPasso;
    document.getElementById('btnVoltarPasso').onclick = voltarPasso;

    if (passo === 1) bindPasso1();
    else if (passo === 2) bindPasso2();
    else if (passo === 3) bindPasso3();
    else if (passo === 4) bindPasso4();
    else if (passo === 5) bindPasso5();
  }

  function renderStepper() {
    var labels = ['Cliente', 'Motivo', 'A&ccedil;&otilde;es', 'Preenchimento', 'Fechamento'];
    var html = labels.map(function(label, i) {
      var idx = i + 1;
      var ativo = idx === passo;
      var feito = idx < passo;
      var bg = ativo ? 'var(--cor-primaria)' : (feito ? '#22c55e' : '#252540');
      var cor = ativo || feito ? '#0f0f1a' : '#9a9a9a';
      return '<div style="flex:1;padding:0.5rem 0.75rem;background:' + bg + ';color:' + cor + ';border-radius:6px;font-size:0.8rem;font-weight:600;text-align:center;">' + idx + '. ' + label + '</div>';
    }).join('');
    document.getElementById('atStepper').innerHTML = html;
  }

  // ============================================================
  // PASSO 1: Cliente
  // ============================================================
  function htmlPasso1() {
    return '<div class="secao-form">' +
        '<div class="secao-form-titulo">Identificar cliente</div>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:3 1 300px;">' +
            '<label for="p1Busca">CPF / Telefone / Nome</label>' +
            '<input type="text" id="p1Busca" placeholder="Digite CPF, telefone ou nome..." autocomplete="off">' +
          '</div>' +
          '<div class="form-group" style="flex:0 0 auto;">' +
            '<button type="button" class="btn-secundario" id="p1BtnBuscar">&#128269; Buscar</button>' +
          '</div>' +
        '</div>' +
        '<div id="p1Resultado" style="margin-top:0.5rem;"></div>' +
      '</div>' +

      '<div class="secao-form" id="p1FormCliente" style="display:none;">' +
        '<div class="secao-form-titulo">Dados do cliente</div>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:2 1 300px;">' +
            '<label for="p1Nome">Nome completo *</label>' +
            '<input type="text" id="p1Nome" required>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="p1Tel">Telefone *</label>' +
            '<input type="text" id="p1Tel" placeholder="(00) 00000-0000" required>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="p1Cpf">CPF / CNPJ (opcional)</label>' +
            '<input type="text" id="p1Cpf" placeholder="000.000.000-00">' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="p1Nf">Nota Fiscal (opcional)</label>' +
            '<input type="text" id="p1Nf" placeholder="N&uacute;mero da NF">' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="p1Modelo">Modelo do equipamento (opcional)</label>' +
            '<select id="p1Modelo"><option value="">Selecione...</option></select>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="secao-form" id="p1MotosSecao" style="display:none;">' +
        '<div class="secao-form-titulo">Motos do cliente</div>' +
        '<div id="p1Motos"></div>' +
      '</div>';
  }

  function bindPasso1() {
    // Restaurar valores se voltou pro passo
    if (dados.cliente) {
      document.getElementById('p1FormCliente').style.display = '';
      var c = dados.cliente;
      setVal('p1Nome', c.nome);
      setVal('p1Tel', c.telefone);
      setVal('p1Cpf', c.cpfCnpj);
      setVal('p1Nf', c.notaFiscal);
      popularModelosP1(c.modelo);
      buscarMotosP1(c.telefone, c.cpfCnpj);
    } else {
      popularModelosP1('');
    }

    document.getElementById('p1BtnBuscar').addEventListener('click', buscarClienteP1);
    document.getElementById('p1Busca').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); buscarClienteP1(); }
    });
  }

  function popularModelosP1(selecionado) {
    var sel = document.getElementById('p1Modelo');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione...</option>';
    if (typeof CATALOGO_MODELOS !== 'undefined') {
      Object.keys(CATALOGO_MODELOS).forEach(function(id) {
        var opt = document.createElement('option');
        opt.value = CATALOGO_MODELOS[id].nome;
        opt.textContent = CATALOGO_MODELOS[id].nome;
        if (selecionado && selecionado === CATALOGO_MODELOS[id].nome) opt.selected = true;
        sel.appendChild(opt);
      });
    }
  }

  function buscarClienteP1() {
    var q = (document.getElementById('p1Busca').value || '').trim();
    if (!q) return mostrarFeedback('Digite CPF, telefone ou nome', 'erro');

    var soDigitos = q.replace(/\D/g, '');
    var params = [];
    if (soDigitos.length === 11 || soDigitos.length === 14) {
      params.push('cpf=' + encodeURIComponent(soDigitos));
    } else if (soDigitos.length >= 10) {
      params.push('telefone=' + encodeURIComponent(soDigitos));
    } else {
      params.push('nome=' + encodeURIComponent(q));
    }

    mostrarFeedback('Buscando...', 'info');
    fetch(resolverUrl() + '?action=buscar_cliente_consolidado&' + params.join('&'))
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        var resDiv = document.getElementById('p1Resultado');
        if (!resp || !resp.sucesso || !resp.clientes || resp.clientes.length === 0) {
          resDiv.innerHTML = '<p style="color:#9a9a9a;font-size:0.85rem;padding:0.5rem;">Nenhum cliente encontrado. Cadastre como novo abaixo:</p>';
          document.getElementById('p1FormCliente').style.display = '';
          // Pre-preenche nome se busca foi nome
          if (!soDigitos.length) setVal('p1Nome', q);
          mostrarFeedback('', '');
          return;
        }
        resDiv.innerHTML = resp.clientes.map(function(c, idx) {
          var cpf = c.cpfs[0] || '';
          var tel = c.telefones[0] || '';
          var nf = c.nfs[0] || '';
          return '<div class="p1-cliente-card" style="margin:0.5rem 0;background:#1c1c1c;padding:0.75rem;border-radius:6px;cursor:pointer;border:1px solid #2a2a2a;transition:all 0.15s;" data-idx="' + idx + '" onmouseover="this.style.borderColor=&quot;#c6ff00&quot;;this.style.background=&quot;#22221a&quot;" onmouseout="this.style.borderColor=&quot;#2a2a2a&quot;;this.style.background=&quot;#1c1c1c&quot;">' +
            '<div style="font-weight:700;color:#fff;">' + escapeHtmlAt(c.nome) + '</div>' +
            '<div style="font-size:0.8rem;color:#9a9a9a;margin-top:0.25rem;">' +
              (cpf ? 'CPF: ' + cpf + ' &bull; ' : '') +
              (tel ? 'Tel: ' + formatarTel(tel) + ' &bull; ' : '') +
              c.totalEventos + ' eventos' +
            '</div>' +
          '</div>';
        }).join('');

        // Bind clicks
        resDiv.querySelectorAll('.p1-cliente-card').forEach(function(card) {
          card.addEventListener('click', function() {
            var idx = parseInt(card.dataset.idx);
            var c = resp.clientes[idx];
            // Preenche form
            document.getElementById('p1FormCliente').style.display = '';
            setVal('p1Nome', c.nome);
            setVal('p1Tel', c.telefones[0] || '');
            setVal('p1Cpf', c.cpfs[0] || '');
            setVal('p1Nf', c.nfs[0] || '');
            clienteEncontrado = c;
            buscarMotosP1(c.telefones[0] || '', c.cpfs[0] || '');
            mostrarFeedback('Cliente selecionado: ' + c.nome, 'sucesso');
          });
        });
        mostrarFeedback(resp.clientes.length + ' cliente(s) encontrado(s). Clique no card pra usar:', 'info');
      })
      .catch(function(err) {
        mostrarFeedback('Erro de rede: ' + err.message, 'erro');
      });
  }

  // --- Motos do cliente (aba Motos Cliente + garantia) ---
  function buscarMotosP1(telefone, cpf) {
    var secao = document.getElementById('p1MotosSecao');
    var div = document.getElementById('p1Motos');
    if (!secao || !div) return;
    var tel = String(telefone || '').replace(/\D/g, '');
    var doc = String(cpf || '').replace(/\D/g, '');
    if (!tel && !doc) { secao.style.display = 'none'; div.innerHTML = ''; return; }
    var params = [];
    if (tel) params.push('telefone=' + encodeURIComponent(tel));
    if (doc) params.push('cpf=' + encodeURIComponent(doc));
    fetch(resolverUrl() + '?action=motos_cliente&' + params.join('&'))
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (!resp || !resp.sucesso || !resp.motos || resp.motos.length === 0) {
          secao.style.display = 'none';
          div.innerHTML = '';
          motoSelecionada = null;
          return;
        }
        renderMotosP1(resp.motos);
      })
      .catch(function() { /* motos sao um extra — falha nao bloqueia o wizard */ });
  }

  function renderMotosP1(motos) {
    var secao = document.getElementById('p1MotosSecao');
    var div = document.getElementById('p1Motos');
    if (!secao || !div) return;
    secao.style.display = '';
    div.innerHTML = motos.map(function(m, idx) {
      var sel = motoSelecionada && motoSelecionada.chassi === m.chassi && motoSelecionada.idVenda === m.idVenda;
      return '<div class="p1-moto-card" data-idx="' + idx + '" style="margin:0.5rem 0;background:#1c1c1c;padding:0.75rem;border-radius:6px;cursor:pointer;border:1px solid ' + (sel ? '#c6ff00' : '#2a2a2a') + ';transition:all 0.15s;">' +
        '<div style="font-weight:700;color:#fff;">&#127949;&#65039; ' + escapeHtmlAt(m.modelo) + (m.cor ? ' &bull; ' + escapeHtmlAt(m.cor) : '') + '</div>' +
        '<div style="font-size:0.8rem;color:#9a9a9a;margin-top:0.25rem;">' +
          (m.chassi ? 'Chassi: ' + escapeHtmlAt(m.chassi) + ' &bull; ' : '') +
          (m.dataCompra ? 'Comprada em ' + formatarDataBrAt(m.dataCompra) : '') +
          (m.loja ? ' &bull; ' + escapeHtmlAt(m.loja) : '') +
        '</div>' +
        htmlGarantiaLinha('Motor e quadro', m.garantiaMotorQuadroAte, m.garantiaMotorQuadroVigente) +
        htmlGarantiaLinha('Bateria', m.garantiaBateriaAte, m.garantiaBateriaVigente) +
        (sel ? '<div style="font-size:0.75rem;color:#c6ff00;margin-top:0.25rem;">&#10003; Vinculada ao atendimento (clique pra desvincular)</div>' : '') +
      '</div>';
    }).join('');

    div.querySelectorAll('.p1-moto-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var m = motos[parseInt(card.dataset.idx)];
        if (motoSelecionada && motoSelecionada.chassi === m.chassi && motoSelecionada.idVenda === m.idVenda) {
          motoSelecionada = null;
        } else {
          motoSelecionada = m;
          if (m.modelo) {
            var sel = document.getElementById('p1Modelo');
            if (sel) {
              var achou = false;
              for (var i = 0; i < sel.options.length; i++) {
                if (sel.options[i].value === m.modelo) { sel.selectedIndex = i; achou = true; break; }
              }
              if (!achou) {
                var opt = document.createElement('option');
                opt.value = m.modelo;
                opt.textContent = m.modelo;
                opt.selected = true;
                sel.appendChild(opt);
              }
            }
          }
        }
        renderMotosP1(motos);
      });
    });
  }

  function formatarDataBrAt(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : (iso || '');
  }

  function htmlGarantiaLinha(rotulo, ate, vigente) {
    if (!ate) {
      return '<div style="font-size:0.8rem;font-weight:600;color:#9a9a9a;margin-top:0.25rem;">' + rotulo + ': garantia n&atilde;o calculada</div>';
    }
    var cor = vigente ? '#22c55e' : '#ef4444';
    return '<div style="font-size:0.8rem;font-weight:600;color:' + cor + ';margin-top:0.25rem;">' + rotulo + ' at&eacute; ' + formatarDataBrAt(ate) + (vigente ? ' (vigente)' : ' (vencida)') + '</div>';
  }

  function textoGarantiaMoto(m) {
    return 'motor/quadro ate ' + (m.garantiaMotorQuadroAte || '?') + (m.garantiaMotorQuadroVigente ? ' (vigente)' : ' (vencida)') +
      ', bateria ate ' + (m.garantiaBateriaAte || '?') + (m.garantiaBateriaVigente ? ' (vigente)' : ' (vencida)');
  }

  function validarPasso1() {
    var nome = document.getElementById('p1Nome');
    if (!nome || !nome.value.trim()) {
      mostrarFeedback('Informe o nome do cliente. Clique em Buscar ou preencha manualmente.', 'erro');
      return false;
    }
    var tel = document.getElementById('p1Tel');
    if (!tel || tel.value.replace(/\D/g, '').length < 10) {
      mostrarFeedback('Telefone invalido', 'erro');
      return false;
    }
    return true;
  }

  function coletarPasso1() {
    dados.cliente = {
      nome: document.getElementById('p1Nome').value.trim(),
      telefone: document.getElementById('p1Tel').value.trim(),
      cpfCnpj: document.getElementById('p1Cpf').value.trim(),
      notaFiscal: document.getElementById('p1Nf').value.trim(),
      modelo: document.getElementById('p1Modelo').value
    };
    dados.moto = motoSelecionada;
  }

  // ============================================================
  // PASSO 2: Motivo
  // ============================================================
  function htmlPasso2() {
    return '<div class="secao-form">' +
        '<div class="secao-form-titulo">Tipo de Atendimento</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="p2Categoria">Categoria *</label>' +
            '<select id="p2Categoria" required>' +
              '<option value="">Selecione...</option>' +
              '<option value="Pos-venda">Pos-venda</option>' +
              '<option value="Pre-venda">Pre-venda</option>' +
              '<option value="Outro">Outro</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="p2Motivo">Motivo *</label>' +
            '<select id="p2Motivo" required disabled><option>Selecione a categoria primeiro</option></select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="p2Origem">Origem *</label>' +
            '<select id="p2Origem" required>' +
              '<option value="">Selecione...</option>' +
              '<option value="WhatsApp">WhatsApp</option>' +
              '<option value="Telefone">Telefone</option>' +
              '<option value="Loja">Loja</option>' +
              '<option value="Site">Site</option>' +
              '<option value="Outro">Outro</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:1 1 100%;">' +
            '<label for="p2Descricao">Descri&ccedil;&atilde;o *</label>' +
            '<textarea id="p2Descricao" rows="3" required></textarea>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="p2Vendedor">Vendedor / Atendente *</label>' +
            '<input type="text" id="p2Vendedor" required>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function bindPasso2() {
    var cat = document.getElementById('p2Categoria');
    var motivo = document.getElementById('p2Motivo');
    if (cat) {
      cat.addEventListener('change', function() { popularMotivos(cat.value, motivo); });
    }

    // Restaurar valores
    if (dados.motivo) {
      setVal('p2Categoria', dados.motivo.categoria);
      popularMotivos(dados.motivo.categoria, motivo);
      setVal('p2Motivo', dados.motivo.motivo);
      setVal('p2Origem', dados.motivo.origem);
      setVal('p2Descricao', dados.motivo.descricao);
      setVal('p2Vendedor', dados.motivo.vendedor);
    }
  }

  function popularMotivos(categoria, sel) {
    sel.innerHTML = '';
    if (!categoria || !MOTIVOS_POR_CATEGORIA[categoria]) {
      sel.disabled = true;
      sel.innerHTML = '<option>Selecione a categoria primeiro</option>';
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

  function validarPasso2() {
    var cat = (document.getElementById('p2Categoria').value || '').trim();
    var mot = (document.getElementById('p2Motivo').value || '').trim();
    var orig = (document.getElementById('p2Origem').value || '').trim();
    var desc = (document.getElementById('p2Descricao').value || '').trim();
    var vend = (document.getElementById('p2Vendedor').value || '').trim();
    if (!cat) return mostrarFeedback('Selecione categoria', 'erro') && false;
    if (!mot) return mostrarFeedback('Selecione motivo', 'erro') && false;
    if (!orig) return mostrarFeedback('Selecione origem', 'erro') && false;
    if (!desc) return mostrarFeedback('Preencha descrição', 'erro') && false;
    if (!vend) return mostrarFeedback('Informe vendedor', 'erro') && false;
    return true;
  }

  function coletarPasso2() {
    dados.motivo = {
      categoria: document.getElementById('p2Categoria').value,
      motivo: document.getElementById('p2Motivo').value,
      origem: document.getElementById('p2Origem').value,
      descricao: document.getElementById('p2Descricao').value.trim(),
      vendedor: document.getElementById('p2Vendedor').value.trim()
    };
  }

  // ============================================================
  // PASSO 3: Ações
  // ============================================================
  function htmlPasso3() {
    return '<div class="secao-form">' +
        '<div class="secao-form-titulo">A&ccedil;&otilde;es deste atendimento</div>' +
        '<p style="padding:0.75rem 1rem 0.25rem;color:#9a9a9a;font-size:0.85rem;">Marque tudo que vai ser gerado dentro deste atendimento. Cada item marcado abre seu sub-formul&aacute;rio no pr&oacute;ximo passo.</p>' +
        '<div style="padding:0.5rem 1rem 1rem;">' +
          '<label class="atend-check"><input type="checkbox" id="p3Venda"> 🛒 Registrar venda de pe&ccedil;as</label>' +
          '<label class="atend-check"><input type="checkbox" id="p3Orcamento"> 📄 Gerar or&ccedil;amento de pe&ccedil;as</label>' +
          '<label class="atend-check"><input type="checkbox" id="p3OS"> 🔧 Abrir OS de assist&ecirc;ncia</label>' +
          '<label class="atend-check"><input type="checkbox" id="p3SoRegistro"> 📝 Apenas registrar atendimento (sem documentos)</label>' +
        '</div>' +
      '</div>';
  }

  function bindPasso3() {
    if (dados.acoes && dados.acoes.length) {
      document.getElementById('p3Venda').checked = dados.acoes.indexOf('venda') !== -1;
      document.getElementById('p3Orcamento').checked = dados.acoes.indexOf('orcamento') !== -1;
      document.getElementById('p3OS').checked = dados.acoes.indexOf('os') !== -1;
      document.getElementById('p3SoRegistro').checked = dados.acoes.indexOf('soregistro') !== -1;
    }

    // "Apenas registrar" desabilita os outros
    var soReg = document.getElementById('p3SoRegistro');
    soReg.addEventListener('change', function() {
      var outros = ['p3Venda', 'p3Orcamento', 'p3OS'];
      outros.forEach(function(id) {
        var el = document.getElementById(id);
        el.disabled = soReg.checked;
        if (soReg.checked) el.checked = false;
      });
    });
    // E vice-versa
    ['p3Venda', 'p3Orcamento', 'p3OS'].forEach(function(id) {
      document.getElementById(id).addEventListener('change', function() {
        if (this.checked) soReg.checked = false;
      });
    });
  }

  function validarPasso3() {
    var v = document.getElementById('p3Venda').checked;
    var o = document.getElementById('p3Orcamento').checked;
    var os = document.getElementById('p3OS').checked;
    var sr = document.getElementById('p3SoRegistro').checked;
    if (!v && !o && !os && !sr) {
      mostrarFeedback('Marque pelo menos uma ação', 'erro');
      return false;
    }
    return true;
  }

  function coletarPasso3() {
    dados.acoes = [];
    if (document.getElementById('p3Venda').checked) dados.acoes.push('venda');
    if (document.getElementById('p3Orcamento').checked) dados.acoes.push('orcamento');
    if (document.getElementById('p3OS').checked) dados.acoes.push('os');
    if (document.getElementById('p3SoRegistro').checked) dados.acoes.push('soregistro');
  }

  // ============================================================
  // PASSO 4: Preenchimento (simplificado nesta fase - placeholders)
  // ============================================================
  function htmlPasso4() {
    var html = '<div class="secao-form">' +
      '<div class="secao-form-titulo">Preenchimento de documentos</div>' +
      '<p style="padding:0.75rem 1rem;color:#9a9a9a;font-size:0.85rem;">Sub-formularios completos ser&atilde;o adicionados na pr&oacute;xima sub-fase. Por enquanto, voc&ecirc; gera o atendimento e cria os documentos pelos fluxos atuais (Pe&ccedil;as / Or&ccedil;amentos / Abrir OS) j&aacute; vinculando o protocolo desta tela.</p>';

    if (dados.acoes.indexOf('venda') !== -1) {
      html += '<div class="form-row"><div class="form-group" style="flex:1 1 100%;color:#22c55e;padding:0.5rem 1rem;">&bull; 🛒 Venda ser&aacute; criada (preenchimento pendente nesta fase)</div></div>';
    }
    if (dados.acoes.indexOf('orcamento') !== -1) {
      html += '<div class="form-row"><div class="form-group" style="flex:1 1 100%;color:#f59e0b;padding:0.5rem 1rem;">&bull; 📄 Or&ccedil;amento ser&aacute; criado (preenchimento pendente nesta fase)</div></div>';
    }
    if (dados.acoes.indexOf('os') !== -1) {
      html += '<div class="form-row"><div class="form-group" style="flex:1 1 100%;color:#3b82f6;padding:0.5rem 1rem;">&bull; 🔧 OS ser&aacute; aberta (preenchimento pendente nesta fase)</div></div>';
    }
    if (dados.acoes.indexOf('soregistro') !== -1) {
      html += '<div class="form-row"><div class="form-group" style="flex:1 1 100%;color:#c6ff00;padding:0.5rem 1rem;">&bull; 📝 Atendimento ser&aacute; apenas registrado (sem documentos vinculados)</div></div>';
    }

    html += '</div>';
    return html;
  }

  function bindPasso4() {
    // sem campos por enquanto
  }

  function validarPasso4() { return true; }
  function coletarPasso4() { /* TODO em sub-fase futura */ }

  // ============================================================
  // PASSO 5: Fechamento
  // ============================================================
  function htmlPasso5() {
    var c = dados.cliente || {};
    var m = dados.motivo || {};
    var acoesTxt = dados.acoes.map(function(a) {
      return {
        venda: '🛒 Venda',
        orcamento: '📄 Or&ccedil;amento',
        os: '🔧 OS',
        soregistro: '📝 Apenas registro'
      }[a];
    }).join(' &bull; ');

    return '<div class="secao-form">' +
        '<div class="secao-form-titulo">Revis&atilde;o e fechamento</div>' +
        '<div style="padding:0.75rem 1rem;color:#e8e8f0;font-size:0.9rem;line-height:1.8;">' +
          '<div><strong style="color:var(--cor-primaria);">Cliente:</strong> ' + escapeHtmlAt(c.nome) + ' &bull; ' + escapeHtmlAt(c.telefone) + '</div>' +
          (c.cpfCnpj ? '<div><strong style="color:var(--cor-primaria);">CPF:</strong> ' + escapeHtmlAt(c.cpfCnpj) + '</div>' : '') +
          (c.notaFiscal ? '<div><strong style="color:var(--cor-primaria);">NF:</strong> ' + escapeHtmlAt(c.notaFiscal) + '</div>' : '') +
          (c.modelo ? '<div><strong style="color:var(--cor-primaria);">Modelo:</strong> ' + escapeHtmlAt(c.modelo) + '</div>' : '') +
          (dados.moto ? '<div><strong style="color:var(--cor-primaria);">Moto vinculada:</strong> ' + escapeHtmlAt(dados.moto.modelo) + (dados.moto.chassi ? ' &bull; chassi ' + escapeHtmlAt(dados.moto.chassi) : '') +
            (dados.moto.garantiaMotorQuadroAte ? ' &bull; <span style="color:' + (dados.moto.garantiaMotorQuadroVigente ? '#22c55e' : '#ef4444') + ';">motor/quadro at&eacute; ' + formatarDataBrAt(dados.moto.garantiaMotorQuadroAte) + (dados.moto.garantiaMotorQuadroVigente ? ' (vigente)' : ' (vencida)') + '</span>' : '') +
            (dados.moto.garantiaBateriaAte ? ' &bull; <span style="color:' + (dados.moto.garantiaBateriaVigente ? '#22c55e' : '#ef4444') + ';">bateria at&eacute; ' + formatarDataBrAt(dados.moto.garantiaBateriaAte) + (dados.moto.garantiaBateriaVigente ? ' (vigente)' : ' (vencida)') + '</span>' : '') +
          '</div>' : '') +
          '<div style="margin-top:0.5rem;"><strong style="color:var(--cor-primaria);">Categoria:</strong> ' + escapeHtmlAt(m.categoria) + ' &bull; ' + escapeHtmlAt(m.motivo) + '</div>' +
          '<div><strong style="color:var(--cor-primaria);">Origem:</strong> ' + escapeHtmlAt(m.origem) + '</div>' +
          '<div><strong style="color:var(--cor-primaria);">Vendedor:</strong> ' + escapeHtmlAt(m.vendedor) + '</div>' +
          '<div style="margin-top:0.5rem;"><strong style="color:var(--cor-primaria);">Descri&ccedil;&atilde;o:</strong></div>' +
          '<div style="padding:0.5rem;background:#1c1c1c;border-radius:4px;font-style:italic;">' + escapeHtmlAt(m.descricao) + '</div>' +
          '<div style="margin-top:0.5rem;"><strong style="color:var(--cor-primaria);">A&ccedil;&otilde;es:</strong> ' + acoesTxt + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Status final</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="p5Status">Status do atendimento *</label>' +
            '<select id="p5Status" required>' +
              '<option value="Aberto">Aberto</option>' +
              '<option value="Em andamento">Em andamento</option>' +
              '<option value="Aguardando cliente">Aguardando cliente</option>' +
              '<option value="Resolvido">Resolvido</option>' +
              '<option value="Fechado">Fechado</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function bindPasso5() {
    if (dados.status) setVal('p5Status', dados.status);
  }

  function validarPasso5() { return true; }

  function coletarPasso5() {
    dados.status = document.getElementById('p5Status').value;
  }

  // ============================================================
  // Orquestração
  // ============================================================
  function avancarPasso() {
    if (passo === 1) {
      if (!validarPasso1()) return;
      coletarPasso1();
      passo = 2;
    } else if (passo === 2) {
      if (!validarPasso2()) return;
      coletarPasso2();
      passo = 3;
    } else if (passo === 3) {
      if (!validarPasso3()) return;
      coletarPasso3();
      passo = 4;
    } else if (passo === 4) {
      coletarPasso4();
      passo = 5;
    } else if (passo === 5) {
      coletarPasso5();
      salvarAtendimento();
      return;
    }
    mostrarFeedback('', '');
    renderPasso();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function voltarPasso() {
    if (passo > 1) {
      passo--;
      mostrarFeedback('', '');
      renderPasso();
    }
  }

  function salvarAtendimento() {
    if (submetendo) return;
    submetendo = true;
    var btn = document.getElementById('btnProxPasso');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    mostrarFeedback('Salvando atendimento...', 'info');

    var payload = {
      action: 'registrar_atendimento',
      categoria: dados.motivo.categoria,
      motivo: dados.motivo.motivo,
      origem: dados.motivo.origem,
      nomeCliente: dados.cliente.nome,
      telefone: dados.cliente.telefone,
      cpfCnpj: dados.cliente.cpfCnpj,
      notaFiscal: dados.cliente.notaFiscal,
      modeloEquipamento: dados.cliente.modelo || (dados.moto ? dados.moto.modelo : ''),
      descricao: dados.motivo.descricao + (dados.moto ? '\n[Moto vinculada: ' + dados.moto.modelo + ' - chassi ' + (dados.moto.chassi || 's/chassi') + ' - ' + textoGarantiaMoto(dados.moto) + ']' : ''),
      vendedor: dados.motivo.vendedor,
      status: dados.status || 'Aberto',
      acoes: JSON.stringify(dados.acoes)
    };

    fetch(resolverUrl(), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    })
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (resp && resp.sucesso) {
          mostrarSucessoFinal(resp.id);
        } else {
          mostrarFeedback('Erro: ' + (resp && resp.erro ? resp.erro : 'sem resposta'), 'erro');
        }
      })
      .catch(function(err) {
        mostrarFeedback('Erro de rede: ' + err.message, 'erro');
      })
      .finally(function() {
        submetendo = false;
        btn.disabled = false;
        btn.textContent = '✓ Salvar atendimento';
      });
  }

  function mostrarSucessoFinal(idAtendimento) {
    var container = document.getElementById('atendimento-container');
    var c = dados.cliente;
    var primeiroNome = (c.nome || '').split(' ')[0];
    var telDigits = (c.telefone || '').replace(/\D/g, '');
    var msgWa = 'Ola ' + primeiroNome + '!\n\nSeu atendimento foi aberto na NXT.\n\n*Protocolo:* ' + idAtendimento + '\n*Categoria:* ' + dados.motivo.categoria + '\n*Motivo:* ' + dados.motivo.motivo + '\n\nEm breve retornaremos.\n\n_NXT SAC_';
    var canWa = telDigits.length >= 10;

    // Botoes condicionais por acao marcada
    var btnsAcao = '';
    if (dados.acoes.indexOf('venda') !== -1) {
      btnsAcao += '<button type="button" class="btn-primario" id="atBtnVenda" style="background:#22c55e;color:#fff;">🛒 Criar venda vinculada</button>';
    }
    if (dados.acoes.indexOf('orcamento') !== -1) {
      btnsAcao += '<button type="button" class="btn-primario" id="atBtnOrcamento" style="background:#f59e0b;color:#fff;">📄 Criar or&ccedil;amento vinculado</button>';
    }
    if (dados.acoes.indexOf('os') !== -1) {
      btnsAcao += '<button type="button" class="btn-primario" id="atBtnOS" style="background:#3b82f6;color:#fff;">🔧 Abrir OS vinculada</button>';
    }

    container.innerHTML =
      '<div style="text-align:center;padding:2rem 1rem;">' +
        '<div style="font-size:3.5rem;">&#x2705;</div>' +
        '<h2 style="color:var(--cor-primaria);margin:0.75rem 0;">Atendimento aberto!</h2>' +
        '<div style="font-size:2rem;font-weight:900;color:#fff;letter-spacing:2px;margin:0.75rem 0;">' + escapeHtmlAt(idAtendimento) + '</div>' +
        '<p style="color:#9a9a9a;">' + escapeHtmlAt(c.nome) + ' &bull; ' + formatarTel(telDigits) + '</p>' +

        (btnsAcao ? '<div style="margin-top:2rem;">' +
          '<div style="color:#9a9a9a;font-size:0.85rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.75rem;">A&ccedil;&otilde;es vinculadas</div>' +
          '<div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">' + btnsAcao + '</div>' +
        '</div>' : '') +

        '<div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid #2a2a2a;">' +
          '<div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">' +
            '<button type="button" class="btn-secundario" id="atBtnCopiar">&#128203; Copiar protocolo</button>' +
            (canWa ? '<button type="button" id="atBtnWa" style="padding:0.6rem 1.5rem;background:#25d366;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;">&#128241; WhatsApp</button>' : '') +
            '<button type="button" class="btn-secundario" id="atBtnNovo">Novo atendimento</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    function preFill(viewAlvo, modo) {
      window.__preFillForm = {
        cliente: {
          nome: c.nome,
          telefone: c.telefone,
          cpfCnpj: c.cpfCnpj,
          notaFiscal: c.notaFiscal,
          modelo: c.modelo
        },
        atendimentoId: idAtendimento,
        moto: dados.moto || null,
        modo: modo || null
      };
      navigateTo(viewAlvo);
    }

    document.getElementById('atBtnCopiar').addEventListener('click', function() {
      navigator.clipboard.writeText(idAtendimento).then(function() {
        alert('Protocolo ' + idAtendimento + ' copiado');
      }).catch(function() { alert('Selecione e Ctrl+C: ' + idAtendimento); });
    });
    if (canWa) {
      document.getElementById('atBtnWa').addEventListener('click', function() {
        window.open('https://wa.me/55' + telDigits + '?text=' + encodeURIComponent(msgWa), '_blank');
      });
    }
    document.getElementById('atBtnNovo').addEventListener('click', function() {
      window.initAtendimento();
    });

    // Listeners das acoes vinculadas
    var btnV = document.getElementById('atBtnVenda');
    if (btnV) btnV.addEventListener('click', function() { preFill('formulario', 'venda'); });
    var btnO = document.getElementById('atBtnOrcamento');
    if (btnO) btnO.addEventListener('click', function() { preFill('formulario', 'orcamento'); });
    var btnOS = document.getElementById('atBtnOS');
    if (btnOS) btnOS.addEventListener('click', function() { preFill('assistencia', null); });
  }

  // ============================================================
  // Helpers
  // ============================================================
  function setVal(id, v) {
    var el = document.getElementById(id);
    if (el) el.value = v || '';
  }

  function escapeHtmlAt(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatarTel(t) {
    var d = String(t || '').replace(/\D/g, '');
    if (d.length === 11) return '(' + d.substr(0,2) + ') ' + d.substr(2,5) + '-' + d.substr(7);
    if (d.length === 10) return '(' + d.substr(0,2) + ') ' + d.substr(2,4) + '-' + d.substr(6);
    return t || '';
  }

  function mostrarFeedback(msg, tipo) {
    var el = document.getElementById('atFeedback');
    if (!el) return;
    if (!msg) { el.innerHTML = ''; return true; }
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.6rem 1rem;border-radius:6px;text-align:center;font-weight:600;font-size:0.85rem;">' + msg + '</div>';
    return true;
  }

})();
