const test = require('node:test');
const assert = require('node:assert');
const {
  normalizarTextoBusca,
  termosDaBusca,
  textoCasaTermos,
  montarTextoBusca,
  respostaHistoricoUtilizavel,
  chaveNumeroOSBusca,
  chaveDedupeBusca,
  filtrarHistoricoNovos
} = require('../lib/busca-texto.js');

// ---------------------------------------------------------------------------
// O CASO REAL que abriu esta task (28/07/2026)
// ---------------------------------------------------------------------------
// A equipe procurou 'Alessandra Soares' na tela de OS e nao achou nada. A OS
// existia: Alessandra Soares de Souza Rita tem OS-2026-0535, 0536 e 0572 (serie
// antiga). Medido na v45 em producao no mesmo dia:
//   ?action=listar_os&busca=alessandra        -> 1 OS  (Alessandra dos Reis)
//   ?action=listar_os&busca=Alessandra%20Rita -> 0 OS  <- o furo
// O nome no cadastro tem 'rita' em MINUSCULO e no fim: 'Alessandra Soares de
// Souza rita'. Busca por substring contigua nunca casa primeiro+ultimo nome.

test('CASO REAL: "alessandra rita" acha "Alessandra Soares de Souza rita"', () => {
  const termos = termosDaBusca('alessandra rita');
  assert.strictEqual(textoCasaTermos('Alessandra Soares de Souza rita', termos), true);
});

test('CASO REAL: a mesma busca continua achando pelo hay completo da linha da OS', () => {
  // hay montado como listarOS monta: numero + cliente + telefone + cpf + chassi
  const hay = montarTextoBusca(['OS-2026-0535', 'Alessandra Soares de Souza rita', '', '', '']);
  assert.strictEqual(textoCasaTermos(hay, termosDaBusca('Alessandra Rita')), true);
  assert.strictEqual(textoCasaTermos(hay, termosDaBusca('0535')), true);
});

test('CASO REAL: nao arrasta a OUTRA Alessandra do master junto', () => {
  // 'Alessandra dos Reis' (OS-2026-0742, master) e uma cliente diferente.
  // Buscar 'alessandra rita' nao pode devolver ela.
  const outra = 'Alessandra dos Reis';
  assert.strictEqual(textoCasaTermos(outra, termosDaBusca('alessandra rita')), false);
  // mas o termo unico continua achando as duas, como sempre achou
  assert.strictEqual(textoCasaTermos(outra, termosDaBusca('alessandra')), true);
});

// ---------------------------------------------------------------------------
// Acento nos DOIS lados
// ---------------------------------------------------------------------------

test('acento so no CONTEUDO: "goncalves" acha "GONÇALVES"', () => {
  assert.strictEqual(textoCasaTermos('Maria GONÇALVES', termosDaBusca('goncalves')), true);
});

test('acento so na BUSCA: "GONÇALVES" acha "goncalves" sem cedilha no cadastro', () => {
  assert.strictEqual(textoCasaTermos('maria goncalves', termosDaBusca('GONÇALVES')), true);
});

test('acento dos DOIS lados, grafias diferentes, ainda casa', () => {
  assert.strictEqual(textoCasaTermos('JOSÉ ANTÔNIO', termosDaBusca('jose antonio')), true);
  assert.strictEqual(textoCasaTermos('jose antonio', termosDaBusca('José Antônio')), true);
  assert.strictEqual(textoCasaTermos('Jaguariúna', termosDaBusca('jaguariuna')), true);
});

test('normalizarTextoBusca tira acento, baixa a caixa e achata espaco', () => {
  assert.strictEqual(normalizarTextoBusca('  GONÇALVES   José  '), 'goncalves jose');
  assert.strictEqual(normalizarTextoBusca('Em análise'), 'em analise');
  // idempotente: normalizar de novo nao muda nada
  assert.strictEqual(normalizarTextoBusca(normalizarTextoBusca('Em análise')), 'em analise');
});

// ---------------------------------------------------------------------------
// Termos fora de ordem (AND em qualquer ordem)
// ---------------------------------------------------------------------------

test('termos fora de ordem casam igual', () => {
  const alvo = 'Alessandra Soares de Souza rita';
  assert.strictEqual(textoCasaTermos(alvo, termosDaBusca('rita alessandra')), true);
  assert.strictEqual(textoCasaTermos(alvo, termosDaBusca('souza alessandra')), true);
  assert.strictEqual(textoCasaTermos(alvo, termosDaBusca('rita souza alessandra soares')), true);
});

test('espaco extra entre os termos nao cria termo vazio (que casaria com tudo)', () => {
  assert.deepStrictEqual(termosDaBusca('  alessandra    rita  '), ['alessandra', 'rita']);
  assert.strictEqual(termosDaBusca('alessandra  rita').indexOf(''), -1);
  assert.strictEqual(textoCasaTermos('Alessandra Soares de Souza rita', termosDaBusca('  alessandra    rita  ')), true);
});

// ---------------------------------------------------------------------------
// Termo que nao existe: UM termo errado reprova a linha inteira (e AND, nao OR)
// ---------------------------------------------------------------------------

test('termo que nao existe reprova, mesmo com os outros casando', () => {
  const alvo = 'Alessandra Soares de Souza rita';
  assert.strictEqual(textoCasaTermos(alvo, termosDaBusca('alessandra pereira')), false);
  assert.strictEqual(textoCasaTermos(alvo, termosDaBusca('xpto')), false);
});

test('nao vira OR por acidente: achar so um dos dois termos nao basta', () => {
  assert.strictEqual(textoCasaTermos('Joao da Silva', termosDaBusca('joao souza')), false);
  assert.strictEqual(textoCasaTermos('Maria Souza', termosDaBusca('joao souza')), false);
  assert.strictEqual(textoCasaTermos('Joao Souza', termosDaBusca('joao souza')), true);
});

// ---------------------------------------------------------------------------
// Busca vazia
// ---------------------------------------------------------------------------

test('busca vazia nao produz termo nenhum', () => {
  assert.deepStrictEqual(termosDaBusca(''), []);
  assert.deepStrictEqual(termosDaBusca('   '), []);
  assert.deepStrictEqual(termosDaBusca(null), []);
  assert.deepStrictEqual(termosDaBusca(undefined), []);
});

test('busca vazia NAO casa com nada (nao pode virar "devolve a base inteira")', () => {
  // Deliberado: buscar_os_historico varre ~1100 linhas de 3 abas. Se lista de
  // termos vazia casasse com tudo, um Enter sem digitar nada despejaria a base.
  assert.strictEqual(textoCasaTermos('qualquer coisa', []), false);
  assert.strictEqual(textoCasaTermos('qualquer coisa', termosDaBusca('')), false);
  assert.strictEqual(textoCasaTermos('qualquer coisa', termosDaBusca('   ')), false);
  assert.strictEqual(textoCasaTermos('qualquer coisa', null), false);
  assert.strictEqual(textoCasaTermos('qualquer coisa', undefined), false);
});

