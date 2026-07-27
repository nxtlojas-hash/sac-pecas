/* ===== NXT SAC - OS (lista, busca e avanco de status) — Task 2 reorg 2026-07-27 =====
   Fecha o relato "nao sei onde altera o status": ate aqui o status da OS (o que
   o cliente ve no QR, statusPublicoOS) so mudava editando a celula da planilha
   na mao. Esta tela lista as OS do master, deixa buscar e mudar o status pelo
   seletor — com o botao "Ver como o cliente ve" do lado pra conferir na hora. */

(function() {
  'use strict';
  var URL_API = (typeof GOOGLE_SCRIPT_URL !== 'undefined') ? GOOGLE_SCRIPT_URL : '';
  var ETAPAS = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Em conserto', 'Pronto p/ retirar'];
  var cache = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function buildHTML() {
    return '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128203; OS</h2>' +
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Filtros</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="osStatus">Status</label>' +
            '<select id="osStatus">' +
              '<option value="">Todos</option>' +
              ETAPAS.map(function(et) {
                return '<option value="' + esc(et) + '">' + esc(et) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="form-group" style="flex:2 1 220px;">' +
            '<label for="osBusca">Busca (numero da OS, cliente, telefone, CPF, chassi)</label>' +
            '<input type="text" id="osBusca" placeholder="Digite parte do texto...">' +
          '</div>' +
        '</div>' +
        '<div class="form-row" style="align-items:center;">' +
          '<button type="button" class="btn-primario" id="osBtnAplicar">&#128269; Aplicar filtros</button>' +
          '<button type="button" class="btn-secundario" id="osBtnLimpar">Limpar</button>' +
          '<button type="button" class="btn-secundario" id="osBtnRefresh">&#x21bb; Atualizar</button>' +
          '<span id="osResumo" style="color:#9a9a9a;font-size:0.85rem;margin-left:auto;"></span>' +
        '</div>' +
      '</div>' +
      '<div id="osFeedback" style="margin-top:0.5rem;"></div>' +
      '<div id="osLista" style="margin-top:1rem;"></div>';
  }

  function filtrosAtuais() {
    var elStatus = document.getElementById('osStatus');
    var elBusca = document.getElementById('osBusca');
    return {
      status: elStatus ? elStatus.value : '',
      busca: elBusca ? elBusca.value.trim() : ''
    };
  }

  function carregar(filtros) {
    mostrarFeedback('Carregando...', 'info');
    var q = Object.keys(filtros || {}).filter(function(k) {
      return filtros[k];
    }).map(function(k) {
      return k + '=' + encodeURIComponent(filtros[k]);
    }).join('&');
    return fetch(URL_API + '?action=listar_os&limite=200' + (q ? '&' + q : ''))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d || !d.ok) {
          mostrarFeedback('Erro: ' + (d && d.erro ? d.erro : 'sem resposta'), 'erro');
          return d;
        }
        cache = d.oses || [];
        render();
        mostrarFeedback('', '');
        return d;
      })
      .catch(function(err) {
        mostrarFeedback('Erro de rede: ' + err.message, 'erro');
      });
  }

  function salvarStatus(numeroOS, novoStatus, btn) {
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    return fetch(URL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'atualizar_status_os', numeroOS: numeroOS, novoStatus: novoStatus })
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.ok) throw new Error(d.erro || 'falhou');
        btn.textContent = 'Salvo';
        // Recarrega para o cartao refletir a verdade da planilha, nao o otimismo da tela.
        setTimeout(function() { carregar(filtrosAtuais()); }, 600);
      })
      .catch(function(e) {
        btn.disabled = false;
        btn.textContent = 'Salvar status';
        alert('Nao consegui salvar: ' + e.message);
      });
  }

  function cardHTML(o, idx) {
    // montarOpcoesStatus (lib/status-os.js) garante que o status REAL da linha
    // sempre aparece marcado como selected — mesmo quando ele nao esta nas 5
    // ETAPAS (toda OS nasce com 'Em andamento', que nao esta no enum). Sem
    // isso o browser selecionava a 1a opcao da lista por omissao, e um clique
    // desatento em "Salvar status" reescrevia o status real na planilha.
    var listaOpcoes = (typeof montarOpcoesStatus === 'function') ? montarOpcoesStatus(o.status, ETAPAS) : [];
    var opcoes = listaOpcoes.map(function(op) {
      return '<option value="' + esc(op.valor) + '"' + (op.selecionado ? ' selected' : '') + '>' + esc(op.rotulo) + '</option>';
    }).join('');
    return '' +
      '<div class="al-card" data-idx="' + idx + '" style="background:#161625;border:1px solid #2a2a2a;border-radius:8px;padding:0.85rem 1rem;margin-bottom:0.5rem;">' +
        '<strong style="color:var(--cor-primaria);font-size:1.05rem;">' + esc(o.numeroOS) + '</strong> ' +
        '<span class="badge" style="background:#3b82f6;border-radius:4px;font-size:0.75rem;padding:0.15rem 0.6rem;height:auto;min-width:0;">' + esc(o.status) + '</span>' +
        (o.atendimentoId
          ? ' <button class="os-ir-at btn-secundario btn-sm" data-pv="' + esc(o.atendimentoId) + '">' + esc(o.atendimentoId) + '</button>'
          : ' <span style="color:#f59e0b;">sem atendimento vinculado</span>') +
        '<div>' + esc(o.cliente) + ' &bull; ' + esc(o.modelo) + ' &bull; ' + esc(o.assistencia) + '</div>' +
        '<div style="font-style:italic;color:#9a9a9a;">' + esc(o.problema) + '</div>' +
        '<div style="margin-top:.5rem;display:flex;gap:.5rem;flex-wrap:wrap;">' +
          '<select class="os-status" data-os="' + esc(o.numeroOS) + '" data-status-atual="' + esc(o.status) + '">' + opcoes + '</select>' +
          '<button class="os-salvar btn-secundario btn-sm" data-os="' + esc(o.numeroOS) + '">Salvar status</button>' +
          '<a class="btn-secundario btn-sm" target="_blank" rel="noopener" ' +
             'href="?view=acompanhar&os=' + encodeURIComponent(o.numeroOS) + '">Ver como o cliente vê</a>' +
        '</div>' +
      '</div>';
  }

  function render() {
    var div = document.getElementById('osLista');
    var resumo = document.getElementById('osResumo');
    if (!div) return;

    if (cache.length === 0) {
      div.innerHTML = '<div style="padding:2rem;text-align:center;color:#9a9a9a;">Nenhuma OS encontrada com esses filtros.</div>';
      if (resumo) resumo.textContent = '0 OS';
      return;
    }

    if (resumo) resumo.textContent = cache.length + ' OS';

    div.innerHTML = cache.map(cardHTML).join('');

    div.querySelectorAll('.os-salvar').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var numeroOS = btn.getAttribute('data-os');
        var card = btn.closest('.al-card');
        var select = card ? card.querySelector('.os-status') : null;
        if (!select) return;
        // Guard: nao dispara escrita se a selecao for igual ao status atual —
        // fecha o outro lado do bug do seletor (clique sem querer, ou clique
        // "so pra ver", nao pode nunca reescrever nada na planilha).
        var statusAtual = select.getAttribute('data-status-atual') || '';
        if (select.value === statusAtual) {
          mostrarFeedback('Selecione um status diferente do atual antes de salvar.', 'info');
          return;
        }
        salvarStatus(numeroOS, select.value, btn);
      });
    });

    div.querySelectorAll('.os-ir-at').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-pv');
        // Mesmo hook que atendimentos-lista.js ja usa pra receber busca vinda de
        // outra view (window.__buscaAtendimento) — nao precisa mexer em app.js.
        window.__buscaAtendimento = id;
        if (typeof navigateTo === 'function') navigateTo('atendimentos');
      });
    });
  }

  function setupListeners() {
    document.getElementById('osBtnAplicar').addEventListener('click', function() {
      carregar(filtrosAtuais());
    });
    document.getElementById('osBtnLimpar').addEventListener('click', function() {
      document.getElementById('osStatus').value = '';
      document.getElementById('osBusca').value = '';
      carregar({});
    });
    document.getElementById('osBtnRefresh').addEventListener('click', function() {
      carregar(filtrosAtuais());
    });
    document.getElementById('osBusca').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); carregar(filtrosAtuais()); }
    });
  }

  function mostrarFeedback(msg, tipo) {
    var el = document.getElementById('osFeedback');
    if (!el) return;
    if (!msg) { el.innerHTML = ''; return; }
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.5rem 1rem;border-radius:6px;text-align:center;font-weight:600;font-size:0.85rem;">' + esc(msg) + '</div>';
  }

  function init() {
    var container = document.getElementById('os-lista-container');
    if (!container) return;
    container.innerHTML = buildHTML();
    setupListeners();
    carregar(filtrosAtuais());
  }

  // Ligado em app.js (navigateTo, case 'os') — mesmo mecanismo das outras
  // views (initClientes, initEstoque, initAtendimentosLista). Nada de listener
  // proprio em #nav-tabs: um so caminho pra abrir a tela, igual ao resto do app.
  window.initOSLista = init;
  window.OSLista = { carregar: carregar };
})();
