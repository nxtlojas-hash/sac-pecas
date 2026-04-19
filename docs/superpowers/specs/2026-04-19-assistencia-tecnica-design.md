# Design — Assistência Técnica + Ajustes SAC-Pecas

**Data:** 2026-04-19
**Autor:** Claudia Moraes (claudiarfmoraes@gmail.com), via Claude
**Status:** Aprovado pelo usuário — aguardando review final do spec antes de ir para writing-plans

## Objetivo

Adicionar à aplicação `sac-pecas/` um sistema de abertura de **Ordem de Serviço (OS) para Assistência Técnica**, além de três ajustes no formulário de peças existente. Tudo isso **sem quebrar** a integração com o Bling ERP que já está em produção.

## Escopo (4 entregas)

| # | Entrega | Risco | Arquivos tocados |
|---|---------|-------|------------------|
| 1 | Fix validação CNPJ no formulário de peças | Baixo | `formulario.js` |
| 2 | Novo item "Mão de obra" (rateado nos produtos para o Bling) | Médio (Bling) | `data.js`, `formulario.js`, `google-apps-script.js` |
| 3 | Seção "Dados da Coleta" no PDF de separação (Folha 1) | Baixo | `formulario.js` |
| 4 | Feature completa de OS de Assistência Técnica | Isolado | `assistencia.js` (novo), `index.html`, `app.js`, `style.css`, `google-apps-script.js` |

**Ordem de entrega:** 1 → 3 → 4 → 2. Motivo: itens 1 e 3 são baixo risco; 4 é isolado (não toca em Bling); 2 é o que mexe com Bling e por isso fica por último, após os outros terem sido validados.

**Validação entre entregas:** Fazer 1 pedido de peças real (ou de teste) após cada entrega para garantir que o envio ao Bling continua funcionando antes da próxima.

## Entrega 1 — Fix CNPJ

### Contexto

`formulario.js:746-761` contém `validarCNPJ()`. Algoritmo está correto (verificado: pesos `[5,4,3,2,9,8,7,6,5,4,3,2]` e `[6,5,4,3,2,9,8,7,6,5,4,3,2]`). Causa provável da rejeição: dessincronização de máscara ao alternar `tipoCliente` ou estado residual do campo.

### Ação

1. Adicionar logs temporários em `validarCampoDocumento()` para capturar o valor pré e pós `replace(/\D/g, '')` durante a investigação.
2. Em `trocarTipoCliente()` (ou equivalente): **limpar o campo** `cpfCnpjCliente` ao trocar entre F/J, para evitar que uma máscara anterior deixe dígitos incorretos.
3. Garantir que `maxlength` e máscara sejam reaplicados imediatamente após troca de tipo.
4. Não alterar o envio para o Bling (`venda.cliente.cpfCnpj.replace(/\D/g, '')` já é robusto).

### Teste de aceite

3 CNPJs reais (um deles válido-comum, um com zeros, um com dígito verificador 0) aceitos pelo formulário tanto na digitação quanto no submit.

### Risco Bling

Nenhum — nada que chega ao Bling muda.

## Entrega 3 — Seção "Dados da Coleta" no PDF

### Ação

No HTML inline do PDF gerado por `formulario.js` (entre `OBSERVAÇÕES` e `ASSINATURAS`, aproximadamente linha 1460), adicionar bloco:

```
┌─ DADOS DA COLETA ──────────────────────────────┐
│ Transportadora: __________________________     │
│ Conferência de NFe: _______________________    │
│ Conferência de Carga: _____________________    │
│ Assinatura do Motorista: __________________    │
│ Assinatura do Conferente: _________________    │
└────────────────────────────────────────────────┘
```

Mesmo estilo visual das seções irmãs (mesmas bordas, mesma fonte). Campos em branco com linha horizontal para preenchimento manual na hora da coleta.

### Teste de aceite

Gerar PDF de um pedido qualquer; seção nova aparece na Folha 1; Folha 2 (etiqueta) permanece igual.

### Risco Bling

