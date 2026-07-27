# Reorganização do SAC Pós-Venda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer com que tudo sobre um atendimento viva num lugar só — OS encontrável, status alterável pela equipe, vínculo automático — e tirar o SAC de cima da planilha da expedição.

**Architecture:** O SAC hoje é um Apps Script preso (`bound`) à planilha "Pedido de peças". Três objetos (atendimento `PV-`, ordem de serviço `OS-`, pedido de peças) vivem em abas da mesma planilha e não se enxergam. O plano ataca em 5 fases: primeiro para a dor sem migrar nada (busca, tela de OS, vínculo), depois unifica o histórico de OS, depois separa a caixa de entrada automática, depois desmembra as planilhas seguindo o padrão já provado do `getOrcamentosSheet()` (abrir por ID via ScriptProperty), e por fim ensina a equipe.

**Tech Stack:** Google Apps Script (backend, arquivo único `google-apps-script.js` ~169 KB) · HTML/CSS/JS vanilla em IIFEs (front, GitHub Pages) · Google Sheets como banco · Node.js `node:test` para as funções puras · Python 3 + `curl` para smoke tests ao vivo.

## Global Constraints

- **Planilha viva (expedição):** `1QtumxGgKwzWBQBPISfDFjH3qGboiT3_1x5gbxl6R6ns` — dona `nxt.lojas@gmail.com`, 3,78 MB. É a `getActiveSpreadsheet()` do script.
- **Planilha de orçamentos (já separada em 21/07):** `1HoYsY9rQKZnJv91z_gJ-5_phKSo8L0Xci7MraByObZw`.
- **URL do web app (NÃO pode mudar):** `https://script.google.com/macros/s/AKfycbytZgFvvhTvYRgufyvFTGbMb27sxHnIQp256XQ6r7VZuX2B0RTdO3MIpbf4EcF8KgnYlw/exec`
- **Deploy backend:** colar o `google-apps-script.js` inteiro no editor do Apps Script → *Implantar → Gerenciar implantações → editar → Nova versão*. Mantém a URL. Versão atual: **v42**.
- **Conta do deploy:** `nxt.lojas` (u/0, a padrão do Chrome NXT). **A fonte confiável da conta é o botão de conta do Google** (`aria-label="Conta do Google: NXT Lojas (nxt.lojas@gmail.com)"`) — NUNCA ler e-mail solto na página (deu falso-positivo em 22/07 e custou tempo).
- **Deploy front:** `git push` na branch `master` publica no GitHub Pages (`nxtlojas-hash.github.io/sac-pecas`, ~1 min).
- **Cache-busting:** todo deploy de front sobe o `?v=` em `index.html` (hoje `v2.35`) — nos 12 `<script>` e no `<link>` do CSS.
- **Regra de ouro dos dados:** nunca reescrever a planilha inteira. Só `appendRow` e `setValue` em célula/intervalo específico. Antes de qualquer migração, **cópia da planilha** (Arquivo → Fazer uma cópia) com a data no nome.
- **NADA É APAGADO NEM RENOMEADO — aba que sai de uso é OCULTADA** (decisão dela, 27/07). Renomear aba foi a causa do incidente de 06/07: o script recriou uma vazia, a numeração de OS voltou ao 0001 e duplicou 93 números que ainda hoje dão trabalho. Ocultar preserva nome e conteúdo.
- **Toda substituição de fonte de dados é dual-write, nunca corte** (decisão dela, 27/07): o novo nasce ao lado do velho, os dois recebem gravação, a leitura vira depois, e o velho só para quando o novo estiver provado. O rollback é sempre voltar uma flag, nunca restaurar backup.
- **Idempotência:** toda rotina de migração roda sob `LockService` e grava uma flag em `DocumentProperties` (padrão do `setupRoteamentoOsV1`), para uma segunda execução não duplicar.
- **Texto visível ao usuário:** pt-BR. Nomes internos de função/variável seguem o estilo do arquivo (sem acento, camelCase, helpers com `_` no fim).
- **Esta sessão NÃO escreve em `C:\dev\NXT\PAINEL-NXT.md`** — outra sessão ("organizar panorama") é dona dele. O delta do SAC é entregue em texto no fim.
- **Prazo concorrente:** o webhook Meta → respond.io vence **05/08/2026**. Não é deste plano, mas se o WhatsApp cair, o pull que alimenta a caixa de entrada para junto.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `google-apps-script.js` | backend inteiro (arquivo único, imposto pelo Apps Script) | Modificar |
| `assistencia.js` | hoje **só** o formulário de abertura de OS | Modificar (ganha lista/busca/status) |
| `os-lista.js` | **novo** — tela de OS: lista, busca por número, avanço de status | Criar |
| `caixa-entrada.js` | **novo** — triagem das mensagens automáticas do Respond.io | Criar |
| `atendimentos-lista.js` | lista de atendimentos `PV-` | Modificar (mostra OS vinculada) |
| `index.html` | nav + containers das views | Modificar (2 abas novas, bump `?v=`) |
| `lib/os-numero.js` | **novo** — funções puras de numeração/desambiguação de OS | Criar |
| `lib/triagem.js` | **novo** — função pura de classificação da caixa de entrada | Criar |
| `tests/os-numero.test.js` | **novo** — testes Node de `lib/os-numero.js` | Criar |
| `tests/triagem.test.js` | **novo** — testes Node de `lib/triagem.js` | Criar |

⚠️ **Os arquivos de `lib/` rodam nos TRÊS lugares:** Node (testes), navegador (o front chama
`pareceNumeroOS` e `podeAssistenciaMover`) e Apps Script (colados no arquivo único, sem o
`module.exports`). Por isso são ES5 puro — nada de `let`, `const`, arrow function ou template
string. **Cada um precisa de um `<script>` em `index.html`**, antes dos módulos que os usam.
| `docs/GUIA-SAC-EQUIPE.md` | **novo** — o guia que a equipe recebe | Criar |

**Por que funções puras + teste em Node:** o Apps Script não roda local e o assistente não loga no navegador para testar UI. O padrão que funcionou na logística (26/07) é extrair a lógica de decisão para funções puras, testá-las em Node, e deixar no Apps Script só a parte que toca a planilha. Toda função pura deste plano é escrita para rodar nos dois ambientes (ES5, sem `let/const/arrow`).

---

## Task 0: Inventário ao vivo das abas

**Por que primeiro:** o plano move dados entre planilhas. Ninguém migra uma planilha de 3,78 MB sem saber quantas abas ela tem e quantas linhas cada uma carrega. O código referencia 18 abas, mas a equipe cria abas à mão (a `ASSISTÊNCIA SUMARÉ` é uma delas) — o número real é desconhecido.

**Files:**
- Modify: `google-apps-script.js` (adicionar action `inventario_abas` no `doGet`, ~linha 900)

**Interfaces:**
- Produces: `inventarioAbas()` → `{ok:true, planilha:{id, nome, totalAbas}, abas:[{nome, linhas, colunas, registros, primeiraLinha:[...]}]}`. As Tasks 5 e 8 consomem essa saída para saber o que existe.

⚠️ **Use exatamente estes nomes de campo.** `registros` é `linhas - 1` (desconta o cabeçalho) e é o número que interessa para dimensionar migração; `linhas` é o bruto. Uma versão anterior deste bloco listava `tamanhoAbas` e `ultimaColunaComDado` — campos que **não existem** no retorno. Corrigido em 27/07 depois da revisão da Task 0; se você está lendo um brief com os nomes antigos, este bloco manda.

- [ ] **Step 1: Escrever a função (read-only, não altera nada)**

Adicionar antes de `function doGet(e) {` (linha ~820):

```javascript
// ========================================
// DIAGNOSTICO (read-only) — inventario das abas da planilha ativa.
// GET ?action=inventario_abas — nao altera nada. Usado para planejar a
// separacao das planilhas (plano 2026-07-27).
// ========================================
function inventarioAbas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abas = ss.getSheets();
  var out = [];
  for (var i = 0; i < abas.length; i++) {
    var a = abas[i];
    var linhas = a.getLastRow();
    var cols = a.getLastColumn();
    var cabecalho = [];
    if (linhas >= 1 && cols >= 1) {
      cabecalho = a.getRange(1, 1, 1, Math.min(cols, 30)).getValues()[0].map(function(c) {
        return String(c || '').slice(0, 40);
      });
    }
    out.push({
      nome: a.getName(),
      linhas: linhas,
      colunas: cols,
      registros: Math.max(0, linhas - 1),
      primeiraLinha: cabecalho
    });
  }
  return {
    ok: true,
    planilha: { id: ss.getId(), nome: ss.getName(), totalAbas: abas.length },
    abas: out
  };
}
```

- [ ] **Step 2: Rotear a action**

