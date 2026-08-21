// 21/08 — a conta do Bling do SAC Pecas e a propriedade BLING_EMPRESA, e a
// natureza e a DAQUELA conta. MEDIDO em 21/08 a tarde: as pecas sempre sairam
// pela NXT INDUSTRIA (196 pedidos PCA- de agosto na conta nxt; 0 na Ni Hao;
// 0 na Vollmond) — o id fixo antigo era da Ni Hao e o Bling o ignorava.
// Este teste le o fonte do Apps Script (nao ha runtime GAS aqui) e prende a fiacao.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'google-apps-script.js'), 'utf8');

// Os tres ids, lidos da API em 21/08 (Industria 15105726928 · Ni Hao 15105967674 · Vollmond 15103346620).
assert.ok(/NATUREZA_PECAS_POR_EMPRESA\s*=\s*\{\s*nxt:\s*15105726928,\s*nihao:\s*15105967674,\s*vollmond:\s*15103346620\s*\}/.test(src), 'mapa de natureza por conta, Industria incluida');
// O pedido NAO pode voltar a levar id fixo.
assert.ok(!/naturezaOperacao:\s*\{\s*id:\s*151\d+\s*\}/.test(src), 'id fixo de natureza no pedido nao pode voltar');
assert.ok(/naturezaOperacao:\s*\{\s*id:\s*naturezaBlingPecas\(\)\s*\}/.test(src), 'o pedido usa a natureza da conta');
// Sem a propriedade, INDUSTRIA — e o que sempre foi.
assert.ok(/getProperty\('BLING_EMPRESA'\)\s*\|\|\s*'nxt'/.test(src), 'padrao e a Industria');
assert.ok(/NATUREZA_PECAS_POR_EMPRESA\[empresaBling\(\)\]\s*\|\|\s*NATUREZA_PECAS_POR_EMPRESA\.nxt/.test(src), 'conta desconhecida cai na Industria');
// O status e a pagina de autorizacao dizem a conta — a troca se confere, nao se adivinha.
assert.ok(/empresa:\s*empresaBling\(\)/.test(src), 'status informa a empresa');
assert.ok(/Conta esperada:/.test(src), 'auth_bling avisa qual conta deve estar logada');
console.log('bling-empresa: ok');
