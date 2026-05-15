# NXT SAC Fase 2b — Aba Clientes (Timeline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Nova aba "Clientes" no app com busca por CPF/telefone/nome + timeline cronológica unificada que mostra todos os eventos do cliente (atendimentos + vendas + orçamentos + OSes), incluindo os legados sem `atendimentoId`.

**Architecture:** Frontend novo módulo `clientes.js` em IIFE consumindo o endpoint `buscar_cliente_consolidado` já implementado na Sub-fase 2a. Sem mudanças no backend. UI com timeline visual (cards cronológicos) e badges diferenciando vinculados (`PV-XXX`) de legados (cinza).

**Tech Stack:** HTML/CSS/JS vanilla, Google Apps Script (já feito), Google Sheets.

**Spec:** `docs/superpowers/specs/2026-05-15-sac-fase2-wizard-design.md`

---

## File Structure

- **Modify:** `index.html` — tab "Clientes" + section view-clientes + script tag + bump cache busting v2.11→v2.12
- **Create:** `clientes.js` — módulo IIFE com busca, lista e timeline
- **Modify:** `app.js` — registrar roteamento `case 'clientes'`
- **Modify:** `style.css` — estilos pra timeline (já tem padrão de cards)
- **Modify:** demais JS — bump header V2.11 → V2.12

---

## Task 2b.1: Tab + view + roteamento

**Files:**
- Modify: `index.html`, `app.js`

- [ ] **Step 1: Adicionar tab "Clientes" no nav do index.html**

No bloco `<nav class="nav-tabs">`, inserir entre "Assistencias" e "Estoque":

```html
<button class="nav-tab" data-view="clientes">&#128100; Clientes</button>
```

(`&#128100;` é o ícone 👤)

- [ ] **Step 2: Adicionar `<section>` da view-clientes**

No `<main>`, logo após `<section class="view" id="view-estoque">...</section>`, inserir:

```html
<!-- Clientes View (Fase 2b) -->
<section class="view" id="view-clientes">
    <div id="clientes-container"></div>
</section>
```

- [ ] **Step 3: Adicionar script no index.html**

Após `<script src="estoque.js?v=2.11"></script>` (ou último script antes do `</body>`), adicionar:

```html
<script src="clientes.js?v=2.12"></script>
```

E bump TODOS os outros `?v=2.11` para `?v=2.12` no index.html:

```bash
sed -i 's/?v=2\.11/?v=2.12/g' C:/dev/NXT/ativos/sac-pecas/index.html
```

Verificar:
```bash
grep -c "?v=2.12" C:/dev/NXT/ativos/sac-pecas/index.html
```
Expected: 11+ ocorrências (10 prévias bumpadas + 1 nova `clientes.js`)

- [ ] **Step 4: Registrar roteamento em app.js**

Em `app.js`, na função `navigateTo`, logo após o bloco de `estoque`, adicionar:

```javascript
  } else if (view === 'clientes') {
    if (typeof window.initClientes === 'function') window.initClientes();
```

- [ ] **Step 5: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/app.js
```

- [ ] **Step 6: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add index.html app.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(clientes): adiciona tab + view + roteamento (Fase 2b)"
```

---

## Task 2b.2: Criar `clientes.js` skeleton

**Files:**
- Create: `clientes.js`

- [ ] **Step 1: Criar `C:/dev/NXT/ativos/sac-pecas/clientes.js`**

