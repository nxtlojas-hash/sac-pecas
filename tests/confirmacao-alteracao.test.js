const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ESCOPO_SALDO,
  formatarMoedaBR,
  textoDoValor,
  mesmoValor,
  listarMudancas,
  escopoModelos,
  avisoRemocaoModelos,
  mensagemNadaMudou,
  decidirGravacao
} = require('../lib/confirmacao-alteracao.js');

// ---------------------------------------------------------------------------
// COMO O VALOR APARECE NA FRASE
// ---------------------------------------------------------------------------

test('preco sai em real brasileiro, com milhar e duas casas', () => {
  assert.strictEqual(formatarMoedaBR(890), 'R$ 890,00');
  assert.strictEqual(formatarMoedaBR(950.5), 'R$ 950,50');
  assert.strictEqual(formatarMoedaBR(1234.5), 'R$ 1.234,50');
  assert.strictEqual(formatarMoedaBR(1234567.89), 'R$ 1.234.567,89');
});

test('peca sem preco nao vira "R$ 0,00"', () => {
  // Peca sem preco cadastrado existe no catalogo (o campo abre em branco).
  // Mostrar zero faria a confirmacao mentir sobre o valor antigo.
  [null, undefined, '', '   '].forEach((v) => {
    assert.strictEqual(formatarMoedaBR(v), 'sem preço', JSON.stringify(v));
  });
});

test('preco tambem e lido do jeito que a pessoa digita ("1.234,56")', () => {
  assert.strictEqual(formatarMoedaBR('1.234,56'), 'R$ 1.234,56');
  assert.strictEqual(formatarMoedaBR('890,00'), 'R$ 890,00');
});

test('peso em branco aparece como "em branco", nao como vazio invisivel', () => {
  assert.strictEqual(textoDoValor('texto', ''), 'em branco');
  assert.strictEqual(textoDoValor('texto', null), 'em branco');
  assert.strictEqual(textoDoValor('texto', '1,60kg'), '1,60kg');
});

// ---------------------------------------------------------------------------
// O QUE CONTA COMO "MUDOU"
// ---------------------------------------------------------------------------

test('preco: numero e o mesmo texto formatado sao o MESMO valor', () => {
  // O campo do modal mostra o preco formatado e devolve texto. Sem isso, abrir
  // o modal e salvar sem tocar em nada seria "alteracao de preco".
  assert.strictEqual(mesmoValor('moeda', 890, '890,00'), true);
  assert.strictEqual(mesmoValor('moeda', 1234.5, '1.234,50'), true);
  assert.strictEqual(mesmoValor('moeda', 890, 950), false);
});

test('preco: diferenca abaixo do centavo nao e alteracao (o campo so tem 2 casas)', () => {
  assert.strictEqual(mesmoValor('moeda', 890.004, 890), true);
  assert.strictEqual(mesmoValor('moeda', 890.005, 890.01), true);
  assert.strictEqual(mesmoValor('moeda', 890, 890.01), false);
});

test('preco: "sem preco" e igual a "sem preco", e diferente de zero', () => {
  assert.strictEqual(mesmoValor('moeda', null, ''), true);
  assert.strictEqual(mesmoValor('moeda', null, 0), false);
  assert.strictEqual(mesmoValor('moeda', 0, null), false);
});

test('peso: espaco em volta e digitacao; trocar a caixa e edicao', () => {
  assert.strictEqual(mesmoValor('texto', ' 55gr ', '55gr'), true);
  assert.strictEqual(mesmoValor('texto', null, ''), true);
  assert.strictEqual(mesmoValor('texto', '55gr', '55GR'), false);
  assert.strictEqual(mesmoValor('texto', '55gr', '60gr'), false);
});

test('saldo: texto do input e o inteiro da tela sao o mesmo saldo', () => {
  assert.strictEqual(mesmoValor('inteiro', 3, '3'), true);
  assert.strictEqual(mesmoValor('inteiro', '', 0), true);
  assert.strictEqual(mesmoValor('inteiro', 0, 0), true);
  assert.strictEqual(mesmoValor('inteiro', 3, 5), false);
});

