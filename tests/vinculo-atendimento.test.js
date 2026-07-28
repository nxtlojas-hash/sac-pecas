const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  MSG_OS_SEM_ATENDIMENTO,
  MSG_OS_PROTOCOLO_INVALIDO,
  CONSULTA_NAO_FEITA,
  CONSULTA_EM_ANDAMENTO,
  CONSULTA_EXISTE,
  CONSULTA_NAO_EXISTE,
  CONSULTA_INDETERMINADA,
  mensagemAtendimentoInexistente,
  mensagemVinculoReal,
  mensagemAtendimentoCriado,
  normalizarProtocoloAtendimento,
  protocoloAtendimentoValido,
  decidirEnvioOS,
  decidirCriacaoAtendimento,
  contarSemVinculo
} = require('../lib/vinculo-atendimento.js');

// ---------------------------------------------------------------------------
// FORMATO DO PROTOCOLO (PV-YYYY-NNNN)
// ---------------------------------------------------------------------------

test('protocolo valido passa', () => {
  assert.strictEqual(protocoloAtendimentoValido('PV-2026-0123'), true);
  assert.strictEqual(protocoloAtendimentoValido('PV-2026-0001'), true);
});

test('protocolo valido continua valido com espaco em volta e em minuscula', () => {
  // A atendente digita na correria e cola de outro lugar. O backend acha o
  // atendimento por igualdade EXATA de string, entao normalizar antes de
  // validar e o que evita um vinculo que falha em silencio.
  assert.strictEqual(protocoloAtendimentoValido('  pv-2026-0123  '), true);
  assert.strictEqual(normalizarProtocoloAtendimento('  pv-2026-0123  '), 'PV-2026-0123');
});

test('protocolo invalido reprova', () => {
  ['PV-26-0123', 'PV-2026-123', 'PV20260123', 'OS-2026-0123', '2026-0123', 'PV-2026-01234', 'qualquer coisa']
    .forEach((v) => {
      assert.strictEqual(protocoloAtendimentoValido(v), false, v + ' deveria ser invalido');
    });
});

test('protocolo vazio reprova (inclusive null, undefined e so espaco)', () => {
  ['', '   ', null, undefined].forEach((v) => {
    assert.strictEqual(protocoloAtendimentoValido(v), false);
  });
});

// ---------------------------------------------------------------------------
// DECISAO DE BLOQUEAR O ENVIO DA OS
// ---------------------------------------------------------------------------

test('o bloqueio dispara quando nao ha protocolo, com a mensagem exata da spec', () => {
  const d = decidirEnvioOS('');
  assert.strictEqual(d.bloquear, true);
  assert.strictEqual(d.motivo, 'vazio');
  assert.strictEqual(
    d.mensagem,
    'Toda OS precisa estar ligada a um atendimento — é assim que ela é encontrada depois.'
  );
});

test('nao informar nada e informar so espaco caem no MESMO bloqueio', () => {
  [null, undefined, '', '   '].forEach((v) => {
    const d = decidirEnvioOS(v);
    assert.strictEqual(d.bloquear, true, JSON.stringify(v) + ' deveria bloquear');
    assert.strictEqual(d.motivo, 'vazio');
    assert.strictEqual(d.mensagem, MSG_OS_SEM_ATENDIMENTO);
  });
});

test('protocolo malformado bloqueia por OUTRO motivo — e com outra saida', () => {
  // Quem nao tem protocolo precisa do botao "Criar atendimento para esta OS";
  // quem digitou errado precisa corrigir o que digitou. Uma mensagem so
  // mandaria metade das pessoas para o lado errado.
  const d = decidirEnvioOS('PV-26-1');
  assert.strictEqual(d.bloquear, true);
  assert.strictEqual(d.motivo, 'formato');
  assert.strictEqual(d.mensagem, MSG_OS_PROTOCOLO_INVALIDO);
  assert.notStrictEqual(d.mensagem, MSG_OS_SEM_ATENDIMENTO);
});

test('o bloqueio NAO dispara com protocolo valido, e devolve o protocolo normalizado', () => {
  const d = decidirEnvioOS(' pv-2026-0123 ');
  assert.strictEqual(d.bloquear, false);
  assert.strictEqual(d.motivo, '');
  assert.strictEqual(d.mensagem, '');
  assert.strictEqual(d.protocolo, 'PV-2026-0123');
});

// ---------------------------------------------------------------------------
// EXISTENCIA DO ATENDIMENTO (rodada 2): formato certo apontando para nada
// ---------------------------------------------------------------------------
// O cenario real: ela tem PV-2026-0050 na mao e digita PV-2026-0500. O formato
// e impecavel, o atendimento nao existe. Ate a rodada 1 a OS ia embora assim e
// nascia um vinculo FANTASMA — pior que nenhum, porque o chip aponta para lugar
// nenhum e a OS some do historico do cliente do mesmo jeito.

test('consulta que diz NAO EXISTE bloqueia — e o motivo e proprio, nao "formato"', () => {
  const d = decidirEnvioOS('PV-2026-0500', { protocolo: 'PV-2026-0500', resultado: CONSULTA_NAO_EXISTE });
  assert.strictEqual(d.bloquear, true);
  assert.strictEqual(d.motivo, 'inexistente');
  assert.strictEqual(d.protocolo, 'PV-2026-0500');
  assert.notStrictEqual(d.mensagem, MSG_OS_PROTOCOLO_INVALIDO);
  assert.notStrictEqual(d.mensagem, MSG_OS_SEM_ATENDIMENTO);
});

test('a mensagem do inexistente diz O QUE FAZER, com as duas saidas reais', () => {
  const m = decidirEnvioOS('PV-2026-0500', { protocolo: 'PV-2026-0500', resultado: CONSULTA_NAO_EXISTE }).mensagem;
  assert.match(m, /PV-2026-0500/);                          // qual protocolo falhou
  assert.match(m, /Confira o número/);                      // saida 1: corrigir
  assert.match(m, /Criar atendimento para esta OS/);        // saida 2: o botao do formulario
  // e o texto mora na lib, uma vez so
  assert.strictEqual(m, mensagemAtendimentoInexistente('pv-2026-0500'));
});

// A REGRA QUE NAO PODE SER QUEBRADA: a atendente nunca fica sem conseguir abrir
// uma OS. "Nao consegui perguntar" NAO e "nao existe" — falha ABERTO.
test('FALHA ABERTO: nenhum estado de consulta que nao seja `nao_existe` bloqueia', () => {
  [CONSULTA_NAO_FEITA, CONSULTA_EM_ANDAMENTO, CONSULTA_EXISTE, CONSULTA_INDETERMINADA,
   '', 'qualquer', null, undefined].forEach((resultado) => {
    const d = decidirEnvioOS('PV-2026-0050', { protocolo: 'PV-2026-0050', resultado: resultado });
    assert.strictEqual(d.bloquear, false, 'resultado ' + JSON.stringify(resultado) + ' nao podia bloquear');
    assert.strictEqual(d.protocolo, 'PV-2026-0050');
  });
});

test('FALHA ABERTO: consulta ausente, nula ou de tipo estranho deixa a OS passar', () => {
  [undefined, null, '', 0, 'nao_existe', ['nao_existe'], NaN].forEach((consulta) => {
    const d = decidirEnvioOS('PV-2026-0050', consulta);
    assert.strictEqual(d.bloquear, false, JSON.stringify(consulta) + ' nao podia bloquear');
  });
  // e a chamada de UM argumento so (front velho em cache chamando a lib nova)
  assert.strictEqual(decidirEnvioOS('PV-2026-0050').bloquear, false);
});

test('a consulta so vale para o protocolo que esta no campo AGORA', () => {
  // Ela viu o vermelho do PV-2026-0500, corrigiu para PV-2026-0050 e mandou. O
  // "nao existe" do numero errado nao pode herdar para o numero certo.
  const d = decidirEnvioOS('PV-2026-0050', { protocolo: 'PV-2026-0500', resultado: CONSULTA_NAO_EXISTE });
  assert.strictEqual(d.bloquear, false);
  assert.strictEqual(d.protocolo, 'PV-2026-0050');
});

