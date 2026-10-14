// 14/10/2026 — Jaragua marca o pedido no Pos-Venda: o Apps Script grava STATUS,
// DATA ENVIO e NF na aba PEDIDOS. Roda a funcao de verdade (marcarPedidoSac_)
// contra uma planilha de mentira: so as colunas G, H e I mudam, e o que ja
// saiu nao volta atras.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8');
const trecho = src.match(/var STATUS_PEDIDO_APP = [\s\S]*?\nfunction marcarPedidoSac_\(body\) \{[\s\S]*?\n\}/);

function montar(linhas) {
  const gravado = [];
  const trilha = [];
  const aba = {
    getDataRange: () => ({ getValues: () => linhas.map((l) => l.slice()) }),
    getRange: (lin, col) => ({ setValue: (v) => { gravado.push([lin, col, v]); linhas[lin - 1][col - 1] = v; } })
  };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => (n === 'PEDIDOS' ? aba : null) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    registrarAlteracaoValor_: (...a) => { trilha.push(a); return true; }
  };
  vm.runInNewContext(trecho[0] + '; this.marcar = marcarPedidoSac_;', ctx);
  return { marcar: ctx.marcar, gravado, trilha, linhas };
}
const linha = (pca, status, data, nf) => ['', pca, 'CS-2026-0300', 'Debora', 'WhatsApp', 'Maria', status, data, nf, 'Garantia'];
const PLANILHA = () => [['', 'PEDIDO', 'PROTOCOLO SAC', 'ATENDENTE', 'Origem', 'clientes', 'STATUS', 'DATA ENVIO', 'NF', ''],
  linha('PCA-1', 'ORGANIZANDO', '', ''), linha('PCA-2', 'ENVIADO', '01/10/2026', 5600), linha('PCA-3', '', '', 4063)];

test('a funcao existe no fonte e a acao POST chama ela', () => {
  assert.ok(trecho, 'marcarPedidoSac_ no fonte');
  assert.ok(/case 'marcar_pedido':\s*\n\s*return jsonResponse\(marcarPedidoSac_\(body\)\);/.test(src));
});

test('enviado: grava G, H e I da linha do pedido e deixa trilha', () => {
  const p = montar(PLANILHA());
  const r = p.marcar({ pedido: 'PCA-1', status: 'ENVIADO', dataEnvio: '14/10/2026', nf: '5700', quem: 'Rafael' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), { ok: true, pedido: 'PCA-1', status: 'ENVIADO', anterior: 'ORGANIZANDO' });
  assert.deepStrictEqual(p.gravado, [[2, 7, 'ENVIADO'], [2, 8, '14/10/2026'], [2, 9, 5700]]);
  assert.deepStrictEqual(p.trilha.map((t) => [t[0], t[1], t[2], t[5]]), [['pedido', 'PCA-1', 'status', 'posvenda: Rafael'],
    ['pedido', 'PCA-1', 'data envio', 'posvenda: Rafael'], ['pedido', 'PCA-1', 'nf', 'posvenda: Rafael']]);
});

test('nao tem a peca e a peca chegou: so o STATUS muda', () => {
  const p = montar(PLANILHA());
  assert.strictEqual(p.marcar({ pedido: 'PCA-3', status: 'NÃO TEM PEÇA' }).ok, true);
  assert.strictEqual(p.marcar({ pedido: 'PCA-3', status: 'ORGANIZANDO' }).ok, true);
  assert.deepStrictEqual(p.gravado, [[4, 7, 'NÃO TEM PEÇA'], [4, 7, 'ORGANIZANDO']]);
});

test('recusas: pedido que ja saiu nao volta; status inventado; enviado sem data ou sem NF; pedido que nao existe', () => {
  const p = montar(PLANILHA());
  assert.match(p.marcar({ pedido: 'PCA-2', status: 'ORGANIZANDO' }).erro, /ja esta ENVIADO/);
  assert.match(p.marcar({ pedido: 'PCA-1', status: 'EMBALADO' }).erro, /Status invalido/);
  assert.match(p.marcar({ pedido: 'PCA-1', status: 'ENVIADO', dataEnvio: '2026-10-14', nf: '1' }).erro, /dd\/mm\/aaaa/);
  assert.match(p.marcar({ pedido: 'PCA-1', status: 'ENVIADO', dataEnvio: '14/10/2026', nf: '' }).erro, /NF/);
  assert.match(p.marcar({ pedido: 'PCA-9', status: 'ENVIADO', dataEnvio: '14/10/2026', nf: '1' }).erro, /nao encontrado/);
  assert.deepStrictEqual(p.gravado, []);
});
