// Normalizacao e casamento de termos da busca livre (Task 4 reorg 2026-07-28).
//
// Por que existe: a busca da tela de OS (listarOS, google-apps-script.js) montava
// um `hay` e fazia hay.indexOf(busca) — substring CONTIGUA e SEM tirar acento.
// Dois furos provados em producao no dia 28/07:
//
//   1. 'Alessandra Rita' NAO acha 'Alessandra Soares de Souza rita'. A atendente
//      digitou o nome como o cliente se apresenta (primeiro + ultimo) e concluiu
//      que a OS nao existia. Existia: OS-2026-0535, 0536 e 0572.
//   2. 'goncalves' NUNCA acha 'GONÇALVES'. Ninguem digita cedilha na correria,
//      e meio cadastro tem acento.
//
// Regra desta lib: normaliza os DOIS lados (busca e conteudo) e exige que TODOS
// os termos aparecam, em QUALQUER ordem (AND). Continua substring por termo, que
// e o que faz 'ales' ainda achar 'Alessandra' — a equipe digita pedaco de nome.
//
// PURA de proposito: nao le planilha, nao le DOM, nao usa nada do Apps Script.
// Existe copia identica destas funcoes dentro de google-apps-script.js (mesmo
// arranjo de pareceNumeroOS / lib/os-numero.js): o backend e um arquivo unico
// colado no editor do Apps Script e nao consegue dar require nesta pasta. Se
// mexer aqui, mexa la tambem — os testes cobrem ESTA copia.