test('a comparacao do protocolo da consulta tambem normaliza (espaco e caixa)', () => {
  const d = decidirEnvioOS(' pv-2026-0500 ', { protocolo: 'PV-2026-0500', resultado: CONSULTA_NAO_EXISTE });
  assert.strictEqual(d.bloquear, true);
  assert.strictEqual(d.motivo, 'inexistente');
});

test('vazio e formato continuam ganhando da consulta (cada erro com a sua saida)', () => {
  const consulta = { protocolo: 'PV-2026-0500', resultado: CONSULTA_NAO_EXISTE };
  assert.strictEqual(decidirEnvioOS('', consulta).motivo, 'vazio');
  assert.strictEqual(decidirEnvioOS('', consulta).mensagem, MSG_OS_SEM_ATENDIMENTO);
  assert.strictEqual(decidirEnvioOS('PV-26-1', consulta).motivo, 'formato');
  assert.strictEqual(decidirEnvioOS('PV-26-1', consulta).mensagem, MSG_OS_PROTOCOLO_INVALIDO);
});

// ---------------------------------------------------------------------------
// DECISAO DE CRIAR ATENDIMENTO PELO BOTAO (rodada 3): matar o laco
// ---------------------------------------------------------------------------
// O laco: a mensagem do protocolo inexistente manda clicar em "Criar
// atendimento para esta OS", e o guard do botao recusava por FORMATO valido —
// PV-2026-0500 (fantasma) tem formato impecavel. A tela mandava fazer algo que
// ela mesma recusava. A regra agora e a mesma de decidirEnvioOS virada do
// avesso: so PROVA POSITIVA de existencia autoriza recusar.

test('LACO MORTO: protocolo de formato valido PROVADO INEXISTENTE deixa criar', () => {
  const d = decidirCriacaoAtendimento('PV-2026-0500',
    { protocolo: 'PV-2026-0500', resultado: CONSULTA_NAO_EXISTE });
  assert.strictEqual(d.criar, true, 'e este exato caso que fechava o laco');
  assert.strictEqual(d.motivo, 'fantasma');
  assert.strictEqual(d.substituira, 'PV-2026-0500');
  assert.match(d.mensagem, /substituído/);   // avisa que o numero vai mudar
  assert.match(d.mensagem, /PV-2026-0500/);
});

test('PROTECAO VIVA: protocolo PROVADO EXISTENTE continua recusando a criacao', () => {
  // O guard nao foi desligado — ele so passou a exigir prova do que protege.
  const d = decidirCriacaoAtendimento('PV-2026-0050',
    { protocolo: 'PV-2026-0050', resultado: CONSULTA_EXISTE });
  assert.strictEqual(d.criar, false);
  assert.strictEqual(d.motivo, 'vinculo_real');
  assert.strictEqual(d.substituira, '', 'recusou: nao vai substituir nada');
  assert.strictEqual(d.mensagem, mensagemVinculoReal('PV-2026-0050'));
  assert.match(d.mensagem, /apague o protocolo do campo/);  // e diz como criar outro
});

test('campo vazio cria, como sempre criou (o caminho principal do botao)', () => {
  [null, undefined, '', '   '].forEach((v) => {
    const d = decidirCriacaoAtendimento(v, { protocolo: '', resultado: CONSULTA_NAO_FEITA });
    assert.strictEqual(d.criar, true);
    assert.strictEqual(d.motivo, 'vazio');
    assert.strictEqual(d.substituira, '');
    assert.strictEqual(d.mensagem, '', 'nao ha protocolo nenhum para avisar que sera trocado');
  });
});

test('texto que nao e protocolo cria, e sem aviso de substituicao', () => {
  ['PV-20', 'PV-26-1', 'nao sei o numero', '12345'].forEach((v) => {
    const d = decidirCriacaoAtendimento(v, { protocolo: '', resultado: CONSULTA_NAO_FEITA });
    assert.strictEqual(d.criar, true, v + ' virou beco sem saida');
    assert.strictEqual(d.motivo, 'texto_invalido');
    assert.strictEqual(d.substituira, '', 'texto solto nao e um protocolo sendo substituido');
  });
});

test('SEM PROVA (nao consultado, no ar, indeterminado) cria — mas avisa a substituicao', () => {
  // Nao ha vinculo real a proteger: nada provou que aquele PV- existe. Criar e
  // o certo, e o aviso e o que evita a surpresa de sair dali com outro numero.
  [CONSULTA_NAO_FEITA, CONSULTA_EM_ANDAMENTO, CONSULTA_INDETERMINADA, '', 'xyz', null, undefined]
    .forEach((resultado) => {
      const d = decidirCriacaoAtendimento('PV-2026-0050',
        { protocolo: 'PV-2026-0050', resultado: resultado });
      assert.strictEqual(d.criar, true, 'resultado ' + JSON.stringify(resultado) + ' nao podia recusar');
      assert.strictEqual(d.motivo, 'sem_prova');
      assert.strictEqual(d.substituira, 'PV-2026-0050');
      assert.match(d.mensagem, /PV-2026-0050 que está no campo será substituído/);
    });
});

test('consulta ausente ou de tipo estranho tambem cria (nada disso e prova)', () => {
  [undefined, null, '', 0, 'existe', ['existe'], NaN].forEach((consulta) => {
    const d = decidirCriacaoAtendimento('PV-2026-0050', consulta);
    assert.strictEqual(d.criar, true, JSON.stringify(consulta) + ' foi tratado como prova');
    assert.strictEqual(d.motivo, 'sem_prova');
  });
  assert.strictEqual(decidirCriacaoAtendimento('PV-2026-0050').criar, true);
});

test('a prova de existencia so vale para o protocolo que esta no campo AGORA', () => {
  // Ela escolheu PV-2026-0050 no datalist (existe), depois digitou por cima
  // PV-2026-0777. O "existe" do primeiro nao pode proteger o segundo.
  const d = decidirCriacaoAtendimento('PV-2026-0777',
    { protocolo: 'PV-2026-0050', resultado: CONSULTA_EXISTE });
  assert.strictEqual(d.criar, true);
  assert.strictEqual(d.motivo, 'sem_prova');
});

test('a decisao normaliza espaco e caixa dos dois lados', () => {
  const recusa = decidirCriacaoAtendimento('  pv-2026-0050  ',
    { protocolo: ' PV-2026-0050 ', resultado: CONSULTA_EXISTE });
  assert.strictEqual(recusa.criar, false);
  assert.strictEqual(recusa.protocolo, 'PV-2026-0050');

  const cria = decidirCriacaoAtendimento('  pv-2026-0500  ',
    { protocolo: 'pv-2026-0500', resultado: CONSULTA_NAO_EXISTE });
  assert.strictEqual(cria.criar, true);
  assert.strictEqual(cria.substituira, 'PV-2026-0500');
});

test('a mensagem de sucesso DIZ que o numero mudou quando houve substituicao', () => {
  const m = mensagemAtendimentoCriado('PV-2026-0901', 'PV-2026-0500');
  assert.match(m, /PV-2026-0901/);
  assert.match(m, /no lugar de PV-2026-0500/);
  assert.match(m, /número mudou/);
});

test('sem substituicao a mensagem de sucesso nao inventa uma troca', () => {
  ['', null, undefined, '   '].forEach((s) => {
    const m = mensagemAtendimentoCriado('PV-2026-0901', s);
    assert.strictEqual(m, 'Atendimento PV-2026-0901 criado. Esta OS será vinculada a ele.');
    assert.strictEqual(/no lugar de/.test(m), false);
  });
  // e substituir a si mesmo tambem nao e troca
  assert.strictEqual(/no lugar de/.test(mensagemAtendimentoCriado('PV-2026-0901', 'pv-2026-0901')), false);
});

// ---------------------------------------------------------------------------
// CONTAGEM DE OS SEM VINCULO (instrumentacao da adesao)
// ---------------------------------------------------------------------------

test('lista vazia conta zero (e nao quebra com null/undefined)', () => {
  assert.strictEqual(contarSemVinculo([]), 0);
  assert.strictEqual(contarSemVinculo(null), 0);
  assert.strictEqual(contarSemVinculo(undefined), 0);
});

