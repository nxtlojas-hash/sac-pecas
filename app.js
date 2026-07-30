/* ===== NXT SAC V2.24 - App Core ===== */

// --- Global State ---
let currentView = 'home';
let currentModel = null;
let selectedParts = []; // {modelId, idx, nome, preco, peso}

// --- Model metadata ---
const MODEL_ICONS = {
  'kay': '\u26A1',
  'jaya': '\uD83C\uDFCD\uFE0F',
  'juna-smart': '\uD83D\uDEF5',
  'luna': '\uD83C\uDF19',
  'shaka': '\uD83D\uDD25',
  'zilla': '\uD83D\uDC9A',
  'gataka': '\uD83C\uDFCE\uFE0F',
  'pancho': '\uD83E\uDD20',
  'hyphen': '\u2796',
  'vega': '\u2B50',
  'kimbo': '\uD83E\uDD81',
  'juna': '\uD83D\uDEF4',
  'y1': '\uD83D\uDEE3\uFE0F',
  'yzl': '\uD83D\uDEE3\uFE0F',
  'outro': '\u2753'
};

// --- Navigation ---
function navigateTo(view, params) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  const target = document.getElementById('view-' + view);
  if (target) {
    target.classList.add('active');
  }

  const tab = document.querySelector('.nav-tab[data-view="' + view + '"]');
  if (tab) {
    tab.classList.add('active');
  }

  currentView = view;

  if (view === 'home') {
    renderHome();
  } else if (view === 'catalogo') {
    if (params && params.model) {
      openCatalogo(params.model);
    } else {
      mostrarSeletorModelos();
    }
  } else if (view === 'orcamentos') {
    if (typeof loadOrcamentos === 'function') loadOrcamentos();
  } else if (view === 'admin') {
    if (typeof initAdmin === 'function') initAdmin();
  } else if (view === 'assistencia') {
    if (typeof initAssistencia === 'function') initAssistencia();
    // Apos init, aplica preFill se foi setado por outro fluxo (atendimento)
    if (window.__preFillForm) {
      var preFillOs = window.__preFillForm;
      window.__preFillForm = null;
      setTimeout(function() {
        if (typeof aplicarPreFillOS === 'function') aplicarPreFillOS(preFillOs);
      }, 150);
    }
  } else if (view === 'atendimento') {
    if (typeof initAtendimento === 'function') initAtendimento();
  } else if (view === 'estoque') {
    if (typeof window.initEstoque === 'function') window.initEstoque();
  } else if (view === 'clientes') {
    if (typeof window.initClientes === 'function') window.initClientes();
  } else if (view === 'atendimentos') {
    if (typeof window.initAtendimentosLista === 'function') window.initAtendimentosLista();
  } else if (view === 'os') {
    if (typeof window.initOSLista === 'function') window.initOSLista();
  } else if (view === 'dashboard') {
    if (typeof initDashboard === 'function') initDashboard();
  } else if (view === 'formulario') {
    if (window.__preFillForm) {
      var preFillVenda = window.__preFillForm;
      window.__preFillForm = null;
      setTimeout(function() {
        if (typeof aplicarPreFillVenda === 'function') aplicarPreFillVenda(preFillVenda);
      }, 150);
    }
  }
}

// --- Tab click handlers ---
document.getElementById('nav-tabs').addEventListener('click', function(e) {
  const tab = e.target.closest('.nav-tab');
  if (!tab) return;
  const view = tab.dataset.view;
  // Sempre reseta o estado do catalogo ao clicar na aba (mostra seletor)
  if (view === 'catalogo') currentModel = null;
  navigateTo(view);
});

