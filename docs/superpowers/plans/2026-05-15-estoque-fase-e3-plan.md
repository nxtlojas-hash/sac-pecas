# Estoque de Peças — Fase E3 (Inventário em lote) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Sub-tela "Inventário" dentro da aba Estoque que permite contagem em lote por armazém — operador percorre lista de todas as peças do catálogo, digita Qtd contada, ao confirmar o sistema gera 1 Ajuste por peça com diferença.

**Architecture:** Frontend dentro de `estoque.js` (sub-tab "Inventário"). Backend ganha endpoint `registrar_inventario_lote` que recebe array de contagens e gera N `Ajuste` chamando `registrarMovimentacao` internamente. Reaproveita atualização atômica de saldo.

**Tech Stack:** HTML/CSS/JS vanilla, Google Apps Script, Google Sheets.

**Spec:** `docs/superpowers/specs/2026-05-15-estoque-pecas-design.md`

---

## File Structure

- **Modify:** `google-apps-script.js` — adicionar `registrarInventarioLote` + case no doPost
- **Modify:** `estoque.js` — implementar sub-tab "Inventário" (lista + form + submit)
- **Modify:** `index.html` — bump `?v=2.6` → `?v=2.7`
- **Modify:** `style.css`, demais JS — bump header de versão V2.6 → V2.7

---

## Task E3.1: Backend `registrarInventarioLote`

**Files:**
- Modify: `google-apps-script.js`

- [ ] **Step 1: Adicionar função no final do arquivo (após `listarMovimentacoes`)**

```javascript

/**
 * Registra inventário em lote: gera 1 ajuste por peça com diferença ≠ 0.
 * payload: {
 *   armazem: 'Sumare' | 'Jaragua',
 *   operador: string,
 *   observacao: string,
 *   contagens: [{ modelo, peca, contado }]  // contado = qtd física real
 * }
 * Para cada peça: lê saldo atual no armazém, calcula diferença = contado - atual.
 * Se diferença ≠ 0, cria 1 movimentação tipo Ajuste com qtd = diferença.
 * Origem padrão: "Inventario YYYY-MM-DD" + observacao
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
    var encontrou = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === modeloLower &&
          String(data[i][1]).toLowerCase() === pecaLower) {
        atual = parseInt(data[i][colArm]) || 0;
        encontrou = true;
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
```

- [ ] **Step 2: Adicionar case no doPost**

Localizar `case 'registrar_movimentacao':` no doPost. Logo após, adicionar:

```javascript
      case 'registrar_inventario_lote':
        return jsonResponse(registrarInventarioLote(body));
```

- [ ] **Step 3: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/google-apps-script.js
```

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add google-apps-script.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): backend registrarInventarioLote (Fase E3)"
```

---

## Task E3.2: Frontend — habilitar sub-tab "Inventário" + render lista

**Files:**
- Modify: `estoque.js`

- [ ] **Step 1: Atualizar `buildHTML` pra habilitar a sub-tab Inventário**

Em `estoque.js`, localizar a função `buildHTML` e substituir por:

```javascript
function buildHTML() {
  return '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128230; Estoque de Pe&ccedil;as</h2>' +
    '<div class="tabs-internas" style="display:flex;gap:0.5rem;margin-bottom:1rem;border-bottom:1px solid #2a2a2a;">' +
      '<button class="tab-interna active" data-subtab="movimentar" style="background:none;border:none;color:var(--cor-primaria);padding:0.5rem 1rem;border-bottom:2px solid var(--cor-primaria);cursor:pointer;font-weight:600;">Movimentar</button>' +
      '<button class="tab-interna" data-subtab="inventario" style="background:none;border:none;color:#9a9a9a;padding:0.5rem 1rem;cursor:pointer;font-weight:600;">Invent&aacute;rio</button>' +
      '<button class="tab-interna" data-subtab="saldo" disabled style="background:none;border:none;color:#5a5a5a;padding:0.5rem 1rem;cursor:not-allowed;">Saldo (em breve)</button>' +
    '</div>' +
    '<div id="subtab-content"></div>';
}
```

- [ ] **Step 2: Atualizar `setupListeners` pra rotear sub-tabs**

