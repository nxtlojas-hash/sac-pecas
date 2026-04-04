/**
 * ===== NXT PECAS V2 - Google Apps Script Backend =====
 * Deploy as Web App (Execute as: Me, Access: Anyone)
 *
 * This file is NOT loaded in the browser.
 * It is deployed separately on Google Apps Script for version control.
 *
 * Sheets:
 *   - "Registros" : sale/warranty registrations
 *   - "Orcamentos": quotes/budgets
 *
 * Integrations:
 *   - Bling ERP API v3
 *   - Google Docs (PDF generation)
 *   - Google Drive (PDF storage)
 */

// ========================================
// CONFIG
// ========================================

var BLING_API_BASE = 'https://www.bling.com.br/Api/v3';
var PASTA_PDF_ORCAMENTOS = '1rTamTXwXDFWIi_0YLgFD1MdzMigcPlNr';
var ABA_ORCAMENTOS = 'Orcamentos';
var ABA_REGISTROS = 'Registros';

// ========================================
// ENTRY POINTS
// ========================================

function doGet(e) {
  var action = (e.parameter && e.parameter.action) || '';

  try {
    switch (action) {
      case 'listar_orcamentos':
        return jsonResponse(listarOrcamentos(
          e.parameter.busca || '',
          e.parameter.status || '',
          e.parameter.data || ''
        ));

      case 'buscar_orcamento':
        return jsonResponse(buscarOrcamento(e.parameter.numero || ''));

      case 'gerar_pdf_orcamento':
        return jsonResponse(gerarPdfOrcamento(e.parameter.numero || ''));

      default:
        return jsonResponse({ sucesso: false, erro: 'Acao GET desconhecida: ' + action });
    }
  } catch (err) {
    return jsonResponse({ sucesso: false, erro: err.message });
  }
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ sucesso: false, erro: 'JSON invalido' });
  }

  var action = body.action || '';

  try {
    switch (action) {
      case 'salvar_orcamento':
        return jsonResponse(salvarOrcamento(body));

      case 'atualizar_status_orcamento':
        return jsonResponse(atualizarStatusOrcamento(body.numero, body.novoStatus));

      case 'registrar_venda':
        return jsonResponse(registrarVenda(body));

      default:
        return jsonResponse({ sucesso: false, erro: 'Acao POST desconhecida: ' + action });
    }
  } catch (err) {
    return jsonResponse({ sucesso: false, erro: err.message });
  }
}

