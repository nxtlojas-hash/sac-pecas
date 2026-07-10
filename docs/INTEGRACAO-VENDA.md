# Integração Venda → SAC (registrar_venda_moto)

Toda venda de moto registrada pelo app das lojas passa a alimentar automaticamente o SAC:
a moto entra na aba **`Motos Cliente`** da planilha "Pedido de peças" e aparece na timeline
do cliente (o `buscar_cliente_consolidado` lê essa aba como 5ª fonte).

**Implantado e testado em 10/07/2026** (Plano 6, Task 3).

## Arquitetura

```
App das lojas (vendas)
  → Webhook Make: hook.us2.make.com/ku3pk... (cenário "receber vendas inventario app", id 2829060, zona us2)
    → [1] Webhook  → [6] Iterator (produtos)  → [109] Excel 365 (planilha das lojas)
    → [111] HTTP "SAC: registrar venda moto"  ← MÓDULO NOVO (roda 1x por moto iterada)
      POST <WEB_APP_SAC>/exec?action=registrar_venda_moto&token=<TOKEN>
      body JSON: {id, loja, vendedor, dataVenda, cliente:{nome,cpf,telefone,email},
                  produtos:[{modelo, cor, chassi, motor}]}
```

- **Web app SAC:** o mesmo `/exec` do `formulario.js` (Apps Script da planilha "Pedido de peças").
- **Token:** gerado por `setupIntegracoes()` (executar no editor do Apps Script); fica na aba
  `Config` da planilha e já está embutido na URL do módulo 111 no Make. **Não commitar o token.**
- **Idempotência:** chave = chassi (ou `idVenda|modelo|cor` sem chassi). Reenvios do mesmo
  chassi não duplicam linha — por isso é seguro o módulo rodar após o Iterator (1x por moto).
- **Falha no SAC nunca para a venda:** módulo 111 tem "Evaluate all states as errors" OFF
  **e** um error handler `Ignore` — se o GAS estiver fora, o cenário segue e o Excel das
  lojas grava normalmente.
- **Log:** aba `Log Integracoes` da planilha registra `ok / negado / erro` por chamada.

## Como o módulo foi criado (e como recriar)

Via blueprint (API de sessão do Make, `PATCH /api/v2/scenarios/2829060` com o blueprint
completo), porque a UI não converte `{{...}}` colado em texto para mapeamento. O módulo é um
`http:ActionSendData` v3 com `bodyType: raw`, `contentType: application/json` e o body acima
com tokens IML. Rollback: menu do editor → *Previous versions* (a versão anterior à edição
de 10/07/2026 tem 3 módulos).

## Teste realizado (10/07/2026)

Payload de teste enviado direto ao webhook (id `1783706799178`, chassi `TESTE-SAC-001`,
loja `TESTE-INTEGRACAO`):

- Make: execução Success, **4 operações** (antes eram 3), ~16 s.
- `Motos Cliente`: linha gravada com telefone normalizado (`19999990000`).
- `Log Integracoes`: `registrar_venda_moto | ok | 1783706799178 — 1 moto(s)`.

> Limpeza: a linha `TESTE-SAC-001` em `Motos Cliente` serve de massa de teste para a Task 4
> (wizard). A linha `TESTE-INTEGRACAO` gravada no Excel das lojas pelo módulo 109 pode ser
> removida quando quiser.

## Verificação rápida (sem auth)

```bash
# ver últimas linhas do log de integração
curl -s "https://docs.google.com/spreadsheets/d/1QtumxGgKwzWBQBPISfDFjH3qGboiT3_1x5gbxl6R6ns/gviz/tq?tqx=out:csv&sheet=Log%20Integracoes" | tail -3

# ver Motos Cliente
curl -s "https://docs.google.com/spreadsheets/d/1QtumxGgKwzWBQBPISfDFjH3qGboiT3_1x5gbxl6R6ns/gviz/tq?tqx=out:csv&sheet=Motos%20Cliente" | tail -3
```
