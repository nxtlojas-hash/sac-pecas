const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const lib = require('../lib/gravacao-peca.js');
const { enderecoSoLocal, imgParaGravar, faltaNaPlanilha, trocouDeNome, recusaTrocaDeNome, avisoDaGravacao } = lib;

const ADMIN = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8').replace(/\r/g, '');

// A resposta REAL do servidor, colhida em 29/09/2026 editando o "Assoalho" do Kay.
const RECUSA_REAL = { sucesso: false, erro: 'Peca nao encontrada para editar: assoalho (modelo kay)', imagemUrl: '' };
const DRIVE = 'https://drive.google.com/thumbnail?id=abc&sz=w400';

function corpoFuncao(nome) {
  const ini = ADMIN.indexOf('function ' + nome + '(');
  assert.notStrictEqual(ini, -1, 'nao achei function ' + nome + ' em admin.js');
  const fim = ADMIN.indexOf('\n}', ini);
  return ADMIN.slice(ini, fim + 2);
}
function assentar() { return new Promise((r) => setTimeout(r, 0)); }

// ===========================================================================
// As regras da lib
// ===========================================================================

test('endereco que so existe no navegador e reconhecido', () => {
  assert.strictEqual(enderecoSoLocal('blob:https://nxtlojas-hash.github.io/1f2e'), true);
  assert.strictEqual(enderecoSoLocal('data:image/jpeg;base64,AAAA'), true);
  assert.strictEqual(enderecoSoLocal(DRIVE), false);
  assert.strictEqual(enderecoSoLocal('img/kay/Banco 1,60kg.jpeg'), false);
  assert.strictEqual(enderecoSoLocal(''), false);
  assert.strictEqual(enderecoSoLocal(null), false);
});

test('previa local nunca vai para a planilha: vale a imagem que a peca tinha', () => {
  assert.strictEqual(imgParaGravar('blob:https://x/1', 'img/kay/Banco 1,60kg.jpeg'), 'img/kay/Banco 1,60kg.jpeg');
  assert.strictEqual(imgParaGravar('blob:https://x/1', ''), '');
  assert.strictEqual(imgParaGravar('blob:https://x/1', undefined), '');
  assert.strictEqual(imgParaGravar('blob:https://x/1', 'blob:https://x/0'), '');
});

test('imagem de verdade passa sem mexer', () => {
  assert.strictEqual(imgParaGravar('img/kay/Banco 1,60kg.jpeg', 'outra'), 'img/kay/Banco 1,60kg.jpeg');
  assert.strictEqual(imgParaGravar(DRIVE, ''), DRIVE);
  assert.strictEqual(imgParaGravar('', 'img/kay/Banco 1,60kg.jpeg'), '');
});

test('a recusa real do servidor e lida como "falta na planilha"', () => {
  assert.strictEqual(faltaNaPlanilha('editar', RECUSA_REAL), true);
});

test('so o editar cai no cadastro; outro erro e outra acao nao', () => {
  assert.strictEqual(faltaNaPlanilha('adicionar', RECUSA_REAL), false);
  assert.strictEqual(faltaNaPlanilha('excluir', RECUSA_REAL), false);
  assert.strictEqual(faltaNaPlanilha('editar', { sucesso: false, erro: 'JSON invalido' }), false);
  assert.strictEqual(faltaNaPlanilha('editar', { sucesso: true, mensagem: 'Peca atualizada: Assoalho' }), false);
  assert.strictEqual(faltaNaPlanilha('editar', null), false);
});

test('troca de nome: so quando o nome muda de verdade', () => {
  assert.strictEqual(trocouDeNome('Assoalho', 'Assoalho'), false);
  assert.strictEqual(trocouDeNome('assoalho ', 'Assoalho'), false, 'caixa e espaco nao sao troca');
  assert.strictEqual(trocouDeNome('Assoalho central', 'Assoalho'), true);
  assert.strictEqual(trocouDeNome('Assoalho', ''), false, 'sem nome original (peca nova) nao ha troca');
  assert.strictEqual(trocouDeNome('Assoalho', undefined), false);
  assert.match(recusaTrocaDeNome('Assoalho'), /"Assoalho"/);
});

