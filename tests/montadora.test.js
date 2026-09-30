// 30/09/2026 — a montadora atualiza saldo e foto; o pedido escolhe a peca da
// lista. MEDIDO antes de escrever: 1.779 movimentacoes, TODAS baixa de venda
// (ninguem nunca gravou contagem); 1.048 linhas na aba Estoque, 902 negativas,
// e so 99 delas com nome do catalogo — o atendente digita o nome a mao e a
// venda baixa o nome digitado. Contar sem travar o nome e contar para um dia.
const test = require('node:test');
const assert = require('node:assert');
const lib = require('../lib/montadora.js');
const { chaveModeloEstoque, etiquetaSaldo, validarPecaDoPedido, baixaEstoqueDoItem, linhasMontadora } = lib;

const CATALOGO = {
  'kay': { nome: 'Kay', pecas: [
    { nome: 'Acelerador de punho', preco: 125, peso: '10gr', img: 'img/kay/a.jpeg' },
    { nome: 'Assoalho', preco: 126, peso: '90gr', img: '' }
  ] },
  'juna-smart': { nome: 'JUNA SMART', pecas: [ { nome: 'Pneu aro 12', preco: 150, peso: '1kg', img: 'x' } ] }
};

// ===========================================================================
// A chave do saldo e o NOME do modelo, porque e assim que a venda baixa
// ===========================================================================
test('saldo gravado pela montadora usa o nome do modelo, o mesmo que a venda baixa', () => {
  // A venda manda p.modelo = CATALOGO_MODELOS[id].nome ("JUNA SMART"). O Admin
  // mandava o id ("juna-smart"): 23 linhas de um lado, 58 do outro, na planilha.
  assert.strictEqual(chaveModeloEstoque('juna-smart', CATALOGO), 'JUNA SMART');
  assert.strictEqual(chaveModeloEstoque('kay', CATALOGO), 'Kay');
  assert.strictEqual(chaveModeloEstoque('nao-existe', CATALOGO), 'nao-existe');
});

// ===========================================================================
// Etiqueta honesta no catalogo
// ===========================================================================
test('sem linha na planilha = "Sem contagem", nao "Indisponivel"', () => {
  assert.deepStrictEqual(etiquetaSaldo(null), { classe: 'estoque-sem-info', texto: 'Sem contagem' });
  assert.deepStrictEqual(etiquetaSaldo(undefined), { classe: 'estoque-sem-info', texto: 'Sem contagem' });
});

test('saldo negativo e venda baixando linha nunca contada: "Sem contagem"', () => {
  assert.deepStrictEqual(etiquetaSaldo({ sumare: 0, jaragua: -7 }), { classe: 'estoque-sem-info', texto: 'Sem contagem' });
  assert.deepStrictEqual(etiquetaSaldo({ sumare: -1, jaragua: -2 }), { classe: 'estoque-sem-info', texto: 'Sem contagem' });
});

test('zero de verdade (contado e acabou) = Indisponivel', () => {
  assert.deepStrictEqual(etiquetaSaldo({ sumare: 0, jaragua: 0 }), { classe: 'estoque-indisponivel', texto: 'Indisponível' });
});

test('com saldo mostra so os armazens que tem', () => {
  assert.deepStrictEqual(etiquetaSaldo({ sumare: 0, jaragua: 8 }), { classe: 'estoque-disponivel', texto: 'Jaraguá: 8' });
  assert.deepStrictEqual(etiquetaSaldo({ sumare: 3, jaragua: 0 }), { classe: 'estoque-disponivel', texto: 'Sumaré: 3' });
  assert.deepStrictEqual(etiquetaSaldo({ sumare: 3, jaragua: 8 }), { classe: 'estoque-disponivel', texto: 'Jaraguá: 8 · Sumaré: 3' });
  // um armazem nunca contado (negativo) nao apaga o outro que tem
  assert.deepStrictEqual(etiquetaSaldo({ sumare: -2, jaragua: 5 }), { classe: 'estoque-disponivel', texto: 'Jaraguá: 5' });
});

// ===========================================================================
// O pedido escolhe a peca da lista
// ===========================================================================
test('peca da lista: aceita e devolve o nome COMO ESTA no catalogo (caixa igual a da contagem)', () => {
  const r = validarPecaDoPedido({ descricao: 'acelerador DE punho', modelId: 'kay', foraDaLista: false, catalogo: CATALOGO });
  assert.strictEqual(r.erro, '');
  assert.strictEqual(r.descricao, 'Acelerador de punho');
  assert.strictEqual(r.foraDaLista, false);
});

test('nome digitado que nao esta na lista, sem marcar "fora da lista": recusa e explica', () => {
  const r = validarPecaDoPedido({ descricao: 'Motor', modelId: 'kay', foraDaLista: false, catalogo: CATALOGO });
  assert.ok(/não está na lista/i.test(r.erro), r.erro);
  assert.ok(/fora da lista/i.test(r.erro), r.erro);
});

