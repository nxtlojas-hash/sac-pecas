/* ===== NXT PECAS V2 - Admin / Gerenciar Pecas ===== */

// --- Admin State ---
let adminAllParts = [];
let adminSortCol = 'modelo';
let adminSortAsc = true;
let adminSearchQuery = '';
let adminFilterModel = '';

// --- Model IDs and names ---
const ADMIN_MODELS = [
  { id: 'gataka', nome: 'Gataka' },
  { id: 'pancho', nome: 'Pancho' },
  { id: 'luna', nome: 'LUNA' },
  { id: 'juna-smart', nome: 'JUNA SMART' },
  { id: 'hyphen', nome: 'Hyphen' },
  { id: 'vega', nome: 'Vega' },
  { id: 'zilla', nome: 'ZILLA' },
  { id: 'shaka', nome: 'SHAKA' },
  { id: 'jaya', nome: 'JAYA' },
  { id: 'kay', nome: 'Kay' },
  { id: 'kimbo', nome: 'Kimbo' },
  { id: 'juna', nome: 'Juna' }
];

// --- Admin Stock State ---
let adminEstoque = [];
let adminEstoqueSearch = '';
let adminEstoqueFilterModel = '';

// --- Init Admin ---
function initAdmin() {
  buildAdminView();
  refreshAdminTable();
}

// --- Build Admin HTML ---
function buildAdminView() {
  var container = document.getElementById('admin-container');
  if (!container) return;

  container.innerHTML =
    '<div class="admin-header">' +
      '<h2 class="admin-titulo">Admin</h2>' +
      '<div class="admin-tabs">' +
        '<button class="admin-tab active" data-admin-tab="pecas">Pecas</button>' +
        '<button class="admin-tab" data-admin-tab="estoque">Estoque</button>' +
      '</div>' +
    '</div>' +

    // === TAB PECAS ===
    '<div class="admin-tab-content active" id="admin-tab-pecas">' +
    '<div class="admin-sub-header">' +
      '<button class="btn-primario" id="btn-admin-nova-peca">+ Nova Peca</button>' +
    '</div>' +

    // Filters
    '<div class="admin-filtros">' +
      '<input type="text" class="search-input admin-search" id="admin-search" placeholder="Buscar peca...">' +
      '<select class="admin-select-modelo" id="admin-filter-modelo">' +
        '<option value="">Todos os modelos</option>' +
        ADMIN_MODELS.map(function(m) {
          return '<option value="' + m.id + '">' + m.nome + '</option>';
        }).join('') +
      '</select>' +
    '</div>' +

    // Stats
    '<div class="admin-stats" id="admin-stats"></div>' +

    // Table
    '<div class="admin-table-wrap">' +
      '<table class="admin-table" id="admin-table">' +
        '<thead>' +
          '<tr>' +
            '<th class="admin-th-sortable" data-col="modelo">Modelo <span class="sort-icon"></span></th>' +
            '<th class="admin-th-sortable" data-col="nome">Peca <span class="sort-icon"></span></th>' +
            '<th class="admin-th-sortable" data-col="preco">Preco <span class="sort-icon"></span></th>' +
            '<th class="admin-th-sortable" data-col="peso">Peso <span class="sort-icon"></span></th>' +
            '<th>Acoes</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody id="admin-tbody"></tbody>' +
      '</table>' +
    '</div>' +
    '</div>' +

    // === TAB ESTOQUE ===
    '<div class="admin-tab-content" id="admin-tab-estoque">' +
    '<div class="admin-filtros">' +
      '<input type="text" class="search-input admin-search" id="estoque-search" placeholder="Buscar peca no estoque...">' +
      '<select class="admin-select-modelo" id="estoque-filter-modelo">' +
        '<option value="">Todos os modelos</option>' +
        ADMIN_MODELS.map(function(m) {
          return '<option value="' + m.id + '">' + m.nome + '</option>';
        }).join('') +
      '</select>' +
      '<button class="btn-primario btn-sm" id="btn-estoque-reload">Recarregar</button>' +
    '</div>' +
    '<div class="admin-stats" id="estoque-stats"></div>' +
    '<div class="admin-table-wrap">' +
      '<table class="admin-table" id="estoque-table">' +
        '<thead>' +
          '<tr>' +
            '<th>Modelo</th>' +
            '<th>Peca</th>' +
            '<th>Sumare</th>' +
            '<th>Jaragua</th>' +
            '<th>Ultima Atualizacao</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody id="estoque-tbody"></tbody>' +
      '</table>' +
    '</div>' +
    '</div>';

  // Event: New part button
  document.getElementById('btn-admin-nova-peca').addEventListener('click', function() {
    openAdminPartModal(null, null, null);
  });

  // Event: Search
  document.getElementById('admin-search').addEventListener('input', function() {
    adminSearchQuery = this.value.toLowerCase().trim();
    refreshAdminTable();
  });

  // Event: Filter model
  document.getElementById('admin-filter-modelo').addEventListener('change', function() {
    adminFilterModel = this.value;
    refreshAdminTable();
  });

  // Event: Sort
  document.getElementById('admin-table').querySelector('thead').addEventListener('click', function(e) {
    var th = e.target.closest('.admin-th-sortable');
    if (!th) return;
    var col = th.dataset.col;
    if (adminSortCol === col) {
      adminSortAsc = !adminSortAsc;
    } else {
      adminSortCol = col;
      adminSortAsc = true;
    }
    refreshAdminTable();
  });

  // Event: Admin tabs
  container.querySelectorAll('.admin-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      container.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
      container.querySelectorAll('.admin-tab-content').forEach(function(c) { c.classList.remove('active'); });
      tab.classList.add('active');
      var target = document.getElementById('admin-tab-' + tab.dataset.adminTab);
      if (target) target.classList.add('active');
      if (tab.dataset.adminTab === 'estoque') {
        loadEstoqueAdmin();
      }
    });
  });

  // Event: Estoque search
  document.getElementById('estoque-search').addEventListener('input', function() {
    adminEstoqueSearch = this.value.toLowerCase().trim();
    renderEstoqueTable();
  });

  // Event: Estoque filter model
  document.getElementById('estoque-filter-modelo').addEventListener('change', function() {
    adminEstoqueFilterModel = this.value;
    renderEstoqueTable();
  });

  // Event: Estoque reload
  document.getElementById('btn-estoque-reload').addEventListener('click', function() {
    loadEstoqueAdmin();
  });
}

