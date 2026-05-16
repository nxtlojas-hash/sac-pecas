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

var BLING_API_BASE = 'https://api.bling.com.br/Api/v3';
var PASTA_PDF_ORCAMENTOS = '1rTamTXwXDFWIi_0YLgFD1MdzMigcPlNr';
var ABA_ORCAMENTOS = 'Orcamentos';
var ABA_REGISTROS = 'Registros';
var ABA_PECAS = 'Pecas';
var ABA_ESTOQUE = 'Estoque';
var ABA_ASSISTENCIAS = 'AssistenciasTecnicas';
var ABA_CADASTRO_ASSISTENCIAS = 'AssistenciasCadastro';

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
    totalCalculado += Math.round(novoPreco * (parseInt(produtos[k].quantidade) || 1) * 100) / 100;
  }

  totalCalculado = Math.round(totalCalculado * 100) / 100;

  var ultimo = produtos[produtos.length - 1];
  var qtdUltimo = parseInt(ultimo.quantidade) || 1;
  var valorRestante = Math.round((totalAlvo - totalCalculado) * 100) / 100;
  var novoPrecoUltimo = Math.round((valorRestante / qtdUltimo) * 100) / 100;
  var somaUltimo = Math.round(novoPrecoUltimo * qtdUltimo * 100) / 100;
  var residual = Math.round((valorRestante - somaUltimo) * 100) / 100;

  if (qtdUltimo === 1 || residual === 0) {
    // Caso simples: 1 unidade absorve o residual diretamente
    ultimo.precoUnitario = Math.round(valorRestante * 100) / 100;
  } else {
    // Quantidade > 1 e há residual de centavos.
    // Divide o último item em duas linhas: (qtd-1) ao preço base + 1 ao preço ajustado
    ultimo.quantidade = qtdUltimo - 1;
    ultimo.precoUnitario = novoPrecoUltimo;
    var ultimoExtra = Object.assign({}, ultimo);
    ultimoExtra.quantidade = 1;
    ultimoExtra.precoUnitario = Math.round((novoPrecoUltimo + residual) * 100) / 100;
    produtos.push(ultimoExtra);
  }

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

      case 'listar_movimentacoes':
        var filtros = {
          dataDe: e.parameter.dataDe,
          dataAte: e.parameter.dataAte,
          tipo: e.parameter.tipo,
          armazem: e.parameter.armazem,
          modelo: e.parameter.modelo,
          peca: e.parameter.peca,
          operador: e.parameter.operador,
          limite: e.parameter.limite
        };
        return jsonResponse(listarMovimentacoes(filtros));

      case 'listar_atendimentos':
        var filtrosAt = {
          status: e.parameter.status,
          categoria: e.parameter.categoria,
          vendedor: e.parameter.vendedor,
          dataDe: e.parameter.dataDe,
          dataAte: e.parameter.dataAte,
          busca: e.parameter.busca,
          limite: e.parameter.limite
        };
        return jsonResponse(listarAtendimentos(filtrosAt));

      case 'buscar_cliente_consolidado':
        return jsonResponse(buscarClienteConsolidado({
          cpf: e.parameter.cpf,
          telefone: e.parameter.telefone,
          nome: e.parameter.nome
        }));

      // --- Assistencias Tecnicas (cadastro) ---
      case 'listar_assistencias':
        return jsonResponse(listarAssistenciasCadastro());

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

      case 'salvar_assistencia':
        return jsonResponse(upsertAssistenciaCadastro(body.nome, body.endereco, body.telefone));

      // --- Atendimentos (NXT SAC Fase 1) ---
      case 'registrar_atendimento':
        return jsonResponse(registrarAtendimento(body));

      case 'vincular_doc_atendimento':
        return jsonResponse(vincularDocAtendimento(body));

      case 'atualizar_atendimento':
        return jsonResponse(atualizarAtendimento(body));

      case 'marcar_nps_enviado':
        return jsonResponse(marcarNpsEnviado(body));

      // --- Movimentacoes de Estoque (Fase E1 NXT SAC) ---
      case 'registrar_movimentacao':
        return jsonResponse(registrarMovimentacao(body));

      case 'registrar_inventario_lote':
        return jsonResponse(registrarInventarioLote(body));

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

  // Fase 2: vincular ao atendimento se presente no payload
  if (dados.atendimentoId) {
    try {
      var colAtOrc = getColAtendimentoId(sheet);
      if (colAtOrc > 0) {
        var ultLinhaOrc = sheet.getLastRow();
        sheet.getRange(ultLinhaOrc, colAtOrc).setValue(dados.atendimentoId);
      }
    } catch (eAt) { /* nao bloqueia o fluxo */ }
  }

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

    // Fase 2: vincular ao atendimento se presente no payload
    if (dados.atendimentoId) {
      try {
        var colAtVenda = getColAtendimentoId(sheetReg);
        if (colAtVenda > 0) {
          var ultLinhaVenda = sheetReg.getLastRow();
          sheetReg.getRange(ultLinhaVenda, colAtVenda).setValue(dados.atendimentoId);
        }
      } catch (eAt) { /* nao bloqueia o fluxo */ }
    }
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
 * Baixa de estoque a partir de uma venda registrada.
 * body: { modelo, peca, sumare, jaragua, vendaId, vendedor }
 * Cria 1 movimentacao tipo Saida em cada armazem com qtd > 0.
 * Mantem retrocompat: continua atualizando aba Estoque atraves de registrarMovimentacao.
 */
