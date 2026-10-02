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

test('acento nao faz a peca cair fora da lista: "Modulo" acha "Módulo"', () => {
  const cat = { 'kay': { nome: 'Kay', pecas: [ { nome: 'Módulo', preco: 354 }, { nome: 'Alça encosto', preco: 115 } ] } };
  let r = validarPecaDoPedido({ descricao: 'modulo', modelId: 'kay', foraDaLista: false, catalogo: cat });
  assert.strictEqual(r.erro, ''); assert.strictEqual(r.descricao, 'Módulo'); assert.strictEqual(r.foraDaLista, false);
  r = validarPecaDoPedido({ descricao: 'ALCA ENCOSTO', modelId: 'kay', foraDaLista: false, catalogo: cat });
  assert.strictEqual(r.descricao, 'Alça encosto');
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

// ===========================================================================
// 30/09 (tarde) — a PLANILHA passa a mandar na lista de pecas
// ===========================================================================
const { linhasParaMigrar, pecasDaPlanilhaPorModelo, jaExisteNoModelo } = lib;

test('migracao: vai para a planilha so o que esta em data.js e ainda nao esta la (sem caixa/acento)', () => {
  const dataJs = { 'kay': { nome: 'Kay', pecas: [
    { nome: 'Acelerador de punho', preco: 125, peso: '10gr', img: 'img/kay/a.jpeg,' },
    { nome: 'Alça encosto', preco: 115, peso: '55gr', img: 'img/kay/b.jpeg' },
    { nome: 'Assoalho', preco: 126, peso: '90gr', img: '' }
  ] }, 'outro': { nome: 'Outro', pecas: [] } };
  const planilha = [ { modelo: 'kay', nome: 'ALCA ENCOSTO', preco: 115 } ];
  const existe = (p) => p === 'img/kay/b.jpeg';
  const r = linhasParaMigrar(dataJs, planilha, existe);
  assert.deepStrictEqual(r, [
    { modelo: 'kay', modeloNome: 'Kay', nome: 'Acelerador de punho', preco: 125, peso: '10gr', img: '' },
    { modelo: 'kay', modeloNome: 'Kay', nome: 'Assoalho', preco: 126, peso: '90gr', img: '' }
  ]);
});

test('migracao: caminho de foto que existe no repo vai junto; que nao existe vira vazio', () => {
  const dataJs = { 'kay': { nome: 'Kay', pecas: [ { nome: 'Banco', preco: 225, peso: '1,60kg', img: 'img/kay/Banco 1,60kg.jpeg' } ] } };
  const r = linhasParaMigrar(dataJs, [], (p) => p === 'img/kay/Banco 1,60kg.jpeg');
  assert.strictEqual(r[0].img, 'img/kay/Banco 1,60kg.jpeg');
});

test('planilha manda: a lista de um modelo vira as linhas da planilha, sem repetidas (a ultima vale)', () => {
  const linhas = [
    { modelo: 'kay', nome: 'Banco', preco: '225', peso: '1,60kg', img: 'img/kay/Banco.jpeg' },
    { modelo: 'kay', nome: 'banco', preco: '230', peso: '1,60kg', img: 'https://drive/x' },
    { modelo: 'JAYA', nome: 'Motor', preco: '', peso: '', img: '' }
  ];
  const porModelo = pecasDaPlanilhaPorModelo(linhas);
  assert.deepStrictEqual(Object.keys(porModelo).sort(), ['jaya', 'kay']);
  assert.deepStrictEqual(porModelo.kay, [ { nome: 'banco', preco: 230, peso: '1,60kg', img: 'https://drive/x' } ]);
  assert.deepStrictEqual(porModelo.jaya, [ { nome: 'Motor', preco: null, peso: null, img: '' } ]);
});

test('nova peca: recusa nome que ja existe no modelo (sem caixa/acento)', () => {
  const pecas = [ { nome: 'Módulo' }, { nome: 'Banco' } ];
  assert.strictEqual(jaExisteNoModelo('modulo', pecas), true);
  assert.strictEqual(jaExisteNoModelo('Banco ', pecas), true);
  assert.strictEqual(jaExisteNoModelo('Módulo Juna', pecas), false);
});

// 02/10/2026 — o seletor so mostrava os 6 modelos que tinham peca no data.js.
// Gataka (61), Hyphen (43), V0, Jay, Vega, Juna, Pancho e Akasha so existem na
// planilha: o Rafael nao via esses modelos. A lista sai do catalogo DEPOIS da
// planilha, e a tela refaz o seletor quando ela chega.
// 02/10 (ela): todo modelo que ja passou pela NXT tem suporte — o seletor mostra
// tambem os sem peca (Juna 2026, Kimbo), para a montadora cadastrar a primeira.
test('seletor da montadora: TODOS os modelos, inclusive sem peca; fora "outro" e "smart-juna"; ordem de nome', () => {
  const { modelosDaMontadora } = lib;
  const catalogo = {
    'kay':        { nome: 'Kay', pecas: [ { nome: 'Banco' } ] },
    'gataka':     { nome: 'Gataka', pecas: [ { nome: 'Motor' } ], daPlanilha: true },
    'akasha':     { nome: 'Akasha', pecas: [] },
    'juna-2026':  { nome: 'Juna 2026', pecas: [] },
    'smart-juna': { nome: 'Smart-Juna', pecas: [] },
    'outro':      { nome: 'Outro', pecas: [ { nome: 'Qualquer' } ] },
    'jaya':       { nome: 'JAYA', pecas: [ { nome: 'Motor' } ] }
  };
  assert.deepStrictEqual(modelosDaMontadora(catalogo), ['akasha', 'gataka', 'jaya', 'juna-2026', 'kay']);
  assert.deepStrictEqual(modelosDaMontadora(null), []);
});

// 02/10/2026 — a marca "fora da lista" aparecia na tela mas nao ia para a
// planilha: o mapeamento do envio so levava 12 campos. Sem ela, medir se a
// lista ajudou exigiu comparar nome por nome. Agora o item gravado diz.
test('item do pedido gravado: leva foraDaLista e modelId, sem perder os campos de antes', () => {
  const { itemParaRegistro } = lib;
  const p = { id: 1, modelId: 'kay', modelo: 'Kay', descricao: 'Banco', cor: 'Preto', tipoPreco: 'cliente',
    quantidade: 2, precoUnitario: 10, total: 20, peso: '1kg', pesoGramas: 2000, img: '', imgManual: '',
    isMaoDeObra: false, foraDaLista: true };
  assert.deepStrictEqual(itemParaRegistro(p), {
    descricao: 'Banco', modelo: 'Kay', modelId: 'kay', cor: 'Preto', tipoPreco: 'cliente', quantidade: 2,
    precoUnitario: 10, total: 20, peso: '1kg', pesoGramas: 2000, img: '', imgManual: '',
    isMaoDeObra: false, foraDaLista: true
  });
  const velho = itemParaRegistro({ descricao: 'X', modelo: 'Kay' });
  assert.strictEqual(velho.foraDaLista, false);
  assert.strictEqual(velho.isMaoDeObra, false);
  assert.strictEqual(velho.modelId, '');
});

// 02/10/2026 — a baixa de estoque (formulario.js, baixaEstoqueVenda) recebe o
// pedido JA MAPEADO para o envio. Sem foraDaLista no mapeamento, item fora da
// lista baixava estoque (medido: "Hyphen Carregador -3", "JUNA SMART PAINEL -18").
test('baixa usa o item mapeado: fora da lista NAO baixa; da lista baixa', () => {
  const { itemParaRegistro, baixaEstoqueDoItem } = lib;
  assert.strictEqual(baixaEstoqueDoItem(itemParaRegistro({ descricao: 'Carregador', modelo: 'Hyphen', foraDaLista: true })), false);
  assert.strictEqual(baixaEstoqueDoItem(itemParaRegistro({ descricao: 'Banco', modelo: 'Kay', foraDaLista: false })), true);
  assert.strictEqual(baixaEstoqueDoItem(itemParaRegistro({ descricao: 'Mão de obra', modelo: 'Kay', isMaoDeObra: true, foraDaLista: true })), false);
});