test('conteudo vazio nunca casa com uma busca de verdade', () => {
  assert.strictEqual(textoCasaTermos('', termosDaBusca('alessandra')), false);
  assert.strictEqual(textoCasaTermos(null, termosDaBusca('alessandra')), false);
  assert.strictEqual(textoCasaTermos(undefined, termosDaBusca('alessandra')), false);
  assert.strictEqual(textoCasaTermos('   ', termosDaBusca('alessandra')), false);
});

// ---------------------------------------------------------------------------
// Nao regredir o que a busca antiga ja acertava
// ---------------------------------------------------------------------------

test('pedaco de palavra continua achando (a equipe digita nome pela metade)', () => {
  assert.strictEqual(textoCasaTermos('Alessandra dos Reis', termosDaBusca('ales')), true);
  assert.strictEqual(textoCasaTermos('Alessandra dos Reis', termosDaBusca('reis')), true);
});

test('numero de OS, telefone e CPF continuam achando como termo unico', () => {
  const hay = montarTextoBusca(['OS-2026-0742', 'Alessandra dos Reis', '19982557147', '31879094851', 'LUH240092R0050436']);
  assert.strictEqual(textoCasaTermos(hay, termosDaBusca('OS-2026-0742')), true);
  assert.strictEqual(textoCasaTermos(hay, termosDaBusca('0742')), true);
  assert.strictEqual(textoCasaTermos(hay, termosDaBusca('19982557147')), true);
  assert.strictEqual(textoCasaTermos(hay, termosDaBusca('31879094851')), true);
  assert.strictEqual(textoCasaTermos(hay, termosDaBusca('LUH240092R0050436')), true);
  // e combinando numero + nome, que a busca contigua nunca conseguiu
  assert.strictEqual(textoCasaTermos(hay, termosDaBusca('0742 alessandra')), true);
});

test('frase contigua exata continua casando (nao quebrou o caso feliz antigo)', () => {
  assert.strictEqual(textoCasaTermos('Alessandra dos Reis', termosDaBusca('alessandra dos reis')), true);
});

// ---------------------------------------------------------------------------
// montarTextoBusca: os campos vem crus da planilha (numero, Date, vazio, null)
// ---------------------------------------------------------------------------

test('montarTextoBusca aceita campo vazio, null e numero sem virar "null"/"undefined"', () => {
  const hay = montarTextoBusca(['OS-2026-0535', 'Fulano', null, undefined, '', 19982557147]);
  assert.strictEqual(hay, 'OS-2026-0535 Fulano 19982557147');
  assert.strictEqual(normalizarTextoBusca(hay).indexOf('null'), -1);
  assert.strictEqual(normalizarTextoBusca(hay).indexOf('undefined'), -1);
});

test('montarTextoBusca com telefone numerico continua sendo achavel', () => {
  // celula numerica na planilha chega como number, nao string
  const hay = montarTextoBusca(['OS-2026-0001', 'Fulano', 19982557147]);
  assert.strictEqual(textoCasaTermos(hay, termosDaBusca('19982557147')), true);
});

test('montarTextoBusca sem campo nenhum devolve string vazia', () => {
  assert.strictEqual(montarTextoBusca([]), '');
  assert.strictEqual(montarTextoBusca(null), '');
  assert.strictEqual(montarTextoBusca(undefined), '');
});

// ---------------------------------------------------------------------------
// FALLBACK enquanto a v45 estiver no ar (a v46 e que traz buscar_os_historico)
// ---------------------------------------------------------------------------

// Payload REAL medido em 28/07 contra a v45 em producao:
//   GET .../exec?action=buscar_os_historico&q=alessandra
//   -> {"status":"ok","message":"NXT Pecas API ativa"}
// O doGet do Apps Script nao devolve erro para action desconhecida: cai no
// default. Entao a tela recebe HTTP 200 com JSON valido que nao e resposta
// nenhuma — e o unico comportamento aceitavel e nao desenhar o bloco.
const RESPOSTA_V45 = { status: 'ok', message: 'NXT Pecas API ativa' };

test('FALLBACK: a resposta real da v45 (action inexistente) nao desenha nada', () => {
  assert.strictEqual(respostaHistoricoUtilizavel(RESPOSTA_V45), false);
});

test('FALLBACK: "ok" no campo errado nao pode passar por ok:true', () => {
  // o furo classico: `if (d.ok)` ou `if (d.status)` deixaria isso passar e a
  // tela quebraria em d.resultados.map de undefined
  assert.strictEqual(respostaHistoricoUtilizavel({ status: 'ok' }), false);
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: 'ok' }), false);
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: 1 }), false);
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: 'true' }), false);
});

// Rodada 3: o teste acima NAO isolava o que promete. Os quatro objetos dele nao
// tem `resultados`, entao morrem na segunda guarda de qualquer jeito — trocar
// `d.ok !== true` por `!d.ok` deixava a suite verde. Estes casos passam por
// TODAS as outras guardas e so podem ser reprovados pela checagem estrita.
test('FALLBACK: so a checagem ESTRITA de ok reprova estes (passam nas guardas seguintes)', () => {
  // resultados e array de verdade e NAO esta vazio: se `ok` fosse testado por
  // verdade-solta (`if (!d.ok)`), estes dois desenhariam o bloco.
  const item = { numeroOS: 'OS-2026-0535', cliente: 'Alessandra Soares de Souza rita', fonte: 'serie-antiga' };
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: 1, resultados: [item] }), false);
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: 'true', resultados: [item] }), false);
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: {}, resultados: [item] }), false);
  // e o mesmo objeto com ok:true de verdade passa — controle positivo, sem ele
  // o teste acima passaria ate se a funcao devolvesse false pra tudo
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: true, resultados: [item] }), true);
  // ok:1 com resultados:[] atravessa a guarda de TIPO de resultados e so cai na
  // de tamanho — cobre o degrau intermediario
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: 1, resultados: [] }), false);
});

test('FALLBACK: resposta ausente, vazia ou nao-objeto nao quebra', () => {
  assert.strictEqual(respostaHistoricoUtilizavel(null), false);
  assert.strictEqual(respostaHistoricoUtilizavel(undefined), false);
  assert.strictEqual(respostaHistoricoUtilizavel({}), false);
  assert.strictEqual(respostaHistoricoUtilizavel(''), false);
  assert.strictEqual(respostaHistoricoUtilizavel(0), false);
  assert.strictEqual(respostaHistoricoUtilizavel('qualquer coisa'), false);
});

test('FALLBACK: ok:true mas resultados fora do formato nao desenha', () => {
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: true }), false);
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: true, resultados: null }), false);
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: true, resultados: 'nada' }), false);
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: true, resultados: {} }), false);
});

test('FALLBACK: busca legitima que nao achou nada tambem nao desenha bloco vazio', () => {
  assert.strictEqual(respostaHistoricoUtilizavel({ ok: true, total: 0, resultados: [] }), false);
});

test('a resposta boa da v46 desenha o bloco', () => {
  const v46 = {
    ok: true,
    q: 'alessandra rita',
    total: 3,
    exibidos: 3,
    truncado: false,
    resultados: [
      { numeroOS: 'OS-2026-0535', cliente: 'Alessandra Soares de Souza rita', data: '18/06/2026', fonte: 'serie-antiga', modelo: '', assistencia: '', problema: '' }
    ]
  };
  assert.strictEqual(respostaHistoricoUtilizavel(v46), true);
});

