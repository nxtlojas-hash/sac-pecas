// Vinculo OS <-> atendimento: validacao do protocolo, decisao de bloquear o
// envio da OS e contagem de OS sem vinculo (Task 4 reorg 2026-07-28).
//
// Por que existe: `docsVinculados` estava preenchido em 0 de 816 atendimentos
// (medido 27/07; 0 de 892 na releitura de 28/07). O caminho certo — entrar no
// formulario de OS a partir da ficha do atendimento — era OPCIONAL, e o atalho
// mais visivel (aba "Assistencias" no topo) abria OS solta. OS solta some do
// historico do cliente: ninguem acha depois, porque o unico fio que liga a OS ao
// resto do SAC e esse protocolo.
//
// PURA de proposito: nao le planilha, nao le DOM, nao faz fetch. E o que permite
// testar em node:test a regra que decide se a OS pode ser enviada — a decisao
// mais cara de errar deste arquivo — sem subir nada.
//
// `contarSemVinculo` tem COPIA IDENTICA dentro de google-apps-script.js (mesmo
// arranjo de lib/busca-texto.js e lib/os-numero.js: o backend e um arquivo unico
// colado no editor do Apps Script e nao consegue dar require nesta pasta).
// tests/vinculo-atendimento.test.js compara os corpos das duas copias, entao
// consertar so um lado quebra o teste de proposito. Se mexer aqui, mexa la.

// Formato do protocolo de atendimento: PV-YYYY-NNNN (gerado por
// gerarProximoIdAtendimento no backend). Mesmo regex que clientes.js:386 ja usa
// no modal "Vincular a atendimento" — uma regra so para o app inteiro.
var RE_PROTOCOLO_ATENDIMENTO = /^PV-\d{4}-\d{4}$/;

// Mensagem do bloqueio. Literal da spec (plano 2026-07-27, Task 4 Step 2): ela
// explica o MOTIVO em vez de so recusar, porque quem abre a OS pela aba
// "Assistencias" nao sabe que existe um protocolo para informar.
var MSG_OS_SEM_ATENDIMENTO =
  'Toda OS precisa estar ligada a um atendimento — é assim que ela é encontrada depois.';

var MSG_OS_PROTOCOLO_INVALIDO =
  'Protocolo inválido. Use o formato PV-YYYY-NNNN (ex.: PV-2026-0123).';

// Resultado da consulta de EXISTENCIA do protocolo (o formulario pergunta ao
// backend se aquele PV- existe mesmo). Sao cinco estados porque "nao sei" nao
// pode ser confundido com "nao existe":
//   nao_consultado -> ninguem perguntou ainda
//   consultando    -> a pergunta esta no ar, sem resposta
//   existe         -> o servidor devolveu o atendimento
//   nao_existe     -> o servidor respondeu e disse que aquele protocolo nao esta la
//   indeterminado  -> rede caiu, backend fora, resposta ilegivel
// So `nao_existe` autoriza recusar a OS. Ver decidirEnvioOS.
var CONSULTA_NAO_FEITA = 'nao_consultado';
var CONSULTA_EM_ANDAMENTO = 'consultando';
var CONSULTA_EXISTE = 'existe';
var CONSULTA_NAO_EXISTE = 'nao_existe';
var CONSULTA_INDETERMINADA = 'indeterminado';

// Mensagem do vinculo fantasma: o protocolo tem a cara certa (PV-YYYY-NNNN) mas
// nao existe atendimento nenhum com esse numero. Diz O QUE FAZER — as duas
// saidas reais — porque quem digitou 0500 no lugar de 0050 nao precisa saber
// que errou, precisa saber como sair dali.
function mensagemAtendimentoInexistente(protocolo) {
  var p = normalizarProtocoloAtendimento(protocolo);
  return 'Não achei o atendimento ' + (p || 'informado') +
    '. Confira o número na ficha do cliente (aba Atendimentos) ou clique em ' +
    '"Criar atendimento para esta OS" — a OS precisa apontar para um atendimento que existe.';
}

