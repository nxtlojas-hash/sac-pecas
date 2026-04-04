/* ===== NXT PECAS V2 - Catalogo ===== */

let catalogoPecas = [];
let catalogoModelId = null;
let isRevenda = false;

// --- Open catalog for a model ---
function openCatalogo(modelId) {
  catalogoModelId = modelId;
  var model = CATALOGO_MODELOS[modelId];
  if (!model) return;

  catalogoPecas = model.pecas;

  document.getElementById('catalogo-titulo').textContent = model.nome;
  document.getElementById('search-input').value = '';
  document.getElementById('toggle-revenda').checked = false;
  isRevenda = false;

  renderCatalogo();
}

// --- Render filtered grid ---
function renderCatalogo() {
  var grid = document.getElementById('grid-pecas');
  var stats = document.getElementById('catalogo-stats');
  var query = document.getElementById('search-input').value.toLowerCase().trim();

  var filtered = catalogoPecas.filter(function(p) {
    if (!query) return true;
    return p.nome.toLowerCase().indexOf(query) !== -1;
  });

  stats.textContent = filtered.length + ' de ' + catalogoPecas.length + ' pecas';

  grid.innerHTML = '';

  filtered.forEach(function(peca, i) {
    // Find original index
    var origIdx = catalogoPecas.indexOf(peca);
    var preco = peca.preco;
    if (preco != null && isRevenda) {
      preco = preco * 0.85;
    }

    var card = document.createElement('div');
    card.className = 'peca-card' + (peca.preco == null ? ' sem-preco' : '');

    var precoHtml;
    if (preco != null) {
      precoHtml = '<span class="peca-preco">R$ ' + formatarValor(preco) + '</span>';
    } else {
      precoHtml = '<span class="peca-preco peca-preco-null">\u26A0\uFE0F Sem preco</span>';
    }

    var pesoHtml = '';
    if (peca.peso) {
      pesoHtml = '<span class="peca-peso">' + peca.peso + '</span>';
    }

    card.innerHTML =
      '<div class="peca-img-wrap" data-idx="' + origIdx + '">' +
        '<img src="' + peca.img + '" alt="' + peca.nome + '" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div class=img-fallback>\uD83D\uDD27</div>\';">' +
        '<div class="peca-img-zoom-icon">\uD83D\uDD0D</div>' +
      '</div>' +
      '<div class="peca-body">' +
        '<div class="peca-nome">' + peca.nome + '</div>' +
        '<div class="peca-meta">' +
          precoHtml +
          pesoHtml +
        '</div>' +
        '<div class="peca-actions">' +
          '<button class="btn-action btn-orcamento" data-idx="' + origIdx + '">+ Orcamento</button>' +
          '<button class="btn-action btn-registrar" data-idx="' + origIdx + '">\uD83D\uDCCB Registrar</button>' +
          '<button class="btn-action btn-edit-peca" data-idx="' + origIdx + '" title="Editar peca">&#9998;</button>' +
        '</div>' +
      '</div>';

    grid.appendChild(card);
  });
}

// --- Event: Search ---
document.getElementById('search-input').addEventListener('input', function() {
  renderCatalogo();
});

// --- Event: Toggle Revenda ---
document.getElementById('toggle-revenda').addEventListener('change', function() {
  isRevenda = this.checked;
  renderCatalogo();
});

// --- Event: Back button ---
document.getElementById('btn-voltar').addEventListener('click', function() {
  currentModel = null;
  catalogoModelId = null;
  navigateTo('home');
});

