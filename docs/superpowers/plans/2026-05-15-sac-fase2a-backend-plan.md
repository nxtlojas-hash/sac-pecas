# NXT SAC Fase 2a — Backend Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Estender o Apps Script com endpoints para a Fase 2 do NXT SAC (Wizard de Atendimento + Aba Clientes): adicionar coluna `atendimentoId` opcional em Vendas/Orcamentos/OSes, criar 3 endpoints novos (`buscar_cliente_consolidado`, `listar_atendimentos`, `vincular_doc_atendimento`), e fazer os endpoints existentes (`registrar_venda`, `salvar_orcamento`, `registrar_os`) gravarem `atendimentoId` quando recebido no payload.

**Architecture:** Mudança apenas em `google-apps-script.js` (backend) + helpers de migração de header da planilha. Frontend continua funcionando exatamente como antes (campo `atendimentoId` é opcional). Esta sub-fase é o fundamento das próximas (Wizard, Clientes).

**Tech Stack:** Google Apps Script, Google Sheets.

**Spec:** `docs/superpowers/specs/2026-05-15-sac-fase2-wizard-design.md`

---

## File Structure

- **Modify:** `google-apps-script.js` — funções novas + ajuste nos existentes + setup de colunas
- **Não toca:** nenhum arquivo frontend (Fase 2b-2g cuida disso)

---

## Task 2a.1: Setup — adicionar coluna `atendimentoId` nas 3 abas

**Files:**
- Modify: `google-apps-script.js`

- [ ] **Step 1: Adicionar função `setupColunaAtendimentoId` no final do arquivo**

```javascript

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
  ['Vendas', 'Orcamentos', 'OSes', 'Assistencias'].forEach(function(nomeAba) {
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
```

- [ ] **Step 2: Adicionar função helper `getColAtendimentoId`**

Logo após `setupColunaAtendimentoId`:

```javascript

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
```

- [ ] **Step 3: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/google-apps-script.js
```

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add google-apps-script.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(fase2): setupColunaAtendimentoId + helper (Fase 2a)"
```

---

## Task 2a.2: Endpoint `vincularDocAtendimento`

**Files:**
- Modify: `google-apps-script.js`

- [ ] **Step 1: Adicionar função `vincularDocAtendimento`**

Logo após `getColAtendimentoId`:

```javascript

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
    'venda': 'Vendas',
    'orcamento': 'Orcamentos',
    'os': 'OSes',
    'assistencia': 'Assistencias'
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
```

- [ ] **Step 2: Adicionar case no `doPost`**

Localizar `case 'registrar_atendimento':` no doPost. Logo após, adicionar:

```javascript
      case 'vincular_doc_atendimento':
        return jsonResponse(vincularDocAtendimento(body));
```

- [ ] **Step 3: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/google-apps-script.js
```

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add google-apps-script.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(fase2): endpoint vincular_doc_atendimento"
```

---

## Task 2a.3: Endpoint `listarAtendimentos`

**Files:**
- Modify: `google-apps-script.js`

- [ ] **Step 1: Adicionar função**

Logo após `vincularDocAtendimento`:

```javascript

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
```

- [ ] **Step 2: Adicionar case no `doGet`**

Localizar `case 'listar_estoque':` no doGet. Logo após o case `listar_movimentacoes`, adicionar:

```javascript
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
```

- [ ] **Step 3: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/google-apps-script.js
```

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add google-apps-script.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(fase2): endpoint listar_atendimentos"
```

---

## Task 2a.4: Endpoint `buscarClienteConsolidado`

**Files:**
- Modify: `google-apps-script.js`

- [ ] **Step 1: Adicionar função**

Logo após `listarAtendimentos`:

```javascript

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
  var shV = ss.getSheetByName('Vendas');
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
  ['OSes', 'Assistencias'].forEach(function(nomeAba) {
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
```

- [ ] **Step 2: Adicionar case no `doGet`**

Logo após `case 'listar_atendimentos':`:

```javascript
      case 'buscar_cliente_consolidado':
        return jsonResponse(buscarClienteConsolidado({
          cpf: e.parameter.cpf,
          telefone: e.parameter.telefone,
          nome: e.parameter.nome
        }));
```

- [ ] **Step 3: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/google-apps-script.js
```

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add google-apps-script.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(fase2): endpoint buscar_cliente_consolidado"
```

---

## Task 2a.5: Endpoints existentes gravam `atendimentoId`

**Files:**
- Modify: `google-apps-script.js` — funções `registrarVenda`, `salvarOrcamento`, `registrarOS`

- [ ] **Step 1: Em `registrarVenda`, gravar atendimentoId quando presente**