```javascript
/* ===== NXT SAC V2.12 - Clientes (Timeline Fase 2b) ===== */

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

  var LS_RECENTES = 'nxt-sac-clientes-recentes';
  var clientesResultado = []; // array de clientes da ultima busca

  window.initClientes = function() {
    var container = document.getElementById('clientes-container');
    if (!container) return;
    container.innerHTML = buildHTML();
    setupListeners();
    renderRecentes();
    console.log('Clientes (Fase 2b) inicializado');
  };

  function buildHTML() {
    return '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128100; Clientes</h2>' +
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Buscar cliente</div>' +
        '<div class="form-row" style="align-items:flex-end;">' +
          '<div class="form-group" style="flex:3 1 320px;">' +
            '<label for="cliBusca">CPF / Telefone / Nome</label>' +
            '<input type="text" id="cliBusca" placeholder="Digite CPF, telefone ou nome..." autocomplete="off">' +
          '</div>' +
          '<div class="form-group" style="flex:0 0 auto;">' +
            '<button type="button" class="btn-primario" id="btnBuscarCli">&#128269; Buscar</button>' +
          '</div>' +
        '</div>' +
        '<div id="cliFeedback" style="margin-top:0.5rem;"></div>' +
      '</div>' +

      '<div id="cliRecentes" class="secao-form" style="display:none;">' +
        '<div class="secao-form-titulo">Recentes</div>' +
        '<div id="cliRecentesLista" style="display:flex;flex-wrap:wrap;gap:0.5rem;padding:0.5rem 1rem;"></div>' +
      '</div>' +

      '<div id="cliResultado" style="margin-top:1rem;"></div>';
  }

  function setupListeners() {
    document.getElementById('btnBuscarCli').addEventListener('click', buscar);
    document.getElementById('cliBusca').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        buscar();
      }
    });
  }

  function getRecentes() {
    try {
      return JSON.parse(localStorage.getItem(LS_RECENTES) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveRecente(query) {
    var trimmed = (query || '').trim();
    if (!trimmed) return;
    var lista = getRecentes();
    lista = lista.filter(function(q) { return q.toLowerCase() !== trimmed.toLowerCase(); });
    lista.unshift(trimmed);
    lista = lista.slice(0, 10);
    localStorage.setItem(LS_RECENTES, JSON.stringify(lista));
  }

  function renderRecentes() {
    var lista = getRecentes();
    var wrap = document.getElementById('cliRecentes');
    var div = document.getElementById('cliRecentesLista');
    if (!wrap || !div) return;
    if (lista.length === 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    div.innerHTML = lista.map(function(q) {
      return '<button type="button" class="btn-secundario btn-sm" data-q="' + escapeAttr(q) + '" style="font-size:0.8rem;padding:0.3rem 0.7rem;">' + escapeHtmlCli(q) + '</button>';
    }).join('');
    div.querySelectorAll('button[data-q]').forEach(function(b) {
      b.addEventListener('click', function() {
        document.getElementById('cliBusca').value = b.dataset.q;
        buscar();
      });
    });
  }

  function buscar() {
    var q = (document.getElementById('cliBusca').value || '').trim();
    if (!q) return mostrarFeedback('Digite CPF, telefone ou nome', 'erro');

    var soDigitos = q.replace(/\D/g, '');
    var params = [];
    if (soDigitos.length >= 10 && soDigitos.length <= 11 && q.indexOf('.') === -1 && q.indexOf('-') === -1) {
      // 10-11 digitos sem mascara: tenta tel
      params.push('telefone=' + encodeURIComponent(soDigitos));
    } else if (soDigitos.length === 11 || soDigitos.length === 14) {
      params.push('cpf=' + encodeURIComponent(soDigitos));
    } else if (soDigitos.length >= 10) {
      // Massa de digitos: tenta como telefone ou cpf
      params.push('cpf=' + encodeURIComponent(soDigitos));
      params.push('telefone=' + encodeURIComponent(soDigitos));
    } else {
      params.push('nome=' + encodeURIComponent(q));
    }

    mostrarFeedback('Buscando...', 'info');
    document.getElementById('cliResultado').innerHTML = '';

    fetch(resolverUrl() + '?action=buscar_cliente_consolidado&' + params.join('&'))
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (!resp || !resp.sucesso) {
          return mostrarFeedback('Erro: ' + (resp && resp.erro ? resp.erro : 'sem resposta'), 'erro');
        }
        clientesResultado = resp.clientes || [];
        saveRecente(q);
        renderRecentes();
        if (clientesResultado.length === 0) {
          mostrarFeedback('Nenhum cliente encontrado.', 'erro');
        } else {
          mostrarFeedback(clientesResultado.length + ' cliente(s) encontrado(s).', 'sucesso');
        }
        renderResultados();
      })
      .catch(function(err) {
        mostrarFeedback('Erro de rede: ' + err.message, 'erro');
      });
  }

  function renderResultados() {
    var div = document.getElementById('cliResultado');
    if (!div) return;
    if (clientesResultado.length === 0) { div.innerHTML = ''; return; }

    div.innerHTML = clientesResultado.map(function(c, idx) {
      return renderCliente(c, idx);
    }).join('');

    div.querySelectorAll('.cli-card-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.idx);
        var painel = document.getElementById('cli-timeline-' + idx);
        if (!painel) return;
        var aberto = painel.style.display !== 'none';
        painel.style.display = aberto ? 'none' : 'block';
        btn.textContent = aberto ? 'Ver timeline ▼' : 'Ocultar timeline ▲';
      });
    });
  }

  function renderCliente(c, idx) {
    var nfsTxt = (c.nfs && c.nfs.length) ? c.nfs.join(', ') : '—';
    var cpfTxt = (c.cpfs && c.cpfs.length) ? c.cpfs.join(', ') : '—';
    var telTxt = (c.telefones && c.telefones.length) ? c.telefones.map(formatarTelCli).join(', ') : '—';

    return '' +
      '<div class="secao-form" style="margin-bottom:1rem;">' +
        '<div class="secao-form-titulo" style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span>' + escapeHtmlCli(c.nome || '(sem nome)') + '</span>' +
          '<span style="font-size:0.75rem;color:var(--cor-primaria);">' + c.totalEventos + ' eventos</span>' +
        '</div>' +
        '<div style="padding:0.75rem 1rem;color:#9a9a9a;font-size:0.85rem;line-height:1.6;">' +
          '<div><strong style="color:#e8e8f0;">CPF:</strong> ' + cpfTxt + '</div>' +
          '<div><strong style="color:#e8e8f0;">Telefone:</strong> ' + telTxt + '</div>' +
          '<div><strong style="color:#e8e8f0;">NFs:</strong> ' + nfsTxt + '</div>' +
        '</div>' +
        '<div style="padding:0 1rem 0.75rem;">' +
          '<button type="button" class="btn-secundario btn-sm cli-card-toggle" data-idx="' + idx + '" style="font-size:0.85rem;">Ver timeline &#9660;</button>' +
        '</div>' +
        '<div id="cli-timeline-' + idx + '" class="cli-timeline" style="display:none;padding:0 1rem 1rem;">' +
          renderTimeline(c.eventos || []) +
        '</div>' +
      '</div>';
  }

  function renderTimeline(eventos) {
    if (!eventos.length) return '<p style="color:#9a9a9a;padding:1rem;font-style:italic;">Sem eventos.</p>';

    return '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
      eventos.map(function(ev) {
        var icone = getIconeTipo(ev.tipo);
        var cor = getCorTipo(ev.tipo);
        var dataStr = formatarDataCli(ev.data);
        var badgeAt = '';
        if (ev.tipo !== 'atendimento') {
          if (ev.atendimentoId) {
            badgeAt = '<span style="background:#22c55e22;color:#22c55e;font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:4px;margin-left:0.5rem;font-weight:600;">' + escapeHtmlCli(ev.atendimentoId) + '</span>';
          } else {
            badgeAt = '<span style="background:#5a5a5a44;color:#9a9a9a;font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:4px;margin-left:0.5rem;font-style:italic;">sem atendimento</span>';
          }
        }
        return '<div style="display:flex;gap:0.75rem;padding:0.6rem 0.75rem;background:#161625;border-left:3px solid ' + cor + ';border-radius:6px;">' +
          '<div style="font-size:1.5rem;">' + icone + '</div>' +
          '<div style="flex:1;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
              '<strong style="color:' + cor + ';font-size:0.9rem;">' + escapeHtmlCli(ev.id || '—') + '</strong>' +
              '<span style="font-size:0.75rem;color:#9a9a9a;">' + dataStr + '</span>' +
            '</div>' +
            '<div style="font-size:0.85rem;color:#e8e8f0;margin-top:0.15rem;">' +
              escapeHtmlCli(ev.resumo || '') + badgeAt +
            '</div>' +
            (ev.status ? '<div style="font-size:0.75rem;color:#9a9a9a;margin-top:0.15rem;">Status: ' + escapeHtmlCli(ev.status) + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function getIconeTipo(tipo) {
    if (tipo === 'atendimento') return '📝'; // 📝
    if (tipo === 'venda') return '🛒'; // 🛒
    if (tipo === 'orcamento') return '📄'; // 📄
    if (tipo === 'os') return '🔧'; // 🔧
    return '•';
  }

  function getCorTipo(tipo) {
    if (tipo === 'atendimento') return '#c6ff00';
    if (tipo === 'venda') return '#22c55e';
    if (tipo === 'orcamento') return '#f59e0b';
    if (tipo === 'os') return '#3b82f6';
    return '#9a9a9a';
  }

  function formatarDataCli(d) {
    if (!d) return '—';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    var dd = String(dt.getDate()).padStart(2, '0');
    var mm = String(dt.getMonth() + 1).padStart(2, '0');
    var yy = dt.getFullYear();
    var hh = String(dt.getHours()).padStart(2, '0');
    var mi = String(dt.getMinutes()).padStart(2, '0');
    return dd + '/' + mm + '/' + yy + ' ' + hh + ':' + mi;
  }

  function formatarTelCli(t) {
    var d = String(t || '').replace(/\D/g, '');
    if (d.length === 11) return '(' + d.substr(0,2) + ') ' + d.substr(2,5) + '-' + d.substr(7);
    if (d.length === 10) return '(' + d.substr(0,2) + ') ' + d.substr(2,4) + '-' + d.substr(6);
    return t;
  }

  function mostrarFeedback(msg, tipo) {
    var el = document.getElementById('cliFeedback');
    if (!el) return;
    if (!msg) { el.innerHTML = ''; return; }
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.5rem 1rem;border-radius:6px;text-align:center;font-weight:600;font-size:0.85rem;">' + msg + '</div>';
  }

  function escapeHtmlCli(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function escapeAttr(s) {
    if (s == null) return '';
    return String(s).replace(/"/g, '&quot;');
  }

})();
```