Em `doGet`, no bloco de `switch (action)`, junto das outras actions read-only (perto de `case 'status_publico':`, linha ~900):

```javascript
      case 'inventario_abas':
        return jsonResponse(inventarioAbas());
```

- [ ] **Step 3: Deployar o backend**

Colar o arquivo no editor do Apps Script (conta `nxt.lojas`, conferida pelo botão de conta) → Nova versão → **v43**.

- [ ] **Step 4: Rodar e guardar a saída**

```bash
U='https://script.google.com/macros/s/AKfycbytZgFvvhTvYRgufyvFTGbMb27sxHnIQp256XQ6r7VZuX2B0RTdO3MIpbf4EcF8KgnYlw/exec'
curl -sL --max-time 120 "$U?action=inventario_abas" -o docs/inventario-abas-2026-07-27.json
python -c "
import json
d=json.load(open('docs/inventario-abas-2026-07-27.json',encoding='utf-8'))
print(d['planilha'])
for a in sorted(d['abas'], key=lambda x:-x['registros']):
    print(f\"{a['registros']:7d}  {a['nome']}\")
"
```

Esperado: lista de abas com contagem. **Guardar o JSON no repo** — as Tasks 5 e 8 leem dele.

- [ ] **Step 5: Commit**

```bash
git add google-apps-script.js docs/inventario-abas-2026-07-27.json
git commit -m "feat(diag): action inventario_abas + inventario da planilha da expedicao

Constraint: migracao de planilha exige saber o que existe antes de mover
Confidence: high
Scope-risk: narrow"
```

---

## Task 1: A busca acha a OS

**O defeito:** `listarAtendimentos` monta o campo de busca como `id + nomeCliente + telefone + cpfCnpj` (`google-apps-script.js:3457`). Número de OS nunca entra. E as OS da série antiga (0001–0717) moram na aba `Assistencias parceiras`, que nenhuma busca lê. Provado ao vivo: `status_publico` para `OS-2026-0426` e `OS-2026-0479` devolve `{"ok":false}`.

**Files:**
- Create: `tests/os-numero.test.js`
- Modify: `google-apps-script.js` (novo `buscarOSPorNumero_` + action `buscar_os`)
- Modify: `atendimentos-lista.js` (dispara a busca de OS quando o texto parece OS)

**Interfaces:**
- Consumes: `chaveNumeroOS_(v)` (já existe, `:2262`) — normaliza `"OS-2026-0045"` e `"45"` para `"45"`.
- Produces: `pareceNumeroOS(texto) → boolean` (pura) · `buscarOSPorNumero_(numero) → [{numeroOS, fonte, cliente, telefone, cpf, modelo, status, atendimentoId, data}]` · action `buscar_os`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/os-numero.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { pareceNumeroOS } = require('../lib/os-numero.js');

test('reconhece OS com prefixo completo', () => {
  assert.strictEqual(pareceNumeroOS('OS-2026-0426'), true);
  assert.strictEqual(pareceNumeroOS('os-2026-0426'), true);
  assert.strictEqual(pareceNumeroOS('  OS 2026 0426 '), true);
});

test('reconhece numero solto de 3-4 digitos (como a equipe digita)', () => {
  assert.strictEqual(pareceNumeroOS('426'), true);
  assert.strictEqual(pareceNumeroOS('0479'), true);
});

test('NAO confunde com protocolo de atendimento', () => {
  assert.strictEqual(pareceNumeroOS('PV-2026-0337'), false);
});