function baixaEstoque(body) {
  var modelo = body.modelo || '';
  var peca = body.peca || '';
  var sumare = parseInt(body.sumare) || 0;
  var jaragua = parseInt(body.jaragua) || 0;
  var vendaId = body.vendaId || '';
  var vendedor = body.vendedor || '';

  if (!modelo || !peca) {
    return { sucesso: false, erro: 'Modelo e peca sao obrigatorios' };
  }
  if (sumare === 0 && jaragua === 0) {
    return { sucesso: false, erro: 'Quantidade Sumare/Jaragua nao informada' };
  }

  var resultados = [];
  var origem = vendaId ? 'Baixa venda ' + vendaId : 'Baixa venda';

  if (sumare > 0) {
    var rS = registrarMovimentacao({
      tipo: 'Saida',
      armazem: 'Sumare',
      modelo: modelo,
      peca: peca,
      quantidade: sumare,
      origem: origem,
      operador: vendedor || 'sistema',
      observacoes: '',
      docVinculado: vendaId
    });
    resultados.push({ armazem: 'Sumare', resp: rS });
  }
  if (jaragua > 0) {
    var rJ = registrarMovimentacao({
      tipo: 'Saida',
      armazem: 'Jaragua',
      modelo: modelo,
      peca: peca,
      quantidade: jaragua,
      origem: origem,
      operador: vendedor || 'sistema',
      observacoes: '',
      docVinculado: vendaId
    });
    resultados.push({ armazem: 'Jaragua', resp: rJ });
  }

  var todasOk = resultados.every(function(r) { return r.resp && r.resp.sucesso; });
  return {
    sucesso: todasOk,
    resultados: resultados
  };
}

// ========================================
// ASSISTÊNCIA TÉCNICA - OS
// ========================================

function garantirAbaAssistencias() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABA_ASSISTENCIAS);
  var cabecalho = [
    'DATA ABERTURA', 'NUMERO OS', 'NOME CLIENTE', 'CPF CLIENTE', 'TELEFONE CLIENTE',
    'CEP CLIENTE', 'ENDERECO CLIENTE', 'NUMERO CLIENTE', 'BAIRRO CLIENTE',
    'CIDADE', 'UF CLIENTE',
    'MODELO', 'NUMERO CHASSI', 'DATA COMPRA', 'NOTA FISCAL COMPRA',
    'TIPO', 'ASSISTENCIA', 'ENDERECO ASSISTENCIA', 'TELEFONE ASSISTENCIA',
    'PROBLEMA RELATADO', 'OBSERVACOES',
    'STATUS', 'NF ASSISTENCIA RECEBIDA', 'PAGAMENTO FEITO'
  ];
  if (!aba) {
    aba = ss.insertSheet(ABA_ASSISTENCIAS);
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
    aba.setFrozenRows(1);
  } else {
    // Migração: se a aba existe mas tem menos colunas que o cabeçalho novo, reescreve o cabeçalho
    var colsAtuais = aba.getLastColumn();
    if (colsAtuais < cabecalho.length) {
      aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
    }
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
    // Garante a aba de cadastro de assistências também (mesmo que o upsert abaixo não rode)
    garantirAbaCadastroAssistencias();
    var numeroOS = obterProximoNumeroOSSemLock_(aba);

    var linha = [
      new Date(),
      numeroOS,
      dados.nomeCliente || '',
      dados.cpfCliente || '',
      dados.telefoneCliente || '',
      dados.cepCliente || '',
      dados.enderecoCliente || '',
      dados.numeroCliente || '',
      dados.bairroCliente || '',
      dados.cidade || '',
      dados.ufCliente || '',
      dados.modelo || '',
      dados.numeroChassi || '',
      dados.dataCompra || '',
      dados.notaFiscalCompra || '',
      dados.tipo || '',
      dados.assistencia || '',
      dados.assistenciaEndereco || '',
      dados.assistenciaTelefone || '',
      dados.problemaRelatado || '',
      dados.observacoes || '',
      'Em andamento',
      'Não',
      'Não'
    ];

    aba.appendRow(linha);

    // Fase 2: vincular ao atendimento se presente no payload
    if (dados.atendimentoId) {
      try {
        var colAtOS = getColAtendimentoId(aba);
        if (colAtOS > 0) {
          var ultLinhaOS = aba.getLastRow();
          aba.getRange(ultLinhaOS, colAtOS).setValue(dados.atendimentoId);
        }
      } catch (eAt) { /* nao bloqueia o fluxo */ }
    }

    // Upsert automático no cadastro de assistências quando há dados preenchidos
    if (dados.assistencia && (dados.assistenciaEndereco || dados.assistenciaTelefone)) {
      try {
        upsertAssistenciaCadastro(dados.assistencia, dados.assistenciaEndereco, dados.assistenciaTelefone);
      } catch (upErr) {
        // Falha silenciosa — não bloqueia a OS
      }
    }

    return { sucesso: true, numeroOS: numeroOS };
  } catch (err) {
    return { sucesso: false, erro: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ========================================
// CADASTRO DE ASSISTÊNCIAS (persistência nome+endereço+telefone)
// ========================================

// Seed inicial (extraído do KMZ oficial)
var ASSISTENCIAS_SEED_ = [
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

function garantirAbaCadastroAssistencias() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABA_CADASTRO_ASSISTENCIAS);
  if (!aba) {
    aba = ss.insertSheet(ABA_CADASTRO_ASSISTENCIAS);
    aba.getRange(1, 1, 1, 4).setValues([['NOME', 'ENDERECO', 'TELEFONE', 'ATUALIZADO_EM']]).setFontWeight('bold');
    aba.setFrozenRows(1);
    // Seed inicial
    var seed = ASSISTENCIAS_SEED_.map(function(n) { return [n, '', '', '']; });
    if (seed.length) aba.getRange(2, 1, seed.length, 4).setValues(seed);
  }
  return aba;
}

function listarAssistenciasCadastro() {
  var aba = garantirAbaCadastroAssistencias();
  var lastRow = aba.getLastRow();
  if (lastRow < 2) return { sucesso: true, assistencias: [] };
  var data = aba.getRange(2, 1, lastRow - 1, 4).getValues();
  var lista = data
    .filter(function(r) { return r[0] && String(r[0]).trim(); })
    .map(function(r) {
      return {
        nome: String(r[0]).trim(),
        endereco: String(r[1] || '').trim(),
        telefone: String(r[2] || '').trim(),
        atualizadoEm: r[3] ? new Date(r[3]).toISOString() : ''
      };
    });
  return { sucesso: true, assistencias: lista };
}

function upsertAssistenciaCadastro(nome, endereco, telefone) {
  nome = (nome || '').trim();
  endereco = (endereco || '').trim();
  telefone = (telefone || '').trim();
  if (!nome) return { sucesso: false, erro: 'Nome é obrigatório' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var aba = garantirAbaCadastroAssistencias();
    var lastRow = aba.getLastRow();
    var agora = new Date();

    if (lastRow >= 2) {
      var nomes = aba.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < nomes.length; i++) {
        if (String(nomes[i][0]).trim().toLowerCase() === nome.toLowerCase()) {
          var rowIdx = i + 2;
          // Só atualiza se veio algo (não apaga dado existente com string vazia)
          if (endereco) aba.getRange(rowIdx, 2).setValue(endereco);
          if (telefone) aba.getRange(rowIdx, 3).setValue(telefone);
          aba.getRange(rowIdx, 4).setValue(agora);
          return { sucesso: true, acao: 'atualizado', nome: nome };
        }
      }
    }

    aba.appendRow([nome, endereco, telefone, agora]);
    return { sucesso: true, acao: 'criado', nome: nome };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// ATENDIMENTOS (NXT SAC Fase 1)
// ============================================================

var SHEET_ATENDIMENTOS = 'Atendimentos';

/**
 * Executar UMA VEZ no editor do Apps Script.
 * Cria a aba "Atendimentos" com os 16 cabecalhos.
 * Idempotente: se a aba ja existir, nao quebra (so confere os cabecalhos).
 */
function setupAtendimentos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ATENDIMENTOS);
  var headers = [
    'id', 'dataAbertura', 'categoria', 'motivo', 'origem',
    'nomeCliente', 'telefone', 'cpfCnpj', 'notaFiscal', 'modeloEquipamento',
    'descricao', 'vendedor', 'status', 'dataFechamento', 'motivoFechamento',
    'npsEnviado'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ATENDIMENTOS);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#c6ff00');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
    Logger.log('Aba "Atendimentos" criada com ' + headers.length + ' colunas.');
    return 'Aba "Atendimentos" criada com sucesso.';
  }

  // Aba ja existe — verificar cabecalhos
  var rangeHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var diff = [];
  for (var i = 0; i < headers.length; i++) {
    if (rangeHeaders[i] !== headers[i]) diff.push((i + 1) + ': "' + rangeHeaders[i] + '" != "' + headers[i] + '"');
  }
  if (diff.length === 0) {
    Logger.log('Aba "Atendimentos" ja existe com cabecalhos corretos.');
    return 'Aba ja existe e esta OK.';
  } else {
    Logger.log('Aba "Atendimentos" existe mas cabecalhos divergem:\n' + diff.join('\n'));
    return 'Aba existe mas cabecalhos divergem. Veja Logger.';
  }
}

