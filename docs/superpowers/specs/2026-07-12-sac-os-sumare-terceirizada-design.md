# Design — OS: Assistência Sumaré vs Terceirizada (roteamento + conserto da numeração)

**Data:** 2026-07-12
**Solicitante:** Jacque (SAC), via WhatsApp 11/07 — prints em `C:\dev\NXT\ativos\sac-pecas\ajustes\`
**Status:** aprovado pela usuária em 12/07 (abordagem A + numeração a partir de 0718)

## 1. Contexto e diagnóstico

O form de OS (`assistencia.js`) grava toda OS na aba `AssistenciasTecnicas` da planilha
"Pedido de peças" (`1QtumxGgKwzWBQBPISfDFjH3qGboiT3_1x5gbxl6R6ns`) via `registrarOS` no
Apps Script. Nenhum código grava nas abas "Assistencias parceiras " e " ASSISTÊNCIA SUMARÉ "
(nomes reais têm espaços extras).

Reconstrução do incidente (evidências via export CSV por gid):

- ~05/07: alguém **renomeou** a aba `AssistenciasTecnicas` para "Assistencias parceiras ".
  Ela guarda o histórico real: OS-2026-0034 … **OS-2026-0717** (633 registros).
- 06/07 04:27: o script, não achando a aba pelo nome, **recriou `AssistenciasTecnicas` vazia**
  (`garantirAbaAssistencias`) e a numeração **reiniciou em OS-2026-0001** (o contador escaneia
  só a coluna B dessa aba). Até 10/07 já havia ~93 OSs novas na aba recriada.
- Consequências: (a) a aba "parceiras" congelou — é o "faz uns dias que não está indo
  informações ali"; (b) **números duplicados** OS-2026-0001..0093 nas duas séries;
  (c) QRs de acompanhamento impressos antes de 06/07 ficaram órfãos.
- " ASSISTÊNCIA SUMARÉ " é 100% manual (105 linhas digitadas pela Jacque), com números de OS
  transcritos à mão ora da série antiga ("571"), ora da nova ("45", "76", "83").
- `AssistenciasCadastro` tem entrada duplicada: "Marcus Assistência - Sumaré" e
  "MARCUS Assistência - Sumaré" (mesmo endereço/telefone).

## 2. O que a Jacque pediu

1. Campo **obrigatório** no form da OS: **Assistência Sumaré** ou **Assistência terceirizada**.
2. Terceirizada → lista com os nomes das parceiras; Sumaré → só nome + endereço da assistência
   própria, **sem telefone** (hoje aparece "o número do Mazotti").
3. Roteamento: terceirizada → aba "Assistencias parceiras "; Sumaré → aba " ASSISTÊNCIA SUMARÉ ".
4. Aba parceiras volta a receber dados, e só de terceirizadas.
5. Aba Sumaré preenchida automaticamente no formato dela: data, cliente, nº OS, modelo,
   **coluna nova de chassi**, problema relatado; restante manual.
6. Fluxo espelhado ao do galpão (Léo imprime OS → técnico → grupo WhatsApp → Jacque trata).

## 3. Decisões

| Decisão | Escolha | Alternativas rejeitadas |
|---|---|---|
| Arquitetura | **A: master + espelhos.** `AssistenciasTecnicas` continua fonte da verdade; `registrarOS` faz *append* adicional na aba do tipo | B (gravar só nas abas por tipo): quebra numeração, QR, busca de cliente, vínculo atendimento. C (abas via QUERY): Jacque não conseguiria editar status/pedido/NF nas abas dela |
| Numeração | **Continua de OS-2026-0718** (piso persistido em ScriptProperties) | Renumerar as 93 novas (invalida PDFs/QRs já impressos); deixar como está (colisões seguiriam até 0717) |
| Assistência própria | **Galpão NXT Sumaré — Rua Quaresmeira da Serra, Sumaré/SP** | "Marcus Assistência - Sumaré" do cadastro (endereço Mineko Ito ≠ galpão, confirmado pela usuária) |
| Telefone no Sumaré | Não exibe no form nem nos PDFs (interna e cliente) | — |

**PENDENTE (não bloqueia implementação, bloqueia deploy):** número e CEP da Rua Quaresmeira
da Serra + nome oficial de exibição (proposta default: **"Assistência NXT Sumaré"**).
Confirmar com a Jacque. Fica em constante única `GALPAO_SUMARE` (frontend) espelhada no GAS.

## 4. Design

### 4.1 Frontend (`assistencia.js`)

- Na seção "Assistência Técnica", **antes** do dropdown atual, radio obrigatório sem
  pré-seleção: `🏭 Assistência Sumaré` | `🤝 Assistência terceirizada`.
- **Sumaré:** esconde dropdown/endereço/telefone; mostra cartão fixo com
  `GALPAO_SUMARE.nome` + `GALPAO_SUMARE.endereco`. Payload recebe esses valores e
  `assistenciaTelefone: ''`.
- **Terceirizada:** comportamento atual intacto (dropdown do cadastro vivo, autofill
  endereço/telefone, opção "Outro").
- Validação: sem tipo selecionado → erro "Selecione Sumaré ou terceirizada".
- Payload ganha `tipoAssistencia: 'Sumare' | 'Terceirizada'`.
- PDFs (interno e cliente): quando Sumaré, a linha Telefone da seção Assistência é omitida.
- O upsert automático de cadastro **não roda** para OS Sumaré (evita recriar entrada do
  galpão no cadastro de parceiras).

### 4.2 Backend (`google-apps-script.js`)

- `garantirAbaAssistencias`: coluna nova **`TIPO ASSISTENCIA`** adicionada **ao final** do
  cabeçalho (não desloca os índices fixos usados por `consultarStatusOS` e busca de cliente).
  Gravação por posição do header, não por índice cravado.
- `obterProximoNumeroOSSemLock_`: passa a retornar
  `max(scan da aba, Number(ScriptProperties.OS_SEQ_FLOOR || 0)) + 1`. Migração one-time seta
  `OS_SEQ_FLOOR = 717`. Mesmo que a aba seja limpa/renomeada de novo, não volta ao 0001.
- **Localização de abas por nome normalizado** (trim, lowercase, sem acentos):
  `encontrarAbaNormalizada_(nome)` usada para as três abas de OS. Cria a aba com o layout
  correto se não existir.
- **`espelharOS_(dados, numeroOS)`** chamado por `registrarOS` após o append no master
  (try/catch — falha no espelho não bloqueia a OS):
  - **Sumaré** → aba " ASSISTÊNCIA SUMARÉ ", mapeando **pelo cabeçalho dela**:
    `DATA` (dd/MM/yyyy), `CLIENTE`, `TELEFONE`, `NUMERO OS` (formato completo
    `OS-2026-XXXX`), `TIPO DE SOLICITAÇÃO` (Garantia/Venda), `MODELO`, `CHASSI`
    (coluna criada após `MODELO` se ausente), `QUAL PROBLEMA`. Demais colunas em branco.
  - **Terceirizada** → aba "Assistencias parceiras ", linha no mesmo layout de 24+ colunas
    do master (formato que a aba já tem).
- OS registrada com `tipoAssistencia` vazio (form antigo em cache) → tratada como
  Terceirizada + valor `"(sem tipo)"` na coluna, para não perder o espelho.

### 4.3 Reparos one-time (endpoint `setup_roteamento_os_v1`, idempotente via DocumentProperties)

1. Seta `OS_SEQ_FLOOR = 717`.
2. **Backfill** das ~93 OSs de 06–10/07 do master para as abas espelho:
   tipo inferido pelo campo ASSISTENCIA (contém "sumar" → Sumaré; senão Terceirizada);
   dedupe pelo número de OS normalizado (só dígitos finais) contra a aba destino — pula as
   linhas que a Jacque já digitou à mão.
3. Funde as duas entradas "Marcus Assistência - Sumaré" do cadastro (mantém a mais recente).

### 4.4 O que não muda

QR/link de acompanhamento, busca consolidada de cliente, vínculo com atendimento,
pedidos de peças, orçamentos, estoque, PDF geral.

## 5. Riscos e limites aceitos

- QRs impressos antes de 06/07 continuam órfãos (já estavam; fora de escopo ressuscitar).
- As 93 OSs com número duplicado permanecem (decisão da usuária).
- Normalização de nome protege contra espaços/caixa, não contra renome completo da aba —
  nesse caso o script recria a aba espelho vazia (o master nunca se perde).
- Espelho Sumaré depende do cabeçalho atual da aba dela; mapeamento por nome de coluna
  tolera reordenação, não remoção de coluna.

## 6. Critérios de aceite

1. Form não envia sem tipo selecionado.
2. OS Sumaré → master + linha na aba Sumaré com data/cliente/telefone/nº OS/tipo/modelo/chassi/problema; PDF sem telefone da assistência.
3. OS terceirizada → master + linha na aba parceiras; dropdown/autofill como hoje.
4. Próxima OS após deploy ≥ OS-2026-0718.
5. Backfill não duplica linhas já digitadas manualmente na aba Sumaré.
6. `?view=acompanhar&os=` continua funcionando para OSs novas.

## 7. Deploy

1. Frontend: commit + push (GitHub Pages).
2. GAS: colar `google-apps-script.js` no editor + nova versão da implantação
   (via Chrome NXT, como na v37, ou manualmente pela usuária).
3. Rodar `setup_roteamento_os_v1` uma vez e conferir: piso de numeração, backfill nas
   duas abas, cadastro sem duplicata.
4. Smoke test: 1 OS Sumaré + 1 OS terceirizada de teste, verificar as três abas e os PDFs.
