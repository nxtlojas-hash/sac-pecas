// 21/08 — "a Ni Hao morre": o SAC Pecas passa a emitir pela conta que a
// propriedade BLING_EMPRESA disser, com a natureza DAQUELA conta. Este teste
// le o fonte do Apps Script (nao ha runtime GAS aqui) e prende a fiacao.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'google-apps-script.js'), 'utf8');

// Os dois ids, lidos da API em 21/08 (Ni Hao 15105967674 · Vollmond 15103346620).
assert.ok(/NATUREZA_PECAS_POR_EMPRESA\s*=\s*\{\s*nihao:\s*15105967674,\s*vollmond:\s*15103346620\s*\}/.test(src), 'mapa de natureza por conta');
// O pedido NAO pode voltar a levar o id fixo da Ni Hao.
assert.ok(!/naturezaOperacao:\s*\{\s*id:\s*15105967674\s*\}/.test(src), 'id fixo da Ni Hao no pedido nao pode voltar');
assert.ok(/naturezaOperacao:\s*\{\s*id:\s*naturezaBlingPecas\(\)\s*\}/.test(src), 'o pedido usa a natureza da conta');
// Sem a propriedade, Ni Hao (nada muda ate alguem trocar de proposito).
assert.ok(/getProperty\('BLING_EMPRESA'\)\s*\|\|\s*'nihao'/.test(src), 'padrao e nihao');
// O status e a pagina de autorizacao dizem a conta — a troca se confere, nao se adivinha.
assert.ok(/empresa:\s*empresaBling\(\)/.test(src), 'status informa a empresa');
assert.ok(/Conta esperada:/.test(src), 'auth_bling avisa qual conta deve estar logada');
console.log('bling-empresa: ok');