// --- Collect all parts into flat array ---
function collectAllParts() {
  var parts = [];
  Object.keys(CATALOGO_MODELOS).forEach(function(modelId) {
    var model = CATALOGO_MODELOS[modelId];
    model.pecas.forEach(function(peca, idx) {
      parts.push({
        modelId: modelId,
        modelNome: model.nome,
        idx: idx,
        nome: peca.nome,
        preco: peca.preco,
        peso: peca.peso,
        img: peca.img
      });
    });
  });
  return parts;
}

// --- Refresh table ---
function refreshAdminTable() {
  adminAllParts = collectAllParts();

  // Filter
  var filtered = adminAllParts.filter(function(p) {
    if (adminFilterModel && p.modelId !== adminFilterModel) return false;
    if (adminSearchQuery && p.nome.toLowerCase().indexOf(adminSearchQuery) === -1) return false;
    return true;
  });

  // Sort
  filtered.sort(function(a, b) {
    var va, vb;
    if (adminSortCol === 'modelo') {
      va = a.modelNome; vb = b.modelNome;
    } else if (adminSortCol === 'nome') {
      va = a.nome; vb = b.nome;
    } else if (adminSortCol === 'preco') {
      va = a.preco || 0; vb = b.preco || 0;
      return adminSortAsc ? va - vb : vb - va;
    } else if (adminSortCol === 'peso') {
      va = parseWeight(a.peso); vb = parseWeight(b.peso);
      return adminSortAsc ? va - vb : vb - va;
    }
    // String sort
    va = (va || '').toString().toLowerCase();
    vb = (vb || '').toString().toLowerCase();
    if (va < vb) return adminSortAsc ? -1 : 1;
    if (va > vb) return adminSortAsc ? 1 : -1;
    return 0;
  });

  // Stats
  var statsEl = document.getElementById('admin-stats');
  if (statsEl) {
    statsEl.textContent = filtered.length + ' pecas' + (adminFilterModel || adminSearchQuery ? ' (filtradas de ' + adminAllParts.length + ' total)' : ' no total');
  }

  // Update sort icons
  document.querySelectorAll('.admin-th-sortable').forEach(function(th) {
    var icon = th.querySelector('.sort-icon');
    if (th.dataset.col === adminSortCol) {
      icon.textContent = adminSortAsc ? ' \u25B2' : ' \u25BC';
    } else {
      icon.textContent = '';
    }
  });

  // Render rows
  var tbody = document.getElementById('admin-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--cor-texto-claro);padding:2rem;">Nenhuma peca encontrada</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(p) {
    var precoStr = p.preco != null ? 'R$ ' + formatarValor(p.preco) : '<span style="color:var(--cor-alerta);">Sem preco</span>';
    return '<tr>' +
      '<td><span class="admin-badge-modelo">' + p.modelNome + '</span></td>' +
      '<td>' + p.nome + '</td>' +
      '<td>' + precoStr + '</td>' +
      '<td>' + (p.peso || '-') + '</td>' +
      '<td class="admin-acoes">' +
        '<button class="btn-admin-edit" data-model="' + p.modelId + '" data-idx="' + p.idx + '" title="Editar">&#9998;</button>' +
        '<button class="btn-admin-delete" data-model="' + p.modelId + '" data-idx="' + p.idx + '" title="Excluir">&#128465;</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  // Event delegation for edit/delete
  tbody.onclick = function(e) {
    var btnEdit = e.target.closest('.btn-admin-edit');
    if (btnEdit) {
      var modelId = btnEdit.dataset.model;
      var idx = parseInt(btnEdit.dataset.idx);
      var peca = CATALOGO_MODELOS[modelId].pecas[idx];
      openAdminPartModal(peca, modelId, idx);
      return;
    }
    var btnDel = e.target.closest('.btn-admin-delete');
    if (btnDel) {
      var modelId2 = btnDel.dataset.model;
      var idx2 = parseInt(btnDel.dataset.idx);
      confirmDeletePart(modelId2, idx2);
      return;
    }
  };
}

// --- Open Add/Edit Modal ---
function openAdminPartModal(peca, modelId, idx) {
  var isEdit = peca !== null;
  var modal = document.getElementById('modal-admin');

  var modelsCheckboxes = ADMIN_MODELS.map(function(m) {
    var checked = isEdit && modelId === m.id ? ' checked' : '';
    return '<label><input type="checkbox" name="admin-modelos" value="' + m.id + '"' + checked + '> ' + m.nome + '</label>';
  }).join('');

  modal.querySelector('.modal-content').innerHTML =
    '<button class="modal-close" id="admin-modal-close">&times;</button>' +
    '<div class="admin-modal-header">' +
      '<h3>' + (isEdit ? 'Editar Peca' : 'Nova Peca') + '</h3>' +
    '</div>' +
    '<div class="admin-modal-body">' +
      '<div class="form-group" style="margin-bottom:0.75rem;">' +
        '<label>Nome da Peca</label>' +
        '<input type="text" id="admin-peca-nome" value="' + (isEdit ? peca.nome : '') + '">' +
      '</div>' +
      '<div class="form-group" style="margin-bottom:0.75rem;">' +
        '<label>Modelo(s)</label>' +
        '<div class="checkbox-group admin-modelos-group">' + modelsCheckboxes + '</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label>Preco Cliente Final (R$)</label>' +
          '<input type="text" id="admin-peca-preco" placeholder="0,00" value="' + (isEdit && peca.preco != null ? formatarValor(peca.preco) : '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Preco Revenda (R$)</label>' +
          '<input type="text" id="admin-peca-preco-revenda" placeholder="Auto: 85%">' +
        '</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label>Peso (ex: 55gr, 1,60kg)</label>' +
          '<input type="text" id="admin-peca-peso" value="' + (isEdit && peca.peso ? peca.peso : '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Imagem (opcional)</label>' +
          '<input type="file" id="admin-peca-img" accept="image/*">' +
        '</div>' +
      '</div>' +
      (isEdit && peca.img ? '<div class="admin-img-preview"><img src="' + peca.img + '" alt="Preview"></div>' : '') +
    '</div>' +
    '<div class="admin-modal-footer">' +
      '<button class="btn-cancelar" id="admin-modal-cancel">Cancelar</button>' +
      '<button class="btn-primario" id="admin-modal-save">' + (isEdit ? 'Salvar Alteracoes' : 'Adicionar Peca') + '</button>' +
    '</div>';

  modal.style.display = 'flex';

  // Auto-calculate revenda
  var precoInput = document.getElementById('admin-peca-preco');
  var revendaInput = document.getElementById('admin-peca-preco-revenda');

  if (isEdit && peca.preco != null) {
    revendaInput.value = formatarValor(peca.preco * 0.85);
  }

  precoInput.addEventListener('input', function() {
    var val = parseMoeda(this.value);
    if (!isNaN(val) && val > 0) {
      revendaInput.value = formatarValor(val * 0.85);
    }
  });

  // Close handlers
  document.getElementById('admin-modal-close').addEventListener('click', function() {
    modal.style.display = 'none';
  });
  document.getElementById('admin-modal-cancel').addEventListener('click', function() {
    modal.style.display = 'none';
  });

  // Save handler
  document.getElementById('admin-modal-save').addEventListener('click', function() {
    saveAdminPart(isEdit, modelId, idx);
  });
}

// --- Read file as base64 data URL ---
function readFileAsBase64(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = function() { reject(reader.error); };
    reader.readAsDataURL(file);
  });
}

// --- Save part (add or edit) ---
function saveAdminPart(isEdit, editModelId, editIdx) {
  var nome = document.getElementById('admin-peca-nome').value.trim();
  if (!nome) {
    mostrarFeedback('Nome da peca e obrigatorio', 'erro');
    return;
  }

  var precoStr = document.getElementById('admin-peca-preco').value.trim();
  var preco = precoStr ? parseMoeda(precoStr) : null;
  if (precoStr && isNaN(preco)) {
    mostrarFeedback('Preco invalido', 'erro');
    return;
  }

  var peso = document.getElementById('admin-peca-peso').value.trim() || null;

  var selectedModels = [];
  document.querySelectorAll('input[name="admin-modelos"]:checked').forEach(function(cb) {
    selectedModels.push(cb.value);
  });

  if (selectedModels.length === 0) {
    mostrarFeedback('Selecione pelo menos um modelo', 'erro');
    return;
  }

  // Handle image - read as base64 if a new file was selected
  var fileInput = document.getElementById('admin-peca-img');
  var hasNewImage = fileInput.files && fileInput.files[0];

  var imagePromise;
  if (hasNewImage) {
    imagePromise = readFileAsBase64(fileInput.files[0]).then(function(base64) {
      return { base64: base64, nome: fileInput.files[0].name };
    });
  } else {
    imagePromise = Promise.resolve(null);
  }

  // Disable save button while processing
  var saveBtn = document.getElementById('admin-modal-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';
  }

  imagePromise.then(function(imageData) {
    var imgPath = '';
    var imagemBase64 = null;
    var imagemNome = null;

    if (isEdit) {
      var existingPeca = CATALOGO_MODELOS[editModelId].pecas[editIdx];
      imgPath = existingPeca.img || '';
    }

    if (imageData) {
      imagemBase64 = imageData.base64;
      imagemNome = imageData.nome;
      // Temporary local preview until Drive URL comes back
      imgPath = URL.createObjectURL(fileInput.files[0]);
    }

    if (isEdit) {
      var peca = CATALOGO_MODELOS[editModelId].pecas[editIdx];
      peca.nome = nome;
      peca.preco = preco;
      peca.peso = peso;
      if (imgPath) peca.img = imgPath;

      // Save to Sheets and get Drive URL back
      savePartToSheets('editar', editModelId, editIdx, peca, imagemBase64, imagemNome).then(function(resp) {
        if (resp && resp.imagemUrl) {
          peca.img = resp.imagemUrl;
          refreshAdminTable();
        }
      });

      // Add to newly selected models (that didn't have this part)
      selectedModels.forEach(function(mid) {
        if (mid === editModelId) return;
        if (!CATALOGO_MODELOS[mid]) return;
        var exists = CATALOGO_MODELOS[mid].pecas.some(function(p) {
          return p.nome.toLowerCase() === nome.toLowerCase();
        });
        if (!exists) {
          var newPeca = { nome: nome, preco: preco, peso: peso, img: imgPath || peca.img };
          CATALOGO_MODELOS[mid].pecas.push(newPeca);
          savePartToSheets('adicionar', mid, CATALOGO_MODELOS[mid].pecas.length - 1, newPeca, imagemBase64, imagemNome).then(function(resp) {
            if (resp && resp.imagemUrl) {
              newPeca.img = resp.imagemUrl;
            }
          });
        }
      });

      mostrarFeedback('Peca "' + nome + '" atualizada em ' + selectedModels.length + ' modelo(s)!', 'sucesso');
    } else {
      // Add new part to selected models
      selectedModels.forEach(function(mid) {
        if (!CATALOGO_MODELOS[mid]) return;
        var newPeca = {
          nome: nome,
          preco: preco,
          peso: peso,
          img: imgPath || 'img/' + mid + '/' + nome + '.jpeg'
        };
        CATALOGO_MODELOS[mid].pecas.push(newPeca);

        var newIdx = CATALOGO_MODELOS[mid].pecas.length - 1;
        savePartToSheets('adicionar', mid, newIdx, newPeca, imagemBase64, imagemNome).then(function(resp) {
          if (resp && resp.imagemUrl) {
            newPeca.img = resp.imagemUrl;
            refreshAdminTable();
          }
        });
      });
      mostrarFeedback('Peca "' + nome + '" adicionada a ' + selectedModels.length + ' modelo(s)!', 'sucesso');
    }

    // Close modal and refresh
    document.getElementById('modal-admin').style.display = 'none';
    refreshAdminTable();

    // Refresh catalog if it's open
    if (typeof catalogoModelId !== 'undefined' && catalogoModelId && typeof openCatalogo === 'function') {
      openCatalogo(catalogoModelId);
    }
  }).catch(function(err) {
    console.error('Admin: erro ao processar imagem', err);
    mostrarFeedback('Erro ao processar imagem: ' + err.message, 'erro');
  }).finally(function() {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Salvar Alteracoes' : 'Adicionar Peca';
    }
  });
}

