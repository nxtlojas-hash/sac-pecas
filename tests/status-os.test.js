const test = require('node:test');
const assert = require('node:assert');
const { montarOpcoesStatus } = require('../lib/status-os.js');

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
