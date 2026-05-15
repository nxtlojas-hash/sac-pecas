# NXT SAC — Fase 0 (Rebrand) + Fase 1 (Atendimento) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renomear visualmente o app `sac-pecas` para "NXT SAC" e adicionar o conceito de Atendimento (protocolo único `PV-2026-NNNN`) como nova aba, persistindo em uma planilha "Atendimentos" via Google Apps Script.

**Architecture:** Frontend HTML/CSS/JS vanilla em IIFE, hospedado em GitHub Pages. Backend Google Apps Script com endpoints novos (`registrar_atendimento`) consumindo uma nova aba do Google Sheets já em uso. Nenhuma alteração nos fluxos existentes (PCA, ORC, OS) nesta fase.

**Tech Stack:** HTML/CSS/JS vanilla, Google Apps Script, Google Sheets, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-05-15-sac-to-posvenda-design.md`

---

## File Structure

- **Modify:** `index.html` — title, h1, subtitle, novo tab, nova view, novo `<script>`, cache busting `?v=2.5`
- **Modify:** `formulario.js`, `assistencia.js`, `orcamento.js`, `catalogo.js`, `admin.js`, `app.js`, `data.js`, `style.css` — bump comentário de versão V2.4 → V2.5 (cosmético)
- **Create:** `atendimento.js` — novo módulo IIFE com a view de Atendimento
- **Modify:** `google-apps-script.js` — adicionar action `registrar_atendimento` e helper `gerarProximoIdAtendimento`
- **Modify (no Sheets, manual):** criar aba "Atendimentos" com cabeçalhos
- **Modify (no Apps Script Editor, manual):** publicar nova versão do script após upload

---

## FASE 0 — Rebrand Visual

### Task 0.1: Atualizar header e cache-busting no index.html

**Files:**
- Modify: `index.html` linhas 6, 17, 18, 102-108

- [ ] **Step 1: Modificar `<title>`, `<h1>` e subtitle**

Substituir em `index.html`:

```html
<title>NXT PECAS V2.4 - SAC</title>
```

por:

```html
<title>NXT SAC — Atendimento ao Cliente</title>
```

Substituir:

```html
<h1>NXT PECAS V2.4</h1>
<span class="header-subtitle">SAC - Consulta, Orcamento e Registro</span>
```

por:

```html
<h1>NXT SAC</h1>
<span class="header-subtitle">Atendimento ao Cliente — Pre-venda, Pos-venda, Garantia, Assistencia</span>
```

- [ ] **Step 2: Bump cache-busting `?v=2.4` → `?v=2.5` em todos os imports**

No `index.html`, substituir todas as ocorrências de `?v=2.4` por `?v=2.5`. Em PowerShell:

```bash
sed -i 's/?v=2\.4/?v=2.5/g' C:/dev/NXT/ativos/sac-pecas/index.html
```

(Ou faça manualmente nas 7 tags de script + 1 link de CSS — confira com grep depois.)

Verificar:

```bash
grep -c "?v=2.5" C:/dev/NXT/ativos/sac-pecas/index.html
```

Expected: 8 ocorrências (1 CSS + 7 JS).

- [ ] **Step 3: Abrir no browser local e confirmar**

```bash
cd C:/dev/NXT/ativos/sac-pecas
python -m http.server 8765
```

Abrir http://localhost:8765 e confirmar:
- Aba do navegador mostra "NXT SAC — Atendimento ao Cliente"
- Header mostra "NXT SAC" + novo subtitle
- Nada quebrou (abas Catalogo, Registrar, Orcamentos, Assistencias, Admin continuam clicáveis)

Parar o servidor (Ctrl+C) quando confirmar.

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add index.html
git -C C:/dev/NXT/ativos/sac-pecas commit -m "chore: rebrand NXT PECAS V2 -> NXT SAC (Fase 0)"
```

---

### Task 0.2: Bump versão nos comentários de header dos JS

**Files:**
- Modify: `formulario.js:1` (header `V2.4` → `V2.5`)
- Modify: `assistencia.js:1` (header `V2.4` → `V2.5`)
- Modify: `app.js:1`, `catalogo.js:1`, `orcamento.js:1`, `admin.js:1`, `style.css:1`, `data.js:1` (mesmo bump cosmético)

- [ ] **Step 1: Bump em todos os arquivos**

Para cada arquivo, alterar o primeiro comentário de versão. Em PowerShell:

