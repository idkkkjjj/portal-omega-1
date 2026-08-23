/* ==========================================================================
   gestor.js — telas do perfil de gestao escolar.
   ========================================================================== */
(function () {
  "use strict";

  const { $, $$, esc, fmt, Icone, delegar } = N;

  Dados.iniciar();
  const eu = Sessao.exigir("gestor");
  if (!eu) return;

  const c = () => Dados.config();

  let casca;
  let rotaAtual = "painel";
  let boletimAberto = null;      // id do aluno em edicao
  let filtros = { alunos: "", professores: "", turmaAlunos: "", turmaDesempenho: "", registro: "todos" };

  /* ======================================================== Estrutura ==== */
  casca = Casca.montar({
    usuario: eu,
    rotuloPapel: "Gestão escolar",
    itens: [
      { separador: "Acompanhamento" },
      { id: "painel", rotulo: "Visão geral", icone: "grade", tituloTopo: "Visão geral da escola" },
      { id: "desempenho", rotulo: "Desempenho", icone: "barras", tituloTopo: "Desempenho acadêmico" },
      { id: "boletins", rotulo: "Boletins", icone: "livro", tituloTopo: "Boletins dos estudantes" },
      { separador: "Cadastros" },
      { id: "professores", rotulo: "Quadro docente", icone: "usuarios", tituloTopo: "Quadro docente" },
      { id: "alunos", rotulo: "Estudantes", icone: "formatura", tituloTopo: "Estudantes matriculados" },
      { separador: "Escola" },
      { id: "atividades", rotulo: "Atividades", icone: "prancheta", tituloTopo: "Atividades publicadas" },
      { id: "registro", rotulo: "Registro do sistema", icone: "lista", tituloTopo: "Registro de operações" },
      { id: "ajustes", rotulo: "Configurações", icone: "engrenagem", tituloTopo: "Configurações da escola" }
    ],
    aoNavegar: function (id, args, visao) {
      rotaAtual = id;
      boletimAberto = id === "boletins" ? (args[0] || boletimAberto) : null;
      const telas = {
        painel: telaPainel, desempenho: telaDesempenho, boletins: telaBoletins,
        professores: telaProfessores, alunos: telaAlunos, atividades: telaAtividades,
        registro: telaRegistro, ajustes: telaAjustes
      };
      (telas[id] || telaPainel)(visao);
      atualizarContadores();
    }
  });

  function atualizarContadores() {
    casca.definirContador("professores", Dados.professores().filter(p => p.ativo).length);
    casca.definirContador("alunos", Dados.alunos().length);
  }

  /* Atualizacao vinda de outra aba ou de outro perfil --------------------- */
  const redesenhar = N.debounce(function () { casca.recarregar(); }, 160);
  Dados.assinar(function (info) {
    if (rotaAtual === "boletins" && boletimAberto && info.origem === "local") {
      atualizarResumoBoletim();
      return;
    }
    redesenhar();
  });

  /* =========================================================== Painel ==== */
  function telaPainel(visao) {
    const est = Dados.estatisticas();
    const cfg = c();

    const abaixo = est.distribuicao.atencao + est.distribuicao.critico;
    const pctAbaixo = est.totalAlunos ? (abaixo / est.totalAlunos) * 100 : 0;

    visao.innerHTML =
      Casca.cabecalho(
        "Visão geral da escola",
        cfg.escola + " · " + cfg.cidade + "/" + cfg.uf + " · " + cfg.bimestreAtual +
        "º bimestre do ano letivo de " + cfg.anoLetivo + ".",
        '<button class="btn btn-neutro" id="btnNovoAluno">' + Icone("usuarioMais") + "<span>Matricular estudante</span></button>" +
        '<button class="btn btn-principal" id="btnNovoProf">' + Icone("mais") + "<span>Cadastrar professor</span></button>"
      ) +

      '<div class="grade-kpi">' +
        Casca.kpi({ rotulo: "Estudantes", valor: est.totalAlunos, nota: est.totalTurmas + " turmas ativas" }) +
        Casca.kpi({ rotulo: "Professores", valor: est.totalProfessores, nota: "contas ativas no quadro", tom: "roxo" }) +
        Casca.kpi({
          rotulo: "Média geral", valor: fmt.nota(est.mediaGeral),
          nota: "mínimo para aprovação: " + fmt.nota(cfg.mediaMinima),
          tom: est.mediaGeral >= cfg.mediaMinima ? "verde" : "ambar"
        }) +
        Casca.kpi({
          rotulo: "Abaixo da média", valor: abaixo, unidade: " (" + fmt.percentual(pctAbaixo) + ")",
          nota: "na média geral · " + est.distribuicao.critico + " em situação crítica",
          tom: pctAbaixo > 30 ? "rubro" : "ambar"
        }) +
        Casca.kpi({
          rotulo: "Lançamentos", valor: fmt.percentual(est.cobertura),
          nota: est.lancadas + " de " + est.previstas + " notas previstas até o " + cfg.bimestreAtual + "º bim."
        }) +
      "</div>" +

      '<div class="grade-12-8" style="margin-bottom:16px">' +
        Casca.cartao({
          titulo: "Média por componente curricular",
          sub: "Todas as turmas · a linha tracejada marca a média mínima",
          corpo: '<div id="gMediaDisciplina"></div>'
        }) +
        Casca.cartao({
          titulo: "Situação dos estudantes",
          sub: "Considerando a média geral parcial",
          corpo: '<div id="gSituacao"></div><div id="lSituacao"></div>'
        }) +
      "</div>" +

      '<div class="grade-2" style="margin-bottom:16px">' +
        Casca.cartao({
          titulo: "Evolução da média por bimestre",
          sub: "Média de todos os lançamentos da escola",
          corpo: '<div id="gBimestres"></div>'
        }) +
        Casca.cartao({
          titulo: "Média por turma",
          sub: "Comparativo entre as turmas em funcionamento",
          corpo: '<div id="gTurmas"></div>'
        }) +
      "</div>" +

      '<div class="grade-2" style="margin-bottom:16px">' +
        Casca.cartao({
          titulo: "Desempenho por etapa de ensino",
          sub: "Comparativo entre Fundamental e Ensino Médio",
          justo: true,
          corpo: '<table class="tabela"><thead><tr><th>Etapa</th>' +
            '<th class="num">Estudantes</th><th class="num">Média</th>' +
            '<th class="num">Abaixo da média</th><th style="width:120px"></th></tr></thead><tbody>' +
            est.porEtapa.map(function (e) {
              const pct = e.alunos ? (e.emRisco / e.alunos) * 100 : 0;
              return "<tr><td><b>" + esc(e.nome) + "</b></td>" +
                '<td class="num">' + e.alunos + "</td>" +
                '<td class="num" style="font-weight:700;color:' + Graficos.corPorNota(e.media, cfg.mediaMinima) + '">' +
                fmt.nota(e.media) + "</td>" +
                '<td class="num">' + e.emRisco + "</td>" +
                '<td><span class="barra ' + (pct >= 40 ? "rubro" : pct >= 20 ? "ambar" : "verde") +
                '"><span style="width:' + pct + '%"></span></span></td></tr>';
            }).join("") + "</tbody></table>"
        }) +
        Casca.cartao({
          titulo: "Componentes com maior reprovação",
          sub: "Percentual de estudantes abaixo de " + fmt.nota(cfg.mediaMinima),
          corpo: listaCriticos(est)
        }) +
      "</div>" +

      '<div class="grade-12-8">' +
        Casca.cartao({
          titulo: "Estudantes que precisam de acompanhamento",
          sub: est.emRisco.length + " com pelo menos um componente abaixo da média",
          justo: true,
          corpo: tabelaRisco(est.emRisco.slice(0, 10)),
          rodape: est.emRisco.length > 10
            ? '<a href="#/desempenho">Ver a lista completa (' + est.emRisco.length + " estudantes)</a>"
            : ""
        }) +
        Casca.cartao({
          titulo: "Quadro geral",
          sub: "Resumo do ano letivo de " + cfg.anoLetivo,
          corpo: '<dl class="definicoes">' +
            "<dt>Instituição</dt><dd>" + esc(cfg.escola) + "</dd>" +
            "<dt>Endereço</dt><dd>" + esc(cfg.endereco) + "<br>" + esc(cfg.cidade) + "/" + esc(cfg.uf) + " · CEP " + esc(cfg.cep) + "</dd>" +
            "<dt>Contato</dt><dd>" + esc(cfg.telefone) + " · " + esc(cfg.instagram || "") + "</dd>" +
            "<dt>Código INEP</dt><dd>" + esc(cfg.inep) + "</dd>" +
            "<dt>Etapas atendidas</dt><dd>" + est.porEtapa.map(e => esc(e.nome)).join("<br>") + "</dd>" +
            "<dt>Turmas</dt><dd>" + est.porTurma.map(x => esc(x.turma.nome)).join(" · ") + "</dd>" +
            "<dt>Componentes</dt><dd>" + Dados.disciplinas().length + " no catálogo · " +
              est.porDisciplina.length + " com lançamento</dd>" +
            "<dt>Atividades publicadas</dt><dd>" + est.totalAtividades + "</dd>" +
          "</dl>"
        }) +
      "</div>";

    /* graficos ---------------------------------------------------------- */
    Graficos.barrasHorizontais($("#gMediaDisciplina"), {
      dados: est.porDisciplina.map(function (d) {
        return {
          rotulo: d.disciplina.nome, valor: d.media, corPorValor: true,
          detalhe: d.alunosAbaixo + " de " + d.alunosComNota + " alunos abaixo da média"
        };
      }),
      max: cfg.notaMaxima, corPorValor: true, recuperacao: cfg.mediaRecuperacao,
      corte: { valor: cfg.mediaMinima, rotulo: "média " + fmt.nota(cfg.mediaMinima) },
      descricao: "Média de cada componente curricular comparada à média mínima da escola"
    });

    const fatias = [
      { rotulo: "Na média ou acima", valor: est.distribuicao.bom, cor: "#1c7a4f" },
      { rotulo: "Abaixo da média", valor: est.distribuicao.atencao, cor: "#a86c0c" },
      { rotulo: "Situação crítica", valor: est.distribuicao.critico, cor: "#a53225" },
      { rotulo: "Sem lançamento", valor: est.distribuicao.sem, cor: "#c3ccd4" }
    ];
    Graficos.rosca($("#gSituacao"), {
      dados: fatias, altura: 194,
      centro: { valor: est.totalAlunos, rotulo: "estudantes" },
      descricao: "Distribuição dos estudantes por situação acadêmica"
    });
    Graficos.legenda($("#lSituacao"), fatias.filter(f => f.valor > 0).map(function (f) {
      return { cor: f.cor, rotulo: f.rotulo, valor: f.valor };
    }));

    Graficos.linha($("#gBimestres"), {
      rotulos: ["1º bim.", "2º bim.", "3º bim.", "4º bim."],
      series: [{ nome: "Média da escola", cor: "#b17f00", pontos: est.porBimestre.map(b => b.media) }],
      max: cfg.notaMaxima, area: true, altura: 214,
      corte: { valor: cfg.mediaMinima },
      descricao: "Evolução da média geral da escola ao longo dos bimestres"
    });

    Graficos.barras($("#gTurmas"), {
      dados: est.porTurma.map(function (t) {
        return { rotulo: t.turma.nome, valor: t.media, detalhe: t.emRisco + " de " + t.alunos + " abaixo da média" };
      }),
      max: cfg.notaMaxima, corPorValor: true, altura: 214,
      corte: { valor: cfg.mediaMinima }, marcas: [0, 2, 4, 6, 8, 10],
      descricao: "Média de cada turma"
    });

    $("#btnNovoProf").addEventListener("click", () => formularioProfessor(null));
    $("#btnNovoAluno").addEventListener("click", () => formularioAluno(null));
    delegar(visao, "click", "[data-boletim]", function (e, b) {
      casca.irPara("boletins", [b.dataset.boletim]);
    });
  }

  function tabelaRisco(lista) {
    if (!lista.length) {
      return Casca.vazio("Nenhum estudante em risco", "Todos estão com média igual ou superior a " +
        fmt.nota(c().mediaMinima) + " em todos os componentes.", "checkCirculo");
    }
    return '<div class="rolagem-x"><table class="tabela">' +
      "<thead><tr><th>Estudante</th><th>Turma</th><th>Componentes abaixo</th>" +
      '<th class="num">Média</th></tr></thead><tbody>' +
      lista.map(function (r) {
        return '<tr class="linha-clicavel" data-boletim="' + r.aluno.id + '">' +
          '<td><div class="pessoa"><span class="avatar p roxo">' + N.iniciais(r.aluno.nome) + "</span>" +
          '<div><div class="nome">' + esc(r.aluno.nome) + "</div>" +
          '<div class="det">' + esc(r.aluno.matricula) + "</div></div></div></td>" +
          "<td>" + esc(r.turma ? r.turma.nome : "—") + "</td>" +
          "<td>" + r.disciplinas.slice(0, 3).map(d => '<span class="etiqueta">' + esc(d.sigla) + "</span>").join(" ") +
          (r.disciplinas.length > 3 ? ' <span class="pequeno texto-3">+' + (r.disciplinas.length - 3) + "</span>" : "") + "</td>" +
          '<td class="num" style="color:' + Graficos.corPorNota(r.media, c().mediaMinima) + ';font-weight:700">' +
          fmt.nota(r.media) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function listaCriticos(est) {
    const ordenados = est.porDisciplina.slice()
      .filter(d => d.alunosComNota > 0)
      .sort((a, b) => b.percentualAbaixo - a.percentualAbaixo)
      .slice(0, 6);
    if (!ordenados.length || ordenados[0].percentualAbaixo === 0) {
      return Casca.vazio("Sem componentes críticos", "Nenhum componente tem alunos abaixo da média.", "checkCirculo");
    }
    return '<div style="display:flex;flex-direction:column;gap:14px">' + ordenados.map(function (d) {
      const pct = d.percentualAbaixo;
      const classe = pct >= 50 ? "rubro" : pct >= 25 ? "ambar" : "verde";
      return "<div>" +
        '<div class="linha-flex entre" style="margin-bottom:5px">' +
          '<span class="medio forte">' + esc(d.disciplina.nome) + "</span>" +
          '<span class="pequeno texto-2">' + d.alunosAbaixo + "/" + d.alunosComNota +
          ' · <b style="color:var(--texto)">' + fmt.percentual(pct) + "</b></span></div>" +
        '<span class="barra ' + classe + '"><span style="width:' + pct + '%"></span></span>' +
        "</div>";
    }).join("") + "</div>";
  }

  /* ======================================================= Desempenho ==== */
  function telaDesempenho(visao) {
    const turmas = Dados.turmas();
    // O escopo guardado é "t:<turma>", "e:<etapa>" ou vazio (escola inteira).
    const bruto = filtros.turmaDesempenho || "";
    const tipo = bruto.slice(0, 2);
    const valor = bruto.slice(2);
    const filtroEst = tipo === "t:" ? { turmaId: valor } : tipo === "e:" ? { etapa: valor } : null;
    const turmaId = tipo === "t:" ? valor : "";
    const est = Dados.estatisticas(filtroEst);
    const cfg = c();
    const escopo = tipo === "t:" ? Dados.turma(valor).nome
      : tipo === "e:" ? Dados.nomeEtapa(valor)
      : "toda a escola";

    visao.innerHTML =
      Casca.cabecalho("Desempenho acadêmico",
        "Indicadores por componente, turma e etapa. Exibindo: " + escopo + ".",
        '<button class="btn btn-neutro" id="btnExportarCsv">' + Icone("download") + "<span>Exportar planilha</span></button>") +

      '<div class="barra-lancamento">' +
        '<span class="rotulo" style="margin:0">Escopo</span>' +
        '<select class="selecao" id="selTurma" style="min-width:250px">' +
          '<option value=""' + (bruto === "" ? " selected" : "") + ">Toda a escola</option>" +
          Object.keys(Dados.etapas()).map(function (k) {
            const daEtapa = turmas.filter(x => x.etapa === k);
            if (!daEtapa.length) return "";
            return '<optgroup label="' + esc(Dados.nomeEtapa(k)) + '">' +
              '<option value="e:' + k + '"' + (bruto === "e:" + k ? " selected" : "") +
              ">Toda a etapa — " + esc(Dados.etapaCurta(k)) + "</option>" +
              daEtapa.map(x => '<option value="t:' + x.id + '"' + (x.id === turmaId ? " selected" : "") +
                ">" + esc(x.nome) + " — " + esc(x.turno) + "</option>").join("") +
              "</optgroup>";
          }).join("") +
        "</select>" +
        '<span class="esticar"></span>' +
        '<span class="pequeno texto-2">' + est.totalAlunos + " estudantes · " +
        est.lancadas + " notas lançadas</span>" +
      "</div>" +

      '<div class="grade-kpi">' +
        Casca.kpi({ rotulo: "Média do escopo", valor: fmt.nota(est.mediaGeral), tom: est.mediaGeral >= cfg.mediaMinima ? "verde" : "ambar", nota: "sobre " + est.lancadas + " lançamentos" }) +
        Casca.kpi({ rotulo: "Aprovando", valor: est.distribuicao.bom, nota: "na média ou acima", tom: "verde" }) +
        Casca.kpi({ rotulo: "Em recuperação", valor: est.distribuicao.atencao, nota: "entre " + fmt.nota(cfg.mediaRecuperacao) + " e " + fmt.nota(cfg.mediaMinima), tom: "ambar" }) +
        Casca.kpi({ rotulo: "Crítico", valor: est.distribuicao.critico, nota: "abaixo de " + fmt.nota(cfg.mediaRecuperacao), tom: "rubro" }) +
      "</div>" +

      '<div class="grade-2" style="margin-bottom:16px">' +
        Casca.cartao({ titulo: "Média por componente", sub: escopo, corpo: '<div id="gDisc2"></div>' }) +
        Casca.cartao({ titulo: "Evolução bimestral", sub: escopo, corpo: '<div id="gBim2"></div>' }) +
      "</div>" +

      Casca.cartao({
        titulo: "Detalhamento por componente curricular",
        sub: "Números consolidados de " + escopo,
        justo: true,
        corpo: tabelaComponentes(est)
      }) +

      '<div class="topo-20">' + Casca.cartao({
        titulo: "Lista de acompanhamento",
        sub: est.emRisco.length + " estudantes com componentes abaixo da média",
        justo: true,
        corpo: tabelaRisco(est.emRisco)
      }) + "</div>";

    Graficos.barrasHorizontais($("#gDisc2"), {
      dados: est.porDisciplina.map(d => ({
        rotulo: d.disciplina.nome, valor: d.media,
        detalhe: d.lancamentos + " lançamentos · " + fmt.percentual(d.percentualAbaixo) + " abaixo"
      })),
      max: cfg.notaMaxima, corPorValor: true, recuperacao: cfg.mediaRecuperacao,
      corte: { valor: cfg.mediaMinima, rotulo: "média " + fmt.nota(cfg.mediaMinima) }
    });

    Graficos.linha($("#gBim2"), {
      rotulos: ["1º bim.", "2º bim.", "3º bim.", "4º bim."],
      series: [{ nome: escopo, cor: "#b17f00", pontos: est.porBimestre.map(b => b.media) }],
      max: cfg.notaMaxima, area: true, altura: 268, corte: { valor: cfg.mediaMinima }
    });

    $("#selTurma").addEventListener("change", function () {
      filtros.turmaDesempenho = this.value;
      telaDesempenho(visao);
    });
    $("#btnExportarCsv").addEventListener("click", () => exportarCsv(turmaId, tipo === "e:" ? valor : null));
    delegar(visao, "click", "[data-boletim]", (e, b) => casca.irPara("boletins", [b.dataset.boletim]));
  }

  function tabelaComponentes(est) {
    const cfg = c();
    return '<div class="rolagem-x"><table class="tabela">' +
      "<thead><tr><th>Componente</th><th>Área</th>" +
      '<th class="num">Média</th><th class="num">Lançamentos</th>' +
      '<th class="num">Abaixo da média</th><th style="width:150px">Situação</th></tr></thead><tbody>' +
      est.porDisciplina.map(function (d) {
        const pct = d.percentualAbaixo;
        const classe = pct >= 50 ? "rubro" : pct >= 25 ? "ambar" : "verde";
        return "<tr><td><b>" + esc(d.disciplina.nome) + "</b></td>" +
          '<td class="pequeno texto-2">' + esc(d.disciplina.area) + "</td>" +
          '<td class="num" style="font-weight:700;color:' + Graficos.corPorNota(d.media, cfg.mediaMinima) + '">' +
          fmt.nota(d.media) + "</td>" +
          '<td class="num">' + d.lancamentos + "</td>" +
          '<td class="num">' + d.alunosAbaixo + " de " + d.alunosComNota + "</td>" +
          '<td><div class="medidor"><span class="barra ' + classe + '"><span style="width:' + pct + '%"></span></span>' +
          '<span class="v">' + fmt.percentual(pct) + "</span></div></td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /**
   * Planilha de boletins. As colunas seguem a matriz do escopo escolhido —
   * sem escopo, entram todos os componentes e as células fora da matriz da
   * etapa ficam em branco.
   */
  function exportarCsv(turmaId, etapa) {
    let lista = Dados.alunos(turmaId ? { turmaId: turmaId } : null);
    if (etapa) lista = lista.filter(a => (Dados.turma(a.turmaId) || {}).etapa === etapa);

    const discs = turmaId ? Dados.disciplinasDaTurma(turmaId)
      : etapa ? Dados.disciplinas().filter(d => d.etapas.indexOf(etapa) > -1)
      : Dados.disciplinas();

    const linhas = [["Matrícula", "Estudante", "Turma", "Etapa"]
      .concat(discs.map(d => d.nome))
      .concat(["Média geral", "Situação"]).join(";")];

    lista.forEach(function (a) {
      const b = Dados.boletim(a.id);
      const turmaA = Dados.turma(a.turmaId) || {};
      const porId = {};
      b.linhas.forEach(l => { porId[l.disciplina.id] = l.media; });
      linhas.push([a.matricula, a.nome, turmaA.nome, Dados.etapaCurta(turmaA.etapa)]
        .concat(discs.map(d => (d.id in porId ? fmt.nota(porId[d.id], "") : "")))
        .concat([fmt.nota(b.mediaGeral, ""), b.situacaoGeral.rotulo]).join(";"));
    });

    const rotulo = turmaId ? Dados.turma(turmaId).nome : etapa ? Dados.etapaCurta(etapa) : "escola";
    const nome = "boletins-" + N.normalizar(rotulo).replace(/\s+/g, "-") + "-" + c().anoLetivo + ".csv";
    // O BOM na frente faz o Excel abrir o arquivo em UTF-8 sem embaralhar acentos.
    N.baixar(nome, "﻿" + linhas.join("\r\n"), "text/csv;charset=utf-8");
    N.notificar({ titulo: "Planilha gerada", texto: nome, tipo: "ok" });
  }

  /* ========================================================= Boletins ==== */
  function telaBoletins(visao) {
    const turmas = Dados.turmas();
    const turmaId = filtros.turmaAlunos || turmas[0].id;
    const lista = Dados.alunos({ turmaId: turmaId });
    if (!boletimAberto || !Dados.usuario(boletimAberto)) boletimAberto = lista.length ? lista[0].id : null;

    visao.innerHTML =
      Casca.cabecalho("Boletins", "As alterações ficam registradas com autor, data e valor anterior.",
        (boletimAberto ? '<button class="btn btn-neutro" id="btnImprimir">' + Icone("imprimir") + "<span>Imprimir boletim</span></button>" : "")) +

      '<div class="grade-lista">' +
        '<section class="cartao sem-impressao" style="align-self:start">' +
          '<div class="cartao-topo"><div><h3>Estudantes</h3>' +
          '<div class="sub">' + lista.length + " matriculados</div></div></div>" +
          '<div class="cartao-corpo" style="padding:12px">' +
            '<select class="selecao" id="selTurmaBol">' +
            turmas.map(t => '<option value="' + t.id + '"' + (t.id === turmaId ? " selected" : "") + ">" +
              esc(t.nome) + " — " + esc(Dados.etapaCurta(t.etapa)) + "</option>").join("") + "</select>" +
          "</div>" +
          '<div class="cartao-corpo justo" style="max-height:560px;overflow-y:auto">' +
            (lista.length ? '<table class="tabela tabela-compacta"><tbody>' + lista.map(function (a) {
              const b = Dados.boletim(a.id);
              return '<tr class="linha-clicavel" data-aluno="' + a.id + '"' +
                (a.id === boletimAberto ? ' style="background:var(--marca-clara)"' : "") + ">" +
                '<td><div class="pessoa"><span class="avatar p roxo">' + N.iniciais(a.nome) + "</span>" +
                '<div><div class="nome">' + esc(a.nome) + '</div><div class="det">' + esc(a.matricula) + "</div></div></div></td>" +
                '<td class="num" style="font-weight:700;color:' + Graficos.corPorNota(b.mediaGeral, c().mediaMinima) + '">' +
                fmt.nota(b.mediaGeral) + "</td></tr>";
            }).join("") + "</tbody></table>" : Casca.vazio("Turma vazia", "Nenhum estudante matriculado nesta turma.", "usuarios")) +
          "</div>" +
        "</section>" +
        '<div id="areaBoletim"></div>' +
      "</div>";

    $("#selTurmaBol").addEventListener("change", function () {
      filtros.turmaAlunos = this.value;
      boletimAberto = null;
      telaBoletins(visao);
    });
    delegar(visao, "click", "[data-aluno]", function (e, tr) {
      boletimAberto = tr.dataset.aluno;
      history.replaceState(null, "", "#/boletins/" + boletimAberto);
      telaBoletins(visao);
    });

    pintarBoletim();
    const bi = $("#btnImprimir");
    if (bi) bi.addEventListener("click", () => window.print());
  }

  function pintarBoletim() {
    const area = $("#areaBoletim");
    if (!area) return;
    if (!boletimAberto) {
      area.innerHTML = '<section class="cartao">' +
        Casca.vazio("Selecione um estudante", "Escolha alguém na lista ao lado para abrir o boletim completo.", "livro") +
        "</section>";
      return;
    }
    const aluno = Dados.usuario(boletimAberto);
    const dados = Dados.boletim(aluno.id);

    area.innerHTML = '<section class="cartao">' +
      Boletim.timbrado(aluno) +
      Boletim.cabecalho(aluno, dados) +
      '<div class="cartao-corpo justo">' + Boletim.tabela(aluno.id, { editavel: true }) + "</div>" +
      Boletim.assinaturas() +
      '<div class="cartao-rodape sem-impressao linha-flex entre quebra">' +
        '<span class="pequeno texto-2">' + Icone("info") +
        " Clique numa nota para corrigir. Use as setas do teclado para navegar entre as células.</span>" +
        '<button class="btn btn-neutro btn-p" id="btnHistorico">' + Icone("relogio") + "<span>Histórico deste boletim</span></button>" +
      "</div></section>";

    Boletim.ligarEdicao(area, aluno.id, eu.id, function () {
      N.notificar({ texto: "Lançamento atualizado no boletim de " + N.primeiroNome(aluno.nome) + ".", tipo: "ok", ms: 2200 });
    });

    $("#btnHistorico").addEventListener("click", () => historicoDoAluno(aluno));
  }

  /** Atualiza medias e selos sem recriar os campos (nao perde o foco). */
  function atualizarResumoBoletim() {
    const area = $("#areaBoletim");
    if (!area || !boletimAberto) return;
    const aluno = Dados.usuario(boletimAberto);
    if (!aluno) return;
    const dados = Dados.boletim(aluno.id);
    const cabecalho = area.querySelector(".cabecalho-boletim");
    if (cabecalho) {
      const novo = document.createElement("div");
      novo.innerHTML = Boletim.cabecalho(aluno, dados);
      cabecalho.replaceWith(novo.firstElementChild);
    }
    const linhas = $$(".tabela-boletim tbody tr", area);
    dados.linhas.forEach(function (l, i) {
      const tr = linhas[i];
      if (!tr) return;
      const cor = Graficos.corPorNota(l.media, c().mediaMinima, c().mediaRecuperacao);
      const cel = tr.querySelector("td.media");
      if (cel) { cel.textContent = fmt.nota(l.media); cel.style.color = cor; }
      const selo = tr.children[6];
      if (selo) selo.innerHTML = Casca.selo(l.situacao);
      const barra = tr.querySelector(".medidor .barra");
      if (barra) {
        barra.className = "barra " + (l.media === null ? "" : l.media >= c().mediaMinima ? "verde" : l.media >= c().mediaRecuperacao ? "ambar" : "rubro");
        barra.firstElementChild.style.width = (l.media === null ? 0 : (l.media / c().notaMaxima) * 100) + "%";
      }
      const v = tr.querySelector(".medidor .v");
      if (v) v.textContent = l.media === null ? "—" : fmt.decimal(l.media);
      tr.classList.toggle("risco", l.media !== null && l.media < c().mediaMinima);
    });
    $$(".nota-in", area).forEach(function (campo) {
      const n = Dados.nota(aluno.id, campo.dataset.disciplina, Number(campo.dataset.bimestre));
      if (document.activeElement !== campo) campo.value = n ? fmt.nota(n.valor) : "";
      campo.classList.toggle("baixa", !!n && n.valor < c().mediaMinima);
      campo.classList.toggle("boa", !!n && n.valor >= c().mediaMinima);
    });
  }

  function historicoDoAluno(aluno) {
    const eventos = Dados.estado().registro.filter(function (r) {
      return r.detalhe && r.detalhe.indexOf(aluno.nome) > -1;
    }).slice(0, 40);

    N.abrirModal({
      titulo: "Histórico de lançamentos",
      subtitulo: aluno.nome + " · matrícula " + aluno.matricula,
      largura: "largo",
      conteudo: eventos.length ? '<div class="registro">' + eventos.map(eventoHtml).join("") + "</div>"
        : Casca.vazio("Sem registros", "Nenhuma operação registrada para este estudante ainda.", "lista"),
      acoes: [{ rotulo: "Fechar", classe: "btn-neutro", valor: "fechar" }]
    });
  }

  /* ====================================================== Professores ==== */
  function telaProfessores(visao) {
    const termo = N.normalizar(filtros.professores);
    const todos = Dados.professores().sort(N.ordenarPor("nome"));
    const lista = todos.filter(function (p) {
      if (!termo) return true;
      const disc = (p.disciplinas || []).map(id => (Dados.disciplina(id) || {}).nome).join(" ");
      return N.normalizar(p.nome + " " + p.email + " " + p.matricula + " " + disc).indexOf(termo) > -1;
    });

    visao.innerHTML =
      Casca.cabecalho("Quadro docente",
        "Cadastro do corpo docente e vínculo com turmas e componentes.",
        '<button class="btn btn-principal" id="btnNovoProf">' + Icone("mais") + "<span>Cadastrar professor</span></button>") +

      Casca.cartao({
        titulo: "Professores cadastrados",
        sub: todos.filter(p => p.ativo).length + " ativos · " + todos.filter(p => !p.ativo).length + " desativados",
        acao: '<div class="busca" style="width:270px"><input class="entrada" id="buscaProf" type="search" ' +
          'placeholder="Buscar por nome, e-mail ou componente" value="' + esc(filtros.professores) + '">' + Icone("busca") + "</div>",
        justo: true,
        corpo: lista.length ? '<div class="rolagem-x"><table class="tabela"><thead><tr>' +
          "<th>Professor</th><th>Matrícula</th><th>Componentes</th><th>Regime</th>" +
          '<th class="num">Lançamentos</th><th>Último acesso</th><th>Situação</th><th></th>' +
          "</tr></thead><tbody>" + lista.map(linhaProfessor).join("") + "</tbody></table></div>"
          : Casca.vazio("Nenhum resultado", "Nenhum professor corresponde a “" + filtros.professores + "”.", "busca")
      });

    const busca = $("#buscaProf");
    busca.addEventListener("input", N.debounce(function () {
      filtros.professores = busca.value;
      telaProfessores(visao);
      const novo = $("#buscaProf");
      novo.focus();
      novo.setSelectionRange(novo.value.length, novo.value.length);
    }, 260));

    $("#btnNovoProf").addEventListener("click", () => formularioProfessor(null));
    delegar(visao, "click", "[data-ver]", (e, b) => fichaProfessor(Dados.usuario(b.dataset.ver)));
    delegar(visao, "click", "[data-editar]", function (e, b) {
      e.stopPropagation();
      formularioProfessor(Dados.usuario(b.dataset.editar));
    });
  }

  function linhaProfessor(p) {
    const discs = (p.disciplinas || []).map(id => Dados.disciplina(id)).filter(Boolean);
    const lancamentos = Dados.estado().notas.filter(n => n.lancadoPor === p.id).length;
    return '<tr class="linha-clicavel" data-ver="' + p.id + '">' +
      '<td><div class="pessoa"><span class="avatar verde">' + N.iniciais(p.nome) + "</span>" +
      '<div><div class="nome">' + esc(p.nome) + '</div><div class="det">' + esc(p.email) + "</div></div></div></td>" +
      '<td class="num">' + esc(p.matricula) + "</td>" +
      "<td>" + discs.map(d => '<span class="etiqueta" title="' + esc(d.nome) + '">' + esc(d.sigla) + "</span>").join(" ") + "</td>" +
      '<td class="pequeno texto-2">' + esc(p.regime || "—") + "</td>" +
      '<td class="num">' + lancamentos + "</td>" +
      '<td class="pequeno texto-2">' + (p.ultimoAcesso ? fmt.relativo(p.ultimoAcesso) : "nunca acessou") + "</td>" +
      "<td>" + (p.ativo ? '<span class="selo selo-verde">Ativo</span>' : '<span class="selo selo-cinza">Desativado</span>') + "</td>" +
      '<td class="acoes"><button class="btn btn-icone" data-editar="' + p.id + '" title="Editar cadastro">' +
      Icone("lapis") + "</button></td></tr>";
  }

  function fichaProfessor(p) {
    if (!p) return;
    const discs = (p.disciplinas || []).map(id => Dados.disciplina(id)).filter(Boolean);
    const turmasP = (p.turmas || []).map(id => Dados.turma(id)).filter(Boolean);
    const lancamentos = Dados.estado().notas.filter(n => n.lancadoPor === p.id);
    const atvs = Dados.atividades({ professorId: p.id });

    const conteudo =
      '<div class="linha-flex" style="gap:14px;margin-bottom:20px">' +
        '<span class="avatar g verde">' + N.iniciais(p.nome) + "</span>" +
        "<div><h3>" + esc(p.nome) + "</h3>" +
        '<div class="pequeno texto-2">' + esc(p.formacao || "Formação não informada") + "</div></div>" +
        '<span class="esticar"></span>' +
        (p.ativo ? '<span class="selo selo-verde">Conta ativa</span>' : '<span class="selo selo-cinza">Desativada</span>') +
      "</div>" +

      '<div class="grade-kpi" style="margin-bottom:20px">' +
        Casca.kpi({ rotulo: "Notas lançadas", valor: lancamentos.length }) +
        Casca.kpi({ rotulo: "Atividades", valor: atvs.length, tom: "roxo" }) +
        Casca.kpi({ rotulo: "Componentes", valor: discs.length, tom: "verde" }) +
      "</div>" +

      '<div class="divisor-rotulado">Dados cadastrais</div>' +
      '<dl class="definicoes">' +
        "<dt>Matrícula</dt><dd>" + esc(p.matricula) + "</dd>" +
        "<dt>E-mail institucional</dt><dd>" + esc(p.email) + "</dd>" +
        "<dt>Telefone</dt><dd>" + esc(p.telefone || "—") + "</dd>" +
        "<dt>Regime de trabalho</dt><dd>" + esc(p.regime || "—") + "</dd>" +
        "<dt>Componentes</dt><dd>" + (discs.length ? discs.map(d => esc(d.nome)).join(", ") : "nenhum vinculado") + "</dd>" +
        "<dt>Turmas atendidas</dt><dd>" + (turmasP.length ? turmasP.map(t => esc(t.nome)).join(", ") : "nenhuma") + "</dd>" +
        "<dt>Conta criada em</dt><dd>" + fmt.dataHora(p.criadoEm) + "</dd>" +
        "<dt>Último acesso</dt><dd>" + (p.ultimoAcesso ? fmt.dataHora(p.ultimoAcesso) + " (" + fmt.relativo(p.ultimoAcesso) + ")" : "nunca acessou") + "</dd>" +
        "<dt>Senha</dt><dd class=\"texto-2\">Armazenada com resumo criptográfico. A gestão pode redefinir, não visualizar.</dd>" +
      "</dl>" +

      (atvs.length ? '<div class="divisor-rotulado topo-20">Últimas atividades publicadas</div>' +
        '<table class="tabela tabela-compacta"><tbody>' + atvs.slice(-5).reverse().map(function (a) {
          return "<tr><td>" + esc(a.titulo) + "</td>" +
            '<td class="pequeno texto-2">' + esc((Dados.turma(a.turmaId) || {}).nome) + "</td>" +
            '<td class="pequeno texto-2 direita">entrega ' + fmt.data(a.entrega) + "</td></tr>";
        }).join("") + "</tbody></table>" : "");

    N.abrirModal({
      titulo: "Ficha do professor",
      subtitulo: p.email,
      largura: "largo",
      conteudo: conteudo,
      acoes: [
        { rotulo: p.ativo ? "Desativar conta" : "Reativar conta", classe: p.ativo ? "btn-perigo-suave" : "btn-neutro", esquerda: true,
          aoClicar: function () { alternarConta(p); } },
        { rotulo: "Redefinir senha", classe: "btn-neutro", icone: "chave", aoClicar: function () { redefinirSenha(p); } },
        { rotulo: "Acessar como", classe: "btn-neutro", icone: "olho", aoClicar: function () { acessarComo(p); } },
        { rotulo: "Editar cadastro", classe: "btn-principal", icone: "lapis", aoClicar: function () { N.fecharModal(); formularioProfessor(p); } }
      ]
    });
  }

  function alternarConta(u) {
    N.confirmar({
      titulo: u.ativo ? "Desativar conta" : "Reativar conta",
      texto: u.ativo
        ? "Ao desativar, " + u.nome + " deixa de conseguir entrar no sistema. Os lançamentos já feitos são mantidos."
        : "A conta de " + u.nome + " voltará a permitir acesso.",
      rotuloOk: u.ativo ? "Desativar" : "Reativar",
      perigo: u.ativo
    }).then(function (ok) {
      if (!ok) return;
      const ativo = Dados.alternarAtivo(u.id, eu.id);
      N.fecharModal();
      N.notificar({ texto: u.nome + (ativo ? " voltou a ter acesso." : " não consegue mais entrar."), tipo: "ok" });
    });
  }

  function redefinirSenha(u) {
    N.abrirModal({
      titulo: "Redefinir senha",
      subtitulo: u.nome,
      largura: "estreito",
      conteudo:
        '<div class="aviso aviso-alerta" style="margin-bottom:16px">' + Icone("alerta") +
        "<div>Anote a senha antes de fechar: ela não poderá ser consultada depois. Oriente a pessoa a trocá-la no primeiro acesso.</div></div>" +
        '<div class="campo"><label for="novaSenha">Nova senha</label>' +
        '<input class="entrada" id="novaSenha" value="' + gerarSenha() + '">' +
        '<span class="ajuda">Mínimo de 6 caracteres.</span></div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn-neutro", valor: "fechar" },
        { rotulo: "Definir senha", classe: "btn-principal", aoClicar: function (e, api) {
          const nova = api.$("#novaSenha").value.trim();
          if (nova.length < 6) { N.notificar({ texto: "Use pelo menos 6 caracteres.", tipo: "erro" }); return; }
          Dados.atualizarUsuario(u.id, { senha: nova }, eu.id);
          N.fecharModal();
          N.notificar({ titulo: "Senha redefinida", texto: u.nome + " · nova senha: " + nova, tipo: "ok", ms: 9000 });
        } }
      ]
    });
  }

  function gerarSenha() {
    const silabas = ["ma", "re", "lo", "ti", "sa", "vu", "pe", "no", "ka", "zi"];
    let s = "";
    for (let i = 0; i < 3; i++) s += silabas[Math.floor(Math.random() * silabas.length)];
    return s + Math.floor(10 + Math.random() * 89);
  }

  function acessarComo(u) {
    N.confirmar({
      titulo: "Acesso assistido",
      texto: "Você vai abrir o sistema com a conta de " + u.nome + ". Um aviso permanente ficará visível " +
        "e a operação será registrada. Para voltar, use o botão na faixa superior.",
      rotuloOk: "Acessar como " + N.primeiroNome(u.nome)
    }).then(function (ok) { if (ok) Sessao.personificar(u.id); });
  }

  /* --------------------------------------------- Formulario de professor - */
  function formularioProfessor(p) {
    const editando = !!p;
    const atual = p || {
      nome: "", email: "", telefone: "", formacao: "", regime: "40h semanais",
      disciplinas: [], turmas: Dados.turmas().map(t => t.id),
      matricula: Dados.proximaMatricula("professor")
    };

    const conteudo =
      '<div class="grade-campos">' +
        '<div class="campo largo"><label for="pNome">Nome completo <span class="obrig">*</span></label>' +
          '<input class="entrada" id="pNome" value="' + esc(atual.nome) + '" placeholder="Como consta no documento"></div>' +
        '<div class="campo"><label for="pEmail">E-mail institucional <span class="obrig">*</span></label>' +
          '<input class="entrada" type="email" id="pEmail" value="' + esc(atual.email) + '" placeholder="nome.sobrenome@colegioomega.com.br"></div>' +
        '<div class="campo"><label for="pMatricula">Matrícula funcional</label>' +
          '<input class="entrada" id="pMatricula" value="' + esc(atual.matricula) + '"' + (editando ? " disabled" : "") + "></div>" +
        '<div class="campo"><label for="pTelefone">Telefone</label>' +
          '<input class="entrada" id="pTelefone" value="' + esc(atual.telefone || "") + '" placeholder="(00) 00000-0000"></div>' +
        '<div class="campo"><label for="pRegime">Regime de trabalho</label>' +
          '<select class="selecao" id="pRegime">' +
          ["40h semanais", "30h semanais", "20h semanais", "Horista", "Contrato temporário"]
            .map(r => '<option' + (r === atual.regime ? " selected" : "") + ">" + r + "</option>").join("") +
          "</select></div>" +
        '<div class="campo largo"><label for="pFormacao">Formação acadêmica</label>' +
          '<input class="entrada" id="pFormacao" value="' + esc(atual.formacao || "") + '" placeholder="Ex.: Licenciatura em Matemática — UNESP"></div>' +
      "</div>" +

      '<div class="divisor-rotulado topo-8">Componentes que leciona <span style="color:var(--rubro)">*</span></div>' +
      Object.keys(Dados.etapas()).map(function (chave) {
        const daEtapa = Dados.disciplinas().filter(d => d.etapas.indexOf(chave) > -1);
        return '<div class="pequeno maiusc texto-3" style="margin:10px 0 6px">' + esc(Dados.nomeEtapa(chave)) + "</div>" +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">' +
          daEtapa.map(function (d) {
            return '<label class="caixa-marcar"><input type="checkbox" name="disc" value="' + d.id + '"' +
              (atual.disciplinas.indexOf(d.id) > -1 ? " checked" : "") + "><span>" + esc(d.nome) +
              '<br><span class="pequeno texto-3">' + esc(d.area) + "</span></span></label>";
          }).join("") + "</div>";
      }).join("") +
      '<span class="ajuda">Componentes ofertados nas duas etapas aparecem em ambas as listas — marcar uma vez basta.</span>' +

      '<div class="divisor-rotulado topo-20">Turmas atendidas</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">' +
        Dados.turmas().map(function (t) {
          return '<label class="caixa-marcar"><input type="checkbox" name="turma" value="' + t.id + '"' +
            ((atual.turmas || []).indexOf(t.id) > -1 ? " checked" : "") + "><span>" + esc(t.nome) +
            '<br><span class="pequeno texto-3">' + esc(Dados.etapaCurta(t.etapa)) + " · " + esc(t.sala) + "</span></span></label>";
        }).join("") +
      "</div>" +

      (editando ? "" :
        '<div class="divisor-rotulado topo-20">Acesso</div>' +
        '<div class="campo"><label for="pSenha">Senha inicial <span class="obrig">*</span></label>' +
        '<input class="entrada" id="pSenha" value="prof123">' +
        '<span class="ajuda">Entregue esta senha ao professor. Ele poderá trocá-la no menu da própria conta.</span></div>');

    N.abrirModal({
      titulo: editando ? "Editar professor" : "Cadastrar professor",
      subtitulo: editando ? atual.nome : "O acesso fica disponível assim que o cadastro for salvo.",
      largura: "largo",
      conteudo: conteudo,
      aoAbrir: function (corpo) {
        const nome = corpo.querySelector("#pNome");
        const email = corpo.querySelector("#pEmail");
        nome.addEventListener("blur", function () {
          if (email.value.trim() || !nome.value.trim()) return;
          email.value = sugerirEmail(nome.value, "colegioomega.com.br");
        });
      },
      acoes: [
        { rotulo: "Cancelar", classe: "btn-neutro", valor: "fechar" },
        { rotulo: editando ? "Salvar alterações" : "Cadastrar professor", classe: "btn-principal", icone: "check",
          aoClicar: function (ev, api) { gravarProfessor(api, p); } }
      ]
    });
  }

  function gravarProfessor(api, existente) {
    const nome = api.$("#pNome").value.trim();
    const email = api.$("#pEmail").value.trim().toLowerCase();
    const discs = api.$$('input[name="disc"]:checked').map(i => i.value);
    const turmasSel = api.$$('input[name="turma"]:checked').map(i => i.value);

    const erro = validarPessoa(nome, email, existente ? existente.id : null);
    if (erro) { N.notificar({ texto: erro, tipo: "erro" }); return; }
    if (!discs.length) { N.notificar({ texto: "Selecione ao menos um componente curricular.", tipo: "erro" }); return; }

    const campos = {
      nome: nome, email: email, telefone: api.$("#pTelefone").value.trim(),
      formacao: api.$("#pFormacao").value.trim(), regime: api.$("#pRegime").value,
      disciplinas: discs, turmas: turmasSel
    };

    if (existente) {
      Dados.atualizarUsuario(existente.id, campos, eu.id);
      N.notificar({ titulo: "Cadastro atualizado", texto: nome, tipo: "ok" });
    } else {
      const senha = api.$("#pSenha").value.trim() || "prof123";
      if (senha.length < 6) { N.notificar({ texto: "A senha inicial precisa ter 6 caracteres ou mais.", tipo: "erro" }); return; }
      Dados.criarUsuario(Object.assign({
        papel: "professor", matricula: api.$("#pMatricula").value.trim(), senha: senha
      }, campos), eu.id);
      N.notificar({ titulo: "Professor cadastrado", texto: nome + " — matrícula " + (api.$("#pMatricula") ? api.$("#pMatricula").value : "") + ".", tipo: "ok", ms: 5200 });
    }
    N.fecharModal();
    casca.recarregar();
  }

  /* ========================================================= Estudantes == */
  function telaAlunos(visao) {
    const termo = N.normalizar(filtros.alunos);
    const turmaId = filtros.turmaAlunos;
    let lista = Dados.alunos(turmaId ? { turmaId: turmaId } : null);
    if (termo) {
      lista = lista.filter(a => N.normalizar(a.nome + " " + a.email + " " + a.matricula + " " + (a.responsavel || "")).indexOf(termo) > -1);
    }

    visao.innerHTML =
      Casca.cabecalho("Estudantes matriculados",
        "Matrículas, turmas e dados de contato dos estudantes.",
        '<button class="btn btn-principal" id="btnNovoAluno">' + Icone("usuarioMais") + "<span>Matricular estudante</span></button>") +

      Casca.cartao({
        titulo: "Estudantes",
        sub: lista.length + " exibidos de " + Dados.alunos().length + " matriculados",
        acao: '<div class="linha-flex">' +
          '<select class="selecao" id="selTurmaAl" style="width:auto">' +
            '<option value="">Todas as turmas</option>' +
            Dados.turmas().map(t => '<option value="' + t.id + '"' + (t.id === turmaId ? " selected" : "") + ">" +
              esc(t.nome) + " — " + esc(Dados.etapaCurta(t.etapa)) + "</option>").join("") +
          "</select>" +
          '<div class="busca" style="width:250px"><input class="entrada" id="buscaAluno" type="search" ' +
          'placeholder="Buscar estudante" value="' + esc(filtros.alunos) + '">' + Icone("busca") + "</div></div>",
        justo: true,
        corpo: lista.length ? '<div class="rolagem-x"><table class="tabela"><thead><tr>' +
          "<th>Estudante</th><th>Matrícula</th><th>Turma</th>" +
          '<th class="num">Média geral</th><th class="num">Abaixo</th><th>Situação</th><th></th>' +
          "</tr></thead><tbody>" + lista.map(linhaAluno).join("") + "</tbody></table></div>"
          : Casca.vazio("Nenhum resultado", "Ajuste a busca ou o filtro de turma.", "busca")
      });

    $("#btnNovoAluno").addEventListener("click", () => formularioAluno(null));
    $("#selTurmaAl").addEventListener("change", function () { filtros.turmaAlunos = this.value; telaAlunos(visao); });
    const busca = $("#buscaAluno");
    busca.addEventListener("input", N.debounce(function () {
      filtros.alunos = busca.value;
      telaAlunos(visao);
      const novo = $("#buscaAluno");
      novo.focus();
      novo.setSelectionRange(novo.value.length, novo.value.length);
    }, 260));

    delegar(visao, "click", "[data-abrir]", (e, tr) => casca.irPara("boletins", [tr.dataset.abrir]));
    delegar(visao, "click", "[data-editar-aluno]", function (e, b) {
      e.stopPropagation();
      formularioAluno(Dados.usuario(b.dataset.editarAluno));
    });
  }

  function linhaAluno(a) {
    const b = Dados.boletim(a.id);
    const t = Dados.turma(a.turmaId);
    return '<tr class="linha-clicavel" data-abrir="' + a.id + '">' +
      '<td><div class="pessoa"><span class="avatar p roxo">' + N.iniciais(a.nome) + "</span>" +
      '<div><div class="nome">' + esc(a.nome) + '</div><div class="det">' + esc(a.email) + "</div></div></div></td>" +
      '<td class="num">' + esc(a.matricula) + "</td>" +
      "<td>" + esc(t ? t.nome : "—") + "</td>" +
      '<td class="num" style="font-weight:700;color:' + Graficos.corPorNota(b.mediaGeral, c().mediaMinima) + '">' +
      fmt.nota(b.mediaGeral) + "</td>" +
      '<td class="num">' + (b.abaixo.length || "—") + "</td>" +
      "<td>" + Casca.selo(b.situacaoGeral) + "</td>" +
      '<td class="acoes"><button class="btn btn-icone" data-editar-aluno="' + a.id + '" title="Editar cadastro">' +
      Icone("lapis") + "</button></td></tr>";
  }

  function formularioAluno(a) {
    const editando = !!a;
    const atual = a || {
      nome: "", email: "", telefone: "", responsavel: "", nascimento: "",
      turmaId: Dados.turmas()[0].id, matricula: Dados.proximaMatricula("aluno")
    };

    const conteudo =
      '<div class="grade-campos">' +
        '<div class="campo largo"><label for="aNome">Nome completo <span class="obrig">*</span></label>' +
          '<input class="entrada" id="aNome" value="' + esc(atual.nome) + '"></div>' +
        '<div class="campo"><label for="aEmail">E-mail do estudante <span class="obrig">*</span></label>' +
          '<input class="entrada" type="email" id="aEmail" value="' + esc(atual.email) + '" placeholder="nome.sobrenome@aluno.colegioomega.com.br"></div>' +
        '<div class="campo"><label for="aMatricula">Matrícula</label>' +
          '<input class="entrada" id="aMatricula" value="' + esc(atual.matricula) + '"' + (editando ? " disabled" : "") + "></div>" +
        '<div class="campo"><label for="aTurma">Turma <span class="obrig">*</span></label>' +
          '<select class="selecao" id="aTurma">' +
          Dados.turmas().map(t => '<option value="' + t.id + '"' + (t.id === atual.turmaId ? " selected" : "") + ">" +
            esc(t.nome) + " — " + esc(Dados.etapaCurta(t.etapa)) + " · " + esc(t.sala) + "</option>").join("") + "</select></div>" +
        '<div class="campo"><label for="aNascimento">Data de nascimento</label>' +
          '<input class="entrada" type="date" id="aNascimento" value="' + esc(atual.nascimento || "") + '"></div>' +
        '<div class="campo"><label for="aResponsavel">Responsável legal</label>' +
          '<input class="entrada" id="aResponsavel" value="' + esc(atual.responsavel || "") + '"></div>' +
        '<div class="campo"><label for="aTelefone">Telefone de contato</label>' +
          '<input class="entrada" id="aTelefone" value="' + esc(atual.telefone || "") + '" placeholder="(00) 00000-0000"></div>' +
      "</div>" +
      (editando ? "" :
        '<div class="divisor-rotulado topo-8">Acesso</div>' +
        '<div class="campo"><label for="aSenha">Senha inicial <span class="obrig">*</span></label>' +
        '<input class="entrada" id="aSenha" value="aluno123">' +
        '<span class="ajuda">O estudante entra com o e-mail ou com o número da matrícula.</span></div>');

    N.abrirModal({
      titulo: editando ? "Editar estudante" : "Matricular estudante",
      subtitulo: editando ? atual.nome : "O boletim é criado vazio e vai se preenchendo com os lançamentos.",
      largura: "largo",
      conteudo: conteudo,
      aoAbrir: function (corpo) {
        const nome = corpo.querySelector("#aNome");
        const email = corpo.querySelector("#aEmail");
        nome.addEventListener("blur", function () {
          if (email.value.trim() || !nome.value.trim()) return;
          email.value = sugerirEmail(nome.value, "aluno.colegioomega.com.br");
        });
      },
      acoes: [
        { rotulo: "Cancelar", classe: "btn-neutro", valor: "fechar" },
        { rotulo: editando ? "Salvar alterações" : "Matricular", classe: "btn-principal", icone: "check",
          aoClicar: function (ev, api) { gravarAluno(api, a); } }
      ]
    });
  }

  function gravarAluno(api, existente) {
    const nome = api.$("#aNome").value.trim();
    const email = api.$("#aEmail").value.trim().toLowerCase();
    const erro = validarPessoa(nome, email, existente ? existente.id : null);
    if (erro) { N.notificar({ texto: erro, tipo: "erro" }); return; }

    const campos = {
      nome: nome, email: email, turmaId: api.$("#aTurma").value,
      nascimento: api.$("#aNascimento").value,
      responsavel: api.$("#aResponsavel").value.trim(),
      telefone: api.$("#aTelefone").value.trim()
    };

    if (existente) {
      Dados.atualizarUsuario(existente.id, campos, eu.id);
      N.notificar({ titulo: "Cadastro atualizado", texto: nome, tipo: "ok" });
    } else {
      const senha = api.$("#aSenha").value.trim() || "aluno123";
      if (senha.length < 6) { N.notificar({ texto: "A senha inicial precisa ter 6 caracteres ou mais.", tipo: "erro" }); return; }
      const novo = Dados.criarUsuario(Object.assign({
        papel: "aluno", matricula: api.$("#aMatricula").value.trim(), senha: senha
      }, campos), eu.id);
      N.notificar({ titulo: "Estudante matriculado", texto: nome + " · matrícula " + novo.matricula, tipo: "ok", ms: 5200 });
    }
    N.fecharModal();
    casca.recarregar();
  }

  function validarPessoa(nome, email, ignorarId) {
    if (nome.length < 5 || nome.indexOf(" ") < 0) return "Informe o nome completo (nome e sobrenome).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "O e-mail informado não é válido.";
    if (!Dados.emailDisponivel(email, ignorarId)) return "Já existe uma conta usando este e-mail.";
    return null;
  }

  function sugerirEmail(nome, dominio) {
    const partes = N.normalizar(nome).split(/\s+/).filter(p => !/^(de|da|do|das|dos|e)$/.test(p));
    if (partes.length < 2) return "";
    let base = (partes[0] + "." + partes[partes.length - 1]).replace(/[^a-z.]/g, "");
    let tentativa = base + "@" + dominio, i = 1;
    while (!Dados.emailDisponivel(tentativa)) { i += 1; tentativa = base + i + "@" + dominio; }
    return tentativa;
  }

  /* ======================================================== Atividades == */
  function telaAtividades(visao) {
    const lista = Atividades.ordenarPorUrgencia(Dados.atividades());
    visao.innerHTML =
      Casca.cabecalho("Atividades publicadas",
        "Atividades publicadas pelos professores em todas as turmas.") +

      '<div class="grade-kpi">' +
        Casca.kpi({ rotulo: "Total publicado", valor: lista.length }) +
        Casca.kpi({ rotulo: "Prazo vencido", valor: lista.filter(a => N.diasAte(a.entrega) < 0).length, tom: "rubro" }) +
        Casca.kpi({ rotulo: "Próximos 7 dias", valor: lista.filter(a => { const d = N.diasAte(a.entrega); return d >= 0 && d <= 7; }).length, tom: "ambar" }) +
        Casca.kpi({ rotulo: "Prioridade alta", valor: lista.filter(a => a.prioridade === "alta").length, tom: "roxo" }) +
      "</div>" +

      (lista.length
        ? '<div class="lista-atividades">' + lista.map(a => Atividades.cartao(a, { modo: "gestor" })).join("") + "</div>"
        : '<section class="cartao">' + Casca.vazio("Nenhuma atividade publicada", "Assim que um professor publicar, ela aparece aqui.", "prancheta") + "</section>");

    delegar(visao, "click", "[data-anexo]", function (e, a) {
      e.preventDefault();
      Atividades.abrirVisor(a.dataset.anexo);
    });
  }

  /* ========================================================== Registro == */
  function telaRegistro(visao) {
    const todos = Dados.estado().registro;
    const tipos = [
      { id: "todos", rotulo: "Todos" },
      { id: "criacao", rotulo: "Criações" },
      { id: "lancamento", rotulo: "Lançamentos" },
      { id: "alteracao", rotulo: "Alterações" },
      { id: "remocao", rotulo: "Exclusões" }
    ];
    const lista = filtros.registro === "todos" ? todos : todos.filter(r => r.tipo === filtros.registro);

    visao.innerHTML =
      Casca.cabecalho("Registro de operações",
        "Histórico de lançamentos, alterações e cadastros.") +

      Casca.cartao({
        titulo: "Últimos eventos",
        sub: lista.length + " de " + todos.length + " registros",
        acao: '<div class="filtros">' + tipos.map(t =>
          '<button class="chip" data-tipo="' + t.id + '" aria-pressed="' + (filtros.registro === t.id) + '">' +
          t.rotulo + '<span class="cont">' +
          (t.id === "todos" ? todos.length : todos.filter(r => r.tipo === t.id).length) + "</span></button>").join("") + "</div>",
        corpo: lista.length ? '<div class="registro">' + lista.map(eventoHtml).join("") + "</div>"
          : Casca.vazio("Sem registros neste filtro", "Escolha outro tipo de evento.", "lista")
      });

    delegar(visao, "click", "[data-tipo]", function (e, b) {
      filtros.registro = b.dataset.tipo;
      telaRegistro(visao);
    });
  }

  function eventoHtml(r) {
    return '<div class="evento" data-tipo="' + esc(r.tipo) + '">' +
      '<div class="ponto"></div>' +
      "<div><b>" + esc(r.acao) + "</b><div>" + esc(r.detalhe) + "</div>" +
      '<div class="quem">' + esc(r.autorNome || "Sistema") + "</div></div>" +
      '<div class="quando">' + fmt.dataHora(r.quando) + "</div></div>";
  }

  /* ========================================================== Ajustes === */
  function telaAjustes(visao) {
    const cfg = c();
    visao.innerHTML =
      Casca.cabecalho("Configurações da escola",
        "Dados da escola, regras de avaliação e cópia de segurança.") +

      '<div class="grade-2">' +
        Casca.cartao({
          titulo: "Identificação da instituição",
          sub: "Aparece no cabeçalho do sistema e nos boletins impressos",
          corpo:
            '<div class="grade-campos">' +
              '<div class="campo largo"><label for="cEscola">Nome da escola</label>' +
                '<input class="entrada" id="cEscola" value="' + esc(cfg.escola) + '"></div>' +
              '<div class="campo"><label for="cSigla">Sigla</label>' +
                '<input class="entrada" id="cSigla" maxlength="6" value="' + esc(cfg.sigla) + '"></div>' +
              '<div class="campo"><label for="cInep">Código INEP</label>' +
                '<input class="entrada" id="cInep" value="' + esc(cfg.inep) + '"></div>' +
              '<div class="campo"><label for="cCidade">Município</label>' +
                '<input class="entrada" id="cCidade" value="' + esc(cfg.cidade) + '"></div>' +
              '<div class="campo"><label for="cUf">UF</label>' +
                '<input class="entrada" id="cUf" maxlength="2" value="' + esc(cfg.uf) + '"></div>' +
            "</div>",
          rodape: '<button class="btn btn-principal" id="btnSalvarEscola">' + Icone("salvar") + "<span>Salvar identificação</span></button>"
        }) +

        Casca.cartao({
          titulo: "Regras de avaliação",
          sub: "Valem para todos os componentes e turmas",
          corpo:
            '<div class="grade-campos">' +
              '<div class="campo"><label for="cAno">Ano letivo</label>' +
                '<input class="entrada" type="number" id="cAno" value="' + cfg.anoLetivo + '"></div>' +
              '<div class="campo"><label for="cBim">Bimestre em andamento</label>' +
                '<select class="selecao" id="cBim">' + [1, 2, 3, 4].map(b =>
                  '<option value="' + b + '"' + (b === cfg.bimestreAtual ? " selected" : "") + ">" + b + "º bimestre</option>").join("") +
                "</select></div>" +
              '<div class="campo"><label for="cMedia">Média mínima para aprovação</label>' +
                '<input class="entrada" type="number" step="0.5" min="0" max="10" id="cMedia" value="' + cfg.mediaMinima + '"></div>' +
              '<div class="campo"><label for="cRec">Nota mínima para recuperação</label>' +
                '<input class="entrada" type="number" step="0.5" min="0" max="10" id="cRec" value="' + cfg.mediaRecuperacao + '"></div>' +
            "</div>" +
            '<div class="aviso aviso-info topo-8">' + Icone("info") +
            "<div>Abaixo da nota de recuperação a situação é considerada crítica. " +
            "Os boletins usam estes valores no cálculo da situação.</div></div>",
          rodape: '<button class="btn btn-principal" id="btnSalvarRegras">' + Icone("salvar") + "<span>Salvar regras</span></button>"
        }) +
      "</div>" +

      '<div class="topo-20">' + Casca.cartao({
        titulo: "Turmas",
        sub: Dados.turmas().length + " turmas cadastradas",
        acao: '<button class="btn btn-neutro btn-p" id="btnNovaTurma">' + Icone("mais") + "<span>Nova turma</span></button>",
        justo: true,
        corpo: '<table class="tabela"><thead><tr><th>Turma</th><th>Etapa</th><th>Turno</th><th>Sala</th>' +
          '<th class="num">Estudantes</th><th></th></tr></thead><tbody>' +
          Dados.turmas().map(function (t) {
            const qtd = Dados.alunos({ turmaId: t.id }).length;
            return "<tr><td><b>" + esc(t.nome) + "</b></td><td>" + esc(Dados.etapaCurta(t.etapa)) + "</td>" +
              "<td>" + esc(t.turno) + "</td><td>" + esc(t.sala) + "</td>" +
              '<td class="num">' + qtd + "</td>" +
              '<td class="acoes"><button class="btn btn-icone" data-turma="' + t.id + '" title="Editar turma">' + Icone("lapis") + "</button>" +
              (qtd === 0 ? '<button class="btn btn-icone" data-excluir-turma="' + t.id + '" title="Excluir turma">' + Icone("lixeira") + "</button>" : "") +
              "</td></tr>";
          }).join("") + "</tbody></table>"
      }) + "</div>" +

      '<div class="topo-20">' + Casca.cartao({
        titulo: "Dados e manutenção",
        sub: "Cópia de segurança e restauração da base",
        corpo:
          '<div class="aviso aviso-alerta" style="margin-bottom:16px">' + Icone("alerta") +
          "<div><strong>Sobre os dados</strong>Os dados ficam gravados neste navegador. Limpar o histórico de navegação apaga a base. Mantenha uma cópia de segurança atualizada.</div></div>" +
          '<div class="linha-flex quebra">' +
            '<button class="btn btn-neutro" id="btnBackup">' + Icone("download") + "<span>Baixar cópia de segurança</span></button>" +
            '<button class="btn btn-neutro" id="btnRestaurar">' + Icone("upload") + "<span>Restaurar de um arquivo</span></button>" +
            '<button class="btn btn-perigo-suave" id="btnZerar">' + Icone("atualizar") + "<span>Voltar aos dados de demonstração</span></button>" +
          "</div>" +
          '<input type="file" id="arqRestaurar" accept="application/json" class="oculto">' +
          '<div class="pequeno texto-2 topo-14">Uso atual de anexos: ' +
          fmt.tamanho(Dados.Arquivos.bytesUsados()) + "</div>"
      }) + "</div>";

    $("#btnSalvarEscola").addEventListener("click", function () {
      const novo = {
        escola: $("#cEscola").value.trim() || cfg.escola,
        sigla: ($("#cSigla").value.trim() || cfg.sigla).toUpperCase(),
        inep: $("#cInep").value.trim(),
        cidade: $("#cCidade").value.trim(),
        uf: $("#cUf").value.trim().toUpperCase()
      };
      Dados.gravar(b => { Object.assign(b.config, novo); }, { tipo: "config" });
      Dados.registrar({ tipo: "alteracao", autorId: eu.id, acao: "Identificação alterada", detalhe: "Dados institucionais atualizados." });
      N.notificar({ titulo: "Identificação salva", texto: novo.escola, tipo: "ok" });
      setTimeout(() => location.reload(), 700);
    });

    $("#btnSalvarRegras").addEventListener("click", function () {
      const media = Number($("#cMedia").value);
      const rec = Number($("#cRec").value);
      if (isNaN(media) || media <= 0 || media > 10) { N.notificar({ texto: "Média mínima inválida.", tipo: "erro" }); return; }
      if (rec >= media) { N.notificar({ texto: "A nota de recuperação precisa ser menor que a média mínima.", tipo: "erro" }); return; }
      Dados.gravar(b => {
        b.config.anoLetivo = Number($("#cAno").value) || b.config.anoLetivo;
        b.config.bimestreAtual = Number($("#cBim").value);
        b.config.mediaMinima = media;
        b.config.mediaRecuperacao = rec;
      }, { tipo: "config" });
      Dados.registrar({
        tipo: "alteracao", autorId: eu.id, acao: "Regras de avaliação alteradas",
        detalhe: "Média mínima " + fmt.nota(media) + " · recuperação a partir de " + fmt.nota(rec) + "."
      });
      N.notificar({ titulo: "Regras salvas", texto: "Os boletins já refletem os novos valores.", tipo: "ok" });
      casca.recarregar();
    });

    $("#btnNovaTurma").addEventListener("click", () => formularioTurma(null));
    delegar(visao, "click", "[data-turma]", (e, b) => formularioTurma(Dados.turma(b.dataset.turma)));
    delegar(visao, "click", "[data-excluir-turma]", function (e, b) {
      const t = Dados.turma(b.dataset.excluirTurma);
      N.confirmar({ titulo: "Excluir turma", texto: "A turma " + t.nome + " será removida. Ela não tem estudantes matriculados.", perigo: true, rotuloOk: "Excluir" })
        .then(function (ok) {
          if (!ok) return;
          Dados.gravar(base => { base.turmas = base.turmas.filter(x => x.id !== t.id); }, { tipo: "turma" });
          Dados.registrar({ tipo: "remocao", autorId: eu.id, acao: "Turma excluída", detalhe: t.nome + " foi removida." });
          casca.recarregar();
        });
    });

    $("#btnBackup").addEventListener("click", function () {
      const nome = "omega-backup-" + N.hojeIso() + ".json";
      N.baixar(nome, Dados.exportar());
      N.notificar({ titulo: "Cópia gerada", texto: nome, tipo: "ok" });
    });
    $("#btnRestaurar").addEventListener("click", () => $("#arqRestaurar").click());
    $("#arqRestaurar").addEventListener("change", function () {
      const arq = this.files[0];
      if (!arq) return;
      const leitor = new FileReader();
      leitor.onload = function () {
        try {
          Dados.importar(leitor.result);
          N.notificar({ titulo: "Base restaurada", texto: "Recarregando…", tipo: "ok" });
          setTimeout(() => location.reload(), 800);
        } catch (erro) {
          N.notificar({ titulo: "Arquivo inválido", texto: erro.message, tipo: "erro" });
        }
      };
      leitor.readAsText(arq);
      this.value = "";
    });
    $("#btnZerar").addEventListener("click", function () {
      N.confirmar({
        titulo: "Voltar aos dados de demonstração",
        texto: "Todos os cadastros, notas e atividades criados serão apagados e substituídos pela base original.",
        rotuloOk: "Restaurar base", perigo: true
      }).then(function (ok) {
        if (!ok) return;
        Dados.reiniciar();
        N.notificar({ titulo: "Base restaurada", texto: "Recarregando…", tipo: "ok" });
        setTimeout(() => location.reload(), 800);
      });
    });
  }

  function formularioTurma(t) {
    const editando = !!t;
    const atual = t || { nome: "", etapa: "fundamental2", serie: 6, turno: "Matutino", sala: "" };
    const SERIES = {
      fundamental2: [6, 7, 8, 9].map(x => ({ v: x, r: x + "º ano" })),
      medio: [1, 2, 3].map(x => ({ v: x, r: x + "ª série" }))
    };
    N.abrirModal({
      titulo: editando ? "Editar turma" : "Nova turma",
      largura: "estreito",
      conteudo:
        '<div class="campo"><label for="tNome">Nome da turma <span class="obrig">*</span></label>' +
          '<input class="entrada" id="tNome" value="' + esc(atual.nome) + '" placeholder="Ex.: 1º ano B"></div>' +
        '<div class="campo"><label for="tEtapa">Etapa de ensino</label><select class="selecao" id="tEtapa">' +
          Object.keys(Dados.etapas()).map(k => '<option value="' + k + '"' + (k === atual.etapa ? " selected" : "") +
            ">" + esc(Dados.nomeEtapa(k)) + "</option>").join("") +
          '</select><span class="ajuda">Define a matriz curricular da turma.</span></div>' +
        '<div class="grade-campos">' +
          '<div class="campo"><label for="tSerie">Ano/série</label><select class="selecao" id="tSerie">' +
            SERIES[atual.etapa].map(s => '<option value="' + s.v + '"' + (s.v === atual.serie ? " selected" : "") + ">" + s.r + "</option>").join("") +
            "</select></div>" +
          '<div class="campo"><label for="tTurno">Turno</label><select class="selecao" id="tTurno">' +
            ["Matutino", "Vespertino", "Noturno", "Integral"].map(x => '<option' + (x === atual.turno ? " selected" : "") + ">" + x + "</option>").join("") +
            "</select></div>" +
        "</div>" +
        '<div class="campo"><label for="tSala">Sala</label>' +
          '<input class="entrada" id="tSala" value="' + esc(atual.sala) + '" placeholder="Ex.: Sala 12"></div>',
      aoAbrir: function (corpo) {
        corpo.querySelector("#tEtapa").addEventListener("change", function () {
          corpo.querySelector("#tSerie").innerHTML =
            SERIES[this.value].map(s => '<option value="' + s.v + '">' + s.r + "</option>").join("");
        });
      },
      acoes: [
        { rotulo: "Cancelar", classe: "btn-neutro", valor: "fechar" },
        { rotulo: "Salvar", classe: "btn-principal", icone: "check", aoClicar: function (e, api) {
          const nome = api.$("#tNome").value.trim();
          if (nome.length < 2) { N.notificar({ texto: "Informe o nome da turma.", tipo: "erro" }); return; }
          const campos = {
            nome: nome, etapa: api.$("#tEtapa").value, serie: Number(api.$("#tSerie").value),
            turno: api.$("#tTurno").value, sala: api.$("#tSala").value.trim() || "—"
          };
          Dados.gravar(function (b) {
            if (editando) Object.assign(b.turmas.find(x => x.id === t.id), campos);
            else b.turmas.push(Object.assign({ id: N.novoId("t") }, campos));
          }, { tipo: "turma" });
          Dados.registrar({
            tipo: editando ? "alteracao" : "criacao", autorId: eu.id,
            acao: editando ? "Turma atualizada" : "Turma criada", detalhe: nome + " — " + campos.turno + "."
          });
          N.fecharModal();
          casca.recarregar();
        } }
      ]
    });
  }
})();
