# OS Sumaré vs Terceirizada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Campo obrigatório Sumaré/Terceirizada no form de OS, espelhamento automático da OS na aba certa da planilha, numeração consertada a partir de OS-2026-0718 e backfill das ~93 OSs órfãs.

**Architecture:** `AssistenciasTecnicas` continua sendo o master (fonte da verdade). O frontend (`assistencia.js`) ganha o seletor de tipo; o backend (`google-apps-script.js`) grava o tipo numa coluna nova no master e faz um *append* adicional (espelho) na aba " ASSISTÊNCIA SUMARÉ " (layout da Jacque + coluna CHASSI) ou "Assistencias parceiras " (layout do master). Um endpoint one-time (`setup_roteamento_os_v1`) seta o piso de numeração, faz o backfill e funde duplicatas do cadastro.

**Tech Stack:** JS vanilla (IIFE, estilo `var`/ES5) no GitHub Pages + Google Apps Script (V8) + Google Sheets. Sem build, sem test runner.

**Spec:** `docs/superpowers/specs/2026-07-12-sac-os-sumare-terceirizada-design.md`

## Global Constraints

- Planilha viva: "Pedido de peças" `1QtumxGgKwzWBQBPISfDFjH3qGboiT3_1x5gbxl6R6ns` — é PRODUÇÃO. Nada de dados de teste sem marcar/limpar depois.
- Nomes reais das abas espelho têm espaços extras: `"Assistencias parceiras "` e `" ASSISTÊNCIA SUMARÉ "`. NUNCA usar `getSheetByName` com nome literal para elas — sempre `encontrarAbaNormalizada_`.
- A aba "Assistencias parceiras " NÃO tem linha de cabeçalho (perdida no incidente de ~05/07; a linha 1 já é dado). Leitura/dedupe nela é por índice fixo: col B = nº OS, col C = cliente.
- A aba " ASSISTÊNCIA SUMARÉ " tem cabeçalho com sujeira real: `"MODELO "` (espaço no fim), `"ENTROU CONTAT0"` (zero no lugar do O), duas colunas `DATA`. Mapear por cabeçalho normalizado, primeira ocorrência vence.
- Numeração: série antiga foi até OS-2026-0717. Piso = ScriptProperty `OS_SEQ_FLOOR_2026` = `717`.
- Estilo de código: seguir o existente — `var`, funções declaradas, strings concatenadas com `+`, comentários em pt-BR sem acento no GAS quando o arquivo já faz assim.
- Verificação local = `node --check <arquivo>` (sem test runner no repo). Verificação real = smoke test pós-deploy (Task 7).
- Deploy GAS: colar `google-apps-script.js` INTEIRO no editor → Implantar → Gerenciar implantações → ✏️ Editar → Nova versão → Implantar (mantém URL). Smoke por curl SEM `-X POST` (quebra redirect com 411).
- Cache-busting do frontend: bump de TODAS as ocorrências `?v=2.34` → `?v=2.35` no `index.html`.
- Endereço do galpão confirmado pela usuária: "Rua Quaresmeira da Serra, Sumaré/SP" (número/CEP pendentes — não bloqueiam código; ver Task 7).

---

### Task 1: Backend — piso de numeração por ano

**Files:**
- Modify: `google-apps-script.js:1914-1933` (função `obterProximoNumeroOSSemLock_`)

**Interfaces:**
- Consumes: `PropertiesService.getScriptProperties()` (nativo GAS)
- Produces: `getOsSeqFloor_(ano) -> number` (usada pela Task 4 indiretamente via propriedade `OS_SEQ_FLOOR_<ano>`); `obterProximoNumeroOSSemLock_(aba)` passa a respeitar o piso

- [ ] **Step 1: Adicionar helper e aplicar o piso**

Localizar (linhas 1914-1933):

```js
// Helper interno — lógica de numeração sem lock aninhado
function obterProximoNumeroOSSemLock_(aba) {
  var ultimaLinha = aba.getLastRow();
  var anoAtual = new Date().getFullYear();
  var prefixo = 'OS-' + anoAtual + '-';

  var maiorSeq = 0;
```

Substituir por:

```js
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
```

