# Assistência Técnica + Ajustes SAC-Peças — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar 4 entregas no sistema `sac-pecas/`: (1) fix CNPJ, (2) seção "Dados da Coleta" no PDF, (3) nova feature de Ordem de Serviço para Assistência Técnica em aba isolada, (4) item "Mão de obra" com valor rateado nos produtos enviados ao Bling.

**Architecture:** Vanilla JS SPA com múltiplas views em uma única página; backend Google Apps Script falando com Google Sheets e Bling API. `assistencia.js` é novo arquivo irmão de `formulario.js`, sem imports cruzados. No Apps Script, nova função `registrarOS()` é 100% isolada de `enviarPedidoBling`. Mão de obra é rateada via função pura no Apps Script antes de montar o payload do Bling.

**Tech Stack:** HTML/CSS/JS vanilla, Google Apps Script (V8), Google Sheets (backend), Bling ERP API v3 (NF-e).

**Spec:** [`docs/superpowers/specs/2026-04-19-assistencia-tecnica-design.md`](../specs/2026-04-19-assistencia-tecnica-design.md)

---

## Pré-implementação: Backup e branch

### Task 0: Preparação

**Files:** nenhum arquivo modificado; operações git apenas.

- [ ] **Step 1: Verificar branch atual**

Run: `git status && git log --oneline -3`
Expected: branch `master`, HEAD em `3dd7c38` (commit do spec).

- [ ] **Step 2: Criar tag de backup do estado atual**

Run: `git tag backup-before-assistencia-feature`
Expected: tag criada silenciosamente. Restaurar com `git reset --hard backup-before-assistencia-feature` se algo der errado.

- [ ] **Step 3: Confirmar endpoint Apps Script em produção**

Run: `grep -n "GOOGLE_SCRIPT_URL" C:/dev/NXT/ativos/sac-pecas/formulario.js`
Expected: linha 3 mostra a URL do Web App. Anote essa URL — ela é o endpoint único de toda comunicação com o backend (incluindo o novo fluxo de OS).

---

## ENTREGA 1 — Fix validação CNPJ

### Task 1.1: Reproduzir o bug e adicionar logs de diagnóstico temporários

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/formulario.js` (função `validarCampoDocumento`, linha 763)

- [ ] **Step 1: Adicionar logs de diagnóstico**

Edite `formulario.js` — função `validarCampoDocumento()` (linha 763). No começo da função, após a linha `var digitos = input.value.replace(/\D/g, '');`, adicione:

```javascript
// TEMP debug CNPJ — remover depois de validar
console.log('[CNPJ debug]', {
  valorBruto: input.value,
  digitos: digitos,
  length: digitos.length,
  tipo: tipo
});
```

- [ ] **Step 2: Abrir o sistema no navegador e reproduzir**

Abra `index.html` no navegador (duplo-clique ou via Live Server). Vá para aba "Registrar". No formulário:
1. Abra o console do navegador (F12 > Console).
2. Mude "Tipo de cliente" para "Jurídica".
3. Digite um CNPJ válido (use `11.222.333/0001-81` que é o CNPJ de teste público).
4. Observe os logs.

Expected: log mostra `digitos` com 14 chars sem máscara. Se `length !== 14` ou `digitos` contém letras/símbolos, isso é o bug.

- [ ] **Step 3: Testar o caso "trocar tipo após digitar"**

Ainda no navegador:
1. Apague o campo.
2. Mude tipo para "Física".
3. Digite `11222333000181` (sem máscara).
4. Observe: campo deve aplicar máscara de CPF, truncar para 11 dígitos → `112.223.330-00`.
5. Agora mude tipo para "Jurídica" **sem limpar o campo**.
6. Observe: a máscara antiga (CPF) fica no campo mas `tipoCliente` agora é J. Ao validar → CNPJ inválido (bug confirmado).

Expected: confirma que o bug é **troca de tipo sem limpar o campo**.

- [ ] **Step 4: Commit dos logs (temporário)**

Não comitar ainda — os logs saem junto com o fix.

### Task 1.2: Corrigir o bug — limpar campo ao trocar tipo

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/formulario.js` (procurar handler de troca de tipo)

- [ ] **Step 1: Localizar o handler de troca de tipoCliente**

Run: `grep -n "tipoCliente" C:/dev/NXT/ativos/sac-pecas/formulario.js`
Expected: várias ocorrências. Procure onde há `addEventListener('change', ...)` associado a `tipoCliente`. Se não existir, será preciso criar.

- [ ] **Step 2: Adicionar listener para limpar campo + re-aplicar máscara**

Em `setupFormListeners()` (após os listeners existentes, antes do `// Mascara CEP` — por volta da linha 386), adicione:

```javascript
// Handler trocar tipo de cliente F/J - limpa campo documento para evitar máscara desincronizada
var tipoClienteSelect = document.getElementById('tipoCliente');
if (tipoClienteSelect) {
  tipoClienteSelect.addEventListener('change', function() {
    var docInput = document.getElementById('cpfCnpjCliente');
    if (docInput) {
      docInput.value = '';
      docInput.classList.remove('campo-invalido', 'campo-valido');
      var aviso = document.getElementById('avisoDocumento');
      if (aviso) aviso.classList.remove('visivel');
      docInput.maxLength = this.value === 'J' ? 18 : 14;
      docInput.placeholder = this.value === 'J' ? '00.000.000/0000-00' : '000.000.000-00';
    }
  });
}
```

- [ ] **Step 3: Validar fix no navegador**

Abra o sistema. Na aba "Registrar":
1. Digite CPF em modo Física → validação OK.
2. Mude para Jurídica → campo é limpo, placeholder muda para CNPJ.
3. Digite `11.222.333/0001-81` → deve aceitar (borda verde).

Expected: CNPJ válido é aceito após troca de tipo. Sem erro "CNPJ invalido".

- [ ] **Step 4: Testar 3 CNPJs reais**

Cole/digite estes 3 CNPJs em modo Jurídica:
- `11.222.333/0001-81` (número público de teste)
- `60.746.948/0001-12` (Banco Bradesco)
- `00.000.000/0001-91` (BB - cenário com zeros)

Expected: todos aceitos.

- [ ] **Step 5: Testar submit completo**

Preencha o formulário inteiro (tipo atendimento, data, vendedor, nome, telefone válido, CNPJ válido, endereço) + adicione 1 peça + clique "Registrar". Submit deve passar.

Expected: sem erro "CNPJ invalido" no envio.

- [ ] **Step 6: Remover logs de diagnóstico**

Delete o bloco `console.log('[CNPJ debug]', {...})` adicionado em 1.1 Step 1.

- [ ] **Step 7: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/formulario.js
git commit -m "$(cat <<'EOF'
fix(form): limpar campo documento ao alternar Tipo de Cliente F/J

Bug: ao trocar o tipo após digitar, a máscara anterior
ficava no campo e gerava "CNPJ inválido" mesmo com
número válido.

Fix: listener de change em tipoCliente limpa o input,
reseta o estado visual e reaplica maxLength/placeholder
correspondente ao novo tipo.

Constraint: não alterar o envio para o Bling (já robusto via replace)
Confidence: high
Scope-risk: narrow
Not-tested: casos onde máscara vem colada do clipboard com formato estranho
EOF
)"
```

---

## ENTREGA 3 — Seção "Dados da Coleta" no PDF de peças

Nota: entrego 3 antes de 4 conforme a ordem do spec (baixo risco primeiro, Bling por último).

### Task 3.1: Adicionar seção "Dados da Coleta" no PDF

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/formulario.js` (bloco HTML do PDF, linha 1456-1460)

