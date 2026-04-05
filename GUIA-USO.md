# NXT SAC Pecas V2 - Guia de Uso

**URL:** https://nxtlojas-hash.github.io/sac-pecas/

---

## Tela Inicial

Ao abrir o sistema, voce ve:
- **12 modelos** de motos com foto real (Kay, Jaya, Luna, Shaka, Zilla, Juna Smart, Juna, Gataka, Pancho, Hyphen, Vega, Kimbo)
- **Tabela Completa de Precos** - consulta rapida de todas as pecas com busca
- **Controle de Estoque** - acesso direto ao gerenciamento de estoque

---

## 1. CONSULTAR PECAS (Catalogo)

**Para que serve:** Identificar visualmente a peca, ver preco e peso corretos.

**Como usar:**
1. Clique no modelo da moto na tela inicial
2. Veja todas as pecas com foto, preco e peso
3. Use o campo "Buscar peca..." para filtrar por nome
4. Clique na foto para ampliar (zoom)
5. Marque "Revenda (-15%)" para ver preco de revenda

**Badges de estoque nos cards:**
- Verde (S:5 | J:3) = disponivel em Sumare e Jaragua
- Amarelo (S:0 | J:2) = disponivel em apenas uma unidade
- Vermelho (Indisponivel) = sem estoque em ambas
- Cinza (Sem info) = estoque nao cadastrado

---

## 2. REGISTRAR VENDA/GARANTIA (Formulario)

**Para que serve:** Registrar atendimento de venda de pecas ou garantia. Envia para planilha Google + Bling.

**Como usar:**

### Pelo Catalogo (recomendado):
1. No catalogo, clique "Registrar" na peca desejada
2. A peca e adicionada automaticamente ao formulario com preco e peso
3. Voce pode voltar ao catalogo e adicionar mais pecas
4. Va para a aba "Registrar" para completar o formulario

### Manualmente:
1. Clique na aba "Registrar"
2. Preencha:
   - **Tipo:** Venda SAC, Venda Sumare ou Garantia
   - **Origem:** Telefone, WhatsApp, Email, etc.
   - **Cliente:** Nome, CPF/CNPJ, telefone, endereco (CEP preenche automatico)
   - **Pecas:** Selecione modelo, busque a peca, defina quantidade
   - **Frete:** Transportadora, valor (peso calculado automaticamente)
   - **Pagamento:** Forma, parcelas
3. Clique "Registrar Atendimento"
4. O sistema salva na planilha e envia para o Bling

**Alertas de estoque:** Se a peca estiver indisponivel, aparece um alerta amarelo mas voce PODE registrar normalmente.

---

## 3. ORCAMENTOS

**Para que serve:** Criar orcamentos para clientes sem registrar a venda. Pode resgatar e converter em venda depois.

### Criar Orcamento:
1. Clique na aba "Orcamentos"
2. Clique "+ Novo Orcamento"
3. Preencha dados do cliente (nome, telefone, documento, email)
4. Adicione pecas: selecione modelo e peca direto no modal, ou use "Buscar no Catalogo"
5. Clique "Salvar" ou "Salvar + PDF"

### Resgatar Orcamento:
1. Na aba "Orcamentos", use o campo de busca
2. Busque por: numero (ORC-...), nome do cliente, telefone
3. Filtre por status: Pendente, Aprovado, Expirado
4. Filtre por data

### Aprovar Orcamento:
1. Clique no orcamento na lista
2. Clique "Aprovar -> Registrar"
3. O sistema preenche o formulario automaticamente
4. Complete os dados restantes e registre

### PDF:
- Ao salvar, clique "Salvar + PDF" para gerar PDF automaticamente
- O PDF fica salvo no Google Drive e pode ser compartilhado com o cliente
- O link do PDF fica salvo na planilha (aba Orcamentos)

### Status:
- **Pendente** - aguardando resposta do cliente (amarelo)
- **Aprovado** - cliente aceitou, convertido em venda (verde)
- **Expirado** - passou da validade sem resposta (vermelho)

---

## 4. CONTROLE DE ESTOQUE

**Para que serve:** Saber quantas pecas tem em cada unidade (Sumare e Jaragua).

### Consultar:
- No catalogo, cada peca mostra o badge de estoque
- Na tela inicial, clique "Controle de Estoque"

### Gerenciar:
1. Va em Admin (icone engrenagem) -> aba "Estoque"
2. Filtre por modelo ou busque por nome
3. Clique no numero da quantidade para editar
4. Digite o novo valor e pressione Enter
5. Salva automaticamente

### Baixa automatica:
- Quando uma venda e registrada, o estoque e decrementado automaticamente
- Nao bloqueia a venda se estoque for zero (apenas alerta)

---

## 5. ADMIN - GERENCIAR PECAS

**Para que serve:** Cadastrar novas pecas, editar precos/pesos, excluir pecas.

### Acessar:
- Clique no icone engrenagem (Admin) no menu

### Cadastrar nova peca:
1. Clique "Nova Peca"
2. Preencha: nome, modelo(s), preco cliente, peso
3. Selecione multiplos modelos se a peca for comum
4. Opcionalmente adicione uma foto (salva no Google Drive)
5. Clique "Adicionar Peca"

### Editar peca existente:
1. Na tabela do Admin, clique no icone de lapis
2. Altere nome, preco, peso ou modelos
3. Clique "Salvar Alteracoes"
4. Tambem pode editar pelo catalogo (icone lapis no card)

### Excluir peca:
1. Na tabela do Admin, clique no icone de lixeira
2. Confirme a exclusao

**Todas as alteracoes sao salvas no Google Sheets e persistem ao recarregar a pagina.**

---

## 6. TABELA DE PRECOS

**Para que serve:** Consulta rapida de precos de todas as pecas.

1. Na tela inicial, clique "Tabela Completa de Precos"
2. Veja todas as pecas de todos os modelos
3. Colunas: Modelo, Peca, Preco Cliente, Preco Revenda, Peso
4. Use o campo de busca para filtrar

---

## Resumo Rapido

| Quero... | Faca... |
|----------|---------|
| Ver a foto de uma peca | Inicio -> modelo -> catalogo |
| Saber o preco | Catalogo ou Tabela de Precos |
| Saber o peso para frete | Catalogo (badge no card) |
| Registrar uma venda | Catalogo -> "Registrar" na peca -> completar formulario |
| Fazer um orcamento | Orcamentos -> Novo Orcamento |
| Resgatar orcamento | Orcamentos -> buscar por nome/numero |
| Converter orcamento em venda | Abrir orcamento -> Aprovar -> Registrar |
| Ver estoque | Catalogo (badges) ou Controle de Estoque |
| Atualizar estoque | Admin -> Estoque -> editar quantidades |
| Cadastrar peca nova | Admin -> Nova Peca |
| Editar preco/peso | Admin -> lapis na peca |

---

## Dados e Persistencia

| Dado | Onde fica salvo |
|------|----------------|
| Pecas (catalogo base) | Arquivo data.js no GitHub |
| Pecas editadas/novas | Google Sheets (aba Pecas) |
| Registros de venda | Google Sheets (aba PEDIDOS + Registros) + Bling |
| Orcamentos | Google Sheets (aba Orcamentos) |
| PDFs de orcamento | Google Drive (pasta compartilhada) |
| Estoque | Google Sheets (aba Estoque) |
| Imagens novas | Google Drive (pasta imagens-pecas) |