```bash
sed -i 's/NXT PECAS V2\.4/NXT PECAS V2.5/g' C:/dev/NXT/ativos/sac-pecas/formulario.js
sed -i 's/NXT PECAS V2\.4/NXT PECAS V2.5/g' C:/dev/NXT/ativos/sac-pecas/assistencia.js
sed -i 's/NXT PECAS V2/NXT SAC V2.5/g' C:/dev/NXT/ativos/sac-pecas/app.js
sed -i 's/NXT PECAS V2/NXT SAC V2.5/g' C:/dev/NXT/ativos/sac-pecas/catalogo.js
sed -i 's/NXT PECAS V2/NXT SAC V2.5/g' C:/dev/NXT/ativos/sac-pecas/orcamento.js
sed -i 's/NXT PECAS V2/NXT SAC V2.5/g' C:/dev/NXT/ativos/sac-pecas/admin.js
sed -i 's/NXT PECAS V2/NXT SAC V2.5/g' C:/dev/NXT/ativos/sac-pecas/style.css
sed -i 's/NXT PECAS V2/NXT SAC V2.5/g' C:/dev/NXT/ativos/sac-pecas/data.js
```

- [ ] **Step 2: Validar sintaxe JS não quebrou**

```bash
for f in formulario.js assistencia.js app.js catalogo.js orcamento.js admin.js data.js; do
  node --check C:/dev/NXT/ativos/sac-pecas/$f
done
```

Expected: sem output (todos OK).

- [ ] **Step 3: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add -u
git -C C:/dev/NXT/ativos/sac-pecas commit -m "chore: bump V2.4 -> V2.5 nos headers de modulos"
```

---

### Task 0.3: Push e deploy

- [ ] **Step 1: Push**

```bash
git -C C:/dev/NXT/ativos/sac-pecas push origin master
```

- [ ] **Step 2: Aguardar GitHub Pages publicar (1-2 min)**

GitHub Pages tem deploy automático ao push na branch `master`. Pode acompanhar em https://github.com/nxtlojas-hash/sac-pecas/actions ou só esperar 90s.

- [ ] **Step 3: Verificar produção**

Abrir https://nxtlojas-hash.github.io/sac-pecas/ em janela anônima (pra ignorar cache local). Confirmar:
- Title "NXT SAC — Atendimento ao Cliente"
- Header "NXT SAC"

Se o título antigo aparecer, é cache — F5 forçado (Ctrl+Shift+R).

---

## FASE 1 — Conceito Atendimento

### Task 1.1: Adicionar tab "Atendimento" e view vazia no index.html

**Files:**
- Modify: `index.html` linhas 24-31 (nav-tabs), 36-79 (views)

- [ ] **Step 1: Adicionar tab no nav**

No `index.html`, alterar o bloco `<nav class="nav-tabs">` para inserir a nova aba **logo após "Inicio"**:

```html
<nav class="nav-tabs" id="nav-tabs">
    <button class="nav-tab active" data-view="home">Inicio</button>
    <button class="nav-tab" data-view="atendimento">&#128221; Atendimento</button>
    <button class="nav-tab" data-view="catalogo">Catalogo</button>
    <button class="nav-tab" data-view="formulario">Registrar</button>
    <button class="nav-tab" data-view="orcamentos">Orcamentos <span class="badge" id="badge-orcamentos" style="display:none;">0</span></button>
    <button class="nav-tab" data-view="assistencia">&#128295; Assistencias</button>
    <button class="nav-tab nav-tab-admin" data-view="admin" title="Gerenciar Pecas">&#9881; Admin</button>
</nav>
```

(O `&#128221;` é o ícone 📝.)

- [ ] **Step 2: Adicionar `<section>` da view-atendimento**

Logo após `<section class="view active" id="view-home">...</section>`, inserir:

```html
<!-- Atendimento View -->
<section class="view" id="view-atendimento">
    <div id="atendimento-container"></div>
</section>
```

- [ ] **Step 3: Validar HTML básico**

Abrir no servidor local (mesma técnica do Task 0.1, step 3), clicar na aba "Atendimento". Esperado: a view fica visível e vazia (container sem conteúdo ainda). Nenhum erro no console.

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add index.html
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(atendimento): adiciona tab e view vazia no nav"
```

---

### Task 1.2: Criar `atendimento.js` com skeleton da view

**Files:**
- Create: `atendimento.js`

- [ ] **Step 1: Criar o arquivo com IIFE skeleton**

Criar `C:/dev/NXT/ativos/sac-pecas/atendimento.js` com o conteúdo:

```javascript
/* ===== NXT SAC V2.5 - Atendimento (Fase 1) ===== */

