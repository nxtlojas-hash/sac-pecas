// Confirmacao de/para dos dois pontos de escrita direta do Admin
// (Task 5 reorg 2026-07-28).
//
// Por que existe: dois cliques gravavam na hora, sem perguntar nada e sem
// deixar rastro:
//   1. o lapis dentro do cartao da peca no catalogo (catalogo.js -> admin.js
//      openEditFromCatalog -> saveAdminPart), que reescreve PRECO e PESO em
//      TODOS os modelos onde aquela peca existe;
//   2. o clique no numero do saldo na aba Estoque do Admin (admin.js
//      renderEstoqueTable -> salvarEstoqueItem), que reescreve o estoque.
// Nos dois, um digito a mais no teclado vira preco errado na rua (ou saldo
// errado no balcao) sem ninguem ver acontecer.
//
// DECISAO DA DONA DO PRODUTO (28/07): os dois pontos NAO foram removidos —
// preco e saldo ganharam CONFIRMACAO. Sumir com eles deixaria a equipe sem
// como corrigir um preco errado, que e pior que o risco de errar.
//
// O que este arquivo decide (e nada mais):
//   - o que de fato MUDOU (comparando valor antigo x novo do jeito certo para
//     cada tipo: dinheiro, texto e inteiro nao se comparam igual);
//   - se ha algo a confirmar, ou se a gravacao segue direto;
//   - se NAO ha nada a gravar (valor novo igual ao antigo), caso em que a tela
//     nem pergunta: nao grava e diz que nada mudou — o mesmo guard que a tela
//     de OS ja usa no Salvar status (lib/status-os.js: o status real sempre vem
//     selecionado, justamente para um clique distraido nao reescrever o que ja
//     estava la);
//   - o TEXTO que a pessoa apressada vai ler, com nome do item, campo, DE
//     quanto PARA quanto e a quem aquilo afeta.
//
// PURA de proposito: nao le DOM, nao faz fetch, nao abre modal. E o que permite
// testar em node:test a decisao mais cara de errar (gravar sem perguntar, ou
// perguntar e gravar mesmo com "Cancelar") sem subir navegador. Quem desenha o
// modal e trata os botoes e o admin.js.
//
// NAO usa Intl/toLocaleString de proposito: o texto da confirmacao e comparado
// caractere a caractere nos testes e precisa sair igual em qualquer maquina,
// navegador antigo do balcao incluso.

// Frase de escopo padrao — a peca vive em varios modelos e o preco e um so.
var ESCOPO_TODO_MUNDO = 'Isso vale para todo mundo.';

// Escopo do saldo: nao e "todo mundo" no sentido de varios modelos, e sim o
// numero que todas as telas leem (catalogo, Admin e a conferencia do balcao).
var ESCOPO_SALDO = 'É o saldo que todas as telas leem.';

// R$ no formato brasileiro, sem Intl. `null`/`undefined`/vazio nao e zero: e
// "sem preco" — peca sem preco cadastrado existe no catalogo (openAdminPartModal
// deixa o campo em branco), e mostrar "R$ 0,00" no lugar faria a confirmacao
// mentir sobre o valor antigo.
function formatarMoedaBR(v) {
  var n = numeroOuNulo(v);
  if (n === null) return 'sem preço';
  var neg = n < 0;
  var fixo = Math.abs(n).toFixed(2);
  var partes = fixo.split('.');
  var inteiro = partes[0];
  var comMilhar = '';
  while (inteiro.length > 3) {
    comMilhar = '.' + inteiro.slice(-3) + comMilhar;
    inteiro = inteiro.slice(0, -3);
  }
  comMilhar = inteiro + comMilhar;
  return 'R$ ' + (neg ? '-' : '') + comMilhar + ',' + partes[1];
}

