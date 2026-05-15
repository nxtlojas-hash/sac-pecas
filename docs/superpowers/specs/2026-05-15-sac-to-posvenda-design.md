# Design — Transformar `sac-pecas` em `NXT SAC` (Pós-Venda + SAC unificado)

**Data:** 2026-05-15
**Status:** Spec aprovada — aguardando plano de implementação
**Autor:** Claudia Moraes (NXT) + Claude Code

## Contexto

O app `sac-pecas` (em produção em https://nxtlojas-hash.github.io/sac-pecas/) hoje atende três fluxos paralelos: venda de peças (PCA), orçamentos (ORC) e ordem de serviço de assistência técnica (OS). Cada fluxo grava em uma planilha Google própria via Google Apps Script.

Em paralelo, existe um sketch chamado `nxt-posvenda` (em `C:\dev\NXT\projetos\nxt-posvenda\`) baseado em Directus 11 + SQLite/Postgres, com escopo amplo (protocolos, timeline, SLA, NPS, integração Respond.io). O sketch nunca foi pra produção e exige stack nova (Docker, Postgres, learning curve).

Esta spec define a **transformação incremental do `sac-pecas` em uma plataforma de SAC + Pós-Venda completa**, descartando o sketch Directus e usando exclusivamente as ferramentas que já rodam em produção (HTML/CSS/JS vanilla + Google Apps Script + Google Sheets + Make.com).

## Objetivos

1. **Identidade** — renomear conceitualmente o app de "NXT Peças" para "NXT SAC", refletindo seu papel real (atende pré-venda, pós-venda, garantia, assistência e SAC genérico)
2. **Protocolo único** — cada interação com cliente gera um número de protocolo `PV-2026-NNNN` rastreável
3. **Categorização** — atendimentos têm categoria (Pré-venda / Pós-venda / Outro). NF de compra é obrigatória apenas em pós-venda
4. **Timeline por cliente** — visão consolidada por CPF/telefone agrupando atendimentos, vendas de peças, orçamentos e OSes
5. **NPS pós-fechamento** — coleta de satisfação após resolver um atendimento
6. **Não disrupção** — nenhuma fase quebra produção. Fluxos atuais (PCA, ORC, OS) continuam funcionando exatamente como hoje
7. **Zero infra nova** — sem Directus, sem Postgres, sem Docker

## Não-objetivos

- Sem migração de dados antigos (planilhas atuais ficam como estão)
- Sem login/autenticação nova
- Sem integração automática com Respond.io na fase inicial (avaliar a partir da Fase 5)
- Sem dashboard de SLA na Fase 1 (coletar dados primeiro, decidir depois)
- Sem unificação real (criar venda dentro do atendimento) antes da Fase 6
- Sem mudança de hosting, URL ou repositório git

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (HTML/CSS/JS vanilla, GitHub Pages)           │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Catálogo │ │Atendimento│ │ Clientes │ │ Admin     │  │
│  └──────────┘ └───────────┘ └──────────┘ └───────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐   │
│  │ Venda Peças │ │ Orçamentos  │ │ Assistência (OS) │   │
│  └─────────────┘ └─────────────┘ └──────────────────┘   │
└──────────────────────────┬──────────────────────────────┘
                           │ fetch POST/GET
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Google Apps Script (backend)                           │
│  Endpoints: registrar_atendimento, listar_atendimentos, │
│  buscar_cliente, registrar_nps, ... (mantidos atuais)   │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Google Sheets (mesma planilha, novas abas)             │
│  Abas atuais: Vendas, Orçamentos, OSes, Assistências    │
│  Abas novas: Atendimentos, NPS                          │
└─────────────────────────────────────────────────────────┘
```

**Decisão chave:** os documentos existentes (PCA, ORC, OS) permanecem em suas abas atuais. A nova aba `Atendimentos` é independente — não substitui, complementa. O link entre Atendimento e documento é feito por um campo opcional `atendimentoId` no documento (string com o nº do protocolo).

## Modelo de Dados

### Aba `Atendimentos` (nova)

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `id` | string | sim | `PV-2026-NNNN` (sequencial) |
| `dataAbertura` | datetime | sim | Timestamp ISO |
| `categoria` | string | sim | `Pre-venda` / `Pos-venda` / `Outro` |
| `motivo` | string | sim | Subcategoria (Garantia, Peças, Dúvida, Interesse, Reclamação, etc) |
| `origem` | string | sim | WhatsApp, Loja, Site, Telefone |
| `nomeCliente` | string | sim | Nome completo |
| `telefone` | string | sim | Com DDD |
| `cpfCnpj` | string | não | CPF ou CNPJ |
| `notaFiscal` | string | quando categoria=Pos-venda | Número da NF NXT |
| `modeloEquipamento` | string | não | Quando aplicável |
| `descricao` | text | sim | O que o cliente precisa |
| `vendedor` | string | sim | Quem registrou |
| `status` | string | sim | `Aberto` / `Em andamento` / `Resolvido` / `Fechado` |
| `dataFechamento` | datetime | quando status=Fechado | |
| `motivoFechamento` | string | quando status=Fechado | Resolução, Cancelado, Sem retorno, etc |
| `npsEnviado` | boolean | não | `true` se já disparou NPS |

### Aba `NPS` (nova, Fase 5)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | string | `NPS-2026-NNNN` |
| `atendimentoId` | string | FK para Atendimento |
| `dataEnvio` | datetime | Quando o link foi gerado |
| `dataResposta` | datetime | Quando respondeu (null se pendente) |
| `nota` | number | 0-10 |
| `comentario` | text | Opcional |

### Documentos existentes (PCA, ORC, OS) — alteração mínima

Adicionar uma única coluna `atendimentoId` (opcional) em cada aba. Valor é string com o nº do protocolo ou vazio. Frontend mostra um seletor "Vincular a atendimento" nos formulários. Sem mexer nas demais colunas.

## Plano de Implantação (7 Fases)

Cada fase é incremental, independente, vai pra produção isolada, e não bloqueia uso do app.

### Fase 0 — Rebrand visual (esforço: ~30min, 1 commit)

- `index.html`: `<title>NXT PECAS V2 - SAC</title>` → `<title>NXT SAC</title>`
- Header `<h1>NXT PECAS V2</h1>` → `<h1>NXT SAC</h1>`
- Subtitle "SAC - Consulta, Orçamento e Registro" → "Atendimento ao Cliente — Pré-venda, Pós-venda, Garantia, Assistência"
- Bump `?v=` cache-busting de todos os scripts/CSS
- Sem mudança funcional. Risco zero.

### Fase 1 — Conceito Atendimento (esforço: 2-4h)

- Nova view "Atendimento" no app (`atendimento.js` + section em `index.html`)
- Form de abertura com os campos do modelo de dados acima
- Validação condicional: NF obrigatória quando categoria = "Pós-venda"
- Validação telefone, formatação CPF/CNPJ
- Botão "Abrir Atendimento" → gera ID via Apps Script → grava na aba `Atendimentos`
- Apps Script ganha endpoint `registrar_atendimento` + função `gerarProximoIdAtendimento()`
- Resumo pós-abertura: número do protocolo + botão copiar/WhatsApp

### Fase 2 — Listagem e busca de atendimentos (esforço: 3-5h)

- Nova view "Atendimentos" (`lista-atendimentos.js`)
- Apps Script: endpoint `listar_atendimentos` com filtros (status, categoria, vendedor, data)
- Render em cards/tabela mostrando: ID, data, cliente, categoria, status, vendedor
- Busca por: nº protocolo, nome, CPF/telefone, NF
- Click no atendimento → modal de detalhe com histórico
- Botões: "Mudar status" (transições válidas), "Fechar atendimento" (pede motivo)

### Fase 3 — Linkar documentos existentes (esforço: 3-4h)

- Adicionar coluna `atendimentoId` nas abas Vendas, Orçamentos, OSes do Sheet
- Nos forms de venda peças, orçamento e OS, adicionar campo opcional "Vincular a atendimento" (busca por protocolo, CPF ou telefone)
- Apps Script: incluir `atendimentoId` no payload
- Atendimento mostra docs vinculados (consulta as 3 abas filtrando por `atendimentoId`)

### Fase 4 — Timeline por cliente (esforço: 4-6h)

- Nova view "Clientes" (`clientes.js`)
- Busca por CPF/telefone/NF
- Apps Script: endpoint `buscar_cliente` que consolida resultados das 4 abas (Atendimentos, Vendas, Orçamentos, OSes) por chave
- Renderiza timeline cronológica unificada com filtros visuais (cor por tipo de evento)

### Fase 5 — NPS (esforço: 3-5h)

- Após fechar atendimento, botão "Enviar NPS" no detalhe
- Gera link único `?nps=<id>` que abre form simples (nota 0-10 + comentário)
- Botão abre `wa.me/<telefone>?text=<msg-com-link>`
- Form NPS é uma view standalone no mesmo app
- Apps Script: endpoint `registrar_nps`
- Aba `NPS` no Sheet, mini-dashboard (média, NPS calculado, últimos comentários)

### Fase 6 — Unificação real (futuro, esforço a estimar)

- Atendimento ganha botão "Criar venda/orçamento/OS deste atendimento"
- Form pré-preenche dados do cliente automaticamente
- Documento gerado já nasce com `atendimentoId` setado
- Não substitui criação direta dos documentos (que continua funcionando)

## Fluxo de Dados (Fase 1, exemplo)

```
Vendedor abre o app
  ↓
Clica "Atendimento" → form vazio
  ↓
Preenche: categoria=Pos-venda, NF=12345, motivo=Garantia, ...
  ↓
Submit → fetch POST → Apps Script
  ↓
Apps Script:
  1. Lê última linha de Atendimentos pra gerar PV-2026-0042
  2. Append nova linha na aba Atendimentos
  3. Retorna { sucesso: true, id: "PV-2026-0042" }
  ↓
Frontend mostra modal de sucesso com nº protocolo
  ↓
Botões: Copiar ID, Compartilhar WhatsApp, Fechar
```

## Tratamento de Erros

- **Apps Script offline/timeout**: feedback visual de erro, botão "Tentar novamente". Não perde dados do form.
- **NF inválida (formato)**: validação client-side antes de enviar
- **CPF duplicado em outro atendimento aberto**: aviso (não bloqueia) "Cliente já tem atendimento PV-2026-0038 em aberto"
- **ID concorrente** (dois vendedores abrindo ao mesmo tempo): Apps Script usa `LockService` pra serializar geração de ID

## Estratégia de Teste

Sem suite de teste automatizado (mantém o padrão atual do projeto). Validação manual a cada fase:

- **Fase 0**: F5 no GitHub Pages, confere título/header
- **Fase 1**: abre atendimento de teste, confere planilha, copia protocolo
- **Fase 2**: lista, filtra por status, busca por nome/CPF, muda status
- **Fase 3**: cria venda/orçamento/OS com `atendimentoId`, confere que aparece no detalhe do atendimento
- **Fase 4**: busca cliente por CPF que tem 2 atendimentos + 1 venda + 1 OS, confere timeline
- **Fase 5**: fecha atendimento, envia NPS, responde nota, vê no dashboard

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Apps Script lento com muitos atendimentos | Paginar lista, carregar últimos 100 por padrão |
| Planilha cresce demais (>10k linhas) | Em 6+ meses, avaliar mover Atendimentos pra Firestore (continua compatível) |
| Vendedores não usarem o protocolo | Treinamento + tornar campo "protocolo" visível em vendas (Fase 3) |
| NF duplicada (cliente comprou e abriu múltiplas OS) | Permitir, contabilizar como atendimentos diferentes da mesma NF |
| Pré-venda nunca virar cliente (NF) | Aceitar — atendimento fica como pré-venda permanente |

## Próximo passo

Após aprovação desta spec, invocar `superpowers:writing-plans` para gerar plano detalhado da **Fase 0** (rebrand) e **Fase 1** (Atendimento) numa única sessão de implementação. Fases 2-6 ganham seus próprios planos quando chegar a vez.
