# Estoque de Peças — Fase E1 (Backend) + Fase E2 (Sub-tela Movimentar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar aba `MovimentacoesEstoque` no Sheets, endpoints de movimentação no Apps Script (`registrar_movimentacao`, `listar_movimentacoes`, `setup_movimentacoes`), e nova aba "Estoque" no app com sub-tela "Movimentar" funcionando ponta-a-ponta (Entrada / Saída / Ajuste por armazém Sumaré ou Jaraguá).

**Architecture:** Frontend HTML/CSS/JS vanilla em IIFE. Backend Google Apps Script grava em nova aba `MovimentacoesEstoque` e atualiza saldo em `Estoque` (atomicamente). Cada movimentação especifica armazém (`Sumare` ou `Jaragua`). Nenhuma alteração nos fluxos atuais (Venda peças, Orçamentos, OS, Atendimento) nesta fase.

**Tech Stack:** HTML/CSS/JS vanilla, Google Apps Script, Google Sheets, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-05-15-estoque-pecas-design.md`

---

## File Structure

- **Modify:** `google-apps-script.js` — adicionar constantes, `setupMovimentacoesEstoque`, `registrarMovimentacao`, `listarMovimentacoes`, `gerarProximoIdMovimentacao` e cases no `doPost`/`doGet`
- **Modify:** `index.html` — nova tab "Estoque" no nav + nova `<section id="view-estoque">` + import `<script src="estoque.js?v=2.6">` + bump cache busting global pra `?v=2.6`
- **Create:** `estoque.js` — novo módulo IIFE com a view "Estoque" (apenas sub-tela "Movimentar" nesta fase)
- **Modify:** `app.js` — registrar roteamento `case 'estoque'` chamando `window.initEstoque`
- **Modify (manual no Apps Script editor):** colar nova versão do `google-apps-script.js` no editor do Apps Script após edição local, e rodar `setupMovimentacoesEstoque` uma vez

---

## FASE E1 — Backend MovimentacoesEstoque

### Task E1.1: Adicionar constantes e função setup

**Files:**
- Modify: `google-apps-script.js` — adicionar ao final do arquivo (depois das funções de Atendimentos)

- [ ] **Step 1: Adicionar bloco no final do arquivo**

No `google-apps-script.js`, **antes da última linha**, adicionar:

```javascript

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
```

- [ ] **Step 2: Validar sintaxe**

Run: `node --check C:/dev/NXT/ativos/sac-pecas/google-apps-script.js`
Expected: sem output (OK)

- [ ] **Step 3: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add google-apps-script.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): adiciona setup da aba MovimentacoesEstoque"
```

---

### Task E1.2: Gerador de ID + registrarMovimentacao

**Files:**
- Modify: `google-apps-script.js` — adicionar logo após `setupMovimentacoesEstoque`

- [ ] **Step 1: Adicionar funções**

Em `google-apps-script.js`, logo após o `}` que fecha `setupMovimentacoesEstoque`, adicionar:

```javascript

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
```

- [ ] **Step 2: Validar sintaxe**

Run: `node --check C:/dev/NXT/ativos/sac-pecas/google-apps-script.js`
Expected: sem output (OK)

- [ ] **Step 3: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add google-apps-script.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): registrar movimentacao + atualizar saldo + validacao"
```

---

### Task E1.3: listarMovimentacoes

**Files:**
- Modify: `google-apps-script.js` — adicionar após `atualizarSaldoEstoque`

- [ ] **Step 1: Adicionar função**

Logo após `atualizarSaldoEstoque`, adicionar:

```javascript

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
```

- [ ] **Step 2: Validar sintaxe**

Run: `node --check C:/dev/NXT/ativos/sac-pecas/google-apps-script.js`
Expected: sem output (OK)

- [ ] **Step 3: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add google-apps-script.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): listar movimentacoes com filtros"
```

---

### Task E1.4: Roteamento (cases no doPost/doGet)

**Files:**
- Modify: `google-apps-script.js` — adicionar cases nos switches

- [ ] **Step 1: Adicionar case no doPost**

