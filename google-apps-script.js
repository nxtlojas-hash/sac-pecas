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

// Planilha SEPARADA "SAC Orcamentos" (decisao 21/07/2026): os NOVOS orcamentos gravam
// nela; os antigos ficam na planilha ativa "Pedido de pecas" como historico (tela limpa).
// Runtime le a ScriptProperty 'ORCAMENTOS_SHEET_ID' primeiro; a constante abaixo e o
// fallback versionado — preenchida depois de rodar setupOrcamentosSpreadsheet() no editor.
var ORCAMENTOS_SHEET_ID = '1HoYsY9rQKZnJv91z_gJ-5_phKSo8L0Xci7MraByObZw';
var ORC_HEADERS = [
  'Numero', 'Data', 'DataValidade', 'Status', 'DataAprovacao',
  'ClienteNome', 'ClienteTelefone', 'ClienteDocumento', 'ClienteEmail',
  'Vendedor', 'Pecas', 'PesoTotal', 'Total', 'Observacoes', 'PdfUrl', 'atendimentoId'
];

var ABA_REGISTROS = 'Registros';
var ABA_PECAS = 'Pecas';
var ABA_ESTOQUE = 'Estoque';
var ABA_ASSISTENCIAS = 'AssistenciasTecnicas';
var ABA_CADASTRO_ASSISTENCIAS = 'AssistenciasCadastro';

// Abas espelho do roteamento de OS (spec 2026-07-12). Nomes reais na planilha
// tem espacos extras — localizar SEMPRE via encontrarAbaNormalizada_.
var ABA_ESPELHO_SUMARE = 'ASSISTÊNCIA SUMARÉ';
var ABA_ESPELHO_PARCEIRAS = 'Assistencias parceiras';

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

  // Renovar sob lock: o Bling troca o refresh_token a cada renovacao e revoga a
  // cadeia inteira se o token antigo for reusado — duas execucoes renovando ao
  // mesmo tempo (ou uma rotacao salva pela metade) matam a integracao
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Reler depois do lock: outra execucao pode ter acabado de renovar
    tokens = getBlingTokens();
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
  } finally {
    lock.releaseLock();
  }
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
      'NOME DO CLIENTE', 'STATUS', 'DATA ENVIO RODONAVES', 'NF', 'SOLICITACAO', 'URGENCIA',
      'ENVIO', 'TELEFONE', 'ENDERECO', 'BAIRRO', 'CIDADE/ESTADO', 'CEP',
      'PEDIDO DE PECAS', 'TIPO DE PECA', 'MODELO', 'COR',
      'QTD', 'TOTAL PECA (R$)', 'PAGAMENTO', 'PREV. EMBARQUE',
      'FRETE (R$)', 'TOTAL GERAL (R$)',
      '', '', 'PESO / VOLUME', 'OBS',
      'BLING STATUS', 'BLING PEDIDO ID', 'FECHAMENTO'
    ]);
    var headerRange = sheet.getRange(1, 1, 1, 34);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1a1a2e');
    headerRange.setFontColor('#c6ff00');
  }

  // Garante a coluna H (DATA ENVIO RODONAVES) antes de gravar a linha
  garantirColunaRodonaves_(sheet);

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
    '',                                                             // H - DATA ENVIO RODONAVES (manual)
    '',                                                             // I - NF (manual)
    dados.tipoAtendimento || '',                                    // J - SOLICITACAO
    urgLabels[dados.urgencia] || dados.urgencia || '',               // K - URGENCIA
    transpLabels[dados.transportadora] || dados.transportadora || '',// L - ENVIO
    dados.telefoneCliente || '',                                    // M - TELEFONE
    (dados.enderecoCliente || '') + (dados.numeroCliente ? ', ' + dados.numeroCliente : ''), // N - ENDERECO
    dados.bairroCliente || '',                                      // O - BAIRRO
    cidadeEstado,                                                   // P - CIDADE/ESTADO
    dados.cepCliente || '',                                         // Q - CEP
    pecasDesc,                                                      // R - PEDIDO DE PECAS
    categorias.join(', '),                                          // S - TIPO DE PECA
    modelos.join(', '),                                             // T - MODELO
    cores.join(', '),                                               // U - COR
    qtdTotal,                                                       // V - QTD
    dados.totalPecas || 0,                                          // W - TOTAL PECA (R$)
    formaPag,                                                       // X - PAGAMENTO
    dados.prevEmbarque || '',                                       // Y - PREV. EMBARQUE
    dados.valorFrete || 0,                                          // Z - FRETE (R$)
    dados.totalGeral || 0,                                          // AA - TOTAL GERAL (R$)
    '',                                                             // AB - (vazio)
    '',                                                             // AC - (vazio)
    dados.pesoVolume || '',                                         // AD - PESO / VOLUME
    dados.observacoes || '',                                        // AE - OBS
    '',                                                             // AF - BLING STATUS
    '',                                                             // AG - BLING PEDIDO ID
    ''                                                              // AH - FECHAMENTO (manual)
  ]);

  var lastRow = sheet.getLastRow();

  // Formatar colunas de valor como moeda (W=23, Z=26, AA=27)
  sheet.getRange(lastRow, 23).setNumberFormat('R$ #.##0,00');
  sheet.getRange(lastRow, 26).setNumberFormat('R$ #.##0,00');
  sheet.getRange(lastRow, 27).setNumberFormat('R$ #.##0,00');

  return lastRow;
}

// Migracao: insere a coluna "DATA ENVIO RODONAVES" entre STATUS (G) e NF (H).
// Idempotente: roda no maximo uma vez (flag em DocumentProperties) e so insere
// se H1 for exatamente 'NF' (layout vigente antes da migracao).
var FLAG_COL_RODONAVES = 'COL_RODONAVES_V1';

function garantirColunaRodonaves_(sheet) {
  var props = PropertiesService.getDocumentProperties();
  if (props.getProperty(FLAG_COL_RODONAVES) === 'ok') return;

  // Lock: impede insercao dupla se duas submissoes chegarem juntas na 1a execucao
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (props.getProperty(FLAG_COL_RODONAVES) === 'ok') return;

    if (sheet.getLastRow() === 0) {
      // Planilha nova: o cabecalho criado em gravarNaPlanilha ja inclui a coluna
      props.setProperty(FLAG_COL_RODONAVES, 'ok');
      return;
    }

    var h8 = String(sheet.getRange(1, 8).getValue()).trim().toUpperCase();

    if (h8.indexOf('RODONAVES') !== -1) {
      // Coluna ja existe (inserida manualmente ou em execucao anterior)
      props.setProperty(FLAG_COL_RODONAVES, 'ok');
      return;
    }

    if (h8 !== 'NF') {
      // Layout inesperado: falhar alto em vez de gravar linha desalinhada
      throw new Error('Migracao coluna Rodonaves: cabecalho H1 inesperado ("' + h8 + '"). Ajuste a aba PEDIDOS ou rode migrarColunaRodonaves() manualmente.');
    }

    sheet.insertColumnBefore(8);
    sheet.getRange(1, 8).setValue('DATA ENVIO RODONAVES');
    SpreadsheetApp.flush();

    // Formatacao e cosmetica: nao pode derrubar a migracao se falhar
    try {
      var header = sheet.getRange(1, 8);
      header.setFontWeight('bold');
      header.setBackground('#1a1a2e');
      header.setFontColor('#c6ff00');
      if (sheet.getMaxRows() > 1) {
        var corpo = sheet.getRange(2, 8, sheet.getMaxRows() - 1, 1);
        corpo.clearDataValidations();
        corpo.setNumberFormat('dd/mm/yyyy');
      }
    } catch (eFmt) {
      Logger.log('Formatacao da coluna Rodonaves falhou (nao critico): ' + eFmt);
    }

    props.setProperty(FLAG_COL_RODONAVES, 'ok');
  } finally {
    lock.releaseLock();
  }
}

// Execucao manual (editor do Apps Script): insere a coluna imediatamente,
// sem esperar o primeiro registro do formulario.
function migrarColunaRodonaves() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PEDIDOS')
           || ss.getSheetByName('Pedido de Pecas')
           || ss.getSheetByName('Pecas')
           || ss.getSheets()[0];
  garantirColunaRodonaves_(sheet);
  Logger.log('Coluna H (DATA ENVIO RODONAVES) garantida na aba "' + sheet.getName() + '".');
}