// --- Delete part ---
function confirmDeletePart(modelId, idx) {
  var peca = CATALOGO_MODELOS[modelId].pecas[idx];
  if (!peca) return;

  var modelNome = CATALOGO_MODELOS[modelId].nome;
  if (!confirm('Tem certeza que deseja excluir "' + peca.nome + '" do modelo ' + modelNome + '?')) {
    return;
  }

  // Remove from memory immediately
  CATALOGO_MODELOS[modelId].pecas.splice(idx, 1);
  refreshAdminTable();
  if (typeof catalogoModelId !== 'undefined' && catalogoModelId && typeof openCatalogo === 'function') {
    openCatalogo(catalogoModelId);
  }

  // Save deletion to Google Sheets and confirm
  savePartToSheets('excluir', modelId, idx, peca).then(function(resp) {
    if (resp && resp.sucesso) {
      mostrarFeedback('Peca "' + peca.nome + '" excluida do modelo ' + modelNome + ' (Sheets atualizado)', 'sucesso');
    } else {
      mostrarFeedback('Peca removida localmente. Erro ao excluir no Sheets: ' + (resp && resp.erro ? resp.erro : 'sem resposta'), 'erro');
    }
  }).catch(function(err) {
    mostrarFeedback('Peca removida localmente, mas erro ao sincronizar: ' + err.message, 'erro');
  });
}