function registrarAtendimento(payload) {
  try {
    var id = gerarProximoIdAtendimento();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_ATENDIMENTOS);
    if (!sheet) {
      return { sucesso: false, erro: 'Aba "Atendimentos" nao existe. Crie no Sheets primeiro.' };
    }

    var agora = new Date();
    sheet.appendRow([
      id,                              // A: id
      agora,                           // B: dataAbertura
      payload.categoria || '',         // C
      payload.motivo || '',            // D
      payload.origem || '',            // E
      payload.nomeCliente || '',       // F
      payload.telefone || '',          // G
      payload.cpfCnpj || '',           // H
      payload.notaFiscal || '',        // I
      payload.modeloEquipamento || '', // J
      payload.descricao || '',         // K
      payload.vendedor || '',          // L
      'Aberto',                        // M: status
      '',                              // N: dataFechamento
      '',                              // O: motivoFechamento
      false                            // P: npsEnviado
    ]);

    return { sucesso: true, id: id };
  } catch (err) {
    return { sucesso: false, erro: String(err) };
  }
}

/**
 * Atualiza status de um atendimento existente.
 * payload: { id, status, motivoFechamento? }
 * Se status = 'Resolvido' ou 'Fechado', preenche dataFechamento com agora.
 */
function atualizarAtendimento(payload) {
  if (!payload || !payload.id) return { sucesso: false, erro: 'id obrigatorio' };
  if (!payload.status) return { sucesso: false, erro: 'status obrigatorio' };

  var statusValidos = ['Aberto', 'Em andamento', 'Aguardando cliente', 'Resolvido', 'Fechado'];
  if (statusValidos.indexOf(payload.status) === -1) {
    return { sucesso: false, erro: 'status invalido' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_ATENDIMENTOS);
    if (!sheet) return { sucesso: false, erro: 'Aba Atendimentos nao encontrada' };

    var ultLinha = sheet.getLastRow();
    if (ultLinha < 2) return { sucesso: false, erro: 'Aba vazia' };

    var dados = sheet.getRange(2, 1, ultLinha - 1, 1).getValues();
    var linha = 0;
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][0]) === String(payload.id)) { linha = i + 2; break; }
    }
    if (linha === 0) return { sucesso: false, erro: 'Atendimento ' + payload.id + ' nao encontrado' };

    // Coluna M (13) = status, N (14) = dataFechamento, O (15) = motivoFechamento
    sheet.getRange(linha, 13).setValue(payload.status);

    var fechamento = (payload.status === 'Resolvido' || payload.status === 'Fechado');
    if (fechamento) {
      sheet.getRange(linha, 14).setValue(new Date());
      if (payload.motivoFechamento) {
        sheet.getRange(linha, 15).setValue(payload.motivoFechamento);
      }
    } else {
      // Limpa data e motivo se voltou pra status nao-final
      sheet.getRange(linha, 14).setValue('');
      sheet.getRange(linha, 15).setValue('');
    }

    return { sucesso: true, id: payload.id, status: payload.status };
  } catch (err) {
    return { sucesso: false, erro: String(err) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Marca npsEnviado=true em um atendimento.
 * payload: { id }
 */
function marcarNpsEnviado(payload) {
  if (!payload || !payload.id) return { sucesso: false, erro: 'id obrigatorio' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_ATENDIMENTOS);
    if (!sheet) return { sucesso: false, erro: 'Aba Atendimentos nao encontrada' };

    var ultLinha = sheet.getLastRow();
    if (ultLinha < 2) return { sucesso: false, erro: 'Aba vazia' };

    var dados = sheet.getRange(2, 1, ultLinha - 1, 1).getValues();
    var linha = 0;
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][0]) === String(payload.id)) { linha = i + 2; break; }
    }
    if (linha === 0) return { sucesso: false, erro: 'Atendimento ' + payload.id + ' nao encontrado' };

    sheet.getRange(linha, 16).setValue(true); // Coluna P = npsEnviado
    return { sucesso: true, id: payload.id };
  } catch (err) {
    return { sucesso: false, erro: String(err) };
  } finally {
    lock.releaseLock();
  }
}