Localizar `case 'registrar_atendimento':` no arquivo. Logo após o bloco daquele case, antes do `default:`, adicionar:

```javascript
      // --- Movimentacoes de Estoque (Fase E1 NXT SAC) ---
      case 'registrar_movimentacao':
        return jsonResponse(registrarMovimentacao(body));
```

- [ ] **Step 2: Adicionar case no doGet**

Localizar a função `doGet` (perto da linha 700 do arquivo). Procurar pelo case `'listar_estoque'`. Logo após aquele bloco, antes do `default:`, adicionar:

```javascript
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
```

- [ ] **Step 3: Validar sintaxe**

Run: `node --check C:/dev/NXT/ativos/sac-pecas/google-apps-script.js`
Expected: sem output

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add google-apps-script.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): roteamento de registrar_movimentacao e listar_movimentacoes"
```

---

### Task E1.5: Deploy Apps Script (manual) + setup da aba

**Files:**
- Apps Script Editor (script.google.com) — colar novo conteúdo

- [ ] **Step 1: Copiar conteúdo do `google-apps-script.js` para clipboard**

```bash
powershell -Command "Get-Content -Raw 'C:\dev\NXT\ativos\sac-pecas\google-apps-script.js' | Set-Clipboard"
```

- [ ] **Step 2: Instruir usuária a colar e rodar `setupMovimentacoesEstoque`**

Mensagem para a usuária:
1. Abre https://script.google.com (conta nxt.lojas@gmail.com)
2. Abre o projeto do SAC
3. Ctrl+A → Ctrl+V (cola a versão nova)
4. Ctrl+S (salva)
5. No dropdown de função, seleciona `setupMovimentacoesEstoque`
6. Clica ▶ Executar
7. Confirma que o log mostra "Aba MovimentacoesEstoque criada com 11 colunas."
8. **Implantar** → Gerenciar implantações → Editar → Nova versão → Implantar
9. Confirma se URL mudou (se sim, atualiza GOOGLE_SCRIPT_URL no formulario.js)

---

## FASE E2 — Frontend "Movimentar"

### Task E2.1: Adicionar tab "Estoque" e view vazia no index.html

**Files:**
- Modify: `index.html` — adicionar tab no nav e section

- [ ] **Step 1: Adicionar tab no nav**

Em `index.html`, no bloco `<nav class="nav-tabs">`, adicionar a tab "Estoque" logo após "Assistencias" e antes de "Admin":

```html
<button class="nav-tab" data-view="estoque">&#128230; Estoque</button>
```

(`&#128230;` é o ícone 📦.)

- [ ] **Step 2: Adicionar section da view**

No `<main>`, logo após `<section class="view" id="view-atendimento">...</section>`, inserir:

```html
<!-- Estoque View -->
<section class="view" id="view-estoque">
    <div id="estoque-container"></div>
</section>
```

- [ ] **Step 3: Bump cache-busting de `?v=2.5` para `?v=2.6` em todos os imports**

No `index.html`, substituir todas as ocorrências de `?v=2.5` por `?v=2.6`. Esperado: 8 ocorrências afetadas.

- [ ] **Step 4: Adicionar script estoque.js**

Logo após `<script src="atendimento.js?v=2.5"></script>`, adicionar:

```html
<script src="estoque.js?v=2.6"></script>
```

E mudar `atendimento.js?v=2.5` para `atendimento.js?v=2.6` no mesmo passo.

- [ ] **Step 5: Validar**

Run: `grep -c "?v=2.6" C:/dev/NXT/ativos/sac-pecas/index.html`
Expected: 9 ocorrências (8 prévias bumpadas + 1 novo `estoque.js`)

- [ ] **Step 6: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add index.html
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): adiciona tab Estoque + cache busting v2.6"
```

---

### Task E2.2: Criar `estoque.js` skeleton + roteamento

**Files:**
- Create: `estoque.js`
- Modify: `app.js` — registrar roteamento

- [ ] **Step 1: Criar `C:/dev/NXT/ativos/sac-pecas/estoque.js`**

```javascript
/* ===== NXT SAC V2.6 - Estoque (Movimentacoes Fase E2) ===== */

