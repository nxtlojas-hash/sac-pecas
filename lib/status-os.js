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
function montarOpcoesStatus(statusAtual, etapas) {
  etapas = etapas || [];
  var atual = String(statusAtual == null ? '' : statusAtual).trim();
  if (!atual) atual = 'Aberta';

  var opcoes = etapas.map(function(et) {
    return { valor: et, rotulo: et, selecionado: et === atual, legado: false };
  });

  var jaTemSelecionado = opcoes.some(function(o) { return o.selecionado; });
  if (!jaTemSelecionado) {
    opcoes.unshift({ valor: atual, rotulo: atual + ' (fora do padrao)', selecionado: true, legado: true });
  }

  return opcoes;
}

if (typeof module !== 'undefined') module.exports = { montarOpcoesStatus };