test('NAO confunde com nome, CPF nem telefone', () => {
  assert.strictEqual(pareceNumeroOS('Wesley Silva'), false);
  assert.strictEqual(pareceNumeroOS('899.067.052-72'), false);
  assert.strictEqual(pareceNumeroOS('19999140990'), false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/os-numero.test.js`
Expected: FAIL — `Cannot find module '../lib/os-numero.js'`

- [ ] **Step 3: Implementar a função pura**

Criar `lib/os-numero.js` (ES5 puro, para o mesmo texto ser colado no Apps Script):

```javascript
// Decide se um texto de busca e um numero de OS. Aceita "OS-2026-0426",
// "os 2026 0426" e o numero solto ("426") — que e como a equipe digita.
// Rejeita protocolo de atendimento (PV-), CPF e telefone (digitos demais).
function pareceNumeroOS(texto) {
  var s = String(texto || '').trim();
  if (!s) return false;
  if (/^pv/i.test(s)) return false;
  if (/^os/i.test(s)) return true;
  var soDigitos = s.replace(/\D/g, '');
  if (soDigitos !== s.replace(/[\s.\-\/]/g, '')) return false; // tem letra
  return soDigitos.length >= 1 && soDigitos.length <= 4;
}

if (typeof module !== 'undefined') module.exports = { pareceNumeroOS };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/os-numero.test.js`
Expected: PASS (4 testes)

- [ ] **Step 5: Implementar a busca nas 3 fontes (Apps Script)**

Colar `pareceNumeroOS` (sem o `module.exports`) e adicionar em `google-apps-script.js`, perto de `statusPublicoOS`:

```javascript
// Procura uma OS pelo numero em TODAS as fontes. A serie antiga (0001..0717)
// vive na aba 'Assistencias parceiras' (antigo master renomeado no incidente
// de 06/07, SEM cabecalho, colunas fixas B=numero C=cliente) e a aba manual da
// Sumare tem cabecalho. A faixa 0001..0093 existe DUAS vezes, para clientes
// diferentes — por isso o retorno e uma LISTA, nunca um objeto.
function buscarOSPorNumero_(numero) {
  var chave = chaveNumeroOS_(numero);
  if (!chave) return [];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var achados = [];

  // 1. Master atual (AssistenciasTecnicas) — colunas conhecidas de registrarOS
  var mestre = ss.getSheetByName(ABA_ASSISTENCIAS);
  if (mestre && mestre.getLastRow() > 1) {
    var dm = mestre.getDataRange().getValues();
    var colAt = getColAtendimentoId(mestre);
    for (var i = 1; i < dm.length; i++) {
      if (chaveNumeroOS_(dm[i][1]) !== chave) continue;
      achados.push({
        numeroOS: String(dm[i][1] || ''),
        fonte: 'master',
        linha: i + 1,
        cliente: String(dm[i][2] || ''),
        cpf: String(dm[i][3] || ''),
        telefone: String(dm[i][4] || ''),
        modelo: String(dm[i][11] || ''),
        chassi: String(dm[i][12] || ''),
        problema: String(dm[i][19] || ''),
        assistencia: String(dm[i][16] || ''),
        status: String(dm[i][21] || 'Aberta'),
        atendimentoId: colAt > 0 ? String(dm[i][colAt - 1] || '') : '',
        data: dm[i][0] instanceof Date
          ? Utilities.formatDate(dm[i][0], Session.getScriptTimeZone(), 'dd/MM/yyyy') : ''
      });
    }
  }

  // 2. Serie antiga (Assistencias parceiras) — sem cabecalho, B=numero C=cliente
  var antiga = ss.getSheetByName(ABA_ESPELHO_PARCEIRAS);
  if (antiga && antiga.getLastRow() >= 1) {
    var da = antiga.getRange(1, 1, antiga.getLastRow(), Math.min(antiga.getLastColumn(), 12)).getValues();
    for (var j = 0; j < da.length; j++) {
      if (chaveNumeroOS_(da[j][1]) !== chave) continue;
      achados.push({
        numeroOS: String(da[j][1] || ''),
        fonte: 'serie-antiga',
        linha: j + 1,
        cliente: String(da[j][2] || ''),
        cpf: '', telefone: '', modelo: '', chassi: '', problema: '',
        assistencia: '', status: '', atendimentoId: '',
        data: da[j][0] instanceof Date
          ? Utilities.formatDate(da[j][0], Session.getScriptTimeZone(), 'dd/MM/yyyy') : ''
      });
    }
  }

  // 3. Aba manual da Sumare — por cabecalho, numeros digitados a mao
  var sumare = ss.getSheetByName(ABA_ESPELHO_SUMARE);
  if (sumare && sumare.getLastRow() > 1) {
    var cols = mapearColunasPorCabecalho_(sumare);
    if ('numero os' in cols) {
      var ds = sumare.getRange(2, 1, sumare.getLastRow() - 1, sumare.getLastColumn()).getValues();
      for (var k = 0; k < ds.length; k++) {
        if (chaveNumeroOS_(ds[k][cols['numero os']]) !== chave) continue;
        achados.push({
          numeroOS: String(ds[k][cols['numero os']] || ''),
          fonte: 'sumare-manual',
          linha: k + 2,
          cliente: 'cliente' in cols ? String(ds[k][cols['cliente']] || '') : '',
          cpf: '', telefone: '', modelo: '', chassi: '', problema: '',
          assistencia: 'Sumare', status: '', atendimentoId: '', data: ''
        });
      }
    }
  }

  return achados;
}

function buscarOS(numero) {
  var achados = buscarOSPorNumero_(numero);
  return {
    ok: true,
    numero: String(numero || ''),
    total: achados.length,
    ambiguo: achados.length > 1,
    resultados: achados
  };
}
```

- [ ] **Step 6: Rotear a action**

Em `doGet`, junto das read-only:

```javascript
      case 'buscar_os':
        return jsonResponse(buscarOS(e.parameter.numero || e.parameter.os || ''));
```

- [ ] **Step 7: Deployar (v44) e provar nos dois casos reais**

```bash
U='https://script.google.com/macros/s/AKfycbytZgFvvhTvYRgufyvFTGbMb27sxHnIQp256XQ6r7VZuX2B0RTdO3MIpbf4EcF8KgnYlw/exec'
for n in OS-2026-0426 OS-2026-0479 426; do echo -n "$n -> "; curl -sL "$U?action=buscar_os&numero=$n" | head -c 300; echo; done
```

Expected: `OS-2026-0426` devolve **pelo menos 1 resultado** (o caso do Wesley, hoje invisível) com `fonte:"serie-antiga"`. Se vier `total:0`, a OS não está em nenhuma das 3 abas — **pare e reporte**, porque aí ela veio de fora do sistema e a Task 5 muda de escopo.

- [ ] **Step 8: Ligar no front**

Em `atendimentos-lista.js`, na função que aplica os filtros, antes de chamar `listar_atendimentos`: se `pareceNumeroOS(termo)`, chamar também `buscar_os` e renderizar um bloco no topo — "OS encontrada fora dos atendimentos" — com número, cliente, status, fonte e, se houver `atendimentoId`, um botão que filtra por ele. Se `ambiguo:true`, mostrar os dois resultados lado a lado com a data, e o aviso: *"Este número existe duas vezes (incidente de 06/07). Confira pela data e pelo cliente."*

Trocar o placeholder do campo de busca de `BUSCA (PROTOCOLO, NOME, CPF, TELEFONE)` para `BUSCA (PROTOCOLO, OS, NOME, CPF, TELEFONE)`.

- [ ] **Step 9: Carregar a lib no front + bump de versão**

Em `index.html`, antes de `<script src="app.js...">` (o front chama `pareceNumeroOS`):

```html
  <script src="lib/os-numero.js?v=2.36"></script>
```

Depois trocar `?v=2.35` por `?v=2.36` em **todas** as ocorrências (13 existentes + a nova).
Conferir que não sobrou nenhuma: `grep -c "v=2.35" index.html` deve dar `0`.

- [ ] **Step 10: Commit**

```bash
git add lib/os-numero.js tests/os-numero.test.js google-apps-script.js atendimentos-lista.js index.html
git commit -m "feat(busca): busca de atendimento acha OS nas 3 fontes, inclusive a serie antiga

A serie antiga (0001-0717) ficou orfa na aba 'Assistencias parceiras' apos o
incidente de renomeacao de 06/07 e nenhuma busca a lia. Caso real: OS-2026-0426
(Wesley) nao aparecia nem por nome nem por numero.

Constraint: a faixa 0001-0093 existe em duplicidade — retorno e lista, nunca objeto
Rejected: unificar as abas agora | migracao de dados vivos exige backup, fica na Task 5
Confidence: high
Scope-risk: narrow
Directive: buscarOSPorNumero_ SEMPRE retorna lista. Nao 'simplifique' para objeto unico
Not-tested: aba manual da Sumare sem a coluna 'numero os' no cabecalho"
```

---

## Task 2: Tela de OS — lista, busca e avanço de status (SAC)

**O defeito:** `assistencia.js` é **só** um formulário de abertura. Não existe lista, busca nem edição de OS. O status que o cliente vê no QR code só muda editando a coluna Status da aba `AssistenciasTecnicas` na mão — o próprio código admite isso em `google-apps-script.js:3869`. Por isso o usuário disse "não sei onde altera o status": não tem onde.

**Files:**
- Create: `os-lista.js`
- Modify: `google-apps-script.js` (actions `listar_os` e `atualizar_status_os`)
- Modify: `index.html` (aba nova "OS" + container + script)

**Interfaces:**
- Consumes: `buscarOSPorNumero_` (Task 1), `ETAPAS_OS` (já existe, `:3872`), `etapaDoStatus_` (`:3874`).
- Produces: action `listar_os` → `{ok, oses:[...]}` · action `atualizar_status_os` (POST) → `{ok, numeroOS, status}`.

- [ ] **Step 1: Implementar `listarOS` no backend**

```javascript
// Lista as OS do master com filtros. NAO lista a serie antiga (ela e historico
// e nao tem colunas para status) — a serie antiga se acha pela busca (buscar_os).
function listarOS(filtros) {
  filtros = filtros || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABA_ASSISTENCIAS);
  if (!aba || aba.getLastRow() < 2) return { ok: true, oses: [], total: 0 };

  var colAt = getColAtendimentoId(aba);
  var dados = aba.getDataRange().getValues();
  var busca = String(filtros.busca || '').toLowerCase().trim();
  var out = [];

  for (var i = 1; i < dados.length; i++) {
    var r = dados[i];
    if (!String(r[1] || '').trim()) continue;
    var o = {
      numeroOS: String(r[1] || ''),
      linha: i + 1,
      cliente: String(r[2] || ''),
      cpf: String(r[3] || ''),
      telefone: String(r[4] || ''),
      cidade: String(r[9] || ''),
      modelo: String(r[11] || ''),
      chassi: String(r[12] || ''),
      tipo: String(r[15] || ''),
      assistencia: String(r[16] || ''),
      problema: String(r[19] || ''),
      status: String(r[21] || 'Aberta'),
      etapa: etapaDoStatus_(String(r[21] || 'Aberta')),
      atendimentoId: colAt > 0 ? String(r[colAt - 1] || '') : '',
      data: r[0] instanceof Date
        ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'dd/MM/yyyy') : ''
    };
    if (filtros.status && o.status !== filtros.status) continue;
    if (filtros.semVinculo === 'sim' && o.atendimentoId) continue;
    if (busca) {
      var hay = (o.numeroOS + ' ' + o.cliente + ' ' + o.telefone + ' ' + o.cpf + ' ' + o.chassi).toLowerCase();
      if (hay.indexOf(busca) === -1) continue;
    }
    out.push(o);
  }

  out.reverse();
  var limite = parseInt(filtros.limite) || 200;
  var total = out.length;
  if (out.length > limite) out = out.slice(0, limite);
  return { ok: true, oses: out, total: total, exibidos: out.length };
}
```

- [ ] **Step 2: Implementar `atualizarStatusOS` (escrita, sob lock)**

```javascript
// Avanca o status da OS. So aceita os rotulos de ETAPAS_OS — status livre
// quebraria a timeline publica do QR (etapaDoStatus_ cairia sempre em 0).
// origem: 'sac' (tela interna) ou 'assistencia' (link com token, Task 3).
function atualizarStatusOS(numeroOS, novoStatus, origem, quem) {
  if (ETAPAS_OS.indexOf(novoStatus) === -1) {
    return { ok: false, erro: 'Status invalido. Use: ' + ETAPAS_OS.join(' / ') };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ss.getSheetByName(ABA_ASSISTENCIAS);
    if (!aba) return { ok: false, erro: 'Aba de OS nao encontrada' };
    var chave = chaveNumeroOS_(numeroOS);
    var dados = aba.getDataRange().getValues();
    for (var i = 1; i < dados.length; i++) {
      if (chaveNumeroOS_(dados[i][1]) !== chave) continue;
      var anterior = String(dados[i][21] || 'Aberta');
      aba.getRange(i + 1, 22).setValue(novoStatus);
      registrarHistoricoOS_(String(dados[i][1]), anterior, novoStatus, origem || 'sac', quem || '');
      return { ok: true, numeroOS: String(dados[i][1]), status: novoStatus, anterior: anterior };
    }
    return { ok: false, erro: 'OS nao encontrada no master' };
  } finally {
    lock.releaseLock();
  }
}

// Trilha de auditoria — quem moveu o status e quando. Aba propria para nao
// alargar o master (os indices de coluna de statusPublicoOS sao fixos).
function registrarHistoricoOS_(numeroOS, de, para, origem, quem) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName('HistoricoOS');
  if (!aba) {
    aba = ss.insertSheet('HistoricoOS');
    aba.appendRow(['DATA', 'NUMERO OS', 'DE', 'PARA', 'ORIGEM', 'QUEM']);
    aba.getRange(1, 1, 1, 6).setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  aba.appendRow([new Date(), numeroOS, de, para, origem, quem]);
}
```

- [ ] **Step 3: Rotear as actions**

Em `doGet`: `case 'listar_os': return jsonResponse(listarOS(e.parameter));`
Em `doPost`, junto de `atualizar_status_orcamento` (~linha 1020):

```javascript
      case 'atualizar_status_os':
        return jsonResponse(atualizarStatusOS(body.numeroOS, body.novoStatus, 'sac', body.quem || ''));
```

- [ ] **Step 4: Deployar (v45) e smoke test**

```bash
U='https://script.google.com/macros/s/AKfycbytZgFvvhTvYRgufyvFTGbMb27sxHnIQp256XQ6r7VZuX2B0RTdO3MIpbf4EcF8KgnYlw/exec'
curl -sL "$U?action=listar_os&limite=5" | head -c 500
curl -sL "$U?action=listar_os&semVinculo=sim&limite=1" | python -c "import sys,json;print('OS sem vinculo:',json.load(sys.stdin)['total'])"
```

Expected: lista de OS com `status` e `etapa`. O segundo comando dá o tamanho do problema do vínculo — anotar o número, a Task 4 volta nele.

- [ ] **Step 5: Escrever `os-lista.js`**

IIFE no mesmo padrão de `atendimentos-lista.js` (mesmo estilo de cartão, mesmo
`escapeHtml` local, mesmo `fetch` com `text/plain` — o backend responde CORS assim).

```javascript
(function() {
  'use strict';
  var URL_API = (typeof GOOGLE_SCRIPT_URL !== 'undefined') ? GOOGLE_SCRIPT_URL : '';
  var ETAPAS = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Em conserto', 'Pronto p/ retirar'];
  var cache = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function carregar(filtros) {
    var q = Object.keys(filtros || {}).map(function(k) {
      return k + '=' + encodeURIComponent(filtros[k]);
    }).join('&');
    return fetch(URL_API + '?action=listar_os&limite=200' + (q ? '&' + q : ''))
      .then(function(r) { return r.json(); })
      .then(function(d) { cache = d.oses || []; render(); return d; });
  }

  function salvarStatus(numeroOS, novoStatus, btn) {
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    return fetch(URL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'atualizar_status_os', numeroOS: numeroOS, novoStatus: novoStatus })
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.ok) throw new Error(d.erro || 'falhou');
        btn.textContent = 'Salvo';
        // Recarrega para o cartao refletir a verdade da planilha, nao o otimismo da tela.
        setTimeout(function() { carregar(filtrosAtuais()); }, 600);
      })
      .catch(function(e) {
        btn.disabled = false;
        btn.textContent = 'Salvar status';
        alert('Nao consegui salvar: ' + e.message);
      });
  }

  function cardHTML(o, idx) {
    var opcoes = ETAPAS.map(function(et) {
      return '<option value="' + esc(et) + '"' + (et === o.status ? ' selected' : '') + '>' + esc(et) + '</option>';
    }).join('');
    return '' +
      '<div class="al-card" data-idx="' + idx + '">' +
        '<strong style="color:var(--cor-primaria);font-size:1.05rem;">' + esc(o.numeroOS) + '</strong> ' +
        '<span class="badge">' + esc(o.status) + '</span>' +
        (o.atendimentoId
          ? ' <button class="os-ir-at" data-pv="' + esc(o.atendimentoId) + '">' + esc(o.atendimentoId) + '</button>'
          : ' <span style="color:#f59e0b;">sem atendimento vinculado</span>') +
        '<div>' + esc(o.cliente) + ' &bull; ' + esc(o.modelo) + ' &bull; ' + esc(o.assistencia) + '</div>' +
        '<div style="font-style:italic;color:#9a9a9a;">' + esc(o.problema) + '</div>' +
        '<div style="margin-top:.5rem;display:flex;gap:.5rem;flex-wrap:wrap;">' +
          '<select class="os-status" data-os="' + esc(o.numeroOS) + '">' + opcoes + '</select>' +
          '<button class="os-salvar btn-secundario btn-sm" data-os="' + esc(o.numeroOS) + '">Salvar status</button>' +
          '<a class="btn-secundario btn-sm" target="_blank" rel="noopener" ' +
             'href="?view=acompanhar&os=' + encodeURIComponent(o.numeroOS) + '">Ver como o cliente vê</a>' +
        '</div>' +
      '</div>';
  }

  // render(), filtrosAtuais() e os addEventListener seguem o mesmo formato de
  // atendimentos-lista.js — inclusive o guard de nao expandir ao clicar em BUTTON.
  window.OSLista = { carregar: carregar };
})();
```

O botão **"Ver como o cliente vê"** abre exatamente o destino do QR code. É ele que
fecha o relato "não sei onde altera o status": a pessoa muda no seletor e confere
na mesma tela o que o cliente passa a ver.

- [ ] **Step 6: Ligar no index.html**

Aba nova entre "Assistências" e "Clientes":

```html
<button class="nav-tab" data-view="os">&#128203; OS</button>
```

Container:

```html
<section class="view" id="view-os"><div id="os-lista-container"></div></section>
```

Script (depois de `assistencia.js`): `<script src="os-lista.js?v=2.36"></script>`

- [ ] **Step 7: Verificar no navegador ao vivo**

Abrir `https://nxtlojas-hash.github.io/sac-pecas/`, aba OS. Mudar o status de **uma** OS de teste para "Em conserto", depois abrir `?view=acompanhar&os=<numero>` e conferir que a timeline andou para a etapa 3. Voltar o status para o original. Conferir a aba `HistoricoOS`: 2 linhas.

