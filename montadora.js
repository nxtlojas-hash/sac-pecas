/* ===== NXT SAC V2.50 - Catalogo da Montadora (quantidade + foto) ===== */
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

  // Refaz o seletor (no comeco com o data.js, de novo quando a planilha chega),
  // mantendo o modelo que ja estava escolhido.
  function preencherModelos() {
    var sel = document.getElementById('mont-modelo');
    var escolhido = sel.value;
    sel.innerHTML = '<option value="">Escolha…</option>';
    modelosDaMontadora(CATALOGO_MODELOS).forEach(function(id) {
      var o = document.createElement('option');
      o.value = id; o.textContent = CATALOGO_MODELOS[id].nome;
      sel.appendChild(o);
    });
    if (escolhido && CATALOGO_MODELOS[escolhido]) sel.value = escolhido;
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
        '<div id="mont-nova" style="display:none;margin-bottom:0.5rem;"></div>' +
        '<div id="mont-lista"></div>' +
        '<p style="color:#6a6a6a;font-size:0.75rem;margin-top:1.5rem;line-height:1.5;">' +
          'Como usar: escolha o modelo, digite a quantidade e aperte Enter (ou saia do campo) — grava na hora. ' +
          'Quantidade vazia = ainda não contada. Zero = não tem. Para a foto, toque em "Trocar foto" e escolha a imagem.' +
        '</p>' +
        '<div style="border:1px solid #2a2a2a;border-radius:8px;padding:0.9rem 1rem;margin-top:0.75rem;font-size:0.85rem;line-height:1.55;color:#c8c8d0;">' +
          '<div style="color:' + COR + ';font-weight:700;font-size:0.75rem;letter-spacing:1px;margin-bottom:0.4rem;">PEÇA QUE NÃO ESTÁ NA LISTA</div>' +
          'Escolha o modelo e toque em <strong>+ Nova peça neste modelo</strong>: nome, preço, peso e foto. ' +
          'Use o <strong>nome do catálogo em PDF</strong> — o nome que você digitar vira o nome oficial da peça no SAC. ' +
          'Cada modelo tem a sua própria lista: editar, excluir ou renomear aqui vale só para o modelo escolhido.' +
          '<div style="color:' + COR + ';font-weight:700;font-size:0.75rem;letter-spacing:1px;margin:0.8rem 0 0.4rem;">AUTOPROPELIDO NOVO</div>' +
          'Modelo novo não se cadastra por aqui: avise a Claudia (NXT). Ela cria o modelo e, depois, as peças dele entram nesta tela.' +
        '</div>' +
      '</div>' +
      '<div id="toast" class="toast" style="display:none;"></div>';

    var sel = document.getElementById('mont-modelo');
    preencherModelos();
    sel.addEventListener('change', function() { modeloAtual = this.value; renderLista(); });
    document.getElementById('mont-busca').addEventListener('input', renderLista);
    montarNova();

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
    // 02/10: a 1a chamada do dia levou 50 s (aquecido, 3 s) e a tela ficou ~2 min
    // so com "Carregando". Com o relogio andando, quem abre sabe que nao travou.
    var inicio = Date.now();
    var relogio = setInterval(function() {
      var s = Math.round((Date.now() - inicio) / 1000);
      resumo.innerHTML = 'Carregando o catálogo… <b>' + s + ' s</b> — a primeira abertura do dia pode levar até 2 minutos. Não feche a página.';
    }, 1000);
    resumo.innerHTML = 'Carregando o catálogo… a primeira abertura do dia pode levar até 2 minutos. Não feche a página.';
    var avisoPecas = '';
    var pPecas = buscarJson('listar_pecas')
      .then(function(d) { if (d.pecas && typeof applySheetsParts === 'function') applySheetsParts(d.pecas); })
      .catch(function() { avisoPecas = ' · ⚠️ as fotos e peças novas da planilha NÃO carregaram — recarregue a página antes de trocar foto.'; });
    var pEst = buscarJson('listar_estoque')
      .then(function(d) { estoque = d.estoque || []; return true; })
      .catch(function() { return false; });
    Promise.all([pPecas, pEst]).then(function(res) {
      clearInterval(relogio);
      preencherModelos();
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
        '<button type="button" class="mont-editar" style="background:#1f1f1f;color:#fff;border:1px solid #333;border-radius:6px;padding:0.5rem 0.7rem;font-size:0.8rem;cursor:pointer;">Editar</button>' +
        '<button type="button" class="mont-excluir" style="background:none;color:#ef4444;border:1px solid #5a1f1f;border-radius:6px;padding:0.5rem 0.7rem;font-size:0.8rem;cursor:pointer;">Excluir</button>' +
        '<div class="mont-form" style="display:none;flex-basis:100%;"></div>' +
      '</div>';
    }).join('');

    var topo = document.getElementById('mont-nova');
    if (topo) topo.style.display = '';

    lista.querySelectorAll('.mont-qtd').forEach(function(inp) {
      inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); this.blur(); } });
      inp.addEventListener('change', function() { gravarQtd(this); });
    });
    lista.querySelectorAll('.mont-foto').forEach(function(inp) {
      inp.addEventListener('change', function() { trocarFoto(this); });
    });
    lista.querySelectorAll('.mont-editar').forEach(function(b) {
      b.addEventListener('click', function() { abrirEdicao(this); });
    });
    lista.querySelectorAll('.mont-excluir').forEach(function(b) {
      b.addEventListener('click', function() { pedirExclusao(this); });
    });
  }

  // A planilha nao carregou nesta abertura: nao deixar editar/excluir/cadastrar
  // em cima da lista de reserva (data.js) — gravaria por cima do que nao se viu.
  function planilhaCarregou(el) {
    if (window.PECAS_DA_PLANILHA) return true;
    if (el) status(el, 'A lista da planilha não carregou. Recarregue a página antes de editar.', '#ef4444');
    return false;
  }

  function inputStyle() {
    return 'padding:0.5rem;background:#161616;color:#fff;border:1px solid #333;border-radius:6px;font-size:0.95rem;width:100%;box-sizing:border-box;';
  }
  function precoTexto(v) { return (v == null || v === '' || isNaN(v)) ? '' : Number(v).toFixed(2).replace('.', ','); }
  function precoNumero(t) {
    var s = String(t || '').trim().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    if (s === '') return null;
    var n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }

  // ---------------------------------------------------------------- editar
  function abrirEdicao(btn) {
    if (!planilhaCarregou(btn)) return;
    var linha = linhaDe(btn);
    var idx = parseInt(linha.dataset.idx);
    var peca = CATALOGO_MODELOS[modeloAtual].pecas[idx];
    var form = linha.querySelector('.mont-form');
    form.style.display = 'block';
    form.innerHTML =
      '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:0.5rem;margin-top:0.5rem;">' +
        '<label style="font-size:0.7rem;color:#9a9a9a;">NOME<input class="ed-nome" value="' + esc(peca.nome) + '" style="' + inputStyle() + '"></label>' +
        '<label style="font-size:0.7rem;color:#9a9a9a;">PREÇO (R$)<input class="ed-preco" value="' + precoTexto(peca.preco) + '" placeholder="0,00" style="' + inputStyle() + '"></label>' +
        '<label style="font-size:0.7rem;color:#9a9a9a;">PESO<input class="ed-peso" value="' + esc(peca.peso || '') + '" placeholder="ex: 55gr" style="' + inputStyle() + '"></label>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">' +
        '<button type="button" class="ed-salvar" style="background:' + COR + ';color:#000;border:none;border-radius:6px;padding:0.5rem 0.9rem;font-weight:700;cursor:pointer;">Salvar</button>' +
        '<button type="button" class="ed-cancelar" style="background:none;color:#9a9a9a;border:1px solid #333;border-radius:6px;padding:0.5rem 0.9rem;cursor:pointer;">Cancelar</button>' +
      '</div>';
    form.querySelector('.ed-cancelar').addEventListener('click', function() { form.style.display = 'none'; form.innerHTML = ''; });
    form.querySelector('.ed-salvar').addEventListener('click', function() { salvarEdicao(linha, idx); });
  }

  function salvarEdicao(linha, idx) {
    var peca = CATALOGO_MODELOS[modeloAtual].pecas[idx];
    var form = linha.querySelector('.mont-form');
    var nome = form.querySelector('.ed-nome').value.trim();
    var preco = precoNumero(form.querySelector('.ed-preco').value);
    var peso = form.querySelector('.ed-peso').value.trim();
    var btn = form.querySelector('.ed-salvar');
    if (!nome) { status(btn, 'O nome não pode ficar vazio.', '#ef4444'); return; }
    if (preco !== null && isNaN(preco)) { status(btn, 'Preço inválido. Use 125,00.', '#ef4444'); return; }
    var trocouNome = chaveNome(nome) !== chaveNome(peca.nome);
    if (trocouNome && jaExisteNoModelo(nome, CATALOGO_MODELOS[modeloAtual].pecas)) {
      status(btn, 'Já existe uma peça com esse nome neste modelo.', '#ef4444'); return;
    }
    var nomeOriginal = peca.nome;
    var nova = { nome: nome, preco: preco, peso: peso || null, img: peca.img || '' };
    btn.disabled = true; status(btn, 'Gravando…', '#9a9a9a');
    savePartToSheets('editar', modeloAtual, idx, nova, null, null, nomeOriginal, peca.img).then(function(resp) {
      btn.disabled = false;
      var aviso = avisoDaGravacao(resp, false);
      if (aviso) { status(btn, aviso, '#ef4444'); return; }
      peca.nome = nome; peca.preco = preco; peca.peso = nova.peso;
      // A linha de saldo e por nome: se trocou o nome e havia contagem, leva junto.
      if (trocouNome) copiarSaldo(nomeOriginal, nome);
      renderLista();
      var nl = [].slice.call(document.querySelectorAll('.mont-linha')).filter(function(x) { return parseInt(x.dataset.idx) === idx; })[0];
      if (nl) status(nl.querySelector('.mont-editar'), 'Gravado ' + fmtData(agoraIso()) + '.', '#22c55e');
    });
  }

  function copiarSaldo(nomeAntigo, nomeNovo) {
    var m = chaveModeloEstoque(modeloAtual, CATALOGO_MODELOS).toLowerCase();
    var e = estoque.filter(function(x) { return String(x.modelo).toLowerCase() === m && chaveNome(x.peca) === chaveNome(nomeAntigo); })[0];
    if (!e || (parseInt(e.jaragua) || 0) < 0) return;
    var payload = { action: 'atualizar_estoque', modelo: chaveModeloEstoque(modeloAtual, CATALOGO_MODELOS), peca: nomeNovo, sumare: Math.max(0, parseInt(e.sumare) || 0), jaragua: parseInt(e.jaragua) || 0 };
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) })
      .then(function() { atualizarCache(payload.modelo, nomeNovo, payload.sumare, payload.jaragua); })
      .catch(function() {});
  }

  // ---------------------------------------------------------------- excluir
  function pedirExclusao(btn) {
    if (!planilhaCarregou(btn)) return;
    var linha = linhaDe(btn);
    var idx = parseInt(linha.dataset.idx);
    var peca = CATALOGO_MODELOS[modeloAtual].pecas[idx];
    var form = linha.querySelector('.mont-form');
    form.style.display = 'block';
    form.innerHTML = '<div style="margin-top:0.5rem;display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">' +
      '<span>Excluir <strong>' + esc(peca.nome) + '</strong> do modelo ' + esc(CATALOGO_MODELOS[modeloAtual].nome) + '?</span>' +
      '<button type="button" class="ex-sim" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:0.5rem 0.9rem;font-weight:700;cursor:pointer;">Sim, excluir</button>' +
      '<button type="button" class="ex-nao" style="background:none;color:#9a9a9a;border:1px solid #333;border-radius:6px;padding:0.5rem 0.9rem;cursor:pointer;">Não</button></div>';
    form.querySelector('.ex-nao').addEventListener('click', function() { form.style.display = 'none'; form.innerHTML = ''; });
    form.querySelector('.ex-sim').addEventListener('click', function() {
      var b = this; b.disabled = true; status(b, 'Excluindo…', '#9a9a9a');
      savePartToSheets('excluir', modeloAtual, idx, peca).then(function(resp) {
        if (!resp || resp.sucesso === false) { b.disabled = false; status(b, 'NÃO excluiu: ' + (resp && resp.erro ? resp.erro : 'o servidor não respondeu.'), '#ef4444'); return; }
        CATALOGO_MODELOS[modeloAtual].pecas.splice(idx, 1);
        renderLista();
        document.getElementById('mont-resumo').innerHTML += ' · <span style="color:#22c55e;">"' + esc(peca.nome) + '" excluída.</span>';
      });
    });
  }

  // ---------------------------------------------------------------- nova peca
  function montarNova() {
    var box = document.getElementById('mont-nova');
    box.innerHTML = '<button type="button" id="mont-nova-abrir" style="background:' + COR + ';color:#000;border:none;border-radius:6px;padding:0.55rem 0.9rem;font-weight:700;cursor:pointer;">+ Nova peça neste modelo</button>' +
      '<div id="mont-nova-form" style="display:none;margin-top:0.5rem;border:1px solid #2a2a2a;border-radius:8px;padding:0.75rem;"></div>';
    document.getElementById('mont-nova-abrir').addEventListener('click', function() {
      if (!planilhaCarregou()) { document.getElementById('mont-resumo').innerHTML = '<span style="color:#ef4444;">A lista da planilha não carregou. Recarregue a página antes de cadastrar.</span>'; return; }
      var f = document.getElementById('mont-nova-form');
      f.style.display = 'block';
      f.innerHTML =
        '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:0.5rem;">' +
          '<label style="font-size:0.7rem;color:#9a9a9a;">NOME (o do catálogo em PDF)<input class="nv-nome" style="' + inputStyle() + '"></label>' +
          '<label style="font-size:0.7rem;color:#9a9a9a;">PREÇO (R$)<input class="nv-preco" placeholder="0,00" style="' + inputStyle() + '"></label>' +
          '<label style="font-size:0.7rem;color:#9a9a9a;">PESO<input class="nv-peso" placeholder="ex: 55gr" style="' + inputStyle() + '"></label>' +
        '</div>' +
        '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;align-items:center;flex-wrap:wrap;">' +
          '<label style="cursor:pointer;background:#1f1f1f;border:1px solid #333;border-radius:6px;padding:0.5rem 0.7rem;font-size:0.8rem;">Foto (opcional)<input type="file" accept="image/*" class="nv-foto" style="display:none;"></label>' +
          '<span class="nv-foto-nome" style="color:#9a9a9a;font-size:0.8rem;"></span>' +
          '<button type="button" class="nv-salvar" style="background:' + COR + ';color:#000;border:none;border-radius:6px;padding:0.5rem 0.9rem;font-weight:700;cursor:pointer;">Cadastrar</button>' +
          '<button type="button" class="nv-cancelar" style="background:none;color:#9a9a9a;border:1px solid #333;border-radius:6px;padding:0.5rem 0.9rem;cursor:pointer;">Cancelar</button>' +
        '</div>' +
        '<div class="nv-status" style="font-size:0.8rem;margin-top:0.4rem;min-height:1em;"></div>';
      f.querySelector('.nv-foto').addEventListener('change', function() { f.querySelector('.nv-foto-nome').textContent = this.files[0] ? this.files[0].name : ''; });
      f.querySelector('.nv-cancelar').addEventListener('click', function() { f.style.display = 'none'; f.innerHTML = ''; });
      f.querySelector('.nv-salvar').addEventListener('click', function() { cadastrarNova(f); });
    });
  }

  function cadastrarNova(f) {
    var st = f.querySelector('.nv-status');
    var diga = function(m, c) { st.textContent = m; st.style.color = c; };
    if (!modeloAtual) { diga('Escolha o modelo primeiro.', '#ef4444'); return; }
    var nome = f.querySelector('.nv-nome').value.trim();
    var preco = precoNumero(f.querySelector('.nv-preco').value);
    var peso = f.querySelector('.nv-peso').value.trim();
    var file = f.querySelector('.nv-foto').files[0];
    if (!nome) { diga('Informe o nome da peça.', '#ef4444'); return; }
    if (preco !== null && isNaN(preco)) { diga('Preço inválido. Use 125,00.', '#ef4444'); return; }
    if (jaExisteNoModelo(nome, CATALOGO_MODELOS[modeloAtual].pecas)) { diga('Já existe uma peça com esse nome neste modelo. Edite a que existe.', '#ef4444'); return; }
    var btn = f.querySelector('.nv-salvar'); btn.disabled = true;
    var peca = { nome: nome, preco: preco, peso: peso || null, img: '' };
    var idx = CATALOGO_MODELOS[modeloAtual].pecas.length;
    var seguir = function(base64) {
      diga(base64 ? 'Enviando a foto e cadastrando…' : 'Cadastrando…', '#9a9a9a');
      var nomeArq = base64 ? (nome + '.jpg').replace(/[\\/:*?"<>|]/g, '_') : null;
      savePartToSheets('adicionar', modeloAtual, idx, peca, base64, nomeArq).then(function(resp) {
        btn.disabled = false;
        var aviso = avisoDaGravacao(resp, !!base64);
        if (resp && resp.sucesso) {
          peca.img = resp.imagemUrl || '';
          CATALOGO_MODELOS[modeloAtual].pecas.push(peca);
          renderLista();
          f.style.display = 'none'; f.innerHTML = '';
          document.getElementById('mont-resumo').innerHTML += ' · <span style="color:' + (aviso ? '#f59e0b' : '#22c55e') + ';">"' + esc(nome) + '" cadastrada' + (aviso ? ' (' + esc(aviso) + ')' : '') + '.</span>';
        } else {
          diga(aviso || 'Não cadastrou.', '#ef4444');
        }
      });
    };
    if (file) comprimirImagem(file, function(b64) { if (!b64) { btn.disabled = false; diga('Não consegui ler essa imagem.', '#ef4444'); return; } seguir(b64); });
    else seguir(null);
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
