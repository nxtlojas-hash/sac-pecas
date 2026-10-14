// 14/10 — o Bling anunciou o bloqueio do token opaco para 15/10. Sem
// 'enable-jwt: 1' a renovacao devolve o token velho e o pedido de pecas para.
// Le o fonte do Apps Script (nao ha runtime GAS aqui) e prende a fiacao.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, 'google-apps-script.js'), 'utf8');

// O cabecalho tem o nome exato do guia do Bling.
assert.ok(/var BLING_CABECALHO_JWT = 'enable-jwt';/.test(src), 'nome do cabecalho');

// ehJwtBling separa o token novo do velho — roda a funcao de verdade.
const corpo = src.match(/function ehJwtBling\(token\) \{[\s\S]*?\n\}/);
assert.ok(corpo, 'ehJwtBling existe');
const ctx = {};
vm.runInNewContext(corpo[0] + '; this.ehJwtBling = ehJwtBling;', ctx);
assert.strictEqual(ctx.ehJwtBling('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.' + 'a'.repeat(1500)), true, 'JWT');
assert.strictEqual(ctx.ehJwtBling('3f2a9c0d1e4b5a6978c0d1e2f3a4b5c6d7e8f901'), false, 'opaco');
assert.strictEqual(ctx.ehJwtBling(null), false);

// As duas chamadas ao /oauth/token (renovacao e callback) levam o cabecalho.
assert.ok(/headersRenovacao\[BLING_CABECALHO_JWT\] = '1';/.test(src), 'renovacao com enable-jwt');
assert.ok(/cbHeaders\[BLING_CABECALHO_JWT\] = '1';/.test(src), 'callback com enable-jwt');
const tokenCalls = src.match(/UrlFetchApp\.fetch\(BLING_API_BASE \+ '\/oauth\/token'/g) || [];
assert.strictEqual(tokenCalls.length, 2, 'se surgir outra chamada ao /oauth/token, ela tambem precisa do cabecalho');
// Toda chamada da API (blingRequest) tambem.
assert.ok(/options\.headers\[BLING_CABECALHO_JWT\] = '1';/.test(src), 'blingRequest com enable-jwt');

// Token opaco guardado nao e reaproveitado — nas DUAS checagens (antes e depois do lock).
const cache = src.match(/Date\.now\(\) < tokens\.expiry - 300000 && ehJwtBling\(tokens\.accessToken\)/g) || [];
assert.strictEqual(cache.length, 2, 'as duas checagens de cache exigem JWT');

// O status diz se ja e JWT (sem expor o token).
assert.ok(/tokenJwt: tokens\.accessToken \? ehJwtBling\(tokens\.accessToken\) : null/.test(src), 'status informa tokenJwt');
console.log('bling-jwt: ok');
