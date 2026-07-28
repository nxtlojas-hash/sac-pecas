/* ===== NXT SAC - OS (lista, busca e avanco de status) — Task 2 reorg 2026-07-27 =====
   Fecha o relato "nao sei onde altera o status": ate aqui o status da OS (o que
   o cliente ve no QR, statusPublicoOS) so mudava editando a celula da planilha
   na mao. Esta tela lista as OS do master, deixa buscar e mudar o status pelo
   seletor — com o botao "Ver como o cliente ve" do lado pra conferir na hora. */

(function() {
  'use strict';
  var URL_API = (typeof GOOGLE_SCRIPT_URL !== 'undefined') ? GOOGLE_SCRIPT_URL : '';
  // FALLBACK, nao fonte da verdade. A lista boa vem do backend (listar_os
  // devolve `etapas`, espelhando ETAPAS_OS do google-apps-script.js) e e
  // adotada em carregar(). Esta copia local so serve pros dois momentos em que
  // o backend ainda nao falou: a 1a pintura da tela (buildHTML roda antes do
  // fetch) e a v45, que esta no ar agora e nao manda o campo. Sem ela o seletor
  // de status ficaria vazio e a tela pararia de mover OS ate a v46 subir.
  //
  // A ULTIMA ETAPA AQUI E O ROTULO VELHO DE PROPOSITO — nao e descuido nem
  // esquecimento da troca 'Pronto p/ retirar' -> 'Finalizado' (28/07). Criterio:
  // este array so entra em cena quando o backend NAO manda `etapas`, e o unico
  // backend que nao manda e a v45 — cujo enum termina em 'Pronto p/ retirar'.
  // Com 'Finalizado' aqui, a tela ofereceria contra a v45 um rotulo que ela
  // recusa ('Status invalido. Use: ...') e a atendente levaria erro ao salvar.
  // O caminho inverso ja esta fechado do outro lado: a v46 ACEITA
  // 'Pronto p/ retirar' como alias legado de gravacao (ETAPAS_OS_ALIAS_LEGADO,
  // google-apps-script.js). Ou seja, este e o unico valor que nao causa erro em
  // NENHUMA das duas versoes — que e exatamente o criterio pra escolher um
  // fallback que roda numa janela de publicacao.
  // Assim que a v46 subir ela manda `etapas` e este array para de ser usado.
  //
  // Se voce mexer nos rotulos, mexa no BACKEND: aqui e so a rede de seguranca.
  var ETAPAS_PADRAO = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Em conserto', 'Pronto p/ retirar'];
  // Lista em uso. Trocada (nunca mutada no lugar) a cada resposta do backend.
  var etapas = ETAPAS_PADRAO;
  // Corte de payload do backend (listarOS corta em `limite` e devolve as mais
  // recentes). NAO aumente pra "resolver" contagem: o corte protege o payload,
  // quem tem que falar a verdade sobre ele e o resumo da tela.
  var LIMITE_LISTA = 200;
  var cache = [];
  // Contadores da ultima resposta: `total` = quantas OS casam com o filtro na
  // planilha; `exibidos` = quantas de fato vieram. Em producao (28/07) sao 283
  // e 200 — a tela escrevia "200 OS" e escondia 83 sem avisar ninguem.
  var totalUltimaResposta = 0;
  var exibidosUltimaResposta = 0;
  // Status ja vistos NESTA sessao, no valor cru que veio do backend. So cresce,
  // nunca encolhe: o filtro montado apenas com a resposta ATUAL apagava o unico
  // status que acha alguma coisa. Sequencia real de 2 cliques: abre a tela
  // (dropdown com 'Em andamento'), escolhe 'Em conserto', o backend devolve 0,
  // e a remontagem tirava 'Em andamento' da lista — a atendente perdia o filtro
  // util de vista e so o recuperava passando por 'Todos'.
  var statusVistos = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function buildHTML() {
    return '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128203; OS</h2>' +
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Filtros</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label for="osStatus">Status</label>' +
            '<select id="osStatus">' +
              '<option value="">Todos</option>' +
              etapas.map(function(et) {
                return '<option value="' + esc(et) + '">' + esc(et) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="form-group" style="flex:2 1 220px;">' +
            '<label for="osBusca">Busca (numero da OS, cliente, telefone, CPF, chassi)</label>' +
            '<input type="text" id="osBusca" placeholder="Digite parte do texto...">' +
          '</div>' +
        '</div>' +
        '<div class="form-row" style="align-items:center;">' +
          '<button type="button" class="btn-primario" id="osBtnAplicar">&#128269; Aplicar filtros</button>' +
          '<button type="button" class="btn-secundario" id="osBtnLimpar">Limpar</button>' +
          '<button type="button" class="btn-secundario" id="osBtnRefresh">&#x21bb; Atualizar</button>' +
          '<span id="osResumo" style="color:#9a9a9a;font-size:0.85rem;margin-left:auto;"></span>' +
        '</div>' +
      '</div>' +
      '<div id="osFeedback" style="margin-top:0.5rem;"></div>' +
      '<div id="osLista" style="margin-top:1rem;"></div>' +
      // Bloco do historico (Task 4). Fica DEPOIS da lista: e complemento, nao
      // substituto. Aparece sempre que houver busca digitada E sobrar algum
      // registro que a lista de cima nao esteja mostrando (ver carregar e
      // renderHistorico).
      '<div id="osHistorico" style="margin-top:1rem;"></div>';
  }

  function filtrosAtuais() {
    var elStatus = document.getElementById('osStatus');
    var elBusca = document.getElementById('osBusca');
    return {
      status: elStatus ? elStatus.value : '',
      busca: elBusca ? elBusca.value.trim() : ''
    };
  }

  function carregar(filtros) {
    mostrarFeedback('Carregando...', 'info');
    var q = Object.keys(filtros || {}).filter(function(k) {
      return filtros[k];
    }).map(function(k) {
      return k + '=' + encodeURIComponent(filtros[k]);
    }).join('&');
    return fetch(URL_API + '?action=listar_os&limite=' + LIMITE_LISTA + (q ? '&' + q : ''))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d || !d.ok) {
          mostrarFeedback('Erro: ' + (d && d.erro ? d.erro : 'sem resposta'), 'erro');
          limparHistorico();
          return d;
        }
        cache = d.oses || [];
        // Adota o enum do backend ANTES de render(): quem monta o seletor do
        // filtro e o de cada cartao le `etapas`. etapasDaResposta devolve
        // ETAPAS_PADRAO quando o campo nao veio (v45) ou veio inutilizavel —
        // mesmo `typeof` defensivo do resto do arquivo: se a lib nao carregar,
        // fica no fallback em vez de quebrar.
        etapas = (typeof etapasDaResposta === 'function')
          ? etapasDaResposta(d, ETAPAS_PADRAO)
          : ETAPAS_PADRAO;
        // Aba vazia devolve so { ok, oses:[], total:0 }, sem `exibidos` — por
        // isso cada contador cai no tamanho da lista quando nao vem numero.
        totalUltimaResposta = (typeof d.total === 'number') ? d.total : cache.length;
        exibidosUltimaResposta = (typeof d.exibidos === 'number') ? d.exibidos : cache.length;
        render();
        mostrarFeedback('', '');
        // Procura no historico SEMPRE que houver texto de busca — nao so quando
        // a lista de cima vier vazia.
        //
        // A regra antiga ("so quando der zero") parecia suficiente e nao era: a
        // busca e AND-por-termo, entao digitar 'alessandra' (um termo, como a
        // equipe digita) devolve 1 OS do master — Alessandra dos Reis, OUTRA
        // cliente. cache.length === 1, o bloco nunca abria, e as tres OS da
        // Alessandra Soares de Souza Rita (0535, 0536, 0572, serie antiga)
        // seguiam invisiveis: exatamente o incidente que abriu esta task.
        //
        // O ruido de repetir embaixo o que ja esta em cima e resolvido no
        // renderHistorico (dedup por numero de OS), nao deixando de perguntar.
        // Sem busca digitada nao ha o que procurar: a action devolveria vazio de
        // proposito e nao vale o round-trip.
        //
        // `cache` vai como ARGUMENTO (e nao lido la dentro): a resposta do
        // historico chega depois e, se a atendente ja tiver disparado outra
        // busca, o dedup tem que ser contra a lista DESTA consulta.
        if (filtros && filtros.busca) buscarHistorico(filtros.busca, cache);
        else limparHistorico();
        return d;
      })
      .catch(function(err) {
        mostrarFeedback('Erro de rede: ' + err.message, 'erro');
        limparHistorico();
      });
  }

  function salvarStatus(numeroOS, novoStatus, btn) {
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    return fetch(URL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'atualizar_status_os', numeroOS: numeroOS, novoStatus: novoStatus })
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.ok) throw new Error(d.erro || 'falhou');
        btn.textContent = 'Salvo';
        // Recarrega para o cartao refletir a verdade da planilha, nao o otimismo da tela.
        setTimeout(function() { carregar(filtrosAtuais()); }, 600);
      })
      .catch(function(e) {
        btn.disabled = false;
        btn.textContent = 'Salvar status';
        alert('Nao consegui salvar: ' + e.message);
      });
  }

  // ===== HISTORICO NAS OUTRAS BASES (Task 4 reorg 2026-07-28) =====
  // Fecha o incidente do dia: a equipe procurou 'Alessandra Soares' aqui e nao
  // achou. A cliente tem OS-2026-0535, 0536 e 0572 — todas na serie antiga, que
  // esta tela nunca leu (listarOS so olha o master). Ate agora o unico caminho
  // ate os ~816 registros antigos era a busca da aba Atendimentos, e SO por
  // numero. Ninguem deveria precisar saber em que aba mora cada base.
  //
  // Estes cartoes sao SOMENTE LEITURA e nao tem seletor de status de proposito:
  // a serie antiga nao tem coluna de status e atualizarStatusOS so escreve no
  // master. Oferecer o seletor aqui seria prometer uma gravacao que nao existe.
  var ROTULO_FONTE = {
    // O master tambem e varrido pela busca do historico. Uma OS dele so chega
    // ate este bloco quando NAO esta na lista de cima — ou o filtro de status a
    // escondeu, ou ela ficou fora das 200 mais recentes.
    'master': 'Aba OS (master) — fora da lista de cima (filtro de status ou corte das 200)',
    'serie-antiga': 'Histórico — série antiga',
    'sumare-manual': 'Histórico — Sumaré (planilha manual)'
  };

  function rotuloFonte(f) {
    var k = String(f == null ? '' : f);
    return ROTULO_FONTE[k] || ('Histórico — ' + (k || 'origem não identificada'));
  }

  // ===== GUARDA DE SEQUENCIA DO BLOCO DE HISTORICO (rodada 3, 28/07) =====
  // Duas buscas em sequencia rapida (digita 'ales', Enter, apaga, digita
  // 'silva', Enter) disparam dois GET, e NADA garante a ordem de chegada: a
  // resposta da busca ANTIGA chegando por ultimo pintava o bloco com o
  // resultado errado — logo abaixo da lista certa e sem nenhum sinal de que
  // estava velho. Pior que uma tela vazia: uma tela confiante e errada.
  //
  // A lista principal nao sofre do mesmo jeito porque cada `carregar` reescreve
  // #osLista inteiro com a sua propria resposta; o bloco de baixo e uma SEGUNDA
  // requisicao, solta, que so ela mesma pode invalidar.
  //
  // Cada busca leva um token crescente e so a MAIS RECENTE pode desenhar.
  // limparHistorico tambem incrementa, de proposito: apagar o bloco (busca sem
  // texto, erro de rede, filtro trocado) tem que cancelar o que ainda estiver
  // voando, senao a resposta atrasada repinta exatamente o que a tela acabou de
  // limpar.
  var seqHistorico = 0;

  function limparHistorico() {
    seqHistorico++;
    var div = document.getElementById('osHistorico');
    if (div) div.innerHTML = '';
  }

  // `listaAtual` e a lista principal que estava na tela quando esta busca saiu —
  // usada so pra nao repetir aqui embaixo uma OS que ja esta la em cima.
  function buscarHistorico(termo, listaAtual) {
    // Incremento explicito: esta busca passa a ser a dona do bloco a partir de
    // agora, mesmo que ela nem chegue a limpar nada.
    var token = ++seqHistorico;
    if (!termo) { limparHistorico(); return; }
    return fetch(URL_API + '?action=buscar_os_historico&q=' + encodeURIComponent(termo))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        // Chegou tarde: outra busca ja saiu (ou o bloco foi limpo) depois desta.
        // Nao desenha E NAO LIMPA — quem manda no bloco agora e a outra, e
        // limpar aqui apagaria o resultado certo que ja pode estar na tela.
        if (token !== seqHistorico) return;
        // FALLBACK OBRIGATORIO (v45 ainda no ar): action que o backend nao
        // conhece cai no default do roteador, que responde
        // {status:'ok', message:'NXT Pecas API ativa'} — sem `ok:true` e sem
        // `resultados`. Nao ha erro pra mostrar a ninguem: a tela simplesmente
        // nao exibe o bloco. respostaHistoricoUtilizavel (lib/busca-texto.js)
        // guarda essa regra e e testada contra o payload real da v45.
        // Mesmo `typeof` defensivo que o cartao ja usa pra montarOpcoesStatus:
        // se a lib nao carregar, o bloco nao aparece — nunca quebra.
        var utilizavel = (typeof respostaHistoricoUtilizavel === 'function')
          ? respostaHistoricoUtilizavel(d)
          : false;
        if (!utilizavel) {
          limparHistorico();
          return;
        }
        renderHistorico(d, listaAtual);
      })
      // Rede caiu / JSON invalido: silencioso. A lista principal ja fez o seu
      // trabalho e mostrar "erro" aqui so assustaria sem informar nada. Mesma
      // guarda: uma falha ANTIGA nao pode apagar o bloco de uma busca nova que
      // ja deu certo.
      .catch(function() { if (token === seqHistorico) limparHistorico(); });
  }

  function histCardHTML(r) {
    var detalhe = [r.modelo, r.assistencia].filter(function(x) { return x; }).join(' • ');
    return '' +
      '<div style="background:#161625;border:1px solid #2a2a2a;border-radius:8px;padding:0.75rem 1rem;margin-bottom:0.5rem;">' +
        '<div>' +
          '<strong style="color:#f59e0b;font-size:1.02rem;">' + esc(r.numeroOS) + '</strong>' +
          (r.data ? ' <span style="color:#9a9a9a;font-size:0.78rem;">&bull; ' + esc(r.data) + '</span>' : '') +
        '</div>' +
        '<div style="font-size:0.9rem;color:#e8e8f0;margin-top:0.2rem;">' + esc(r.cliente || '(sem nome)') + '</div>' +
        (detalhe ? '<div style="font-size:0.8rem;color:#9a9a9a;margin-top:0.15rem;">' + esc(detalhe) + '</div>' : '') +
        (r.problema ? '<div style="font-style:italic;color:#9a9a9a;font-size:0.8rem;margin-top:0.15rem;">' + esc(r.problema) + '</div>' : '') +
        '<div style="font-size:0.75rem;color:#f59e0b;margin-top:0.35rem;">' + esc(rotuloFonte(r.fonte)) + '</div>' +
      '</div>';
  }

  function renderHistorico(d, listaAtual) {
    var div = document.getElementById('osHistorico');
    if (!div) return;

    // Dedup contra a lista principal: agora o historico e consultado em TODA
    // busca (ver carregar), entao a mesma OS pode vir nos dois lugares — o
    // backend varre o master tambem. Repetir o cartao logo abaixo dele mesmo
    // seria o ruido que a regra antiga ("so quando der zero") tentava evitar.
    // Mesmo `typeof` defensivo do resto do arquivo: se a lib nao carregar,
    // mostra tudo em vez de quebrar (repetido e melhor que tela quebrada).
    var novos = (typeof filtrarHistoricoNovos === 'function')
      ? filtrarHistoricoNovos(d.resultados, listaAtual)
      : d.resultados;

    // Sobrou nada = o historico so devolveu o que ja esta em cima. Nao ha
    // noticia nenhuma pra dar: nao desenha bloco vazio.
    if (!novos.length) { limparHistorico(); return; }

    // `total`/`truncado` sao campos novos: derivo o corte em vez de confiar que
    // vieram, pra o bloco nunca prometer numero que nao pode provar.
    var recebidos = d.resultados.length;
    var total = (typeof d.total === 'number' && d.total > recebidos) ? d.total : recebidos;
    var escondidos = recebidos - novos.length;

    // Duas frases separadas de proposito: uma e sobre o CORTE do backend
    // (LIMITE_HISTORICO_OS), a outra sobre o que o dedup tirou. Junta-las daria
    // um "Mostrando 2 de 3" que nao explica para onde foi o terceiro.
    var corte = total > recebidos
      ? '<div style="background:#f59e0b22;color:#f59e0b;padding:0.5rem 1rem;border-radius:6px;font-size:0.85rem;margin-bottom:0.5rem;">' +
          'A busca no histórico achou ' + total + ' registros e trouxe os ' + recebidos +
          ' primeiros. Digite mais um pedaço do nome para estreitar a busca.' +
        '</div>'
      : '';
    var repetidos = escondidos > 0
      ? '<div style="color:#9a9a9a;font-size:0.78rem;margin-bottom:0.5rem;">' +
          escondidos + (escondidos === 1
            ? ' registro desta busca já aparece na lista de OS acima e não foi repetido aqui.'
            : ' registros desta busca já aparecem na lista de OS acima e não foram repetidos aqui.') +
        '</div>'
      : '';

    div.innerHTML = '<div class="secao-form" style="border-color:#f59e0b;">' +
      '<div class="secao-form-titulo" style="color:#f59e0b;">&#9888; Encontrado no histórico &mdash; somente leitura</div>' +
      '<div style="color:#9a9a9a;font-size:0.85rem;margin-bottom:0.6rem;">' +
        'Estes registros casaram com a busca em outras bases (série antiga e planilha da Sumaré) ' +
        'ou estavam escondidos pelos filtros da lista de cima. ' +
        'O status deles <strong>não pode ser alterado por aqui</strong>.' +
      '</div>' +
      corte +
      repetidos +
      novos.map(histCardHTML).join('') +
    '</div>';
  }

  function cardHTML(o, idx) {
    // montarOpcoesStatus (lib/status-os.js) garante que o status REAL da linha
    // sempre aparece marcado como selected — mesmo quando ele nao esta nas 5
    // etapas. Sem isso o browser selecionava a 1a opcao da lista por omissao, e
    // um clique desatento em "Salvar status" reescrevia o status real na
    // planilha. Continua valendo depois de 28/07: OS nova ja nasce 'Aberta',
    // mas as OS legadas em 'Em andamento' (ate a migracao rodar) e a
    // OS-2026-0864, gravada como 'Pronto p/ retirar' antes do rotulo virar
    // 'Finalizado', seguem fora do enum e dependem desta garantia.
    var listaOpcoes = (typeof montarOpcoesStatus === 'function') ? montarOpcoesStatus(o.status, etapas) : [];
    var opcoes = listaOpcoes.map(function(op) {
      return '<option value="' + esc(op.valor) + '"' + (op.selecionado ? ' selected' : '') + '>' + esc(op.rotulo) + '</option>';
    }).join('');
    return '' +
      '<div class="al-card" data-idx="' + idx + '" style="background:#161625;border:1px solid #2a2a2a;border-radius:8px;padding:0.85rem 1rem;margin-bottom:0.5rem;">' +
        '<strong style="color:var(--cor-primaria);font-size:1.05rem;">' + esc(o.numeroOS) + '</strong> ' +
        '<span class="badge" style="background:#3b82f6;border-radius:4px;font-size:0.75rem;padding:0.15rem 0.6rem;height:auto;min-width:0;">' + esc(o.status) + '</span>' +
        (o.atendimentoId
          ? ' <button class="os-ir-at btn-secundario btn-sm" data-pv="' + esc(o.atendimentoId) + '">' + esc(o.atendimentoId) + '</button>'
          : ' <span style="color:#f59e0b;">sem atendimento vinculado</span>') +
        '<div>' + esc(o.cliente) + ' &bull; ' + esc(o.modelo) + ' &bull; ' + esc(o.assistencia) + '</div>' +
        '<div style="font-style:italic;color:#9a9a9a;">' + esc(o.problema) + '</div>' +
        '<div style="margin-top:.5rem;display:flex;gap:.5rem;flex-wrap:wrap;">' +
          '<select class="os-status" data-os="' + esc(o.numeroOS) + '" data-status-atual="' + esc(o.status) + '">' + opcoes + '</select>' +
          '<button class="os-salvar btn-secundario btn-sm" data-os="' + esc(o.numeroOS) + '">Salvar status</button>' +
          '<a class="btn-secundario btn-sm" target="_blank" rel="noopener" ' +
             'href="?view=acompanhar&os=' + encodeURIComponent(o.numeroOS) + '">Ver como o cliente vê</a>' +
        '</div>' +
      '</div>';
  }

  // O resumo tem que CONTAR o corte, nao esconder: com 283 OS no filtro e 200
  // no payload a tela escrevia "200 OS", e a atendente jurava que as outras 83
  // nao existiam.
  function contagens() {
    // `exibidos` e quantas o backend diz ter mandado; cache.length e quantas a
    // tela recebeu. Se divergirem, vale o menor — o resumo nunca pode prometer
    // mais OS do que existem na tela.
    var mostradas = cache.length;
    if (exibidosUltimaResposta > 0 && exibidosUltimaResposta < mostradas) mostradas = exibidosUltimaResposta;
    var total = totalUltimaResposta > mostradas ? totalUltimaResposta : mostradas;
    return { mostradas: mostradas, total: total, cortada: total > mostradas };
  }

  function textoResumo(c) {
    if (!c.cortada) return c.mostradas + ' OS';
    return 'Mostrando as ' + c.mostradas + ' OS mais recentes de ' + c.total +
      ' no total. As ' + (c.total - c.mostradas) + ' mais antigas ficaram de fora desta lista — use a busca para achá-las.';
  }

  function pintarResumo() {
    var resumo = document.getElementById('osResumo');
    if (!resumo) return;
    var c = contagens();
    // textContent (nao innerHTML): so numeros nossos entram aqui, e assim
    // continua imune a texto vindo do backend.
    resumo.textContent = textoResumo(c);
    // Amarelo quando tem OS fora da tela; cinza quando a lista esta inteira.
    resumo.style.color = c.cortada ? '#f59e0b' : '#9a9a9a';
    resumo.style.fontWeight = c.cortada ? '600' : 'normal';
  }

  // Guarda os status crus que ja passaram pela tela. Cru (sem trim) porque e
  // exatamente isso que vai virar valor de <option> e depois querystring — o
  // backend compara por igualdade exata e nao trima.
  function lembrarStatusVistos(oses) {
    oses = oses || [];
    for (var i = 0; i < oses.length; i++) {
      var bruto = oses[i] == null ? '' : (typeof oses[i] === 'string' ? oses[i] : oses[i].status);
      var st = String(bruto == null ? '' : bruto);
      if (!st.trim() || statusVistos.indexOf(st) !== -1) continue;
      statusVistos.push(st);
    }
  }

  // Refaz o <select> do filtro com a uniao das 5 etapas + os status ja vistos
  // na sessao + a selecao atual (montarOpcoesFiltroStatus, lib/status-os.js).
  // Sem isso o filtro so oferecia as 5 etapas e devolvia sempre lista vazia —
  // as 287 OS de producao estao em 'Em andamento', que nao esta no enum. E sem
  // o acumulado (statusVistos) um filtro que devolve zero apagava justamente o
  // 'Em andamento' que a atendente precisava clicar de volta.
  //
  // A migracao (POST migrar_status_os_em_andamento_v1) zera esse legado, mas
  // este caminho NAO some com ela: enquanto a dona nao rodar, e sempre que
  // alguem editar a celula na mao com um texto qualquer, o status fora do enum
  // precisa continuar filtravel.
  function atualizarFiltroStatus() {
    var sel = document.getElementById('osStatus');
    if (!sel || typeof montarOpcoesFiltroStatus !== 'function') return;
    // Le a selecao ANTES de trocar as opcoes: a recarga nao pode zerar o filtro.
    var selecionado = sel.value;
    lembrarStatusVistos(cache);
    sel.innerHTML = montarOpcoesFiltroStatus(cache, etapas, selecionado, statusVistos).map(function(op) {
      return '<option value="' + esc(op.valor) + '"' + (op.selecionado ? ' selected' : '') + '>' + esc(op.rotulo) + '</option>';
    }).join('');
  }

  function render() {
    var div = document.getElementById('osLista');
    if (!div) return;

    // Antes do early-return da lista vazia: filtrar por um status e nao achar
    // nada nao pode fazer a opcao escolhida sumir do seletor.
    atualizarFiltroStatus();
    pintarResumo();

    if (cache.length === 0) {
      div.innerHTML = '<div style="padding:2rem;text-align:center;color:#9a9a9a;">Nenhuma OS encontrada com esses filtros.</div>';
      return;
    }

    div.innerHTML = cache.map(cardHTML).join('');

    div.querySelectorAll('.os-salvar').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var numeroOS = btn.getAttribute('data-os');
        var card = btn.closest('.al-card');
        var select = card ? card.querySelector('.os-status') : null;
        if (!select) return;
        // Guard: nao dispara escrita se a selecao for igual ao status atual —
        // fecha o outro lado do bug do seletor (clique sem querer, ou clique
        // "so pra ver", nao pode nunca reescrever nada na planilha).
        var statusAtual = select.getAttribute('data-status-atual') || '';
        if (select.value === statusAtual) {
          mostrarFeedback('Selecione um status diferente do atual antes de salvar.', 'info');
          return;
        }
        salvarStatus(numeroOS, select.value, btn);
      });
    });

    div.querySelectorAll('.os-ir-at').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-pv');
        // Mesmo hook que atendimentos-lista.js ja usa pra receber busca vinda de
        // outra view (window.__buscaAtendimento) — nao precisa mexer em app.js.
        window.__buscaAtendimento = id;
        if (typeof navigateTo === 'function') navigateTo('atendimentos');
      });
    });
  }

  function setupListeners() {
    document.getElementById('osBtnAplicar').addEventListener('click', function() {
      carregar(filtrosAtuais());
    });
    document.getElementById('osBtnLimpar').addEventListener('click', function() {
      document.getElementById('osStatus').value = '';
      document.getElementById('osBusca').value = '';
      carregar({});
    });
    document.getElementById('osBtnRefresh').addEventListener('click', function() {
      carregar(filtrosAtuais());
    });
    document.getElementById('osBusca').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); carregar(filtrosAtuais()); }
    });
  }

  function mostrarFeedback(msg, tipo) {
    var el = document.getElementById('osFeedback');
    if (!el) return;
    if (!msg) { el.innerHTML = ''; return; }
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.5rem 1rem;border-radius:6px;text-align:center;font-weight:600;font-size:0.85rem;">' + esc(msg) + '</div>';
  }

  function init() {
    var container = document.getElementById('os-lista-container');
    if (!container) return;
    container.innerHTML = buildHTML();
    setupListeners();
    // Chegada vinda do cartao do atendimento (atendimentos-lista.js clicou num
    // chip OS-...): abre a tela ja filtrada naquele numero. Espelho exato do
    // window.__buscaAtendimento que ESTA tela usa no caminho inverso — um so
    // mecanismo para navegar entre as duas views.
    if (window.__buscaOS) {
      var campoBusca = document.getElementById('osBusca');
      if (campoBusca) campoBusca.value = window.__buscaOS;
      window.__buscaOS = null;
    }
    carregar(filtrosAtuais());
  }

  // Ligado em app.js (navigateTo, case 'os') — mesmo mecanismo das outras
  // views (initClientes, initEstoque, initAtendimentosLista). Nada de listener
  // proprio em #nav-tabs: um so caminho pra abrir a tela, igual ao resto do app.
  window.initOSLista = init;
  window.OSLista = { carregar: carregar };
})();