test('listarMudancas devolve SO o que mudou, com os dois lados prontos', () => {
  const m = listarMudancas([
    { campo: 'preco', rotulo: 'preço', tipo: 'moeda', de: 890, para: 950 },
    { campo: 'peso', rotulo: 'peso', tipo: 'texto', de: '1,60kg', para: '1,60kg' }
  ]);
  assert.strictEqual(m.length, 1);
  assert.strictEqual(m[0].campo, 'preco');
  assert.strictEqual(m[0].deTexto, 'R$ 890,00');
  assert.strictEqual(m[0].paraTexto, 'R$ 950,00');
});

// ---------------------------------------------------------------------------
// A DECISAO: GRAVAR, PERGUNTAR OU NAO FAZER NADA
// ---------------------------------------------------------------------------

test('o texto da confirmacao e o que a dona pediu: item, campo, DE e PARA', () => {
  const d = decidirGravacao('Kay bateria 60V', [
    { campo: 'preco', rotulo: 'preço', tipo: 'moeda', de: 890, para: 950 }
  ], { escopo: 'Isso vale para todo mundo.' });

  assert.strictEqual(d.gravar, true);
  assert.strictEqual(d.confirmar, true);
  assert.strictEqual(
    d.texto,
    'Kay bateria 60V: preço R$ 890,00 → R$ 950,00. Isso vale para todo mundo. Confirmar?'
  );
});

test('duas mudancas de uma vez aparecem as duas — nenhuma escondida', () => {
  const d = decidirGravacao('Kay bateria 60V', [
    { campo: 'preco', rotulo: 'preço', tipo: 'moeda', de: 890, para: 950 },
    { campo: 'peso', rotulo: 'peso', tipo: 'texto', de: '1,60kg', para: '1,80kg' }
  ], { escopo: 'Isso vale para todo mundo.' });

  assert.strictEqual(
    d.texto,
    'Kay bateria 60V: preço R$ 890,00 → R$ 950,00; peso 1,60kg → 1,80kg. ' +
    'Isso vale para todo mundo. Confirmar?'
  );
});

test('valor novo IGUAL ao antigo: nao pergunta, nao grava, e diz que nada mudou', () => {
  const d = decidirGravacao('Kay bateria 60V', [
    { campo: 'preco', rotulo: 'preço', tipo: 'moeda', de: 890, para: '890,00' },
    { campo: 'peso', rotulo: 'peso', tipo: 'texto', de: '1,60kg', para: ' 1,60kg ' }
  ], { escopo: 'Isso vale para todo mundo.' });

  assert.strictEqual(d.gravar, false);
  assert.strictEqual(d.confirmar, false);
  assert.strictEqual(d.texto, '');
  assert.strictEqual(d.mensagem, mensagemNadaMudou('Kay bateria 60V'));
  assert.match(d.mensagem, /Nada mudou/);
});

test('mudanca que nao e de valor (nome, imagem, modelo a mais) grava SEM perguntar', () => {
  // Perguntar "de/para" aqui seria inventar uma pergunta que nao existe; nao
  // gravar seria descartar em silencio o que a pessoa fez.
  const d = decidirGravacao('Kay bateria 60V', [
    { campo: 'preco', rotulo: 'preço', tipo: 'moeda', de: 890, para: 890 }
  ], { outrasMudancas: true });

  assert.strictEqual(d.gravar, true);
  assert.strictEqual(d.confirmar, false);
  assert.strictEqual(d.texto, '');
});

test('remocao de modelo continua sendo perguntada, mesmo sem mudanca de valor', () => {
  const d = decidirGravacao('Kay bateria 60V', [
    { campo: 'preco', rotulo: 'preço', tipo: 'moeda', de: 890, para: 890 }
  ], { avisos: [avisoRemocaoModelos(['Jaya', 'Shaka'])] });

  assert.strictEqual(d.gravar, true);
  assert.strictEqual(d.confirmar, true);
  assert.strictEqual(
    d.texto,
    'Kay bateria 60V: A peça será REMOVIDA de 2 modelo(s): Jaya, Shaka. Confirmar?'
  );
});