function atualizarBlingStatus(row, status, pedidoId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PEDIDOS')
           || ss.getSheetByName('Pedido de Pecas')
           || ss.getSheetByName('Pecas')
           || ss.getSheets()[0];
  sheet.getRange(row, 32).setValue(status);
  sheet.getRange(row, 33).setValue(pedidoId || '');
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

      // --- Motos do cliente + garantia (wizard SAC) ---
      case 'motos_cliente':
        return jsonResponse(motosCliente({
          cpf: e.parameter.cpf,
          telefone: e.parameter.telefone
        }));

      // --- Acompanhamento publico da OS (QR / link do cliente) ---
      case 'status_publico':
        return jsonResponse(statusPublicoOS(e.parameter.os));

      // --- NPS publico (link enviado por WhatsApp ao fechar atendimento) ---
      case 'registrar_nps':
        return jsonResponse(registrarNps({
          id: e.parameter.id,
          nota: e.parameter.nota,
          comentario: e.parameter.comentario
        }));

      // --- Painel interno (Task 9): pendencias/SLA e resumo de NPS ---
      case 'resumo_pendencias':
        return jsonResponse(resumoPendencias());

      case 'resumo_nps':
        return jsonResponse(resumoNps());

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

  // Integracoes externas (Make/Respond.io) mandam o payload puro no body
  // e a action na URL (?action=...&token=...) — fallback para e.parameter.
  var action = body.action || (e && e.parameter && e.parameter.action) || '';

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

      case 'setup_roteamento_os_v1':
        return jsonResponse(setupRoteamentoOsV1(body));

      case 'reprocessar_bling_v1':
        return jsonResponse(reprocessarBlingV1(body));

      // --- Atendimentos (NXT SAC Fase 1) ---
      case 'registrar_atendimento':
        return jsonResponse(registrarAtendimento(body));

      case 'vincular_doc_atendimento':
        return jsonResponse(vincularDocAtendimento(body));

      case 'atualizar_atendimento':
        return jsonResponse(atualizarAtendimento(body));

      case 'marcar_nps_enviado':
        return jsonResponse(marcarNpsEnviado(body));

      case 'migrar_pendentes_para_atendimentos':
        return jsonResponse(migrarPendentesParaAtendimentos(body));

      // --- Movimentacoes de Estoque (Fase E1 NXT SAC) ---
      case 'registrar_movimentacao':
        return jsonResponse(registrarMovimentacao(body));

      case 'registrar_inventario_lote':
        return jsonResponse(registrarInventarioLote(body));

      // --- Integracao venda de MOTO -> SAC (plano 6; NAO confundir com registrar_venda de pecas) ---
      case 'registrar_venda_moto':
        if (!validarToken_(e)) { logIntegracao_('registrar_venda_moto', 'negado', ''); return jsonResponse({ ok: false, erro: 'nao autorizado' }); }
        try {
          return jsonResponse(registrarVendaMoto(body));
        } catch (errVM) {
          logIntegracao_('registrar_venda_moto', 'erro', errVM.message);
          return jsonResponse({ ok: false, erro: errVM.message });
        }

      // --- Integracao Respond.io -> SAC (plano 6 Task 5): mensagem WhatsApp cria/alimenta atendimento ---
      case 'respond_mensagem':
        if (!validarToken_(e)) { logIntegracao_('respond_mensagem', 'negado', ''); return jsonResponse({ ok: false, erro: 'nao autorizado' }); }
        try {
          return jsonResponse(respondMensagem(body));
        } catch (errRM) {
          logIntegracao_('respond_mensagem', 'erro', errRM.message);
          return jsonResponse({ ok: false, erro: errRM.message });
        }

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

// ========================================
// PLANILHA SEPARADA DE ORCAMENTOS (SAC Orcamentos)
// ========================================

// ID efetivo da planilha de orcamentos: ScriptProperty tem prioridade sobre a constante.
function getOrcamentosSpreadsheetId_() {
  var pid = '';
  try {
    pid = PropertiesService.getScriptProperties().getProperty('ORCAMENTOS_SHEET_ID') || '';
  } catch (e) { pid = ''; }
  return pid || ORCAMENTOS_SHEET_ID || '';
}

// Retorna a aba "Orcamentos" da planilha SEPARADA, criando-a com cabecalho se faltar.
// Substitui getSheet(ABA_ORCAMENTOS) em todo o fluxo de orcamentos.
function getOrcamentosSheet() {
  var id = getOrcamentosSpreadsheetId_();
  if (!id) {
    throw new Error('ORCAMENTOS_SHEET_ID nao configurado. Rode setupOrcamentosSpreadsheet() no editor uma vez.');
  }
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName(ABA_ORCAMENTOS);
  if (!sheet) {
    sheet = ss.insertSheet(ABA_ORCAMENTOS);
    ensureOrcTextFormat_(sheet);
    sheet.appendRow(ORC_HEADERS);
    sheet.getRange(1, 1, 1, ORC_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Formata as colunas como TEXTO PURO para datas (e telefone/doc) nao virarem
// objeto Date/numero na gravacao — a planilha antiga guardava "2026-07-21" como
// texto e o frontend depende disso (formatarDataOrc, filtro de data, auto-expira).
function ensureOrcTextFormat_(sheet) {
  try {
    sheet.getRange(1, 1, sheet.getMaxRows(), ORC_HEADERS.length).setNumberFormat('@');
  } catch (e) { /* nao bloqueia o fluxo */ }
}

// EXECUTAR UMA VEZ no editor: cria a planilha "SAC Orcamentos" (sob a conta do script),
// move para a pasta SAC/Orcamentos (mesma dos PDFs) e grava o ID na ScriptProperty.
// Idempotente: se ja existir um ID valido, apenas garante a aba/cabecalho.
function setupOrcamentosSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var existing = getOrcamentosSpreadsheetId_();
  if (existing) {
    var ssExist = null;
    try { ssExist = SpreadsheetApp.openById(existing); } catch (e) { ssExist = null; }
    if (ssExist) {
      var shExist = getOrcamentosSheet(); // garante aba + cabecalho
      ensureOrcTextFormat_(shExist);      // corrige formato (datas como texto puro)
      var jaMsg = 'JA EXISTIA | nome=' + ssExist.getName() + ' | id=' + existing + ' | url=' + ssExist.getUrl();
      Logger.log(jaMsg);
      return jaMsg;
    }
  }

  var ss = SpreadsheetApp.create('SAC Orcamentos');
  var id = ss.getId();

  var sheet = ss.getSheets()[0];
  sheet.setName(ABA_ORCAMENTOS);
  ensureOrcTextFormat_(sheet);
  sheet.appendRow(ORC_HEADERS);
  sheet.getRange(1, 1, 1, ORC_HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Move o arquivo para a pasta SAC/Orcamentos (mesma dos PDFs)
  var pastaInfo = 'raiz do Drive';
  try {
    var file = DriveApp.getFileById(id);
    var folder = DriveApp.getFolderById(PASTA_PDF_ORCAMENTOS);
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    pastaInfo = folder.getName();
  } catch (eMove) {
    pastaInfo = 'raiz do Drive (falha ao mover: ' + eMove.message + ')';
  }

  props.setProperty('ORCAMENTOS_SHEET_ID', id);

  var out = 'CRIADA | nome=SAC Orcamentos | id=' + id + ' | pasta=' + pastaInfo + ' | url=' + ss.getUrl();
  Logger.log(out);
  return out;
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
  var sheet = getOrcamentosSheet();

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
  var sheet = getOrcamentosSheet();
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

  var sheet = getOrcamentosSheet();
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

  var sheet = getOrcamentosSheet();
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
  var sheet = getOrcamentosSheet();
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

// Reutilizavel (idempotente): reenvia ao Bling os pedidos da aba PEDIDOS marcados
// com erro de renovacao de token (o refresh token morreu 12-13/07/2026 e os pedidos
// so gravaram na planilha). Reconstroi os dados a partir da aba Registros — unica
// fonte com CPF e pecas em JSON. POST {action:'reprocessar_bling_v1', confirmar:'SIM'}.
// Se estourar o tempo, rode de novo: linhas que viraram OK nao sao reprocessadas.
function reprocessarBlingV1(body) {
  if (!body || body.confirmar !== 'SIM') {
    return { sucesso: false, erro: 'mande {"confirmar":"SIM"} para executar' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('PEDIDOS');
    var reg = ss.getSheetByName(ABA_REGISTROS);
    if (!sheet || !reg) {
      return { sucesso: false, erro: 'aba PEDIDOS ou Registros nao encontrada' };
    }

    var valores = sheet.getDataRange().getValues();
    var regValores = reg.getDataRange().getValues();

    // Indexar Registros por id (col A)
    var regPorId = {};
    for (var r = 1; r < regValores.length; r++) {
      regPorId[String(regValores[r][0]).trim()] = regValores[r];
    }

    var resultado = { processados: 0, ok: 0, falhas: [] };
    var inicio = Date.now();

    for (var i = 1; i < valores.length; i++) {
      var status = String(valores[i][31] || '');
      if (status.indexOf('ERRO: Erro ao renovar token') !== 0) continue;

      // Web app tem limite de 6 min; para com folga e continua na proxima chamada
      if (Date.now() - inicio > 270000) {
        resultado.falhas.push('tempo esgotado — rode de novo para continuar');
        break;
      }

      var id = String(valores[i][1] || '').trim();
      resultado.processados++;

      var linhaReg = regPorId[id];
      if (!linhaReg) {
        resultado.falhas.push(id + ': sem linha na aba Registros');
        continue;
      }

      var pecas;
      try {
        pecas = JSON.parse(linhaReg[19] || '[]');
      } catch (e) {
        resultado.falhas.push(id + ': pecas ilegiveis no Registros');
        continue;
      }

      var dados = {
        id: id,
        tipoAtendimento: linhaReg[2],
        origemSac: linhaReg[3],
        protocoloSac: linhaReg[4],
        dataVenda: dataParaISO_(linhaReg[5]),
        vendedor: linhaReg[6],
        prevEmbarque: linhaReg[7],
        nomeCliente: linhaReg[8],
        tipoCliente: linhaReg[9],
        cpfCnpjCliente: String(linhaReg[10] || ''),
        ieCliente: linhaReg[11],
        telefoneCliente: String(linhaReg[12] || ''),
        enderecoCliente: linhaReg[13],
        numeroCliente: linhaReg[14],
        bairroCliente: linhaReg[15],
        cidadeCliente: linhaReg[16],
        ufCliente: linhaReg[17],
        cepCliente: String(linhaReg[18] || ''),
        pecas: pecas,
        formaPagamento: linhaReg[20],
        parcelas: linhaReg[21],
        urgencia: linhaReg[22],
        transportadora: linhaReg[23],
        valorFrete: linhaReg[24],
        pesoVolume: linhaReg[25],
        observacoes: linhaReg[26],
        totalPecas: linhaReg[27],
        totalGeral: linhaReg[28]
      };

      try {
        var pedidoId = enviarPedidoBling(dados);
        atualizarBlingStatus(i + 1, 'OK', pedidoId);
        resultado.ok++;
      } catch (errB) {
        atualizarBlingStatus(i + 1, 'ERRO: ' + errB.message, '');
        resultado.falhas.push(id + ': ' + errB.message);
      }
    }

    resultado.sucesso = true;
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

// getValues devolve Date quando a celula virou data; o Bling espera 'yyyy-MM-dd'
function dataParaISO_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '');
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
    var nomeBusca = (body.nomeOriginal || nome).toString().toLowerCase();
    var data = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === modelo && data[i][3].toString().toLowerCase() === nomeBusca) {
        sheet.getRange(i + 1, 1, 1, 7).setValues([[timestamp, modelo, modeloNome, nome, preco, peso, img]]);
        found = true;
        break;
      }
    }
    if (!found) {
      return { sucesso: false, erro: 'Peca nao encontrada para editar: ' + nomeBusca + ' (modelo ' + modelo + ')', imagemUrl: imagemUrl };
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

var CABECALHO_OS_ = [
  'DATA ABERTURA', 'NUMERO OS', 'NOME CLIENTE', 'CPF CLIENTE', 'TELEFONE CLIENTE',
  'CEP CLIENTE', 'ENDERECO CLIENTE', 'NUMERO CLIENTE', 'BAIRRO CLIENTE',
  'CIDADE', 'UF CLIENTE',
  'MODELO', 'NUMERO CHASSI', 'DATA COMPRA', 'NOTA FISCAL COMPRA',
  'TIPO', 'ASSISTENCIA', 'ENDERECO ASSISTENCIA', 'TELEFONE ASSISTENCIA',
  'PROBLEMA RELATADO', 'OBSERVACOES',
  'STATUS', 'NF ASSISTENCIA RECEBIDA', 'PAGAMENTO FEITO'
];

function garantirAbaAssistencias() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABA_ASSISTENCIAS);
  if (!aba) {
    aba = ss.insertSheet(ABA_ASSISTENCIAS);
    aba.getRange(1, 1, 1, CABECALHO_OS_.length).setValues([CABECALHO_OS_]).setFontWeight('bold');
    aba.setFrozenRows(1);
  } else {
    // Migração: se a aba existe mas tem menos colunas que o cabeçalho novo, reescreve o cabeçalho
    var colsAtuais = aba.getLastColumn();
    if (colsAtuais < CABECALHO_OS_.length) {
      aba.getRange(1, 1, 1, CABECALHO_OS_.length).setValues([CABECALHO_OS_]).setFontWeight('bold');
    }
  }
  return aba;
}

// ========================================
// ROTEAMENTO DE OS: SUMARE vs TERCEIRIZADA (spec 2026-07-12)
// ========================================

function normalizarNomeAba_(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function encontrarAbaNormalizada_(nomeAlvo) {
  var alvo = normalizarNomeAba_(nomeAlvo);
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (normalizarNomeAba_(sheets[i].getName()) === alvo) return sheets[i];
  }
  return null;
}

// Mapa {cabecalho normalizado -> indice 0-based}. Primeira ocorrencia vence
// (a aba Sumare tem duas colunas "DATA"; a primeira e a data de abertura).
function mapearColunasPorCabecalho_(aba) {
  var map = {};
  if (aba.getLastColumn() === 0) return map;
  var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    var chave = normalizarNomeAba_(headers[i]);
    if (chave && !(chave in map)) map[chave] = i;
  }
  return map;
}

// Coluna TIPO ASSISTENCIA no master — criada no fim do cabecalho vivo se nao existir
// (depois de atendimentoId), para nao deslocar os indices fixos de statusPublicoOS.
function garantirColTipoAssistencia_(aba) {
  var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (normalizarNomeAba_(headers[i]) === 'tipo assistencia') return i + 1;
  }
  var col = aba.getLastColumn() + 1;
  aba.getRange(1, col).setValue('TIPO ASSISTENCIA').setFontWeight('bold');
  return col;
}

var CABECALHO_ESPELHO_SUMARE_ = [
  'DATA', 'CLIENTE', 'TELEFONE', 'NUMERO OS', 'TIPO DE SOLICITAÇÃO',
  'MODELO', 'CHASSI', 'QUAL PROBLEMA', 'ENTROU CONTATO', 'DATA RETORNO',
  'O QUE PRECISA', 'PEDIDO', 'STATUS', 'NF', 'NUMERO NFE', 'REENVIO PEÇA'
];

function garantirAbaEspelhoSumare_() {
  var aba = encontrarAbaNormalizada_(ABA_ESPELHO_SUMARE);
  if (!aba) {
    aba = SpreadsheetApp.getActiveSpreadsheet().insertSheet(ABA_ESPELHO_SUMARE);
    aba.getRange(1, 1, 1, CABECALHO_ESPELHO_SUMARE_.length)
       .setValues([CABECALHO_ESPELHO_SUMARE_]).setFontWeight('bold');
    aba.setFrozenRows(1);
    return aba;
  }
  // Aba manual da Jacque ja existe: garante a coluna CHASSI logo apos MODELO
  var cols = mapearColunasPorCabecalho_(aba);
  if (!('chassi' in cols)) {
    var posModelo = ('modelo' in cols) ? cols['modelo'] + 1 : aba.getLastColumn();
    aba.insertColumnAfter(posModelo);
    aba.getRange(1, posModelo + 1).setValue('CHASSI').setFontWeight('bold');
  }
  return aba;
}

function garantirAbaEspelhoParceiras_() {
  var aba = encontrarAbaNormalizada_(ABA_ESPELHO_PARCEIRAS);
  if (!aba) {
    aba = SpreadsheetApp.getActiveSpreadsheet().insertSheet(ABA_ESPELHO_PARCEIRAS);
    aba.getRange(1, 1, 1, CABECALHO_OS_.length).setValues([CABECALHO_OS_]).setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  return aba;
}

// Espelha a OS na aba do tipo. Sumare: mapeia pelo cabecalho da aba da Jacque
// (so as colunas automaticas; o resto ela preenche). Terceirizada: linha completa
// no layout do master (a aba parceiras E o antigo master renomeado, sem cabecalho).
function espelharOS_(dados, numeroOS, tipoAssistencia, linhaMaster, dataAbertura) {
  if (tipoAssistencia === 'Sumare') {
    var aba = garantirAbaEspelhoSumare_();
    var cols = mapearColunasPorCabecalho_(aba);
    var linha = [];
    for (var i = 0; i < aba.getLastColumn(); i++) linha.push('');
    var dt = (dataAbertura instanceof Date) ? dataAbertura : new Date();
    var set = function(chave, valor) { if (chave in cols) linha[cols[chave]] = valor; };
    set('data', Utilities.formatDate(dt, Session.getScriptTimeZone(), 'dd/MM/yyyy'));
    set('cliente', dados.nomeCliente || '');
    set('telefone', dados.telefoneCliente || '');
    set('numero os', numeroOS);
    set('tipo de solicitacao', dados.tipo || '');
    set('modelo', dados.modelo || '');
    set('chassi', dados.numeroChassi || '');
    set('qual problema', dados.problemaRelatado || '');
    aba.appendRow(linha);
  } else {
    garantirAbaEspelhoParceiras_().appendRow(linhaMaster);
  }
}

// Chave de dedupe pelo numero da OS: pega o ultimo grupo de digitos e tira zeros
// a esquerda. "OS-2026-0045" -> "45"; "45" (digitado a mao na aba Sumare) -> "45".
function chaveNumeroOS_(v) {
  var m = String(v || '').match(/(\d+)\s*$/);
  return m ? String(parseInt(m[1], 10)) : '';
}

function chaveDedupe_(numero, cliente) {
  return chaveNumeroOS_(numero) + '|' + normalizarNomeAba_(cliente);
}

// Aba Sumare: dedupe SO pelo numero (as linhas manuais da Jacque sao as mesmas OSs,
// com nome as vezes digitado diferente do master).
function chavesSumare_(aba) {
  var chaves = {};
  var lastRow = aba.getLastRow();
  if (lastRow < 2) return chaves;
  var cols = mapearColunasPorCabecalho_(aba);
  if (!('numero os' in cols)) return chaves;
  var dados = aba.getRange(2, 1, lastRow - 1, aba.getLastColumn()).getValues();
  for (var i = 0; i < dados.length; i++) {
    var chave = chaveNumeroOS_(dados[i][cols['numero os']]);
    if (chave) chaves[chave] = true;
  }
  return chaves;
}

// Aba parceiras (antigo master renomeado, SEM cabecalho): dedupe por numero+cliente,
// porque a serie antiga tambem tem OS-2026-0001..0093 (de outros clientes) e nao pode
// bloquear o backfill das novas. Colunas fixas: B = numero OS, C = cliente.
function chavesParceiras_(aba) {
  var chaves = {};
  var lastRow = aba.getLastRow();
  if (lastRow < 1) return chaves;
  var dados = aba.getRange(1, 1, lastRow, 3).getValues();
  for (var i = 0; i < dados.length; i++) {
    if (!dados[i][1]) continue;
    chaves[chaveDedupe_(dados[i][1], dados[i][2])] = true;
  }
  return chaves;
}

// Funde entradas do cadastro cujo NOME COMPLETO e igual apos normalizacao
// (caso real da planilha: "Marcus Assistencia - Sumare" vs "MARCUS Assistencia - Sumare",
// mesmo nome com caixa diferente — verificado no cadastro vivo em 12/07/2026).
// Nao funde variantes com sufixo diferente (ex.: "Marcus" vs "Marcus Assistencia").
// Mantem a linha com ATUALIZADO_EM mais recente.
function fundirCadastroDuplicado_() {
  var aba = garantirAbaCadastroAssistencias();
  var lastRow = aba.getLastRow();
  if (lastRow < 3) return 0;
  var dados = aba.getRange(2, 1, lastRow - 1, 4).getValues();
  var vistos = {};
  var apagar = [];
  for (var i = 0; i < dados.length; i++) {
    var chave = normalizarNomeAba_(dados[i][0]);
    if (!chave) continue;
    if (chave in vistos) {
      var jaIdx = vistos[chave];
      var dNova = dados[i][3] instanceof Date ? dados[i][3].getTime() : 0;
      var dVelha = dados[jaIdx][3] instanceof Date ? dados[jaIdx][3].getTime() : 0;
      if (dNova > dVelha) { apagar.push(jaIdx + 2); vistos[chave] = i; }
      else apagar.push(i + 2);
    } else {
      vistos[chave] = i;
    }
  }
  apagar.sort(function(a, b) { return b - a; });
  for (var j = 0; j < apagar.length; j++) aba.deleteRow(apagar[j]);
  return apagar.length;
}

// One-time (idempotente): piso da numeracao + backfill das OSs orfas de 06-10/07
// + fusao de duplicatas do cadastro. POST {action:'setup_roteamento_os_v1', confirmar:'SIM'}.
function setupRoteamentoOsV1(body) {
  if (!body || body.confirmar !== 'SIM') {
    return { sucesso: false, erro: 'mande {"confirmar":"SIM"} para executar' };
  }
  var props = PropertiesService.getDocumentProperties();
  var ja = props.getProperty('SETUP_ROTEAMENTO_OS_V1');
  if (ja) return { sucesso: false, erro: 'setup ja executado em ' + ja };

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // 1. Piso da numeracao 2026 (serie antiga foi ate OS-2026-0717)
    PropertiesService.getScriptProperties().setProperty('OS_SEQ_FLOOR_2026', '717');

    // 2. Backfill do master para as abas espelho
    var aba = garantirAbaAssistencias();
    var colTipo = garantirColTipoAssistencia_(aba);
    var dados = aba.getDataRange().getValues();
    var chavesSum = chavesSumare_(garantirAbaEspelhoSumare_());
    var chavesPar = chavesParceiras_(garantirAbaEspelhoParceiras_());

    var criadasSum = 0, criadasPar = 0, tipadas = 0;
    for (var i = 1; i < dados.length; i++) {
      var r = dados[i];
      var numeroOS = String(r[1] || '').trim();
      if (numeroOS.indexOf('OS-') !== 0) continue;

      var ehSumare = normalizarNomeAba_(r[16]).indexOf('sumar') !== -1;
      var tipo = ehSumare ? 'Sumare' : 'Terceirizada';
      if (!String(r[colTipo - 1] || '').trim()) {
        aba.getRange(i + 1, colTipo).setValue(tipo);
        tipadas++;
      }

      var d = {
        nomeCliente: r[2], telefoneCliente: r[4], tipo: r[15], modelo: r[11],
        numeroChassi: r[12], problemaRelatado: r[19]
      };
      if (ehSumare) {
        var chaveS = chaveNumeroOS_(numeroOS);
        if (chavesSum[chaveS]) continue;
        espelharOS_(d, numeroOS, 'Sumare', r, r[0] instanceof Date ? r[0] : new Date());
        chavesSum[chaveS] = true;
        criadasSum++;
      } else {
        var chaveP = chaveDedupe_(numeroOS, r[2]);
        if (chavesPar[chaveP]) continue;
        espelharOS_(d, numeroOS, 'Terceirizada', r, null);
        chavesPar[chaveP] = true;
        criadasPar++;
      }
    }

    // 3. Cadastro: funde duplicatas (Marcus/MARCUS Assistencia - Sumare etc.)
    var fundidos = fundirCadastroDuplicado_();

    props.setProperty('SETUP_ROTEAMENTO_OS_V1', new Date().toISOString());
    return {
      sucesso: true, piso: 717,
      espelhadasSumare: criadasSum, espelhadasParceiras: criadasPar,
      tipadas: tipadas, cadastroFundidos: fundidos
    };
  } finally {
    lock.releaseLock();
  }
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

// Piso de numeracao por ano — protege contra reset se a aba for limpa/renomeada.
// Incidente 06/07/2026: aba renomeada -> script recriou vazia -> numeracao voltou pro 0001
// e duplicou OS-2026-0001..0093 com a serie antiga. Piso e setado pelo setup_roteamento_os_v1.
function getOsSeqFloor_(ano) {
  var v = PropertiesService.getScriptProperties().getProperty('OS_SEQ_FLOOR_' + ano);
  var n = v ? parseInt(v, 10) : 0;
  return isNaN(n) ? 0 : n;
}

// Helper interno — lógica de numeração sem lock aninhado
function obterProximoNumeroOSSemLock_(aba) {
  var ultimaLinha = aba.getLastRow();
  var anoAtual = new Date().getFullYear();
  var prefixo = 'OS-' + anoAtual + '-';

  var maiorSeq = getOsSeqFloor_(anoAtual);
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

    // Roteamento Sumare vs terceirizada (spec 2026-07-12). Form antigo em cache
    // manda sem tipoAssistencia -> marca "(sem tipo)" e espelha como terceirizada.
    var tipoAssistencia = (dados.tipoAssistencia === 'Sumare') ? 'Sumare'
      : (dados.tipoAssistencia === 'Terceirizada') ? 'Terceirizada'
      : '(sem tipo)';

    try {
      var colTipo = garantirColTipoAssistencia_(aba);
      aba.getRange(aba.getLastRow(), colTipo).setValue(tipoAssistencia);
    } catch (eTipo) { /* nao bloqueia a OS */ }

    try {
      espelharOS_(dados, numeroOS, tipoAssistencia === 'Sumare' ? 'Sumare' : 'Terceirizada', linha, new Date());
    } catch (eEsp) { /* nao bloqueia a OS */ }

    // Upsert automático no cadastro de assistências quando há dados preenchidos.
    // OS Sumare NAO faz upsert — o galpao nao e uma parceira do cadastro.
    if (tipoAssistencia !== 'Sumare' && dados.assistencia && (dados.assistenciaEndereco || dados.assistenciaTelefone)) {
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

/**
 * Migracao retroativa: cria atendimentos sinteticos para docs pendentes sem atendimentoId.
 * Considera "pendente":
 *   - Orcamentos com status='pendente' (case insensitive ou vazio) e atendimentoId vazio
 *   - AssistenciasTecnicas com atendimentoId vazio (OS nao tem status formal de fechamento)
 *
 * payload: { simular: boolean } - se true, so retorna a contagem sem modificar
 *
 * Para cada doc qualificado:
 *  1. Le campos do cliente (nome, telefone, cpf, nf, modelo) do doc
 *  2. Chama registrarAtendimento() com categoria/motivo deduzidos do tipo
 *  3. Chama vincularDocAtendimento() para conectar doc ao atendimento criado
 *
 * Status do atendimento criado: "Em andamento" (pendente real)
 */
function migrarPendentesParaAtendimentos(payload) {
  var simular = !!(payload && payload.simular);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var resumo = { orcamentos: 0, oses: 0, criados: [] };

  // === ORCAMENTOS pendentes ===
  var sheetOrc = ss.getSheetByName(ABA_ORCAMENTOS);
  if (sheetOrc && sheetOrc.getLastRow() > 1) {
    var ultCol = sheetOrc.getLastColumn();
    var headers = sheetOrc.getRange(1, 1, 1, ultCol).getValues()[0];
    var idxStatus = headers.indexOf('status');
    var idxAt = headers.indexOf('atendimentoId');
    var idxCliente = headers.indexOf('cliente'); if (idxCliente < 0) idxCliente = headers.indexOf('nome');
    var idxTel = headers.indexOf('telefone');
    var idxDoc = headers.indexOf('documento'); if (idxDoc < 0) idxDoc = headers.indexOf('cpf');
    var idxVendedor = headers.indexOf('vendedor');

    if (idxAt >= 0) { // só migra se a coluna existe
      var dados = sheetOrc.getRange(2, 1, sheetOrc.getLastRow() - 1, ultCol).getValues();
      for (var i = 0; i < dados.length; i++) {
        var r = dados[i];
        var status = String(r[idxStatus] || '').toLowerCase().trim();
        var atId = String(r[idxAt] || '').trim();
        if (atId) continue; // ja vinculado
        if (status && status !== 'pendente' && status !== '') continue;

        resumo.orcamentos++;
        if (simular) continue;

        var orcId = r[0];
        var atResp = registrarAtendimento({
          categoria: 'Pos-venda',
          motivo: 'Pecas / reposicao',
          origem: 'Migracao - Orcamento pendente',
          nomeCliente: r[idxCliente] || '',
          telefone: r[idxTel] || '',
          cpfCnpj: r[idxDoc] || '',
          notaFiscal: '',
          modeloEquipamento: '',
          descricao: 'Orcamento ' + orcId + ' criado anteriormente (migrado retroativamente)',
          vendedor: r[idxVendedor] || 'migracao',
          status: 'Em andamento'
        });

        if (atResp && atResp.sucesso) {
          vincularDocAtendimento({
            atendimentoId: atResp.id,
            tipoDoc: 'orcamento',
            docId: orcId
          });
          resumo.criados.push({ tipo: 'orcamento', docId: orcId, atendimentoId: atResp.id });
        }
      }
    }
  }

  // === ASSISTENCIAS TECNICAS sem atendimentoId ===
  var sheetOS = ss.getSheetByName(ABA_ASSISTENCIAS);
  if (sheetOS && sheetOS.getLastRow() > 1) {
    var ultColOS = sheetOS.getLastColumn();
    var headersOS = sheetOS.getRange(1, 1, 1, ultColOS).getValues()[0];
    var idxAtOS = headersOS.indexOf('atendimentoId');
    var idxNomeOS = headersOS.indexOf('nomeCliente'); if (idxNomeOS < 0) idxNomeOS = headersOS.indexOf('nome');
    var idxTelOS = headersOS.indexOf('telefoneCliente'); if (idxTelOS < 0) idxTelOS = headersOS.indexOf('telefone');
    var idxCpfOS = headersOS.indexOf('cpfCliente'); if (idxCpfOS < 0) idxCpfOS = headersOS.indexOf('cpf');
    var idxNFOS = headersOS.indexOf('notaFiscal');
    var idxModeloOS = headersOS.indexOf('modeloEquipamento'); if (idxModeloOS < 0) idxModeloOS = headersOS.indexOf('modelo');
    var idxProblemaOS = headersOS.indexOf('problema'); if (idxProblemaOS < 0) idxProblemaOS = headersOS.indexOf('descricao');

    if (idxAtOS >= 0) {
      var dadosOS = sheetOS.getRange(2, 1, sheetOS.getLastRow() - 1, ultColOS).getValues();
      for (var j = 0; j < dadosOS.length; j++) {
        var ros = dadosOS[j];
        var atIdOS = String(ros[idxAtOS] || '').trim();
        if (atIdOS) continue;

        resumo.oses++;
        if (simular) continue;

        var osId = ros[0];
        var atRespOS = registrarAtendimento({
          categoria: 'Pos-venda',
          motivo: 'Assistencia tecnica',
          origem: 'Migracao - OS legada',
          nomeCliente: idxNomeOS >= 0 ? (ros[idxNomeOS] || '') : '',
          telefone: idxTelOS >= 0 ? (ros[idxTelOS] || '') : '',
          cpfCnpj: idxCpfOS >= 0 ? (ros[idxCpfOS] || '') : '',
          notaFiscal: idxNFOS >= 0 ? (ros[idxNFOS] || '') : '',
          modeloEquipamento: idxModeloOS >= 0 ? (ros[idxModeloOS] || '') : '',
          descricao: idxProblemaOS >= 0 ? (ros[idxProblemaOS] || 'OS ' + osId) : ('OS ' + osId + ' migrada'),
          vendedor: 'migracao',
          status: 'Em andamento'
        });

        if (atRespOS && atRespOS.sucesso) {
          vincularDocAtendimento({
            atendimentoId: atRespOS.id,
            tipoDoc: 'os',
            docId: osId
          });
          resumo.criados.push({ tipo: 'os', docId: osId, atendimentoId: atRespOS.id });
        }
      }
    }
  }

  return {
    sucesso: true,
    simulacao: simular,
    totalOrcamentos: resumo.orcamentos,
    totalOSes: resumo.oses,
    totalGeral: resumo.orcamentos + resumo.oses,
    totalCriados: simular ? 0 : resumo.criados.length,
    criados: resumo.criados
  };
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
  // Orcamentos vivem na planilha SEPARADA; o resto continua na planilha ativa.
  var sheet = (nomeAba === ABA_ORCAMENTOS) ? getOrcamentosSheet() : ss.getSheetByName(nomeAba);
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

  // Motos do cliente (integracao venda -> SAC, plano 6): a compra alimenta a timeline
  var shMC = ss.getSheetByName('Motos Cliente');
  if (shMC && shMC.getLastRow() > 1) {
    var dadosMC = shMC.getRange(2, 1, shMC.getLastRow() - 1, 11).getValues();
    dadosMC.forEach(function(r) {
      var cpfMC = String(r[10] || '').replace(/\D/g, '');
      var telMC = String(r[9] || '').replace(/\D/g, '');
      var nomeMC = r[8] || '';
      if (!pertence(cpfMC, telMC, nomeMC)) return;
      add(cpfMC, telMC, nomeMC, '', {
        tipo: 'compra_moto',
        id: r[7],
        data: r[4],
        resumo: 'Compra de moto: ' + (r[1] || '') + ' ' + (r[2] || '') + (r[0] ? ' — chassi ' + r[0] : ''),
        status: ''
      });
    });
  }

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

// ========================================
// INTEGRACOES POS-VENDA (plano 6): FUNDACAO
// Config na aba 'Config' (Chave|Valor), token de integracao, log e helpers.
// Actions de INTEGRACAO respondem {ok:...} (contrato Make/Respond.io);
// as actions internas antigas seguem com {sucesso:...}.
// ========================================

function obterOuCriarAba_(nome, cabecalhos) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(nome);
  if (!sheet) {
    sheet = ss.insertSheet(nome);
    if (cabecalhos && cabecalhos.length) sheet.appendRow(cabecalhos);
  }
  return sheet;
}

function obterConfig(chave, padrao) {
  var sheet = obterOuCriarAba_('Config', ['Chave', 'Valor']);
  var dados = sheet.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim() === chave) return dados[i][1];
  }
  return padrao === undefined ? '' : padrao;
}

function validarToken_(e) {
  var token = obterConfig('TOKEN_INTEGRACAO', '');
  return token !== '' && !!(e && e.parameter && e.parameter.token === String(token));
}

function logIntegracao_(action, resultado, detalhe) {
  try {
    var sheet = obterOuCriarAba_('Log Integracoes', ['Timestamp', 'Action', 'Resultado', 'Detalhe']);
    sheet.appendRow([new Date(), action, resultado, String(detalhe || '').slice(0, 500)]);
  } catch (err) { /* log nunca derruba a action */ }
}

function normalizarTelefone_(s) {
  var d = String(s || '').replace(/\D/g, '');
  if (d.indexOf('55') === 0 && d.length > 11) d = d.slice(2);
  return d.slice(-11);
}

// Rodar UMA VEZ no editor Apps Script depois de colar esta versao:
// cria Config (com token forte se faltar), Log Integracoes, Motos Cliente e
// Config Garantia por componente: motor/quadro 24 meses, bateria 6 meses.
// Se a aba ainda estiver no layout antigo (Modelo|Meses), faz o upgrade.
// O token aparece no Logger e na aba Config (anotar no cofre).
function setupIntegracoes() {
  var cfg = obterOuCriarAba_('Config', ['Chave', 'Valor']);
  if (!obterConfig('TOKEN_INTEGRACAO', '')) {
    cfg.appendRow(['TOKEN_INTEGRACAO',
      Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '')]);
  }
  obterOuCriarAba_('Log Integracoes', ['Timestamp', 'Action', 'Resultado', 'Detalhe']);
  obterOuCriarAba_('Motos Cliente',
    ['Chassi', 'Modelo', 'Cor', 'Motor', 'Data Compra', 'Loja', 'Vendedor', 'ID Venda', 'Cliente', 'Telefone', 'CPF']);

  var HEADERS_GAR = ['Modelo', 'Motor/Quadro (meses)', 'Bateria (meses)'];
  var gar = obterOuCriarAba_('Config Garantia', HEADERS_GAR);
  var h2 = String(gar.getRange(1, 2).getValue() || '');
  if (h2 === 'Meses') {
    // upgrade do layout antigo (Modelo|Meses unico): vira 24/6 por componente
    gar.getRange(1, 1, 1, 3).setValues([HEADERS_GAR]);
    if (gar.getLastRow() > 1) {
      var n = gar.getLastRow() - 1;
      var vals = [];
      for (var i = 0; i < n; i++) vals.push([24, 6]);
      gar.getRange(2, 2, n, 2).setValues(vals);
    }
  }
  if (gar.getLastRow() < 2) {
    ['Juna', 'Kay', 'Pancho', 'Kimbo', 'Luna', 'Jaya', 'Jay', 'Hyphen', 'Gataka',
     'Vega', 'V0', 'Smart-Juna', 'Shaka', 'Zilla', 'Akasha'].forEach(function (m) {
      gar.appendRow([m, 24, 6]);
    });
  }
  Logger.log('TOKEN_INTEGRACAO: ' + obterConfig('TOKEN_INTEGRACAO'));
}

// ========================================
// VENDA -> SAC (registrar_venda_moto)
// Payload = venda sanitizada do formulario/dash:
// {id, loja, vendedor, dataVenda, cliente:{nome,cpf,telefone,email}, produtos:[{modelo,cor,chassi,motor,preco}]}
// Idempotente: chave = chassi (ou idVenda|modelo|cor quando sem chassi).
// O cliente fica nas colunas da propria linha (nao ha estrutura separada de
// clientes no SAC — buscar_cliente_consolidado le esta aba como 5a fonte).
// ========================================

function registrarVendaMoto(dados) {
  var cli = (dados && dados.cliente) || {};
  var tel = normalizarTelefone_(cli.telefone);
  var aba = obterOuCriarAba_('Motos Cliente',
    ['Chassi', 'Modelo', 'Cor', 'Motor', 'Data Compra', 'Loja', 'Vendedor', 'ID Venda', 'Cliente', 'Telefone', 'CPF']);
  var existentes = aba.getDataRange().getValues();

  function chaveDe_(chassi, idVenda, modelo, cor) {
    return (chassi && String(chassi).trim())
      ? String(chassi).trim().toUpperCase()
      : (idVenda + '|' + modelo + '|' + cor);
  }

  var registradas = 0;
  (dados.produtos || []).forEach(function (p) {
    var chave = chaveDe_(p.chassi, dados.id, p.modelo, p.cor);
    var duplicada = existentes.some(function (l) {
      return chaveDe_(l[0], l[7], l[1], l[2]) === chave;
    });
    if (duplicada) return;
    aba.appendRow([p.chassi || '', p.modelo || '', p.cor || '', p.motor || '',
                   dados.dataVenda || '', dados.loja || '', dados.vendedor || '',
                   dados.id || '', cli.nome || '', tel, cli.cpf || '']);
    registradas++;
  });
  logIntegracao_('registrar_venda_moto', 'ok', (dados.id || '?') + ' — ' + registradas + ' moto(s)');
  return { ok: true, registradas: registradas };
}

// ========================================
// MOTOS DO CLIENTE (wizard SAC)
// GET ?action=motos_cliente&telefone=...&cpf=... — sem token: leitura
// interna do front, mesmo nivel de exposicao das actions internas.
// Retorna motos da aba 'Motos Cliente' com garantia POR COMPONENTE a
// partir da Data Compra: motor/quadro e bateria, meses por modelo na
// 'Config Garantia' (padrao NXT: motor/quadro 24, bateria 6).
// ========================================

function motosCliente(query) {
  var cpf = String((query && query.cpf) || '').replace(/\D/g, '');
  var tel = String((query && query.telefone) || '').replace(/\D/g, '');
  if (!cpf && !tel) return { sucesso: false, erro: 'informe telefone ou cpf' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName('Motos Cliente');
  if (!aba || aba.getLastRow() < 2) return { sucesso: true, motos: [] };

  // Config Garantia: Modelo | Motor/Quadro (meses) | Bateria (meses)
  var garantiaPorModelo = {};
  var abaGar = ss.getSheetByName('Config Garantia');
  if (abaGar && abaGar.getLastRow() > 1) {
    abaGar.getRange(2, 1, abaGar.getLastRow() - 1, 3).getValues().forEach(function(r) {
      if (r[0]) garantiaPorModelo[String(r[0]).trim().toUpperCase()] = {
        motorQuadro: Number(r[1]) || 24,
        bateria: Number(r[2]) || 6
      };
    });
  }

  var tz = Session.getScriptTimeZone();
  var hoje = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  function venceEm_(dataBase, meses) {
    var d = new Date(dataBase.getTime());
    d.setMonth(d.getMonth() + meses);
    return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  }

  var dados = aba.getDataRange().getValues();
  var motos = [];
  // Header: Chassi, Modelo, Cor, Motor, Data Compra, Loja, Vendedor, ID Venda, Cliente, Telefone, CPF
  for (var i = 1; i < dados.length; i++) {
    var r = dados[i];
    var rTel = String(r[9] || '').replace(/\D/g, '');
    var rCpf = String(r[10] || '').replace(/\D/g, '');
    // Telefone casa por sufixo de 8 digitos (tolera 55/DDD/9o digito)
    var casaCpf = cpf && rCpf && rCpf === cpf;
    var casaTel = tel && rTel && rTel.slice(-8) === tel.slice(-8);
    if (!casaCpf && !casaTel) continue;

    var g = garantiaPorModelo[String(r[1] || '').trim().toUpperCase()] || { motorQuadro: 24, bateria: 6 };
    var dc = r[4];
    var dataCompra = '';
    var mqAte = '', batAte = '';
    var d = (dc instanceof Date) ? new Date(dc.getTime()) : (dc ? new Date(String(dc)) : null);
    if (d && !isNaN(d.getTime())) {
      dataCompra = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
      mqAte = venceEm_(d, g.motorQuadro);
      batAte = venceEm_(d, g.bateria);
    }
    motos.push({
      chassi: String(r[0] || ''),
      modelo: String(r[1] || ''),
      cor: String(r[2] || ''),
      motor: String(r[3] || ''),
      dataCompra: dataCompra,
      loja: String(r[5] || ''),
      vendedor: String(r[6] || ''),
      idVenda: String(r[7] || ''),
      garantiaMotorQuadroMeses: g.motorQuadro,
      garantiaMotorQuadroAte: mqAte,
      garantiaMotorQuadroVigente: !!mqAte && mqAte >= hoje,
      garantiaBateriaMeses: g.bateria,
      garantiaBateriaAte: batAte,
      garantiaBateriaVigente: !!batAte && batAte >= hoje
    });
  }
  return { sucesso: true, motos: motos };
}

// ========================================
// ACOMPANHAMENTO PUBLICO DA OS (plano 6 Task 7)
// GET ?action=status_publico&os=OS-2026-0001 — SEM token, publico.
// Retorna so o necessario pra timeline do cliente; OS inexistente ->
// {ok:false} generico (nao vaza existencia de dados). O operador avanca
// o status editando a coluna Status da aba AssistenciasTecnicas.
// ========================================

var ETAPAS_OS = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Em conserto', 'Pronto p/ retirar'];

function etapaDoStatus_(status) {
  var s = String(status || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (/(pronto|retirar|conclu|finaliz|entregue|resolvid|fechad)/.test(s)) return 4;
  if (/(conserto|reparo|manuten)/.test(s)) return 3;
  if (/(aprova|orcament|orçament)/.test(s)) return 2;
  if (/(analise|laudo|avalia)/.test(s)) return 1;
  return 0; // aberta / em andamento / desconhecido
}

function statusPublicoOS(os) {
  var alvo = String(os || '').trim().toUpperCase();
  if (!alvo) return { ok: false };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABA_ASSISTENCIAS);
  if (!aba || aba.getLastRow() < 2) return { ok: false };

  var alvoNum = alvo.replace(/\D/g, '');
  var dados = aba.getDataRange().getValues();
  // Colunas (ver registrarOS): 0 Data, 1 NumeroOS, 11 Modelo, 16 Assistencia,
  // 19 ProblemaRelatado, 21 Status.
  for (var i = 1; i < dados.length; i++) {
    var r = dados[i];
    var num = String(r[1] || '').trim().toUpperCase();
    var casa = num === alvo || (alvoNum && num.replace(/\D/g, '') === alvoNum);
    if (!casa) continue;

    var statusRaw = String(r[21] || 'Aberta');
    var tz = Session.getScriptTimeZone();
    var dt = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'dd/MM/yyyy') : '';
    return {
      ok: true,
      os: num,
      status: statusRaw,
      etapaAtual: etapaDoStatus_(statusRaw),
      etapas: ETAPAS_OS,
      modelo: String(r[11] || ''),
      problemaResumo: String(r[19] || '').slice(0, 100),
      assistencia: String(r[16] || ''),
      atualizadoEm: dt
    };
  }
  return { ok: false };
}

// ========================================
// NPS PUBLICO (plano 6 Task 8)
// GET ?action=registrar_nps&id=PV-2026-0001&nota=9&comentario=...
// id deve ser um atendimento existente e ainda sem nota. Grava na aba NPS.
// Segunda tentativa do mesmo id -> {ok:false, erro:'ja respondido'}.
// ========================================

function registrarNps(params) {
  var id = String((params && params.id) || '').trim();
  var nota = parseInt(params && params.nota, 10);
  var comentario = String((params && params.comentario) || '').slice(0, 500);
  if (!id) return { ok: false, erro: 'id obrigatorio' };
  if (isNaN(nota) || nota < 0 || nota > 10) return { ok: false, erro: 'nota invalida' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // atendimento existe?
    var shAt = ss.getSheetByName(SHEET_ATENDIMENTOS);
    var existe = false;
    if (shAt && shAt.getLastRow() > 1) {
      var ids = shAt.getRange(2, 1, shAt.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === id) { existe = true; break; }
      }
    }
    if (!existe) return { ok: false, erro: 'atendimento nao encontrado' };

    // ja respondido?
    var shNps = obterOuCriarAba_('NPS', ['Timestamp', 'Protocolo', 'Nota', 'Comentario', 'Categoria']);
    if (shNps.getLastRow() > 1) {
      var resp = shNps.getRange(2, 2, shNps.getLastRow() - 1, 1).getValues();
      for (var j = 0; j < resp.length; j++) {
        if (String(resp[j][0]).trim() === id) return { ok: false, erro: 'ja respondido' };
      }
    }

    var categoria = nota >= 9 ? 'Promotor' : (nota >= 7 ? 'Neutro' : 'Detrator');
    shNps.appendRow([new Date(), id, nota, comentario, categoria]);
    return { ok: true, nota: nota, categoria: categoria };
  } finally {
    lock.releaseLock();
  }
}

// ========================================
// PAINEL INTERNO (plano 6 Task 9)
// ========================================

// Pendencias abertas (status != Resolvido/Fechado) + SLA. Alimenta o badge
// do nav e o bloco "Em aberto" da home. SLA_DIAS vem da aba Config (padrao 3).
function resumoPendencias() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ATENDIMENTOS);
  var slaDias = parseInt(obterConfig('SLA_DIAS', '3'), 10) || 3;
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, abertos: 0, vencidos: 0, slaDias: slaDias, maisAntigos: [] };

  var tz = Session.getScriptTimeZone();
  var agora = new Date();
  var dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, 13).getValues(); // A..M
  var fechados = { 'Resolvido': 1, 'Fechado': 1 };
  var abertos = [];
  for (var i = 0; i < dados.length; i++) {
    var r = dados[i];
    var status = String(r[12] || '').trim();
    if (fechados[status]) continue;
    var dtAb = r[1] instanceof Date ? r[1] : new Date(r[1]);
    var dias = !isNaN(dtAb.getTime()) ? Math.floor((agora - dtAb) / 86400000) : 0;
    abertos.push({
      id: r[0],
      nomeCliente: String(r[5] || ''),
      status: status,
      dataAbertura: !isNaN(dtAb.getTime()) ? Utilities.formatDate(dtAb, tz, 'dd/MM/yyyy') : '',
      diasAberto: dias,
      vencido: dias > slaDias
    });
  }
  abertos.sort(function(a, b) { return b.diasAberto - a.diasAberto; }); // mais antigos primeiro
  var vencidos = abertos.filter(function(a) { return a.vencido; }).length;
  return { ok: true, abertos: abertos.length, vencidos: vencidos, slaDias: slaDias, maisAntigos: abertos.slice(0, 5) };
}

