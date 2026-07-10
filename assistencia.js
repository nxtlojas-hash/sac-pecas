/* ===== NXT SAC V2.24 - Formulário Assistência Técnica + Modal Pós-OS ===== */

(function(){
  // Reaproveita a URL definida em formulario.js (mesmo endpoint do backend)
  var GOOGLE_SCRIPT_URL_OS = null;
  function resolverUrl() {
    if (GOOGLE_SCRIPT_URL_OS) return GOOGLE_SCRIPT_URL_OS;
    if (typeof GOOGLE_SCRIPT_URL !== 'undefined') {
      GOOGLE_SCRIPT_URL_OS = GOOGLE_SCRIPT_URL;
      return GOOGLE_SCRIPT_URL_OS;
    }
    throw new Error('GOOGLE_SCRIPT_URL não definida — carregar formulario.js primeiro.');
  }

  // Lista das Assistências Técnicas Autorizadas NXT (extraída do KMZ oficial)
  var ASSISTENCIAS_NXT = [
    'Jackson Técnico - Campinas',
    'Batata Racing - Santo André',
    'Fábio Técnico - Rio Claro',
    'Cláudio Técnico/Eco Scooter - Osasco/Lapa',
    'Matiazo Bikes - Artur Nogueira',
    'Eco Ride - Vila Mariana',
    'Conserta Bikes Araraquara - Gordinho Bikes',
    'SOS Motos e Acessórios - Holambra',
    'Martins Bike - Mogi Mirim',
    'Romano Motos - Itapira',
    'Bike Shop Mazotti - Andradina',
    'E-MOBI - Dracena SP',
    'Robson Técnico - Indaiatuba',
    'Vaner Bikes - Espírito Santo do Pinhal SP',
    'Emerson - Sumaré',
    'Família Motos',
    'Anderson Técnico - Extrema MG',
    'Wanderlei / Ecobike Elétrica - Ipatinga MG',
    'Bertão E-Bikes',
    'Saints Eletric',
    'Pedal Blu Bike Shop - Blumenau',
    'Augusto Técnico / Cheetos Motos - São Francisco do Sul',
    'Conserta Bike - Curitiba / São José dos Pinhais PR',
    'Estação do Patinete / Felipe NXT - Balneário Camboriú',
    'Hercílio André - Jaraguá do Sul',
    'NXT Mafra / Rio Negrinho',
    'Regis / Elos Bike - Caxias do Sul RS',
    'Sami Amin - Florianópolis'
  ];

  var submetendo = false;
  // Cache local dos dados das assistências: { "nome": { endereco, telefone } }
  var cadastroAssistencias = {};

  // Atendimento vinculado (setado por aplicarPreFillOS quando wizard atendimento -> OS)
  var atendimentoVinculadoOS = '';

  window.initAssistencia = function() {
    var container = document.getElementById('assistencia-container');
    if (!container) return;
    container.innerHTML = buildFormHTMLAssistencia();
    setupListenersAssistencia();
    carregarCadastroAssistencias();
    console.log('Formulário Assistência Técnica inicializado');
  };

  // Busca lista do servidor e atualiza dropdown + cache
  function carregarCadastroAssistencias() {
    try {
      var url = resolverUrl() + '?action=listar_assistencias';
      fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(resp) {
          if (!resp || !resp.sucesso || !resp.assistencias) return;
          cadastroAssistencias = {};
          resp.assistencias.forEach(function(a) {
            cadastroAssistencias[a.nome] = { endereco: a.endereco || '', telefone: a.telefone || '' };
          });
          // Rebuild dropdown com lista do servidor (mantém seleção atual se existir)
          var select = document.getElementById('osAssistenciaSelect');
          if (!select) return;
          var atual = select.value;
          var opts = '<option value="">Selecione a assistência...</option>';
          resp.assistencias.forEach(function(a) {
            opts += '<option value="' + escapeHtml(a.nome) + '">' + escapeHtml(a.nome) + '</option>';
          });
          opts += '<option value="__outro__">Outro — informar manualmente</option>';
          select.innerHTML = opts;
          if (atual && cadastroAssistencias[atual]) select.value = atual;
        })
        .catch(function() { /* usa fallback hardcoded */ });
    } catch (e) { /* silencioso */ }
  }

  // --- Build form HTML ---
  function buildFormHTMLAssistencia() {
    var modelsOptions = '<option value="">Selecione...</option>';
    if (typeof CATALOGO_MODELOS !== 'undefined') {
      Object.keys(CATALOGO_MODELOS).forEach(function(id) {
        modelsOptions += '<option value="' + CATALOGO_MODELOS[id].nome + '">' + CATALOGO_MODELOS[id].nome + '</option>';
      });
    }
    modelsOptions += '<option value="Outro">Outro</option>';

    var assistOptions = '<option value="">Selecione a assistência...</option>';
    ASSISTENCIAS_NXT.forEach(function(nome) {
      assistOptions += '<option value="' + nome + '">' + nome + '</option>';
    });
    assistOptions += '<option value="__outro__">Outro — informar manualmente</option>';

    var ufOptions = '<option value="">UF</option>';
    ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].forEach(function(u) {
      ufOptions += '<option value="' + u + '">' + u + '</option>';
    });

    return '' +
      '<form id="osForm" autocomplete="off">' +
        '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">🔧 Abertura de OS — Assistência Técnica</h2>' +

        // SEÇÃO 1 — DADOS DO CLIENTE
        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Dados do Cliente</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="osNomeCliente">Nome completo *</label>' +
              '<input type="text" id="osNomeCliente" required></div>' +
            '<div class="form-group"><label for="osCpfCliente">CPF (opcional)</label>' +
              '<input type="text" id="osCpfCliente" placeholder="000.000.000-00" maxlength="14"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="osTelefoneCliente">Telefone *</label>' +
              '<input type="text" id="osTelefoneCliente" placeholder="(00) 00000-0000" maxlength="15" required>' +
              '<span class="campo-aviso" id="osAvisoTelefone">Telefone inválido</span></div>' +
            '<div class="form-group"><label for="osCepCliente">CEP</label>' +
              '<input type="text" id="osCepCliente" placeholder="00000-000" maxlength="9"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:2 1 320px;"><label for="osEnderecoCliente">Endereço</label>' +
              '<input type="text" id="osEnderecoCliente" placeholder="Rua, Avenida..."></div>' +
            '<div class="form-group"><label for="osNumeroCliente">Número</label>' +
              '<input type="text" id="osNumeroCliente" placeholder="Nº"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="osBairroCliente">Bairro</label>' +
              '<input type="text" id="osBairroCliente"></div>' +
            '<div class="form-group"><label for="osCidadeCliente">Cidade *</label>' +
              '<input type="text" id="osCidadeCliente" required></div>' +
            '<div class="form-group"><label for="osUfCliente">UF</label>' +
              '<select id="osUfCliente">' + ufOptions + '</select></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="osNotaFiscal">Nota fiscal de compra *</label>' +
              '<input type="text" id="osNotaFiscal" required></div>' +
            '<div class="form-group"><label for="osDataCompra">Data da compra</label>' +
              '<input type="date" id="osDataCompra"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="osModelo">Equipamento (modelo) *</label>' +
              '<select id="osModelo" required>' + modelsOptions + '</select></div>' +
            '<div class="form-group"><label for="osNumeroChassi">Nº Chassi / Série</label>' +
              '<input type="text" id="osNumeroChassi"></div>' +
          '</div>' +
        '</div>' +

        // SEÇÃO 2 — ASSISTÊNCIA TÉCNICA
        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Assistência Técnica</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:1 1 100%;"><label for="osAssistenciaSelect">Assistência *</label>' +
              '<select id="osAssistenciaSelect" required>' + assistOptions + '</select></div>' +
          '</div>' +
          '<div class="form-row" id="osAssistOutroRow" style="display:none;">' +
            '<div class="form-group" style="flex:1 1 100%;"><label for="osAssistenciaOutroNome">Nome da assistência *</label>' +
              '<input type="text" id="osAssistenciaOutroNome" placeholder="Informe o nome"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:2 1 320px;"><label for="osAssistenciaEndereco">Endereço da assistência</label>' +
              '<input type="text" id="osAssistenciaEndereco" placeholder="Rua, número, bairro, cidade/UF"></div>' +
            '<div class="form-group"><label for="osAssistenciaTelefone">Telefone da assistência</label>' +
              '<input type="text" id="osAssistenciaTelefone" placeholder="(00) 00000-0000" maxlength="15"></div>' +
          '</div>' +
        '</div>' +

        // SEÇÃO 3 — TIPO DE ATENDIMENTO
        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Tipo de Atendimento</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:1 1 100%;">' +
              '<div class="checkbox-group">' +
                '<label><input type="radio" name="osTipo" value="Garantia" checked> Garantia</label>' +
                '<label><input type="radio" name="osTipo" value="Venda"> Venda</label>' +
              '</div></div>' +
          '</div>' +
        '</div>' +

        // SEÇÃO 4 — PROBLEMA RELATADO
        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Ocorrência</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:1 1 100%;">' +
              '<label for="osProblema">Problema relatado pelo cliente *</label>' +
              '<textarea id="osProblema" rows="4" required></textarea></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:1 1 100%;">' +
              '<label for="osObservacoes">Observações internas (opcional — não sai no PDF)</label>' +
              '<textarea id="osObservacoes" rows="2"></textarea></div>' +
          '</div>' +
        '</div>' +

        '<div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem;">' +
          '<button type="button" class="btn-secundario" id="btnLimparOS">Limpar</button>' +
          '<button type="button" class="btn-primario" id="btnAbrirOS">Abrir OS e gerar PDF ➔</button>' +
        '</div>' +

        '<div id="osFeedback" style="margin-top:1rem;"></div>' +
      '</form>';
  }

  // --- Setup listeners ---
  function setupListenersAssistencia() {
    aplicarMascaraTelefone(document.getElementById('osTelefoneCliente'));
    aplicarMascaraTelefone(document.getElementById('osAssistenciaTelefone'));
    aplicarMascaraCPF(document.getElementById('osCpfCliente'));
    aplicarMascaraCEP(document.getElementById('osCepCliente'));

    // Busca cliente automatica ao sair dos campos CPF/telefone
    var cpfEl = document.getElementById('osCpfCliente');
    if (cpfEl) cpfEl.addEventListener('blur', buscarClienteAutoOS);
    var telEl = document.getElementById('osTelefoneCliente');
    if (telEl) telEl.addEventListener('blur', buscarClienteAutoOS);

    // CEP autofill via ViaCEP
    var cepInput = document.getElementById('osCepCliente');
    if (cepInput) {
      cepInput.addEventListener('blur', function() {
        var cep = this.value.replace(/\D/g, '');
        if (cep.length === 8) buscarCEPAssistencia(cep);
      });
    }

    // Assistência — toggle campo "Outro" + autopreencher endereço/telefone do cadastro
    var assistSelect = document.getElementById('osAssistenciaSelect');
    if (assistSelect) {
      assistSelect.addEventListener('change', function() {
        var outroRow = document.getElementById('osAssistOutroRow');
        var outroInput = document.getElementById('osAssistenciaOutroNome');
        var enderecoInput = document.getElementById('osAssistenciaEndereco');
        var telefoneInput = document.getElementById('osAssistenciaTelefone');

        if (this.value === '__outro__') {
          outroRow.style.display = '';
          outroInput.required = true;
          enderecoInput.value = '';
          telefoneInput.value = '';
          outroInput.focus();
        } else {
          outroRow.style.display = 'none';
          outroInput.required = false;
          outroInput.value = '';

          // Autopreencher com dados cadastrados (editáveis)
          var cadastro = cadastroAssistencias[this.value];
          if (cadastro) {
            enderecoInput.value = cadastro.endereco || '';
            // Aplica máscara no telefone se vier só dígitos
            var tel = cadastro.telefone || '';
            var digitos = tel.replace(/\D/g, '');
            if (digitos.length === 11) tel = '(' + digitos.substr(0,2) + ') ' + digitos.substr(2,5) + '-' + digitos.substr(7);
            else if (digitos.length === 10) tel = '(' + digitos.substr(0,2) + ') ' + digitos.substr(2,4) + '-' + digitos.substr(6);
            telefoneInput.value = tel;
          } else {
            enderecoInput.value = '';
            telefoneInput.value = '';
          }
        }
      });
    }

    var btnLimpar = document.getElementById('btnLimparOS');
    if (btnLimpar) {
      btnLimpar.addEventListener('click', function() {
        if (confirm('Limpar todos os campos?')) {
          document.getElementById('osForm').reset();
          document.getElementById('osAssistOutroRow').style.display = 'none';
        }
      });
    }

    var btnAbrir = document.getElementById('btnAbrirOS');
    if (btnAbrir) btnAbrir.addEventListener('click', submeterOS);
  }

  // --- Máscaras ---
  function aplicarMascaraTelefone(input) {
    if (!input) return;
    input.addEventListener('input', function() {
      var v = this.value.replace(/\D/g, '');
      if (v.length > 11) v = v.substring(0, 11);
      if (v.length > 6) {
        if (v.length === 11) v = v.replace(/^(\d{2})(\d{5})(\d{0,4})$/, '($1) $2-$3');
        else v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
      } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
      }
      this.value = v;
    });
  }

  function aplicarMascaraCPF(input) {
    if (!input) return;
    input.addEventListener('input', function() {
      var v = this.value.replace(/\D/g, '').substring(0, 11);
      if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
      else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
      else if (v.length > 3) v = v.replace(/^(\d{3})(\d{0,3})/, '$1.$2');
      this.value = v;
    });
  }

  function aplicarMascaraCEP(input) {
    if (!input) return;
    input.addEventListener('input', function() {
      var v = this.value.replace(/\D/g, '').substring(0, 8);
      if (v.length > 5) v = v.replace(/^(\d{5})(\d{0,3})/, '$1-$2');
      this.value = v;
    });
  }

  function buscarCEPAssistencia(cep) {
    fetch('https://viacep.com.br/ws/' + cep + '/json/')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.erro) {
          var e = document.getElementById('osEnderecoCliente');
          var b = document.getElementById('osBairroCliente');
          var c = document.getElementById('osCidadeCliente');
          var u = document.getElementById('osUfCliente');
          if (e && !e.value) e.value = data.logradouro || '';
          if (b && !b.value) b.value = data.bairro || '';
          if (c && !c.value) c.value = data.localidade || '';
          if (u && !u.value) u.value = data.uf || '';
          var n = document.getElementById('osNumeroCliente');
          if (n) n.focus();
        }
      })
      .catch(function() { /* silencioso */ });
  }

  // --- Submit ---
  function submeterOS() {
    if (submetendo) return;

    var assistSelVal = document.getElementById('osAssistenciaSelect').value;
    var assistNome;
    if (assistSelVal === '__outro__') {
      assistNome = (document.getElementById('osAssistenciaOutroNome').value || '').trim();
    } else {
      assistNome = assistSelVal;
    }

    var dados = {
      nomeCliente: (document.getElementById('osNomeCliente').value || '').trim(),
      cpfCliente: (document.getElementById('osCpfCliente').value || '').replace(/\D/g, ''),
      telefoneCliente: (document.getElementById('osTelefoneCliente').value || '').replace(/\D/g, ''),
      cepCliente: (document.getElementById('osCepCliente').value || '').replace(/\D/g, ''),
      enderecoCliente: (document.getElementById('osEnderecoCliente').value || '').trim(),
      numeroCliente: (document.getElementById('osNumeroCliente').value || '').trim(),
      bairroCliente: (document.getElementById('osBairroCliente').value || '').trim(),
      cidade: (document.getElementById('osCidadeCliente').value || '').trim(),
      ufCliente: document.getElementById('osUfCliente').value || '',
      modelo: document.getElementById('osModelo').value,
      numeroChassi: (document.getElementById('osNumeroChassi').value || '').trim(),
      dataCompra: document.getElementById('osDataCompra').value,
      notaFiscalCompra: (document.getElementById('osNotaFiscal').value || '').trim(),
      tipo: (document.querySelector('input[name="osTipo"]:checked') || {}).value || '',
      assistencia: assistNome,
      assistenciaEndereco: (document.getElementById('osAssistenciaEndereco').value || '').trim(),
      assistenciaTelefone: (document.getElementById('osAssistenciaTelefone').value || '').replace(/\D/g, ''),
      problemaRelatado: (document.getElementById('osProblema').value || '').trim(),
      observacoes: (document.getElementById('osObservacoes').value || '').trim()
    };

    if (!dados.nomeCliente) return mostrarFeedbackOS('Informe o nome do cliente', 'erro');
    if (!validarTelefoneOS(dados.telefoneCliente)) return mostrarFeedbackOS('Telefone do cliente inválido', 'erro');
    if (dados.cpfCliente && dados.cpfCliente.length !== 11) return mostrarFeedbackOS('CPF inválido (deixe em branco se não tiver)', 'erro');
    if (!dados.cidade) return mostrarFeedbackOS('Informe a cidade', 'erro');
    if (!dados.modelo) return mostrarFeedbackOS('Selecione o equipamento (modelo)', 'erro');
    if (!dados.notaFiscalCompra) return mostrarFeedbackOS('Informe a NF de compra', 'erro');
    if (!dados.tipo) return mostrarFeedbackOS('Selecione o tipo (Garantia/Venda)', 'erro');
    if (!dados.assistencia) return mostrarFeedbackOS('Informe a assistência técnica', 'erro');
    if (!dados.problemaRelatado) return mostrarFeedbackOS('Informe o problema relatado', 'erro');

    if (dados.dataCompra) {
      var dc = new Date(dados.dataCompra);
      var hoje = new Date();
      hoje.setHours(23, 59, 59, 999);
      if (dc > hoje) return mostrarFeedbackOS('Data de compra não pode ser futura', 'erro');
    }

    submetendo = true;
    var btn = document.getElementById('btnAbrirOS');
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    mostrarFeedbackOS('Abrindo OS...', 'info');

    var payload = Object.assign({ action: 'registrar_os', atendimentoId: atendimentoVinculadoOS || '' }, dados);

    fetch(resolverUrl(), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    })
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (resp && resp.sucesso) {
          mostrarFeedbackOS('OS ' + resp.numeroOS + ' aberta com sucesso!', 'sucesso');
          // Atualiza cache local do cadastro — se usuário digitou dados novos, já refletem imediatamente
          if (dados.assistencia && (dados.assistenciaEndereco || dados.assistenciaTelefone)) {
            cadastroAssistencias[dados.assistencia] = {
              endereco: dados.assistenciaEndereco || (cadastroAssistencias[dados.assistencia] || {}).endereco || '',
              telefone: dados.assistenciaTelefone || (cadastroAssistencias[dados.assistencia] || {}).telefone || ''
            };
            // Adiciona ao dropdown se for nova ("Outro")
            var select = document.getElementById('osAssistenciaSelect');
            if (select && !Array.prototype.some.call(select.options, function(o) { return o.value === dados.assistencia; })) {
              var opt = document.createElement('option');
              opt.value = dados.assistencia;
              opt.textContent = dados.assistencia;
              select.insertBefore(opt, select.querySelector('option[value="__outro__"]'));
            }
          }
          mostrarModalPosOS(Object.assign({}, dados, { numeroOS: resp.numeroOS, dataAbertura: new Date() }));
        } else {
          mostrarFeedbackOS('Erro: ' + (resp && resp.erro ? escapeHtml(resp.erro) : 'resposta inválida do servidor'), 'erro');
        }
      })
      .catch(function(err) {
        mostrarFeedbackOS('Erro de rede: ' + err.message, 'erro');
      })
      .finally(function() {
        submetendo = false;
        btn.disabled = false;
        btn.textContent = 'Abrir OS e gerar PDF ➔';
      });
  }

  function validarTelefoneOS(tel) {
    var digitos = (tel || '').replace(/\D/g, '');
    return digitos.length >= 10 && digitos.length <= 11;
  }

  function mostrarFeedbackOS(msg, tipo) {
    var el = document.getElementById('osFeedback');
    if (!el) return;
    var bg;
    if (tipo === 'erro') bg = '#ef4444';
    else if (tipo === 'sucesso') bg = '#22c55e';
    else bg = '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.75rem 1rem;border-radius:6px;text-align:center;font-weight:600;">' + msg + '</div>';
  }

  // --- PDF (mesmo visual do PDF de venda de peças: logo NXT + header dark + lime accent) ---
  function gerarPDFAssistencia(dados) {
    var win = window.open('', '_blank');
    if (!win) {
      mostrarFeedbackOS('Pop-up bloqueado — libere pop-ups para gerar o PDF', 'erro');
      return;
    }

    var baseUrl = window.location.href.replace(/[^\/]*$/, '');
    var dataAberturaStr = formatarDataBR(dados.dataAbertura || new Date());
    var dataCompraStr = dados.dataCompra ? formatarDataBR(dados.dataCompra) : '-';
    var telFmt = formatarTelefone(dados.telefoneCliente);
    var telAssistFmt = formatarTelefone(dados.assistenciaTelefone);
    var cpfFmt = formatarCPF(dados.cpfCliente);
    var cepFmt = formatarCEP(dados.cepCliente);

    var endCompleto = escapeHtml(dados.enderecoCliente || '-');
    if (dados.numeroCliente) endCompleto += ', ' + escapeHtml(dados.numeroCliente);
    if (dados.bairroCliente) endCompleto += ' — ' + escapeHtml(dados.bairroCliente);
    var cidadeUf = escapeHtml(dados.cidade || '') + (dados.ufCliente ? '/' + escapeHtml(dados.ufCliente) : '');

    var assistEnd = dados.assistenciaEndereco ? escapeHtml(dados.assistenciaEndereco) : '<span style="color:#999;">A preencher</span>';
    var assistTel = telAssistFmt !== '-' ? telAssistFmt : '<span style="color:#999;">A preencher</span>';

    var logoImg = '<img src="logo-nxt.png" alt="NXT" style="height:36px;width:auto;">';

    var html = '' +
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
    '<base href="' + baseUrl + '">' +
    '<title>OS ' + escapeHtml(dados.numeroOS) + ' - ' + escapeHtml(dados.nomeCliente) + '</title>' +
    '<style>' +
    '@page { size: A4; margin: 10mm 12mm; }' +
    '* { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
    'body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #222; }' +

    '.bg-dark { background: #1a1a2e !important; box-shadow: inset 0 0 0 9999px #1a1a2e; color: #fff; }' +

    /* Header */
    '.doc-header { padding: 10px 14px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }' +
    '.doc-header .logo-wrap { display: flex; align-items: center; gap: 10px; }' +
    '.doc-header .title { color: #c6ff00; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; margin-top: 4px; }' +
    '.doc-header .info { text-align: right; }' +
    '.doc-header .os-id { font-size: 16px; font-weight: 900; color: #c6ff00; letter-spacing: 1px; }' +
    '.doc-header .info-line { font-size: 10px; color: #ccc; margin-top: 2px; }' +
    '.badge-tipo { display: inline-block; padding: 3px 12px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #000; margin-top: 4px; background: #c6ff00 !important; box-shadow: inset 0 0 0 9999px #c6ff00; }' +

    /* Sections */
    '.section { margin-bottom: 8px; }' +
    '.section-title { padding: 5px 10px; font-weight: 700; font-size: 11px; letter-spacing: 1px; border-radius: 4px 4px 0 0; }' +
    '.section-body { border: 1px solid #ddd; border-top: none; }' +

    /* Tabelas de dados */
    '.data-table { width: 100%; border-collapse: collapse; }' +
    '.data-table td { padding: 5px 9px; border: 1px solid #eee; vertical-align: top; }' +
    '.data-table .lbl { font-size: 7.5px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 1px; }' +
    '.data-table .val { font-size: 11px; color: #111; }' +

    /* Problema relatado */
    '.problema-box { padding: 8px 10px; min-height: 32px; font-size: 11px; color: #222; white-space: pre-wrap; background: #fafafa; }' +

    /* Split Laudo + Peças lado a lado */
    '.split-row { display: flex; gap: 6px; margin-bottom: 8px; }' +
    '.split-col { flex: 1; }' +

    /* Espaços para preenchimento manual */
    '.blank-line { border-bottom: 1px solid #000; min-height: 6mm; display: block; margin: 2mm 0; }' +
    '.laudo-body { padding: 8px 10px; min-height: 46mm; background: #fff; }' +

    /* Peças table */
    '.pecas-tbl { width: 100%; border-collapse: collapse; }' +
    '.pecas-tbl th { background: #f5f5f5; padding: 4px 6px; font-size: 9px; text-transform: uppercase; color: #555; border: 1px solid #ddd; font-weight: 700; text-align: left; }' +
    '.pecas-tbl td { padding: 0 6px; height: 6mm; font-size: 10px; border: 1px solid #ddd; }' +

    /* Assinaturas */
    '.sig-row { display: flex; gap: 14mm; margin-top: 8mm; padding: 0 12mm; }' +
    '.sig-block { flex: 1; text-align: center; }' +
    '.sig-line { border-top: 1px solid #333; padding-top: 2mm; font-size: 9px; color: #555; margin-top: 10mm; }' +

    /* Totais inline */
    '.totais-row { display: flex; gap: 10mm; margin-top: 3mm; padding: 0 2mm; font-size: 10px; }' +
    '.totais-row .lbl { font-weight: 700; color: #444; }' +

    /* Rodapé */
    '.doc-footer { text-align: center; font-size: 8.5px; color: #888; margin-top: 6mm; }' +
    '</style></head><body>' +

    /* HEADER */
    '<div class="doc-header bg-dark">' +
      '<div class="logo-wrap">' + logoImg +
        '<div class="title">ORDEM DE SERVIÇO — ASSISTÊNCIA TÉCNICA</div>' +
      '</div>' +
      '<div class="info">' +
        '<div class="os-id">' + escapeHtml(dados.numeroOS) + '</div>' +
        '<div class="info-line">Abertura: ' + dataAberturaStr + '</div>' +
        '<div><span class="badge-tipo">' + escapeHtml((dados.tipo || '').toUpperCase()) + '</span></div>' +
      '</div>' +
    '</div>' +

    /* 1. CLIENTE (com NFe + equipamento) */
    '<div class="section">' +
      '<div class="section-title bg-dark">CLIENTE</div>' +
      '<div class="section-body">' +
        '<table class="data-table">' +
          '<tr>' +
            '<td style="width:50%;"><span class="lbl">Nome</span><span class="val">' + escapeHtml(dados.nomeCliente) + '</span></td>' +
            '<td style="width:25%;"><span class="lbl">CPF</span><span class="val">' + cpfFmt + '</span></td>' +
            '<td style="width:25%;"><span class="lbl">Telefone</span><span class="val">' + telFmt + '</span></td>' +
          '</tr>' +
          '<tr>' +
            '<td colspan="2"><span class="lbl">Endereço</span><span class="val">' + endCompleto + '</span></td>' +
            '<td><span class="lbl">CEP</span><span class="val">' + cepFmt + '</span></td>' +
          '</tr>' +
          '<tr>' +
            '<td><span class="lbl">Cidade / UF</span><span class="val">' + cidadeUf + '</span></td>' +
            '<td><span class="lbl">NF de compra</span><span class="val">' + escapeHtml(dados.notaFiscalCompra) + '</span></td>' +
            '<td><span class="lbl">Data da compra</span><span class="val">' + dataCompraStr + '</span></td>' +
          '</tr>' +
          '<tr>' +
            '<td><span class="lbl">Equipamento (Modelo)</span><span class="val"><strong>' + escapeHtml(dados.modelo) + '</strong></span></td>' +
            '<td colspan="2"><span class="lbl">Nº Chassi / Série</span><span class="val">' + escapeHtml(dados.numeroChassi || '-') + '</span></td>' +
          '</tr>' +
        '</table>' +
      '</div>' +
    '</div>' +

    /* 2. ASSISTÊNCIA TÉCNICA */
    '<div class="section">' +
      '<div class="section-title bg-dark">ASSISTÊNCIA TÉCNICA</div>' +
      '<div class="section-body">' +
        '<table class="data-table">' +
          '<tr>' +
            '<td style="width:100%;"><span class="lbl">Nome</span><span class="val"><strong>' + escapeHtml(dados.assistencia) + '</strong></span></td>' +
          '</tr>' +
          '<tr>' +
            '<td style="width:70%;"><span class="lbl">Endereço</span><span class="val">' + assistEnd + '</span></td>' +
          '</tr>' +
          '<tr>' +
            '<td><span class="lbl">Telefone</span><span class="val">' + assistTel + '</span></td>' +
          '</tr>' +
        '</table>' +
      '</div>' +
    '</div>' +

    /* 3. PROBLEMA RELATADO PELO CLIENTE */
    '<div class="section">' +
      '<div class="section-title bg-dark">PROBLEMA RELATADO PELO CLIENTE</div>' +
      '<div class="section-body">' +
        '<div class="problema-box">' + escapeHtml(dados.problemaRelatado) + '</div>' +
      '</div>' +
    '</div>' +

    /* 4. LAUDO TÉCNICO + PEÇAS (lado a lado) */
    '<div class="split-row">' +
      '<div class="split-col section">' +
        '<div class="section-title bg-dark">LAUDO TÉCNICO (preencher)</div>' +
        '<div class="section-body">' +
          '<div class="laudo-body">' +
            '<span class="blank-line"></span>' +
            '<span class="blank-line"></span>' +
            '<span class="blank-line"></span>' +
            '<span class="blank-line"></span>' +
            '<span class="blank-line"></span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="split-col section">' +
        '<div class="section-title bg-dark">PEÇAS UTILIZADAS</div>' +
        '<div class="section-body">' +
          '<table class="pecas-tbl">' +
            '<thead><tr><th style="width:60%;">Descrição</th><th style="width:14%;">Qtd</th><th style="width:26%;">Código</th></tr></thead>' +
            '<tbody>' +
              '<tr><td></td><td></td><td></td></tr>' +
              '<tr><td></td><td></td><td></td></tr>' +
              '<tr><td></td><td></td><td></td></tr>' +
              '<tr><td></td><td></td><td></td></tr>' +
              '<tr><td></td><td></td><td></td></tr>' +
              '<tr><td></td><td></td><td></td></tr>' +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
    '</div>' +

    /* Totais / conclusão */
    '<div class="totais-row">' +
      '<div><span class="lbl">Data conclusão:</span> ___/___/______</div>' +
      '<div><span class="lbl">Mão de obra:</span> R$ ____________</div>' +
      '<div><span class="lbl">Total:</span> R$ ____________</div>' +
    '</div>' +

    /* Assinaturas */
    '<div class="sig-row">' +
      '<div class="sig-block"><div class="sig-line">Assinatura Técnico</div></div>' +
      '<div class="sig-block"><div class="sig-line">Assinatura Cliente</div></div>' +
    '</div>' +

    blocoQrOS(dados.numeroOS) +

    '<div class="doc-footer">NXT Mobilidade Elétrica &bull; OS ' + escapeHtml(dados.numeroOS) + ' &bull; Gerado em ' + dataAberturaStr + '</div>' +

    '</body></html>';

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function() { try { win.print(); } catch(e){} }, 500);
  }

  // Bloco de QR + link de acompanhamento publico da OS (plano 6 Task 7).
  // O QR e gerado na janela pai (qrcode.min.js) e embutido como data URL.
  function blocoQrOS(numeroOS) {
    var link = 'https://nxtlojas-hash.github.io/sac-pecas/?view=acompanhar&os=' + encodeURIComponent(numeroOS);
    var qr = (typeof gerarQrDataUrl === 'function') ? gerarQrDataUrl(link, 130) : '';
    if (!qr) return '';
    return '<div style="display:flex;align-items:center;gap:12px;border:1px solid #ddd;border-radius:6px;padding:8px 12px;margin:8px 0;background:#fafafa;page-break-inside:avoid;">' +
        '<img src="' + qr + '" alt="QR de acompanhamento" style="width:88px;height:88px;flex:0 0 88px;">' +
        '<div style="font-size:10px;color:#333;line-height:1.5;">' +
          '<strong style="color:#111;font-size:11px;">Acompanhe sua OS pelo celular</strong><br>' +
          'Aponte a c&acirc;mera para o QR Code ou acesse:<br>' +
          '<span style="color:#0066cc;word-break:break-all;">' + escapeHtml(link) + '</span>' +
        '</div>' +
      '</div>';
  }

  // --- Formatadores ---
  function formatarDataBR(d) {
    if (!d) return '-';
    var dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    var dd = String(dt.getDate()).padStart(2, '0');
    var mm = String(dt.getMonth() + 1).padStart(2, '0');
    return dd + '/' + mm + '/' + dt.getFullYear();
  }

  function formatarTelefone(tel) {
    var d = (tel || '').replace(/\D/g, '');
    if (d.length === 11) return '(' + d.substr(0,2) + ') ' + d.substr(2,5) + '-' + d.substr(7);
    if (d.length === 10) return '(' + d.substr(0,2) + ') ' + d.substr(2,4) + '-' + d.substr(6);
    return tel ? tel : '-';
  }

  function formatarCPF(cpf) {
    var d = (cpf || '').replace(/\D/g, '');
    if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return '-';
  }

  function formatarCEP(cep) {
    var d = (cep || '').replace(/\D/g, '');
    if (d.length === 8) return d.replace(/^(\d{5})(\d{3})$/, '$1-$2');
    return '-';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // --- Aplica pre-fill quando wizard de atendimento navega pra ca ---
  window.aplicarPreFillOS = function(preFill) {
    if (!preFill || !preFill.cliente) return;
    var c = preFill.cliente;
    atendimentoVinculadoOS = preFill.atendimentoId || '';

    // Preenche campos do cliente
    setIfOS('osNomeCliente', c.nome);
    setIfOS('osTelefoneCliente', c.telefone);
    setIfOS('osCpfCliente', c.cpfCnpj);
    setIfOS('osNotaFiscal', c.notaFiscal);
    if (c.modelo) {
      var sel = document.getElementById('osModelo');
      if (sel) {
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === c.modelo || sel.options[i].textContent === c.modelo) {
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
    }

    // Moto vinculada no wizard: chassi + data de compra direto na OS
    if (preFill.moto) {
      setIfOS('osNumeroChassi', preFill.moto.chassi);
      setIfOS('osDataCompra', preFill.moto.dataCompra);
    }

    // Banner do vinculo
    var existente = document.getElementById('bannerAtVinculadoOS');
    if (existente) existente.remove();
    if (atendimentoVinculadoOS) {
      var banner = document.createElement('div');
      banner.id = 'bannerAtVinculadoOS';
      banner.style.cssText = 'background:#c6ff0022;border-left:3px solid #c6ff00;padding:0.75rem 1rem;margin-bottom:1rem;border-radius:6px;color:#e8e8f0;font-size:0.9rem;';
      banner.innerHTML = '<strong style="color:#c6ff00;">&#128279; Vinculado ao atendimento ' + atendimentoVinculadoOS + '</strong><br>' +
        '<span style="color:#9a9a9a;">Cliente j&aacute; preenchido. Complete os dados da OS — ser&aacute; vinculada automaticamente.</span>';
      var container = document.getElementById('assistencia-container');
      if (container) container.insertBefore(banner, container.firstChild);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function setIfOS(id, val) {
    if (!val) return;
    var el = document.getElementById(id);
    if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }
  }

  // --- Busca cliente automatica em OS ---
  var ultimaBuscaAutoOS = '';

  function buscarClienteAutoOS() {
    if (typeof GOOGLE_SCRIPT_URL === 'undefined') return;

    var cpf = (document.getElementById('osCpfCliente') || {}).value || '';
    var tel = (document.getElementById('osTelefoneCliente') || {}).value || '';
    var cpfDigitos = cpf.replace(/\D/g, '');
    var telDigitos = tel.replace(/\D/g, '');

    var params = [];
    if (cpfDigitos.length === 11 || cpfDigitos.length === 14) {
      params.push('cpf=' + encodeURIComponent(cpfDigitos));
    } else if (telDigitos.length === 10 || telDigitos.length === 11) {
      params.push('telefone=' + encodeURIComponent(telDigitos));
    } else {
      return;
    }

    var chave = params.join('&');
    if (chave === ultimaBuscaAutoOS) return;
    ultimaBuscaAutoOS = chave;

    fetch(GOOGLE_SCRIPT_URL + '?action=buscar_cliente_consolidado&' + chave)
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (!resp || !resp.sucesso || !resp.clientes || resp.clientes.length === 0) {
          removerBannerClienteAutoOS();
          return;
        }
        mostrarBannerClienteAutoOS(resp.clientes[0]);
      })
      .catch(function() { /* silencioso */ });
  }

  function removerBannerClienteAutoOS() {
    var existente = document.getElementById('bannerClienteAutoOS');
    if (existente) existente.remove();
  }

  function mostrarBannerClienteAutoOS(cliente) {
    removerBannerClienteAutoOS();

    var atendimentos = (cliente.eventos || []).filter(function(e) { return e.tipo === 'atendimento'; });
    var abertos = atendimentos.filter(function(a) { return a.status !== 'Fechado' && a.status !== 'Resolvido'; });
    var totalAt = atendimentos.length;

    var corBg = abertos.length > 0 ? '#f59e0b22' : '#3b82f622';
    var corBorda = abertos.length > 0 ? '#f59e0b' : '#3b82f6';
    var corTitulo = abertos.length > 0 ? '#f59e0b' : '#3b82f6';
    var icone = abertos.length > 0 ? '&#9888;' : '&#8505;';

    var subtitulo = '';
    if (abertos.length > 0) subtitulo = '<strong>' + abertos.length + ' atendimento(s) em aberto</strong> &bull; ' + totalAt + ' total';
    else if (totalAt > 0) subtitulo = totalAt + ' atendimento(s) anteriores (todos fechados)';
    else subtitulo = 'Cliente conhecido, sem atendimentos anteriores';

    var listaHtml = '';
    if (totalAt > 0) {
      listaHtml = '<div style="margin-top:0.5rem;display:flex;flex-direction:column;gap:0.3rem;">' +
        atendimentos.slice(0, 5).map(function(a) {
          var statusCor = (a.status === 'Aberto' || a.status === 'Em andamento') ? '#f59e0b' : (a.status === 'Resolvido' ? '#22c55e' : '#9a9a9a');
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0.6rem;background:#1c1c1c;border-radius:4px;font-size:0.85rem;">' +
            '<span><strong style="color:#c6ff00;">' + a.id + '</strong> &bull; ' +
            '<span style="color:' + statusCor + ';">' + (a.status || '—') + '</span> &bull; ' +
            '<span style="color:#9a9a9a;">' + (a.categoria || '') + '</span></span>' +
            '<button type="button" data-at-id="' + a.id + '" class="banner-vincular-at-os" style="background:#c6ff00;color:#0f0f1a;border:none;padding:0.2rem 0.6rem;border-radius:4px;font-size:0.75rem;cursor:pointer;font-weight:600;">Vincular a este</button>' +
          '</div>';
        }).join('') +
        (atendimentos.length > 5 ? '<div style="font-size:0.75rem;color:#9a9a9a;text-align:center;">+ ' + (atendimentos.length - 5) + ' mais</div>' : '') +
      '</div>';
    }

    var banner = document.createElement('div');
    banner.id = 'bannerClienteAutoOS';
    banner.style.cssText = 'background:' + corBg + ';border-left:3px solid ' + corBorda + ';padding:0.75rem 1rem;margin-bottom:1rem;border-radius:6px;color:#e8e8f0;font-size:0.9rem;';
    banner.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">' +
        '<div>' +
          '<strong style="color:' + corTitulo + ';">' + icone + ' Cliente identificado: ' + escapeHtml(cliente.nome || '') + '</strong><br>' +
          '<span style="color:#9a9a9a;">' + subtitulo + '</span>' +
        '</div>' +
        '<button type="button" id="bannerClienteAutoOSFechar" style="background:transparent;border:none;color:#9a9a9a;cursor:pointer;font-size:1.1rem;line-height:1;">&times;</button>' +
      '</div>' +
      listaHtml;

    var container = document.getElementById('assistencia-container');
    if (container) container.insertBefore(banner, container.firstChild);

    document.getElementById('bannerClienteAutoOSFechar').addEventListener('click', removerBannerClienteAutoOS);
    banner.querySelectorAll('.banner-vincular-at-os').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var atId = btn.dataset.atId;
        atendimentoVinculadoOS = atId;
        removerBannerClienteAutoOS();
        var existenteVinc = document.getElementById('bannerAtVinculadoOS');
        if (existenteVinc) existenteVinc.remove();
        var b = document.createElement('div');
        b.id = 'bannerAtVinculadoOS';
        b.style.cssText = 'background:#c6ff0022;border-left:3px solid #c6ff00;padding:0.75rem 1rem;margin-bottom:1rem;border-radius:6px;color:#e8e8f0;font-size:0.9rem;';
        b.innerHTML = '<strong style="color:#c6ff00;">&#128279; Vinculado ao atendimento ' + atId + '</strong><br>' +
          '<span style="color:#9a9a9a;">Esta OS ser&aacute; vinculada automaticamente.</span>';
        if (container) container.insertBefore(b, container.firstChild);
      });
    });
  }

  // ============================================================
  //  PDF VERSAO CLIENTE — simplificado, sem campos internos
  // ============================================================
  function gerarPDFAssistenciaCliente(dados) {
    var win = window.open('', '_blank');
    if (!win) {
      mostrarFeedbackOS('Pop-up bloqueado — libere pop-ups para gerar o PDF', 'erro');
      return;
    }

    var baseUrl = window.location.href.replace(/[^\/]*$/, '');
    var dataAberturaStr = formatarDataBR(dados.dataAbertura || new Date());
    var telFmt = formatarTelefone(dados.telefoneCliente);
    var telAssistFmt = formatarTelefone(dados.assistenciaTelefone);

    var logoImg = '<img src="logo-nxt.png" alt="NXT" style="height:36px;width:auto;">';
    var assistEnd = dados.assistenciaEndereco ? escapeHtml(dados.assistenciaEndereco) : '<span style="color:#999;">A confirmar</span>';
    var assistTel = telAssistFmt !== '-' ? telAssistFmt : '<span style="color:#999;">A confirmar</span>';

    var html = '' +
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
    '<base href="' + baseUrl + '">' +
    '<title>OS ' + escapeHtml(dados.numeroOS) + ' - ' + escapeHtml(dados.nomeCliente) + '</title>' +
    '<style>' +
    '@page { size: A4; margin: 14mm 14mm; }' +
    '* { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
    'body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #222; }' +
    '.bg-dark { background: #1a1a2e !important; box-shadow: inset 0 0 0 9999px #1a1a2e; color: #fff; }' +
    '.doc-header { padding: 12px 16px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }' +
    '.doc-header .logo-wrap { display: flex; align-items: center; gap: 12px; }' +
    '.doc-header .title { color: #c6ff00; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; margin-top: 4px; }' +
    '.doc-header .info { text-align: right; }' +
    '.doc-header .os-id { font-size: 18px; font-weight: 900; color: #c6ff00; letter-spacing: 1px; }' +
    '.doc-header .info-line { font-size: 10px; color: #ccc; margin-top: 2px; }' +
    '.badge-tipo { display: inline-block; padding: 3px 12px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #000; margin-top: 4px; background: #c6ff00 !important; box-shadow: inset 0 0 0 9999px #c6ff00; }' +
    '.section { margin-bottom: 12px; }' +
    '.section-title { padding: 6px 12px; font-weight: 700; font-size: 11px; letter-spacing: 1px; border-radius: 4px 4px 0 0; }' +
    '.section-body { border: 1px solid #ddd; border-top: none; padding: 10px 12px; }' +
    '.data-table { width: 100%; border-collapse: collapse; }' +
    '.data-table td { padding: 6px 10px; border: 1px solid #eee; vertical-align: top; }' +
    '.data-table .lbl { font-size: 8px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px; }' +
    '.data-table .val { font-size: 12px; color: #111; }' +
    '.problema-box { padding: 10px 12px; font-size: 12px; color: #222; white-space: pre-wrap; background: #fafafa; border-left: 3px solid #c6ff00; }' +
    '.assist-box { padding: 12px; background: #f9fafb; border-left: 3px solid #1a1a2e; }' +
    '.assist-box .nome { font-size: 14px; font-weight: 700; color: #111; margin-bottom: 6px; }' +
    '.assist-box .linha { font-size: 11px; color: #444; margin-top: 3px; }' +
    '.instructions { background: #fef3c7; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #78350f; line-height: 1.5; }' +
    '.instructions strong { color: #78350f; }' +
    '.doc-footer { text-align: center; font-size: 9px; color: #888; margin-top: 18mm; padding-top: 6mm; border-top: 1px solid #ddd; }' +
    '</style></head><body>' +
    '<div class="doc-header bg-dark">' +
      '<div class="logo-wrap">' + logoImg +
        '<div class="title">ORDEM DE SERVI&Ccedil;O &mdash; VIA DO CLIENTE</div>' +
      '</div>' +
      '<div class="info">' +
        '<div class="os-id">' + escapeHtml(dados.numeroOS) + '</div>' +
        '<div class="info-line">Abertura: ' + dataAberturaStr + '</div>' +
        '<div><span class="badge-tipo">' + escapeHtml((dados.tipo || '').toUpperCase()) + '</span></div>' +
      '</div>' +
    '</div>' +

    '<div class="section">' +
      '<div class="section-title bg-dark">DADOS DO CLIENTE</div>' +
      '<div class="section-body" style="padding:0;">' +
        '<table class="data-table">' +
          '<tr>' +
            '<td style="width:55%;"><span class="lbl">Nome</span><span class="val">' + escapeHtml(dados.nomeCliente) + '</span></td>' +
            '<td><span class="lbl">Telefone</span><span class="val">' + telFmt + '</span></td>' +
          '</tr>' +
        '</table>' +
      '</div>' +
    '</div>' +

    '<div class="section">' +
      '<div class="section-title bg-dark">SEU EQUIPAMENTO</div>' +
      '<div class="section-body" style="padding:0;">' +
        '<table class="data-table">' +
          '<tr>' +
            '<td style="width:55%;"><span class="lbl">Modelo</span><span class="val">' + escapeHtml(dados.modelo || '-') + '</span></td>' +
            '<td><span class="lbl">N&ordm; Chassi / S&eacute;rie</span><span class="val">' + escapeHtml(dados.numeroChassi || '-') + '</span></td>' +
          '</tr>' +
          '<tr>' +
            '<td><span class="lbl">Nota Fiscal</span><span class="val">' + escapeHtml(dados.notaFiscal || '-') + '</span></td>' +
            '<td><span class="lbl">Data da Compra</span><span class="val">' + (dados.dataCompra ? formatarDataBR(dados.dataCompra) : '-') + '</span></td>' +
          '</tr>' +
        '</table>' +
      '</div>' +
    '</div>' +

    '<div class="section">' +
      '<div class="section-title bg-dark">PROBLEMA RELATADO</div>' +
      '<div class="problema-box">' + escapeHtml(dados.problema || '-') + '</div>' +
    '</div>' +

    '<div class="section">' +
      '<div class="section-title bg-dark">ASSIST&Ecirc;NCIA RESPONS&Aacute;VEL</div>' +
      '<div class="assist-box">' +
        '<div class="nome">' + escapeHtml(dados.assistencia || '-') + '</div>' +
        '<div class="linha"><strong>Endere&ccedil;o:</strong> ' + assistEnd + '</div>' +
        '<div class="linha"><strong>Telefone:</strong> ' + assistTel + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="section">' +
      '<div class="section-title bg-dark">PR&Oacute;XIMOS PASSOS</div>' +
      '<div class="instructions">' +
        '<strong>1.</strong> Leve o equipamento at&eacute; a assist&ecirc;ncia respons&aacute;vel ou aguarde contato dela.<br>' +
        '<strong>2.</strong> Apresente este documento (n&ordm; <strong>' + escapeHtml(dados.numeroOS) + '</strong>) na assist&ecirc;ncia.<br>' +
        '<strong>3.</strong> A assist&ecirc;ncia avaliar&aacute; o equipamento e entrar&aacute; em contato com o la&uacute;do t&eacute;cnico.<br>' +
        '<strong>4.</strong> Em caso de d&uacute;vidas, fale com a NXT pelo SAC.' +
      '</div>' +
    '</div>' +

    blocoQrOS(dados.numeroOS) +

    '<div class="doc-footer">NXT Mobilidade El&eacute;trica &bull; OS ' + escapeHtml(dados.numeroOS) + ' &bull; Gerado em ' + dataAberturaStr + '</div>' +

    '</body></html>';

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function() { try { win.print(); } catch(e){} }, 500);
  }

  // ============================================================
  //  Mensagens de WhatsApp (Cliente / Assistencia)
  // ============================================================
  function enviarWhatsAppClienteOS(dados) {
    var tel = (dados.telefoneCliente || '').replace(/\D/g, '');
    if (!tel || tel.length < 10) {
      mostrarFeedbackOS('Telefone do cliente inválido', 'erro');
      return;
    }
    var primeiroNome = (dados.nomeCliente || '').split(' ')[0] || 'Cliente';
    var dataStr = formatarDataBR(dados.dataAbertura || new Date());
    var assistEnd = dados.assistenciaEndereco || 'A confirmar';
    var assistTel = formatarTelefone(dados.assistenciaTelefone);

    var msg = 'Olá ' + primeiroNome + '!\n\n' +
      'Sua Ordem de Serviço foi aberta na NXT.\n\n' +
      '━━━━━━━━━━━━━━━━━\n' +
      '*ORDEM DE SERVIÇO - NXT*\n' +
      '━━━━━━━━━━━━━━━━━\n\n' +
      '*Número:* ' + (dados.numeroOS || '-') + '\n' +
      '*Data abertura:* ' + dataStr + '\n' +
      '*Tipo:* ' + (dados.tipo || '-') + '\n\n' +
      '*SEU EQUIPAMENTO*\n' +
      'Modelo: ' + (dados.modelo || '-') + '\n' +
      'Chassi: ' + (dados.numeroChassi || 'N/A') + '\n\n' +
      '*PROBLEMA RELATADO*\n' +
      '_' + (dados.problema || '-') + '_\n\n' +
      '*ASSISTÊNCIA RESPONSÁVEL*\n' +
      (dados.assistencia || '-') + '\n' +
      '📍 ' + assistEnd + '\n' +
      '📞 ' + assistTel + '\n\n' +
      '⚠️ *Próximos passos:*\n' +
      '1. Leve o equipamento até a assistência ou aguarde contato dela.\n' +
      '2. Apresente o número da OS (' + (dados.numeroOS || '') + ').\n' +
      '3. A assistência fará o laúdo e entrará em contato.\n\n' +
      '_NXT Lojas - Mobilidade Elétrica_\n' +
      'www.nxt.eco.br';

    var url = 'https://wa.me/55' + tel + '?text=' + encodeURIComponent(msg);
    window.open(url, '_blank');
    mostrarFeedbackOS('WhatsApp aberto com a mensagem do cliente', 'sucesso');
  }

  function enviarWhatsAppAssistenciaOS(dados) {
    var tel = (dados.assistenciaTelefone || '').replace(/\D/g, '');
    if (!tel || tel.length < 10) {
      mostrarFeedbackOS('Telefone da assistência não cadastrado', 'erro');
      return;
    }
    var dataStr = formatarDataBR(dados.dataAbertura || new Date());
    var endCliente = (dados.enderecoCliente || '') +
      (dados.numeroCliente ? ', ' + dados.numeroCliente : '') +
      (dados.bairroCliente ? ' - ' + dados.bairroCliente : '');
    var cidadeUf = (dados.cidade || '') + (dados.ufCliente ? '/' + dados.ufCliente : '');

    var msg = '*NOVA OS - NXT*\n\n' +
      '━━━━━━━━━━━━━━━━━\n\n' +
      '*Número:* ' + (dados.numeroOS || '-') + '\n' +
      '*Data abertura:* ' + dataStr + '\n' +
      '*Tipo:* ' + (dados.tipo || '-') + '\n\n' +
      '*CLIENTE*\n' +
      'Nome: ' + (dados.nomeCliente || '-') + '\n' +
      (dados.cpfCliente ? 'CPF: ' + formatarCPF(dados.cpfCliente) + '\n' : '') +
      'Telefone: ' + formatarTelefone(dados.telefoneCliente) + '\n' +
      (endCliente ? 'Endereço: ' + endCliente + '\n' : '') +
      (cidadeUf ? cidadeUf + (dados.cepCliente ? ' - CEP ' + formatarCEP(dados.cepCliente) : '') + '\n' : '') +
      '\n*EQUIPAMENTO*\n' +
      'Modelo: ' + (dados.modelo || '-') + '\n' +
      'Chassi: ' + (dados.numeroChassi || 'N/A') + '\n' +
      'NF compra: ' + (dados.notaFiscal || '-') + '\n' +
      (dados.dataCompra ? 'Data compra: ' + formatarDataBR(dados.dataCompra) + '\n' : '') +
      '\n*PROBLEMA RELATADO*\n' +
      '_' + (dados.problema || '-') + '_\n\n' +
      '━━━━━━━━━━━━━━━━━\n' +
      'Solicitamos avaliação e contato direto com o cliente.\n\n' +
      '_NXT Lojas - SAC_';

    var url = 'https://wa.me/55' + tel + '?text=' + encodeURIComponent(msg);
    window.open(url, '_blank');
    mostrarFeedbackOS('WhatsApp aberto com a mensagem da assistência', 'sucesso');
  }

  // ============================================================
  //  Modal pos-OS com 4 opções de envio
  // ============================================================
  function mostrarModalPosOS(dados) {
    var modal = document.getElementById('osModalPos');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'osModalPos';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem;';

    var telCliente = formatarTelefone(dados.telefoneCliente);
    var telAssist = formatarTelefone(dados.assistenciaTelefone);
    var primeiroNome = ((dados.nomeCliente || '').split(' ')[0]) || 'Cliente';
    var assistDisabled = telAssist === '-';

    modal.innerHTML = '' +
      '<div style="background:#fff;border-radius:8px;max-width:520px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 40px rgba(0,0,0,0.3);">' +
        '<div style="background:#1a1a2e;color:#fff;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;border-radius:8px 8px 0 0;">' +
          '<div>' +
            '<div style="font-size:11px;letter-spacing:1.5px;color:#c6ff00;font-weight:700;">OS ABERTA COM SUCESSO</div>' +
            '<div style="font-size:20px;font-weight:900;margin-top:2px;letter-spacing:1px;">' + escapeHtml(dados.numeroOS) + '</div>' +
          '</div>' +
          '<button id="osModalClose" style="background:transparent;border:none;color:#fff;font-size:28px;cursor:pointer;line-height:1;padding:0 0.25rem;">&times;</button>' +
        '</div>' +
        '<div style="padding:1.25rem;">' +
          '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:#dcfce7;border-radius:6px;color:#166534;font-size:13px;font-weight:600;">' +
            '<span style="font-size:16px;">&#10003;</span> OS registrada no sistema NXT' +
          '</div>' +

          '<div style="margin-top:1rem;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">' +
            '<div style="background:#f9fafb;padding:0.65rem 0.9rem;font-weight:700;font-size:11px;color:#374151;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">ENVIO AO CLIENTE</div>' +
            '<div style="padding:0.9rem;">' +
              '<div style="font-size:13px;color:#666;margin-bottom:0.65rem;">' +
                '<strong style="color:#111;">' + escapeHtml(primeiroNome) + '</strong> &bull; ' + telCliente +
              '</div>' +
              '<div style="display:flex;gap:0.5rem;">' +
                '<button id="osBtnWaCliente" style="flex:1;padding:0.7rem;background:#25d366;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">&#128241; WhatsApp</button>' +
                '<button id="osBtnPdfCliente" style="flex:1;padding:0.7rem;background:#1a1a2e;color:#c6ff00;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">&#128190; Salvar PDF</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div style="margin-top:0.75rem;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">' +
            '<div style="background:#f9fafb;padding:0.65rem 0.9rem;font-weight:700;font-size:11px;color:#374151;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">ENVIO &Agrave; ASSIST&Ecirc;NCIA</div>' +
            '<div style="padding:0.9rem;">' +
              '<div style="font-size:13px;color:#666;margin-bottom:0.65rem;">' +
                '<strong style="color:#111;">' + escapeHtml(dados.assistencia || '-') + '</strong>' +
                (telAssist !== '-' ? ' &bull; ' + telAssist : ' &bull; <em style="color:#999;">sem telefone</em>') +
              '</div>' +
              '<div style="display:flex;gap:0.5rem;">' +
                '<button id="osBtnWaAssist" ' + (assistDisabled ? 'disabled title="Telefone da assistencia nao cadastrado"' : '') +
                  ' style="flex:1;padding:0.7rem;background:' + (assistDisabled ? '#9ca3af' : '#25d366') + ';color:#fff;border:none;border-radius:6px;font-weight:600;cursor:' + (assistDisabled ? 'not-allowed' : 'pointer') + ';font-size:13px;">&#128241; WhatsApp</button>' +
                '<button id="osBtnPdfAssist" style="flex:1;padding:0.7rem;background:#1a1a2e;color:#c6ff00;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">&#128190; Salvar PDF</button>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div style="margin-top:1rem;text-align:center;font-size:11px;color:#999;">Use quantas op&ccedil;&otilde;es precisar. Feche quando terminar.</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('osModalClose').addEventListener('click', function() { modal.remove(); });
    document.getElementById('osBtnWaCliente').addEventListener('click', function() { enviarWhatsAppClienteOS(dados); });
    document.getElementById('osBtnPdfCliente').addEventListener('click', function() { gerarPDFAssistenciaCliente(dados); });
    if (!assistDisabled) {
      document.getElementById('osBtnWaAssist').addEventListener('click', function() { enviarWhatsAppAssistenciaOS(dados); });
    }
    document.getElementById('osBtnPdfAssist').addEventListener('click', function() { gerarPDFAssistencia(dados); });
  }
})();
