/* ===== NXT PECAS V2 - Sistema de Orcamentos ===== */

var orcamentosCache = [];
var orcamentoSearchTimer = null;

// --- Init ---
function initOrcamentos() {
  var container = document.getElementById('orcamentos-container');
  if (!container) return;

  container.innerHTML = buildOrcamentosHTML();
  setupOrcamentosListeners();
  console.log('Orcamentos V2 inicializado');
}

// --- Build HTML ---
function buildOrcamentosHTML() {
  return '' +
    '<div class="orc-header">' +
      '<h2 class="orc-titulo">Orcamentos</h2>' +
      '<button type="button" class="btn-primario" onclick="novoOrcamento()">+ Novo Orcamento</button>' +
    '</div>' +
    '<div class="orc-filtros">' +
      '<input type="text" class="search-input orc-search" id="busca-orcamento" placeholder="Buscar por numero, cliente, telefone...">' +
      '<select id="filtro-status-orc">' +
        '<option value="">Todos os status</option>' +
        '<option value="pendente">Pendente</option>' +
        '<option value="aprovado">Aprovado</option>' +
        '<option value="expirado">Expirado</option>' +
      '</select>' +
      '<input type="date" id="filtro-data-orc" placeholder="Filtrar por data">' +
      '<button type="button" class="btn-secundario btn-sm" onclick="loadOrcamentos()">Atualizar</button>' +
    '</div>' +
    '<div id="lista-orcamentos" class="orc-lista">' +
      '<p class="orc-vazio">Nenhum orcamento encontrado. Clique em "+ Novo Orcamento" ou adicione pecas pelo catalogo.</p>' +
    '</div>' +

    // Modal novo orcamento
    '<div class="modal-overlay" id="modal-novo-orcamento" style="display:none;">' +
      '<div class="modal-content modal-orcamento-form">' +
        '<div class="modal-resumo-header">' +
          '<h3>Novo Orcamento</h3>' +
          '<button class="modal-close" onclick="fecharModalNovoOrc()">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-row">' +
            '<div class="form-group form-group-lg">' +
              '<label for="orc-cliente-nome">Nome do Cliente</label>' +
              '<input type="text" id="orc-cliente-nome" placeholder="Nome completo">' +
            '</div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label for="orc-cliente-tel">Telefone</label>' +
              '<input type="text" id="orc-cliente-tel" placeholder="(00) 00000-0000" maxlength="15">' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="orc-cliente-doc">CPF/CNPJ</label>' +
              '<input type="text" id="orc-cliente-doc" placeholder="Documento">' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="orc-cliente-email">E-mail</label>' +
              '<input type="email" id="orc-cliente-email" placeholder="email@exemplo.com">' +
            '</div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label for="orc-vendedor">Vendedor</label>' +
              '<input type="text" id="orc-vendedor" placeholder="Nome do vendedor">' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="orc-validade">Validade (dias)</label>' +
              '<input type="number" id="orc-validade" value="7" min="1" max="90">' +
            '</div>' +
          '</div>' +
          '<div class="secao-form-titulo">Pecas Selecionadas</div>' +
          '<div id="orc-lista-pecas" class="lista-pecas"></div>' +
          '<div class="form-total">Total: <strong id="orc-total">R$ 0,00</strong></div>' +
          '<div class="form-row" style="margin-top:0.5rem;">' +
            '<span class="info-calculada">Peso Total: <strong id="orc-peso-total">0gr</strong></span>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group form-group-lg">' +
              '<label for="orc-observacoes">Observacoes</label>' +
              '<textarea id="orc-observacoes" rows="3" placeholder="Observacoes do orcamento..."></textarea>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-resumo-actions">' +
          '<button type="button" class="btn-primario" onclick="salvarOrcamento()">Salvar</button>' +
          '<button type="button" class="btn-secundario" onclick="salvarEGerarPDF()">Salvar + PDF</button>' +
          '<button type="button" class="btn-cancelar" onclick="fecharModalNovoOrc()">Cancelar</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // Modal detalhe orcamento
    '<div class="modal-overlay" id="modal-orcamento" style="display:none;">' +
      '<div class="modal-content modal-orcamento-detalhe">' +
        '<div class="modal-resumo-header">' +
          '<h3 id="modal-orc-titulo">Orcamento</h3>' +
          '<button class="modal-close" onclick="fecharModalOrcamento()">&times;</button>' +
        '</div>' +
        '<div id="orcamento-detail" class="modal-body"></div>' +
        '<div class="modal-resumo-actions" id="modal-orc-actions"></div>' +
      '</div>' +
    '</div>';
}