(function() {
  // Cache da URL do Apps Script (reaproveita formulario.js)
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

  window.initAtendimento = function() {
    var container = document.getElementById('atendimento-container');
    if (!container) return;
    container.innerHTML = buildFormHTML();
    setupListeners();
    console.log('Atendimento (Fase 1) inicializado');
  };

  function buildFormHTML() {
    return '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128221; Abertura de Atendimento</h2>' +
      '<form id="atForm" autocomplete="off">' +
        '<div class="secao-form">' +
          '<div class="secao-form-titulo">Em construcao</div>' +
          '<p style="padding:1rem;color:#9a9a9a;">Form a implementar nos proximos passos.</p>' +
        '</div>' +
      '</form>';
  }

  function setupListeners() {
    // Placeholder — listeners reais nas proximas tasks
  }

})();
```

- [ ] **Step 2: Adicionar `<script>` no index.html**

No bloco de scripts do `index.html`, adicionar **antes de** `</body>`:

```html
<script src="atendimento.js?v=2.5"></script>
```

Após os outros 7 scripts existentes. Ordem completa esperada:

```html
<script src="data.js?v=2.5"></script>
<script src="app.js?v=2.5"></script>
<script src="catalogo.js?v=2.5"></script>
<script src="formulario.js?v=2.5"></script>
<script src="orcamento.js?v=2.5"></script>
<script src="admin.js?v=2.5"></script>
<script src="assistencia.js?v=2.5"></script>
<script src="atendimento.js?v=2.5"></script>
```

- [ ] **Step 3: Registrar `initAtendimento` no roteamento do app.js**

Abrir `app.js` e localizar a função `navigateTo` (linha 28+). Logo após o bloco que chama `initAssistencia` (procure por `initAssistencia` no arquivo), adicionar:

```javascript
} else if (view === 'atendimento') {
  if (typeof window.initAtendimento === 'function') window.initAtendimento();
```

(O exato padrão depende do encadeamento de `if/else if` na função. Se a `navigateTo` usa `switch`, adapte. Olhar como `assistencia` é tratada e seguir o mesmo padrão.)

- [ ] **Step 4: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/atendimento.js
node --check C:/dev/NXT/ativos/sac-pecas/app.js
```

Expected: sem output.

- [ ] **Step 5: Teste manual**

Server local, abrir http://localhost:8765, clicar em "Atendimento". Esperado:
- View carrega
- Título "Abertura de Atendimento" aparece
- Console mostra "Atendimento (Fase 1) inicializado"

- [ ] **Step 6: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add atendimento.js index.html app.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(atendimento): cria modulo atendimento.js com skeleton"
```

---

### Task 1.3: Implementar HTML do form de Atendimento

**Files:**
- Modify: `atendimento.js` — função `buildFormHTML`

- [ ] **Step 1: Substituir `buildFormHTML` pelo form completo**

Em `atendimento.js`, substituir a função `buildFormHTML` por:

```javascript
function buildFormHTML() {
  var modelosOpts = '<option value="">Selecione (opcional)...</option>';
  if (typeof CATALOGO_MODELOS !== 'undefined') {
    Object.keys(CATALOGO_MODELOS).forEach(function(id) {
      modelosOpts += '<option value="' + CATALOGO_MODELOS[id].nome + '">' + CATALOGO_MODELOS[id].nome + '</option>';
    });
  }

  return '' +
    '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128221; Abertura de Atendimento</h2>' +
    '<form id="atForm" autocomplete="off">' +

      // SEÇÃO 1 — CATEGORIA
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Tipo de Atendimento</div>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:1 1 100%;">' +
            '<label for="atCategoria">Categoria *</label>' +
            '<select id="atCategoria" required>' +
              '<option value="">Selecione...</option>' +
              '<option value="Pos-venda">Pos-venda (Garantia, Assistencia, Pecas)</option>' +
              '<option value="Pre-venda">Pre-venda (Interesse, Cotacao)</option>' +
              '<option value="Outro">Outro (Reclamacao, Sugestao)</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="atMotivo">Motivo *</label>' +
            '<select id="atMotivo" required disabled>' +
              '<option value="">Selecione a categoria primeiro</option>' +
            '</select></div>' +
          '<div class="form-group"><label for="atOrigem">Origem *</label>' +
            '<select id="atOrigem" required>' +
              '<option value="">Selecione...</option>' +
              '<option value="WhatsApp">WhatsApp</option>' +
              '<option value="Telefone">Telefone</option>' +
              '<option value="Loja">Loja</option>' +
              '<option value="Site">Site</option>' +
              '<option value="Outro">Outro</option>' +
            '</select></div>' +
        '</div>' +
      '</div>' +

      // SEÇÃO 2 — CLIENTE
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Cliente</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="atNome">Nome completo *</label>' +
            '<input type="text" id="atNome" required></div>' +
          '<div class="form-group"><label for="atTelefone">Telefone *</label>' +
            '<input type="text" id="atTelefone" placeholder="(00) 00000-0000" maxlength="15" required></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="atCpf">CPF / CNPJ (opcional)</label>' +
            '<input type="text" id="atCpf" placeholder="000.000.000-00"></div>' +
          '<div class="form-group" id="atNfRow" style="display:none;"><label for="atNotaFiscal">Nota Fiscal (NXT) *</label>' +
            '<input type="text" id="atNotaFiscal" placeholder="Numero da NF"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="atModelo">Modelo do Equipamento (opcional)</label>' +
            '<select id="atModelo">' + modelosOpts + '</select></div>' +
        '</div>' +
      '</div>' +

      // SEÇÃO 3 — DESCRICAO
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Descricao do Atendimento</div>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:1 1 100%;">' +
            '<label for="atDescricao">O que o cliente precisa? *</label>' +
            '<textarea id="atDescricao" rows="4" required></textarea>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="atVendedor">Vendedor / Atendente *</label>' +
            '<input type="text" id="atVendedor" required></div>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem;">' +
        '<button type="button" class="btn-secundario" id="btnLimparAt">Limpar</button>' +
        '<button type="button" class="btn-primario" id="btnAbrirAt">Abrir Atendimento &#10148;</button>' +
      '</div>' +

      '<div id="atFeedback" style="margin-top:1rem;"></div>' +
    '</form>';
}
```

- [ ] **Step 2: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/atendimento.js
```

- [ ] **Step 3: Teste visual**

No server local, clicar em Atendimento. Esperado: form completo aparece (3 seções, todos os campos visíveis exceto NF que fica oculta). Console sem erros.

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add atendimento.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(atendimento): implementa form HTML com 3 secoes"
```

---

### Task 1.4: Implementar dropdown dinâmico de motivos e visibilidade da NF

**Files:**
- Modify: `atendimento.js` — função `setupListeners` e nova função `popularMotivos`

- [ ] **Step 1: Substituir `setupListeners` e adicionar `popularMotivos`**

Em `atendimento.js`, substituir a função `setupListeners` por:

```javascript
var MOTIVOS_POR_CATEGORIA = {
  'Pos-venda': ['Garantia', 'Assistencia tecnica', 'Pecas / reposicao', 'Duvida sobre uso', 'Reclamacao'],
  'Pre-venda': ['Interesse em compra', 'Cotacao', 'Duvida sobre modelo', 'Agendar visita / test-ride'],
  'Outro':     ['Reclamacao geral', 'Sugestao', 'Elogio', 'Outro']
};

function setupListeners() {
  // Mascara de telefone (reaproveita do formulario)
  var tel = document.getElementById('atTelefone');
  if (tel && typeof aplicarMascaraTelefone === 'function') aplicarMascaraTelefone(tel);

  // Mascara CPF/CNPJ - usa padrao do formulario se existir
  var cpf = document.getElementById('atCpf');
  if (cpf && typeof aplicarMascaraCPF === 'function') aplicarMascaraCPF(cpf);

  // Categoria muda motivo + visibilidade da NF
  var cat = document.getElementById('atCategoria');
  if (cat) {
    cat.addEventListener('change', function() {
      popularMotivos(cat.value);
      toggleNF(cat.value);
    });
  }

  // Botoes
  document.getElementById('btnLimparAt').addEventListener('click', limparForm);
  document.getElementById('btnAbrirAt').addEventListener('click', abrirAtendimento);
}

function popularMotivos(categoria) {
  var sel = document.getElementById('atMotivo');
  sel.innerHTML = '';
  if (!categoria || !MOTIVOS_POR_CATEGORIA[categoria]) {
    sel.disabled = true;
    sel.innerHTML = '<option value="">Selecione a categoria primeiro</option>';
    return;
  }
  sel.disabled = false;
  sel.innerHTML = '<option value="">Selecione...</option>';
  MOTIVOS_POR_CATEGORIA[categoria].forEach(function(m) {
    var opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });
}

function toggleNF(categoria) {
  var row = document.getElementById('atNfRow');
  var input = document.getElementById('atNotaFiscal');
  if (categoria === 'Pos-venda') {
    row.style.display = '';
    input.required = true;
  } else {
    row.style.display = 'none';
    input.required = false;
    input.value = '';
  }
}

function limparForm() {
  document.getElementById('atForm').reset();
  toggleNF('');
  popularMotivos('');
  var fb = document.getElementById('atFeedback');
  if (fb) fb.innerHTML = '';
}

function abrirAtendimento() {
  // Placeholder — implementado na Task 1.6
  console.log('abrirAtendimento ainda nao implementado');
}
```

- [ ] **Step 2: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/atendimento.js
```

- [ ] **Step 3: Teste manual no browser**

Server local. Abrir aba Atendimento. Selecionar:
- Categoria "Pos-venda" → motivo lista 5 opções, campo NF aparece, fica obrigatório
- Categoria "Pre-venda" → motivo lista 4 opções, NF some
- Categoria "Outro" → motivo lista 4 opções, NF some
- Click "Limpar" → tudo zera

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add atendimento.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(atendimento): motivo dinamico + NF condicional por categoria"
```

---

### Task 1.5: Implementar submit do atendimento (frontend)

**Files:**
- Modify: `atendimento.js` — função `abrirAtendimento` (substituir placeholder)

- [ ] **Step 1: Substituir a função `abrirAtendimento`**

Substituir o placeholder de `abrirAtendimento` por:

```javascript
function abrirAtendimento() {
  if (submetendo) return;

  // Coleta dos dados
  var dados = {
    categoria: document.getElementById('atCategoria').value,
    motivo: document.getElementById('atMotivo').value,
    origem: document.getElementById('atOrigem').value,
    nomeCliente: document.getElementById('atNome').value.trim(),
    telefone: document.getElementById('atTelefone').value.trim(),
    cpfCnpj: document.getElementById('atCpf').value.trim(),
    notaFiscal: document.getElementById('atNotaFiscal').value.trim(),
    modeloEquipamento: document.getElementById('atModelo').value,
    descricao: document.getElementById('atDescricao').value.trim(),
    vendedor: document.getElementById('atVendedor').value.trim()
  };

  // Validacoes minimas
  if (!dados.categoria) return mostrarFeedback('Selecione a categoria', 'erro');
  if (!dados.motivo) return mostrarFeedback('Selecione o motivo', 'erro');
  if (!dados.origem) return mostrarFeedback('Selecione a origem', 'erro');
  if (!dados.nomeCliente) return mostrarFeedback('Informe o nome do cliente', 'erro');
  if (!dados.telefone || dados.telefone.replace(/\D/g, '').length < 10) {
    return mostrarFeedback('Telefone invalido', 'erro');
  }
  if (!dados.descricao) return mostrarFeedback('Descreva o atendimento', 'erro');
  if (!dados.vendedor) return mostrarFeedback('Informe o vendedor/atendente', 'erro');
  if (dados.categoria === 'Pos-venda' && !dados.notaFiscal) {
    return mostrarFeedback('Nota fiscal e obrigatoria em pos-venda', 'erro');
  }

  // Envio
  submetendo = true;
  var btn = document.getElementById('btnAbrirAt');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  mostrarFeedback('Abrindo atendimento...', 'info');

  var payload = Object.assign({ action: 'registrar_atendimento' }, dados);

  fetch(resolverUrl(), {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  })
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (resp && resp.sucesso) {
        mostrarSucesso(resp.id, dados);
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
      btn.innerHTML = 'Abrir Atendimento &#10148;';
    });
}

