/* ===== NXT SAC V2.45 - Catalogo da Montadora (quantidade + foto) ===== */
// Pagina propria: sac-pecas/?view=montadora
// Para quem esta em Jaragua (Rafael): escolhe o modelo, digita a quantidade
// que a montadora tem para o SAC e troca a foto. So isso. Sem Admin, sem
// preco, sem lixeira, sem Sumare (Sumare so recebe — Jacque, 29/09).
//
// Grava pelas acoes que o servidor ja tem (atualizar_estoque, gerenciar_peca);
// as regras estao em lib/montadora.js, com teste.

(function() {
  var COR = '#c6ff00';
  var estoque = [];      // lista crua de listar_estoque
  var modeloAtual = '';

  function fmtData(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var p = function(n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function agoraIso() { return new Date().toISOString(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function modelosComPecas() {
    return Object.keys(CATALOGO_MODELOS).filter(function(id) {
      return id !== 'outro' && (CATALOGO_MODELOS[id].pecas || []).length > 0;
    }).sort(function(a, b) {
      return CATALOGO_MODELOS[a].nome.localeCompare(CATALOGO_MODELOS[b].nome, 'pt-BR');
    });
  }

  window.renderMontadora = function() {
    document.title = 'Catálogo da montadora — NXT';
    document.body.style.background = '#0d0d0d';
    document.body.innerHTML =
      '<div style="max-width:980px;margin:0 auto;padding:1.25rem 1rem 3rem;font-family:Arial,Helvetica,sans-serif;color:#e8e8f0;">' +
        '<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;">' +
          '<img src="logo-nxt.png" alt="NXT" style="height:40px;width:auto;">' +
          '<div>' +
            '<div style="color:' + COR + ';font-weight:700;letter-spacing:1px;font-size:0.8rem;">CATÁLOGO DA MONTADORA</div>' +
            '<div style="color:#9a9a9a;font-size:0.85rem;">Quantidade que a montadora tem para o SAC, e a foto de cada peça. O SAC vê na hora.</div>' +
          '</div>' +
        '</div>' +
        '<div id="mont-topo" style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:flex-end;margin-bottom:0.75rem;">' +
          '<label style="display:flex;flex-direction:column;gap:0.25rem;font-size:0.75rem;color:#9a9a9a;">MODELO' +
            '<select id="mont-modelo" style="min-width:200px;padding:0.55rem;background:#161616;color:#fff;border:1px solid #333;border-radius:6px;font-size:1rem;"><option value="">Escolha…</option></select>' +
          '</label>' +
          '<label style="display:flex;flex-direction:column;gap:0.25rem;font-size:0.75rem;color:#9a9a9a;flex:1;min-width:200px;">PROCURAR PEÇA' +
            '<input id="mont-busca" type="text" placeholder="Digite parte do nome…" style="padding:0.55rem;background:#161616;color:#fff;border:1px solid #333;border-radius:6px;font-size:1rem;">' +
          '</label>' +
        '</div>' +
        '<div id="mont-resumo" style="color:#9a9a9a;font-size:0.85rem;margin-bottom:0.5rem;">Carregando o catálogo…</div>' +
        '<div id="mont-lista"></div>' +
        '<p style="color:#6a6a6a;font-size:0.75rem;margin-top:1.5rem;line-height:1.5;">' +
          'Como usar: escolha o modelo, digite a quantidade e aperte Enter (ou saia do campo) — grava na hora. ' +
          'Quantidade vazia = ainda não contada. Zero = não tem. Para a foto, toque em "Trocar foto" e escolha a imagem.' +
        '</p>' +
        '<div style="border:1px solid #2a2a2a;border-radius:8px;padding:0.9rem 1rem;margin-top:0.75rem;font-size:0.85rem;line-height:1.55;color:#c8c8d0;">' +
          '<div style="color:' + COR + ';font-weight:700;font-size:0.75rem;letter-spacing:1px;margin-bottom:0.4rem;">PEÇA QUE NÃO ESTÁ NA LISTA</div>' +
          'Cadastre em <a href="./?view=admin" target="_blank" style="color:' + COR + ';">Admin › Peças › Adicionar</a>: modelo, nome, preço, peso e foto. ' +
          'Use o <strong>nome do catálogo em PDF</strong> — o nome que você digitar vira o nome oficial da peça no SAC. ' +
          'Depois de salvar, recarregue esta página e ela aparece aqui.' +
          '<div style="color:' + COR + ';font-weight:700;font-size:0.75rem;letter-spacing:1px;margin:0.8rem 0 0.4rem;">AUTOPROPELIDO NOVO</div>' +
          'Modelo novo não se cadastra por aqui: avise a Claudia (NXT). Ela cria o modelo e, depois, as peças dele entram nesta tela.' +
        '</div>' +
      '</div>' +
      '<div id="toast" class="toast" style="display:none;"></div>';

    var sel = document.getElementById('mont-modelo');
    modelosComPecas().forEach(function(id) {
      var o = document.createElement('option');
      o.value = id; o.textContent = CATALOGO_MODELOS[id].nome;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function() { modeloAtual = this.value; renderLista(); });
    document.getElementById('mont-busca').addEventListener('input', renderLista);

    carregar();
  };

  // O Apps Script as vezes demora 30 s ou devolve a pagina HTML de erro do
  // Google em vez do JSON (medido em 30/09: 404 HTML numa chamada, 200 em 36 s
  // na seguinte). Le como texto, tenta ate 3 vezes, e nunca renderiza a lista
  // sem os saldos — senao tudo pareceria "sem contagem" e a montadora contaria
  // de novo por cima.
  function buscarJson(action, tentativas) {
    tentativas = tentativas || 3;
    return fetch(GOOGLE_SCRIPT_URL + '?action=' + action, { redirect: 'follow' })
      .then(function(r) { return r.text(); })
      .then(function(t) {
        var d = null;
        try { d = JSON.parse(t); } catch (e) {}
        if (d && d.sucesso) return d;
        throw new Error('resposta invalida');
      })
      .catch(function(err) {
        if (tentativas > 1) return buscarJson(action, tentativas - 1);
        throw err;
      });
  }

  // Pecas da planilha (fotos e pecas novas) + saldos, em paralelo. So depois renderiza.
  function carregar() {
    var resumo = document.getElementById('mont-resumo');
    resumo.innerHTML = 'Carregando o catálogo… (o servidor do Google pode levar até 1 minuto)';
    var avisoPecas = '';
    var pPecas = buscarJson('listar_pecas')
      .then(function(d) { if (d.pecas && typeof applySheetsParts === 'function') applySheetsParts(d.pecas); })
      .catch(function() { avisoPecas = ' · ⚠️ as fotos e peças novas da planilha NÃO carregaram — recarregue a página antes de trocar foto.'; });
    var pEst = buscarJson('listar_estoque')
      .then(function(d) { estoque = d.estoque || []; return true; })
      .catch(function() { return false; });
    Promise.all([pPecas, pEst]).then(function(res) {
      if (!res[1]) {
        resumo.innerHTML = '<span style="color:#ef4444;">Não consegui carregar os saldos (o servidor do Google não respondeu). Sem eles a lista não aparece, para não contar por cima.</span> ' +
          '<button type="button" id="mont-retry" style="margin-left:0.5rem;padding:0.4rem 0.8rem;background:#1f1f1f;color:#fff;border:1px solid #333;border-radius:6px;cursor:pointer;">Tentar de novo</button>';
        document.getElementById('mont-retry').addEventListener('click', carregar);
        return;
      }
      resumo.textContent = 'Escolha o modelo para ver as peças.' + avisoPecas;
      var params = new URLSearchParams(location.search);
      var m = params.get('modelo');
      if (m && CATALOGO_MODELOS[m]) {
        document.getElementById('mont-modelo').value = m;
        modeloAtual = m;
      }
      renderLista(avisoPecas);
    });
  }

  var avisoPecasAtual = '';
  function renderLista(avisoPecas) {
    if (typeof avisoPecas === 'string') avisoPecasAtual = avisoPecas;
    var lista = document.getElementById('mont-lista');
    var resumo = document.getElementById('mont-resumo');
    if (!modeloAtual) { lista.innerHTML = ''; return; }

    var linhas = linhasMontadora(modeloAtual, CATALOGO_MODELOS, estoque);
    var q = (document.getElementById('mont-busca').value || '').trim().toLowerCase();
    var vis = q ? linhas.filter(function(l) { return l.nome.toLowerCase().indexOf(q) !== -1; }) : linhas;
    var contadas = linhas.filter(function(l) { return l.contado; }).length;
    var semFoto = linhas.filter(function(l) { return !l.img; }).length;
    resumo.innerHTML = '<strong style="color:#fff;">' + esc(CATALOGO_MODELOS[modeloAtual].nome) + '</strong>: ' +
      linhas.length + ' peças · ' + contadas + ' com quantidade · ' + (linhas.length - contadas) + ' sem contagem · ' + semFoto + ' sem foto' +
      (q ? ' · mostrando ' + vis.length : '') + esc(avisoPecasAtual);

    lista.innerHTML = vis.map(function(l) {
      var thumb = l.img
        ? '<img src="' + esc(l.img) + '" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:6px;background:#222;">'
        : '<div style="width:64px;height:64px;border-radius:6px;background:#222;display:flex;align-items:center;justify-content:center;color:#666;font-size:0.7rem;text-align:center;">sem<br>foto</div>';
      return '<div class="mont-linha" data-idx="' + l.idx + '" style="display:flex;gap:0.75rem;align-items:center;padding:0.6rem 0.5rem;border-bottom:1px solid #222;flex-wrap:wrap;">' +
        '<div class="mont-thumb">' + thumb + '</div>' +
        '<div style="flex:1;min-width:180px;">' +
          '<div style="font-weight:600;">' + esc(l.nome) + '</div>' +
          '<div style="color:#9a9a9a;font-size:0.8rem;">' + (l.preco != null && l.preco > 0 ? 'R$ ' + Number(l.preco).toFixed(2).replace('.', ',') : 'sem preço') +
            (l.ultima ? ' · gravado ' + esc(fmtData(l.ultima)) : '') + '</div>' +
          '<div class="mont-status" style="font-size:0.8rem;min-height:1em;"></div>' +
        '</div>' +
        '<label style="display:flex;flex-direction:column;font-size:0.7rem;color:#9a9a9a;gap:0.2rem;">QTD JARAGUÁ' +
          '<input type="number" min="0" step="1" class="mont-qtd" value="' + (l.contado ? l.jaragua : '') + '" placeholder="—" data-sumare="' + l.sumare + '" ' +
            'style="width:90px;padding:0.5rem;font-size:1.1rem;text-align:center;background:#161616;color:#fff;border:1px solid ' + (l.contado ? '#333' : '#8a6d00') + ';border-radius:6px;">' +
        '</label>' +
        '<label style="cursor:pointer;background:#1f1f1f;border:1px solid #333;border-radius:6px;padding:0.5rem 0.7rem;font-size:0.8rem;">Trocar foto' +
          '<input type="file" accept="image/*" class="mont-foto" style="display:none;">' +
        '</label>' +
      '</div>';
    }).join('');

    lista.querySelectorAll('.mont-qtd').forEach(function(inp) {
      inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); this.blur(); } });
      inp.addEventListener('change', function() { gravarQtd(this); });
    });
    lista.querySelectorAll('.mont-foto').forEach(function(inp) {
      inp.addEventListener('change', function() { trocarFoto(this); });
    });
  }

  function linhaDe(el) { return el.closest('.mont-linha'); }
  function status(el, msg, cor) {
    var s = linhaDe(el).querySelector('.mont-status');
    s.textContent = msg; s.style.color = cor;
  }

  // Grava a quantidade: modelo pelo NOME (a linha que a venda baixa), Sumare
  // como esta (atualizar_estoque sobrescreve as duas colunas).
  function gravarQtd(inp) {
    var linha = linhaDe(inp);
    var idx = parseInt(linha.dataset.idx);
    var peca = CATALOGO_MODELOS[modeloAtual].pecas[idx];
    var v = inp.value.trim();
    if (v === '') { status(inp, 'Digite a quantidade (0 = não tem).', '#f59e0b'); return; }
    var n = parseInt(v);
    if (isNaN(n) || n < 0) { status(inp, 'Quantidade inválida.', '#ef4444'); return; }

    var sumare = parseInt(inp.dataset.sumare) || 0;
    if (sumare < 0) sumare = 0;
    var payload = {
      action: 'atualizar_estoque',
      modelo: chaveModeloEstoque(modeloAtual, CATALOGO_MODELOS),
      peca: peca.nome,
      sumare: sumare,
      jaragua: n
    };
    status(inp, 'Gravando…', '#9a9a9a');
    inp.disabled = true;
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) })
      .then(function(r) { return r.text(); })
      .then(function(t) {
        var d = null;
        try { d = JSON.parse(t); } catch (e) {}
        if (d && d.sucesso) {
          atualizarCache(payload.modelo, peca.nome, sumare, n);
          inp.style.borderColor = '#22c55e';
          status(inp, 'Gravado ' + fmtData(agoraIso()) + ' — o SAC já vê ' + n + '.', '#22c55e');
        } else {
          inp.style.borderColor = '#ef4444';
          status(inp, 'NÃO gravou: ' + (d && d.erro ? d.erro : 'o servidor não respondeu. Tente de novo.'), '#ef4444');
        }
      })
      .catch(function(err) {
        inp.style.borderColor = '#ef4444';
        status(inp, 'NÃO gravou (sem internet?): ' + err.message, '#ef4444');
      })
      .finally(function() { inp.disabled = false; });
  }

  function atualizarCache(modeloNome, pecaNome, sumare, jaragua) {
    var k = pecaNome.toLowerCase(), m = modeloNome.toLowerCase();
    for (var i = 0; i < estoque.length; i++) {
      if (String(estoque[i].modelo).toLowerCase() === m && String(estoque[i].peca).toLowerCase() === k) {
        estoque[i].sumare = sumare; estoque[i].jaragua = jaragua; estoque[i].ultimaAtualizacao = agoraIso();
        return;
      }
    }
    estoque.push({ modelo: modeloNome, peca: pecaNome, sumare: sumare, jaragua: jaragua, ultimaAtualizacao: agoraIso() });
  }

  // Foto: comprime (formulario.js) e grava pela mesma funcao do Admin, que ja
  // sabe cadastrar a peca do arquivo-base que ainda nao esta na planilha (v2.43).
  function trocarFoto(inp) {
    var file = inp.files && inp.files[0];
    if (!file) return;
    var linha = linhaDe(inp);
    var idx = parseInt(linha.dataset.idx);
    var modelId = modeloAtual;
    var peca = CATALOGO_MODELOS[modelId].pecas[idx];
    var imgAnterior = peca.img || '';
    if (!file.type || file.type.indexOf('image/') !== 0) { status(inp, 'Escolha um arquivo de imagem.', '#ef4444'); inp.value = ''; return; }

    status(inp, 'Preparando a foto…', '#9a9a9a');
    comprimirImagem(file, function(base64) {
      inp.value = '';
      if (!base64) { status(inp, 'Não consegui ler essa imagem.', '#ef4444'); return; }
      var thumb = linha.querySelector('.mont-thumb');
      thumb.innerHTML = '<img src="' + base64 + '" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:6px;opacity:0.5;">';
      status(inp, 'Enviando a foto…', '#9a9a9a');
      var nomeArq = (peca.nome + '.jpg').replace(/[\\/:*?"<>|]/g, '_');
      savePartToSheets('editar', modelId, idx, peca, base64, nomeArq, peca.nome, imgAnterior).then(function(resp) {
        var aviso = avisoDaGravacao(resp, true);
        if (aviso) {
          thumb.innerHTML = imgAnterior
            ? '<img src="' + esc(imgAnterior) + '" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:6px;">'
            : '<div style="width:64px;height:64px;border-radius:6px;background:#222;display:flex;align-items:center;justify-content:center;color:#666;font-size:0.7rem;text-align:center;">sem<br>foto</div>';
          status(inp, aviso, '#ef4444');
          return;
        }
        peca.img = resp.imagemUrl;
        thumb.innerHTML = '<img src="' + esc(resp.imagemUrl) + '" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:6px;">';
        status(inp, 'Foto guardada ' + fmtData(agoraIso()) + '.', '#22c55e');
      });
    });
  }
})();