// --- Save to Google Sheets ---
function savePartToSheets(acao, modelId, idx, peca, imagemBase64, imagemNome) {
  if (typeof GOOGLE_SCRIPT_URL === 'undefined' || GOOGLE_SCRIPT_URL.indexOf('SUBSTITUIR') !== -1) {
    console.warn('Admin: Google Script URL nao configurada, salvamento apenas local.');
    return Promise.resolve(null);
  }

  var payload = {
    action: 'gerenciar_peca',
    acao: acao,
    modelo: modelId,
    modeloNome: CATALOGO_MODELOS[modelId].nome,
    idx: idx,
    nome: peca.nome,
    preco: peca.preco,
    peso: peca.peso,
    img: peca.img || ''
  };

  // Include base64 image if provided
  if (imagemBase64 && imagemNome) {
    payload.imagemBase64 = imagemBase64;
    payload.imagemNome = imagemNome;
  }

  return fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  }).then(function(resp) {
    return resp.text();
  }).then(function(text) {
    try {
      var data = JSON.parse(text);
      console.log('Admin: peca salva no Sheets (' + acao + ')', data);
      return data;
    } catch (e) {
      console.warn('Admin: resposta nao-JSON do Sheets', text);
      return null;
    }
  }).catch(function(err) {
    console.error('Admin: erro ao salvar no Sheets', err);
    return null;
  });
}