// Tira espaco e sobe a caixa ANTES de validar/enviar. O backend acha o
// atendimento por igualdade exata de string (`String(dadosAt[j][0]) ===
// String(payload.atendimentoId)`), entao 'pv-2026-0123 ' digitado na correria
// passaria pelo formulario e nao acharia linha nenhuma la — vinculo que falha
// em silencio e pior que vinculo recusado na cara.
function normalizarProtocoloAtendimento(v) {
  return String(v == null ? '' : v).trim().toUpperCase();
}

function protocoloAtendimentoValido(v) {
  return RE_PROTOCOLO_ATENDIMENTO.test(normalizarProtocoloAtendimento(v));
}

// A OS pode ser enviada com este protocolo?
//
// Devolve { bloquear, motivo, mensagem, protocolo }:
//   motivo 'vazio'       -> nao informou nada          -> MSG_OS_SEM_ATENDIMENTO
//   motivo 'formato'     -> informou algo fora do PV-  -> MSG_OS_PROTOCOLO_INVALIDO
//   motivo 'inexistente' -> formato certo, atendimento nao existe (vinculo fantasma)
//   motivo ''            -> segue o envio, com o protocolo ja normalizado
//
// Os motivos existem separados porque as saidas sao diferentes: quem nao tem
// protocolo precisa do botao "Criar atendimento para esta OS"; quem digitou
// errado precisa corrigir o que digitou. Uma mensagem so mandaria metade das
// pessoas para o lado errado.
//
// EXISTENCIA (2a rodada): validar so o FORMATO deixava passar o erro mais
// provavel do balcao — PV-2026-0500 no lugar de PV-2026-0050. O formulario
// mostrava o vermelho de "nao achei", ela clicava Abrir OS assim mesmo e nascia
// um vinculo FANTASMA: o chip aponta para lugar nenhum e a OS some do historico
// do cliente do mesmo jeito que a OS solta que esta task veio matar.
//
// `consulta` e { protocolo, resultado } — o que o formulario perguntou ao
// backend e o que ouviu de volta. A REGRA QUE NAO PODE SER QUEBRADA (a atendente
// nunca fica sem conseguir abrir OS) manda falhar ABERTO: so `nao_existe`
// bloqueia, porque so ele e uma resposta do servidor dizendo que o protocolo nao
// esta la. Consulta ausente, ainda no ar, de OUTRO protocolo (ela corrigiu o
// campo e nao houve tempo de reconsultar) ou indeterminada (rede caiu, backend
// fora, resposta ilegivel) NAO sao prova de inexistencia — e impedir a OS por
// causa de rede deixaria a equipe parada no balcao.
//
// ESTE BLOQUEIO E SO DO FRONT (decisao do controlador, 28/07): o backend
// continua aceitando OS sem atendimento de proposito. A equipe esta usando o
// sistema agora e quem estiver com o index.html velho em cache (sem o campo
// novo) ficaria impedido de abrir QUALQUER OS no meio do expediente. Front
// velho seguir criando OS solta e aceitavel e se cura sozinho quando o cache
// expira — o tamanho desse residuo e medido por contarSemVinculo.
function decidirEnvioOS(protocolo, consulta) {
  var p = normalizarProtocoloAtendimento(protocolo);
  if (!p) {
    return { bloquear: true, motivo: 'vazio', mensagem: MSG_OS_SEM_ATENDIMENTO, protocolo: '' };
  }
  if (!RE_PROTOCOLO_ATENDIMENTO.test(p)) {
    return { bloquear: true, motivo: 'formato', mensagem: MSG_OS_PROTOCOLO_INVALIDO, protocolo: p };
  }
  if (consultaProvaInexistencia(consulta, p)) {
    return {
      bloquear: true,
      motivo: 'inexistente',
      mensagem: mensagemAtendimentoInexistente(p),
      protocolo: p
    };
  }
  return { bloquear: false, motivo: '', mensagem: '', protocolo: p };
}

// A consulta guardada PROVA alguma coisa sobre ESTE protocolo?
//
// Separada de proposito: e por aqui que passam as duas unicas recusas do arquivo
// que se apoiam em algo que nao esta na frente da atendente, entao e uma lista
// curta de condicoes que TODAS precisam valer. Qualquer duvida devolve false —
// e "false" sempre significa "deixa passar", nunca "recusa".
//
// A terceira condicao (mesmo protocolo) e a que impede prova herdada: corrigir
// PV-2026-0500 para PV-2026-0050 nao pode carregar junto o veredito do numero
// errado, em nenhuma das duas direcoes.
function consultaProva(consulta, protocoloNormalizado, resultadoEsperado) {
  if (!consulta || typeof consulta !== 'object') return false;
  if (consulta.resultado !== resultadoEsperado) return false;
  return normalizarProtocoloAtendimento(consulta.protocolo) === protocoloNormalizado;
}