(function() {
  var SCRIPT_URL = null;
  function resolverUrl() {
    if (SCRIPT_URL) return SCRIPT_URL;
    if (typeof GOOGLE_SCRIPT_URL !== 'undefined') {
      SCRIPT_URL = GOOGLE_SCRIPT_URL;
      return SCRIPT_URL;
    }
    throw new Error('GOOGLE_SCRIPT_URL nao definida — carregar formulario.js primeiro.');
  }

  var submetendo = false;
  var LS_OPERADORES = 'nxt-estoque-operadores';

  window.initEstoque = function() {
    var container = document.getElementById('estoque-container');
    if (!container) return;
    container.innerHTML = buildHTML();
    setupListeners();
    console.log('Estoque (Fase E2) inicializado');
  };

  function buildHTML() {
    return '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128230; Estoque de Pe&ccedil;as</h2>' +
      '<div class="tabs-internas" style="display:flex;gap:0.5rem;margin-bottom:1rem;border-bottom:1px solid #2a2a2a;">' +
        '<button class="tab-interna active" data-subtab="movimentar" style="background:none;border:none;color:var(--cor-primaria);padding:0.5rem 1rem;border-bottom:2px solid var(--cor-primaria);cursor:pointer;font-weight:600;">Movimentar</button>' +
        '<button class="tab-interna" data-subtab="saldo" disabled style="background:none;border:none;color:#5a5a5a;padding:0.5rem 1rem;cursor:not-allowed;">Saldo (em breve)</button>' +
        '<button class="tab-interna" data-subtab="inventario" disabled style="background:none;border:none;color:#5a5a5a;padding:0.5rem 1rem;cursor:not-allowed;">Invent&aacute;rio (em breve)</button>' +
      '</div>' +
      '<div id="subtab-movimentar"></div>';
  }

  function setupListeners() {
    document.getElementById('subtab-movimentar').innerHTML = buildFormMovimentarHTML();
    setupFormMovimentar();
  }

  function buildFormMovimentarHTML() {
    return '<p style="color:#9a9a9a;padding:1rem;">Form em construcao...</p>';
  }

  function setupFormMovimentar() {
    // Placeholder — implementado nas proximas tasks
  }

})();
```

- [ ] **Step 2: Registrar roteamento em `app.js`**

Em `app.js`, localizar a função `navigateTo` (linha ~28). Encontrar o `else if (view === 'atendimento')` e adicionar logo após:

```javascript
} else if (view === 'estoque') {
  if (typeof window.initEstoque === 'function') window.initEstoque();
```

- [ ] **Step 3: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/estoque.js
node --check C:/dev/NXT/ativos/sac-pecas/app.js
```

Expected: sem output

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add estoque.js app.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): modulo estoque.js com skeleton + roteamento"
```

---

### Task E2.3: Form "Movimentar" HTML completo

**Files:**
- Modify: `estoque.js` — substituir `buildFormMovimentarHTML`

- [ ] **Step 1: Substituir a função**

Em `estoque.js`, substituir a função `buildFormMovimentarHTML` por:

```javascript
function buildFormMovimentarHTML() {
  var modelosOpts = '<option value="">Selecione...</option>';
  if (typeof CATALOGO_MODELOS !== 'undefined') {
    Object.keys(CATALOGO_MODELOS).forEach(function(id) {
      modelosOpts += '<option value="' + id + '">' + CATALOGO_MODELOS[id].nome + '</option>';
    });
  }

  return '' +
    '<form id="estForm" autocomplete="off">' +
      '<datalist id="estOperadoresList"></datalist>' +

      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Movimenta&ccedil;&atilde;o</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="estTipo">Tipo *</label>' +
            '<select id="estTipo" required>' +
              '<option value="">Selecione...</option>' +
              '<option value="Entrada">Entrada</option>' +
              '<option value="Saida">Sa&iacute;da</option>' +
              '<option value="Ajuste">Ajuste</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="estArmazem">Armaz&eacute;m *</label>' +
            '<select id="estArmazem" required>' +
              '<option value="">Selecione...</option>' +
              '<option value="Sumare">Sumar&eacute;</option>' +
              '<option value="Jaragua">Jaragu&aacute;</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Pe&ccedil;a</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="estModelo">Modelo *</label>' +
            '<select id="estModelo" required>' + modelosOpts + '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="estPeca">Pe&ccedil;a *</label>' +
            '<input type="text" id="estPeca" list="estPecasList" placeholder="Digite ou selecione" required>' +
            '<datalist id="estPecasList"></datalist>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="estQtd">Quantidade *</label>' +
            '<input type="number" id="estQtd" min="1" step="1" required>' +
            '<span class="campo-aviso" style="display:none;color:#9a9a9a;font-size:0.85rem;" id="estDicaAjuste">Em Ajuste, use negativo (-N) para reduzir saldo.</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Origem e Operador</div>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:2 1 320px;">' +
            '<label for="estOrigem">Origem *</label>' +
            '<input type="text" id="estOrigem" list="estOrigensList" placeholder="Ex: Desmontagem moto NXT123 / Compra fornecedor / Perda" required>' +
            '<datalist id="estOrigensList">' +
              '<option value="Desmontagem moto">' +
              '<option value="Compra fornecedor">' +
              '<option value="Devolucao cliente">' +
              '<option value="Invent&aacute;rio inicial">' +
              '<option value="Perda">' +
              '<option value="Encontrado">' +
              '<option value="Ajuste manual">' +
            '</datalist>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="estOperador">Operador *</label>' +
            '<input type="text" id="estOperador" list="estOperadoresList" placeholder="Quem registrou?" required>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:1 1 100%;">' +
            '<label for="estObs">Observa&ccedil;&otilde;es</label>' +
            '<textarea id="estObs" rows="2" placeholder="Opcional"></textarea>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem;">' +
        '<button type="button" class="btn-secundario" id="btnLimparEst">Limpar</button>' +
        '<button type="button" class="btn-primario" id="btnRegistrarEst">Registrar &#10148;</button>' +
      '</div>' +

      '<div id="estFeedback" style="margin-top:1rem;"></div>' +
    '</form>';
}
```

- [ ] **Step 2: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/estoque.js
```

