# Design — NXT SAC Fase 2: Wizard de Atendimento + Aba Clientes

**Data:** 2026-05-15
**Status:** Spec aprovada (decisões consolidadas no brainstorming anterior)
**Autor:** Claudia Moraes (NXT) + Claude Code
**Precedência:** Fase 1 do NXT SAC (rebrand + form Atendimento simples) já em produção. Esta fase substitui o form simples por um wizard guiado.

## Contexto

A Fase 1 entregou o `sac-pecas` rebrandado como NXT SAC com uma aba "Atendimento" que registra um protocolo `PV-2026-NNNN` em planilha. O form é uma única tela com cliente, categoria, motivo, descrição e vendedor.

A operação real mostrou 2 gaps:
- **Atendimentos nasciam isolados.** Cada PCA, ORC e OS continuava sendo criado avulso, sem vínculo ao atendimento. Resultado: bagunça na planilha, sem rastreabilidade do que originou cada documento.
- **Histórico fragmentado por cliente.** Nada agrega o que aconteceu com um CPF/telefone: vendas, orçamentos e OS ficam dispersos nas suas próprias abas.

Esta fase resolve os dois gaps:
1. Atendimento vira ponto de entrada obrigatório, com fluxo de wizard que gera dentro dele venda, orçamento e/ou OS já vinculados via `atendimentoId`
2. Nova aba "Clientes" busca CPF/telefone em todas as abas (atendimentos novos, vendas, orçamentos, OSes — inclusive os legados sem vínculo) e mostra timeline cronológica unificada

## Objetivos

1. **Wizard de Atendimento (5 passos)** substituindo o form simples atual
2. **Atendimento como entrada única** de venda, orçamento e OS para casos NOVOS
3. **Legados preservados** — docs antigos (sem `atendimentoId`) continuam intactos, ficam visíveis na timeline por CPF/telefone
4. **Aba "Clientes"** com busca + timeline cronológica unificada
5. **Vinculação retroativa opcional** — ao abrir atendimento de cliente antigo, oferece "vincular docs anteriores deste CPF"
6. **Coluna `atendimentoId` opcional** nas abas Vendas, Orcamentos, OSes para o vínculo
7. Manter stack atual (HTML/CSS/JS + Apps Script + Sheets), zero infra nova

## Não-objetivos

