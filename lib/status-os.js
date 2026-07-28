// Monta a lista de opcoes do seletor de status da OS (os-lista.js, Task 2).
//
// Por que existe: o seletor so tinha as 5 ETAPAS_OS como <option>. Toda OS
// nasce com status 'Em andamento' (registrarOS, google-apps-script.js) — valor
// que NAO esta nas 5 etapas. Sem opcao marcada, o browser exibe a primeira da
// lista ("Aberta") como se fosse o status real; um clique em "Salvar status"
// sem querer reescreve 'Em andamento' -> 'Aberta' na planilha, em silencio.
//
// Regra: o status real da linha SEMPRE aparece como opcao e SEMPRE vem
// selecionado — mesmo quando ele nao esta no enum (fica marcado como "fora do
// padrao" pra ficar visivel que e um valor legado). Status em branco cai na
// mesma convencao ja usada no resto do arquivo (listarOS, statusPublicoOS):
// branco == 'Aberta'.
var SUFIXO_FORA_DO_PADRAO = ' (fora do padrão)';

function montarOpcoesStatus(statusAtual, etapas) {
  etapas = etapas || [];
  var atual = String(statusAtual == null ? '' : statusAtual).trim();
  if (!atual) atual = 'Aberta';

  var opcoes = etapas.map(function(et) {
    return { valor: et, rotulo: et, selecionado: et === atual, legado: false };
  });

  var jaTemSelecionado = opcoes.some(function(o) { return o.selecionado; });
  if (!jaTemSelecionado) {
    opcoes.unshift({ valor: atual, rotulo: atual + SUFIXO_FORA_DO_PADRAO, selecionado: true, legado: true });
  }

  return opcoes;
}

// Le o status CRU de um item: aceita a OS inteira (o objeto que listarOS
// devolve) ou ja a string do status.
//
// De proposito NAO trima. O backend le a celula crua e compara por igualdade
// exata, sem trim:
//   google-apps-script.js:4121  status: String(r[21] || 'Aberta')
//   google-apps-script.js:4127  if (filtros.status && o.status !== filtros.status) continue;
// Entao o valor que vai na querystring tem que ser byte a byte o da celula.
// Trimar aqui produziria uma opcao que nao acha nem a linha que a originou —
// o sintoma exato ("filtrei e nao veio nada") que este filtro existe pra matar.
// Este projeto ja foi mordido por espaco parasita ('Assistencias parceiras ').
// O trim fica so no ROTULO exibido, em montarOpcoesFiltroStatus.
function statusBrutoDoItem(item) {
  if (item == null) return '';
  var bruto = (typeof item === 'string') ? item : item.status;
  return String(bruto == null ? '' : bruto);
}

// Monta as opcoes do FILTRO de status do topo da tela de OS (os-lista.js).
//
// Por que existe: o filtro so oferecia 'Todos' + as 5 ETAPAS_OS. Em producao
// (medido 28/07: listar_os -> total 283) as 283 OS estao em 'Em andamento',
// que NAO esta no enum. Como o backend (listarOS) compara status por igualdade
// exata de string, qualquer opcao escolhida devolvia lista vazia e a atendente
// concluia que o filtro tinha quebrado.
//
// Regra: a lista e a UNIAO de 'Todos' + {5 etapas} + {status ja vistos NESTA
// sessao} + {selecao atual}. Os que estao fora do enum entram rotulados como
// fora do padrao (mesma convencao do seletor do cartao), sem duplicar.
//
// O parametro `vistos` existe porque montar so a partir da resposta ATUAL
// apagava o unico status util: a atendente abre a tela (dropdown com
// 'Em andamento'), escolhe 'Em conserto', o backend devolve 0, e o filtro era
// remontado sem 'Em andamento' — que e o unico status que retorna algo em
// producao. Ela perdia o filtro de vista e so recuperava passando por 'Todos'.
// A funcao continua PURA: quem acumula os vistos e o os-lista.js, que passa a
// lista pronta aqui. A selecao atual tambem nunca some da lista.
//
// Valor CRU, rotulo trimado (ver statusBrutoDoItem): o backend compara exato e
// nao trima. Deduplicacao pelo valor cru. Consequencia aceita: se existirem
// 'Em andamento' e 'Em andamento ', aparecem duas opcoes visualmente iguais e
// cada uma acha as SUAS linhas — honesto, e melhor que uma que nao acha nada.
//
// Pura de proposito: nao le nem escreve DOM. Quem renderiza (os-lista.js)
// escapa valor e rotulo com esc() antes de virar HTML.
function montarOpcoesFiltroStatus(oses, etapas, selecionado, vistos) {
  oses = oses || [];
  etapas = etapas || [];
  vistos = vistos || [];
  var atual = statusBrutoDoItem(selecionado);
  // Selecao so-espaco nao e um status: cai em 'Todos' (mesma convencao do
  // filtro vazio, que nem chega a ir na querystring — ver carregar()).
  if (!atual.trim()) atual = '';

  // '' == 'Todos' (o filtro vazio nao vai na querystring, ver carregar()).
  var opcoes = [{ valor: '', rotulo: 'Todos', selecionado: atual === '', legado: false }];
  var valores = [''];
  var extras = [];
  var i;

  for (i = 0; i < etapas.length; i++) {
    var et = statusBrutoDoItem(etapas[i]);
    if (!et.trim() || valores.indexOf(et) !== -1) continue;
    valores.push(et);
    opcoes.push({ valor: et, rotulo: et.trim(), selecionado: et === atual, legado: false });
  }

  function acrescentarExtra(item) {
    var st = statusBrutoDoItem(item);
    if (!st.trim() || valores.indexOf(st) !== -1 || extras.indexOf(st) !== -1) return;
    extras.push(st);
  }

  // Ordem: o que veio agora, depois o que ja foi visto antes na sessao, e por
  // fim a selecao atual (que pode nao existir em lugar nenhum dos dois).
  for (i = 0; i < oses.length; i++) acrescentarExtra(oses[i]);
  for (i = 0; i < vistos.length; i++) acrescentarExtra(vistos[i]);
  acrescentarExtra(atual);

  for (i = 0; i < extras.length; i++) {
    opcoes.push({
      valor: extras[i],
      rotulo: extras[i].trim() + SUFIXO_FORA_DO_PADRAO,
      selecionado: extras[i] === atual,
      legado: true
    });
  }

  return opcoes;
}

// Exports aditivo: cada task acrescenta a sua funcao aqui sem mexer nas outras
// (Task 3 acrescenta podeAssistenciaMover).
if (typeof module !== 'undefined') module.exports = {
  montarOpcoesStatus: montarOpcoesStatus,
  montarOpcoesFiltroStatus: montarOpcoesFiltroStatus
};
