// A montadora atualiza saldo e foto; o pedido escolhe a peca da lista.
//
// Nasceu em 30/09/2026. O Rafael (Jaragua) dizia que "nao da para atualizar
// estoque". MEDIDO: a tela existia (Admin > Estoque), mas ninguem nunca gravou
// contagem — 1.779 movimentacoes, todas baixa de venda. E contar nao adiantava:
// o atendente digita o nome da peca a mao e a venda baixa o nome digitado; das
// 902 linhas negativas da aba Estoque, so 99 tem nome do catalogo.
//
// As regras moram aqui, e nao soltas no front, para ter teste.

// O saldo e gravado com o NOME do modelo (CATALOGO_MODELOS[id].nome), porque
// e assim que a venda baixa (formulario.js, baixaEstoqueVenda: p.modelo). O
// Admin gravava pelo id ("juna-smart") e a venda por "JUNA SMART": duas linhas.
function chaveModeloEstoque(modelId, catalogo) {
  var m = catalogo && catalogo[modelId];
  return (m && m.nome) ? String(m.nome) : String(modelId || '');
}

// A etiqueta do catalogo. Negativo ou sem linha = ninguem contou: "Sem contagem".
// So depois de contar e que zero quer dizer "Indisponivel".
function etiquetaSaldo(info) {
  if (!info) return { classe: 'estoque-sem-info', texto: 'Sem contagem' };
  var j = parseInt(info.jaragua) || 0;
  var s = parseInt(info.sumare) || 0;
  var partes = [];
  if (j > 0) partes.push('Jaraguá: ' + j);
  if (s > 0) partes.push('Sumaré: ' + s);
  if (partes.length) return { classe: 'estoque-disponivel', texto: partes.join(' · ') };
  if (j < 0 || s < 0) return { classe: 'estoque-sem-info', texto: 'Sem contagem' };
  return { classe: 'estoque-indisponivel', texto: 'Indisponível' };
}

// Compara sem caixa e sem acento: "Modulo" e "Módulo" sao a mesma peca.
function chaveNome(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function acharPorNome(lista, nome) {
  var alvo = chaveNome(nome);
  for (var i = 0; i < (lista || []).length; i++) {
    if (chaveNome(lista[i].nome) === alvo) return lista[i];
  }
  return null;
}

// O que o pedido aceita como peca.
// - Da lista do modelo: aceita, com o nome COMO ESTA no catalogo (a contagem
//   da montadora usa esse nome; a baixa tem de cair na mesma linha).
// - Item global (mao de obra): aceita, fora da lista (nao e estoque).
// - Modelo "outro": nao tem lista, texto livre, fora da lista.
// - Fora da lista sem marcar: recusa e diz o que fazer.
function validarPecaDoPedido(p) {
  var descricao = String(p.descricao || '').trim();
  if (!descricao) return { erro: 'Informe a peça', descricao: '', foraDaLista: false };

  var global = acharPorNome(p.globais, descricao);
  if (global) return { erro: '', descricao: global.nome, foraDaLista: true };

  if (p.modelId === 'outro' || !p.catalogo || !p.catalogo[p.modelId]) {
    return { erro: '', descricao: descricao, foraDaLista: true };
  }

  var daLista = acharPorNome(p.catalogo[p.modelId].pecas, descricao);
  if (daLista) return { erro: '', descricao: daLista.nome, foraDaLista: false };

  if (p.foraDaLista) return { erro: '', descricao: descricao, foraDaLista: true };

  return {
    erro: 'Essa peça não está na lista do modelo. Escolha uma da lista ou, se ela não existe lá, marque "Peça fora da lista".',
    descricao: descricao,
    foraDaLista: false
  };
}

// So peca da lista baixa estoque. Fora da lista e mao de obra, nao.
// Item sem a marcacao (pedido de antes desta versao) segue como sempre foi.
function baixaEstoqueDoItem(item) {
  if (!item) return false;
  if (item.isMaoDeObra) return false;
  if (item.foraDaLista === true) return false;
  return true;
}

// As linhas da tela da montadora para um modelo: cada peca do catalogo com o
// saldo de Jaragua e a data da ultima gravacao. O saldo vem da linha que a
// VENDA baixa (nome do modelo); a do id so vale se a do nome nao existir.
function linhasMontadora(modelId, catalogo, estoque) {
  var m = catalogo && catalogo[modelId];
  if (!m) return [];
  var chaveNome = chaveModeloEstoque(modelId, catalogo).toLowerCase();
  var chaveId = String(modelId).toLowerCase();

  var porNome = {};
  var porId = {};
  (estoque || []).forEach(function(e) {
    var mod = String(e.modelo || '').toLowerCase();
    var peca = String(e.peca || '').toLowerCase();
    if (mod === chaveNome) porNome[peca] = e;
    else if (mod === chaveId) porId[peca] = e;
  });

  return (m.pecas || []).map(function(p, idx) {
    var k = String(p.nome || '').toLowerCase();
    var e = porNome[k] || porId[k] || null;
    var j = e ? (parseInt(e.jaragua) || 0) : 0;
    var s = e ? (parseInt(e.sumare) || 0) : 0;
    return {
      idx: idx,
      nome: p.nome,
      img: p.img || '',
      preco: (p.preco == null) ? null : p.preco,
      sumare: s,
      jaragua: j,
      contado: !!e && j >= 0,
      ultima: e ? String(e.ultimaAtualizacao || '') : ''
    };
  });
}

if (typeof module !== 'undefined') {
  module.exports = { chaveModeloEstoque, etiquetaSaldo, validarPecaDoPedido, baixaEstoqueDoItem, linhasMontadora };
}
