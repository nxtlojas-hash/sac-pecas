// 28/10/2026 — uma linha por peca na aba Pecas (Rafael: "o preco some quando atualizo"). Roda as funcoes de verdade do
// Apps Script (gerenciarPeca, listarPecasSheet e as ajudantes) contra uma planilha de mentira.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8');
const trecho = src.match(/\/\/ 28\/10\/2026 — UMA LINHA POR PECA[\s\S]*?\nfunction listarPecasSheet\(\) \{[\s\S]*?\n\}/);
const CAB = ['Timestamp', 'Modelo', 'ModeloNome', 'Nome', 'Preco', 'Peso', 'Img'];

function montar(linhas) {
  const rows = [CAB.slice(), ...linhas.map((l) => l.slice())];
  const trilha = [];
  const trava = { pedidas: 0, soltas: 0, ocupada: false };
  const aba = {
    getDataRange: () => ({ getValues: () => rows.map((r) => r.slice()) }),
    getRange: (lin, col, nl, nc) => ({ setValues(vs) { vs[0].forEach((v, j) => { rows[lin - 1][col - 1 + j] = v; }); return this; } }),
    deleteRow: (r) => { rows.splice(r - 1, 1); },
    appendRow: (r) => rows.push(r.slice())
  };
  const ctx = {
    ABA_PECAS: 'Pecas',
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => (n === 'Pecas' ? aba : null) }) },
    getOrCreateAbaPecas: () => aba,
    LockService: { getScriptLock: () => ({ waitLock() { if (trava.ocupada) throw new Error('ocupada'); trava.pedidas++; }, releaseLock() { trava.soltas++; } }) },
    registrarAlteracaoValor_: (...a) => { trilha.push(a); return true; },
    salvarImagemDrive: (b64, nome) => 'https://drive.google.com/thumbnail?id=FOTO-' + nome
  };
  vm.runInNewContext(trecho[0] + '; this.gerenciar = gerenciarPeca; this.listar = listarPecasSheet;', ctx);
  return { ...ctx, rows, trilha, trava, corpo: () => rows.slice(1) };
}

// O caso do Rafael (aba de verdade, 28/10): a linha nova com preco em cima, a de junho sem preco embaixo.
const FAROL = () => [
  ['2026-10-28T14:16:38.398Z', 'gataka', 'Gataka', 'acabamento carenagem do farol', 45, '10g', 'https://drive.google.com/thumbnail?id=NOVA'],
  ['2026-09-30T12:00:00.000Z', 'gataka', 'Gataka', 'Farol', 145, '2kg', 'img/gataka/farol.jpg'],
  ['2026-06-11T17:45:14.185Z', 'gataka', 'Gataka', 'acabamento carenagem do farol', '', '10g', 'https://drive.google.com/thumbnail?id=VELHA']
];

test('o trecho existe no fonte', () => assert.ok(trecho, 'chavePecaAba_ … listarPecasSheet'));

test('listar: peca com duas linhas devolve a gravada por ultimo (o preco nao some mais)', () => {
  const p = montar(FAROL());
  const r = p.listar();
  assert.strictEqual(r.sucesso, true);
  assert.strictEqual(r.pecas.length, 2);
  const farol = r.pecas.find((x) => x.nome === 'acabamento carenagem do farol');
  assert.strictEqual(farol.preco, 45);
  assert.strictEqual(farol.img, 'https://drive.google.com/thumbnail?id=NOVA');
});

test('listar: empate de horario vale a de baixo (como a tela fazia) e sem acento/caixa e a mesma peca', () => {
  const p = montar([
    ['2026-09-30T19:58:54.559Z', 'zilla', 'ZILLA', 'Balanca', 220, '1,20kg', 'img/zilla/balanca.jpeg'],
    ['2026-09-30T19:58:56.410Z', 'zilla', 'ZILLA', 'Balança', 220, '1,20kg', 'img/zilla/balança.jpeg'],
    ['2026-10-23T13:08:26.968Z', 'kay-2026', 'Kay 2026', 'Chave ignição', 125, '', 'A'],
    ['2026-10-23T13:08:26.968Z', 'kay-2026', 'Kay 2026', ' chave ignição ', 130, '', 'B']
  ]);
  const r = p.listar().pecas;
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].nome, 'Balança');
  assert.strictEqual(r[1].preco, 130);
});

test('listar: data como Date (celula formatada) tambem conta', () => {
  const p = montar([
    [new Date('2026-10-28T10:00:00Z'), 'vega', 'Vega', 'Pedal und', 52, '', 'NOVA'],
    ['2026-06-01T10:00:00.000Z', 'vega', 'Vega', 'Pedal und', '', '', 'VELHA']
  ]);
  assert.strictEqual(p.listar().pecas[0].img, 'NOVA');
});

test('editar: grava na linha que a tela mostra (a mais nova) e apaga a repetida', () => {
  const p = montar(FAROL());
  const r = p.gerenciar({ acao: 'editar', modelo: 'gataka', modeloNome: 'Gataka', nome: 'acabamento carenagem do farol', nomeOriginal: 'acabamento carenagem do farol', preco: 49, peso: '10g', img: 'https://drive.google.com/thumbnail?id=NOVA' });
  assert.strictEqual(r.sucesso, true);
  assert.strictEqual(r.repetidasApagadas, 1);
  const linhas = p.corpo().filter((l) => l[3] === 'acabamento carenagem do farol');
  assert.strictEqual(linhas.length, 1);
  assert.strictEqual(linhas[0][4], 49);
  assert.strictEqual(p.corpo().length, 2, 'o Farol continua');
  assert.strictEqual(p.listar().pecas.find((x) => x.nome === 'acabamento carenagem do farol').preco, 49);
  assert.deepStrictEqual(p.trilha[0].slice(2, 5), ['preco', 45, 49], 'o "de" e o preco que a tela mostrava');
  assert.deepStrictEqual([p.trava.pedidas, p.trava.soltas], [1, 1]);
});