- [ ] **Step 8: Commit**

```bash
git add os-lista.js google-apps-script.js index.html
git commit -m "feat(os): tela de OS com lista, busca e avanco de status

Fecha o relato 'nao sei onde altera o status': ate agora o status da OS (o que o
cliente ve no QR) so mudava editando a celula da planilha na mao.

Constraint: statusPublicoOS le colunas por indice fixo — historico vai em aba propria
Constraint: status limitado a ETAPAS_OS, senao etapaDoStatus_ zera a timeline do QR
Confidence: high
Scope-risk: moderate
Directive: nao alargar a aba AssistenciasTecnicas a esquerda da coluna 22
Not-tested: duas pessoas mudando a mesma OS ao mesmo tempo (o lock cobre, nao foi exercitado)"
```

---

## Task 3: Link para a assistência mover o status

**Decisão dela (27/07):** o status é movido pelos **dois** — SAC pela tela (Task 2) e a assistência por um link.

**Regra de precedência (defina e respeite):** o último a mover ganha, e a aba `HistoricoOS` guarda quem foi. A assistência **não pode** voltar status (só avançar) nem fechar a OS — "Pronto p/ retirar" é o teto dela. Isso evita a briga que a decisão "os dois" naturalmente cria, sem precisar de hierarquia de usuário.

**Files:**
- Modify: `google-apps-script.js` (token por OS + action pública `os_assistencia`)
- Modify: `assistencia.js` (o PDF/WhatsApp da assistência passa a levar o link)

**Interfaces:**
- Consumes: `atualizarStatusOS` (Task 2), `ETAPAS_OS`.
- Produces: `tokenOS_(numeroOS) → string` (HMAC curto, determinístico) · action `os_assistencia` (GET, sem login).

- [ ] **Step 1: Teste da função pura de precedência**

Acrescentar em `tests/os-numero.test.js`:

```javascript
const { podeAssistenciaMover } = require('../lib/os-numero.js');

test('assistencia avanca dentro do permitido', () => {
  assert.strictEqual(podeAssistenciaMover('Aberta', 'Em análise'), true);
  assert.strictEqual(podeAssistenciaMover('Em análise', 'Pronto p/ retirar'), true);
});

test('assistencia NAO volta status', () => {
  assert.strictEqual(podeAssistenciaMover('Em conserto', 'Aberta'), false);
});

test('assistencia NAO mexe no que ja esta pronto', () => {
  assert.strictEqual(podeAssistenciaMover('Pronto p/ retirar', 'Em conserto'), false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/os-numero.test.js`
Expected: FAIL — `podeAssistenciaMover is not a function`

- [ ] **Step 3: Implementar**

Em `lib/os-numero.js`:

```javascript
var ETAPAS_OS_LIB = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Em conserto', 'Pronto p/ retirar'];

// A assistencia so AVANCA, e para no 'Pronto p/ retirar'. Quem fecha e o SAC.
function podeAssistenciaMover(de, para) {
  var i = ETAPAS_OS_LIB.indexOf(String(de || 'Aberta'));
  var j = ETAPAS_OS_LIB.indexOf(String(para || ''));
  if (i === -1 || j === -1) return false;
  if (i >= ETAPAS_OS_LIB.length - 1) return false;
  return j > i;
}

if (typeof module !== 'undefined') module.exports = { pareceNumeroOS, podeAssistenciaMover };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/os-numero.test.js`
Expected: PASS (7 testes)

- [ ] **Step 5: Token e página da assistência**