function mostrarFeedback(msg, tipo) {
  var el = document.getElementById('atFeedback');
  if (!el) return;
  var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
  el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.75rem 1rem;border-radius:6px;text-align:center;font-weight:600;">' + msg + '</div>';
}

function mostrarSucesso(id, dados) {
  // Implementado na Task 1.6 (modal de protocolo)
  mostrarFeedback('Atendimento aberto! Protocolo: ' + id, 'sucesso');
  limparForm();
}
```

- [ ] **Step 2: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/atendimento.js
```

- [ ] **Step 3: Teste com fetch mockado (backend ainda não existe)**

No browser dev tools (F12 → Console), antes de submeter, executa:

```javascript
window.fetch = () => Promise.resolve({ json: () => Promise.resolve({ sucesso: true, id: 'PV-2026-TESTE' }) });
```

Aí preenche o form e clica em "Abrir Atendimento". Esperado:
- Feedback verde "Atendimento aberto! Protocolo: PV-2026-TESTE"
- Form limpa
- Console sem erros

- [ ] **Step 4: Teste de validações**

Sem mock — tenta abrir com campo faltando. Esperado: feedback vermelho com mensagem específica, sem chamada de rede.

- [ ] **Step 5: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add atendimento.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(atendimento): validacao + submit ao Apps Script"
```

---

### Task 1.6: Modal de sucesso pós-abertura (protocolo + WhatsApp + copiar)

**Files:**
- Modify: `atendimento.js` — substituir `mostrarSucesso`

- [ ] **Step 1: Substituir `mostrarSucesso`**

Substituir a função `mostrarSucesso` por:

```javascript
function mostrarSucesso(id, dados) {
  // Remove modal anterior se existir
  var existente = document.getElementById('atModalSucesso');
  if (existente) existente.remove();

  var modal = document.createElement('div');
  modal.id = 'atModalSucesso';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem;';

  var telDigits = (dados.telefone || '').replace(/\D/g, '');
  var primeiroNome = (dados.nomeCliente || '').split(' ')[0] || 'Cliente';
  var msgWA = 'Ola ' + primeiroNome + '!\n\nSeu atendimento foi registrado na NXT.\n\n' +
    '*Protocolo:* ' + id + '\n' +
    '*Categoria:* ' + dados.categoria + '\n' +
    '*Motivo:* ' + dados.motivo + '\n\n' +
    'Guarde esse numero para acompanhar. Em breve retornaremos.\n\n_NXT SAC_';

  var canWhats = telDigits.length >= 10;

  modal.innerHTML = '' +
    '<div style="background:#fff;border-radius:8px;max-width:480px;width:100%;box-shadow:0 20px 40px rgba(0,0,0,0.3);">' +
      '<div style="background:#1a1a2e;color:#fff;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;border-radius:8px 8px 0 0;">' +
        '<div>' +
          '<div style="font-size:11px;letter-spacing:1.5px;color:#c6ff00;font-weight:700;">ATENDIMENTO ABERTO</div>' +
          '<div style="font-size:22px;font-weight:900;margin-top:2px;letter-spacing:1px;">' + escapeHtmlAt(id) + '</div>' +
        '</div>' +
        '<button id="atModalClose" style="background:transparent;border:none;color:#fff;font-size:28px;cursor:pointer;line-height:1;padding:0 0.25rem;">&times;</button>' +
      '</div>' +
      '<div style="padding:1.25rem;">' +
        '<div style="font-size:13px;color:#444;margin-bottom:0.75rem;">' +
          '<strong>' + escapeHtmlAt(primeiroNome) + '</strong> &bull; ' + escapeHtmlAt(dados.telefone) +
        '</div>' +
        '<div style="font-size:13px;color:#666;margin-bottom:1rem;">' +
          'Protocolo registrado em planilha. Compartilhe com o cliente:' +
        '</div>' +
        '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
          '<button id="atBtnCopiar" style="flex:1;min-width:140px;padding:0.7rem;background:#1a1a2e;color:#c6ff00;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px;">&#128203; Copiar protocolo</button>' +
          '<button id="atBtnWa" ' + (canWhats ? '' : 'disabled') +
            ' style="flex:1;min-width:140px;padding:0.7rem;background:' + (canWhats ? '#25d366' : '#9ca3af') + ';color:#fff;border:none;border-radius:6px;font-weight:600;cursor:' + (canWhats ? 'pointer' : 'not-allowed') + ';font-size:13px;">&#128241; WhatsApp</button>' +
        '</div>' +
        '<div style="margin-top:1rem;text-align:center;font-size:11px;color:#999;">Voce pode fechar este aviso quando terminar.</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  document.getElementById('atModalClose').addEventListener('click', function() { modal.remove(); });
  document.getElementById('atBtnCopiar').addEventListener('click', function() {
    navigator.clipboard.writeText(id).then(function() {
      mostrarFeedback('Protocolo ' + id + ' copiado', 'sucesso');
    }).catch(function() {
      mostrarFeedback('Falha ao copiar — selecione e Ctrl+C', 'erro');
    });
  });
  if (canWhats) {
    document.getElementById('atBtnWa').addEventListener('click', function() {
      var url = 'https://wa.me/55' + telDigits + '?text=' + encodeURIComponent(msgWA);
      window.open(url, '_blank');
    });
  }

  // Limpa o form no fundo
  limparForm();
}