- [ ] **Step 1: Localizar o bloco OBSERVAÇÕES no HTML do PDF**

Abra `formulario.js` e confirme as linhas 1456-1466:

```javascript
/* OBSERVACOES */
'<div class="section">' +
  '<div class="section-title bg-obs">OBSERVA\u00c7\u00d5ES</div>' +
  '<div class="obs-body">' + (venda.observacoes || '') + '</div>' +
'</div>' +

/* ASSINATURAS */
'<div class="signatures">' +
  '<div class="sig-block"><div class="sig-line">Separado por / Data</div></div>' +
  '<div class="sig-block"><div class="sig-line">Conferido por / Data</div></div>' +
'</div>' +
```

- [ ] **Step 2: Inserir o bloco DADOS DA COLETA entre OBSERVAÇÕES e ASSINATURAS**

Substitua o bloco acima por (note o novo bloco no meio):

```javascript
/* OBSERVACOES */
'<div class="section">' +
  '<div class="section-title bg-obs">OBSERVA\u00c7\u00d5ES</div>' +
  '<div class="obs-body">' + (venda.observacoes || '') + '</div>' +
'</div>' +

/* DADOS DA COLETA */
'<div class="section">' +
  '<div class="section-title bg-dark">DADOS DA COLETA</div>' +
  '<div class="section-body">' +
    '<table class="envio-table">' +
      '<tr><td colspan="2"><span class="lbl">Transportadora</span><span class="val" style="border-bottom:1px solid #000;display:inline-block;min-width:240px;">&nbsp;</span></td></tr>' +
      '<tr>' +
        '<td><span class="lbl">Confer\u00eancia de NFe</span><span class="val" style="border-bottom:1px solid #000;display:inline-block;min-width:160px;">&nbsp;</span></td>' +
        '<td><span class="lbl">Confer\u00eancia de Carga</span><span class="val" style="border-bottom:1px solid #000;display:inline-block;min-width:160px;">&nbsp;</span></td>' +
      '</tr>' +
      '<tr>' +
        '<td><span class="lbl">Assinatura do Motorista</span><span class="val" style="border-bottom:1px solid #000;display:inline-block;min-width:160px;">&nbsp;</span></td>' +
        '<td><span class="lbl">Assinatura do Conferente</span><span class="val" style="border-bottom:1px solid #000;display:inline-block;min-width:160px;">&nbsp;</span></td>' +
      '</tr>' +
    '</table>' +
  '</div>' +
'</div>' +

/* ASSINATURAS */
'<div class="signatures">' +
  '<div class="sig-block"><div class="sig-line">Separado por / Data</div></div>' +
  '<div class="sig-block"><div class="sig-line">Conferido por / Data</div></div>' +
'</div>' +
```

- [ ] **Step 3: Testar geração do PDF**

No navegador: aba Registrar, preenche formulário completo, adiciona 1 peça, clica "Registrar + Imprimir PDF" (ou o botão equivalente que gera PDF). Janela de impressão abre.

Expected: Folha 1 mostra seção "DADOS DA COLETA" entre OBSERVAÇÕES e ASSINATURAS, com 4 campos em branco para preenchimento manual. Folha 2 (etiqueta) inalterada.

- [ ] **Step 4: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/formulario.js
git commit -m "$(cat <<'EOF'
feat(pdf): adicionar seção Dados da Coleta na folha 1

Novo bloco entre OBSERVAÇÕES e ASSINATURAS com campos
em branco para preenchimento manual na hora da coleta:
Transportadora, Conferência de NFe, Conferência de Carga,
Assinatura do Motorista, Assinatura do Conferente.

Constraint: não modificar folha 2 (etiqueta)
Confidence: high
Scope-risk: narrow
EOF
)"
```

---

## ENTREGA 4 — Feature Assistência Técnica

### Task 4.1: Criar aba "AssistenciasTecnicas" na planilha

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/google-apps-script.js` (adicionar constante de aba)

- [ ] **Step 1: Adicionar constante de nome da aba**

Em `google-apps-script.js` (perto das outras constantes, ex. linha 44):

```javascript
var ABA_ORCAMENTOS = 'Orcamentos';
var ABA_REGISTROS = 'Registros';
var ABA_PECAS = 'Pecas';
var ABA_ESTOQUE = 'Estoque';
var ABA_ASSISTENCIAS = 'AssistenciasTecnicas';  // <-- adicionar esta linha
```

- [ ] **Step 2: Criar função para inicializar a aba se não existir**

No final de `google-apps-script.js` (antes do último `}` de fechamento do arquivo se houver, ou apenas no final), adicione:

```javascript
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
```

- [ ] **Step 3: Testar criação da aba no Apps Script**

Abra o editor do Apps Script (script.google.com), selecione a função `garantirAbaAssistencias` no dropdown e clique em "Executar". Verifique na planilha se a aba "AssistenciasTecnicas" foi criada com o cabeçalho correto.

Expected: nova aba existe com 16 colunas na linha 1 em negrito.

- [ ] **Step 4: Commit (ainda não deployar — mais tarefas virão em deploys conjuntos)**

```bash
git add C:/dev/NXT/ativos/sac-pecas/google-apps-script.js
git commit -m "feat(apps-script): adicionar aba AssistenciasTecnicas + função garantir"
```

### Task 4.2: Implementar `obterProximoNumeroOS()` com LockService

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/google-apps-script.js`

- [ ] **Step 1: Adicionar a função após `garantirAbaAssistencias`**

```javascript
function obterProximoNumeroOS() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // aguarda até 10s

  try {
    var aba = garantirAbaAssistencias();
    var ultimaLinha = aba.getLastRow();
    var anoAtual = new Date().getFullYear();
    var prefixo = 'OS-' + anoAtual + '-';

    var maiorSeq = 0;
    if (ultimaLinha > 1) {
      var numeros = aba.getRange(2, 2, ultimaLinha - 1, 1).getValues(); // coluna B
      for (var i = 0; i < numeros.length; i++) {
        var num = String(numeros[i][0] || '');
        if (num.indexOf(prefixo) === 0) {
          var seq = parseInt(num.substring(prefixo.length), 10);
          if (!isNaN(seq) && seq > maiorSeq) maiorSeq = seq;
        }
      }
    }

    var proximo = maiorSeq + 1;
    var padded = String(proximo).padStart(4, '0');
    return prefixo + padded;
  } finally {
    lock.releaseLock();
  }
}
```

- [ ] **Step 2: Testar no editor Apps Script**

No editor, execute `obterProximoNumeroOS()` manualmente.
Expected: retorna `OS-2026-0001` na primeira chamada (aba vazia). Execute de novo sem gravar nada — ainda retorna `OS-2026-0001` (porque não foi gravado).

- [ ] **Step 3: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/google-apps-script.js
git commit -m "feat(apps-script): obterProximoNumeroOS com LockService"
```

### Task 4.3: Implementar `registrarOS()` no Apps Script

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/google-apps-script.js`

- [ ] **Step 1: Adicionar função `registrarOS`**

Após `obterProximoNumeroOS`, adicione:

```javascript
function registrarOS(dados) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var aba = garantirAbaAssistencias();
    var numeroOS = obterProximoNumeroOSSemLock_(aba);  // chamada interna sem re-lock

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
```

- [ ] **Step 2: Refatorar `obterProximoNumeroOS` (público) para usar o helper**

Substitua o corpo de `obterProximoNumeroOS` pelo seguinte, para evitar duplicação e re-lock:

```javascript
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
```

- [ ] **Step 3: Registrar a ação no `doPost`**

Na função `doPost` (linha 749), dentro do switch, adicione após `case 'baixa_estoque':`:

```javascript
case 'registrar_os':
  return jsonResponse(registrarOS(body));