// --- Load parts from Google Sheets on startup ---
function loadPartsFromSheets() {
  if (typeof GOOGLE_SCRIPT_URL === 'undefined' || GOOGLE_SCRIPT_URL.indexOf('SUBSTITUIR') !== -1) {
    console.warn('Admin: Google Script URL nao configurada, usando dados locais.');
    return;
  }

  var url = GOOGLE_SCRIPT_URL + '?action=listar_pecas';

  fetch(url, { redirect: 'follow' })
    .then(function(res) { return res.text(); })
    .then(function(text) {
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn('Admin: resposta nao-JSON ao listar pecas', text);
        return;
      }
      if (data && data.sucesso && data.pecas && data.pecas.length > 0) {
        applySheetsParts(data.pecas);
        console.log('Admin: ' + data.pecas.length + ' pecas carregadas do Sheets');
        // Refresh views
        if (typeof currentView !== 'undefined' && currentView === 'home' && typeof renderHome === 'function') renderHome();
        if (typeof currentView !== 'undefined' && currentView === 'catalogo' && typeof catalogoModelId !== 'undefined' && catalogoModelId && typeof openCatalogo === 'function') openCatalogo(catalogoModelId);
        if (typeof currentView !== 'undefined' && currentView === 'admin' && typeof refreshAdminTable === 'function') refreshAdminTable();
      }
    })
    .catch(function(err) {
      console.warn('Admin: nao foi possivel carregar pecas do Sheets', err);
    });
}