// Resumo de NPS da aba NPS (media, score NPS, distribuicao). Para o dashboard.
function resumoNps() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('NPS');
  if (!sheet || sheet.getLastRow() < 2) {
    return { ok: true, total: 0, media: 0, nps: 0, promotores: 0, neutros: 0, detratores: 0 };
  }
  var notas = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues(); // col C = Nota
  var soma = 0, prom = 0, neu = 0, det = 0, n = 0;
  for (var i = 0; i < notas.length; i++) {
    var nota = parseInt(notas[i][0], 10);
    if (isNaN(nota)) continue;
    n++; soma += nota;
    if (nota >= 9) prom++; else if (nota >= 7) neu++; else det++;
  }
  return {
    ok: true,
    total: n,
    media: n ? Math.round(soma / n * 10) / 10 : 0,
    nps: n ? Math.round((prom - det) / n * 100) : 0,
    promotores: prom, neutros: neu, detratores: det
  };
}

// ========================================
// PULL RESPOND.IO -> SAC (agendado, gratis; substitui a ponte Make)
// Roda por gatilho de tempo (setupPullRespond). Le RESPOND_API_TOKEN do
// Config (aba Config, chave RESPOND_API_TOKEN). Lista contatos (mais
// recentes primeiro), processa os NOVOS desde RESPOND_ULTIMO_ID e cria o
// atendimento (idempotente por telefone via respondMensagem). Captura
// clientes NOVOS; nao loga follow-up de contato ja conhecido.
// ========================================