test('sem resposta do servidor NAO e sucesso, e manda conferir antes de repetir', () => {
  assert.match(avisoDaGravacao(null, false), /CONFIRA/);
  assert.match(avisoDaGravacao(undefined, true), /não respondeu/);
});

test('recusa do servidor aparece com o motivo', () => {
  assert.match(avisoDaGravacao({ sucesso: false, erro: 'Acao de peca desconhecida: x' }, false), /Acao de peca desconhecida/);
});

test('peca gravada sem a foto que foi enviada: avisa', () => {
  assert.match(avisoDaGravacao({ sucesso: true, imagemUrl: '' }, true), /FOTO não foi guardada/);
});

test('deu certo = aviso vazio', () => {
  assert.strictEqual(avisoDaGravacao({ sucesso: true, imagemUrl: DRIVE }, true), '');
  assert.strictEqual(avisoDaGravacao({ sucesso: true, imagemUrl: '' }, false), '');
});

// O texto da recusa mora no servidor. Se alguem mudar a frase la, o cadastro
// automatico para de funcionar em silencio — este teste fica vermelho antes.
test('a frase da recusa no servidor e a que a lib procura', () => {
  const gs = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8');
  assert.match(gs, /erro: 'Peca nao encontrada para editar: '/);
});

test('index.html carrega a lib antes do admin.js', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const tag = html.indexOf('lib/gravacao-peca.js?v=');
  assert.ok(tag > 0, 'sem a tag, a tela volta a mostrar o erro antigo');
  assert.ok(tag < html.indexOf('admin.js?v='), 'a lib tem de vir antes de quem usa');
});

// ===========================================================================
// savePartToSheets de verdade (admin.js), com fetch de mentira
// ===========================================================================

function montarSave(respostas) {
  // respostas: lista de respostas do servidor, na ordem; string = texto cru (nao-JSON)
  const pedidos = [];
  const fetchFalso = (url, opcoes) => {
    pedidos.push(JSON.parse(opcoes.body));
    const r = respostas.shift();
    const texto = typeof r === 'string' ? r : JSON.stringify(r);
    return Promise.resolve({ text: () => Promise.resolve(texto) });
  };
  const save = new Function(
    'GOOGLE_SCRIPT_URL', 'CATALOGO_MODELOS', 'fetch', 'console',
    'imgParaGravar', 'faltaNaPlanilha', 'trocouDeNome', 'recusaTrocaDeNome',
    corpoFuncao('savePartToSheets') + '\nreturn savePartToSheets;'
  )('https://script.example/exec', { kay: { nome: 'Kay', pecas: [] } }, fetchFalso, { log() {}, warn() {}, error() {} },
    lib.imgParaGravar, lib.faltaNaPlanilha, lib.trocouDeNome, lib.recusaTrocaDeNome);
  return { save, pedidos };
}