// Prova de que o protocolo do campo NAO existe (recusa o envio da OS).
function consultaProvaInexistencia(consulta, protocoloNormalizado) {
  return consultaProva(consulta, protocoloNormalizado, CONSULTA_NAO_EXISTE);
}

// Prova de que o protocolo do campo EXISTE (recusa criar um segundo
// atendimento por cima de um vinculo real). Ver decidirCriacaoAtendimento.
function consultaProvaExistencia(consulta, protocoloNormalizado) {
  return consultaProva(consulta, protocoloNormalizado, CONSULTA_EXISTE);
}

// O botao "Criar atendimento para esta OS" pode criar agora?
//
// Devolve { criar, motivo, mensagem, protocolo, substituira }:
//   motivo 'vinculo_real'   -> NAO cria: o campo aponta para um atendimento que
//                              PROVADAMENTE existe, e criar outro apagaria esse
//                              vinculo em silencio
//   motivo 'vazio'          -> cria, campo em branco (o caminho principal)
//   motivo 'texto_invalido' -> cria, o que esta no campo nao e protocolo nenhum
//   motivo 'fantasma'       -> cria, o campo tem protocolo PROVADO INEXISTENTE
//   motivo 'sem_prova'      -> cria, o campo tem protocolo de formato valido
//                              ainda nao consultado (ou consulta indeterminada)
// `substituira` e o protocolo de formato valido que a criacao vai trocar no
// campo ('' quando nao ha nenhum) — e a partir dele que a mensagem de sucesso
// avisa que o numero mudou.
//
// POR QUE MUDOU (3a rodada): a rodada 2 acrescentou duas coisas que colidiram.
// A mensagem do protocolo inexistente manda clicar em "Criar atendimento para
// esta OS"; o guard deste botao recusava por FORMATO valido — e PV-2026-0500
// (fantasma) tem formato impecavel. A tela mandava clicar num botao que
// respondia "apague o protocolo do campo antes": um laco na cara de quem usa o
// formulario pela primeira vez. Tinha saida manual, mas so para quem ja sabia.
//
// A regra passou a ser a mesma de decidirEnvioOS, virada do avesso: o guard
// protege um VINCULO REAL, nao um texto com a cara certa. So PROVA POSITIVA de
// existencia (a consulta respondeu, foi sobre ESSE protocolo, e disse que
// existe) autoriza recusar. Sem prova nao ha vinculo a proteger — e recusar sem
// vinculo e justamente o que fechava o laco.
//
// Criar por cima de um protocolo que estava no campo nunca e silencioso: quando
// `substituira` vem preenchido, o formulario avisa ANTES (mensagem daqui) e a
// mensagem de sucesso repete que o numero mudou (mensagemAtendimentoCriado).
function decidirCriacaoAtendimento(protocolo, consulta) {
  var p = normalizarProtocoloAtendimento(protocolo);
  var pareceProtocolo = RE_PROTOCOLO_ATENDIMENTO.test(p);

  if (pareceProtocolo && consultaProvaExistencia(consulta, p)) {
    return {
      criar: false,
      motivo: 'vinculo_real',
      mensagem: mensagemVinculoReal(p),
      protocolo: p,
      substituira: ''
    };
  }
  if (!pareceProtocolo) {
    // Campo vazio ou texto que nao e protocolo: nao ha nada para proteger nem
    // nada para avisar que sera substituido.
    return {
      criar: true,
      motivo: p ? 'texto_invalido' : 'vazio',
      mensagem: '',
      protocolo: p,
      substituira: ''
    };
  }
  var fantasma = consultaProvaInexistencia(consulta, p);
  return {
    criar: true,
    motivo: fantasma ? 'fantasma' : 'sem_prova',
    mensagem: mensagemCriacaoSubstituira(p, fantasma),
    protocolo: p,
    substituira: p
  };
}