// --- Apply parts from Sheets to CATALOGO_MODELOS ---
function applySheetsParts(sheetParts) {
  // Group by model
  var byModel = {};
  sheetParts.forEach(function(sp) {
    if (!byModel[sp.modelo]) byModel[sp.modelo] = [];
    byModel[sp.modelo].push({
      nome: sp.nome,
      preco: sp.preco != null && sp.preco !== '' ? parseFloat(sp.preco) : null,
      peso: sp.peso || null,
      img: sp.img || ''
    });
  });

  // Override/supplement each model
  Object.keys(byModel).forEach(function(modelId) {
    if (!CATALOGO_MODELOS[modelId]) return;

    var sheetList = byModel[modelId];
    sheetList.forEach(function(sp) {
      // Check if part already exists (by name)
      var existingIdx = -1;
      CATALOGO_MODELOS[modelId].pecas.forEach(function(p, i) {
        if (p.nome.toLowerCase() === sp.nome.toLowerCase()) {
          existingIdx = i;
        }
      });

      if (existingIdx >= 0) {
        // Update existing
        if (sp.preco != null) CATALOGO_MODELOS[modelId].pecas[existingIdx].preco = sp.preco;
        if (sp.peso) CATALOGO_MODELOS[modelId].pecas[existingIdx].peso = sp.peso;
        if (sp.img) CATALOGO_MODELOS[modelId].pecas[existingIdx].img = sp.img;
      } else {
        // Add new
        CATALOGO_MODELOS[modelId].pecas.push(sp);
      }
    });
  });
}

