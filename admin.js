/* ===== NXT SAC V2.31 - Admin / Gerenciar Pecas ===== */

// --- Admin State ---
let adminAllParts = [];
let adminSortCol = 'modelo';
let adminSortAsc = true;
let adminSearchQuery = '';
let adminFilterModel = '';

// --- Model IDs and names (derived from CATALOGO_MODELOS in data.js) ---
// Lista dinamica: qualquer modelo novo adicionado ao data.js aparece automaticamente
// no admin (filtros e cadastro de pecas), sem precisar editar este arquivo.
function getAdminModels() {
  return Object.keys(CATALOGO_MODELOS).map(function(id) {
    return { id: id, nome: CATALOGO_MODELOS[id].nome };
  });
}

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
        getAdminModels().map(function(m) {
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
        getAdminModels().map(function(m) {
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

  // Em edicao, pre-marca TODOS os modelos onde a peca ja existe (busca por
  // nome). Antes so o de origem ficava marcado, escondendo o fato de que a
  // peca pode estar em varios modelos. Desmarcar agora remove de fato (em
  // vez de ser ignorado).
  function partExistsInModel(mid, pecaNome) {
    if (!CATALOGO_MODELOS[mid] || !pecaNome) return false;
    var target = pecaNome.toLowerCase();
    return CATALOGO_MODELOS[mid].pecas.some(function(p) {
      return p.nome.toLowerCase() === target;
    });
  }

  var modelsCheckboxes = getAdminModels().map(function(m) {
    var checked = isEdit && peca ? partExistsInModel(m.id, peca.nome) : false;
    return '<label><input type="checkbox" name="admin-modelos" value="' + m.id + '"' + (checked ? ' checked' : '') + '> ' + m.nome + '</label>';
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

// ============================================================
// CONFIRMACAO DE/PARA (Task 5 reorg 2026-07-28)
// ============================================================
// Modal de confirmacao usado pelos dois pontos que gravam direto: o preco/peso
// da peca (saveAdminPart) e o saldo do estoque (renderEstoqueTable).
//
// NAO usa confirm() nativo de proposito: o dialogo do navegador trava a
// automacao de teste, nao aceita o visual do app e nao da para ler o texto de
// fora. Este aqui e o mesmo .modal-overlay/.modal-content que o resto do
// arquivo ja usa, com z-index acima do modal de edicao (1000) para poder
// aparecer POR CIMA dele sem fechar o formulario — quem cancelar volta para o
// formulario com o que digitou ainda la.
//
// Devolve Promise<boolean>: true so quando a pessoa clica em Confirmar.
// Cancelar, Esc e clique fora resolvem false — e false NUNCA grava nada.
function confirmarAlteracao(texto) {
  return new Promise(function(resolve) {
    var anterior = document.getElementById('modal-confirma-alteracao');
    if (anterior && anterior.parentNode) anterior.parentNode.removeChild(anterior);

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-confirma-alteracao';
    overlay.style.display = 'flex';
    overlay.style.zIndex = '1200';
    overlay.innerHTML =
      '<div class="modal-content" style="max-width:540px;padding:1.5rem;">' +
        '<div id="confirma-alteracao-texto" style="font-size:0.95rem;line-height:1.6;margin-bottom:1.5rem;"></div>' +
        '<div style="display:flex;gap:0.75rem;justify-content:flex-end;">' +
          '<button type="button" class="btn-cancelar" id="confirma-alteracao-cancelar">Cancelar</button>' +
          '<button type="button" class="btn-primario" id="confirma-alteracao-ok">Confirmar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // textContent, nao innerHTML: o texto carrega nome de peca vindo da
    // planilha e nunca deve virar marcacao.
    document.getElementById('confirma-alteracao-texto').textContent = texto;

    var respondido = false;
    function fechar(valor) {
      if (respondido) return;
      respondido = true;
      document.removeEventListener('keydown', aoTeclar, true);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(valor);
    }
    function aoTeclar(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); fechar(false); }
    }

    document.getElementById('confirma-alteracao-ok').addEventListener('click', function() { fechar(true); });
    document.getElementById('confirma-alteracao-cancelar').addEventListener('click', function() { fechar(false); });
    overlay.addEventListener('click', function(ev) { if (ev.target === overlay) fechar(false); });
    document.addEventListener('keydown', aoTeclar, true);

    // O foco comeca no Cancelar: quem estiver martelando Enter no teclado sai
    // sem gravar, que e o lado seguro de errar.
    document.getElementById('confirma-alteracao-cancelar').focus();
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

  // Fecha o formulario e repinta as telas. Era codigo corrido no fim do
  // .then(); virou funcao porque na edicao ele passou a acontecer DEPOIS da
  // resposta do modal de confirmacao — fechar antes de perguntar apagaria o
  // que ela digitou justamente quando ela clicasse em Cancelar.
  function fecharModalEAtualizar() {
    var modalAdmin = document.getElementById('modal-admin');
    if (modalAdmin) modalAdmin.style.display = 'none';
    refreshAdminTable();

    // Refresh catalog if it's open
    if (typeof catalogoModelId !== 'undefined' && catalogoModelId && typeof openCatalogo === 'function') {
      openCatalogo(catalogoModelId);
    }
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

    // Quando ha imagem nova, fazer upload UMA vez (na primeira chamada) e
    // reutilizar a URL retornada do Drive nas chamadas seguintes. Antes, o
    // base64 era enviado em N requests paralelos -> N copias do mesmo arquivo
    // no Drive.
    var hasNewImage = !!(imagemBase64 && imagemNome);

    if (isEdit) {
      var sourcePeca = CATALOGO_MODELOS[editModelId].pecas[editIdx];
      var nomeOriginal = sourcePeca.nome;

      // 1. Encontra todas as ocorrencias atuais da peca (por nomeOriginal)
      //    para sincronizar update/add/remove conforme a selecao do usuario.
      var preExisting = {}; // mid -> idx (em caso de duplicata, ultima ganha)
      Object.keys(CATALOGO_MODELOS).forEach(function(mid) {
        if (!CATALOGO_MODELOS[mid]) return;
        CATALOGO_MODELOS[mid].pecas.forEach(function(p, i) {
          if (p.nome.toLowerCase() === nomeOriginal.toLowerCase()) {
            preExisting[mid] = i;
          }
        });
      });

      // 2. Diff: pre-existentes x selecionados
      var selSet = {};
      selectedModels.forEach(function(mid) { selSet[mid] = true; });

      var toUpdate = []; // [{mid, idx}] - em ambos
      var toAdd = [];    // [mid]        - so em selecionados
      var toRemove = []; // [{mid, idx, modelNome}] - so em pre-existentes

      Object.keys(preExisting).forEach(function(mid) {
        if (selSet[mid]) {
          toUpdate.push({ mid: mid, idx: preExisting[mid] });
        } else {
          toRemove.push({ mid: mid, idx: preExisting[mid], modelNome: CATALOGO_MODELOS[mid].nome });
        }
      });
      selectedModels.forEach(function(mid) {
        if (preExisting[mid] === undefined && CATALOGO_MODELOS[mid]) {
          toAdd.push(mid);
        }
      });

      // 3. CONFIRMACAO DE/PARA (Task 5 reorg 2026-07-28)
      //
      // Este e o lapis do cartao no catalogo. Ele reescreve PRECO e PESO em
      // todos os modelos onde a peca existe, e ate hoje gravava direto: um
      // digito a mais virava preco errado na rua sem ninguem ver acontecer. A
      // dona do produto decidiu (28/07) que ele NAO some — ganha confirmacao,
      // porque sumir deixaria a equipe sem como corrigir um preco errado.
      //
      // O aviso da remocao de modelos, que era um confirm() nativo aqui, entrou
      // no MESMO modal: dois dialogos em sequencia fazem a pessoa clicar no
      // segundo sem ler, e o nativo ainda trava a automacao de teste.
      //
      // A regra (o que mudou, se ha o que confirmar, e o texto) mora em
      // lib/confirmacao-alteracao.js e e testada em node:test. Aqui so se
      // pergunta e se obedece a resposta.
      var nomesAfetados = [];
      toUpdate.forEach(function(u) {
        if (CATALOGO_MODELOS[u.mid]) nomesAfetados.push(CATALOGO_MODELOS[u.mid].nome);
      });
      toAdd.forEach(function(mid) {
        if (CATALOGO_MODELOS[mid]) nomesAfetados.push(CATALOGO_MODELOS[mid].nome);
      });
      var nomesRemove = toRemove.map(function(r) { return r.modelNome; });

      // O rotulo e o que ela ve no cartao que abriu ("Kay bateria 60V"); a
      // frase de escopo logo depois diz em quantos modelos aquilo vale.
      var rotuloAlvo = ((CATALOGO_MODELOS[editModelId] && CATALOGO_MODELOS[editModelId].nome) || '') +
        ' ' + nomeOriginal;

      // Trocar o NOME, subir imagem nova ou marcar um modelo a mais sao
      // alteracoes de verdade e precisam gravar — mas nao sao de/para de valor,
      // entao nao viram pergunta. So entram aqui para nao caírem no "nada
      // mudou" e serem descartadas em silencio.
      var outrasMudancas = (nome !== nomeOriginal) || hasNewImage || toAdd.length > 0;

      var decisao = (typeof decidirGravacao === 'function')
        ? decidirGravacao(rotuloAlvo, [
            { campo: 'preco', rotulo: 'preço', tipo: 'moeda', de: sourcePeca.preco, para: preco },
            { campo: 'peso', rotulo: 'peso', tipo: 'texto', de: sourcePeca.peso, para: peso }
          ], {
            escopo: (typeof escopoModelos === 'function') ? escopoModelos(nomesAfetados) : '',
            avisos: [(typeof avisoRemocaoModelos === 'function') ? avisoRemocaoModelos(nomesRemove) : ''],
            outrasMudancas: outrasMudancas
          })
        // Sem a lib carregada (404 no meio de um deploy), segue o comportamento
        // que ja existia antes desta task: grava. Travar a edicao de preco por
        // causa de um arquivo que nao baixou seria pior que a falta do aviso.
        : null;

      if (decisao && !decisao.gravar) {
        // Nada mudou: nao grava, nao pergunta, e diz que nao gravou. O modal
        // fica aberto — ela ainda pode corrigir o que quis mudar. Mesmo guard
        // que a tela de OS usa no Salvar status.
        mostrarFeedback(decisao.mensagem, 'info');
        return;
      }

      // 4. Escolhe ancora pra fazer o upload da imagem (uma vez so).
      //    Prefere o modelo de origem se ele estiver em toUpdate.
      //
      // Daqui para baixo e a GRAVACAO. Virou funcao para poder acontecer depois
      // da resposta do modal — antes era codigo corrido logo abaixo do
      // confirm(), que era sincrono. Nada dentro dela mudou.
      var anchorMid = null;
      var anchorIdx = null;
      var anchorAction = null;

      function gravarEdicao() {
        if (toUpdate.length > 0) {
          var sourceInUpdate = null;
          for (var iu = 0; iu < toUpdate.length; iu++) {
            if (toUpdate[iu].mid === editModelId) { sourceInUpdate = toUpdate[iu]; break; }
          }
          var anchor = sourceInUpdate || toUpdate[0];
          anchorMid = anchor.mid;
          anchorIdx = anchor.idx;
          anchorAction = 'editar';
        } else if (toAdd.length > 0) {
          anchorMid = toAdd[0];
          anchorAction = 'adicionar';
        }

        function applyRest(driveUrl) {
          // Updates (pula a ancora)
          toUpdate.forEach(function(u) {
            if (u.mid === anchorMid && anchorAction === 'editar') return;
            var p = CATALOGO_MODELOS[u.mid].pecas[u.idx];
            if (!p) return;
            p.nome = nome;
            p.preco = preco;
            p.peso = peso;
            if (driveUrl) p.img = driveUrl;
            else if (imgPath) p.img = imgPath;
            savePartToSheets('editar', u.mid, u.idx, p, null, null, nomeOriginal);
          });

          // Adicoes (pula a ancora)
          toAdd.forEach(function(mid) {
            if (mid === anchorMid && anchorAction === 'adicionar') return;
            var newP = {
              nome: nome,
              preco: preco,
              peso: peso,
              img: driveUrl || imgPath || 'img/' + mid + '/' + nome + '.jpeg'
            };
            CATALOGO_MODELOS[mid].pecas.push(newP);
            var newIdx = CATALOGO_MODELOS[mid].pecas.length - 1;
            savePartToSheets('adicionar', mid, newIdx, newP, null, null);
          });

          // Remocoes. Cada toRemove e em modelo distinto, entao o idx capturado
          // continua valido (nenhum splice anterior afetou aquele array).
          toRemove.forEach(function(r) {
            var currentPeca = CATALOGO_MODELOS[r.mid].pecas[r.idx];
            var stubForBackend = { nome: currentPeca ? currentPeca.nome : nomeOriginal };
            CATALOGO_MODELOS[r.mid].pecas.splice(r.idx, 1);
            savePartToSheets('excluir', r.mid, r.idx, stubForBackend, null, null);
          });

          // Feedback agregado
          var partes = [];
          if (toUpdate.length > 0) partes.push(toUpdate.length + ' atualizado(s)');
          if (toAdd.length > 0) partes.push(toAdd.length + ' adicionado(s)');
          if (toRemove.length > 0) partes.push(toRemove.length + ' removido(s)');
          if (partes.length > 0) {
            mostrarFeedback('Peca "' + nome + '": ' + partes.join(', '), 'sucesso');
          }
          refreshAdminTable();
        }

        if (anchorMid && anchorAction === 'editar') {
          var pAnchor = CATALOGO_MODELOS[anchorMid].pecas[anchorIdx];
          pAnchor.nome = nome;
          pAnchor.preco = preco;
          pAnchor.peso = peso;
          if (imgPath) pAnchor.img = imgPath;

          savePartToSheets('editar', anchorMid, anchorIdx, pAnchor, imagemBase64, imagemNome, nomeOriginal).then(function(resp) {
            if (resp && resp.sucesso === false) {
              mostrarFeedback('Erro ao atualizar peca na planilha: ' + (resp.erro || 'desconhecido'), 'erro');
              return;
            }
            var driveUrl = (resp && resp.imagemUrl) ? resp.imagemUrl : null;
            if (driveUrl) {
              pAnchor.img = driveUrl;
              refreshAdminTable();
            }
            applyRest(driveUrl);
          });
        } else if (anchorMid && anchorAction === 'adicionar') {
          var newAnchor = {
            nome: nome,
            preco: preco,
            peso: peso,
            img: imgPath || 'img/' + anchorMid + '/' + nome + '.jpeg'
          };
          CATALOGO_MODELOS[anchorMid].pecas.push(newAnchor);
          var newAnchorIdx = CATALOGO_MODELOS[anchorMid].pecas.length - 1;
          savePartToSheets('adicionar', anchorMid, newAnchorIdx, newAnchor, imagemBase64, imagemNome).then(function(resp) {
            var driveUrl = (resp && resp.imagemUrl) ? resp.imagemUrl : null;
            if (driveUrl) {
              newAnchor.img = driveUrl;
              refreshAdminTable();
            }
            applyRest(driveUrl);
          });
        } else {
          // So tem remocoes
          applyRest(null);
        }

        fecharModalEAtualizar();
      }

      // 5. Pergunta (se houver o que perguntar) e so entao grava.
      //
      // O `return` da cadeia e proposital: ele prende o .finally() la embaixo
      // ate a pessoa responder, entao o botao "Salvar Alteracoes" continua
      // desabilitado enquanto o modal esta na tela — nao da para disparar a
      // gravacao duas vezes.
      if (decisao && decisao.confirmar) {
        return confirmarAlteracao(decisao.texto).then(function(confirmou) {
          if (!confirmou) return; // Cancelar nao grava NADA e nao fecha o formulario
          gravarEdicao();
        });
      }
      if (!decisao && toRemove.length > 0) {
        // Sem a lib carregada, o de/para se perde — mas o aviso da remocao ja
        // existia ANTES desta task (era o confirm() nativo daqui). Perde-lo em
        // silencio seria transformar uma queda de arquivo em peca apagada de
        // modelo sem ninguem perguntar.
        return confirmarAlteracao('A peça "' + nomeOriginal + '" será REMOVIDA de ' +
          toRemove.length + ' modelo(s): ' + nomesRemove.join(', ') + '. Confirmar?')
          .then(function(confirmou) {
            if (!confirmou) return;
            gravarEdicao();
          });
      }
      gravarEdicao();
      return;
    } else {
      // Add new part to selected models
      var validModels = selectedModels.filter(function(mid) { return !!CATALOGO_MODELOS[mid]; });

      function adicionarAosDemais(driveUrl, startIdx) {
        for (var k = startIdx; k < validModels.length; k++) {
          (function(mid) {
            var img = driveUrl || imgPath || 'img/' + mid + '/' + nome + '.jpeg';
            var otherPeca = { nome: nome, preco: preco, peso: peso, img: img };
            CATALOGO_MODELOS[mid].pecas.push(otherPeca);
            var otherIdx = CATALOGO_MODELOS[mid].pecas.length - 1;
            // null base64/nome -> sem reupload
            savePartToSheets('adicionar', mid, otherIdx, otherPeca, null, null);
          })(validModels[k]);
        }
      }

      if (hasNewImage && validModels.length > 0) {
        // Faz a primeira chamada com base64, espera a URL do Drive,
        // dispara as outras em paralelo sem base64.
        var firstMid = validModels[0];
        var firstPeca = {
          nome: nome,
          preco: preco,
          peso: peso,
          img: imgPath || 'img/' + firstMid + '/' + nome + '.jpeg'
        };
        CATALOGO_MODELOS[firstMid].pecas.push(firstPeca);
        var firstIdx = CATALOGO_MODELOS[firstMid].pecas.length - 1;
        savePartToSheets('adicionar', firstMid, firstIdx, firstPeca, imagemBase64, imagemNome).then(function(resp) {
          var driveUrl = (resp && resp.imagemUrl) ? resp.imagemUrl : firstPeca.img;
          if (driveUrl !== firstPeca.img) {
            firstPeca.img = driveUrl;
            refreshAdminTable();
          }
          adicionarAosDemais(driveUrl, 1);
        });
      } else {
        // Sem imagem nova: cada modelo usa seu proprio fallback path em paralelo
        validModels.forEach(function(mid) {
          var newPeca = {
            nome: nome,
            preco: preco,
            peso: peso,
            img: imgPath || 'img/' + mid + '/' + nome + '.jpeg'
          };
          CATALOGO_MODELOS[mid].pecas.push(newPeca);
          var newIdx = CATALOGO_MODELOS[mid].pecas.length - 1;
          savePartToSheets('adicionar', mid, newIdx, newPeca, null, null).then(function(resp) {
            if (resp && resp.imagemUrl) {
              newPeca.img = resp.imagemUrl;
              refreshAdminTable();
            }
          });
        });
      }
      mostrarFeedback('Peca "' + nome + '" adicionada a ' + selectedModels.length + ' modelo(s)!', 'sucesso');
    }

    fecharModalEAtualizar();
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
function savePartToSheets(acao, modelId, idx, peca, imagemBase64, imagemNome, nomeOriginal) {
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

  if (nomeOriginal) {
    payload.nomeOriginal = nomeOriginal;
  }

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

      // Indexa estoque da planilha por modelId|peca (ambos lowercase).
      // Backend devolve item.modelo como NOME — normalizamos via
      // getModelIdByName (definido em catalogo.js) pra casar com p.modelId
      // do catalogo no lookup abaixo.
      var sheetEstoque = {};
      if (data && data.sucesso && data.estoque) {
        data.estoque.forEach(function(item) {
          var modelId = (typeof getModelIdByName === 'function')
            ? getModelIdByName(item.modelo)
            : (item.modelo || '').toLowerCase();
          var key = modelId + '|' + (item.peca || '').toLowerCase();
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

    // Uma resposta so por edicao. O blur dispara mais de uma vez (abrir o modal
    // tira o foco do campo; o Escape remove o input do DOM, o que tambem dispara
    // blur), e sem esta trava a mesma alteracao perguntaria duas vezes.
    var tratado = false;

    function pintarCelula(valor) {
      cell.textContent = valor;
      cell.classList.toggle('estoque-cell-zero', valor === 0);
    }

    function saveValue() {
      if (tratado) return;
      tratado = true;

      var newVal = parseInt(input.value) || 0;
      if (newVal < 0) newVal = 0;

      // A celula volta ao valor ANTIGO enquanto a pergunta esta na tela: numero
      // novo pintado antes da confirmacao e uma promessa que o Cancelar teria
      // de desfazer.
      pintarCelula(currentVal);

      // CONFIRMACAO DE/PARA (Task 5 reorg 2026-07-28). Este clique reescrevia o
      // estoque na hora, sem perguntar e sem registro — e o numero que ele muda
      // e o que todas as telas leem. Decisao da dona do produto (28/07): nao
      // sumir com o campo, e sim confirmar, para continuar dando para corrigir
      // um saldo errado.
      var item = adminEstoque[idx];
      var rotuloCampo = field === 'sumare' ? 'saldo em Sumaré' : field === 'jaragua' ? 'saldo em Jaraguá' : 'saldo (' + field + ')';
      var decisao = (typeof decidirGravacao === 'function')
        ? decidirGravacao(
            (item.modeloNome || item.modelo || '') + ' — ' + item.peca,
            [{ campo: field, rotulo: rotuloCampo, tipo: 'inteiro', de: currentVal, para: newVal }],
            { escopo: (typeof ESCOPO_SALDO === 'string') ? ESCOPO_SALDO : '' }
          )
        // Sem a lib carregada, mantem o comportamento anterior a esta task
        // (grava direto) em vez de deixar o estoque sem como ser corrigido.
        : null;

      function gravar() {
        adminEstoque[idx][field] = newVal;
        pintarCelula(newVal);
        salvarEstoqueItem(adminEstoque[idx]);
      }

      if (!decisao) { gravar(); return; }

      if (!decisao.gravar) {
        // Digitou o mesmo numero: nao vai POST nenhum para a planilha.
        mostrarFeedback(decisao.mensagem, 'info');
        return;
      }

      confirmarAlteracao(decisao.texto).then(function(confirmou) {
        if (!confirmou) return; // Cancelar nao grava nada e a celula ja esta no valor antigo
        gravar();
      });
    }

    input.addEventListener('blur', saveValue);
    input.addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        input.blur();
      }
      if (ev.key === 'Escape') {
        // Escape e um cancelamento: marca como tratado ANTES de tirar o input
        // do DOM, senao o blur que vem em seguida gravava o valor digitado — o
        // Escape nunca cancelou de verdade nesta tela.
        tratado = true;
        pintarCelula(currentVal);
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