- Sem migração em massa dos legados (preservativa)
- Sem integração Respond.io nesta fase (fica pendente)
- Sem dashboard de SLA ou NPS automático nesta fase
- Sem mudança no fluxo de Estoque (já entregue)
- Sem rota separada — o wizard ocupa a aba "Atendimento" que já existe

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (HTML/CSS/JS vanilla)                             │
│                                                             │
│  Aba Atendimento (REFORMULADA):                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Wizard 5 passos                                    │  │
│   │  1.Cliente → 2.Motivo → 3.Ações → 4.Preench → 5.OK  │  │
│   │  Header com stepper visual                          │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Aba Clientes (NOVA):                                       │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Busca CPF/Telefone → Timeline cronológica          │  │
│   │  Aparece: atendimentos + vendas + ORCs + OSes       │  │
│   └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────┘
                                  │ fetch
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Apps Script — endpoints novos:                             │
│  - buscar_cliente_consolidado (GET por CPF ou telefone)     │
│  - listar_atendimentos (com filtros)                        │
│  - vincular_doc_atendimento (POST: docId, atendimentoId)    │
│  Endpoints existentes ganham coluna atendimentoId:          │
│  - registrar_venda, salvar_orcamento, registrar_os          │
└─────────────────────────────────┬───────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Google Sheets                                              │
│  Atendimentos:    +ações (JSON) +docsVinculados (JSON)      │
│  Vendas, Orcamentos, OSes: +atendimentoId (string, opcional)│
└─────────────────────────────────────────────────────────────┘
```

## Modelo de Dados

### Aba `Atendimentos` (existente — adiciona 2 colunas)

| Col | Campo | Tipo | Obrig. | Descrição |
|-----|-------|------|--------|-----------|
| A-P | (campos atuais da Fase 1) | | | id, dataAbertura, categoria, motivo, origem, nomeCliente, telefone, cpfCnpj, notaFiscal, modeloEquipamento, descricao, vendedor, status, dataFechamento, motivoFechamento, npsEnviado |
| Q | `acoes` | string (JSON) | não | `["venda", "orcamento", "os"]` — ações marcadas no passo 3 |
| R | `docsVinculados` | string (JSON) | não | `["PCA-...", "ORC-...", "OS-..."]` — preenchido conforme docs são criados ou vinculados |

### Abas existentes (Vendas, Orcamentos, OSes) — adiciona 1 coluna

| Coluna nova | Tipo | Obrig. | Descrição |
|-------------|------|--------|-----------|
| `atendimentoId` | string | não | `PV-2026-NNNN` ou vazio (legado) |

Legados ficam com `atendimentoId` vazio — não recebem migração.

## Fluxo do Wizard (5 passos)

### Passo 1: Cliente

- Campo de **busca CPF / telefone** (input livre + botão "Buscar")
- Ao buscar, Apps Script faz scan nas 4 abas (Atendimentos, Vendas, Orcamentos, OSes) por chave
- **Cliente existente**: mostra card com último nome, telefone, endereço, NF, modelo (puxados do registro mais recente). Botão "Confirmar e continuar"
- **Cliente novo**: form de cadastro mínimo (nome, telefone, CPF, modelo opcional, NF opcional)
- Botão "Próximo →" libera quando dados básicos presentes

### Passo 2: Motivo

- Categoria (select): Pré-venda / Pós-venda / Outro
- Motivo (select dinâmico baseado em categoria, igual à Fase 1)
- Origem (select): WhatsApp / Telefone / Loja / Site / Outro
- NF (campo) — obrigatório só se categoria=Pós-venda
- Descrição (textarea)
- Vendedor (input com datalist localStorage)
- Botões: ← Voltar / Próximo →

### Passo 3: Ações

Checkboxes multi-select:
- ☐ Registrar venda de peças
- ☐ Gerar orçamento de peças
- ☐ Abrir OS de assistência
- ☐ Apenas registrar atendimento (sem documentos)

Pelo menos 1 deve estar marcada. Ao escolher "Apenas registrar", as outras desabilitam.

Botões: ← Voltar / Próximo →

### Passo 4: Preenchimento

Renderização condicional baseada nas ações marcadas no passo 3:

- **Se Venda/Orçamento marcado**: sub-form de peças (modelo+peça+qtd+chassi opcional+preço+ frete + pagamento se venda)
- **Se OS marcado**: sub-form de OS (assistência, problema, equipamento — campos da OS atual)

Cada sub-form reaproveita lógica dos forms existentes. Dados do cliente vêm pré-preenchidos do passo 1.

Botões: ← Voltar / Próximo →

### Passo 5: Fechamento

- Resumo de tudo: dados do cliente + motivo + ações realizadas (com IDs gerados — PCA-XXX, ORC-XXX, OS-XXX)
- Status do atendimento (select): Resolvido / Em andamento / Aguardando cliente / Fechado
- Ações finais:
  - Botão "💾 Salvar atendimento" → grava na aba Atendimentos com `acoes` + `docsVinculados`, gera os docs (PCA/ORC/OS) com `atendimentoId` preenchido
  - Botão "📱 Enviar resumo WhatsApp" (após salvar) → mensagem com todos os IDs gerados
  - Botão "📄 PDF do atendimento" (após salvar) — opcional, pode ficar pra fase futura

## Aba Clientes (nova)

### Tela principal

- Input grande de busca: "Buscar cliente por CPF, telefone ou nome"
- Lista de últimos clientes consultados (localStorage, 10 recentes)
- Botão "Buscar"

### Resultado da busca

Para cada cliente encontrado (pode haver múltiplos com mesmo nome):
- Card com nome, CPF, telefone, NF (todas as NFs encontradas)
- Botão "Ver timeline"

### Timeline

- Header: nome, contatos, totais (N atendimentos, N vendas, N OSes)
- Linha do tempo (mais recente primeiro), cada evento mostra:
  - Ícone do tipo (📝 atendimento / 🛒 venda / 📄 orçamento / 🔧 OS)
  - Data
  - ID do doc
  - Resumo (motivo / itens / equipamento)
  - Badge "Sem atendimento" para legados (cinza)
  - Badge `PV-XXX` para vinculados (verde lime)
- Click expande detalhes

### Vinculação retroativa

Quando abrir um cliente que tem docs legados (sem `atendimentoId`), aparece banner:
- "Este cliente tem N documentos anteriores sem vínculo. [Vincular ao próximo atendimento]"
- Quando vendedor inicia novo atendimento desse cliente, oferece "Vincular os 3 docs anteriores a este atendimento?"

## Apps Script — Endpoints

```javascript
// NOVO
function buscarClienteConsolidado(query) {
  // query: { cpf?, telefone?, nome? }
  // Scan nas 4 abas, agrupa por chave (CPF se houver, senão telefone)
  // Retorna: {
  //   clientes: [
  //     {
  //       chave: 'CPF:123.456...' | 'TEL:5511...',
  //       nome, cpf, telefone, ufs[],
  //       nfs: ['NF-001', ...],
  //       eventos: [
  //         { tipo, id, data, resumo, atendimentoId, ... }
  //       ]
  //     }
  //   ]
  // }
}