Zero — só HTML/CSS no bloco do PDF client-side.

## Entrega 4 — Feature Assistência Técnica

### 4.1 Arquitetura

```
sac-pecas/
├── index.html              [+ view #view-assistencia, + aba nav, + botão home]
├── app.js                  [+ caso 'assistencia' em navigateTo]
├── assistencia.js          [NOVO — form, validação, submit, PDF da OS]
├── style.css               [+ estilos específicos se necessário]
└── google-apps-script.js   [+ registrarOS(), + obterProximoNumeroOS()]
```

**Princípio:** `assistencia.js` é irmão de `formulario.js`, sem imports cruzados. Máscara/validação de telefone é copiada (não compartilhada) para isolar os fluxos. Uma refatoração futura pode extrair utilitários, mas fora do escopo deste ticket.

### 4.2 Modelo de dados — aba `AssistenciasTecnicas`

Nova aba na mesma planilha (a que já contém `PEDIDOS`, `Orcamentos`, `Pecas`, `Estoque`).

| Col | Campo | Origem | Tipo |
|-----|-------|--------|------|
| A | DATA ABERTURA | auto | timestamp |
| B | NUMERO OS | auto | string — `OS-YYYY-NNNN` |
| C | NOME CLIENTE | form | string |
| D | TELEFONE CLIENTE | form | string com máscara |
| E | CIDADE | form | string |
| F | MODELO | form | string — Kay/Jaya/etc/Outro |
| G | NUMERO CHASSI | form | string (opcional) |
| H | DATA COMPRA | form | date (opcional) |
| I | NOTA FISCAL COMPRA | form | string |
| J | TIPO | form | `Garantia` ou `Venda` |
| K | ASSISTENCIA | form | string |
| L | PROBLEMA RELATADO | form | string (multilinha) |
| M | OBSERVACOES | form | string (opcional) |
| N | STATUS | default | `Em andamento` (atualizado manualmente depois) |
| O | NF ASSISTENCIA RECEBIDA | default | `Não` (manual) |
| P | PAGAMENTO FEITO | default | `Não` (manual) |

**Acompanhamento (Fase 1):** Atualização de Status/NF/Pagamento é feita **manualmente na própria planilha**. Uma tela de gestão interna vira um ticket futuro.

### 4.3 Numeração de OS

Função `obterProximoNumeroOS()` em `google-apps-script.js`:

1. Obter `LockService.getScriptLock()` e aguardar (até 10s) — evita race condition em submits simultâneos.
2. Ler coluna B da aba `AssistenciasTecnicas`.
3. Filtrar linhas com prefixo `OS-{anoAtual}-`.
4. Extrair a maior sequência e incrementar, padded a 4 dígitos (`0001`, `0002`...).
5. Se não houver nenhuma do ano: retornar `OS-{anoAtual}-0001`.
6. Liberar lock.

### 4.4 Fluxo de submit

```
[Usuário preenche form + clica "Abrir OS e gerar PDF"]
        ↓
[Validação client-side]
        ↓
[POST para Apps Script action='registrarOS' com dados do form]
        ↓
[Apps Script: getLock → proximoNumeroOS() → gravar linha → releaseLock → retornar {numeroOS, timestamp}]
        ↓
[Cliente recebe numeroOS → renderiza PDF com todos os dados + o número → window.print()]
```

PDF gerado **somente após** receber o número do servidor, garantindo unicidade e impedindo PDFs duplicados em caso de falha de rede.

### 4.5 UI do formulário

```
[DADOS DO CLIENTE]
  Nome completo *
  Telefone *
  Cidade *

[DADOS DA MOTO]
  Modelo * (select: Kay, Jaya, Juna Smart, Luna, Shaka, Zilla, Y1, YZL, Outro)
  Nº Chassi / Série (opcional)
  Data da compra (opcional)
  Nota fiscal de compra *

[ATENDIMENTO]
  Tipo * (radio: Garantia / Venda)
  Assistência técnica *

[OCORRÊNCIA]
  Problema relatado * (textarea)
  Observações internas (opcional)

[Limpar] [Abrir OS e gerar PDF]
```

