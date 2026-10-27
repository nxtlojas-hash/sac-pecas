// 27/10/2026 — cores com quantidade na aba Estoque (Jacque: "carenagem lateral preto 10, vermelho 5"). Roda as funcoes de
// verdade do Apps Script (normalizarCores_, atualizarEstoque, listarEstoque) contra uma planilha de mentira.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8');
const trechoAtualizar = src.match(/function normalizarCores_\(v\) \{[\s\S]*?\nfunction atualizarEstoque\(body\) \{[\s\S]*?\n\}/);
const trechoListar = src.match(/function listarEstoque\(\) \{[\s\S]*?\n\}/);

function montar(linhas) {
  const trilha = [];
  const largura = () => Math.max(...linhas.map((l) => l.length));
  const aba = {
    getDataRange: () => ({ getValues: () => linhas.map((l) => { const c = l.slice(); while (c.length < largura()) c.push(''); return c; }) }),
    getRange: (lin, col, nl, nc) => ({
      setValue(v) { while (linhas[lin - 1].length < col) linhas[lin - 1].push(''); linhas[lin - 1][col - 1] = v; return this; },
      setValues(vs) { vs[0].forEach((v, j) => { linhas[lin - 1][col - 1 + j] = v; }); return this; },
      setFontWeight() { return this; }
    }),
    appendRow: (r) => linhas.push(r.slice())
  };
  const ctx = {
    ABA_ESTOQUE: 'Estoque',
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => (n === 'Estoque' ? aba : null) }) },
    getOrCreateAbaEstoque: () => aba,
    registrarAlteracaoValor_: (...a) => { trilha.push(a); return true; }
  };
  vm.runInNewContext(trechoAtualizar[0] + '\n' + trechoListar[0] + '; this.atualizar = atualizarEstoque; this.listar = listarEstoque; this.norm = normalizarCores_;', ctx);
  return { ...ctx, linhas, trilha };
}
const PLANILHA = () => [['Modelo', 'Peca', 'Sumare', 'Jaragua', 'UltimaAtualizacao'], ['Kay 2026', 'Carenagem lateral kay 2026', 0, 1, '2026-10-27T12:26:43.116Z']];

test('as funcoes existem no fonte', () => { assert.ok(trechoAtualizar, 'normalizarCores_ + atualizarEstoque'); assert.ok(trechoListar, 'listarEstoque'); });

test('cores: texto do jeito que se digita vira "cor=qtd; …" (minusculas, repetida vale a ultima, lixo fica de fora)', () => {
  const p = montar(PLANILHA());
  assert.strictEqual(p.norm('Preto 10, vermelho 5'), 'preto=10; vermelho=5');
  assert.strictEqual(p.norm('azul claro = 3; preto: 2 unidades\nbranco 0'), 'azul claro=3; preto=2; branco=0');
  assert.strictEqual(p.norm('preto 10, preto 4, rosa, 7, verde -2, cinza 2.5'), 'preto=4');
  assert.strictEqual(p.norm([{ cor: 'Preto', qtd: 10 }, { cor: 'Azul', qtd: '5' }]), 'preto=10; azul=5');
  assert.strictEqual(p.norm({ preto: 1 }), 'preto=1');
  assert.strictEqual(p.norm(''), '');
});

test('gravar com cores: total de Jaragua = soma, coluna F ganha o cabecalho "Cores" e a trilha registra', () => {
  const p = montar(PLANILHA());
  const r = p.atualizar({ modelo: 'Kay 2026', peca: 'Carenagem lateral kay 2026', sumare: 0, jaragua: 1, cores: 'preto 10, vermelho 5' });
  assert.ok(r.sucesso); assert.strictEqual(r.jaragua, 15); assert.strictEqual(r.cores, 'preto=10; vermelho=5');
  assert.strictEqual(p.linhas[0][5], 'Cores');
  assert.deepStrictEqual(p.linhas[1].slice(0, 4).concat(p.linhas[1][5]), ['Kay 2026', 'Carenagem lateral kay 2026', 0, 15, 'preto=10; vermelho=5']);
  assert.ok(p.trilha.some((t) => t[2] === 'cores' && t[3] === '' && t[4] === 'preto=10; vermelho=5'));
  const l = p.listar().estoque[0];
  assert.deepStrictEqual([l.jaragua, l.cores], [15, 'preto=10; vermelho=5']);
});

test('gravar SEM o campo cores (tela antiga, baixa) nao mexe nas cores; cores vazias limpam e o total fica o digitado', () => {
  const p = montar(PLANILHA());
  p.atualizar({ modelo: 'Kay 2026', peca: 'Carenagem lateral kay 2026', jaragua: 1, cores: 'preto 10' });
  p.atualizar({ modelo: 'Kay 2026', peca: 'Carenagem lateral kay 2026', jaragua: 7 });
  assert.deepStrictEqual([p.linhas[1][3], p.linhas[1][5]], [7, 'preto=10']);
  p.atualizar({ modelo: 'Kay 2026', peca: 'Carenagem lateral kay 2026', jaragua: 3, cores: '' });
  assert.deepStrictEqual([p.linhas[1][3], p.linhas[1][5]], [3, '']);
});

test('peca sem linha no estoque: cria a linha ja com as cores; listar de planilha sem a coluna F devolve cores vazia', () => {
  const p = montar(PLANILHA());
  p.atualizar({ modelo: 'Vega', peca: 'Carenagem frontal', jaragua: 0, cores: 'branco 2; preto 3' });
  assert.deepStrictEqual([...p.linhas[2]], ['Vega', 'Carenagem frontal', 0, 5, p.linhas[2][4], 'branco=2; preto=3']);
  const q = montar(PLANILHA());
  assert.strictEqual(q.listar().estoque[0].cores, '');
});