```javascript
// Token curto e deterministico por OS. Nao e login: e um link nao-adivinhavel,
// mesmo nivel de segredo do QR publico, porem com poder de ESCREVER — por isso
// so avanca status e nao expoe CPF/endereco do cliente.
// O segredo vive em ScriptProperties (getProperty/setProperty, :202-207), NAO na
// aba Config — a aba Config e visivel para quem abre a planilha.
function tokenOS_(numeroOS) {
  var segredo = getProperty('OS_LINK_SECRET');
  if (!segredo) {
    segredo = Utilities.getUuid();
    setProperty('OS_LINK_SECRET', segredo);
  }
  var bytes = Utilities.computeHmacSha256Signature(String(numeroOS), segredo);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '').slice(0, 16);
}

// GET ?action=os_assistencia&os=OS-2026-0800&t=<token>[&novo=Em conserto]
// Sem 'novo' -> so devolve o estado. Com 'novo' -> tenta avancar.
function osAssistencia(os, token, novo) {
  var numero = String(os || '').trim();
  if (!numero || token !== tokenOS_(numero)) return { ok: false };
  var achados = buscarOSPorNumero_(numero);
  var alvo = null;
  for (var i = 0; i < achados.length; i++) {
    if (achados[i].fonte === 'master') { alvo = achados[i]; break; }
  }
  if (!alvo) return { ok: false };

  if (novo) {
    if (!podeAssistenciaMover(alvo.status, novo)) {
      return { ok: false, erro: 'Movimento nao permitido', status: alvo.status, etapas: ETAPAS_OS };
    }
    var r = atualizarStatusOS(numero, novo, 'assistencia', alvo.assistencia);
    if (!r.ok) return r;
    alvo.status = novo;
  }

  return {
    ok: true, os: alvo.numeroOS, cliente: alvo.cliente, modelo: alvo.modelo,
    problema: alvo.problema, status: alvo.status,
    etapaAtual: etapaDoStatus_(alvo.status), etapas: ETAPAS_OS
  };
}
```

Rotear em `doGet`: `case 'os_assistencia': return jsonResponse(osAssistencia(e.parameter.os, e.parameter.t, e.parameter.novo));`

- [ ] **Step 6: Levar o link no documento da assistência**

Em `assistencia.js`, na função `gerarPDFAssistencia` (a via da **assistência**, não a do cliente — `gerarPDFAssistenciaCliente` fica intocada), junto do bloco de QR já existente (`blocoQrOS`, `:718`), acrescentar um segundo QR apontando para:

`https://nxtlojas-hash.github.io/sac-pecas/?view=osassist&os=<numero>&t=<token>`

com a legenda **"Atualize o andamento aqui"**. O token vem no retorno do `registrar_os` (adicionar `linkAssistencia` ao retorno de `registrarOS`).

Em `app.js`, ao lado do roteamento de `?view=acompanhar` (`:812`), tratar `?view=osassist`: página limpa, sem nav, com os 5 botões de etapa — desabilitando os que `podeAssistenciaMover` recusa.

- [ ] **Step 7: Deployar (v46) e testar ponta a ponta**

Abrir uma OS de teste pelo formulário, pegar o `linkAssistencia` do retorno, abrir num navegador anônimo, avançar de "Aberta" para "Em análise", conferir na tela de OS (Task 2) que mudou, e tentar voltar para "Aberta" — deve recusar. Apagar a OS de teste da planilha ao fim.

- [ ] **Step 8: Commit**

```bash
git add lib/os-numero.js tests/os-numero.test.js google-apps-script.js assistencia.js app.js
git commit -m "feat(os): link para a assistencia avancar o status da OS

Decisao dela (27/07): status movido pelos dois — SAC pela tela, assistencia por link.

Constraint: link nao e login — assistencia so AVANCA e para em 'Pronto p/ retirar'
Constraint: a pagina da assistencia nao expoe CPF nem endereco do cliente
Rejected: conta por assistencia | 20+ parceiras, adocao seria zero
Confidence: medium
Scope-risk: moderate
Directive: precedencia e 'ultimo a mover ganha' + trilha em HistoricoOS. Nao inverter sem rever
Not-tested: assistencia abrindo o link depois da OS ser migrada de aba (Task 5)"
```

---

## Task 4: Vínculo atendimento↔OS deixa de ser opcional

**O defeito:** `assistencia.js:451` já manda `atendimentoId`, mas ele só vem preenchido quando a pessoa chega ao formulário **de dentro de um atendimento** (`:770`, `preFill.atendimentoId`). Quem clica na aba "Assistências" no topo — o caminho mais visível — abre OS solta. Resultado medido: **`docsVinculados` preenchido em 0 de 816 atendimentos.** É exatamente o "já está criado e eles não estão usando".

**Files:**
- Modify: `assistencia.js` (formulário exige atendimento)
- Modify: `google-apps-script.js` (`registrarOS` grava o vínculo dos dois lados)
- Modify: `atendimentos-lista.js` (o cartão mostra a OS)

- [ ] **Step 1: Vínculo dos dois lados no backend**

Hoje `registrarOS` só escreve o `atendimentoId` na linha da OS. Falta o outro lado — é o lado que a tela de atendimento lê. Dentro de `registrarOS`, no bloco `if (dados.atendimentoId)` (`:2482`), acrescentar depois do `setValue`:

```javascript
        // Outro lado do vinculo: carimba a OS em docsVinculados do atendimento.
        // Sem isso o cartao do atendimento nunca mostra a OS — causa medida de
        // docsVinculados = 0 em 816 atendimentos (diagnostico 27/07).
        try {
          vincularDocAtendimento(dados.atendimentoId, numeroOS);
        } catch (eVinc) { /* nao bloqueia a OS */ }
```

Conferir a assinatura de `vincularDocAtendimento` (action `vincular_doc_atendimento` já existe) e ajustar a chamada ao que ela espera.

- [ ] **Step 2: Formulário exige o atendimento**

Em `assistencia.js`, no topo do formulário (`buildFormHTMLAssistencia`, `:99`), acrescentar um campo **Atendimento (protocolo)** com `datalist` dos atendimentos abertos, no mesmo padrão do vínculo que já existe em `clientes.js:356-387` (inclusive a validação `/^PV-\d{4}-\d{4}$/`). Dois caminhos e nenhum terceiro:

1. **Tem protocolo** → digita/escolhe o `PV-`, e os campos de cliente vêm preenchidos dele.
2. **Não tem** → botão **"Criar atendimento para esta OS"**, que chama `registrar_atendimento` com categoria `Pos-venda` / motivo `Assistencia tecnica` e usa o `PV-` recém-criado.

Em `submeterOS` (`:383`), bloquear o envio se `atendimentoVinculadoOS` estiver vazio, com a mensagem: *"Toda OS precisa estar ligada a um atendimento — é assim que ela é encontrada depois."*

- [ ] **Step 3: O cartão do atendimento mostra a OS**

Em `atendimentos-lista.js`, `renderDetalhe` (`:227`): hoje o bloco "Docs vinculados" mostra os chips e mais nada. Fazer cada chip que casar com `/^OS-/` virar botão que abre a tela de OS (Task 2) já filtrada naquele número, e acrescentar ao lado o status atual da OS. É isso que entrega o "tudo sobre um atendimento no mesmo local".

- [ ] **Step 4: Deployar (v47 + front v2.37) e provar**

Abrir uma OS de teste **pela aba Assistências** (o caminho errado de hoje): deve recusar sem protocolo. Criar o atendimento pelo botão, concluir a OS, e conferir que o cartão do `PV-` mostra o chip `OS-...` com status. Apagar os dois registros de teste ao fim.

- [ ] **Step 5: Commit**

```bash
git add assistencia.js google-apps-script.js atendimentos-lista.js index.html
git commit -m "feat(os): OS so nasce ligada a um atendimento, e o vinculo grava dos dois lados

docsVinculados estava em 0/816: o caminho certo (entrar pela ficha do atendimento)
era opcional e o atalho errado (aba Assistencias) era o mais visivel.

Constraint: quem nao tem protocolo cria um no proprio formulario — nao pode virar beco
Confidence: high
Scope-risk: moderate
Directive: nao reintroduzir caminho de OS sem atendimento 'so para o caso urgente'
Not-tested: OS aberta com o front em cache antigo (sem o campo) — cai no bloqueio do backend?"
```

---

## Task 5: Unificar o histórico de OS

**Decisão dela (27/07):** unificar num histórico buscável, renumerando só as 93 duplicadas com uma marca.

**Depende de:** a saída da Task 0 (nomes e tamanhos reais das abas) e do resultado do Step 7 da Task 1 (se `OS-2026-0426` foi achada e em qual fonte).

