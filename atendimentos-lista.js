/* ===== NXT SAC V2.20 - Atendimentos (lista) ===== */

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

  var atendimentosCache = [];
  var filtrosAtivos = {};

  window.initAtendimentosLista = function() {
    var container = document.getElementById('atendimentos-lista-container');
    if (!container) return;
    container.innerHTML = buildHTML();
    setupListeners();
    carregarAtendimentos();
    console.log('Atendimentos Lista inicializado');
  };

  function buildHTML() {
    return '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128221; Atendimentos</h2>' +
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Filtros</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="alStatus">Status</label>' +
            '<select id="alStatus">' +
              '<option value="">Todos</option>' +
              '<option value="Aberto">Aberto</option>' +
              '<option value="Em andamento">Em andamento</option>' +
              '<option value="Aguardando cliente">Aguardando cliente</option>' +
              '<option value="Resolvido">Resolvido</option>' +
              '<option value="Fechado">Fechado</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="alCategoria">Categoria</label>' +
            '<select id="alCategoria">' +
              '<option value="">Todas</option>' +
              '<option value="Pos-venda">P&oacute;s-venda</option>' +
              '<option value="Pre-venda">Pr&eacute;-venda</option>' +
              '<option value="Outro">Outro</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="alVendedor">Vendedor</label>' +
            '<input type="text" id="alVendedor" placeholder="Nome do vendedor">' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="alDataDe">De</label>' +
            '<input type="date" id="alDataDe">' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="alDataAte">At&eacute;</label>' +
            '<input type="date" id="alDataAte">' +
          '</div>' +
          '<div class="form-group" style="flex:2 1 200px;">' +
            '<label for="alBusca">Busca (protocolo, nome, CPF, telefone)</label>' +
            '<input type="text" id="alBusca" placeholder="Digite parte do texto...">' +
          '</div>' +
        '</div>' +
        '<div class="form-row" style="align-items:center;">' +
          '<button type="button" class="btn-primario" id="alBtnAplicar">&#128269; Aplicar filtros</button>' +
          '<button type="button" class="btn-secundario" id="alBtnLimpar">Limpar</button>' +
          '<button type="button" class="btn-secundario" id="alBtnRefresh">&#x21bb; Atualizar</button>' +
          '<span id="alResumo" style="color:#9a9a9a;font-size:0.85rem;margin-left:auto;"></span>' +
        '</div>' +
      '</div>' +

      '<div id="alFeedback" style="margin-top:0.5rem;"></div>' +
      '<div id="alLista" style="margin-top:1rem;"></div>';
  }

  function setupListeners() {
    document.getElementById('alBtnAplicar').addEventListener('click', aplicarFiltros);
    document.getElementById('alBtnLimpar').addEventListener('click', limparFiltros);
    document.getElementById('alBtnRefresh').addEventListener('click', carregarAtendimentos);
    document.getElementById('alBusca').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); aplicarFiltros(); }
    });
  }

  function carregarAtendimentos() {
    mostrarFeedback('Carregando...', 'info');
    var params = ['action=listar_atendimentos', 'limite=200'];
    if (filtrosAtivos.status) params.push('status=' + encodeURIComponent(filtrosAtivos.status));
    if (filtrosAtivos.categoria) params.push('categoria=' + encodeURIComponent(filtrosAtivos.categoria));
    if (filtrosAtivos.vendedor) params.push('vendedor=' + encodeURIComponent(filtrosAtivos.vendedor));
    if (filtrosAtivos.dataDe) params.push('dataDe=' + encodeURIComponent(filtrosAtivos.dataDe));
    if (filtrosAtivos.dataAte) params.push('dataAte=' + encodeURIComponent(filtrosAtivos.dataAte));
    if (filtrosAtivos.busca) params.push('busca=' + encodeURIComponent(filtrosAtivos.busca));

    fetch(resolverUrl() + '?' + params.join('&'))
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (!resp || !resp.sucesso) {
          return mostrarFeedback('Erro: ' + (resp && resp.erro ? resp.erro : 'sem resposta'), 'erro');
        }
        atendimentosCache = resp.atendimentos || [];
        renderLista();
        mostrarFeedback('', '');
      })
      .catch(function(err) {
        mostrarFeedback('Erro de rede: ' + err.message, 'erro');
      });
  }

  function aplicarFiltros() {
    filtrosAtivos = {
      status: document.getElementById('alStatus').value,
      categoria: document.getElementById('alCategoria').value,
      vendedor: document.getElementById('alVendedor').value.trim(),
      dataDe: document.getElementById('alDataDe').value,
      dataAte: document.getElementById('alDataAte').value,
      busca: document.getElementById('alBusca').value.trim()
    };
    carregarAtendimentos();
  }

  function limparFiltros() {
    ['alStatus', 'alCategoria', 'alVendedor', 'alDataDe', 'alDataAte', 'alBusca'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    filtrosAtivos = {};
    carregarAtendimentos();
  }

  function renderLista() {
    var div = document.getElementById('alLista');
    var resumo = document.getElementById('alResumo');
    if (!div) return;

    if (atendimentosCache.length === 0) {
      div.innerHTML = '<div style="padding:2rem;text-align:center;color:#9a9a9a;">Nenhum atendimento encontrado com esses filtros.</div>';
      if (resumo) resumo.textContent = '0 atendimentos';
      return;
    }

    if (resumo) {
      var abertos = atendimentosCache.filter(function(a) { return a.status === 'Aberto' || a.status === 'Em andamento'; }).length;
      resumo.innerHTML = atendimentosCache.length + ' atendimentos &bull; <strong style="color:#f59e0b;">' + abertos + ' em aberto</strong>';
    }

    div.innerHTML = atendimentosCache.map(function(a, idx) {
      var statusCor = getCorStatus(a.status);
      var dataStr = formatarDataAt(a.dataAbertura);
      var docsVinc = '';
      if (a.docsVinculados) {
        try {
          var arr = typeof a.docsVinculados === 'string' ? JSON.parse(a.docsVinculados) : a.docsVinculados;
          if (Array.isArray(arr) && arr.length) {
            docsVinc = '<span style="font-size:0.75rem;color:#9a9a9a;">' + arr.length + ' doc(s) vinculados</span>';
          }
        } catch (e) { /* ignora */ }
      }

      return '<div class="al-card" data-idx="' + idx + '" style="background:#161625;border:1px solid #2a2a2a;border-left:4px solid ' + statusCor + ';border-radius:8px;padding:0.85rem 1rem;margin-bottom:0.5rem;cursor:pointer;transition:all 0.15s;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;flex-wrap:wrap;">' +
          '<div style="flex:1;min-width:220px;">' +
            '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
              '<strong style="color:#c6ff00;font-size:1rem;">' + escapeHtmlAt(a.id) + '</strong>' +
              '<span style="background:' + statusCor + '22;color:' + statusCor + ';font-size:0.75rem;font-weight:700;padding:0.15rem 0.6rem;border-radius:4px;">' + escapeHtmlAt(a.status || 'Aberto') + '</span>' +
              '<span style="font-size:0.75rem;color:#9a9a9a;">' + escapeHtmlAt(a.categoria || '') + (a.motivo ? ' &bull; ' + escapeHtmlAt(a.motivo) : '') + '</span>' +
            '</div>' +
            '<div style="font-size:0.9rem;color:#e8e8f0;margin-top:0.35rem;">' + escapeHtmlAt(a.nomeCliente || '(sem nome)') + '</div>' +
            '<div style="font-size:0.78rem;color:#9a9a9a;margin-top:0.15rem;">' +
              (a.telefone ? formatarTel(a.telefone) : '') +
              (a.cpfCnpj ? ' &bull; CPF ' + escapeHtmlAt(a.cpfCnpj) : '') +
              (a.vendedor ? ' &bull; ' + escapeHtmlAt(a.vendedor) : '') +
            '</div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div style="font-size:0.75rem;color:#9a9a9a;">' + dataStr + '</div>' +
            (docsVinc ? '<div style="margin-top:0.25rem;">' + docsVinc + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div id="al-detail-' + idx + '" style="display:none;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid #2a2a2a;font-size:0.85rem;color:#e8e8f0;"></div>' +
      '</div>';
    }).join('');

    div.querySelectorAll('.al-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') return; // não expande ao clicar em botões
        var idx = parseInt(card.dataset.idx);
        toggleDetalhe(idx);
      });
    });
  }

  function toggleDetalhe(idx) {
    var det = document.getElementById('al-detail-' + idx);
    if (!det) return;
    if (det.style.display === 'none') {
      det.innerHTML = renderDetalhe(atendimentosCache[idx], idx);
      det.style.display = 'block';
      // Bind botoes do detalhe
      var btnEditar = det.querySelector('.al-btn-editar-' + idx);
      if (btnEditar) {
        btnEditar.addEventListener('click', function(e) {
          e.stopPropagation();
          editarStatusFromList(atendimentosCache[idx], idx);
        });
      }
    } else {
      det.style.display = 'none';
    }
  }

  function renderDetalhe(a, idx) {
    var docsHtml = '';
    if (a.docsVinculados) {
      try {
        var arr = typeof a.docsVinculados === 'string' ? JSON.parse(a.docsVinculados) : a.docsVinculados;
        if (Array.isArray(arr) && arr.length) {
          docsHtml = '<div style="margin-top:0.5rem;"><strong style="color:var(--cor-primaria);">Docs vinculados:</strong> ' +
            arr.map(function(d) { return '<span style="background:#22c55e22;color:#22c55e;padding:0.15rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600;margin-right:0.25rem;">' + escapeHtmlAt(d) + '</span>'; }).join('') +
          '</div>';
        }
      } catch (e) { /* ignora */ }
    }

    var acoesHtml = '';
    if (a.acoes) {
      try {
        var ac = typeof a.acoes === 'string' ? JSON.parse(a.acoes) : a.acoes;
        if (Array.isArray(ac) && ac.length) {
          acoesHtml = '<div><strong style="color:var(--cor-primaria);">A&ccedil;&otilde;es marcadas:</strong> ' + ac.join(', ') + '</div>';
        }
      } catch (e) { /* ignora */ }
    }

    return '' +
      (a.origem ? '<div><strong style="color:var(--cor-primaria);">Origem:</strong> ' + escapeHtmlAt(a.origem) + '</div>' : '') +
      (a.notaFiscal ? '<div><strong style="color:var(--cor-primaria);">NF:</strong> ' + escapeHtmlAt(a.notaFiscal) + '</div>' : '') +
      (a.modeloEquipamento ? '<div><strong style="color:var(--cor-primaria);">Equipamento:</strong> ' + escapeHtmlAt(a.modeloEquipamento) + '</div>' : '') +
      (a.descricao ? '<div style="margin-top:0.4rem;"><strong style="color:var(--cor-primaria);">Descri&ccedil;&atilde;o:</strong><div style="background:#1c1c1c;padding:0.5rem;border-radius:4px;margin-top:0.2rem;font-style:italic;">' + escapeHtmlAt(a.descricao) + '</div></div>' : '') +
      acoesHtml +
      docsHtml +
      (a.dataFechamento ? '<div style="margin-top:0.4rem;color:#9a9a9a;font-size:0.78rem;">Fechado em ' + formatarDataAt(a.dataFechamento) + (a.motivoFechamento ? ' &bull; ' + escapeHtmlAt(a.motivoFechamento) : '') + '</div>' : '') +
      '<div style="margin-top:0.6rem;display:flex;gap:0.5rem;flex-wrap:wrap;">' +
        '<button type="button" class="al-btn-editar-' + idx + ' btn-secundario btn-sm" style="font-size:0.78rem;">&#9998; Editar status</button>' +
      '</div>';
  }

  function editarStatusFromList(atendimento, idx) {
    // Reaproveita modal de clientes.js? Não — clientes.js é IIFE separado.
    // Cria modal local simples.
    var existente = document.getElementById('alModalStatus');
    if (existente) existente.remove();

    var statusAtual = atendimento.status || 'Aberto';
    var statusOpts = ['Aberto', 'Em andamento', 'Aguardando cliente', 'Resolvido', 'Fechado']
      .map(function(s) {
        return '<option value="' + s + '"' + (s === statusAtual ? ' selected' : '') + '>' + s + '</option>';
      }).join('');

    var modal = document.createElement('div');
    modal.id = 'alModalStatus';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem;';
    modal.innerHTML =
      '<div style="background:#1c1c1c;border:1px solid #2a2a2a;border-radius:8px;max-width:480px;width:100%;">' +
        '<div style="background:#1a1a2e;color:#fff;padding:1rem 1.25rem;display:flex;justify-content:space-between;align-items:center;border-radius:8px 8px 0 0;">' +
          '<div>' +
            '<div style="font-size:11px;letter-spacing:1.5px;color:#c6ff00;font-weight:700;">EDITAR STATUS</div>' +
            '<div style="font-size:16px;font-weight:700;margin-top:2px;">' + escapeHtmlAt(atendimento.id) + '</div>' +
          '</div>' +
          '<button id="alModalStatusClose" style="background:transparent;border:none;color:#fff;font-size:24px;cursor:pointer;line-height:1;">&times;</button>' +
        '</div>' +
        '<div style="padding:1.25rem;color:#e8e8f0;">' +
          '<div style="margin-bottom:1rem;">' +
            '<label style="display:block;font-size:0.8rem;color:#9a9a9a;text-transform:uppercase;margin-bottom:0.5rem;">Novo status</label>' +
            '<select id="alModalStatusSelect" style="width:100%;padding:0.6rem;background:#161625;border:1px solid #2a2a2a;border-radius:6px;color:#fff;font-size:0.95rem;">' + statusOpts + '</select>' +
          '</div>' +
          '<div id="alModalMotivoWrap" style="margin-bottom:1rem;display:' + (statusAtual === 'Resolvido' || statusAtual === 'Fechado' ? 'block' : 'none') + ';">' +
            '<label style="display:block;font-size:0.8rem;color:#9a9a9a;text-transform:uppercase;margin-bottom:0.5rem;">Motivo (opcional)</label>' +
            '<input type="text" id="alModalMotivo" placeholder="Ex: Pe&ccedil;a entregue" style="width:100%;padding:0.6rem;background:#161625;border:1px solid #2a2a2a;border-radius:6px;color:#fff;font-size:0.95rem;">' +
          '</div>' +
          '<div id="alModalFeedback"></div>' +
          '<div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1rem;">' +
            '<button type="button" class="btn-secundario" id="alModalCancelar">Cancelar</button>' +
            '<button type="button" class="btn-primario" id="alModalSalvar">Salvar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    function fechar() { modal.remove(); }
    document.getElementById('alModalStatusClose').addEventListener('click', fechar);
    document.getElementById('alModalCancelar').addEventListener('click', fechar);

    document.getElementById('alModalStatusSelect').addEventListener('change', function() {
      var f = (this.value === 'Resolvido' || this.value === 'Fechado');
      document.getElementById('alModalMotivoWrap').style.display = f ? 'block' : 'none';
    });

    document.getElementById('alModalSalvar').addEventListener('click', function() {
      var novoStatus = document.getElementById('alModalStatusSelect').value;
      var motivo = (document.getElementById('alModalMotivo').value || '').trim();
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Salvando...';

      fetch(resolverUrl(), {
        method: 'POST',
        body: JSON.stringify({
          action: 'atualizar_atendimento',
          id: atendimento.id,
          status: novoStatus,
          motivoFechamento: motivo
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      })
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (resp && resp.sucesso) {
          atendimento.status = novoStatus;
          renderLista();
          setTimeout(fechar, 300);
        } else {
          var fb = document.getElementById('alModalFeedback');
          if (fb) fb.innerHTML = '<div style="background:#ef4444;color:#fff;padding:0.5rem;border-radius:4px;font-size:0.85rem;margin-top:0.5rem;">Erro: ' + (resp && resp.erro ? resp.erro : 'sem resposta') + '</div>';
        }
      })
      .catch(function(err) {
        var fb = document.getElementById('alModalFeedback');
        if (fb) fb.innerHTML = '<div style="background:#ef4444;color:#fff;padding:0.5rem;border-radius:4px;font-size:0.85rem;margin-top:0.5rem;">Erro: ' + err.message + '</div>';
      })
      .finally(function() {
        btn.disabled = false;
        btn.textContent = 'Salvar';
      });
    });
  }

  function getCorStatus(status) {
    if (status === 'Aberto') return '#f59e0b';
    if (status === 'Em andamento') return '#3b82f6';
    if (status === 'Aguardando cliente') return '#a855f7';
    if (status === 'Resolvido') return '#22c55e';
    if (status === 'Fechado') return '#9a9a9a';
    return '#9a9a9a';
  }

  function formatarDataAt(d) {
    if (!d) return '—';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    var dd = String(dt.getDate()).padStart(2, '0');
    var mm = String(dt.getMonth() + 1).padStart(2, '0');
    var yy = dt.getFullYear();
    var hh = String(dt.getHours()).padStart(2, '0');
    var mi = String(dt.getMinutes()).padStart(2, '0');
    return dd + '/' + mm + '/' + yy + ' ' + hh + ':' + mi;
  }

  function formatarTel(t) {
    var d = String(t || '').replace(/\D/g, '');
    if (d.length === 11) return '(' + d.substr(0,2) + ') ' + d.substr(2,5) + '-' + d.substr(7);
    if (d.length === 10) return '(' + d.substr(0,2) + ') ' + d.substr(2,4) + '-' + d.substr(6);
    return t;
  }

  function escapeHtmlAt(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function mostrarFeedback(msg, tipo) {
    var el = document.getElementById('alFeedback');
    if (!el) return;
    if (!msg) { el.innerHTML = ''; return; }
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.5rem 1rem;border-radius:6px;text-align:center;font-weight:600;font-size:0.85rem;">' + msg + '</div>';
  }

})();