// --- Edit from catalog (called by edit icon on cards) ---
function openEditFromCatalog(modelId, idx) {
  var peca = CATALOGO_MODELOS[modelId].pecas[idx];
  if (!peca) return;
  openAdminPartModal(peca, modelId, idx);
}

// --- Modal overlay click to close ---
document.addEventListener('DOMContentLoaded', function() {
  var modalAdmin = document.getElementById('modal-admin');
  if (modalAdmin) {
    modalAdmin.addEventListener('click', function(e) {
      if (e.target === modalAdmin) {
        modalAdmin.style.display = 'none';
      }
    });
  }
});

// ========================================
// ESTOQUE (Stock Management in Admin)
// ========================================

// --- Load stock from Sheets ---
function loadEstoqueAdmin() {
  if (typeof GOOGLE_SCRIPT_URL === 'undefined' || GOOGLE_SCRIPT_URL.indexOf('SUBSTITUIR') !== -1) {
    console.warn('Estoque: Google Script URL nao configurada');
    // Build from catalog parts with empty stock
    adminEstoque = collectAllParts().map(function(p) {
      return { modelo: p.modelId, modeloNome: p.modelNome, peca: p.nome, sumare: 0, jaragua: 0, ultimaAtualizacao: '' };
    });
    renderEstoqueTable();
    return;
  }

  var statsEl = document.getElementById('estoque-stats');
  if (statsEl) statsEl.textContent = 'Carregando estoque...';

  var url = GOOGLE_SCRIPT_URL + '?action=listar_estoque';
  fetch(url, { redirect: 'follow' })
    .then(function(res) { return res.text(); })
    .then(function(text) {
      var data;
      try { data = JSON.parse(text); } catch (e) {
        if (statsEl) statsEl.textContent = 'Erro ao parsear resposta do estoque';
        return;
      }

      var sheetEstoque = {};
      if (data && data.sucesso && data.estoque) {
        data.estoque.forEach(function(item) {
          var key = (item.modelo || '').toLowerCase() + '|' + (item.peca || '').toLowerCase();
          sheetEstoque[key] = item;
        });
      }

      // Mesclar com catalogo para ter lista completa
      var allParts = collectAllParts();
      adminEstoque = allParts.map(function(p) {
        var key = p.modelId.toLowerCase() + '|' + p.nome.toLowerCase();
        var info = sheetEstoque[key];
        return {
          modelo: p.modelId,
          modeloNome: p.modelNome,
          peca: p.nome,
          sumare: info ? (parseInt(info.sumare) || 0) : 0,
          jaragua: info ? (parseInt(info.jaragua) || 0) : 0,
          ultimaAtualizacao: info ? (info.ultimaAtualizacao || '') : ''
        };
      });

      renderEstoqueTable();
    })
    .catch(function(err) {
      console.warn('Estoque: erro ao carregar', err);
      if (statsEl) statsEl.textContent = 'Erro ao carregar estoque';
    });
}