// ========================================
// HELPERS
// ========================================

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(abaName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(abaName);
  if (!sheet) {
    sheet = ss.insertSheet(abaName);
    // Add headers based on sheet type
    if (abaName === ABA_ORCAMENTOS) {
      sheet.appendRow([
        'Numero', 'Data', 'DataValidade', 'Status', 'DataAprovacao',
        'ClienteNome', 'ClienteTelefone', 'ClienteDocumento', 'ClienteEmail',
        'Vendedor', 'Pecas', 'PesoTotal', 'Total', 'Observacoes', 'PdfUrl'
      ]);
    } else if (abaName === ABA_REGISTROS) {
      sheet.appendRow([
        'ID', 'DataRegistro', 'TipoAtendimento', 'OrigemSac', 'ProtocoloSac',
        'DataVenda', 'Vendedor', 'PrevEmbarque',
        'NomeCliente', 'TipoCliente', 'CpfCnpj', 'IE', 'Telefone',
        'Endereco', 'Numero', 'Bairro', 'Cidade', 'UF', 'CEP',
        'Pecas', 'FormaPagamento', 'Parcelas', 'Urgencia',
        'Transportadora', 'ValorFrete', 'PesoVolume', 'Observacoes',
        'TotalPecas', 'TotalGeral'
      ]);
    }
  }
  return sheet;
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ========================================
// ORCAMENTOS (QUOTES)
// ========================================

function salvarOrcamento(dados) {
  var sheet = getSheet(ABA_ORCAMENTOS);

  var pecasJson = '';
  try {
    pecasJson = JSON.stringify(dados.pecas || []);
  } catch (e) {
    pecasJson = '[]';
  }

  var clienteNome = '';
  var clienteTel = '';
  var clienteDoc = '';
  var clienteEmail = '';

  if (dados.cliente) {
    clienteNome = dados.cliente.nome || '';
    clienteTel = dados.cliente.telefone || '';
    clienteDoc = dados.cliente.documento || '';
    clienteEmail = dados.cliente.email || '';
  }

  sheet.appendRow([
    dados.numero || '',
    dados.data || formatDate(new Date()),
    dados.dataValidade || '',
    dados.status || 'pendente',
    '', // DataAprovacao
    clienteNome,
    clienteTel,
    clienteDoc,
    clienteEmail,
    dados.vendedor || '',
    pecasJson,
    dados.pesoTotal || '',
    dados.total || 0,
    dados.observacoes || '',
    '' // PdfUrl
  ]);

  var resultado = { sucesso: true, numero: dados.numero };

  // Generate PDF if requested
  if (dados.gerarPDF) {
    try {
      var pdfResult = gerarPdfOrcamento(dados.numero);
      resultado.pdfUrl = pdfResult.pdfUrl || '';
    } catch (e) {
      resultado.pdfErro = e.message;
    }
  }

  return resultado;
}

function listarOrcamentos(busca, status, data) {
  var sheet = getSheet(ABA_ORCAMENTOS);
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();

  if (values.length <= 1) {
    return { sucesso: true, orcamentos: [] };
  }

  var headers = values[0];
  var orcamentos = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var orc = {
      numero: String(row[0] || ''),
      data: String(row[1] || ''),
      dataValidade: String(row[2] || ''),
      status: String(row[3] || 'pendente'),
      cliente: String(row[5] || ''),
      telefone: String(row[6] || ''),
      vendedor: String(row[9] || ''),
      total: parseFloat(row[12]) || 0
    };

    // Skip empty rows
    if (!orc.numero) continue;

    // Filter by busca (text search)
    if (busca) {
      var buscaLower = busca.toLowerCase();
      var match = orc.numero.toLowerCase().indexOf(buscaLower) !== -1 ||
                  orc.cliente.toLowerCase().indexOf(buscaLower) !== -1 ||
                  orc.telefone.indexOf(busca) !== -1;
      if (!match) continue;
    }

    // Filter by status
    if (status && orc.status !== status) continue;

    // Filter by date
    if (data && orc.data !== data) continue;

    orcamentos.push(orc);
  }

  // Sort by date descending
  orcamentos.sort(function(a, b) {
    return (b.data || '').localeCompare(a.data || '');
  });

  return { sucesso: true, orcamentos: orcamentos };
}

function buscarOrcamento(numero) {
  if (!numero) return { sucesso: false, erro: 'Numero nao informado' };

  var sheet = getSheet(ABA_ORCAMENTOS);
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[0]) === numero) {
      var pecas = [];
      try {
        pecas = JSON.parse(row[10] || '[]');
      } catch (e) {
        pecas = [];
      }

      return {
        sucesso: true,
        orcamento: {
          numero: String(row[0]),
          data: String(row[1] || ''),
          dataValidade: String(row[2] || ''),
          status: String(row[3] || 'pendente'),
          dataAprovacao: String(row[4] || ''),
          clienteNome: String(row[5] || ''),
          clienteTelefone: String(row[6] || ''),
          clienteDocumento: String(row[7] || ''),
          clienteEmail: String(row[8] || ''),
          vendedor: String(row[9] || ''),
          pecas: pecas,
          pesoTotal: String(row[11] || ''),
          total: parseFloat(row[12]) || 0,
          observacoes: String(row[13] || ''),
          pdfUrl: String(row[14] || '')
        }
      };
    }
  }

  return { sucesso: false, erro: 'Orcamento nao encontrado' };
}