// Aceita numero ou o texto que veio do campo ("1.234,56"). Devolve null quando
// nao da para ler um numero — inclusive para NaN, para "sem preco" e "preco
// ilegivel" cairem no mesmo lugar em vez de virar 0.
function numeroOuNulo(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var s = String(v).trim();
  if (!s) return null;
  // Formato brasileiro: ponto e milhar, virgula e decimal.
  var n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function inteiroOuZero(v) {
  var n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

function textoLimpo(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

// Como cada tipo aparece na frase.
function textoDoValor(tipo, valor) {
  if (tipo === 'moeda') return formatarMoedaBR(valor);
  if (tipo === 'inteiro') return String(inteiroOuZero(valor));
  var t = textoLimpo(valor);
  return t || 'em branco';
}

// Os dois valores sao o MESMO valor?
//
// 'moeda': compara com 2 casas. O campo do modal so mostra e so aceita 2 casas
// (formatarValor/parseMoeda em app.js), entao um preco gravado como 890.005
// reaparece no campo como "890,01" e voltaria do formulario como 890.01. Sem o
// arredondamento, abrir o modal e salvar sem tocar em nada seria contado como
// alteracao de preco — a confirmacao viraria ruido e a pessoa aprenderia a
// clicar "Confirmar" sem ler, que e o oposto do que esta task existe para
// fazer.
//
// 'texto' (peso): compara com trim e SEM mexer na caixa. Espaco em volta e
// digitacao, nao decisao; ja trocar "55gr" por "55GR" e uma edicao de verdade
// que a pessoa fez de proposito e merece aparecer.
function mesmoValor(tipo, de, para) {
  if (tipo === 'moeda') {
    var a = numeroOuNulo(de);
    var b = numeroOuNulo(para);
    if (a === null || b === null) return a === b;
    return Math.round(a * 100) === Math.round(b * 100);
  }
  if (tipo === 'inteiro') return inteiroOuZero(de) === inteiroOuZero(para);
  return textoLimpo(de) === textoLimpo(para);
}

// Filtra a lista de campos, devolvendo SO os que mudaram de verdade, ja com o
// texto de cada lado pronto para a frase.
//
// campos: [{ campo, rotulo, tipo, de, para }]
//   tipo: 'moeda' | 'inteiro' | 'texto' (default 'texto')
function listarMudancas(campos) {
  var lista = [];
  campos = campos || [];
  for (var i = 0; i < campos.length; i++) {
    var c = campos[i];
    if (!c) continue;
    var tipo = c.tipo || 'texto';
    if (mesmoValor(tipo, c.de, c.para)) continue;
    lista.push({
      campo: c.campo,
      rotulo: c.rotulo || c.campo,
      tipo: tipo,
      de: c.de,
      para: c.para,
      deTexto: textoDoValor(tipo, c.de),
      paraTexto: textoDoValor(tipo, c.para)
    });
  }
  return lista;
}

// "preço R$ 890,00 → R$ 950,00"
function fraseDaMudanca(m) {
  return m.rotulo + ' ' + m.deTexto + ' → ' + m.paraTexto;
}

// Frase de escopo quando a peca vive em varios modelos. Dizer QUAIS modelos
// (e nao so "todo mundo") e o que deixa a pessoa perceber que esta mexendo em
// mais lugares do que o cartao que ela abriu.
function escopoModelos(nomes) {
  var lista = [];
  nomes = nomes || [];
  for (var i = 0; i < nomes.length; i++) {
    var n = textoLimpo(nomes[i]);
    if (n && lista.indexOf(n) === -1) lista.push(n);
  }
  if (!lista.length) return ESCOPO_TODO_MUNDO;
  if (lista.length === 1) return 'Isso vale para todo mundo — a peça está em ' + lista[0] + '.';
  return 'Isso vale para todo mundo — a peça está em ' + lista.length +
    ' modelos: ' + lista.join(', ') + '.';
}

// Aviso da remocao (a peca sai de modelos que estavam marcados antes). Continua
// sendo uma pergunta, como ja era; o que mudou e que agora ela chega junto com
// o de/para, num modal so, em vez de um confirm() nativo em cima do outro.
function avisoRemocaoModelos(nomes) {
  var lista = [];
  nomes = nomes || [];
  for (var i = 0; i < nomes.length; i++) {
    var n = textoLimpo(nomes[i]);
    if (n && lista.indexOf(n) === -1) lista.push(n);
  }
  if (!lista.length) return '';
  return 'A peça será REMOVIDA de ' + lista.length + ' modelo(s): ' + lista.join(', ') + '.';
}

function mensagemNadaMudou(alvo) {
  var a = textoLimpo(alvo);
  return 'Nada mudou' + (a ? ' em ' + a : '') + ' — não gravei.';
}

// Monta o texto que a pessoa le no modal.
//
// Ordem: o que muda -> a quem afeta -> avisos -> a pergunta. Quem le so a
// primeira linha (a maioria, na correria) ja sai sabendo O QUE vai mudar e DE
// quanto PARA quanto, que e a informacao que evita o erro.
function montarTextoConfirmacao(alvo, mudancas, escopo, avisos) {
  mudancas = mudancas || [];
  avisos = avisos || [];
  var linhas = [];

  if (mudancas.length) {
    var frases = [];
    for (var i = 0; i < mudancas.length; i++) frases.push(fraseDaMudanca(mudancas[i]));
    linhas.push(frases.join('; ') + '.');
    var esc = textoLimpo(escopo);
    if (esc) linhas.push(esc);
  }

  for (var j = 0; j < avisos.length; j++) {
    var av = textoLimpo(avisos[j]);
    if (av) linhas.push(av);
  }

  linhas.push('Confirmar?');
  var a = textoLimpo(alvo);
  return (a ? a + ': ' : '') + linhas.join(' ');
}

// A decisao inteira, num objeto so.
//
// alvo   : como o item se chama para quem le ("Kay bateria 60V")
// campos : [{ campo, rotulo, tipo, de, para }] — os valores comparaveis
// opcoes : { escopo, avisos, outrasMudancas }
//   escopo         -> frase de "isso vale para..." (ver escopoModelos)
//   avisos         -> frases extras que TAMBEM exigem confirmacao (remocao)
//   outrasMudancas -> true quando algo fora de `campos` mudou (nome da peca,
//                     imagem nova, modelo acrescentado). Grava, mas nao inventa
//                     uma pergunta de/para que nao existe.
//
// Devolve { gravar, confirmar, mudancas, texto, mensagem }:
//   gravar=false   -> NAO grave nada e mostre `mensagem` ("nada mudou")
//   confirmar=true -> mostre `texto` e so grave se a pessoa confirmar
//   confirmar=false com gravar=true -> segue direto, como antes
//
// O caso `gravar:false` e o que impede a pergunta boba: reabrir o modal, nao
// mexer em nada e clicar em Salvar nao pode virar uma confirmacao (nem uma
// gravacao) — e e exatamente o que a mao no automatico faz o dia inteiro.
function decidirGravacao(alvo, campos, opcoes) {
  opcoes = opcoes || {};
  var mudancas = listarMudancas(campos);
  var avisos = [];
  var brutos = opcoes.avisos || [];
  for (var i = 0; i < brutos.length; i++) {
    var av = textoLimpo(brutos[i]);
    if (av) avisos.push(av);
  }

  if (!mudancas.length && !avisos.length && !opcoes.outrasMudancas) {
    return {
      gravar: false,
      confirmar: false,
      mudancas: [],
      texto: '',
      mensagem: mensagemNadaMudou(alvo)
    };
  }

  var confirmar = !!(mudancas.length || avisos.length);
  return {
    gravar: true,
    confirmar: confirmar,
    mudancas: mudancas,
    texto: confirmar ? montarTextoConfirmacao(alvo, mudancas, opcoes.escopo, avisos) : '',
    mensagem: ''
  };
}

// Exports aditivo: cada task acrescenta a sua funcao aqui sem mexer nas outras.
if (typeof module !== 'undefined') module.exports = {
  ESCOPO_TODO_MUNDO: ESCOPO_TODO_MUNDO,
  ESCOPO_SALDO: ESCOPO_SALDO,
  formatarMoedaBR: formatarMoedaBR,
  textoDoValor: textoDoValor,
  mesmoValor: mesmoValor,
  listarMudancas: listarMudancas,
  fraseDaMudanca: fraseDaMudanca,
  escopoModelos: escopoModelos,
  avisoRemocaoModelos: avisoRemocaoModelos,
  mensagemNadaMudou: mensagemNadaMudou,
  montarTextoConfirmacao: montarTextoConfirmacao,
  decidirGravacao: decidirGravacao
};