(O resto da função — o loop de scan e o `return` — fica intacto: `Math.max` implícito porque o scan só sobe `maiorSeq`.)

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check google-apps-script.js`
Expected: sem saída (exit 0)

- [ ] **Step 3: Commit**

```bash
git add google-apps-script.js docs/superpowers/specs/2026-07-12-sac-os-sumare-terceirizada-design.md docs/superpowers/plans/2026-07-12-sac-os-sumare-terceirizada-plan.md
git commit -m "feat(os): piso de numeracao por ano (OS_SEQ_FLOOR) + spec/plano roteamento Sumare"
```

---

### Task 2: Backend — helpers de abas espelho

**Files:**
- Modify: `google-apps-script.js:47-48` (constantes de aba)
- Modify: `google-apps-script.js:1877-1901` (`garantirAbaAssistencias` passa a usar `CABECALHO_OS_`)
- Create (mesmo arquivo): bloco novo de helpers logo após `garantirAbaAssistencias`

**Interfaces:**
- Produces (usadas nas Tasks 3 e 4):
  - `normalizarNomeAba_(s) -> string` (lowercase, sem acentos, espaços colapsados)
  - `encontrarAbaNormalizada_(nomeAlvo) -> Sheet|null`
  - `mapearColunasPorCabecalho_(aba) -> {chaveNormalizada: indice0based}` (primeira ocorrência vence)
  - `garantirColTipoAssistencia_(aba) -> number` (1-based; cria header `TIPO ASSISTENCIA` no fim se faltar)
  - `garantirAbaEspelhoSumare_() -> Sheet` (cria/acha a aba, garante coluna CHASSI após MODELO)
  - `garantirAbaEspelhoParceiras_() -> Sheet`
  - `espelharOS_(dados, numeroOS, tipoAssistencia, linhaMaster, dataAbertura) -> void`
  - `CABECALHO_OS_` (array 24 headers do master)

- [ ] **Step 1: Adicionar constantes de aba**

Após a linha 48 (`var ABA_CADASTRO_ASSISTENCIAS = 'AssistenciasCadastro';`), inserir:

```js
// Abas espelho do roteamento de OS (spec 2026-07-12). Nomes reais na planilha
// tem espacos extras — localizar SEMPRE via encontrarAbaNormalizada_.
var ABA_ESPELHO_SUMARE = 'ASSISTÊNCIA SUMARÉ';
var ABA_ESPELHO_PARCEIRAS = 'Assistencias parceiras';
```

- [ ] **Step 2: Extrair `CABECALHO_OS_` e usar em `garantirAbaAssistencias`**

Substituir o miolo de `garantirAbaAssistencias` (linhas 1877-1901) por:

```js
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
```

(É o mesmo comportamento de hoje; só o array `cabecalho` virou constante compartilhada. O array
NÃO ganha `TIPO ASSISTENCIA` — essa coluna é criada dinamicamente no fim do cabeçalho vivo pela
`garantirColTipoAssistencia_`, para não colidir com a coluna `atendimentoId` que já existe na
planilha depois das 24 colunas.)

- [ ] **Step 3: Adicionar bloco de helpers**

Inserir logo após a função `garantirAbaAssistencias` (antes de `obterProximoNumeroOS`):

```js
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
```

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check google-apps-script.js`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add google-apps-script.js
git commit -m "feat(os): helpers de abas espelho (Sumare/parceiras) com nome normalizado"
```

---

### Task 3: Backend — tipo + espelho no `registrarOS`

**Files:**
- Modify: `google-apps-script.js:1972-1992` (dentro de `registrarOS`, após o `appendRow`)

**Interfaces:**
- Consumes: `garantirColTipoAssistencia_`, `espelharOS_` (Task 2)
- Produces: `registrarOS(dados)` aceita `dados.tipoAssistencia: 'Sumare'|'Terceirizada'` (payload novo do frontend, Task 5); grava coluna `TIPO ASSISTENCIA` e espelha

- [ ] **Step 1: Inserir tipo + espelho após o bloco do atendimentoId**

Localizar em `registrarOS` (linhas 1972-1992):

```js
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
```

Substituir por:

```js
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
```

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check google-apps-script.js`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add google-apps-script.js
git commit -m "feat(os): coluna TIPO ASSISTENCIA + espelho automatico por tipo no registrarOS"
```

---

### Task 4: Backend — `setup_roteamento_os_v1` (piso + backfill + fusão do cadastro)

**Files:**
- Modify: `google-apps-script.js:1008-1009` (novo `case` no `doPost`, junto de `salvar_assistencia`)
- Create (mesmo arquivo): funções `setupRoteamentoOsV1`, `chaveNumeroOS_`, `chaveDedupe_`, `chavesSumare_`, `chavesParceiras_`, `fundirCadastroDuplicado_` — inserir após `espelharOS_`

**Interfaces:**
- Consumes: `garantirAbaAssistencias`, `garantirColTipoAssistencia_`, `garantirAbaEspelhoSumare_`, `garantirAbaEspelhoParceiras_`, `espelharOS_`, `normalizarNomeAba_`, `garantirAbaCadastroAssistencias` (existente)
- Produces: POST `{action:'setup_roteamento_os_v1', confirmar:'SIM'}` → `{sucesso, piso, espelhadasSumare, espelhadasParceiras, tipadas, cadastroFundidos}`; idempotente via DocumentProperty `SETUP_ROTEAMENTO_OS_V1`

- [ ] **Step 1: Adicionar o case no doPost**

Após o case `salvar_assistencia` (linhas 1008-1009), inserir:

```js
      case 'setup_roteamento_os_v1':
        return jsonResponse(setupRoteamentoOsV1(body));