Validações client-side: campos marcados com `*` são obrigatórios. Telefone: 10-11 dígitos (máscara reaproveitada, com código copiado de `formulario.js`). Data da compra (se preenchida): não pode ser futura.

### 4.6 Layout do PDF da OS

**1 página A4 retrato**. Seções:

- Cabeçalho: logo NXT + `Nº OS: OS-2026-NNNN` + data de abertura.
- `CLIENTE`: nome, telefone, cidade.
- `EQUIPAMENTO`: modelo, chassi, data compra, NF compra.
- `ATENDIMENTO`: tipo (GARANTIA/VENDA) e nome da assistência.
- `PROBLEMA RELATADO PELO CLIENTE`: texto completo digitado.
- Separador: `═══ A SER PREENCHIDO PELA ASSISTÊNCIA ═══`
- `LAUDO TÉCNICO`: linhas em branco.
- `PEÇAS UTILIZADAS`: 4-5 linhas em branco com espaço para qtd.
- `SERVIÇO EXECUTADO`: linhas em branco.
- Data conclusão + valor cobrado.
- Assinaturas: Técnico e Cliente.
- Rodapé: NXT Mobilidade Elétrica.

Geração igual ao PDF atual: `window.open()` + HTML/CSS inline + `window.print()` após load.

### 4.7 Acesso

- **Nav superior:** novo botão `🔧 Assistências` entre `Orcamentos` e `Admin`.
- **Home:** card/botão `[🔧 Abrir OS de Assistência Técnica]` abaixo dos 3 existentes (Tabela Preços, Estoque, Guia Uso), mesmo estilo visual.

### 4.8 Isolamento do código Bling

- `registrarOS()` **não chama** nenhuma função de Bling.
- Nenhuma função existente (`registrarVenda`, envios Bling etc) é modificada.
- `MAPEAMENTO_FISCAL` não é tocado.
- Aba `PEDIDOS` não é tocada.

## Entrega 2 — Item "Mão de obra" rateado no Bling

### Abordagem (D, escolhida pelo usuário)

Mão de obra aparece como linha **separada** no PDF e na planilha, mas ao enviar para o Bling seu valor é **rateado proporcionalmente** entre os produtos do pedido. Bling só vê produtos, com preços unitários inflados para absorver o valor do serviço. Total da NFe = total pago pelo cliente.

### Exemplo

Pedido:
- Acelerador R$ 125,00
- Alça R$ 115,00
- Mão de obra R$ 60,00 → Total R$ 300,00

Bling recebe:
- Acelerador R$ 156,25 (125 × 1,25)
- Alça R$ 143,75 (115 × 1,25, com ajuste residual no último item se necessário)
- Total R$ 300,00 ✓

### Implementação

1. **`data.js`**: adicionar uma função/lista de "itens globais" contendo `{ nome: "Mão de obra", preco: 0, peso: 0, img: "", precoEditavel: true }`. Esses itens são disponibilizados em qualquer modelo.
2. **`formulario.js`**: ao adicionar "Mão de obra", apresentar input numérico para o usuário digitar o valor. Salvar como item normal em `pecasAdicionadas`, mas com um flag `isMaoDeObra: true`.
3. **`google-apps-script.js`**: nova função pura `ratearMaoDeObra(itensBling, valorMaoObra)`:
   - Se `valorMaoObra === 0`, retorna `itensBling` intocado.
   - Caso contrário: fator = `(totalProdutos + valorMaoObra) / totalProdutos`.
   - Multiplica o preço unitário de cada produto pelo fator, arredondando a 2 casas.
   - Ajusta o último produto para que a soma exata feche com o total esperado (absorve residual de centavos).
   - Retorna nova lista de itens.
4. Na função que monta o payload do Bling (identificar em `registrarVenda()` / `enviarParaBling()`): antes de enviar, separar produtos e mão de obra, chamar `ratearMaoDeObra()`, e usar o resultado como itens do payload.
5. **Planilha PEDIDOS (coluna Q)**: continua recebendo a lista literal (inclusive mão de obra) — sem alteração de comportamento para a planilha.