var RESPOND_API_BASE = 'https://api.respond.io/v2';

function respondApi_(metodo, path, body) {
  var token = obterConfig('RESPOND_API_TOKEN', '');
  if (!token) throw new Error('RESPOND_API_TOKEN ausente no Config');
  var opt = {
    method: metodo,
    headers: { 'Authorization': 'Bearer ' + token },
    contentType: 'application/json',
    muteHttpExceptions: true
  };
  if (body) opt.payload = JSON.stringify(body);
  var resp = UrlFetchApp.fetch(RESPOND_API_BASE + path, opt);
  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Respond API ' + code + ': ' + resp.getContentText().slice(0, 200));
  return JSON.parse(resp.getContentText());
}

function setConfig_(chave, valor) {
  var sheet = obterOuCriarAba_('Config', ['Chave', 'Valor']);
  var dados = sheet.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim() === chave) { sheet.getRange(i + 1, 2).setValue(String(valor)); return; }
  }
  sheet.appendRow([chave, String(valor)]);
}

function puxarRespondNovos() {
  var token = obterConfig('RESPOND_API_TOKEN', '');
  if (!token) { logIntegracao_('pull_respond', 'ignorado', 'sem RESPOND_API_TOKEN'); return { ok: false, erro: 'sem token' }; }

  var ultimoId = parseInt(obterConfig('RESPOND_ULTIMO_ID', '0'), 10) || 0;
  var primeira = ultimoId === 0;
  var novos = [], cursor = null, maiorId = ultimoId, pag = 0;

  while (pag < 8) {
    pag++;
    var qs = '/contact/list?limit=99' + (cursor ? '&cursorId=' + cursor : '');
    // a API exige "filter" no body ({$and:[]} = sem filtro); body {} da 400
    var r = respondApi_('post', qs, { search: '', timezone: 'America/Sao_Paulo', filter: { $and: [] } });
    var items = (r && r.items) || [];
    if (!items.length) break;
    var parar = false;
    for (var i = 0; i < items.length; i++) {
      var c = items[i];
      var id = Number(c.id);
      if (id > maiorId) maiorId = id;
      if (ultimoId && id <= ultimoId) { parar = true; break; }
      if (c.status === 'open' && c.phone) novos.push(c);
    }
    if (parar || primeira) break; // primeira exec: so a 1a pagina (cobre o gap recente)
    cursor = items[items.length - 1].id;
  }

  // processa do mais antigo pro mais novo; teto por execucao (o resto vem no proximo run)
  novos.sort(function(a, b) { return a.id - b.id; });
  var LIMITE = 80;
  var processar = novos.slice(0, LIMITE);
  var criados = 0, anexados = 0, falhas = 0;
  processar.forEach(function(c) {
    try {
      var nome = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      var res = respondMensagem({ telefone: c.phone, nome: nome, texto: '', canal: 'whatsapp' });
      if (res && res.ok) { res.novo ? criados++ : anexados++; } else { falhas++; }
    } catch (ec) { falhas++; }
  });

  // avanca o cursor: se coube tudo, ate o maior visto; senao, ate o ultimo processado
  var novoUltimo = (processar.length && processar.length < novos.length) ? processar[processar.length - 1].id : maiorId;
  setConfig_('RESPOND_ULTIMO_ID', novoUltimo);
  logIntegracao_('pull_respond', 'ok', 'novos=' + novos.length + ' criados=' + criados + ' anexados=' + anexados + ' falhas=' + falhas + (primeira ? ' (1a exec)' : ''));
  return { ok: true, novos: novos.length, criados: criados, anexados: anexados, falhas: falhas, ultimoId: novoUltimo };
}