function atualizarStatusOrcamento(numero, novoStatus) {
  if (!numero) return { sucesso: false, erro: 'Numero nao informado' };
  if (!novoStatus) return { sucesso: false, erro: 'Status nao informado' };

  var sheet = getSheet(ABA_ORCAMENTOS);
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === numero) {
      // Column D (index 3) = Status
      sheet.getRange(i + 1, 4).setValue(novoStatus);

      // If approved, set approval date (column E, index 4)
      if (novoStatus === 'aprovado') {
        sheet.getRange(i + 1, 5).setValue(formatDate(new Date()));
      }

      return { sucesso: true, numero: numero, status: novoStatus };
    }
  }

  return { sucesso: false, erro: 'Orcamento nao encontrado' };
}

// ========================================
// PDF GENERATION
// ========================================

function gerarPdfOrcamento(numero) {
  if (!numero) return { sucesso: false, erro: 'Numero nao informado' };

  var result = buscarOrcamento(numero);
  if (!result.sucesso) return result;

  var orc = result.orcamento;
  var pecas = orc.pecas || [];

  // Create Google Doc
  var doc = DocumentApp.create('NXT - Orcamento ' + numero);
  var body = doc.getBody();

  // Style settings
  var headerStyle = {};
  headerStyle[DocumentApp.Attribute.FONT_SIZE] = 16;
  headerStyle[DocumentApp.Attribute.BOLD] = true;

  var normalStyle = {};
  normalStyle[DocumentApp.Attribute.FONT_SIZE] = 10;
  normalStyle[DocumentApp.Attribute.BOLD] = false;

  var boldStyle = {};
  boldStyle[DocumentApp.Attribute.FONT_SIZE] = 10;
  boldStyle[DocumentApp.Attribute.BOLD] = true;

  // Header
  var header = body.appendParagraph('NXT MOTOS - ORCAMENTO DE PECAS');
  header.setAttributes(headerStyle);
  header.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  var subHeader = body.appendParagraph(numero + ' | Data: ' + formatDateBR(orc.data));
  subHeader.setAttributes(normalStyle);
  subHeader.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph('').setAttributes(normalStyle);

  // Client info
  var clientSection = body.appendParagraph('CLIENTE');
  clientSection.setAttributes(boldStyle);

  body.appendParagraph('Nome: ' + (orc.clienteNome || '-')).setAttributes(normalStyle);
  if (orc.clienteTelefone) body.appendParagraph('Telefone: ' + orc.clienteTelefone).setAttributes(normalStyle);
  if (orc.clienteDocumento) body.appendParagraph('Documento: ' + orc.clienteDocumento).setAttributes(normalStyle);
  if (orc.clienteEmail) body.appendParagraph('E-mail: ' + orc.clienteEmail).setAttributes(normalStyle);

  body.appendParagraph('').setAttributes(normalStyle);

  // Parts table
  var pecasTitle = body.appendParagraph('PECAS');
  pecasTitle.setAttributes(boldStyle);

  if (pecas.length > 0) {
    var table = body.appendTable();

    // Header row
    var headerRow = table.appendTableRow();
    ['Peca', 'Modelo', 'Qtd', 'Peso', 'Preco Unit.', 'Subtotal'].forEach(function(h) {
      var cell = headerRow.appendTableCell(h);
      cell.setAttributes(boldStyle);
    });

    // Data rows
    pecas.forEach(function(p) {
      var row = table.appendTableRow();
      row.appendTableCell(p.nome || p.descricao || '-').setAttributes(normalStyle);
      row.appendTableCell(p.modelo || '-').setAttributes(normalStyle);
      row.appendTableCell(String(p.quantidade || 1)).setAttributes(normalStyle);
      row.appendTableCell(p.peso || '-').setAttributes(normalStyle);
      row.appendTableCell('R$ ' + formatValorGAS(p.precoUnitario || 0)).setAttributes(normalStyle);
      row.appendTableCell('R$ ' + formatValorGAS(p.total || 0)).setAttributes(normalStyle);
    });
  }

  body.appendParagraph('').setAttributes(normalStyle);

  // Totals
  if (orc.pesoTotal) {
    body.appendParagraph('Peso Total: ' + orc.pesoTotal).setAttributes(boldStyle);
  }
  body.appendParagraph('TOTAL: R$ ' + formatValorGAS(orc.total || 0)).setAttributes(headerStyle);

  body.appendParagraph('').setAttributes(normalStyle);

  // Observations
  if (orc.observacoes) {
    body.appendParagraph('Observacoes: ' + orc.observacoes).setAttributes(normalStyle);
    body.appendParagraph('').setAttributes(normalStyle);
  }

  // Footer
  var validadeStr = orc.dataValidade ? formatDateBR(orc.dataValidade) : '-';
  body.appendParagraph('Validade: ' + validadeStr).setAttributes(normalStyle);
  if (orc.vendedor) body.appendParagraph('Vendedor: ' + orc.vendedor).setAttributes(normalStyle);

  var footer = body.appendParagraph('nxt.eco.br');
  footer.setAttributes(normalStyle);
  footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  doc.saveAndClose();

  // Convert to PDF
  var docFile = DriveApp.getFileById(doc.getId());
  var pdfBlob = docFile.getAs('application/pdf');
  pdfBlob.setName('NXT_Orcamento_' + numero + '.pdf');

  // Save to Drive folder
  var folder;
  try {
    folder = DriveApp.getFolderById(PASTA_PDF_ORCAMENTOS);
  } catch (e) {
    folder = DriveApp.getRootFolder();
  }

  var pdfFile = folder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var pdfUrl = pdfFile.getUrl();

  // Delete temp doc
  docFile.setTrashed(true);

  // Save PDF URL back to sheet
  savePdfUrlToSheet(numero, pdfUrl);

  return { sucesso: true, pdfUrl: pdfUrl, numero: numero };
}