### Regras de bloqueio

- Formulário impede submeter com **somente mão de obra** (sem produtos). Mensagem: "Adicione ao menos uma peça junto com a mão de obra".
- Isso garante que `ratearMaoDeObra()` nunca recebe lista vazia de produtos.

### Testes de aceite

1. Pedido com apenas produtos (sem mão de obra): Bling recebe preços iguais ao catálogo (comportamento inalterado).
2. Pedido com produtos + mão de obra: Bling recebe preços inflados; soma bate com total pago.
3. Pedido com produtos + mão de obra = 0: Bling recebe preços do catálogo.
4. Tentativa de submit apenas com mão de obra: bloqueado com mensagem.
5. Pedido com centavos de resíduo no rateio: último produto absorve; soma bate exatamente.

### Risco Bling

Médio. Mitigações:
- Pós-processamento puro (não altera o pedido localmente, só o payload).
- Fallback natural: pedido sem mão de obra passa intocado.
- Testes obrigatórios antes de considerar feito: os 5 cenários acima, feitos contra o ambiente de produção Bling com um pedido de teste.

## Checklist de testes pós-implementação (regressão + feature)

- [ ] Fluxo 1: abrir form Assistência, preencher válido, submeter, receber OS, PDF abre.
- [ ] Fluxo 2: submeter sem campos obrigatórios → validação bloqueia.
- [ ] Fluxo 3: linha nova aparece na aba `AssistenciasTecnicas` com OS única.
- [ ] Fluxo 4: dois submits simultâneos → OSs diferentes (LockService).
- [ ] Regressão Peças: pedido normal de peças sem mão de obra → chega ao Bling com preços do catálogo.
- [ ] Regressão Peças + Mão de obra: preços inflados proporcionalmente, total bate.
- [ ] Regressão Peças: submit apenas com Mão de obra → bloqueado.
- [ ] CNPJ: 3 CNPJs reais aceitos no form de peças.
- [ ] PDF de Peças: nova seção "Dados da Coleta" aparece; Folha 2 inalterada.

## Restrições e decisões rejeitadas

- **Rejeitado:** criar nova planilha Google Sheets separada. Motivo: usuário preferiu manter tudo numa planilha só, aba separada, por simplicidade de gestão.
- **Rejeitado:** enviar "Mão de obra" para o Bling como produto. Motivo: mão de obra é serviço (NFS-e), não produto (NF-e); risco fiscal.
- **Rejeitado:** estender `formulario.js` com flag de modo (`pecas`/`os`). Motivo: `formulario.js` já tem ~1500 linhas; acoplar os fluxos aumenta risco sobre Bling.
- **Rejeitado:** extrair utilitários compartilhados (máscara/validação) para `utils.js` agora. Motivo: escopo cresce e mexe em código que vai para Bling; fica para ticket futuro.
- **Rejeitado:** tela de gestão (listagem/edição) das OSs na UI. Motivo: usuário preferiu começar apenas com gestão manual na planilha; vira ticket futuro.

## Direcionadores para quem for implementar

- **Cuidado especial com Bling:** qualquer alteração em `registrarVenda()` / mapping fiscal / payload deve ser testada ponta-a-ponta com pedido de teste antes de merge.
- **Isolamento:** resista à tentação de "reaproveitar" código de `formulario.js` em `assistencia.js`. Duplicação pequena é aceitável aqui; o custo de acoplamento é maior que o ganho de DRY.
- **`LockService` é obrigatório** na geração de número de OS. Sem ele, dois submits simultâneos geram a mesma OS.
- **PDF só depois da resposta do servidor** — nunca gerar PDF antes de confirmar que a linha foi gravada na planilha.

## Próximo passo

Após aprovação do usuário sobre este spec, transicionar para `superpowers:writing-plans` para criar o plano de implementação detalhado.