// REESCRITO na rodada 3. A versao anterior montava um objeto literal DENTRO do
// proprio teste e afirmava coisas sobre esse literal: nenhuma funcao nem nenhuma
// fonte de producao era consultada, entao ele passava mesmo que o backend
// devolvesse um contrato completamente diferente. Agora le a FONTE (mesma
// tecnica do teste irmao logo abaixo) e fiscaliza os objetos que buscarOSHistorico
// realmente empilha — os TRES, um por fonte.
test('o contrato do historico e o mesmo nas 3 fontes, e nenhuma delas traz status', () => {
  const fs = require('fs');
  const path = require('path');
  const gas = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8').replace(/\r/g, '');

  const ini = gas.indexOf('function buscarOSHistorico(');
  assert.notStrictEqual(ini, -1, 'buscarOSHistorico nao existe no backend');
  const fim = gas.indexOf('\n}', ini);
  assert.notStrictEqual(fim, -1, 'nao achei o fim de buscarOSHistorico');
  const corpo = gas.slice(ini, fim + 2);

  // Recorta cada `achados.push({...})` contando chaves ate fechar.
  const literais = [];
  let p = corpo.indexOf('achados.push({');
  while (p !== -1) {
    let i = corpo.indexOf('{', p);
    let nivel = 0;
    let f = i;
    for (; f < corpo.length; f++) {
      if (corpo[f] === '{') nivel++;
      else if (corpo[f] === '}' && --nivel === 0) break;
    }
    literais.push(corpo.slice(i + 1, f));
    p = corpo.indexOf('achados.push({', f);
  }

  // uma por fonte: serie-antiga, sumare-manual e master
  assert.strictEqual(literais.length, 3, 'esperava 3 achados.push, um por fonte');

  const CONTRATO = ['assistencia', 'cliente', 'data', 'fonte', 'modelo', 'numeroOS', 'problema'];
  literais.forEach((lit, n) => {
    const chaves = (lit.match(/^\s*([a-zA-Z]+):/gm) || [])
      .map((s) => s.trim().replace(':', '')).sort();
    // Guarda de escopo: `status` no retorno faria a tela oferecer um seletor
    // que nao tem onde gravar — atualizarStatusOS so escreve no master.
    assert.strictEqual(chaves.indexOf('status'), -1, 'push #' + (n + 1) + ' voltou a devolver status');
    assert.deepStrictEqual(chaves, CONTRATO, 'push #' + (n + 1) + ' divergiu do contrato do historico');
  });
});

// ---------------------------------------------------------------------------
// FIX 1 (rodada 3): a serie antiga E o master antigo renomeado
// ---------------------------------------------------------------------------
// O comentario do backend afirmava que a aba 'Assistencias parceiras ' "nao tem
// telefone, CPF, modelo nem status" e, em cima disso, a busca varria so
// [numero, cliente] e devolvia modelo/assistencia/problema vazios. Era FALSO.
// docs/inventario-abas-2026-07-27.json (inventario ao vivo da planilha) mostra
// 26 colunas e a linha 1 completa, no layout do master:
//   [1] OS-2026-0034  [2] Simone Aparecida dos Santos  [3] CPF 33320112864
//   [4] telefone 11975791430  [11] Kay  [12] JH2400921000W0527
//   [16] Anderson Tecnico - Extrema MG  [19] problema  [21] Em andamento
const INVENTARIO = require('../docs/inventario-abas-2026-07-27.json');
const ABA_ANTIGA = INVENTARIO.abas.find((a) => a.nome.trim() === 'Assistencias parceiras');
const ABA_MASTER = INVENTARIO.abas.find((a) => a.nome.trim() === 'AssistenciasTecnicas');

test('FIX 1: o inventario prova que a serie antiga tem o layout do master (26 colunas, com CPF e telefone)', () => {
  assert.ok(ABA_ANTIGA, 'a aba da serie antiga sumiu do inventario');
  assert.strictEqual(ABA_ANTIGA.colunas, 26);
  assert.strictEqual(ABA_ANTIGA.registros, 804);
  // as posicoes que o backend passou a ler, uma a uma, na linha 1 do inventario
  const l = ABA_ANTIGA.primeiraLinha;
  assert.strictEqual(l[1], 'OS-2026-0034');
  assert.strictEqual(l[2], 'Simone Aparecida dos Santos');
  assert.strictEqual(l[3], '33320112864');            // CPF
  assert.strictEqual(l[4], '11975791430');            // TELEFONE — o caso de aceite
  assert.strictEqual(l[11], 'Kay');                   // MODELO
  assert.strictEqual(l[12], 'JH2400921000W0527');     // CHASSI
  assert.strictEqual(l[16], 'Anderson Técnico - Extrema MG'); // ASSISTENCIA
  assert.ok(l[19].indexOf('Motor fazendo barulho') !== -1);   // PROBLEMA
  assert.strictEqual(l[21], 'Em andamento');          // STATUS (existe, mas nao viaja)
  // e o cabecalho do master confirma o significado de cada indice
  const h = ABA_MASTER.primeiraLinha;
  assert.strictEqual(h[3], 'CPF CLIENTE');
  assert.strictEqual(h[4], 'TELEFONE CLIENTE');
  assert.strictEqual(h[11], 'MODELO');
  assert.strictEqual(h[12], 'NUMERO CHASSI');
  assert.strictEqual(h[16], 'ASSISTENCIA');
  assert.strictEqual(h[19], 'PROBLEMA RELATADO');
});

test('FIX 1: ACEITE — o telefone 11975791430 casa com a linha da OS-2026-0034 da serie antiga', () => {
  // o hay que o backend passou a montar para a serie antiga:
  // [ra[1] numero, ra[2] cliente, ra[3] cpf, ra[4] telefone, ra[12] chassi]
  const l = ABA_ANTIGA.primeiraLinha;
  const hay = montarTextoBusca([l[1], l[2], l[3], l[4], l[12]]);
  assert.strictEqual(textoCasaTermos(hay, termosDaBusca('11975791430')), true);
  assert.strictEqual(textoCasaTermos(hay, termosDaBusca('33320112864')), true);
  assert.strictEqual(textoCasaTermos(hay, termosDaBusca('JH2400921000W0527')), true);
  // e o hay ANTIGO (so numero + cliente) nao achava nenhum dos tres
  const hayAntigo = montarTextoBusca([l[1], l[2]]);
  assert.strictEqual(textoCasaTermos(hayAntigo, termosDaBusca('11975791430')), false);
  assert.strictEqual(textoCasaTermos(hayAntigo, termosDaBusca('33320112864')), false);
});

