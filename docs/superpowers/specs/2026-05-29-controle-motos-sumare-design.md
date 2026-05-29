# Design — Controle de Motos na Assistência Sumaré

**Data:** 2026-05-29
**Status:** Spec aprovada (brainstorming consolidado)
**Autor:** Claudia Moraes (NXT) + Claude Code
**Precedência:** Incêndio no galpão de Sumaré destruiu o controle manual em papel. Levantamento fotográfico foi feito em 28/05/2026 via WhatsApp (grupo "Levantamento Sumaré"). Esta entrega reconstrói o controle a partir dos checklists fotografados.

## Contexto

A assistência técnica de Sumaré operava com um controle 100% em papel — cada moto recebida tinha um **Checklist de Assistência Técnica Pós-Venda NXT Autopropelidos** preenchido à mão, arquivado no galpão. O incêndio destruiu esse arquivo físico, deixando a equipe sem visibilidade de:

- Quais motos estão na assistência agora
- A quem cada moto pertence (CPF, telefone, endereço)
- Qual o problema relatado por cada cliente
- Que diagnóstico/serviço foi feito ou está pendente

Em 28/05/2026, a equipe (Emerson Sumaré, Claudia, Leo, Evellyn, Nikolly, Marcão, Emerson Gomes Sumaré) fez um levantamento fotográfico: 130 fotos no grupo de WhatsApp, alternando entre **foto do checklist preenchido** (papel) e **foto da moto correspondente**, com o nome do cliente como legenda na maioria.

Estimativa: **~65 motos** (130 fotos ÷ pares checklist+moto). Algumas motos provavelmente estão sem checklist pareado (não identificadas).

## Objetivos

1. **Planilha Google Sheets compartilhada** com a equipe Sumaré, contendo todas as motos identificadas + as não identificadas
2. **Pré-população automática** via OCR dos checklists fotografados (~25 campos por moto)
3. **Pasta no Drive** com as 130 fotos organizadas e renomeadas por ID da moto
4. **Histórico de movimentações** preservado em aba separada (auditoria pós-incêndio)
5. **Dashboard simples** com totais por status, % identificadas, motos mais antigas
6. **Aba "Não Identificadas"** filtrada, com campo para a equipe ir investigando
7. **Compartilhável via Drive** — link único pra equipe Sumaré

## Não-objetivos (V1)

- Sem integração com sistema SAC nesta fase (V2 — apenas link no menu)
- Sem migração para módulo nativo (avaliado depois de estabilizar)
- Sem app mobile ou interface custom (Google Sheets é suficiente pra V1)
- Sem OCR perfeito — campos de baixa confiança ficam marcados pra revisão humana
- Sem timeline rica como em Clientes do SAC (V2 — quando migrar pra módulo nativo)
- Sem integração com Respond.io ou Bling (V2)

## Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│  Google Drive: J:\Meu Drive\SAC\Motos Assistência Sumaré\  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Controle - Motos Sumaré.xlsx (Google Sheets)          │  │
│  │                                                        │  │
│  │  Aba 1: Motos          — 1 linha/moto, 28 colunas      │  │
│  │  Aba 2: Movimentações  — log de eventos                │  │
│  │  Aba 3: Não Identificadas — VIEW filtrada (QUERY)      │  │
│  │  Aba 4: Dashboard      — totais e gráficos             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Fotos\                                                │  │
│  │   ├── M001-checklist.jpg                               │  │
│  │   ├── M001-moto.jpg                                    │  │
│  │   ├── M002-checklist.jpg                               │  │
│  │   ├── M002-moto.jpg                                    │  │
│  │   └── ... (130 arquivos renomeados)                    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │ link compartilhado
                              │
                       Equipe Sumaré