test('editar: troca de nome leva a peca e limpa as repetidas do nome antigo', () => {
  const p = montar(FAROL());
  const r = p.gerenciar({ acao: 'editar', modelo: 'gataka', modeloNome: 'Gataka', nome: 'Acabamento da carenagem do farol', nomeOriginal: 'acabamento carenagem do farol', preco: 45, peso: '10g', img: 'X' });
  assert.strictEqual(r.sucesso, true);
  const nomes = p.corpo().map((l) => l[3]).sort();
  assert.deepStrictEqual(nomes, ['Acabamento da carenagem do farol', 'Farol']);
});

test('editar: peca que nao existe na aba continua dando erro (a tela cadastra pelo caminho de sempre)', () => {
  const p = montar(FAROL());
  const r = p.gerenciar({ acao: 'editar', modelo: 'gataka', nome: 'Retrovisor', nomeOriginal: 'Retrovisor', preco: 75 });
  assert.strictEqual(r.sucesso, false);
  assert.match(r.erro, /nao encontrada para editar: retrovisor/);
  assert.strictEqual(p.corpo().length, 3);
  assert.deepStrictEqual([p.trava.pedidas, p.trava.soltas], [1, 1], 'a trava e solta mesmo no erro');
});

test('adicionar: peca nova entra no fim', () => {
  const p = montar(FAROL());
  const r = p.gerenciar({ acao: 'adicionar', modelo: 'gataka', modeloNome: 'Gataka', nome: 'Retrovisor', preco: 75, peso: '300g', img: '' });
  assert.strictEqual(r.sucesso, true);
  assert.strictEqual(r.mensagem, 'Peca adicionada: Retrovisor');
  assert.strictEqual(p.corpo().length, 4);
  assert.strictEqual(p.corpo()[3][3], 'Retrovisor');
});

test('adicionar: o mesmo cadastro chegando duas vezes (com foto) fica UMA linha', () => {
  const p = montar([]);
  const pedido = { acao: 'adicionar', modelo: 'hyphen', modeloNome: 'Hyphen', nome: 'Carenagem lateral direita', preco: 75, peso: '', imagemBase64: 'data:image/jpeg;base64,AAAA', imagemNome: 'carenagem.jpg' };
  const r1 = p.gerenciar({ ...pedido });
  const r2 = p.gerenciar({ ...pedido, imagemNome: 'carenagem2.jpg' });
  assert.strictEqual(r1.sucesso, true);
  assert.strictEqual(r2.sucesso, true);
  assert.match(r2.mensagem, /ja existia/);
  assert.strictEqual(p.corpo().length, 1);
  assert.strictEqual(p.corpo()[0][6], 'https://drive.google.com/thumbnail?id=FOTO-carenagem2.jpg');
});

test('adicionar: o repetido sem foto/preco nao apaga o que a linha ja tinha', () => {
  const p = montar(FAROL());
  p.gerenciar({ acao: 'adicionar', modelo: 'gataka', modeloNome: '', nome: 'Acabamento carenagem do farol', preco: null, peso: '', img: '' });
  const l = p.corpo().filter((x) => /farol$/i.test(x[3]) && /acabamento/i.test(x[3]));
  assert.strictEqual(l.length, 1);
  assert.deepStrictEqual([l[0][2], l[0][4], l[0][5], l[0][6]], ['Gataka', 45, '10g', 'https://drive.google.com/thumbnail?id=NOVA']);
});

test('excluir: apaga todas as linhas da peca (a de junho nao volta)', () => {
  const p = montar([...FAROL(), ['2026-06-11T18:42:40.381Z', 'gataka', 'Gataka', 'Acabamento carenagem do farol ', '', '', '']]);
  const r = p.gerenciar({ acao: 'excluir', modelo: 'gataka', nome: 'acabamento carenagem do farol' });
  assert.strictEqual(r.sucesso, true);
  assert.strictEqual(r.linhasApagadas, 3);
  assert.deepStrictEqual(p.corpo().map((l) => l[3]), ['Farol']);
});

test('excluir: peca que ja nao esta na aba responde como antes', () => {
  const p = montar(FAROL());
  const r = p.gerenciar({ acao: 'excluir', modelo: 'gataka', nome: 'Retrovisor' });
  assert.strictEqual(r.sucesso, true);
  assert.match(r.mensagem, /nao encontrada/);
  assert.strictEqual(p.corpo().length, 3);
});

test('outro modelo com o mesmo nome e outra peca', () => {
  const p = montar([...FAROL(), ['2026-10-01T00:00:00.000Z', 'vega', 'Vega', 'Farol', 99, '', '']]);
  p.gerenciar({ acao: 'excluir', modelo: 'gataka', nome: 'Farol' });
  assert.deepStrictEqual(p.corpo().filter((l) => l[3] === 'Farol').map((l) => l[1]), ['vega']);
});

test('planilha ocupada: nao grava e avisa', () => {
  const p = montar(FAROL());
  p.trava.ocupada = true;
  const r = p.gerenciar({ acao: 'adicionar', modelo: 'gataka', nome: 'Retrovisor', preco: 75 });
  assert.strictEqual(r.sucesso, false);
  assert.match(r.erro, /ocupada/);
  assert.strictEqual(p.corpo().length, 3);
});

test('acao desconhecida continua recusada', () => {
  const p = montar(FAROL());
  assert.strictEqual(p.gerenciar({ acao: 'apagar_tudo', modelo: 'gataka', nome: 'Farol' }).sucesso, false);
  assert.strictEqual(p.trava.pedidas, 0);
});