test('nome fora da lista COM a marcacao: aceita, marcado, sem baixar estoque', () => {
  const r = validarPecaDoPedido({ descricao: 'Motor', modelId: 'kay', foraDaLista: true, catalogo: CATALOGO });
  assert.strictEqual(r.erro, '');
  assert.strictEqual(r.descricao, 'Motor');
  assert.strictEqual(r.foraDaLista, true);
});

test('marcou "fora da lista" mas a peca ESTA na lista: vale a lista (e baixa estoque)', () => {
  const r = validarPecaDoPedido({ descricao: 'Assoalho', modelId: 'kay', foraDaLista: true, catalogo: CATALOGO });
  assert.strictEqual(r.erro, '');
  assert.strictEqual(r.foraDaLista, false);
});

test('modelo "outro" nao tem lista: texto livre, sempre fora da lista', () => {
  const r = validarPecaDoPedido({ descricao: 'Guidão', modelId: 'outro', foraDaLista: false, catalogo: CATALOGO });
  assert.strictEqual(r.erro, '');
  assert.strictEqual(r.foraDaLista, true);
});

test('item global (mao de obra) e aceito em qualquer modelo e nao baixa estoque', () => {
  const globais = [{ nome: 'Mão de obra', precoEditavel: true, isMaoDeObra: true }];
  const r = validarPecaDoPedido({ descricao: 'mão de obra', modelId: 'kay', foraDaLista: false, catalogo: CATALOGO, globais: globais });
  assert.strictEqual(r.erro, '');
  assert.strictEqual(r.descricao, 'Mão de obra');
  assert.strictEqual(r.foraDaLista, true);
});

test('descricao vazia e recusada', () => {
  const r = validarPecaDoPedido({ descricao: '   ', modelId: 'kay', foraDaLista: false, catalogo: CATALOGO });
  assert.ok(r.erro);
});

test('baixa de estoque: so peca da lista', () => {
  assert.strictEqual(baixaEstoqueDoItem({ descricao: 'Acelerador de punho', foraDaLista: false }), true);
  assert.strictEqual(baixaEstoqueDoItem({ descricao: 'Motor', foraDaLista: true }), false);
  assert.strictEqual(baixaEstoqueDoItem({ descricao: 'Mão de obra', isMaoDeObra: true }), false);
  // pedido antigo, sem a marcacao (antes desta versao): segue baixando como sempre
  assert.strictEqual(baixaEstoqueDoItem({ descricao: 'Assoalho' }), true);
});

// ===========================================================================
// As linhas da tela da montadora
// ===========================================================================
test('linhas da montadora: uma por peca do modelo, com saldo de Jaragua e a data da ultima gravacao', () => {
  const estoque = [
    { modelo: 'Kay', peca: 'ACELERADOR DE PUNHO', sumare: 0, jaragua: 8, ultimaAtualizacao: '2026-08-04T20:05:57.513Z' },
    { modelo: 'kay', peca: 'Assoalho', sumare: 0, jaragua: -5, ultimaAtualizacao: '2026-09-29T10:00:00.000Z' },
    { modelo: 'JUNA SMART', peca: 'Pneu aro 12', sumare: 0, jaragua: 2, ultimaAtualizacao: '' }
  ];
  const linhas = linhasMontadora('kay', CATALOGO, estoque);
  assert.strictEqual(linhas.length, 2);
  assert.deepStrictEqual(linhas[0], { idx: 0, nome: 'Acelerador de punho', img: 'img/kay/a.jpeg', preco: 125, sumare: 0, jaragua: 8, contado: true, ultima: '2026-08-04T20:05:57.513Z' });
  // negativo = nunca contado: a tela mostra vazio, nao o numero negativo
  assert.strictEqual(linhas[1].jaragua, -5);
  assert.strictEqual(linhas[1].contado, false);
  assert.strictEqual(linhas[1].img, '');
});

test('linhas da montadora: modelo casa por nome OU por id (as duas formas existem na planilha)', () => {
  const estoque = [
    { modelo: 'juna-smart', peca: 'Pneu aro 12', sumare: 0, jaragua: 4, ultimaAtualizacao: '' },
    { modelo: 'JUNA SMART', peca: 'Pneu aro 12', sumare: 0, jaragua: -3, ultimaAtualizacao: '' }
  ];
  const linhas = linhasMontadora('juna-smart', CATALOGO, estoque);
  assert.strictEqual(linhas.length, 1);
  // vale a linha que a VENDA baixa (nome do modelo), porque e nela que a contagem tem de cair
  assert.strictEqual(linhas[0].jaragua, -3);
});
