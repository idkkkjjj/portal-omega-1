/* ==========================================================================
   portal.js — pagina publica: autenticacao e atalhos de demonstracao.
   ========================================================================== */
(function () {
  "use strict";

  const { $, Icone, esc } = N;

  Dados.iniciar();

  /* ------------------------------------------------------------- Rodape -- */
  $("#rodapeAno").textContent = Dados.config().escola + " · " + Dados.config().cidade + "/" + Dados.config().uf;
  const anoLetivo = $("#rodapeAnoLetivo");
  if (anoLetivo) anoLetivo.textContent = Dados.config().anoLetivo;

  /* ----------------------------------------------------- Mostrar a senha - */
  const campoSenha = $("#senha");
  const btnVer = $("#verSenha");
  btnVer.innerHTML = Icone("olho");
  btnVer.addEventListener("click", function () {
    const mostrando = campoSenha.type === "text";
    campoSenha.type = mostrando ? "password" : "text";
    btnVer.innerHTML = Icone(mostrando ? "olho" : "olhoOff");
    btnVer.setAttribute("aria-label", mostrando ? "Mostrar senha" : "Ocultar senha");
    campoSenha.focus();
  });

  /* ------------------------------------------------------------- Erros --- */
  const caixaErro = $("#erroEntrar");
  function mostrarErro(texto) {
    caixaErro.innerHTML = Icone("alerta") + "<div>" + esc(texto) + "</div>";
    caixaErro.classList.remove("oculto");
  }
  function limparErro() { caixaErro.classList.add("oculto"); }

  /* ------------------------------------------------- Mensagem de contexto */
  const params = new URLSearchParams(location.search);
  if (params.get("acesso") === "necessario") {
    mostrarErro("Sua sessão expirou ou você ainda não entrou. Faça login para continuar.");
    setTimeout(function () { document.getElementById("acesso").scrollIntoView({ behavior: "smooth" }); }, 700);
  }

  /* --------------------------------------------------- Sessao ja iniciada */
  const jaLogado = Sessao.atual();
  if (jaLogado) {
    const faixa = document.createElement("div");
    faixa.className = "aviso aviso-info";
    faixa.style.marginBottom = "18px";
    faixa.innerHTML = Icone("info") +
      "<div class=\"esticar\"><strong>Você já está conectado</strong>" +
      esc(jaLogado.nome) + " — " + esc(Sessao.rotuloDe(jaLogado.papel)) + "</div>";

    const ir = document.createElement("button");
    ir.className = "btn btn-principal btn-p";
    ir.textContent = "Continuar";
    ir.addEventListener("click", function () { location.href = Sessao.paginaDe(jaLogado.papel); });

    const sair = document.createElement("button");
    sair.className = "btn btn-neutro btn-p";
    sair.textContent = "Sair";
    sair.addEventListener("click", function () {
      sessionStorage.removeItem("omega.sessao.v1");
      location.reload();
    });

    const acoes = document.createElement("div");
    acoes.className = "linha-flex";
    acoes.appendChild(ir);
    acoes.appendChild(sair);
    faixa.appendChild(acoes);

    const painel = document.querySelector(".painel-entrada");
    painel.insertBefore(faixa, painel.firstChild);
  }

  /* ---------------------------------------------------------- Login ------ */
  /**
   * As contas de demonstração são resolvidas na hora, a partir da base. Assim
   * a página nunca mostra uma credencial que não existe — mesmo depois de a
   * gestão editar, renomear ou desativar alguém.
   */
  function contasDemo() {
    const professor = Dados.professores().filter(p => p.ativo)
      .find(p => (p.disciplinas || []).indexOf("mat") > -1) || Dados.professores()[0];

    const turmaMedio = Dados.turmas().find(t => t.etapa === "medio") || Dados.turmas()[0];
    const aluno = Dados.alunos({ turmaId: turmaMedio.id })[0] || Dados.alunos()[0];

    return {
      gestor: { usuario: Dados.gestores()[0], senha: "gestor123", rotulo: "gestão" },
      professor: { usuario: professor, senha: "prof123", rotulo: "professor" },
      aluno: { usuario: aluno, senha: "aluno123", rotulo: "estudante" }
    };
  }

  const DEMO = contasDemo();

  const listaContas = $("#contasDemo");
  if (listaContas) {
    listaContas.innerHTML = ["gestor", "professor", "aluno"].map(function (k) {
      const c = DEMO[k];
      if (!c.usuario) return "";
      let complemento = "";
      if (k === "aluno") {
        complemento = (Dados.turma(c.usuario.turmaId) || {}).nome || "";
      } else if (k === "professor") {
        complemento = (c.usuario.disciplinas || [])
          .map(id => (Dados.disciplina(id) || {}).nome).join(", ");
      } else {
        complemento = c.usuario.cargo || "";
      }
      return "<li><code>" + esc(c.rotulo) + "</code><span>" +
        "<b>" + esc(c.usuario.nome) + "</b>" + (complemento ? " · " + esc(complemento) : "") +
        "<br>" + esc(c.usuario.email) + " · senha <code>" + esc(c.senha) + "</code>" +
        "</span></li>";
    }).join("");
  }

  N.$$("[data-demo]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      const conta = DEMO[chip.dataset.demo];
      if (!conta || !conta.usuario) return;
      const radio = document.querySelector('input[name="perfil"][value="' + chip.dataset.demo + '"]');
      if (radio) radio.checked = true;
      $("#identificador").value = conta.usuario.email;
      campoSenha.value = conta.senha;
      limparErro();
      $("#formEntrar").querySelector('button[type="submit"]').focus();
    });
  });

  $("#formEntrar").addEventListener("submit", function (e) {
    e.preventDefault();
    limparErro();

    const perfil = (document.querySelector('input[name="perfil"]:checked') || {}).value;
    const identificador = $("#identificador").value.trim();
    const senha = campoSenha.value;

    if (!identificador) { mostrarErro("Informe o e-mail institucional ou a matrícula."); $("#identificador").focus(); return; }
    if (!senha) { mostrarErro("Informe a senha."); campoSenha.focus(); return; }

    const botao = this.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.innerHTML = '<span class="carga"></span><span>Verificando…</span>';

    // Pequeno atraso proposital: sem ele a troca de tela fica brusca demais.
    setTimeout(function () {
      const r = Sessao.entrar(identificador, senha, perfil);
      if (!r.ok) {
        botao.disabled = false;
        botao.textContent = "Entrar";
        mostrarErro(r.erro);
        if (r.campo === "senha") { campoSenha.value = ""; campoSenha.focus(); }
        else if (r.campo === "identificador") $("#identificador").focus();
        return;
      }
      const destino = sessionStorage.getItem("omega.destino");
      sessionStorage.removeItem("omega.destino");
      const paginaCerta = Sessao.paginaDe(r.usuario.papel);
      location.href = destino && destino.indexOf(paginaCerta) === 0 ? destino : paginaCerta;
    }, 320);
  });

  /* ------------------------------------------- Restaurar demonstracao ---- */
  $("#zerarBase").addEventListener("click", function (e) {
    e.preventDefault();
    N.confirmar({
      titulo: "Restaurar dados de demonstração",
      texto: "Todas as contas, notas e atividades criadas por você serão apagadas e a base " +
        "voltará ao conteúdo original. Não há como desfazer.",
      rotuloOk: "Restaurar base",
      perigo: true
    }).then(function (ok) {
      if (!ok) return;
      sessionStorage.removeItem("omega.sessao.v1");
      Dados.reiniciar();
      N.notificar({ titulo: "Base restaurada", texto: "Recarregando a página…", tipo: "ok" });
      setTimeout(function () { location.href = "index.html"; }, 900);
    });
  });
})();

