/* ===== NXT PECAS V2.1 - Formulario de Registro ===== */

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbytZgFvvhTvYRgufyvFTGbMb27sxHnIQp256XQ6r7VZuX2B0RTdO3MIpbf4EcF8KgnYlw/exec';

let pecasAdicionadas = [];
let envioEmAndamento = false;
let ultimoResumo = '';
let ultimaVendaPDF = null;

// --- Init ---
function initFormulario() {
  var container = document.getElementById('formulario-container');
  if (!container) return;

  container.innerHTML = buildFormHTML();
  setupFormListeners();
  configurarDataHoje();
  console.log('Formulario V2 inicializado');
}

// --- Build form HTML ---
function buildFormHTML() {
  var modelsOptions = '';
  Object.keys(CATALOGO_MODELOS).forEach(function(id) {
    modelsOptions += '<option value="' + id + '">' + CATALOGO_MODELOS[id].nome + '</option>';
  });

  var ufOptions = ['', 'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(function(u) {
    return '<option value="' + u + '">' + (u || 'UF') + '</option>';
  }).join('');

  return '' +
    '<form id="vendaPecaForm" autocomplete="off">' +

    // SECAO ATENDIMENTO
    '<div class="secao-form">' +
      '<div class="secao-form-titulo">Atendimento</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label>Tipo</label>' +
          '<div class="checkbox-group">' +
            '<label><input type="checkbox" id="tipoVendaSAC"> Venda de Pecas SAC</label>' +
            '<label><input type="checkbox" id="tipoVendaSumare"> Venda de Pecas Sumare</label>' +
            '<label><input type="checkbox" id="tipoGarantia"> Garantia</label>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="origemSac">Origem SAC</label>' +
          '<select id="origemSac">' +
            '<option value="">Selecione...</option>' +
            '<option value="WhatsApp">WhatsApp</option>' +
            '<option value="Telefone">Telefone</option>' +
            '<option value="E-mail">E-mail</option>' +
            '<option value="Chat">Chat</option>' +
            '<option value="Reclame Aqui">Reclame Aqui</option>' +
            '<option value="Mercado Livre">Mercado Livre</option>' +
            '<option value="Outro">Outro</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="protocoloSac">Protocolo</label>' +
          '<input type="text" id="protocoloSac" placeholder="Protocolo SAC">' +
        '</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="dataVenda">Data</label>' +
          '<input type="date" id="dataVenda" required>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="vendedor">Vendedor (SAC)</label>' +
          '<input type="text" id="vendedor" placeholder="Nome do atendente" required>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="prevEmbarque">Prev. Embarque</label>' +
          '<input type="date" id="prevEmbarque">' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="urgencia">Urgencia</label>' +
          '<select id="urgencia">' +
            '<option value="normal">Normal</option>' +
            '<option value="baixa">Baixa</option>' +
            '<option value="alta">Alta</option>' +
            '<option value="urgente">Urgente</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // SECAO CLIENTE
    '<div class="secao-form">' +
      '<div class="secao-form-titulo">Cliente</div>' +
      '<div class="form-row">' +
        '<div class="form-group form-group-lg">' +
          '<label for="nomeCliente">Nome</label>' +
          '<input type="text" id="nomeCliente" placeholder="Nome completo" required>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="tipoCliente">Tipo</label>' +
          '<select id="tipoCliente">' +
            '<option value="F">Pessoa Fisica</option>' +
            '<option value="J">Pessoa Juridica</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="cpfCnpjCliente">CPF/CNPJ</label>' +
          '<input type="text" id="cpfCnpjCliente" placeholder="000.000.000-00" maxlength="14">' +
          '<span class="campo-aviso" id="avisoDocumento"></span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="ieCliente">IE</label>' +
          '<input type="text" id="ieCliente" placeholder="Inscricao Estadual">' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="telefoneCliente">Telefone</label>' +
          '<input type="text" id="telefoneCliente" placeholder="(00) 00000-0000" maxlength="15" required>' +
          '<span class="campo-aviso" id="avisoTelefone">Telefone invalido</span>' +
        '</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group form-group-sm">' +
          '<label for="cepCliente">CEP</label>' +
          '<input type="text" id="cepCliente" placeholder="00000-000" maxlength="9">' +
        '</div>' +
        '<div class="form-group form-group-lg">' +
          '<label for="enderecoCliente">Endereco</label>' +
          '<input type="text" id="enderecoCliente" placeholder="Rua, Avenida...">' +
        '</div>' +
        '<div class="form-group form-group-sm">' +
          '<label for="numeroCliente">Numero</label>' +
          '<input type="text" id="numeroCliente" placeholder="No">' +
        '</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="bairroCliente">Bairro</label>' +
          '<input type="text" id="bairroCliente" placeholder="Bairro">' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="cidadeCliente">Cidade</label>' +
          '<input type="text" id="cidadeCliente" placeholder="Cidade">' +
        '</div>' +
        '<div class="form-group form-group-sm">' +
          '<label for="ufCliente">UF</label>' +
          '<select id="ufCliente">' + ufOptions + '</select>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // SECAO PECAS
    '<div class="secao-form">' +
      '<div class="secao-form-titulo">Pecas</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="modeloMoto">Modelo</label>' +
          '<select id="modeloMoto">' +
            '<option value="">Selecione o modelo...</option>' +
            modelsOptions +
          '</select>' +
        '</div>' +
        '<div class="form-group" id="outroModeloGroup" style="display:none;">' +
          '<label for="outroModeloNome">Especifique o modelo</label>' +
          '<input type="text" id="outroModeloNome" placeholder="Digite o nome do modelo...">' +
        '</div>' +
        '<div class="form-group form-group-lg">' +
          '<label for="descricaoPeca">Peca</label>' +
          '<input type="text" id="descricaoPeca" list="listaPecasDatalist" placeholder="Digite ou selecione a peca...">' +
          '<datalist id="listaPecasDatalist"></datalist>' +
        '</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="tipoPrecoPeca">Tipo Preco</label>' +
          '<select id="tipoPrecoPeca">' +
            '<option value="cliente">Cliente</option>' +
            '<option value="revenda">Revenda (-15%)</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="corBike">Cor</label>' +
          '<input type="text" id="corBike" placeholder="Cor (opcional)">' +
        '</div>' +
        '<div class="form-group form-group-sm">' +
          '<label for="qtdPeca">Qtd</label>' +
          '<input type="number" id="qtdPeca" value="1" min="1">' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="precoPeca">Preco Unit.</label>' +
          '<input type="text" id="precoPeca" class="mask-moeda" placeholder="0,00">' +
        '</div>' +
        '<div class="form-group form-group-sm">' +
          '<label for="pesoPeca">Peso</label>' +
          '<input type="text" id="pesoPeca" placeholder="0gr" readonly>' +
        '</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<div class="peca-img-preview-wrap" id="previewPecaSelecionada" style="display:none;">' +
            '<img id="imgPecaSelecionada" src="" alt="Preview">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="form-row" style="align-items:center;">' +
        '<span class="subtotal-label">Subtotal: <strong id="subtotalPeca">R$ 0,00</strong></span>' +
        '<button type="button" class="btn-primario btn-adicionar-peca" onclick="adicionarPeca()">+ Adicionar Peca</button>' +
      '</div>' +
      '<div class="form-row" style="align-items:center;margin-top:0.5rem;">' +
        '<button type="button" class="btn-secundario" onclick="buscarNoCatalogo()" style="width:100%;">&#128269; Buscar no Catalogo</button>' +
      '</div>' +
      '<div id="listaPecas" class="lista-pecas"></div>' +
      '<div class="form-total">Total Pecas: <strong id="totalVenda">R$ 0,00</strong></div>' +
    '</div>' +

    // SECAO FRETE
    '<div class="secao-form">' +
      '<div class="secao-form-titulo">Frete</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="transportadora">Transportadora</label>' +
          '<select id="transportadora">' +
            '<option value="">Selecione...</option>' +
            '<option value="correios">Correios</option>' +
            '<option value="rodonaves">Rodonaves</option>' +
            '<option value="atual_cargas">Atual Cargas</option>' +
            '<option value="em_maos">Em Maos</option>' +
            '<option value="loja">Loja</option>' +
            '<option value="outro">Outro</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="valorFrete">Valor Frete</label>' +
          '<input type="text" id="valorFrete" class="mask-moeda" placeholder="0,00">' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Peso Total</label>' +
          '<span class="info-calculada" id="pesoTotalCalc">0gr</span>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // SECAO PAGAMENTO
    '<div class="secao-form">' +
      '<div class="secao-form-titulo">Pagamento</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="formaPagamento">Forma de Pagamento</label>' +
          '<select id="formaPagamento">' +
            '<option value="">Selecione...</option>' +
            '<option value="pix">PIX</option>' +
            '<option value="dinheiro">Dinheiro</option>' +
            '<option value="debito">Debito</option>' +
            '<option value="credito">Credito</option>' +
            '<option value="boleto">Boleto</option>' +
            '<option value="link">Link de Pagamento</option>' +
            '<option value="transferencia">Transferencia</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group" id="parcelasContainer" style="display:none;">' +
          '<label for="parcelas">Parcelas</label>' +
          '<select id="parcelas">' +
            '<option value="1">1x</option>' +
            '<option value="2">2x</option>' +
            '<option value="3">3x</option>' +
            '<option value="4">4x</option>' +
            '<option value="5">5x</option>' +
            '<option value="6">6x</option>' +
            '<option value="10">10x</option>' +
            '<option value="12">12x</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group form-group-lg">' +
          '<label for="observacoes">Observacoes</label>' +
          '<textarea id="observacoes" rows="3" placeholder="Observacoes adicionais..."></textarea>' +
        '</div>' +
      '</div>' +
      '<div class="form-total form-total-geral">TOTAL GERAL: <strong id="totalGeral">R$ 0,00</strong></div>' +
    '</div>' +

    // BOTAO REGISTRAR
    '<button type="submit" class="btn-primario btn-registrar-venda" id="btnRegistrar">' +
      'Registrar Atendimento' +
    '</button>' +
    '</form>' +

    // MODAL RESUMO
    '<div class="modal-overlay" id="resumoModal" style="display:none;">' +
      '<div class="modal-content modal-resumo">' +
        '<div class="modal-resumo-header">' +
          '<h3>Resumo do Atendimento</h3>' +
          '<button class="modal-close" onclick="fecharResumoModal()">&times;</button>' +
        '</div>' +
        '<div class="checklist-envio">' +
          '<div class="checklist-item" id="checkPlanilha">' +
            '<span class="checklist-icon">&#9203;</span>' +
            '<span>Enviando para planilha...</span>' +
          '</div>' +
          '<div class="checklist-item" id="checkBling">' +
            '<span class="checklist-icon">&#9203;</span>' +
            '<span>Enviando para Bling...</span>' +
          '</div>' +
        '</div>' +
        '<textarea id="textoResumoModal" rows="14" readonly></textarea>' +
        '<div class="modal-resumo-actions">' +
          '<button type="button" class="btn-primario" onclick="copiarResumo()">Copiar Resumo</button>' +
          '<button type="button" class="btn-secundario" onclick="gerarPDFSeparacao()">PDF Separacao</button>' +
          '<button type="button" class="btn-sucesso" onclick="novaVenda()">Novo Atendimento</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