test('o escopo diz em QUANTOS e em QUAIS modelos aquilo vale', () => {
  assert.strictEqual(escopoModelos(['Kay']), 'Isso vale para todo mundo — a peça está em Kay.');
  assert.strictEqual(
    escopoModelos(['Kay', 'Jaya', 'Shaka']),
    'Isso vale para todo mundo — a peça está em 3 modelos: Kay, Jaya, Shaka.'
  );
  // Repetido nao conta duas vezes; lista vazia cai na frase generica.
  assert.strictEqual(escopoModelos(['Kay', 'Kay']), 'Isso vale para todo mundo — a peça está em Kay.');
  assert.strictEqual(escopoModelos([]), 'Isso vale para todo mundo.');
});

test('SALDO: 3 -> 5 pergunta com o de/para; 3 -> 3 nao faz nada', () => {
  const muda = decidirGravacao('Kay — bateria 60V', [
    { campo: 'sumare', rotulo: 'saldo em Sumaré', tipo: 'inteiro', de: 3, para: 5 }
  ], { escopo: ESCOPO_SALDO });
  assert.strictEqual(muda.confirmar, true);
  assert.strictEqual(
    muda.texto,
    'Kay — bateria 60V: saldo em Sumaré 3 → 5. É o saldo que todas as telas leem. Confirmar?'
  );

  const igual = decidirGravacao('Kay — bateria 60V', [
    { campo: 'sumare', rotulo: 'saldo em Sumaré', tipo: 'inteiro', de: 3, para: '3' }
  ], { escopo: ESCOPO_SALDO });
  assert.strictEqual(igual.gravar, false);
  assert.match(igual.mensagem, /Nada mudou/);
});

test('SALDO: zerar um saldo que ja era zero nao vira POST', () => {
  const d = decidirGravacao('Kay — bateria 60V', [
    { campo: 'jaragua', rotulo: 'saldo em Jaraguá', tipo: 'inteiro', de: 0, para: 0 }
  ], { escopo: ESCOPO_SALDO });
  assert.strictEqual(d.gravar, false);
});

test('SALDO: zerar um saldo que tinha peca E uma alteracao (pergunta)', () => {
  const d = decidirGravacao('Kay — bateria 60V', [
    { campo: 'jaragua', rotulo: 'saldo em Jaraguá', tipo: 'inteiro', de: 7, para: 0 }
  ], { escopo: ESCOPO_SALDO });
  assert.strictEqual(d.confirmar, true);
  assert.match(d.texto, /saldo em Jaraguá 7 → 0/);
});

// ===========================================================================
// O FIO RODANDO DE VERDADE: saveAdminPart (o lapis do cartao no catalogo)
// ===========================================================================
// A funcao e extraida da FONTE de admin.js e avaliada com document, fetch e
// modal falsos injetados como parametros — mesma tecnica de
// tests/status-os.test.js e tests/vinculo-atendimento.test.js. O que roda e o
// codigo que vai para o navegador, e as assercoes sao sobre o que FOI GRAVADO
// (as chamadas de savePartToSheets), nao sobre a presenca de texto no arquivo.

const ADMIN = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8').replace(/\r/g, '');
const LIB = require('../lib/confirmacao-alteracao.js');

function corpoFuncao(fonte, nome) {
  const ini = fonte.indexOf('function ' + nome + '(');
  assert.notStrictEqual(ini, -1, 'nao achei function ' + nome + ' em admin.js');
  const fim = fonte.indexOf('\n}', ini);
  assert.notStrictEqual(fim, -1, 'nao achei o fim de ' + nome);
  return fonte.slice(ini, fim + 2);
}

// Corte de funcao aninhada (indentada): usado para o saldo, que mora dentro do
// tbody.onclick de renderEstoqueTable.
function corpoIndentado(fonte, nome, espacos) {
  const pad = new Array(espacos + 1).join(' ');
  const ini = fonte.indexOf(pad + 'function ' + nome + '(');
  assert.notStrictEqual(ini, -1, 'nao achei function ' + nome + ' com ' + espacos + ' espacos');
  const fim = fonte.indexOf('\n' + pad + '}', ini);
  assert.notStrictEqual(fim, -1, 'nao achei o fim de ' + nome);
  return fonte.slice(ini, fim + pad.length + 2);
}

