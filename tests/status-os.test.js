const test = require('node:test');
const assert = require('node:assert');
const { montarOpcoesStatus, montarOpcoesFiltroStatus, etapasDaResposta } = require('../lib/status-os.js');

// Espelha ETAPAS_OS (google-apps-script.js). A ultima virou 'Finalizado' em
// 28/07: a maioria das assistencias e na casa do cliente, e 'Pronto p/ retirar'
// mandava o cliente buscar uma moto que o tecnico vai entregar.
const ETAPAS = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Em conserto', 'Finalizado'];

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
  // 'Pronto p/ retirar' saiu do enum mas continua gravado na OS-2026-0864, e a
  // barra e o unico caractere aqui que vira %2F — o caso fica coberto.
  assert.strictEqual(url('Pronto p/ retirar'), 'status=Pronto%20p%2F%20retirar');
  // e o decode do outro lado tem que devolver exatamente o valor da opcao
  opcoes.forEach((o) => {
    assert.strictEqual(decodeURIComponent(encodeURIComponent(o.valor)), o.valor);
  });
});

// ===== etapasDaResposta: o enum vem do backend, com fallback obrigatorio =====
// O front tinha uma COPIA hardcoded das 5 etapas. Agora listar_os devolve
// `etapas` e ela e a fonte da verdade — mas a v45, que esta no ar, NAO manda o
// campo (medido 28/07: listar_os devolve {ok,oses,total,exibidos} e nada mais).
// Sem fallback o seletor de status ficaria vazio e a tela pararia de mover OS.
const ETAPAS_NOVAS = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Em conserto', 'Finalizado'];

test('v45 no ar: resposta sem `etapas` cai na copia local, nunca em lista vazia', () => {
  // payload REAL da v45, copiado da resposta de producao de 28/07
  const v45 = { ok: true, oses: [{ numeroOS: 'OS-2026-0916', status: 'Em andamento' }], total: 292, exibidos: 1 };
  assert.deepStrictEqual(etapasDaResposta(v45, ETAPAS_NOVAS), ETAPAS_NOVAS);
});

test('v46: a lista do backend ganha da copia local (e assim os rotulos nunca divergem)', () => {
  const v46 = { ok: true, oses: [], total: 0, exibidos: 0, etapas: ETAPAS_NOVAS };
  // fallback DIFERENTE de proposito: prova que quem mandou foi o backend
  const antiga = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Em conserto', 'Pronto p/ retirar'];
  assert.deepStrictEqual(etapasDaResposta(v46, antiga), ETAPAS_NOVAS);
});

test('resposta ausente, nula ou nao-objeto cai no fallback', () => {
  [undefined, null, '', 0, 'erro', []].forEach((r) => {
    assert.deepStrictEqual(etapasDaResposta(r, ETAPAS_NOVAS), ETAPAS_NOVAS);
  });
});

test('`etapas` que nao e array cai no fallback', () => {
  [{ etapas: 'Aberta' }, { etapas: {} }, { etapas: null }, { etapas: 5 }].forEach((r) => {
    assert.deepStrictEqual(etapasDaResposta(r, ETAPAS_NOVAS), ETAPAS_NOVAS);
  });
});

test('array vazio ou so com lixo cai no fallback (nunca devolve seletor vazio)', () => {
  [[], ['', '   '], [null, undefined], [1, 2, {}], [{ nome: 'Aberta' }]].forEach((etapas) => {
    assert.deepStrictEqual(etapasDaResposta({ etapas }, ETAPAS_NOVAS), ETAPAS_NOVAS);
  });
});

test('lista parcialmente suja aproveita o que presta, sem cair no fallback inteiro', () => {
  const r = { etapas: ['Aberta', '', 'Em conserto', null, 7, 'Finalizado'] };
  assert.deepStrictEqual(etapasDaResposta(r, ETAPAS_NOVAS), ['Aberta', 'Em conserto', 'Finalizado']);
});

test('deduplica sem reordenar', () => {
  const r = { etapas: ['Aberta', 'Em conserto', 'Aberta', 'Finalizado', 'Em conserto'] };
  assert.deepStrictEqual(etapasDaResposta(r, ETAPAS_NOVAS), ['Aberta', 'Em conserto', 'Finalizado']);
});

test('valores vem CRUS: nao trima, porque o backend compara status por igualdade exata', () => {
  const r = { etapas: ['Aberta ', ' Em conserto'] };
  assert.deepStrictEqual(etapasDaResposta(r, ETAPAS_NOVAS), ['Aberta ', ' Em conserto']);
});

test('fallback invalido nao explode: devolve [] em vez de quebrar a tela', () => {
  assert.deepStrictEqual(etapasDaResposta({ ok: true }, undefined), []);
  assert.deepStrictEqual(etapasDaResposta(null, 'Aberta'), []);
});

test('nao muta nem a resposta nem o fallback', () => {
  const fallback = ETAPAS_NOVAS.slice();
  const r = { etapas: ['Aberta', '', 'Finalizado'] };
  etapasDaResposta(r, fallback);
  assert.deepStrictEqual(fallback, ETAPAS_NOVAS);
  assert.deepStrictEqual(r.etapas, ['Aberta', '', 'Finalizado']);
});

// A ponta a ponta que interessa: com a v45 no ar, o seletor do cartao continua
// oferecendo as 5 etapas E marcando o status legado da linha.
test('v45 + OS legada: fallback alimenta montarOpcoesStatus e o status real fica selecionado', () => {
  const v45 = { ok: true, oses: [{ status: 'Em andamento' }], total: 292, exibidos: 1 };
  const etapas = etapasDaResposta(v45, ETAPAS_NOVAS);
  const opcoes = montarOpcoesStatus('Em andamento', etapas);
  assert.strictEqual(opcoes.length, 6);
  assert.strictEqual(opcoes[0].valor, 'Em andamento');
  assert.strictEqual(opcoes[0].selecionado, true);
  assert.ok(opcoes.some((o) => o.valor === 'Finalizado'));
});