// --- Home: Render atalhos (Atendimento, Catalogo, Registrar, Assistencia, Estoque) + Links uteis (Drive) ---
function renderHome() {
  var grid = document.getElementById('grid-modelos');
  if (!grid) return;

  // Esconde o grid de modelos antigo (vai aparecer so em Catalogo agora)
  grid.style.display = 'none';

  // Cria ou recupera o container de atalhos
  var homeWrap = document.getElementById('home-atalhos-wrap');
  if (homeWrap) homeWrap.remove();
  homeWrap = document.createElement('div');
  homeWrap.id = 'home-atalhos-wrap';

  var acoes = [
    { titulo: 'Atendimento',  icone: '\uD83D\uDCDD', desc: 'Abrir novo atendimento',           tipo: 'view',  alvo: 'atendimento' },
    { titulo: 'Atendimentos', icone: '\uD83D\uDCCB', desc: 'Listar e filtrar atendimentos',    tipo: 'view',  alvo: 'atendimentos' },
    { titulo: 'Clientes',     icone: '\uD83D\uDC64', desc: 'Hist&oacute;rico por CPF/telefone', tipo: 'view',  alvo: 'clientes' },
    { titulo: 'Cat&aacute;logo', icone: '\uD83D\uDCD6', desc: 'Pe&ccedil;as por modelo',         tipo: 'view',  alvo: 'catalogo' },
    { titulo: 'Pe&ccedil;as',       icone: '\uD83D\uDED2', desc: 'Venda ou or&ccedil;amento de pe&ccedil;a', tipo: 'view', alvo: 'formulario' },
    { titulo: 'Abrir OS',    icone: '\uD83D\uDD27', desc: 'Assist&ecirc;ncia t&eacute;cnica e garantia',  tipo: 'view',  alvo: 'assistencia' },
    { titulo: 'Estoque',      icone: '\uD83D\uDCE6', desc: 'Movimenta&ccedil;&otilde;es, invent&aacute;rio, saldo', tipo: 'view', alvo: 'estoque' }
  ];

  var links = [
    { titulo: 'Manuais',          icone: '\uD83D\uDCDA', desc: 'Pasta no Drive',          tipo: 'link', alvo: 'https://drive.google.com/drive/folders/1hVDtxEgwc-BSx1WKrTygpQENo27ovfqp?usp=drive_link' },
    { titulo: 'Tabela de Pre&ccedil;os', icone: '\uD83D\uDCB0', desc: 'Pasta no Drive',  tipo: 'link', alvo: 'https://drive.google.com/drive/folders/1tW8JKNqC6gVRA2Ig68WGgG0ZzzrxZTA2?usp=drive_link' },
    { titulo: 'Quadro Comparativo', icone: '\uD83D\uDCCA', desc: 'Arquivo no Drive',     tipo: 'link', alvo: 'https://drive.google.com/file/d/190mnJT8Rn4sBo_G65DUSmwrMAb-_nlz0/view?usp=drive_link' },
    { titulo: 'Mapa Assist&ecirc;ncias', icone: '\uD83D\uDDFA\uFE0F', desc: 'Google Maps', tipo: 'link', alvo: 'https://www.google.com/maps/d/edit?mid=1wdtuUW-7dQ-OMY2DUJmVJ1ZqiMr-V9o&usp=drive_link' },
    { titulo: 'Mapa Lojas',       icone: '\uD83D\uDCCD', desc: 'Google Maps',             tipo: 'link', alvo: 'https://www.google.com/maps/d/edit?mid=1-Lc86Tm6UgkxEm3r1sE4wQLpHzyvH_Q&usp=drive_link' },
    { titulo: 'Drive do SAC',     icone: '\uD83D\uDCC1', desc: 'Pasta principal',         tipo: 'link', alvo: 'https://drive.google.com/drive/folders/1rTamTXwXDFWIi_0YLgFD1MdzMigcPlNr?usp=drive_link' },
    { titulo: 'Respond.io',       icone: '\uD83D\uDCAC', logoUrl: 'https://www.google.com/s2/favicons?domain=respond.io&sz=64', desc: 'Plataforma de mensagens', tipo: 'link', alvo: 'https://respond.io/' }
  ];

  homeWrap.innerHTML =
    '<section class="home-section" id="home-em-aberto" style="display:none;"></section>' +
    '<section class="home-section home-instrucoes">' +
      '<h2 class="home-section-titulo">Como usar</h2>' +
      '<div class="home-passos">' +
        '<div class="home-passo">' +
          '<div class="home-passo-num">1</div>' +
          '<div class="home-passo-texto"><strong>O contato chega no Respond.</strong> A maior parte dos atendimentos entra aqui sozinha, puxada de l&aacute;. Abra <span style="color:var(--cor-primaria);font-weight:600;">📋 Atendimentos</span> e procure pelo telefone ou CPF antes de qualquer coisa.</div>' +
        '</div>' +
        '<div class="home-passo">' +
          '<div class="home-passo-num">2</div>' +
          '<div class="home-passo-texto"><strong>S&oacute; crie um atendimento novo se n&atilde;o achar</strong> o do cliente na lista. Criar por cima gera dois atendimentos para o mesmo contato.</div>' +
        '</div>' +
        '<div class="home-passo">' +
          '<div class="home-passo-num">3</div>' +
          '<div class="home-passo-texto"><strong>Registre o que o atendimento gerou:</strong> 🔧 Abrir OS para assist&ecirc;ncia e garantia, 🛒 Pe&ccedil;as para venda ou or&ccedil;amento. A OS pede o protocolo <code style="color:var(--cor-primaria);background:#0f0f1a;padding:2px 6px;border-radius:3px;">PV-AAAA-NNNN</code> do atendimento.</div>' +
        '</div>' +
        '<div class="home-passo">' +
          '<div class="home-passo-num">4</div>' +
          '<div class="home-passo-texto"><strong>Acompanhe</strong> em <span style="color:var(--cor-primaria);font-weight:600;">📋 OS</span> (andamento da ordem) ou <span style="color:var(--cor-primaria);font-weight:600;">👤 Clientes</span> (tudo que j&aacute; aconteceu com aquele CPF/telefone).</div>' +
        '</div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:1rem;">' +
        '<a href="https://github.com/nxtlojas-hash/sac-pecas/blob/master/docs/GUIA-USO-SAC.md" target="_blank" rel="noopener" style="color:var(--cor-primaria);text-decoration:none;font-weight:600;font-size:0.9rem;">&#128214; Ver guia completo &rarr;</a>' +
      '</div>' +
    '</section>' +
    '<section class="home-section">' +
      '<h2 class="home-section-titulo">A&ccedil;&otilde;es</h2>' +
      '<div class="home-grid">' +
        acoes.map(function(c) {
          return '<button class="home-card home-card-acao" data-tipo="' + c.tipo + '" data-alvo="' + c.alvo + '">' +
            '<span class="home-card-icone">' + c.icone + '</span>' +
            '<span class="home-card-titulo">' + c.titulo + '</span>' +
            '<span class="home-card-desc">' + c.desc + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +
    '</section>' +
    '<section class="home-section">' +
      '<h2 class="home-section-titulo">Links &uacute;teis</h2>' +
      '<div class="home-grid">' +
        links.map(function(c) {
          var iconeHtml = c.logoUrl
            ? '<img src="' + c.logoUrl + '" alt="' + c.titulo + '" class="home-card-logo" onerror="this.style.display=\'none\';this.parentElement.insertAdjacentHTML(\'afterbegin\', \'<span class=home-card-icone>' + (c.icone || '🔗') + '</span>\');this.remove();">'
            : '<span class="home-card-icone">' + c.icone + '</span>';
          return '<a class="home-card home-card-link" href="' + c.alvo + '" target="_blank" rel="noopener">' +
            iconeHtml +
            '<span class="home-card-titulo">' + c.titulo + '</span>' +
            '<span class="home-card-desc">' + c.desc + '</span>' +
          '</a>';
        }).join('') +
      '</div>' +
    '</section>';

  grid.parentNode.insertBefore(homeWrap, grid);

  // Bind clicks dos cards de a&ccedil;&atilde;o
  homeWrap.querySelectorAll('.home-card-acao').forEach(function(btn) {
    btn.addEventListener('click', function() {
      navigateTo(btn.dataset.alvo);
    });
  });

  // Remove a se&ccedil;&atilde;o antiga de bot&otilde;es se ainda existir
  var btnSectionAntigo = document.getElementById('home-tabela-section');
  if (btnSectionAntigo) btnSectionAntigo.remove();

  carregarEmAberto();
}

// Bloco "Em aberto" na home (Task 9): 5 atendimentos mais antigos + destaque SLA.
function carregarEmAberto() {
  var sec = document.getElementById('home-em-aberto');
  if (!sec || typeof GOOGLE_SCRIPT_URL === 'undefined') return;
  fetch(GOOGLE_SCRIPT_URL + '?action=resumo_pendencias')
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (!resp || !resp.ok || !resp.abertos) { sec.style.display = 'none'; return; }
      var itens = (resp.maisAntigos || []).map(function(a) {
        var cor = a.vencido ? '#ef4444' : (a.diasAberto >= resp.slaDias ? '#f59e0b' : '#9a9a9a');
        var selo = a.diasAberto === 0 ? 'hoje' : (a.diasAberto + 'd');
        return '<button class="em-aberto-item" data-id="' + escapeHtmlApp(a.id) + '" style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;width:100%;text-align:left;background:#161616;border:1px solid #2a2a2a;border-left:3px solid ' + cor + ';border-radius:6px;padding:0.6rem 0.85rem;margin:0.35rem 0;cursor:pointer;color:#e8e8f0;">' +
            '<span><strong style="color:var(--cor-primaria);">' + escapeHtmlApp(a.id) + '</strong> &bull; ' + escapeHtmlApp(a.nomeCliente || '—') + ' <span style="color:#7a7a7a;">(' + escapeHtmlApp(a.status) + ')</span></span>' +
            '<span style="color:' + cor + ';font-weight:700;font-size:0.85rem;white-space:nowrap;">' + selo + (a.vencido ? ' &#9888;' : '') + '</span>' +
          '</button>';
      }).join('');
      sec.innerHTML =
        '<h2 class="home-section-titulo">Em aberto ' +
          '<span style="font-size:0.8rem;color:#9a9a9a;font-weight:400;">' + resp.abertos + ' no total' +
          (resp.vencidos ? ' &bull; <span style="color:#ef4444;font-weight:700;">' + resp.vencidos + ' fora do SLA (' + resp.slaDias + 'd)</span>' : '') +
          '</span></h2>' +
        itens +
        '<div style="text-align:center;margin-top:0.5rem;"><a href="#" id="em-aberto-vertodos" style="color:var(--cor-primaria);text-decoration:none;font-weight:600;font-size:0.88rem;">Ver todos os atendimentos &rarr;</a></div>';
      sec.style.display = '';
      sec.querySelectorAll('.em-aberto-item').forEach(function(b) {
        b.addEventListener('click', function() { abrirAtendimentoPorId(b.dataset.id); });
      });
      var verTodos = document.getElementById('em-aberto-vertodos');
      if (verTodos) verTodos.addEventListener('click', function(e) { e.preventDefault(); navigateTo('atendimentos'); });
    })
    .catch(function() { sec.style.display = 'none'; });
}