function gerarProximoIdAtendimento() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ano = new Date().getFullYear();
    var prefix = 'PV-' + ano + '-';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_ATENDIMENTOS);
    if (!sheet) throw new Error('Aba Atendimentos nao encontrada');

    var ultLinha = sheet.getLastRow();
    if (ultLinha < 2) return prefix + '0001';

    var dados = sheet.getRange(2, 1, ultLinha - 1, 1).getValues();
    var maior = 0;
    for (var i = 0; i < dados.length; i++) {
      var v = String(dados[i][0] || '');
      if (v.indexOf(prefix) === 0) {
        var n = parseInt(v.substring(prefix.length), 10);
        if (!isNaN(n) && n > maior) maior = n;
      }
    }
    var prox = maior + 1;
    var num = ('0000' + prox).slice(-4);
    return prefix + num;
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// MOVIMENTACOES DE ESTOQUE (Fase E1 NXT SAC)
// ============================================================

var SHEET_MOVIMENTACOES = 'MovimentacoesEstoque';

/**
 * Executar UMA VEZ no editor do Apps Script.
 * Cria a aba "MovimentacoesEstoque" com os 11 cabecalhos.
 * Idempotente: se a aba ja existir, verifica os cabecalhos.
 */
function setupMovimentacoesEstoque() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_MOVIMENTACOES);
  var headers = [
    'id', 'dataHora', 'tipo', 'armazem',
    'modelo', 'peca', 'quantidade',
    'origem', 'operador', 'observacoes', 'docVinculado'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_MOVIMENTACOES);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#1a1a2e')
         .setFontColor('#c6ff00');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
    Logger.log('Aba "MovimentacoesEstoque" criada com ' + headers.length + ' colunas.');
    return 'Aba "MovimentacoesEstoque" criada com sucesso.';
  }

  var rangeHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var diff = [];
  for (var i = 0; i < headers.length; i++) {
    if (rangeHeaders[i] !== headers[i]) {
      diff.push((i + 1) + ': "' + rangeHeaders[i] + '" != "' + headers[i] + '"');
    }
  }
  if (diff.length === 0) {
    Logger.log('Aba "MovimentacoesEstoque" ja existe e esta OK.');
    return 'Aba ja existe e esta OK.';
  } else {
    Logger.log('Aba "MovimentacoesEstoque" tem cabecalhos divergentes:\n' + diff.join('\n'));
    return 'Aba existe mas cabecalhos divergem. Veja Logger.';
  }
}

function gerarProximoIdMovimentacao() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ano = new Date().getFullYear();
    var prefix = 'MOV-' + ano + '-';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_MOVIMENTACOES);
    if (!sheet) throw new Error('Aba MovimentacoesEstoque nao encontrada. Rode setupMovimentacoesEstoque primeiro.');

    var ultLinha = sheet.getLastRow();
    if (ultLinha < 2) return prefix + '0001';

    var dados = sheet.getRange(2, 1, ultLinha - 1, 1).getValues();
    var maior = 0;
    for (var i = 0; i < dados.length; i++) {
      var v = String(dados[i][0] || '');
      if (v.indexOf(prefix) === 0) {
        var n = parseInt(v.substring(prefix.length), 10);
        if (!isNaN(n) && n > maior) maior = n;
      }
    }
    var prox = maior + 1;
    var num = ('0000' + prox).slice(-4);
    return prefix + num;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Registra uma movimentacao e atualiza o saldo na aba Estoque.
 * payload: { tipo, armazem, modelo, peca, quantidade, origem, operador, observacoes, docVinculado }
 * tipo: "Entrada" | "Saida" | "Ajuste"
 * armazem: "Sumare" | "Jaragua"
 * quantidade: numero POSITIVO. O sinal e aplicado baseado no tipo:
 *   - Entrada: +qtd
 *   - Saida:   -qtd
 *   - Ajuste:  +/- qtd (recebe sinal do payload, pode ser negativo)
 */
function registrarMovimentacao(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var erro = validarPayloadMovimentacao(payload);
    if (erro) return { sucesso: false, erro: erro };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetMov = ss.getSheetByName(SHEET_MOVIMENTACOES);
    if (!sheetMov) {
      return { sucesso: false, erro: 'Aba MovimentacoesEstoque nao existe. Rode setupMovimentacoesEstoque.' };
    }

    var qtdSignal = aplicarSinalQuantidade(payload.tipo, payload.quantidade);
    var id = gerarProximoIdMovimentacao();
    var agora = new Date();

    sheetMov.appendRow([
      id,
      agora,
      payload.tipo,
      payload.armazem,
      payload.modelo,
      payload.peca,
      qtdSignal,
      payload.origem || '',
      payload.operador || '',
      payload.observacoes || '',
      payload.docVinculado || ''
    ]);

    var novoSaldo = atualizarSaldoEstoque(payload.armazem, payload.modelo, payload.peca, qtdSignal);

    return {
      sucesso: true,
      id: id,
      saldoAtual: novoSaldo,
      armazem: payload.armazem
    };
  } catch (err) {
    return { sucesso: false, erro: String(err) };
  } finally {
    lock.releaseLock();
  }
}