// --- Setup listeners ---
function setupOrcamentosListeners() {
  var buscaInput = document.getElementById('busca-orcamento');
  if (buscaInput) {
    buscaInput.addEventListener('input', function() {
      clearTimeout(orcamentoSearchTimer);
      orcamentoSearchTimer = setTimeout(function() {
        renderOrcamentosFiltrados();
      }, 500);
    });
  }

  var filtroStatus = document.getElementById('filtro-status-orc');
  if (filtroStatus) {
    filtroStatus.addEventListener('change', function() {
      renderOrcamentosFiltrados();
    });
  }

  var filtroData = document.getElementById('filtro-data-orc');
  if (filtroData) {
    filtroData.addEventListener('change', function() {
      renderOrcamentosFiltrados();
    });
  }

  // Phone mask on orc modal
  var telOrc = document.getElementById('orc-cliente-tel');
  if (telOrc) {
    telOrc.addEventListener('input', function() {
      var v = this.value.replace(/\D/g, '');
      if (v.length > 11) v = v.substring(0, 11);
      if (v.length > 6) {
        if (v.length === 11) {
          v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        } else {
          v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
        }
      } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
      }
      this.value = v;
    });
  }
}

// --- Generate quote number ---
function gerarNumeroOrc() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  var seq = String(Math.floor(Math.random() * 900) + 100);
  return 'ORC-' + y + m + d + '-' + seq;
}

// --- Open new quote modal ---
function novoOrcamento() {
  // Populate from selectedParts
  renderOrcPecas();
  calcularOrcTotais();

  // Clear client fields
  document.getElementById('orc-cliente-nome').value = '';
  document.getElementById('orc-cliente-tel').value = '';
  document.getElementById('orc-cliente-doc').value = '';
  document.getElementById('orc-cliente-email').value = '';
  document.getElementById('orc-vendedor').value = '';
  document.getElementById('orc-validade').value = '7';
  document.getElementById('orc-observacoes').value = '';

  var modal = document.getElementById('modal-novo-orcamento');
  if (modal) modal.style.display = 'flex';
}

function fecharModalNovoOrc() {
  var modal = document.getElementById('modal-novo-orcamento');
  if (modal) modal.style.display = 'none';
}

// --- Render parts in quote modal ---
function renderOrcPecas() {
  var lista = document.getElementById('orc-lista-pecas');
  if (!lista) return;

  if (selectedParts.length === 0) {
    lista.innerHTML = '<p class="orc-vazio">Nenhuma peca selecionada. Adicione pecas pelo catalogo.</p>';
    return;
  }

  lista.innerHTML = selectedParts.map(function(p, idx) {
    var modelNome = CATALOGO_MODELOS[p.modelId] ? CATALOGO_MODELOS[p.modelId].nome : p.modelId;
    var precoStr = p.preco != null ? 'R$ ' + formatarValor(p.preco) : 'Sem preco';
    var qtd = p.qtd || 1;
    return '<div class="peca-item">' +
      '<div class="peca-info">' +
        '<div class="peca-item-nome">' + p.nome + '</div>' +
        '<div class="peca-item-detalhe">' + modelNome + (p.peso ? ' | ' + p.peso : '') + '</div>' +
      '</div>' +
      '<div class="orc-peca-controls">' +
        '<button type="button" class="btn-sm btn-orc-qty" onclick="alterarQtdOrc(' + idx + ',-1)">-</button>' +
        '<span class="orc-peca-qty">' + qtd + '</span>' +
        '<button type="button" class="btn-sm btn-orc-qty" onclick="alterarQtdOrc(' + idx + ',1)">+</button>' +
      '</div>' +
      '<span class="peca-item-total">' + precoStr + '</span>' +
      '<button type="button" class="btn-remover-peca" onclick="removerPecaOrc(' + idx + ')">&#10005;</button>' +
    '</div>';
  }).join('');
}