```

- [ ] **Step 2: Adicionar as funções**

Inserir após `espelharOS_`:

```js
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

// Funde entradas do cadastro com nome igual apos normalizacao (ex.: "Marcus" vs
// "MARCUS Assistencia - Sumare"). Mantem a linha com ATUALIZADO_EM mais recente.
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
```

- [ ] **Step 3: Verificar sintaxe**

Run: `node --check google-apps-script.js`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add google-apps-script.js
git commit -m "feat(os): setup_roteamento_os_v1 — piso 717, backfill orfas, fusao cadastro"
```

---

### Task 5: Frontend — seletor Sumaré/Terceirizada no form

**Files:**
- Modify: `assistencia.js:1` (versão do header), `assistencia.js:45` (constante nova), `assistencia.js:160-177` (seção 2 do form), `assistencia.js:216+` (listener novo), `assistencia.js:346-427` (submeterOS)
- Modify: `index.html:7,132-143` (bump `?v=2.34` → `?v=2.35`)

**Interfaces:**
- Consumes: `registrarOS` aceita `tipoAssistencia` (Task 3)
- Produces: payload `registrar_os` com `tipoAssistencia: 'Sumare'|'Terceirizada'`; `dados.tipoAssistencia` disponível para PDFs/WhatsApp (Task 6); constante `GALPAO_SUMARE = {nome, endereco}`

- [ ] **Step 1: Header + constante do galpão**

Linha 1: trocar `V2.24` por `V2.25`.

Após o fechamento do array `ASSISTENCIAS_NXT` (linha 45 `];`), inserir:

```js
  // Assistencia propria (galpao NXT Sumare). Endereco confirmado pela gestao em 12/07/2026;
  // numero/CEP pendentes — atualizar aqui quando confirmados (unico ponto a mexer).
  var GALPAO_SUMARE = {
    nome: 'Assistência NXT Sumaré',
    endereco: 'Rua Quaresmeira da Serra, Sumaré/SP'
  };
```

- [ ] **Step 2: Reescrever a seção 2 do form**

Substituir o bloco inteiro (linhas 160-177):

```js
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
```

Por:

```js
        // SEÇÃO 2 — ASSISTÊNCIA TÉCNICA
        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Assistência Técnica</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="flex:1 1 100%;">' +
              '<label>Tipo de assistência *</label>' +
              '<div class="checkbox-group">' +
                '<label><input type="radio" name="osTipoAssistencia" value="Sumare"> 🏭 Assistência Sumaré</label>' +
                '<label><input type="radio" name="osTipoAssistencia" value="Terceirizada"> 🤝 Assistência terceirizada</label>' +
              '</div></div>' +
          '</div>' +
          '<div id="osSumareCard" style="display:none;background:#c6ff0011;border:1px solid #c6ff0055;border-radius:6px;padding:0.9rem 1rem;margin-bottom:0.75rem;">' +
            '<div style="font-weight:700;color:var(--cor-primaria);">' + escapeHtml(GALPAO_SUMARE.nome) + '</div>' +
            '<div style="color:#9a9a9a;font-size:0.9rem;margin-top:2px;">' + escapeHtml(GALPAO_SUMARE.endereco) + '</div>' +
          '</div>' +
          '<div id="osTerceirizadaCampos" style="display:none;">' +
            '<div class="form-row">' +
              '<div class="form-group" style="flex:1 1 100%;"><label for="osAssistenciaSelect">Assistência *</label>' +
                '<select id="osAssistenciaSelect">' + assistOptions + '</select></div>' +
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
        '</div>' +
```