test('editar recusado (peca so em data.js) vira cadastro, com a foto ja guardada e sem reenviar', async () => {
  const { save, pedidos } = montarSave([
    { sucesso: false, erro: 'Peca nao encontrada para editar: assoalho (modelo kay)', imagemUrl: DRIVE },
    { sucesso: true, mensagem: 'Peca adicionada: Assoalho', imagemUrl: '' }
  ]);
  const r = await save('editar', 'kay', 3, { nome: 'Assoalho', preco: 90, peso: '1kg', img: 'blob:https://x/previa' }, 'data:image/jpeg;base64,AAAA', 'foto.jpg', 'Assoalho', '');
  assert.strictEqual(pedidos.length, 2);
  assert.strictEqual(pedidos[0].acao, 'editar');
  assert.strictEqual(pedidos[0].img, '', 'a previa local nao vai para a planilha');
  assert.strictEqual(pedidos[0].imagemBase64, 'data:image/jpeg;base64,AAAA');
  assert.strictEqual(pedidos[1].acao, 'adicionar');
  assert.strictEqual(pedidos[1].img, DRIVE, 'o cadastro leva a foto que o servidor ja guardou');
  assert.strictEqual(pedidos[1].imagemBase64, undefined, 'a foto nao sobe duas vezes');
  assert.strictEqual(pedidos[1].nomeOriginal, undefined);
  assert.deepStrictEqual([r.sucesso, r.imagemUrl, r.cadastradaNaPlanilha], [true, DRIVE, true]);
});

test('editar recusado SEM foto: cadastra com a imagem que a peca tinha', async () => {
  const { save, pedidos } = montarSave([RECUSA_REAL, { sucesso: true, imagemUrl: '' }]);
  const r = await save('editar', 'kay', 3, { nome: 'Assoalho', preco: 95, peso: null, img: 'img/kay/Assoalho.jpeg' }, null, null, 'Assoalho');
  assert.strictEqual(pedidos[1].img, 'img/kay/Assoalho.jpeg');
  assert.strictEqual(pedidos[1].preco, 95);
  assert.strictEqual(r.sucesso, true);
  assert.strictEqual(r.imagemUrl, '');
});

test('troca de nome em peca so de data.js: NAO cadastra (senao a peca aparece duas vezes)', async () => {
  const { save, pedidos } = montarSave([
    { sucesso: false, erro: 'Peca nao encontrada para editar: assoalho (modelo kay)', imagemUrl: DRIVE }
  ]);
  const r = await save('editar', 'kay', 3, { nome: 'Assoalho central', preco: 90, peso: null, img: 'img/kay/Assoalho.jpeg' }, null, null, 'Assoalho');
  assert.strictEqual(pedidos.length, 1, 'nenhum segundo pedido');
  assert.strictEqual(r.sucesso, false);
  assert.strictEqual(r.trocaDeNomeRecusada, true);
  assert.match(r.erro, /"Assoalho"/);
  assert.match(avisoDaGravacao(r, false), /NÃO foi gravada/);
});

test('editar encontrado: um pedido so, sem cadastro', async () => {
  const { save, pedidos } = montarSave([{ sucesso: true, mensagem: 'Peca atualizada: Banco', imagemUrl: DRIVE }]);
  const r = await save('editar', 'kay', 0, { nome: 'Banco', preco: 100, peso: '1,60kg', img: 'blob:https://x/p' }, 'data:image/jpeg;base64,AAAA', 'b.jpg', 'Banco', 'img/kay/Banco 1,60kg.jpeg');
  assert.strictEqual(pedidos.length, 1);
  assert.strictEqual(pedidos[0].img, 'img/kay/Banco 1,60kg.jpeg');
  assert.strictEqual(r.imagemUrl, DRIVE);
  assert.strictEqual(r.cadastradaNaPlanilha, undefined);
});

test('outro erro do servidor nao vira cadastro; pagina de erro (nao-JSON) vira null', async () => {
  const a = montarSave([{ sucesso: false, erro: 'Acao de peca desconhecida: x' }]);
  const ra = await a.save('editar', 'kay', 0, { nome: 'Banco', img: '' }, null, null, 'Banco');
  assert.strictEqual(a.pedidos.length, 1);
  assert.strictEqual(ra.sucesso, false);
  const b = montarSave(['<html>Não foi possível abrir o arquivo</html>']);
  const rb = await b.save('adicionar', 'kay', 0, { nome: 'Banco', img: '' }, null, null);
  assert.strictEqual(rb, null);
});

