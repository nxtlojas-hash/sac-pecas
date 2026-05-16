/* ===== NXT SAC V2.23 - Clientes (Timeline Fase 2b) ===== */

(function() {
  var SCRIPT_URL = null;
  function resolverUrl() {
    if (SCRIPT_URL) return SCRIPT_URL;
    if (typeof GOOGLE_SCRIPT_URL !== 'undefined') {
      SCRIPT_URL = GOOGLE_SCRIPT_URL;
      return SCRIPT_URL;
    }
    throw new Error('GOOGLE_SCRIPT_URL nao definida — carregar formulario.js primeiro.');
  }

  var LS_RECENTES = 'nxt-sac-clientes-recentes';
  var clientesResultado = []; // array de clientes da ultima busca

  window.initClientes = function() {
    var container = document.getElementById('clientes-container');
    if (!container) return;
    container.innerHTML = buildHTML();
    setupListeners();
    renderRecentes();
    console.log('Clientes (Fase 2b) inicializado');
  };

  function buildHTML() {
    return '<h2 style="color:var(--cor-primaria);margin-bottom:1rem;">&#128100; Clientes</h2>' +
      '<div class="secao-form">' +
        '<div class="secao-form-titulo">Buscar cliente</div>' +
        '<div class="form-row" style="align-items:flex-end;">' +
          '<div class="form-group" style="flex:3 1 320px;">' +
            '<label for="cliBusca">CPF / Telefone / Nome</label>' +
            '<input type="text" id="cliBusca" placeholder="Digite CPF, telefone ou nome..." autocomplete="off">' +
          '</div>' +
          '<div class="form-group" style="flex:0 0 auto;">' +
            '<button type="button" class="btn-primario" id="btnBuscarCli">&#128269; Buscar</button>' +
          '</div>' +
        '</div>' +
        '<div id="cliFeedback" style="margin-top:0.5rem;"></div>' +
      '</div>' +

      '<div id="cliRecentes" class="secao-form" style="display:none;">' +
        '<div class="secao-form-titulo">Recentes</div>' +
        '<div id="cliRecentesLista" style="display:flex;flex-wrap:wrap;gap:0.5rem;padding:0.5rem 1rem;"></div>' +
      '</div>' +

      '<div id="cliResultado" style="margin-top:1rem;"></div>';
  }

  function setupListeners() {
    document.getElementById('btnBuscarCli').addEventListener('click', buscar);
    document.getElementById('cliBusca').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        buscar();
      }
    });
  }

  function getRecentes() {
    try {
      return JSON.parse(localStorage.getItem(LS_RECENTES) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveRecente(query) {
    var trimmed = (query || '').trim();
    if (!trimmed) return;
    var lista = getRecentes();
    lista = lista.filter(function(q) { return q.toLowerCase() !== trimmed.toLowerCase(); });
    lista.unshift(trimmed);
    lista = lista.slice(0, 10);
    localStorage.setItem(LS_RECENTES, JSON.stringify(lista));
  }

  function renderRecentes() {
    var lista = getRecentes();
    var wrap = document.getElementById('cliRecentes');
    var div = document.getElementById('cliRecentesLista');
    if (!wrap || !div) return;
    if (lista.length === 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    div.innerHTML = lista.map(function(q) {
      return '<button type="button" class="btn-secundario btn-sm" data-q="' + escapeAttr(q) + '" style="font-size:0.8rem;padding:0.3rem 0.7rem;">' + escapeHtmlCli(q) + '</button>';
    }).join('');
    div.querySelectorAll('button[data-q]').forEach(function(b) {
      b.addEventListener('click', function() {
        document.getElementById('cliBusca').value = b.dataset.q;
        buscar();
      });
    });
  }

  function buscar() {
    var q = (document.getElementById('cliBusca').value || '').trim();
    if (!q) return mostrarFeedback('Digite CPF, telefone ou nome', 'erro');

    var soDigitos = q.replace(/\D/g, '');
    var params = [];
    if (soDigitos.length >= 10 && soDigitos.length <= 11 && q.indexOf('.') === -1 && q.indexOf('-') === -1) {
      // 10-11 digitos sem mascara: tenta tel
      params.push('telefone=' + encodeURIComponent(soDigitos));
    } else if (soDigitos.length === 11 || soDigitos.length === 14) {
      params.push('cpf=' + encodeURIComponent(soDigitos));
    } else if (soDigitos.length >= 10) {
      // Massa de digitos: tenta como telefone ou cpf
      params.push('cpf=' + encodeURIComponent(soDigitos));
      params.push('telefone=' + encodeURIComponent(soDigitos));
    } else {
      params.push('nome=' + encodeURIComponent(q));
    }

    mostrarFeedback('Buscando...', 'info');
    document.getElementById('cliResultado').innerHTML = '';

    fetch(resolverUrl() + '?action=buscar_cliente_consolidado&' + params.join('&'))
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (!resp || !resp.sucesso) {
          return mostrarFeedback('Erro: ' + (resp && resp.erro ? resp.erro : 'sem resposta'), 'erro');
        }
        clientesResultado = resp.clientes || [];
        saveRecente(q);
        renderRecentes();
        if (clientesResultado.length === 0) {
          mostrarFeedback('Nenhum cliente encontrado.', 'erro');
        } else {
          mostrarFeedback(clientesResultado.length + ' cliente(s) encontrado(s).', 'sucesso');
        }
        renderResultados();
      })
      .catch(function(err) {
        mostrarFeedback('Erro de rede: ' + err.message, 'erro');
      });
  }

  function renderResultados() {
    var div = document.getElementById('cliResultado');
    if (!div) return;
    if (clientesResultado.length === 0) { div.innerHTML = ''; return; }

    div.innerHTML = clientesResultado.map(function(c, idx) {
      return renderCliente(c, idx);
    }).join('');

    div.querySelectorAll('.cli-card-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.idx);
        var painel = document.getElementById('cli-timeline-' + idx);
        if (!painel) return;
        var aberto = painel.style.display !== 'none';
        painel.style.display = aberto ? 'none' : 'block';
        btn.textContent = aberto ? 'Ver timeline ▼' : 'Ocultar timeline ▲';
      });
    });

    // Bind botoes "Vincular a atendimento" (legados)
    div.querySelectorAll('.cli-btn-vincular').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var cliIdx = parseInt(btn.dataset.cli);
        var evIdx = parseInt(btn.dataset.ev);
        var c = clientesResultado[cliIdx];
        if (!c) return;
        var ev = c.eventos[evIdx];
        if (!ev) return;
        abrirModalVincular(ev, c);
      });
    });

    // Bind botoes "Editar status" (atendimentos)
    div.querySelectorAll('.cli-btn-editar-status').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var cliIdx = parseInt(btn.dataset.cli);
        var evIdx = parseInt(btn.dataset.ev);
        var c = clientesResultado[cliIdx];
        if (!c) return;
        var ev = c.eventos[evIdx];
        if (!ev) return;
        abrirModalEditarStatus(ev, cliIdx, evIdx);
      });
    });

    // Bind botoes "Novo atendimento" do card do cliente
    div.querySelectorAll('.cli-card-novo-at').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.idx);
        var c = clientesResultado[idx];
        if (!c) return;
        // Seta preFill com dados do cliente para o wizard de atendimento
        var modeloDoEvento = '';
        if (c.eventos && c.eventos.length) {
          for (var i = 0; i < c.eventos.length; i++) {
            var ev = c.eventos[i];
            if (ev.modelo) { modeloDoEvento = ev.modelo; break; }
          }
        }
        window.__preFillAtendimento = {
          nome: c.nome || '',
          telefone: c.telefones && c.telefones[0] ? c.telefones[0] : '',
          cpfCnpj: c.cpfs && c.cpfs[0] ? c.cpfs[0] : '',
          notaFiscal: c.nfs && c.nfs[0] ? c.nfs[0] : '',
          modelo: modeloDoEvento
        };
        navigateTo('atendimento');
      });
    });
  }

  function abrirModalEditarStatus(ev, cliIdx, evIdx) {
    var existente = document.getElementById('cliModalStatus');
    if (existente) existente.remove();

    var statusAtual = ev.status || 'Aberto';
    var statusOpts = ['Aberto', 'Em andamento', 'Aguardando cliente', 'Resolvido', 'Fechado']
      .map(function(s) {
        return '<option value="' + s + '"' + (s === statusAtual ? ' selected' : '') + '>' + s + '</option>';
      }).join('');

    var modal = document.createElement('div');
    modal.id = 'cliModalStatus';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem;';

    modal.innerHTML =
      '<div style="background:#1c1c1c;border:1px solid #2a2a2a;border-radius:8px;max-width:480px;width:100%;">' +
        '<div style="background:#1a1a2e;color:#fff;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;border-radius:8px 8px 0 0;">' +
          '<div>' +
            '<div style="font-size:11px;letter-spacing:1.5px;color:#c6ff00;font-weight:700;">EDITAR STATUS</div>' +
            '<div style="font-size:16px;font-weight:700;margin-top:2px;">' + escapeHtmlCli(ev.id) + '</div>' +
          '</div>' +
          '<button id="cliStatusClose" style="background:transparent;border:none;color:#fff;font-size:28px;cursor:pointer;line-height:1;">&times;</button>' +
        '</div>' +
        '<div style="padding:1.25rem;color:#e8e8f0;">' +
          '<div style="margin-bottom:1rem;">' +
            '<label style="display:block;font-size:0.8rem;color:#9a9a9a;text-transform:uppercase;margin-bottom:0.5rem;">Novo status</label>' +
            '<select id="cliStatusSelect" style="width:100%;padding:0.6rem;background:#161625;border:1px solid #2a2a2a;border-radius:6px;color:#fff;font-size:0.95rem;">' + statusOpts + '</select>' +
          '</div>' +
          '<div id="cliStatusMotivoWrap" style="margin-bottom:1rem;display:' + (statusAtual === 'Resolvido' || statusAtual === 'Fechado' ? 'block' : 'none') + ';">' +
            '<label style="display:block;font-size:0.8rem;color:#9a9a9a;text-transform:uppercase;margin-bottom:0.5rem;">Motivo do fechamento (opcional)</label>' +
            '<input type="text" id="cliStatusMotivo" placeholder="Ex: Pe&ccedil;a entregue / Cliente n&atilde;o retornou" style="width:100%;padding:0.6rem;background:#161625;border:1px solid #2a2a2a;border-radius:6px;color:#fff;font-size:0.95rem;">' +
          '</div>' +
          '<div id="cliStatusFeedback" style="margin-top:0.5rem;"></div>' +
          '<div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1rem;">' +
            '<button type="button" class="btn-secundario" id="cliStatusCancelar">Cancelar</button>' +
            '<button type="button" class="btn-primario" id="cliStatusConfirmar">Salvar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    function fechar() { modal.remove(); }
    document.getElementById('cliStatusClose').addEventListener('click', fechar);
    document.getElementById('cliStatusCancelar').addEventListener('click', fechar);

    document.getElementById('cliStatusSelect').addEventListener('change', function() {
      var fechamento = (this.value === 'Resolvido' || this.value === 'Fechado');
      document.getElementById('cliStatusMotivoWrap').style.display = fechamento ? 'block' : 'none';
    });

    document.getElementById('cliStatusConfirmar').addEventListener('click', function() {
      var novoStatus = document.getElementById('cliStatusSelect').value;
      var motivo = (document.getElementById('cliStatusMotivo').value || '').trim();

      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Salvando...';
      setStatusFeedback('Atualizando...', 'info');

      fetch(resolverUrl(), {
        method: 'POST',
        body: JSON.stringify({
          action: 'atualizar_atendimento',
          id: ev.id,
          status: novoStatus,
          motivoFechamento: motivo
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      })
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (resp && resp.sucesso) {
          setStatusFeedback('Status atualizado!', 'sucesso');
          // Atualiza local
          ev.status = novoStatus;
          var spans = document.querySelectorAll('.cli-ev-status-' + cliIdx + '-' + evIdx);
          spans.forEach(function(s) { s.textContent = novoStatus; });

          // Se virou Resolvido/Fechado, oferece enviar NPS
          if ((novoStatus === 'Resolvido' || novoStatus === 'Fechado') && typeof window.enviarNPSWhatsApp === 'function') {
            var cliente = clientesResultado[cliIdx];
            var tel = cliente && cliente.telefones && cliente.telefones[0] ? cliente.telefones[0] : '';
            var nome = cliente && cliente.nome ? cliente.nome : '';
            if (tel) {
              setTimeout(function() {
                if (confirm('Atendimento marcado como ' + novoStatus + '.\n\nEnviar pesquisa de satisfacao (NPS) por WhatsApp agora?')) {
                  window.enviarNPSWhatsApp(ev.id, tel, nome);
                }
                fechar();
              }, 500);
              return;
            }
          }

          setTimeout(fechar, 700);
        } else {
          setStatusFeedback('Erro: ' + (resp && resp.erro ? resp.erro : 'sem resposta'), 'erro');
        }
      })
      .catch(function(err) {
        setStatusFeedback('Erro de rede: ' + err.message, 'erro');
      })
      .finally(function() {
        btn.disabled = false;
        btn.textContent = 'Salvar';
      });
    });
  }

  function setStatusFeedback(msg, tipo) {
    var el = document.getElementById('cliStatusFeedback');
    if (!el) return;
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.5rem 0.75rem;border-radius:6px;text-align:center;font-weight:600;font-size:0.85rem;">' + msg + '</div>';
  }

  function abrirModalVincular(ev, cliente) {
    // Atendimentos do mesmo cliente pra sugerir
    var atendimentos = cliente.eventos
      .filter(function(e) { return e.tipo === 'atendimento'; })
      .map(function(e) { return e.id; });

    var existente = document.getElementById('cliModalVincular');
    if (existente) existente.remove();

    var modal = document.createElement('div');
    modal.id = 'cliModalVincular';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem;';

    var sugestoes = atendimentos.map(function(id) {
      return '<option value="' + escapeHtmlCli(id) + '">';
    }).join('');

    modal.innerHTML =
      '<div style="background:#1c1c1c;border:1px solid #2a2a2a;border-radius:8px;max-width:480px;width:100%;">' +
        '<div style="background:#1a1a2e;color:#fff;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;border-radius:8px 8px 0 0;">' +
          '<div>' +
            '<div style="font-size:11px;letter-spacing:1.5px;color:#c6ff00;font-weight:700;">VINCULAR A ATENDIMENTO</div>' +
            '<div style="font-size:16px;font-weight:700;margin-top:2px;">' + escapeHtmlCli(ev.id) + '</div>' +
          '</div>' +
          '<button id="cliVincClose" style="background:transparent;border:none;color:#fff;font-size:28px;cursor:pointer;line-height:1;">&times;</button>' +
        '</div>' +
        '<div style="padding:1.25rem;color:#e8e8f0;">' +
          '<p style="font-size:0.85rem;color:#9a9a9a;margin-bottom:0.75rem;">' +
            'Informe o protocolo (PV-YYYY-NNNN) do atendimento ao qual este doc deve ser vinculado.' +
            (atendimentos.length ? ' Sugest&otilde;es deste cliente abaixo:' : '') +
          '</p>' +
          '<input type="text" id="cliVincInput" list="cliVincList" placeholder="PV-2026-XXXX" autocomplete="off" style="width:100%;padding:0.6rem;background:#161625;border:1px solid #2a2a2a;border-radius:6px;color:#fff;font-size:0.95rem;letter-spacing:1px;">' +
          (atendimentos.length ? '<datalist id="cliVincList">' + sugestoes + '</datalist>' : '') +
          '<div id="cliVincFeedback" style="margin-top:0.75rem;"></div>' +
          '<div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1rem;">' +
            '<button type="button" class="btn-secundario" id="cliVincCancelar">Cancelar</button>' +
            '<button type="button" class="btn-primario" id="cliVincConfirmar">Vincular</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    setTimeout(function() { document.getElementById('cliVincInput').focus(); }, 50);

    function fechar() { modal.remove(); }
    document.getElementById('cliVincClose').addEventListener('click', fechar);
    document.getElementById('cliVincCancelar').addEventListener('click', fechar);

    document.getElementById('cliVincInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('cliVincConfirmar').click(); }
    });

    document.getElementById('cliVincConfirmar').addEventListener('click', function() {
      var protocolo = (document.getElementById('cliVincInput').value || '').trim();
      if (!protocolo) {
        setVincFeedback('Informe o protocolo', 'erro');
        return;
      }
      if (!/^PV-\d{4}-\d{4}$/.test(protocolo)) {
        setVincFeedback('Formato invalido. Use PV-YYYY-NNNN', 'erro');
        return;
      }

      var btn = document.getElementById('cliVincConfirmar');
      btn.disabled = true;
      btn.textContent = 'Vinculando...';
      setVincFeedback('Vinculando...', 'info');

      fetch(resolverUrl(), {
        method: 'POST',
        body: JSON.stringify({
          action: 'vincular_doc_atendimento',
          atendimentoId: protocolo,
          tipoDoc: ev.tipo,
          docId: ev.id
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      })
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (resp && resp.sucesso) {
          setVincFeedback('Vinculado com sucesso! Atualizando timeline...', 'sucesso');
          // Atualiza local
          ev.atendimentoId = protocolo;
          renderResultados();
          // Reabre painel do cliente vinculado
          setTimeout(function() {
            var clienteIdx = clientesResultado.indexOf(cliente);
            if (clienteIdx >= 0) {
              var painel = document.getElementById('cli-timeline-' + clienteIdx);
              if (painel) painel.style.display = 'block';
              var btnToggle = document.querySelector('.cli-card-toggle[data-idx="' + clienteIdx + '"]');
              if (btnToggle) btnToggle.textContent = 'Ocultar timeline ▲';
            }
            fechar();
          }, 800);
        } else {
          setVincFeedback('Erro: ' + (resp && resp.erro ? resp.erro : 'sem resposta'), 'erro');
        }
      })
      .catch(function(err) {
        setVincFeedback('Erro de rede: ' + err.message, 'erro');
      })
      .finally(function() {
        btn.disabled = false;
        btn.textContent = 'Vincular';
      });
    });
  }

  function setVincFeedback(msg, tipo) {
    var el = document.getElementById('cliVincFeedback');
    if (!el) return;
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.5rem 0.75rem;border-radius:6px;text-align:center;font-weight:600;font-size:0.85rem;">' + msg + '</div>';
  }

  function renderCliente(c, idx) {
    var nfsTxt = (c.nfs && c.nfs.length) ? c.nfs.join(', ') : '—';
    var cpfTxt = (c.cpfs && c.cpfs.length) ? c.cpfs.join(', ') : '—';
    var telTxt = (c.telefones && c.telefones.length) ? c.telefones.map(formatarTelCli).join(', ') : '—';

    return '' +
      '<div class="secao-form" style="margin-bottom:1rem;">' +
        '<div class="secao-form-titulo" style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span>' + escapeHtmlCli(c.nome || '(sem nome)') + '</span>' +
          '<span style="font-size:0.75rem;color:var(--cor-primaria);">' + c.totalEventos + ' eventos</span>' +
        '</div>' +
        '<div style="padding:0.75rem 1rem;color:#9a9a9a;font-size:0.85rem;line-height:1.6;">' +
          '<div><strong style="color:#e8e8f0;">CPF:</strong> ' + cpfTxt + '</div>' +
          '<div><strong style="color:#e8e8f0;">Telefone:</strong> ' + telTxt + '</div>' +
          '<div><strong style="color:#e8e8f0;">NFs:</strong> ' + nfsTxt + '</div>' +
        '</div>' +
        '<div style="padding:0 1rem 0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap;">' +
          '<button type="button" class="btn-secundario btn-sm cli-card-toggle" data-idx="' + idx + '" style="font-size:0.85rem;">Ver timeline &#9660;</button>' +
          '<button type="button" class="btn-primario btn-sm cli-card-novo-at" data-idx="' + idx + '" style="font-size:0.85rem;background:#c6ff00;color:#0f0f1a;">&#43; Novo atendimento</button>' +
        '</div>' +
        '<div id="cli-timeline-' + idx + '" class="cli-timeline" style="display:none;padding:0 1rem 1rem;">' +
          renderTimeline(c.eventos || [], idx) +
        '</div>' +
      '</div>';
  }

  function renderTimeline(eventos, clienteIdx) {
    if (!eventos.length) return '<p style="color:#9a9a9a;padding:1rem;font-style:italic;">Sem eventos.</p>';

    // Lista de atendimentos do mesmo cliente (pra autocomplete no modal de vinculação)
    var atendimentosCliente = eventos
      .filter(function(e) { return e.tipo === 'atendimento'; })
      .map(function(e) { return e.id; });

    return '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
      eventos.map(function(ev, evIdx) {
        var icone = getIconeTipo(ev.tipo);
        var cor = getCorTipo(ev.tipo);
        var dataStr = formatarDataCli(ev.data);
        var badgeAt = '';
        var btnAcao = '';
        if (ev.tipo !== 'atendimento') {
          if (ev.atendimentoId) {
            badgeAt = '<span style="background:#22c55e22;color:#22c55e;font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:4px;margin-left:0.5rem;font-weight:600;">' + escapeHtmlCli(ev.atendimentoId) + '</span>';
          } else {
            badgeAt = '<span style="background:#5a5a5a44;color:#9a9a9a;font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:4px;margin-left:0.5rem;font-style:italic;">sem atendimento</span>';
            btnAcao = '<button type="button" class="cli-btn-vincular" data-cli="' + clienteIdx + '" data-ev="' + evIdx + '" style="margin-top:0.5rem;background:transparent;color:#c6ff00;border:1px solid #c6ff00;border-radius:4px;padding:0.25rem 0.7rem;font-size:0.75rem;cursor:pointer;font-weight:600;">&#128279; Vincular a atendimento</button>';
          }
        } else {
          // Atendimento: botao editar status
          btnAcao = '<button type="button" class="cli-btn-editar-status" data-cli="' + clienteIdx + '" data-ev="' + evIdx + '" style="margin-top:0.5rem;background:transparent;color:#c6ff00;border:1px solid #c6ff00;border-radius:4px;padding:0.25rem 0.7rem;font-size:0.75rem;cursor:pointer;font-weight:600;">&#9998; Editar status</button>';
        }
        return '<div style="display:flex;gap:0.75rem;padding:0.6rem 0.75rem;background:#161625;border-left:3px solid ' + cor + ';border-radius:6px;">' +
          '<div style="font-size:1.5rem;">' + icone + '</div>' +
          '<div style="flex:1;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
              '<strong style="color:' + cor + ';font-size:0.9rem;">' + escapeHtmlCli(ev.id || '—') + '</strong>' +
              '<span style="font-size:0.75rem;color:#9a9a9a;">' + dataStr + '</span>' +
            '</div>' +
            '<div style="font-size:0.85rem;color:#e8e8f0;margin-top:0.15rem;">' +
              escapeHtmlCli(ev.resumo || '') + badgeAt +
            '</div>' +
            (ev.status ? '<div style="font-size:0.75rem;color:#9a9a9a;margin-top:0.15rem;">Status: <span class="cli-ev-status-' + clienteIdx + '-' + evIdx + '">' + escapeHtmlCli(ev.status) + '</span></div>' : '') +
            btnAcao +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function getIconeTipo(tipo) {
    if (tipo === 'atendimento') return '📝';
    if (tipo === 'venda') return '🛒';
    if (tipo === 'orcamento') return '📄';
    if (tipo === 'os') return '🔧';
    return '•';
  }

  function getCorTipo(tipo) {
    if (tipo === 'atendimento') return '#c6ff00';
    if (tipo === 'venda') return '#22c55e';
    if (tipo === 'orcamento') return '#f59e0b';
    if (tipo === 'os') return '#3b82f6';
    return '#9a9a9a';
  }

  function formatarDataCli(d) {
    if (!d) return '—';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    var dd = String(dt.getDate()).padStart(2, '0');
    var mm = String(dt.getMonth() + 1).padStart(2, '0');
    var yy = dt.getFullYear();
    var hh = String(dt.getHours()).padStart(2, '0');
    var mi = String(dt.getMinutes()).padStart(2, '0');
    return dd + '/' + mm + '/' + yy + ' ' + hh + ':' + mi;
  }

  function formatarTelCli(t) {
    var d = String(t || '').replace(/\D/g, '');
    if (d.length === 11) return '(' + d.substr(0,2) + ') ' + d.substr(2,5) + '-' + d.substr(7);
    if (d.length === 10) return '(' + d.substr(0,2) + ') ' + d.substr(2,4) + '-' + d.substr(6);
    return t;
  }

  function mostrarFeedback(msg, tipo) {
    var el = document.getElementById('cliFeedback');
    if (!el) return;
    if (!msg) { el.innerHTML = ''; return; }
    var bg = tipo === 'erro' ? '#ef4444' : tipo === 'sucesso' ? '#22c55e' : '#3b82f6';
    el.innerHTML = '<div style="background:' + bg + ';color:#fff;padding:0.5rem 1rem;border-radius:6px;text-align:center;font-weight:600;font-size:0.85rem;">' + msg + '</div>';
  }

  function escapeHtmlCli(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function escapeAttr(s) {
    if (s == null) return '';
    return String(s).replace(/"/g, '&quot;');
  }

})();