(Mudanças: radio obrigatório sem pré-seleção; cartão fixo do galpão; os 3 form-rows existentes
foram envelopados em `#osTerceirizadaCampos` sem alteração interna, exceto a remoção do
atributo `required` do select — a validação é manual no `submeterOS`.)

- [ ] **Step 3: Listener do toggle**

Em `setupListenersAssistencia`, logo antes do bloco `// Assistência — toggle campo "Outro"...` (linha 237), inserir:

```js
    // Tipo de assistencia — alterna cartao Sumare vs campos de terceirizada
    document.querySelectorAll('input[name="osTipoAssistencia"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var sumare = this.value === 'Sumare';
        document.getElementById('osSumareCard').style.display = sumare ? '' : 'none';
        document.getElementById('osTerceirizadaCampos').style.display = sumare ? 'none' : '';
        if (sumare) {
          document.getElementById('osAssistenciaSelect').value = '';
          document.getElementById('osAssistOutroRow').style.display = 'none';
          document.getElementById('osAssistenciaOutroNome').value = '';
          document.getElementById('osAssistenciaEndereco').value = '';
          document.getElementById('osAssistenciaTelefone').value = '';
        }
      });
    });
```

- [ ] **Step 4: submeterOS — tipo, payload e validação**

Substituir (linhas 349-355):

```js
    var assistSelVal = document.getElementById('osAssistenciaSelect').value;
    var assistNome;
    if (assistSelVal === '__outro__') {
      assistNome = (document.getElementById('osAssistenciaOutroNome').value || '').trim();
    } else {
      assistNome = assistSelVal;
    }
```

Por:

```js
    var tipoAssistencia = (document.querySelector('input[name="osTipoAssistencia"]:checked') || {}).value || '';

    var assistNome, assistEndereco, assistTelefone;
    if (tipoAssistencia === 'Sumare') {
      assistNome = GALPAO_SUMARE.nome;
      assistEndereco = GALPAO_SUMARE.endereco;
      assistTelefone = '';
    } else {
      var assistSelVal = document.getElementById('osAssistenciaSelect').value;
      if (assistSelVal === '__outro__') {
        assistNome = (document.getElementById('osAssistenciaOutroNome').value || '').trim();
      } else {
        assistNome = assistSelVal;
      }
      assistEndereco = (document.getElementById('osAssistenciaEndereco').value || '').trim();
      assistTelefone = (document.getElementById('osAssistenciaTelefone').value || '').replace(/\D/g, '');
    }
```

No objeto `dados` (linhas 357-377), trocar as três linhas de assistência:

```js
      assistencia: assistNome,
      assistenciaEndereco: (document.getElementById('osAssistenciaEndereco').value || '').trim(),
      assistenciaTelefone: (document.getElementById('osAssistenciaTelefone').value || '').replace(/\D/g, ''),
```

Por:

```js
      tipoAssistencia: tipoAssistencia,
      assistencia: assistNome,
      assistenciaEndereco: assistEndereco,
      assistenciaTelefone: assistTelefone,
```

Nas validações, logo após `if (!dados.tipo) return mostrarFeedbackOS('Selecione o tipo (Garantia/Venda)', 'erro');` (linha 385), inserir:

```js
    if (!tipoAssistencia) return mostrarFeedbackOS('Selecione o tipo de assistência (Sumaré ou terceirizada)', 'erro');
```

No bloco de atualização do cache pós-sucesso (linha 414), trocar:

```js
          if (dados.assistencia && (dados.assistenciaEndereco || dados.assistenciaTelefone)) {
```

Por:

```js
          if (dados.tipoAssistencia !== 'Sumare' && dados.assistencia && (dados.assistenciaEndereco || dados.assistenciaTelefone)) {
```

- [ ] **Step 5: Bump de cache no index.html**

Trocar TODAS as ocorrências de `?v=2.34` por `?v=2.35` (linhas 7 e 132-143 — 13 ocorrências).

