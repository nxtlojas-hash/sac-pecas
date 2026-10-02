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

// ---------------------------------------------------------------------------
// 30/09 (tarde): a PLANILHA (aba Pecas) passa a mandar na lista de pecas.
// Motivo, medido com o retorno da Jacque: 267 das 384 pecas-base moravam so
// em data.js — excluir "dava ok e voltava", e o Admin editava por NOME em
// todos os modelos de uma vez. Uma linha por modelo na planilha resolve os dois.
// ---------------------------------------------------------------------------

// O que falta na planilha, a partir de data.js. Foto so vai se o arquivo existe.
function linhasParaMigrar(dataJs, planilha, existeArquivo) {
  var na = {};
  (planilha || []).forEach(function(r) { na[String(r.modelo || '').toLowerCase() + '|' + chaveNome(r.nome)] = true; });
  var out = [];
  Object.keys(dataJs || {}).forEach(function(id) {
    var m = dataJs[id];
    (m.pecas || []).forEach(function(p) {
      if (na[id.toLowerCase() + '|' + chaveNome(p.nome)]) return;
      var img = String(p.img || '');
      out.push({
        modelo: id, modeloNome: m.nome, nome: p.nome,
        preco: (p.preco == null) ? null : p.preco,
        peso: p.peso || '',
        img: (img && existeArquivo && existeArquivo(img)) ? img : ''
      });
    });
  });
  return out;
}

// As linhas da planilha viram a lista de cada modelo (id em minusculas).
// Repetida (mesmo modelo + nome): a ultima linha vale.
function pecasDaPlanilhaPorModelo(linhas) {
  var por = {};
  (linhas || []).forEach(function(r) {
    var id = String(r.modelo || '').toLowerCase();
    if (!id) return;
    if (!por[id]) por[id] = {};
    var preco = (r.preco == null || r.preco === '') ? null : parseFloat(r.preco);
    por[id][chaveNome(r.nome)] = { nome: r.nome, preco: isNaN(preco) ? null : preco, peso: r.peso || null, img: r.img || '' };
  });
  var out = {};
  Object.keys(por).forEach(function(id) {
    out[id] = Object.keys(por[id]).map(function(k) { return por[id][k]; });
  });
  return out;
}

function jaExisteNoModelo(nome, pecas) {
  return !!acharPorNome(pecas, nome);
}

// Os modelos do seletor da montadora. 02/10: o seletor era montado antes de a
// planilha chegar e so mostrava os 6 modelos com peca no data.js — Gataka,
// Hyphen, V0, Jay, Vega, Juna, Pancho e Akasha (so na planilha) sumiam. A tela
// chama de novo depois de applySheetsParts.
function modelosDaMontadora(catalogo) {
  if (!catalogo) return [];
  return Object.keys(catalogo).filter(function(id) {
    return id !== 'outro' && (catalogo[id].pecas || []).length > 0;
  }).sort(function(a, b) {
    return String(catalogo[a].nome).localeCompare(String(catalogo[b].nome), 'pt-BR', { sensitivity: 'base' });
  });
}

// O item como vai para a planilha (aba Registros, coluna Pecas). 02/10: a marca
// foraDaLista ficava so na tela — sem ela, medir se a lista ajudou exigiu
// comparar nome por nome com o catalogo. modelId junto: o nome do modelo varia
// ("Juna  Antiga", "kay"), o id nao.
function itemParaRegistro(p) {
  return {
    descricao: p.descricao,
    modelo: p.modelo,
    modelId: p.modelId || '',
    cor: p.cor,
    tipoPreco: p.tipoPreco,
    quantidade: p.quantidade,
    precoUnitario: p.precoUnitario,
    total: p.total,
    peso: p.peso,
    pesoGramas: p.pesoGramas,
    img: p.img || '',
    imgManual: p.imgManual || '',
    isMaoDeObra: p.isMaoDeObra || false,
    foraDaLista: p.foraDaLista === true
  };
}

if (typeof module !== 'undefined') {
  module.exports = { chaveModeloEstoque, etiquetaSaldo, validarPecaDoPedido, baixaEstoqueDoItem, linhasMontadora,
    chaveNome, linhasParaMigrar, pecasDaPlanilhaPorModelo, jaExisteNoModelo, modelosDaMontadora, itemParaRegistro };
}
