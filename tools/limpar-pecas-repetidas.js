// 28/10/2026 — junta as linhas repetidas da aba Pecas (uma linha por peca; ver chavePecaAba_ no google-apps-script.js).
// Ensaio (padrao): le a aba, roda as funcoes DO SERVIDOR contra uma copia em memoria e mostra o antes/depois — nada grava.
// --valendo: para cada peca repetida manda ao servidor um "adicionar" so com modelo + nome. Com a peca ja na aba, o servidor
// atualiza a linha gravada por ultimo SEM trocar preco, peso, foto e modelo (o que nao veio fica) e apaga as repetidas.
// So funciona com a versao do servidor de 28/10 no ar (a anterior criaria mais uma linha): o script confere isso antes.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PLANILHA = '1QtumxGgKwzWBQBPISfDFjH3qGboiT3_1x5gbxl6R6ns';
const SAC = 'https://script.google.com/macros/s/AKfycbytZgFvvhTvYRgufyvFTGbMb27sxHnIQp256XQ6r7VZuX2B0RTdO3MIpbf4EcF8KgnYlw/exec';
const valendo = process.argv.includes('--valendo');

async function lerAba() {
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${PLANILHA}/gviz/tq?tqx=out:json&sheet=Pecas&headers=1&t=${Date.now()}`);
  const t = await r.text();
  const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  if (j.status !== 'ok') throw new Error('aba Pecas: ' + j.status);
  return j.table.rows.map((row) => [0, 1, 2, 3, 4, 5, 6].map((i) => (row.c && row.c[i] && row.c[i].v != null ? row.c[i].v : '')));
}

function servidor(linhas) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8');
  const trecho = src.match(/\/\/ 28\/10\/2026 — UMA LINHA POR PECA[\s\S]*?\nfunction listarPecasSheet\(\) \{[\s\S]*?\n\}/);
  if (!trecho) throw new Error('trecho do servidor nao encontrado');
  const rows = [['Timestamp', 'Modelo', 'ModeloNome', 'Nome', 'Preco', 'Peso', 'Img'], ...linhas.map((l) => l.slice())];
  const aba = {
    getDataRange: () => ({ getValues: () => rows.map((r) => r.slice()) }),
    getRange: (lin, col) => ({ setValues(vs) { vs[0].forEach((v, j) => { rows[lin - 1][col - 1 + j] = v; }); return this; } }),
    deleteRow: (r) => { rows.splice(r - 1, 1); },
    appendRow: (r) => rows.push(r.slice())
  };
  const ctx = { ABA_PECAS: 'Pecas', SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => aba }) }, getOrCreateAbaPecas: () => aba,
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, registrarAlteracaoValor_: () => true, salvarImagemDrive: () => '' };
  vm.runInNewContext(trecho[0] + '; this.gerenciar = gerenciarPeca; this.listar = listarPecasSheet; this.chave = chavePecaAba_; this.tempo = tempoLinhaPeca_;', ctx);
  return { ...ctx, rows };
}

function repetidas(linhas, s) {
  const g = new Map();
  linhas.forEach((l, i) => { if (!l[1] || !l[3]) return; const k = s.chave(l[1], l[3]); (g.get(k) || g.set(k, []).get(k)).push(i); });
  return [...g.values()].filter((x) => x.length > 1).map((idx) => {
    const nova = idx.slice().sort((a, b) => (s.tempo(linhas[b][0]) - s.tempo(linhas[a][0])) || (b - a))[0];
    return { idx, nova: linhas[nova] };
  });
}

(async () => {
  const linhas = await lerAba();
  const s = servidor(linhas);
  const grupos = repetidas(linhas, s);
  const antes = s.listar().pecas.length;
  console.log(`aba Pecas: ${linhas.length} linhas · ${antes} pecas · ${grupos.length} com linha repetida (${grupos.reduce((n, g) => n + g.idx.length - 1, 0)} a mais)`);
  // ensaio: o mesmo pedido que o --valendo manda, contra a copia
  for (const g of grupos) {
    const r = s.gerenciar({ acao: 'adicionar', modelo: g.nova[1], nome: g.nova[3], preco: null, peso: '', img: '', modeloNome: '' });
    if (!r.sucesso || !/ja existia/.test(r.mensagem)) throw new Error('ensaio: ' + g.nova[3] + ' → ' + JSON.stringify(r));
  }
  const depois = s.rows.slice(1);
  const restam = repetidas(depois, s);
  let mudou = 0;
  for (const g of grupos) {
    const l = depois.find((x) => s.chave(x[1], x[3]) === s.chave(g.nova[1], g.nova[3]));
    if ([1, 2, 3, 4, 5, 6].some((c) => String(l[c]) !== String(g.nova[c]))) { mudou++; console.log('   DIFERENTE:', g.nova, '→', l); }
  }
  console.log(`ensaio: ${depois.length} linhas · ${restam.length} repetidas · ${mudou} pecas com preco/peso/foto/nome diferente da linha mais nova`);
  grupos.forEach((g) => console.log(`   ${g.nova[1]} · ${g.nova[3]} · ${g.idx.length} linhas → 1 (fica: ${g.nova[4] === '' ? 'sem preço' : 'R$ ' + g.nova[4]}${g.nova[6] ? ', com foto' : ''})`));
  if (restam.length || mudou || depois.length !== antes) { console.log('ENSAIO NAO BATEU — nada foi gravado.'); process.exit(1); }
  if (!valendo) { console.log('\nEnsaio. Para gravar: node tools/limpar-pecas-repetidas.js --valendo'); return; }

  // Valendo: confere que o servidor no ar e o de 28/10 (listar ja devolve uma linha por peca).
  const noAr = await fetch(`${SAC}?action=listar_pecas&t=${Date.now()}`, { redirect: 'follow' }).then((r) => r.json());
  if (!noAr.sucesso || noAr.pecas.length !== antes) { console.log(`O servidor no ar devolve ${noAr.pecas && noAr.pecas.length} linhas (esperado ${antes}): publique a versao de 28/10 antes. Nada gravado.`); process.exit(1); }
  let ok = 0;
  for (const g of grupos) {
    const corpo = { action: 'gerenciar_peca', acao: 'adicionar', modelo: g.nova[1], nome: g.nova[3], preco: null, peso: '', img: '', modeloNome: '' };
    const r = await fetch(SAC, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(corpo) }).then((x) => x.json()).catch((e) => ({ erro: e.message }));
    const certo = r && r.sucesso && /ja existia/.test(r.mensagem || '');
    if (certo) ok++;
    console.log(`   ${certo ? 'ok' : 'ERRO'} · ${g.nova[1]} · ${g.nova[3]} · ${r.mensagem || r.erro} · repetidas apagadas: ${r.repetidasApagadas}`);
  }
  const fim = await lerAba();
  console.log(`\nvalendo: ${ok}/${grupos.length} · aba agora ${fim.length} linhas · repetidas: ${repetidas(fim, s).length}`);
})().catch((e) => { console.error(e); process.exit(1); });
