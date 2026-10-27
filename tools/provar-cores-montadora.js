/* PROVA AS CORES NA TELA DA MONTADORA (27/10/2026 — Jacque: "carenagem lateral preto 10, vermelho 5") num navegador de verdade,
   SEM o Apps Script de verdade: serve esta pasta em http://127.0.0.1:8883 e responde script.google.com com um servidor de mentira
   que usa a regra REAL das cores (normalizarCores_ do google-apps-script.js). Nada é gravado em lugar nenhum.
   1. Botão "Cores": grava preto 10 · vermelho 5 · azul 0 → o pacote leva as cores e o total 15; a linha mostra as cores e o total
      fica travado ("TOTAL (CORES)"). Cor sem quantidade = aviso, nada vai.
   2. Tirar todas as cores e gravar → cores vazias, o total volta a ser digitável.
   3. Servidor antigo (sem a coluna Cores) → a tela diz que as cores NÃO foram guardadas.
   USO: node tools/provar-cores-montadora.js [FOTO=pasta] */
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const vm = require('vm');
const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const RAIZ = path.join(__dirname, '..');
const PORTA = 8883;   // porta nova (regra da casa)
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg' };
const servidor = http.createServer((q, r) => {
  const arq = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { r.writeHead(404); r.end('404'); return; }
  r.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(arq).pipe(r);
});
// a regra das cores do servidor de verdade
const src = fs.readFileSync(path.join(RAIZ, 'google-apps-script.js'), 'utf8');
const regra = {};
vm.runInNewContext(src.match(/function normalizarCores_\(v\) \{[\s\S]*?\nfunction somaCores_\(texto\) \{[\s\S]*?\n\}/)[0] + '; this.norm = normalizarCores_; this.soma = somaCores_;', regra);

const PECAS = [{ modelo: 'kay-2026', modeloNome: 'Kay 2026', nome: 'Carenagem lateral kay 2026', preco: 65, peso: '', img: '' },
  { modelo: 'kay-2026', modeloNome: 'Kay 2026', nome: 'Assoalho kay 2026', preco: 126, peso: '', img: '' }];

(async () => {
  let falhou = false, navegador = null;
  const confere = (ok, txt) => { console.log((ok ? '  ✔ ' : '  ✘ ') + txt); if (!ok) falhou = true; };
  try {
    await new Promise((ok) => servidor.listen(PORTA, '127.0.0.1', ok));
    navegador = await chromium.launch({ channel: 'chrome', headless: true });
    async function abrir(antigo, largura) {
      const ctx = await navegador.newContext({ viewport: { width: largura || 1100, height: 900 } });
      const pag = await ctx.newPage();
      const erros = []; const posts = [];
      const estoque = [{ modelo: 'Kay 2026', peca: 'Carenagem lateral kay 2026', sumare: 0, jaragua: 1, ultimaAtualizacao: '2026-10-27T12:26:43.116Z', cores: '' }];
      pag.on('pageerror', (e) => erros.push(String(e)));
      await pag.route(/script\.google\.com\//, async (r) => {
        const q = r.request();
        let corpo = { sucesso: true };
        if (q.method() === 'POST') {
          const b = JSON.parse(q.postData() || '{}'); posts.push(b);
          if (b.action === 'atualizar_estoque') {
            const linha = estoque.find((e) => e.modelo.toLowerCase() === String(b.modelo).toLowerCase() && e.peca.toLowerCase() === String(b.peca).toLowerCase());
            if (antigo) { if (linha) linha.jaragua = b.jaragua; corpo = { sucesso: true, mensagem: 'Estoque atualizado' }; }
            else {
              const tem = b.cores !== undefined && b.cores !== null; const cores = tem ? regra.norm(b.cores) : '';
              const j = tem && cores ? regra.soma(cores) : b.jaragua;
              if (linha) { linha.jaragua = j; if (tem) linha.cores = cores; }
              corpo = { sucesso: true, mensagem: 'Estoque atualizado', jaragua: j, cores: tem ? cores : undefined };
            }
          }
        } else {
          const acao = new URL(q.url()).searchParams.get('action');
          if (acao === 'listar_pecas') corpo = { sucesso: true, pecas: PECAS };
          if (acao === 'listar_estoque') corpo = { sucesso: true, estoque };
        }
        await r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(corpo) });
      });
      await pag.goto(`http://127.0.0.1:${PORTA}/index.html?view=montadora&modelo=kay-2026`);
      await pag.waitForSelector('.mont-linha', { timeout: 20000 });
      return { ctx, pag, erros, posts };
    }
    const linhaSel = '.mont-linha:has-text("Carenagem lateral kay 2026")';
    const texto = (pag, sel) => pag.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }, sel);
    const foto = async (pag, nome) => { if (process.env.FOTO) await pag.screenshot({ path: path.join(process.env.FOTO, nome + '.png'), fullPage: true }); };

    console.log('1) gravar as cores');
    { const { ctx, pag, erros, posts } = await abrir(false);
      const linha = pag.locator(linhaSel);
      await linha.locator('.mont-cores').click();
      confere(await linha.locator('.cor-linha').count() === 2, 'o formulário abre com 2 linhas de cor vazias');
      await linha.locator('.cor-nome').nth(0).fill('Preto'); await linha.locator('.cor-qtd').nth(0).fill('10');
      await linha.locator('.cor-nome').nth(1).fill('vermelho'); await linha.locator('.cor-qtd').nth(1).fill('5');
      await linha.locator('.cor-mais').click();
      await linha.locator('.cor-nome').nth(2).fill('azul');
      await linha.locator('.cor-salvar').click();
      confere(/Quantidade inválida para "azul"/.test(await linha.locator('.mont-status').innerText()) && !posts.length, 'cor sem quantidade: aviso, nada foi enviado');
      await linha.locator('.cor-qtd').nth(2).fill('0');
      await foto(pag, 'montadora-cores-form');
      await linha.locator('.cor-salvar').click();
      await pag.waitForFunction(() => /Cores gravadas/.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
      const p = posts[posts.length - 1] || {};
      confere(p.action === 'atualizar_estoque' && p.jaragua === 15 && JSON.stringify(p.cores) === JSON.stringify([{ cor: 'preto', qtd: 10 }, { cor: 'vermelho', qtd: 5 }, { cor: 'azul', qtd: 0 }]),
        'o pacote leva as 3 cores e o total 15 (' + JSON.stringify({ jaragua: p.jaragua, cores: p.cores }) + ')');
      const t = (await pag.locator(linhaSel).innerText()).replace(/\s+/g, " ");
      confere(/Cores: preto 10 · vermelho 5 · azul 0/.test(t), 'a linha mostra "Cores: preto 10 · vermelho 5 · azul 0"');
      confere(/TOTAL \(CORES\)/.test(t) && /Cores gravadas .* total 15/.test(t), 'o rótulo vira "TOTAL (CORES)" e o aviso diz o total 15');
      const qtd = linha.locator('.mont-qtd');
      confere((await qtd.inputValue()) === '15' && (await qtd.evaluate((e) => e.readOnly)), 'o total fica 15 e travado (muda pelas cores)');
      await foto(pag, 'montadora-cores-gravadas');

      console.log('2) tirar todas as cores');
      await linha.locator('.mont-cores').click();
      confere(await linha.locator('.cor-linha').count() === 3, 'o formulário abre com as 3 cores gravadas');
      for (let i = 0; i < 3; i++) await linha.locator('.cor-tirar').first().click();
      await linha.locator('.cor-salvar').click();
      await pag.waitForFunction(() => /ficou sem cor/.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
      const p2 = posts[posts.length - 1] || {};
      confere(p2.cores === '' && p2.jaragua === 15, 'o pacote leva cores vazias e mantém o total 15');
      confere(!/Cores:/.test((await pag.locator(linhaSel).innerText()).replace(/\s+/g, " ")) && !(await linha.locator('.mont-qtd').evaluate((e) => e.readOnly)), 'a linha fica sem cor e o total volta a ser digitável');
      confere(!erros.length, 'nenhum erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
      await ctx.close(); }

    console.log('3) servidor antigo (sem a coluna Cores)');
    { const { ctx, pag, erros } = await abrir(true, 375);
      const linha = pag.locator(linhaSel);
      await linha.locator('.mont-cores').click();
      await linha.locator('.cor-nome').nth(0).fill('preto'); await linha.locator('.cor-qtd').nth(0).fill('3');
      await linha.locator('.cor-salvar').click();
      await pag.waitForFunction(() => /NÃO foram guardadas/.test(document.body.innerText), null, { timeout: 5000 }).catch(() => {});
      confere(/As cores NÃO foram guardadas/.test(await linha.locator('.mont-status').innerText()), 'a tela diz que as cores NÃO foram guardadas');
      confere(!/Cores:/.test((await pag.locator(linhaSel).innerText()).replace(/\s+/g, " ")), 'e não mostra cor que não existe');
      await foto(pag, 'montadora-cores-celular');
      confere(!erros.length, 'nenhum erro na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
      await ctx.close(); }
  } catch (e) { console.error('ERRO NA PROVA:', e.message); falhou = true; }
  finally { if (navegador) await navegador.close(); servidor.close(); }
  console.log(falhou ? '\nFALHOU' : '\nTUDO CERTO');
  process.exit(falhou ? 1 : 0);
})();