function escapeHtmlAt(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Validar sintaxe**

```bash
node --check C:/dev/NXT/ativos/sac-pecas/atendimento.js
```

- [ ] **Step 3: Teste com fetch mockado**

No browser dev tools:

```javascript
window.fetch = () => Promise.resolve({ json: () => Promise.resolve({ sucesso: true, id: 'PV-2026-0042' }) });
```

Preenche o form completo e abre. Esperado:
- Modal aparece centralizado, fundo escuro, protocolo "PV-2026-0042" em destaque
- 2 botões: "Copiar protocolo" (lime) e "WhatsApp" (verde)
- Click em Copiar → feedback "Protocolo PV-2026-0042 copiado"
- Click em WhatsApp → abre nova aba `wa.me/55...?text=...`
- Click em X → modal fecha

- [ ] **Step 4: Commit**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add atendimento.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(atendimento): modal de sucesso com protocolo + WhatsApp + copiar"
```

---

### Task 1.7: Apps Script — endpoint `registrar_atendimento` e gerador de ID

**Files:**
- Modify: `google-apps-script.js` (cópia local) — adicionar case no `doPost` e funções helper

> O `google-apps-script.js` no repositório é uma **cópia local de referência**. O código que roda em produção fica no editor do Apps Script no Google. As mudanças desta task devem ser **coladas no editor do Apps Script** após editar o arquivo local.

- [ ] **Step 1: Adicionar case no `doPost`**

Abrir `google-apps-script.js`. Localizar a função `doPost` (linha ~836). Procurar pelo case `'registrar_os'` (~linha 870). Logo após o bloco daquele case, adicionar:

```javascript
case 'registrar_atendimento':
  resposta = registrarAtendimento(payload);
  break;
```

- [ ] **Step 2: Adicionar as funções helper no final do arquivo**

Adicionar ao fim do `google-apps-script.js`:

```javascript
// ============================================================
// ATENDIMENTOS (Fase 1 do NXT SAC)
// ============================================================

var SHEET_ATENDIMENTOS = 'Atendimentos';

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

function gerarProximoIdAtendimento() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ano = new Date().getFullYear();
    var prefix = 'PV-' + ano + '-';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_ATENDIMENTOS);
    if (!sheet) throw new Error('Aba Atendimentos nao encontrada');

    var dados = sheet.getRange('A2:A').getValues();
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
```

- [ ] **Step 3: Copiar o conteúdo do arquivo local pro editor do Apps Script**

1. Abrir https://script.google.com
2. Selecionar o projeto vinculado ao Sheets do SAC (mesmo que o `sac-pecas` já usa)
3. Substituir o conteúdo do arquivo principal pelo conteúdo de `google-apps-script.js` local
4. Salvar (Ctrl+S)
5. **Implantar** → Nova implantação → tipo "App da Web" → "Quem tem acesso: Qualquer pessoa" → Implantar
6. Confirmar que a URL do Web App não mudou (se mudou, atualizar `GOOGLE_SCRIPT_URL` no `data.js` e deployar tudo)

- [ ] **Step 4: Commit do arquivo local**

```bash
git -C C:/dev/NXT/ativos/sac-pecas add google-apps-script.js
git -C C:/dev/NXT/ativos/sac-pecas commit -m "feat(apps-script): adiciona registrar_atendimento + gerador de ID"
```

---

### Task 1.8: Criar aba "Atendimentos" no Google Sheets (manual)

**Files:**
- Modify (manual): Google Sheets do projeto

- [ ] **Step 1: Abrir a planilha**

A planilha é a mesma que o `sac-pecas` usa hoje (vinculada ao Apps Script). Abrir via console do Apps Script: `SpreadsheetApp.getActiveSpreadsheet().getUrl()` ou abrir direto pela URL no Drive.

- [ ] **Step 2: Adicionar nova aba "Atendimentos"**

Click no `+` no canto inferior esquerdo. Renomear pra `Atendimentos` (exatamente, com 'A' maiúsculo).

- [ ] **Step 3: Adicionar cabeçalhos na linha 1**

Cabeçalhos exatos, da coluna A até a P:

```
A1: id
B1: dataAbertura
C1: categoria
D1: motivo
E1: origem
F1: nomeCliente
G1: telefone
H1: cpfCnpj
I1: notaFiscal
J1: modeloEquipamento
K1: descricao
L1: vendedor
M1: status
N1: dataFechamento
O1: motivoFechamento
P1: npsEnviado
```

- [ ] **Step 4: Formatar cabeçalho (opcional)**

Selecionar linha 1, deixar em negrito, fundo cinza claro. Travar linha (Visualizar → Congelar → 1 linha).

---

### Task 1.9: Teste end-to-end e deploy

- [ ] **Step 1: Teste local com backend real**

```bash
cd C:/dev/NXT/ativos/sac-pecas
python -m http.server 8765
```

Abrir http://localhost:8765, ir em "Atendimento". **Sem** mockar fetch. Preencher form real com dados de teste:
- Categoria: Pos-venda
- Motivo: Garantia
- Origem: WhatsApp
- Nome: Cliente Teste E2E
- Telefone: (11) 99999-0000
- CPF: 123.456.789-00
- NF: 999999
- Modelo: Jaya
- Descrição: Teste do fluxo end-to-end
- Vendedor: Claudia

Click "Abrir Atendimento". Esperado:
- Modal mostra `PV-2026-0001` (ou o próximo número)
- Conferir na planilha "Atendimentos" que uma nova linha apareceu com todos os campos preenchidos
- Click em Copiar funciona
- Click em WhatsApp abre `wa.me/5511999990000?text=...`

- [ ] **Step 2: Teste de validação (NF obrigatória)**

No form, escolher categoria "Pre-venda" → NF some. Preencher e abrir. Esperado: linha grava com NF vazia.

Mudar categoria pra "Pos-venda" e deixar NF em branco. Esperado: feedback "Nota fiscal e obrigatoria em pos-venda".

- [ ] **Step 3: Teste de ID concorrente (opcional)**

Abrir 2 abas do app. Preencher form em ambas. Submeter quase simultaneamente. Esperado: IDs consecutivos, sem duplicação na planilha. `LockService` deve serializar.

- [ ] **Step 4: Push e deploy**

```bash
git -C C:/dev/NXT/ativos/sac-pecas push origin master
```

GitHub Pages atualiza em ~1min.

- [ ] **Step 5: Validar em produção**

Abrir https://nxtlojas-hash.github.io/sac-pecas/ em janela anônima. Repetir um teste rápido (registrar 1 atendimento). Confirmar que aparece na planilha.

- [ ] **Step 6: Commit final (se houve ajustes)**

Se precisou ajustar algo durante os testes:

```bash
git -C C:/dev/NXT/ativos/sac-pecas add -u
git -C C:/dev/NXT/ativos/sac-pecas commit -m "fix: ajustes pos-teste E2E da Fase 1"
git -C C:/dev/NXT/ativos/sac-pecas push origin master
```

---

## Self-Review

**Spec coverage:**
- ✅ Identidade (NXT SAC) — Tasks 0.1, 0.2
- ✅ Protocolo único — Tasks 1.5, 1.6, 1.7
- ✅ Categorização (Pre/Pos/Outro) — Tasks 1.3, 1.4
- ✅ NF obrigatória em pós-venda — Task 1.4
- ✅ Persistência em Sheets — Tasks 1.7, 1.8
- ✅ Apps Script com LockService — Task 1.7
- ❌ Timeline por cliente, Lista/busca, Link com docs, NPS — fora do escopo (Fases 2-5, planos próprios)

**Placeholder scan:** Sem `TBD/TODO/etc`. Cada step tem código completo ou comando exato.

**Type consistency:** Nomes de funções consistentes (`buildFormHTML`, `setupListeners`, `popularMotivos`, `toggleNF`, `abrirAtendimento`, `mostrarSucesso`, `mostrarFeedback`, `escapeHtmlAt`, `limparForm`). IDs do DOM começam com `at` (`atForm`, `atCategoria`, `atMotivo`, etc).

---

## Próximas fases (referência)

- **Fase 2:** lista + busca de atendimentos (planejada em sessão própria)
- **Fase 3:** linkar PCA/ORC/OS ao protocolo
- **Fase 4:** timeline por cliente
- **Fase 5:** NPS
- **Fase 6:** unificação real (criar venda direto do atendimento)