// Abre a lista de atendimentos ja filtrada por um protocolo (link direto da home).
function abrirAtendimentoPorId(id) {
  window.__buscaAtendimento = id;
  navigateTo('atendimentos');
}

// Badge de pendencias no nav (Task 9).
function atualizarBadgeAtendimentos() {
  var badge = document.getElementById('badge-atendimentos');
  if (!badge || typeof GOOGLE_SCRIPT_URL === 'undefined') return;
  fetch(GOOGLE_SCRIPT_URL + '?action=resumo_pendencias')
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (resp && resp.ok && resp.abertos > 0) {
        badge.textContent = resp.abertos;
        badge.style.display = 'inline-flex';
        badge.style.background = resp.vencidos ? '#ef4444' : '';
      } else {
        badge.style.display = 'none';
      }
    })
    .catch(function() { /* silencioso */ });
}

// ============================================================
// Dashboard interno (Task 9)
// ============================================================
window.initDashboard = function() {
  var cont = document.getElementById('dashboard-container');
  if (!cont) return;
  cont.innerHTML = '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128202; Dashboard</h2>' +
    '<p style="color:#9a9a9a;text-align:center;padding:2rem;">Carregando dados…</p>';

  Promise.all([
    fetch(GOOGLE_SCRIPT_URL + '?action=listar_atendimentos&limite=100000').then(function(r) { return r.json(); }),
    fetch(GOOGLE_SCRIPT_URL + '?action=resumo_nps').then(function(r) { return r.json(); })
  ]).then(function(res) {
    var ats = (res[0] && res[0].atendimentos) || [];
    var nps = res[1] || {};
    cont.innerHTML = '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128202; Dashboard</h2>' + montarDashboard(ats, nps);
  }).catch(function() {
    cont.innerHTML = '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128202; Dashboard</h2>' +
      '<p style="color:#ef4444;text-align:center;padding:2rem;">Não foi possível carregar os dados agora.</p>';
  });
};