// --- Setup all event listeners ---
function setupFormListeners() {
  // Form submit
  var form = document.getElementById('vendaPecaForm');
  if (form) {
    form.addEventListener('submit', registrarVenda);
  }

  // Tipo cliente change
  var tipoCliente = document.getElementById('tipoCliente');
  if (tipoCliente) {
    tipoCliente.addEventListener('change', function() {
      var docInput = document.getElementById('cpfCnpjCliente');
      docInput.value = '';
      if (this.value === 'J') {
        docInput.placeholder = '00.000.000/0000-00';
        docInput.maxLength = 18;
      } else {
        docInput.placeholder = '000.000.000-00';
        docInput.maxLength = 14;
      }
      validarCampoDocumento();
    });
  }

  // Mascara telefone
  var telInput = document.getElementById('telefoneCliente');
  if (telInput) {
    telInput.addEventListener('input', function() {
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
      validarCampoTelefone();
    });
  }

  // Mascara CPF/CNPJ
  var docInput = document.getElementById('cpfCnpjCliente');
  if (docInput) {
    docInput.addEventListener('input', function() {
      var v = this.value.replace(/\D/g, '');
      var tipo = document.getElementById('tipoCliente').value;
      if (tipo === 'J') {
        if (v.length > 14) v = v.substring(0, 14);
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
        this.maxLength = 18;
      } else {
        if (v.length > 11) v = v.substring(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        this.maxLength = 14;
      }
      this.value = v;
      validarCampoDocumento();
    });
  }

  // Handler trocar tipo de cliente F/J - limpa campo documento para evitar máscara desincronizada
  var tipoClienteSelect = document.getElementById('tipoCliente');
  if (tipoClienteSelect) {
    tipoClienteSelect.addEventListener('change', function() {
      var docInput = document.getElementById('cpfCnpjCliente');
      if (docInput) {
        docInput.value = '';
        docInput.classList.remove('campo-invalido', 'campo-valido');
        var aviso = document.getElementById('avisoDocumento');
        if (aviso) aviso.classList.remove('visivel');
        docInput.maxLength = this.value === 'J' ? 18 : 14;
        docInput.placeholder = this.value === 'J' ? '00.000.000/0000-00' : '000.000.000-00';
      }
    });
  }

  // Mascara CEP + auto-fill
  var cepInput = document.getElementById('cepCliente');
  if (cepInput) {
    cepInput.addEventListener('input', function() {
      var v = this.value.replace(/\D/g, '');
      if (v.length > 8) v = v.substring(0, 8);
      if (v.length > 5) {
        v = v.replace(/^(\d{5})(\d)/, '$1-$2');
      }
      this.value = v;
    });

    cepInput.addEventListener('blur', function() {
      var cep = this.value.replace(/\D/g, '');
      if (cep.length === 8) {
        buscarCEP(cep);
      }
    });
  }

  // Mascara moeda
  document.querySelectorAll('#formulario-container .mask-moeda').forEach(function(input) {
    input.addEventListener('input', function() {
      var v = this.value.replace(/\D/g, '');
      if (v) {
        v = (parseInt(v) / 100).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        this.value = v;
      }
    });
  });

  // Modelo change -> populate datalist + toggle "Outro" field
  var modeloSelect = document.getElementById('modeloMoto');
  if (modeloSelect) {
    modeloSelect.addEventListener('change', function() {
      var outroGroup = document.getElementById('outroModeloGroup');
      if (outroGroup) {
        outroGroup.style.display = this.value === 'outro' ? '' : 'none';
        if (this.value !== 'outro') {
          document.getElementById('outroModeloNome').value = '';
        }
      }
      popularDatalistPecas(this.value);
      document.getElementById('descricaoPeca').value = '';
      limparPreviewPeca();
    });
  }

  // Peca input change -> auto-fill preco/peso/img
  var pecaInput = document.getElementById('descricaoPeca');
  if (pecaInput) {
    pecaInput.addEventListener('change', function() {
      preencherDadosPeca();
    });
    pecaInput.addEventListener('input', function() {
      // Debounce for typing
      clearTimeout(this._debounce);
      var self = this;
      this._debounce = setTimeout(function() {
        preencherDadosPeca();
      }, 300);
    });
  }

  // Tipo preco change
  var tipoPreco = document.getElementById('tipoPrecoPeca');
  if (tipoPreco) {
    tipoPreco.addEventListener('change', function() {
      preencherDadosPeca();
    });
  }

  // Qtd/preco -> subtotal
  var qtdInput = document.getElementById('qtdPeca');
  var precoInput = document.getElementById('precoPeca');
  if (qtdInput) qtdInput.addEventListener('input', calcularSubtotal);
  if (precoInput) precoInput.addEventListener('input', calcularSubtotal);

  // Frete change -> total geral
  var valorFrete = document.getElementById('valorFrete');
  if (valorFrete) valorFrete.addEventListener('input', atualizarTotalGeral);

  // Forma pagamento -> parcelas
  var formaPgto = document.getElementById('formaPagamento');
  if (formaPgto) {
    formaPgto.addEventListener('change', function() {
      var container = document.getElementById('parcelasContainer');
      container.style.display = (this.value === 'credito' || this.value === 'link') ? 'block' : 'none';
    });
  }
}

// --- Date setup ---
function configurarDataHoje() {
  var hoje = new Date().toISOString().split('T')[0];
  var el = document.getElementById('dataVenda');
  if (el) el.value = hoje;
}

// --- CEP lookup ---
function buscarCEP(cep) {
  fetch('https://viacep.com.br/ws/' + cep + '/json/')
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
      if (!data.erro) {
        var e = document.getElementById('enderecoCliente');
        var b = document.getElementById('bairroCliente');
        var c = document.getElementById('cidadeCliente');
        var u = document.getElementById('ufCliente');
        if (e) e.value = data.logradouro || '';
        if (b) b.value = data.bairro || '';
        if (c) c.value = data.localidade || '';
        if (u) u.value = data.uf || '';
        // Focus on numero
        var n = document.getElementById('numeroCliente');
        if (n) n.focus();
        mostrarFeedback('CEP encontrado!', 'sucesso');
      } else {
        mostrarFeedback('CEP nao encontrado', 'erro');
      }
    })
    .catch(function() {
      mostrarFeedback('Erro ao buscar CEP', 'erro');
    });
}