Substituir `setupListeners` em `estoque.js` por:

```javascript
function setupListeners() {
  document.querySelectorAll('.tab-interna').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (btn.disabled) return;
      document.querySelectorAll('.tab-interna').forEach(function(b) {
        b.classList.remove('active');
        b.style.color = '#9a9a9a';
        b.style.borderBottom = '';
      });
      btn.classList.add('active');
      btn.style.color = 'var(--cor-primaria)';
      btn.style.borderBottom = '2px solid var(--cor-primaria)';
      renderSubtab(btn.dataset.subtab);
    });
  });
  renderSubtab('movimentar');
}

function renderSubtab(name) {
  var container = document.getElementById('subtab-content');
  if (!container) return;
  if (name === 'movimentar') {
    container.innerHTML = buildFormMovimentarHTML();
    setupFormMovimentar();
  } else if (name === 'inventario') {
    container.innerHTML = buildInventarioHTML();
    setupInventario();
  }
}
```

- [ ] **Step 3: Adicionar `buildInventarioHTML` e `setupInventario` (no IIFE)**

Adicionar dentro do IIFE de `estoque.js`, antes do fechamento `})()`:

```javascript

function buildInventarioHTML() {
  return '' +
    '<form id="invForm" autocomplete="off">' +
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Configura&ccedil;&atilde;o do Invent&aacute;rio</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="invArmazem">Armaz&eacute;m *</label>' +
            '<select id="invArmazem" required>' +
              '<option value="">Selecione...</option>' +
              '<option value="Sumare">Sumar&eacute;</option>' +
              '<option value="Jaragua">Jaragu&aacute;</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="invOperador">Operador *</label>' +
            '<input type="text" id="invOperador" list="estOperadoresList" placeholder="Quem est&aacute; contando?" required>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:1 1 100%;">' +
            '<label for="invObservacao">Observa&ccedil;&atilde;o (opcional)</label>' +
            '<input type="text" id="invObservacao" placeholder="Ex: Invent&aacute;rio fim do trim. Q2">' +
          '</div>' +
        '</div>' +
        '<div class="form-row" style="margin-top:0.5rem;">' +
          '<button type="button" class="btn-secundario" id="btnCarregarInv">&#128270; Carregar pe&ccedil;as</button>' +
          '<span style="color:#9a9a9a;font-size:0.85rem;margin-left:1rem;align-self:center;">Selecione armaz&eacute;m + operador, depois carregue a lista de pe&ccedil;as.</span>' +
        '</div>' +
      '</div>' +

      '<div id="invListaContainer" style="display:none;">' +
        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Contagem F&iacute;sica</div>' +
          '<div style="padding:0.5rem 1rem;color:#9a9a9a;font-size:0.85rem;">' +
            'Digite a quantidade <strong>contada fisicamente</strong> em cada pe&ccedil;a. Linhas com diferen&ccedil;a ser&atilde;o destacadas.' +
          '</div>' +
          '<div id="invLista" style="max-height:60vh;overflow-y:auto;"></div>' +
        '</div>' +
        '<div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem;align-items:center;">' +
          '<span id="invResumo" style="color:#9a9a9a;font-size:0.9rem;margin-right:auto;"></span>' +
          '<button type="button" class="btn-secundario" id="btnLimparInv">Limpar</button>' +
          '<button type="button" class="btn-primario" id="btnConfirmarInv">Confirmar invent&aacute;rio &#10148;</button>' +
        '</div>' +
      '</div>' +

      '<div id="invFeedback" style="margin-top:1rem;"></div>' +
    '</form>';
}

var invPecas = []; // [{modelo, peca, atual}]

function setupInventario() {
  populateOperadoresDatalist();

  document.getElementById('btnCarregarInv').addEventListener('click', carregarInventario);
  document.getElementById('btnLimparInv').addEventListener('click', limparInventario);
  document.getElementById('btnConfirmarInv').addEventListener('click', confirmarInventario);
}

function carregarInventario() {
  var armazem = document.getElementById('invArmazem').value;
  var operador = document.getElementById('invOperador').value.trim();
  if (!armazem) return mostrarFeedbackInv('Selecione o armazem', 'erro');
  if (!operador) return mostrarFeedbackInv('Informe o operador', 'erro');

  mostrarFeedbackInv('Carregando saldos...', 'info');

  // 1. Pega saldos da aba Estoque
  var url = resolverUrl() + '?action=listar_estoque';
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (!resp || !resp.sucesso) {
        return mostrarFeedbackInv('Erro carregando estoque', 'erro');
      }
      // 2. Monta lista de TODAS as pecas do catalogo
      invPecas = [];
      var saldoMap = {};
      (resp.estoque || []).forEach(function(it) {
        var key = String(it.modelo).toLowerCase() + '|' + String(it.peca).toLowerCase();
        saldoMap[key] = (armazem === 'Sumare') ? (it.sumare || 0) : (it.jaragua || 0);
      });
      if (typeof CATALOGO_MODELOS !== 'undefined') {
        Object.keys(CATALOGO_MODELOS).forEach(function(modelId) {
          var nome = CATALOGO_MODELOS[modelId].nome;
          var pecas = CATALOGO_MODELOS[modelId].pecas || [];
          pecas.forEach(function(p) {
            var key = nome.toLowerCase() + '|' + p.nome.toLowerCase();
            invPecas.push({
              modelo: nome,
              peca: p.nome,
              atual: saldoMap[key] || 0
            });
          });
        });
      }

      renderListaInventario();
      document.getElementById('invListaContainer').style.display = '';
      mostrarFeedbackInv('Lista carregada com ' + invPecas.length + ' pe&ccedil;as. Comece a contar.', 'sucesso');
    })
    .catch(function(err) {
      mostrarFeedbackInv('Erro de rede: ' + err.message, 'erro');
    });
}

function renderListaInventario() {
  var div = document.getElementById('invLista');
  if (!div) return;
  var html = '<table style="width:100%;border-collapse:collapse;">' +
    '<thead style="position:sticky;top:0;background:#1c1c1c;z-index:1;">' +
    '<tr style="border-bottom:1px solid #2a2a2a;">' +
      '<th style="padding:0.5rem;text-align:left;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Modelo</th>' +
      '<th style="padding:0.5rem;text-align:left;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Pe&ccedil;a</th>' +
      '<th style="padding:0.5rem;text-align:center;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Saldo</th>' +
      '<th style="padding:0.5rem;text-align:center;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Contado</th>' +
      '<th style="padding:0.5rem;text-align:center;font-size:0.75rem;color:#9a9a9a;text-transform:uppercase;">Dif.</th>' +
    '</tr>' +
    '</thead><tbody>';

  invPecas.forEach(function(it, idx) {
    html += '<tr data-idx="' + idx + '" style="border-bottom:1px solid #222;">' +
      '<td style="padding:0.5rem;font-size:0.85rem;">' + escapeHtmlEst(it.modelo) + '</td>' +
      '<td style="padding:0.5rem;font-size:0.85rem;">' + escapeHtmlEst(it.peca) + '</td>' +
      '<td style="padding:0.5rem;text-align:center;color:#9a9a9a;">' + it.atual + '</td>' +
      '<td style="padding:0.5rem;text-align:center;">' +
        '<input type="number" min="0" step="1" data-idx="' + idx + '" class="inv-contado" style="width:80px;background:#161616;color:#fff;border:1px solid #2a2a2a;border-radius:4px;padding:0.25rem;text-align:center;">' +
      '</td>' +
      '<td class="inv-dif" data-idx="' + idx + '" style="padding:0.5rem;text-align:center;font-weight:700;">-</td>' +
    '</tr>';
  });
  html += '</tbody></table>';
  div.innerHTML = html;

  // Listeners de cada input contado
  div.querySelectorAll('.inv-contado').forEach(function(inp) {
    inp.addEventListener('input', atualizarDifLinha);
  });

  atualizarResumoInv();
}

function atualizarDifLinha(e) {
  var idx = parseInt(e.target.dataset.idx);
  var contado = parseInt(e.target.value);
  var atual = invPecas[idx].atual;
  var difCell = document.querySelector('.inv-dif[data-idx="' + idx + '"]');
  var row = e.target.closest('tr');
  if (isNaN(contado)) {
    difCell.textContent = '-';
    difCell.style.color = '#9a9a9a';
    row.style.background = '';
  } else {
    var dif = contado - atual;
    difCell.textContent = (dif > 0 ? '+' : '') + dif;
    if (dif === 0) {
      difCell.style.color = '#9a9a9a';
      row.style.background = '';
    } else if (dif > 0) {
      difCell.style.color = '#22c55e';
      row.style.background = 'rgba(34,197,94,0.08)';
    } else {
      difCell.style.color = '#ef4444';
      row.style.background = 'rgba(239,68,68,0.08)';
    }
  }
  atualizarResumoInv();
}

function atualizarResumoInv() {
  var preenchidos = 0;
  var comDif = 0;
  document.querySelectorAll('.inv-contado').forEach(function(inp) {
    if (inp.value.trim() !== '') preenchidos++;
    var idx = parseInt(inp.dataset.idx);
    var contado = parseInt(inp.value);
    if (!isNaN(contado) && contado !== invPecas[idx].atual) comDif++;
  });
  var resumo = document.getElementById('invResumo');
  if (resumo) {
    resumo.textContent = preenchidos + '/' + invPecas.length + ' contados, ' + comDif + ' com diferenca';
  }
}

function limparInventario() {
  document.querySelectorAll('.inv-contado').forEach(function(inp) {
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  mostrarFeedbackInv('', '');
}

function confirmarInventario() {
  var armazem = document.getElementById('invArmazem').value;
  var operador = document.getElementById('invOperador').value.trim();
  var observacao = document.getElementById('invObservacao').value.trim();

  var contagens = [];
  document.querySelectorAll('.inv-contado').forEach(function(inp) {
    var contado = parseInt(inp.value);
    if (isNaN(contado)) return;
    var idx = parseInt(inp.dataset.idx);
    contagens.push({
      modelo: invPecas[idx].modelo,
      peca: invPecas[idx].peca,
      contado: contado
    });
  });

  if (contagens.length === 0) {
    return mostrarFeedbackInv('Preencha pelo menos 1 pe&ccedil;a contada', 'erro');
  }

  if (!confirm('Confirmar invent&aacute;rio? ' + contagens.length + ' pe&ccedil;as contadas. Pe&ccedil;as com diferen&ccedil;a ser&atilde;o ajustadas.')) return;

  var btn = document.getElementById('btnConfirmarInv');
  btn.disabled = true;
  btn.textContent = 'Processando...';
  mostrarFeedbackInv('Processando ' + contagens.length + ' contagens...', 'info');

  fetch(resolverUrl(), {
    method: 'POST',
    body: JSON.stringify({
      action: 'registrar_inventario_lote',
      armazem: armazem,
      operador: operador,
      observacao: observacao,
      contagens: contagens
    }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  })
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (resp && resp.sucesso) {
        saveOperador(operador);
        mostrarFeedbackInv('Invent&aacute;rio conclu&iacute;do: ' + resp.totalAjustes + ' ajustes feitos, ' + resp.totalUnidadesMovidas + ' un movidas.', 'sucesso');
        document.getElementById('invListaContainer').style.display = 'none';
        invPecas = [];
      } else {
        mostrarFeedbackInv('Erro: ' + (resp && resp.erro ? resp.erro : 'resposta invalida'), 'erro');
      }
    })
    .catch(function(err) {
      mostrarFeedbackInv('Erro de rede: ' + err.message, 'erro');
    })
    .finally(function() {
      btn.disabled = false;
      btn.innerHTML = 'Confirmar invent&aacute;rio &#10148;';
    });
}

function mostrarFeedbackInv(msg, tipo) {
  var el = document.getElementById('invFeedback');
  if (!el) return;
  if (!msg) { el.innerHTML = ''; return; }
  var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
  el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.75rem 1rem;border-radius:6px;text-align:center;font-weight:600;">' + msg + '</div>';
}

function escapeHtmlEst(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
```