function alterarQtdOrc(idx, delta) {
  if (idx < 0 || idx >= selectedParts.length) return;
  var p = selectedParts[idx];
  var novaQtd = (p.qtd || 1) + delta;
  if (novaQtd < 1) novaQtd = 1;
  p.qtd = novaQtd;
  renderOrcPecas();
  calcularOrcTotais();
}

function removerPecaOrc(idx) {
  if (idx < 0 || idx >= selectedParts.length) return;
  selectedParts.splice(idx, 1);
  updateSelectionBadge();
  renderOrcPecas();
  calcularOrcTotais();
}

function calcularOrcTotais() {
  var total = 0;
  var pesoTotal = 0;
  selectedParts.forEach(function(p) {
    var qtd = p.qtd || 1;
    if (p.preco != null) total += p.preco * qtd;
    if (p.peso) pesoTotal += parseWeight(p.peso) * qtd;
  });

  var elTotal = document.getElementById('orc-total');
  if (elTotal) elTotal.textContent = 'R$ ' + formatarValor(total);

  var elPeso = document.getElementById('orc-peso-total');
  if (elPeso) elPeso.textContent = formatWeight(pesoTotal) || '0gr';
}

// --- Save quote ---
function salvarOrcamento() {
  var nome = document.getElementById('orc-cliente-nome').value.trim();
  var tel = document.getElementById('orc-cliente-tel').value.trim();
  var doc = document.getElementById('orc-cliente-doc').value.trim();
  var email = document.getElementById('orc-cliente-email').value.trim();
  var vendedor = document.getElementById('orc-vendedor').value.trim();
  var validade = parseInt(document.getElementById('orc-validade').value) || 7;
  var obs = document.getElementById('orc-observacoes').value.trim();

  if (!nome) { mostrarFeedback('Informe o nome do cliente', 'erro'); return; }
  if (selectedParts.length === 0) { mostrarFeedback('Adicione ao menos uma peca', 'erro'); return; }

  var numero = gerarNumeroOrc();
  var hoje = new Date();
  var dataValidade = new Date(hoje.getTime() + validade * 24 * 60 * 60 * 1000);

  var total = 0;
  var pesoTotal = 0;
  var pecasPayload = selectedParts.map(function(p) {
    var qtd = p.qtd || 1;
    var modelNome = CATALOGO_MODELOS[p.modelId] ? CATALOGO_MODELOS[p.modelId].nome : p.modelId;
    if (p.preco != null) total += p.preco * qtd;
    if (p.peso) pesoTotal += parseWeight(p.peso) * qtd;
    return {
      nome: p.nome,
      modelo: modelNome,
      modelId: p.modelId,
      quantidade: qtd,
      precoUnitario: p.preco || 0,
      total: (p.preco || 0) * qtd,
      peso: p.peso || ''
    };
  });

  var orcamento = {
    action: 'salvar_orcamento',
    numero: numero,
    data: hoje.toISOString().split('T')[0],
    dataValidade: dataValidade.toISOString().split('T')[0],
    status: 'pendente',
    cliente: {
      nome: nome,
      telefone: tel.replace(/\D/g, ''),
      documento: doc.replace(/\D/g, ''),
      email: email
    },
    vendedor: vendedor,
    pecas: pecasPayload,
    pesoTotal: formatWeight(pesoTotal),
    total: total,
    observacoes: obs
  };

  // Send to Google Apps Script
  enviarOrcamento(orcamento, false);
}

