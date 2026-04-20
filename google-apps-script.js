// =============================================
// GOOGLE APPS SCRIPT - NXT PECAS V2
// Planilha + Bling + Orcamentos + PDF (tudo centralizado)
// =============================================
//
// INSTRUCOES DE INSTALACAO:
// 1. Abra a planilha Google Sheets
// 2. Menu: Extensoes > Apps Script
// 3. Cole TODO este codigo no editor (substitua o conteudo)
// 4. No editor, va em: Configuracoes do projeto (engrenagem) > Propriedades do script
//    Adicione estas propriedades:
//      BLING_CLIENT_ID      = (seu client_id do Bling)
//      BLING_CLIENT_SECRET  = (seu client_secret do Bling)
//      BLING_REFRESH_TOKEN  = (seu refresh_token do Bling)
// 5. Clique em "Implantar" > "Nova implantacao"
//    - Tipo: "App da Web"
//    - Executar como: "Eu"
//    - Acesso: "Qualquer pessoa"
// 6. Copie a URL gerada e cole no script.js (GOOGLE_SCRIPT_URL)
//
// PARA AUTORIZAR O BLING:
//   - Execute a funcao "autorizarBling" no editor do Apps Script
//   - Ou acesse: SUA_URL_APPS_SCRIPT?action=auth_bling
//   - Siga o link de autorizacao e cole o codigo recebido
//
// Sheets:
//   - "Registros"  : sale/warranty registrations
//   - "Orcamentos" : quotes/budgets
//
// Integrations:
//   - Bling ERP API v3
//   - Google Docs (PDF generation)
//   - Google Drive (PDF storage)
//
// =============================================

// ========================================
// CONFIG
// ========================================

var BLING_API_BASE = 'https://www.bling.com.br/Api/v3';
var PASTA_PDF_ORCAMENTOS = '1rTamTXwXDFWIi_0YLgFD1MdzMigcPlNr';
var ABA_ORCAMENTOS = 'Orcamentos';
var ABA_REGISTROS = 'Registros';
var ABA_PECAS = 'Pecas';
var ABA_ESTOQUE = 'Estoque';
var ABA_ASSISTENCIAS = 'AssistenciasTecnicas';

// ========================================
// MAPEAMENTO FISCAL (Tabela Claudia Pecas)
// ========================================
// Cada peca do formulario -> codigo Bling + descricao NFe + IPI
// Pecas sem mapeamento (baterias, motor, carregador, alarme) continuam buscando por nome no Bling