function validarPayloadMovimentacao(p) {
  if (!p) return 'payload vazio';
  if (['Entrada', 'Saida', 'Ajuste'].indexOf(p.tipo) === -1) return 'tipo invalido (esperado: Entrada, Saida ou Ajuste)';
  if (['Sumare', 'Jaragua'].indexOf(p.armazem) === -1) return 'armazem invalido (esperado: Sumare ou Jaragua)';
  if (!p.modelo) return 'modelo obrigatorio';
  if (!p.peca) return 'peca obrigatoria';
  if (p.quantidade == null || isNaN(parseFloat(p.quantidade))) return 'quantidade obrigatoria';
  if (parseFloat(p.quantidade) === 0) return 'quantidade nao pode ser zero';
  if (!p.origem) return 'origem obrigatoria';
  if (!p.operador) return 'operador obrigatorio';
  return null;
}

function aplicarSinalQuantidade(tipo, qtd) {
  var n = parseFloat(qtd);
  if (tipo === 'Entrada') return Math.abs(n);
  if (tipo === 'Saida') return -Math.abs(n);
  // Ajuste: respeita sinal do input (positivo ou negativo)
  return n;
}

/**
 * Atualiza saldo de uma peca em um armazem.
 * Cria linha se a peca nao existir na aba Estoque.
 * Retorna o novo saldo do armazem.
 */
function atualizarSaldoEstoque(armazem, modelo, peca, delta) {
  var sheet = getOrCreateAbaEstoque();
  var data = sheet.getDataRange().getValues();
  var col = (armazem === 'Sumare') ? 2 : 3; // C=Sumare(2), D=Jaragua(3) - zero-indexed
  var modeloLower = String(modelo).toLowerCase();
  var pecaLower = String(peca).toLowerCase();
  var timestamp = new Date().toISOString();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === modeloLower &&
        String(data[i][1]).toLowerCase() === pecaLower) {
      var atual = parseInt(data[i][col]) || 0;
      var novo = atual + parseInt(delta);
      sheet.getRange(i + 1, col + 1).setValue(novo);
      sheet.getRange(i + 1, 5).setValue(timestamp);
      return novo;
    }
  }

  // Peca nao existe — cria nova linha
  var nova = [modelo, peca, 0, 0, timestamp];
  nova[col] = parseInt(delta);
  sheet.appendRow(nova);
  return nova[col];
}

/**
 * Lista movimentacoes com filtros opcionais.
 * filtros: { dataDe, dataAte, tipo, armazem, modelo, peca, operador }
 * Retorna ultimas 100 por default (mais recentes primeiro).
 */
function listarMovimentacoes(filtros) {
  filtros = filtros || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_MOVIMENTACOES);
  if (!sheet) return { sucesso: true, movimentacoes: [] };

  var ultLinha = sheet.getLastRow();
  if (ultLinha < 2) return { sucesso: true, movimentacoes: [] };

  var dados = sheet.getRange(2, 1, ultLinha - 1, 11).getValues();
  var dataDe = filtros.dataDe ? new Date(filtros.dataDe) : null;
  var dataAte = filtros.dataAte ? new Date(filtros.dataAte) : null;

  var resultado = [];
  for (var i = 0; i < dados.length; i++) {
    var row = dados[i];
    var mov = {
      id: row[0],
      dataHora: row[1],
      tipo: row[2],
      armazem: row[3],
      modelo: row[4],
      peca: row[5],
      quantidade: row[6],
      origem: row[7],
      operador: row[8],
      observacoes: row[9],
      docVinculado: row[10]
    };

    if (dataDe && new Date(mov.dataHora) < dataDe) continue;
    if (dataAte && new Date(mov.dataHora) > dataAte) continue;
    if (filtros.tipo && mov.tipo !== filtros.tipo) continue;
    if (filtros.armazem && mov.armazem !== filtros.armazem) continue;
    if (filtros.modelo && String(mov.modelo).toLowerCase() !== String(filtros.modelo).toLowerCase()) continue;
    if (filtros.peca && String(mov.peca).toLowerCase().indexOf(String(filtros.peca).toLowerCase()) === -1) continue;
    if (filtros.operador && String(mov.operador).toLowerCase() !== String(filtros.operador).toLowerCase()) continue;

    resultado.push(mov);
  }

  resultado.reverse(); // mais recentes primeiro

  var limite = parseInt(filtros.limite) || 100;
  if (resultado.length > limite) resultado = resultado.slice(0, limite);

  return { sucesso: true, movimentacoes: resultado, total: resultado.length };
}

/**
 * Registra inventario em lote: gera 1 ajuste por peca com diferenca diferente de zero.
 * payload: {
 *   armazem: 'Sumare' | 'Jaragua',
 *   operador: string,
 *   observacao: string,
 *   contagens: [{ modelo, peca, contado }]  // contado = qtd fisica real
 * }
 * Para cada peca: le saldo atual no armazem, calcula diferenca = contado - atual.
 * Se diferenca != 0, cria 1 movimentacao tipo Ajuste com qtd = diferenca.
 * Origem padrao: "Inventario YYYY-MM-DD" + observacao
 * Retorna { sucesso, totalAjustes, totalUnidadesMovidas, ajustes: [{modelo, peca, antes, depois, diferenca, movId}] }
 */