// --- Populate datalist from model ---
function popularDatalistPecas(modelId) {
  var datalist = document.getElementById('listaPecasDatalist');
  if (!datalist) return;
  datalist.innerHTML = '';

  if (modelId && CATALOGO_MODELOS[modelId]) {
    var pecas = CATALOGO_MODELOS[modelId].pecas;
    pecas.forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p.nome;
      datalist.appendChild(opt);
    });
  }

  // Itens globais (ex: Mão de obra) — disponíveis em qualquer modelo
  if (typeof ITENS_GLOBAIS !== 'undefined') {
    ITENS_GLOBAIS.forEach(function(item) {
      var opt = document.createElement('option');
      opt.value = item.nome;
      datalist.appendChild(opt);
    });
  }
}

// --- Find part data from current model ---
function encontrarPecaSelecionada() {
  var modelId = document.getElementById('modeloMoto').value;
  var nome = document.getElementById('descricaoPeca').value.trim();
  if (!nome) return null;

  // Primeiro, procurar nos itens globais (independente de modelo)
  if (typeof ITENS_GLOBAIS !== 'undefined') {
    for (var g = 0; g < ITENS_GLOBAIS.length; g++) {
      if (ITENS_GLOBAIS[g].nome.toLowerCase() === nome.toLowerCase()) {
        return Object.assign({}, ITENS_GLOBAIS[g]);
      }
    }
  }

  if (!modelId || !CATALOGO_MODELOS[modelId]) return null;

  var pecas = CATALOGO_MODELOS[modelId].pecas;
  for (var i = 0; i < pecas.length; i++) {
    if (pecas[i].nome.toLowerCase() === nome.toLowerCase()) {
      return pecas[i];
    }
  }
  return null;
}

// --- Auto-fill price, weight, image ---
function preencherDadosPeca() {
  var peca = encontrarPecaSelecionada();
  var precoInput = document.getElementById('precoPeca');
  var pesoInput = document.getElementById('pesoPeca');
  var previewWrap = document.getElementById('previewPecaSelecionada');
  var previewImg = document.getElementById('imgPecaSelecionada');

  if (!peca) {
    limparPreviewPeca();
    return;
  }

  // Price
  var tipoPreco = document.getElementById('tipoPrecoPeca').value;
  var preco = peca.preco;
  if (preco != null && tipoPreco === 'revenda') {
    preco = preco * 0.85;
  }
  if (preco != null && preco > 0) {
    precoInput.value = formatarValor(preco);
  } else {
    precoInput.value = '';
  }

  // Se o item é de preço editável (ex: Mão de obra), deixar campo vazio e focado
  if (peca.precoEditavel) {
    precoInput.value = '';
    precoInput.placeholder = 'Informe o valor (R$)';
    precoInput.readOnly = false;
    precoInput.focus();
  } else {
    precoInput.placeholder = '0,00';
    precoInput.readOnly = false;
  }

  // Weight
  if (peca.peso) {
    pesoInput.value = peca.peso;
  } else {
    pesoInput.value = '';
  }

  // Image
  if (peca.img && previewWrap && previewImg) {
    previewImg.src = peca.img;
    previewImg.alt = peca.nome;
    previewWrap.style.display = 'block';
  } else {
    limparPreviewPeca();
  }

  calcularSubtotal();
}

function limparPreviewPeca() {
  var wrap = document.getElementById('previewPecaSelecionada');
  var img = document.getElementById('imgPecaSelecionada');
  if (wrap) wrap.style.display = 'none';
  if (img) { img.src = ''; img.alt = ''; }
}

// --- Subtotal ---
function calcularSubtotal() {
  var qtd = parseInt(document.getElementById('qtdPeca').value) || 0;
  var preco = parseMoeda(document.getElementById('precoPeca').value);
  var el = document.getElementById('subtotalPeca');
  if (el) el.textContent = 'R$ ' + formatarValor(qtd * preco);
}

// --- Add part ---
function adicionarPeca() {
  var modelId = document.getElementById('modeloMoto').value;
  var descricao = document.getElementById('descricaoPeca').value.trim();
  var qtd = parseInt(document.getElementById('qtdPeca').value) || 1;
  var precoTexto = document.getElementById('precoPeca').value;
  var tipoPreco = document.getElementById('tipoPrecoPeca').value;
  var cor = document.getElementById('corBike').value.trim();
  var pesoTexto = document.getElementById('pesoPeca').value;

  if (!descricao) { mostrarFeedback('Informe a peca', 'erro'); return; }
  if (!modelId) { mostrarFeedback('Selecione o modelo', 'erro'); return; }

  // Validar nome do modelo quando "Outro"
  var outroNome = document.getElementById('outroModeloNome') ? document.getElementById('outroModeloNome').value.trim() : '';
  if (modelId === 'outro' && !outroNome) { mostrarFeedback('Especifique o nome do modelo', 'erro'); return; }

  var preco = parseMoeda(precoTexto);
  if (isNaN(preco) || preco <= 0) { mostrarFeedback('Informe o preco da peca', 'erro'); return; }

  var pesoGramas = parseWeight(pesoTexto);

  // Detectar se é item global isMaoDeObra
  var pecaBase = encontrarPecaSelecionada();
  var isMaoDeObra = !!(pecaBase && pecaBase.isMaoDeObra);

  var modelNome = modelId === 'outro' ? outroNome : (CATALOGO_MODELOS[modelId] ? CATALOGO_MODELOS[modelId].nome : modelId);

  // Get image from preview
  var imgSrc = '';
  var previewImg = document.getElementById('imgPecaSelecionada');
  if (previewImg && previewImg.src && previewImg.src !== window.location.href) {
    imgSrc = previewImg.src;
  }

  var peca = {
    id: Date.now(),
    modelId: modelId,
    modelo: modelNome,
    descricao: descricao,
    cor: cor,
    tipoPreco: tipoPreco,
    quantidade: qtd,
    precoUnitario: preco,
    total: preco * qtd,
    peso: pesoTexto,
    pesoGramas: pesoGramas * qtd,
    img: imgSrc,
    isMaoDeObra: isMaoDeObra
  };

  pecasAdicionadas.push(peca);
  renderizarPecas();
  atualizarTotal();
  atualizarPesoTotal();

  // Verificar estoque
  verificarEstoquePeca(modelId, descricao);

  // Clear part fields
  document.getElementById('descricaoPeca').value = '';
  document.getElementById('qtdPeca').value = '1';
  document.getElementById('precoPeca').value = '';
  document.getElementById('corBike').value = '';
  document.getElementById('pesoPeca').value = '';
  document.getElementById('subtotalPeca').textContent = 'R$ 0,00';
  limparPreviewPeca();

  mostrarFeedback(descricao + ' adicionado!', 'sucesso');
}

// --- Remove part ---
function removerPeca(id) {
  pecasAdicionadas = pecasAdicionadas.filter(function(p) { return p.id !== id; });
  renderizarPecas();
  atualizarTotal();
  atualizarPesoTotal();
}

// --- Render parts list ---
function renderizarPecas() {
  var lista = document.getElementById('listaPecas');
  if (!lista) return;

  if (pecasAdicionadas.length === 0) {
    lista.innerHTML = '';
    return;
  }

  lista.innerHTML = pecasAdicionadas.map(function(p) {
    return '<div class="peca-item">' +
      '<div class="peca-info">' +
        '<div class="peca-item-nome">' + p.descricao + '</div>' +
        '<div class="peca-item-detalhe">' +
          p.modelo +
          (p.cor ? ' | Cor: ' + p.cor : '') +
          ' | ' + p.quantidade + 'x R$ ' + formatarValor(p.precoUnitario) +
          ' (' + p.tipoPreco + ')' +
          (p.peso ? ' | ' + p.peso : '') +
        '</div>' +
      '</div>' +
      '<span class="peca-item-total">R$ ' + formatarValor(p.total) + '</span>' +
      '<button type="button" class="btn-remover-peca" onclick="removerPeca(' + p.id + ')">&#10005;</button>' +
    '</div>';
  }).join('');
}