// OS-2026-0864 continua gravada como 'Pronto p/ retirar' — rotulo que saiu do
// enum em 28/07. A dona ajusta na mao; ate la a tela nao pode nem esconder nem
// reescrever esse valor sozinha.
test('OS-2026-0864: status fora do novo enum continua visivel e selecionado, sem virar Aberta', () => {
  const opcoes = montarOpcoesStatus('Pronto p/ retirar', ETAPAS_NOVAS);
  assert.strictEqual(opcoes[0].valor, 'Pronto p/ retirar');
  assert.strictEqual(opcoes[0].selecionado, true);
  assert.strictEqual(opcoes[0].legado, true);
  assert.strictEqual(opcoes.filter((o) => o.selecionado).length, 1);
  assert.strictEqual(opcoes.find((o) => o.valor === 'Aberta').selecionado, false);
});

// ===========================================================================
// ALIAS LEGADO DE GRAVACAO (rodada 2) — a janela de incompatibilidade
// ===========================================================================
// Trocar o rotulo da ultima etapa abre uma janela em QUALQUER ordem de deploy:
//   front novo + backend v45   -> a tela oferece 'Finalizado', a v45 recusa;
//   backend v46 + front velho  -> a tela oferece 'Pronto p/ retirar' (cache do
//                                 navegador), e sem alias a v46 recusaria.
// Os dois lados sao fechados aqui: o backend ACEITA o rotulo velho
// (ETAPAS_OS_ALIAS_LEGADO) e o fallback do front oferece o rotulo que as DUAS
// versoes aceitam.
//
// atualizarStatusOS nao roda fora do Apps Script (usa SpreadsheetApp e
// LockService), mas o pedaco que decide "aceita ou recusa" e logica PURA: as
// duas declaracoes + statusOsAceito_ sao extraidas da fonte e avaliadas aqui,
// entao o que este teste exercita e o codigo do backend de verdade, nao uma
// reimplementacao paralela que envelheceria em silencio.
const fs = require('fs');
const pathMod = require('path');
const GAS = fs.readFileSync(pathMod.join(__dirname, '..', 'google-apps-script.js'), 'utf8').replace(/\r/g, '');