test('FIX 1: a serie antiga passou a ler telefone/CPF/chassi e a devolver modelo/assistencia/problema', () => {
  const fs = require('fs');
  const path = require('path');
  const gas = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8').replace(/\r/g, '');
  const ini = gas.indexOf('function buscarOSHistorico(');
  const corpo = gas.slice(ini, gas.indexOf('\n}', ini) + 2);
  // recorta so o trecho da serie antiga (do `var da =` ate o push dela)
  const bloco = corpo.slice(corpo.indexOf('var da ='), corpo.indexOf("fonte: 'serie-antiga'"));

  assert.ok(/montarTextoBusca\(\[ra\[1\], ra\[2\], ra\[3\], ra\[4\], ra\[12\]\]\)/.test(bloco),
    'o texto pesquisavel da serie antiga tem que incluir CPF (3), telefone (4) e chassi (12)');
  assert.strictEqual(/montarTextoBusca\(\[ra\[1\], ra\[2\]\]\)/.test(bloco), false,
    'voltou a varrer so numero + cliente');
  // e o retorno usa as MESMAS posicoes do master, nao literais vazios
  assert.ok(/modelo: String\(ra\[11\] \|\| ''\)/.test(corpo), 'modelo tem que vir da coluna 11');
  assert.ok(/assistencia: String\(ra\[16\] \|\| ''\)/.test(corpo), 'assistencia tem que vir da coluna 16');
  assert.ok(/problema: String\(ra\[19\] \|\| ''\)/.test(corpo), 'problema tem que vir da coluna 19');
  // o teto de 12 colunas cortava fora chassi (12), assistencia (16) e problema (19)
  assert.strictEqual(/antiga\.getLastColumn\(\), 12\)/.test(corpo), false,
    'com 12 colunas as posicoes 12/16/19 nem chegam a ser lidas');
  assert.ok(/antiga\.getLastColumn\(\), CABECALHO_OS_\.length\)/.test(corpo),
    'a largura da leitura tem que ser a do layout do master');
});

// ---------------------------------------------------------------------------
// FIX 2 (rodada 3): o corte de 50 nao pode ser gasto pelo master
// ---------------------------------------------------------------------------

test('FIX 2: as fontes de historico sao varridas ANTES do master', () => {
  const fs = require('fs');
  const path = require('path');
  const gas = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8').replace(/\r/g, '');
  const ini = gas.indexOf('function buscarOSHistorico(');
  const corpo = gas.slice(ini, gas.indexOf('\n}', ini) + 2);

  const posAntiga = corpo.indexOf("fonte: 'serie-antiga'");
  const posSumare = corpo.indexOf("fonte: 'sumare-manual'");
  const posMaster = corpo.indexOf("fonte: 'master'");
  [posAntiga, posSumare, posMaster].forEach((p) => assert.notStrictEqual(p, -1));

  // Medido em 28/07: 'silva' casa 41 no master e 9 na serie antiga. Com o master
  // primeiro, o slice(0,50) guardava 41+9, o dedup do front apagava os 41 e
  // sobravam 9 cartoes — e as ~800 linhas da serie antiga nem eram consideradas.
  assert.ok(posAntiga < posMaster, 'a serie antiga tem que ser empilhada antes do master');
  assert.ok(posSumare < posMaster, 'a Sumare tem que ser empilhada antes do master');
  // o corte continua sendo por ordem de empilhamento (e por isso a ordem importa)
  assert.ok(/achados = achados\.slice\(0, LIMITE_HISTORICO_OS\)/.test(corpo));
});

test('FIX 2: com o master por ultimo, o corte de 50 sobra para quem so aparece no historico', () => {
  // Simulacao do empilhamento do backend com os numeros REAIS de 'silva'
  // (41 no master, 9 na serie antiga), agora na ordem nova.
  const LIMITE = 50;
  const antigos = [];
  for (let i = 1; i <= 9; i++) antigos.push({ numeroOS: 'OS-2026-0' + (100 + i), cliente: 'Silva ' + i, fonte: 'serie-antiga' });
  const mestres = [];
  for (let i = 1; i <= 41; i++) mestres.push({ numeroOS: 'OS-2026-0' + (500 + i), cliente: 'Silva M' + i, fonte: 'master' });

  const cortado = antigos.concat(mestres).slice(0, LIMITE);
  // a lista principal mostra as 41 do master; o dedup tira exatamente elas
  const novos = filtrarHistoricoNovos(cortado, mestres);
  assert.strictEqual(novos.length, 9);
  assert.strictEqual(novos.every((r) => r.fonte === 'serie-antiga'), true);

  // controle: na ORDEM ANTIGA (master primeiro) o mesmo corte perde tudo
  const cortadoAntigo = mestres.concat(antigos).slice(0, LIMITE);
  assert.strictEqual(filtrarHistoricoNovos(cortadoAntigo, mestres).length, 9);
  // (aqui empata porque 41+9 = 50 cabe; o furo aparece quando o master enche o corte)
  const mestresCheio = [];
  for (let i = 1; i <= 60; i++) mestresCheio.push({ numeroOS: 'OS-2026-0' + (500 + i), cliente: 'Silva M' + i, fonte: 'master' });
  assert.strictEqual(filtrarHistoricoNovos(mestresCheio.concat(antigos).slice(0, LIMITE), mestresCheio).length, 0);
  assert.strictEqual(filtrarHistoricoNovos(antigos.concat(mestresCheio).slice(0, LIMITE), mestresCheio).length, 9);
});

// ---------------------------------------------------------------------------
// DEDUP DO BLOCO DE HISTORICO (rodada 2)
// ---------------------------------------------------------------------------
// O bloco so era consultado quando a lista principal devolvia ZERO — e a busca
// AND-por-termo tornou isso quase inalcancavel. Agora ele e consultado em toda
// busca, e o que evita ruido e o dedup, nao o silencio.

test('CASO REAL rodada 2: buscar "alessandra" mostra as OS antigas em vez de escondê-las', () => {
  // Medido na v45 em 28/07: ?action=listar_os&busca=alessandra -> 1 OS
  // (Alessandra dos Reis, master). Com a regra antiga (so consultar o historico
  // quando cache.length === 0) esse 1 resultado fazia o bloco NUNCA aparecer, e
  // as tres OS da Alessandra Soares de Souza Rita seguiam invisiveis.
  const listaPrincipal = [
    { numeroOS: 'OS-2026-0742', cliente: 'Alessandra dos Reis', status: 'Em andamento' }
  ];
  const doHistorico = [
    // o master tambem e varrido pela action nova: esta e a MESMA OS de cima
    { numeroOS: 'OS-2026-0742', cliente: 'Alessandra dos Reis', fonte: 'master' },
    { numeroOS: 'OS-2026-0535', cliente: 'Alessandra Soares de Souza rita', fonte: 'serie-antiga' },
    { numeroOS: 'OS-2026-0536', cliente: 'Alessandra Soares de Souza rita', fonte: 'serie-antiga' },
    { numeroOS: 'OS-2026-0572', cliente: 'Alessandra Soares de Souza rita', fonte: 'serie-antiga' }
  ];
  const novos = filtrarHistoricoNovos(doHistorico, listaPrincipal);
  assert.deepStrictEqual(novos.map((r) => r.numeroOS), ['OS-2026-0535', 'OS-2026-0536', 'OS-2026-0572']);
});

test('a OS que ja esta na lista de cima nao se repete no bloco de baixo', () => {
  const lista = [{ numeroOS: 'OS-2026-0864', cliente: 'Joao da Silva' }];
  const hist = [{ numeroOS: 'OS-2026-0864', cliente: 'Joao da Silva', fonte: 'master' }];
  assert.deepStrictEqual(filtrarHistoricoNovos(hist, lista), []);
});