// Espera as promessas internas (imagem -> confirmacao -> gravacao) assentarem.
function assentar() {
  return new Promise((r) => setTimeout(r, 0));
}

// Tira os comentarios antes de procurar por CODIGO. Sem isto, um comentario que
// explica "aqui NAO tem mais confirm() nativo" derruba o teste que verifica
// justamente que nao ha confirm() nativo.
function semComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function montarAmbiente(opcoes) {
  const registro = {
    salvos: [],          // toda chamada de savePartToSheets
    feedback: [],        // [msg, tipo]
    perguntas: [],       // textos mostrados no modal de confirmacao
    modalFechado: false
  };

  const campos = {
    'admin-peca-nome': { value: opcoes.nome },
    'admin-peca-preco': { value: opcoes.preco },
    'admin-peca-peso': { value: opcoes.peso },
    'admin-peca-img': { files: null },
    'admin-modal-save': { disabled: false, textContent: '' },
    'modal-admin': { style: { display: 'flex' } }
  };

  const doc = {
    getElementById: (id) => campos[id] || null,
    querySelectorAll: () => opcoes.modelosMarcados.map((mid) => ({ value: mid }))
  };
  // O fechamento do formulario e observavel: cancelar nao pode fechar.
  Object.defineProperty(campos['modal-admin'].style, 'display', {
    get() { return this._v || 'flex'; },
    set(v) { this._v = v; if (v === 'none') registro.modalFechado = true; }
  });

  const catalogo = {
    kay: { nome: 'Kay', pecas: [{ nome: 'bateria 60V', preco: 890, peso: '1,60kg', img: 'img/kay/b.jpeg' }] },
    jaya: { nome: 'Jaya', pecas: [{ nome: 'bateria 60V', preco: 890, peso: '1,60kg', img: 'img/jaya/b.jpeg' }] },
    shaka: { nome: 'Shaka', pecas: [] }
  };

  const saveAdminPart = new Function(
    'document', 'parseMoeda', 'mostrarFeedback', 'CATALOGO_MODELOS', 'savePartToSheets',
    'refreshAdminTable', 'confirmarAlteracao', 'decidirGravacao', 'escopoModelos',
    'avisoRemocaoModelos',
    corpoFuncao(ADMIN, 'saveAdminPart') + '\nreturn saveAdminPart;'
  )(
    doc,
    (s) => (s ? parseFloat(String(s).replace(/\./g, '').replace(',', '.')) : NaN),
    (msg, tipo) => registro.feedback.push([msg, tipo]),
    catalogo,
    (acao, mid, idx, peca) => {
      registro.salvos.push({ acao: acao, mid: mid, nome: peca.nome, preco: peca.preco, peso: peca.peso });
      return Promise.resolve({ sucesso: true });
    },
    () => {},
    (texto) => { registro.perguntas.push(texto); return Promise.resolve(opcoes.resposta); },
    // semLib simula lib/confirmacao-alteracao.js nao ter carregado (404 no meio
    // de um deploy): as tres funcoes viram undefined, como no navegador.
    opcoes.semLib ? undefined : LIB.decidirGravacao,
    opcoes.semLib ? undefined : LIB.escopoModelos,
    opcoes.semLib ? undefined : LIB.avisoRemocaoModelos
  );

  return { saveAdminPart, registro, catalogo };
}

