/* ===== NXT SAC V2.30 - Catalogo ===== */

let catalogoPecas = [];
let catalogoModelId = null;
let isRevenda = false;
let estoqueCache = {}; // Cache de estoque por modelo, indexado por modelId

// Resolve NOME do modelo (como vem da aba Estoque) para o ID em CATALOGO_MODELOS.
// Necessario porque o backend armazena/retorna o nome (ex: "JUNA SMART") mas o
// frontend faz lookup pelo id (ex: "juna-smart"). Para modelos onde
// id.toLowerCase() === nome.toLowerCase() (Kay, Akasha, etc.) o lookup direto
// funcionava por coincidencia; aqui normalizamos sempre via nome -> id.
function getModelIdByName(nome) {
  if (!nome) return '';
  var target = String(nome).toLowerCase();
  if (typeof CATALOGO_MODELOS !== 'undefined') {
    for (var id in CATALOGO_MODELOS) {
      if (CATALOGO_MODELOS[id].nome.toLowerCase() === target) return id;
    }
  }
  return target; // fallback: nome legado nao mapeado -> indexa pelo proprio nome
}

// --- Mostra grid de modelos pra escolher (quando entra em Catalogo sem modelo selecionado) ---
function mostrarSeletorModelos() {
  catalogoModelId = null;

  // Esconde os controles de filtro/busca (só fazem sentido com modelo aberto)
  var header = document.querySelector('#view-catalogo .catalogo-header');
  if (header) header.style.display = 'none';
  var stats = document.getElementById('catalogo-stats');
  if (stats) stats.style.display = 'none';

  var grid = document.getElementById('grid-pecas');
  if (!grid) return;
  grid.innerHTML = '';
  grid.className = 'grid-modelos';

  // Mostra TODOS os modelos, mesmo com pecas:[]. O catalogo serve tambem
  // pro vendedor saber quais modelos existem na linha NXT, nao so quais
  // tem pecas cadastradas. Modelo vazio aparece com "0 pecas" — sinal pro
  // admin cadastrar.
  Object.keys(CATALOGO_MODELOS).forEach(function(modelId) {
    var model = CATALOGO_MODELOS[modelId];
    var count = model.pecas.length;
    var icon = (typeof MODEL_ICONS !== 'undefined' && MODEL_ICONS[modelId]) ? MODEL_ICONS[modelId] : '🛠️';
    var card = document.createElement('div');
    card.className = 'modelo-card';
    card.innerHTML =
      '<div class="modelo-img"><img src="img/modelos/' + modelId + '.png" alt="' + model.nome + '" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<span class=modelo-icon-fallback>' + icon + '</span>\';"></div>' +
      '<div class="modelo-nome">' + model.nome + '</div>' +
      '<div class="modelo-count">' + count + ' pecas</div>';

    card.addEventListener('click', function() {
      currentModel = modelId;
      navigateTo('catalogo', { model: modelId });
    });

    grid.appendChild(card);
  });
}

// --- Open catalog for a model ---
function openCatalogo(modelId) {
  // Restaura os controles que estavam ocultos no seletor
  var header = document.querySelector('#view-catalogo .catalogo-header');
  if (header) header.style.display = '';
  var stats = document.getElementById('catalogo-stats');
  if (stats) stats.style.display = '';
  var grid = document.getElementById('grid-pecas');
  if (grid) grid.className = 'grid-pecas';

  catalogoModelId = modelId;
  var model = CATALOGO_MODELOS[modelId];
  if (!model) return;

  catalogoPecas = model.pecas;

  document.getElementById('catalogo-titulo').textContent = model.nome;
  document.getElementById('search-input').value = '';
  document.getElementById('toggle-revenda').checked = false;
  isRevenda = false;

  renderCatalogo();
  carregarEstoqueModelo(modelId);
}

// --- Load stock data for current model ---
function carregarEstoqueModelo(modelId) {
  if (!modelId) return;
  // Se ja tem cache, usa
  if (estoqueCache[modelId]) {
    renderEstoqueBadges(modelId);
    return;
  }

  if (typeof GOOGLE_SCRIPT_URL === 'undefined' || GOOGLE_SCRIPT_URL.indexOf('SUBSTITUIR') !== -1) return;

  var url = GOOGLE_SCRIPT_URL + '?action=listar_estoque';
  console.log('Catalogo: carregando estoque de', url);
  fetch(url, { redirect: 'follow' })
    .then(function(res) {
      console.log('Catalogo: estoque response status', res.status);
      return res.text();
    })
    .then(function(text) {
      console.log('Catalogo: estoque response length', text.length);
      var data;
      try { data = JSON.parse(text); } catch (e) {
        console.warn('Catalogo: resposta nao-JSON', text.substring(0, 200));
        return;
      }
      if (data && data.sucesso && data.estoque) {
        console.log('Catalogo: recebidos', data.estoque.length, 'itens de estoque');
        // Indexar por modelId+peca. Backend retorna item.modelo como NOME
        // (ex: "JUNA SMART"); normalizamos pro id (ex: "juna-smart") via
        // getModelIdByName pra alinhar com o lookup feito em renderEstoqueBadges
        // e getEstoquePeca.
        data.estoque.forEach(function(item) {
          var key = getModelIdByName(item.modelo);
          if (!estoqueCache[key]) estoqueCache[key] = {};
          estoqueCache[key][(item.peca || '').toLowerCase()] = {
            sumare: parseInt(item.sumare) || 0,
            jaragua: parseInt(item.jaragua) || 0
          };
        });
        renderEstoqueBadges(modelId);
      } else {
        console.warn('Catalogo: resposta sem estoque', data);
      }
    })
    .catch(function(err) {
      console.warn('Catalogo: erro ao carregar estoque', err);
    });
}

