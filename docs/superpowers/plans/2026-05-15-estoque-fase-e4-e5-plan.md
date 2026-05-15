# Estoque de Peças — Fase E4 (Integração baixa_estoque) + Fase E5 (Sub-tela Saldo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** (E4) Integrar a baixa automática de estoque feita ao registrar venda com a aba `MovimentacoesEstoque`, gerando uma movimentação `Saida` rastreável por venda; (E5) habilitar sub-tela "Saldo" com lista de peças, filtros (modelo, busca por peça, só com saldo / só zerados) e botão refresh.

**Architecture:** E4 modifica `baixaEstoque` no Apps Script pra delegar à `registrarMovimentacao` (criando trilha) — mudança backend isolada. E5 adiciona renderização da sub-tab "Saldo" em `estoque.js`, consumindo o endpoint `listar_estoque` que já existe. Sem novas dependências.

**Tech Stack:** HTML/CSS/JS vanilla, Google Apps Script, Google Sheets.

**Spec:** `docs/superpowers/specs/2026-05-15-estoque-pecas-design.md`

---

## File Structure

- **Modify:** `google-apps-script.js` — refatorar `baixaEstoque` pra registrar movimentação Saida
- **Modify:** `estoque.js` — habilitar sub-tab "Saldo" + funções de render/filtro
- **Modify:** `index.html` — bump `?v=2.7` → `?v=2.8`
- **Modify:** demais arquivos — bump header V2.7 → V2.8

---

## FASE E4 — Integração baixa_estoque

### Task E4.1: Refatorar `baixaEstoque` pra criar Saida

**Files:**
- Modify: `google-apps-script.js` — função `baixaEstoque` existente

- [ ] **Step 1: Localizar `baixaEstoque` no arquivo**

Em `google-apps-script.js`, procurar por `function baixaEstoque(`. A função existente recebe payload do tipo:
```js
{ modelo, peca, sumare, jaragua, vendaId, vendedor }
```
e subtrai diretamente das colunas Sumare/Jaragua da aba Estoque.

- [ ] **Step 2: Substituir `baixaEstoque` por versão que delega à `registrarMovimentacao`**

Localizar a função `baixaEstoque(body)` e substituir por:

```javascript
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
```

- [ ] **Step 3: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/google-apps-script.js
```

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add google-apps-script.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): baixa_estoque cria movimentacao Saida vinculada a venda (Fase E4)"
```

---

## FASE E5 — Sub-tela "Saldo"

### Task E5.1: Habilitar sub-tab "Saldo" + render

**Files:**
- Modify: `estoque.js` — habilitar a tab e adicionar funções

- [ ] **Step 1: Alterar `buildHTML` pra habilitar a sub-tab Saldo**

Em `estoque.js`, substituir a função `buildHTML` por:

```javascript
function buildHTML() {
  return '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128230; Estoque de Pe&ccedil;as</h2>' +
    '<div class="tabs-internas" style="display:flex;gap:0.5rem;margin-bottom:1rem;border-bottom:1px solid #2a2a2a;">' +
      '<button class="tab-interna active" data-subtab="movimentar" style="background:none;border:none;color:var(--cor-primaria);padding:0.5rem 1rem;border-bottom:2px solid var(--cor-primaria);cursor:pointer;font-weight:600;">Movimentar</button>' +
      '<button class="tab-interna" data-subtab="inventario" style="background:none;border:none;color:#9a9a9a;padding:0.5rem 1rem;cursor:pointer;font-weight:600;">Invent&aacute;rio</button>' +
      '<button class="tab-interna" data-subtab="saldo" style="background:none;border:none;color:#9a9a9a;padding:0.5rem 1rem;cursor:pointer;font-weight:600;">Saldo</button>' +
    '</div>' +
    '<div id="subtab-content"></div>';
}
```

- [ ] **Step 2: Atualizar `renderSubtab` para incluir 'saldo'**

Em `estoque.js`, substituir a função `renderSubtab` por:

```javascript
function renderSubtab(name) {
  var container = document.getElementById('subtab-content');
  if (!container) return;
  if (name === 'movimentar') {
    container.innerHTML = buildFormMovimentarHTML();
    setupFormMovimentar();
  } else if (name === 'inventario') {
    container.innerHTML = buildInventarioHTML();
    setupInventario();
  } else if (name === 'saldo') {
    container.innerHTML = buildSaldoHTML();
    setupSaldo();
  }
}
```

- [ ] **Step 3: Adicionar `buildSaldoHTML`, `setupSaldo`, `carregarSaldos`, `renderSaldos`, `filtrarSaldos`**

Adicionar dentro do IIFE de `estoque.js`, antes do fechamento `})()`:

```javascript

// ============================================================
// SUB-TAB SALDO (Fase E5)
// ============================================================

var saldosCache = []; // [{ modelo, peca, sumare, jaragua, ultimaAtualizacao }]

function buildSaldoHTML() {
  return '' +
    '<div class="secao-form">' +
      '<div class="secao-form-titulo">Saldo Atual</div>' +
      '<div class="form-row" style="align-items:flex-end;">' +
        '<div class="form-group">' +
          '<label for="saldoModelo">Filtrar por modelo</label>' +
          '<select id="saldoModelo">' +
            '<option value="">Todos</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group" style="flex:2 1 200px;">' +
          '<label for="saldoBusca">Buscar pe&ccedil;a</label>' +
          '<input type="text" id="saldoBusca" placeholder="Digite para filtrar...">' +
        '</div>' +
        '<div class="form-group" style="flex:0 0 auto;">' +
          '<label for="saldoFiltroStatus">Status</label>' +
          '<select id="saldoFiltroStatus">' +
            '<option value="todos">Todos</option>' +
            '<option value="comSaldo">S&oacute; com saldo</option>' +
            '<option value="zerados">S&oacute; zerados</option>' +
            '<option value="negativos">S&oacute; negativos</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group" style="flex:0 0 auto;">' +
          '<button type="button" class="btn-secundario" id="btnRefreshSaldo">&#x21bb; Atualizar</button>' +
        '</div>' +
      '</div>' +
      '<div id="saldoResumo" style="padding:0.5rem 1rem;color:#9a9a9a;font-size:0.85rem;"></div>' +
      '<div id="saldoLista" style="max-height:65vh;overflow-y:auto;"></div>' +
    '</div>' +
    '<div id="saldoFeedback" style="margin-top:1rem;"></div>';
}

function setupSaldo() {
  // Popular dropdown de modelos
  var modeloSel = document.getElementById('saldoModelo');
  if (modeloSel && typeof CATALOGO_MODELOS !== 'undefined') {
    Object.keys(CATALOGO_MODELOS).forEach(function(id) {
      var opt = document.createElement('option');
      opt.value = CATALOGO_MODELOS[id].nome;
      opt.textContent = CATALOGO_MODELOS[id].nome;
      modeloSel.appendChild(opt);
    });
  }

  document.getElementById('btnRefreshSaldo').addEventListener('click', carregarSaldos);
  document.getElementById('saldoModelo').addEventListener('change', filtrarSaldos);
  document.getElementById('saldoBusca').addEventListener('input', filtrarSaldos);
  document.getElementById('saldoFiltroStatus').addEventListener('change', filtrarSaldos);

  carregarSaldos();
}

function carregarSaldos() {
  mostrarFeedbackSaldo('Carregando saldos...', 'info');
  var url = resolverUrl() + '?action=listar_estoque';
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (!resp || !resp.sucesso) {
        return mostrarFeedbackSaldo('Erro carregando estoque', 'erro');
      }
      saldosCache = resp.estoque || [];
      filtrarSaldos();
      mostrarFeedbackSaldo('', '');
    })
    .catch(function(err) {
      mostrarFeedbackSaldo('Erro de rede: ' + err.message, 'erro');
    });
}

function filtrarSaldos() {
  var modeloFiltro = (document.getElementById('saldoModelo').value || '').toLowerCase();
  var busca = (document.getElementById('saldoBusca').value || '').toLowerCase().trim();
  var status = document.getElementById('saldoFiltroStatus').value;

  var filtrados = saldosCache.filter(function(it) {
    var total = (parseInt(it.sumare) || 0) + (parseInt(it.jaragua) || 0);
    if (modeloFiltro && String(it.modelo).toLowerCase() !== modeloFiltro) return false;
    if (busca && String(it.peca).toLowerCase().indexOf(busca) === -1) return false;
    if (status === 'comSaldo' && total === 0) return false;
    if (status === 'zerados' && total !== 0) return false;
    if (status === 'negativos') {
      if ((parseInt(it.sumare) || 0) >= 0 && (parseInt(it.jaragua) || 0) >= 0) return false;
    }
    return true;
  });

  renderSaldos(filtrados);
}

function renderSaldos(lista) {
  var div = document.getElementById('saldoLista');
  var resumo = document.getElementById('saldoResumo');
  if (!div) return;

  if (lista.length === 0) {
    div.innerHTML = '<div style="padding:2rem;text-align:center;color:#9a9a9a;">Nenhuma pe&ccedil;a encontrada com esses filtros.</div>';
    if (resumo) resumo.textContent = '0 pe&ccedil;as';
    return;
  }

  var totalSumare = 0, totalJaragua = 0;
  lista.forEach(function(it) {
    totalSumare += parseInt(it.sumare) || 0;
    totalJaragua += parseInt(it.jaragua) || 0;
  });

  if (resumo) {
    resumo.innerHTML = lista.length + ' pe&ccedil;as | Sumar&eacute;: <strong>' + totalSumare + '</strong> | Jaragu&aacute;: <strong>' + totalJaragua + '</strong> | Total: <strong>' + (totalSumare + totalJaragua) + '</strong>';
  }

  var html = '<table style="width:100%;border-collapse:collapse;">' +
    '<thead style="position:sticky;top:0;background:#1c1c1c;z-index:1;">' +
    '<tr style="border-bottom:1px solid #2a2a2a;">' +
      '<th style="padding:0.5rem;text-align:left;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Modelo</th>' +
      '<th style="padding:0.5rem;text-align:left;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Pe&ccedil;a</th>' +
      '<th style="padding:0.5rem;text-align:center;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Sumar&eacute;</th>' +
      '<th style="padding:0.5rem;text-align:center;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Jaragu&aacute;</th>' +
      '<th style="padding:0.5rem;text-align:center;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Total</th>' +
    '</tr>' +
    '</thead><tbody>';

  lista.forEach(function(it) {
    var sumare = parseInt(it.sumare) || 0;
    var jaragua = parseInt(it.jaragua) || 0;
    var total = sumare + jaragua;
    var corS = sumare < 0 ? '#ef4444' : (sumare === 0 ? '#5a5a5a' : '#fff');
    var corJ = jaragua < 0 ? '#ef4444' : (jaragua === 0 ? '#5a5a5a' : '#fff');
    html += '<tr style="border-bottom:1px solid #222;">' +
      '<td style="padding:0.5rem;font-size:0.85rem;">' + escapeHtmlEst(it.modelo) + '</td>' +
      '<td style="padding:0.5rem;font-size:0.85rem;">' + escapeHtmlEst(it.peca) + '</td>' +
      '<td style="padding:0.5rem;text-align:center;color:' + corS + ';font-weight:600;">' + sumare + '</td>' +
      '<td style="padding:0.5rem;text-align:center;color:' + corJ + ';font-weight:600;">' + jaragua + '</td>' +
      '<td style="padding:0.5rem;text-align:center;color:' + (total < 0 ? '#ef4444' : 'var(--cor-primaria)') + ';font-weight:700;">' + total + '</td>' +
    '</tr>';
  });
  html += '</tbody></table>';
  div.innerHTML = html;
}

function mostrarFeedbackSaldo(msg, tipo) {
  var el = document.getElementById('saldoFeedback');
  if (!el) return;
  if (!msg) { el.innerHTML = ''; return; }
  var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
  el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.75rem 1rem;border-radius:6px;text-align:center;font-weight:600;">' + msg + '</div>';
}
```