- [ ] **Step 2: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/clientes.js
```

- [ ] **Step 3: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add clientes.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(clientes): modulo clientes.js com busca + timeline cronologica"
```

---

## Task 2b.3: Adicionar card de "Clientes" na home

**Files:**
- Modify: `app.js` — função `renderHome`, array `acoes`

- [ ] **Step 1: Adicionar card de Clientes no array `acoes` da função `renderHome` em app.js**

Localizar o array `var acoes = [...]` em `renderHome`. Adicionar logo após o card de Atendimento:

```javascript
{ titulo: 'Clientes',     icone: '👤', desc: 'Hist&oacute;rico por CPF/telefone',                                tipo: 'view',  alvo: 'clientes' },
```

(`👤` é o 👤)

A ordem proposta dos cards de Ações: Atendimento, **Clientes**, Catálogo, Registrar, Assistência, Estoque. O grid responsivo se adapta.

- [ ] **Step 2: Validar**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/app.js
```

- [ ] **Step 3: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add app.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(home): adiciona card 'Clientes' nos atalhos"
```

---

## Task 2b.4: Bump versão + push final

**Files:**
- Modify: vários — bump cosmético V2.11 → V2.12

- [ ] **Step 1: Bump header dos JS/CSS**

```bash
for f in formulario.js assistencia.js atendimento.js app.js catalogo.js orcamento.js admin.js estoque.js style.css; do
  sed -i 's/NXT SAC V2\.11/NXT SAC V2.12/g' C:/dev/NXT/ativos/sac-pecas/$f
done
```