test('PRECO: confirmar grava o valor novo em TODOS os modelos da peca', async () => {
  const amb = montarAmbiente({
    nome: 'bateria 60V', preco: '950,00', peso: '1,60kg',
    modelosMarcados: ['kay', 'jaya'], resposta: true
  });

  amb.saveAdminPart(true, 'kay', 0);
  await assentar();

  assert.strictEqual(amb.registro.perguntas.length, 1, 'tinha que perguntar antes de gravar');
  assert.strictEqual(amb.registro.salvos.length, 2, 'a peca esta em 2 modelos, sao 2 gravacoes');
  amb.registro.salvos.forEach((s) => {
    assert.strictEqual(s.acao, 'editar');
    assert.strictEqual(s.preco, 950);
  });
  assert.strictEqual(amb.catalogo.kay.pecas[0].preco, 950);
  assert.strictEqual(amb.catalogo.jaya.pecas[0].preco, 950);
  assert.strictEqual(amb.registro.modalFechado, true, 'depois de gravar o formulario fecha');
});

test('PRECO: a pergunta traz de/para e a quem afeta, no texto que ela le', async () => {
  const amb = montarAmbiente({
    nome: 'bateria 60V', preco: '950,00', peso: '1,60kg',
    modelosMarcados: ['kay', 'jaya'], resposta: true
  });

  amb.saveAdminPart(true, 'kay', 0);
  await assentar();

  assert.strictEqual(
    amb.registro.perguntas[0],
    'Kay bateria 60V: preço R$ 890,00 → R$ 950,00. ' +
    'Isso vale para todo mundo — a peça está em 2 modelos: Kay, Jaya. Confirmar?'
  );
});

test('PRECO: CANCELAR nao grava nada, nao mexe na memoria e nao fecha o formulario', async () => {
  const amb = montarAmbiente({
    nome: 'bateria 60V', preco: '950,00', peso: '1,60kg',
    modelosMarcados: ['kay', 'jaya'], resposta: false
  });

  amb.saveAdminPart(true, 'kay', 0);
  await assentar();

  assert.strictEqual(amb.registro.perguntas.length, 1);
  assert.deepStrictEqual(amb.registro.salvos, [], 'cancelou e mesmo assim gravou');
  assert.strictEqual(amb.catalogo.kay.pecas[0].preco, 890, 'o preco em memoria nao pode mudar');
  assert.strictEqual(amb.catalogo.jaya.pecas[0].preco, 890);
  assert.strictEqual(amb.registro.modalFechado, false, 'cancelar tem que devolver o formulario aberto');
});

test('PRECO: salvar sem mudar nada nao pergunta, nao grava e avisa', async () => {
  const amb = montarAmbiente({
    nome: 'bateria 60V', preco: '890,00', peso: '1,60kg',
    modelosMarcados: ['kay', 'jaya'], resposta: true
  });

  amb.saveAdminPart(true, 'kay', 0);
  await assentar();

  assert.deepStrictEqual(amb.registro.perguntas, [], 'nao ha o que confirmar');
  assert.deepStrictEqual(amb.registro.salvos, [], 'nao ha o que gravar');
  assert.strictEqual(amb.registro.modalFechado, false);
  assert.match(amb.registro.feedback.map((f) => f[0]).join(' | '), /Nada mudou/);
});

test('PRECO: trocar so o NOME grava direto, sem pergunta de de/para', async () => {
  const amb = montarAmbiente({
    nome: 'bateria 60V (nova)', preco: '890,00', peso: '1,60kg',
    modelosMarcados: ['kay', 'jaya'], resposta: false // se perguntasse, o "nao" apareceria
  });

  amb.saveAdminPart(true, 'kay', 0);
  await assentar();

  assert.deepStrictEqual(amb.registro.perguntas, []);
  assert.strictEqual(amb.registro.salvos.length, 2);
  assert.strictEqual(amb.registro.salvos[0].nome, 'bateria 60V (nova)');
});

test('REMOCAO: desmarcar um modelo pergunta no MESMO modal e cancelar nao remove', async () => {
  const amb = montarAmbiente({
    nome: 'bateria 60V', preco: '890,00', peso: '1,60kg',
    modelosMarcados: ['kay'], resposta: false
  });

  amb.saveAdminPart(true, 'kay', 0);
  await assentar();

  assert.strictEqual(amb.registro.perguntas.length, 1);
  assert.match(amb.registro.perguntas[0], /REMOVIDA de 1 modelo\(s\): Jaya/);
  assert.deepStrictEqual(amb.registro.salvos, [], 'cancelou e a remocao aconteceu assim mesmo');
  assert.strictEqual(amb.catalogo.jaya.pecas.length, 1, 'a peca sumiu de Jaya sem confirmacao');
});