// --- Render stock table ---
function renderEstoqueTable() {
  var filtered = adminEstoque.filter(function(item) {
    if (adminEstoqueFilterModel && item.modelo !== adminEstoqueFilterModel) return false;
    if (adminEstoqueSearch && item.peca.toLowerCase().indexOf(adminEstoqueSearch) === -1 &&
        item.modeloNome.toLowerCase().indexOf(adminEstoqueSearch) === -1) return false;
    return true;
  });

  var statsEl = document.getElementById('estoque-stats');
  if (statsEl) {
    statsEl.textContent = filtered.length + ' itens' +
      (adminEstoqueFilterModel || adminEstoqueSearch ? ' (filtrados de ' + adminEstoque.length + ' total)' : ' no total');
  }

  var tbody = document.getElementById('estoque-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--cor-texto-claro);padding:2rem;">Nenhum item de estoque encontrado</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(item, idx) {
    var globalIdx = adminEstoque.indexOf(item);
    var sumareClass = item.sumare === 0 ? ' estoque-cell-zero' : '';
    var jaraguaClass = item.jaragua === 0 ? ' estoque-cell-zero' : '';
    var atualizacao = item.ultimaAtualizacao ? formatarDataEstoque(item.ultimaAtualizacao) : '-';

    return '<tr>' +
      '<td><span class="admin-badge-modelo">' + item.modeloNome + '</span></td>' +
      '<td>' + item.peca + '</td>' +
      '<td class="estoque-cell-editable' + sumareClass + '" data-idx="' + globalIdx + '" data-field="sumare" title="Clique para editar">' + item.sumare + '</td>' +
      '<td class="estoque-cell-editable' + jaraguaClass + '" data-idx="' + globalIdx + '" data-field="jaragua" title="Clique para editar">' + item.jaragua + '</td>' +
      '<td style="font-size:0.75rem;color:var(--cor-texto-claro);">' + atualizacao + '</td>' +
    '</tr>';
  }).join('');

  // Event delegation for inline editing
  tbody.onclick = function(e) {
    var cell = e.target.closest('.estoque-cell-editable');
    if (!cell) return;
    if (cell.querySelector('input')) return; // ja editando

    var idx = parseInt(cell.dataset.idx);
    var field = cell.dataset.field;
    var currentVal = adminEstoque[idx][field];

    var input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = currentVal;
    input.className = 'estoque-inline-input';

    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    function saveValue() {
      var newVal = parseInt(input.value) || 0;
      if (newVal < 0) newVal = 0;

      adminEstoque[idx][field] = newVal;
      cell.textContent = newVal;
      cell.classList.toggle('estoque-cell-zero', newVal === 0);

      // Salvar no Sheets
      salvarEstoqueItem(adminEstoque[idx]);
    }

    input.addEventListener('blur', saveValue);
    input.addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        input.blur();
      }
      if (ev.key === 'Escape') {
        cell.textContent = currentVal;
        cell.classList.toggle('estoque-cell-zero', currentVal === 0);
      }
    });
  };
}

// --- Save stock item to Sheets ---
function salvarEstoqueItem(item) {
  if (typeof GOOGLE_SCRIPT_URL === 'undefined' || GOOGLE_SCRIPT_URL.indexOf('SUBSTITUIR') !== -1) {
    console.warn('Estoque: URL nao configurada, salvamento apenas local');
    return;
  }

  var payload = {
    action: 'atualizar_estoque',
    modelo: item.modelo,
    peca: item.peca,
    sumare: parseInt(item.sumare) || 0,
    jaragua: parseInt(item.jaragua) || 0
  };

  console.log('Estoque: salvando item', JSON.stringify(payload));

  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  }).then(function(resp) {
    console.log('Estoque: response status', resp.status, resp.url);
    return resp.text();
  }).then(function(text) {
    console.log('Estoque: response body', text.substring(0, 500));
    try {
      var data = JSON.parse(text);
      if (data && data.sucesso) {
        mostrarFeedback('Estoque atualizado: ' + item.peca, 'sucesso');
      } else {
        console.warn('Estoque: erro na resposta', data);
        mostrarFeedback('Erro ao salvar estoque: ' + (data.erro || 'resposta inesperada'), 'erro');
      }
    } catch (e) {
      console.warn('Estoque: resposta nao-JSON', text.substring(0, 200));
      mostrarFeedback('Erro ao salvar estoque: resposta invalida do servidor', 'erro');
    }
  }).catch(function(err) {
    console.error('Estoque: fetch error', err);
    mostrarFeedback('Erro ao salvar estoque: ' + err.message, 'erro');
  });

  // Invalidar cache de estoque do catalogo
  if (typeof estoqueCache !== 'undefined') {
    for (var key in estoqueCache) {
      delete estoqueCache[key];
    }
  }
}

// --- Format date for stock display ---
function formatarDataEstoque(isoStr) {
  if (!isoStr) return '-';
  try {
    var d = new Date(isoStr);
    var dia = String(d.getDate()).padStart(2, '0');
    var mes = String(d.getMonth() + 1).padStart(2, '0');
    var ano = d.getFullYear();
    var hora = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return dia + '/' + mes + '/' + ano + ' ' + hora + ':' + min;
  } catch (e) {
    return isoStr;
  }
}