// --- Update totals ---
function atualizarTotal() {
  var total = pecasAdicionadas.reduce(function(sum, p) { return sum + p.total; }, 0);
  var el = document.getElementById('totalVenda');
  if (el) el.textContent = 'R$ ' + formatarValor(total);
  atualizarTotalGeral();
}

function atualizarTotalGeral() {
  var totalPecas = pecasAdicionadas.reduce(function(sum, p) { return sum + p.total; }, 0);
  var frete = parseMoeda(document.getElementById('valorFrete').value);
  var el = document.getElementById('totalGeral');
  if (el) el.textContent = 'R$ ' + formatarValor(totalPecas + frete);
}

function atualizarPesoTotal() {
  var pesoTotal = pecasAdicionadas.reduce(function(sum, p) { return sum + (p.pesoGramas || 0); }, 0);
  var el = document.getElementById('pesoTotalCalc');
  if (el) el.textContent = formatWeight(pesoTotal) || '0gr';
}

// --- Validation ---
function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  for (var t = 9; t < 11; t++) {
    var soma = 0;
    for (var i = 0; i < t; i++) {
      soma += parseInt(cpf[i]) * ((t + 1) - i);
    }
    var resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(cpf[t])) return false;
  }
  return true;
}

function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  var pesos1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  var pesos2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  var soma = 0;
  for (var i = 0; i < 12; i++) soma += parseInt(cnpj[i]) * pesos1[i];
  var resto = soma % 11;
  if (parseInt(cnpj[12]) !== (resto < 2 ? 0 : 11 - resto)) return false;
  soma = 0;
  for (var j = 0; j < 13; j++) soma += parseInt(cnpj[j]) * pesos2[j];
  resto = soma % 11;
  if (parseInt(cnpj[13]) !== (resto < 2 ? 0 : 11 - resto)) return false;
  return true;
}

function validarCampoDocumento() {
  var input = document.getElementById('cpfCnpjCliente');
  var aviso = document.getElementById('avisoDocumento');
  var tipo = document.getElementById('tipoCliente').value;
  var digitos = input.value.replace(/\D/g, '');

  if (digitos.length === 0) {
    input.classList.remove('campo-invalido', 'campo-valido');
    if (aviso) aviso.classList.remove('visivel');
    return;
  }

  var tamanhoEsperado = tipo === 'J' ? 14 : 11;

  if (digitos.length < tamanhoEsperado) {
    input.classList.remove('campo-invalido', 'campo-valido');
    if (aviso) aviso.classList.remove('visivel');
  } else {
    var valido = tipo === 'J' ? validarCNPJ(digitos) : validarCPF(digitos);
    if (valido) {
      input.classList.remove('campo-invalido');
      input.classList.add('campo-valido');
      if (aviso) aviso.classList.remove('visivel');
    } else {
      input.classList.add('campo-invalido');
      input.classList.remove('campo-valido');
      if (aviso) {
        aviso.textContent = tipo === 'J' ? 'CNPJ invalido' : 'CPF invalido';
        aviso.classList.add('visivel');
      }
    }
  }
}

function validarTelefone(tel) {
  var digitos = tel.replace(/\D/g, '');
  return digitos.length >= 10 && digitos.length <= 11;
}

function validarCampoTelefone() {
  var input = document.getElementById('telefoneCliente');
  var aviso = document.getElementById('avisoTelefone');
  var digitos = input.value.replace(/\D/g, '');
  if (digitos.length > 0 && digitos.length < 10) {
    input.classList.add('campo-invalido');
    input.classList.remove('campo-valido');
    if (aviso) aviso.classList.add('visivel');
  } else if (digitos.length >= 10) {
    input.classList.remove('campo-invalido');
    input.classList.add('campo-valido');
    if (aviso) aviso.classList.remove('visivel');
  } else {
    input.classList.remove('campo-invalido', 'campo-valido');
    if (aviso) aviso.classList.remove('visivel');
  }
}

// --- Format helpers ---
function formatarData(dataISO) {
  var parts = dataISO.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function formatarTelefoneExibicao(digitos) {
  if (digitos.length === 11) {
    return digitos.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  return digitos.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
}

// --- Submit ---
function registrarVenda(event) {
  event.preventDefault();
  if (envioEmAndamento) return;

  var tipoVendaSAC = document.getElementById('tipoVendaSAC').checked;
  var tipoVendaSumare = document.getElementById('tipoVendaSumare').checked;
  var tipoGarantia = document.getElementById('tipoGarantia').checked;
  var origemSac = document.getElementById('origemSac').value;
  var protocoloSac = document.getElementById('protocoloSac').value.trim();
  var data = document.getElementById('dataVenda').value;
  var vendedor = document.getElementById('vendedor').value.trim();
  var prevEmbarque = document.getElementById('prevEmbarque').value;
  var nomeCliente = document.getElementById('nomeCliente').value.trim();
  var tipoCliente = document.getElementById('tipoCliente').value;
  var cpfCnpj = document.getElementById('cpfCnpjCliente').value.trim();
  var ie = document.getElementById('ieCliente').value.trim();
  var telefone = document.getElementById('telefoneCliente').value.trim();
  var endereco = document.getElementById('enderecoCliente').value.trim();
  var numero = document.getElementById('numeroCliente').value.trim();
  var bairro = document.getElementById('bairroCliente').value.trim();
  var cidade = document.getElementById('cidadeCliente').value.trim();
  var uf = document.getElementById('ufCliente').value;
  var cep = document.getElementById('cepCliente').value.trim();
  var urgencia = document.getElementById('urgencia').value;
  var transportadora = document.getElementById('transportadora').value;
  var valorFrete = parseMoeda(document.getElementById('valorFrete').value);
  var formaPagamento = document.getElementById('formaPagamento').value;
  var parcelas = document.getElementById('parcelas').value;
  var observacoes = document.getElementById('observacoes').value.trim();

  // Validations
  if (!tipoVendaSAC && !tipoVendaSumare && !tipoGarantia) { mostrarFeedback('Selecione o tipo de atendimento', 'erro'); return; }
  if (!data) { mostrarFeedback('Informe a data', 'erro'); return; }
  if (!vendedor) { mostrarFeedback('Informe o vendedor (SAC)', 'erro'); return; }
  if (!nomeCliente) { mostrarFeedback('Informe o nome do cliente', 'erro'); return; }
  if (!telefone || !validarTelefone(telefone)) { mostrarFeedback('Telefone invalido', 'erro'); return; }
  if (cpfCnpj) {
    var docDigitos = cpfCnpj.replace(/\D/g, '');
    if (tipoCliente === 'J' && !validarCNPJ(docDigitos)) { mostrarFeedback('CNPJ invalido', 'erro'); return; }
    if (tipoCliente !== 'J' && docDigitos.length === 11 && !validarCPF(docDigitos)) { mostrarFeedback('CPF invalido', 'erro'); return; }
  }
  if (pecasAdicionadas.length === 0) { mostrarFeedback('Adicione ao menos uma peca', 'erro'); return; }

  // Mão de obra não pode ir sozinha para o Bling (rateio precisa de produto base)
  var produtosNoCarrinho = pecasAdicionadas.filter(function(p) { return !p.isMaoDeObra; });
  var maoDeObraNoCarrinho = pecasAdicionadas.filter(function(p) { return p.isMaoDeObra; });
  if (maoDeObraNoCarrinho.length > 0 && produtosNoCarrinho.length === 0) {
    mostrarFeedback('Adicione ao menos uma peça junto com a mão de obra', 'erro');
    return;
  }
  if ((tipoVendaSAC || tipoVendaSumare) && !formaPagamento) { mostrarFeedback('Selecione a forma de pagamento', 'erro'); return; }

  envioEmAndamento = true;
  var btnSubmit = document.getElementById('btnRegistrar');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Enviando...';

  var totalPecas = pecasAdicionadas.reduce(function(s, p) { return s + p.total; }, 0);
  var totalGeral = totalPecas + valorFrete;
  var pesoTotalGramas = pecasAdicionadas.reduce(function(s, p) { return s + (p.pesoGramas || 0); }, 0);

  var tipoAtendimento = [];
  if (tipoVendaSAC) tipoAtendimento.push('Venda SAC');
  if (tipoVendaSumare) tipoAtendimento.push('Venda Sumare');
  if (tipoGarantia) tipoAtendimento.push('Garantia');

  var venda = {
    id: 'PCA-' + Date.now(),
    tipoAtendimento: tipoAtendimento.join(' + '),
    origemSac: origemSac,
    protocoloSac: protocoloSac,
    dataVenda: data,
    vendedor: vendedor,
    prevEmbarque: prevEmbarque,
    cliente: {
      nome: nomeCliente,
      tipo: tipoCliente,
      cpfCnpj: cpfCnpj.replace(/\D/g, ''),
      ie: ie,
      telefone: telefone.replace(/\D/g, ''),
      endereco: endereco,
      numero: numero,
      bairro: bairro,
      cidade: cidade,
      uf: uf,
      cep: cep.replace(/\D/g, '')
    },
    pecas: pecasAdicionadas.map(function(p) {
      return {
        descricao: p.descricao,
        modelo: p.modelo,
        cor: p.cor,
        tipoPreco: p.tipoPreco,
        quantidade: p.quantidade,
        precoUnitario: p.precoUnitario,
        total: p.total,
        peso: p.peso,
        pesoGramas: p.pesoGramas,
        img: p.img || ''
      };
    }),
    pagamento: {
      forma: formaPagamento,
      parcelas: (formaPagamento === 'credito' || formaPagamento === 'link') ? parcelas : '1'
    },
    urgencia: urgencia,
    frete: {
      transportadora: transportadora,
      valor: valorFrete
    },
    pesoVolume: formatWeight(pesoTotalGramas),
    observacoes: observacoes,
    totalPecas: totalPecas,
    totalGeral: totalGeral
  };

  // Show modal
  mostrarResumoModal(venda);

  // Send to Google
  enviarParaGoogle(venda);
}

// --- Send to Google Apps Script ---
function enviarParaGoogle(venda) {
  if (GOOGLE_SCRIPT_URL.indexOf('SUBSTITUIR') !== -1) {
    console.warn('Google Apps Script nao configurado');
    atualizarChecklist('checkPlanilha', false);
    atualizarChecklist('checkBling', false);
    finalizarEnvio();
    return;
  }

  var payload = {
    action: 'registrar_venda',
    id: venda.id,
    tipoAtendimento: venda.tipoAtendimento,
    origemSac: venda.origemSac,
    protocoloSac: venda.protocoloSac,
    dataVenda: venda.dataVenda,
    vendedor: venda.vendedor,
    prevEmbarque: venda.prevEmbarque,
    nomeCliente: venda.cliente.nome,
    tipoCliente: venda.cliente.tipo,
    cpfCnpjCliente: venda.cliente.cpfCnpj,
    ieCliente: venda.cliente.ie,
    telefoneCliente: venda.cliente.telefone,
    enderecoCliente: venda.cliente.endereco,
    numeroCliente: venda.cliente.numero,
    bairroCliente: venda.cliente.bairro,
    cidadeCliente: venda.cliente.cidade,
    ufCliente: venda.cliente.uf,
    cepCliente: venda.cliente.cep,
    pecas: venda.pecas,
    formaPagamento: venda.pagamento.forma,
    parcelas: venda.pagamento.parcelas,
    urgencia: venda.urgencia,
    transportadora: venda.frete.transportadora,
    valorFrete: venda.frete.valor,
    pesoVolume: venda.pesoVolume,
    observacoes: venda.observacoes,
    totalPecas: venda.totalPecas,
    totalGeral: venda.totalGeral
  };

  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    redirect: 'follow',
    body: JSON.stringify(payload)
  })
  .then(function(response) {
    if (response.type === 'opaque' || response.ok) {
      atualizarChecklist('checkPlanilha', true);
      atualizarChecklist('checkBling', true);
      // Baixa automatica de estoque
      baixaEstoqueVenda(venda);
    } else {
      atualizarChecklist('checkPlanilha', false);
      atualizarChecklist('checkBling', false);
    }
    finalizarEnvio();
  })
  .catch(function(error) {
    console.error('Erro ao enviar:', error);
    atualizarChecklist('checkPlanilha', false);
    atualizarChecklist('checkBling', false);
    finalizarEnvio();
  });
}

