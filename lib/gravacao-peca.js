// O que fazer com a resposta do servidor ao gravar uma peca do catalogo.
//
// Nasceu em 29/09/2026: a montadora nao conseguia por foto no catalogo —
// "esta com erro". Medido: 267 das 384 pecas de data.js NUNCA
// foram para a aba Pecas. A tela mostra todas, mas o 'editar' do servidor so
// procura na planilha e devolvia "Peca nao encontrada para editar". A foto
// chegava a ser guardada no Drive e ficava orfa.
//
// As regras moram aqui, e nao soltas no admin.js, para ter teste.

// Endereco que so existe neste navegador nao pode ir para a planilha.
// 'blob:' e a previa local da foto; se a guarda no Drive falhar, e ele que
// sobra em peca.img — e gravado, vira imagem quebrada para todo mundo.
function enderecoSoLocal(img) {
  return /^(blob:|data:)/i.test(String(img || ''));
}

// A imagem que vai no pedido: a da peca; se for so local, a que ela tinha antes.
function imgParaGravar(img, imgAnterior) {
  if (!enderecoSoLocal(img)) return String(img || '');
  return enderecoSoLocal(imgAnterior) ? '' : String(imgAnterior || '');
}

// 'editar' recusado porque a peca ainda nao esta na planilha (so em data.js).
// Nesse caso a tela cadastra a peca e segue, em vez de mostrar erro.
function faltaNaPlanilha(acao, resp) {
  if (acao !== 'editar' || !resp || resp.sucesso !== false) return false;
  return /nao encontrada para editar/i.test(String(resp.erro || ''));
}

// O nome foi trocado nesta edicao? Peca que so existe em data.js NAO pode
// trocar de nome: o nome antigo continua no arquivo-base e, cadastrando o
// novo, a peca apareceria DUAS vezes no catalogo de todo mundo.
function trocouDeNome(nome, nomeOriginal) {
  if (!nomeOriginal) return false;
  return String(nome || '').trim().toLowerCase() !== String(nomeOriginal).trim().toLowerCase();
}

function recusaTrocaDeNome(nomeOriginal) {
  return 'esta peça vem do arquivo-base e o nome dela não pode ser trocado por aqui. ' +
    'Salve de novo com o nome "' + nomeOriginal + '". Foto, preço e peso podem mudar.';
}

// O aviso que a pessoa precisa ler. Vazio = deu tudo certo.
// Sem resposta (internet, pagina de erro do Google) NAO e sucesso — mas pode
// ter gravado: por isso manda CONFERIR antes de salvar de novo (senao duplica).
function avisoDaGravacao(resp, mandouFoto) {
  if (!resp) {
    return 'O servidor não respondeu. Atualize a página e CONFIRA se a peça foi gravada antes de salvar de novo.';
  }
  if (resp.sucesso === false) {
    return 'A peça NÃO foi gravada: ' + (resp.erro || 'erro desconhecido');
  }
  if (mandouFoto && !resp.imagemUrl) {
    return 'A peça foi gravada, mas a FOTO não foi guardada. Abra a peça e envie a foto de novo.';
  }
  return '';
}

if (typeof module !== 'undefined') {
  module.exports = { enderecoSoLocal, imgParaGravar, faltaNaPlanilha, trocouDeNome, recusaTrocaDeNome, avisoDaGravacao };
}