```

- [ ] **Step 4: Testar no editor**

No editor Apps Script, crie uma função de teste temporária:

```javascript
function testarRegistrarOS() {
  var resultado = registrarOS({
    nomeCliente: 'Teste',
    telefoneCliente: '11999999999',
    cidade: 'Sumaré',
    modelo: 'Kay',
    notaFiscalCompra: '123',
    tipo: 'Garantia',
    assistencia: 'Oficina Teste',
    problemaRelatado: 'teste'
  });
  Logger.log(JSON.stringify(resultado));
}
```

Execute `testarRegistrarOS`. Na aba AssistenciasTecnicas deve aparecer 1 linha nova com OS-2026-0001.

Expected: log mostra `{"sucesso": true, "numeroOS": "OS-2026-0001"}` e a planilha tem a linha.

- [ ] **Step 5: Deletar a função de teste temporária**

Delete `testarRegistrarOS` do arquivo.

- [ ] **Step 6: Deployar Apps Script**

No editor Apps Script, `Deploy > Manage deployments > Edit (ícone do lápis) > Nova versão > Deploy`. A URL não muda, mas a nova versão entra em produção. Confirmar que a URL segue sendo a mesma que `GOOGLE_SCRIPT_URL` em formulario.js.

Expected: deploy bem-sucedido.

- [ ] **Step 7: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/google-apps-script.js
git commit -m "feat(apps-script): registrarOS + action POST registrar_os"
```

### Task 4.4: Criar `assistencia.js` — estrutura inicial

**Files:**
- Create: `C:/dev/NXT/ativos/sac-pecas/assistencia.js`

- [ ] **Step 1: Criar arquivo com esqueleto**

```javascript
/* ===== NXT PECAS V2.1 - Formulário Assistência Técnica ===== */

(function(){
  // Usa a mesma URL do formulario.js — ver formulario.js linha 3
  var GOOGLE_SCRIPT_URL_OS = null;

  function resolverUrl() {
    if (GOOGLE_SCRIPT_URL_OS) return GOOGLE_SCRIPT_URL_OS;
    if (typeof GOOGLE_SCRIPT_URL !== 'undefined') {
      GOOGLE_SCRIPT_URL_OS = GOOGLE_SCRIPT_URL;
      return GOOGLE_SCRIPT_URL_OS;
    }
    throw new Error('GOOGLE_SCRIPT_URL não definida — carregar formulario.js primeiro.');
  }

  var submetendo = false;

  // --- Init ---
  window.initAssistencia = function() {
    var container = document.getElementById('assistencia-container');
    if (!container) return;
    container.innerHTML = buildFormHTMLAssistencia();
    setupListenersAssistencia();
    console.log('Formulário Assistência Técnica inicializado');
  };

  function buildFormHTMLAssistencia() {
    // Scaffold intencional — implementação real na Task 4.6
    return '<p>placeholder — formulário será renderizado na Task 4.6</p>';
  }

  function setupListenersAssistencia() {
    // Scaffold intencional — implementação real na Task 4.7
  }
})();
```

> Scaffold deliberado: `buildFormHTMLAssistencia` e `setupListenersAssistencia` recebem implementações concretas nas Tasks 4.6 e 4.7 a seguir. Não é um TBD — é uma estrutura mínima para validar o carregamento da view antes de investir na UI.

- [ ] **Step 2: Referenciar o script no index.html**

Abra `index.html` e adicione o script após `formulario.js` (linha 99):

```html
<script src="formulario.js"></script>
<script src="orcamento.js"></script>
<script src="admin.js"></script>
<script src="assistencia.js"></script>   <!-- NOVO -->
```

Coloque o novo `<script>` **após** `formulario.js` para poder reutilizar `GOOGLE_SCRIPT_URL`.

- [ ] **Step 3: Validar que não há erros no console**

Recarregue a página. Abra DevTools > Console.

Expected: nenhum erro JavaScript. Log `Formulário Assistência Técnica inicializado` aparece após clicar em `navigateTo('assistencia')` — mas como ainda não há view, isso será implementado em task 4.5.

- [ ] **Step 4: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/assistencia.js C:/dev/NXT/ativos/sac-pecas/index.html
git commit -m "feat(assistencia): esqueleto de assistencia.js + referência no HTML"
```

### Task 4.5: Adicionar view `#view-assistencia` + navegação

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/index.html`
- Modify: `C:/dev/NXT/ativos/sac-pecas/app.js`

- [ ] **Step 1: Adicionar aba na nav e view no HTML**

Em `index.html`, linha 28 (após a aba Orcamentos, antes de Admin):

```html
<button class="nav-tab" data-view="orcamentos">Orcamentos <span class="badge" id="badge-orcamentos" style="display:none;">0</span></button>
<button class="nav-tab" data-view="assistencia">&#128295; Assistencias</button>   <!-- NOVO -->
<button class="nav-tab nav-tab-admin" data-view="admin" title="Gerenciar Pecas">&#9881; Admin</button>
```

Após a view Orcamentos (linha 68), adicione:

```html
<!-- Assistencia Tecnica View -->
<section class="view" id="view-assistencia">
  <div id="assistencia-container"></div>
</section>
```

- [ ] **Step 2: Adicionar caso no `navigateTo`**

Em `app.js`, na função `navigateTo` (linha 28-53), dentro do bloco de `else if`:

```javascript
} else if (view === 'admin') {
  if (typeof initAdmin === 'function') initAdmin();
} else if (view === 'assistencia') {                        // NOVO
  if (typeof initAssistencia === 'function') initAssistencia();
}
```

- [ ] **Step 3: Adicionar botão na home**

Em `app.js`, função `renderHome()` (linha 94-107), dentro do `btnSection.innerHTML`, adicione o botão de Assistência:

```javascript
btnSection.innerHTML =
  '<button class="btn-secundario" onclick="abrirTabelaPrecos()" style="font-size:1rem;padding:0.75rem 2rem;">' +
    '\uD83D\uDCCA Tabela Completa de Precos' +
  '</button>' +
  '<button class="btn-secundario" onclick="abrirControleEstoque()" style="font-size:1rem;padding:0.75rem 2rem;">' +
    '\uD83D\uDCE6 Controle de Estoque' +
  '</button>' +
  '<button class="btn-secundario" onclick="abrirGuiaUso()" style="font-size:1rem;padding:0.75rem 2rem;">' +
    '\uD83D\uDCD6 Guia de Uso' +
  '</button>' +
  '<button class="btn-primario" onclick="navigateTo(\'assistencia\')" style="font-size:1rem;padding:0.75rem 2rem;">' +   // NOVO
    '\uD83D\uDD27 Abrir OS Assistencia' +
  '</button>';
```

> Se a classe `btn-primario` não existir no `style.css`, use `btn-secundario` com background destacado inline.

- [ ] **Step 4: Validar navegação**

Recarregue. Clique na aba "🔧 Assistencias" ou no botão da home. A view deve aparecer mostrando `placeholder`. Console logga "Formulário Assistência Técnica inicializado".

Expected: view troca sem erros.

- [ ] **Step 5: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/index.html C:/dev/NXT/ativos/sac-pecas/app.js
git commit -m "feat(assistencia): nav, view e botão home para Assistência Técnica"
```

