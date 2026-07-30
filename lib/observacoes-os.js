// Logica pura de observacoes de OS.
//
// Por que existe: a mesma logica de validacao e de apendice precisa ser testada
// unitariamente (Node --test) e tambem rodar no backend (GAS nao tem require).
// Mesma convencao de lib/busca-texto.js e lib/vinculo-atendimento.js: ES5,
// copiada identicamente em google-apps-script.js. Se mexer aqui, mexa la.
//
// Regra de negocio central: observacoes NUNCA sao sobrescritas. Cada adicao
// acrescenta um carimbo de data/hora + o texto ao final do conteudo existente.
// Uma observacao que apaga a anterior e pior que nao ter o campo.

var LIMITE_OBSERVACAO = 500;

// Valida o texto ANTES de acrescentar.
// Retorna {ok:true} ou {ok:false, erro:'...'}.
function validarTextoObservacao(texto) {
  if (typeof texto !== 'string' || !texto.trim()) {
    return { ok: false, erro: 'Texto vazio ou apenas espacos nao e permitido' };
  }
  if (texto.length > LIMITE_OBSERVACAO) {
    return { ok: false, erro: 'Texto muito longo: limite de ' + LIMITE_OBSERVACAO + ' caracteres por observacao (recebeu ' + texto.length + ')' };
  }
  return { ok: true };
}

// Formata o carimbo '[dd/mm/aaaa hh:mm]'.
// `agora` e um objeto Date; sem argumento usa `new Date()`.
function montarCarimboObservacao(agora) {
  var d = (agora instanceof Date) ? agora : new Date();
  var pad = function(n) { return n < 10 ? '0' + n : String(n); };
  return '[' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ']';
}

// Acrescenta `texto` ao valor atual de observacoes.
// NUNCA sobrescreve: se `atual` nao for vazio, coloca uma quebra de linha antes.
// `agora` (opcional) e o Date para o carimbo.
function acrescentarObservacao(atual, texto, agora) {
  var prefixo = montarCarimboObservacao(agora) + ' ' + texto;
  var atualStr = String(atual == null ? '' : atual);
  return atualStr ? atualStr + '\n' + prefixo : prefixo;
}

if (typeof module !== 'undefined') module.exports = {
  LIMITE_OBSERVACAO: LIMITE_OBSERVACAO,
  validarTextoObservacao: validarTextoObservacao,
  montarCarimboObservacao: montarCarimboObservacao,
  acrescentarObservacao: acrescentarObservacao
};