test('dedup pelo NUMERO normalizado: as bases escrevem o mesmo numero diferente', () => {
  // master grava 'OS-2026-0535'; a aba manual da Sumare, digitada a mao, as
  // vezes tem so o numero — e as duas linhas sao a MESMA OS.
  const lista = [{ numeroOS: 'OS-2026-0535', cliente: 'Alessandra Soares de Souza rita' }];
  const hist = [
    { numeroOS: '535', cliente: 'ALESSANDRA SOARES DE SOUZA RITA', fonte: 'sumare-manual' },
    { numeroOS: 'os 2026 535', cliente: '  Alessandra  Soares de Souza Rita ', fonte: 'serie-antiga' },
    { numeroOS: 'OS-2026-0536', cliente: 'Alessandra Soares de Souza rita', fonte: 'serie-antiga' }
  ];
  assert.deepStrictEqual(filtrarHistoricoNovos(hist, lista).map((r) => r.numeroOS), ['OS-2026-0536']);
});

// ---------------------------------------------------------------------------
// FIX 3 (rodada 3): a chave de dedup e numero + CLIENTE, espelhando chaveDedupe_
// ---------------------------------------------------------------------------

test('FIX 3: CASO REAL — OS-2026-0034 e de DUAS clientes diferentes, e a antiga nao pode sumir', () => {
  // Inventario de 27/07: na serie antiga a OS-2026-0034 e da Simone Aparecida
  // dos Santos; no master o mesmo numero e de EDNA DE MARIA DA SILVA. O proprio
  // backend sabe que isso acontece (buscarOS devolve ambiguo:true). Com dedup so
  // por numero, a Simone sumia do bloco porque a Edna estava na lista de cima —
  // e a Simone era exatamente quem a atendente estava procurando.
  const lista = [{ numeroOS: 'OS-2026-0034', cliente: 'EDNA DE MARIA DA SILVA', status: 'Em andamento' }];
  const hist = [
    { numeroOS: 'OS-2026-0034', cliente: 'EDNA DE MARIA DA SILVA', fonte: 'master' },
    { numeroOS: 'OS-2026-0034', cliente: 'Simone Aparecida dos Santos', fonte: 'serie-antiga' }
  ];
  const novos = filtrarHistoricoNovos(hist, lista);
  assert.strictEqual(novos.length, 1);
  assert.strictEqual(novos[0].cliente, 'Simone Aparecida dos Santos');
  assert.strictEqual(novos[0].fonte, 'serie-antiga');
});

test('FIX 3: chaveDedupeBusca espelha o chaveDedupe_ do backend (numero|cliente normalizado)', () => {
  assert.strictEqual(chaveDedupeBusca('OS-2026-0034', 'Simone Aparecida dos Santos'), '34|simone aparecida dos santos');
  // mesma normalizacao do normalizarNomeAba_: acento, caixa e espaco repetido
  assert.strictEqual(chaveDedupeBusca('34', '  SIMONE   Aparecida dos SANTOS '), '34|simone aparecida dos santos');
  assert.strictEqual(chaveDedupeBusca('OS-2026-0034', 'José Antônio'), '34|jose antonio');
  // numeros diferentes com o mesmo cliente nao colidem, e vice-versa
  assert.notStrictEqual(
    chaveDedupeBusca('OS-2026-0034', 'EDNA DE MARIA DA SILVA'),
    chaveDedupeBusca('OS-2026-0034', 'Simone Aparecida dos Santos')
  );
  assert.notStrictEqual(
    chaveDedupeBusca('OS-2026-0034', 'Simone'),
    chaveDedupeBusca('OS-2026-0035', 'Simone')
  );
});

test('FIX 3: meia chave nao e chave — falta numero OU falta cliente devolve vazio', () => {
  assert.strictEqual(chaveDedupeBusca('', 'Simone'), '');
  assert.strictEqual(chaveDedupeBusca('sem numero', 'Simone'), '');
  assert.strictEqual(chaveDedupeBusca('OS-2026-0034', ''), '');
  assert.strictEqual(chaveDedupeBusca('OS-2026-0034', '   '), '');
  assert.strictEqual(chaveDedupeBusca('OS-2026-0034', null), '');
  assert.strictEqual(chaveDedupeBusca(null, null), '');
});

test('FIX 3: a chave sempre carrega o separador, entao nunca colide com o prototipo', () => {
  // 'toString', 'constructor' e afins nao sao chaves alcancaveis: todas tem '|'
  assert.ok(chaveDedupeBusca('OS-2026-0034', 'Simone').indexOf('|') !== -1);
  const lista = [{ numeroOS: 'toString', cliente: 'toString' }];
  const hist = [{ numeroOS: 'toString', cliente: 'toString' }];
  assert.strictEqual(filtrarHistoricoNovos(hist, lista).length, 1, 'sem numero valido nada e escondido');
});

test('chaveNumeroOSBusca segue a mesma regra do chaveNumeroOS_ do backend', () => {
  assert.strictEqual(chaveNumeroOSBusca('OS-2026-0535'), '535');
  assert.strictEqual(chaveNumeroOSBusca('535'), '535');
  assert.strictEqual(chaveNumeroOSBusca('os 2026 535 '), '535');
  assert.strictEqual(chaveNumeroOSBusca(535), '535');
  // sem digito no fim nao ha chave — e sem chave nada e escondido
  assert.strictEqual(chaveNumeroOSBusca(''), '');
  assert.strictEqual(chaveNumeroOSBusca(null), '');
  assert.strictEqual(chaveNumeroOSBusca(undefined), '');
  assert.strictEqual(chaveNumeroOSBusca('sem numero'), '');
});

test('registro sem numero OU sem cliente NUNCA e escondido (esconder por engano e pior que repetir)', () => {
  const lista = [
    { numeroOS: 'OS-2026-0742', cliente: 'Alessandra dos Reis' },
    { numeroOS: '', cliente: 'linha manual sem numero' },
    { numeroOS: 'OS-2026-0900', cliente: '' },
    {}
  ];
  const hist = [
    { numeroOS: '', cliente: 'linha manual sem numero' },        // sem numero
    { numeroOS: 'toString', cliente: 'lixo digitado a mao' },    // numero sem digito
    { cliente: 'sem campo numeroOS' },                           // idem
    { numeroOS: 'OS-2026-0900', cliente: '' },                   // sem cliente
    { numeroOS: 'OS-2026-0742' },                                // sem campo cliente
    { numeroOS: 'OS-2026-0742', cliente: '   ' }                 // cliente so espaco
  ];
  assert.strictEqual(filtrarHistoricoNovos(hist, lista).length, 6);
});

test('lista principal vazia devolve o historico inteiro', () => {
  const hist = [{ numeroOS: 'OS-2026-0535' }, { numeroOS: 'OS-2026-0536' }];
  assert.deepStrictEqual(filtrarHistoricoNovos(hist, []), hist);
  assert.deepStrictEqual(filtrarHistoricoNovos(hist, null), hist);
  assert.deepStrictEqual(filtrarHistoricoNovos(hist, undefined), hist);
});