### Task 4.6: Implementar `buildFormHTMLAssistencia()`

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/assistencia.js`

- [ ] **Step 1: Substituir o placeholder em `buildFormHTMLAssistencia`**

```javascript
function buildFormHTMLAssistencia() {
  var modelsOptions = '<option value="">Selecione...</option>';
  // Reutilizar a lista de modelos do catálogo se disponível
  if (typeof CATALOGO_MODELOS !== 'undefined') {
    Object.keys(CATALOGO_MODELOS).forEach(function(id) {
      modelsOptions += '<option value="' + CATALOGO_MODELOS[id].nome + '">' + CATALOGO_MODELOS[id].nome + '</option>';
    });
  }
  modelsOptions += '<option value="Outro">Outro</option>';

  return '' +
    '<form id="osForm" autocomplete="off">' +
      '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">\uD83D\uDD27 Abertura de OS — Assistência Técnica</h2>' +

      // DADOS DO CLIENTE
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Dados do Cliente</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="osNomeCliente">Nome completo *</label>' +
            '<input type="text" id="osNomeCliente" required></div>' +
          '<div class="form-group"><label for="osTelefoneCliente">Telefone *</label>' +
            '<input type="text" id="osTelefoneCliente" placeholder="(00) 00000-0000" maxlength="15" required>' +
            '<span class="campo-aviso" id="osAvisoTelefone">Telefone inválido</span></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="osCidade">Cidade *</label>' +
            '<input type="text" id="osCidade" required></div>' +
        '</div>' +
      '</div>' +

      // DADOS DA MOTO
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Dados da Moto</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="osModelo">Modelo *</label>' +
            '<select id="osModelo" required>' + modelsOptions + '</select></div>' +
          '<div class="form-group"><label for="osNumeroChassi">Nº Chassi / Série</label>' +
            '<input type="text" id="osNumeroChassi"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label for="osDataCompra">Data da compra</label>' +
            '<input type="date" id="osDataCompra"></div>' +
          '<div class="form-group"><label for="osNotaFiscal">Nota fiscal de compra *</label>' +
            '<input type="text" id="osNotaFiscal" required></div>' +
        '</div>' +
      '</div>' +

      // ATENDIMENTO
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Atendimento</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Tipo *</label>' +
            '<div class="checkbox-group">' +
              '<label><input type="radio" name="osTipo" value="Garantia" checked> Garantia</label>' +
              '<label><input type="radio" name="osTipo" value="Venda"> Venda</label>' +
            '</div></div>' +
          '<div class="form-group"><label for="osAssistencia">Assistência técnica *</label>' +
            '<input type="text" id="osAssistencia" required></div>' +
        '</div>' +
      '</div>' +

      // OCORRENCIA
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Ocorrência</div>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:1 1 100%;">' +
            '<label for="osProblema">Problema relatado pelo cliente *</label>' +
            '<textarea id="osProblema" rows="4" required></textarea></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:1 1 100%;">' +
            '<label for="osObservacoes">Observações internas (opcional)</label>' +
            '<textarea id="osObservacoes" rows="2"></textarea></div>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem;">' +
        '<button type="button" class="btn-secundario" id="btnLimparOS">Limpar</button>' +
        '<button type="button" class="btn-primario" id="btnAbrirOS">Abrir OS e gerar PDF &#10140;</button>' +
      '</div>' +

      '<div id="osFeedback" style="margin-top:1rem;"></div>' +
    '</form>';
}
```

- [ ] **Step 2: Testar renderização**

Recarregue. Vá para aba Assistencias.
Expected: formulário renderiza com todos os campos e botões. Nenhum erro no console.

- [ ] **Step 3: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/assistencia.js
git commit -m "feat(assistencia): UI do formulário de OS"
```

### Task 4.7: Implementar listeners (máscara telefone, limpar, submit)

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/assistencia.js`

- [ ] **Step 1: Implementar listeners**

Substitua o stub `setupListenersAssistencia()` por:

```javascript
function setupListenersAssistencia() {
  // Máscara telefone (copiada de formulario.js — sem import para manter isolamento)
  var telInput = document.getElementById('osTelefoneCliente');
  if (telInput) {
    telInput.addEventListener('input', function() {
      var v = this.value.replace(/\D/g, '');
      if (v.length > 11) v = v.substring(0, 11);
      if (v.length > 6) {
        if (v.length === 11) v = v.replace(/^(\d{2})(\d{5})(\d{0,4})$/, '($1) $2-$3');
        else v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
      } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
      }
      this.value = v;
    });
  }

  // Limpar
  var btnLimpar = document.getElementById('btnLimparOS');
  if (btnLimpar) {
    btnLimpar.addEventListener('click', function() {
      if (confirm('Limpar todos os campos?')) {
        document.getElementById('osForm').reset();
      }
    });
  }

  // Submit
  var btnAbrir = document.getElementById('btnAbrirOS');
  if (btnAbrir) {
    btnAbrir.addEventListener('click', submeterOS);
  }
}

function submeterOS() {
  // Scaffold intencional — implementação real na Task 4.8
  console.log('submit clicked (stub)');
}

function validarTelefoneOS(tel) {
  var digitos = tel.replace(/\D/g, '');
  return digitos.length >= 10 && digitos.length <= 11;
}

function mostrarFeedbackOS(msg, tipo) {
  var el = document.getElementById('osFeedback');
  if (!el) return;
  el.innerHTML = '<div class="toast toast-' + (tipo || 'info') + '" style="display:block;position:static;">' + msg + '</div>';
}
```

- [ ] **Step 2: Testar máscara e limpar**

Recarregue. Digite `11999999999` no telefone → vira `(11) 99999-9999`. Clique Limpar + OK → tudo vazio.

Expected: máscara funciona, limpar funciona.

- [ ] **Step 3: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/assistencia.js
git commit -m "feat(assistencia): listeners de máscara, limpar e stub de submit"
```

### Task 4.8: Implementar submit `submeterOS()`

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/assistencia.js`

- [ ] **Step 1: Substituir stub `submeterOS` pela implementação**

```javascript
function submeterOS() {
  if (submetendo) return;

  // Coleta
  var dados = {
    nomeCliente: (document.getElementById('osNomeCliente').value || '').trim(),
    telefoneCliente: (document.getElementById('osTelefoneCliente').value || '').replace(/\D/g, ''),
    cidade: (document.getElementById('osCidade').value || '').trim(),
    modelo: document.getElementById('osModelo').value,
    numeroChassi: (document.getElementById('osNumeroChassi').value || '').trim(),
    dataCompra: document.getElementById('osDataCompra').value,
    notaFiscalCompra: (document.getElementById('osNotaFiscal').value || '').trim(),
    tipo: (document.querySelector('input[name="osTipo"]:checked') || {}).value || '',
    assistencia: (document.getElementById('osAssistencia').value || '').trim(),
    problemaRelatado: (document.getElementById('osProblema').value || '').trim(),
    observacoes: (document.getElementById('osObservacoes').value || '').trim()
  };

  // Validações
  if (!dados.nomeCliente) return mostrarFeedbackOS('Informe o nome do cliente', 'erro');
  if (!validarTelefoneOS(dados.telefoneCliente)) return mostrarFeedbackOS('Telefone inválido', 'erro');
  if (!dados.cidade) return mostrarFeedbackOS('Informe a cidade', 'erro');
  if (!dados.modelo) return mostrarFeedbackOS('Selecione o modelo', 'erro');
  if (!dados.notaFiscalCompra) return mostrarFeedbackOS('Informe a NF de compra', 'erro');
  if (!dados.tipo) return mostrarFeedbackOS('Selecione o tipo (Garantia/Venda)', 'erro');
  if (!dados.assistencia) return mostrarFeedbackOS('Informe o nome da assistência', 'erro');
  if (!dados.problemaRelatado) return mostrarFeedbackOS('Informe o problema relatado', 'erro');

  // Data compra não pode ser futura
  if (dados.dataCompra) {
    var dc = new Date(dados.dataCompra);
    var hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    if (dc > hoje) return mostrarFeedbackOS('Data de compra não pode ser futura', 'erro');
  }

  submetendo = true;
  var btn = document.getElementById('btnAbrirOS');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  mostrarFeedbackOS('Abrindo OS...', 'info');

  var payload = Object.assign({ action: 'registrar_os' }, dados);

  fetch(resolverUrl(), {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }  // Apps Script aceita text/plain sem CORS preflight
  })
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (resp && resp.sucesso) {
        mostrarFeedbackOS('OS ' + resp.numeroOS + ' aberta com sucesso!', 'sucesso');
        gerarPDFAssistencia(Object.assign({}, dados, { numeroOS: resp.numeroOS, dataAbertura: new Date() }));
      } else {
        mostrarFeedbackOS('Erro: ' + (resp && resp.erro ? resp.erro : 'resposta inválida do servidor'), 'erro');
      }
    })
    .catch(function(err) {
      mostrarFeedbackOS('Erro de rede: ' + err.message, 'erro');
    })
    .finally(function() {
      submetendo = false;
      btn.disabled = false;
      btn.textContent = 'Abrir OS e gerar PDF \u2794';
    });
}