function registrarInventarioLote(payload) {
  if (!payload || ['Sumare', 'Jaragua'].indexOf(payload.armazem) === -1) {
    return { sucesso: false, erro: 'armazem invalido' };
  }
  if (!payload.operador) return { sucesso: false, erro: 'operador obrigatorio' };
  if (!Array.isArray(payload.contagens) || payload.contagens.length === 0) {
    return { sucesso: false, erro: 'contagens deve ser array nao vazio' };
  }

  var dataStr = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
  var origemBase = 'Inventario ' + dataStr;
  if (payload.observacao) origemBase += ' - ' + payload.observacao;

  var sheet = getOrCreateAbaEstoque();
  var data = sheet.getDataRange().getValues();
  var colArm = (payload.armazem === 'Sumare') ? 2 : 3;

  var ajustes = [];
  var totalUnidades = 0;

  for (var idx = 0; idx < payload.contagens.length; idx++) {
    var item = payload.contagens[idx];
    if (!item.modelo || !item.peca) continue;
    var contado = parseInt(item.contado);
    if (isNaN(contado) || contado < 0) continue;

    // Acha saldo atual na aba Estoque (case-insensitive)
    var modeloLower = String(item.modelo).toLowerCase();
    var pecaLower = String(item.peca).toLowerCase();
    var atual = 0;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === modeloLower &&
          String(data[i][1]).toLowerCase() === pecaLower) {
        atual = parseInt(data[i][colArm]) || 0;
        break;
      }
    }

    var diferenca = contado - atual;
    if (diferenca === 0) continue;

    // Chama registrarMovimentacao reaproveitando a logica
    var resp = registrarMovimentacao({
      tipo: 'Ajuste',
      armazem: payload.armazem,
      modelo: item.modelo,
      peca: item.peca,
      quantidade: diferenca,
      origem: origemBase,
      operador: payload.operador,
      observacoes: 'Saldo antes: ' + atual + ' / contado: ' + contado
    });

    if (resp.sucesso) {
      ajustes.push({
        modelo: item.modelo,
        peca: item.peca,
        antes: atual,
        depois: contado,
        diferenca: diferenca,
        movId: resp.id
      });
      totalUnidades += Math.abs(diferenca);
    }
  }

  return {
    sucesso: true,
    totalAjustes: ajustes.length,
    totalUnidadesMovidas: totalUnidades,
    ajustes: ajustes
  };
}

// ============================================================
// FASE 2 — Vinculacao docs ao Atendimento
// ============================================================

/**
 * Executar UMA VEZ no editor.
 * Adiciona coluna 'atendimentoId' (vazia) ao final das abas Vendas, Orcamentos, OSes
 * se ela ainda nao existir. Idempotente.
 */
function setupColunaAtendimentoId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var resultado = [];
  [ABA_REGISTROS, ABA_ORCAMENTOS, ABA_ASSISTENCIAS].forEach(function(nomeAba) {
    var sheet = ss.getSheetByName(nomeAba);
    if (!sheet) { resultado.push(nomeAba + ': aba nao existe (skip)'); return; }
    var ultimaCol = sheet.getLastColumn();
    if (ultimaCol === 0) { resultado.push(nomeAba + ': aba vazia (skip)'); return; }

    // Le linha 1 inteira
    var headers = sheet.getRange(1, 1, 1, ultimaCol).getValues()[0];
    var jaTem = headers.some(function(h) { return String(h).trim().toLowerCase() === 'atendimentoid'; });
    if (jaTem) { resultado.push(nomeAba + ': coluna ja existe'); return; }

    // Adiciona nova coluna no final
    sheet.getRange(1, ultimaCol + 1).setValue('atendimentoId');
    sheet.getRange(1, ultimaCol + 1).setFontWeight('bold');
    resultado.push(nomeAba + ': coluna atendimentoId adicionada (col ' + (ultimaCol + 1) + ')');
  });
  Logger.log(resultado.join('\n'));
  return resultado.join('; ');
}

/**
 * Retorna o indice (1-based) da coluna 'atendimentoId' em uma aba.
 * Retorna 0 se a coluna nao existir.
 */
function getColAtendimentoId(sheet) {
  if (!sheet || sheet.getLastColumn() === 0) return 0;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === 'atendimentoid') return i + 1;
  }
  return 0;
}

/**
 * Vincula um documento (PCA/ORC/OS) a um atendimento existente.
 * payload: { atendimentoId, tipoDoc: 'venda'|'orcamento'|'os', docId }
 * 1. Acha doc na aba correspondente
 * 2. Preenche coluna atendimentoId
 * 3. Atualiza docsVinculados (coluna R) do atendimento
 */
function vincularDocAtendimento(payload) {
  if (!payload || !payload.atendimentoId || !payload.docId || !payload.tipoDoc) {
    return { sucesso: false, erro: 'atendimentoId, docId e tipoDoc sao obrigatorios' };
  }

  var mapAba = {
    'venda': ABA_REGISTROS,
    'orcamento': ABA_ORCAMENTOS,
    'os': ABA_ASSISTENCIAS,
    'assistencia': ABA_ASSISTENCIAS
  };
  var nomeAba = mapAba[payload.tipoDoc];
  if (!nomeAba) return { sucesso: false, erro: 'tipoDoc invalido' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(nomeAba);
  if (!sheet) return { sucesso: false, erro: 'Aba "' + nomeAba + '" nao existe' };

  var colAt = getColAtendimentoId(sheet);
  if (colAt === 0) return { sucesso: false, erro: 'Coluna atendimentoId nao existe em ' + nomeAba + '. Rode setupColunaAtendimentoId.' };

  // Acha doc por ID (coluna A)
  var data = sheet.getDataRange().getValues();
  var linha = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(payload.docId)) { linha = i + 1; break; }
  }
  if (linha === 0) return { sucesso: false, erro: 'Doc ' + payload.docId + ' nao encontrado em ' + nomeAba };

  sheet.getRange(linha, colAt).setValue(payload.atendimentoId);

  // Atualiza docsVinculados do atendimento (coluna R, idx 18)
  var sheetAt = ss.getSheetByName(SHEET_ATENDIMENTOS);
  if (sheetAt) {
    var dadosAt = sheetAt.getDataRange().getValues();
    for (var j = 1; j < dadosAt.length; j++) {
      if (String(dadosAt[j][0]) === String(payload.atendimentoId)) {
        var rDocsVinc = j + 1;
        // Coluna docsVinculados pode ainda nao existir nesta planilha (legado)
        var ultimaCol = sheetAt.getLastColumn();
        var colDV = 0;
        var headers = sheetAt.getRange(1, 1, 1, ultimaCol).getValues()[0];
        for (var k = 0; k < headers.length; k++) {
          if (String(headers[k]).trim().toLowerCase() === 'docsvinculados') { colDV = k + 1; break; }
        }
        if (colDV === 0) {
          // Cria coluna docsVinculados
          sheetAt.getRange(1, ultimaCol + 1).setValue('docsVinculados');
          sheetAt.getRange(1, ultimaCol + 1).setFontWeight('bold');
          colDV = ultimaCol + 1;
        }
        var atual = sheetAt.getRange(rDocsVinc, colDV).getValue() || '';
        var lista = [];
        if (atual) {
          try { lista = JSON.parse(atual); if (!Array.isArray(lista)) lista = []; } catch(e) { lista = []; }
        }
        if (lista.indexOf(payload.docId) === -1) {
          lista.push(payload.docId);
          sheetAt.getRange(rDocsVinc, colDV).setValue(JSON.stringify(lista));
        }
        break;
      }
    }
  }

  return { sucesso: true, atendimentoId: payload.atendimentoId, docId: payload.docId };
}