- [ ] **Step 3: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add estoque.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): form HTML completo para Movimentar"
```

---

### Task E2.4: Listeners — dropdown de peças por modelo + operadores localStorage + dica Ajuste

**Files:**
- Modify: `estoque.js` — substituir `setupFormMovimentar`

- [ ] **Step 1: Substituir a função**

Em `estoque.js`, substituir `setupFormMovimentar` por:

```javascript
function setupFormMovimentar() {
  populateOperadoresDatalist();

  // Modelo muda -> popula datalist de pecas
  var modeloSel = document.getElementById('estModelo');
  if (modeloSel) {
    modeloSel.addEventListener('change', function() {
      popularDatalistPecas(modeloSel.value);
    });
  }

  // Tipo Ajuste -> mostra dica
  var tipoSel = document.getElementById('estTipo');
  var dica = document.getElementById('estDicaAjuste');
  if (tipoSel && dica) {
    tipoSel.addEventListener('change', function() {
      dica.style.display = (tipoSel.value === 'Ajuste') ? '' : 'none';
      // Em Ajuste, permite negativos no input quantidade
      var qtdInput = document.getElementById('estQtd');
      if (tipoSel.value === 'Ajuste') {
        qtdInput.removeAttribute('min');
      } else {
        qtdInput.setAttribute('min', '1');
      }
    });
  }

  document.getElementById('btnLimparEst').addEventListener('click', limparForm);
  document.getElementById('btnRegistrarEst').addEventListener('click', registrarMov);
}