function gerarPDFAssistencia(dados) {
  // Scaffold intencional — implementação real na Task 4.9
  console.log('gerar PDF (stub):', dados);
}
```

- [ ] **Step 2: Testar submit — caminho feliz**

Recarregue. Preencha o formulário com dados válidos. Clique "Abrir OS".

Expected: mensagem de sucesso com número `OS-2026-XXXX`. Planilha AssistenciasTecnicas recebe uma linha. Console mostra `gerar PDF: {...}` (ainda sem PDF real).

- [ ] **Step 3: Testar validações**

Esvazie cada campo obrigatório um por um e tente submeter. Cada um deve bloquear com mensagem específica.

Expected: validações bloqueiam submit.

- [ ] **Step 4: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/assistencia.js
git commit -m "feat(assistencia): submit com validações + POST para Apps Script"
```

### Task 4.9: Implementar `gerarPDFAssistencia()`

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/assistencia.js`

- [ ] **Step 1: Substituir stub `gerarPDFAssistencia`**

```javascript
function gerarPDFAssistencia(dados) {
  var win = window.open('', '_blank');
  if (!win) {
    mostrarFeedbackOS('Pop-up bloqueado — libere pop-ups para gerar o PDF', 'erro');
    return;
  }

  var dataAberturaStr = formatarDataBR(dados.dataAbertura || new Date());
  var dataCompraStr = dados.dataCompra ? formatarDataBR(dados.dataCompra) : '-';
  var telFmt = formatarTelefone(dados.telefoneCliente);

  var html = '' +
  '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
  '<title>' + dados.numeroOS + ' - ' + dados.nomeCliente + '</title>' +
  '<style>' +
  '@page { size: A4; margin: 12mm; }' +
  'body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; }' +
  '.header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #111; padding-bottom:6mm; margin-bottom:6mm; }' +
  '.logo { font-size:18pt; font-weight:bold; letter-spacing:2px; }' +
  '.os-id { font-size:14pt; font-weight:bold; }' +
  '.titulo-principal { text-align:center; font-size:14pt; font-weight:bold; margin:4mm 0; letter-spacing:1px; }' +
  '.section { margin-bottom:5mm; border:1px solid #999; }' +
  '.section-title { background:#222; color:#fff; padding:2mm 3mm; font-weight:bold; font-size:10pt; letter-spacing:1px; }' +
  '.section-body { padding:3mm; }' +
  '.row { display:flex; gap:6mm; margin-bottom:1.5mm; }' +
  '.row > div { flex:1; }' +
  '.lbl { font-weight:bold; font-size:9pt; color:#444; margin-right:3mm; }' +
  '.val { font-size:11pt; }' +
  '.blank-line { border-bottom:1px solid #000; min-height:6mm; display:block; margin:1mm 0; }' +
  '.problema-box { min-height:18mm; padding:2mm; border:1px solid #ccc; background:#fafafa; white-space:pre-wrap; }' +
  '.assist-section-title { background:#777; color:#fff; padding:2mm 3mm; font-weight:bold; font-size:10pt; letter-spacing:1px; text-align:center; margin-top:6mm; }' +
  '.pecas-table { width:100%; border-collapse:collapse; margin-top:2mm; }' +
  '.pecas-table td { border-bottom:1px solid #000; height:7mm; padding:0 2mm; font-size:10pt; }' +
  '.sig-row { display:flex; gap:8mm; margin-top:10mm; }' +
  '.sig-block { flex:1; text-align:center; }' +
  '.sig-line { border-top:1px solid #000; padding-top:1mm; font-size:9pt; margin-top:12mm; }' +
  '.rodape { text-align:center; font-size:8pt; color:#666; margin-top:6mm; }' +
  '</style></head><body>' +

  '<div class="header">' +
    '<div class="logo">NXT</div>' +
    '<div style="text-align:right;">' +
      '<div class="os-id">Nº OS: ' + dados.numeroOS + '</div>' +
      '<div style="font-size:9pt;">Data: ' + dataAberturaStr + '</div>' +
    '</div>' +
  '</div>' +

  '<div class="titulo-principal">ORDEM DE SERVIÇO — ASSISTÊNCIA TÉCNICA</div>' +

  '<div class="section">' +
    '<div class="section-title">CLIENTE</div>' +
    '<div class="section-body">' +
      '<div class="row"><div><span class="lbl">Nome:</span> ' + escapeHtml(dados.nomeCliente) + '</div></div>' +
      '<div class="row">' +
        '<div><span class="lbl">Telefone:</span> ' + telFmt + '</div>' +
        '<div><span class="lbl">Cidade:</span> ' + escapeHtml(dados.cidade) + '</div>' +
      '</div>' +
    '</div>' +
  '</div>' +

  '<div class="section">' +
    '<div class="section-title">EQUIPAMENTO</div>' +
    '<div class="section-body">' +
      '<div class="row">' +
        '<div><span class="lbl">Modelo:</span> ' + escapeHtml(dados.modelo) + '</div>' +
        '<div><span class="lbl">Nº Chassi:</span> ' + escapeHtml(dados.numeroChassi || '-') + '</div>' +
      '</div>' +
      '<div class="row">' +
        '<div><span class="lbl">Data compra:</span> ' + dataCompraStr + '</div>' +
        '<div><span class="lbl">NF compra:</span> ' + escapeHtml(dados.notaFiscalCompra) + '</div>' +
      '</div>' +
    '</div>' +
  '</div>' +

  '<div class="section">' +
    '<div class="section-title">ATENDIMENTO</div>' +
    '<div class="section-body">' +
      '<div class="row"><div><span class="lbl">Tipo:</span> <strong>' + dados.tipo.toUpperCase() + '</strong></div></div>' +
      '<div class="row"><div><span class="lbl">Assistência:</span> ' + escapeHtml(dados.assistencia) + '</div></div>' +
    '</div>' +
  '</div>' +

  '<div class="section">' +
    '<div class="section-title">PROBLEMA RELATADO PELO CLIENTE</div>' +
    '<div class="section-body">' +
      '<div class="problema-box">' + escapeHtml(dados.problemaRelatado) + '</div>' +
    '</div>' +
  '</div>' +

  '<div class="assist-section-title">═══ A SER PREENCHIDO PELA ASSISTÊNCIA ═══</div>' +

  '<div class="section">' +
    '<div class="section-title">LAUDO TÉCNICO</div>' +
    '<div class="section-body">' +
      '<span class="blank-line"></span>' +
      '<span class="blank-line"></span>' +
      '<span class="blank-line"></span>' +
    '</div>' +
  '</div>' +

  '<div class="section">' +
    '<div class="section-title">PEÇAS UTILIZADAS</div>' +
    '<div class="section-body">' +
      '<table class="pecas-table">' +
        '<tr><td style="width:75%;">1.</td><td>Qtd:</td></tr>' +
        '<tr><td>2.</td><td>Qtd:</td></tr>' +
        '<tr><td>3.</td><td>Qtd:</td></tr>' +
        '<tr><td>4.</td><td>Qtd:</td></tr>' +
      '</table>' +
    '</div>' +
  '</div>' +

  '<div class="section">' +
    '<div class="section-title">SERVIÇO EXECUTADO</div>' +
    '<div class="section-body">' +
      '<span class="blank-line"></span>' +
      '<span class="blank-line"></span>' +
    '</div>' +
  '</div>' +

  '<div class="row" style="margin-top:4mm;">' +
    '<div><span class="lbl">Data conclusão:</span> ___/___/______</div>' +
    '<div><span class="lbl">Valor cobrado:</span> R$ _______________</div>' +
  '</div>' +

  '<div class="sig-row">' +
    '<div class="sig-block"><div class="sig-line">Assinatura Técnico</div></div>' +
    '<div class="sig-block"><div class="sig-line">Assinatura Cliente</div></div>' +
  '</div>' +

  '<div class="rodape">NXT Mobilidade Elétrica &bull; OS ' + dados.numeroOS + ' gerada em ' + dataAberturaStr + '</div>' +

  '</body></html>';

  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(function() { try { win.print(); } catch(e){} }, 400);
}