test('REMOCAO: confirmando, a remocao acontece junto com o resto', async () => {
  const amb = montarAmbiente({
    nome: 'bateria 60V', preco: '890,00', peso: '1,60kg',
    modelosMarcados: ['kay'], resposta: true
  });

  amb.saveAdminPart(true, 'kay', 0);
  await assentar();

  const acoes = amb.registro.salvos.map((s) => s.acao + ':' + s.mid);
  assert.ok(acoes.indexOf('excluir:jaya') !== -1, 'a remocao confirmada nao foi para a planilha');
  assert.strictEqual(amb.catalogo.jaya.pecas.length, 0);
});

test('SEM A LIB: a edicao de preco continua funcionando (falha aberto)', async () => {
  // Mesma regra do resto do app (assistencia.js): arquivo que nao baixou nao
  // pode deixar a equipe sem conseguir corrigir um preco no meio do expediente.
  const amb = montarAmbiente({
    nome: 'bateria 60V', preco: '950,00', peso: '1,60kg',
    modelosMarcados: ['kay', 'jaya'], resposta: true, semLib: true
  });

  amb.saveAdminPart(true, 'kay', 0);
  await assentar();

  assert.deepStrictEqual(amb.registro.perguntas, [], 'sem lib nao ha de/para para perguntar');
  assert.strictEqual(amb.registro.salvos.length, 2);
  assert.strictEqual(amb.catalogo.kay.pecas[0].preco, 950);
});

test('SEM A LIB: a remocao de modelo AINDA pergunta (o aviso ja existia antes)', async () => {
  const amb = montarAmbiente({
    nome: 'bateria 60V', preco: '890,00', peso: '1,60kg',
    modelosMarcados: ['kay'], resposta: false, semLib: true
  });

  amb.saveAdminPart(true, 'kay', 0);
  await assentar();

  assert.strictEqual(amb.registro.perguntas.length, 1, 'peca sumiria de um modelo sem perguntar');
  assert.match(amb.registro.perguntas[0], /REMOVIDA de 1 modelo\(s\): Jaya/);
  assert.deepStrictEqual(amb.registro.salvos, []);
  assert.strictEqual(amb.catalogo.jaya.pecas.length, 1);
});