- [ ] **Step 4: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/estoque.js
```

- [ ] **Step 5: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add estoque.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): sub-tab Saldo com filtros (Fase E5)"
```

---

## Task E5.2: Bump versão + push

- [ ] **Step 1: Bump cache-busting + headers V2.7 → V2.8**

```bash
sed -i 's/?v=2\.7/?v=2.8/g' C:/dev/NXT/ativos/sac-pecas/index.html

for f in formulario.js assistencia.js atendimento.js app.js catalogo.js orcamento.js admin.js estoque.js style.css; do
  sed -i 's/NXT SAC V2\.7/NXT SAC V2.8/g' C:/dev/NXT/ativos/sac-pecas/$f
done
```

Validar sintaxe:
```bash
for f in formulario.js assistencia.js atendimento.js app.js catalogo.js orcamento.js admin.js estoque.js; do
  node --check C:/dev/NXT/ativos/sac-pecas/$f
done
```

- [ ] **Step 2: Commit + Push**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add -u
git -C C:/dev/NXT/ativos/sac-pecas commit -m "chore: bump V2.7 -> V2.8 (Fases E4 + E5)"
git -C C:/dev/NXT/ativos/sac-pecas push origin master
```

---

## Self-Review

**Spec coverage (E4 + E5):**
- ✅ baixa_estoque cria movimentação Saida com docVinculado = vendaId — Task E4.1
- ✅ Sub-tela Saldo lista todas as peças — Task E5.1 (`carregarSaldos`)
- ✅ Filtros: modelo, busca por peça, status — Task E5.1 (`filtrarSaldos`)
- ✅ Visual com soma por armazém e total — Task E5.1 (`renderSaldos`)
- ✅ Botão refresh — Task E5.1 (`btnRefreshSaldo`)
- ✅ Bump versão — Task E5.2

**Placeholder scan:** Sem TODOs.

**Type consistency:** IDs `saldo*` (`saldoModelo`, `saldoBusca`, `saldoFiltroStatus`, `saldoLista`, `saldoResumo`, `saldoFeedback`, `btnRefreshSaldo`). Funções: `buildSaldoHTML`, `setupSaldo`, `carregarSaldos`, `filtrarSaldos`, `renderSaldos`, `mostrarFeedbackSaldo`. Variável: `saldosCache`. Não conflitam com `est*` (Movimentar) nem `inv*` (Inventário).
