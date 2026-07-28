// Testes do fluxo de VENDA (formulario.js): o que a tela diz depois que o
// servidor responde, e o que ela deixa de fazer quando nao sabe a resposta.
//
// Por que estes testes existem: este e o fluxo mais caro do sistema — cada
// registro vira pedido E nota fiscal. O unico erro inaceitavel e a tela fazer a
// atendente registrar a MESMA venda duas vezes. A rodada 1 reescreveu 268 linhas
// desse caminho sem um unico teste; a revisao achou 3 buracos, um deles a tela
// dizendo "Pode registrar de novo (...) nao ha risco de duplicar" num cenario em
// que o pedido podia estar na planilha.
//
// aplicarResultadoVenda e (data, venda) -> DOM. Entao o teste monta um DOM
// minimo, roda a funcao de verdade e le o texto que a atendente veria.

const test = require('node:test');
const assert = require('node:assert');

const {
  aplicarResultadoVenda,
  vendaEstadoDesconhecido,
  instrucaoConferirAntes,
  enviarParaGoogle,
  travarModalDuranteEnvio,
  destravarModalAposEnvio,
  finalizarEnvio
} = require('../formulario.js');

// ===================== DOM minimo =====================
// So o que o fluxo de venda toca: getElementById, querySelector('.classe'),
// querySelector('span:last-child'), createElement, insertBefore, appendChild,
// textContent, classList e style.

function criarElemento(tag) {
  const el = {
    tagName: String(tag).toLowerCase(),
    id: '',
    className: '',
    disabled: false,
    title: '',
    style: {},
    children: [],
    parentNode: null,
    _texto: ''
  };

  el.classList = {
    add(c) { if (!el.className.split(/\s+/).includes(c)) el.className = (el.className + ' ' + c).trim(); },
    remove(c) { el.className = el.className.split(/\s+/).filter((x) => x && x !== c).join(' '); },
    contains(c) { return el.className.split(/\s+/).includes(c); }
  };

  el.appendChild = function(no) {
    no.parentNode = el;
    el.children.push(no);
    return no;
  };

  el.insertBefore = function(no, ref) {
    const i = el.children.indexOf(ref);
    no.parentNode = el;
    if (i === -1) el.children.push(no);
    else el.children.splice(i, 0, no);
    return no;
  };

  el.querySelector = function(sel) { return primeiroQueCasa(el, sel); };

  Object.defineProperty(el, 'textContent', {
    get() {
      if (el.children.length === 0) return el._texto;
      // igual ao browser: concatena os descendentes, sem separador
      return el.children.map((c) => c.textContent).join('');
    },
    set(v) {
      el._texto = String(v);
      el.children.forEach((c) => { c.parentNode = null; });
      el.children = [];
    }
  });

  return el;
}

function casa(el, sel) {
  if (sel.startsWith('.')) return el.className.split(/\s+/).includes(sel.slice(1));
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  if (sel === 'span:last-child') {
    if (el.tagName !== 'span' || !el.parentNode) return false;
    const irmaos = el.parentNode.children;
    return irmaos[irmaos.length - 1] === el;
  }
  return el.tagName === sel;
}

function descendentes(raiz) {
  const saida = [];
  (function anda(no) {
    no.children.forEach((f) => { saida.push(f); anda(f); });
  })(raiz);
  return saida;
}

function primeiroQueCasa(raiz, sel) {
  const partes = sel.trim().split(/\s+(?![^(]*\))/);
  let escopos = [raiz];
  for (const parte of partes) {
    const achados = [];
    for (const esc of escopos) {
      for (const d of descendentes(esc)) if (casa(d, parte)) achados.push(d);
    }
    if (achados.length === 0) return null;
    escopos = achados;
  }
  return escopos[0];
}