test('lista toda vinculada conta zero', () => {
  const oses = [
    { numeroOS: 'OS-2026-0001', atendimentoId: 'PV-2026-0001' },
    { numeroOS: 'OS-2026-0002', atendimentoId: 'PV-2026-0002' },
    { numeroOS: 'OS-2026-0003', atendimentoId: 'PV-2026-0003' }
  ];
  assert.strictEqual(contarSemVinculo(oses), 0);
});

test('lista mista conta so as sem vinculo', () => {
  const oses = [
    { numeroOS: 'OS-2026-0001', atendimentoId: 'PV-2026-0001' },
    { numeroOS: 'OS-2026-0002', atendimentoId: '' },
    { numeroOS: 'OS-2026-0003' },
    { numeroOS: 'OS-2026-0004', atendimentoId: '   ' },
    { numeroOS: 'OS-2026-0005', atendimentoId: null },
    { numeroOS: 'OS-2026-0006', atendimentoId: 'PV-2026-0006' }
  ];
  assert.strictEqual(contarSemVinculo(oses), 4);
});

test('lista inteira sem vinculo conta todas (o baseline real de 28/07 era 298 de 298)', () => {
  const oses = [];
  for (let i = 0; i < 298; i++) oses.push({ numeroOS: 'OS-2026-' + i, atendimentoId: '' });
  assert.strictEqual(contarSemVinculo(oses), 298);
});

test('item nulo conta como sem vinculo (a metrica erra para o lado pessimista)', () => {
  // Inflar a adesao e o erro que faria alguem ligar o bloqueio do backend cedo
  // demais — e ai quem estivesse com o front velho em cache pararia de abrir OS.
  assert.strictEqual(contarSemVinculo([null, undefined, { atendimentoId: 'PV-2026-0001' }]), 2);
});

// ---------------------------------------------------------------------------
// GUARDAS DE FONTE — o que nao da para executar aqui, mas nao pode regredir
// ---------------------------------------------------------------------------

const GAS = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8').replace(/\r/g, '');

function corpo(fonte, nome) {
  const ini = fonte.indexOf('function ' + nome + '(');
  assert.notStrictEqual(ini, -1, 'nao achei function ' + nome);
  // fecha na primeira '}' em inicio de linha depois da abertura ('\n}' casa
  // tambem em CRLF, porque '\r\n}' contem '\n}')
  const fim = fonte.indexOf('\n}', ini);
  assert.notStrictEqual(fim, -1, 'nao achei o fim de ' + nome);
  return fonte.slice(ini, fim + 2).replace(/\r/g, '');
}

// Tira as linhas de comentario antes de procurar padrao de CODIGO. Sem isso o
// comentario que EXPLICA o bug antigo ('lia docsVinculados: row[17]') faz o
// guard acusar o proprio texto que documenta o conserto.
function semComentarios(codigo) {
  return codigo.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}

test('a copia de contarSemVinculo em google-apps-script.js bate com a desta lib', () => {
  const lib = fs.readFileSync(path.join(__dirname, '..', 'lib', 'vinculo-atendimento.js'), 'utf8');
  assert.strictEqual(corpo(GAS, 'contarSemVinculo'), corpo(lib, 'contarSemVinculo'),
    'contarSemVinculo divergiu entre google-apps-script.js e lib/vinculo-atendimento.js');
});