- [ ] **Step 4: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/estoque.js
```

- [ ] **Step 5: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add estoque.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(estoque): sub-tab Inventario com contagem em lote"
```

---

## Task E3.3: Bump versão + push

- [ ] **Step 1: Bump cache-busting v2.6 → v2.7 no index.html**

```bash
sed -i 's/?v=2\.6/?v=2.7/g' C:/dev/NXT/ativos/sac-pecas/index.html
```

Verificar:
```bash
grep -c "?v=2.7" C:/dev/NXT/ativos/sac-pecas/index.html
```
Expected: 9 ocorrências

- [ ] **Step 2: Bump headers V2.6 → V2.7 nos JS/CSS**

```bash
sed -i 's/NXT SAC V2\.6/NXT SAC V2.7/g' C:/dev/NXT/ativos/sac-pecas/formulario.js
sed -i 's/NXT SAC V2\.6/NXT SAC V2.7/g' C:/dev/NXT/ativos/sac-pecas/assistencia.js
sed -i 's/NXT SAC V2\.6/NXT SAC V2.7/g' C:/dev/NXT/ativos/sac-pecas/atendimento.js
sed -i 's/NXT SAC V2\.6/NXT SAC V2.7/g' C:/dev/NXT/ativos/sac-pecas/app.js
sed -i 's/NXT SAC V2\.6/NXT SAC V2.7/g' C:/dev/NXT/ativos/sac-pecas/catalogo.js
sed -i 's/NXT SAC V2\.6/NXT SAC V2.7/g' C:/dev/NXT/ativos/sac-pecas/orcamento.js
sed -i 's/NXT SAC V2\.6/NXT SAC V2.7/g' C:/dev/NXT/ativos/sac-pecas/admin.js
sed -i 's/NXT SAC V2\.6/NXT SAC V2.7/g' C:/dev/NXT/ativos/sac-pecas/style.css
sed -i 's/NXT SAC V2\.6/NXT SAC V2.7/g' C:/dev/NXT/ativos/sac-pecas/estoque.js
```

