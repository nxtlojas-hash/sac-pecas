# Design — Estoque de Peças (Movimentações + Inventário)

**Data:** 2026-05-15
**Status:** Spec aprovada — aguardando plano de implementação
**Autor:** Claudia Moraes (NXT) + Claude Code
**Precedência:** Esta fase entra antes da reformulação do Atendimento (decidido durante brainstorming)

## Contexto

O `sac-pecas` (em produção em https://nxtlojas-hash.github.io/sac-pecas/) já controla **saldo atual** de peças por modelo:

- Aba `Estoque` no Google Sheets (modelo, peça, quantidade)
- Endpoints no Apps Script: `listar_estoque`, `buscar_estoque`, `atualizar_estoque`, `baixa_estoque`
- Atualização manual via tela Admin
- Baixa automática quando uma venda é registrada (`baixa_estoque`)

**Gap atual:** nenhuma trilha de auditoria. Não há como saber **quando, quem, ou por que** o saldo mudou. Quando o saldo da planilha diverge do estoque físico, não há como reconciliar — e divergir é normal porque peças entram de várias formas (compra, desmontagem de motos, devolução, ajustes manuais) sem registro.

A operação real informa que:
- Muitas peças entram por **desmontagem de motos** (não é compra com NF)
- Acontecem **ajustes** por perda, quebra, contagem errada
- O **saldo precisa de inventário inicial** (contagem física baseline) e depois recontagens periódicas
- O controle precisa ser **simples** — sem campos demais

## Objetivos

1. **Histórico completo de movimentações** — toda mudança de saldo é registrada com data, tipo, peça, qtd, origem, operador
2. **Entrada simples** — uma única forma de registrar entrada, com campo de origem em texto livre (cobre compra, desmontagem, devolução, qualquer cenário)
3. **Inventário** — modo de contagem em lote pra estabelecer saldo inicial e reconciliar discrepâncias periodicamente
4. **Saída automática integrada** — baixa por venda continua automática mas passa a deixar trilha na tabela de movimentações
5. **Ajuste manual rastreado** — corrigir saldo (+/-) com motivo obrigatório e operador identificado
6. **Não disrupção** — aba `Estoque` atual mantida como saldo; só ganha uma irmã `MovimentacoesEstoque` pra histórico

## Não-objetivos

- Sem novos armazéns além dos atuais (Sumaré e Jaraguá já existem na aba `Estoque`)
- Sem controle de validade, lote ou número de série
- Sem custo médio, FIFO ou contabilidade fiscal
- Sem aprovação/workflow de movimentação (operador registra direto)
- Sem migração de saldo antigo — inventário inicial via tela do app, faz parte do uso
- Sem integração com Bling no escopo desta fase (mantém manual)

## Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (HTML/CSS/JS vanilla, GitHub Pages)                │
│  Nova aba "Estoque" com 3 sub-telas:                         │
│  ┌─────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ Saldo   │  │ Movimentar │  │ Inventario │                 │
│  └─────────┘  └────────────┘  └────────────┘                 │
└────────────────────────┬─────────────────────────────────────┘
                         │ fetch POST/GET (action=...)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Google Apps Script (backend)                                │
│  Endpoints novos:                                            │
│  - registrar_movimentacao     (POST)                         │
│  - listar_movimentacoes       (GET, com filtros)             │
│  - registrar_inventario_lote  (POST, recebe array de Qtds)   │
│  Endpoint atualizado:                                        │
│  - baixa_estoque              (passa a criar 1 mov tipo Saida)│
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Google Sheets                                               │
│  Aba existente: Estoque              (saldo atual)           │
│  Aba NOVA:      MovimentacoesEstoque (historico completo)    │
└──────────────────────────────────────────────────────────────┘
```

## Modelo de Dados

### Aba `MovimentacoesEstoque` (nova)

| Col | Campo | Tipo | Obrigatório | Descrição |
|-----|-------|------|-------------|-----------|
| A | `id` | string | sim | `MOV-2026-NNNN` (sequencial via LockService) |
| B | `dataHora` | datetime | sim | Timestamp ISO |
| C | `tipo` | string | sim | `Entrada` / `Saida` / `Ajuste` |
| D | `armazem` | string | sim | `Sumare` / `Jaragua` (armazém onde a movimentação aconteceu) |
| E | `modelo` | string | sim | Modelo da peça (Jaya, Akasha, etc) |
| F | `peca` | string | sim | Nome da peça (Espelho Esq, Para-choque, etc) |
| G | `quantidade` | number | sim | Sinal positivo (Entrada/Ajuste+) ou negativo (Saída/Ajuste-) |
| H | `origem` | string | sim | Texto livre — "Desmontagem moto NXT123", "Compra fornecedor X", "Inventário inicial", "Baixa venda PCA-XXX", "Perda", "Encontrado" |
| I | `operador` | string | sim | Quem registrou (texto livre) |
| J | `observacoes` | text | não | Notas adicionais |
| K | `docVinculado` | string | não | ID do doc relacionado (ex: `PCA-2026-0042` quando for baixa de venda) |

### Aba `Estoque` (existente — sem mudança estrutural)

Mantém colunas atuais. Saldo é recalculado a partir de cada movimentação aplicada.

## Componentes (Frontend)

Nova aba "Estoque" no nav principal, com sub-tabs internas:

### Sub-tela 1: Saldo

- Lista todas as peças do catálogo com saldo atual
- Filtros: por modelo, por peça (busca), só com saldo / só zerados
- Visual: tabela compacta (Modelo, Peça, Qtd)
- Botão "Atualizar" — refresh do servidor

### Sub-tela 2: Movimentar

Form único pra Entrada, Saída manual ou Ajuste:

- **Tipo** (select): Entrada / Saída / Ajuste
- **Armazém** (select): Sumaré / Jaraguá
- **Modelo** (select do catálogo)
- **Peça** (select dinâmico baseado no modelo)
- **Quantidade** (number — frontend converte para sinal correto baseado em Tipo)
- **Origem** (text livre, com sugestões: "Desmontagem moto [chassi]", "Compra fornecedor", "Inventário inicial", "Perda", "Encontrado", "Devolução cliente")
- **Operador** (text livre + datalist com últimos operadores via localStorage)
- **Observações** (textarea, opcional)
- Botões: Limpar / Registrar

Após registrar, mostra feedback verde + saldo atualizado da peça.

### Sub-tela 3: Inventário

Modo de contagem em lote:

1. Lista todas as peças do catálogo (uma por linha)
2. Cada linha mostra: Modelo | Peça | Saldo atual no sistema | **Campo "Contado"** (qtd física)
3. Operador percorre, conta fisicamente, digita a qtd real em cada campo
4. Linhas com diferença ≠ 0 são destacadas
5. Campo "Operador" + "Observação do inventário" (ex: "Inventário fim de trimestre Q2 2026")
6. Botão "Confirmar inventário"
7. Ao confirmar, gera 1 movimentação tipo `Ajuste` pra cada peça com diferença (qtd = contado - saldo atual)
8. Origem: `Inventario YYYY-MM-DD` + observação
9. Mostra resumo final (N ajustes feitos, total de unidades movidas)

**Inventário inicial é caso especial:** saldo atual = 0 em tudo (planilha vazia). Operador conta o que tem hoje, digita as qtds, confirma → gera N Entradas (todas Ajustes positivos) com origem `Inventário inicial 2026-05-15`.

## Fluxos

### Fluxo 1: Inventário inicial (uma vez)

```
Admin abre aba Estoque → Inventário
Lista carrega com saldos 0 ou existentes
Operador conta fisicamente cada peça
Digita Contado=8, Contado=12, etc
Operador="Pedro" + Observação="Inventário inicial"
Confirmar
  ↓
Backend recebe lote, gera 1 movimentação Ajuste por peça com diferença
Atualiza saldos na aba Estoque
  ↓
Retorna: "47 ajustes feitos, 312 unidades registradas"
```

### Fluxo 2: Entrada simples (desmontagem)

```
Operador abre aba Estoque → Movimentar
Tipo=Entrada, Modelo=Jaya, Peça=Espelho Esq, Qtd=3
Origem="Desmontagem moto chassi NXT2026X4471"
Operador="Pedro"
Registrar
  ↓
Backend: cria MOV-2026-0042, atualiza Estoque[Jaya/Espelho Esq] += 3
  ↓
Frontend: feedback verde "Entrada registrada. Saldo atual: 11 un"
```

### Fluxo 3: Saída por venda (automática, atualizada)

```
Vendedor registra venda no fluxo atual (Registrar) — cria PCA-2026-0123
Apps Script chama baixa_estoque pra cada item da venda
  ↓
Em vez de só subtrair saldo, baixa_estoque agora:
1. Cria MOV-2026-0042 tipo=Saida, qtd=-N, origem="Baixa venda PCA-2026-0123", operador=vendedor da venda, docVinculado=PCA-2026-0123
2. Atualiza saldo na aba Estoque
  ↓
Toda saída tem rastro
```

### Fluxo 4: Ajuste manual

```
Operador percebe que saldo de "Para-choque Jaya" está 5 no sistema mas só 3 no físico
Abre Estoque → Movimentar
Tipo=Ajuste, Modelo=Jaya, Peça=Para-choque, Qtd=-2
Origem="Perda" (ou "Encontrado" se fosse a mais)
Operador="Maria" + Obs="Quebra durante manuseio"
Registrar
  ↓
Backend: cria MOV tipo=Ajuste, atualiza Estoque[-2]
```

## Apps Script — Funções (esqueleto)

```javascript
// Constantes
var ABA_MOVIMENTACOES = 'MovimentacoesEstoque';

// Endpoint: registrar uma movimentação avulsa
function registrarMovimentacao(payload) {
  // 1. Valida payload (tipo, modelo, peça, qtd, origem, operador obrigatórios)
  // 2. Aplica sinal correto à qtd (Saida vira negativo)
  // 3. Gera MOV-2026-NNNN via LockService
  // 4. Append na aba MovimentacoesEstoque
  // 5. Atualiza saldo na aba Estoque (cria peça se não existir)
  // 6. Retorna { sucesso: true, id, saldoAtual }
}

// Endpoint: registrar inventário em lote
function registrarInventarioLote(payload) {
  // payload = { operador, observacao, contagens: [{modelo, peca, contado}] }
  // Pra cada item:
  //   - Lê saldo atual
  //   - Calcula diferença
  //   - Se diferença != 0, cria 1 Ajuste
  // Retorna { sucesso: true, totalAjustes, totalUnidades }
}

// Endpoint: listar movimentações com filtros
function listarMovimentacoes(filtros) {
  // filtros: { dataDe, dataAte, tipo, modelo, peca, operador }
  // Retorna lista paginada (últimas 100 por default)
}

// Update do baixa_estoque existente
function baixaEstoque(body) {
  // Já existe — adicionar:
  // 1. Antes de atualizar saldo, criar registro em MovimentacoesEstoque
  //    tipo=Saida, qtd=-N, origem="Baixa venda <docId>", operador=<vendedor>, docVinculado=<docId>
  // 2. Resto do código continua
}

// Helper: gerador de ID com LockService
function gerarProximoIdMovimentacao() {
  // MOV-YYYY-NNNN sequencial
}

// Setup: criar aba MovimentacoesEstoque (idempotente)
function setupMovimentacoesEstoque() {
  // Cria aba + cabeçalhos + congela linha 1
}
```

## Plano de Implantação (5 fases)

Cada fase é incremental, commit/push isolado, sem quebrar produção atual.

### Fase E1 — Backend MovimentacoesEstoque (esforço: 2-3h)

- `setupMovimentacoesEstoque()` (idempotente) — cria a aba com cabeçalhos
- Constantes + helper `gerarProximoIdMovimentacao()`
- `registrarMovimentacao(payload)` + case no doPost
- `listarMovimentacoes(filtros)` + case no doGet
- Sem mudança no frontend ainda

### Fase E2 — Sub-tela "Movimentar" (esforço: 3-4h)

- Nova aba "Estoque" no nav principal do `index.html`
- `estoque.js` com IIFE + view principal contendo 3 sub-tabs (inicialmente só "Movimentar" funcional)
- Form de Tipo + Modelo + Peça + Qtd + Origem + Operador + Obs
- Submit chama `registrar_movimentacao`
- Feedback de sucesso + saldo atualizado da peça
- Datalist de operadores em localStorage (padrão do `form-estoque`)

### Fase E3 — Sub-tela "Inventário" (esforço: 3-5h)

- Sub-tab "Inventário" no `estoque.js`
- Lista todas as peças do catálogo (de `data.js` `CATALOGO_MODELOS`)
- Pra cada peça: linha com Modelo | Peça | Saldo atual | Input "Contado"
- Highlight em linhas com diferença ≠ 0
- Header com Operador + Observação geral
- Botão "Confirmar inventário" → chama `registrar_inventario_lote`
- Modal de resultado: N ajustes, total movido

### Fase E4 — Integrar baixa_estoque (esforço: 1h)

- Atualizar `baixaEstoque` no Apps Script pra criar registro em `MovimentacoesEstoque` antes de subtrair saldo
- Sem mudança no frontend
- Vendas a partir desta fase ganham trilha automática

### Fase E5 — Sub-tela "Saldo" (esforço: 2-3h)

- Sub-tab "Saldo" no `estoque.js`
- Lista de todas as peças com saldo (consulta `listar_estoque`)
- Filtros: modelo, busca por peça, só com saldo / só zerados
- Sem edição direta (saldo é consequência de movimentações)
- Botão "Refresh"

## Tratamento de Erros

- **Apps Script offline/timeout**: feedback visual de erro, form preservado, botão "Tentar de novo"
- **Saldo negativo** (Saída maior que disponível): aviso "Saldo ficará negativo (atual: 2, saída: 5). Confirmar?" mas permite — pode haver casos legítimos de correção
- **Peça não existe na aba Estoque**: cria automaticamente com saldo 0 antes de aplicar movimentação
- **ID concorrente**: `LockService` no gerador de MOV (igual ao `gerarProximoIdAtendimento`)
- **Inventário com tela travada**: dados salvos no localStorage durante digitação, recuperáveis em refresh

## Estratégia de Teste

Sem suite automatizada (mantém padrão do projeto). Validação manual por fase:

- **E1**: chama endpoint via Apps Script Editor (função Test), confere linha aparece na aba
- **E2**: registra Entrada de teste, confere movimentação na aba + saldo atualizado
- **E3**: inventário com 3 peças, 2 com diferença → vê 2 ajustes criados
- **E4**: registra venda real → vê movimentação Saida criada com docVinculado
- **E5**: lista todos saldos, filtra por modelo

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Sheets lento com muitas movimentações (>10k linhas) | Indexar por data, paginar listagem (últimos 100). Em 1+ ano, avaliar migração das mov antigas pra outra aba |
| Operador esquece de registrar entrada (peça aparece "do nada") | Tela Movimentar é a única forma de entrar peça; cultura + treinamento. Inventário periódico recupera divergências |
| Saldo negativo silencioso | Inventário detecta. Pode adicionar relatório "peças com saldo negativo" depois |
| Inventário interrompido perde dados | Salvar a cada digitação no localStorage, recuperar em refresh |
| Conflito de update simultâneo no saldo | `LockService` no Apps Script serializa updates |

## Próximo passo

Após aprovação desta spec, invocar `superpowers:writing-plans` pra gerar plano detalhado de implementação da Fase E1 + E2 (backend + sub-tela Movimentar) numa primeira rodada. Fases E3-E5 ganham seus próprios planos depois.