// Tira acento, baixa a caixa e achata espaco repetido.
// O par NFD + faixa U+0300-U+036F (marcas diacriticas combinantes) e exatamente
// o mesmo que normalizarNomeAba_ e etapaDoStatus_ ja usam no backend. Aqui vai
// escrito como \u0300-\u036f em vez do literal: o efeito e identico e o codigo
// nao depende de o editor preservar caracteres combinantes soltos.
function normalizarTextoBusca(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// Quebra o texto digitado em termos. 'Alessandra  RITA ' -> ['alessandra','rita'].
// Busca vazia (ou so espaco) -> [] — quem chama decide o que fazer com isso,
// ver textoCasaTermos.
function termosDaBusca(busca) {
  var n = normalizarTextoBusca(busca);
  if (!n) return [];
  return n.split(' ');
}

// Verdadeiro so quando TODOS os termos aparecem no texto, em qualquer ordem.
//
// Lista de termos VAZIA devolve FALSO, nao verdadeiro. E deliberado: a busca do
// historico varre ~1100 linhas de tres abas, e "nao digitei nada" nao pode virar
// "me devolve tudo". Quem quer a semantica oposta ("filtro vazio = nao filtra",
// que e o que listarOS sempre fez) testa `termos.length` antes de chamar — e e
// assim que listarOS chama.
function textoCasaTermos(texto, termos) {
  if (!termos || !termos.length) return false;
  var alvo = normalizarTextoBusca(texto);
  if (!alvo) return false;
  for (var i = 0; i < termos.length; i++) {
    if (alvo.indexOf(termos[i]) === -1) return false;
  }
  return true;
}

// Junta os campos pesquisaveis de um registro num texto so. Aceita null/undefined
// e numero (telefone e CPF chegam como number quando a celula e numerica).
function montarTextoBusca(campos) {
  campos = campos || [];
  var partes = [];
  for (var i = 0; i < campos.length; i++) {
    var c = campos[i];
    if (c == null) continue;
    var s = String(c);
    if (s) partes.push(s);
  }
  return partes.join(' ');
}

// A resposta de 'buscar_os_historico' da pra desenhar na tela?
//
// Existe por causa da janela de versoes: a v45 esta no ar AGORA e nao conhece a
// action. O roteador do Apps Script (doGet) nao devolve erro para action
// desconhecida — cai no default e responde, medido em 28/07 contra a v45:
//
//   {"status":"ok","message":"NXT Pecas API ativa"}
//
// Repare que tem "ok" no valor de OUTRO campo (`status`), nao um `ok:true`. Um
// guard preguicoso (`if (d.ok)`) ja passaria; `if (d && d.status)` entao passaria
// direto e a tela quebraria lendo d.resultados.map de undefined. Por isso a
// checagem e `ok === true` E `resultados` sendo array de verdade.
//
// Falso = a tela simplesmente NAO desenha o bloco do historico. Nada de mensagem
// de erro: enquanto o backend for v45 isso e o comportamento correto, nao falha.
function respostaHistoricoUtilizavel(d) {
  if (!d || d.ok !== true) return false;
  if (!d.resultados || Object.prototype.toString.call(d.resultados) !== '[object Array]') return false;
  return d.resultados.length > 0;
}

// ===== DEDUP DO BLOCO DE HISTORICO (rodada 2, 28/07) =====
// As duas funcoes abaixo sao SO DO FRONT: nao existe copia delas no
// google-apps-script.js e nao deve existir. O backend nao sabe (nem pode saber)
// o que a lista principal da tela esta mostrando naquele instante — quem tem
// essa informacao e o os-lista.js.

// Chave de comparacao de numero de OS. Mesma regra do chaveNumeroOS_ do backend
// (google-apps-script.js:2320): pega o ULTIMO grupo de digitos e derruba o zero
// a esquerda. 'OS-2026-0535', 'os 2026 535' e '535' viram todos '535'.
// Precisa ser assim porque as bases escrevem o mesmo numero de jeitos
// diferentes: o master grava 'OS-2026-0535' e a aba manual da Sumare, digitada
// a mao, as vezes tem so o numero.
// Sem digito nenhum devolve '' — e '' NUNCA e usado como chave de comparacao
// (ver filtrarHistoricoNovos), senao dois registros sem numero virariam "o
// mesmo registro".
function chaveNumeroOSBusca(v) {
  var m = String(v == null ? '' : v).match(/(\d+)\s*$/);
  return m ? String(parseInt(m[1], 10)) : '';
}

// Chave de dedup do bloco de historico. ESPELHA o chaveDedupe_ do backend
// (google-apps-script.js:2325), que e chaveNumeroOS_(numero) + '|' +
// normalizarNomeAba_(cliente).
//
// So o numero NAO serve (rodada 3, 28/07): o MESMO numero de OS existe para
// clientes DIFERENTES entre as bases. Prova viva — OS-2026-0034 e 'EDNA DE
// MARIA DA SILVA' no master e 'Simone Aparecida dos Santos' na serie antiga
// (inventario ao vivo de 27/07). O proprio backend ja sabe disso: buscarOS
// devolve `ambiguo:true` exatamente nesse caso, e chavesParceiras_ dedupa por
// numero+cliente pelo mesmo motivo. Deduplicando so pelo numero, a Simone
// sumia do bloco porque a Edna estava na lista de cima — o registro que a
// atendente procurava era justamente o escondido.
//
// O normalizador do cliente e o normalizarTextoBusca desta lib de proposito: e
// o MESMO algoritmo do normalizarNomeAba_ do backend (NFD, tira diacritico,
// lowercase, achata espaco, trim). Escrever uma terceira copia so criaria mais
// um lugar pra divergir.
//
// Devolve '' quando FALTA qualquer uma das duas metades. Chave pela metade nao
// prova identidade nenhuma: quem so tem numero (ou so nome) nao esconde nada e
// nunca e escondido.
function chaveDedupeBusca(numero, cliente) {
  var n = chaveNumeroOSBusca(numero);
  var c = normalizarTextoBusca(cliente);
  if (!n || !c) return '';
  return n + '|' + c;
}

// Tira do bloco de historico as OS que a lista principal JA esta mostrando.
//
// Por que existe: ate a rodada 2 o historico so era consultado quando a lista
// de cima devolvia ZERO — e com a busca AND-por-termo isso deixou o bloco quase
// inutil. Digitar 'alessandra' (UM termo, que e como a equipe digita) devolve 1
// OS do master (Alessandra dos Reis, outra cliente): cache.length === 1, e o
// bloco nunca aparecia. As tres OS da Alessandra Soares de Souza Rita (0535,
// 0536 e 0572, todas na serie antiga) seguiam invisiveis — o incidente que abriu
// a task continuava aberto. Agora o historico e consultado SEMPRE que ha texto
// de busca, e o ruido de repetir embaixo o que ja esta em cima morre aqui.
//
// `jaNaLista` aceita a OS inteira (objeto com numeroOS e cliente, como listarOS
// devolve) ou so a string do numero — mas string SOZINHA nao tem cliente, entao
// ela nao completa chave e nao esconde nada. Quem chama de verdade (os-lista.js)
// passa o `cache` inteiro, que tem os dois campos.
//
// Item de historico sem numero OU sem cliente nunca e escondido: chave
// incompleta nao prova que e o mesmo registro, e esconder por engano e pior que
// repetir — sobretudo agora, que o registro escondido por engano seria
// exatamente a OS antiga que a atendente esta procurando (ver chaveDedupeBusca).
// Nao deduplica o historico contra ele mesmo de proposito — o mesmo numero
// vindo de duas fontes (master e serie antiga) e informacao, nao ruido.
//
// PURA: nao le DOM, nao ordena, nao muta as listas que recebe.
function filtrarHistoricoNovos(resultados, jaNaLista) {
  resultados = resultados || [];
  jaNaLista = jaNaLista || [];

  function numeroDe(item) {
    return (item && typeof item === 'object') ? item.numeroOS : item;
  }
  function clienteDe(item) {
    return (item && typeof item === 'object') ? item.cliente : '';
  }

  var vistos = {};
  var i;
  for (i = 0; i < jaNaLista.length; i++) {
    var k = chaveDedupeBusca(numeroDe(jaNaLista[i]), clienteDe(jaNaLista[i]));
    if (k) vistos[k] = true;
  }

  var novos = [];
  for (i = 0; i < resultados.length; i++) {
    var r = resultados[i];
    var kr = chaveDedupeBusca(numeroDe(r), clienteDe(r));
    // `=== true` e nao `in`/truthy: protege de chave herdada do prototipo
    // ('toString' e afins) virar "ja esta na lista" e sumir com um registro.
    // A chave sempre contem '|', o que ja tornaria a colisao impossivel, mas o
    // guard fica: e barato e nao depende do formato da chave continuar assim.
    if (kr && vistos[kr] === true) continue;
    novos.push(r);
  }
  return novos;
}

// Exports aditivo: cada task acrescenta a sua funcao aqui sem mexer nas outras.
if (typeof module !== 'undefined') module.exports = {
  normalizarTextoBusca: normalizarTextoBusca,
  termosDaBusca: termosDaBusca,
  textoCasaTermos: textoCasaTermos,
  montarTextoBusca: montarTextoBusca,
  respostaHistoricoUtilizavel: respostaHistoricoUtilizavel,
  chaveNumeroOSBusca: chaveNumeroOSBusca,
  chaveDedupeBusca: chaveDedupeBusca,
  filtrarHistoricoNovos: filtrarHistoricoNovos
};