// --- Stock check when adding part ---
function verificarEstoquePeca(modelId, pecaNome) {
  var info = null;
  if (typeof getEstoquePeca === 'function') {
    info = getEstoquePeca(modelId, pecaNome);
  }

  // Remover alerta anterior
  var oldAlert = document.getElementById('alertaEstoque');
  if (oldAlert) oldAlert.remove();

  if (!info) return; // Sem info de estoque, nao alertar

  var alertDiv = document.createElement('div');
  alertDiv.id = 'alertaEstoque';

  if (info.sumare === 0 && info.jaragua === 0) {
    alertDiv.className = 'alerta-estoque alerta-estoque-indisponivel';
    alertDiv.innerHTML = '\u26A0\uFE0F <strong>' + pecaNome + '</strong> est\u00e1 indispon\u00edvel no estoque. Deseja continuar?';
  } else if (info.sumare === 0) {
    alertDiv.className = 'alerta-estoque alerta-estoque-parcial';
    alertDiv.innerHTML = '\u2139\uFE0F <strong>' + pecaNome + '</strong> dispon\u00edvel apenas em <strong>Jaragu\u00e1</strong> (qtd: ' + info.jaragua + ')';
  } else if (info.jaragua === 0) {
    alertDiv.className = 'alerta-estoque alerta-estoque-parcial';
    alertDiv.innerHTML = '\u2139\uFE0F <strong>' + pecaNome + '</strong> dispon\u00edvel apenas em <strong>Sumar\u00e9</strong> (qtd: ' + info.sumare + ')';
  } else {
    return; // Ambos disponiveis, sem alerta
  }

  var listaPecas = document.getElementById('listaPecas');
  if (listaPecas) {
    listaPecas.parentNode.insertBefore(alertDiv, listaPecas);
  }

  // Auto-remover apos 8 segundos
  setTimeout(function() {
    if (alertDiv.parentNode) alertDiv.remove();
  }, 8000);
}

// --- Auto-decrement stock on sale ---
function baixaEstoqueVenda(venda) {
  if (typeof GOOGLE_SCRIPT_URL === 'undefined' || GOOGLE_SCRIPT_URL.indexOf('SUBSTITUIR') !== -1) return;

  var pecas = venda.pecas || [];
  pecas.forEach(function(p) {
    // Determinar localizacao pela tipo de atendimento
    var localizacao = 'sumare'; // default
    if (venda.tipoAtendimento && venda.tipoAtendimento.toLowerCase().indexOf('sumare') !== -1) {
      localizacao = 'sumare';
    } else {
      localizacao = 'jaragua';
    }

    var payload = {
      action: 'baixa_estoque',
      modelo: p.modelo || '',
      peca: p.descricao || '',
      localizacao: localizacao,
      quantidade: p.quantidade || 1
    };

    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    }).then(function(resp) {
      return resp.text();
    }).then(function(text) {
      try {
        var data = JSON.parse(text);
        console.log('Baixa estoque:', data);
      } catch (e) {
        console.warn('Baixa estoque: resposta nao-JSON', text);
      }
    }).catch(function(err) {
      console.warn('Baixa estoque: erro', err);
    });
  });

  // Invalidar cache de estoque
  if (typeof estoqueCache !== 'undefined') {
    for (var key in estoqueCache) {
      delete estoqueCache[key];
    }
  }
}

function finalizarEnvio() {
  envioEmAndamento = false;
  var btn = document.getElementById('btnRegistrar');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Registrar Atendimento';
  }
}