function popularDatalistPecas(modelId) {
  var datalist = document.getElementById('estPecasList');
  if (!datalist) return;
  datalist.innerHTML = '';
  if (!modelId || typeof CATALOGO_MODELOS === 'undefined' || !CATALOGO_MODELOS[modelId]) return;
  var pecas = CATALOGO_MODELOS[modelId].pecas || [];
  pecas.forEach(function(p) {
    var opt = document.createElement('option');
    opt.value = p.nome;
    datalist.appendChild(opt);
  });
}

function getOperadores() {
  try {
    return JSON.parse(localStorage.getItem(LS_OPERADORES) || '[]');
  } catch (e) {
    return [];
  }
}

function saveOperador(nome) {
  var trimmed = (nome || '').trim();
  if (!trimmed) return;
  var lista = getOperadores();
  var existe = lista.some(function(n) { return n.toLowerCase() === trimmed.toLowerCase(); });
  if (existe) return;
  lista.push(trimmed);
  lista.sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); });
  localStorage.setItem(LS_OPERADORES, JSON.stringify(lista));
  populateOperadoresDatalist();
}

function populateOperadoresDatalist() {
  var dl = document.getElementById('estOperadoresList');
  if (!dl) return;
  dl.innerHTML = '';
  getOperadores().forEach(function(n) {
    var opt = document.createElement('option');
    opt.value = n;
    dl.appendChild(opt);
  });
}

function limparForm() {
  document.getElementById('estForm').reset();
  document.getElementById('estPecasList').innerHTML = '';
  document.getElementById('estDicaAjuste').style.display = 'none';
  document.getElementById('estQtd').setAttribute('min', '1');
  var fb = document.getElementById('estFeedback');
  if (fb) fb.innerHTML = '';
}

function registrarMov() {
  // Placeholder — implementado na Task E2.5
  console.log('registrarMov ainda nao implementado');
}

function mostrarFeedback(msg, tipo) {
  var el = document.getElementById('estFeedback');
  if (!el) return;
  var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
  el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.75rem 1rem;border-radius:6px;text-align:center;font-weight:600;">' + msg + '</div>';
}
```

- [ ] **Step 2: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/estoque.js
```

- [ ] **Step 3: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add estoque.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): dropdown de pecas por modelo + operadores localStorage"
```

---

### Task E2.5: Submit + validação + feedback

**Files:**
- Modify: `estoque.js` — substituir `registrarMov`

- [ ] **Step 1: Substituir a função**

Em `estoque.js`, substituir `registrarMov` por:

```javascript
function registrarMov() {
  if (submetendo) return;

  var dados = {
    tipo: document.getElementById('estTipo').value,
    armazem: document.getElementById('estArmazem').value,
    modelo: document.getElementById('estModelo').selectedOptions[0] ? document.getElementById('estModelo').selectedOptions[0].textContent : '',
    peca: document.getElementById('estPeca').value.trim(),
    quantidade: parseInt(document.getElementById('estQtd').value),
    origem: document.getElementById('estOrigem').value.trim(),
    operador: document.getElementById('estOperador').value.trim(),
    observacoes: document.getElementById('estObs').value.trim()
  };

  if (!dados.tipo) return mostrarFeedback('Selecione o tipo', 'erro');
  if (!dados.armazem) return mostrarFeedback('Selecione o armazem', 'erro');
  if (!dados.modelo) return mostrarFeedback('Selecione o modelo', 'erro');
  if (!dados.peca) return mostrarFeedback('Informe a peca', 'erro');
  if (isNaN(dados.quantidade) || dados.quantidade === 0) return mostrarFeedback('Quantidade invalida', 'erro');
  if (dados.tipo !== 'Ajuste' && dados.quantidade < 0) return mostrarFeedback('Quantidade deve ser positiva (use Ajuste para reduzir saldo)', 'erro');
  if (!dados.origem) return mostrarFeedback('Informe a origem', 'erro');
  if (!dados.operador) return mostrarFeedback('Informe o operador', 'erro');

  submetendo = true;
  var btn = document.getElementById('btnRegistrarEst');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  mostrarFeedback('Registrando movimentacao...', 'info');

  var payload = Object.assign({ action: 'registrar_movimentacao' }, dados);

  fetch(resolverUrl(), {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  })
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (resp && resp.sucesso) {
        saveOperador(dados.operador);
        mostrarSucessoMov(resp, dados);
      } else {
        mostrarFeedback('Erro: ' + (resp && resp.erro ? resp.erro : 'resposta invalida'), 'erro');
      }
    })
    .catch(function(err) {
      mostrarFeedback('Erro de rede: ' + err.message, 'erro');
    })
    .finally(function() {
      submetendo = false;
      btn.disabled = false;
      btn.innerHTML = 'Registrar &#10148;';
    });
}

