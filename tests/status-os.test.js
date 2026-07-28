const test = require('node:test');
const assert = require('node:assert');
const { montarOpcoesStatus, montarOpcoesFiltroStatus } = require('../lib/status-os.js');

const ETAPAS = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Em conserto', 'Pronto p/ retirar'];

test('status real fora do enum (Em andamento, o valor com que toda OS nasce) fica visivel e selecionado', () => {
  const opcoes = montarOpcoesStatus('Em andamento', ETAPAS);
  assert.strictEqual(opcoes.length, ETAPAS.length + 1);
  assert.strictEqual(opcoes[0].valor, 'Em andamento');
  assert.strictEqual(opcoes[0].selecionado, true);
  assert.strictEqual(opcoes[0].legado, true);
  // nenhuma das 5 etapas normais pode aparecer marcada por engano
  const selecionadas = opcoes.filter(function(o) { return o.selecionado; });
  assert.strictEqual(selecionadas.length, 1);
  assert.strictEqual(selecionadas[0].valor, 'Em andamento');
});

test('status dentro do enum (Aberta) nao ganha opcao extra, so a marcacao normal', () => {
  const opcoes = montarOpcoesStatus('Aberta', ETAPAS);
  assert.strictEqual(opcoes.length, ETAPAS.length);
  const selecionadas = opcoes.filter(function(o) { return o.selecionado; });
  assert.strictEqual(selecionadas.length, 1);
  assert.strictEqual(selecionadas[0].valor, 'Aberta');
  assert.strictEqual(selecionadas[0].legado, false);
});

test('status em branco cai na mesma convencao do resto do arquivo (branco == Aberta)', () => {
  const opcoes = montarOpcoesStatus('', ETAPAS);
  assert.strictEqual(opcoes.length, ETAPAS.length);
  const selecionadas = opcoes.filter(function(o) { return o.selecionado; });
  assert.strictEqual(selecionadas.length, 1);
  assert.strictEqual(selecionadas[0].valor, 'Aberta');
});

test('exatamente uma opcao selecionada, sempre (nunca zero, nunca duas)', () => {
  ['Em andamento', 'Aberta', 'Em análise', '', 'Cancelada (status inventado)'].forEach(function(status) {
    const opcoes = montarOpcoesStatus(status, ETAPAS);
    const selecionadas = opcoes.filter(function(o) { return o.selecionado; });
    assert.strictEqual(selecionadas.length, 1, 'status "' + status + '" deveria ter exatamente 1 opcao selecionada');
  });
});

// ===== FILTRO do topo da tela (montarOpcoesFiltroStatus) =====
// Producao 28/07: listar_os devolve total 283, e as 283 estao em 'Em andamento'
// (etapa 0), status que NAO esta nas 5 ETAPAS_OS. Como listarOS compara status
// por igualdade exata, qualquer opcao do filtro antigo devolvia lista vazia.

const valores = (opcoes) => opcoes.map((o) => o.valor);

test('status real fora do enum (Em andamento) vira opcao do filtro, rotulado como fora do padrao', () => {
  const dados = [{ status: 'Em andamento' }, { status: 'Em andamento' }, { status: 'Em andamento' }];
  const opcoes = montarOpcoesFiltroStatus(dados, ETAPAS, '');
  const extra = opcoes.filter((o) => o.valor === 'Em andamento');
  assert.strictEqual(extra.length, 1);
  assert.strictEqual(extra[0].legado, true);
  assert.match(extra[0].rotulo, /fora do padrão/);
  // o valor tem que ir cru pra querystring; o "(fora do padrão)" e so rotulo
  assert.strictEqual(extra[0].valor, 'Em andamento');
  assert.strictEqual(opcoes.length, 1 + ETAPAS.length + 1);
});

test('status que ja e uma ETAPA nao duplica (nem quando aparece em varias OS)', () => {
  const dados = [{ status: 'Aberta' }, { status: 'Em conserto' }, { status: 'Aberta' }];
  const opcoes = montarOpcoesFiltroStatus(dados, ETAPAS, '');
  assert.strictEqual(opcoes.length, 1 + ETAPAS.length);
  assert.strictEqual(valores(opcoes).filter((v) => v === 'Aberta').length, 1);
  assert.strictEqual(opcoes.filter((o) => o.legado).length, 0);
});