// Monta a arvore que buildFormHTML() produz, na parte que o fluxo de venda usa.
function montarDom() {
  const raiz = criarElemento('div');

  const modal = criarElemento('div');
  modal.id = 'resumoModal';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  raiz.appendChild(modal);

  const conteudo = criarElemento('div');
  conteudo.className = 'modal-content modal-resumo';
  modal.appendChild(conteudo);

  const cabecalho = criarElemento('div');
  cabecalho.className = 'modal-resumo-header';
  conteudo.appendChild(cabecalho);

  const btnFechar = criarElemento('button');
  btnFechar.id = 'btnFecharResumo';
  btnFechar.className = 'modal-close';
  cabecalho.appendChild(btnFechar);

  const checklist = criarElemento('div');
  checklist.className = 'checklist-envio';
  conteudo.appendChild(checklist);

  ['checkPlanilha', 'checkBling', 'checkEstoque'].forEach((id) => {
    const item = criarElemento('div');
    item.id = id;
    item.className = 'checklist-item';
    const icone = criarElemento('span');
    icone.className = 'checklist-icon';
    icone.textContent = '⏳';
    const rotulo = criarElemento('span');
    rotulo.textContent = 'Enviando...';
    item.appendChild(icone);
    item.appendChild(rotulo);
    checklist.appendChild(item);
  });

  const acoes = criarElemento('div');
  acoes.className = 'modal-resumo-actions';
  conteudo.appendChild(acoes);

  const btnNovo = criarElemento('button');
  btnNovo.id = 'btnNovoAtendimento';
  btnNovo.className = 'btn-sucesso';
  btnNovo.textContent = 'Novo Atendimento';
  acoes.appendChild(btnNovo);

  const btnRegistrar = criarElemento('button');
  btnRegistrar.id = 'btnRegistrar';
  raiz.appendChild(btnRegistrar);

  const documento = {
    getElementById(id) {
      return descendentes(raiz).find((e) => e.id === id) || null;
    },
    querySelector(sel) { return primeiroQueCasa(raiz, sel); },
    createElement(tag) { return criarElemento(tag); }
  };

  return { raiz, documento, modal };
}

// ===================== bancada =====================

const VENDA = {
  id: 'PCA-1753700000000',
  tipoAtendimento: 'Venda SAC',
  origemSac: 'WhatsApp',
  protocoloSac: 'PV-2026-0337',
  dataVenda: '2026-07-28',
  vendedor: 'Paula',
  prevEmbarque: '2026-07-30',
  cliente: {
    nome: 'Maria Souza', tipo: 'F', cpfCnpj: '12345678901', ie: '',
    telefone: '19999998888', endereco: 'Rua A', numero: '10', bairro: 'Centro',
    cidade: 'Sumare', uf: 'SP', cep: '13170000'
  },
  // pecas NAO vazia de proposito: baixaEstoqueVenda sai cedo, sem fetch, quando
  // a lista e vazia. Com peca, qualquer chamada a ela vira fetch observavel —
  // sem isso o teste de "nao baixou estoque" passaria por acidente.
  pecas: [{ descricao: 'Bateria 60V 20Ah', modelo: 'Kay', quantidade: 1, precoUnitario: 1200, total: 1200 }],
  pagamento: { forma: 'pix', parcelas: 1 },
  frete: { transportadora: 'rodonaves', valor: 90 },
  urgencia: 'normal',
  pesoVolume: '18 kg',
  observacoes: '',
  totalPecas: 1200,
  totalGeral: 1290
};

// Silencia os console.warn/error que o proprio codigo emite ao registrar erros.
function silenciarConsole() {
  const warn = console.warn;
  const error = console.error;
  console.warn = function() {};
  console.error = function() {};
  return function() { console.warn = warn; console.error = error; };
}