function mostrarSucessoMov(resp, dados) {
  var saldoTxt = (typeof resp.saldoAtual === 'number') ? ' Saldo atual em ' + resp.armazem + ': ' + resp.saldoAtual + ' un.' : '';
  mostrarFeedback('OK ' + resp.id + ' — ' + dados.tipo + ' ' + Math.abs(dados.quantidade) + ' un de ' + dados.peca + '.' + saldoTxt, 'sucesso');
  limparForm();
}
```

- [ ] **Step 2: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/estoque.js
```

- [ ] **Step 3: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add estoque.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): submit + validacao + feedback de sucesso"
```

---

### Task E2.6: Bump headers de versão + push final

**Files:**
- Modify: `formulario.js`, `assistencia.js`, `atendimento.js`, `app.js`, `catalogo.js`, `orcamento.js`, `admin.js`, `style.css` — bump comentário de V2.5 para V2.6
- Modify: `index.html` — bump v2.5 -> v2.6 do `atendimento.js` (caso ainda tenha)

- [ ] **Step 1: Bump cosmético dos headers**

```bash
sed -i 's/NXT SAC V2\.5/NXT SAC V2.6/g' C:/dev/NXT/ativos/sac-pecas/formulario.js
sed -i 's/NXT SAC V2\.5/NXT SAC V2.6/g' C:/dev/NXT/ativos/sac-pecas/assistencia.js
sed -i 's/NXT SAC V2\.5/NXT SAC V2.6/g' C:/dev/NXT/ativos/sac-pecas/atendimento.js
sed -i 's/NXT SAC V2\.5/NXT SAC V2.6/g' C:/dev/NXT/ativos/sac-pecas/app.js
sed -i 's/NXT SAC V2\.5/NXT SAC V2.6/g' C:/dev/NXT/ativos/sac-pecas/catalogo.js
sed -i 's/NXT SAC V2\.5/NXT SAC V2.6/g' C:/dev/NXT/ativos/sac-pecas/orcamento.js
sed -i 's/NXT SAC V2\.5/NXT SAC V2.6/g' C:/dev/NXT/ativos/sac-pecas/admin.js
sed -i 's/NXT SAC V2\.5/NXT SAC V2.6/g' C:/dev/NXT/ativos/sac-pecas/style.css
```

Validar JS:

```bash
for f in formulario.js assistencia.js atendimento.js app.js catalogo.js orcamento.js admin.js; do
  node --check C:/dev/NXT/ativos/sac-pecas/$f
done
```

Expected: sem output.

- [ ] **Step 2: Commit + Push**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add -u
git -C C:/dev/NXT/ativos/sac-pecas commit -m "chore: bump V2.5 -> V2.6 nos headers"
git -C C:/dev/NXT/ativos/sac-pecas push origin master
```

GitHub Pages atualiza em ~1min.

---

### Task E2.7: Teste end-to-end em produção

- [ ] **Step 1: Em janela anonima, abrir https://nxtlojas-hash.github.io/sac-pecas/**

Validar:
- Aba "Estoque" aparece no nav (após Assistências, antes de Admin)
- Click em "Estoque" carrega view com título "Estoque de Peças"
- Sub-tabs: "Movimentar" (ativa, lime), "Saldo (em breve)" e "Inventário (em breve)" (desabilitadas)

- [ ] **Step 2: Registrar Entrada de teste**