// Rodar UMA VEZ no editor: cria o gatilho de tempo (a cada 1h). Idempotente.
function setupPullRespond() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'puxarRespondNovos') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('puxarRespondNovos').timeBased().everyHours(1).create();
  Logger.log('Gatilho puxarRespondNovos criado (a cada 1h).');
}

// ========================================
// RESPOND.IO -> SAC (respond_mensagem)  [plano 6 Task 5]
// Webhook message.received do Respond.io cria/alimenta um atendimento.
// Payload real (docs/respond-io/webhooks.md): telefone em contact.phone,
// texto ANINHADO em message.message.text, nome em contact.firstName/lastName,
// canal em channel.source. Aceita tambem campos planos (telefone/texto/nome)
// para teste via curl.
// Protocolo = id do atendimento (PV-AAAA-NNNN): mesma numeracao do wizard,
// pra cair na mesma lista/badge e no consolidado do cliente (nao ha contador
// paralelo). Idempotencia leve: mensagens do mesmo telefone com atendimento
// aberto sao anexadas ao mesmo protocolo.
// ========================================

function respondMensagem(dados) {
  dados = dados || {};
  var contact = dados.contact || {};
  var msgWrap = dados.message || {};
  var msgInner = msgWrap.message || {};
  var canal = (dados.channel && (dados.channel.source || dados.channel.name)) || dados.canal || 'whatsapp';

  var tel = normalizarTelefone_(contact.phone || dados.telefone || '');
  var texto = msgInner.text || dados.texto || '';
  var nome = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || dados.nome || '';

  if (!tel) { logIntegracao_('respond_mensagem', 'erro', 'sem telefone'); return { ok: false, erro: 'sem telefone' }; }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var protocolo, novo = false;
  try {
    var aberto = buscarAtendimentoAbertoPorTelefone_(tel);
    if (aberto) {
      protocolo = aberto.id;
    } else {
      protocolo = criarAtendimentoViaWhatsApp_(tel, nome, texto, canal);
      novo = true;
    }
  } finally {
    lock.releaseLock();
  }

  obterOuCriarAba_('Mensagens', ['Timestamp', 'Protocolo', 'Telefone', 'Cliente', 'Direcao', 'Texto', 'Canal'])
    .appendRow([new Date(), protocolo, tel, nome, 'recebida', String(texto).slice(0, 1000), canal]);

  logIntegracao_('respond_mensagem', 'ok', 'protocolo ' + protocolo + (novo ? ' (novo)' : ''));
  return { ok: true, protocolo: protocolo, novo: novo };
}