test('historico vazio, nulo ou indefinido nao quebra', () => {
  assert.deepStrictEqual(filtrarHistoricoNovos([], [{ numeroOS: 'OS-2026-0001' }]), []);
  assert.deepStrictEqual(filtrarHistoricoNovos(null, [{ numeroOS: 'OS-2026-0001' }]), []);
  assert.deepStrictEqual(filtrarHistoricoNovos(undefined, undefined), []);
});

test('string solta na lista principal nao completa chave, entao nao esconde ninguem', () => {
  // Aceitar string continua sendo tolerancia de entrada, mas desde o FIX 3 a
  // chave exige numero E cliente — e uma string nao tem cliente. Quem chama de
  // verdade (os-lista.js) passa o `cache`, que tem os dois campos.
  const hist = [
    { numeroOS: 'OS-2026-0535', cliente: 'Alessandra Soares de Souza rita' },
    { numeroOS: 'OS-2026-0536', cliente: 'Alessandra Soares de Souza rita' }
  ];
  assert.strictEqual(filtrarHistoricoNovos(hist, ['OS-2026-0535']).length, 2);
  // com o objeto completo, ai sim esconde
  assert.deepStrictEqual(
    filtrarHistoricoNovos(hist, [{ numeroOS: 'OS-2026-0535', cliente: 'Alessandra Soares de Souza rita' }])
      .map((r) => r.numeroOS),
    ['OS-2026-0536']
  );
});

test('nao deduplica o historico contra ele mesmo (duas fontes = duas noticias)', () => {
  // a mesma OS aparecer no master E na serie antiga e informacao util: diz que
  // a linha foi copiada. Quem decide o que fazer com isso e a pessoa.
  const hist = [
    { numeroOS: 'OS-2026-0535', cliente: 'Alessandra Soares de Souza rita', fonte: 'serie-antiga' },
    { numeroOS: 'OS-2026-0535', cliente: 'Alessandra Soares de Souza rita', fonte: 'sumare-manual' }
  ];
  assert.strictEqual(filtrarHistoricoNovos(hist, []).length, 2);
});

test('nao muta as listas que recebe', () => {
  const lista = [{ numeroOS: 'OS-2026-0742', cliente: 'Alessandra dos Reis' }];
  const hist = [
    { numeroOS: 'OS-2026-0742', cliente: 'Alessandra dos Reis' },
    { numeroOS: 'OS-2026-0535', cliente: 'Alessandra Soares de Souza rita' }
  ];
  const copiaLista = JSON.parse(JSON.stringify(lista));
  const copiaHist = JSON.parse(JSON.stringify(hist));
  filtrarHistoricoNovos(hist, lista);
  assert.deepStrictEqual(lista, copiaLista);
  assert.deepStrictEqual(hist, copiaHist);
});

test('FIACAO: o historico e consultado em TODA busca, e o dedup esta ligado no render', () => {
  // A funcao pura acima nao prova nada se o os-lista.js nao a chamar. Este
  // teste le a fonte do front (nao da pra montar DOM aqui) e guarda as duas
  // pontas da correcao: a condicao que voltou a esconder o bloco e o dedup.
  const fs = require('fs');
  const path = require('path');
  const front = fs.readFileSync(path.join(__dirname, '..', 'os-lista.js'), 'utf8');

  assert.ok(/if \(filtros && filtros\.busca\) buscarHistorico\(filtros\.busca, cache\);/.test(front),
    'a busca no historico tem que sair sempre que houver texto digitado');
  assert.strictEqual(/cache\.length === 0\) buscarHistorico/.test(front), false,
    'a regra antiga ("so quando a lista der zero") deixava o bloco inalcancavel');
  assert.ok(/filtrarHistoricoNovos\(d\.resultados, listaAtual\)/.test(front),
    'sem o dedup, a lista principal seria repetida no bloco de baixo');
  assert.ok(/if \(!novos\.length\) \{ limparHistorico\(\); return; \}/.test(front),
    'se o dedup nao deixar nada, o bloco nao pode ser desenhado vazio');
});

