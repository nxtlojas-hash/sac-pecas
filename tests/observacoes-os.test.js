const test = require('node:test');
const assert = require('node:assert');
const {
  LIMITE_OBSERVACAO,
  validarTextoObservacao,
  montarCarimboObservacao,
  acrescentarObservacao
} = require('../lib/observacoes-os.js');

// ===== validarTextoObservacao =====
// A regra central e binaria: ou o texto e aprovado (ok:true) ou e recusado
// com uma mensagem clara. Nunca trucar em silencio, nunca depender de quem
// chamou pra sanitizar antes.

test('recusa texto vazio com mensagem clara', () => {
  const r = validarTextoObservacao('');
  assert.strictEqual(r.ok, false);
  assert.ok(r.erro && r.erro.length > 0, 'erro tem que ter mensagem');
});

test('recusa string so de espacos — mesma regra do vazio', () => {
  ['   ', '\t', '  \n  '].forEach((s) => {
    const r = validarTextoObservacao(s);
    assert.strictEqual(r.ok, false, JSON.stringify(s) + ' passou como valido');
  });
});

test('recusa null e undefined — tipos invalidos dao ok:false, nao explodem', () => {
  [null, undefined, 42, {}, []].forEach((v) => {
    const r = validarTextoObservacao(v);
    assert.strictEqual(r.ok, false, JSON.stringify(v) + ' nao e string e nao pode passar');
  });
});

test('recusa texto maior que LIMITE_OBSERVACAO caracteres', () => {
  const longo = 'a'.repeat(LIMITE_OBSERVACAO + 1);
  const r = validarTextoObservacao(longo);
  assert.strictEqual(r.ok, false);
  // a mensagem tem que incluir o limite e o tamanho recebido — quem chamou precisa saber o que aconteceu
  assert.ok(r.erro.indexOf(String(LIMITE_OBSERVACAO)) !== -1, 'mensagem tem que citar o limite');
  assert.ok(r.erro.indexOf(String(longo.length)) !== -1, 'mensagem tem que citar o tamanho recebido');
});

test('recusa exatamente LIMITE_OBSERVACAO + 1 caracteres (limite e exclusivo no lado "nao aceito")', () => {
  const r = validarTextoObservacao('x'.repeat(LIMITE_OBSERVACAO + 1));
  assert.strictEqual(r.ok, false);
});

test('aceita texto com exatamente LIMITE_OBSERVACAO caracteres', () => {
  const r = validarTextoObservacao('x'.repeat(LIMITE_OBSERVACAO));
  assert.strictEqual(r.ok, true);
});

test('aceita texto normal de um caractere', () => {
  const r = validarTextoObservacao('a');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.erro, undefined);
});

test('aceita texto com espacos internos (so o trim importa pro "vazio")', () => {
  const r = validarTextoObservacao('  texto valido  ');
  assert.strictEqual(r.ok, true);
});

// PROVA POR MUTACAO (a): retornar sempre ok:true levaria estes cenarios a passar
// no frontend e o backend rejeitaria — mas mesmo que alguem quebre a validacao
// no backend o dano seria menor se o frontend jah nao mandasse a requisicao.
// O teste de "texto com exatamente LIMITE + 1 recebe ok:false" e o gatilho:
// se validarTextoObservacao virasse `return {ok: true};`, aquele teste ficaria
// VERMELHO. Do mesmo modo, o teste de string vazia ficaria vermelho se a guarda
// de trim sumisse.

// ===== montarCarimboObservacao =====

test('formato exato: [dd/mm/aaaa hh:mm]', () => {
  // Data fixada: 30/07/2026 09:05 — dois digitos para dia, mes, hora e minuto
  const d = new Date(2026, 6, 30, 9, 5, 0); // mes 0-based
  const c = montarCarimboObservacao(d);
  assert.strictEqual(c, '[30/07/2026 09:05]');
});

test('pad funciona nos dois extremos do calendario (01/01/aaaa 00:00 e 31/12/aaaa 23:59)', () => {
  const inicio = new Date(2026, 0, 1, 0, 0);
  assert.strictEqual(montarCarimboObservacao(inicio), '[01/01/2026 00:00]');

  const fim = new Date(2026, 11, 31, 23, 59);
  assert.strictEqual(montarCarimboObservacao(fim), '[31/12/2026 23:59]');
});

test('sem argumento nao explode (usa new Date() internamente)', () => {
  // nao da pra fixar o horario, mas a forma tem que bater com o regex
  const c = montarCarimboObservacao();
  assert.match(c, /^\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\]$/);
});

test('argumento que nao e Date tambem cai no new Date() interno', () => {
  const c = montarCarimboObservacao(null);
  assert.match(c, /^\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\]$/);
});

// ===== acrescentarObservacao =====
// A regra INVIOLAVEL: nunca sobrescrever o que existe. Cada adicao acrescenta
// uma nova linha no final. Perder uma observacao antiga e pior do que nao ter
// o campo.

const DATA_FIXA = new Date(2026, 6, 30, 9, 5, 0); // 30/07/2026 09:05
const CARIMBO  = '[30/07/2026 09:05]';

test('campo vazio: nova obs vira a primeira entrada (so o carimbo + texto, sem linha em branco antes)', () => {
  const r = acrescentarObservacao('', 'primeira obs', DATA_FIXA);
  assert.strictEqual(r, CARIMBO + ' primeira obs');
  // sem newline no inicio — um '\n' sobrando criaria linha em branco no topo do campo
  assert.strictEqual(r[0], '[');
});