// A unica recusa do botao. Diz que o atendimento EXISTE (e o que justifica a
// recusa) e como criar outro mesmo assim — o caminho continua aberto.
function mensagemVinculoReal(p) {
  return 'Esta OS já está apontando para o atendimento ' + p +
    ', que existe. Se quiser criar um atendimento novo, apague o protocolo do campo antes.';
}

// Aviso de que o numero do campo vai mudar. Vem ANTES da criacao para nao ser
// surpresa: ela digitou um protocolo e vai sair dali com outro.
function mensagemCriacaoSubstituira(p, provadoInexistente) {
  return 'Criando um atendimento novo — o protocolo ' + p + ' que está no campo ' +
    (provadoInexistente ? 'não existe e será substituído' : 'será substituído') +
    ' pelo número novo.';
}

// Mensagem de sucesso da criacao. Quando houve substituicao ela DIZ isso: a
// pessoa precisa saber que o numero mudou, senao vai procurar a OS pelo
// protocolo antigo (que nao existe, ou pertence a outra pessoa).
function mensagemAtendimentoCriado(novo, substituido) {
  var n = normalizarProtocoloAtendimento(novo);
  var s = normalizarProtocoloAtendimento(substituido);
  if (s && s !== n) {
    return 'Atendimento ' + n + ' criado e colocado no campo no lugar de ' + s +
      '. O número mudou: esta OS será vinculada ao ' + n + '.';
  }
  return 'Atendimento ' + n + ' criado. Esta OS será vinculada a ele.';
}

// Quantas OS da lista estao SEM atendimento vinculado.
//
// INSTRUMENTACAO, nao funcionalidade: nao aparece na tela da atendente. Como o
// bloqueio vive so no front, este numero e a unica forma de enxergar, sem abrir
// a planilha, se ainda nasce OS solta — e e ele que decide, daqui a alguns
// dias, se da para ligar o bloqueio tambem no backend.
//
// Baseline medido ao vivo em 28/07 (v46, antes desta task): 298 de 298.
//
// Item nulo conta como sem vinculo: nao ha id nenhum ali para provar o
// contrario, e a metrica tem que errar para o lado pessimista — inflar adesao e
// exatamente o erro que faria alguem ligar o bloqueio cedo demais.
function contarSemVinculo(oses) {
  oses = oses || [];
  var n = 0;
  for (var i = 0; i < oses.length; i++) {
    var o = oses[i];
    var id = (o && typeof o === 'object') ? o.atendimentoId : null;
    if (!String(id == null ? '' : id).trim()) n++;
  }
  return n;
}

// Exports aditivo: cada task acrescenta a sua funcao aqui sem mexer nas outras.
if (typeof module !== 'undefined') module.exports = {
  RE_PROTOCOLO_ATENDIMENTO: RE_PROTOCOLO_ATENDIMENTO,
  MSG_OS_SEM_ATENDIMENTO: MSG_OS_SEM_ATENDIMENTO,
  MSG_OS_PROTOCOLO_INVALIDO: MSG_OS_PROTOCOLO_INVALIDO,
  CONSULTA_NAO_FEITA: CONSULTA_NAO_FEITA,
  CONSULTA_EM_ANDAMENTO: CONSULTA_EM_ANDAMENTO,
  CONSULTA_EXISTE: CONSULTA_EXISTE,
  CONSULTA_NAO_EXISTE: CONSULTA_NAO_EXISTE,
  CONSULTA_INDETERMINADA: CONSULTA_INDETERMINADA,
  mensagemAtendimentoInexistente: mensagemAtendimentoInexistente,
  mensagemVinculoReal: mensagemVinculoReal,
  mensagemCriacaoSubstituira: mensagemCriacaoSubstituira,
  mensagemAtendimentoCriado: mensagemAtendimentoCriado,
  normalizarProtocoloAtendimento: normalizarProtocoloAtendimento,
  protocoloAtendimentoValido: protocoloAtendimentoValido,
  decidirEnvioOS: decidirEnvioOS,
  decidirCriacaoAtendimento: decidirCriacaoAtendimento,
  consultaProvaInexistencia: consultaProvaInexistencia,
  consultaProvaExistencia: consultaProvaExistencia,
  contarSemVinculo: contarSemVinculo
};