test('CORRIDA (rodada 3): a ultima busca ganha — resposta atrasada nao pinta nem apaga o bloco', () => {
  // Duas buscas rapidas ('ales' Enter, apaga, 'silva' Enter) sao dois GET sem
  // ordem de chegada garantida. Sem guarda, a resposta da busca ANTIGA chegando
  // depois pintava o bloco com o resultado errado, embaixo da lista certa.
  const fs = require('fs');
  const path = require('path');
  const front = fs.readFileSync(path.join(__dirname, '..', 'os-lista.js'), 'utf8').replace(/\r/g, '');

  assert.ok(/\n {2}var seqHistorico = 0;/.test(front), 'falta o contador de sequencia');
  assert.ok(/function limparHistorico\(\) \{\n\s*seqHistorico\+\+;/.test(front),
    'limpar o bloco tem que cancelar o que ainda estiver voando');

  const ini = front.indexOf('function buscarHistorico(');
  assert.notStrictEqual(ini, -1, 'nao achei buscarHistorico');
  const corpo = front.slice(ini, front.indexOf('function histCardHTML('));

  assert.ok(/var token = \+\+seqHistorico;/.test(corpo), 'cada busca tem que levar um token crescente');

  // Escopo: SO o callback que trata a resposta. O limparHistorico() do
  // early-exit sincrono (`if (!termo)`) e legitimo e vem antes de tudo — nao
  // pode contar como "limpou sem checar a sequencia".
  const handler = corpo.slice(corpo.indexOf('.then(function(d) {'));
  const guarda = handler.indexOf('if (token !== seqHistorico) return;');
  assert.notStrictEqual(guarda, -1, 'a resposta tem que checar se ainda e a busca atual');

  // A guarda vem ANTES de qualquer decisao sobre o bloco: a resposta velha nao
  // pode desenhar e tambem nao pode limpar o resultado certo que ja esta na tela.
  assert.ok(guarda < handler.indexOf('respostaHistoricoUtilizavel(d)'),
    'a guarda tem que vir antes de avaliar a resposta');
  assert.ok(guarda < handler.indexOf('renderHistorico(d, listaAtual)'),
    'a guarda tem que vir antes de desenhar');
  assert.ok(guarda < handler.indexOf('limparHistorico();'),
    'a guarda tem que vir antes de limpar');

  // o mesmo vale pro erro de rede: uma falha velha nao apaga uma busca nova
  assert.ok(/\.catch\(function\(\) \{ if \(token === seqHistorico\) limparHistorico\(\); \}\);/.test(corpo),
    'o catch tambem tem que respeitar a sequencia');
});

// ===========================================================================
// CORRIDA — BANCADA QUE RODA O buscarHistorico DE VERDADE (rodada 4, 28/07)
// ===========================================================================
// Ate aqui existia neste ponto um teste que reimplementava o protocolo do token
// DENTRO do proprio teste (`let seq = 0; function buscar(...)`) e fazia
// assercoes sobre essa copia. Ele nao lia os-lista.js e nao importava nada de
// producao: passava verde com a guarda de sequencia REMOVIDA do codigo real.
// Teste que nao pode falhar e pior que teste nenhum — da a seguranca sem dar a
// protecao. Foi trocado por esta bancada.
//
// O argumento de que "o codigo la e inseparavel do fetch" nao se sustenta: fetch
// e document sao injetaveis, do mesmo jeito que SpreadsheetApp e LockService sao
// injetados nos testes do backend (tests/status-os.test.js). O corpo REAL de
// buscarHistorico e limparHistorico e extraido da fonte e avaliado com
// new Function, junto com a declaracao de seqHistorico — que e o estado que o
// protocolo inteiro usa. O que roda abaixo e o codigo do arquivo, nao um primo.
//
// O `fetch` falso nao resolve sozinho: cada chamada entra numa fila e o teste
// decide QUEM responde primeiro. E assim que a corrida (busca antiga chegando
// depois da nova) vira um caso determinista em vez de um flake.

function bancadaHistorico() {
  const fs = require('fs');
  const path = require('path');
  const front = fs.readFileSync(path.join(__dirname, '..', 'os-lista.js'), 'utf8').replace(/\r/g, '');

  // As funcoes vivem indentadas dentro do IIFE do arquivo, entao o corte e na
  // primeira '}' em inicio de linha COM os 2 espacos do bloco — o mesmo criterio
  // dos outros testes de contrato, ajustado pra indentacao.
  function corpoIndentado(nome) {
    const ini = front.indexOf('  function ' + nome + '(');
    assert.notStrictEqual(ini, -1, 'nao achei function ' + nome + ' em os-lista.js');
    const fim = front.indexOf('\n  }', ini);
    assert.notStrictEqual(fim, -1, 'nao achei o fim de ' + nome);
    return front.slice(ini, fim + 4);
  }

  const decSeq = front.match(/^ {2}var seqHistorico = 0;$/m);
  assert.ok(decSeq, 'nao achei a declaracao de seqHistorico — o protocolo inteiro depende dela');

  const pendentes = [];
  const pintados = [];
  const div = { innerHTML: '<div>bloco anterior</div>' };

  function fetchFalso(url) {
    return new Promise(function(resolve, reject) {
      pendentes.push({
        url: url,
        // responde com o payload que o teste quiser, na hora que o teste quiser
        responder: function(payload) {
          resolve({ json: function() { return Promise.resolve(payload); } });
        },
        falhar: function() { reject(new Error('rede caiu')); }
      });
    });
  }

  const mod = new Function(
    'document', 'fetch', 'URL_API', 'respostaHistoricoUtilizavel', 'renderHistorico',
    decSeq[0] + '\n' + corpoIndentado('limparHistorico') + '\n' + corpoIndentado('buscarHistorico') +
    '\nreturn { buscarHistorico: buscarHistorico, limparHistorico: limparHistorico };'
  )(
    { getElementById: function(id) { return id === 'osHistorico' ? div : null; } },
    fetchFalso,
    'https://exemplo/api',
    // a lib de producao, nao um stub: e ela que decide se a resposta serve
    respostaHistoricoUtilizavel,
    // renderHistorico e a fronteira de "pintou": espiao, porque o que este teste
    // fiscaliza e QUEM pode pintar, nao o HTML que sai.
    function(d, listaAtual) {
      pintados.push({ marca: d.marca, listaAtual: listaAtual });
      div.innerHTML = 'PINTADO:' + d.marca;
    }
  );

  return {
    buscarHistorico: mod.buscarHistorico,
    limparHistorico: mod.limparHistorico,
    pendentes: pendentes,
    pintados: pintados,
    div: div,
    ultimaMarca: function() { return pintados.length ? pintados[pintados.length - 1].marca : null; }
  };
}

// Payload bom, marcado pra dar pra dizer QUAL busca pintou o bloco.
function respostaBoa(marca) {
  return { ok: true, resultados: [{ numeroOS: 'OS-2026-0001', cliente: marca }], total: 1, marca: marca };
}
// Como "resposta inutilizavel" a bancada usa o RESPOSTA_V45 declarado la em cima
// — o payload REAL medido contra a v45 em producao. Reaproveitar em vez de
// redeclarar mantem um fixture so: se a v45 mudar, os dois blocos mudam juntos.

// Deixa as promises resolverem (fetch -> .json() -> handler sao 2+ microtasks).
const escoar = () => new Promise((r) => setImmediate(r));

test('CORRIDA: a bancada roda o buscarHistorico REAL do os-lista.js (nao uma copia)', async () => {
  // Se esta bancada parar de montar, os quatro testes abaixo nao provam nada —
  // entao ela mesma e verificada: sai o GET certo, com a action e o termo certos.
  const t = bancadaHistorico();
  t.buscarHistorico('ales', []);
  assert.strictEqual(t.pendentes.length, 1, 'buscarHistorico real tem que disparar um GET');
  assert.strictEqual(t.pendentes[0].url,
    'https://exemplo/api?action=buscar_os_historico&q=ales');

  t.pendentes[0].responder(respostaBoa('ales'));
  await escoar();
  assert.strictEqual(t.ultimaMarca(), 'ales', 'o caminho feliz tem que pintar');
});

test('CORRIDA: resposta ATRASADA nao repinta o bloco da busca nova', async () => {
  // 'ales' Enter, apaga, 'silva' Enter: dois GET sem ordem de chegada garantida.
  const t = bancadaHistorico();
  t.buscarHistorico('ales', []);
  t.buscarHistorico('silva', []);
  assert.strictEqual(t.pendentes.length, 2);

  t.pendentes[1].responder(respostaBoa('silva'));   // a nova responde primeiro
  await escoar();
  assert.strictEqual(t.ultimaMarca(), 'silva');

  t.pendentes[0].responder(respostaBoa('ales'));    // a ANTIGA chega depois
  await escoar();
  assert.strictEqual(t.pintados.length, 1, 'a resposta antiga repintou o bloco');
  assert.strictEqual(t.div.innerHTML, 'PINTADO:silva');
});

test('CORRIDA: resposta ATRASADA e inutilizavel nao APAGA o resultado certo', async () => {
  // Este e o lado que mais engana: a resposta velha nao pinta nada, mas se ela
  // puder chamar limparHistorico apaga o bloco que a busca nova acabou de
  // desenhar — e a tela fica vazia sem ninguem entender por que.
  const t = bancadaHistorico();
  t.buscarHistorico('ales', []);
  t.buscarHistorico('silva', []);

  t.pendentes[1].responder(respostaBoa('silva'));
  await escoar();
  assert.strictEqual(t.div.innerHTML, 'PINTADO:silva');

  t.pendentes[0].responder(RESPOSTA_V45);           // velha, e sem `resultados`
  await escoar();
  assert.strictEqual(t.div.innerHTML, 'PINTADO:silva', 'a resposta antiga apagou o bloco');
});

test('CORRIDA: falha de rede ATRASADA nao apaga o resultado certo (o catch tambem conta)', async () => {
  const t = bancadaHistorico();
  t.buscarHistorico('ales', []);
  t.buscarHistorico('silva', []);

  t.pendentes[1].responder(respostaBoa('silva'));
  await escoar();
  assert.strictEqual(t.div.innerHTML, 'PINTADO:silva');

  t.pendentes[0].falhar();                          // a busca velha falhou
  await escoar();
  assert.strictEqual(t.div.innerHTML, 'PINTADO:silva', 'a falha antiga apagou o bloco');
});

test('CORRIDA: limpar o bloco cancela o que ainda estava voando', async () => {
  // limparHistorico incrementa a sequencia de proposito: sem isso, a resposta em
  // voo repintaria exatamente o que a tela acabou de limpar (filtro trocado,
  // campo apagado). E o caso que nao tem "busca nova" pra invalidar a antiga.
  const t = bancadaHistorico();
  t.buscarHistorico('ales', []);
  t.limparHistorico();
  assert.strictEqual(t.div.innerHTML, '');

  t.pendentes[0].responder(respostaBoa('ales'));
  await escoar();
  assert.deepStrictEqual(t.pintados, [], 'a resposta em voo repintou um bloco ja limpo');
  assert.strictEqual(t.div.innerHTML, '');
});

test('CORRIDA: controle positivo — a busca ATUAL manda no bloco (pinta, limpa e falha)', async () => {
  // Sem estes tres, uma guarda quebrada pra "nunca faz nada" passaria em todos
  // os testes acima: eles so provam que a resposta VELHA nao age.
  const pintou = bancadaHistorico();
  pintou.buscarHistorico('silva', []);
  pintou.pendentes[0].responder(respostaBoa('silva'));
  await escoar();
  assert.strictEqual(pintou.div.innerHTML, 'PINTADO:silva');

  // resposta inutilizavel da busca ATUAL: tem que limpar
  const limpou = bancadaHistorico();
  limpou.buscarHistorico('silva', []);
  limpou.pendentes[0].responder(RESPOSTA_V45);
  await escoar();
  assert.deepStrictEqual(limpou.pintados, []);
  assert.strictEqual(limpou.div.innerHTML, '');

  // erro de rede da busca ATUAL: tem que limpar
  const falhou = bancadaHistorico();
  falhou.buscarHistorico('silva', []);
  falhou.pendentes[0].falhar();
  await escoar();
  assert.strictEqual(falhou.div.innerHTML, '');
});

test('CORRIDA: busca sem texto limpa na hora e nem chega a sair da tela', async () => {
  const t = bancadaHistorico();
  t.buscarHistorico('', []);
  assert.deepStrictEqual(t.pendentes, [], 'termo vazio nao pode virar GET');
  assert.strictEqual(t.div.innerHTML, '');
});

test('CORRIDA: a lista principal daquela busca viaja junto pro dedup', async () => {
  // renderHistorico recebe a listaAtual de QUEM pediu — se a guarda deixasse a
  // resposta velha passar, o dedup rodaria contra a lista errada tambem.
  const t = bancadaHistorico();
  const lista = [{ numeroOS: 'OS-2026-0007' }];
  t.buscarHistorico('silva', lista);
  t.pendentes[0].responder(respostaBoa('silva'));
  await escoar();
  assert.strictEqual(t.pintados.length, 1);
  assert.strictEqual(t.pintados[0].listaAtual, lista);
});

// ---------------------------------------------------------------------------
// A copia dentro de google-apps-script.js tem que ser identica a desta lib.
// O backend e um arquivo unico colado no editor do Apps Script — nao da require
// nesta pasta, entao as funcoes vivem duplicadas (mesmo arranjo de
// pareceNumeroOS / lib/os-numero.js). Este teste existe pra a copia nao
// envelhecer em silencio: se alguem consertar so um lado, quebra aqui.
// ---------------------------------------------------------------------------

test('as copias em google-apps-script.js batem com as desta lib', () => {
  const fs = require('fs');
  const path = require('path');
  const gas = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8');
  const lib = fs.readFileSync(path.join(__dirname, '..', 'lib', 'busca-texto.js'), 'utf8');

  function corpo(fonte, nome) {
    const ini = fonte.indexOf('function ' + nome + '(');
    assert.notStrictEqual(ini, -1, 'nao achei function ' + nome);
    // fecha na primeira '}' em inicio de linha depois da abertura
    const fim = fonte.indexOf('\n}', ini);
    assert.notStrictEqual(fim, -1, 'nao achei o fim de ' + nome);
    return fonte.slice(ini, fim + 2).replace(/\r/g, '');
  }

  ['normalizarTextoBusca', 'termosDaBusca', 'textoCasaTermos', 'montarTextoBusca'].forEach((nome) => {
    assert.strictEqual(corpo(gas, nome), corpo(lib, nome),
      nome + ' divergiu entre google-apps-script.js e lib/busca-texto.js');
  });
});

test('buscarOSHistorico nao devolve status para item nenhum (guarda de escopo)', () => {
  // A serie antiga nao tem coluna de status e atualizarStatusOS so escreve no
  // master. Se um `status:` aparecer no retorno desta funcao, a tela vai acabar
  // oferecendo um seletor que nao tem onde gravar. Este teste le a FONTE do
  // backend porque nao da pra executar Apps Script aqui.
  const fs = require('fs');
  const path = require('path');
  const gas = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script.js'), 'utf8');

  const ini = gas.indexOf('function buscarOSHistorico(');
  assert.notStrictEqual(ini, -1, 'buscarOSHistorico nao existe no backend');
  // '\n}' (a primeira '}' em inicio de linha), nunca '\r\n}': o mesmo corte do
  // teste irmao logo acima. Com '\r\n}' hardcoded o teste dependia do arquivo
  // estar em CRLF — bastava um checkout com autocrlf=input, um editor que
  // normaliza, ou o arquivo virar LF pra este guard sumir sem ninguem ver
  // (indexOf devolveria -1 e o teste falharia por um motivo que nao e o que ele
  // fiscaliza). '\n}' casa nos dois finais de linha, porque '\r\n}' contem
  // '\n}'. O \r sai depois, no slice.
  const fim = gas.indexOf('\n}', ini);
  assert.notStrictEqual(fim, -1, 'nao achei o fim de buscarOSHistorico');
  const corpo = gas.slice(ini, fim + 2).replace(/\r/g, '');

  assert.strictEqual(/(^|[\s{,])status\s*:/.test(corpo), false,
    'buscarOSHistorico voltou a devolver campo status');

  // e as tres fontes continuam sendo varridas, cada uma com o seu rotulo
  ["'master'", "'serie-antiga'", "'sumare-manual'"].forEach((fonte) => {
    assert.ok(corpo.indexOf('fonte: ' + fonte) !== -1, 'faltou a fonte ' + fonte);
  });

  // as abas com espaco parasita SO podem ser achadas por encontrarAbaNormalizada_
  assert.ok(corpo.indexOf('encontrarAbaNormalizada_(ABA_ESPELHO_PARCEIRAS)') !== -1);
  assert.ok(corpo.indexOf('encontrarAbaNormalizada_(ABA_ESPELHO_SUMARE)') !== -1);
  assert.strictEqual(corpo.indexOf('getSheetByName(ABA_ESPELHO_'), -1,
    'getSheetByName devolve null nas abas com espaco parasita — use encontrarAbaNormalizada_');
});