**Files:**
- Modify: `google-apps-script.js` (rotina `unificar_historico_os_v1`)
- Create: `docs/2026-07-XX-unificacao-os.md` (relatório do que foi movido)

- [ ] **Step 1: Backup manual, antes de qualquer código**

Abrir a planilha `1QtumxGgKwzWBQBPISfDFjH3qGboiT3_1x5gbxl6R6ns` → *Arquivo → Fazer uma cópia* → nome `Pedido de peças — BACKUP antes unificacao OS 2026-07-XX`. **Sem isso, não siga.**

- [ ] **Step 2: Teste da desambiguação (função pura)**

Criar em `tests/os-numero.test.js`:

```javascript
const { marcarDuplicata } = require('../lib/os-numero.js');

// A assinatura é (numero, indice, totalComEsseNumero). O 3º argumento é o que
// distingue "único" de "duplicado" — sem ele os dois primeiros testes teriam
// os MESMOS argumentos e resultados diferentes.
test('numero unico fica intacto', () => {
  assert.strictEqual(marcarDuplicata('OS-2026-0426', 0, 1), 'OS-2026-0426');
});

test('duplicatas ganham sufixo estavel por ordem', () => {
  assert.strictEqual(marcarDuplicata('OS-2026-0045', 0, 2), 'OS-2026-0045-A');
  assert.strictEqual(marcarDuplicata('OS-2026-0045', 1, 2), 'OS-2026-0045-B');
});

test('o sufixo nunca e reaplicado', () => {
  assert.strictEqual(marcarDuplicata('OS-2026-0045-A', 0, 2), 'OS-2026-0045-A');
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --test tests/os-numero.test.js`
Expected: FAIL — `marcarDuplicata is not a function`

- [ ] **Step 4: Implementar**

```javascript
// A serie nova recomecou no 0001 apos o incidente de 06/07 e foi ate 0093 antes
// do piso 717 entrar — esses numeros existem DUAS vezes, para clientes diferentes.
// Sufixo -A/-B preserva o numero impresso no papel do cliente.
function marcarDuplicata(numero, indice, totalComEsseNumero) {
  var s = String(numero || '');
  if (/-[A-Z]$/.test(s)) return s;
  if (!totalComEsseNumero || totalComEsseNumero <= 1) return s;
  return s + '-' + String.fromCharCode(65 + indice);
}
```

A rotina de migração agrupa por `chaveNumeroOS_` antes de chamar, então sempre
sabe quantas linhas compartilham aquele número — é esse `totalComEsseNumero` que
ela passa. Número único (total 1) sai intacto; colisão vira `-A`, `-B`.

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test tests/os-numero.test.js`
Expected: PASS (10 testes)

- [ ] **Step 6: Rotina de unificação (dry-run obrigatório)**

Escrever `unificarHistoricoOsV1(body)` no padrão do `setupRoteamentoOsV1` (`:2334`): sob `LockService`, flag em `DocumentProperties`, e **`body.dryRun !== false` por padrão** — a primeira execução só relata. A rotina lê `Assistencias parceiras` (colunas fixas B=número, C=cliente) e insere no master `AssistenciasTecnicas` as linhas que ainda não existem lá, com `fonteOriginal: 'serie-antiga'` numa coluna nova à **direita** (nunca à esquerda da 22 — `statusPublicoOS` lê por índice fixo). Colisões de número recebem `marcarDuplicata`. Status inicial das migradas: `Pronto p/ retirar` só se houver data de conclusão; senão `Aberta`.

- [ ] **Step 7: Rodar em dry-run, conferir, só então valendo**

```bash
U='https://script.google.com/macros/s/AKfycbytZgFvvhTvYRgufyvFTGbMb27sxHnIQp256XQ6r7VZuX2B0RTdO3MIpbf4EcF8KgnYlw/exec'
curl -sL -X POST "$U" -H 'Content-Type: text/plain' \
  -d '{"action":"unificar_historico_os_v1","confirmar":"SIM","dryRun":true}'
```

Conferir no relatório: total a migrar, quantas colisões, e que `OS-2026-0426` está na lista. Só depois rodar com `"dryRun":false`.

- [ ] **Step 8: Provar o caso do Wesley**

```bash
curl -sL "$U?action=buscar_os&numero=OS-2026-0426" | head -c 400
curl -sL "$U?action=status_publico&os=OS-2026-0426" | head -c 300
```

Expected: os dois respondem com dados (o `status_publico` era `{"ok":false}` antes). **Este é o critério de aceite da task.**

- [ ] **Step 9: Commit**

```bash
git add lib/os-numero.js tests/os-numero.test.js google-apps-script.js docs/
git commit -m "feat(os): unifica a serie antiga no master, desambiguando as 93 duplicatas

Constraint: backup da planilha antes de rodar — dado vivo, sem desfazer
Constraint: coluna nova so a DIREITA da 22 (statusPublicoOS le por indice fixo)
Constraint: dry-run e o padrao; valendo exige dryRun:false explicito
Rejected: renumerar tudo em serie limpa | o numero esta impresso no papel do cliente
Confidence: medium
Scope-risk: broad
Directive: sufixo -A/-B preserva o numero impresso. Nao 'limpe' esses sufixos depois
Not-tested: OS da aba manual da Sumare que nunca existiu no master"
```

---

## Task 6: Caixa de Entrada separada

**Decisão dela (27/07):** o pull do Respond.io passa a cair numa Caixa de Entrada; só vira atendimento quando alguém tria.

**O tamanho do problema:** 490 dos 816 atendimentos (60%) foram criados por `criarAtendimentoViaWhatsApp_` (`:4192`) e ninguém abriu. 787 estão "Aberto" e 703 vencidos no SLA de 3 dias — o mais antigo tem 70 dias.

**Files:**
- Modify: `google-apps-script.js` (`criarAtendimentoViaWhatsApp_` grava na aba nova)
- Create: `caixa-entrada.js`, `tests/triagem.test.js`
- Modify: `index.html`

- [ ] **Step 1: Teste da classificação**

`tests/triagem.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { classificarEntrada } = require('../lib/triagem.js');

test('cliente conhecido por telefone vira sugestao de vinculo', () => {
  const r = classificarEntrada({ telefone: '19999140990', texto: 'oi' },
    [{ id: 'PV-2026-0100', telefone: '19999140990', status: 'Aberto' }]);
  assert.strictEqual(r.acao, 'vincular');
  assert.strictEqual(r.atendimentoId, 'PV-2026-0100');
});

test('telefone novo vira atendimento novo', () => {
  const r = classificarEntrada({ telefone: '11888887777', texto: 'quero comprar' }, []);
  assert.strictEqual(r.acao, 'novo');
});