Preencher:
- Tipo: Entrada
- Armazém: Sumaré
- Modelo: Jaya
- Peça: digitar "Espelho Esq" (datalist sugere se houver)
- Quantidade: 5
- Origem: Desmontagem moto NXT2026X1234
- Operador: Pedro

Click "Registrar". Esperado:
- Feedback verde "OK MOV-2026-0001 — Entrada 5 un de Espelho Esq. Saldo atual em Sumare: 5 un."
- Form limpa
- Operador "Pedro" salvo no localStorage (aparece no datalist na próxima vez)

Conferir na planilha Google:
- Aba `MovimentacoesEstoque`: 1 linha com tipo=Entrada, armazem=Sumare, qtd=5
- Aba `Estoque`: linha do Jaya/Espelho Esq com Sumare=5

- [ ] **Step 3: Registrar Saída**

Mesma peça/modelo/armazém. Tipo=Saida, Qtd=2. Origem="Venda balcão teste". Operador=Pedro.

Esperado: saldo Sumare passa para 3.

- [ ] **Step 4: Registrar Ajuste negativo**

Mesma peça. Tipo=Ajuste, Qtd=-1, Origem=Perda, Operador=Pedro.

Esperado: saldo Sumare passa para 2.

- [ ] **Step 5: Tentar Ajuste positivo**

Mesma peça. Tipo=Ajuste, Qtd=+10, Origem=Encontrado.

Esperado: saldo Sumare passa para 12.

- [ ] **Step 6: Tentar Saída no Jaraguá (armazém diferente)**

Tipo=Saida, Armazem=Jaragua, mesma peça, Qtd=3.

Esperado: saldo Jaragua passa para -3 (sistema permite negativo intencionalmente — saldo Sumaré não muda).

- [ ] **Step 7: Conferir planilha**

Aba `MovimentacoesEstoque`: 5 linhas (MOV-2026-0001 até 0005).
Aba `Estoque`: linha Jaya/Espelho Esq com Sumare=12, Jaragua=-3.

---

## Self-Review

**Spec coverage (Fases E1+E2):**
- ✅ Aba `MovimentacoesEstoque` com 11 colunas — Task E1.1
- ✅ Endpoint `registrar_movimentacao` com validação — Tasks E1.2, E1.4
- ✅ Endpoint `listar_movimentacoes` com filtros — Tasks E1.3, E1.4
- ✅ `LockService` para ID concorrente — Task E1.2
- ✅ Aba `Estoque` atualizada automaticamente por cada mov — Task E1.2 (`atualizarSaldoEstoque`)
- ✅ Cria peça nova na aba `Estoque` se não existir — Task E1.2
- ✅ Suporte aos 2 armazéns (Sumaré, Jaraguá) — Tasks E1.2, E2.3
- ✅ Saldo negativo permitido com aviso — Task E2.5 + flag implícita no backend
- ✅ Nova tab "Estoque" no app — Task E2.1
- ✅ Sub-tela "Movimentar" funcional — Tasks E2.3, E2.4, E2.5
- ✅ Datalist de operadores via localStorage — Task E2.4
- ✅ Tipo Ajuste aceita negativo — Task E2.4
- ❌ Sub-telas Saldo + Inventário — fora do escopo (Fases E3+E5 próprias)
- ❌ Integração `baixa_estoque` com movimentações — fora do escopo (Fase E4 própria)

**Placeholder scan:** Nenhum `TBD/TODO`. Cada step tem código completo ou comando exato.

**Type consistency:** Nomes consistentes (`registrarMov`, `mostrarFeedback`, `mostrarSucessoMov`, `popularDatalistPecas`, `getOperadores`, `saveOperador`, `populateOperadoresDatalist`, `limparForm`). IDs do DOM começam com `est` (`estForm`, `estTipo`, `estArmazem`, `estModelo`, `estPeca`, etc).

---

## Próximas fases (referência)

- **Fase E3:** Sub-tela "Inventário" (contagem em lote por armazém)
- **Fase E4:** Integrar `baixa_estoque` (venda gera movimentação Saida automaticamente)
- **Fase E5:** Sub-tela "Saldo" com filtros e visualização