// ===========================================================================
// saveAdminPart de verdade, com foto (o harness de confirmacao-alteracao
// nunca manda foto: aqui os tres fluxos com foto sao exercitados)
// ===========================================================================

function montarTela(opcoes) {
  const registro = { salvos: [], feedback: [], modalFechado: false };
  const arquivo = opcoes.foto ? { name: 'foto.jpg' } : null;
  const campos = {
    'admin-peca-nome': { value: opcoes.nome },
    'admin-peca-preco': { value: opcoes.preco || '' },
    'admin-peca-peso': { value: opcoes.peso || '' },
    'admin-peca-img': { files: arquivo ? [arquivo] : null },
    'admin-modal-save': { disabled: false, textContent: '' },
    'modal-admin': { style: { display: 'flex' } }
  };
  const doc = {
    getElementById: (id) => campos[id] || null,
    querySelectorAll: () => opcoes.modelosMarcados.map((mid) => ({ value: mid }))
  };
  const catalogo = {
    kay: { nome: 'Kay', pecas: [{ nome: 'Assoalho', preco: 80, peso: '1kg', img: 'img/kay/Assoalho.jpeg' }] },
    jaya: { nome: 'Jaya', pecas: [{ nome: 'Assoalho', preco: 80, peso: '1kg', img: 'img/jaya/Assoalho.jpeg' }] },
    shaka: { nome: 'Shaka', pecas: [] }
  };
  const respostas = opcoes.respostas.slice();
  const fonte =
    corpoFuncao('avisoAoGravarPeca') + '\n' + corpoFuncao('avisarFotoEmEnvio') + '\n' +
    corpoFuncao('fimDoEnvioDaFoto') + '\n' + corpoFuncao('avisarFimDaGravacao') + '\n' +
    corpoFuncao('ehNomeDoArquivoBase') + '\n' +
    // como no navegador: a lista dos nomes-base e tirada do data.js puro
    'ehNomeDoArquivoBase.lista = { kay: ["assoalho"], jaya: ["assoalho"] };\n' +
    corpoFuncao('saveAdminPart') + '\nreturn { saveAdminPart: saveAdminPart, avisarFotoEmEnvio: avisarFotoEmEnvio };';
  const tela = new Function(
    'document', 'parseMoeda', 'mostrarFeedback', 'CATALOGO_MODELOS', 'savePartToSheets', 'refreshAdminTable',
    'confirmarAlteracao', 'decidirGravacao', 'escopoModelos', 'avisoRemocaoModelos',
    'readFileAsBase64', 'URL', 'avisoDaGravacao', 'trocouDeNome',
    fonte
  )(
    doc,
    (s) => (s ? parseFloat(String(s).replace(/\./g, '').replace(',', '.')) : NaN),
    (msg, tipo, duracao) => registro.feedback.push([msg, tipo, duracao]),
    catalogo,
    (acao, mid, idx, peca, base64, nomeArq, nomeOriginal, imgAnterior) => {
      registro.salvos.push({ acao, mid, nome: peca.nome, img: peca.img, temFoto: !!base64, imgAnterior });
      const r = respostas.shift();
      return Promise.resolve(r === undefined ? { sucesso: true } : r);
    },
    () => {},
    () => Promise.resolve(true),
    undefined, undefined, undefined,                      // sem a lib de confirmacao: grava direto
    () => Promise.resolve('data:image/jpeg;base64,AAAA'),
    { createObjectURL: () => 'blob:https://x/previa' },
    lib.avisoDaGravacao,
    lib.trocouDeNome
  );
  return { tela, registro, catalogo };
}