// NOVO
function listarAtendimentos(filtros) {
  // filtros: { status, categoria, vendedor, dataDe, dataAte, busca }
  // Retorna últimos 100 ordenados por data desc
}

// NOVO
function vincularDocAtendimento(payload) {
  // payload: { atendimentoId, tipoDoc ('venda'|'orcamento'|'os'), docId }
  // 1. Acha doc na aba correspondente, preenche atendimentoId
  // 2. Atualiza coluna docsVinculados do atendimento (append JSON)
  // 3. Retorna { sucesso, atendimento atualizado }
}

// MODIFICADO — registrarAtendimento ganha:
//  - aceita 'acoes' (JSON) no payload
//  - aceita 'docsVinculados' (JSON) inicial vazio
//  - se 'acoes' incluir venda/orcamento/os e payload contiver dadosVenda/dadosOrcamento/dadosOS,
//    chama internamente registrarVenda/salvarOrcamento/registrarOS com atendimentoId
//    e popula docsVinculados com os IDs retornados

// MODIFICADO — registrarVenda, salvarOrcamento, registrarOS:
//  - aceitam atendimentoId opcional no payload
//  - se presente, grava na nova coluna 'atendimentoId' da respectiva aba
```

## Plano de Implantação (sub-fases)

| Sub-fase | Entrega | Quebra produção? |
|----------|---------|-------------------|
| **2a — Backend extension** | Apps Script: colunas atendimentoId nas 3 abas, endpoints `buscar_cliente_consolidado` + `listar_atendimentos` + `vincular_doc_atendimento`. Forms atuais aceitam atendimentoId opcional | Não (campo opcional) |
| **2b — Aba Clientes** | Tela nova: busca + timeline cronológica unificada | Não (leitura pura) |
| **2c — Wizard skeleton** | Nova UI do Atendimento com stepper visual 5 passos navegáveis, conteúdo vazio | Não (em paralelo ao form atual via flag) |
| **2d — Wizard passos 1-3** | Implementar Cliente (busca+confirmação), Motivo, Ações (multi-select) | Não |
| **2e — Wizard passo 4** | Sub-forms condicionais (venda, orçamento, OS) reaproveitando lógica existente | Não |
| **2f — Wizard passo 5 + integração** | Fechamento + salvamento orquestrado (atendimento + docs gerados vinculados) | Sim (substitui form simples atual) |
| **2g — Vinculação retroativa** | Banner em Clientes + ação de vincular legados | Não |

Cada sub-fase tem seu próprio plano e commit. 2a é fundamento.

## Tratamento de Erros

- **Salvamento parcial no passo 5** (ex: atendimento salva mas venda falha): registrar atendimento já fica criado com `docsVinculados` parcial; mensagem clara "Atendimento PV-XXX criado, mas venda falhou — registre manualmente"
- **Cliente existente com dados conflitantes**: mostra todos os registros encontrados, vendedor escolhe qual usar
- **Busca sem resultado**: oferece "Continuar como cliente novo"
- **Concorrência de IDs**: `LockService` já em uso pelos geradores existentes

## Próximo passo

Após aprovação, invocar `writing-plans` pra gerar plano detalhado da **Sub-fase 2a** (backend extension) primeiro — fundamento sem o qual o wizard não funciona. Demais sub-fases ganham planos próprios.