function salvarEGerarPDF() {
  var nome = document.getElementById('orc-cliente-nome').value.trim();
  if (!nome) { mostrarFeedback('Informe o nome do cliente', 'erro'); return; }
  if (selectedParts.length === 0) { mostrarFeedback('Adicione ao menos uma peca', 'erro'); return; }

  var numero = gerarNumeroOrc();
  var hoje = new Date();
  var validade = parseInt(document.getElementById('orc-validade').value) || 7;
  var dataValidade = new Date(hoje.getTime() + validade * 24 * 60 * 60 * 1000);

  var total = 0;
  var pesoTotal = 0;
  var pecasPayload = selectedParts.map(function(p) {
    var qtd = p.qtd || 1;
    var modelNome = CATALOGO_MODELOS[p.modelId] ? CATALOGO_MODELOS[p.modelId].nome : p.modelId;
    if (p.preco != null) total += p.preco * qtd;
    if (p.peso) pesoTotal += parseWeight(p.peso) * qtd;
    return {
      nome: p.nome,
      modelo: modelNome,
      modelId: p.modelId,
      quantidade: qtd,
      precoUnitario: p.preco || 0,
      total: (p.preco || 0) * qtd,
      peso: p.peso || ''
    };
  });

  var orcamento = {
    action: 'salvar_orcamento',
    numero: numero,
    data: hoje.toISOString().split('T')[0],
    dataValidade: dataValidade.toISOString().split('T')[0],
    status: 'pendente',
    cliente: {
      nome: document.getElementById('orc-cliente-nome').value.trim(),
      telefone: document.getElementById('orc-cliente-tel').value.replace(/\D/g, ''),
      documento: document.getElementById('orc-cliente-doc').value.replace(/\D/g, ''),
      email: document.getElementById('orc-cliente-email').value.trim()
    },
    vendedor: document.getElementById('orc-vendedor').value.trim(),
    pecas: pecasPayload,
    pesoTotal: formatWeight(pesoTotal),
    total: total,
    observacoes: document.getElementById('orc-observacoes').value.trim(),
    gerarPDF: true
  };

  enviarOrcamento(orcamento, true);
}

function enviarOrcamento(orcamento, comPDF) {
  mostrarFeedback('Salvando orcamento...', 'info');

  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    redirect: 'follow',
    body: JSON.stringify(orcamento)
  })
  .then(function(response) {
    if (response.type === 'opaque' || response.ok) {
      mostrarFeedback('Orcamento ' + orcamento.numero + ' salvo!', 'sucesso');
      fecharModalNovoOrc();
      // Clear selected parts
      selectedParts = [];
      updateSelectionBadge();

      if (comPDF) {
        // Request PDF generation
        setTimeout(function() {
          solicitarPDFOrcamento(orcamento.numero);
        }, 2000);
      }
    } else {
      mostrarFeedback('Erro ao salvar orcamento', 'erro');
    }
  })
  .catch(function(error) {
    console.error('Erro ao salvar orcamento:', error);
    mostrarFeedback('Erro ao salvar orcamento', 'erro');
  });
}

function solicitarPDFOrcamento(numero) {
  var url = GOOGLE_SCRIPT_URL + '?action=gerar_pdf_orcamento&numero=' + encodeURIComponent(numero);

  fetch(url)
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
      if (data.sucesso && data.pdfUrl) {
        mostrarFeedback('PDF gerado com sucesso!', 'sucesso');
        window.open(data.pdfUrl, '_blank');
      } else {
        mostrarFeedback('Erro ao gerar PDF: ' + (data.erro || 'desconhecido'), 'erro');
      }
    })
    .catch(function(error) {
      console.error('Erro ao gerar PDF:', error);
      mostrarFeedback('Erro ao gerar PDF do orcamento', 'erro');
    });
}

// --- Load quotes from backend ---
function loadOrcamentos() {
  var busca = document.getElementById('busca-orcamento').value.trim();
  var status = document.getElementById('filtro-status-orc').value;
  var data = document.getElementById('filtro-data-orc').value;

  var params = ['action=listar_orcamentos'];
  if (busca) params.push('busca=' + encodeURIComponent(busca));
  if (status) params.push('status=' + encodeURIComponent(status));
  if (data) params.push('data=' + encodeURIComponent(data));

  var url = GOOGLE_SCRIPT_URL + '?' + params.join('&');

  var lista = document.getElementById('lista-orcamentos');
  if (lista) lista.innerHTML = '<p class="orc-vazio">Carregando orcamentos...</p>';

  fetch(url)
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
      if (data.sucesso && data.orcamentos) {
        orcamentosCache = data.orcamentos;
        renderOrcamentos(orcamentosCache);
      } else {
        renderOrcamentos([]);
      }
    })
    .catch(function(error) {
      console.error('Erro ao carregar orcamentos:', error);
      renderOrcamentos([]);
      mostrarFeedback('Erro ao carregar orcamentos', 'erro');
    });
}

