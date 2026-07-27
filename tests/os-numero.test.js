const test = require('node:test');
const assert = require('node:assert');
const { pareceNumeroOS } = require('../lib/os-numero.js');

test('reconhece OS com prefixo completo', () => {
  assert.strictEqual(pareceNumeroOS('OS-2026-0426'), true);
  assert.strictEqual(pareceNumeroOS('os-2026-0426'), true);
  assert.strictEqual(pareceNumeroOS('  OS 2026 0426 '), true);
});

test('reconhece numero solto de 3-4 digitos (como a equipe digita)', () => {
  assert.strictEqual(pareceNumeroOS('426'), true);
  assert.strictEqual(pareceNumeroOS('0479'), true);
});

test('NAO confunde com protocolo de atendimento', () => {
  assert.strictEqual(pareceNumeroOS('PV-2026-0337'), false);
});

test('NAO confunde com nome, CPF nem telefone', () => {
  assert.strictEqual(pareceNumeroOS('Wesley Silva'), false);
  assert.strictEqual(pareceNumeroOS('899.067.052-72'), false);
  assert.strictEqual(pareceNumeroOS('19999140990'), false);
});