// --- Summary Modal ---
function mostrarResumoModal(venda) {
  var formaLabel = {
    'dinheiro': 'Dinheiro', 'pix': 'PIX', 'debito': 'Debito',
    'credito': 'Credito', 'boleto': 'Boleto', 'link': 'Link de Pagamento',
    'transferencia': 'Transferencia'
  };
  var transpLabel = {
    'correios': 'Correios', 'rodonaves': 'Rodonaves', 'atual_cargas': 'Atual Cargas',
    'em_maos': 'Em Maos', 'loja': 'Loja', 'outro': 'Outro'
  };

  var texto = '*ATENDIMENTO SAC - PECAS*\n';
  texto += '━━━━━━━━━━━━━━━━\n';
  texto += '*Tipo:* ' + venda.tipoAtendimento + '\n';
  if (venda.origemSac) texto += '*Origem:* ' + venda.origemSac + '\n';
  if (venda.protocoloSac) texto += '*Protocolo:* ' + venda.protocoloSac + '\n';
  texto += '*Data:* ' + formatarData(venda.dataVenda) + '\n';
  texto += '*Vendedor:* ' + venda.vendedor + '\n';
  if (venda.prevEmbarque) texto += '*Prev. Embarque:* ' + formatarData(venda.prevEmbarque) + '\n';
  texto += '\n*CLIENTE:*\n';
  texto += '*Nome:* ' + venda.cliente.nome + '\n';
  texto += '*Telefone:* ' + formatarTelefoneExibicao(venda.cliente.telefone) + '\n';
  if (venda.cliente.cpfCnpj) texto += '*' + (venda.cliente.tipo === 'J' ? 'CNPJ' : 'CPF') + ':* ' + venda.cliente.cpfCnpj + '\n';
  if (venda.cliente.ie) texto += '*IE:* ' + venda.cliente.ie + '\n';
  if (venda.cliente.endereco) texto += '*Endereco:* ' + venda.cliente.endereco + (venda.cliente.numero ? ', ' + venda.cliente.numero : '') + '\n';
  if (venda.cliente.bairro) texto += '*Bairro:* ' + venda.cliente.bairro + '\n';
  if (venda.cliente.cidade) texto += '*Cidade:* ' + venda.cliente.cidade + (venda.cliente.uf ? ' - ' + venda.cliente.uf : '') + '\n';
  if (venda.cliente.cep) texto += '*CEP:* ' + venda.cliente.cep + '\n';
  texto += '\n*PECAS:*\n';
  venda.pecas.forEach(function(p, i) {
    texto += (i + 1) + '. ' + p.descricao + ' (' + p.modelo + ')' + (p.cor ? ' - Cor: ' + p.cor : '') + '\n';
    texto += '   ' + p.quantidade + 'x R$ ' + formatarValor(p.precoUnitario) + ' = R$ ' + formatarValor(p.total) + '\n';
    if (p.peso) texto += '   Peso: ' + p.peso + '\n';
  });
  texto += '\n*Total Pecas: R$ ' + formatarValor(venda.totalPecas) + '*\n';
  if (venda.pesoVolume) texto += '*Peso Total: ' + venda.pesoVolume + '*\n';
  if (venda.frete.valor > 0) {
    texto += '*Frete (' + (transpLabel[venda.frete.transportadora] || venda.frete.transportadora) + '): R$ ' + formatarValor(venda.frete.valor) + '*\n';
  }
  texto += '*TOTAL GERAL: R$ ' + formatarValor(venda.totalGeral) + '*\n';
  texto += '*Pagamento:* ' + (formaLabel[venda.pagamento.forma] || venda.pagamento.forma);
  if (venda.pagamento.forma === 'credito' || venda.pagamento.forma === 'link') texto += ' (' + venda.pagamento.parcelas + 'x)';
  texto += '\n';
  if (venda.observacoes) texto += '*Obs:* ' + venda.observacoes + '\n';

  ultimoResumo = texto;
  ultimaVendaPDF = venda;

  // Reset checklist
  resetChecklist('checkPlanilha', 'Enviando para planilha...');
  resetChecklist('checkBling', 'Enviando para Bling...');

  var textarea = document.getElementById('textoResumoModal');
  if (textarea) textarea.value = texto;

  var modal = document.getElementById('resumoModal');
  if (modal) modal.style.display = 'flex';
}

function resetChecklist(elementId, label) {
  var el = document.getElementById(elementId);
  if (!el) return;
  var icon = el.querySelector('.checklist-icon');
  var span = el.querySelector('span:last-child');
  if (icon) icon.textContent = '\u23F3';
  if (span) span.textContent = label;
  el.classList.remove('done');
}

function atualizarChecklist(elementId, sucesso) {
  var el = document.getElementById(elementId);
  if (!el) return;
  var icon = el.querySelector('.checklist-icon');
  var span = el.querySelector('span:last-child');

  if (sucesso) {
    if (icon) icon.textContent = '\u2705';
    el.classList.add('done');
    if (span) span.textContent = elementId === 'checkPlanilha' ? 'Enviado para planilha!' : 'Enviado para Bling!';
  } else {
    if (icon) icon.textContent = '\u274C';
    if (span) span.textContent = elementId === 'checkPlanilha' ? 'Erro ao enviar para planilha' : 'Erro ao enviar para Bling';
  }
}

function copiarResumo() {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ultimoResumo).then(function() {
      mostrarFeedback('Resumo copiado!', 'sucesso');
    }).catch(function() {
      fallbackCopy();
    });
  } else {
    fallbackCopy();
  }
}

function fallbackCopy() {
  var textarea = document.getElementById('textoResumoModal');
  if (textarea) {
    textarea.select();
    document.execCommand('copy');
    mostrarFeedback('Resumo copiado!', 'sucesso');
  }
}

function fecharResumoModal() {
  var modal = document.getElementById('resumoModal');
  if (modal) modal.style.display = 'none';
}

function novaVenda() {
  fecharResumoModal();
  var form = document.getElementById('vendaPecaForm');
  if (form) form.reset();
  pecasAdicionadas = [];
  renderizarPecas();
  atualizarTotal();
  atualizarPesoTotal();
  configurarDataHoje();
  var parcCont = document.getElementById('parcelasContainer');
  if (parcCont) parcCont.style.display = 'none';
  var sub = document.getElementById('subtotalPeca');
  if (sub) sub.textContent = 'R$ 0,00';
  limparPreviewPeca();
  document.querySelectorAll('#formulario-container .campo-invalido, #formulario-container .campo-valido').forEach(function(el) {
    el.classList.remove('campo-invalido', 'campo-valido');
  });
  document.querySelectorAll('#formulario-container .campo-aviso').forEach(function(el) {
    el.classList.remove('visivel');
  });
}