// Prepara document + fetch falso e devolve leitores do que foi parar na tela.
function bancada(opcoes) {
  const cfg = opcoes || {};
  const { documento, modal } = montarDom();
  global.document = documento;

  const chamadas = { registrar_venda: [], baixa_estoque: [], outras: [] };

  global.fetch = function(url, opts) {
    let corpo = {};
    try { corpo = JSON.parse((opts && opts.body) || '{}'); } catch (e) { corpo = {}; }
    const acao = corpo.action || 'outras';
    (chamadas[acao] || chamadas.outras).push(corpo);

    if (acao === 'registrar_venda' && cfg.respostaVenda) return cfg.respostaVenda();
    // Sem resposta programada a promise nunca resolve: nada roda depois nem
    // suja o teste com atualizacoes assincronas de checklist.
    return new Promise(function() {});
  };

  function item(id) {
    const el = documento.getElementById(id);
    return {
      icone: el.querySelector('.checklist-icon').textContent,
      texto: el.querySelector('span:last-child').textContent,
      feito: el.classList.contains('done'),
      cor: el.style.color
    };
  }

  function aviso() {
    const el = documento.getElementById('avisoVenda');
    if (!el) return null;
    return {
      titulo: el.children[0] ? el.children[0].textContent : '',
      corpo: el.children[1] ? el.children[1].textContent : '',
      tudo: el.textContent,
      fundo: el.style.background
    };
  }

  return {
    documento,
    modal,
    chamadas,
    item,
    aviso,
    botao: (id) => documento.getElementById(id)
  };
}

// ===================== os 5 cenarios =====================

const CENARIOS = {
  'planilha=true, bling=true': (b) => aplicarResultadoVenda({ planilha: true, bling: true, blingPedidoId: '55501' }, VENDA),
  'planilha=true, bling=false': (b) => aplicarResultadoVenda({ planilha: true, bling: false, erros: ['Bling: Error: 401 invalid_grant'] }, VENDA),
  'planilha=false, bling=true': (b) => aplicarResultadoVenda({ planilha: false, bling: true, blingPedidoId: '55502', erros: ['Planilha: Error: cota excedida'] }, VENDA),
  'planilha=false, bling=false': (b) => aplicarResultadoVenda({ planilha: false, bling: false, erros: ['Planilha: Error: timeout', 'Bling: Error: sem token'] }, VENDA),
  'desconhecido': (b) => vendaEstadoDesconhecido(VENDA)
};

function rodarCenario(nome, cfg) {
  const b = bancada(cfg);
  const restaurar = silenciarConsole();
  try { CENARIOS[nome](b); } finally { restaurar(); }
  return b;
}

// ===================== normalizacao p/ o invariante =====================