test('status fora do enum repetido em muitas OS entra uma vez so', () => {
  const dados = [
    { status: 'Em andamento' }, { status: 'Cancelada' }, { status: 'Em andamento' },
    { status: 'Cancelada' }, { status: 'Em andamento' }
  ];
  const opcoes = montarOpcoesFiltroStatus(dados, ETAPAS, '');
  assert.deepStrictEqual(valores(opcoes), ['', ...ETAPAS, 'Em andamento', 'Cancelada']);
});

test('lista vazia de dados nao quebra (nem null/undefined) e ainda oferece as etapas', () => {
  [[], null, undefined].forEach((dados) => {
    const opcoes = montarOpcoesFiltroStatus(dados, ETAPAS, '');
    assert.deepStrictEqual(valores(opcoes), ['', ...ETAPAS]);
    assert.strictEqual(opcoes.filter((o) => o.selecionado).length, 1);
  });
  // sem etapas nenhuma tambem nao pode quebrar
  assert.deepStrictEqual(valores(montarOpcoesFiltroStatus(null, null, '')), ['']);
});

test("a opcao 'Todos' continua existindo, sempre em primeiro e com valor vazio", () => {
  const cenarios = [
    [[], ''],
    [[{ status: 'Em andamento' }], 'Em andamento'],
    [[{ status: 'Aberta' }], 'Aberta'],
    [[{ status: '  ' }, { status: '' }], '']
  ];
  cenarios.forEach(([dados, sel]) => {
    const opcoes = montarOpcoesFiltroStatus(dados, ETAPAS, sel);
    assert.strictEqual(opcoes[0].valor, '');
    assert.strictEqual(opcoes[0].rotulo, 'Todos');
    assert.strictEqual(opcoes.filter((o) => o.valor === '').length, 1);
  });
});

test('a selecao atual nao se perde na recarga, mesmo quando o resultado vem vazio', () => {
  // caso real: filtra por 'Em andamento', alguem move todas, a recarga volta []
  const opcoes = montarOpcoesFiltroStatus([], ETAPAS, 'Em andamento');
  const selecionadas = opcoes.filter((o) => o.selecionado);
  assert.strictEqual(selecionadas.length, 1);
  assert.strictEqual(selecionadas[0].valor, 'Em andamento');
  assert.strictEqual(selecionadas[0].legado, true);
});

test('selecao atual que e etapa fica marcada nela mesma, sem virar opcao legado', () => {
  const opcoes = montarOpcoesFiltroStatus([{ status: 'Em andamento' }], ETAPAS, 'Em conserto');
  const selecionadas = opcoes.filter((o) => o.selecionado);
  assert.strictEqual(selecionadas.length, 1);
  assert.strictEqual(selecionadas[0].valor, 'Em conserto');
  assert.strictEqual(selecionadas[0].legado, false);
  assert.strictEqual(valores(opcoes).filter((v) => v === 'Em conserto').length, 1);
});

test("selecao vazia marca 'Todos' e nenhuma outra", () => {
  const opcoes = montarOpcoesFiltroStatus([{ status: 'Em andamento' }], ETAPAS, '');
  const selecionadas = opcoes.filter((o) => o.selecionado);
  assert.strictEqual(selecionadas.length, 1);
  assert.strictEqual(selecionadas[0].rotulo, 'Todos');
});

test('status em branco ou so espaco nos dados nao vira opcao fantasma', () => {
  const dados = [{ status: '' }, { status: '   ' }, { status: null }, {}, null, { status: 'Em andamento' }];
  const opcoes = montarOpcoesFiltroStatus(dados, ETAPAS, '');
  assert.deepStrictEqual(valores(opcoes), ['', ...ETAPAS, 'Em andamento']);
});