// --- PDF Separacao (modelo referencia V1.6) ---
function gerarPDFSeparacao() {
  if (!ultimaVendaPDF) {
    mostrarFeedback('Nenhum pedido para gerar PDF', 'erro');
    return;
  }

  var venda = ultimaVendaPDF;
  var transpLabel = {
    'correios': 'Correios', 'rodonaves': 'Rodonaves', 'atual_cargas': 'Atual Cargas',
    'em_maos': 'Em M\u00e3os', 'loja': 'Loja', 'outro': 'Outro'
  };
  var transNome = transpLabel[venda.frete.transportadora] || venda.frete.transportadora || '';

  var agora = new Date();
  var timestamp = agora.toLocaleDateString('pt-BR') + ', ' + agora.toLocaleTimeString('pt-BR');

  var urgenciaLabel = { 'normal': 'NORMAL', 'baixa': 'BAIXA', 'alta': 'ALTA', 'urgente': 'URGENTE' };
  var urgenciaCor = { 'normal': '#6b7280', 'baixa': '#3b82f6', 'alta': '#f59e0b', 'urgente': '#ef4444' };
  var urgText = urgenciaLabel[venda.urgencia] || 'NORMAL';
  var urgColor = urgenciaCor[venda.urgencia] || '#6b7280';

  // Calcular volumes (1 volume por peca)
  var totalVolumes = venda.pecas.reduce(function(s, p) { return s + (p.quantidade || 1); }, 0);
  var pesoVolumeStr = (venda.pesoVolume || '0gr') + ' / ' + totalVolumes + ' volume' + (totalVolumes > 1 ? 's' : '');

  // Formatacao CPF/CNPJ para exibicao
  var cpfExib = venda.cliente.cpfCnpj || '';

  // Formatacao CEP
  var cepExib = venda.cliente.cep || '';
  if (cepExib.length === 8) cepExib = cepExib.replace(/^(\d{5})(\d{3})$/, '$1-$2');

  // Endereco completo
  var endCompleto = (venda.cliente.endereco || '');
  if (venda.cliente.numero) endCompleto += ', ' + venda.cliente.numero;

  // Cidade/UF
  var cidadeUf = (venda.cliente.cidade || '') + (venda.cliente.uf ? '/' + venda.cliente.uf : '');

  // Base URL para imagens
  var baseUrl = window.location.href.replace(/[^\/]*$/, '');

  // Helper para URL-encodar caracteres especiais (espaços, $, vírgula, acentos)
  // preservando os separadores de path
  function encodePath(p) {
    return p.split('/').map(function(seg) { return encodeURIComponent(seg); }).join('/');
  }

  // Pecas rows
  var pecasRows = '';
  venda.pecas.forEach(function(p, i) {
    var rawImg = p.img || '';
    var imgSrc = rawImg;
    if (rawImg && !rawImg.startsWith('http') && !rawImg.startsWith('data:')) {
      imgSrc = baseUrl + encodePath(rawImg);
    }
    var imgHtml = imgSrc ? '<img src="' + imgSrc + '" style="width:85px;height:85px;object-fit:cover;border-radius:4px;">' : '<span style="color:#ccc;font-size:9px;">Sem foto</span>';
    pecasRows += '<tr>' +
      '<td style="text-align:center;width:30px;vertical-align:middle;">' + (i + 1) + '</td>' +
      '<td style="text-align:center;width:95px;padding:4px;vertical-align:middle;">' + imgHtml + '</td>' +
      '<td style="vertical-align:middle;">' + p.descricao + '</td>' +
      '<td style="text-align:center;vertical-align:middle;">' + (p.modelo || '') + '</td>' +
      '<td style="text-align:center;vertical-align:middle;">' + (p.cor || '') + '</td>' +
      '<td style="text-align:center;vertical-align:middle;">' + (p.categoria || '') + '</td>' +
      '<td style="text-align:center;width:35px;vertical-align:middle;">' + p.quantidade + '</td>' +
      '<td style="text-align:center;width:35px;vertical-align:middle;"></td>' +
    '</tr>';
  });

  // Logo NXT - usar imagem real do projeto (com base tag, caminho relativo funciona)
  var logoImg = '<img src="logo-nxt.png" alt="NXT" style="height:40px;width:auto;">';

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<base href="' + baseUrl + '">' +
    '<title>Separa\u00e7\u00e3o - ' + venda.id + '</title>' +
    '<style>' +
      '@page { size: A4; margin: 12mm 15mm; }' +
      '@media print { .page-break { page-break-before: always; } }' +
      '* { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }' +
      'body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #222; }' +

      /* Fundo escuro via box-shadow (funciona em print sem habilitar backgrounds) */
      '.bg-dark { background: #1a1a2e !important; box-shadow: inset 0 0 0 9999px #1a1a2e; color: white; }' +
      '.bg-obs { background: #f59e0b !important; box-shadow: inset 0 0 0 9999px #f59e0b; color: #000; }' +

      /* Header */
      '.doc-header { padding: 14px 18px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }' +
      '.doc-header .logo { display: flex; align-items: center; gap: 10px; }' +
      '.doc-header .title { color: #c6ff00; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-top: 4px; }' +
      '.doc-header .info { text-align: right; }' +
      '.doc-header .pca-id { font-size: 16px; font-weight: 900; color: #c6ff00; }' +
      '.doc-header .info-line { font-size: 10px; color: #ccc; margin-top: 2px; }' +
      '.badge-urg { display: inline-block; padding: 4px 16px; border-radius: 4px; font-size: 12px; font-weight: 700; color: white; margin-top: 5px; }' +
      '.badge-urg.urg-urgente { padding: 7px 22px; font-size: 16px; border-radius: 5px; background: #ef4444 !important; box-shadow: inset 0 0 0 9999px #ef4444; }' +
      '.badge-urg.urg-alta { padding: 5px 18px; font-size: 14px; background: #f59e0b !important; box-shadow: inset 0 0 0 9999px #f59e0b; }' +
      '.badge-urg.urg-normal { background: #6b7280 !important; box-shadow: inset 0 0 0 9999px #6b7280; }' +
      '.badge-urg.urg-baixa { background: #3b82f6 !important; box-shadow: inset 0 0 0 9999px #3b82f6; }' +

      /* Sections */
      '.section { margin-bottom: 12px; }' +
      '.section-title { padding: 6px 12px; font-weight: 700; font-size: 12px; border-radius: 4px 4px 0 0; }' +
      '.section-body { border: 1px solid #ddd; border-top: none; }' +

      /* Client table */
      '.client-table { width: 100%; border-collapse: collapse; }' +
      '.client-table td { padding: 6px 10px; border: 1px solid #eee; vertical-align: top; }' +
      '.client-table .lbl { font-size: 8px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px; }' +
      '.client-table .val { font-size: 12px; color: #111; }' +

      /* Parts table */
      '.parts-table { width: 100%; border-collapse: collapse; }' +
      '.parts-table th { background: #f5f5f5; padding: 6px 8px; font-size: 10px; text-transform: uppercase; color: #555; border: 1px solid #ddd; font-weight: 700; }' +
      '.parts-table td { padding: 5px 8px; font-size: 11px; border: 1px solid #ddd; }' +

      /* Envio table */
      '.envio-table { width: 100%; border-collapse: collapse; }' +
      '.envio-table td { padding: 6px 10px; border: 1px solid #eee; vertical-align: top; width: 50%; }' +
      '.envio-table .lbl { font-size: 8px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px; }' +
      '.envio-table .val { font-size: 12px; color: #111; }' +

      /* Obs */
      '.obs-body { border: 1px solid #ddd; border-top: none; padding: 10px 12px; min-height: 50px; font-size: 11px; color: #333; }' +

      /* Signatures */
      '.signatures { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 30px; }' +
      '.sig-block { text-align: center; width: 40%; }' +
      '.sig-line { border-top: 1px solid #333; padding-top: 6px; font-size: 10px; color: #555; }' +

      /* Footer */
      '.doc-footer { text-align: center; font-size: 9px; color: #999; margin-top: 15px; }' +

      /* PAGE 2 - Etiqueta */
      '.etiqueta-wrap { margin-top: 30px; text-align: center; }' +
      '.etiqueta-cut { font-size: 10px; color: #999; letter-spacing: 3px; margin-bottom: 10px; }' +
      '.etiqueta { border: 2px dashed #999; border-radius: 8px; max-width: 650px; margin: 0 auto; overflow: hidden; }' +
      '.etiqueta-header { padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; }' +
      '.etiqueta-header .et-title { color: #c6ff00; font-size: 14px; font-weight: 900; letter-spacing: 2px; }' +
      '.etiqueta-header .et-id { font-size: 11px; color: #ccc; }' +
      '.etiqueta-body { display: flex; padding: 16px; gap: 0; }' +
      '.etiqueta-body .col { flex: 1; padding: 8px 12px; }' +
      '.etiqueta-body .col:first-child { border-right: 1px solid #ddd; }' +
      '.etiqueta-body .col-lbl { font-size: 8px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }' +
      '.etiqueta-body .col-name { font-size: 14px; font-weight: 700; color: #111; margin-bottom: 6px; }' +
      '.etiqueta-body .col-line { font-size: 11px; color: #333; margin-bottom: 2px; }' +
      '.etiqueta-footer { display: flex; border-top: 1px solid #ddd; }' +
      '.etiqueta-footer .ef-cell { flex: 1; padding: 8px 12px; border-right: 1px solid #ddd; text-align: center; }' +
      '.etiqueta-footer .ef-cell:last-child { border-right: none; }' +
      '.etiqueta-footer .ef-lbl { font-size: 7px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px; }' +
      '.etiqueta-footer .ef-val { font-size: 12px; font-weight: 700; color: #111; margin-top: 2px; }' +
    '</style></head><body>' +

    /* ===== PAGE 1 - PEDIDO DE SEPARACAO ===== */
    '<div class="doc-header bg-dark">' +
      '<div class="logo">' + logoImg + '<div class="title">PEDIDO DE SEPARA\u00c7\u00c3O - EXPEDI\u00c7\u00c3O</div></div>' +
      '<div class="info">' +
        '<div class="pca-id">' + venda.id + '</div>' +
        (venda.protocoloSac ? '<div class="info-line">Protocolo: <strong>' + venda.protocoloSac + '</strong></div>' : '') +
        '<div class="info-line">Data: ' + formatarData(venda.dataVenda) + '</div>' +
        (venda.prevEmbarque ? '<div class="info-line">Prev. Embarque: ' + formatarData(venda.prevEmbarque) + '</div>' : '') +
        '<div><span class="badge-urg urg-' + venda.urgencia + '">' + urgText + '</span></div>' +
      '</div>' +
    '</div>' +

    /* CLIENTE */
    '<div class="section">' +
      '<div class="section-title bg-dark">CLIENTE</div>' +
      '<div class="section-body">' +
        '<table class="client-table">' +
          '<tr>' +
            '<td style="width:55%"><span class="lbl">Nome</span><span class="val">' + venda.cliente.nome + '</span></td>' +
            '<td><span class="lbl">CPF</span><span class="val">' + cpfExib + '</span></td>' +
          '</tr>' +
          '<tr>' +
            '<td><span class="lbl">Telefone</span><span class="val">' + formatarTelefoneExibicao(venda.cliente.telefone) + '</span></td>' +
            '<td><span class="lbl">Endere\u00e7o</span><span class="val">' + endCompleto + '</span></td>' +
          '</tr>' +
          '<tr>' +
            '<td><span class="lbl">Bairro</span><span class="val">' + (venda.cliente.bairro || '') + '</span></td>' +
            '<td><span class="lbl">Cidade/UF</span><span class="val">' + cidadeUf + '</span></td>' +
          '</tr>' +
          '<tr>' +
            '<td colspan="2"><span class="lbl">CEP</span><span class="val">' + cepExib + '</span></td>' +
          '</tr>' +
        '</table>' +
      '</div>' +
    '</div>' +

    /* PECAS PARA SEPARACAO */
    '<div class="section">' +
      '<div class="section-title bg-dark">PE\u00c7AS PARA SEPARA\u00c7\u00c3O</div>' +
      '<table class="parts-table">' +
        '<thead><tr><th>#</th><th>Foto</th><th>Descri\u00e7\u00e3o da Pe\u00e7a</th><th>Modelo</th><th>Cor</th><th>Categoria</th><th>Qtd</th><th>OK</th></tr></thead>' +
        '<tbody>' + pecasRows + '</tbody>' +
      '</table>' +
    '</div>' +

    /* ENVIO */
    '<div class="section">' +
      '<div class="section-title bg-dark">ENVIO</div>' +
      '<div class="section-body">' +
        '<table class="envio-table">' +
          '<tr>' +
            '<td><span class="lbl">Transportadora</span><span class="val">' + transNome + '</span></td>' +
            '<td><span class="lbl">Peso / Volume</span><span class="val">' + pesoVolumeStr + '</span></td>' +
          '</tr>' +
          '<tr>' +
            '<td><span class="lbl">Vendedor (SAC)</span><span class="val">' + venda.vendedor + '</span></td>' +
            '<td><span class="lbl">Tipo</span><span class="val">' + venda.tipoAtendimento + '</span></td>' +
          '</tr>' +
        '</table>' +
      '</div>' +
    '</div>' +

    /* OBSERVACOES */
    '<div class="section">' +
      '<div class="section-title bg-obs">OBSERVA\u00c7\u00d5ES</div>' +
      '<div class="obs-body">' + (venda.observacoes || '') + '</div>' +
    '</div>' +

    /* DADOS DA COLETA */
    '<div class="section">' +
      '<div class="section-title bg-dark">DADOS DA COLETA</div>' +
      '<div class="section-body">' +
        '<table class="envio-table">' +
          '<tr><td colspan="2"><span class="lbl">Transportadora</span><span class="val" style="border-bottom:1px solid #000;display:inline-block;min-width:240px;">&nbsp;</span></td></tr>' +
          '<tr>' +
            '<td><span class="lbl">Confer\u00eancia de NFe</span><span class="val" style="border-bottom:1px solid #000;display:inline-block;min-width:160px;">&nbsp;</span></td>' +
            '<td><span class="lbl">Confer\u00eancia de Carga</span><span class="val" style="border-bottom:1px solid #000;display:inline-block;min-width:160px;">&nbsp;</span></td>' +
          '</tr>' +
          '<tr>' +
            '<td><span class="lbl">Assinatura do Motorista</span><span class="val" style="border-bottom:1px solid #000;display:inline-block;min-width:160px;">&nbsp;</span></td>' +
            '<td><span class="lbl">Assinatura do Conferente</span><span class="val" style="border-bottom:1px solid #000;display:inline-block;min-width:160px;">&nbsp;</span></td>' +
          '</tr>' +
        '</table>' +
      '</div>' +
    '</div>' +

    /* ASSINATURAS */
    '<div class="signatures">' +
      '<div class="sig-block"><div class="sig-line">Separado por / Data</div></div>' +
      '<div class="sig-block"><div class="sig-line">Conferido por / Data</div></div>' +
    '</div>' +

    /* FOOTER P1 */
    '<div class="doc-footer">NXT Pe\u00e7as V2.1 - Documento gerado em ' + timestamp + '</div>' +

    /* ===== PAGE 2 - ETIQUETA DE ENVIO ===== */
    '<div class="page-break"></div>' +
    '<div class="etiqueta-wrap">' +
      '<div class="etiqueta-cut">Recorte pela linha tracejada</div>' +
      '<div class="etiqueta">' +
        '<div class="etiqueta-header bg-dark">' +
          '<div style="display:flex;align-items:center;gap:8px;">' + logoImg + '<span class="et-title">ETIQUETA DE ENVIO</span></div>' +
          '<div class="et-id">' + venda.id + (venda.protocoloSac ? ' | ' + venda.protocoloSac : '') + '</div>' +
        '</div>' +
        '<div class="etiqueta-body">' +
          '<div class="col">' +
            '<div class="col-lbl">R E M E T E N T E</div>' +
            '<div class="col-name">NXT MOTOS</div>' +
            '<div class="col-line">Rua Manoel Francisco da Costa, 3900</div>' +
            '<div class="col-line">Jo\u00e3o Pessoa - Cond. \u00c2ngelo Pereira</div>' +
            '<div class="col-line">Jaragu\u00e1 do Sul - SC</div>' +
            '<div class="col-line">CEP: 89257-407</div>' +
          '</div>' +
          '<div class="col">' +
            '<div class="col-lbl">D E S T I N A T \u00c1 R I O</div>' +
            '<div class="col-name">' + venda.cliente.nome + '</div>' +
            (endCompleto ? '<div class="col-line">' + endCompleto + '</div>' : '') +
            (venda.cliente.bairro ? '<div class="col-line">' + venda.cliente.bairro + '</div>' : '') +
            (cidadeUf ? '<div class="col-line">' + cidadeUf.replace('/', ' - ') + '</div>' : '') +
            (cepExib ? '<div class="col-line"><strong>CEP: ' + cepExib + '</strong></div>' : '') +
            '<div class="col-line">Tel: ' + formatarTelefoneExibicao(venda.cliente.telefone) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="etiqueta-footer">' +
          '<div class="ef-cell"><div class="ef-lbl">Transportadora</div><div class="ef-val">' + transNome + '</div></div>' +
          '<div class="ef-cell"><div class="ef-lbl">Peso / Volume</div><div class="ef-val">' + pesoVolumeStr + '</div></div>' +
          '<div class="ef-cell"><div class="ef-lbl">Data</div><div class="ef-val">' + formatarData(venda.dataVenda) + '</div></div>' +
          '<div class="ef-cell"><div class="ef-lbl">Atendente</div><div class="ef-val">' + venda.vendedor + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="doc-footer" style="margin-top:12px;">NXT Pe\u00e7as V2.1 - Etiqueta gerada em ' + timestamp + '</div>' +
    '</div>' +

    '</body></html>';

  var win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    // Aguardar imagens carregarem antes de imprimir
    var imgs = win.document.querySelectorAll('img');
    if (imgs.length === 0) {
      win.print();
    } else {
      var loaded = 0;
      var total = imgs.length;
      var onReady = function() {
        loaded++;
        if (loaded >= total) win.print();
      };
      imgs.forEach(function(img) {
        if (img.complete) {
          onReady();
        } else {
          img.addEventListener('load', onReady);
          img.addEventListener('error', onReady);
        }
      });
      // Fallback: imprimir apos 3s se imagens nao carregarem
      setTimeout(function() { if (loaded < total) win.print(); }, 3000);
    }
  }
}

// --- Navigate to catalog from form ---
function buscarNoCatalogo() {
  if (currentModel) {
    navigateTo('catalogo', { model: currentModel });
  } else {
    navigateTo('home');
    mostrarFeedback('Selecione um modelo para abrir o catalogo', 'info');
  }
}

// --- Called from catalog (legacy, now catalog adds directly) ---
function addPartToForm(peca, modelId) {
  navigateTo('formulario');

  setTimeout(function() {
    var modelSelect = document.getElementById('modeloMoto');
    if (modelSelect) {
      modelSelect.value = modelId;
      popularDatalistPecas(modelId);
    }

    var pecaInput = document.getElementById('descricaoPeca');
    if (pecaInput) pecaInput.value = peca.nome;

    preencherDadosPeca();
  }, 100);
}