// --- Render stock badges on cards ---
function renderEstoqueBadges(modelId) {
  var estoqueModelo = estoqueCache[modelId.toLowerCase()] || {};
  var cards = document.querySelectorAll('#grid-pecas .peca-card');

  cards.forEach(function(card) {
    var nomeEl = card.querySelector('.peca-nome');
    if (!nomeEl) return;
    var nome = nomeEl.textContent.trim().toLowerCase();

    // Remover badge anterior se existir
    var oldBadge = card.querySelector('.estoque-badge');
    if (oldBadge) oldBadge.remove();

    var badge = document.createElement('div');
    var info = estoqueModelo[nome];

    if (!info) {
      badge.className = 'estoque-badge estoque-sem-info';
      badge.textContent = 'Sem info';
    } else if (info.sumare === 0 && info.jaragua === 0) {
      badge.className = 'estoque-badge estoque-indisponivel';
      badge.textContent = 'Indispon\u00edvel';
    } else if (info.sumare === 0 || info.jaragua === 0) {
      badge.className = 'estoque-badge estoque-parcial';
      badge.textContent = 'S: ' + info.sumare + ' | J: ' + info.jaragua;
    } else {
      badge.className = 'estoque-badge estoque-disponivel';
      badge.textContent = 'S: ' + info.sumare + ' | J: ' + info.jaragua;
    }

    var body = card.querySelector('.peca-body');
    if (body) {
      body.insertBefore(badge, body.querySelector('.peca-actions'));
    }
  });
}

// --- Get stock for a specific part (used by form) ---
function getEstoquePeca(modelId, pecaNome) {
  if (!modelId || !pecaNome) return null;
  var estoqueModelo = estoqueCache[modelId.toLowerCase()] || {};
  return estoqueModelo[pecaNome.toLowerCase()] || null;
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

  // Empty state: modelo sem nenhuma peca cadastrada
  if (catalogoPecas.length === 0) {
    grid.innerHTML =
      '<div class="catalogo-empty" style="grid-column:1/-1;padding:3rem 1.5rem;text-align:center;color:var(--cor-texto-claro);">' +
        '<div style="font-size:2.5rem;margin-bottom:0.75rem;">📋</div>' +
        '<div style="font-size:1rem;font-weight:600;margin-bottom:0.5rem;">Sem pecas cadastradas para este modelo</div>' +
        '<div style="font-size:0.9rem;">Acesse <strong>Admin &gt; Nova Peca</strong> para comecar.</div>' +
      '</div>';
    return;
  }

  // Empty state filtrado: tem pecas mas a busca nao casou
  if (filtered.length === 0) {
    grid.innerHTML =
      '<div class="catalogo-empty" style="grid-column:1/-1;padding:2rem 1.5rem;text-align:center;color:var(--cor-texto-claro);">' +
        'Nenhuma peca encontrada com esse termo.' +
      '</div>';
    return;
  }

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
          '<button class="btn-action btn-registrar" data-idx="' + origIdx + '">+ Venda</button>' +
          '<button class="btn-action btn-edit-peca" data-idx="' + origIdx + '" title="Editar peca">&#9998;</button>' +
        '</div>' +
      '</div>';

    grid.appendChild(card);
  });
}

// --- Event: Search ---
document.getElementById('search-input').addEventListener('input', function() {
  renderCatalogo();
  if (catalogoModelId) renderEstoqueBadges(catalogoModelId);
});

// --- Event: Toggle Revenda ---
document.getElementById('toggle-revenda').addEventListener('change', function() {
  isRevenda = this.checked;
  renderCatalogo();
  if (catalogoModelId) renderEstoqueBadges(catalogoModelId);
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

  // Acento CRU de proposito: mostrarFeedback usa toast.textContent (app.js:615),
  // que NAO interpreta entidade HTML — '&ccedil;' apareceria literal na tela.
  mostrarFeedback(peca.nome + ' adicionado! Continue no catalogo ou va para Peças', 'sucesso');
}
