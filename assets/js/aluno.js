/* ==========================================================================
   aluno.js — telas do estudante: painel, boletim ao vivo e mural de
   atividades.

   O boletim escuta as mudancas da base. Quando um professor salva um
   lancamento em outra aba, esta tela detecta a diferenca, avisa e destaca
   exatamente a celula que mudou — sem recarregar a pagina.
   ========================================================================== */
(function () {
  "use strict";

  const { $, $$, esc, fmt, Icone, delegar } = N;

  Dados.iniciar();
  const eu = Sessao.exigir("aluno");
  if (!eu) return;

  const c = () => Dados.config();
  const minhaTurma = () => Dados.turma(eu.turmaId);

  let casca;
  let rotaAtual = "painel";
  let filtroAtividades = "pendentes";
  let recemMudadas = [];          // chaves "disciplina:bimestre" a destacar
  let instantaneo = fotografar();

  /* ---------------------------------------------------- Deteccao ao vivo - */
  function fotografar() {
    const mapa = {};
    Dados.notasDoAluno(eu.id).forEach(function (n) {
      mapa[n.disciplinaId + ":" + n.bimestre] = n.valor;
    });
    return mapa;
  }

  function comparar() {
    const agora = fotografar();
    const mudancas = [];
    Object.keys(agora).forEach(function (k) {
      if (instantaneo[k] === undefined) mudancas.push({ chave: k, valor: agora[k], tipo: "nova" });
      else if (instantaneo[k] !== agora[k]) mudancas.push({ chave: k, valor: agora[k], anterior: instantaneo[k], tipo: "alterada" });
    });
    Object.keys(instantaneo).forEach(function (k) {
      if (agora[k] === undefined) mudancas.push({ chave: k, tipo: "removida" });
    });
    instantaneo = agora;
    return mudancas;
  }

  function anunciar(mudancas) {
    mudancas.slice(0, 4).forEach(function (m) {
      const p = m.chave.split(":");
      const d = Dados.disciplina(p[0]);
      if (!d) return;
      if (m.tipo === "nova") {
        N.notificar({
          titulo: "Nova nota lançada",
          texto: d.nome + " — " + p[1] + "º bimestre: " + fmt.nota(m.valor),
          tipo: m.valor >= c().mediaMinima ? "ok" : "alerta", ms: 8000
        });
      } else if (m.tipo === "alterada") {
        N.notificar({
          titulo: "Nota corrigida",
          texto: d.nome + " — " + p[1] + "º bimestre: de " + fmt.nota(m.anterior) + " para " + fmt.nota(m.valor),
          tipo: "info", ms: 8000
        });
      } else {
        N.notificar({ titulo: "Nota removida", texto: d.nome + " — " + p[1] + "º bimestre", tipo: "alerta", ms: 6000 });
      }
    });
    if (mudancas.length > 4) {
      N.notificar({ texto: "e mais " + (mudancas.length - 4) + " atualizações no seu boletim.", tipo: "info" });
    }
  }

  /* ======================================================== Estrutura ==== */
  casca = Casca.montar({
    usuario: eu,
    rotuloPapel: "Estudante",
    itens: [
      { id: "painel", rotulo: "Meu painel", icone: "grade", tituloTopo: "Painel do estudante" },
      { id: "boletim", rotulo: "Meu boletim", icone: "livro", tituloTopo: "Boletim escolar" },
      { id: "atividades", rotulo: "Atividades", icone: "prancheta", tituloTopo: "Mural da turma" },
      { id: "perfil", rotulo: "Meus dados", icone: "usuario", tituloTopo: "Dados cadastrais" }
    ],
    aoNavegar: function (id, args, visao) {
      rotaAtual = id;
      const telas = { painel: telaPainel, boletim: telaBoletim, atividades: telaAtividades, perfil: telaPerfil };
      (telas[id] || telaPainel)(visao);
      contadores();
    }
  });

  function contadores() {
    const pend = atividadesPendentes().length;
    casca.definirContador("atividades", pend);
  }

  Dados.assinar(function () {
    const mudancas = comparar();
    if (mudancas.length) {
      recemMudadas = mudancas.filter(m => m.tipo !== "removida").map(m => m.chave);
      anunciar(mudancas);
      // O destaque amarelo some sozinho depois da animacao.
      setTimeout(function () { recemMudadas = []; }, 6000);
    }
    casca.recarregar();
  });

  /* ------------------------------------------------------------ Apoio ---- */
  function minhasAtividades() {
    return Dados.atividades({ turmaId: eu.turmaId });
  }

  function atividadesPendentes() {
    return minhasAtividades().filter(a => !Dados.concluida(a.id, eu.id));
  }

  /* =========================================================== Painel ==== */
  function telaPainel(visao) {
    const cfg = c();
    const bol = Dados.boletim(eu.id);
    const turma = minhaTurma();
    const pendentes = atividadesPendentes();
    const atrasadas = pendentes.filter(a => N.diasAte(a.entrega) < 0);
    const naMedia = bol.linhas.filter(l => l.media !== null && l.media >= cfg.mediaMinima).length;

    const recentes = Dados.notasDoAluno(eu.id)
      .slice().sort(function (a, b) { return String(b.lancadoEm).localeCompare(String(a.lancadoEm)); })
      .slice(0, 6);

    const faltando = bol.linhas
      .filter(l => l.precisaSomar > 0 && l.lancadas > 0 && l.lancadas < 4)
      .sort((a, b) => b.precisaSomar - a.precisaSomar);

    visao.innerHTML =
      '<div class="cartao-saudacao">' +
        "<div><h2>Olá, " + esc(N.primeiroNome(eu.nome)) + "</h2>" +
        "<p>" + esc(turma ? turma.nome : "sem turma") + " · " + esc(turma ? turma.turno : "") +
        " · matrícula " + esc(eu.matricula) + "</p>" +
        '<div class="ponto-vivo topo-8"><i></i>Boletim sincronizado em tempo real</div></div>' +
        '<div class="medidor-geral"><div class="r">Média geral parcial</div>' +
        '<div class="n">' + fmt.nota(bol.mediaGeral) + "</div>" +
        '<div class="r" style="margin-top:6px">' + bol.totalLancadas + " de " + bol.totalPrevistas + " notas lançadas</div></div>" +
      "</div>" +

      '<div class="grade-kpi">' +
        Casca.kpi({ rotulo: "Componentes na média", valor: naMedia, unidade: " / " + bol.linhas.length, tom: "verde",
          nota: "média mínima " + fmt.nota(cfg.mediaMinima) }) +
        Casca.kpi({ rotulo: "Abaixo da média", valor: bol.abaixo.length, tom: bol.abaixo.length ? "ambar" : "verde",
          nota: bol.criticas.length + " em situação crítica" }) +
        Casca.kpi({ rotulo: "Atividades pendentes", valor: pendentes.length, tom: "roxo",
          nota: minhasAtividades().length + " publicadas na turma" }) +
        Casca.kpi({ rotulo: "Prazo vencido", valor: atrasadas.length, tom: atrasadas.length ? "rubro" : "verde",
          nota: atrasadas.length ? "entregue o quanto antes" : "nada atrasado" }) +
      "</div>" +

      '<div class="grade-12-8" style="margin-bottom:16px">' +
        Casca.cartao({
          titulo: "Meu desempenho por componente",
          sub: "A linha tracejada marca a média mínima de " + fmt.nota(cfg.mediaMinima),
          corpo: '<div id="gMeuDesempenho"></div>'
        }) +
        Casca.cartao({
          titulo: "Últimos lançamentos",
          sub: "As notas mais recentes do seu boletim",
          justo: true,
          corpo: recentes.length
            ? '<table class="tabela tabela-compacta"><tbody>' + recentes.map(function (n) {
                const d = Dados.disciplina(n.disciplinaId);
                return "<tr><td><b>" + esc(d ? d.nome : "—") + "</b><br>" +
                  '<span class="pequeno texto-2">' + n.bimestre + "º bimestre · " + fmt.relativo(n.lancadoEm) + "</span></td>" +
                  '<td class="num" style="font-size:1.05rem;font-weight:700;color:' +
                  Graficos.corPorNota(n.valor, cfg.mediaMinima) + '">' + fmt.nota(n.valor) + "</td></tr>";
              }).join("") + "</tbody></table>"
            : Casca.vazio("Nenhuma nota ainda", "Assim que um professor lançar, aparece aqui na hora.", "livro")
        }) +
      "</div>" +

      '<div class="grade-2">' +
        Casca.cartao({
          titulo: "Próximas entregas",
          sub: pendentes.length + " atividades em aberto",
          justo: true,
          corpo: pendentes.length
            ? '<div style="padding:12px">' + Atividades.ordenarPorUrgencia(pendentes).slice(0, 4)
                .map(a => Atividades.cartao(a, { modo: "aluno", alunoId: eu.id, mostrarTurma: false })).join("") + "</div>"
            : Casca.vazio("Tudo em dia", "Você marcou todas as atividades da turma como entregues.", "checkCirculo"),
          rodape: pendentes.length > 4 ? '<a href="#/atividades">Ver todas as atividades</a>' : ""
        }) +
        Casca.cartao({
          titulo: "O que falta para fechar na média",
          sub: "Soma necessária nos bimestres que ainda não foram lançados",
          justo: true,
          corpo: faltando.length
            ? '<div class="rolagem-x"><table class="tabela"><thead><tr><th>Componente</th>' +
              '<th class="num">Média atual</th><th class="num">Faltam somar</th><th class="num">Bimestres restantes</th>' +
              "</tr></thead><tbody>" + faltando.map(function (l) {
                const restantes = 4 - l.lancadas;
                const porBim = l.precisaSomar / restantes;
                return "<tr><td><b>" + esc(l.disciplina.nome) + "</b></td>" +
                  '<td class="num" style="color:' + Graficos.corPorNota(l.media, cfg.mediaMinima) + ';font-weight:700">' +
                  fmt.nota(l.media) + "</td>" +
                  '<td class="num"><b>' + fmt.decimal(l.precisaSomar) + "</b></td>" +
                  '<td class="num pequeno texto-2">' + restantes + " × " + fmt.decimal(porBim) + "</td></tr>";
              }).join("") + "</tbody></table></div>"
            : Casca.vazio("Nenhuma pendência de nota", "Nos componentes já lançados você está na média.", "checkCirculo")
        }) +
      "</div>";

    Graficos.barrasHorizontais($("#gMeuDesempenho"), {
      dados: bol.linhas.map(function (l) {
        return {
          rotulo: l.disciplina.nome, valor: l.media,
          detalhe: l.lancadas ? l.lancadas + " de 4 bimestres lançados" : "sem lançamento"
        };
      }),
      max: cfg.notaMaxima, corPorValor: true, recuperacao: cfg.mediaRecuperacao,
      corte: { valor: cfg.mediaMinima, rotulo: "média " + fmt.nota(cfg.mediaMinima) },
      descricao: "Média do estudante em cada componente curricular"
    });

    delegar(visao, "click", "[data-concluir]", marcarConclusao);
    delegar(visao, "click", "[data-anexo]", function (e, a) { e.preventDefault(); Atividades.abrirVisor(a.dataset.anexo); });
  }

  /* ========================================================== Boletim === */
  function telaBoletim(visao) {
    const cfg = c();
    const bol = Dados.boletim(eu.id);

    visao.innerHTML =
      Casca.cabecalho("Meu boletim",
        "Atualizado automaticamente. Não é preciso recarregar a página quando um professor lança uma nota.",
        '<button class="btn btn-neutro" id="btnImprimirBol">' + Icone("imprimir") + "<span>Imprimir</span></button>") +

      '<section class="cartao">' +
        Boletim.timbrado(eu) +
        Boletim.cabecalho(eu, bol) +
        '<div class="cartao-corpo justo">' + Boletim.tabela(eu.id, { destacar: recemMudadas }) + "</div>" +
        Boletim.assinaturas() +
        '<div class="cartao-rodape sem-impressao">' +
          '<div class="linha-flex quebra" style="gap:20px">' +
            '<span class="pequeno texto-2 linha-flex" style="gap:6px">' +
              '<span class="ponto-vivo" style="color:var(--texto-2)"><i style="background:var(--verde)"></i></span>' +
              "Sincronizado — última verificação " + fmt.dataHora(new Date().toISOString()) + "</span>" +
            '<span class="pequeno texto-2">Média mínima para aprovação: <b>' + fmt.nota(cfg.mediaMinima) + "</b></span>" +
            '<span class="pequeno texto-2">Recuperação a partir de <b>' + fmt.nota(cfg.mediaRecuperacao) + "</b></span>" +
          "</div>" +
        "</div>" +
      "</section>" +

      '<div class="grade-2 topo-20">' +
        Casca.cartao({
          titulo: "Evolução das minhas médias",
          sub: "Média de todos os componentes em cada bimestre",
          corpo: '<div id="gEvolucao"></div>'
        }) +
        Casca.cartao({
          titulo: "Como a situação é calculada",
          corpo:
            '<dl class="definicoes">' +
              "<dt>Média do componente</dt><dd>Soma das notas bimestrais lançadas dividida pela quantidade de lançamentos. " +
              "Bimestres em branco não entram na conta.</dd>" +
              "<dt>Acima da média</dt><dd>Média parcial igual ou superior a " + fmt.nota(cfg.mediaMinima) + ".</dd>" +
              "<dt>Abaixo da média</dt><dd>Entre " + fmt.nota(cfg.mediaRecuperacao) + " e " + fmt.nota(cfg.mediaMinima) +
              ". Ainda dá para recuperar nos bimestres restantes.</dd>" +
              "<dt>Crítico</dt><dd>Abaixo de " + fmt.nota(cfg.mediaRecuperacao) + ". Procure o professor do componente.</dd>" +
              "<dt>Média geral</dt><dd>Média aritmética das médias de todos os componentes com nota lançada.</dd>" +
            "</dl>"
        }) +
      "</div>";

    const porBimestre = [1, 2, 3, 4].map(function (b) {
      const vals = Dados.notasDoAluno(eu.id).filter(n => n.bimestre === b).map(n => n.valor);
      return Dados.mediaDe(vals);
    });

    Graficos.linha($("#gEvolucao"), {
      rotulos: ["1º bim.", "2º bim.", "3º bim.", "4º bim."],
      series: [{ nome: "Minha média", cor: "#5b4b8a", pontos: porBimestre }],
      max: cfg.notaMaxima, area: true, altura: 236, corte: { valor: cfg.mediaMinima },
      descricao: "Evolução da média do estudante ao longo dos bimestres"
    });

    $("#btnImprimirBol").addEventListener("click", () => window.print());
  }

  /* ======================================================= Atividades === */
  function telaAtividades(visao) {
    const todas = minhasAtividades();
    const feitas = todas.filter(a => Dados.concluida(a.id, eu.id));
    const pendentes = todas.filter(a => !Dados.concluida(a.id, eu.id));
    const atrasadas = pendentes.filter(a => N.diasAte(a.entrega) < 0);
    const semana = pendentes.filter(a => { const d = N.diasAte(a.entrega); return d >= 0 && d <= 7; });

    const grupos = {
      pendentes: pendentes, atrasadas: atrasadas, semana: semana,
      entregues: feitas, todas: todas
    };
    const lista = Atividades.ordenarPorUrgencia(grupos[filtroAtividades] || pendentes);

    const chips = [
      { id: "pendentes", rotulo: "Pendentes", n: pendentes.length },
      { id: "atrasadas", rotulo: "Atrasadas", n: atrasadas.length },
      { id: "semana", rotulo: "Próximos 7 dias", n: semana.length },
      { id: "entregues", rotulo: "Entregues", n: feitas.length },
      { id: "todas", rotulo: "Todas", n: todas.length }
    ];

    visao.innerHTML =
      Casca.cabecalho("Mural da turma",
        (minhaTurma() ? minhaTurma().nome + " · " : "") +
        "Ordenado por urgência: o que está atrasado vem primeiro, depois o prazo mais próximo.") +

      '<div class="barra-lancamento">' +
        '<div class="filtros">' + chips.map(ch =>
          '<button class="chip" data-filtro="' + ch.id + '" aria-pressed="' + (filtroAtividades === ch.id) + '">' +
          ch.rotulo + '<span class="cont">' + ch.n + "</span></button>").join("") + "</div>" +
        '<span class="esticar"></span>' +
        (atrasadas.length
          ? '<span class="selo selo-rubro">' + fmt.plural(atrasadas.length, "atividade atrasada", "atividades atrasadas") + "</span>"
          : '<span class="selo selo-verde">Sem atrasos</span>') +
      "</div>" +

      (lista.length
        ? '<div class="lista-atividades">' +
          lista.map(a => Atividades.cartao(a, { modo: "aluno", alunoId: eu.id, mostrarTurma: false })).join("") + "</div>"
        : '<section class="cartao">' + Casca.vazio(
            filtroAtividades === "entregues" ? "Nada marcado como entregue" : "Nenhuma atividade neste filtro",
            filtroAtividades === "pendentes"
              ? "Você marcou todas as atividades da turma como entregues."
              : "Experimente outro filtro para ver o restante do mural.", "prancheta") + "</section>");

    delegar(visao, "click", "[data-filtro]", function (e, b) {
      filtroAtividades = b.dataset.filtro;
      telaAtividades(visao);
    });
    delegar(visao, "click", "[data-concluir]", marcarConclusao);
    delegar(visao, "click", "[data-anexo]", function (e, a) { e.preventDefault(); Atividades.abrirVisor(a.dataset.anexo); });
  }

  function marcarConclusao(e, b) {
    const atv = Dados.atividade(b.dataset.concluir);
    const marcou = Dados.alternarConclusao(atv.id, eu.id);
    N.notificar({
      texto: marcou ? '"' + atv.titulo + '" marcada como entregue.' : '"' + atv.titulo + '" voltou para as pendentes.',
      tipo: marcou ? "ok" : "info", ms: 2600
    });
  }

  /* ========================================================== Perfil ==== */
  function telaPerfil(visao) {
    const turma = minhaTurma();
    const bol = Dados.boletim(eu.id);

    visao.innerHTML =
      Casca.cabecalho("Meus dados",
        "Informações do seu cadastro escolar. Correções devem ser solicitadas à secretaria.") +

      '<div class="grade-2">' +
        Casca.cartao({
          titulo: "Cadastro",
          corpo:
            '<div class="linha-flex" style="gap:14px;margin-bottom:20px">' +
              '<span class="avatar g roxo">' + N.iniciais(eu.nome) + "</span>" +
              "<div><h3>" + esc(eu.nome) + "</h3>" +
              '<div class="pequeno texto-2">' + esc(eu.email) + "</div></div></div>" +
            '<dl class="definicoes">' +
              "<dt>Matrícula</dt><dd>" + esc(eu.matricula) + "</dd>" +
              "<dt>Turma</dt><dd>" + esc(turma ? turma.nome + " — " + turma.turno + " · " + turma.sala : "—") + "</dd>" +
              "<dt>Ano letivo</dt><dd>" + c().anoLetivo + "</dd>" +
              "<dt>Data de nascimento</dt><dd>" + (eu.nascimento ? fmt.data(eu.nascimento) : "—") + "</dd>" +
              "<dt>Responsável</dt><dd>" + esc(eu.responsavel || "—") + "</dd>" +
              "<dt>Telefone</dt><dd>" + esc(eu.telefone || "—") + "</dd>" +
              "<dt>Conta criada em</dt><dd>" + fmt.data(eu.criadoEm) + "</dd>" +
            "</dl>",
          rodape: '<button class="btn btn-neutro" id="btnSenha">' + Icone("chave") + "<span>Alterar minha senha</span></button>"
        }) +
        Casca.cartao({
          titulo: "Resumo acadêmico",
          corpo:
            '<div class="grade-kpi" style="margin:0">' +
              Casca.kpi({ rotulo: "Média geral", valor: fmt.nota(bol.mediaGeral),
                tom: bol.mediaGeral >= c().mediaMinima ? "verde" : "ambar" }) +
              Casca.kpi({ rotulo: "Notas lançadas", valor: bol.totalLancadas, unidade: " / " + bol.totalPrevistas }) +
            "</div>" +
            '<div class="aviso aviso-info topo-20">' + Icone("info") +
            "<div><strong>Situação atual: " + esc(bol.situacaoGeral.rotulo) + "</strong>" +
            (bol.abaixo.length
              ? "Você está abaixo da média em " + fmt.plural(bol.abaixo.length, "componente", "componentes") + ": " +
                bol.abaixo.map(l => l.disciplina.nome).join(", ") + "."
              : "Nenhum componente abaixo da média até o momento.") + "</div></div>" +
            '<div class="divisor-rotulado topo-20">Escola</div>' +
            '<dl class="definicoes">' +
              "<dt>Instituição</dt><dd>" + esc(c().escola) + "</dd>" +
              "<dt>Município</dt><dd>" + esc(c().cidade) + "/" + esc(c().uf) + "</dd>" +
              "<dt>Código INEP</dt><dd>" + esc(c().inep) + "</dd>" +
            "</dl>"
        }) +
      "</div>";

    $("#btnSenha").addEventListener("click", () => Casca.abrirTrocaSenha(eu));
  }
})();