// --- Event delegation on grid ---
document.getElementById('grid-pecas').addEventListener('click', function(e) {
  // Zoom on image
  var imgWrap = e.target.closest('.peca-img-wrap');
  if (imgWrap && !e.target.closest('.btn-action')) {
    var idx = parseInt(imgWrap.dataset.idx);
    var peca = catalogoPecas[idx];
    if (peca) {
      var preco = peca.preco;
      if (preco != null && isRevenda) preco = preco * 0.85;
      abrirZoom(peca.img, peca.nome, preco, peca.peso);
    }
    return;
  }

  // Add to quote
  var btnOrc = e.target.closest('.btn-orcamento');
  if (btnOrc) {
    addToSelection(parseInt(btnOrc.dataset.idx));
    return;
  }

  // Register
  var btnReg = e.target.closest('.btn-registrar');
  if (btnReg) {
    addToFormAndNavigate(parseInt(btnReg.dataset.idx));
    return;
  }

  // Edit part (admin)
  var btnEdit = e.target.closest('.btn-edit-peca');
  if (btnEdit) {
    var editIdx = parseInt(btnEdit.dataset.idx);
    if (typeof openEditFromCatalog === 'function' && catalogoModelId) {
      openEditFromCatalog(catalogoModelId, editIdx);
    }
    return;
  }
});

// --- Zoom Modal ---
function abrirZoom(imgSrc, nome, preco, peso) {
  var modal = document.getElementById('modal-zoom');
  var img = document.getElementById('modal-img');
  var info = document.getElementById('modal-info');

  img.src = imgSrc;
  img.alt = nome;

  var precoStr = preco != null ? 'R$ ' + formatarValor(preco) : 'Sem preco';
  var pesoStr = peso || '-';

  info.innerHTML =
    '<div class="modal-nome">' + nome + '</div>' +
    '<div class="modal-meta">' +
      '<span class="modal-preco">' + precoStr + '</span>' +
      '<span class="modal-peso">' + pesoStr + '</span>' +
    '</div>';

  modal.style.display = 'flex';
}

function fecharZoom() {
  var modal = document.getElementById('modal-zoom');
  modal.style.display = 'none';
  document.getElementById('modal-img').src = '';
}

document.getElementById('modal-close').addEventListener('click', fecharZoom);

document.getElementById('modal-zoom').addEventListener('click', function(e) {
  if (e.target === this) {
    fecharZoom();
  }
});

// --- Selection (quote) ---
function addToSelection(idx) {
  var peca = catalogoPecas[idx];
  if (!peca) return;

  var preco = peca.preco;
  if (preco != null && isRevenda) preco = preco * 0.85;

  selectedParts.push({
    modelId: catalogoModelId,
    idx: idx,
    nome: peca.nome,
    preco: preco,
    peso: peca.peso
  });

  updateSelectionBadge();
  mostrarFeedback(peca.nome + ' adicionado ao orcamento', 'sucesso');
}

function addToFormAndNavigate(idx) {
  var peca = catalogoPecas[idx];
  if (!peca) return;

  var tipoPreco = isRevenda ? 'revenda' : 'cliente';
  var preco = peca.preco;
  if (preco != null && isRevenda) preco = preco * 0.85;

  if (preco == null || preco <= 0) {
    mostrarFeedback(peca.nome + ': sem preco definido, nao pode adicionar', 'erro');
    return;
  }

  var pesoGramas = (typeof parseWeight === 'function') ? parseWeight(peca.peso || '') : 0;
  var modelNome = CATALOGO_MODELOS[catalogoModelId] ? CATALOGO_MODELOS[catalogoModelId].nome : catalogoModelId;

  var item = {
    id: Date.now() + Math.random(),
    modelId: catalogoModelId,
    modelo: modelNome,
    descricao: peca.nome,
    cor: '',
    tipoPreco: tipoPreco,
    quantidade: 1,
    precoUnitario: preco,
    total: preco,
    peso: peca.peso || '',
    pesoGramas: pesoGramas,
    img: peca.img || ''
  };

  // Add directly to form parts list
  if (typeof pecasAdicionadas !== 'undefined') {
    pecasAdicionadas.push(item);
    if (typeof renderizarPecas === 'function') renderizarPecas();
    if (typeof atualizarTotal === 'function') atualizarTotal();
    if (typeof atualizarPesoTotal === 'function') atualizarPesoTotal();
  }

  mostrarFeedback(peca.nome + ' adicionado! Continue no catalogo ou va para Registrar', 'sucesso');
}