function formatarDataBR(d) {
  if (!d) return '-';
  var dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  var dd = String(dt.getDate()).padStart(2, '0');
  var mm = String(dt.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm + '/' + dt.getFullYear();
}

function formatarTelefone(tel) {
  var d = (tel || '').replace(/\D/g, '');
  if (d.length === 11) return '(' + d.substr(0,2) + ') ' + d.substr(2,5) + '-' + d.substr(7);
  if (d.length === 10) return '(' + d.substr(0,2) + ') ' + d.substr(2,4) + '-' + d.substr(6);
  return tel || '-';
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
```

- [ ] **Step 2: Testar geração do PDF end-to-end**

Preencha o form, submeta. Pop-up abre com PDF formatado. Imprima ou salve como PDF.

Expected: PDF tem todas as seções, campos preenchidos do cliente, e campos em branco para assistência preencher.

- [ ] **Step 3: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/assistencia.js
git commit -m "feat(assistencia): geração de PDF com campos para assistência preencher"
```

### Task 4.10: Teste E2E da feature Assistência

**Files:** nenhuma mudança — apenas teste.

- [ ] **Step 1: Teste caminho feliz completo**

1. Home → clique "🔧 Abrir OS Assistencia".
2. Preencha: Nome "João Silva", Tel "11999999999", Cidade "Sumaré", Modelo "Kay", NF "123", Tipo "Garantia", Assistência "Oficina ABC", Problema "Moto não liga".
3. Clique "Abrir OS".
4. Confirme feedback de sucesso com número OS-2026-XXXX.
5. PDF abre em nova aba.

Expected: tudo funciona.

- [ ] **Step 2: Verificar planilha**

Abra a planilha Google Sheets → aba AssistenciasTecnicas.
Expected: linha recém-criada com todos os dados corretos + STATUS="Em andamento", NF ASSISTENCIA RECEBIDA="Não", PAGAMENTO FEITO="Não".

- [ ] **Step 3: Teste de concorrência (simulado)**

Abra duas abas do sistema. Em cada uma, abra o formulário Assistência e preencha. Clique "Abrir OS" em ambas quase simultaneamente.
Expected: duas linhas na planilha com OSs **diferentes** (ex: OS-2026-0002 e OS-2026-0003). Sem duplicatas.

- [ ] **Step 4: Regressão — pedido de peças normal ainda funciona**

Na aba "Registrar" (formulário de peças), faça um pedido de peças fictício (use CNPJ válido e 1 peça, sem mão de obra).
Expected: pedido é registrado, aparece na aba PEDIDOS, chega ao Bling (verificar em "BLING STATUS" e "BLING PEDIDO ID" na planilha).

- [ ] **Step 5: Commit "done" (se necessário — marco)**

Se houve ajustes durante os testes, commit. Se não, pule esta step.

---

## ENTREGA 2 — Item "Mão de obra" rateada no Bling

### Task 2.1: Adicionar item global "Mão de obra" em `data.js`

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/data.js`

- [ ] **Step 1: Adicionar lista de itens globais no final do arquivo**

No final de `data.js`, após o fechamento de `CATALOGO_MODELOS`:

```javascript
// Itens globais — disponíveis para qualquer modelo
const ITENS_GLOBAIS = [
  {
    nome: "Mão de obra",
    preco: 0,  // editável pelo usuário ao adicionar
    peso: "0gr",
    img: "",
    precoEditavel: true,
    isMaoDeObra: true
  }
];
```

- [ ] **Step 2: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/data.js
git commit -m "feat(data): adicionar ITENS_GLOBAIS com Mão de obra"
```

### Task 2.2: Integrar "Mão de obra" no form de peças com preço editável

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/formulario.js`

Referências exatas:
- `popularDatalistPecas(modelId)` — linha 516
- `encontrarPecaSelecionada()` — linha 532
- `preencherDadosPeca()` — linha 549
- `adicionarPeca()` — linha 608

- [ ] **Step 1: Adicionar ITENS_GLOBAIS ao datalist em `popularDatalistPecas`**

Substitua a função inteira `popularDatalistPecas` (linha 516-529) por:

```javascript
function popularDatalistPecas(modelId) {
  var datalist = document.getElementById('listaPecasDatalist');
  if (!datalist) return;
  datalist.innerHTML = '';

  if (modelId && CATALOGO_MODELOS[modelId]) {
    var pecas = CATALOGO_MODELOS[modelId].pecas;
    pecas.forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p.nome;
      datalist.appendChild(opt);
    });
  }

  // Itens globais (ex: Mão de obra) — disponíveis em qualquer modelo
  if (typeof ITENS_GLOBAIS !== 'undefined') {
    ITENS_GLOBAIS.forEach(function(item) {
      var opt = document.createElement('option');
      opt.value = item.nome;
      datalist.appendChild(opt);
    });
  }
}
```

- [ ] **Step 2: Modificar `encontrarPecaSelecionada` para incluir itens globais**

Substitua a função (linha 532-546) por:

```javascript
function encontrarPecaSelecionada() {
  var modelId = document.getElementById('modeloMoto').value;
  var nome = document.getElementById('descricaoPeca').value.trim();
  if (!nome) return null;

  // Primeiro, procurar nos itens globais (independente de modelo)
  if (typeof ITENS_GLOBAIS !== 'undefined') {
    for (var g = 0; g < ITENS_GLOBAIS.length; g++) {
      if (ITENS_GLOBAIS[g].nome.toLowerCase() === nome.toLowerCase()) {
        return Object.assign({}, ITENS_GLOBAIS[g]);
      }
    }
  }

  if (!modelId || !CATALOGO_MODELOS[modelId]) return null;

  var pecas = CATALOGO_MODELOS[modelId].pecas;
  for (var i = 0; i < pecas.length; i++) {
    if (pecas[i].nome.toLowerCase() === nome.toLowerCase()) {
      return pecas[i];
    }
  }
  return null;
}
```

- [ ] **Step 3: Ajustar `preencherDadosPeca` para deixar preço editável quando `precoEditavel`**

Em `preencherDadosPeca` (linha 549), após o bloco que calcula `preco` (linha 562-571), adicione antes do bloco de `Weight`:

```javascript
  // Se o item é de preço editável (ex: Mão de obra), deixar campo vazio e focado
  if (peca.precoEditavel) {
    precoInput.value = '';
    precoInput.placeholder = 'Informe o valor (R$)';
    precoInput.readOnly = false;
    precoInput.focus();
  } else {
    precoInput.placeholder = '';
    precoInput.readOnly = false;
  }