function montarDashboard(ats, nps) {
  var FIN = { 'Resolvido': 1, 'Fechado': 1 };
  var total = ats.length, abertos = 0, fechados = 0, somaDias = 0, nFech = 0;
  var porMes = {}, porMotivo = {}, porVend = {};

  ats.forEach(function(a) {
    var fin = FIN[String(a.status || '').trim()];
    if (fin) fechados++; else abertos++;

    var dAb = a.dataAbertura ? new Date(a.dataAbertura) : null;
    if (dAb && !isNaN(dAb.getTime())) {
      var mes = dAb.getFullYear() + '-' + ('0' + (dAb.getMonth() + 1)).slice(-2);
      porMes[mes] = (porMes[mes] || 0) + 1;
    }
    if (fin && dAb && a.dataFechamento) {
      var dF = new Date(a.dataFechamento);
      if (!isNaN(dF.getTime()) && !isNaN(dAb.getTime()) && dF >= dAb) { somaDias += (dF - dAb) / 86400000; nFech++; }
    }
    var mot = String(a.motivo || '—').trim() || '—';
    porMotivo[mot] = (porMotivo[mot] || 0) + 1;
    var vend = String(a.vendedor || '—').trim() || '—';
    porVend[vend] = (porVend[vend] || 0) + 1;
  });

  var tempoMedio = nFech ? (Math.round(somaDias / nFech * 10) / 10) : null;

  function kpi(rotulo, valor, cor) {
    return '<div style="flex:1 1 120px;background:#161616;border:1px solid #2a2a2a;border-radius:8px;padding:0.9rem;text-align:center;">' +
      '<div style="font-size:1.8rem;font-weight:900;color:' + (cor || '#fff') + ';">' + valor + '</div>' +
      '<div style="font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;letter-spacing:0.5px;margin-top:0.2rem;">' + rotulo + '</div>' +
    '</div>';
  }

  function tabelaBarras(titulo, obj, opts) {
    opts = opts || {};
    var pares = Object.keys(obj).map(function(k) { return [k, obj[k]]; });
    pares.sort(function(a, b) { return opts.chave ? (a[0] < b[0] ? -1 : 1) : (b[1] - a[1]); });
    if (opts.top) pares = pares.slice(0, opts.top);
    var max = pares.reduce(function(m, p) { return Math.max(m, p[1]); }, 0) || 1;
    var linhas = pares.map(function(p) {
      var pct = Math.round(p[1] / max * 100);
      var cor = opts.cor || 'var(--cor-primaria)';
      return '<div style="margin:0.35rem 0;">' +
          '<div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#e8e8f0;margin-bottom:2px;">' +
            '<span>' + escapeHtmlApp(p[0]) + '</span><strong>' + p[1] + '</strong>' +
          '</div>' +
          '<div style="height:8px;background:#0d0d0d;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + cor + ';"></div></div>' +
        '</div>';
    }).join('') || '<p style="color:#7a7a7a;font-size:0.85rem;">Sem dados.</p>';
    return '<div style="flex:1 1 320px;background:#161616;border:1px solid #2a2a2a;border-radius:8px;padding:1rem;">' +
        '<h3 style="color:#cfcfcf;font-size:0.95rem;margin-bottom:0.6rem;">' + titulo + '</h3>' + linhas +
      '</div>';
  }

  var npsCor = nps.nps >= 50 ? '#22c55e' : (nps.nps >= 0 ? '#f59e0b' : '#ef4444');

  return '' +
    '<div style="display:flex;flex-wrap:wrap;gap:0.6rem;margin-bottom:1rem;">' +
      kpi('Total', total, '#fff') +
      kpi('Em aberto', abertos, '#f59e0b') +
      kpi('Fechados', fechados, '#22c55e') +
      kpi('Tempo médio', tempoMedio === null ? '—' : (tempoMedio + 'd'), '#fff') +
      kpi('NPS', nps.total ? nps.nps : '—', npsCor) +
      kpi('Nota média', nps.total ? nps.media : '—', npsCor) +
    '</div>' +
    (nps.total ? '<div style="background:#161616;border:1px solid #2a2a2a;border-radius:8px;padding:1rem;margin-bottom:1rem;font-size:0.9rem;color:#e8e8f0;">' +
      '<strong style="color:#cfcfcf;">NPS (' + nps.total + ' respostas):</strong> ' +
      '<span style="color:#22c55e;">' + nps.promotores + ' promotores</span> &bull; ' +
      '<span style="color:#f59e0b;">' + nps.neutros + ' neutros</span> &bull; ' +
      '<span style="color:#ef4444;">' + nps.detratores + ' detratores</span>' +
    '</div>' : '') +
    '<div style="display:flex;flex-wrap:wrap;gap:0.6rem;">' +
      tabelaBarras('Atendimentos por mês', porMes, { chave: true, cor: '#3b82f6' }) +
      tabelaBarras('Top motivos', porMotivo, { top: 8 }) +
      tabelaBarras('Por responsável', porVend, { top: 8, cor: '#a855f7' }) +
    '</div>';
}

// --- NPS: envia pesquisa por WhatsApp + marca npsEnviado no backend ---
window.enviarNPSWhatsApp = function(atendimentoId, telefone, nomeCliente) {
  var tel = String(telefone || '').replace(/\D/g, '');
  if (tel.length < 10) {
    alert('Telefone do cliente invalido — nao da pra enviar NPS por WhatsApp.');
    return;
  }
  var primeiroNome = String(nomeCliente || 'Cliente').split(' ')[0];
  var linkNps = 'https://nxtlojas-hash.github.io/sac-pecas/?view=nps&id=' + encodeURIComponent(atendimentoId);
  var msg = 'Ola ' + primeiroNome + '! Aqui da NXT SAC.\n\n' +
    'Seu atendimento ' + atendimentoId + ' foi concluído. Sua opinião é muito importante!\n\n' +
    '⭐ *De 0 a 10, o quanto você recomendaria nosso atendimento para um amigo?*\n\n' +
    'Avalie em 1 clique: ' + linkNps + '\n\n' +
    'Se preferir, pode responder por aqui mesmo com a nota e um comentário. Obrigado! 🙏';

  window.open('https://wa.me/55' + tel + '?text=' + encodeURIComponent(msg), '_blank');

  // Marca como enviado no backend (best effort)
  if (typeof GOOGLE_SCRIPT_URL !== 'undefined') {
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'marcar_nps_enviado', id: atendimentoId }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }).catch(function() { /* silencioso */ });
  }
};