test('TROCA DE NOME em peca do arquivo-base (mesmo ja com linha na planilha): recusada ANTES de ir ao servidor, formulario aberto', async () => {
  const t = montarTela({ nome: 'Assoalho central', preco: '90,00', peso: '1kg', foto: false, modelosMarcados: ['kay', 'jaya'], respostas: [] });
  await rodar(t, true, 'kay', 0);
  assert.strictEqual(t.registro.salvos.length, 0, 'nada foi ao servidor');
  assert.strictEqual(t.registro.modalFechado, false, 'o formulario fica aberto para corrigir');
  assert.strictEqual(t.catalogo.kay.pecas[0].nome, 'Assoalho');
  assert.match(t.registro.feedback[t.registro.feedback.length - 1][0], /arquivo-base/);
});

test('mudar so preco de peca do arquivo-base segue normal (caixa diferente nao e troca de nome)', async () => {
  const t = montarTela({ nome: 'assoalho', preco: '99,00', peso: '1kg', foto: false, modelosMarcados: ['kay', 'jaya'], respostas: [{ sucesso: true }, { sucesso: true }] });
  await rodar(t, true, 'kay', 0);
  assert.deepStrictEqual(t.registro.salvos.map((s) => s.acao + ':' + s.mid), ['editar:kay', 'editar:jaya']);
  assert.strictEqual(t.catalogo.kay.pecas[0].preco, 99);
  assert.strictEqual(t.catalogo.jaya.pecas[0].preco, 99);
});

async function rodar(t, isEdit, mid, idx) {
  t.tela.saveAdminPart(isEdit, mid, idx);
  for (let i = 0; i < 6; i++) await assentar();
}

test('FOTO GUARDADA: a peca fica com a foto do Drive e a tela diz "Foto guardada"', async () => {
  const t = montarTela({ nome: 'Assoalho', preco: '90,00', peso: '1kg', foto: true, modelosMarcados: ['kay'],
    respostas: [{ sucesso: true, imagemUrl: DRIVE, cadastradaNaPlanilha: true }] });
  await rodar(t, true, 'kay', 0);
  assert.strictEqual(t.registro.salvos[0].acao, 'editar');
  assert.strictEqual(t.registro.salvos[0].temFoto, true);
  assert.strictEqual(t.registro.salvos[0].imgAnterior, 'img/kay/Assoalho.jpeg', 'a imagem de antes vai junto, para o caso de a foto falhar');
  assert.strictEqual(t.catalogo.kay.pecas[0].img, DRIVE);
  assert.strictEqual(t.catalogo.kay.pecas[0].preco, 90);
  assert.ok(t.registro.feedback.some((f) => /Enviando a foto/.test(f[0])), 'avisa que a foto esta subindo');
  assert.match(t.registro.feedback[t.registro.feedback.length - 1][0], /Foto guardada/);
  assert.strictEqual(t.tela.avisarFotoEmEnvio.pendentes, 0, 'liberou o salvar');
});

test('FOTO NAO GUARDADA (peca gravada): volta a imagem de antes e avisa', async () => {
  const t = montarTela({ nome: 'Assoalho', preco: '90,00', peso: '1kg', foto: true, modelosMarcados: ['kay', 'jaya'],
    respostas: [{ sucesso: true, imagemUrl: '' }] });
  await rodar(t, true, 'kay', 0);
  assert.strictEqual(t.catalogo.kay.pecas[0].img, 'img/kay/Assoalho.jpeg', 'nao fica com a previa local');
  assert.strictEqual(t.catalogo.kay.pecas[0].preco, 90, 'o preco foi gravado, fica');
  const outro = t.registro.salvos.find((s) => s.mid === 'jaya');
  assert.ok(outro, 'o outro modelo e gravado');
  assert.ok(!/^blob:/.test(outro.img), 'e sem a previa local');
  assert.match(t.registro.feedback[t.registro.feedback.length - 1][0], /FOTO não foi guardada/);
});