/**
 * Lista atendimentos com filtros opcionais.
 * filtros: { status, categoria, vendedor, dataDe, dataAte, busca, limite }
 * busca: procura em nomeCliente, telefone, cpfCnpj, id (case-insensitive, substring)
 * Retorna ultimos 100 ordenados por data desc por default.
 */
function listarAtendimentos(filtros) {
  filtros = filtros || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ATENDIMENTOS);
  if (!sheet) return { sucesso: true, atendimentos: [] };

  var ultLinha = sheet.getLastRow();
  if (ultLinha < 2) return { sucesso: true, atendimentos: [] };

  var ultCol = sheet.getLastColumn();
  var dados = sheet.getRange(2, 1, ultLinha - 1, ultCol).getValues();
  var dataDe = filtros.dataDe ? new Date(filtros.dataDe) : null;
  var dataAte = filtros.dataAte ? new Date(filtros.dataAte) : null;
  var buscaLower = (filtros.busca || '').toLowerCase().trim();

  var resultado = [];
  for (var i = 0; i < dados.length; i++) {
    var row = dados[i];
    var at = {
      id: row[0],
      dataAbertura: row[1],
      categoria: row[2],
      motivo: row[3],
      origem: row[4],
      nomeCliente: row[5],
      telefone: row[6],
      cpfCnpj: row[7],
      notaFiscal: row[8],
      modeloEquipamento: row[9],
      descricao: row[10],
      vendedor: row[11],
      status: row[12],
      dataFechamento: row[13],
      motivoFechamento: row[14],
      npsEnviado: row[15],
      acoes: row[16] || '',
      docsVinculados: row[17] || ''
    };

    if (dataDe && new Date(at.dataAbertura) < dataDe) continue;
    if (dataAte && new Date(at.dataAbertura) > dataAte) continue;
    if (filtros.status && at.status !== filtros.status) continue;
    if (filtros.categoria && at.categoria !== filtros.categoria) continue;
    if (filtros.vendedor && String(at.vendedor).toLowerCase() !== String(filtros.vendedor).toLowerCase()) continue;
    if (buscaLower) {
      var hay = (String(at.id) + ' ' + at.nomeCliente + ' ' + at.telefone + ' ' + at.cpfCnpj).toLowerCase();
      if (hay.indexOf(buscaLower) === -1) continue;
    }

    resultado.push(at);
  }

  resultado.reverse(); // mais recentes primeiro

  var limite = parseInt(filtros.limite) || 100;
  if (resultado.length > limite) resultado = resultado.slice(0, limite);

  return { sucesso: true, atendimentos: resultado, total: resultado.length };
}

/**
 * Busca cliente em todas as abas (Atendimentos, Vendas, Orcamentos, OSes/Assistencias)
 * agrega tudo por CPF ou telefone (chave normalizada apenas digitos).
 * query: { cpf?, telefone?, nome? }
 * Retorna { sucesso, clientes: [...] } onde cada cliente tem:
 *   { chave, nome, cpfs, telefones, nfs, eventos }
 * eventos: [{tipo, id, data, resumo, atendimentoId}]
 */