test('o lapis do catalogo nao usa mais confirm()/alert() nativos', () => {
  // Dialogo nativo trava a automacao e nao da para ler de fora. A confirmacao
  // desta tela e um .modal-overlay como o resto do app.
  const corpo = semComentarios(corpoFuncao(ADMIN, 'saveAdminPart'));
  assert.strictEqual(/[^.\w]confirm\(/.test(corpo), false, 'sobrou confirm() nativo em saveAdminPart');
  assert.strictEqual(/[^.\w]alert\(/.test(corpo), false, 'sobrou alert() nativo em saveAdminPart');
  assert.match(corpo, /confirmarAlteracao\(/, 'a confirmacao tem que passar pelo modal do app');
});

// ===========================================================================
// O FIO DO SALDO: saveValue (clique no numero do estoque, no Admin)
// ===========================================================================

function montarSaldo(opcoes) {
  const registro = { salvos: [], feedback: [], perguntas: [], pintado: [] };
  const adminEstoque = [{
    modelo: 'kay', modeloNome: 'Kay', peca: 'bateria 60V', sumare: 3, jaragua: 0
  }];
  const cell = {
    textContent: '',
    classList: { toggle: () => {} }
  };
  const fabrica = new Function(
    'input', 'cell', 'currentVal', 'idx', 'field', 'adminEstoque', 'decidirGravacao',
    'ESCOPO_SALDO', 'confirmarAlteracao', 'salvarEstoqueItem', 'mostrarFeedback',
    'var tratado = false;\n' +
    corpoIndentado(ADMIN, 'pintarCelula', 4) + '\n' +
    corpoIndentado(ADMIN, 'saveValue', 4) + '\n' +
    'return saveValue;'
  )(
    { value: opcoes.digitado },
    cell,
    3,                       // valor que estava na celula
    0,
    'sumare',
    adminEstoque,
    LIB.decidirGravacao,
    LIB.ESCOPO_SALDO,
    (texto) => { registro.perguntas.push(texto); return Promise.resolve(opcoes.resposta); },
    (item) => registro.salvos.push({ modelo: item.modelo, peca: item.peca, sumare: item.sumare }),
    (msg, tipo) => registro.feedback.push([msg, tipo])
  );
  return { saveValue: fabrica, registro, adminEstoque, cell };
}

test('SALDO: confirmar grava o numero novo', async () => {
  const s = montarSaldo({ digitado: '5', resposta: true });
  s.saveValue();
  await assentar();

  assert.strictEqual(s.registro.perguntas.length, 1);
  assert.match(s.registro.perguntas[0], /Kay — bateria 60V: saldo em Sumaré 3 → 5\./);
  assert.deepStrictEqual(s.registro.salvos, [{ modelo: 'kay', peca: 'bateria 60V', sumare: 5 }]);
  assert.strictEqual(s.adminEstoque[0].sumare, 5);
});

test('SALDO: CANCELAR nao grava e a celula volta para o numero antigo', async () => {
  const s = montarSaldo({ digitado: '5', resposta: false });
  s.saveValue();
  await assentar();

  assert.deepStrictEqual(s.registro.salvos, [], 'cancelou e o estoque foi gravado assim mesmo');
  assert.strictEqual(s.adminEstoque[0].sumare, 3, 'o saldo em memoria nao pode mudar');
  assert.strictEqual(s.cell.textContent, 3, 'a celula ficou mostrando um numero que nao foi gravado');
});

test('SALDO: digitar o mesmo numero nao pergunta e nao manda POST', async () => {
  const s = montarSaldo({ digitado: '3', resposta: true });
  s.saveValue();
  await assentar();

  assert.deepStrictEqual(s.registro.perguntas, []);
  assert.deepStrictEqual(s.registro.salvos, []);
  assert.match(s.registro.feedback.map((f) => f[0]).join(' | '), /Nada mudou/);
});

test('SALDO: o blur repetido nao pergunta duas vezes pela mesma edicao', async () => {
  const s = montarSaldo({ digitado: '5', resposta: true });
  s.saveValue();
  s.saveValue();
  await assentar();

  assert.strictEqual(s.registro.perguntas.length, 1);
  assert.strictEqual(s.registro.salvos.length, 1);
});

test('SALDO: Escape cancela ANTES do blur poder gravar', () => {
  // O Escape removia o input do DOM, o que dispara blur, e o blur gravava o
  // valor digitado: o Escape nunca cancelou de verdade nesta tela. A ordem
  // (marcar tratado antes de repintar) e o que conserta.
  // Ancorado na tabela de ESTOQUE: 'tbody.onclick' sozinho pega antes a tabela
  // de pecas do Admin.
  const tabela = ADMIN.slice(ADMIN.indexOf('function renderEstoqueTable'),
    ADMIN.indexOf('// --- Save stock item to Sheets ---'));
  const escape = tabela.slice(tabela.indexOf("ev.key === 'Escape'"));
  const posTratado = escape.indexOf('tratado = true');
  const posPintar = escape.indexOf('pintarCelula(');
  assert.notStrictEqual(posTratado, -1, 'o Escape nao marca a edicao como tratada');
  assert.ok(posTratado < posPintar, 'tratado tem que ser marcado ANTES de tirar o input do DOM');
});

test('o clique no saldo nao usa confirm()/alert() nativos', () => {
  const corpo = semComentarios(corpoIndentado(ADMIN, 'saveValue', 4));
  assert.strictEqual(/[^.\w]confirm\(/.test(corpo), false);
  assert.strictEqual(/[^.\w]alert\(/.test(corpo), false);
  assert.match(corpo, /confirmarAlteracao\(/);
  assert.match(corpo, /decidirGravacao\(/);
});

// ===========================================================================
// "MIGRAR PENDENTES" APOSENTADO (28/07)
// ===========================================================================

const GAS = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8').replace(/\r/g, '');
const AT_LISTA = fs.readFileSync(path.join(__dirname, '..', 'atendimentos-lista.js'), 'utf8').replace(/\r/g, '');

test('o roteador NAO chama mais migrarPendentesParaAtendimentos', () => {
  // A unica ocorrencia com parenteses tem que ser a propria declaracao. Se
  // alguem reintroduzir a chamada no doPost/doGet, este teste cai.
  const chamadas = GAS.match(/migrarPendentesParaAtendimentos\(/g) || [];
  assert.strictEqual(chamadas.length, 1, 'apareceu chamada de migrarPendentesParaAtendimentos');
  assert.match(GAS, /function migrarPendentesParaAtendimentos\(/,
    'a funcao tem que continuar no arquivo, como registro do que estava errado');
});

test('o case do roteador devolve recusa explicita (o front velho em cache clica nele)', () => {
  const ini = GAS.indexOf("case 'migrar_pendentes_para_atendimentos':");
  assert.notStrictEqual(ini, -1, 'o case sumiu — clique de front velho viraria "acao desconhecida"');
  const trecho = GAS.slice(ini, ini + 900);
  assert.match(trecho, /sucesso:\s*false/, 'a recusa tem que dizer que nao gravou');
  assert.match(trecho, /aposentada:\s*true/);
  assert.match(trecho, /28\/07/, 'a recusa tem que datar a decisao');
  assert.strictEqual(/migrarPendentesParaAtendimentos\(/.test(trecho), false);
});

test('a funcao aposentada guarda POR QUE estava quebrada', () => {
  const ini = GAS.indexOf('APOSENTADA EM 28/07/2026');
  assert.notStrictEqual(ini, -1);
  const doc = GAS.slice(ini, GAS.indexOf('function migrarPendentesParaAtendimentos('));
  // Os tres erros medidos na fonte antes de aposentar.
  assert.match(doc, /atendimentoId/, 'o erro do indexOf -1 nas OS precisa estar registrado');
  assert.match(doc, /getOrcamentosSheet/, 'o erro da planilha errada precisa estar registrado');
  assert.match(doc, /sensivel a caixa/, 'o erro do cabecalho em minusculas precisa estar registrado');
});

test('o botao "Migrar pendentes" saiu do front, com listener e fetch juntos', () => {
  // Sem comentarios: o arquivo GUARDA a explicacao do que foi aposentado (e
  // cita a action pelo nome), o que nao pode ser confundido com o codigo vivo.
  const codigo = semComentarios(AT_LISTA);
  assert.strictEqual(/alBtnMigrar/.test(codigo), false, 'o botao ainda esta na tela');
  assert.strictEqual(/Migrar pendentes/.test(codigo), false, 'o rotulo do botao ainda e gerado');
  assert.strictEqual(/migrar_pendentes_para_atendimentos/.test(codigo), false,
    'o front ainda dispara a action aposentada');
  assert.strictEqual(/function migrarPendentes\(/.test(codigo), false);
  // E o registro do porque nao pode sumir junto.
  assert.match(AT_LISTA, /APOSENTADO em 28\/07/);
  // O resto da barra de filtros continua de pe.
  ['alBtnAplicar', 'alBtnLimpar', 'alBtnRefresh'].forEach((id) => {
    assert.match(AT_LISTA, new RegExp(id), id + ' sumiu junto sem querer');
  });
});

// ===========================================================================
// CACHE: index.html
// ===========================================================================

test('index.html carrega a lib nova e nao sobrou nenhuma tag na versao velha', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /lib\/confirmacao-alteracao\.js\?v=2\.41/,
    'sem esta tag o front cai no fallback e grava sem perguntar');
  assert.strictEqual((html.match(/v=2\.40/g) || []).length, 0, 'sobrou tag em 2.40');
  assert.strictEqual((html.match(/v=2\.41/g) || []).length, 19);
});