test('listarOS devolve semVinculo junto do resto (instrumentacao da adesao)', () => {
  const c = corpo(GAS, 'listarOS');
  assert.match(c, /semVinculo:/, 'listarOS parou de devolver o campo semVinculo');
  assert.match(c, /contarSemVinculo\(/, 'listarOS deveria contar pela funcao pura, nao no olho');
});

// ---------------------------------------------------------------------------
// listarOS RODANDO DE VERDADE (mesma tecnica de tests/status-os.test.js): o
// corpo e extraido da FONTE do backend e avaliado com new Function, com os
// globais do Apps Script injetados como parametros. O que roda aqui e o codigo
// que vai para a planilha, nao uma reimplementacao paralela.
// ---------------------------------------------------------------------------

const buscaTexto = require('../lib/busca-texto.js');
const ABA = 'AssistenciasTecnicas';
const COL_ATENDIMENTO = 26; // conferido ao vivo em 28/07: 26 colunas, a ultima e atendimentoId

// Linha do master com 26 colunas. atendimentoId vazio = OS solta.
function linhaOS(numero, atendimentoId) {
  const l = new Array(COL_ATENDIMENTO).fill('');
  l[0] = new Date(2026, 6, 28);
  l[1] = numero;
  l[2] = 'Cliente ' + numero;
  l[21] = 'Aberta';
  l[COL_ATENDIMENTO - 1] = atendimentoId || '';
  return l;
}

function bancadaListarOS(linhas) {
  const aba = {
    getLastRow: function() { return linhas.length; },
    getDataRange: function() {
      return { getValues: function() { return linhas.map(function(l) { return l.slice(); }); } };
    }
  };
  return new Function(
    'SpreadsheetApp', 'ABA_ASSISTENCIAS', 'getColAtendimentoId',
    'termosDaBusca', 'montarTextoBusca', 'textoCasaTermos', 'contarSemVinculo',
    'etapaDoStatus_', 'Utilities', 'Session', 'ETAPAS_OS',
    corpo(GAS, 'listarOS') + '\nreturn listarOS;'
  )(
    { getActiveSpreadsheet: function() {
        return { getSheetByName: function(n) { return n === ABA ? aba : null; } };
      } },
    ABA,
    function() { return COL_ATENDIMENTO; },
    buscaTexto.termosDaBusca, buscaTexto.montarTextoBusca, buscaTexto.textoCasaTermos,
    contarSemVinculo,
    function() { return 0; },
    { formatDate: function() { return '28/07/2026'; } },
    { getScriptTimeZone: function() { return 'America/Sao_Paulo'; } },
    ['Aberta']
  );
}

test('listarOS conta as OS soltas da listagem — lista mista', () => {
  const listar = bancadaListarOS([
    ['cabecalho'],
    linhaOS('OS-2026-0001', 'PV-2026-0001'),
    linhaOS('OS-2026-0002', ''),
    linhaOS('OS-2026-0003', ''),
    linhaOS('OS-2026-0004', 'PV-2026-0004')
  ]);
  const r = listar({});
  assert.strictEqual(r.total, 4);
  assert.strictEqual(r.semVinculo, 2);
});

test('listarOS conta zero quando toda OS esta vinculada (o alvo desta task)', () => {
  const listar = bancadaListarOS([
    ['cabecalho'],
    linhaOS('OS-2026-0001', 'PV-2026-0001'),
    linhaOS('OS-2026-0002', 'PV-2026-0002')
  ]);
  assert.strictEqual(listar({}).semVinculo, 0);
});

test('listarOS conta ANTES do corte de `limite` — o numero anda com `total`, nao com `exibidos`', () => {
  // Contar depois do slice faria a metrica encostar no teto do payload e
  // parecer que a adesao melhorou quando so cresceu a lista.
  const linhas = [['cabecalho']];
  for (let i = 0; i < 10; i++) linhas.push(linhaOS('OS-2026-' + (1000 + i), ''));
  const r = bancadaListarOS(linhas)({ limite: 3 });
  assert.strictEqual(r.total, 10);
  assert.strictEqual(r.exibidos, 3);
  assert.strictEqual(r.semVinculo, 10, 'semVinculo nao pode ser cortado junto com a pagina');
});

test('listarOS devolve semVinculo tambem quando a aba esta vazia (nunca undefined)', () => {
  // Caminho do early-return (aba so com cabecalho). Um campo que existe em um
  // caminho e some no outro vira ruido na hora de comparar a medicao dia a dia.
  const r = bancadaListarOS([['cabecalho']])({});
  assert.strictEqual(r.oses.length, 0);
  assert.strictEqual(r.semVinculo, 0);
});

test('listarOS devolve semVinculo quando o filtro nao acha nada', () => {
  const r = bancadaListarOS([
    ['cabecalho'],
    linhaOS('OS-2026-0001', 'PV-2026-0001')
  ])({ busca: 'cliente que nao existe' });
  assert.strictEqual(r.oses.length, 0);
  assert.strictEqual(r.semVinculo, 0);
});

test('registrarOS carimba o outro lado do vinculo, e sem poder derrubar a OS', () => {
  const c = corpo(GAS, 'registrarOS');
  assert.match(c, /carimbarDocNoAtendimento_\(/,
    'registrarOS parou de carimbar a OS em docsVinculados do atendimento');
  // A chamada tem que estar dentro de try/catch: o vinculo e importante, mas
  // perder a OS inteira porque a aba Atendimentos estava travada seria pior.
  const i = c.indexOf('carimbarDocNoAtendimento_(');
  const antes = c.slice(0, i);
  const ultimoTry = antes.lastIndexOf('try {');
  const ultimoCatch = antes.lastIndexOf('} catch');
  assert.ok(ultimoTry > ultimoCatch, 'a chamada de carimbarDocNoAtendimento_ nao esta dentro de um try');
});

test('listarAtendimentos le docsVinculados pelo CABECALHO, nunca por indice fixo', () => {
  // A aba Atendimentos tem 17 colunas e docsVinculados e a Q (indice 16) —
  // conferido ao vivo em 28/07. O codigo antigo lia row[17] (coluna R, que nao
  // existe) e devolvia o conteudo da Q no campo `acoes`. Resultado: mesmo
  // depois de o vinculo passar a ser gravado, o cartao do atendimento
  // continuaria mostrando zero doc. Indice fixo aqui e o bug, nao o contrato.
  const c = semComentarios(corpo(GAS, 'listarAtendimentos'));
  assert.strictEqual(/docsVinculados:\s*row\[\d+\]/.test(c), false,
    'listarAtendimentos voltou a ler docsVinculados por indice fixo');
  assert.match(c, /indiceCabecalho_\(/, 'listarAtendimentos deveria achar a coluna pelo cabecalho');
});

const ASSISTENCIA = fs.readFileSync(path.join(__dirname, '..', 'assistencia.js'), 'utf8').replace(/\r/g, '');

test('assistencia.js decide o bloqueio pela lib, sem copiar a regra na mao', () => {
  assert.match(ASSISTENCIA, /decidirEnvioOS\(/,
    'assistencia.js deveria chamar decidirEnvioOS (lib/vinculo-atendimento.js)');
  // A mensagem mora na lib. Se ela for recopiada aqui, as duas versoes
  // divergem no primeiro ajuste de texto e o teste da mensagem exata deixa de
  // valer para o que a atendente le de verdade.
  assert.strictEqual(ASSISTENCIA.indexOf('Toda OS precisa estar ligada'), -1,
    'a mensagem do bloqueio foi duplicada em assistencia.js — ela mora na lib');
});

test('o campo de protocolo existe no formulario de OS e nao e so decoracao', () => {
  assert.match(ASSISTENCIA, /id="osAtendimentoId"/, 'campo Atendimento (protocolo) sumiu do formulario');
  assert.match(ASSISTENCIA, /<datalist id="osAtendimentoLista">/, 'o datalist dos atendimentos abertos sumiu');
  assert.match(ASSISTENCIA, /id="btnCriarAtendimentoOS"/,
    'sem o botao "Criar atendimento para esta OS" o formulario vira beco para quem nao tem protocolo');
  assert.match(ASSISTENCIA, /registrar_atendimento/,
    'o botao precisa criar o atendimento de verdade');
});

const OS_LISTA = fs.readFileSync(path.join(__dirname, '..', 'os-lista.js'), 'utf8').replace(/\r/g, '');
const AT_LISTA = fs.readFileSync(path.join(__dirname, '..', 'atendimentos-lista.js'), 'utf8').replace(/\r/g, '');

test('o caminho atendimento -> OS usa o mesmo hook do caminho inverso', () => {
  // window.__buscaAtendimento (OS -> atendimento) ja existia; window.__buscaOS e
  // o espelho dele. Mecanismo novo aqui significaria duas formas de navegar
  // entre as mesmas duas telas.
  assert.match(AT_LISTA, /window\.__buscaOS\s*=/, 'o chip de OS nao manda o numero para a tela de OS');
  assert.match(AT_LISTA, /navigateTo\('os'\)/, 'o chip de OS nao navega para a aba OS');
  assert.match(OS_LISTA, /window\.__buscaOS/, 'a tela de OS nao le o numero que veio do atendimento');
});

test('o campo do protocolo cabe o protocolo COLADO com espaco em volta', () => {
  // maxlength 12 era o tamanho exato de 'PV-2026-0123' — colar ' PV-2026-0123'
  // do WhatsApp (o espaco da frente vem junto) truncava o ultimo digito e ela
  // levava "protocolo invalido" num numero que copiou certo.
  const m = ASSISTENCIA.match(/id="osAtendimentoId"[^>]*maxlength="(\d+)"/);
  const limite = m ? Number(m[1]) : Infinity; // sem maxlength tambem esta certo
  assert.ok(limite >= ' PV-2026-0123 '.length,
    'maxlength=' + limite + ' trunca o protocolo colado com espaco em volta');
});

// ===========================================================================
// O FIO PRINCIPAL DA TASK, RODANDO DE VERDADE (rodada 2)
// ===========================================================================
// A revisao provou por mutacao que o vinculo nao tinha teste NENHUM de
// comportamento: apagar `atendimentoId` do Object.assign do payload mantinha os
// 171 verdes. O que existia era `assert.match(ASSISTENCIA, /decidirEnvioOS\(/)`
// — presenca de TEXTO no arquivo, nao comportamento.
//
// Daqui para baixo submeterOS, aoTrocarAtendimentoOS e criarAtendimentoParaOS
// sao extraidos da FONTE de assistencia.js e avaliados com new Function, com
// document/fetch falsos injetados como parametros — a mesma tecnica que
// tests/status-os.test.js usa para o backend. O que roda e o codigo que vai para
// o navegador, e as assercoes sao sobre o PAYLOAD que sairia no fetch.

// assistencia.js e um IIFE: tudo esta indentado em 2 espacos, entao o corte e na
// primeira '}' em coluna 2 (o corte por coluna 0 do backend acharia so o fim do
// arquivo).
function corpoIndentado(fonte, nome) {
  const ini = fonte.indexOf('  function ' + nome + '(');
  assert.notStrictEqual(ini, -1, 'nao achei function ' + nome + ' em assistencia.js');
  const fim = fonte.indexOf('\n  }', ini);
  assert.notStrictEqual(fim, -1, 'nao achei o fim de ' + nome);
  return fonte.slice(ini, fim + 4);
}

// A declaracao vem da FONTE tambem: o estado inicial da consulta e parte do
// comportamento (comecar em 'nao_existe' bloquearia todo mundo).
function declaracaoVar(fonte, nome) {
  const m = fonte.match(new RegExp('^  var ' + nome + ' = .*;$', 'm'));
  assert.ok(m, 'nao achei a declaracao de ' + nome + ' em assistencia.js');
  return m[0];
}

const CAMPOS_OK = {
  osNomeCliente: 'Maria Souza',
  osTelefoneCliente: '(19) 99999-8888',
  osCidadeCliente: 'Sumare',
  osUfCliente: 'SP',
  osModelo: 'Kay',
  osNotaFiscal: 'NF-12345',
  osProblema: 'Nao liga',
  osCpfCliente: '',
  osDataCompra: ''
};

function domFalso(valores) {
  const els = {};
  const focados = [];
  function el(id) {
    if (!els[id]) {
      els[id] = {
        id: id, value: '', textContent: '', disabled: false,
        focus: function() { focados.push(id); }
      };
    }
    return els[id];
  }
  Object.keys(valores || {}).forEach(function(id) { el(id).value = valores[id]; });
  return {
    els: els,
    el: el,
    focados: focados,
    doc: {
      getElementById: function(id) { return el(id); },
      querySelector: function(sel) {
        // Sumare de proposito: o caminho que nao depende do dropdown de
        // assistencias, que e ruido para o que esta sendo testado aqui.
        if (sel === 'input[name="osTipoAssistencia"]:checked') return { value: 'Sumare' };
        if (sel === 'input[name="osTipo"]:checked') return { value: 'Garantia' };
        return null;
      }
    }
  };
}

const URL_FALSA = 'https://script.google.test/exec';

function fetchFalso(registro, respostas) {
  return function(url, opts) {
    let payload = null;
    try { payload = JSON.parse((opts && opts.body) || 'null'); } catch (e) { payload = '(corpo ilegivel)'; }
    registro.push({ url: url, metodo: (opts && opts.method) || 'GET', payload: payload });
    const r = respostas && respostas.length ? respostas.shift() : null;
    if (r) return r();
    // Sem resposta programada a promise nunca resolve: nada assincrono roda
    // depois nem suja a assercao sobre o que foi enviado.
    return new Promise(function() {});
  };
}

function protocoloDoCampoReal(doc) {
  return new Function(
    'document', 'atendimentoVinculadoOS', 'normalizarProtocoloAtendimento',
    corpoIndentado(ASSISTENCIA, 'protocoloDoCampoOS') + '\nreturn protocoloDoCampoOS;'
  )(doc, '', normalizarProtocoloAtendimento);
}

const validarTelefoneReal = new Function(
  corpoIndentado(ASSISTENCIA, 'validarTelefoneOS') + '\nreturn validarTelefoneOS;'
)();

// --- bancada 1: submeterOS -------------------------------------------------
function bancadaSubmeterOS(cfg) {
  cfg = cfg || {};
  const campos = Object.assign({}, CAMPOS_OK, { osAtendimentoId: cfg.protocolo || '' }, cfg.campos || {});
  const dom = domFalso(campos);
  const enviados = [];
  const feedback = [];
  const info = [];

  const submeter = new Function(
    'document', 'fetch', 'decidirEnvioOS', 'protocoloDoCampoOS', 'consultaAtendimentoOS',
    'GALPAO_SUMARE', 'mostrarFeedbackOS', 'mostrarInfoAtendimentoOS', 'validarTelefoneOS',
    'resolverUrl', 'cadastroAssistencias', 'mostrarModalPosOS', 'escapeHtml',
    'var submetendo = false;\nvar atendimentoVinculadoOS = "";\n' +
    corpoIndentado(ASSISTENCIA, 'submeterOS') + '\nreturn submeterOS;'
  )(
    dom.doc,
    fetchFalso(enviados),
    decidirEnvioOS,                      // a lib de verdade, nao um dublê
    protocoloDoCampoReal(dom.doc),       // e o campo de verdade, com normalizacao
    cfg.consulta || { protocolo: '', resultado: CONSULTA_NAO_FEITA, mensagem: '', tipo: '' },
    { nome: 'Assistência NXT Sumaré', endereco: 'Rua Quaresmeira da Serra, Sumaré/SP' },
    function(msg, tipo) { feedback.push({ msg: msg, tipo: tipo }); },
    function(msg, tipo) { info.push({ msg: msg, tipo: tipo }); },
    validarTelefoneReal,
    function() { return URL_FALSA; },
    {},
    function() {},
    function(s) { return s == null ? '' : String(s); }
  );

  return {
    submeter: submeter,
    enviados: enviados,
    feedback: feedback,
    info: info,
    focados: dom.focados,
    // o payload do POST de OS, se e que houve um
    payload: function() { return enviados.length ? enviados[0].payload : null; },
    textos: function() {
      return feedback.concat(info).map(function(f) { return f.msg; }).join(' | ');
    }
  };
}

test('BANCADA: submeterOS montada aqui e a de verdade — controle positivo', () => {
  // Sem este teste, "nao houve fetch" passaria ate numa bancada que nao monta
  // funcao nenhuma.
  const b = bancadaSubmeterOS({
    protocolo: 'PV-2026-0050',
    consulta: { protocolo: 'PV-2026-0050', resultado: CONSULTA_EXISTE }
  });
  b.submeter();
  assert.strictEqual(b.enviados.length, 1);
  assert.strictEqual(b.enviados[0].metodo, 'POST');
  assert.strictEqual(b.enviados[0].url, URL_FALSA);
  assert.strictEqual(b.payload().action, 'registrar_os');
  assert.strictEqual(b.payload().nomeCliente, 'Maria Souza');
});

test('COM protocolo valido e existente: o payload leva atendimentoId com aquele valor', () => {
  // ESTE e o fio da task inteira. Tirar `atendimentoId` do Object.assign do
  // payload deixa este teste VERMELHO — e era exatamente a mutacao que os 171
  // testes anteriores nao viam.
  const b = bancadaSubmeterOS({
    protocolo: 'PV-2026-0050',
    consulta: { protocolo: 'PV-2026-0050', resultado: CONSULTA_EXISTE }
  });
  b.submeter();
  assert.strictEqual(b.enviados.length, 1, 'a OS nem chegou a ser enviada');
  assert.strictEqual(b.payload().atendimentoId, 'PV-2026-0050');
});

test('o payload leva o protocolo NORMALIZADO, do jeito que o backend procura', () => {
  // O backend acha o atendimento por igualdade exata de string; mandar
  // ' pv-2026-0050 ' seria vinculo que falha em silencio.
  const b = bancadaSubmeterOS({
    protocolo: '  pv-2026-0050  ',
    consulta: { protocolo: 'PV-2026-0050', resultado: CONSULTA_EXISTE }
  });
  b.submeter();
  assert.strictEqual(b.payload().atendimentoId, 'PV-2026-0050');
});

test('SEM protocolo: nao ha fetch nenhum, e a mensagem e a exata do plano', () => {
  const b = bancadaSubmeterOS({ protocolo: '' });
  b.submeter();
  assert.strictEqual(b.enviados.length, 0, 'a OS foi enviada sem atendimento');
  assert.ok(b.feedback.some(function(f) {
    return f.msg === 'Toda OS precisa estar ligada a um atendimento — é assim que ela é encontrada depois.';
  }), 'a mensagem exata do plano nao apareceu: ' + b.textos());
  // e o cursor volta para o campo que falta, nao deixa a pessoa procurando
  assert.notStrictEqual(b.focados.indexOf('osAtendimentoId'), -1);
});

test('SEM protocolo: so espaco no campo cai no mesmo lugar (nao vira OS solta)', () => {
  const b = bancadaSubmeterOS({ protocolo: '    ' });
  b.submeter();
  assert.strictEqual(b.enviados.length, 0);
  assert.ok(b.feedback.some(function(f) { return f.msg === MSG_OS_SEM_ATENDIMENTO; }));
});

test('protocolo com formato errado: nao ha fetch, e a mensagem manda corrigir', () => {
  const b = bancadaSubmeterOS({ protocolo: 'PV-26-1' });
  b.submeter();
  assert.strictEqual(b.enviados.length, 0);
  assert.ok(b.feedback.some(function(f) { return f.msg === MSG_OS_PROTOCOLO_INVALIDO; }), b.textos());
});

test('FIX 1 — protocolo INEXISTENTE: nao ha fetch (o vinculo fantasma nao nasce)', () => {
  // PV-2026-0500 no lugar de PV-2026-0050: formato perfeito, atendimento
  // nenhum. Ate a rodada 1 esta OS ia embora e ficava invisivel no historico.
  const b = bancadaSubmeterOS({
    protocolo: 'PV-2026-0500',
    consulta: { protocolo: 'PV-2026-0500', resultado: CONSULTA_NAO_EXISTE }
  });
  b.submeter();
  assert.strictEqual(b.enviados.length, 0, 'a OS nasceu apontando para um atendimento que nao existe');
  assert.match(b.textos(), /PV-2026-0500/);
  assert.match(b.textos(), /Criar atendimento para esta OS/); // a saida, nao so o erro
  assert.notStrictEqual(b.focados.indexOf('osAtendimentoId'), -1);
});

test('FIX 1 — consulta IMPOSSIVEL (rede caiu): HA fetch, a OS sai (falha aberto)', () => {
  // A regra que nao pode ser quebrada: impedir a OS por causa de rede deixaria a
  // equipe parada no balcao. "Nao consegui perguntar" nao e "nao existe".
  const b = bancadaSubmeterOS({
    protocolo: 'PV-2026-0500',
    consulta: { protocolo: 'PV-2026-0500', resultado: CONSULTA_INDETERMINADA }
  });
  b.submeter();
  assert.strictEqual(b.enviados.length, 1, 'a rede caiu e a OS ficou presa — isso para o balcao');
  assert.strictEqual(b.payload().atendimentoId, 'PV-2026-0500');
});

test('FALHA ABERTO: consulta nao feita, ainda no ar, ou de OUTRO protocolo -> a OS sai', () => {
  [
    ['ninguem perguntou', { protocolo: '', resultado: CONSULTA_NAO_FEITA }],
    ['pergunta no ar', { protocolo: 'PV-2026-0050', resultado: CONSULTA_EM_ANDAMENTO }],
    ['resposta de outro protocolo', { protocolo: 'PV-2026-0500', resultado: CONSULTA_NAO_EXISTE }],
    ['estado corrompido', { protocolo: 'PV-2026-0050', resultado: 'xyz' }],
    ['sem estado', null]
  ].forEach(function(par) {
    const b = bancadaSubmeterOS({ protocolo: 'PV-2026-0050', consulta: par[1] });
    b.submeter();
    assert.strictEqual(b.enviados.length, 1, 'cenario "' + par[0] + '" prendeu a OS');
    assert.strictEqual(b.payload().atendimentoId, 'PV-2026-0050');
  });
});

test('FALHA ABERTO: sem a lib carregada nada bloqueia — <script> perdido nao para o balcao', () => {
  // Mesma bancada, mas decidirEnvioOS chega undefined (o typeof do codigo cobre).
  const dom = domFalso(Object.assign({}, CAMPOS_OK, { osAtendimentoId: 'PV-2026-0050' }));
  const enviados = [];
  const submeter = new Function(
    'document', 'fetch', 'decidirEnvioOS', 'protocoloDoCampoOS', 'consultaAtendimentoOS',
    'GALPAO_SUMARE', 'mostrarFeedbackOS', 'mostrarInfoAtendimentoOS', 'validarTelefoneOS',
    'resolverUrl', 'cadastroAssistencias', 'mostrarModalPosOS', 'escapeHtml',
    'var submetendo = false;\nvar atendimentoVinculadoOS = "";\n' +
    corpoIndentado(ASSISTENCIA, 'submeterOS') + '\nreturn submeterOS;'
  )(
    dom.doc, fetchFalso(enviados), undefined, protocoloDoCampoReal(dom.doc),
    { protocolo: 'PV-2026-0050', resultado: CONSULTA_NAO_EXISTE }, // ate o pior estado
    { nome: 'Assistência NXT Sumaré', endereco: 'Rua X' },
    function() {}, function() {}, validarTelefoneReal,
    function() { return URL_FALSA; }, {}, function() {}, function(s) { return String(s); }
  );
  submeter();
  assert.strictEqual(enviados.length, 1, 'sem a lib o formulario travou — falhou FECHADO');
  assert.strictEqual(enviados[0].payload.atendimentoId, 'PV-2026-0050');
});

// --- bancada 2: aoTrocarAtendimentoOS + criarAtendimentoParaOS --------------
// O outro lado do FIX 1: quem PRODUZ o estado que submeterOS le. Os dois pedacos
// juntos fecham o circuito (campo -> consulta -> decisao -> payload), entao um
// literal trocado no meio ('nao-existe' em vez de 'nao_existe') fica vermelho.

function bancadaFormularioOS(cfg) {
  cfg = cfg || {};
  const dom = domFalso(Object.assign({}, CAMPOS_OK, { osAtendimentoId: cfg.digitado || '' }));
  const chamadas = [];
  const info = [];
  const aplicados = [];

  const escopo = new Function(
    'document', 'fetch', 'resolverUrl', 'protocoloDoCampoOS', 'mostrarInfoAtendimentoOS',
    'atendimentosConhecidosOS', 'aplicarAtendimentoNoFormularioOS', 'validarTelefoneOS',
    'mensagemAtendimentoInexistente', 'mensagemAtendimentoCriado', 'decidirCriacaoAtendimento',
    'normalizarProtocoloAtendimento',
    'var atendimentoVinculadoOS = "";\n' +
    declaracaoVar(ASSISTENCIA, 'ultimoProtocoloConsultadoOS') + '\n' +
    declaracaoVar(ASSISTENCIA, 'consultaAtendimentoOS') + '\n' +
    declaracaoVar(ASSISTENCIA, 'criandoAtendimentoOS') + '\n' +
    corpoIndentado(ASSISTENCIA, 'anotarConsultaOS') + '\n' +
    corpoIndentado(ASSISTENCIA, 'esquecerAtendimentoConsultadoOS') + '\n' +
    corpoIndentado(ASSISTENCIA, 'msgAtendimentoInexistenteOS') + '\n' +
    corpoIndentado(ASSISTENCIA, 'msgAtendimentoCriadoOS') + '\n' +
    corpoIndentado(ASSISTENCIA, 'aoTrocarAtendimentoOS') + '\n' +
    corpoIndentado(ASSISTENCIA, 'criarAtendimentoParaOS') + '\n' +
    'return { aoTrocar: aoTrocarAtendimentoOS, criar: criarAtendimentoParaOS, ' +
    'consulta: function() { return consultaAtendimentoOS; }, ' +
    'esquecer: esquecerAtendimentoConsultadoOS, ' +
    'vinculado: function() { return atendimentoVinculadoOS; } };'
  )(
    dom.doc,
    fetchFalso(chamadas, cfg.respostas),
    function() { return URL_FALSA; },
    protocoloDoCampoReal(dom.doc),
    function(msg, tipo) { info.push({ msg: msg, tipo: tipo }); },
    cfg.conhecidos || {},
    function(a, p) { aplicados.push(p); },
    validarTelefoneReal,
    mensagemAtendimentoInexistente,
    mensagemAtendimentoCriado,
    decidirCriacaoAtendimento,          // a lib de verdade decide o botao tambem
    normalizarProtocoloAtendimento
  );

  escopo.dom = dom;
  escopo.chamadas = chamadas;
  escopo.info = info;
  escopo.aplicados = aplicados;
  escopo.digitar = function(v) { dom.el('osAtendimentoId').value = v; };
  escopo.textos = function() { return info.map(function(i) { return i.msg; }).join(' | '); };
  return escopo;
}

function flush(voltas) {
  let p = Promise.resolve();
  for (let i = 0; i < (voltas || 8); i++) p = p.then(() => new Promise((r) => setImmediate(r)));
  return p;
}

function respostaJson(obj) {
  return function() { return Promise.resolve({ json: function() { return Promise.resolve(obj); } }); };
}

// O que o servidor responde -> que estado fica anotado -> a OS sai ou nao.
const CIRCUITO = [
  ['servidor devolve o atendimento', respostaJson({ sucesso: true, atendimentos: [{ id: 'PV-2026-0050', nomeCliente: 'Maria' }] }), CONSULTA_EXISTE, true],
  ['servidor responde e o protocolo NAO esta la', respostaJson({ sucesso: true, atendimentos: [] }), CONSULTA_NAO_EXISTE, false],
  ['servidor responde com outro atendimento so', respostaJson({ sucesso: true, atendimentos: [{ id: 'PV-2026-0777' }] }), CONSULTA_NAO_EXISTE, false],
  ['backend devolve erro', respostaJson({ sucesso: false, erro: 'cota excedida' }), CONSULTA_INDETERMINADA, true],
  ['resposta sem a lista', respostaJson({ sucesso: true }), CONSULTA_INDETERMINADA, true],
  ['HTML de erro do Google (json explode)', function() {
    return Promise.resolve({ json: function() { return Promise.reject(new SyntaxError('Unexpected token <')); } });
  }, CONSULTA_INDETERMINADA, true],
  ['rede caiu', function() { return Promise.reject(new Error('Failed to fetch')); }, CONSULTA_INDETERMINADA, true]
];

CIRCUITO.forEach(function(caso) {
  const nome = caso[0], resposta = caso[1], esperado = caso[2], deveEnviar = caso[3];

  test('CIRCUITO: ' + nome + ' -> consulta "' + esperado + '" -> ' + (deveEnviar ? 'a OS SAI' : 'a OS NAO sai'), async () => {
    const f = bancadaFormularioOS({ digitado: 'PV-2026-0050', respostas: [resposta] });
    f.aoTrocar();
    await flush();

    const c = f.consulta();
    assert.strictEqual(c.resultado, esperado, 'anotou "' + c.resultado + '" (mensagem: ' + f.textos() + ')');
    assert.strictEqual(c.protocolo, 'PV-2026-0050');

    // e agora o MESMO estado atravessa para o envio de verdade
    const b = bancadaSubmeterOS({ protocolo: 'PV-2026-0050', consulta: c });
    b.submeter();
    assert.strictEqual(b.enviados.length, deveEnviar ? 1 : 0,
      'cenario "' + nome + '": enviados=' + b.enviados.length);
    if (deveEnviar) assert.strictEqual(b.payload().atendimentoId, 'PV-2026-0050');
  });
});

test('CIRCUITO: campo apagado esquece a consulta anterior (nada de bloqueio herdado)', async () => {
  const f = bancadaFormularioOS({ digitado: 'PV-2026-0500', respostas: [respostaJson({ sucesso: true, atendimentos: [] })] });
  f.aoTrocar();
  await flush();
  assert.strictEqual(f.consulta().resultado, CONSULTA_NAO_EXISTE);

  f.digitar('');
  f.aoTrocar();
  assert.strictEqual(f.consulta().resultado, CONSULTA_NAO_FEITA);
  assert.strictEqual(f.consulta().protocolo, '');
});

test('CIRCUITO: o "nao achei" e repintado quando change e blur disparam em sequencia', async () => {
  // A trava anti-consulta-dupla nao pode ENGOLIR a mensagem: o segundo evento
  // nao repete a pergunta, mas repete o que ela respondeu.
  const f = bancadaFormularioOS({ digitado: 'PV-2026-0500', respostas: [respostaJson({ sucesso: true, atendimentos: [] })] });
  f.aoTrocar();     // change
  await flush();
  const antes = f.chamadas.length;
  f.aoTrocar();     // blur, logo em seguida
  assert.strictEqual(f.chamadas.length, antes, 'consultou duas vezes o mesmo protocolo');
  const ultimas = f.info.slice(-1);
  assert.match(ultimas[0].msg, /Não achei o atendimento PV-2026-0500/);
  assert.strictEqual(ultimas[0].tipo, 'erro');
});

test('MINOR (iii): initAssistencia zera a memoria — a 2a OS reconsulta o mesmo protocolo', async () => {
  // O guard sobrevivia a reconstrucao do formulario: na segunda OS com o mesmo
  // protocolo errado, a consulta nao acontecia e a tela ficava muda.
  const f = bancadaFormularioOS({ digitado: 'PV-2026-0500', respostas: [
    respostaJson({ sucesso: true, atendimentos: [] }),
    respostaJson({ sucesso: true, atendimentos: [] })
  ] });
  f.aoTrocar();
  await flush();
  assert.strictEqual(f.chamadas.length, 1);

  f.esquecer();     // e o que initAssistencia chama ao remontar o formulario
  assert.strictEqual(f.consulta().resultado, CONSULTA_NAO_FEITA);
  f.aoTrocar();
  await flush();
  assert.strictEqual(f.chamadas.length, 2, 'a segunda OS herdou a memoria da primeira e nao reconsultou');
  assert.strictEqual(f.consulta().resultado, CONSULTA_NAO_EXISTE);
  // e a trava de leitura: initAssistencia tem que chamar isso de verdade
  const init = ASSISTENCIA.slice(ASSISTENCIA.indexOf('window.initAssistencia'), ASSISTENCIA.indexOf('window.initAssistencia') + 900);
  assert.match(init, /esquecerAtendimentoConsultadoOS\(\)/,
    'initAssistencia parou de zerar a memoria do protocolo consultado');
});

test('CIRCUITO: protocolo que veio do datalist nao gasta consulta e ja conta como existente', () => {
  const f = bancadaFormularioOS({
    digitado: 'PV-2026-0050',
    conhecidos: { 'PV-2026-0050': { id: 'PV-2026-0050', nomeCliente: 'Maria' } }
  });
  f.aoTrocar();
  assert.strictEqual(f.chamadas.length, 0, 'perguntou por um atendimento que ja estava na mao');
  assert.strictEqual(f.consulta().resultado, CONSULTA_EXISTE);
  assert.deepStrictEqual(f.aplicados, ['PV-2026-0050']);
});

// --- MINOR (ii): o botao "Criar atendimento para esta OS" -------------------

test('MINOR (ii): com vinculo REAL no campo, o botao NAO cria um segundo atendimento', () => {
  // Ela escolheu o atendimento no datalist: existe, e esta provado sem gastar
  // consulta. Criar outro aqui apagaria o vinculo que ela acabou de escolher.
  const f = bancadaFormularioOS({
    digitado: 'PV-2026-0050',
    conhecidos: { 'PV-2026-0050': { id: 'PV-2026-0050', nomeCliente: 'Maria' } }
  });
  f.aoTrocar();
  assert.strictEqual(f.consulta().resultado, CONSULTA_EXISTE);
  f.criar();
  assert.strictEqual(f.chamadas.length, 0, 'criou outro atendimento por cima do que ela escolheu');
  assert.match(f.textos(), /PV-2026-0050/);
  assert.match(f.textos(), /apague o protocolo do campo/); // diz como fazer, se for a intencao
});

test('MINOR (ii): clicar de novo antes da resposta nao cria um SEGUNDO atendimento', () => {
  const f = bancadaFormularioOS({ digitado: '' });   // sem protocolo: o caminho legitimo
  f.criar();
  assert.strictEqual(f.chamadas.length, 1);
  assert.strictEqual(f.chamadas[0].payload.action, 'registrar_atendimento');
  f.criar();   // clique duplo, requisicao ainda no ar
  f.criar();
  assert.strictEqual(f.chamadas.length, 1, 'cada clique virou um atendimento novo');
});

test('MINOR (ii): depois de criar, o campo fica com o PV- novo e nao deixa criar outro', async () => {
  const f = bancadaFormularioOS({
    digitado: '',
    respostas: [respostaJson({ sucesso: true, id: 'PV-2026-0901' })]
  });
  f.criar();
  await flush();

  assert.strictEqual(f.dom.el('osAtendimentoId').value, 'PV-2026-0901');
  assert.strictEqual(f.vinculado(), 'PV-2026-0901');
  // recem-criado no servidor: existe, e o envio nao precisa reconsultar
  assert.strictEqual(f.consulta().resultado, CONSULTA_EXISTE);
  assert.strictEqual(f.consulta().protocolo, 'PV-2026-0901');

  f.criar();
  assert.strictEqual(f.chamadas.length, 1, 'criou um segundo atendimento sem ela limpar o campo');

  // e a OS sai vinculada ao atendimento novo
  const b = bancadaSubmeterOS({ protocolo: 'PV-2026-0901', consulta: f.consulta() });
  b.submeter();
  assert.strictEqual(b.payload().atendimentoId, 'PV-2026-0901');
});

test('MINOR (ii): a saida continua aberta — sem protocolo e com dados, o botao cria', () => {
  // O guard nao pode virar beco: quem nao tem protocolo PRECISA deste botao.
  const f = bancadaFormularioOS({ digitado: '' });
  f.criar();
  assert.strictEqual(f.chamadas.length, 1);
  assert.strictEqual(f.chamadas[0].payload.nomeCliente, 'Maria Souza');
});

test('MINOR (ii): protocolo pela metade no campo nao impede de criar (nao e vinculo)', () => {
  const f = bancadaFormularioOS({ digitado: 'PV-20' });
  f.criar();
  assert.strictEqual(f.chamadas.length, 1, 'texto invalido no campo virou beco sem saida');
});

// ===========================================================================
// O LACO, PERCORRIDO INTEIRO (rodada 3)
// ===========================================================================
// A REGRA QUE NAO PODE SER QUEBRADA tem duas metades. A segunda — "nunca fica
// presa num laco onde a tela manda fazer algo que a propria tela recusa" — era
// o que quebrava: erro do protocolo inexistente manda clicar no botao; o botao
// recusava por formato valido. Os testes daqui percorrem os dois passos NA
// MESMA bancada, entao consertar a mensagem sem consertar o guard (ou vice
// versa) fica vermelho.

test('LACO MORTO (fio inteiro): o que a tela manda fazer, a tela deixa fazer', async () => {
  const f = bancadaFormularioOS({
    digitado: 'PV-2026-0500',
    respostas: [
      respostaJson({ sucesso: true, atendimentos: [] }),        // consulta: nao existe
      respostaJson({ sucesso: true, id: 'PV-2026-0901' })       // criacao pedida pela propria mensagem
    ]
  });

  // passo 1: ela digita o protocolo fantasma e a tela pinta o erro
  f.aoTrocar();
  await flush();
  assert.strictEqual(f.consulta().resultado, CONSULTA_NAO_EXISTE);
  assert.match(f.textos(), /Criar atendimento para esta OS/, 'a mensagem deixou de indicar a saida');

  // passo 2: ela faz exatamente o que a mensagem mandou
  const antes = f.chamadas.length;
  f.criar();
  assert.strictEqual(f.chamadas.length, antes + 1,
    'a tela mandou clicar no botao e o botao recusou o clique — o laco voltou');
  assert.strictEqual(f.chamadas[antes].payload.action, 'registrar_atendimento');
  assert.strictEqual(f.chamadas[antes].payload.nomeCliente, 'Maria Souza');

  // passo 3: ela sai do laco com um protocolo que existe, e SABE que mudou
  await flush();
  assert.strictEqual(f.dom.el('osAtendimentoId').value, 'PV-2026-0901');
  assert.strictEqual(f.vinculado(), 'PV-2026-0901');
  assert.strictEqual(f.consulta().resultado, CONSULTA_EXISTE);
  assert.strictEqual(f.consulta().protocolo, 'PV-2026-0901');
  assert.match(f.textos(), /no lugar de PV-2026-0500/, 'a troca do numero ficou em silencio');
  assert.match(f.textos(), /número mudou/);

  // e a OS sai vinculada ao atendimento novo, que existe
  const b = bancadaSubmeterOS({ protocolo: 'PV-2026-0901', consulta: f.consulta() });
  b.submeter();
  assert.strictEqual(b.enviados.length, 1);
  assert.strictEqual(b.payload().atendimentoId, 'PV-2026-0901');
});

test('LACO MORTO: antes de criar por cima, o aviso da substituicao aparece', () => {
  // Sem o aviso, ela clica no botao e o numero do campo troca sozinho.
  const f = bancadaFormularioOS({ digitado: 'PV-2026-0050' });  // ninguem consultou ainda
  f.criar();
  assert.strictEqual(f.chamadas.length, 1, 'protocolo sem prova nenhuma travou a criacao');
  assert.match(f.textos(), /PV-2026-0050 que está no campo será substituído/);
});

test('LACO MORTO: consulta indeterminada (rede caiu) nao impede de criar', async () => {
  // "Nao consegui perguntar" nao e prova de vinculo — e prender a criacao aqui
  // deixaria a atendente sem protocolo E sem como fazer um.
  const f = bancadaFormularioOS({
    digitado: 'PV-2026-0050',
    respostas: [
      function() { return Promise.reject(new Error('Failed to fetch')); },
      respostaJson({ sucesso: true, id: 'PV-2026-0902' })
    ]
  });
  f.aoTrocar();
  await flush();
  assert.strictEqual(f.consulta().resultado, CONSULTA_INDETERMINADA);

  f.criar();
  assert.strictEqual(f.chamadas.length, 2, 'a rede caiu e o botao travou junto');
  await flush();
  assert.strictEqual(f.dom.el('osAtendimentoId').value, 'PV-2026-0902');
  assert.match(f.textos(), /no lugar de PV-2026-0050/);
});

test('PROTECAO VIVA (fio inteiro): vinculo real consultado no servidor segue recusando', async () => {
  const f = bancadaFormularioOS({
    digitado: 'PV-2026-0050',
    respostas: [respostaJson({ sucesso: true, atendimentos: [{ id: 'PV-2026-0050', nomeCliente: 'Maria' }] })]
  });
  f.aoTrocar();
  await flush();
  assert.strictEqual(f.consulta().resultado, CONSULTA_EXISTE);

  const antes = f.chamadas.length;
  f.criar();
  assert.strictEqual(f.chamadas.length, antes, 'criou um atendimento por cima de um vinculo real');
  assert.match(f.textos(), /que existe/);
  assert.match(f.textos(), /apague o protocolo do campo/);
  // e o campo continua apontando para o atendimento dela, intacto
  assert.strictEqual(f.dom.el('osAtendimentoId').value, 'PV-2026-0050');
});

test('PROTECAO VIVA: prova de existencia de OUTRO protocolo nao protege o do campo', () => {
  // Ela escolheu PV-2026-0050 no datalist e depois digitou PV-2026-0777 por
  // cima. O "existe" do primeiro nao pode virar recusa para o segundo.
  const f = bancadaFormularioOS({
    digitado: 'PV-2026-0050',
    conhecidos: { 'PV-2026-0050': { id: 'PV-2026-0050', nomeCliente: 'Maria' } }
  });
  f.aoTrocar();
  assert.strictEqual(f.consulta().resultado, CONSULTA_EXISTE);

  f.digitar('PV-2026-0777');
  f.criar();
  assert.strictEqual(f.chamadas.length, 1, 'a prova do protocolo antigo recusou o novo');
});

test('a trava de clique-duplo sobreviveu: com protocolo fantasma no campo tambem', async () => {
  // A flag criandoAtendimentoOS protege outra coisa (requisicao no ar) e nao
  // participa do laco — mexer no guard nao pode ter desligado ela.
  const f = bancadaFormularioOS({
    digitado: 'PV-2026-0500',
    respostas: [
      respostaJson({ sucesso: true, atendimentos: [] }),
      respostaJson({ sucesso: true, id: 'PV-2026-0903' })
    ]
  });
  f.aoTrocar();
  await flush();
  f.criar();
  f.criar();
  f.criar();
  assert.strictEqual(f.chamadas.length, 2, 'cada clique virou um atendimento novo');
});

test('a regra de criar mora na lib, nao copiada em assistencia.js', () => {
  assert.match(ASSISTENCIA, /decidirCriacaoAtendimento\(/,
    'assistencia.js deveria decidir o botao pela lib (lib/vinculo-atendimento.js)');
  assert.strictEqual(ASSISTENCIA.indexOf('Esta OS já está apontando'), -1,
    'o texto da recusa foi duplicado em assistencia.js — ele mora na lib');
  assert.strictEqual(ASSISTENCIA.indexOf('protocoloAtendimentoValido('), -1,
    'o guard voltou a recusar por FORMATO — e o formato do fantasma e valido');
});

test('sem a lib carregada o botao CRIA (falha aberto, como o resto do formulario)', () => {
  // Mesmo arranjo do teste do submeterOS: perder o <script> nao pode deixar a
  // atendente sem protocolo e sem como fazer um.
  const dom = domFalso(Object.assign({}, CAMPOS_OK, { osAtendimentoId: 'PV-2026-0050' }));
  const chamadas = [];
  const criar = new Function(
    'document', 'fetch', 'resolverUrl', 'protocoloDoCampoOS', 'mostrarInfoAtendimentoOS',
    'atendimentosConhecidosOS', 'validarTelefoneOS', 'mensagemAtendimentoCriado',
    'decidirCriacaoAtendimento', 'normalizarProtocoloAtendimento',
    'var atendimentoVinculadoOS = "";\nvar ultimoProtocoloConsultadoOS = "";\n' +
    'var consultaAtendimentoOS = { protocolo: "PV-2026-0050", resultado: "existe" };\n' +
    declaracaoVar(ASSISTENCIA, 'criandoAtendimentoOS') + '\n' +
    corpoIndentado(ASSISTENCIA, 'anotarConsultaOS') + '\n' +
    corpoIndentado(ASSISTENCIA, 'msgAtendimentoCriadoOS') + '\n' +
    corpoIndentado(ASSISTENCIA, 'criarAtendimentoParaOS') + '\nreturn criarAtendimentoParaOS;'
  )(
    dom.doc, fetchFalso(chamadas), function() { return URL_FALSA; },
    protocoloDoCampoReal(dom.doc), function() {}, {}, validarTelefoneReal,
    undefined, undefined, undefined     // a lib inteira ausente
  );
  criar();
  assert.strictEqual(chamadas.length, 1, 'sem a lib o botao travou — falhou FECHADO');
  assert.strictEqual(chamadas[0].payload.action, 'registrar_atendimento');
});