function declaracaoArray(nome) {
  const m = GAS.match(new RegExp('^var ' + nome + ' = (\\[[^\\]]*\\]);$', 'm'));
  assert.ok(m, 'nao achei a declaracao de ' + nome + ' no backend');
  return { codigo: m[0], valores: JSON.parse(m[1].replace(/'/g, '"')) };
}

function corpoFuncao(fonte, nome) {
  const ini = fonte.indexOf('function ' + nome + '(');
  assert.notStrictEqual(ini, -1, 'nao achei function ' + nome);
  // primeira '}' em inicio de linha (mesmo corte dos testes de busca-texto)
  const fim = fonte.indexOf('\n}', ini);
  assert.notStrictEqual(fim, -1, 'nao achei o fim de ' + nome);
  return fonte.slice(ini, fim + 2);
}

const decEtapas = declaracaoArray('ETAPAS_OS');
const decAlias = declaracaoArray('ETAPAS_OS_ALIAS_LEGADO');
const statusOsAceito = new Function(
  decEtapas.codigo + '\n' + decAlias.codigo + '\n' +
  corpoFuncao(GAS, 'statusOsAceito_') + '\nreturn statusOsAceito_;'
)();

test('ALIAS: a v46 continua ACEITANDO "Pronto p/ retirar" (front velho preso no cache)', () => {
  // este e o caso que quebrava a atendente no meio do expediente
  assert.strictEqual(statusOsAceito('Pronto p/ retirar'), true);
});

test('ALIAS: o rotulo novo e as outras 4 etapas continuam aceitos', () => {
  ['Aberta', 'Em análise', 'Aguardando aprovação', 'Em conserto', 'Finalizado'].forEach((et) => {
    assert.strictEqual(statusOsAceito(et), true, et + ' deveria ser aceito');
  });
  assert.deepStrictEqual(decEtapas.valores, ETAPAS_NOVAS);
});

test('ALIAS: tolerancia e SO pro rotulo velho — nao virou "aceita qualquer coisa"', () => {
  // 'Em andamento' e o legado do status INICIAL (287 OS em producao). Ele
  // continua recusado de proposito: quem grava agora grava 'Aberta'.
  assert.strictEqual(statusOsAceito('Em andamento'), false);
  ['', '   ', 'Cancelada', 'Finalizada', 'qualquer coisa', null, undefined, 0, 42, {}, []]
    .forEach((v) => assert.strictEqual(statusOsAceito(v), false, JSON.stringify(v) + ' nao pode ser aceito'));
});

test('ALIAS: comparacao EXATA, igual ao resto do arquivo (nem trim, nem caixa)', () => {
  // O backend compara status por igualdade exata em todo lugar (listarOS:4127,
  // STATUS_OS_LEGADO). Aceitar 'pronto p/ retirar' ou 'Pronto p/ retirar '
  // aqui gravaria na planilha um valor que nenhum filtro depois encontra.
  assert.strictEqual(statusOsAceito('pronto p/ retirar'), false);
  assert.strictEqual(statusOsAceito('Pronto p/ retirar '), false);
  assert.strictEqual(statusOsAceito(' Pronto p/ retirar'), false);
  assert.strictEqual(statusOsAceito('PRONTO P/ RETIRAR'), false);
});

test('ALIAS: o rotulo velho NAO e oferecido — nem no enum, nem na mensagem de erro', () => {
  // "para de oferecer, mas continua aceitando": o alias e tolerancia de
  // entrada. Se ele entrar em ETAPAS_OS, volta a aparecer no seletor da tela
  // (listar_os devolve `etapas: ETAPAS_OS`) e a troca de rotulo perde o efeito.
  assert.strictEqual(decEtapas.valores.indexOf('Pronto p/ retirar'), -1);
  assert.deepStrictEqual(decAlias.valores, ['Pronto p/ retirar']);

  const corpo = corpoFuncao(GAS, 'atualizarStatusOS');
  assert.ok(/erro: 'Status invalido\. Use: ' \+ ETAPAS_OS\.join/.test(corpo),
    'a mensagem de erro tem que listar so ETAPAS_OS');
  assert.strictEqual(/ALIAS_LEGADO\.join/.test(corpo), false,
    'o alias nao pode ser sugerido ao usuario');
});

test('ALIAS: atualizarStatusOS valida por statusOsAceito_ e grava o valor COMO VEIO', () => {
  const corpo = corpoFuncao(GAS, 'atualizarStatusOS');
  assert.ok(/if \(!statusOsAceito_\(novoStatus\)\)/.test(corpo),
    'a guarda tem que passar por statusOsAceito_');
  assert.strictEqual(/ETAPAS_OS\.indexOf\(novoStatus\)/.test(corpo), false,
    'a checagem antiga (so ETAPAS_OS) recusaria o alias');
  // nada de converter em silencio: a celula recebe novoStatus, byte a byte
  assert.ok(/setValue\(novoStatus\)/.test(corpo), 'tem que gravar novoStatus cru');
  assert.strictEqual(/novoStatus\s*=\s*'Finalizado'/.test(corpo), false,
    'converter o alias em silencio apagaria a escolha de quem clicou');
});

test('ALIAS: a timeline publica trata os dois rotulos como a MESMA ultima etapa', () => {
  // e por isso que aceitar o rotulo velho nao mente pro cliente no QR
  const etapaDoStatus = new Function(corpoFuncao(GAS, 'etapaDoStatus_') + '\nreturn etapaDoStatus_;')();
  assert.strictEqual(etapaDoStatus('Pronto p/ retirar'), 4);
  assert.strictEqual(etapaDoStatus('Finalizado'), 4);
});

// ===== o outro lado da janela: o fallback do front (os-lista.js:18) =====
// Enquanto a v45 estiver no ar ela NAO manda `etapas`, e a tela cai no
// ETAPAS_PADRAO. Se aquele array oferecesse 'Finalizado', a v45 recusaria a
// gravacao. O criterio do fallback e: todo rotulo dele tem que ser aceito pelas
// DUAS versoes.
const ETAPAS_V45 = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Em conserto', 'Pronto p/ retirar'];

test('FALLBACK: todo rotulo do ETAPAS_PADRAO e aceito pela v45 E pela v46', () => {
  const front = fs.readFileSync(pathMod.join(__dirname, '..', 'os-lista.js'), 'utf8');
  const m = front.match(/var ETAPAS_PADRAO = (\[[^\]]*\]);/);
  assert.ok(m, 'nao achei ETAPAS_PADRAO em os-lista.js');
  const padrao = JSON.parse(m[1].replace(/'/g, '"'));

  assert.strictEqual(padrao.length, 5);
  padrao.forEach((et) => {
    // v45: o enum dela e a unica coisa que ela aceita
    assert.notStrictEqual(ETAPAS_V45.indexOf(et), -1, '"' + et + '" seria recusado pela v45');
    // v46: enum novo + alias legado
    assert.strictEqual(statusOsAceito(et), true, '"' + et + '" seria recusado pela v46');
  });
  // e o rotulo da ultima etapa e o VELHO de proposito — e o unico que as duas
  // versoes aceitam. Trocar por 'Finalizado' reabre a janela contra a v45.
  assert.strictEqual(padrao[4], 'Pronto p/ retirar');
});

// ===========================================================================
// MIGRACAO EM LOTE 'Em andamento' -> 'Aberta' (rodada 3, 28/07)
// ===========================================================================
// migrarStatusOsEmAndamentoV1 e o UNICO caminho de escrita em lote do diff: ela
// reescreve ~287 celulas do master de uma vez. Ate a rodada 2 ela nao tinha
// teste NENHUM — a revisao provou por mutacao que trocar o guard por
// `var confirmado = true;` mantinha a suite inteira verde: a migracao gravaria
// sem confirmacao e nada acusaria.
//
// Ela nao roda fora do Apps Script (SpreadsheetApp, LockService), entao vale a
// MESMA tecnica que ja funciona neste arquivo para statusOsAceito_ e
// etapaDoStatus_: extrair o pedaco da FONTE e avaliar com new Function,
// injetando os globais do Apps Script como parametros. O que os testes abaixo
// exercitam e o codigo do backend de verdade, nao uma reimplementacao paralela.
//
// As quatro mutacoes que estes testes existem pra REPROVAR:
//   (a) `var confirmado = true;`            -> perde o dry-run
//   (b) comparacao virar trim/lowercase     -> pega variantes que nao deviam
//   (c) a escrita tocar outra coluna alem da 22
//   (d) o filtro sumir e reescrever linha que nao casou

function declaracaoString(nome) {
  const m = GAS.match(new RegExp("^var " + nome + " = ('[^']*');$", 'm'));
  assert.ok(m, 'nao achei a declaracao de ' + nome + ' no backend');
  return { codigo: m[0], valor: m[1].slice(1, -1) };
}

const decLegado = declaracaoString('STATUS_OS_LEGADO');

// Sentinela: o fake so devolve a aba se a funcao pedir EXATAMENTE o valor que
// recebeu em ABA_ASSISTENCIAS. Se alguem trocar por um nome literal, o
// getSheetByName devolve null e a migracao vira no-op — os testes ficam vermelhos.
const NOME_MASTER = '<<master>>';

// Uma linha do master. So os indices que a migracao usa importam: 1 = numero,
// 21 = status. O resto vai preenchido pra provar que nada mais e tocado.
function linhaOS(numero, status) {
  const l = [];
  for (let i = 0; i < 25; i++) l.push('col' + i + ':' + numero);
  l[0] = new Date(2026, 6, 1);
  l[1] = numero;
  l[21] = status;
  return l;
}

// linha 1 = cabecalho; linhas 2..11 = dados.
// ALVOS: 2, 3 (contiguas), 9 e 11 (soltas)  -> 3 blocos de escrita
// NAO-ALVOS: 4 ('Aberta'), 5..8 (as quatro variantes de caixa/espaco), 10 (vazio)
function fixture() {
  const cabecalho = [];
  for (let i = 0; i < 25; i++) cabecalho.push('H' + i);
  return [
    cabecalho,
    linhaOS('OS-2026-0001', 'Em andamento'),   // linha 2  ALVO
    linhaOS('OS-2026-0002', 'Em andamento'),   // linha 3  ALVO (contigua)
    linhaOS('OS-2026-0003', 'Aberta'),         // linha 4
    linhaOS('OS-2026-0004', 'Em andamento '),  // linha 5  espaco no FIM
    linhaOS('OS-2026-0005', 'em andamento'),   // linha 6  caixa baixa
    linhaOS('OS-2026-0006', ' Em andamento'),  // linha 7  espaco no INICIO
    linhaOS('OS-2026-0007', 'EM ANDAMENTO'),   // linha 8  caixa alta
    linhaOS('OS-2026-0008', 'Em andamento'),   // linha 9  ALVO (bloco solto)
    linhaOS('OS-2026-0009', ''),               // linha 10 vazio
    linhaOS('OS-2026-0010', 'Em andamento')    // linha 11 ALVO (bloco solto)
  ];
}

const ALVOS = [2, 3, 9, 11];
const NAO_ALVOS = [1, 4, 5, 6, 7, 8, 10];

function bancada(linhas) {
  const escritas = [];
  const historico = [];
  const travas = [];

  const aba = {
    getLastRow: function() { return linhas.length; },
    getDataRange: function() {
      // copia: a funcao nao pode depender de mutar o que leu
      return { getValues: function() { return linhas.map(function(l) { return l.slice(); }); } };
    },
    getRange: function(r, c, nr, nc) {
      function registrar(valores) {
        escritas.push({ linha: r, coluna: c, nLinhas: nr, nColunas: nc, valores: valores });
        for (let i = 0; i < valores.length; i++) {
          for (let j = 0; j < valores[i].length; j++) linhas[r - 1 + i][c - 1 + j] = valores[i][j];
        }
      }
      return {
        setValues: function(v) { registrar(v); },
        setValue: function(v) { registrar([[v]]); }
      };
    }
  };

  const migrar = new Function(
    'SpreadsheetApp', 'LockService', 'ABA_ASSISTENCIAS', 'registrarHistoricoOS_',
    decEtapas.codigo + '\n' + decLegado.codigo + '\n' +
    corpoFuncao(GAS, 'migrarStatusOsEmAndamentoV1') + '\nreturn migrarStatusOsEmAndamentoV1;'
  )(
    { getActiveSpreadsheet: function() {
        return { getSheetByName: function(n) { return n === NOME_MASTER ? aba : null; } };
      } },
    { getScriptLock: function() {
        return {
          waitLock: function(ms) { travas.push('wait:' + ms); },
          releaseLock: function() { travas.push('release'); }
        };
      } },
    NOME_MASTER,
    function(numeroOS, de, para, origem, quem) {
      historico.push({ numeroOS: numeroOS, de: de, para: para, origem: origem, quem: quem });
    }
  );

  return {
    migrar: migrar,
    linhas: linhas,
    escritas: escritas,
    historico: historico,
    travas: travas,
    statusDe: function(l) { return linhas[l - 1][21]; },
    // todas as linhas 1-based que receberam escrita, expandindo os blocos
    linhasEscritas: function() {
      const out = [];
      escritas.forEach(function(e) {
        for (let i = 0; i < e.nLinhas; i++) out.push(e.linha + i);
      });
      return out.sort(function(a, b) { return a - b; });
    }
  };
}

test('MIGRACAO: a bancada monta a funcao REAL do backend (nao uma reimplementacao)', () => {
  const corpo = corpoFuncao(GAS, 'migrarStatusOsEmAndamentoV1');
  assert.ok(/getSheetByName\(ABA_ASSISTENCIAS\)/.test(corpo), 'tem que ler o master pela constante');
  assert.ok(/var destino = ETAPAS_OS\[0\]/.test(corpo), 'o destino vem do enum, nao de um literal');
  assert.strictEqual(decLegado.valor, 'Em andamento');
  assert.strictEqual(decEtapas.valores[0], 'Aberta');
  assert.strictEqual(typeof bancada(fixture()).migrar, 'function');
});

// ----- (a) o dry-run e o padrao -------------------------------------------

test('MIGRACAO (a): sem confirmar e DRY-RUN — conta tudo e NAO escreve um byte', () => {
  const b = bancada(fixture());
  const r = b.migrar({});

  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.dryRun, true);
  assert.strictEqual(r.examinadas, 10);
  assert.strictEqual(r.alteradas, 4);
  assert.deepStrictEqual(r.exemplos, ['OS-2026-0001', 'OS-2026-0002', 'OS-2026-0008', 'OS-2026-0010']);
  assert.strictEqual(r.destino, 'Aberta');
  assert.match(r.mensagem, /^DRY-RUN: nada foi gravado\. 4 OS iriam de Em andamento para Aberta\./);

  // O QUE ESTA MUTACAO QUEBRA: zero escritas, zero historico, planilha intacta.
  assert.deepStrictEqual(b.escritas, []);
  assert.deepStrictEqual(b.historico, []);
  ALVOS.forEach((l) => assert.strictEqual(b.statusDe(l), 'Em andamento', 'linha ' + l + ' foi gravada no dry-run'));
});

test('MIGRACAO (a): so a string exata "SIM" libera a gravacao', () => {
  [undefined, null, {}, { confirmar: '' }, { confirmar: 'sim' }, { confirmar: 'Sim' },
   { confirmar: 'SIM ' }, { confirmar: ' SIM' }, { confirmar: true }, { confirmar: 1 },
   { confirmar: ['SIM'] }, { quem: 'beto' }].forEach((body) => {
    const b = bancada(fixture());
    const r = b.migrar(body);
    assert.strictEqual(r.dryRun, true, JSON.stringify(body) + ' nao podia sair do dry-run');
    assert.deepStrictEqual(b.escritas, [], JSON.stringify(body) + ' gravou');
  });
});

test('MIGRACAO: com {"confirmar":"SIM"} grava — controle positivo do dry-run', () => {
  // Sem este teste, "nao escreveu nada" passaria ate numa funcao que nunca escreve.
  const b = bancada(fixture());
  const r = b.migrar({ confirmar: 'SIM', quem: 'beto' });

  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.dryRun, false);
  assert.strictEqual(r.examinadas, 10);
  assert.strictEqual(r.alteradas, 4);
  assert.strictEqual(r.mensagem, '4 OS movidas de Em andamento para Aberta.');
  assert.deepStrictEqual(b.linhasEscritas(), ALVOS);
  ALVOS.forEach((l) => assert.strictEqual(b.statusDe(l), 'Aberta'));
});

// ----- (b) comparacao de status EXATA --------------------------------------

test('MIGRACAO (b): a comparacao de status e EXATA — trim e caixa NAO entram', () => {
  const b = bancada(fixture());
  const r = b.migrar({ confirmar: 'SIM' });

  // 4 alvos, nao 8: as quatro variantes das linhas 5..8 ficam de fora.
  assert.strictEqual(r.alteradas, 4);
  // e continuam na planilha byte a byte como estavam
  assert.strictEqual(b.statusDe(5), 'Em andamento ');
  assert.strictEqual(b.statusDe(6), 'em andamento');
  assert.strictEqual(b.statusDe(7), ' Em andamento');
  assert.strictEqual(b.statusDe(8), 'EM ANDAMENTO');
  [5, 6, 7, 8].forEach((l) => assert.strictEqual(b.linhasEscritas().indexOf(l), -1,
    'linha ' + l + ' so casa se a comparacao deixar de ser exata'));
});

test('MIGRACAO (b): celula que nao e string (numero, Date, vazio) nunca casa', () => {
  const cabecalho = [];
  for (let i = 0; i < 25; i++) cabecalho.push('H' + i);
  const linhas = [
    cabecalho,
    linhaOS('OS-2026-0100', 0),
    linhaOS('OS-2026-0101', new Date(2026, 6, 1)),
    linhaOS('OS-2026-0102', null),
    linhaOS('OS-2026-0103', undefined),
    linhaOS('OS-2026-0104', 'Em andamento')  // linha 6, o unico alvo
  ];
  const b = bancada(linhas);
  const r = b.migrar({ confirmar: 'SIM' });
  assert.strictEqual(r.alteradas, 1);
  assert.deepStrictEqual(b.linhasEscritas(), [6]);
});

// ----- (c) a escrita toca SO a coluna 22 -----------------------------------

test('MIGRACAO (c): toda escrita e na coluna 22, uma coluna de largura, e so com o destino', () => {
  const b = bancada(fixture());
  b.migrar({ confirmar: 'SIM' });

  assert.ok(b.escritas.length > 0, 'nao escreveu nada — o controle positivo falhou');
  b.escritas.forEach((e) => {
    assert.strictEqual(e.coluna, 22, 'escreveu na coluna ' + e.coluna + ', nao na 22');
    assert.strictEqual(e.nColunas, 1, 'escreveu ' + e.nColunas + ' colunas de uma vez');
    e.valores.forEach((linha) => {
      assert.strictEqual(linha.length, 1, 'o bloco tem que ter uma celula por linha');
      assert.strictEqual(linha[0], 'Aberta');
    });
  });
});

test('MIGRACAO (c): nenhuma celula fora da coluna 22 muda, em linha nenhuma', () => {
  const b = bancada(fixture());
  b.migrar({ confirmar: 'SIM' });

  const original = fixture();
  b.linhas.forEach((linha, i) => {
    linha.forEach((valor, j) => {
      if (j === 21) return; // a coluna 22 (0-based 21) e a unica que pode mudar
      assert.deepStrictEqual(valor, original[i][j],
        'celula fora da coluna 22 foi tocada: linha ' + (i + 1) + ', coluna ' + (j + 1));
    });
  });
});

// ----- (d) o filtro nao pode sumir -----------------------------------------

test('MIGRACAO (d): SO as linhas que casaram sao reescritas — nenhuma outra, nem o cabecalho', () => {
  const b = bancada(fixture());
  b.migrar({ confirmar: 'SIM' });

  assert.deepStrictEqual(b.linhasEscritas(), ALVOS);
  NAO_ALVOS.forEach((l) => assert.strictEqual(b.linhasEscritas().indexOf(l), -1,
    'linha ' + l + ' nao casou e nao podia ser reescrita'));
  // os status das nao-alvo continuam os originais (nem reescritos com o proprio valor)
  assert.strictEqual(b.statusDe(4), 'Aberta');
  assert.strictEqual(b.statusDe(10), '');
  assert.strictEqual(b.statusDe(1), 'H21'); // cabecalho intacto
});

test('MIGRACAO (d): linhas contiguas viram UM setValues — 3 chamadas para 4 linhas', () => {
  // O agrupamento existe pra caber no teto de 6 min do web app com ~287 linhas.
  // Se o filtro sumisse, o bloco viraria um so, de 11 linhas, a partir da 1.
  const b = bancada(fixture());
  b.migrar({ confirmar: 'SIM' });
  assert.strictEqual(b.escritas.length, 3);
  assert.deepStrictEqual(b.escritas.map((e) => [e.linha, e.nLinhas]), [[2, 2], [9, 1], [11, 1]]);
});

// ----- bordas e trilha ------------------------------------------------------

test('MIGRACAO: UMA linha de resumo no HistoricoOS, nunca uma por OS', () => {
  const b = bancada(fixture());
  b.migrar({ confirmar: 'SIM', quem: 'beto' });
  assert.strictEqual(b.historico.length, 1);
  assert.deepStrictEqual(b.historico[0], {
    numeroOS: '(lote: 4 OS)', de: 'Em andamento', para: 'Aberta',
    origem: 'migracao_status_os_v1', quem: 'beto'
  });
});

test('MIGRACAO: sem `quem` a trilha grava "migracao", nunca vazio', () => {
  const b = bancada(fixture());
  b.migrar({ confirmar: 'SIM' });
  assert.strictEqual(b.historico[0].quem, 'migracao');
});

test('MIGRACAO: nada casou -> nao escreve nem registra historico, mesmo com SIM', () => {
  const cabecalho = [];
  for (let i = 0; i < 25; i++) cabecalho.push('H' + i);
  const b = bancada([cabecalho, linhaOS('OS-2026-0003', 'Aberta')]);
  const r = b.migrar({ confirmar: 'SIM' });
  assert.strictEqual(r.alteradas, 0);
  assert.strictEqual(r.examinadas, 1);
  assert.match(r.mensagem, /^Nada a fazer/);
  assert.deepStrictEqual(b.escritas, []);
  assert.deepStrictEqual(b.historico, []);
});

test('MIGRACAO: aba so com cabecalho (ou sem aba) devolve zero sem escrever', () => {
  const cabecalho = [];
  for (let i = 0; i < 25; i++) cabecalho.push('H' + i);
  const b = bancada([cabecalho]);
  const r = b.migrar({ confirmar: 'SIM' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.examinadas, 0);
  assert.strictEqual(r.alteradas, 0);
  assert.deepStrictEqual(r.exemplos, []);
  assert.deepStrictEqual(b.escritas, []);
});

test('MIGRACAO: no maximo 5 exemplos, e so de OS com numero', () => {
  const cabecalho = [];
  for (let i = 0; i < 25; i++) cabecalho.push('H' + i);
  const linhas = [cabecalho, linhaOS('', 'Em andamento')];
  for (let i = 1; i <= 8; i++) linhas.push(linhaOS('OS-2026-' + (1000 + i), 'Em andamento'));
  const b = bancada(linhas);
  const r = b.migrar({});
  assert.strictEqual(r.alteradas, 9);      // a sem numero conta como alterada
  assert.strictEqual(r.exemplos.length, 5); // mas nao vira exemplo
  assert.strictEqual(r.exemplos.indexOf(''), -1);
});

test('MIGRACAO: o lock e pego e SEMPRE liberado (dry-run e gravacao)', () => {
  const seco = bancada(fixture());
  seco.migrar({});
  assert.deepStrictEqual(seco.travas, ['wait:30000', 'release']);

  const molhado = bancada(fixture());
  molhado.migrar({ confirmar: 'SIM' });
  assert.deepStrictEqual(molhado.travas, ['wait:30000', 'release']);
});

// ===========================================================================
// GUARDA 1: listarOS TEM QUE DEVOLVER `etapas` APONTANDO PARA ETAPAS_OS
// ===========================================================================
// A revisao por mutacao provou o buraco: apagar `etapas: ETAPAS_OS` do return de
// listarOS mantinha a suite inteira verde. Esse campo e o eixo da rodada — e ele
// que faz o enum ter UMA fonte da verdade. Sem ele o front cai no ETAPAS_PADRAO
// (os-lista.js:31), que termina em 'Pronto p/ retirar' de proposito: a atendente
// nunca veria 'Finalizado' e a troca de rotulo estaria revertida em silencio,
// sem um unico teste vermelho.
//
// A assercao central e de IDENTIDADE (===), nao de conteudo. Um array literal
// duplicado dentro de listarOS passaria num deepStrictEqual e seria exatamente a
// segunda fonte da verdade que esta rodada existe pra matar — hoje igual,
// divergente no primeiro deploy em que so um dos lados sobe. `===` so passa se o
// campo REFERENCIA a declaracao de ETAPAS_OS.
//
// Mesma tecnica ja usada acima para statusOsAceito_/migrarStatusOsEmAndamentoV1:
// listarOS nao roda fora do Apps Script, entao o corpo e extraido da FONTE e
// avaliado com new Function, com os globais injetados como parametros. O que
// roda aqui e o codigo do backend de verdade, nao uma reimplementacao paralela.

const buscaTexto = require('../lib/busca-texto.js');

function linhaListagem(numero, status) {
  const l = [];
  for (let i = 0; i < 25; i++) l.push('col' + i + ':' + numero);
  l[0] = new Date(2026, 6, 1);
  l[1] = numero;
  l[2] = 'Cliente ' + numero;
  l[21] = status;
  return l;
}

// NOME_MASTER (declarado na bancada da migracao) e a mesma sentinela: o fake so
// devolve a aba se listarOS pedir EXATAMENTE o valor recebido em ABA_ASSISTENCIAS.
function bancadaListar(linhas) {
  const aba = {
    getLastRow: function() { return linhas.length; },
    getDataRange: function() {
      return { getValues: function() { return linhas.map(function(l) { return l.slice(); }); } };
    }
  };

  // ETAPAS_OS e declarado DENTRO do escopo montado e devolvido junto: e contra
  // esse objeto que a identidade e comparada. Comparar com um array escrito no
  // teste seria comparar com uma copia — o erro que este teste existe pra pegar.
  return new Function(
    'SpreadsheetApp', 'ABA_ASSISTENCIAS', 'getColAtendimentoId',
    'termosDaBusca', 'montarTextoBusca', 'textoCasaTermos', 'contarSemVinculo',
    'etapaDoStatus_', 'Utilities', 'Session',
    decEtapas.codigo + '\n' +
    corpoFuncao(GAS, 'listarOS') + '\nreturn { listarOS: listarOS, ETAPAS_OS: ETAPAS_OS };'
  )(
    { getActiveSpreadsheet: function() {
        return { getSheetByName: function(n) { return n === NOME_MASTER ? aba : null; } };
      } },
    NOME_MASTER,
    function() { return 0; },
    buscaTexto.termosDaBusca, buscaTexto.montarTextoBusca, buscaTexto.textoCasaTermos,
    // contarSemVinculo entrou em listarOS na Task 4 (instrumentacao da adesao ao
    // vinculo OS<->atendimento). Injetado da lib, como as funcoes de busca: o
    // teste irmao em tests/vinculo-atendimento.test.js prova que a copia dentro
    // do google-apps-script.js e identica a esta.
    require('../lib/vinculo-atendimento.js').contarSemVinculo,
    new Function(corpoFuncao(GAS, 'etapaDoStatus_') + '\nreturn etapaDoStatus_;')(),
    { formatDate: function() { return '01/07/2026'; } },
    { getScriptTimeZone: function() { return 'America/Sao_Paulo'; } }
  );
}

const LINHAS_LISTAGEM = [
  ['H'],
  linhaListagem('OS-2026-0001', 'Aberta'),
  linhaListagem('OS-2026-0002', 'Em andamento'),
  linhaListagem('OS-2026-0003', 'Finalizado')
];

const listagemNova = () => bancadaListar(LINHAS_LISTAGEM.map(function(l) { return l.slice(); }));

test('GUARDA 1: listarOS devolve o campo `etapas` — a tela nao pode depender do fallback', () => {
  const b = listagemNova();
  const r = b.listarOS({});

  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.oses.length, 3, 'a bancada precisa listar algo, senao o resto nao prova nada');
  assert.ok(Object.prototype.hasOwnProperty.call(r, 'etapas'),
    'listar_os TEM que mandar `etapas`; sem o campo o front cai no ETAPAS_PADRAO ' +
    '(que termina em "Pronto p/ retirar") e a atendente nunca ve "Finalizado"');
});

test('GUARDA 1: `etapas` E o ETAPAS_OS — mesma referencia, nao uma copia', () => {
  const b = listagemNova();
  const r = b.listarOS({});

  // O ponto do teste: um `etapas: ['Aberta', ..., 'Finalizado']` escrito na mao
  // dentro de listarOS passaria no deepStrictEqual abaixo e seria uma SEGUNDA
  // fonte da verdade — exatamente o que esta rodada veio eliminar.
  assert.strictEqual(r.etapas, b.ETAPAS_OS,
    '`etapas` tem que REFERENCIAR ETAPAS_OS; um array literal duplicado aqui vira ' +
    'a segunda fonte da verdade que esta rodada eliminou');
  assert.deepStrictEqual(r.etapas, decEtapas.valores);
  assert.deepStrictEqual(r.etapas, ETAPAS_NOVAS);
});

test('GUARDA 1: `etapas` viaja em toda listagem util — com filtro, com busca e sem resultado', () => {
  // Se o campo so aparecesse no caminho feliz, a tela perderia o enum justo
  // quando a atendente filtra — e e filtrando que ela muda status.
  const cenarios = [
    ['sem filtro', {}],
    ['filtro de status', { status: 'Aberta' }],
    ['filtro no status legado', { status: 'Em andamento' }],
    ['busca por cliente', { busca: 'Cliente' }],
    ['filtro que nao acha nada', { status: 'Nao existe' }],
    ['busca que nao acha nada', { busca: 'zzzzz' }],
    ['limite de 1', { limite: 1 }]
  ];
  cenarios.forEach(function(par) {
    const b = listagemNova();
    const r = b.listarOS(par[1]);
    assert.strictEqual(r.etapas, b.ETAPAS_OS, 'cenario "' + par[0] + '" perdeu o campo etapas');
  });
});

test('GUARDA 1: a fonte referencia o identificador, nao um literal remontado', () => {
  // Trava de leitura, complementar a de execucao: pega tambem a variante em que
  // alguem "conserta" o campo copiando os rotulos na mao dentro da funcao.
  const corpo = corpoFuncao(GAS, 'listarOS');
  assert.ok(/etapas:\s*ETAPAS_OS\b/.test(corpo),
    'listarOS tem que devolver etapas: ETAPAS_OS');
  assert.strictEqual(/etapas:\s*\[/.test(corpo), false,
    'etapas nao pode ser array literal dentro de listarOS — seria outro enum');
  assert.strictEqual(/etapas:\s*ETAPAS_OS\s*\.\s*(slice|concat|map|filter)/.test(corpo), false,
    'copiar o enum aqui reabre a divergencia que o campo veio fechar');
});

// ===========================================================================
// GUARDA 2: registrarOS TEM QUE NASCER COM UM STATUS DO ENUM
// ===========================================================================
// A revisao por mutacao provou o segundo buraco: trocar 'Aberta' de volta por
// 'Em andamento' na linha da coluna 22 mantinha a suite 130/0 verde. Esse
// literal errado custou o dia inteiro pra ser diagnosticado — era vocabulario de
// ATENDIMENTO gravado em OS — e sozinho explicava as 287 OS fora do enum, o
// rotulo "(fora do padrao)" em todo cartao e o filtro que nao casava.
//
// A assercao e "PERTENCE a ETAPAS_OS", nao "e igual a 'Aberta'": assim o teste
// protege a REGRA (toda OS nasce num status que o backend aceita e que a tela
// sabe oferecer) e nao um rotulo, que pode legitimamente mudar amanha — como
// 'Pronto p/ retirar' -> 'Finalizado' mudou nesta mesma rodada.
//
// E NAO vale statusOsAceito_ como criterio aqui: ele tolera o alias legado
// ('Pronto p/ retirar') na ENTRADA de atualizarStatusOS, e gravar um alias numa
// OS nova poria de volta na planilha um valor que o seletor nao oferece. Para
// NASCER, o criterio e o enum puro.

function bancadaRegistrar() {
  const appendadas = [];
  const aba = {
    appendRow: function(l) { appendadas.push(l.slice()); },
    getLastRow: function() { return appendadas.length + 1; },
    getRange: function() { return { setValue: function() {} }; }
  };

  const registrar = new Function(
    'LockService', 'garantirAbaAssistencias', 'garantirAbaCadastroAssistencias',
    'obterProximoNumeroOSSemLock_', 'getColAtendimentoId',
    'garantirColTipoAssistencia_', 'espelharOS_', 'upsertAssistenciaCadastro',
    corpoFuncao(GAS, 'registrarOS') + '\nreturn registrarOS;'
  )(
    { getScriptLock: function() { return { waitLock: function() {}, releaseLock: function() {} }; } },
    function() { return aba; },
    function() { return {}; },
    function() { return 'OS-2026-0999'; },
    function() { return 0; },
    function() { return 23; },
    function() {},
    function() {}
  );

  return { registrar: registrar, appendadas: appendadas };
}

// A coluna 22 (indice 21) e onde o status vive: e o r[21] que listarOS le
// (`status: String(r[21] || 'Aberta')`), o que statusPublicoOS le pro QR e o que
// migrarStatusOsEmAndamentoV1 reescreve. Gravar o status em outro indice seria o
// mesmo defeito com outra roupa, entao a leitura e por indice fixo, de proposito.
const COL_STATUS_0BASED = 21;

test('GUARDA 2: registrarOS grava mesmo — controle positivo da bancada', () => {
  // Sem este teste, "o status esta no enum" passaria ate numa funcao que nunca grava.
  const b = bancadaRegistrar();
  const r = b.registrar({ nomeCliente: 'Fulano', modelo: 'Kay', tipoAssistencia: 'Sumare' });
  assert.strictEqual(r.sucesso, true, 'a bancada nao montou registrarOS: ' + r.erro);
  assert.strictEqual(b.appendadas.length, 1);
  assert.strictEqual(b.appendadas[0][1], 'OS-2026-0999');
  assert.ok(b.appendadas[0].length > COL_STATUS_0BASED, 'a linha nem chega na coluna de status');
});

test('GUARDA 2: o status inicial de toda OS nova PERTENCE a ETAPAS_OS', () => {
  const b = bancadaRegistrar();
  b.registrar({ nomeCliente: 'Fulano', modelo: 'Kay', tipoAssistencia: 'Sumare' });
  const status = b.appendadas[0][COL_STATUS_0BASED];

  assert.notStrictEqual(decEtapas.valores.indexOf(status), -1,
    'OS nova nasceu com status "' + status + '", que NAO esta em ETAPAS_OS (' +
    decEtapas.valores.join(' / ') + '). Foi assim que 287 OS nasceram fora do enum: ' +
    'o seletor da tela nunca marcava o status real e o filtro nao casava');
  // trava explicita contra a regressao concreta que a mutacao reintroduziu
  assert.notStrictEqual(status, 'Em andamento',
    '"Em andamento" e vocabulario de ATENDIMENTO, nunca de OS');
});

test('GUARDA 2: nasce na PRIMEIRA etapa — nao numa etapa qualquer do enum', () => {
  // 'pertence ao enum' sozinho aceitaria nascer em 'Finalizado'. A regra completa
  // e: OS nova esta no comeco do fluxo. Duas leituras disso, as duas
  // independentes do rotulo:
  const b = bancadaRegistrar();
  b.registrar({ nomeCliente: 'Fulano', modelo: 'Kay' });
  const status = b.appendadas[0][COL_STATUS_0BASED];

  assert.strictEqual(status, decEtapas.valores[0],
    'o status inicial tem que ser a 1a etapa do enum, seja qual for o rotulo dela');
  // e a timeline publica do QR tem que mostrar a OS na etapa 0
  const etapaDoStatus = new Function(corpoFuncao(GAS, 'etapaDoStatus_') + '\nreturn etapaDoStatus_;')();
  assert.strictEqual(etapaDoStatus(status), 0, 'o cliente veria a OS ja adiantada no QR');
});

test('GUARDA 2: o status inicial e aceito por atualizarStatusOS (a OS ja nasce coerente)', () => {
  // Fecha o circuito: o valor gravado no nascimento e um valor que o proprio
  // backend aceitaria receber de volta, e que a tela sabe oferecer no seletor.
  const b = bancadaRegistrar();
  b.registrar({ nomeCliente: 'Fulano' });
  assert.strictEqual(statusOsAceito(b.appendadas[0][COL_STATUS_0BASED]), true);
});

test('GUARDA 2: nenhum caminho de entrada desvia o status inicial', () => {
  [{}, { tipoAssistencia: 'Sumare' }, { tipoAssistencia: 'Terceirizada' },
   { tipoAssistencia: 'lixo' }, { nomeCliente: 'Fulano', atendimentoId: 'PV-1' },
   { assistencia: 'Jackson', assistenciaTelefone: '199999' }].forEach(function(dados) {
    const bb = bancadaRegistrar();
    bb.registrar(dados);
    assert.strictEqual(bb.appendadas.length, 1, JSON.stringify(dados) + ' nao gravou');
    const st = bb.appendadas[0][COL_STATUS_0BASED];
    assert.notStrictEqual(decEtapas.valores.indexOf(st), -1,
      JSON.stringify(dados) + ' nasceu com status fora do enum: "' + st + '"');
  });
});
