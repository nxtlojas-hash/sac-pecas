# Aceite — NXT Pós-Venda Fase 1 (Plano 6)

**Data:** 2026-07-10 · **Backend:** Apps Script Versão 37 · **Front:** GitHub Pages (`nxtlojas-hash.github.io/sac-pecas`)

O pós-venda foi construído **dentro do SAC** (Google Sheets + Apps Script + front GitHub Pages), substituindo o projeto Directus (arquivado). Abaixo o resultado do roteiro de aceite.

## Roteiro de aceite — resultados

| # | Item | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | **Venda → SAC** com cliente + moto + garantia | ✅ | Módulo HTTP no cenário Make "receber vendas inventario app" (2829060). Teste id `1783706799178` gravou a moto em `Motos Cliente`; wizard de atendimento mostra a moto com garantia **motor/quadro 24m + bateria 6m**. |
| 2 | **WhatsApp → atendimento** com protocolo | ✅ | Ponte Make "SAC - WhatsApp para Atendimento" (5629662) **ligada**. Mensagens reais criaram `PV-2026-0533`…`0537`; mensagens seguidas do mesmo telefone caem no mesmo protocolo (idempotência). Aba `Mensagens` + aba `Atendimentos`. |
| 3 | **OS → QR → acompanhamento público** | ✅ | Action `status_publico`; página `?view=acompanhar&os=` testada com `OS-2026-0001` (timeline 5 etapas). QR nos 2 documentos de OS aponta pra ela. Status avança editando a coluna Status da aba `AssistenciasTecnicas`. |
| 4 | **NPS por link** gravado | ✅ | Action `registrar_nps`; página `?view=nps&id=` testada (nota 10 → aba `NPS` com categoria Promotor). Link incluído na mensagem de NPS por WhatsApp. 1 resposta por atendimento. |
| 5 | **Badge / SLA / Dashboard** corretos | ✅ | Badge no nav (289 abertos, vermelho por haver vencidos); bloco "Em aberto" na home (5 mais antigos, destaque SLA 3d); aba Dashboard (KPIs + por mês / top motivos / por responsável + NPS). |
| 6 | **Log Integracoes** sem erros inesperados | ✅ | 73 `ok`, 4 `negado` (testes de token). **0 `erro`.** |
| 7 | **Funções antigas** não quebraram | ✅ | Smoke test OK: `listar_pecas` (213), `listar_estoque`, `listar_orcamentos`, `listar_atendimentos`, `buscar_cliente_consolidado`, `status` (Bling), `listar_assistencias`, `listar_movimentacoes`. |

## Infra

- **Deploy backend:** colar `google-apps-script.js` no editor → nova versão (mantém a URL do web app). Chegou na **Versão 37**.
- **Deploy front:** `git push` publica no GitHub Pages (~1min de rebuild).
- **Ponte Respond.io → SAC:** via Make (conexão Respond.io existente + módulo HTTP), sem upgrade pago do Respond.io. O webhook de plataforma do Respond.io é gated (pago).
- **Directus:** `projetos/nxt-posvenda/README.md` prefixado com `[ARQUIVADO 2026-07]`.

## Pendências (fora do escopo de código)

- **Processo:** de 290 atendimentos, **290 estão em aberto (0 fechados)** — a equipe não marca Resolvido/Fechado. Alinhar o fechamento para que SLA/tempo-médio/NPS fiquem úteis.
- **Créditos Make:** cada mensagem de WhatsApp = 2 operações. Acompanhar o consumo (~5,8k/10k créditos no início).
- **Limpeza de massa de teste:** NPS `PV-2026-0533` (nota fabricada num cliente REAL) e `PV-2026-0532`; atendimentos/ contatos "TESTE"; workflow-rascunho no painel Respond.io ("SAC - Encaminhar mensagem…").
- **Físico (já validado pela usuária):** leitura do QR por celular; avanço de status refletindo na página.
