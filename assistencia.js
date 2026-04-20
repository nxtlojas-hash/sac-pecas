/* ===== NXT PECAS V2.1 - Formulário Assistência Técnica ===== */

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

  var submetendo = false;

  window.initAssistencia = function() {
    var container = document.getElementById('assistencia-container');
    if (!container) return;
    container.innerHTML = buildFormHTMLAssistencia();
    setupListenersAssistencia();
    console.log('Formulário Assistência Técnica inicializado');
  };

  // --- Build form HTML ---
  function buildFormHTMLAssistencia() {
    var modelsOptions = '<option value="">Selecione...</option>';
    if (typeof CATALOGO_MODELOS !== 'undefined') {
      Object.keys(CATALOGO_MODELOS).forEach(function(id) {
        modelsOptions += '<option value="' + CATALOGO_MODELOS[id].nome + '">' + CATALOGO_MODELOS[id].nome + '</option>';
      });
    }
    modelsOptions += '<option value="Outro">Outro</option>';

    return '' +
      '<form id="osForm" autocomplete="off">' +
        '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">\uD83D\uDD27 Abertura de OS — Assistência Técnica</h2>' +

        // DADOS DO CLIENTE
        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Dados do Cliente</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="osNomeCliente">Nome completo *</label>' +
              '<input type="text" id="osNomeCliente" required></div>' +
            '<div class="form-group"><label for="osTelefoneCliente">Telefone *</label>' +
              '<input type="text" id="osTelefoneCliente" placeholder="(00) 00000-0000" maxlength="15" required>' +
              '<span class="campo-aviso" id="osAvisoTelefone">Telefone inválido</span></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="osCidade">Cidade *</label>' +
              '<input type="text" id="osCidade" required></div>' +
          '</div>' +
        '</div>' +

        // DADOS DA MOTO
        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Dados da Moto</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="osModelo">Modelo *</label>' +
              '<select id="osModelo" required>' + modelsOptions + '</select></div>' +
            '<div class="form-group"><label for="osNumeroChassi">Nº Chassi / Série</label>' +
              '<input type="text" id="osNumeroChassi"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label for="osDataCompra">Data da compra</label>' +
              '<input type="date" id="osDataCompra"></div>' +
            '<div class="form-group"><label for="osNotaFiscal">Nota fiscal de compra *</label>' +
              '<input type="text" id="osNotaFiscal" required></div>' +
          '</div>' +
        '</div>' +

        // ATENDIMENTO
        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Atendimento</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>Tipo *</label>' +
              '<div class="checkbox-group">' +
                '<label><input type="radio" name="osTipo" value="Garantia" checked> Garantia</label>' +
                '<label><input type="radio" name="osTipo" value="Venda"> Venda</label>' +
              '</div></div>' +
            '<div class="form-group"><label for="osAssistencia">Assistência técnica *</label>' +
              '<input type="text" id="osAssistencia" required></div>' +
          '</div>' +
        '</div>' +

        // OCORRENCIA
        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Ocorrência</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:1 1 100%;">' +
              '<label for="osProblema">Problema relatado pelo cliente *</label>' +
              '<textarea id="osProblema" rows="4" required></textarea></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:1 1 100%;">' +
              '<label for="osObservacoes">Observações internas (opcional)</label>' +
              '<textarea id="osObservacoes" rows="2"></textarea></div>' +
          '</div>' +
        '</div>' +

        '<div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem;">' +
          '<button type="button" class="btn-secundario" id="btnLimparOS">Limpar</button>' +
          '<button type="button" class="btn-primario" id="btnAbrirOS">Abrir OS e gerar PDF \u2794</button>' +
        '</div>' +

        '<div id="osFeedback" style="margin-top:1rem;"></div>' +
      '</form>';
  }

  // --- Setup listeners ---
  function setupListenersAssistencia() {
    // Máscara telefone (copiada do formulario.js — sem import para manter isolamento)
    var telInput = document.getElementById('osTelefoneCliente');
    if (telInput) {
      telInput.addEventListener('input', function() {
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

    var btnLimpar = document.getElementById('btnLimparOS');
    if (btnLimpar) {
      btnLimpar.addEventListener('click', function() {
        if (confirm('Limpar todos os campos?')) {
          document.getElementById('osForm').reset();
        }
      });
    }

    var btnAbrir = document.getElementById('btnAbrirOS');
    if (btnAbrir) {
      btnAbrir.addEventListener('click', submeterOS);
    }
  }

  // --- Submit ---
  function submeterOS() {
    if (submetendo) return;

    var dados = {
      nomeCliente: (document.getElementById('osNomeCliente').value || '').trim(),
      telefoneCliente: (document.getElementById('osTelefoneCliente').value || '').replace(/\D/g, ''),
      cidade: (document.getElementById('osCidade').value || '').trim(),
      modelo: document.getElementById('osModelo').value,
      numeroChassi: (document.getElementById('osNumeroChassi').value || '').trim(),
      dataCompra: document.getElementById('osDataCompra').value,
      notaFiscalCompra: (document.getElementById('osNotaFiscal').value || '').trim(),
      tipo: (document.querySelector('input[name="osTipo"]:checked') || {}).value || '',
      assistencia: (document.getElementById('osAssistencia').value || '').trim(),
      problemaRelatado: (document.getElementById('osProblema').value || '').trim(),
      observacoes: (document.getElementById('osObservacoes').value || '').trim()
    };

    if (!dados.nomeCliente) return mostrarFeedbackOS('Informe o nome do cliente', 'erro');
    if (!validarTelefoneOS(dados.telefoneCliente)) return mostrarFeedbackOS('Telefone inválido', 'erro');
    if (!dados.cidade) return mostrarFeedbackOS('Informe a cidade', 'erro');
    if (!dados.modelo) return mostrarFeedbackOS('Selecione o modelo', 'erro');
    if (!dados.notaFiscalCompra) return mostrarFeedbackOS('Informe a NF de compra', 'erro');
    if (!dados.tipo) return mostrarFeedbackOS('Selecione o tipo (Garantia/Venda)', 'erro');
    if (!dados.assistencia) return mostrarFeedbackOS('Informe o nome da assistência', 'erro');
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

    var payload = Object.assign({ action: 'registrar_os' }, dados);

    fetch(resolverUrl(), {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    })
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (resp && resp.sucesso) {
          mostrarFeedbackOS('OS ' + resp.numeroOS + ' aberta com sucesso!', 'sucesso');
          gerarPDFAssistencia(Object.assign({}, dados, { numeroOS: resp.numeroOS, dataAbertura: new Date() }));
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
        btn.textContent = 'Abrir OS e gerar PDF \u2794';
      });
  }

  function validarTelefoneOS(tel) {
    var digitos = tel.replace(/\D/g, '');
    return digitos.length >= 10 && digitos.length <= 11;
  }

  function mostrarFeedbackOS(msg, tipo) {
    var el = document.getElementById('osFeedback');
    if (!el) return;
    el.innerHTML = '<div class="toast toast-' + (tipo || 'info') + '" style="display:block;position:static;">' + msg + '</div>';
  }

  // --- PDF ---
  function gerarPDFAssistencia(dados) {
    var win = window.open('', '_blank');
    if (!win) {
      mostrarFeedbackOS('Pop-up bloqueado — libere pop-ups para gerar o PDF', 'erro');
      return;
    }

    var dataAberturaStr = formatarDataBR(dados.dataAbertura || new Date());
    var dataCompraStr = dados.dataCompra ? formatarDataBR(dados.dataCompra) : '-';
    var telFmt = formatarTelefone(dados.telefoneCliente);

    var html = '' +
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
    '<title>' + escapeHtml(dados.numeroOS) + ' - ' + escapeHtml(dados.nomeCliente) + '</title>' +
    '<style>' +
    '@page { size: A4; margin: 12mm; }' +
    'body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; }' +
    '.header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #111; padding-bottom:6mm; margin-bottom:6mm; }' +
    '.logo { font-size:18pt; font-weight:bold; letter-spacing:2px; }' +
    '.os-id { font-size:14pt; font-weight:bold; }' +
    '.titulo-principal { text-align:center; font-size:14pt; font-weight:bold; margin:4mm 0; letter-spacing:1px; }' +
    '.section { margin-bottom:5mm; border:1px solid #999; }' +
    '.section-title { background:#222; color:#fff; padding:2mm 3mm; font-weight:bold; font-size:10pt; letter-spacing:1px; }' +
    '.section-body { padding:3mm; }' +
    '.row { display:flex; gap:6mm; margin-bottom:1.5mm; }' +
    '.row > div { flex:1; }' +
    '.lbl { font-weight:bold; font-size:9pt; color:#444; margin-right:3mm; }' +
    '.val { font-size:11pt; }' +
    '.blank-line { border-bottom:1px solid #000; min-height:6mm; display:block; margin:1mm 0; }' +
    '.problema-box { min-height:18mm; padding:2mm; border:1px solid #ccc; background:#fafafa; white-space:pre-wrap; }' +
    '.assist-section-title { background:#777; color:#fff; padding:2mm 3mm; font-weight:bold; font-size:10pt; letter-spacing:1px; text-align:center; margin-top:6mm; }' +
    '.pecas-table { width:100%; border-collapse:collapse; margin-top:2mm; }' +
    '.pecas-table td { border-bottom:1px solid #000; height:7mm; padding:0 2mm; font-size:10pt; }' +
    '.sig-row { display:flex; gap:8mm; margin-top:10mm; }' +
    '.sig-block { flex:1; text-align:center; }' +
    '.sig-line { border-top:1px solid #000; padding-top:1mm; font-size:9pt; margin-top:12mm; }' +
    '.rodape { text-align:center; font-size:8pt; color:#666; margin-top:6mm; }' +
    '</style></head><body>' +

    '<div class="header">' +
      '<div class="logo">NXT</div>' +
      '<div style="text-align:right;">' +
        '<div class="os-id">Nº OS: ' + dados.numeroOS + '</div>' +
        '<div style="font-size:9pt;">Data: ' + dataAberturaStr + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="titulo-principal">ORDEM DE SERVIÇO — ASSISTÊNCIA TÉCNICA</div>' +

    '<div class="section">' +
      '<div class="section-title">CLIENTE</div>' +
      '<div class="section-body">' +
        '<div class="row"><div><span class="lbl">Nome:</span> ' + escapeHtml(dados.nomeCliente) + '</div></div>' +
        '<div class="row">' +
          '<div><span class="lbl">Telefone:</span> ' + telFmt + '</div>' +
          '<div><span class="lbl">Cidade:</span> ' + escapeHtml(dados.cidade) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="section">' +
      '<div class="section-title">EQUIPAMENTO</div>' +
      '<div class="section-body">' +
        '<div class="row">' +
          '<div><span class="lbl">Modelo:</span> ' + escapeHtml(dados.modelo) + '</div>' +
          '<div><span class="lbl">Nº Chassi:</span> ' + escapeHtml(dados.numeroChassi || '-') + '</div>' +
        '</div>' +
        '<div class="row">' +
          '<div><span class="lbl">Data compra:</span> ' + dataCompraStr + '</div>' +
          '<div><span class="lbl">NF compra:</span> ' + escapeHtml(dados.notaFiscalCompra) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="section">' +
      '<div class="section-title">ATENDIMENTO</div>' +
      '<div class="section-body">' +
        '<div class="row"><div><span class="lbl">Tipo:</span> <strong>' + escapeHtml(dados.tipo).toUpperCase() + '</strong></div></div>' +
        '<div class="row"><div><span class="lbl">Assistência:</span> ' + escapeHtml(dados.assistencia) + '</div></div>' +
      '</div>' +
    '</div>' +

    '<div class="section">' +
      '<div class="section-title">PROBLEMA RELATADO PELO CLIENTE</div>' +
      '<div class="section-body">' +
        '<div class="problema-box">' + escapeHtml(dados.problemaRelatado) + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="assist-section-title">═══ A SER PREENCHIDO PELA ASSISTÊNCIA ═══</div>' +

    '<div class="section">' +
      '<div class="section-title">LAUDO TÉCNICO</div>' +
      '<div class="section-body">' +
        '<span class="blank-line"></span>' +
        '<span class="blank-line"></span>' +
        '<span class="blank-line"></span>' +
      '</div>' +
    '</div>' +

    '<div class="section">' +
      '<div class="section-title">PEÇAS UTILIZADAS</div>' +
      '<div class="section-body">' +
        '<table class="pecas-table">' +
          '<tr><td style="width:75%;">1.</td><td>Qtd:</td></tr>' +
          '<tr><td>2.</td><td>Qtd:</td></tr>' +
          '<tr><td>3.</td><td>Qtd:</td></tr>' +
          '<tr><td>4.</td><td>Qtd:</td></tr>' +
        '</table>' +
      '</div>' +
    '</div>' +

    '<div class="section">' +
      '<div class="section-title">SERVIÇO EXECUTADO</div>' +
      '<div class="section-body">' +
        '<span class="blank-line"></span>' +
        '<span class="blank-line"></span>' +
      '</div>' +
    '</div>' +

    '<div class="row" style="margin-top:4mm;">' +
      '<div><span class="lbl">Data conclusão:</span> ___/___/______</div>' +
      '<div><span class="lbl">Valor cobrado:</span> R$ _______________</div>' +
    '</div>' +

    '<div class="sig-row">' +
      '<div class="sig-block"><div class="sig-line">Assinatura Técnico</div></div>' +
      '<div class="sig-block"><div class="sig-line">Assinatura Cliente</div></div>' +
    '</div>' +

    '<div class="rodape">NXT Mobilidade Elétrica &bull; OS ' + dados.numeroOS + ' gerada em ' + dataAberturaStr + '</div>' +

    '</body></html>';

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function() { try { win.print(); } catch(e){} }, 400);
  }

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
    return tel || '-';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();
