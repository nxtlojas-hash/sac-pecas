// Passa para a aba Pecas (planilha "Pedido de pecas") as pecas que so existem
// em data.js. Uma linha por modelo, com preco, peso e foto (se o arquivo existe).
//
//   node tools/migrar-pecas-base.js            -> ENSAIO: so lista, nao grava
//   node tools/migrar-pecas-base.js --valendo  -> grava, uma por vez, com retentativa
//
// Idempotente: sempre le a planilha antes e so manda o que ainda nao esta la.
// Registro de cada gravacao em tools/migracao-pecas-<data>.log.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const lib = require('../lib/montadora.js');

const RAIZ = path.join(__dirname, '..');
const URL = 'https://script.google.com/macros/s/AKfycbytZgFvvhTvYRgufyvFTGbMb27sxHnIQp256XQ6r7VZuX2B0RTdO3MIpbf4EcF8KgnYlw/exec';
const VALENDO = process.argv.includes('--valendo');

// data.js e um script de navegador: avalia num contexto vazio.
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(RAIZ, 'data.js'), 'utf8') + '\nthis.CATALOGO_MODELOS = CATALOGO_MODELOS;', ctx);
const dataJs = ctx.CATALOGO_MODELOS;

async function json(url, corpo, tentativas = 3) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const r = await fetch(url, corpo ? { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(corpo), redirect: 'follow' } : { redirect: 'follow' });
      const t = await r.text();
      const d = JSON.parse(t);
      if (d && d.sucesso) return d;
      throw new Error(d && d.erro ? d.erro : 'resposta sem sucesso');
    } catch (e) {
      if (i === tentativas) throw e;
      await new Promise(res => setTimeout(res, 3000 * i));
    }
  }
}

(async () => {
  const planilha = (await json(URL + '?action=listar_pecas')).pecas || [];
  const existe = (p) => fs.existsSync(path.join(RAIZ, p));
  const faltam = lib.linhasParaMigrar(dataJs, planilha, existe);
  const totalDataJs = Object.values(dataJs).reduce((n, m) => n + (m.pecas || []).length, 0);
  const porModelo = {};
  faltam.forEach(l => { porModelo[l.modeloNome] = (porModelo[l.modeloNome] || 0) + 1; });
  console.log(`data.js: ${totalDataJs} pecas · planilha: ${planilha.length} linhas · faltam na planilha: ${faltam.length}`);
  console.log('por modelo:', JSON.stringify(porModelo));
  console.log(`com foto que existe no repo: ${faltam.filter(l => l.img).length} · sem foto: ${faltam.filter(l => !l.img).length}`);
  if (!VALENDO) {
    console.log('\nENSAIO — nada gravado. Primeiras 5:');
    faltam.slice(0, 5).forEach(l => console.log('  ', JSON.stringify(l)));
    return;
  }
  const log = path.join(__dirname, `migracao-pecas-${new Date().toISOString().slice(0, 10)}.log`);
  let ok = 0, erro = 0;
  for (const [i, l] of faltam.entries()) {
    const corpo = { action: 'gerenciar_peca', acao: 'adicionar', modelo: l.modelo, modeloNome: l.modeloNome, nome: l.nome, preco: l.preco, peso: l.peso, img: l.img };
    try {
      const d = await json(URL, corpo);
      ok++;
      fs.appendFileSync(log, `${new Date().toISOString()} OK ${l.modelo} | ${l.nome} | ${d.mensagem}\n`);
    } catch (e) {
      erro++;
      fs.appendFileSync(log, `${new Date().toISOString()} ERRO ${l.modelo} | ${l.nome} | ${e.message}\n`);
    }
    if ((i + 1) % 20 === 0) console.log(`${i + 1}/${faltam.length} (ok ${ok}, erro ${erro})`);
  }
  console.log(`\nFIM: ${ok} gravadas, ${erro} com erro. Registro: ${log}`);
  const depois = (await json(URL + '?action=listar_pecas')).pecas || [];
  const aindaFaltam = lib.linhasParaMigrar(dataJs, depois, existe);
  console.log(`conferencia: planilha agora com ${depois.length} linhas · ainda faltam ${aindaFaltam.length}`);
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
