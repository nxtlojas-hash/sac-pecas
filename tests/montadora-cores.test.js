// 27/10/2026 - cores com quantidade na tela da montadora (Jacque: "carenagem lateral preto 10, vermelho 5").
const test = require('node:test');
const assert = require('node:assert');
const { linhasMontadora, lerCores, somaCores, coresTexto, coresDoFormulario } = require('../lib/montadora.js');

const CATALOGO = { 'kay-2026': { nome: 'Kay 2026', estoque: 'Kay 2026', pecas: [{ nome: 'Carenagem lateral kay 2026', preco: 65 }, { nome: 'Assoalho kay 2026', preco: 126 }] } };

test('a linha da tela traz as cores da aba Estoque (coluna F); sem coluna = sem cor', () => {
  const est = [{ modelo: 'Kay 2026', peca: 'Carenagem lateral kay 2026', sumare: 0, jaragua: 15, ultimaAtualizacao: 'x', cores: 'preto=10; vermelho=5' },
    { modelo: 'Kay 2026', peca: 'Assoalho kay 2026', sumare: 0, jaragua: 1, ultimaAtualizacao: 'x' }];
  const l = linhasMontadora('kay-2026', CATALOGO, est);
  assert.deepStrictEqual(l[0].cores, [{ cor: 'preto', qtd: 10 }, { cor: 'vermelho', qtd: 5 }]);
  assert.deepStrictEqual(l[1].cores, []);
  assert.strictEqual(coresTexto(l[0].cores), 'preto 10 · vermelho 5');
  assert.strictEqual(somaCores(l[0].cores), 15);
});

test('lerCores aguenta cor com espaco, zero e lixo', () => {
  assert.deepStrictEqual(lerCores('azul claro=3; branco=0; ; x; verde=-1'), [{ cor: 'azul claro', qtd: 3 }, { cor: 'branco', qtd: 0 }]);
  assert.deepStrictEqual(lerCores(''), []);
});

test('formulario: linha vazia some; cor sem nome, qtd ruim, cor repetida e simbolo viram aviso', () => {
  assert.deepStrictEqual(coresDoFormulario([{ cor: ' Preto ', qtd: '10' }, { cor: '', qtd: '' }, { cor: 'Vermelho', qtd: 5 }]).cores,
    [{ cor: 'preto', qtd: 10 }, { cor: 'vermelho', qtd: 5 }]);
  assert.match(coresDoFormulario([{ cor: '', qtd: '3' }]).erro, /Falta o nome da cor/);
  assert.match(coresDoFormulario([{ cor: 'preto', qtd: '' }]).erro, /Quantidade inválida/);
  assert.match(coresDoFormulario([{ cor: 'preto', qtd: '2.5' }]).erro, /Quantidade inválida/);
  assert.match(coresDoFormulario([{ cor: 'preto', qtd: '1' }, { cor: 'PRETO', qtd: '2' }]).erro, /repetida/);
  assert.match(coresDoFormulario([{ cor: 'preto=1', qtd: '1' }]).erro, /só letras/);
  assert.deepStrictEqual(coresDoFormulario([]).cores, []);
});