// Atendimento aberto (status != Resolvido/Fechado) mais recente deste telefone.
// Casa por sufixo de 8 digitos (tolera 55/DDD/9o digito). Le a aba Atendimentos
// existente (col A=id, G=telefone, M=status; ver registrarAtendimento).
function buscarAtendimentoAbertoPorTelefone_(tel) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ATENDIMENTOS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var alvo = String(tel || '').replace(/\D/g, '').slice(-8);
  if (!alvo) return null;
  var dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, 13).getValues();
  var fechados = { 'Resolvido': 1, 'Fechado': 1 };
  for (var i = dados.length - 1; i >= 0; i--) {
    var r = dados[i];
    var rtel = String(r[6] || '').replace(/\D/g, '').slice(-8);
    var status = String(r[12] || '').trim();
    if (rtel && rtel === alvo && !fechados[status]) {
      return { id: r[0], nome: r[5], status: status };
    }
  }
  return null;
}

// Cria atendimento novo na aba Atendimentos com id PV-AAAA-NNNN (mesma
// numeracao/estrutura de registrarAtendimento). Origem = canal, status Aberto.
function criarAtendimentoViaWhatsApp_(tel, nome, texto, canal) {
  var id = gerarProximoIdAtendimento();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_ATENDIMENTOS);
  if (!sheet) throw new Error('Aba Atendimentos nao encontrada');

  if (!nome) {
    try {
      var cons = buscarClienteConsolidado({ telefone: tel });
      if (cons && cons.clientes && cons.clientes.length) nome = cons.clientes[0].nome || '';
    } catch (e) { /* nome e opcional */ }
  }

  sheet.appendRow([
    id,                                  // A: id / protocolo
    new Date(),                          // B: dataAbertura
    'Pos-venda',                         // C: categoria
    'Mensagem WhatsApp',                 // D: motivo
    canal || 'whatsapp',                 // E: origem
    nome || '',                          // F: nomeCliente
    tel,                                 // G: telefone
    '',                                  // H: cpfCnpj
    '',                                  // I: notaFiscal
    '',                                  // J: modeloEquipamento
    'Atendimento aberto via WhatsApp (Respond.io).' + (texto ? '\nPrimeira mensagem: ' + String(texto).slice(0, 300) : ''), // K
    '',                                  // L: vendedor
    'Aberto',                            // M: status
    '',                                  // N: dataFechamento
    '',                                  // O: motivoFechamento
    false                                // P: npsEnviado
  ]);
  return id;
}
