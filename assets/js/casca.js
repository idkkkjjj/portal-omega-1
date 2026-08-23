/* ==========================================================================
   casca.js — estrutura comum das telas internas: barra superior, menu
   lateral, menu do usuario, roteamento por hash e troca de senha.
   ========================================================================== */
(function (global) {
  "use strict";

  const { $, esc, Icone } = N;

  const CORES_AVATAR = { gestor: "", professor: "verde", aluno: "roxo" };

  function montar(cfg) {
    const usuario = cfg.usuario;
    const ctx = Sessao.contexto();
    const conf = Dados.config();
    const raiz = document.getElementById("app");

    const itensHtml = cfg.itens.map(function (i) {
      if (i.separador) return '<div class="grupo-titulo">' + esc(i.separador) + "</div>";
      return '<a href="#/' + i.id + '" data-rota="' + i.id + '">' +
        Icone(i.icone) + "<span>" + esc(i.rotulo) + "</span>" +
        '<span class="conta oculto" data-conta="' + i.id + '"></span></a>';
    }).join("");

    raiz.innerHTML =
      (ctx && ctx.personificando ? faixaPersonificacao(ctx) : "") +
      '<div class="aplicacao">' +
        '<div class="marca-app">' +
          '<button class="btn btn-icone abrir-menu sem-impressao" id="btnMenu" aria-label="Abrir menu" ' +
            'style="color:#fff;margin-left:-6px">' + Icone("menu") + "</button>" +
          '<span class="sigla">' + N.Marca({ barra: false }) + "</span>" +
          '<span class="nome">' + esc(conf.escola) + "<small>" + esc(cfg.rotuloPapel) + "</small></span>" +
        "</div>" +

        '<header class="barra-topo sem-impressao">' +
          '<div class="esticar">' +
            '<div class="trilha" id="trilhaTopo">' + esc(conf.escola) + "</div>" +
            '<div class="titulo-secao" id="tituloTopo">—</div>' +
          "</div>" +
          '<span class="pilula-periodo" title="Período letivo em andamento">' +
            '<span class="ponto"></span>' + conf.bimestreAtual + "º bimestre · " + conf.anoLetivo +
          "</span>" +
          '<div class="menu-usuario">' +
            '<button class="btn-usuario" id="btnUsuario" aria-haspopup="true" aria-expanded="false">' +
              '<span class="avatar ' + CORES_AVATAR[usuario.papel] + '">' + N.iniciais(usuario.nome) + "</span>" +
              '<span class="info"><span class="n">' + esc(N.primeiroNome(usuario.nome)) + "</span>" +
              '<span class="p">' + esc(Sessao.rotuloDe(usuario.papel)) + "</span></span>" +
              Icone("chevronBaixo") +
            "</button>" +
          "</div>" +
        "</header>" +

        '<nav class="barra-lateral sem-impressao" id="menuLateral" aria-label="Menu principal">' +
          itensHtml +
          '<div class="rodape-menu">' +
            esc(conf.endereco || "") + "<br>" + esc(conf.cidade) + "/" + esc(conf.uf) +
            "<br>" + esc(conf.telefone || "") + "<br>Ano letivo " + conf.anoLetivo +
          "</div>" +
        "</nav>" +

        '<main class="conteudo"><div class="faixa" id="visao"></div></main>' +
      "</div>" +
      '<div class="cortina sem-impressao" id="cortina"></div>';

    const visao = $("#visao");

    /* ------------------------------------------------------ menu usuario - */
    const btnUsuario = $("#btnUsuario");
    btnUsuario.addEventListener("click", function (e) {
      e.stopPropagation();
      const existente = $(".gaveta");
      if (existente) { existente.remove(); btnUsuario.setAttribute("aria-expanded", "false"); return; }

      const g = document.createElement("div");
      g.className = "gaveta";
      g.innerHTML =
        '<div class="cabeca"><div class="n">' + esc(usuario.nome) + "</div>" +
        '<div class="e">' + esc(usuario.email) + "</div>" +
        '<div class="e">Matrícula ' + esc(usuario.matricula) + "</div></div>" +
        '<button type="button" data-acao="senha">' + Icone("chave") + "Alterar minha senha</button>" +
        (ctx && ctx.personificando
          ? '<button type="button" data-acao="voltar">' + Icone("atualizar") + "Voltar para minha conta</button>"
          : "") +
        '<div class="separador"></div>' +
        '<button type="button" class="sair" data-acao="sair">' + Icone("sair") + "Encerrar sessão</button>";
      btnUsuario.parentNode.appendChild(g);
      btnUsuario.setAttribute("aria-expanded", "true");

      g.addEventListener("click", function (ev) {
        const b = ev.target.closest("[data-acao]");
        if (!b) return;
        const a = b.dataset.acao;
        g.remove();
        btnUsuario.setAttribute("aria-expanded", "false");
        if (a === "senha") abrirTrocaSenha(usuario);
        if (a === "sair") Sessao.sair();
        if (a === "voltar") Sessao.encerrarPersonificacao();
      });
    });

    document.addEventListener("click", function () {
      const g = $(".gaveta");
      if (g) { g.remove(); btnUsuario.setAttribute("aria-expanded", "false"); }
    });

    /* ------------------------------------------------------- menu mobile - */
    const menu = $("#menuLateral");
    const cortina = $("#cortina");
    $("#btnMenu").addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("aberta");
      cortina.classList.toggle("visivel");
    });
    cortina.addEventListener("click", function () {
      menu.classList.remove("aberta");
      cortina.classList.remove("visivel");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) { menu.classList.remove("aberta"); cortina.classList.remove("visivel"); }
    });

    /* ------------------------------------------------------ personificar - */
    const btnVoltar = $("#btnVoltarGestor");
    if (btnVoltar) btnVoltar.addEventListener("click", Sessao.encerrarPersonificacao);

    /* ------------------------------------------------------------- rotas - */
    const rotaPadrao = cfg.itens.find(i => !i.separador).id;

    function lerRota() {
      const h = (location.hash || "").replace(/^#\/?/, "");
      const partes = h.split("/").filter(Boolean);
      return { id: partes[0] || rotaPadrao, args: partes.slice(1) };
    }

    function aplicar() {
      const r = lerRota();
      const item = cfg.itens.find(i => i.id === r.id) || cfg.itens.find(i => !i.separador);
      N.$$("#menuLateral a").forEach(function (a) {
        a.classList.toggle("ativo", a.dataset.rota === item.id);
      });
      $("#tituloTopo").textContent = item.tituloTopo || item.rotulo;
      visao.scrollTop = 0;
      window.scrollTo({ top: 0 });
      // Transição suave entre as telas: reinicia a animação de entrada.
      visao.classList.remove("entrando");
      void visao.offsetWidth;
      cfg.aoNavegar(item.id, r.args, visao);
      visao.classList.add("entrando");
    }

    global.addEventListener("hashchange", aplicar);

    const api = {
      visao: visao,
      irPara: function (id, args) {
        const destino = "#/" + id + (args && args.length ? "/" + args.join("/") : "");
        if (location.hash === destino) aplicar();
        else location.hash = destino;
      },
      recarregar: aplicar,
      rota: lerRota,
      definirContador: function (id, valor) {
        const el = document.querySelector('[data-conta="' + id + '"]');
        if (!el) return;
        if (valor) { el.textContent = valor; el.classList.remove("oculto"); }
        else el.classList.add("oculto");
      },
      definirTitulo: function (t) { $("#tituloTopo").textContent = t; }
    };

    // A primeira renderização sai numa microtarefa: assim o script da página já
    // terminou de atribuir o retorno de montar() e pode usá-lo dentro de
    // aoNavegar (para atualizar contadores do menu, por exemplo).
    Promise.resolve().then(aplicar);
    return api;
  }

  function faixaPersonificacao(ctx) {
    return '<div class="faixa-personificacao sem-impressao">' +
      Icone("olho") +
      "<span>Acesso assistido: você está vendo o sistema como <b>" + esc(ctx.usuario.nome) +
      "</b> (" + esc(Sessao.rotuloDe(ctx.usuario.papel)) + ").</span>" +
      '<button type="button" id="btnVoltarGestor">Voltar para minha conta</button></div>';
  }

  /* ------------------------------------------------------- Troca de senha */
  function abrirTrocaSenha(usuario) {
    N.abrirModal({
      titulo: "Alterar senha",
      subtitulo: usuario.nome,
      largura: "estreito",
      conteudo:
        '<div class="campo"><label for="sAtual">Senha atual</label>' +
        '<input class="entrada" type="password" id="sAtual" autocomplete="current-password"></div>' +
        '<div class="campo"><label for="sNova">Nova senha</label>' +
        '<input class="entrada" type="password" id="sNova" autocomplete="new-password">' +
        '<span class="ajuda">Mínimo de 6 caracteres.</span></div>' +
        '<div class="campo"><label for="sConf">Repita a nova senha</label>' +
        '<input class="entrada" type="password" id="sConf" autocomplete="new-password"></div>' +
        '<div class="erro-campo oculto" id="sErro"></div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn-neutro", valor: "fechar" },
        {
          rotulo: "Salvar nova senha", classe: "btn-principal", icone: "check",
          aoClicar: function (e, api) {
            const atual = api.$("#sAtual").value;
            const nova = api.$("#sNova").value;
            const conf = api.$("#sConf").value;
            const erro = api.$("#sErro");
            const falhar = function (m) { erro.textContent = m; erro.classList.remove("oculto"); };

            if (!Dados.conferirSenha(usuario, atual)) return falhar("A senha atual não confere.");
            if (nova.length < 6) return falhar("A nova senha precisa ter pelo menos 6 caracteres.");
            if (nova !== conf) return falhar("As duas senhas digitadas são diferentes.");

            Dados.atualizarUsuario(usuario.id, { senha: nova }, usuario.id);
            N.fecharModal();
            N.notificar({ titulo: "Senha alterada", texto: "Use a nova senha no próximo acesso.", tipo: "ok" });
          }
        }
      ]
    });
  }

  /* ------------------------------------------- Blocos reaproveitados ----- */
  function cabecalho(titulo, descricao, acoesHtml) {
    return '<div class="cabecalho-pagina"><div><h1>' + esc(titulo) + "</h1>" +
      (descricao ? '<p class="descricao">' + esc(descricao) + "</p>" : "") + "</div>" +
      (acoesHtml ? '<div class="acoes sem-impressao">' + acoesHtml + "</div>" : "") + "</div>";
  }

  function kpi(cfg) {
    return '<div class="kpi ' + (cfg.tom || "") + '">' +
      '<div class="rot">' + esc(cfg.rotulo) + "</div>" +
      '<div class="val">' + cfg.valor + (cfg.unidade ? "<small>" + esc(cfg.unidade) + "</small>" : "") + "</div>" +
      (cfg.nota ? '<div class="nota">' + cfg.nota + "</div>" : "") + "</div>";
  }

  function vazio(titulo, texto, icone) {
    return '<div class="vazio">' + Icone(icone || "caixa") +
      "<h4>" + esc(titulo) + "</h4><p>" + esc(texto) + "</p></div>";
  }

  function cartao(cfg) {
    return '<section class="cartao">' +
      '<div class="cartao-topo"><div><h3>' + esc(cfg.titulo) + "</h3>" +
      (cfg.sub ? '<div class="sub">' + esc(cfg.sub) + "</div>" : "") + "</div>" +
      (cfg.acao || "") + "</div>" +
      '<div class="cartao-corpo' + (cfg.justo ? " justo" : "") + '">' + cfg.corpo + "</div>" +
      (cfg.rodape ? '<div class="cartao-rodape">' + cfg.rodape + "</div>" : "") +
      "</section>";
  }

  function selo(situacao) {
    return '<span class="selo ' + situacao.classe + '">' + esc(situacao.rotulo) + "</span>";
  }

  global.Casca = {
    montar: montar, cabecalho: cabecalho, kpi: kpi, vazio: vazio,
    cartao: cartao, selo: selo, abrirTrocaSenha: abrirTrocaSenha
  };
})(window);