function renderOrcamentosFiltrados() {
  // If we have cached data, filter locally; otherwise load from server
  if (orcamentosCache.length > 0) {
    var busca = (document.getElementById('busca-orcamento').value || '').toLowerCase().trim();
    var statusFiltro = document.getElementById('filtro-status-orc').value;
    var dataFiltro = document.getElementById('filtro-data-orc').value;

    var filtrados = orcamentosCache.filter(function(orc) {
      // Text filter
      if (busca) {
        var match = (orc.numero || '').toLowerCase().indexOf(busca) !== -1 ||
                    (orc.cliente || '').toLowerCase().indexOf(busca) !== -1 ||
                    (orc.telefone || '').toLowerCase().indexOf(busca) !== -1;
        if (!match) return false;
      }
      // Status filter
      if (statusFiltro && orc.status !== statusFiltro) return false;
      // Date filter
      if (dataFiltro && orc.data !== dataFiltro) return false;
      return true;
    });

    renderOrcamentos(filtrados);
  } else {
    loadOrcamentos();
  }
}

// --- Render quote list ---
function renderOrcamentos(orcamentos) {
  var lista = document.getElementById('lista-orcamentos');
  if (!lista) return;

  if (!orcamentos || orcamentos.length === 0) {
    lista.innerHTML = '<p class="orc-vazio">Nenhum orcamento encontrado.</p>';
    return;
  }

  lista.innerHTML = orcamentos.map(function(orc) {
    var statusClass = 'orc-status-' + (orc.status || 'pendente');

    // Auto-expire check
    var status = orc.status || 'pendente';
    if (status === 'pendente' && orc.dataValidade) {
      var valDate = new Date(orc.dataValidade + 'T23:59:59');
      if (valDate < new Date()) {
        status = 'expirado';
        statusClass = 'orc-status-expirado';
      }
    }

    var statusLabel = { 'pendente': 'Pendente', 'aprovado': 'Aprovado', 'expirado': 'Expirado' };
    var totalStr = orc.total != null ? 'R$ ' + formatarValor(orc.total) : '-';
    var dataStr = orc.data ? formatarDataOrc(orc.data) : '-';

    return '<div class="orc-card" onclick="abrirOrcamento(\'' + orc.numero + '\')">' +
      '<div class="orc-card-header">' +
        '<span class="orc-card-numero">' + orc.numero + '</span>' +
        '<span class="orc-badge ' + statusClass + '">' + (statusLabel[status] || status) + '</span>' +
      '</div>' +
      '<div class="orc-card-body">' +
        '<div class="orc-card-cliente">' + (orc.cliente || '-') + '</div>' +
        '<div class="orc-card-meta">' +
          '<span>' + dataStr + '</span>' +
          '<span class="orc-card-total">' + totalStr + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function formatarDataOrc(dataISO) {
  if (!dataISO) return '-';
  var parts = dataISO.split('-');
  if (parts.length !== 3) return dataISO;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

// --- Open quote detail ---
function abrirOrcamento(numero) {
  var url = GOOGLE_SCRIPT_URL + '?action=buscar_orcamento&numero=' + encodeURIComponent(numero);

  var detail = document.getElementById('orcamento-detail');
  if (detail) detail.innerHTML = '<p class="orc-vazio">Carregando...</p>';

  var titulo = document.getElementById('modal-orc-titulo');
  if (titulo) titulo.textContent = 'Orcamento ' + numero;

  var modal = document.getElementById('modal-orcamento');
  if (modal) modal.style.display = 'flex';

  fetch(url)
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
      if (data.sucesso && data.orcamento) {
        renderOrcamentoDetail(data.orcamento);
      } else {
        if (detail) detail.innerHTML = '<p class="orc-vazio">Orcamento nao encontrado.</p>';
      }
    })
    .catch(function(error) {
      console.error('Erro ao buscar orcamento:', error);
      if (detail) detail.innerHTML = '<p class="orc-vazio">Erro ao carregar orcamento.</p>';
    });
}

function renderOrcamentoDetail(orc) {
  var detail = document.getElementById('orcamento-detail');
  if (!detail) return;

  var status = orc.status || 'pendente';
  if (status === 'pendente' && orc.dataValidade) {
    var valDate = new Date(orc.dataValidade + 'T23:59:59');
    if (valDate < new Date()) status = 'expirado';
  }

  var statusLabel = { 'pendente': 'Pendente', 'aprovado': 'Aprovado', 'expirado': 'Expirado' };
  var statusClass = 'orc-status-' + status;

  var pecasHTML = '';
  var pecas = orc.pecas || [];
  if (typeof pecas === 'string') {
    try { pecas = JSON.parse(pecas); } catch (e) { pecas = []; }
  }

  if (pecas.length > 0) {
    pecasHTML = '<table class="orc-detail-table">' +
      '<thead><tr><th>Peca</th><th>Modelo</th><th>Qtd</th><th>Peso</th><th>Unit.</th><th>Total</th></tr></thead><tbody>';
    pecas.forEach(function(p) {
      pecasHTML += '<tr>' +
        '<td>' + (p.nome || p.descricao || '-') + '</td>' +
        '<td>' + (p.modelo || '-') + '</td>' +
        '<td style="text-align:center">' + (p.quantidade || 1) + '</td>' +
        '<td style="text-align:center">' + (p.peso || '-') + '</td>' +
        '<td style="text-align:right">R$ ' + formatarValor(p.precoUnitario || 0) + '</td>' +
        '<td style="text-align:right">R$ ' + formatarValor(p.total || 0) + '</td>' +
      '</tr>';
    });
    pecasHTML += '</tbody></table>';
  }

  detail.innerHTML = '' +
    '<div class="orc-detail-section">' +
      '<div class="orc-detail-row">' +
        '<span><strong>Status:</strong> <span class="orc-badge ' + statusClass + '">' + (statusLabel[status] || status) + '</span></span>' +
        '<span><strong>Data:</strong> ' + formatarDataOrc(orc.data) + '</span>' +
        '<span><strong>Validade:</strong> ' + formatarDataOrc(orc.dataValidade) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="orc-detail-section">' +
      '<h4>Cliente</h4>' +
      '<p><strong>Nome:</strong> ' + (orc.clienteNome || orc.cliente || '-') + '</p>' +
      (orc.clienteTelefone || orc.telefone ? '<p><strong>Telefone:</strong> ' + (orc.clienteTelefone || orc.telefone) + '</p>' : '') +
      (orc.clienteDocumento ? '<p><strong>Documento:</strong> ' + orc.clienteDocumento + '</p>' : '') +
      (orc.clienteEmail ? '<p><strong>E-mail:</strong> ' + orc.clienteEmail + '</p>' : '') +
      (orc.vendedor ? '<p><strong>Vendedor:</strong> ' + orc.vendedor + '</p>' : '') +
    '</div>' +
    '<div class="orc-detail-section">' +
      '<h4>Pecas</h4>' +
      pecasHTML +
    '</div>' +
    '<div class="orc-detail-section">' +
      '<div class="orc-detail-row">' +
        (orc.pesoTotal ? '<span><strong>Peso Total:</strong> ' + orc.pesoTotal + '</span>' : '') +
        '<span class="orc-detail-total"><strong>Total: R$ ' + formatarValor(orc.total || 0) + '</strong></span>' +
      '</div>' +
    '</div>' +
    (orc.observacoes ? '<div class="orc-detail-section"><h4>Observacoes</h4><p>' + orc.observacoes + '</p></div>' : '') +
    (orc.pdfUrl ? '<div class="orc-detail-section"><a href="' + orc.pdfUrl + '" target="_blank" class="btn-secundario">Abrir PDF</a></div>' : '');

  // Actions
  var actions = document.getElementById('modal-orc-actions');
  if (actions) {
    var btns = '';
    if (status === 'pendente') {
      btns += '<button type="button" class="btn-sucesso" onclick="aprovarOrcamento(\'' + orc.numero + '\')">Aprovar</button>';
    }
    btns += '<button type="button" class="btn-primario" onclick="copiarOrcamento(\'' + orc.numero + '\')">Copiar Resumo</button>';
    btns += '<button type="button" class="btn-cancelar" onclick="fecharModalOrcamento()">Fechar</button>';
    actions.innerHTML = btns;
  }
}

// --- Approve quote ---
function aprovarOrcamento(numero) {
  mostrarFeedback('Aprovando orcamento...', 'info');

  var payload = {
    action: 'atualizar_status_orcamento',
    numero: numero,
    novoStatus: 'aprovado'
  };

  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    redirect: 'follow',
    body: JSON.stringify(payload)
  })
  .then(function(response) {
    if (response.type === 'opaque' || response.ok) {
      mostrarFeedback('Orcamento aprovado! Preenchendo formulario...', 'sucesso');
      fecharModalOrcamento();

      // Fetch full quote to fill form
      var url = GOOGLE_SCRIPT_URL + '?action=buscar_orcamento&numero=' + encodeURIComponent(numero);
      fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.sucesso && data.orcamento) {
            preencherFormularioComOrcamento(data.orcamento);
          }
          navigateTo('formulario');
        })
        .catch(function() {
          navigateTo('formulario');
        });
    } else {
      mostrarFeedback('Erro ao aprovar orcamento', 'erro');
    }
  })
  .catch(function(error) {
    console.error('Erro ao aprovar:', error);
    mostrarFeedback('Erro ao aprovar orcamento', 'erro');
  });
}

