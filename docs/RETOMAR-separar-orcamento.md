# RETOMAR — SAC: planilha separada de orçamentos

> ## ✅ CONCLUÍDO (22/07/2026) — não re-fazer
> Separação feita (v41, outra sessão) + fix do 360°-cliente (`buscarClienteConsolidado`
> lendo as 2 planilhas) publicado na **v42** pela conta dona nxt.lojas. Detalhes e a
> **lição da conta no deploy** estão no `PAINEL-NXT.md` (Histórico 22/07) e na memória
> `project_sac_pecas.md`. Este doc fica como registro histórico do raciocínio.


> Handoff de 21/07/2026. Este arquivo é lido do disco (UTF-8) — não é colado,
> então nunca embaralha. A sessão nova lê isto + `C:\dev\NXT\PAINEL-NXT.md`.

## Antes de agir
1. Leia `C:\dev\NXT\PAINEL-NXT.md` (fonte única da verdade do status NXT).
2. Confirme o estado atual no código — não confie só neste doc.

## Contexto (decidido/feito em 21/07/2026)
- Acabamos de construir do zero o orçamento do **form-PJ**: backend Apps Script +
  planilha própria em `J:\Meu Drive\PJ` + frontend + PDF com identidade NXT. Está
  no ar e funciona. **É o padrão de referência** — o SAC é o mesmo tipo de trabalho.
  Ver `C:\dev\NXT\ativos\form-pj\apps-script\orcamento-pj.gs` e
  `docs/superpowers/` do form-pj.
- Decisão da Claudia para o SAC: criar uma planilha Google **SEPARADA** para os
  orçamentos. Hoje eles moram DENTRO da planilha "Pedido de peças" (tumultuada).
  **NÃO migrar** os antigos — ficam lá como histórico; só os NOVOS vão para a
  planilha separada.
- **Já resolvido (não mexer):** os PDFs do orçamento do SAC já vão para a pasta
  `SAC/Orçamentos` (constante `PASTA_PDF_ORCAMENTOS` no código). Não precisa consertar.

## ⚠️ NÃO é "trocar 5 funções" — a aba é ACOPLADA aos atendimentos

A aba `Orcamentos` é tocada em MAIS lugares que as funções de CRUD. Mover só o
CRUD e esquecer o resto = falha silenciosa (atendimentos procurando orçamentos na
planilha errada, sem erro). **Antes de mudar qualquer coisa, mapeie TUDO:**

```
grep -nE "ABA_ORCAMENTOS|getSheetByName\(ABA_ORCAMENTOS\)|atendimentoId|getColAtendimentoId" google-apps-script.js
```

Referências conhecidas em 21/07 (confirmar que não surgiram novas):
- `getSheet` (linha ~1104) tem **lógica especial** para `ABA_ORCAMENTOS` — LER antes.
- CRUD de orçamento (via `getSheet(ABA_ORCAMENTOS)`): `salvarOrcamento`,
  `listarOrcamentos`, `buscarOrcamento`, `atualizarStatusOrcamento`, `savePdfUrlToSheet`.
- **Acoplamento com atendimentos** (estes também tocam a aba, alguns por
  `ss.getSheetByName` direto):
  - `vincularAtendimentosRetroativos` (~2705) — cria atendimentos sintéticos p/
    orçamentos pendentes.
  - `adicionarColunaAtendimentoId` (~3186) — mexe em `[Registros, Orcamentos, Assistencias]`.
  - `vincularAtendimento` (~3233) — mapeia `'orcamento' → ABA_ORCAMENTOS` p/ gravar `atendimentoId`.

## Tarefa
1. Criar planilha Google **"SAC Orçamentos"** em `J:\Meu Drive\SAC\Orçamentos\`
   (conta `nxt.lojas@gmail.com`), com o mesmo cabeçalho da aba `Orcamentos` atual
   (incluindo a coluna `atendimentoId`).
2. No Apps Script do SAC, fazer **todas** as referências acima passarem a apontar
   para a planilha nova por ID (`SpreadsheetApp.openById(ORCAMENTOS_SHEET_ID)`),
   não só o CRUD. Um helper `getOrcamentosSheet()` centraliza; mas as funções que
   usam `ss.getSheetByName(ABA_ORCAMENTOS)` direto (retroativos, vínculo) também
   precisam ser tratadas.
   - **NÃO tocar** nas funções de peças/OS — continuam na planilha ativa
     "Pedido de peças".
   - ⚠️ **Decisão de desenho a levar para a Claudia:** os atendimentos vivem na
     "Pedido de peças". Se os orçamentos saem para outra planilha, o vínculo
     orçamento↔atendimento vira **cross-workbook**. Confirmar com ela se isso é
     aceitável, ou se o vínculo deve ficar só na planilha nova.
3. Deploy: colar o `.js` atualizado no editor do Apps Script do SAC e republicar
   nova versão (o SAC deploya por paste no editor). A URL do Web App não muda.
4. Verificar AO VIVO: criar um orçamento de teste pelo SAC, confirmar que cai na
   planilha NOVA (não na "Pedido de peças"), que listar/buscar funcionam e o PDF
   sai em `SAC/Orçamentos`. Depois apagar o orçamento de teste.

## Gotchas aprendidos (aplicam ao SAC)
- Web App: chamar com `Content-Type: text/plain` (o SAC já faz). `application/json`
  dispara preflight CORS que o Apps Script não responde.
- O Google Sheets auto-converte `dd/MM/yyyy` em objeto Date — formatar na leitura
  se precisar (o PJ tem `fmtData`).
- **Verificar por CONTEÚDO, nunca por status HTTP** (200 engana).
- Colar código no editor: `Set-Clipboard` (PowerShell) + Ctrl+V. Autorização OAuth
  é decisão da Claudia — peça para ela clicar em "Revisar permissões".

## Ao terminar
- Atualizar `PAINEL-NXT.md` (mover a tarefa da Caixa de Entrada para concluído) e
  rodar `py C:\dev\NXT\atualizar-painel.py`.