var MAPEAMENTO_FISCAL = {
  // --- 04.0035 | GUIDAO / PARTES DIVERSAS | IPI 9% ---
  'Guidao ferro':                    { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Display lcd':                     { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Suporte de celular':              { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Acelerador de dedo':              { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Acelerador de punho':             { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Punho':                           { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Mesa inferior':                   { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Mesa superior':                   { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Conjunto botoes (buzina, luz alta)': { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Par bengala':                     { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Ignicao':                         { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Manopla':                         { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Conjunto de direcao':             { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Par manete com sensor':           { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Garfo completo':                  { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Painel display com acelerador':   { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Canote':                          { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Miolo trava':                     { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },
  'Suspensao dianteira':             { codigo: '04.0035', descricaoNfe: 'PARTES/DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: GUIDAO - PRODUTO NOVO.', ipi: 0.09 },

  // --- 04.0030 | ASSENTO / BANCO | IPI 9% ---
  'Banco traseiro':                  { codigo: '04.0030', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: ASSENTO ENCOSTO - ALMOFADA - PRODUTO NOVO.', ipi: 0.09 },
  'Banco passageiro':                { codigo: '04.0030', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: ASSENTO ENCOSTO - ALMOFADA - PRODUTO NOVO.', ipi: 0.09 },
  'Banco de encosto':                { codigo: '04.0030', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: ASSENTO ENCOSTO - ALMOFADA - PRODUTO NOVO.', ipi: 0.09 },
  'Encosto com alca':                { codigo: '04.0030', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: ASSENTO ENCOSTO - ALMOFADA - PRODUTO NOVO.', ipi: 0.09 },

  // --- 04.0038 | FRAME / QUADRO | IPI 9% ---
  'Cesto':                           { codigo: '04.0038', descricaoNfe: 'PARTES/DE MOTOCICLETAS INCLUINDO OS CICLOMOTORES - SENDO: FRAME - QUADRO, ARMACAO PARA MOTOCICLETA ELETRICA - MARCA: N', ipi: 0.09 },
  'Amortecedor':                     { codigo: '04.0038', descricaoNfe: 'PARTES/DE MOTOCICLETAS INCLUINDO OS CICLOMOTORES - SENDO: FRAME - QUADRO, ARMACAO PARA MOTOCICLETA ELETRICA - MARCA: N', ipi: 0.09 },
  'Par suspensao traseira':          { codigo: '04.0038', descricaoNfe: 'PARTES/DE MOTOCICLETAS INCLUINDO OS CICLOMOTORES - SENDO: FRAME - QUADRO, ARMACAO PARA MOTOCICLETA ELETRICA - MARCA: N', ipi: 0.09 },
  'Quadro chassi':                   { codigo: '04.0038', descricaoNfe: 'PARTES/DE MOTOCICLETAS INCLUINDO OS CICLOMOTORES - SENDO: FRAME - QUADRO, ARMACAO PARA MOTOCICLETA ELETRICA - MARCA: N', ipi: 0.09 },

  // --- 04.0007 | MODULO CONTROLADOR | IPI 9.75% ---
  'Modulo controlador':              { codigo: '04.0007', descricaoNfe: 'CONTROLLER -MODULO CONTROLADOR SCOOTER/MOTO ELETRICA', ipi: 0.0975 },
  'Modulo controlador 48v':          { codigo: '04.0007', descricaoNfe: 'CONTROLLER -MODULO CONTROLADOR SCOOTER/MOTO ELETRICA', ipi: 0.0975 },

  // --- 04.0049 | RETROVISOR | IPI 9% ---
  'Retrovisor':                      { codigo: '04.0049', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: ESPELHO RETROVISOR - PRODUTO NOVO. (REARVIEW MIRROR)', ipi: 0.09 },

  // --- 04.0002 | ILUMINACAO / FAROIS | IPI 9.75% ---
  'Farol dianteiro':                 { codigo: '04.0002', descricaoNfe: 'APARELHOS ELETRICOS  DE ILUMINACAO - SENDO: FAROIS - PRODUTO NOVO - MARCA NXT', ipi: 0.0975 },
  'Lanterna traseira':               { codigo: '04.0002', descricaoNfe: 'APARELHOS ELETRICOS  DE ILUMINACAO - SENDO: FAROIS - PRODUTO NOVO - MARCA NXT', ipi: 0.0975 },
  'Par pisca punho led':             { codigo: '04.0002', descricaoNfe: 'APARELHOS ELETRICOS  DE ILUMINACAO - SENDO: FAROIS - PRODUTO NOVO - MARCA NXT', ipi: 0.0975 },
  'Rele':                            { codigo: '04.0002', descricaoNfe: 'APARELHOS ELETRICOS  DE ILUMINACAO - SENDO: FAROIS - PRODUTO NOVO - MARCA NXT', ipi: 0.0975 },
  'Iluminacao':                      { codigo: '04.0002', descricaoNfe: 'APARELHOS ELETRICOS  DE ILUMINACAO - SENDO: FAROIS - PRODUTO NOVO - MARCA NXT', ipi: 0.0975 },

  // --- 04.0018 | CARENAGEM / PLASTICO | IPI 9% ---
  'Assoalho':                        { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Carenagem bau':                   { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Carenagem escudo':                { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Carenagem frontal farol':         { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Carenagem lateral':               { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Para-brisa':                      { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Paralamas dianteiro':             { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Paralamas traseiro':              { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Plastico lateral':                { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Plastico peito':                  { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Tapete':                          { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Bico ventil':                     { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Calota':                          { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Bico dianteiro':                  { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Maleta de bateria':               { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Porta treco':                     { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Rabeta':                          { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Par protetor de balanca':         { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },
  'Protetor de motor':               { codigo: '04.0018', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES),  SENDO: CARENAGEM/COBERTURA DE PLASTICO - PARTE DE CARROCARIA, PRO', ipi: 0.09 },

  // --- 04.0099 | RODA / PNEU | IPI 9% ---
  'Aro 10 dianteiro':                { codigo: '04.0099', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO:RODA DA FRENTE - PRODUTO NOVO.', ipi: 0.09 },
  'Pneu 10 2.75':                    { codigo: '04.0099', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO:RODA DA FRENTE - PRODUTO NOVO.', ipi: 0.09 },
  'Pneu 12 2.50':                    { codigo: '04.0099', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO:RODA DA FRENTE - PRODUTO NOVO.', ipi: 0.09 },
  'Camara de ar':                    { codigo: '04.0099', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO:RODA DA FRENTE - PRODUTO NOVO.', ipi: 0.09 },

  // --- 04.0031 | CABO DE FREIO | IPI 9% ---
  'Cabo de freio diant / traseiro':  { codigo: '04.0031', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO:CABO DE FREIO', ipi: 0.09 },
  'Reservatorio de oleo':            { codigo: '04.0031', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO:CABO DE FREIO', ipi: 0.09 },

  // --- 04.0027 | FREIO DE TAMBOR | IPI 9% ---
  'Freio tambor':                    { codigo: '04.0027', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: FREIO DE TAMBOR', ipi: 0.09 },
  'Disco de freio':                  { codigo: '04.0027', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: FREIO DE TAMBOR', ipi: 0.09 },
  'Freio hidraulico completo':       { codigo: '04.0027', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: FREIO DE TAMBOR', ipi: 0.09 },
  'Pastilha freio par':              { codigo: '04.0027', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: FREIO DE TAMBOR', ipi: 0.09 },

  // --- 04.0021 | ALAVANCA DE FREIO | IPI 9% ---
  'Alavanca do freio':               { codigo: '04.0021', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: ALAVANCA DE FREIO', ipi: 0.09 },

  // --- 04.0045 | PEDAL | IPI 9% ---
  'Pedaleira com chapa':             { codigo: '04.0045', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: PEDAL - PRODUTO NOVO.', ipi: 0.09 },
  'Pezinho de descanso':             { codigo: '04.0045', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: PEDAL - PRODUTO NOVO.', ipi: 0.09 },

  // --- 04.0047 | MANIVELA | IPI 9% ---
  'Manivela':                        { codigo: '04.0047', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: MANIVELA - PRODUTO NOVO.', ipi: 0.09 },

  // --- 04.0048 | COROA DE TRANSMISSAO | IPI 9% ---
  'Coroa de transmissao':            { codigo: '04.0048', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: COROA DE TRANSMISSAO - PRODUTO NOVO.', ipi: 0.09 },

  // --- 04.0020 | OLHO DE GATO | IPI 9% ---
  'Olho de gato':                    { codigo: '04.0020', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), REFETOR TIPO OLHO DE GATO ( CATADIOPTRICOS -DISPOSITIVO REFLETOR -', ipi: 0.09 },

  // --- 04.0024 | CABO DE BATERIA / ELETRICO | IPI 9% ---
  'Chicote':                         { codigo: '04.0024', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: CABO DE BATERIA', ipi: 0.09 },
  'Fonte do carregador':             { codigo: '04.0024', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: CABO DE BATERIA', ipi: 0.09 },
  'Tomada carregador':               { codigo: '04.0024', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: CABO DE BATERIA', ipi: 0.09 },
  'Fuzivel':                         { codigo: '04.0024', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: CABO DE BATERIA', ipi: 0.09 },
  'Tomada maleta':                   { codigo: '04.0024', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: CABO DE BATERIA', ipi: 0.09 },
  'Conjunto cabos de bateria':       { codigo: '04.0024', descricaoNfe: 'PARTES / DE MOTOCICLETAS (INCLUINDO OS CICLOMOTORES), SENDO: CABO DE BATERIA', ipi: 0.09 }
};

// Busca o mapeamento fiscal pela descricao da peca (case-insensitive)
function buscarMapeamentoFiscal(descricaoPeca) {
  if (!descricaoPeca) return null;
  var desc = descricaoPeca.trim();
  // Busca exata primeiro
  if (MAPEAMENTO_FISCAL[desc]) return MAPEAMENTO_FISCAL[desc];
  // Busca case-insensitive
  var descLower = desc.toLowerCase();
  var keys = Object.keys(MAPEAMENTO_FISCAL);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === descLower) return MAPEAMENTO_FISCAL[keys[i]];
  }
  return null;
}

// ========================================
// BLING: ARMAZENAMENTO DE TOKENS
// ========================================

function getProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function setProperty(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

function getBlingTokens() {
  return {
    accessToken: getProperty('BLING_ACCESS_TOKEN'),
    refreshToken: getProperty('BLING_REFRESH_TOKEN'),
    expiry: parseInt(getProperty('BLING_TOKEN_EXPIRY') || '0')
  };
}

function saveBlingTokens(accessToken, refreshToken, expiresIn) {
  var expiry = Date.now() + (expiresIn * 1000);
  setProperty('BLING_ACCESS_TOKEN', accessToken);
  setProperty('BLING_REFRESH_TOKEN', refreshToken);
  setProperty('BLING_TOKEN_EXPIRY', expiry.toString());
}

// ========================================
// BLING: OAUTH
// ========================================

function getBlingAccessToken() {
  var clientId = getProperty('BLING_CLIENT_ID');
  var clientSecret = getProperty('BLING_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Credenciais do Bling nao configuradas. Adicione BLING_CLIENT_ID e BLING_CLIENT_SECRET nas Propriedades do Script.');
  }

  var tokens = getBlingTokens();

  if (!tokens.refreshToken) {
    throw new Error('Refresh token nao encontrado. Execute a autorizacao do Bling primeiro.');
  }

  // Verificar se access_token ainda e valido (margem de 5 min)
  if (tokens.accessToken && tokens.expiry && Date.now() < tokens.expiry - 300000) {
    return tokens.accessToken;
  }

  // Renovar access_token usando refresh_token
  var credentials = Utilities.base64Encode(clientId + ':' + clientSecret);

  var response = UrlFetchApp.fetch(BLING_API_BASE + '/oauth/token', {
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + credentials
    },
    payload: {
      'grant_type': 'refresh_token',
      'refresh_token': tokens.refreshToken
    },
    muteHttpExceptions: true
  });

  var data = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    throw new Error('Erro ao renovar token Bling: ' + JSON.stringify(data));
  }

  // Salvar novos tokens
  saveBlingTokens(data.access_token, data.refresh_token, data.expires_in);

  return data.access_token;
}

// Fazer requisicao a API do Bling
function blingRequest(endpoint, method, body) {
  var accessToken = getBlingAccessToken();
  var url = BLING_API_BASE + endpoint;

  var options = {
    method: method || 'get',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    muteHttpExceptions: true
  };

  if (body && (method === 'post' || method === 'POST' || method === 'put' || method === 'PUT')) {
    options.payload = JSON.stringify(body);
  }

  var response = UrlFetchApp.fetch(url, options);
  var responseData = JSON.parse(response.getContentText());

  if (response.getResponseCode() >= 400) {
    var errorMsg = '';
    if (responseData.error) {
      errorMsg = responseData.error.message || JSON.stringify(responseData.error);
      if (responseData.error.fields) {
        errorMsg += ' — ' + responseData.error.fields.map(function(f) { return f.msg || f.message || JSON.stringify(f); }).join('; ');
      }
    }
    throw new Error('Bling API erro ' + response.getResponseCode() + ': ' + errorMsg);
  }

  return responseData;
}

// ========================================
// BLING: CONTATO + PEDIDO
// ========================================

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

function buscarOuCriarContato(cliente) {
  var cpf = cliente.cpf || '';
  var telefone = cliente.telefone || '';

  // Buscar por CPF/CNPJ se existir
  var docLength = cpf.length;
  var docValido = (docLength === 11 && validarCPF(cpf)) || docLength === 14;
  if (cpf && docValido) {
    try {
      var busca = blingRequest('/contatos?numeroDocumento=' + cpf, 'get');
      if (busca.data && busca.data.length > 0) {
        var contatoExistente = busca.data[0];
        // Atualizar endereco do contato existente (necessario para NF)
        if (cliente.endereco) {
          try {
            blingRequest('/contatos/' + contatoExistente.id, 'put', {
              nome: contatoExistente.nome,
              tipo: contatoExistente.tipo || (cliente.tipo === 'J' ? 'J' : 'F'),
              endereco: {
                endereco: cliente.endereco,
                numero: cliente.numero || 'S/N',
                bairro: cliente.bairro || '',
                municipio: cliente.cidade || '',
                uf: cliente.uf || '',
                cep: cliente.cep || ''
              }
            });
          } catch (eUpdate) {
            // Se falhar a atualizacao, segue com o contato existente
          }
        }
        return contatoExistente.id;
      }
    } catch (e) {
      // Contato nao encontrado, vai criar
    }
  }

  // Criar novo contato
  var tipoPessoa = cliente.tipo === 'J' ? 'J' : 'F';
  var novoContato = {
    nome: cliente.nome.toUpperCase(),
    tipo: tipoPessoa,
    situacao: 'A',
    indicadorIe: tipoPessoa === 'J' ? 1 : 9
  };

  if (telefone && telefone.length >= 10) {
    novoContato.telefone = telefone;
    novoContato.celular = telefone;
  }

  if (cpf && ((cpf.length === 11 && validarCPF(cpf)) || cpf.length === 14)) {
    novoContato.numeroDocumento = cpf;
  }

  if (cliente.ie) {
    novoContato.ie = cliente.ie;
  }

  if (cliente.email) {
    novoContato.email = cliente.email;
  }

  // Endereco
  if (cliente.endereco) {
    novoContato.endereco = {
      endereco: cliente.endereco,
      numero: cliente.numero || 'S/N',
      bairro: cliente.bairro || '',
      municipio: cliente.cidade || '',
      uf: cliente.uf || '',
      cep: cliente.cep || ''
    };
  }

  var resultado = blingRequest('/contatos', 'post', novoContato);
  return resultado.data.id;
}

/**
 * Rateia o valor da mão de obra proporcionalmente entre os produtos.
 * Retorna nova lista de peças sem mão de obra, com preços unitários inflados.
 * Ajusta o último item para absorver residual de centavos.
 *
 * @param {Array} pecas — array com {descricao, precoUnitario, quantidade, isMaoDeObra?}
 * @returns {Array} novas peças (sem mão de obra), com precoUnitario possivelmente ajustado
 */
function ratearMaoDeObra(pecas) {
  if (!pecas || pecas.length === 0) return [];

  var produtos = [];
  var valorMaoObra = 0;

  for (var i = 0; i < pecas.length; i++) {
    if (pecas[i].isMaoDeObra) {
      valorMaoObra += (parseFloat(pecas[i].precoUnitario) || 0) * (parseInt(pecas[i].quantidade) || 1);
    } else {
      produtos.push(Object.assign({}, pecas[i]));
    }
  }

  if (valorMaoObra <= 0) return produtos;

  if (produtos.length === 0) {
    throw new Error('Pedido não pode conter apenas mão de obra');
  }

  var totalProdutos = 0;
  for (var j = 0; j < produtos.length; j++) {
    totalProdutos += (parseFloat(produtos[j].precoUnitario) || 0) * (parseInt(produtos[j].quantidade) || 1);
  }

  if (totalProdutos <= 0) {
    throw new Error('Total dos produtos zero — não é possível ratear');
  }

  var fator = (totalProdutos + valorMaoObra) / totalProdutos;
  var totalAlvo = Math.round((totalProdutos + valorMaoObra) * 100) / 100;
  var totalCalculado = 0;

  for (var k = 0; k < produtos.length - 1; k++) {
    var novoPreco = Math.round(produtos[k].precoUnitario * fator * 100) / 100;
    produtos[k].precoUnitario = novoPreco;
    totalCalculado += novoPreco * (parseInt(produtos[k].quantidade) || 1);
  }

  var ultimo = produtos[produtos.length - 1];
  var qtdUltimo = parseInt(ultimo.quantidade) || 1;
  var valorRestante = totalAlvo - totalCalculado;
  var novoPrecoUltimo = Math.round((valorRestante / qtdUltimo) * 100) / 100;
  ultimo.precoUnitario = novoPrecoUltimo;

  return produtos;
}

function enviarPedidoBling(dados) {
  // 1. Buscar ou criar contato
  var contatoId = buscarOuCriarContato({
    nome: dados.nomeCliente,
    cpf: dados.cpfCnpjCliente,
    telefone: dados.telefoneCliente,
    email: '',
    tipo: dados.tipoCliente || 'F',
    ie: dados.ieCliente || '',
    endereco: dados.enderecoCliente || '',
    numero: dados.numeroCliente || '',
    bairro: dados.bairroCliente || '',
    cidade: dados.cidadeCliente || '',
    uf: dados.ufCliente || '',
    cep: dados.cepCliente || ''
  });

  // 2. Montar itens do pedido (com mapeamento fiscal da Claudia Pecas)
  var itens = [];
  var pecas = dados.pecas || [];

  // 2.0 Rateio de mão de obra — absorve valor do serviço nos produtos
  // Pedidos sem mão de obra passam intocados.
  try {
    pecas = ratearMaoDeObra(pecas);
  } catch (err) {
    throw new Error('Erro no rateio de mão de obra: ' + err.message);
  }

  for (var i = 0; i < pecas.length; i++) {
    var peca = pecas[i];
    var fiscal = buscarMapeamentoFiscal(peca.descricao);

    // Se tem IPI no mapeamento fiscal, o valor enviado ao Bling deve ser o valor BASE (sem IPI)
    // Ex: cliente paga R$200, IPI 9% -> valor base = 200 / 1.09 = R$183,49
    // Quando a nota for gerada, o Bling soma o IPI automaticamente e fecha no valor total
    var valorUnitario = peca.precoUnitario;
    if (fiscal && fiscal.ipi > 0) {
      valorUnitario = peca.precoUnitario / (1 + fiscal.ipi);
      valorUnitario = Math.round(valorUnitario * 100) / 100; // arredondar 2 casas
    }

    var item = {
      descricao: fiscal ? fiscal.descricaoNfe : peca.descricao.toUpperCase(),
      unidade: 'UN',
      quantidade: peca.quantidade,
      valor: valorUnitario
    };

    // Se tem mapeamento fiscal, usar o codigo da tabela da contabilidade
    if (fiscal) {
      item.codigo = fiscal.codigo;
      try {
        var buscaFiscal = blingRequest('/produtos?codigo=' + encodeURIComponent(fiscal.codigo), 'get');
        if (buscaFiscal.data && buscaFiscal.data.length > 0) {
          item.produto = { id: buscaFiscal.data[0].id };
        }
      } catch (e) {
        // Produto nao encontrado por codigo fiscal
      }
    }

    // Se nao tem mapeamento fiscal, tentar vincular por codigo manual ou nome (fallback)
    if (!fiscal) {
      if (peca.codigo) {
        try {
          var buscaCod = blingRequest('/produtos?codigo=' + encodeURIComponent(peca.codigo), 'get');
          if (buscaCod.data && buscaCod.data.length > 0) {
            item.produto = { id: buscaCod.data[0].id };
            item.codigo = peca.codigo;
          }
        } catch (e) {}
      }

      if (!item.produto) {
        try {
          var buscaNome = blingRequest('/produtos?nome=' + encodeURIComponent(peca.descricao), 'get');
          if (buscaNome.data && buscaNome.data.length > 0) {
            item.produto = { id: buscaNome.data[0].id };
            item.codigo = buscaNome.data[0].codigo || '';
          }
        } catch (e) {}
      }
    }

    itens.push(item);
  }

  // 3. Montar pedido de venda
  var pedido = {
    contato: { id: contatoId },
    data: dados.dataVenda,
    numero: dados.id.replace('PCA-', ''),
    numeroLoja: dados.id,
    vendedor: { nome: dados.vendedor },
    naturezaOperacao: { id: 15105967674 },
    itens: itens,
    observacoes: 'SAC - ' + (dados.tipoAtendimento || 'Pecas') + (dados.protocoloSac ? ' | Protocolo: ' + dados.protocoloSac : '') + (dados.observacoes ? '\n' + dados.observacoes : '')
  };

  // 3.1 Adicionar transporte (frete + endereco de entrega para NF)
  var valorFrete = parseFloat(dados.valorFrete) || 0;
  pedido.transporte = {
    fretePorConta: 0 // 0 = por conta do remetente
  };
  if (valorFrete > 0) {
    pedido.transporte.frete = valorFrete;
  }

  var resultado = blingRequest('/pedidos/vendas', 'post', pedido);
  return resultado.data.id;
}

// ========================================
// BLING: GRAVAR NA PLANILHA (PEDIDOS)
// ========================================

function gravarNaPlanilha(dados) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PEDIDOS')
           || ss.getSheetByName('Pedido de Pecas')
           || ss.getSheetByName('Pecas')
           || ss.getSheets()[0];
  Logger.log('Aba encontrada: ' + sheet.getName());

  // Criar cabecalho se a planilha estiver vazia
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'DATA', 'PEDIDO', 'PROTOCOLO SAC', 'ATENDENTE', 'Origem',
      'NOME DO CLIENTE', 'STATUS', 'NF', 'SOLICITACAO', 'URGENCIA',
      'ENVIO', 'TELEFONE', 'ENDERECO', 'BAIRRO', 'CIDADE/ESTADO', 'CEP',
      'PEDIDO DE PECAS', 'TIPO DE PECA', 'MODELO', 'COR',
      'QTD', 'TOTAL PECA (R$)', 'PAGAMENTO', 'PREV. EMBARQUE',
      'FRETE (R$)', 'TOTAL GERAL (R$)',
      '', '', 'PESO / VOLUME', 'OBS',
      'BLING STATUS', 'BLING PEDIDO ID', 'FECHAMENTO'
    ]);
    var headerRange = sheet.getRange(1, 1, 1, 33);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1a1a2e');
    headerRange.setFontColor('#c6ff00');
  }

  // Montar descricao das pecas
  var pecas = dados.pecas || [];
  var pecasDesc = pecas.map(function(p) {
    return p.descricao + ' (' + p.modelo + ')' +
           (p.cor ? ' [Cor: ' + p.cor + ']' : '') +
           ' - ' + p.quantidade + 'x R$' + Number(p.precoUnitario).toFixed(2).replace('.', ',');
  }).join(' | ');

  // Extrair categorias, modelos e cores unicos
  var categorias = [];
  var modelos = [];
  var cores = [];
  pecas.forEach(function(p) {
    if (p.categoria && categorias.indexOf(p.categoria) === -1) categorias.push(p.categoria);
    if (p.modelo && modelos.indexOf(p.modelo) === -1) modelos.push(p.modelo);
    if (p.cor && cores.indexOf(p.cor) === -1) cores.push(p.cor);
  });

  var qtdTotal = pecas.reduce(function(sum, p) { return sum + (p.quantidade || 0); }, 0);

  // Formatar forma de pagamento
  var formaLabels = {
    'dinheiro': 'Dinheiro', 'pix': 'PIX', 'debito': 'Debito',
    'credito': 'Credito', 'boleto': 'Boleto', 'link': 'Link de Pagamento', 'transferencia': 'Transferencia'
  };
  var formaPag = formaLabels[dados.formaPagamento] || dados.formaPagamento || '';
  if ((dados.formaPagamento === 'credito' || dados.formaPagamento === 'link') && dados.parcelas) {
    formaPag += ' (' + dados.parcelas + 'x)';
  }

  var transpLabels = {
    'correios': 'Correios', 'rodonaves': 'Rodonaves', 'atual_cargas': 'Atual Cargas',
    'em_maos': 'Em Maos', 'loja': 'Loja', 'outro': 'Outro'
  };

  var urgLabels = {
    'baixa': 'Baixa', 'normal': 'Normal', 'alta': 'Alta', 'urgente': 'URGENTE'
  };

  var cidadeEstado = (dados.cidadeCliente || '') + (dados.ufCliente ? '/' + dados.ufCliente : '');

  // Inserir linha (ordem conforme aba "PEDIDOS")
  sheet.appendRow([
    dados.dataVenda || '',                                          // A - DATA
    dados.id || '',                                                 // B - PEDIDO
    dados.protocoloSac || '',                                       // C - PROTOCOLO SAC
    dados.vendedor || '',                                           // D - ATENDENTE
    dados.origemSac || '',                                          // E - Origem
    dados.nomeCliente || '',                                        // F - NOME DO CLIENTE
    '',                                                             // G - STATUS (manual)
    '',                                                             // H - NF (manual)
    dados.tipoAtendimento || '',                                    // I - SOLICITACAO
    urgLabels[dados.urgencia] || dados.urgencia || '',               // J - URGENCIA
    transpLabels[dados.transportadora] || dados.transportadora || '',// K - ENVIO
    dados.telefoneCliente || '',                                    // L - TELEFONE
    (dados.enderecoCliente || '') + (dados.numeroCliente ? ', ' + dados.numeroCliente : ''), // M - ENDERECO
    dados.bairroCliente || '',                                      // N - BAIRRO
    cidadeEstado,                                                   // O - CIDADE/ESTADO
    dados.cepCliente || '',                                         // P - CEP
    pecasDesc,                                                      // Q - PEDIDO DE PECAS
    categorias.join(', '),                                          // R - TIPO DE PECA
    modelos.join(', '),                                             // S - MODELO
    cores.join(', '),                                               // T - COR
    qtdTotal,                                                       // U - QTD
    dados.totalPecas || 0,                                          // V - TOTAL PECA (R$)
    formaPag,                                                       // W - PAGAMENTO
    dados.prevEmbarque || '',                                       // X - PREV. EMBARQUE
    dados.valorFrete || 0,                                          // Y - FRETE (R$)
    dados.totalGeral || 0,                                          // Z - TOTAL GERAL (R$)
    '',                                                             // AA - (vazio)
    '',                                                             // AB - (vazio)
    dados.pesoVolume || '',                                         // AC - PESO / VOLUME
    dados.observacoes || '',                                        // AD - OBS
    '',                                                             // AE - BLING STATUS
    '',                                                             // AF - BLING PEDIDO ID
    ''                                                              // AG - FECHAMENTO (manual)
  ]);

  var lastRow = sheet.getLastRow();

  // Formatar colunas de valor como moeda (V=22, Y=25, Z=26)
  sheet.getRange(lastRow, 22).setNumberFormat('R$ #.##0,00');
  sheet.getRange(lastRow, 25).setNumberFormat('R$ #.##0,00');
  sheet.getRange(lastRow, 26).setNumberFormat('R$ #.##0,00');

  return lastRow;
}

function atualizarBlingStatus(row, status, pedidoId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PEDIDOS')
           || ss.getSheetByName('Pedido de Pecas')
           || ss.getSheetByName('Pecas')
           || ss.getSheets()[0];
  sheet.getRange(row, 31).setValue(status);
  sheet.getRange(row, 32).setValue(pedidoId || '');
}

// ========================================
// ENTRY POINTS
// ========================================

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var code = (e && e.parameter && e.parameter.code) || '';

  // Se veio com codigo do Bling, tratar como callback automaticamente
  if (code && !action) {
    action = 'bling_callback';
  }

  try {
    switch (action) {
      // --- Orcamentos ---
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

      // --- Pecas (Admin) ---
      case 'listar_pecas':
        return jsonResponse(listarPecasSheet());

      // --- Estoque ---
      case 'listar_estoque':
        return jsonResponse(listarEstoque());

      case 'buscar_estoque':
        return jsonResponse(buscarEstoque(
          e.parameter.modelo || '',
          e.parameter.peca || ''
        ));

      // --- Bling Auth ---
      case 'status':
        var tokens = getBlingTokens();
        var hasCreds = !!(getProperty('BLING_CLIENT_ID') && getProperty('BLING_CLIENT_SECRET'));
        var hasRefresh = !!tokens.refreshToken;
        var tokenValido = tokens.accessToken && tokens.expiry && Date.now() < tokens.expiry - 300000;
        return jsonResponse({
          status: 'ok',
          bling: {
            credenciais: hasCreds,
            refreshToken: hasRefresh,
            accessTokenValido: tokenValido
          }
        });

      case 'auth_bling':
        var clientId = getProperty('BLING_CLIENT_ID');
        if (!clientId) {
          return jsonResponse({ error: 'BLING_CLIENT_ID nao configurado nas Propriedades do Script' });
        }
        var scriptUrl = ScriptApp.getService().getUrl();
        var redirectUri = scriptUrl;
        var authUrl = BLING_API_BASE + '/oauth/authorize?response_type=code&client_id=' + clientId +
                      '&redirect_uri=' + encodeURIComponent(redirectUri) + '&state=pecas';
        var html = '<html><head><title>Autorizar Bling</title>'
          + '<style>body{font-family:Arial;padding:40px;max-width:600px;margin:0 auto;text-align:center;}'
          + '.btn{display:inline-block;background:#27ae60;color:white;padding:15px 30px;border-radius:8px;text-decoration:none;font-size:16px;}'
          + '.btn:hover{background:#219a52;}</style></head>'
          + '<body><h1>Autorizar Bling - NXT Pecas</h1>'
          + '<p>Clique no botao abaixo para autorizar o acesso ao Bling:</p>'
          + '<p><a class="btn" href="' + authUrl + '">Autorizar no Bling</a></p>'
          + '<p style="color:#888;font-size:12px;">Redirect URI: ' + redirectUri + '</p>'
          + '</body></html>';
        return HtmlService.createHtmlOutput(html);

      case 'bling_callback':
        if (!code) code = e.parameter.code;
        if (!code) {
          return HtmlService.createHtmlOutput('<h1 style="color:red;">Erro: codigo nao recebido</h1>');
        }
        var cbClientId = getProperty('BLING_CLIENT_ID');
        var cbClientSecret = getProperty('BLING_CLIENT_SECRET');
        var cbCredentials = Utilities.base64Encode(cbClientId + ':' + cbClientSecret);
        var cbScriptUrl = ScriptApp.getService().getUrl();
        var cbRedirectUri = cbScriptUrl;
        var cbResponse = UrlFetchApp.fetch(BLING_API_BASE + '/oauth/token', {
          method: 'post',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + cbCredentials
          },
          payload: {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': cbRedirectUri
          },
          muteHttpExceptions: true
        });
        var cbData = JSON.parse(cbResponse.getContentText());
        if (cbResponse.getResponseCode() !== 200) {
          return HtmlService.createHtmlOutput(
            '<h1 style="color:red;">Erro ao obter tokens</h1><pre>' + JSON.stringify(cbData, null, 2) + '</pre>'
          );
        }
        saveBlingTokens(cbData.access_token, cbData.refresh_token, cbData.expires_in);
        return HtmlService.createHtmlOutput(
          '<html><body style="font-family:Arial;padding:40px;text-align:center;">'
          + '<h1 style="color:#27ae60;">Bling Conectado!</h1>'
          + '<p>Tokens salvos com sucesso. O NXT Pecas esta pronto para enviar pedidos ao Bling.</p>'
          + '</body></html>'
        );

      default:
        return jsonResponse({ status: 'ok', message: 'NXT Pecas API ativa' });
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
      // --- Orcamentos ---
      case 'salvar_orcamento':
        return jsonResponse(salvarOrcamento(body));

      case 'atualizar_status_orcamento':
        return jsonResponse(atualizarStatusOrcamento(body.numero, body.novoStatus));

      // --- Registrar Venda (Planilha + Bling) ---
      case 'registrar_venda':
        return jsonResponse(registrarVenda(body));

      // --- Gerenciar Pecas (Admin) ---
      case 'gerenciar_peca':
        return jsonResponse(gerenciarPeca(body));

      // --- Estoque ---
      case 'atualizar_estoque':
        return jsonResponse(atualizarEstoque(body));

      case 'baixa_estoque':
        return jsonResponse(baixaEstoque(body));

      case 'registrar_os':
        return jsonResponse(registrarOS(body));

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

// ========================================
// REGISTROS (SALE REGISTRATION + BLING)
// ========================================

function registrarVenda(dados) {
  var resultado = { sucesso: false, planilha: false, bling: false, blingPedidoId: null, erros: [] };

  // 1. Gravar na planilha PEDIDOS (formato detalhado do original)
  var row;
  try {
    row = gravarNaPlanilha(dados);
    resultado.planilha = true;
  } catch (errPlanilha) {
    resultado.erros.push('Planilha: ' + errPlanilha.toString());
  }

  // 2. Gravar na aba Registros (formato simplificado)
  try {
    var sheetReg = getSheet(ABA_REGISTROS);
    var pecasJson = '';
    try {
      pecasJson = JSON.stringify(dados.pecas || []);
    } catch (e) {
      pecasJson = '[]';
    }

    sheetReg.appendRow([
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
  } catch (errReg) {
    resultado.erros.push('Registros: ' + errReg.toString());
  }

  // 3. Enviar para o Bling
  try {
    var pedidoId = enviarPedidoBling(dados);
    resultado.bling = true;
    resultado.blingPedidoId = pedidoId;

    // Atualizar status na planilha
    if (row) {
      atualizarBlingStatus(row, 'OK', pedidoId);
    }
  } catch (errBling) {
    resultado.erros.push('Bling: ' + errBling.toString());

    // Marcar erro na planilha
    if (row) {
      atualizarBlingStatus(row, 'ERRO: ' + errBling.message, '');
    }
  }

  resultado.sucesso = resultado.planilha || resultado.bling;
  return resultado;
}

// ========================================
// GERENCIAR PECAS (Admin)
// ========================================

/**
 * Obtem ou cria a aba "Pecas"
 */
function getOrCreateAbaPecas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_PECAS);
  if (!sheet) {
    sheet = ss.insertSheet(ABA_PECAS);
    // Criar cabecalho
    sheet.getRange(1, 1, 1, 7).setValues([['Timestamp', 'Modelo', 'ModeloNome', 'Nome', 'Preco', 'Peso', 'Img']]);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Salva imagem no Google Drive e retorna URL publica de thumbnail
 */
function salvarImagemDrive(base64Data, nomeArquivo) {
  var folder;
  try {
    folder = DriveApp.getFolderById(PASTA_PDF_ORCAMENTOS);
    var subfolders = folder.getFoldersByName('imagens-pecas');
    if (subfolders.hasNext()) {
      folder = subfolders.next();
    } else {
      folder = folder.createFolder('imagens-pecas');
    }
  } catch(e) {
    folder = DriveApp.getRootFolder();
  }

  var contentType = 'image/jpeg';
  if (base64Data.indexOf('data:') === 0) {
    var parts = base64Data.split(',');
    contentType = parts[0].split(':')[1].split(';')[0];
    base64Data = parts[1];
  }

  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, nomeArquivo);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400';
}

/**
 * Gerencia pecas (adicionar, editar, excluir)
 * body: { action, acao, modelo, modeloNome, idx, nome, preco, peso, img }
 */
function gerenciarPeca(body) {
  var sheet = getOrCreateAbaPecas();
  var acao = body.acao || '';
  var modelo = body.modelo || '';
  var modeloNome = body.modeloNome || '';
  var nome = body.nome || '';
  var preco = body.preco;
  var peso = body.peso || '';
  var img = body.img || '';
  var timestamp = new Date().toISOString();
  var imagemUrl = '';

  // Se veio imagem em base64, salvar no Drive
  if (body.imagemBase64 && body.imagemNome) {
    try {
      imagemUrl = salvarImagemDrive(body.imagemBase64, body.imagemNome);
      img = imagemUrl;
    } catch (e) {
      // Se falhar upload, continuar sem imagem nova
      imagemUrl = '';
    }
  }

  if (acao === 'adicionar') {
    sheet.appendRow([timestamp, modelo, modeloNome, nome, preco, peso, img]);
    return { sucesso: true, mensagem: 'Peca adicionada: ' + nome, imagemUrl: imagemUrl };
  }

  if (acao === 'editar') {
    var data = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === modelo && data[i][3].toString().toLowerCase() === nome.toLowerCase()) {
        sheet.getRange(i + 1, 1, 1, 7).setValues([[timestamp, modelo, modeloNome, nome, preco, peso, img]]);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([timestamp, modelo, modeloNome, nome, preco, peso, img]);
    }
    return { sucesso: true, mensagem: 'Peca atualizada: ' + nome, imagemUrl: imagemUrl };
  }

  if (acao === 'excluir') {
    var data2 = sheet.getDataRange().getValues();
    for (var j = 1; j < data2.length; j++) {
      if (data2[j][1] === modelo && data2[j][3].toString().toLowerCase() === nome.toLowerCase()) {
        sheet.deleteRow(j + 1);
        return { sucesso: true, mensagem: 'Peca excluida: ' + nome };
      }
    }
    return { sucesso: true, mensagem: 'Peca nao encontrada na planilha (ja removida da memoria)' };
  }

  return { sucesso: false, erro: 'Acao de peca desconhecida: ' + acao };
}

/**
 * Lista todas as pecas salvas na aba "Pecas"
 */
function listarPecasSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_PECAS);
  if (!sheet) {
    return { sucesso: true, pecas: [] };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { sucesso: true, pecas: [] };
  }

  var pecas = [];
  for (var i = 1; i < data.length; i++) {
    pecas.push({
      modelo: data[i][1] || '',
      modeloNome: data[i][2] || '',
      nome: data[i][3] || '',
      preco: data[i][4],
      peso: data[i][5] || '',
      img: data[i][6] || ''
    });
  }

  return { sucesso: true, pecas: pecas };
}

// ========================================
// ESTOQUE (STOCK CONTROL)
// ========================================

/**
 * Obtem ou cria a aba "Estoque"
 * Colunas: Modelo | Peca | Sumare | Jaragua | UltimaAtualizacao
 */
function getOrCreateAbaEstoque() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_ESTOQUE);
  if (!sheet) {
    sheet = ss.insertSheet(ABA_ESTOQUE);
    sheet.getRange(1, 1, 1, 5).setValues([['Modelo', 'Peca', 'Sumare', 'Jaragua', 'UltimaAtualizacao']]);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Lista todo o estoque
 */
function listarEstoque() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_ESTOQUE);
  if (!sheet) {
    return { sucesso: true, estoque: [] };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { sucesso: true, estoque: [] };
  }

  var estoque = [];
  for (var i = 1; i < data.length; i++) {
    estoque.push({
      modelo: data[i][0] || '',
      peca: data[i][1] || '',
      sumare: parseInt(data[i][2]) || 0,
      jaragua: parseInt(data[i][3]) || 0,
      ultimaAtualizacao: data[i][4] || ''
    });
  }

  return { sucesso: true, estoque: estoque };
}

/**
 * Busca estoque de uma peca especifica
 */
function buscarEstoque(modelo, peca) {
  if (!modelo || !peca) return { sucesso: false, erro: 'Modelo e peca sao obrigatorios' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_ESTOQUE);
  if (!sheet) {
    return { sucesso: true, estoque: null };
  }

  var data = sheet.getDataRange().getValues();
  var modeloLower = modelo.toLowerCase();
  var pecaLower = peca.toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === modeloLower &&
        String(data[i][1]).toLowerCase() === pecaLower) {
      return {
        sucesso: true,
        estoque: {
          modelo: data[i][0],
          peca: data[i][1],
          sumare: parseInt(data[i][2]) || 0,
          jaragua: parseInt(data[i][3]) || 0,
          ultimaAtualizacao: data[i][4] || ''
        }
      };
    }
  }

  return { sucesso: true, estoque: null };
}

/**
 * Atualiza estoque (set absoluto)
 * body: { modelo, peca, sumare, jaragua }
 */
function atualizarEstoque(body) {
  var sheet = getOrCreateAbaEstoque();
  var modelo = body.modelo || '';
  var peca = body.peca || '';
  var sumare = parseInt(body.sumare) || 0;
  var jaragua = parseInt(body.jaragua) || 0;
  var timestamp = new Date().toISOString();

  if (!modelo || !peca) {
    return { sucesso: false, erro: 'Modelo e peca sao obrigatorios' };
  }

  var data = sheet.getDataRange().getValues();
  var modeloLower = modelo.toLowerCase();
  var pecaLower = peca.toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === modeloLower &&
        String(data[i][1]).toLowerCase() === pecaLower) {
      sheet.getRange(i + 1, 1, 1, 5).setValues([[modelo, peca, sumare, jaragua, timestamp]]);
      return { sucesso: true, mensagem: 'Estoque atualizado: ' + peca + ' (' + modelo + ')' };
    }
  }

  // Nao encontrou, criar nova linha
  sheet.appendRow([modelo, peca, sumare, jaragua, timestamp]);
  return { sucesso: true, mensagem: 'Estoque criado: ' + peca + ' (' + modelo + ')' };
}

/**
 * Baixa de estoque (decrementa)
 * body: { modelo, peca, localizacao ('sumare' ou 'jaragua'), quantidade }
 */
function baixaEstoque(body) {
  var sheet = getOrCreateAbaEstoque();
  var modelo = body.modelo || '';
  var peca = body.peca || '';
  var localizacao = (body.localizacao || '').toLowerCase();
  var quantidade = parseInt(body.quantidade) || 1;
  var timestamp = new Date().toISOString();

  if (!modelo || !peca) {
    return { sucesso: false, erro: 'Modelo e peca sao obrigatorios' };
  }

  if (localizacao !== 'sumare' && localizacao !== 'jaragua') {
    return { sucesso: false, erro: 'Localizacao deve ser "sumare" ou "jaragua"' };
  }

  var data = sheet.getDataRange().getValues();
  var modeloLower = modelo.toLowerCase();
  var pecaLower = peca.toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === modeloLower &&
        String(data[i][1]).toLowerCase() === pecaLower) {
      var col = localizacao === 'sumare' ? 3 : 4; // coluna C ou D (1-indexed)
      var atual = parseInt(data[i][col - 1]) || 0;
      var novo = Math.max(0, atual - quantidade);
      sheet.getRange(i + 1, col).setValue(novo);
      sheet.getRange(i + 1, 5).setValue(timestamp);
      return {
        sucesso: true,
        mensagem: 'Baixa de ' + quantidade + ' unidade(s) de ' + peca + ' em ' + localizacao,
        estoqueAnterior: atual,
        estoqueAtual: novo
      };
    }
  }

  return { sucesso: true, mensagem: 'Peca nao encontrada no estoque, baixa ignorada' };
}

// ========================================
// ASSISTÊNCIA TÉCNICA - OS
// ========================================

function garantirAbaAssistencias() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABA_ASSISTENCIAS);
  if (!aba) {
    aba = ss.insertSheet(ABA_ASSISTENCIAS);
    var cabecalho = [
      'DATA ABERTURA', 'NUMERO OS', 'NOME CLIENTE', 'TELEFONE CLIENTE',
      'CIDADE', 'MODELO', 'NUMERO CHASSI', 'DATA COMPRA',
      'NOTA FISCAL COMPRA', 'TIPO', 'ASSISTENCIA', 'PROBLEMA RELATADO',
      'OBSERVACOES', 'STATUS', 'NF ASSISTENCIA RECEBIDA', 'PAGAMENTO FEITO'
    ];
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  return aba;
}

function obterProximoNumeroOS() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var aba = garantirAbaAssistencias();
    return obterProximoNumeroOSSemLock_(aba);
  } finally {
    lock.releaseLock();
  }
}

// Helper interno — lógica de numeração sem lock aninhado
function obterProximoNumeroOSSemLock_(aba) {
  var ultimaLinha = aba.getLastRow();
  var anoAtual = new Date().getFullYear();
  var prefixo = 'OS-' + anoAtual + '-';

  var maiorSeq = 0;
  if (ultimaLinha > 1) {
    var numeros = aba.getRange(2, 2, ultimaLinha - 1, 1).getValues();
    for (var i = 0; i < numeros.length; i++) {
      var num = String(numeros[i][0] || '');
      if (num.indexOf(prefixo) === 0) {
        var seq = parseInt(num.substring(prefixo.length), 10);
        if (!isNaN(seq) && seq > maiorSeq) maiorSeq = seq;
      }
    }
  }

  return prefixo + String(maiorSeq + 1).padStart(4, '0');
}

function registrarOS(dados) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var aba = garantirAbaAssistencias();
    var numeroOS = obterProximoNumeroOSSemLock_(aba);

    var linha = [
      new Date(),
      numeroOS,
      dados.nomeCliente || '',
      dados.telefoneCliente || '',
      dados.cidade || '',
      dados.modelo || '',
      dados.numeroChassi || '',
      dados.dataCompra || '',
      dados.notaFiscalCompra || '',
      dados.tipo || '',
      dados.assistencia || '',
      dados.problemaRelatado || '',
      dados.observacoes || '',
      'Em andamento',
      'Não',
      'Não'
    ];

    aba.appendRow(linha);

    return { sucesso: true, numeroOS: numeroOS };
  } catch (err) {
    return { sucesso: false, erro: err.message };
  } finally {
    lock.releaseLock();
  }
}