/* ==========================================================================
   Animações da página: elementos surgem conforme a rolagem e os números da
   faixa de abertura contam até o valor final.
   ========================================================================== */
(function () {
  "use strict";

  const reduzir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Liga o estado inicial oculto dos elementos .rev — só com JS ativo.
  document.documentElement.classList.add("anim");
  const alvos = Array.prototype.slice.call(document.querySelectorAll(".rev"));

  if (reduzir || !("IntersectionObserver" in window)) {
    alvos.forEach(el => el.classList.add("vis"));
  } else {
    // Pequeno atraso progressivo entre elementos vizinhos do mesmo bloco.
    const obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        const pai = e.target.parentElement;
        const irmaos = pai ? Array.prototype.filter.call(pai.children, x => x.classList && x.classList.contains("rev")) : [];
        const indice = Math.max(0, irmaos.indexOf(e.target));
        e.target.style.transitionDelay = Math.min(indice * 70, 280) + "ms";
        e.target.classList.add("vis");
        obs.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.15 });
    alvos.forEach(el => obs.observe(el));
  }

  /* Contadores da abertura ------------------------------------------------ */
  const numeros = Array.prototype.slice.call(document.querySelectorAll("[data-contar]"));
  if (!numeros.length) return;

  function contar(el) {
    const alvo = parseInt(el.dataset.contar, 10);
    if (reduzir || isNaN(alvo)) { el.textContent = el.dataset.contar; return; }
    const inicio = performance.now();
    const duracao = 700;
    function passo(agora) {
      const p = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(alvo * suave);
      if (p < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  if ("IntersectionObserver" in window && !reduzir) {
    const obsNum = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        contar(e.target);
        obsNum.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    numeros.forEach(el => obsNum.observe(el));
  } else {
    numeros.forEach(el => { el.textContent = el.dataset.contar; });
  }
})();

/* ==========================================================================
   Cortina de abertura da página inicial.
   ========================================================================== */
(function () {
  "use strict";

  const cortina = document.getElementById("cortina");
  if (!cortina) return;

  const reduzir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Quem chegou aqui redirecionado de uma página interna quer entrar, não
  // assistir à abertura.
  const veioDeRedirecionamento = new URLSearchParams(location.search).get("acesso") === "necessario";

  document.documentElement.classList.add("cortina-ativa");

  /** Quebra a palavra em letras animadas, cada uma com o seu atraso. */
  function montarPalavra(el, palavra, deslocamento) {
    if (!el) return;
    el.innerHTML = palavra.split("").map(function (c, i) {
      return '<span class="letra" style="--i:' + (i + deslocamento) + '">' +
        (c === " " ? "&nbsp;" : c) + "</span>";
    }).join("");
  }

  function soltarMotes() {
    const caixa = document.getElementById("abParticulas");
    if (!caixa || reduzir) return;
    for (let i = 0; i < 18; i++) {
      const m = document.createElement("span");
      m.className = "mote";
      const tam = 3 + Math.random() * 7;
      m.style.cssText =
        "left:" + (Math.random() * 100) + "%;" +
        "width:" + tam + "px;height:" + tam + "px;" +
        "--dur:" + (5 + Math.random() * 5).toFixed(1) + "s;" +
        "--atraso:" + (Math.random() * 4).toFixed(1) + "s;" +
        "--deriva:" + ((Math.random() - 0.5) * 120).toFixed(0) + "px";
      caixa.appendChild(m);
    }
  }

  let encerrada = false;
  function encerrar() {
    if (encerrada) return;
    encerrada = true;
    cortina.classList.add("saiu");
    document.documentElement.classList.remove("cortina-ativa");
    setTimeout(function () { cortina.remove(); }, 800);
  }

  montarPalavra(document.getElementById("abPalavra1"), "Portal", 0);
  montarPalavra(document.getElementById("abPalavra2"), "Ômega", 6);
  soltarMotes();

  const btnPular = document.getElementById("abPular");
  if (btnPular) btnPular.addEventListener("click", encerrar);
  cortina.addEventListener("click", encerrar);
  document.addEventListener("keydown", function aoTeclar(e) {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      encerrar();
      document.removeEventListener("keydown", aoTeclar);
    }
  });

  setTimeout(encerrar, veioDeRedirecionamento ? 200 : (reduzir ? 400 : 2700));
})();