test('campo null: trata como vazio, nao explode nem coloca a string "null" antes do texto', () => {
  // String(null) == "null" — se a guarda `atual == null` sumir, a obs começa com "null\n"
  const r = acrescentarObservacao(null, 'primeira obs', DATA_FIXA);
  assert.strictEqual(r, CARIMBO + ' primeira obs');
  // o resultado nao pode comecar com a palavra "null" seguida de newline
  assert.strictEqual(r.startsWith('null'), false);
});

test('campo undefined: mesma regra do null', () => {
  const r = acrescentarObservacao(undefined, 'obs em undefined', DATA_FIXA);
  assert.strictEqual(r, CARIMBO + ' obs em undefined');
});

test('campo com conteudo: nova obs e APENDADA, separada por newline — o conteudo anterior NUNCA some', () => {
  const anterior = '[29/07/2026 10:00] obs anterior';
  const r = acrescentarObservacao(anterior, 'obs nova', DATA_FIXA);
  // o conteudo anterior tem que estar INTACTO no inicio
  assert.ok(r.startsWith(anterior), 'conteudo anterior desapareceu');
  // a nova obs tem que estar no final
  assert.ok(r.endsWith(CARIMBO + ' obs nova'), 'nova obs nao foi apendada no final');
  // separados por exatamente um newline
  assert.strictEqual(r, anterior + '\n' + CARIMBO + ' obs nova');
});

test('multiplas adicoes preservam todas as entradas anteriores (nao so a ultima)', () => {
  const d1 = new Date(2026, 6, 28, 8, 0);
  const d2 = new Date(2026, 6, 29, 14, 30);
  const d3 = new Date(2026, 6, 30, 9, 5);

  const apos1 = acrescentarObservacao('',      'entrada 1', d1);
  const apos2 = acrescentarObservacao(apos1,   'entrada 2', d2);
  const apos3 = acrescentarObservacao(apos2,   'entrada 3', d3);

  assert.ok(apos3.indexOf('entrada 1') !== -1, 'entrada 1 sumiu');
  assert.ok(apos3.indexOf('entrada 2') !== -1, 'entrada 2 sumiu');
  assert.ok(apos3.indexOf('entrada 3') !== -1, 'entrada 3 sumiu');
  // a ordem e cronologica: mais antiga no topo
  assert.ok(apos3.indexOf('entrada 1') < apos3.indexOf('entrada 2'));
  assert.ok(apos3.indexOf('entrada 2') < apos3.indexOf('entrada 3'));
});

test('acrescentarObservacao nao muta o valor anterior (imutabilidade de strings JS ja garante, mas documenta)', () => {
  const anterior = '[29/07/2026 10:00] obs anterior';
  const copia = anterior.slice();
  acrescentarObservacao(anterior, 'nova', DATA_FIXA);
  assert.strictEqual(anterior, copia);
});

// PROVA POR MUTACAO (b): a mutacao mais perigosa e `return prefixo;` em vez de
// `return atualStr ? atualStr + '\n' + prefixo : prefixo;`. Isso sobrescreveria
// silenciosamente qualquer obs anterior — exatamente o que a regra proibe.
// O teste "campo com conteudo: nova obs e APENDADA" pega essa mutacao:
// `return prefixo` retornaria so `[30/07/2026 09:05] obs nova`, sem o anterior.
// assert.ok(r.startsWith(anterior)) ficaria VERMELHO.

// ===== COPIA IDENTICA em google-apps-script.js =====
// As tres funcoes existem em dois lugares: lib/observacoes-os.js (testado aqui
// via require) e google-apps-script.js (sem require disponivel no GAS). Se um
// lado for editado e o outro nao, o comportamento diverge em producao sem aviso
// nenhum. Este teste compara os corpos funcao-a-funcao e vai VERMELHO se
// qualquer caractere diferir — mesma tecnica de lib/busca-texto.js.

test('as copias em google-apps-script.js batem com as desta lib', () => {
  const fs = require('fs');
  const path = require('path');
  const gas = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8');
  const lib = fs.readFileSync(path.join(__dirname, '..', 'lib', 'observacoes-os.js'), 'utf8');

  function corpo(fonte, nome) {
    const ini = fonte.indexOf('function ' + nome + '(');
    assert.notStrictEqual(ini, -1, 'nao achei function ' + nome + ' na fonte');
    const fim = fonte.indexOf('\n}', ini);
    assert.notStrictEqual(fim, -1, 'nao achei o fim de ' + nome);
    return fonte.slice(ini, fim + 2).replace(/\r/g, '');
  }

  ['validarTextoObservacao', 'montarCarimboObservacao', 'acrescentarObservacao'].forEach((nome) => {
    assert.strictEqual(corpo(gas, nome), corpo(lib, nome),
      nome + ' divergiu entre google-apps-script.js e lib/observacoes-os.js');
  });
});

test('LIMITE_OBSERVACAO e 500 nos dois lados (a constante e referencada pelo nome, nao pelo valor)', () => {
  const fs = require('fs');
  const path = require('path');
  const gas = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8');

  // a declaracao exata tem que existir em ambos os arquivos
  assert.ok(gas.indexOf('var LIMITE_OBSERVACAO = 500;') !== -1,
    'LIMITE_OBSERVACAO = 500 nao achado no backend');
  assert.strictEqual(LIMITE_OBSERVACAO, 500);
});