// REESCRITO de proposito na rodada 2. Este teste se chamava "status vem
// trimado (celula de planilha com espaco nao cria opcao duplicada)" e FIXAVA o
// comportamento errado. Motivo da troca: o backend NAO trima —
//   google-apps-script.js:4121  status: String(r[21] || 'Aberta')   (celula crua)
//   google-apps-script.js:4127  if (filtros.status && o.status !== filtros.status) continue;  (igualdade exata)
// entao uma opcao com valor trimado a partir da celula 'Em andamento ' nunca
// casaria com a propria linha que a originou: seria o sintoma exato ("filtrei
// e nao veio nada") que esta mudanca existe pra matar. Regra nova: VALOR cru
// byte a byte, ROTULO trimado, deduplicacao pelo valor cru. Duas opcoes
// visualmente iguais e o preco honesto — cada uma acha as SUAS linhas, o que e
// melhor que uma unica opcao que nao acha nenhuma.
test('valor da opcao vai CRU, sem trim (o backend compara exato); so o rotulo exibido e trimado', () => {
  const dados = [{ status: 'Em andamento ' }, { status: 'Em andamento' }, { status: ' Aberta' }];
  const opcoes = montarOpcoesFiltroStatus(dados, ETAPAS, '');
  assert.deepStrictEqual(valores(opcoes), ['', ...ETAPAS, 'Em andamento ', 'Em andamento', ' Aberta']);

  const comEspaco = opcoes.find((o) => o.valor === 'Em andamento ');
  assert.strictEqual(comEspaco.valor, 'Em andamento '); // com o espaco, igualzinho a celula
  assert.strictEqual(comEspaco.rotulo, 'Em andamento (fora do padrão)'); // rotulo trimado
  assert.strictEqual(comEspaco.legado, true);

  // ' Aberta' NAO e a etapa 'Aberta' aos olhos do backend: vira a sua propria
  // opcao em vez de apontar pra um valor que nao casa com a linha dela.
  assert.strictEqual(opcoes.find((o) => o.valor === ' Aberta').legado, true);
  assert.strictEqual(opcoes.find((o) => o.valor === 'Aberta').legado, false);
});

test('status ja visto na sessao NAO some quando a resposta vem vazia (os 2 cliques reais)', () => {
  // Producao 28/07: as 283 OS estao em 'Em andamento'. A atendente abre a tela
  // (o dropdown ganha 'Em andamento'), escolhe 'Em conserto', o backend devolve
  // 0 — e o filtro montado so com a resposta atual apagava o UNICO status que
  // acha alguma coisa. Quem acumula os vistos e o os-lista.js; aqui eles chegam
  // pelo 4o argumento, entao a funcao continua pura (sem estado global).
  const vistos = ['Em andamento'];
  const opcoes = montarOpcoesFiltroStatus([], ETAPAS, 'Em conserto', vistos);
  assert.deepStrictEqual(valores(opcoes), ['', ...ETAPAS, 'Em andamento']);
  assert.strictEqual(opcoes.find((o) => o.valor === 'Em andamento').legado, true);
  // e o filtro escolhido continua sendo o que esta marcado
  const selecionadas = opcoes.filter((o) => o.selecionado);
  assert.strictEqual(selecionadas.length, 1);
  assert.strictEqual(selecionadas[0].valor, 'Em conserto');
});

test('status visto na sessao nao duplica o que ja veio nos dados nem as etapas', () => {
  const dados = [{ status: 'Em andamento' }, { status: 'Aberta' }];
  const vistos = ['Em andamento', 'Aberta', 'Cancelada', '', '   '];
  const opcoes = montarOpcoesFiltroStatus(dados, ETAPAS, '', vistos);
  assert.deepStrictEqual(valores(opcoes), ['', ...ETAPAS, 'Em andamento', 'Cancelada']);
});

test('aceita tambem uma lista de strings, nao so a OS inteira', () => {
  const opcoes = montarOpcoesFiltroStatus(['Em andamento', 'Aberta'], ETAPAS, '');
  assert.deepStrictEqual(valores(opcoes), ['', ...ETAPAS, 'Em andamento']);
});

test('os valores do filtro sobrevivem a querystring com espaco e acento', () => {
  const dados = [{ status: 'Em andamento' }];
  const opcoes = montarOpcoesFiltroStatus(dados, ETAPAS, '');
  const url = (v) => 'status=' + encodeURIComponent(v);
  assert.strictEqual(url('Em andamento'), 'status=Em%20andamento');
  assert.strictEqual(url('Em análise'), 'status=Em%20an%C3%A1lise');
  assert.strictEqual(url('Aguardando aprovação'), 'status=Aguardando%20aprova%C3%A7%C3%A3o');
  assert.strictEqual(url('Pronto p/ retirar'), 'status=Pronto%20p%2F%20retirar');
  // e o decode do outro lado tem que devolver exatamente o valor da opcao
  opcoes.forEach((o) => {
    assert.strictEqual(decodeURIComponent(encodeURIComponent(o.valor)), o.valor);
  });
});