- [ ] **Step 6: Verificar sintaxe**

Run: `node --check assistencia.js`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add assistencia.js index.html
git commit -m "feat(os): seletor obrigatorio Sumare/terceirizada no form de OS (v2.35)"
```

---

### Task 6: Frontend — PDFs e WhatsApp sem telefone para Sumaré

**Files:**
- Modify: `assistencia.js:591-596` (PDF interno), `assistencia.js:970-977` (PDF cliente), `assistencia.js:1028-1031` (mensagem WhatsApp do cliente)

**Interfaces:**
- Consumes: `dados.tipoAssistencia` (presente no objeto `dados` que flui para PDFs/modal desde a Task 5)
- Produces: documentos sem a linha Telefone quando `tipoAssistencia === 'Sumare'`

- [ ] **Step 1: PDF interno (`gerarPDFAssistencia`)**

Substituir (linhas 591-596, dentro da tabela ASSISTÊNCIA TÉCNICA):

```js
          '<tr>' +
            '<td style="width:70%;"><span class="lbl">Endereço</span><span class="val">' + assistEnd + '</span></td>' +
          '</tr>' +
          '<tr>' +
            '<td><span class="lbl">Telefone</span><span class="val">' + assistTel + '</span></td>' +
          '</tr>' +
```

Por:

```js
          '<tr>' +
            '<td style="width:70%;"><span class="lbl">Endereço</span><span class="val">' + assistEnd + '</span></td>' +
          '</tr>' +
          (dados.tipoAssistencia === 'Sumare' ? '' :
          '<tr>' +
            '<td><span class="lbl">Telefone</span><span class="val">' + assistTel + '</span></td>' +
          '</tr>') +
```

- [ ] **Step 2: PDF do cliente (`gerarPDFAssistenciaCliente`)**

Substituir (linhas 972-976, bloco ASSISTÊNCIA RESPONSÁVEL):

```js
      '<div class="assist-box">' +
        '<div class="nome">' + escapeHtml(dados.assistencia || '-') + '</div>' +
        '<div class="linha"><strong>Endere&ccedil;o:</strong> ' + assistEnd + '</div>' +
        '<div class="linha"><strong>Telefone:</strong> ' + assistTel + '</div>' +
      '</div>' +
```

Por:

```js
      '<div class="assist-box">' +
        '<div class="nome">' + escapeHtml(dados.assistencia || '-') + '</div>' +
        '<div class="linha"><strong>Endere&ccedil;o:</strong> ' + assistEnd + '</div>' +
        (dados.tipoAssistencia === 'Sumare' ? '' :
        '<div class="linha"><strong>Telefone:</strong> ' + assistTel + '</div>') +
      '</div>' +
```

- [ ] **Step 3: Mensagem WhatsApp do cliente (`enviarWhatsAppClienteOS`)**

Substituir (linhas 1028-1031):

```js
      '*ASSISTÊNCIA RESPONSÁVEL*\n' +
      (dados.assistencia || '-') + '\n' +
      '📍 ' + assistEnd + '\n' +
      '📞 ' + assistTel + '\n\n' +
```

Por:

```js
      '*ASSISTÊNCIA RESPONSÁVEL*\n' +
      (dados.assistencia || '-') + '\n' +
      '📍 ' + assistEnd + '\n' +
      (dados.tipoAssistencia === 'Sumare' ? '' : '📞 ' + assistTel + '\n') +
      '\n' +
```

(O botão "WhatsApp assistência" do modal já fica desabilitado sozinho quando não há telefone —
nenhuma mudança necessária lá.)

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check assistencia.js`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add assistencia.js
git commit -m "feat(os): PDFs e WhatsApp sem telefone quando assistencia Sumare"
```

---

### Task 7: Deploy, reparo one-time e smoke test

**Files:**
- Nenhum arquivo novo — publicação e verificação.

**Interfaces:**
- Consumes: tudo das Tasks 1-6; web app URL `https://script.google.com/macros/s/AKfycbytZgFvvhTvYRgufyvFTGbMb27sxHnIQp256XQ6r7VZuX2B0RTdO3MIpbf4EcF8KgnYlw/exec`

- [ ] **Step 0 (gate): endereço do galpão**