// --- Guide modal ---
function abrirGuiaUso() {
  var existing = document.getElementById('modal-guia-uso');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'modal-guia-uso';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML =
    '<div class="modal-content" style="max-width:700px;max-height:90vh;overflow-y:auto;">' +
      '<button class="modal-close" onclick="document.getElementById(\'modal-guia-uso\').remove()">&times;</button>' +
      '<h2 style="color:var(--cor-primaria);text-align:center;margin-bottom:1rem;">Guia de Uso - NXT SAC Pecas V2</h2>' +

      '<div class="guia-section">' +
        '<h3>1. Consultar Pecas (Catalogo)</h3>' +
        '<p>Clique no modelo da moto na tela inicial para ver todas as pecas com foto, preco e peso.</p>' +
        '<ul>' +
          '<li>Use o campo "Buscar peca..." para filtrar por nome</li>' +
          '<li>Clique na foto para ampliar (zoom)</li>' +
          '<li>Marque "Revenda (-15%)" para ver preco de revenda</li>' +
          '<li>Badges de estoque: <span style="color:#22c55e;">verde</span> = disponivel, <span style="color:#f59e0b;">amarelo</span> = parcial, <span style="color:#ef4444;">vermelho</span> = indisponivel</li>' +
        '</ul>' +
      '</div>' +

      '<div class="guia-section">' +
        '<h3>2. Registrar Venda/Garantia</h3>' +
        '<p><strong>Pelo Catalogo (recomendado):</strong> clique "Registrar" na peca desejada. Ela e adicionada ao formulario com preco e peso. Continue adicionando mais pecas pelo catalogo.</p>' +
        '<p><strong>Manualmente:</strong> aba "Registrar", preencha tipo (SAC/Sumare/Garantia), cliente, pecas, frete e pagamento.</p>' +
        '<p>O sistema salva na planilha e envia para o Bling automaticamente.</p>' +
      '</div>' +

      '<div class="guia-section">' +
        '<h3>3. Orcamentos</h3>' +
        '<ul>' +
          '<li><strong>Criar:</strong> aba Orcamentos > Novo Orcamento > adicione pecas > Salvar ou Salvar + PDF</li>' +
          '<li><strong>Resgatar:</strong> busque por numero (ORC-...), nome, telefone ou data</li>' +
          '<li><strong>Aprovar:</strong> abra o orcamento > "Aprovar > Registrar" > formulario preenchido automaticamente</li>' +
          '<li><strong>PDF:</strong> gerado no Google Drive, link salvo na planilha</li>' +
          '<li><strong>Status:</strong> Pendente (amarelo), Aprovado (verde), Expirado (vermelho)</li>' +
        '</ul>' +
      '</div>' +

      '<div class="guia-section">' +
        '<h3>4. Controle de Estoque</h3>' +
        '<ul>' +
          '<li><strong>Ver:</strong> badges no catalogo ou botao "Controle de Estoque"</li>' +
          '<li><strong>Editar:</strong> Admin > aba Estoque > clique no numero > digite > Enter</li>' +
          '<li><strong>Baixa automatica:</strong> ao registrar venda, estoque e decrementado</li>' +
          '<li>Nao bloqueia a venda se estoque for zero (apenas alerta)</li>' +
        '</ul>' +
      '</div>' +

      '<div class="guia-section">' +
        '<h3>5. Admin - Gerenciar Pecas</h3>' +
        '<ul>' +
          '<li><strong>Nova peca:</strong> Admin > Nova Peca > preencha nome, modelo(s), preco, peso, foto</li>' +
          '<li><strong>Editar:</strong> icone de lapis na tabela ou no card do catalogo</li>' +
          '<li><strong>Excluir:</strong> icone de lixeira na tabela</li>' +
          '<li>Pecas podem pertencer a multiplos modelos</li>' +
          '<li>Todas alteracoes sao salvas no Google Sheets</li>' +
        '</ul>' +
      '</div>' +

      '<div class="guia-section">' +
        '<h3>Resumo Rapido</h3>' +
        '<table style="width:100%;font-size:0.82rem;border-collapse:collapse;">' +
          '<tr style="border-bottom:1px solid var(--cor-borda);"><td style="padding:0.4rem;"><strong>Identificar peca</strong></td><td style="padding:0.4rem;">Inicio > modelo > catalogo</td></tr>' +
          '<tr style="border-bottom:1px solid var(--cor-borda);"><td style="padding:0.4rem;"><strong>Saber preco/peso</strong></td><td style="padding:0.4rem;">Catalogo ou Tabela de Precos</td></tr>' +
          '<tr style="border-bottom:1px solid var(--cor-borda);"><td style="padding:0.4rem;"><strong>Registrar venda</strong></td><td style="padding:0.4rem;">Catalogo > "Registrar" > completar formulario</td></tr>' +
          '<tr style="border-bottom:1px solid var(--cor-borda);"><td style="padding:0.4rem;"><strong>Fazer orcamento</strong></td><td style="padding:0.4rem;">Orcamentos > Novo > pecas > Salvar</td></tr>' +
          '<tr style="border-bottom:1px solid var(--cor-borda);"><td style="padding:0.4rem;"><strong>Resgatar orcamento</strong></td><td style="padding:0.4rem;">Orcamentos > buscar nome/numero</td></tr>' +
          '<tr style="border-bottom:1px solid var(--cor-borda);"><td style="padding:0.4rem;"><strong>Aprovar orcamento</strong></td><td style="padding:0.4rem;">Abrir > Aprovar > vira registro</td></tr>' +
          '<tr style="border-bottom:1px solid var(--cor-borda);"><td style="padding:0.4rem;"><strong>Ver estoque</strong></td><td style="padding:0.4rem;">Badges no catalogo</td></tr>' +
          '<tr><td style="padding:0.4rem;"><strong>Atualizar estoque</strong></td><td style="padding:0.4rem;">Admin > Estoque > editar quantidade</td></tr>' +
        '</table>' +
      '</div>' +
    '</div>';

  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
}