```

> Razão: em vez de usar `prompt()`, reaproveitamos o campo de preço existente no form. Usuário digita o valor normalmente.

- [ ] **Step 4: Propagar flag `isMaoDeObra` em `adicionarPeca`**

Em `adicionarPeca` (linha 608), logo após a linha `var pesoGramas = parseWeight(pesoTexto);` (linha 627), adicione uma recuperação do flag:

```javascript
  // Detectar se é item global isMaoDeObra
  var pecaBase = encontrarPecaSelecionada();
  var isMaoDeObra = !!(pecaBase && pecaBase.isMaoDeObra);
```

Depois, no objeto `peca` (linha 637-650), adicione o campo:

```javascript
  var peca = {
    id: Date.now(),
    modelId: modelId,
    modelo: modelNome,
    descricao: descricao,
    cor: cor,
    tipoPreco: tipoPreco,
    quantidade: qtd,
    precoUnitario: preco,
    total: preco * qtd,
    peso: pesoTexto,
    pesoGramas: pesoGramas * qtd,
    img: imgSrc,
    isMaoDeObra: isMaoDeObra   // <-- NOVO
  };
```

- [ ] **Step 5: Testar adicionar Mão de obra**

1. Recarregue a página. Aba "Registrar".
2. Selecione um modelo (ex: Kay).
3. No campo "Peça", digite "Mão de obra" (deve autocompletar via datalist).
4. Campo preço fica vazio com placeholder "Informe o valor (R$)".
5. Digite `60,00`. Qtd: 1.
6. Clique "+ Adicionar Peça".

Expected: linha aparece no carrinho com descrição "Mão de obra", modelo do Kay, preço R$ 60,00.

- [ ] **Step 6: Testar peça normal ainda funciona**

Adicione uma peça normal (ex: Acelerador de punho). Preço deve preencher automaticamente com R$ 125,00 do catálogo.

Expected: regressão ok — comportamento original preservado.

- [ ] **Step 7: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/formulario.js
git commit -m "$(cat <<'EOF'
feat(form): suporte a item Mão de obra com valor editável

Integra ITENS_GLOBAIS (data.js) no datalist e na busca de
peças. Campo preço fica vazio para o usuário digitar valor.
Flag isMaoDeObra é propagado para o carrinho — será usado
pelo Apps Script no rateio ao enviar para o Bling.

Constraint: não afetar o fluxo de peças normais
Confidence: high
Scope-risk: narrow
EOF
)"
```

### Task 2.3: Validação "Mão de obra não vai sozinha"

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/formulario.js`

- [ ] **Step 1: Adicionar validação no submit**

Na função `registrarVenda` (client side — aproximadamente linha 870 em `formulario.js`), após a validação `if (pecasAdicionadas.length === 0) ...`, adicione:

```javascript
// Mão de obra não pode ir sozinha para o Bling (rateio precisa de produto base)
var produtosNoCarrinho = pecasAdicionadas.filter(function(p) { return !p.isMaoDeObra; });
var maoDeObraNoCarrinho = pecasAdicionadas.filter(function(p) { return p.isMaoDeObra; });
if (maoDeObraNoCarrinho.length > 0 && produtosNoCarrinho.length === 0) {
  mostrarFeedback('Adicione ao menos uma peça junto com a mão de obra', 'erro');
  return;
}
```

- [ ] **Step 2: Testar bloqueio**

No formulário, adicione apenas "Mão de obra" (nada mais). Tente submeter.
Expected: mensagem "Adicione ao menos uma peça junto com a mão de obra" — submit bloqueado.

- [ ] **Step 3: Testar caso válido**

Adicione 1 produto normal + 1 Mão de obra. Tente submeter (preencha campos obrigatórios).
Expected: passa da validação (vai até o envio).

- [ ] **Step 4: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/formulario.js
git commit -m "feat(form): bloquear submit com apenas Mão de obra"
```

### Task 2.4: Implementar `ratearMaoDeObra()` no Apps Script

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/google-apps-script.js`

- [ ] **Step 1: Adicionar função pura antes de `enviarPedidoBling`**

Em `google-apps-script.js`, antes da linha 393 (`function enviarPedidoBling`):

```javascript
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
      produtos.push(Object.assign({}, pecas[i]));  // clone raso
    }
  }

  if (valorMaoObra <= 0) return produtos;  // sem mão de obra, intocado

  if (produtos.length === 0) {
    throw new Error('Pedido não pode conter apenas mão de obra');
  }

  // Total atual dos produtos
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

  // Inflar cada produto (menos o último)
  for (var k = 0; k < produtos.length - 1; k++) {
    var novoPreco = Math.round(produtos[k].precoUnitario * fator * 100) / 100;
    produtos[k].precoUnitario = novoPreco;
    totalCalculado += novoPreco * (parseInt(produtos[k].quantidade) || 1);
  }

  // Último produto absorve o residual para bater total exato
  var ultimo = produtos[produtos.length - 1];
  var qtdUltimo = parseInt(ultimo.quantidade) || 1;
  var valorRestante = totalAlvo - totalCalculado;
  var novoPrecoUltimo = Math.round((valorRestante / qtdUltimo) * 100) / 100;
  ultimo.precoUnitario = novoPrecoUltimo;

  return produtos;
}
```

- [ ] **Step 2: Criar função de teste**

Adicione temporariamente:

```javascript
function testarRatearMaoDeObra() {
  var entrada = [
    { descricao: 'Acelerador', precoUnitario: 125, quantidade: 1, isMaoDeObra: false },
    { descricao: 'Alça',       precoUnitario: 115, quantidade: 1, isMaoDeObra: false },
    { descricao: 'Mão de obra', precoUnitario: 60, quantidade: 1, isMaoDeObra: true }
  ];
  var saida = ratearMaoDeObra(entrada);
  Logger.log('entrada total: ' + (125 + 115 + 60));
  Logger.log('saida: ' + JSON.stringify(saida));
  var total = saida.reduce(function(s, p) { return s + p.precoUnitario * p.quantidade; }, 0);
  Logger.log('saida total: ' + total);
}
```

Execute `testarRatearMaoDeObra`.
Expected:
- Saída tem 2 produtos (sem mão de obra).
- Preços foram inflados: Acelerador ≈ 156.25, Alça ≈ 143.75.
- Soma dos preços = 300.00 (casa com o total original 240 + 60).

- [ ] **Step 3: Teste edge case — sem mão de obra**

```javascript
function testarSemMaoDeObra() {
  var entrada = [
    { descricao: 'Peça A', precoUnitario: 100, quantidade: 2, isMaoDeObra: false }
  ];
  var saida = ratearMaoDeObra(entrada);
  Logger.log(JSON.stringify(saida));
}
```

Expected: saída idêntica à entrada — preço 100, qtd 2.

- [ ] **Step 4: Teste edge case — só mão de obra (deve lançar)**

```javascript
function testarSoMaoDeObra() {
  var entrada = [
    { descricao: 'Mão de obra', precoUnitario: 50, quantidade: 1, isMaoDeObra: true }
  ];
  try {
    ratearMaoDeObra(entrada);
    Logger.log('ERRO: deveria ter lançado exception');
  } catch (e) {
    Logger.log('OK: lançou ' + e.message);
  }
}
```

Expected: log "OK: lançou Pedido não pode conter apenas mão de obra".

- [ ] **Step 5: Deletar funções de teste**

Delete `testarRatearMaoDeObra`, `testarSemMaoDeObra`, `testarSoMaoDeObra`.

- [ ] **Step 6: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/google-apps-script.js
git commit -m "feat(apps-script): ratearMaoDeObra distribui valor entre produtos"
```