test('atendimento ja fechado nao reabre — abre novo', () => {
  const r = classificarEntrada({ telefone: '19999140990', texto: 'oi' },
    [{ id: 'PV-2026-0100', telefone: '19999140990', status: 'Fechado' }]);
  assert.strictEqual(r.acao, 'novo');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/triagem.test.js`
Expected: FAIL — módulo inexistente

- [ ] **Step 3: Implementar `lib/triagem.js`**

```javascript
// Status que contam como encerrados — mesma lista de statusValidos (:2717)
// menos os que ainda pedem trabalho.
var FECHADOS_TRIAGEM = ['Resolvido', 'Fechado'];

// Normaliza telefone pelos ULTIMOS 8 digitos — mesma regra do :4181, que existe
// porque DDD e o nono digito entram e saem conforme o canal.
function chaveTelefone(tel) {
  return String(tel || '').replace(/\D/g, '').slice(-8);
}

// Decide o que fazer com uma mensagem que chegou: pendurar num atendimento que
// ja esta aberto para aquele telefone, ou abrir um novo. NAO reabre atendimento
// fechado — caso encerrado que volta e assunto novo.
function classificarEntrada(msg, atendimentosAbertos) {
  var alvo = chaveTelefone(msg && msg.telefone);
  var lista = atendimentosAbertos || [];
  if (alvo) {
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (chaveTelefone(a.telefone) !== alvo) continue;
      if (FECHADOS_TRIAGEM.indexOf(String(a.status || '').trim()) !== -1) continue;
      return { acao: 'vincular', atendimentoId: a.id };
    }
  }
  return { acao: 'novo', atendimentoId: '' };
}

if (typeof module !== 'undefined') {
  module.exports = { classificarEntrada, chaveTelefone, FECHADOS_TRIAGEM };
}
```

⚠️ A sugestão é **sugestão** — quem tria confirma na tela (Step 6). A função nunca
grava nada sozinha.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/triagem.test.js`
Expected: PASS (3 testes)

- [ ] **Step 5: Desviar o pull**

Trocar o `appendRow` de `criarAtendimentoViaWhatsApp_` (`:4205`) para gravar na aba nova `CaixaEntrada` (colunas: DATA, TELEFONE, NOME, TEXTO, CANAL, SITUACAO, ATENDIMENTO_ID), com `SITUACAO = 'Nova'`. **Não migrar as 490 antigas** — elas ficam como estão; a triagem começa daqui. Registrar isso no relatório.

- [ ] **Step 6: Tela de triagem**

`caixa-entrada.js`: lista as entradas `Nova`, com a sugestão de `classificarEntrada` já calculada, e dois botões por linha — **Vincular ao PV-XXXX** e **Criar atendimento** — mais **Descartar** (marca `SITUACAO = 'Descartada'`, nunca apaga).

- [ ] **Step 7: Verificar com mensagem real**

Mandar uma mensagem de um número de teste ao WhatsApp do SAC, esperar o pull (roda de 1h em 1h) e conferir que ela caiu em `CaixaEntrada` e **não** na aba `Atendimentos`.

- [ ] **Step 8: Commit**

```bash
git add lib/triagem.js tests/triagem.test.js caixa-entrada.js google-apps-script.js index.html
git commit -m "feat(sac): pull do Respond.io cai em Caixa de Entrada, nao mais direto em Atendimentos

60% da lista (490 de 816) entrava sozinha e ninguem triava; 703 vencidos no SLA.

Constraint: as 490 antigas ficam onde estao — migrar historico nao ajuda a operacao
Rejected: desligar o pull | perderia o rastro de quem chamou no WhatsApp
Confidence: high
Scope-risk: moderate
Directive: Descartar marca situacao, nunca apaga linha
Not-tested: volume de pico (o pull traz ate N contatos por rodada)"
```

---

## Task 7: Aposentar o que não se usa

**Pedido dela (27/07):** *"foram construídas várias funções e creio que a maioria não está sendo utilizada corretamente ou é redundante, preciso fazer um checkup e ajustar."*

**Por que antes do desmembramento:** não se migra peso morto. Toda tela que sobreviver a esta task é uma tela a mais para conferir na Task 8.

**O que a medição de 27/07 já respondeu (não precisa medir de novo):**

| Função | Evidência | Veredito proposto |
|---|---|---|
| `docsVinculados` | 0 de 816 | **não é morta — está quebrada.** A Task 4 conserta; medir de novo depois |
| `ações marcadas` (`acoes`) | 0 de 816 | candidata a remoção |
| Orçamentos | 0 registros desde 21/07 | **decisão dela** — separada há 6 dias, amostra curta demais |
| NPS | 2 respostas / 4 enviados | candidata a repensar (o link chega, ninguém responde) |
| Catálogo · Estoque | 274 peças · 677 itens · 100 movimentações | vivas, não tocar |

**Files:**
- Modify: `google-apps-script.js` (contador de uso por tela)
- Create: `docs/2026-08-XX-aposentadoria-telas.md` (a proposta que ela decide)

**Interfaces:**
- Produces: action `ping_tela` (POST, fire-and-forget) → grava em `UsoTelas` · `resumo_uso_telas` (GET).

- [ ] **Step 1: Contador de uso — por tela, nunca por pessoa**

```javascript
// Conta ABERTURAS DE TELA, sem identificar quem. O objetivo e saber qual
// funcao aposentar, nao vigiar a equipe — por isso nao grava usuario nem IP.
function pingTela(tela) {
  var nome = String(tela || '').slice(0, 40);
  if (!nome) return { ok: false };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName('UsoTelas');
  if (!aba) {
    aba = ss.insertSheet('UsoTelas');
    aba.appendRow(['DATA', 'TELA']);
    aba.getRange(1, 1, 1, 2).setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  aba.appendRow([new Date(), nome]);
  return { ok: true };
}
```

- [ ] **Step 2: Disparar no front**

Em `app.js`, no handler que troca de view (o que já existe para as `nav-tab`), um `fetch` sem `await` e com `.catch(function(){})` — **nunca** pode atrasar ou quebrar a navegação se a rede falhar.

- [ ] **Step 3: Deployar e deixar rodando 2 semanas**

Não interprete antes disso. Uma semana pega só um ciclo de trabalho; duas pegam a virada de mês, que é quando a expedição muda de ritmo.

- [ ] **Step 4: Escrever a proposta e levar para ela decidir**

Uma linha por tela: quantas aberturas em 14 dias, o que ela faz, e uma recomendação entre **manter · fundir com X · aposentar**. Nada é removido nesta task — a decisão é dela, e remoção vira task própria com o commit citando a decisão.

- [ ] **Step 5: Commit**

```bash
git add google-apps-script.js app.js docs/
git commit -m "feat(diag): contador de uso por tela para decidir o que aposentar

Constraint: conta abertura de tela, nunca quem abriu — e para aposentar funcao,
nao para medir pessoa
Constraint: 14 dias de amostra, para pegar a virada de mes
Rejected: decidir so pelos numeros de hoje | orcamentos foi separado ha 6 dias, amostra curta
Confidence: high
Scope-risk: narrow
Directive: nenhuma tela e removida sem decisao dela registrada no commit"
```

---

## Task 8: Desmembrar — Atendimentos e OS saem da planilha da expedição

**Pedido dela (27/07):** *"está tudo na planilha da expedição, e esse é um problema que quero atacar."*

**O padrão já existe e foi provado em 21/07:** `getOrcamentosSheet()` (`:1152`) abre por ID vindo de `ScriptProperty`, com uma constante versionada como reserva, e cria a aba se faltar. A troca é transparente para o front — nenhuma tela muda.

**Ordem importa:** fazer isto **depois** das Tasks 1–7. Se as telas ainda não existem, você migra e fica sem como conferir; e se a Task 7 ainda não rodou, você migra peso morto.

### ⚠️ Estratégia definida por ela em 27/07: DUAL-WRITE, não corte

> *"podemos criar o novo fluxo, mantendo tudo ativo na planilha; quando os novos estiverem funcionais paramos a planilha antiga e só oculto as abas, deixo lá, para não corrermos riscos."*

**Não existe momento de virada.** O novo nasce ao lado do velho, os dois recebem gravação ao mesmo tempo, e a planilha da expedição continua funcionando o tempo inteiro. Quando o novo estiver provado, o script **para de escrever** no velho e as abas são **ocultadas** — nunca apagadas, nunca renomeadas.

**Este é o padrão que já deu certo duas vezes aqui:** o dual-write da logística (25/07, Firebase + Excel — provado ponta a ponta em 26/07) e o `espelharOS_` (`:2504`) que já vive neste mesmo arquivo espelhando OS nas abas Sumaré/parceiras. **Reuse `espelharOS_` como molde — não invente um mecanismo novo.**

As 4 fases, e nenhuma começa sem a anterior verificada:

| Fase | Escreve em | Lê de | Fim da fase |
|---|---|---|---|
| A | velho | velho | planilhas destino criadas e vazias |
| B | **velho + novo** | velho | contagens batem por 3 dias seguidos |
| C | **velho + novo** | **novo** | 7 dias sem incidente |
| D | novo | novo | abas antigas **ocultadas** |

**Files:**
- Modify: `google-apps-script.js` (`getAtendimentosSheet()`, `getAssistenciasSheet()`, `espelharNoAntigo_()` + `setup*Spreadsheet()`)

- [ ] **Step 1: Backup** — cópia da planilha, como na Task 5 Step 1. Mesmo com dual-write: o backup é o que permite errar sem medo.

- [ ] **Step 2 (Fase A): Criar as planilhas destino**

`setupAtendimentosSpreadsheet()` e `setupAssistenciasSpreadsheet()` espelhando `setupOrcamentosSpreadsheet()` (`:1218`): cria a planilha **sob a conta do script** (`openById` exige que quem executa seja dono ou tenha acesso — foi o tropeço de 21/07), põe na pasta `SAC`, grava o ID em `ScriptProperties` (`ATENDIMENTOS_SHEET_ID`, `ASSISTENCIAS_SHEET_ID`) e formata como texto as colunas de data (Sheets converte `"yyyy-MM-dd"` em `Date` na gravação — o motivo do `fmtDataOrc_`).

Verificar: as duas planilhas existem, com cabeçalho e **zero linhas de dado**.

- [ ] **Step 3 (Fase B): Ligar o dual-write**

```javascript
// Flag de fase, para a virada ser um valor de configuracao e nao um deploy.
// 'A' = so velho · 'B'/'C' = os dois · 'D' = so novo.
function faseSeparacao_() {
  return getProperty('FASE_SEPARACAO_SAC') || 'A';
}

// Espelha uma gravacao na aba antiga. Best-effort: NUNCA bloqueia o fluxo —
// mesmo contrato de espelharOS_ (:2504), que ja faz isso neste arquivo.
// Em fase D nao escreve mais no antigo, mas a funcao continua existindo:
// e o caminho de volta se algo der errado.
function espelharNoAntigo_(nomeAba, linha) {
  if (faseSeparacao_() === 'D') return;
  try {
    var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nomeAba);
    if (aba) aba.appendRow(linha);
  } catch (e) { /* espelho nunca derruba a gravacao principal */ }
}
```

Trocar `ss.getSheetByName(SHEET_ATENDIMENTOS)` por `getAtendimentosSheet()` em todas as ocorrências (e o mesmo para `ABA_ASSISTENCIAS`), e em cada `appendRow` acrescentar a chamada de espelho. Contar antes para saber o tamanho da troca:

```bash
grep -c "getSheetByName(SHEET_ATENDIMENTOS)" google-apps-script.js
grep -c "getSheetByName(ABA_ASSISTENCIAS)" google-apps-script.js
```

⚠️ `buscarClienteConsolidado` lê **as duas** fontes — foi exatamente onde a separação dos orçamentos quebrou em 21/07 e precisou do fix de 22/07 (v42). Conferir essa função linha a linha, e **em fase B/C ela deve ler do velho** para não mostrar histórico pela metade.

- [ ] **Step 4 (Fase B): Backfill do histórico, sem tocar no original**

Rotina `copiar_atendimentos_v1` com dry-run: **copia** (nunca move) as linhas existentes para a planilha nova. A aba antiga sai desta task exatamente como entrou — mesmas linhas, mesma ordem.

- [ ] **Step 5 (Fase B): Conferência de 3 dias**

Comparar as contagens todo dia. Só passa para a fase C quando bater 3 dias seguidos:

```bash
U='https://script.google.com/macros/s/AKfycbytZgFvvhTvYRgufyvFTGbMb27sxHnIQp256XQ6r7VZuX2B0RTdO3MIpbf4EcF8KgnYlw/exec'
curl -sL "$U?action=conferir_dual_write" | python -c "
import sys,json
d=json.load(sys.stdin)
for k,v in d.get('comparacao',{}).items():
    ok='OK ' if v['antigo']==v['novo'] else 'DIVERGE'
    print(f\"{ok} {k}: antigo={v['antigo']} novo={v['novo']}\")
"
```

Escrever `conferirDualWrite()` que devolve `{comparacao:{atendimentos:{antigo,novo}, os:{antigo,novo}}}`. **Divergência não é motivo de pânico** — é motivo de olhar qual gravação não espelhou, corrigir e reiniciar a contagem dos 3 dias.

- [ ] **Step 6 (Fase C): Virar só a LEITURA**

`setProperty('FASE_SEPARACAO_SAC', 'C')` e apontar as leituras para a planilha nova. **A gravação continua nas duas.** Se algo quebrar aqui, o rollback é voltar a flag para `'B'` — sem deploy, sem perda, porque o velho nunca parou de receber.

- [ ] **Step 7 (Fase D): Parar o velho e OCULTAR as abas**

Depois de 7 dias em fase C sem incidente: `setProperty('FASE_SEPARACAO_SAC', 'D')`. Aí, **na mão, na planilha**: botão direito na aba → **Ocultar planilha**. Nas abas `Atendimentos`, `AssistenciasTecnicas` e as de espelho que saíram de uso.

**NÃO apagar. NÃO renomear.** Renomear foi a causa do incidente de 06/07 — o script recriou a aba vazia e a numeração de OS voltou ao 0001, duplicando 93 números que até hoje dão trabalho. Ocultar não muda nome nem conteúdo: o script continua achando a aba se precisar.

- [ ] **Step 8: Commit**

```bash
git add google-apps-script.js
git commit -m "refactor(sac): Atendimentos e OS saem da expedicao por dual-write, sem corte

A planilha 'Pedido de pecas' (3,78 MB) virou o banco do SAC inteiro. A separacao
acontece em 4 fases com flag em ScriptProperty (A/B/C/D): o novo nasce ao lado,
os dois recebem gravacao, a leitura vira depois, e o velho so para no fim.

Constraint: estrategia definida por ela em 27/07 — dual-write, nunca corte
Constraint: aba antiga e OCULTADA, nunca apagada nem renomeada (renomear causou
  o incidente de 06/07: aba recriada vazia, numeracao de OS de volta ao 0001)
Constraint: buscarClienteConsolidado le as duas fontes — foi o que quebrou em 21/07
Rejected: migrar e cortar | risco sem rollback numa planilha que a operacao usa hoje
Rejected: mecanismo novo de espelho | espelharOS_ (:2504) ja faz isso neste arquivo
Confidence: high
Scope-risk: broad
Directive: rollback de qualquer fase e voltar a flag FASE_SEPARACAO_SAC, sem deploy
Directive: nenhuma tela do front muda — se precisou mexer no front, a separacao esta errada
Not-tested: limite de 6 min de execucao do Apps Script no backfill com o volume total"
```

---

## Task 9: Guia da equipe e treinamento

**Pedido dela:** *"preciso ver o que temos e ensinar os usuarios as ferramentas."*

**Files:**
- Create: `docs/GUIA-SAC-EQUIPE.md`
- Modify: `app.js` (bloco de ajuda na home)

- [ ] **Step 1: Escrever o guia**

Uma página por pergunta que a equipe fez de verdade — não um manual de telas:

1. **"Onde eu altero o status?"** → aba OS, cartão, seletor de status. Print.
2. **"O cliente sumiu, não acho nem por nome nem por OS"** → campo de busca aceita o número da OS agora; se aparecer duas vezes, confira pela data.
3. **"Por que o registro é PV e o papel é OS?"** → `PV-` é o caso (a conversa inteira), `OS-` é o documento da assistência dentro dele. Um caso pode ter várias OS. O cartão do `PV-` mostra as OS ligadas.
4. **"Abri a OS pela aba Assistências e ela sumiu"** → não abre mais sem protocolo; se não tiver, o próprio formulário cria.
5. **"O que é a Caixa de Entrada?"** → tudo que chega do WhatsApp cai lá; vira atendimento quando alguém tria. Atendimento aberto é trabalho de alguém.
6. **Pedido de peças** → continua sendo a ferramenta da expedição, e só isso.

- [ ] **Step 2: Ajuda dentro da tela**

Em `app.js`, o bloco de passos da home (`:146`) já explica o protocolo `PV-AAAA-NNNN`. Acrescentar dois passos: a diferença `PV-` × `OS-` e onde se move o status.

- [ ] **Step 3: Rodar o treino e anotar o que eles perguntam**

Sessão curta com quem atende. **As perguntas que sobrarem viram a próxima rodada do guia** — se a mesma dúvida aparecer duas vezes, é defeito de tela, não de treino.

- [ ] **Step 4: Commit**

```bash
git add docs/GUIA-SAC-EQUIPE.md app.js
git commit -m "docs(sac): guia da equipe organizado pelas duvidas reais do time

Confidence: high
Scope-risk: narrow
Directive: duvida repetida duas vezes e defeito de tela, nao falta de treino"
```

---

## Critérios de aceite do plano inteiro

| # | Critério | Como provar |
|---|---|---|
| 1 | O caso do Wesley não acontece mais | `curl "$U?action=buscar_os&numero=OS-2026-0426"` devolve resultado |
| 2 | Existe onde mudar o status da OS | mudar na aba OS e ver a timeline do QR andar |
| 3 | Toda OS nova nasce ligada a um atendimento | `listar_os&semVinculo=sim` para de crescer |
| 4 | A lista de Atendimentos volta a ser fila de trabalho | abertos caem de 787 para a ordem de grandeza dos casos reais |
| 5 | A expedição volta a ser só expedição | `inventario_abas` na planilha antiga sem `Atendimentos`/`AssistenciasTecnicas` ativas |
| 6 | Nenhuma tela sobrevive sem justificativa | proposta da Task 7 decidida por ela, tela a tela |
| 7 | A equipe sabe usar | as 6 perguntas do guia não voltam |

## Riscos anotados

- **Prazo do webhook Meta (05/08).** Se o WhatsApp do SAC cair, a Caixa de Entrada (Task 6) fica vazia e a Task 8 perde a forma de conferir. Não é deste plano, mas é o relógio que corre por fora.
- **Limite de 6 minutos** de execução do Apps Script nas rotinas de migração (Tasks 5 e 8) com planilha de 3,78 MB. Se estourar, quebrar em lotes com cursor em `DocumentProperties`.
- **Front em cache.** Loja/atendente com bundle velho continua vendo o formulário antigo de OS. O bump de `?v=` cobre, mas a lição de 27/07 do dash (aparelho preso por dias em `max-age=3600`) vale aqui: conferir o cabeçalho `Cache-Control` do GitHub Pages antes de culpar o código.
- **A Task 8 é a mais arriscada** e é a que ela mais quer (tirar tudo de cima da planilha da expedição). Ela vem quase no fim de propósito: sem as telas das Tasks 1–4, não há como conferir que a migração não perdeu nada.