Validar sintaxe JS:
```bash
for f in formulario.js assistencia.js atendimento.js app.js catalogo.js orcamento.js admin.js estoque.js; do
  node --check C:/dev/NXT/ativos/sac-pecas/$f
done
```

- [ ] **Step 3: Commit + Push**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add -u
git -C C:/dev/NXT/ativos/sac-pecas commit -m "chore: bump V2.6 -> V2.7 + cache busting (Fase E3)"
git -C C:/dev/NXT/ativos/sac-pecas push origin master
```

---

## Self-Review

**Spec coverage (Fase E3):**
- ✅ Sub-tela "Inventário" no app — Task E3.2
- ✅ Backend `registrar_inventario_lote` — Task E3.1
- ✅ Lista todas as peças do catálogo com saldo atual — Task E3.2 (`carregarInventario`)
- ✅ Campo Contado por peça com diferença visual — Task E3.2 (`atualizarDifLinha`)
- ✅ Ao confirmar gera N Ajustes — Task E3.1 (`registrarInventarioLote` chama `registrarMovimentacao`)
- ✅ Origem padrão "Inventario YYYY-MM-DD" — Task E3.1
- ✅ Operador obrigatório + observação opcional — Tasks E3.1 e E3.2
- ✅ Bump versão V2.6 → V2.7 — Task E3.3

**Placeholder scan:** Sem TODOs.

**Type consistency:** IDs `inv*` (`invForm`, `invArmazem`, `invOperador`, `invObservacao`, `invListaContainer`, `invLista`, `invResumo`, `invFeedback`, `btnCarregarInv`, `btnLimparInv`, `btnConfirmarInv`, classes `inv-contado`, `inv-dif`). Funções: `buildInventarioHTML`, `setupInventario`, `carregarInventario`, `renderListaInventario`, `atualizarDifLinha`, `atualizarResumoInv`, `limparInventario`, `confirmarInventario`, `mostrarFeedbackInv`, `escapeHtmlEst`.

---

## Próxima fase (referência)

- **Fase E4** — integrar `baixa_estoque` (venda gera Saida automaticamente)
- **Fase E5** — sub-tela "Saldo" com filtros e visualização
