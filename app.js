/* ===== NXT PECAS V2 - App Core ===== */

// --- Global State ---
let currentView = 'home';
let currentModel = null;
let selectedParts = []; // {modelId, idx, nome, preco, peso}

// --- Model metadata ---
const MODEL_ICONS = {
  'e-kay': '\u26A1',
  'jaya': '\uD83C\uDFCD\uFE0F',
  'juna-smart': '\uD83D\uDEF5',
  'luna': '\uD83C\uDF19',
  'shaka': '\uD83D\uDD25',
  'zilla': '\uD83D\uDC9A'
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
    const icon = MODEL_ICONS[modelId] || '\uD83D\uDEE0\uFE0F';

    const card = document.createElement('div');
    card.className = 'modelo-card';
    card.innerHTML =
      '<div class="modelo-icon">' + icon + '</div>' +
      '<div class="modelo-nome">' + model.nome + '</div>' +
      '<div class="modelo-count">' + count + ' pecas</div>';

    card.addEventListener('click', function() {
      currentModel = modelId;
      navigateTo('catalogo', { model: modelId });
    });

    grid.appendChild(card);
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
});