test('SERVIDOR RECUSOU: a peca volta a ser o que era e os outros modelos NAO sao gravados', async () => {
  const t = montarTela({ nome: 'Assoalho', preco: '90,00', peso: '1kg', foto: true, modelosMarcados: ['kay', 'jaya'],
    respostas: [{ sucesso: false, erro: 'Acao de peca desconhecida: editar', imagemUrl: '' }] });
  await rodar(t, true, 'kay', 0);
  assert.strictEqual(t.registro.salvos.length, 1, 'so a ancora foi ao servidor');
  assert.deepStrictEqual(
    [t.catalogo.kay.pecas[0].nome, t.catalogo.kay.pecas[0].preco, t.catalogo.kay.pecas[0].img],
    ['Assoalho', 80, 'img/kay/Assoalho.jpeg'], 'a memoria nao mostra o que o servidor nao tem');
  assert.match(t.registro.feedback[t.registro.feedback.length - 1][0], /NÃO foi gravada: Acao de peca desconhecida/);
  assert.strictEqual(t.tela.avisarFotoEmEnvio.pendentes, 0);
});

test('PECA NOVA com foto em 2 modelos: a foto sobe uma vez e o 2o modelo recebe o endereco do Drive', async () => {
  const t = montarTela({ nome: 'Retrovisor', preco: '75,00', peso: '', foto: true, modelosMarcados: ['kay', 'shaka'],
    respostas: [{ sucesso: true, imagemUrl: DRIVE }, { sucesso: true }] });
  await rodar(t, false);
  assert.strictEqual(t.registro.salvos.length, 2);
  assert.strictEqual(t.registro.salvos[0].temFoto, true);
  assert.strictEqual(t.registro.salvos[1].temFoto, false);
  assert.strictEqual(t.registro.salvos[1].img, DRIVE);
  assert.strictEqual(t.catalogo.shaka.pecas[0].img, DRIVE);
  assert.match(t.registro.feedback[t.registro.feedback.length - 1][0], /Foto guardada/);
});

test('PECA NOVA: o 1o modelo falha (sem resposta) -> a peca sai da tela e o 2o modelo NAO e gravado', async () => {
  const t = montarTela({ nome: 'Retrovisor', preco: '75,00', peso: '', foto: true, modelosMarcados: ['kay', 'shaka'],
    respostas: [null] });
  await rodar(t, false);
  assert.strictEqual(t.registro.salvos.length, 1, 'nada foi para o 2o modelo (gravar la e pedir "salve de novo" duplicava)');
  assert.strictEqual(t.catalogo.kay.pecas.length, 1, 'a peca nova saiu da tela');
  assert.strictEqual(t.catalogo.shaka.pecas.length, 0);
  assert.match(t.registro.feedback[t.registro.feedback.length - 1][0], /não respondeu/);
  assert.strictEqual(t.tela.avisarFotoEmEnvio.pendentes, 0);
});

test('com uma foto subindo, salvar de novo e recusado ate a resposta chegar', async () => {
  // A resposta do servidor fica presa ate `responder` ser chamado (um "thenable").
  let responder;
  const pendente = new Promise((r) => { responder = r; });
  const t = montarTela({ nome: 'Assoalho', preco: '90,00', peso: '1kg', foto: true, modelosMarcados: ['kay'],
    respostas: [{ then: (ok) => pendente.then(ok) }] });
  t.tela.saveAdminPart(true, 'kay', 0);
  await assentar(); await assentar();
  assert.strictEqual(t.tela.avisarFotoEmEnvio.pendentes, 1, 'ha uma foto em envio');
  t.tela.saveAdminPart(true, 'kay', 0);
  assert.match(t.registro.feedback[t.registro.feedback.length - 1][0], /Aguarde/);
  assert.strictEqual(t.registro.salvos.length, 1, 'a segunda gravacao nao foi ao servidor');
  responder({ sucesso: true, imagemUrl: DRIVE });
  for (let i = 0; i < 6; i++) await assentar();
  assert.strictEqual(t.tela.avisarFotoEmEnvio.pendentes, 0);
  assert.strictEqual(t.catalogo.kay.pecas[0].img, DRIVE);
});