// --- Navigate to stock control ---
function abrirControleEstoque() {
  navigateTo('admin');
  setTimeout(function() {
    var tab = document.querySelector('[data-admin-tab="estoque"]');
    if (tab) tab.click();
  }, 300);
}

// --- Full price table ---
function abrirTabelaPrecos() {
  var existing = document.getElementById('modal-tabela-precos');
  if (existing) existing.remove();

  // Collect all parts
  var allParts = [];
  Object.keys(CATALOGO_MODELOS).forEach(function(modelId) {
    var model = CATALOGO_MODELOS[modelId];
    model.pecas.forEach(function(p) {
      allParts.push({
        modelo: model.nome,
        nome: p.nome,
        preco: p.preco,
        precoRevenda: p.preco != null ? p.preco * 0.85 : null,
        peso: p.peso || '-'
      });
    });
  });

  // Sort by modelo then nome
  allParts.sort(function(a, b) {
    var cmp = a.modelo.localeCompare(b.modelo);
    if (cmp !== 0) return cmp;
    return a.nome.localeCompare(b.nome);
  });

  // Build table rows
  var rowsHtml = allParts.map(function(p) {
    var precoCliente = p.preco != null ? 'R$ ' + formatarValor(p.preco) : '-';
    var precoRevenda = p.precoRevenda != null ? 'R$ ' + formatarValor(p.precoRevenda) : '-';
    return '<tr>' +
      '<td>' + p.modelo + '</td>' +
      '<td>' + p.nome + '</td>' +
      '<td>' + precoCliente + '</td>' +
      '<td>' + precoRevenda + '</td>' +
      '<td>' + p.peso + '</td>' +
    '</tr>';
  }).join('');

  var modal = document.createElement('div');
  modal.id = 'modal-tabela-precos';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML =
    '<div class="modal-content" style="max-width:900px;max-height:90vh;display:flex;flex-direction:column;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--cor-borda);">' +
        '<h3 style="font-size:1.1rem;font-weight:700;color:var(--cor-primaria);margin:0;">\uD83D\uDCCA Tabela Completa de Precos</h3>' +
        '<button class="modal-close" id="btn-fechar-tabela">&times;</button>' +
      '</div>' +
      '<div style="padding:0.75rem 1.25rem;">' +
        '<input type="text" id="tabela-precos-search" class="search-input" placeholder="Buscar peca ou modelo..." style="width:100%;">' +
      '</div>' +
      '<div style="padding:0 1.25rem;font-size:0.8rem;color:var(--cor-texto-claro);margin-bottom:0.5rem;">' +
        '<span id="tabela-precos-stats">' + allParts.length + ' pecas</span>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto;padding:0 1.25rem 1rem;">' +
        '<table class="orc-detail-table" id="tabela-precos-table">' +
          '<thead><tr>' +
            '<th>Modelo</th>' +
            '<th>Peca</th>' +
            '<th>Preco Cliente</th>' +
            '<th>Preco Revenda</th>' +
            '<th>Peso</th>' +
          '</tr></thead>' +
          '<tbody id="tabela-precos-body">' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  // Close handlers
  document.getElementById('btn-fechar-tabela').addEventListener('click', function() {
    modal.remove();
  });
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.remove();
  });

  // Search filter
  document.getElementById('tabela-precos-search').addEventListener('input', function() {
    var q = this.value.toLowerCase().trim();
    var tbody = document.getElementById('tabela-precos-body');
    var rows = tbody.querySelectorAll('tr');
    var shown = 0;
    rows.forEach(function(row) {
      var text = row.textContent.toLowerCase();
      var match = !q || text.indexOf(q) !== -1;
      row.style.display = match ? '' : 'none';
      if (match) shown++;
    });
    document.getElementById('tabela-precos-stats').textContent = shown + ' de ' + allParts.length + ' pecas';
  });
}