function savePdfUrlToSheet(numero, pdfUrl) {
  var sheet = getSheet(ABA_ORCAMENTOS);
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === numero) {
      // Column O (index 14) = PdfUrl
      sheet.getRange(i + 1, 15).setValue(pdfUrl);
      break;
    }
  }
}

function formatDateBR(dateStr) {
  if (!dateStr) return '-';
  var parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function formatValorGAS(valor) {
  if (valor == null || isNaN(valor)) return '0,00';
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ========================================
// REGISTROS (SALE REGISTRATION)
// ========================================

function registrarVenda(dados) {
  var sheet = getSheet(ABA_REGISTROS);

  var pecasJson = '';
  try {
    pecasJson = JSON.stringify(dados.pecas || []);
  } catch (e) {
    pecasJson = '[]';
  }

  var resultado = { sucesso: false, planilha: false, bling: false, erros: [] };

  try {
    sheet.appendRow([
      dados.id || 'PCA-' + new Date().getTime(),
      formatDate(new Date()),
      dados.tipoAtendimento || '',
      dados.origemSac || '',
      dados.protocoloSac || '',
      dados.dataVenda || '',
      dados.vendedor || '',
      dados.prevEmbarque || '',
      dados.nomeCliente || '',
      dados.tipoCliente || '',
      dados.cpfCnpjCliente || '',
      dados.ieCliente || '',
      dados.telefoneCliente || '',
      dados.enderecoCliente || '',
      dados.numeroCliente || '',
      dados.bairroCliente || '',
      dados.cidadeCliente || '',
      dados.ufCliente || '',
      dados.cepCliente || '',
      pecasJson,
      dados.formaPagamento || '',
      dados.parcelas || '',
      dados.urgencia || '',
      dados.transportadora || '',
      dados.valorFrete || 0,
      dados.pesoVolume || '',
      dados.observacoes || '',
      dados.totalPecas || 0,
      dados.totalGeral || 0
    ]);

    resultado.planilha = true;
  } catch (e) {
    resultado.erros.push('Planilha: ' + e.message);
  }

  // Bling integration (placeholder - implement when API keys are configured)
  try {
    // resultado.bling = enviarParaBling(dados);
    resultado.bling = true; // Placeholder
  } catch (e) {
    resultado.erros.push('Bling: ' + e.message);
  }

  resultado.sucesso = resultado.planilha;
  return resultado;
}