function normalizar(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const PASSOS_CONFERIR = [
  'abra a planilha de pedidos',
  'procure o pedido',
  'so registre de novo se ele nao estiver la'
];

// Os tres passos existem E estao NA ORDEM. A ordem e parte da instrucao: conferir
// depois de registrar de novo nao serve pra nada.
function temConferirNaOrdem(texto) {
  const t = normalizar(texto);
  let cursor = -1;
  for (const passo of PASSOS_CONFERIR) {
    const i = t.indexOf(passo, cursor + 1);
    if (i === -1) return false;
    cursor = i;
  }
  return true;
}

const MENCIONA_REFAZER = /registr\w*\s+(?:de novo|a venda outra vez|outra vez|novamente)/;
const PROIBE_REFAZER = /nao registre (?:a venda )?de novo/;

// Frases que autorizam refazer sem conferir. Nenhuma pode voltar a existir.
// As duas primeiras sao literalmente o texto da rodada 1 que motivou o FIX 1.
const FRASES_BANIDAS = [
  'pode registrar de novo',
  'nao ha risco de duplicar',
  'sem risco de duplicar',
  'pode registrar a venda de novo',
  'registre de novo sem conferir'
];

// ===================== INVARIANTE CENTRAL =====================

test('INVARIANTE: em nenhum cenario a tela manda registrar de novo sem mandar conferir antes', () => {
  Object.keys(CENARIOS).forEach((nome) => {
    const b = rodarCenario(nome);
    const av = b.aviso();
    assert.ok(av, 'cenario "' + nome + '" nao mostrou aviso nenhum na tela');
    const t = normalizar(av.tudo);

    FRASES_BANIDAS.forEach((frase) => {
      assert.ok(t.indexOf(frase) === -1,
        'cenario "' + nome + '" contem a frase banida "' + frase + '": ' + av.tudo);
    });

    if (MENCIONA_REFAZER.test(t)) {
      assert.ok(PROIBE_REFAZER.test(t) || temConferirNaOrdem(t),
        'cenario "' + nome + '" fala em registrar de novo sem proibir e sem mandar conferir: ' + av.tudo);
    }
  });
});

test('INVARIANTE: os dois cenarios que podem terminar em novo registro trazem os 3 passos NA ORDEM', () => {
  // Estes sao os unicos em que a atendente pode legitimamente registrar de novo.
  // Sao tambem os unicos onde errar duplica pedido e nota fiscal.
  ['planilha=false, bling=false', 'desconhecido'].forEach((nome) => {
    const b = rodarCenario(nome);
    const t = normalizar(b.aviso().tudo);
    assert.ok(temConferirNaOrdem(t),
      'cenario "' + nome + '" nao traz abrir -> procurar -> so entao registrar: ' + b.aviso().tudo);
  });
});

test('a instrucao de conferencia identifica o pedido pelo ID E pelo nome do cliente', () => {
  const texto = instrucaoConferirAntes(VENDA);
  assert.match(texto, /PCA-1753700000000/);
  assert.match(texto, /Maria Souza/);
  assert.ok(temConferirNaOrdem(normalizar(texto)));
  // sem venda nenhuma nao pode quebrar nem virar "undefined" na tela
  [null, undefined, {}, { cliente: null }].forEach((v) => {
    const t = instrucaoConferirAntes(v);
    assert.ok(temConferirNaOrdem(normalizar(t)));
    assert.ok(t.indexOf('undefined') === -1 && t.indexOf('null') === -1, t);
  });
});

// ===================== as 4 combinacoes =====================

test('planilha=true, bling=true: tudo certo, sem mencao a registrar de novo', () => {
  const b = rodarCenario('planilha=true, bling=true');
  const av = b.aviso();
  assert.match(av.titulo, /Tudo certo/);
  assert.ok(!MENCIONA_REFAZER.test(normalizar(av.tudo)), 'o caminho feliz nao deve falar em refazer');
  assert.strictEqual(b.item('checkPlanilha').icone, '✅');
  assert.strictEqual(b.item('checkBling').icone, '✅');
  assert.match(b.item('checkBling').texto, /55501/);
});

test('planilha=true, bling=false: a venda esta salva, so a nota falhou - proibe refazer', () => {
  const b = rodarCenario('planilha=true, bling=false');
  const av = b.aviso();
  assert.ok(PROIBE_REFAZER.test(normalizar(av.tudo)), av.tudo);
  assert.strictEqual(b.item('checkPlanilha').icone, '✅');
  assert.strictEqual(b.item('checkBling').icone, '❌');
  assert.match(b.item('checkBling').texto, /401 invalid_grant/);
  // o motivo do Bling nao pode vazar para o visto da planilha
  assert.ok(b.item('checkPlanilha').texto.indexOf('invalid_grant') === -1);
});

test('planilha=false, bling=true: a nota ja saiu - o pior caso, proibe refazer', () => {
  const b = rodarCenario('planilha=false, bling=true');
  const av = b.aviso();
  assert.ok(PROIBE_REFAZER.test(normalizar(av.tudo)), av.tudo);
  assert.match(av.tudo, /NOTA EM DOBRO/);
  assert.match(av.tudo, /55502/);
  assert.strictEqual(b.item('checkPlanilha').icone, '❌');
  assert.strictEqual(b.item('checkBling').icone, '✅');
});

test('planilha=false, bling=false: FIX 1 - nao da mais alvara para refazer', () => {
  const b = rodarCenario('planilha=false, bling=false');
  const av = b.aviso();
  // continua tranquilizador...
  assert.match(av.tudo, /provavelmente NAO entrou/);
  // ...mas a acao pedida e conferir, nunca "pode registrar de novo"
  assert.ok(temConferirNaOrdem(normalizar(av.tudo)), av.tudo);
  assert.match(av.tudo, /timeout/);
  assert.strictEqual(b.item('checkPlanilha').icone, '❌');
  assert.strictEqual(b.item('checkBling').icone, '❌');
});

// ===================== FIX 2: estoque =====================

test('FIX 2: planilha=false NAO baixa estoque (nenhum POST de baixa)', () => {
  const b = rodarCenario('planilha=false, bling=false');
  assert.strictEqual(b.chamadas.baixa_estoque.length, 0);
  assert.strictEqual(b.item('checkEstoque').icone, '❌');
});

test('FIX 2: no estado DESCONHECIDO nao ha baixa de estoque, e o visto fica no terceiro estado', () => {
  const b = rodarCenario('desconhecido');
  assert.strictEqual(b.chamadas.baixa_estoque.length, 0,
    'baixar estoque sem saber se a venda entrou gera dois debitos para uma venda');
  const estoque = b.item('checkEstoque');
  assert.strictEqual(estoque.icone, '⚠️'); // ambar, nao verde nem vermelho
  assert.strictEqual(estoque.feito, false);
  assert.strictEqual(estoque.cor, '#a06600');
  assert.match(estoque.texto, /NAO SEI/);
  // e a tela explica que o estoque sera conferido junto com a venda
  assert.match(b.aviso().tudo, /estoque tambem nao foi mexido/i);
});

test('FIX 2: planilha=true continua baixando estoque (controle positivo do teste acima)', () => {
  const b = rodarCenario('planilha=true, bling=true');
  assert.strictEqual(b.chamadas.baixa_estoque.length, VENDA.pecas.length);
  assert.strictEqual(b.chamadas.baixa_estoque[0].vendaId, VENDA.id);
});

test('os tres vistos ficam no terceiro estado (ambar) no desconhecido, nunca em verde', () => {
  const b = rodarCenario('desconhecido');
  ['checkPlanilha', 'checkBling', 'checkEstoque'].forEach((id) => {
    const it = b.item(id);
    assert.strictEqual(it.icone, '⚠️', id + ' deveria estar ambar');
    assert.strictEqual(it.feito, false, id + ' nao pode estar marcado como concluido');
  });
});

// ===================== FIX 3: o aviso nao pode morrer no modal fechado =====================

test('FIX 3(a): durante o envio o X e o "Novo Atendimento" ficam desabilitados', () => {
  const b = bancada();
  travarModalDuranteEnvio();
  assert.strictEqual(b.botao('btnFecharResumo').disabled, true);
  assert.strictEqual(b.botao('btnNovoAtendimento').disabled, true);
  assert.match(b.botao('btnNovoAtendimento').textContent, /Enviando/);
  assert.ok(b.botao('btnFecharResumo').title.length > 0, 'o X precisa dizer por que esta travado');
});

test('FIX 3(a): terminado o envio, os dois botoes voltam ao normal', () => {
  const b = bancada();
  travarModalDuranteEnvio();
  destravarModalAposEnvio();
  assert.strictEqual(b.botao('btnFecharResumo').disabled, false);
  assert.strictEqual(b.botao('btnNovoAtendimento').disabled, false);
  assert.strictEqual(b.botao('btnNovoAtendimento').textContent, 'Novo Atendimento');
});

test('FIX 3(a): finalizarEnvio destrava o modal (e o unico ponto de saida do envio)', () => {
  const b = bancada();
  travarModalDuranteEnvio();
  finalizarEnvio();
  assert.strictEqual(b.botao('btnFecharResumo').disabled, false);
  assert.strictEqual(b.botao('btnNovoAtendimento').disabled, false);
});

test('FIX 3(b): se ela fechou o modal, qualquer resultado que nao seja "tudo certo" reabre', () => {
  ['planilha=true, bling=false', 'planilha=false, bling=true', 'planilha=false, bling=false', 'desconhecido']
    .forEach((nome) => {
      const b = bancada();
      b.modal.style.display = 'none'; // ela fechou antes da resposta chegar
      const restaurar = silenciarConsole();
      try { CENARIOS[nome](b); } finally { restaurar(); }
      assert.strictEqual(b.modal.style.display, 'flex',
        'cenario "' + nome + '" deixou o aviso escondido num modal fechado');
      assert.ok(b.aviso(), 'cenario "' + nome + '" nao escreveu o aviso');
    });
});

test('FIX 3(b): "tudo certo" nao reabre o modal fechado (nao ha o que avisar)', () => {
  const b = bancada();
  b.modal.style.display = 'none';
  const restaurar = silenciarConsole();
  try { CENARIOS['planilha=true, bling=true'](b); } finally { restaurar(); }
  assert.strictEqual(b.modal.style.display, 'none');
});

// ===================== estado desconhecido pelos dois caminhos reais =====================
// Nao basta chamar vendaEstadoDesconhecido na mao: o que precisa estar certo e o
// ROTEAMENTO dentro de enviarParaGoogle. Aqui o fetch e falso e a resposta vem
// quebrada de verdade.

function flush(voltas) {
  let p = Promise.resolve();
  for (let i = 0; i < (voltas || 8); i++) p = p.then(() => new Promise((r) => setImmediate(r)));
  return p;
}

test('resposta que nao e JSON (HTML de erro do Google) cai no DESCONHECIDO, nao em "falhou"', async () => {
  const b = bancada({
    respostaVenda: () => Promise.resolve({
      text: () => Promise.resolve('<!DOCTYPE html><html><body>Erro 500</body></html>')
    })
  });
  const restaurar = silenciarConsole();
  try {
    enviarParaGoogle(VENDA);
    await flush();
  } finally { restaurar(); }

  const av = b.aviso();
  assert.match(av.titulo, /NAO DEU PARA CONFIRMAR/);
  assert.ok(temConferirNaOrdem(normalizar(av.tudo)), av.tudo);
  assert.strictEqual(b.item('checkPlanilha').icone, '⚠️');
  assert.strictEqual(b.chamadas.baixa_estoque.length, 0);
  // e o modal foi destravado no fim
  assert.strictEqual(b.botao('btnNovoAtendimento').disabled, false);
});

test('JSON valido mas sem o campo planilha tambem cai no DESCONHECIDO', async () => {
  const b = bancada({
    respostaVenda: () => Promise.resolve({ text: () => Promise.resolve('{"sucesso":"talvez"}') })
  });
  const restaurar = silenciarConsole();
  try { enviarParaGoogle(VENDA); await flush(); } finally { restaurar(); }

  assert.match(b.aviso().titulo, /NAO DEU PARA CONFIRMAR/);
  assert.strictEqual(b.chamadas.baixa_estoque.length, 0);
});

test('fetch rejeitado (rede caiu) cai no DESCONHECIDO, nunca em "a venda falhou"', async () => {
  const b = bancada({ respostaVenda: () => Promise.reject(new Error('Failed to fetch')) });
  const restaurar = silenciarConsole();
  try { enviarParaGoogle(VENDA); await flush(); } finally { restaurar(); }

  const av = b.aviso();
  assert.match(av.titulo, /NAO DEU PARA CONFIRMAR/);
  // o texto NAO pode afirmar que falhou: ela refaria a venda
  assert.ok(!/pode registrar de novo/.test(normalizar(av.tudo)));
  assert.ok(temConferirNaOrdem(normalizar(av.tudo)), av.tudo);
  assert.strictEqual(b.chamadas.baixa_estoque.length, 0);
});

test('resposta boa pelo caminho real: aplica o resultado e baixa o estoque', async () => {
  const b = bancada({
    respostaVenda: () => Promise.resolve({
      text: () => Promise.resolve('{"planilha":true,"bling":true,"blingPedidoId":"90210"}')
    })
  });
  const restaurar = silenciarConsole();
  try { enviarParaGoogle(VENDA); await flush(); } finally { restaurar(); }

  assert.match(b.aviso().titulo, /Tudo certo/);
  assert.strictEqual(b.chamadas.registrar_venda.length, 1);
  assert.strictEqual(b.chamadas.registrar_venda[0].id, VENDA.id);
  assert.strictEqual(b.chamadas.baixa_estoque.length, VENDA.pecas.length);
});
