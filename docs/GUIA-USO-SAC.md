# Guia de Uso — NXT SAC

> **Para vendedores e atendentes da NXT** • Versão V2.21 • Atualizado em 2026-05-16
>
> **URL do sistema:** https://nxtlojas-hash.github.io/sac-pecas/

## Sumário

1. [Visão geral](#visão-geral)
2. [Fluxo principal: atendimento ao cliente](#fluxo-principal-atendimento-ao-cliente)
3. [Abas e o que cada uma faz](#abas-e-o-que-cada-uma-faz)
4. [Cenários práticos](#cenários-práticos)
5. [Dicas e atalhos](#dicas-e-atalhos)
6. [Perguntas frequentes](#perguntas-frequentes)

---

## Visão geral

O **NXT SAC** é o sistema único que centraliza:

- **Atendimento ao cliente** — toda interação (pré-venda, pós-venda, garantia, dúvida) começa com um protocolo `PV-AAAA-NNNN`
- **Venda e orçamento de peças** — gera PCA (venda) ou ORC (orçamento, pendente 7 dias)
- **Assistência técnica** — abre OS para o cliente levar o equipamento à assistência autorizada
- **Estoque de peças** — entrada, saída, ajustes manuais e inventário em 2 armazéns (Sumaré e Jaraguá)
- **Histórico do cliente** — busca por CPF/telefone e mostra tudo (atendimentos + vendas + orçamentos + OSes) numa timeline única
- **Acompanhamento de pendências** — lista filtrável de todos os atendimentos com status

Tudo grava em uma única planilha do Google Drive. Não precisa instalar nada.

---

## Fluxo principal: atendimento ao cliente

### A) Cliente entra em contato (telefone, WhatsApp, loja)

1. Vai em **📝 Atendimento** no menu
2. **Passo 1 — Cliente:** digita CPF, telefone ou nome → clica **Buscar**
   - Se o cliente já é conhecido, click no card pra preencher os dados automaticamente
   - Se é novo, preenche manualmente os campos
3. **Passo 2 — Motivo:** seleciona categoria (Pós-venda / Pré-venda / Outro), motivo, origem do contato (WhatsApp, loja, etc), descreve o que o cliente precisa e identifica o vendedor
4. **Passo 3 — Ações:** marca o que vai gerar nesse atendimento:
   - 🛒 Registrar venda de peças
   - 📄 Gerar orçamento
   - 🔧 Abrir OS de assistência
   - 📝 Apenas registrar (sem documento)
5. **Passo 4 — Preenchimento:** revisa as ações marcadas
6. **Passo 5 — Fechamento:** define status (Aberto / Em andamento / Aguardando cliente / Resolvido / Fechado) e clica **✓ Salvar atendimento**

### B) Após salvar, modal de sucesso mostra o protocolo

- **📋 Copiar protocolo** — salva no clipboard pra colar em qualquer lugar
- **📱 WhatsApp** — abre conversa com o cliente já com mensagem pronta contendo o protocolo
- Se você marcou **venda/orçamento/OS** no Passo 3, aparecem botões pra criar cada um — leva pro form correspondente já com cliente pré-preenchido e atendimento vinculado automaticamente

### C) Atendimento fica registrado e rastreável

- Aparece na aba **📋 Atendimentos** (lista com filtros)
- Aparece na timeline do cliente em **👤 Clientes**
- Cada documento gerado (PCA/ORC/OS) fica vinculado pelo `atendimentoId`

---

## Abas e o que cada uma faz

### 🏠 Início

Página inicial com **atalhos** para todas as ações e **links úteis** (Manuais, Tabela de Preços, Quadro Comparativo, Mapa das Assistências, Mapa das Lojas, Drive do SAC).

### 📝 Atendimento

Wizard de 5 passos pra abrir novo atendimento. Caminho recomendado pra qualquer interação com cliente nova.

### 📋 Atendimentos

Lista completa de todos os atendimentos cadastrados. Filtros disponíveis:
- **Status** — Aberto, Em andamento, Aguardando cliente, Resolvido, Fechado
- **Categoria** — Pós-venda, Pré-venda, Outro
- **Vendedor** — texto livre
- **Período** — de / até
- **Busca textual** — protocolo, nome, CPF, telefone

**Cards coloridos** por status: laranja=Aberto, azul=Em andamento, roxo=Aguardando, verde=Resolvido, cinza=Fechado.

**Click no card** expande detalhes (origem, NF, equipamento, descrição, ações, docs vinculados) e oferece botão **✏️ Editar status**.

### 👤 Clientes

Busca clientes por CPF, telefone ou nome. Mostra **timeline cronológica unificada** com todos os eventos do cliente:
- 📝 Atendimentos
- 🛒 Vendas
- 📄 Orçamentos
- 🔧 OSes

Cada evento tem badge indicando se está vinculado a algum atendimento (`PV-XXX` verde) ou se é legado (cinza "sem atendimento").

**Botões disponíveis:**
- **➕ Novo atendimento** — abre wizard com cliente já pré-preenchido
- **✏️ Editar status** (em atendimentos) — muda status, oferece NPS ao marcar Resolvido/Fechado
- **🔗 Vincular a atendimento** (em docs legados) — conecta retroativamente

### 🛒 Registrar

Formulário de venda/orçamento de peças. O **mesmo formulário** gera 2 fluxos diferentes pelos botões finais:

- **Registrar Venda** (lime) — conclui a venda, baixa estoque automaticamente, envia para o Bling
- **📄 Salvar como Orçamento** (laranja) — salva pendente com validade de 7 dias, NÃO baixa estoque

**Detecção automática de cliente:** ao preencher CPF ou telefone, o sistema busca e mostra banner com atendimentos anteriores. Se houver, oferece vincular esta venda/orçamento a um atendimento existente.

### 🔧 Assistências

Formulário pra abrir OS (Ordem de Serviço) — quando o cliente precisa levar o equipamento à assistência autorizada.

Mesma detecção automática de cliente da aba Registrar. Gera PDF da OS com identidade NXT.

### 📦 Estoque

3 sub-telas internas:

#### Movimentar
Registro manual de movimentação:
- **Entrada** — peça chegou (compra, devolução, desmontagem de moto)
- **Saída** — peça saiu fora de venda (perda, retirada)
- **Ajuste** — corrige saldo divergente (use valor negativo pra reduzir)

Campos: tipo, armazém (Sumaré/Jaraguá), modelo, peça, quantidade, origem (texto livre), operador.

#### Inventário
Modo de contagem física em lote. Lista todas as peças do catálogo com o saldo atual. Você conta fisicamente e digita o valor real na coluna "Contado". Linhas com diferença ficam destacadas (verde=positiva, vermelho=negativa). Ao confirmar, sistema gera 1 ajuste por peça com diferença.

#### Saldo
Visão consolidada de todos os saldos. Filtros por modelo, busca de peça, status (todos / com saldo / zerados / negativos). Totais por armazém no topo.

### Catálogo, Orçamentos, Admin

- **📖 Catálogo** — peças por modelo (consulta com preços e estoque)
- **📄 Orçamentos** — lista de orçamentos pendentes para resgatar/converter em venda
- **⚙ Admin** — gestão de peças (cadastrar, editar, excluir)

---

## Cenários práticos

### 1️⃣ Cliente liga pedindo orçamento de peça

```
1. Atendimento → Buscar cliente (ou cadastrar)
2. Categoria: Pos-venda • Motivo: Peças • Origem: Telefone
3. Descrição: "Cliente quer orçamento para troca de espelho"
4. Ação: ☑️ Gerar orçamento
5. Status: Aguardando cliente
6. Salvar → modal mostra PV-2026-XXX
7. Click em "📄 Criar orçamento vinculado"
8. Form Registrar abre com cliente preenchido + banner verde de vínculo
9. Adiciona a peça, clica "Salvar como Orçamento"
10. Confirma → ORC-2026XXXX-NNN gerado
```

### 2️⃣ Cliente foi à loja, comprou peça (venda direta sem atendimento prévio)

```
1. Registrar → preenche CPF do cliente
2. (Banner pode aparecer se ele já tem atendimento aberto — opcionalmente vincula)
3. Preenche tipo (Venda SAC), peças, pagamento
4. Click em "Registrar Venda"
5. Confirma → PCA gerado, estoque baixado, Bling notificado
```

### 3️⃣ Equipamento na garantia precisa ir pra assistência

```
1. Atendimento → busca cliente pelo CPF
2. Categoria: Pos-venda • Motivo: Garantia • Origem: WhatsApp
3. Ação: ☑️ Abrir OS de assistência
4. Salvar → "🔧 Abrir OS vinculada"
5. Form Assistência abre com cliente preenchido
6. Seleciona assistência autorizada, problema relatado, etc
7. Abrir OS → gera PDF para enviar ao cliente
```

### 4️⃣ Recebimento de peças na fábrica

```
1. Estoque → Movimentar
2. Tipo: Entrada • Armazém: Sumaré • Modelo: Jaya • Peça: Espelho Esq
3. Quantidade: 10
4. Origem: "Compra Fornecedor X NF-123"
5. Operador: seu nome
6. Registrar → saldo atualizado
```

### 5️⃣ Inventário trimestral

```
1. Estoque → Inventário
2. Operador: seu nome • Observação: "Inventário Q2/2026"
3. Carregar peças → lista aparece com saldos atuais
4. Vai contando fisicamente e digitando quantidades
5. Diferenças ficam destacadas
6. Confirmar inventário → gera N ajustes automaticamente
```

### 6️⃣ Cliente resolvido — coletar NPS

```
1. Vai em Atendimentos (ou Clientes → timeline)
2. Localiza o atendimento → click no card → "✏️ Editar status"
3. Muda para "Resolvido" → motivo "Equipamento entregue ok"
4. Salva → sistema pergunta "Enviar NPS por WhatsApp?"
5. Sim → abre wa.me com mensagem pronta pedindo nota 0-10
6. Cliente responde no WhatsApp; você anota no atendimento via observação ou em outro lugar
```

---

## Dicas e atalhos

- **Hard refresh** (Ctrl+Shift+R) sempre que sentir que o app está numa versão antiga
- O **modal de confirmação** antes de Registrar Venda evita registros acidentais — leia com atenção
- **Atendimentos em aberto** ficam visíveis no resumo do canto superior direito da aba Atendimentos
- **Recentes** em Clientes lembra suas últimas buscas (localStorage, fica no seu navegador)
- **Operadores** em Estoque também ficam salvos por dispositivo (autocomplete)
- **Vinculação retroativa** está disponível em Clientes — qualquer doc legado tem botão "🔗 Vincular a atendimento"
- **Modelos** do catálogo são gerenciados na pasta do Drive (master) — não edite direto pelo app sem coordenação

---

## Perguntas frequentes

**Q: Posso ter mais de 1 ação por atendimento (venda + OS, por exemplo)?**
Sim. No Passo 3 do wizard, marque várias ações. Após salvar o atendimento, aparece um botão para cada ação criar o documento correspondente, todos vinculados ao mesmo protocolo.

**Q: O cliente já comprou antes mas o sistema diz "não encontrado".**
Verifique se digitou o CPF ou telefone corretamente. Se sim, talvez o registro antigo esteja sob outra grafia. Busque por nome parcial.

**Q: Esqueci de vincular um atendimento a um documento já criado.**
Vai em Clientes → busca o cliente → expande timeline → no doc legado, clica em "🔗 Vincular a atendimento" → informa o protocolo. Pronto.

**Q: Orçamento expira em quantos dias?**
7 dias. Após esse prazo, status muda automaticamente para "Expirado". Você pode reabrir manualmente em Orçamentos.

**Q: Como acompanhar o que está pendente?**
Aba **📋 Atendimentos** → filtro Status = "Aberto" ou "Em andamento" ou "Aguardando cliente". O resumo mostra "N em aberto" em destaque laranja.

**Q: Estoque negativo é possível?**
Sim, o sistema permite (em casos legítimos de correção). Aparece em vermelho na aba Saldo. Use a sub-aba Inventário ou Movimentar com tipo Ajuste para regularizar.

**Q: Onde os dados são salvos?**
Tudo em uma planilha Google Drive. Cada operação cria/atualiza linha. Backup automático do Google.

**Q: Posso usar pelo celular?**
Sim — o app é responsivo e funciona em qualquer navegador. Pra ficar como app no celular (PWA) precisa de uma rodada de implementação futura.

---

**Versão deste guia:** 2.21 — 2026-05-16
**Repo:** https://github.com/nxtlojas-hash/sac-pecas
**Suporte:** Claudia Moraes