Se a usuária já tiver número/CEP da Rua Quaresmeira da Serra, atualizar `GALPAO_SUMARE.endereco` em `assistencia.js` e commitar antes de publicar. Se não, publicar com "Rua Quaresmeira da Serra, Sumaré/SP" mesmo (dado confirmado 12/07).

- [ ] **Step 1: Push do frontend**

```bash
git push
```

Expected: GitHub Pages atualiza https://nxtlojas-hash.github.io/sac-pecas/ em ~1-2 min.

- [ ] **Step 2: Deploy do Apps Script**

Colar `google-apps-script.js` inteiro no editor (projeto `1magpf46YAy3yvOOwPNF3sRUry4PfaXDdOqr6-YHrPpLFBEyiP0o_qOJz`, Chrome NXT via `switch_browser`) → Ctrl+A, Ctrl+V, Ctrl+S → Implantar → Gerenciar implantações → ✏️ → Nova versão → Implantar.

Smoke de código novo no ar (sem token, deve responder erro controlado):

```bash
curl -sL "https://script.google.com/macros/s/AKfycbytZgFvvhTvYRgufyvFTGbMb27sxHnIQp256XQ6r7VZuX2B0RTdO3MIpbf4EcF8KgnYlw/exec?action=setup_roteamento_os_v1" -d '{"action":"setup_roteamento_os_v1"}'
```

Expected: `{"sucesso":false,"erro":"mande {\"confirmar\":\"SIM\"} para executar"}` (prova que o case novo existe).

- [ ] **Step 3: Rodar o reparo one-time**

```bash
curl -sL "https://script.google.com/macros/s/AKfycbytZgFvvhTvYRgufyvFTGbMb27sxHnIQp256XQ6r7VZuX2B0RTdO3MIpbf4EcF8KgnYlw/exec?action=setup_roteamento_os_v1" -d '{"action":"setup_roteamento_os_v1","confirmar":"SIM"}'
```

Expected: `{"sucesso":true,"piso":717,"espelhadasSumare":N,"espelhadasParceiras":M,"tipadas":~93,"cadastroFundidos":>=1}`.

Rodar de novo → Expected: `{"sucesso":false,"erro":"setup ja executado em ..."}` (idempotência).

- [ ] **Step 4: Conferir as abas (CSV, sem auth)**

```bash
ID=1QtumxGgKwzWBQBPISfDFjH3qGboiT3_1x5gbxl6R6ns
curl -sL "https://docs.google.com/spreadsheets/d/$ID/export?format=csv&gid=767600855" | tail -5   # Sumare: backfill presente, coluna CHASSI no cabecalho
curl -sL "https://docs.google.com/spreadsheets/d/$ID/export?format=csv&gid=1012035912" | tail -5  # Parceiras: OSs de 06-10/07 no fim
```

Expected: linhas novas nas duas abas; nenhuma duplicata das linhas manuais da Jacque (conferir números 45, 53, 65, 76, 83, 86 aparecem UMA vez na Sumaré).

- [ ] **Step 5: Smoke test funcional (2 OSs de teste em produção)**

No form https://nxtlojas-hash.github.io/sac-pecas/ (hard refresh):

1. Tentar enviar OS sem escolher tipo → deve barrar com "Selecione o tipo de assistência".
2. OS de teste **Sumaré** (cliente "TESTE CLAUDE — APAGAR", chassi "TESTE123") → deve criar **OS-2026-0718**, aparecer no master com TIPO ASSISTENCIA=Sumare e na aba Sumaré com chassi; PDF interno e do cliente **sem** linha Telefone.
3. OS de teste **Terceirizada** (Jackson Técnico - Campinas) → **OS-2026-0719**, espelhada na aba parceiras; PDF com telefone normal.
4. Conferir `?view=acompanhar&os=OS-2026-0718` → timeline responde.
5. Marcar as 2 OSs de teste com STATUS "CANCELADA - TESTE" no master e avisar a usuária para excluir as linhas espelhadas de teste (ou excluir as 4 linhas direto, master + espelhos).

- [ ] **Step 6: Commit final e encerramento**

```bash
git add -A && git commit -m "chore(os): ajustes pos-smoke roteamento Sumare (se houver)" || echo "nada a commitar"
git push
```

Avisar a Jacque: campo novo no ar, aba parceiras volta a receber (só terceirizadas), aba Sumaré recebe automático com chassi, e as ~93 OSs da última semana foram espelhadas.