function buscarClienteConsolidado(query) {
  query = query || {};
  var cpfQ = (query.cpf || '').replace(/\D/g, '');
  var telQ = (query.telefone || '').replace(/\D/g, '');
  var nomeQ = (query.nome || '').toLowerCase().trim();
  if (!cpfQ && !telQ && !nomeQ) {
    return { sucesso: false, erro: 'Informe cpf, telefone ou nome' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Mapa chave -> agregado
  var agregado = {};

  function chave(cpf, tel) {
    if (cpf) return 'CPF:' + cpf;
    if (tel) return 'TEL:' + tel;
    return null;
  }

  function pertence(cpf, tel, nome) {
    if (cpfQ && cpf === cpfQ) return true;
    if (telQ && tel === telQ) return true;
    if (nomeQ && nome && String(nome).toLowerCase().indexOf(nomeQ) !== -1) return true;
    return false;
  }

  function add(cpf, tel, nome, nf, evento) {
    var k = chave(cpf, tel);
    if (!k) return;
    if (!agregado[k]) {
      agregado[k] = {
        chave: k,
        nome: nome || '',
        cpfs: [],
        telefones: [],
        nfs: [],
        eventos: []
      };
    }
    var a = agregado[k];
    if (nome && !a.nome) a.nome = nome;
    if (cpf && a.cpfs.indexOf(cpf) === -1) a.cpfs.push(cpf);
    if (tel && a.telefones.indexOf(tel) === -1) a.telefones.push(tel);
    if (nf && a.nfs.indexOf(nf) === -1) a.nfs.push(nf);
    a.eventos.push(evento);
  }

  // ATENDIMENTOS
  var shAt = ss.getSheetByName(SHEET_ATENDIMENTOS);
  if (shAt && shAt.getLastRow() > 1) {
    var dadosAt = shAt.getRange(2, 1, shAt.getLastRow() - 1, 16).getValues();
    dadosAt.forEach(function(r) {
      var cpf = String(r[7] || '').replace(/\D/g, '');
      var tel = String(r[6] || '').replace(/\D/g, '');
      if (!pertence(cpf, tel, r[5])) return;
      add(cpf, tel, r[5], r[8], {
        tipo: 'atendimento',
        id: r[0],
        data: r[1],
        resumo: r[2] + ' - ' + r[3],
        categoria: r[2],
        status: r[12]
      });
    });
  }

  // VENDAS
  var shV = ss.getSheetByName(ABA_REGISTROS);
  if (shV && shV.getLastRow() > 1) {
    var ultV = shV.getLastColumn();
    var headersV = shV.getRange(1, 1, 1, ultV).getValues()[0];
    var idxCpf = headersV.indexOf('cpfCnpjCliente'); if (idxCpf < 0) idxCpf = headersV.indexOf('cpf');
    var idxTel = headersV.indexOf('telefoneCliente'); if (idxTel < 0) idxTel = headersV.indexOf('telefone');
    var idxNome = headersV.indexOf('nomeCliente'); if (idxNome < 0) idxNome = headersV.indexOf('cliente');
    var idxId = 0; // assumindo col A
    var idxData = headersV.indexOf('dataVenda'); if (idxData < 0) idxData = 1;
    var idxAt = headersV.indexOf('atendimentoId');
    var dadosV = shV.getRange(2, 1, shV.getLastRow() - 1, ultV).getValues();
    dadosV.forEach(function(r) {
      var cpf = idxCpf >= 0 ? String(r[idxCpf] || '').replace(/\D/g, '') : '';
      var tel = idxTel >= 0 ? String(r[idxTel] || '').replace(/\D/g, '') : '';
      var nome = idxNome >= 0 ? r[idxNome] : '';
      if (!pertence(cpf, tel, nome)) return;
      add(cpf, tel, nome, '', {
        tipo: 'venda',
        id: r[idxId],
        data: r[idxData],
        resumo: 'Venda registrada',
        atendimentoId: idxAt >= 0 ? r[idxAt] : ''
      });
    });
  }

  // ORCAMENTOS
  var shO = ss.getSheetByName('Orcamentos');
  if (shO && shO.getLastRow() > 1) {
    var ultO = shO.getLastColumn();
    var headersO = shO.getRange(1, 1, 1, ultO).getValues()[0];
    var iCpfO = headersO.indexOf('documento'); if (iCpfO < 0) iCpfO = headersO.indexOf('cpf');
    var iTelO = headersO.indexOf('telefone');
    var iNomeO = headersO.indexOf('cliente'); if (iNomeO < 0) iNomeO = headersO.indexOf('nome');
    var iDataO = headersO.indexOf('data'); if (iDataO < 0) iDataO = 1;
    var iAtO = headersO.indexOf('atendimentoId');
    var dadosO = shO.getRange(2, 1, shO.getLastRow() - 1, ultO).getValues();
    dadosO.forEach(function(r) {
      var cpf = iCpfO >= 0 ? String(r[iCpfO] || '').replace(/\D/g, '') : '';
      var tel = iTelO >= 0 ? String(r[iTelO] || '').replace(/\D/g, '') : '';
      var nome = iNomeO >= 0 ? r[iNomeO] : '';
      if (!pertence(cpf, tel, nome)) return;
      add(cpf, tel, nome, '', {
        tipo: 'orcamento',
        id: r[0],
        data: r[iDataO],
        resumo: 'Orcamento',
        atendimentoId: iAtO >= 0 ? r[iAtO] : ''
      });
    });
  }

  // OSes / Assistencias
  [ABA_ASSISTENCIAS].forEach(function(nomeAba) {
    var shOS = ss.getSheetByName(nomeAba);
    if (!shOS || shOS.getLastRow() < 2) return;
    var ultOS = shOS.getLastColumn();
    var headersOS = shOS.getRange(1, 1, 1, ultOS).getValues()[0];
    var iCpf = headersOS.indexOf('cpfCliente'); if (iCpf < 0) iCpf = headersOS.indexOf('cpf');
    var iTel = headersOS.indexOf('telefoneCliente'); if (iTel < 0) iTel = headersOS.indexOf('telefone');
    var iNome = headersOS.indexOf('nomeCliente'); if (iNome < 0) iNome = headersOS.indexOf('nome');
    var iNF = headersOS.indexOf('notaFiscal');
    var iData = headersOS.indexOf('dataAbertura'); if (iData < 0) iData = 1;
    var iAt = headersOS.indexOf('atendimentoId');
    var dadosOS = shOS.getRange(2, 1, shOS.getLastRow() - 1, ultOS).getValues();
    dadosOS.forEach(function(r) {
      var cpf = iCpf >= 0 ? String(r[iCpf] || '').replace(/\D/g, '') : '';
      var tel = iTel >= 0 ? String(r[iTel] || '').replace(/\D/g, '') : '';
      var nome = iNome >= 0 ? r[iNome] : '';
      var nf = iNF >= 0 ? r[iNF] : '';
      if (!pertence(cpf, tel, nome)) return;
      add(cpf, tel, nome, nf, {
        tipo: 'os',
        id: r[0],
        data: r[iData],
        resumo: 'Ordem de Servico',
        atendimentoId: iAt >= 0 ? r[iAt] : ''
      });
    });
  });

  // Converter mapa em array, ordenar eventos por data desc
  var clientes = [];
  Object.keys(agregado).forEach(function(k) {
    var c = agregado[k];
    c.eventos.sort(function(a, b) { return new Date(b.data) - new Date(a.data); });
    c.totalEventos = c.eventos.length;
    clientes.push(c);
  });

  return { sucesso: true, clientes: clientes };
}