// --- Utilities ---
function formatarValor(n) {
  if (n == null) return null;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoeda(str) {
  if (!str) return NaN;
  // "1.234,56" -> 1234.56
  return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

function parseWeight(str) {
  if (!str) return 0;
  str = str.trim().toLowerCase();
  if (str.endsWith('kg')) {
    return parseFloat(str.replace(',', '.').replace('kg', '')) * 1000;
  }
  if (str.endsWith('gr')) {
    return parseFloat(str.replace(',', '.').replace('gr', ''));
  }
  if (str.endsWith('g')) {
    return parseFloat(str.replace(',', '.').replace('g', ''));
  }
  return parseFloat(str.replace(',', '.')) || 0;
}

function formatWeight(grams) {
  if (!grams || grams === 0) return '';
  if (grams >= 1000) {
    return (grams / 1000).toFixed(2).replace('.', ',') + 'kg';
  }
  return Math.round(grams) + 'gr';
}

function mostrarFeedback(msg, tipo) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast toast-' + (tipo || 'info');
  toast.style.display = 'block';
  toast.offsetHeight; // force reflow
  toast.classList.add('toast-show');

  setTimeout(function() {
    toast.classList.remove('toast-show');
    setTimeout(function() {
      toast.style.display = 'none';
    }, 300);
  }, 2500);
}

function updateSelectionBadge() {
  var badge = document.getElementById('badge-orcamentos');
  if (selectedParts.length > 0) {
    badge.textContent = selectedParts.length;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

// --- Init ---
// ============================================================
// Acompanhamento publico da OS (plano 6 Task 7)
// URL: ?view=acompanhar&os=OS-2026-0001 — pagina limpa, sem nav.
// ============================================================

// Gera um QR como data URL usando qrcode.min.js (global). Usado tambem
// pelo documento da OS (assistencia.js) para imprimir o QR no papel.
function gerarQrDataUrl(texto, tam) {
  if (typeof QRCode === 'undefined' || !texto) return '';
  var div = document.createElement('div');
  div.style.display = 'none';
  document.body.appendChild(div);
  try {
    new QRCode(div, { text: texto, width: tam || 120, height: tam || 120, correctLevel: QRCode.CorrectLevel.M });
    var canvas = div.querySelector('canvas');
    if (canvas) return canvas.toDataURL('image/png');
    var img = div.querySelector('img');
    return img ? img.src : '';
  } catch (e) {
    return '';
  } finally {
    document.body.removeChild(div);
  }
}

function renderAcompanhar(os) {
  var COR = '#c6ff00';
  document.title = 'Acompanhe sua OS' + (os ? ' ' + os : '') + ' — NXT';
  document.body.innerHTML =
    '<div style="max-width:520px;margin:0 auto;padding:2rem 1.25rem;font-family:Arial,Helvetica,sans-serif;color:#e8e8f0;">' +
      '<div style="text-align:center;margin-bottom:1.5rem;">' +
        '<img src="logo-nxt.png" alt="NXT" style="height:44px;width:auto;">' +
        '<div style="color:' + COR + ';font-weight:700;letter-spacing:1px;font-size:0.8rem;margin-top:0.4rem;">ACOMPANHAMENTO DE ORDEM DE SERVIÇO</div>' +
      '</div>' +
      '<div id="acomp-body" style="background:#161616;border:1px solid #2a2a2a;border-radius:10px;padding:1.5rem;">' +
        '<p style="color:#9a9a9a;text-align:center;">Carregando…</p>' +
      '</div>' +
      '<p style="text-align:center;color:#6a6a6a;font-size:0.75rem;margin-top:1.25rem;">NXT Mobilidade Elétrica</p>' +
    '</div>';
  document.body.style.background = '#0d0d0d';

  var body = document.getElementById('acomp-body');
  if (!os) { body.innerHTML = '<p style="color:#ef4444;text-align:center;">Informe o número da OS.</p>'; return; }

  fetch(GOOGLE_SCRIPT_URL + '?action=status_publico&os=' + encodeURIComponent(os))
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (!resp || !resp.ok) {
        body.innerHTML = '<p style="color:#ef4444;text-align:center;">OS não encontrada. Confira o número com a loja.</p>';
        return;
      }
      var etapas = resp.etapas || [];
      var atual = resp.etapaAtual || 0;
      var timeline = etapas.map(function(nome, i) {
        var feito = i < atual, aqui = i === atual;
        var cor = feito ? '#22c55e' : (aqui ? COR : '#3a3a3a');
        var bolinha = feito ? '&#10003;' : (aqui ? '&#9679;' : (i + 1));
        var linha = i < etapas.length - 1
          ? '<div style="width:2px;height:22px;background:' + (feito ? '#22c55e' : '#3a3a3a') + ';margin:2px 0 2px 13px;"></div>' : '';
        return '<div style="display:flex;align-items:center;gap:0.75rem;">' +
            '<div style="flex:0 0 28px;height:28px;border-radius:50%;background:' + cor + ';color:#0d0d0d;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">' + bolinha + '</div>' +
            '<div style="color:' + (aqui ? '#fff' : (feito ? '#cfcfcf' : '#7a7a7a')) + ';font-weight:' + (aqui ? '700' : '400') + ';">' + escapeHtmlApp(nome) + '</div>' +
          '</div>' + linha;
      }).join('');

      body.innerHTML =
        '<div style="text-align:center;margin-bottom:1.25rem;">' +
          '<div style="font-size:1.6rem;font-weight:900;color:' + COR + ';letter-spacing:1px;">' + escapeHtmlApp(resp.os) + '</div>' +
          (resp.modelo ? '<div style="color:#9a9a9a;font-size:0.9rem;margin-top:0.2rem;">' + escapeHtmlApp(resp.modelo) + '</div>' : '') +
        '</div>' +
        '<div style="margin:0 auto;max-width:300px;">' + timeline + '</div>' +
        '<div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid #2a2a2a;font-size:0.85rem;color:#9a9a9a;">' +
          (resp.assistencia ? '<div><strong style="color:#cfcfcf;">Assistência:</strong> ' + escapeHtmlApp(resp.assistencia) + '</div>' : '') +
          (resp.problemaResumo ? '<div style="margin-top:0.3rem;"><strong style="color:#cfcfcf;">Problema:</strong> ' + escapeHtmlApp(resp.problemaResumo) + '</div>' : '') +
          (resp.atualizadoEm ? '<div style="margin-top:0.3rem;color:#6a6a6a;font-size:0.78rem;">Aberta em ' + escapeHtmlApp(resp.atualizadoEm) + '</div>' : '') +
        '</div>';
    })
    .catch(function() {
      body.innerHTML = '<p style="color:#ef4444;text-align:center;">Não foi possível carregar agora. Tente de novo em instantes.</p>';
    });
}

function escapeHtmlApp(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// NPS publico (plano 6 Task 8) — ?view=nps&id=PV-2026-0001
// ============================================================
function renderNps(id) {
  var COR = '#c6ff00';
  var notaSel = null;
  document.title = 'Avalie seu atendimento — NXT';
  document.body.style.background = '#0d0d0d';

  function wrap(inner) {
    document.body.innerHTML =
      '<div style="max-width:520px;margin:0 auto;padding:2rem 1.25rem;font-family:Arial,Helvetica,sans-serif;color:#e8e8f0;">' +
        '<div style="text-align:center;margin-bottom:1.5rem;">' +
          '<img src="logo-nxt.png" alt="NXT" style="height:44px;width:auto;">' +
          '<div style="color:' + COR + ';font-weight:700;letter-spacing:1px;font-size:0.8rem;margin-top:0.4rem;">PESQUISA DE SATISFAÇÃO</div>' +
        '</div>' +
        '<div id="nps-body" style="background:#161616;border:1px solid #2a2a2a;border-radius:10px;padding:1.5rem;">' + inner + '</div>' +
        '<p style="text-align:center;color:#6a6a6a;font-size:0.75rem;margin-top:1.25rem;">NXT Mobilidade Elétrica</p>' +
      '</div>';
  }

  function agradecer(nota) {
    wrap(
      '<div style="text-align:center;padding:1rem 0;">' +
        '<div style="font-size:3rem;">&#128153;</div>' +
        '<h2 style="color:' + COR + ';margin:0.75rem 0;">Obrigado pela sua avaliação!</h2>' +
        '<p style="color:#9a9a9a;">Sua nota <strong style="color:#fff;">' + nota + '</strong> foi registrada. Sua opinião ajuda a NXT a melhorar.</p>' +
      '</div>');
  }

  if (!id) { wrap('<p style="color:#ef4444;text-align:center;">Link inválido (sem protocolo).</p>'); return; }

  wrap(
    '<p style="text-align:center;color:#e8e8f0;font-size:0.95rem;margin-bottom:1rem;">De <strong>0</strong> a <strong>10</strong>, o quanto você recomendaria o atendimento da NXT para um amigo?</p>' +
    '<div id="nps-notas" style="display:flex;flex-wrap:wrap;gap:0.4rem;justify-content:center;margin-bottom:1rem;"></div>' +
    '<textarea id="nps-coment" rows="3" placeholder="Quer deixar um comentário? (opcional)" style="width:100%;box-sizing:border-box;background:#0d0d0d;border:1px solid #2a2a2a;border-radius:6px;color:#e8e8f0;padding:0.6rem;font-family:inherit;font-size:0.9rem;resize:vertical;"></textarea>' +
    '<button id="nps-enviar" style="width:100%;margin-top:1rem;padding:0.75rem;background:' + COR + ';color:#0d0d0d;border:none;border-radius:6px;font-weight:700;font-size:1rem;cursor:pointer;opacity:0.5;" disabled>Enviar avaliação</button>' +
    '<div id="nps-feedback" style="margin-top:0.75rem;text-align:center;font-size:0.85rem;"></div>');

  var cont = document.getElementById('nps-notas');
  for (var n = 0; n <= 10; n++) {
    (function(valor) {
      var b = document.createElement('button');
      var cor = valor <= 6 ? '#ef4444' : (valor <= 8 ? '#f59e0b' : '#22c55e');
      b.textContent = valor;
      b.style.cssText = 'flex:0 0 40px;height:40px;border-radius:8px;border:2px solid ' + cor + ';background:transparent;color:' + cor + ';font-weight:700;font-size:0.95rem;cursor:pointer;transition:all 0.12s;';
      b.addEventListener('click', function() {
        notaSel = valor;
        Array.prototype.forEach.call(cont.children, function(el) {
          el.style.background = 'transparent';
          el.style.color = el.style.borderColor;
        });
        b.style.background = cor;
        b.style.color = '#0d0d0d';
        var env = document.getElementById('nps-enviar');
        env.disabled = false;
        env.style.opacity = '1';
      });
      cont.appendChild(b);
    })(n);
  }

  document.getElementById('nps-enviar').addEventListener('click', function() {
    if (notaSel === null) return;
    var btn = this;
    btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'Enviando…';
    var coment = (document.getElementById('nps-coment').value || '').slice(0, 500);
    var url = GOOGLE_SCRIPT_URL + '?action=registrar_nps&id=' + encodeURIComponent(id) +
      '&nota=' + notaSel + '&comentario=' + encodeURIComponent(coment);
    fetch(url).then(function(r) { return r.json(); }).then(function(resp) {
      if (resp && resp.ok) { agradecer(notaSel); return; }
      var fb = document.getElementById('nps-feedback');
      if (resp && resp.erro === 'ja respondido') {
        wrap('<p style="text-align:center;color:#9a9a9a;">Este atendimento já foi avaliado. Obrigado! &#128153;</p>');
      } else {
        fb.innerHTML = '<span style="color:#ef4444;">Não foi possível registrar (' + escapeHtmlApp(resp && resp.erro || 'erro') + '). Tente de novo.</span>';
        btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Enviar avaliação';
      }
    }).catch(function() {
      document.getElementById('nps-feedback').innerHTML = '<span style="color:#ef4444;">Falha de conexão. Tente novamente.</span>';
      btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Enviar avaliação';
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var params = new URLSearchParams(location.search);
  if (params.get('view') === 'acompanhar') {
    renderAcompanhar((params.get('os') || '').trim());
    return; // pagina publica: nao inicializa o app interno
  }
  if (params.get('view') === 'nps') {
    renderNps((params.get('id') || '').trim());
    return; // pagina publica
  }
  renderHome();
  updateSelectionBadge();
  atualizarBadgeAtendimentos();
  if (typeof initFormulario === 'function') initFormulario();
  if (typeof initOrcamentos === 'function') initOrcamentos();
  if (typeof loadPartsFromSheets === 'function') loadPartsFromSheets();
});