Validar sintaxe JS:
```bash
for f in formulario.js assistencia.js atendimento.js app.js catalogo.js orcamento.js admin.js estoque.js clientes.js; do
  node --check C:/dev/NXT/ativos/sac-pecas/$f
done
```

- [ ] **Step 2: Commit + push**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add -u
git -C C:/dev/NXT/ativos/sac-pecas commit -m "chore: bump V2.11 -> V2.12 (Fase 2b clientes)"
git -C C:/dev/NXT/ativos/sac-pecas push origin master
```

---

## Self-Review

**Spec coverage (Sub-fase 2b):**
- ✅ Tela "Clientes" com busca por CPF/telefone/nome — Tasks 2b.1, 2b.2
- ✅ Card de "Clientes" na home — Task 2b.3
- ✅ Recentes em localStorage — Task 2b.2 (`getRecentes`, `saveRecente`)
- ✅ Timeline cronológica unificada (atendimentos + vendas + ORC + OS) — Task 2b.2 (`renderTimeline`)
- ✅ Badge "Sem atendimento" para legados — Task 2b.2
- ✅ Badge `PV-XXX` (verde) para docs vinculados — Task 2b.2
- ❌ Vinculação retroativa (banner + ação) — fora do escopo (Fase 2g)

**Type consistency:** Prefixos `cli*` exclusivos no IIFE — `cliBusca`, `cliFeedback`, `cliRecentes`, `cliResultado`, `cli-card-toggle`, `cli-timeline-N`. Funções: `buildHTML`, `setupListeners`, `buscar`, `renderResultados`, `renderCliente`, `renderTimeline`, `getRecentes`, `saveRecente`, `renderRecentes`, `getIconeTipo`, `getCorTipo`, `formatarDataCli`, `formatarTelCli`, `mostrarFeedback`, `escapeHtmlCli`, `escapeAttr`. Variável: `clientesResultado`, `SCRIPT_URL`, `LS_RECENTES`. Sem colisão com `est*`/`inv*`/`saldo*`/`at*`.

**Placeholder scan:** Sem TODOs.