// --- Fill form from approved quote ---
function preencherFormularioComOrcamento(orc) {
  // Client info
  var nome = document.getElementById('nomeCliente');
  if (nome) nome.value = orc.clienteNome || orc.cliente || '';

  var tel = document.getElementById('telefoneCliente');
  if (tel) tel.value = orc.clienteTelefone || orc.telefone || '';

  var doc = document.getElementById('cpfCnpjCliente');
  if (doc) doc.value = orc.clienteDocumento || '';

  var vendedor = document.getElementById('vendedor');
  if (vendedor) vendedor.value = orc.vendedor || '';

  // Add parts to pecasAdicionadas
  var pecas = orc.pecas || [];
  if (typeof pecas === 'string') {
    try { pecas = JSON.parse(pecas); } catch (e) { pecas = []; }
  }

  pecasAdicionadas = [];
  pecas.forEach(function(p) {
    pecasAdicionadas.push({
      id: Date.now() + Math.random(),
      modelId: p.modelId || '',
      modelo: p.modelo || '',
      descricao: p.nome || p.descricao || '',
      cor: p.cor || '',
      tipoPreco: 'cliente',
      quantidade: p.quantidade || 1,
      precoUnitario: p.precoUnitario || 0,
      total: p.total || 0,
      peso: p.peso || '',
      pesoGramas: parseWeight(p.peso || '0') * (p.quantidade || 1),
      img: ''
    });
  });

  if (typeof renderizarPecas === 'function') renderizarPecas();
  if (typeof atualizarTotal === 'function') atualizarTotal();
  if (typeof atualizarPesoTotal === 'function') atualizarPesoTotal();
}

// --- Copy quote text ---
function copiarOrcamento(numero) {
  // Build text from detail content
  var detail = document.getElementById('orcamento-detail');
  if (!detail) return;

  var texto = detail.innerText || detail.textContent || '';
  texto = '*ORCAMENTO ' + numero + '*\n' + texto;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(function() {
      mostrarFeedback('Resumo copiado!', 'sucesso');
    }).catch(function() {
      mostrarFeedback('Erro ao copiar', 'erro');
    });
  } else {
    mostrarFeedback('Clipboard nao disponivel', 'erro');
  }
}

// --- Close detail modal ---
function fecharModalOrcamento() {
  var modal = document.getElementById('modal-orcamento');
  if (modal) modal.style.display = 'none';
}