```

### Componentes

**1. Script de extração (Python local, executado uma vez)**
- Lê o ZIP do WhatsApp já extraído em `%TEMP%/sumare/`
- Para cada foto: classifica via Claude vision como `checklist` ou `moto`
- Para cada checklist: extrai os ~25 campos estruturados
- Pareia checklists com motos por proximidade temporal/sender
- Gera CSV pronto pra importar + renomeia fotos

**2. Template Google Sheets (`.xlsx`)**
- 4 abas pré-formatadas com dropdowns, validações, fórmulas
- Aba Motos preenchida com dados extraídos
- Aba Movimentações com 1 evento "Recebida — levantamento 28/05" por moto
- Aba Não Identificadas usando `QUERY` em Motos
- Aba Dashboard com `COUNTIF` e gráficos por status/modelo

**3. Pasta Fotos no Drive**
- 130 imagens renomeadas: `M001-checklist.jpg`, `M001-moto.jpg`, etc
- Links inseridos na planilha (coluna `Foto checklist`, `Foto moto`)

## Schema da aba Motos (28 colunas)

| # | Coluna | Tipo | Origem | Notas |
|---|--------|------|--------|-------|
| **Identificação** ||||||
| 1 | `ID` | M001, M002… | auto |  |
| 2 | `Data registro` | data | timestamp WhatsApp | 28/05/2026 para todas (V1) |
| 3 | `Nº OS` | texto | OCR (topo direito) | normalmente vazio |
| 4 | `Data entrada checklist` | data | OCR (topo direito ou assinatura) | normalmente vazio; usa `Data registro` como fallback |
| 5 | `Status atual` | dropdown | manual | `Aguardando diagnóstico` / `Em reparo` / `Aguardando peça` / `Aguardando cliente` / `Pronta` / `Entregue` / `Não identificada` |
| 6 | `Identificada?` | Sim/Não | derivado da presença de Nome+CPF | fórmula `=IF(AND(E:E<>"";F:F<>""); "Sim"; "Não")` |
| **Cliente** ||||||
| 7 | `Nome` | texto | OCR checklist | |
| 8 | `CPF` | texto | OCR checklist | |
| 9 | `Telefone` | texto | OCR checklist | |
| 10 | `Endereço` | texto | OCR checklist | |
| 11 | `Cidade/UF` | texto | OCR checklist | |
| **Moto** ||||||
| 12 | `Modelo NXT` | dropdown | OCR + match com 12 modelos | Kay/Jaya/Luna/Shaka/Zilla/Juna Smart/Juna/Gataka/Pancho/Hyphen/Vega/Kimbo |
| 13 | `Cor` | texto | OCR checklist | |
| 14 | `Nº Chassi` | texto | OCR checklist | |
| 15 | `Nº Motor` | texto | OCR checklist | |
| 16 | `Data compra` | data | OCR checklist | |
| 17 | `Loja/revendedor` | texto | OCR checklist | |
| **Diagnóstico** ||||||
| 18 | `Problema relatado` | texto longo | OCR seção 3 | |
| 19 | `Componentes danificados` | texto | OCR seção 4 (só "Ruim/X") | concatenado com `;` |
| 20 | `Tipo atendimento` | dropdown | OCR seção 5 | `Garantia` / `Preventiva` / `Reparo pago` / `Revisão entrega` / `Outro` |
| 21 | `Peças substituídas` | texto | OCR seção 5 | vazio se ainda não diagnosticado |
| 22 | `Técnico responsável` | texto | OCR assinatura | |
| **Fotos** ||||||
| 23 | `Foto checklist` | URL Drive | renomeada | `Fotos/M001-checklist.jpg` |
| 24 | `Foto moto` | URL Drive | renomeada | `Fotos/M001-moto.jpg` |
| 25 | `Fotos extras` | URLs | se houver | separadas por vírgula |
| **Metadados** ||||||
| 26 | `Origem do registro` | texto | fixo | `WhatsApp 28/05/2026` |
| 27 | `Quem registrou` | texto | sender do WhatsApp | Emerson Sumaré / Claudia / Leo / etc |
| 28 | `Observações` | texto livre | manual | equipe preenche |

## Schema da aba Movimentações

| Coluna | Tipo | Notas |
|--------|------|-------|
| `Data/hora` | timestamp | auto (`=NOW()` ao inserir linha) |
| `ID Moto` | ref | `M001` |
| `Status anterior` | dropdown | mesma lista do Status atual |
| `Status novo` | dropdown | mesma lista |
| `Responsável` | texto | quem registrou |
| `Observação` | texto livre | |

V1 pré-populada com 1 linha por moto: `28/05/2026 13:00 | M001 | (vazio) | Aguardando diagnóstico | <sender WhatsApp> | "Recebida — levantamento pós-incêndio"`.

## Schema da aba Não Identificadas (VIEW)

```
=QUERY(Motos!A1:AB; "SELECT A, G, L, M, R, W, X WHERE F = 'Não' ORDER BY A"; 1)
```
Mostra: ID, Nome (possivelmente vazio), Modelo NXT, Cor, Problema relatado, Foto checklist, Foto moto. (Colunas exatas podem ser ajustadas na implementação conforme o que ajudar mais a identificar.)

Coluna extra (manual, fora do QUERY): `Pistas` — campo livre pra equipe ir anotando indícios (ex: "mesma cor que moto da Bianca? checar bairro").

## Schema da aba Dashboard

- `B2: Total motos` = `=COUNTA(Motos!A2:A)`
- `B3: Identificadas` = `=COUNTIF(Motos!F:F; "Sim")`
- `B4: Não identificadas` = `=COUNTIF(Motos!F:F; "Não")`
- `B5: % identificadas` = `=B3/B2`
- Tabela `Status × Quantidade` via `COUNTIF` (8 linhas, uma por status)
- Tabela `Modelo × Quantidade` via `COUNTIF` (12 linhas, uma por modelo NXT)
- Top 5 motos mais antigas via `QUERY ... ORDER BY B ASC LIMIT 5`
- Gráfico de barras: motos por status
- Gráfico de pizza: identificadas vs não

## Workflow de extração

1. **Setup:** ZIP já está extraído em `%TEMP%/sumare/` (130 fotos + chat.txt)
2. **Parse do chat:** mapeia cada foto pra (timestamp, sender, legenda continuação)
3. **OCR por foto** via Claude vision:
   - Classifica como `checklist` | `moto` | `outro` (raro)
   - Para `checklist`: extrai os campos estruturados (Nome, CPF, etc) → JSON
   - Para `moto`: só registra dimensões/qualidade
4. **Pareamento checklist+moto:**
   - Para cada checklist: procura próxima foto `moto` do mesmo sender em janela de ±2 min
   - Casos especiais:
     - Checklist sem moto pareado → moto identificada mas sem foto da moto
     - Moto sem checklist → moto **NÃO identificada** (entra com Status="Não identificada")
5. **Atribuição de ID:** todas as motos recebem ID sequencial `M001`, `M002`, ... em ordem cronológica do WhatsApp. Status="Não identificada" é o flag — não há prefixo separado. Motos órfãs (só foto-moto sem checklist) entram no mesmo numerador, depois dos pareados.
6. **Renomeação de fotos:** copia para pasta `out/Fotos/` com novo nome
7. **Geração do XLSX:** monta 4 abas via `openpyxl`, aplica formatação, validações, fórmulas
8. **Relatório de extração** (markdown): total processado, taxa de identificação, campos de baixa confiança pra revisão

## Entregáveis V1

- `J:\Meu Drive\SAC\Motos Assistência Sumaré\Controle - Motos Sumaré.xlsx`
- `J:\Meu Drive\SAC\Motos Assistência Sumaré\Fotos\` (130 jpgs renomeados)
- `relatorio-extracao.md` — resumo da execução
- Instruções de compartilhamento da pasta Drive com a equipe Sumaré

## Roadmap V2 (depois de estabilizar)

1. **Link no menu do SAC:** card "Motos na Assistência Sumaré" no `index.html` apontando pra planilha
2. **Cross-reference com base Clientes do SAC:** quando bate CPF/telefone, exibir badge "Cliente conhecido"
3. **Migração pra módulo nativo:** integrar com Clientes/timeline do SAC (1 linha do `historico` por movimentação)
4. **Notificações:** push pra cliente quando muda status (via Respond.io)
5. **Expansão Jaraguá:** mesma estrutura pra outra unidade

## Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| OCR erra campo crítico (CPF, telefone) | Alta | Marcar campos de baixa confiança no relatório; equipe revisa |
| Letra manuscrita ilegível em foto ruim | Média | Deixar campo vazio + flag "Revisar — letra ilegível" nas Observações |
| Pareamento checklist+moto falha | Média | Casos órfãos vão pra "Não identificadas" pra revisão manual |
| Equipe não usa planilha (volta pro papel) | Alta | Treinar 1 pessoa por turno; deixar planilha simples; iterar conforme uso |
| Duplicação de motos (mesma moto fotografada 2x) | Média | Detectar via nome+CPF duplicado no relatório de extração |
| Drive H: não sincronizado para equipe Sumaré | Média | Confirmar acesso Drive antes do compartilhamento |