### Task 2.5: Integrar rateio em `enviarPedidoBling`

**Files:**
- Modify: `C:/dev/NXT/ativos/sac-pecas/google-apps-script.js`

- [ ] **Step 1: Modificar `enviarPedidoBling` para chamar rateio antes do loop**

Em `google-apps-script.js` linha 410-412 (início do bloco "2. Montar itens do pedido"):

**Antes:**
```javascript
// 2. Montar itens do pedido (com mapeamento fiscal da Claudia Pecas)
var itens = [];
var pecas = dados.pecas || [];
```

**Depois:**
```javascript
// 2. Montar itens do pedido (com mapeamento fiscal da Claudia Pecas)
var itens = [];
var pecas = dados.pecas || [];

// 2.0 Rateio de mão de obra — absorve valor do serviço nos produtos
try {
  pecas = ratearMaoDeObra(pecas);
} catch (err) {
  throw new Error('Erro no rateio de mão de obra: ' + err.message);
}
```

> **Directive:** NÃO remover a propagação do erro. Se o rateio falhar, o pedido não deve ir para o Bling com valores errados.

- [ ] **Step 2: Deployar nova versão do Apps Script**

No editor: `Deploy > Manage deployments > Edit > Nova versão > Deploy`.
Expected: URL não muda.

- [ ] **Step 3: Commit**

```bash
git add C:/dev/NXT/ativos/sac-pecas/google-apps-script.js
git commit -m "feat(apps-script): aplicar ratearMaoDeObra antes de montar itens do Bling"
```

### Task 2.6: Testes de regressão completos

**Files:** nenhuma mudança — apenas testes.

- [ ] **Step 1: Cenário A — pedido sem mão de obra (REGRESSÃO)**

No sistema: faça pedido de 1 peça (ex: Acelerador R$ 125). Submeta.

Expected:
- Planilha PEDIDOS registra normalmente.
- Bling recebe pedido com preço unitário = R$ 125,00 (inalterado).
- Coluna "BLING STATUS" da planilha mostra sucesso e "BLING PEDIDO ID" é preenchida.

- [ ] **Step 2: Cenário B — produtos + mão de obra**

Pedido: Acelerador R$ 125 + Alça R$ 115 + Mão de obra R$ 60. Total exibido = R$ 300.

Submeta.

Expected:
- Planilha PEDIDOS mostra 3 itens (inclusive Mão de obra) e total R$ 300.
- No Bling, o pedido tem **2 produtos** (sem mão de obra) com preços inflados: ~156,25 e ~143,75.
- Total do pedido no Bling = R$ 300,00.

Verificação: abrir o pedido no painel do Bling e conferir valores unitários.

- [ ] **Step 3: Cenário C — mão de obra zerada**

Pedido: Acelerador R$ 125 + Mão de obra R$ 0.

Se o form permitir R$ 0 para mão de obra, submeta; senão, pule este teste.

Expected: pedido vai para o Bling com Acelerador R$ 125 (rateio de 0 não muda nada).

- [ ] **Step 4: Cenário D — só mão de obra (bloqueado client-side)**

Formulário: tente adicionar apenas Mão de obra e submeter.

Expected: mensagem "Adicione ao menos uma peça junto com a mão de obra" — não chega a chamar o servidor.

- [ ] **Step 5: Cenário E — rateio com resíduo de centavos**

Pedido: 3 produtos R$ 33,33 cada + Mão de obra R$ 0,01. Total = R$ 100,00.
Fator = 100 / 99.99 = 1.0001...
Produtos inflados: 33.33 × 1.0001 ≈ 33.33. Último absorve residual.

Submeta e verifique no Bling.

Expected: total bate exatamente R$ 100,00 (não R$ 99,99 nem R$ 100,01).

- [ ] **Step 6: Regressão final do form de peças**

Crie um pedido real completo (sem mão de obra, com CNPJ válido) seguindo o fluxo normal da equipe.

Expected: pedido chega ao Bling normalmente; planilha PEDIDOS atualiza; NFe gera sem divergências.

- [ ] **Step 7: Commit (se ajustes foram necessários durante os testes)**

```bash
git commit -m "chore: ajustes após testes E2E" # se aplicável
```

---

## Entrega final: Consolidação

### Task Z.1: Limpeza e verificação

- [ ] **Step 1: Remover backup tag se tudo estiver ok**

Depois de 1-2 semanas em produção sem incidentes, pode remover a tag:

```bash
git tag -d backup-before-assistencia-feature
```

Se quiser mantê-la, deixe.

- [ ] **Step 2: Atualizar GUIA-USO.md**

Verifique se faz sentido adicionar uma seção no `GUIA-USO.md` sobre a nova feature Assistência Técnica.

- [ ] **Step 3: Commit de docs se atualizou GUIA-USO**

```bash
git add C:/dev/NXT/ativos/sac-pecas/GUIA-USO.md
git commit -m "docs: adicionar seção Assistência Técnica no guia de uso"
```

---

## Critérios de Aceitação Geral

- [ ] CNPJ: formulário de peças aceita 3 CNPJs válidos sem erro.
- [ ] PDF de peças: nova seção "Dados da Coleta" aparece na folha 1.
- [ ] Home: botão "🔧 Abrir OS Assistencia" aparece e navega corretamente.
- [ ] Nav: aba "🔧 Assistencias" aparece e funciona.
- [ ] Form Assistência: gera OS, grava planilha, abre PDF.
- [ ] PDF Assistência: tem seções em branco para assistência preencher.
- [ ] Planilha: aba `AssistenciasTecnicas` tem as 16 colunas, valores defaults corretos.
- [ ] LockService: duas submits simultâneas geram OSs diferentes.
- [ ] Mão de obra: item aparece no autocomplete; preço editável; somente com produto é aceito.
- [ ] Bling: pedido sem mão de obra → preços inalterados.
- [ ] Bling: pedido com mão de obra → produtos inflados proporcionalmente, total = valor pago.
- [ ] Bling: pedido com resíduo de centavos → total exato preservado pelo ajuste no último item.
- [ ] Regressão: pedido de peças padrão continua chegando ao Bling normalmente.

---

## Notas finais

- **Ordem:** executar entregas na ordem 1 → 3 → 4 → 2. A 2 fica por último porque é a que mexe no fluxo do Bling.
- **Commits frequentes:** cada Task deve terminar num commit. Rollback fica fácil.
- **Apps Script:** requer deploy manual após cada conjunto de mudanças. Não esquecer de fazer deploy de nova versão (não basta salvar).
- **Testes em produção:** todos os testes envolvem Bling em produção. Usar pedidos claramente marcados como teste ("PCA-TESTE-001" por exemplo) e cancelá-los depois.
- **Backup:** a tag `backup-before-assistencia-feature` é o ponto de rollback total.
