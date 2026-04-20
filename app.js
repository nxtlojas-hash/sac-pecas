/* ===== NXT PECAS V2.1 - App Core ===== */

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
  } else if (view === 'catalogo' && params && params.model) {
    openCatalogo(params.model);
  } else if (view === 'orcamentos') {
    if (typeof loadOrcamentos === 'function') loadOrcamentos();
  } else if (view === 'admin') {
    if (typeof initAdmin === 'function') initAdmin();
  } else if (view === 'assistencia') {
    if (typeof initAssistencia === 'function') initAssistencia();
  }
}

// --- Tab click handlers ---
document.getElementById('nav-tabs').addEventListener('click', function(e) {
  const tab = e.target.closest('.nav-tab');
  if (!tab) return;
  const view = tab.dataset.view;
  if (view === 'catalogo' && !currentModel) {
    navigateTo('home');
    return;
  }
  navigateTo(view);
});

// --- Home: Render model cards ---
function renderHome() {
  const grid = document.getElementById('grid-modelos');
  grid.innerHTML = '';

  Object.keys(CATALOGO_MODELOS).forEach(function(modelId) {
    const model = CATALOGO_MODELOS[modelId];
    const count = model.pecas.length;
    const card = document.createElement('div');
    card.className = 'modelo-card';
    card.innerHTML =
      '<div class="modelo-img"><img src="img/modelos/' + modelId + '.png" alt="' + model.nome + '" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<span class=modelo-icon-fallback>' + (MODEL_ICONS[modelId] || '\uD83D\uDEE0\uFE0F') + '</span>\';"></div>' +
      '<div class="modelo-nome">' + model.nome + '</div>' +
      '<div class="modelo-count">' + count + ' pecas</div>';

    card.addEventListener('click', function() {
      currentModel = modelId;
      navigateTo('catalogo', { model: modelId });
    });

    grid.appendChild(card);
  });

  // Price table button and stock control button
  var btnSection = document.getElementById('home-tabela-section');
  if (!btnSection) {
    btnSection = document.createElement('div');
    btnSection.id = 'home-tabela-section';
    btnSection.style.cssText = 'text-align:center;padding:1.5rem 0;display:flex;flex-wrap:wrap;justify-content:center;gap:0.75rem;';
    btnSection.innerHTML =
      '<button class="btn-secundario" onclick="abrirTabelaPrecos()" style="font-size:1rem;padding:0.75rem 2rem;">' +
        '\uD83D\uDCCA Tabela Completa de Precos' +
      '</button>' +
      '<button class="btn-secundario" onclick="abrirControleEstoque()" style="font-size:1rem;padding:0.75rem 2rem;">' +
        '\uD83D\uDCE6 Controle de Estoque' +
      '</button>' +
      '<button class="btn-secundario" onclick="abrirGuiaUso()" style="font-size:1rem;padding:0.75rem 2rem;">' +
        '\uD83D\uDCD6 Guia de Uso' +
      '</button>' +
      '<button class="btn-secundario" onclick="navigateTo(\'assistencia\')" style="font-size:1rem;padding:0.75rem 2rem;background:var(--cor-primaria);color:#fff;">' +
        '\uD83D\uDD27 Abrir OS Assistencia' +
      '</button>';
    grid.parentNode.insertBefore(btnSection, grid.nextSibling);
  }
}

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
document.addEventListener('DOMContentLoaded', function() {
  renderHome();
  updateSelectionBadge();
  if (typeof initFormulario === 'function') initFormulario();
  if (typeof initOrcamentos === 'function') initOrcamentos();
  if (typeof loadPartsFromSheets === 'function') loadPartsFromSheets();
});