Localizar a função `registrarVenda(payload)` no Apps Script. Logo após o `appendRow` que insere a venda, adicionar:

```javascript
  // Fase 2: vincular ao atendimento se presente no payload
  if (payload.atendimentoId) {
    try {
      var sheetVendas = ss.getSheetByName('Vendas');
      var colAt = getColAtendimentoId(sheetVendas);
      if (colAt > 0) {
        var ultLinha = sheetVendas.getLastRow();
        sheetVendas.getRange(ultLinha, colAt).setValue(payload.atendimentoId);
      }
    } catch (e) { /* nao bloqueia o fluxo */ }
  }
```

(Adapte a referência a `ss` e nome da aba para o que existir na função — provavelmente já tem variáveis ali; use o nome de aba que `registrarVenda` usa.)

- [ ] **Step 2: Mesmo padrão em `salvarOrcamento`**

Localizar `salvarOrcamento(payload)`. Logo após o appendRow do orçamento, adicionar:

```javascript
  if (payload.atendimentoId) {
    try {
      var sheetOrc = ss.getSheetByName('Orcamentos');
      var colAt = getColAtendimentoId(sheetOrc);
      if (colAt > 0) {
        var ultLinha = sheetOrc.getLastRow();
        sheetOrc.getRange(ultLinha, colAt).setValue(payload.atendimentoId);
      }
    } catch (e) { /* nao bloqueia */ }
  }
```

- [ ] **Step 3: Mesmo padrão em `registrarOS`**

Localizar `registrarOS(payload)`. Logo após o appendRow, adicionar:

```javascript
  if (payload.atendimentoId) {
    try {
      var sheetOS = ss.getSheetByName('OSes');
      if (!sheetOS) sheetOS = ss.getSheetByName('Assistencias');
      var colAt = getColAtendimentoId(sheetOS);
      if (colAt > 0) {
        var ultLinha = sheetOS.getLastRow();
        sheetOS.getRange(ultLinha, colAt).setValue(payload.atendimentoId);
      }
    } catch (e) { /* nao bloqueia */ }
  }
```

- [ ] **Step 4: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/google-apps-script.js
```

- [ ] **Step 5: Commit + Push**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add google-apps-script.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(fase2): registrar_venda/salvar_orcamento/registrar_os gravam atendimentoId quando presente"
git -C C:/dev/NXT/ativos/sac-pecas push origin master
```

---

## Task 2a.6: Deploy manual (usuária)

- [ ] **Step 1: Copiar conteúdo do `google-apps-script.js` para clipboard**

```bash
powershell -Command "Get-Content -Raw 'C:\dev\NXT\ativos\sac-pecas\google-apps-script.js' | Set-Clipboard"
```

- [ ] **Step 2: Instruir a usuária**

Mensagem:
1. https://script.google.com → projeto NXT SAC
2. Ctrl+A → Ctrl+V → Ctrl+S
3. Dropdown de função → seleciona `setupColunaAtendimentoId` → ▶ Executar (1 vez)
4. Confere log: deve mostrar 'Vendas: coluna atendimentoId adicionada', etc.
5. Implantar → Gerenciar implantações → Nova versão → Implantar

---

## Self-Review

**Spec coverage (Sub-fase 2a):**
- ✅ Coluna `atendimentoId` nas 4 abas — Task 2a.1
- ✅ Endpoint `vincular_doc_atendimento` — Task 2a.2
- ✅ Endpoint `listar_atendimentos` — Task 2a.3
- ✅ Endpoint `buscar_cliente_consolidado` — Task 2a.4
- ✅ Existing endpoints aceitam `atendimentoId` — Task 2a.5
- ✅ Setup idempotente para usuária rodar — Task 2a.1, 2a.6

**Placeholder scan:** Sem TODOs.

**Type consistency:** Funções nomeadas em camelCase consistente. Constante `SHEET_ATENDIMENTOS` reaproveitada da Fase 1.

**Riscos:**
- A função `registrarVenda` no Apps Script já existe — não conheço sua referência exata a `ss`. O subagent deve ler o código atual antes de aplicar o patch (instrução abaixo).

---

## Notas para o subagent executor

- Antes de aplicar Task 2a.5, leia as funções `registrarVenda`, `salvarOrcamento`, `registrarOS` no arquivo atual e identifique se `ss` (SpreadsheetApp) já está disponível no escopo, ou crie localmente
- Se as funções têm `try/catch` global, insira a lógica de `atendimentoId` DENTRO do try
- Não pushar antes de toda a fase 2a estar completa (push só na Task 2a.5 final)
