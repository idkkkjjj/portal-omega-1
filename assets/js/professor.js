/* ==========================================================================
   professor.js — telas do corpo docente: diario de classe, atividades e
   acompanhamento das turmas.
   ========================================================================== */
(function () {
  "use strict";

  const { $, $$, esc, fmt, Icone, delegar } = N;

  Dados.iniciar();
  const eu = Sessao.exigir("professor");
  if (!eu) return;

  const c = () => Dados.config();

  const minhasDisciplinas = () => (eu.disciplinas || []).map(id => Dados.disciplina(id)).filter(Boolean);
  const minhasTurmas = () => Dados.turmas().filter(t => !eu.turmas || eu.turmas.indexOf(t.id) > -1);

  /**
   * Componentes que EU leciono E que existem na matriz daquela turma.
   * Uma professora de Arte atende as duas etapas; uma de Ciências, só os Anos
   * Finais. É esse cruzamento que decide o que aparece no diário.
   */
  function minhasDisciplinasNaTurma(turmaId) {
    const daTurma = Dados.disciplinasDaTurma(turmaId).map(d => d.id);
    return minhasDisciplinas().filter(d => daTurma.indexOf(d.id) > -1);
  }

  let casca;
  let rotaAtual = "painel";
  const sel = {
    turma: (minhasTurmas()[0] || {}).id,
    disciplina: (eu.disciplinas || [])[0],
    turmaAtividades: "",
    turmaAlunos: (minhasTurmas()[0] || {}).id
  };

  /** Alteracoes ainda nao gravadas no diario de classe. */
  let pendentes = {};
  const temPendencias = () => Object.keys(pendentes).length > 0;

  /* ======================================================== Estrutura ==== */
  casca = Casca.montar({
    usuario: eu,
    rotuloPapel: "Corpo docente",
    itens: [
      { id: "painel", rotulo: "Meu painel", icone: "grade", tituloTopo: "Painel do professor" },
      { id: "diario", rotulo: "Diário de classe", icone: "livro", tituloTopo: "Lançamento de notas" },
      { id: "atividades", rotulo: "Atividades", icone: "prancheta", tituloTopo: "Minhas atividades" },
      { id: "turmas", rotulo: "Minhas turmas", icone: "usuarios", tituloTopo: "Turmas atendidas" }
    ],
    aoNavegar: function (id, args, visao) {
      if (temPendencias() && rotaAtual === "diario" && id !== "diario") {
        // Evita perder lançamentos digitados por engano ao trocar de tela.
        if (!confirm("Existem lançamentos não salvos no diário. Deseja sair mesmo assim?")) {
          location.hash = "#/diario";
          return;
        }
        pendentes = {};
      }
      rotaAtual = id;
      if (id === "diario" && args[0]) { sel.turma = args[0]; if (args[1]) sel.disciplina = args[1]; }
      const telas = { painel: telaPainel, diario: telaDiario, atividades: telaAtividades, turmas: telaTurmas };
      (telas[id] || telaPainel)(visao);
      contadores();
    }
  });

  function contadores() {
    casca.definirContador("atividades", Dados.atividades({ professorId: eu.id }).length);
  }

  const redesenhar = N.debounce(function () { casca.recarregar(); }, 180);
  Dados.assinar(function (info) {
    if (rotaAtual === "diario" && temPendencias()) {
      if (info.origem === "externo") {
        N.notificar({ titulo: "Dados alterados em outra tela", texto: "Salve ou descarte seus lançamentos para ver a versão mais recente.", tipo: "alerta", ms: 6000 });
      }
      return;
    }
    redesenhar();
  });

  window.addEventListener("beforeunload", function (e) {
    if (!temPendencias()) return;
    e.preventDefault();
    e.returnValue = "";
  });

  /* ------------------------------------------------------------ Apoio ---- */
  /** Notas do professor: apenas dos componentes que ele leciona. */
  function estatisticaMinha(turmaId) {
    const ids = (eu.disciplinas || []);
    const alunos = Dados.alunos(turmaId ? { turmaId: turmaId } : null)
      .filter(a => !eu.turmas || eu.turmas.indexOf(a.turmaId) > -1);
    const mapa = {}; alunos.forEach(a => { mapa[a.id] = true; });
    const notas = Dados.estado().notas.filter(n => mapa[n.alunoId] && ids.indexOf(n.disciplinaId) > -1);
    return { alunos: alunos, notas: notas, media: Dados.mediaDe(notas.map(n => n.valor)) };
  }

  /** Media de um aluno em um componente. */
  function mediaAlunoDisciplina(alunoId, disciplinaId) {
    const ns = Dados.notasDoAluno(alunoId).filter(n => n.disciplinaId === disciplinaId);
    return Dados.mediaDe(ns.map(n => n.valor));
  }

  /** Turmas x componentes que ainda faltam lancar no bimestre corrente. */
  function pendenciasDeLancamento() {
    const bim = c().bimestreAtual;
    const lista = [];
    minhasTurmas().forEach(function (t) {
      const alunos = Dados.alunos({ turmaId: t.id });
      if (!alunos.length) return;
      minhasDisciplinasNaTurma(t.id).forEach(function (d) {
        const faltam = alunos.filter(a => !Dados.nota(a.id, d.id, bim)).length;
        if (faltam) lista.push({ turma: t, disciplina: d, faltam: faltam, total: alunos.length });
      });
    });
    return lista.sort((a, b) => b.faltam - a.faltam);
  }

  /* =========================================================== Painel ==== */
  function telaPainel(visao) {
    const cfg = c();
    const est = estatisticaMinha(null);
    const atvs = Dados.atividades({ professorId: eu.id });
    const abertas = atvs.filter(a => N.diasAte(a.entrega) >= 0);
    const pend = pendenciasDeLancamento();
    const totalFaltam = pend.reduce((s, p) => s + p.faltam, 0);

    const emRisco = [];
    est.alunos.forEach(function (a) {
      minhasDisciplinasNaTurma(a.turmaId).forEach(function (d) {
        const m = mediaAlunoDisciplina(a.id, d.id);
        if (m !== null && m < cfg.mediaMinima) emRisco.push({ aluno: a, disciplina: d, media: m });
      });
    });
    emRisco.sort((x, y) => x.media - y.media);

    visao.innerHTML =
      Casca.cabecalho("Olá, " + N.primeiroNome(eu.nome),
        minhasDisciplinas().map(d => d.nome).join(" · ") + " · " +
        fmt.plural(minhasTurmas().length, "turma atendida", "turmas atendidas") + ".",
        '<button class="btn btn-neutro" id="btnIrDiario">' + Icone("livro") + "<span>Abrir diário</span></button>" +
        '<button class="btn btn-principal" id="btnNovaAtv">' + Icone("mais") + "<span>Nova atividade</span></button>") +

      '<div class="grade-kpi">' +
        Casca.kpi({ rotulo: "Estudantes atendidos", valor: est.alunos.length, nota: minhasTurmas().length + " turmas" }) +
        Casca.kpi({
          rotulo: "Média nos meus componentes", valor: fmt.nota(est.media),
          nota: est.notas.length + " lançamentos", tom: est.media >= cfg.mediaMinima ? "verde" : "ambar"
        }) +
        Casca.kpi({
          rotulo: "Notas a lançar", valor: totalFaltam,
          nota: "no " + cfg.bimestreAtual + "º bimestre", tom: totalFaltam ? "ambar" : "verde"
        }) +
        Casca.kpi({ rotulo: "Atividades com prazo aberto", valor: abertas.length, nota: atvs.length + " publicadas no total", tom: "roxo" }) +
      "</div>" +

      '<div class="grade-12-8" style="margin-bottom:16px">' +
        Casca.cartao({
          titulo: "Média por turma nos meus componentes",
          sub: "Linha tracejada: média mínima de " + fmt.nota(cfg.mediaMinima),
          corpo: '<div id="gTurmasProf"></div>'
        }) +
        Casca.cartao({
          titulo: "Pendências de lançamento",
          sub: cfg.bimestreAtual + "º bimestre",
          justo: true,
          corpo: pend.length
            ? '<table class="tabela tabela-compacta"><tbody>' + pend.map(function (p) {
                return '<tr class="linha-clicavel" data-lancar="' + p.turma.id + "|" + p.disciplina.id + '">' +
                  "<td><b>" + esc(p.turma.nome) + "</b><br>" +
                  '<span class="pequeno texto-2">' + esc(p.disciplina.nome) + "</span></td>" +
                  '<td class="num"><span class="selo selo-ambar">' + p.faltam + " de " + p.total + "</span></td>" +
                  '<td class="acoes">' + Icone("chevronDir") + "</td></tr>";
              }).join("") + "</tbody></table>"
            : Casca.vazio("Tudo lançado", "Não há notas pendentes no bimestre atual.", "checkCirculo")
        }) +
      "</div>" +

      '<div class="grade-2">' +
        Casca.cartao({
          titulo: "Estudantes abaixo da média",
          sub: emRisco.length + " situações nos meus componentes",
          justo: true,
          corpo: emRisco.length
            ? '<div class="rolagem-x"><table class="tabela"><thead><tr><th>Estudante</th><th>Turma</th>' +
              '<th>Componente</th><th class="num">Média</th></tr></thead><tbody>' +
              emRisco.slice(0, 12).map(function (r) {
                return "<tr><td>" + esc(r.aluno.nome) + "</td>" +
                  '<td class="pequeno texto-2">' + esc((Dados.turma(r.aluno.turmaId) || {}).nome) + "</td>" +
                  "<td>" + esc(r.disciplina.nome) + "</td>" +
                  '<td class="num" style="font-weight:700;color:' + Graficos.corPorNota(r.media, cfg.mediaMinima) + '">' +
                  fmt.nota(r.media) + "</td></tr>";
              }).join("") + "</tbody></table></div>"
            : Casca.vazio("Nenhum estudante abaixo da média", "Todos alcançaram " + fmt.nota(cfg.mediaMinima) + " ou mais nos seus componentes.", "checkCirculo")
        }) +
        Casca.cartao({
          titulo: "Próximas entregas",
          sub: "Atividades que você publicou",
          justo: true,
          corpo: abertas.length
            ? '<table class="tabela tabela-compacta"><tbody>' +
              Atividades.ordenarPorUrgencia(abertas).slice(0, 8).map(function (a) {
                const p = Atividades.prazo(a);
                const feitas = Dados.contarConclusoes(a.id);
                const total = Dados.alunos({ turmaId: a.turmaId }).length;
                return "<tr><td><b>" + esc(a.titulo) + "</b><br>" +
                  '<span class="pequeno texto-2">' + esc((Dados.turma(a.turmaId) || {}).nome) + " · " +
                  esc(p.texto) + "</span></td>" +
                  '<td class="num pequeno">' + feitas + "/" + total + "<br>" +
                  '<span class="texto-3">entregues</span></td></tr>';
              }).join("") + "</tbody></table>"
            : Casca.vazio("Nada em aberto", "Nenhuma atividade sua com prazo em aberto.", "prancheta")
        }) +
      "</div>";

    Graficos.barras($("#gTurmasProf"), {
      dados: minhasTurmas().map(function (t) {
        const e = estatisticaMinha(t.id);
        return { rotulo: t.nome, valor: e.media, detalhe: e.notas.length + " lançamentos" };
      }),
      max: cfg.notaMaxima, corPorValor: true, corte: { valor: cfg.mediaMinima },
      altura: 240, marcas: [0, 2, 4, 6, 8, 10]
    });

    $("#btnIrDiario").addEventListener("click", () => casca.irPara("diario"));
    $("#btnNovaAtv").addEventListener("click", novaAtividade);
    delegar(visao, "click", "[data-lancar]", function (e, tr) {
      const p = tr.dataset.lancar.split("|");
      sel.turma = p[0]; sel.disciplina = p[1];
      casca.irPara("diario");
    });
  }

  /* ==================================================== Diario de classe = */
  function telaDiario(visao) {
    const cfg = c();
    const turmas = minhasTurmas();
    if (!turmas.length) {
      visao.innerHTML = '<section class="cartao">' +
        Casca.vazio("Nenhuma turma vinculada", "Peça à gestão para vincular a sua conta às turmas.", "usuarios") + "</section>";
      return;
    }
    if (turmas.every(t => t.id !== sel.turma)) sel.turma = turmas[0].id;

    const disponiveis = minhasDisciplinasNaTurma(sel.turma);
    if (!disponiveis.length) {
      visao.innerHTML = '<section class="cartao">' + Casca.vazio("Sem componentes nesta turma",
        "Você não leciona nenhum componente da matriz de " + Dados.turma(sel.turma).nome + ".", "livro") + "</section>";
      return;
    }
    if (!disponiveis.some(d => d.id === sel.disciplina)) sel.disciplina = disponiveis[0].id;

    const turma = Dados.turma(sel.turma);
    const disc = Dados.disciplina(sel.disciplina);
    const alunos = Dados.alunos({ turmaId: sel.turma });

    const medias = alunos.map(a => mediaAlunoDisciplina(a.id, sel.disciplina)).filter(m => m !== null);
    const mediaTurma = Dados.mediaDe(medias);
    const abaixo = medias.filter(m => m < cfg.mediaMinima).length;

    visao.innerHTML =
      Casca.cabecalho("Diário de classe",
        "Digite a nota e pressione Tab para ir ao próximo campo. Nada é gravado até você salvar.",
        '<button class="btn btn-neutro" id="btnLimparCol">' + Icone("filtro") + "<span>Preencher coluna</span></button>") +

      '<div class="barra-lancamento">' +
        '<div><span class="rotulo">Turma</span>' +
          '<select class="selecao" id="dTurma">' + turmas.map(t =>
            '<option value="' + t.id + '"' + (t.id === sel.turma ? " selected" : "") + ">" + esc(t.nome) + " — " + esc(t.turno) + "</option>").join("") + "</select></div>" +
        '<div><span class="rotulo">Componente</span>' +
          '<select class="selecao" id="dDisciplina">' + disponiveis.map(d =>
            '<option value="' + d.id + '"' + (d.id === sel.disciplina ? " selected" : "") + ">" + esc(d.nome) + "</option>").join("") + "</select></div>" +
        '<span class="esticar"></span>' +
        '<div class="linha-flex" style="gap:22px">' +
          '<div><div class="pequeno texto-2 maiusc">Média da turma</div>' +
            '<div style="font-size:1.28rem;font-weight:700;color:' + Graficos.corPorNota(mediaTurma, cfg.mediaMinima) + '">' +
            fmt.nota(mediaTurma) + "</div></div>" +
          '<div><div class="pequeno texto-2 maiusc">Abaixo da média</div>' +
            '<div style="font-size:1.28rem;font-weight:700">' + abaixo + '<span class="pequeno texto-2"> / ' + alunos.length + "</span></div></div>" +
        "</div>" +
      "</div>" +

      Casca.cartao({
        titulo: turma.nome + " · " + disc.nome,
        sub: Dados.etapaCurta(turma.etapa) + " · " + alunos.length + " estudantes · escala de 0 a " + fmt.nota(cfg.notaMaxima) +
          " · o " + cfg.bimestreAtual + "º bimestre está em andamento",
        justo: true,
        corpo: alunos.length ? tabelaDiario(alunos) : Casca.vazio("Turma sem estudantes", "Nenhum estudante matriculado nesta turma.", "usuarios")
      }) +
      '<div id="barraSalvar"></div>';

    $("#dTurma").addEventListener("change", function () {
      if (!confirmarDescarte()) { this.value = sel.turma; return; }
      sel.turma = this.value; telaDiario(visao);
    });
    $("#dDisciplina").addEventListener("change", function () {
      if (!confirmarDescarte()) { this.value = sel.disciplina; return; }
      sel.disciplina = this.value; telaDiario(visao);
    });
    $("#btnLimparCol").addEventListener("click", preencherColuna);

    ligarCampos(visao, alunos);
    pintarBarraSalvar(visao, alunos);
  }

  function tabelaDiario(alunos) {
    const cfg = c();
    const bimAtual = cfg.bimestreAtual;
    return '<div class="rolagem-x"><table class="tabela tabela-fixa">' +
      '<thead><tr><th style="min-width:230px">Estudante</th>' +
      [1, 2, 3, 4].map(b => '<th class="centro"' + (b === bimAtual ? ' style="background:var(--marca-clara);color:var(--enlace)"' : "") + ">" +
        b + "º bim." + (b === bimAtual ? " ●" : "") + "</th>").join("") +
      '<th class="centro">Média</th><th>Situação</th></tr></thead><tbody>' +
      alunos.map(function (a, i) {
        const notas = [1, 2, 3, 4].map(b => Dados.nota(a.id, sel.disciplina, b));
        const valores = notas.filter(Boolean).map(n => n.valor);
        const m = Dados.mediaDe(valores);
        const sit = Dados.classificar(m, valores.length, 4);
        return '<tr data-aluno="' + a.id + '">' +
          '<td><div class="pessoa"><span class="pequeno texto-3" style="width:20px;text-align:right">' + (i + 1) + "</span>" +
          '<span class="avatar p roxo">' + N.iniciais(a.nome) + "</span>" +
          '<div><div class="nome">' + esc(a.nome) + '</div><div class="det">' + esc(a.matricula) + "</div></div></div></td>" +
          [1, 2, 3, 4].map(function (b) {
            const n = notas[b - 1];
            const cls = n ? (n.valor < cfg.mediaMinima ? "baixa" : "boa") : "";
            return '<td class="centro"><input class="nota-in ' + cls + '" type="text" inputmode="decimal" ' +
              'value="' + (n ? fmt.nota(n.valor) : "") + '" data-aluno="' + a.id + '" data-bim="' + b + '" ' +
              'aria-label="' + esc(a.nome) + ", " + b + 'º bimestre"' +
              (n ? ' title="Lançada em ' + fmt.dataHora(n.lancadoEm) + '"' : "") + "></td>";
          }).join("") +
          '<td class="centro" data-media style="font-weight:700;color:' + Graficos.corPorNota(m, cfg.mediaMinima) + '">' +
          fmt.nota(m) + "</td>" +
          "<td data-situacao>" + Casca.selo(sit) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /* Edicao em lote --------------------------------------------------------- */
  function chave(alunoId, bim) { return alunoId + "|" + sel.disciplina + "|" + bim; }

  function ligarCampos(visao, alunos) {
    const cfg = c();
    const campos = $$(".nota-in", visao);
    const colunas = 4;

    campos.forEach(function (campo, i) {
      campo.addEventListener("focus", () => campo.select());

      campo.addEventListener("keydown", function (e) {
        let destino = null;
        if (e.key === "Enter" || e.key === "ArrowDown") destino = i + colunas;
        if (e.key === "ArrowUp") destino = i - colunas;
        if (destino !== null && campos[destino]) { e.preventDefault(); campos[destino].focus(); }
        if (e.key === "Escape") { campo.blur(); }
      });

      campo.addEventListener("input", function () {
        const bruto = campo.value.trim().replace(",", ".");
        const original = Dados.nota(campo.dataset.aluno, sel.disciplina, Number(campo.dataset.bim));
        const originalTxt = original ? fmt.nota(original.valor) : "";

        if (bruto !== "" && (isNaN(Number(bruto)) || Number(bruto) < 0 || Number(bruto) > cfg.notaMaxima)) {
          campo.classList.add("baixa");
          campo.setCustomValidity && campo.setCustomValidity("inválido");
          return;
        }

        const k = chave(campo.dataset.aluno, campo.dataset.bim);
        if (campo.value.trim() === originalTxt) delete pendentes[k];
        else pendentes[k] = { alunoId: campo.dataset.aluno, bimestre: Number(campo.dataset.bim), valor: bruto === "" ? null : Number(bruto) };

        campo.classList.toggle("alterada", !!pendentes[k]);
        atualizarLinha(campo.closest("tr"));
        pintarBarraSalvar(visao, alunos);
      });
    });
  }

  /** Recalcula media e situacao da linha usando os valores que estao na tela. */
  function atualizarLinha(tr) {
    const cfg = c();
    const valores = $$(".nota-in", tr)
      .map(i => i.value.trim().replace(",", "."))
      .filter(v => v !== "" && !isNaN(Number(v)))
      .map(Number);
    const m = Dados.mediaDe(valores);
    const celMedia = tr.querySelector("[data-media]");
    celMedia.textContent = fmt.nota(m);
    celMedia.style.color = Graficos.corPorNota(m, cfg.mediaMinima);
    tr.querySelector("[data-situacao]").innerHTML = Casca.selo(Dados.classificar(m, valores.length, 4));
    $$(".nota-in", tr).forEach(function (i) {
      const v = Number(i.value.trim().replace(",", "."));
      i.classList.toggle("baixa", i.value.trim() !== "" && v < cfg.mediaMinima);
      i.classList.toggle("boa", i.value.trim() !== "" && v >= cfg.mediaMinima);
    });
  }

  function pintarBarraSalvar(visao, alunos) {
    const area = $("#barraSalvar", visao);
    if (!area) return;
    const qtd = Object.keys(pendentes).length;
    if (!qtd) { area.innerHTML = ""; return; }
    area.innerHTML = '<div class="rodape-fixo sem-impressao">' +
      '<div class="aviso-alteracoes">' + Icone("alerta") + " <b>" + qtd + "</b> " +
      (qtd === 1 ? "lançamento não salvo" : "lançamentos não salvos") + " neste diário.</div>" +
      '<div class="linha-flex">' +
        '<button class="btn btn-neutro" id="btnDescartar">Descartar</button>' +
        '<button class="btn btn-principal" id="btnSalvarNotas">' + Icone("salvar") + "<span>Salvar lançamentos</span></button>" +
      "</div></div>";

    $("#btnDescartar").addEventListener("click", function () {
      pendentes = {};
      telaDiario(visao);
      N.notificar({ texto: "Alterações descartadas.", tipo: "info" });
    });
    $("#btnSalvarNotas").addEventListener("click", () => salvarLancamentos(visao, alunos));
  }

  function salvarLancamentos(visao) {
    const lista = Object.keys(pendentes).map(k => pendentes[k]);
    if (!lista.length) return;
    const disc = Dados.disciplina(sel.disciplina);
    const turma = Dados.turma(sel.turma);
    let novas = 0, alteradas = 0, removidas = 0;

    lista.forEach(function (item) {
      const anterior = Dados.nota(item.alunoId, sel.disciplina, item.bimestre);
      const valorAnterior = anterior ? anterior.valor : null;

      const op = Dados.lancarNota({
        alunoId: item.alunoId, disciplinaId: sel.disciplina, bimestre: item.bimestre,
        valor: item.valor, autorId: eu.id, registrar: false
      });

      if (op === "criada") novas += 1;
      if (op === "removida") removidas += 1;
      if (op === "alterada") {
        alteradas += 1;
        // Correcao de nota ja existente e registrada individualmente: e o que
        // a gestao precisa conseguir auditar depois.
        Dados.registrar({
          tipo: "alteracao", autorId: eu.id, acao: "Alteração de nota",
          detalhe: "Nota de " + Dados.nomeUsuario(item.alunoId) + " em " + disc.nome + " (" +
            item.bimestre + "º bimestre) alterada de " + fmt.nota(valorAnterior) + " para " + fmt.nota(item.valor) + "."
        });
      }
    });

    if (novas || removidas) {
      Dados.registrar({
        tipo: removidas && !novas ? "remocao" : "lancamento", autorId: eu.id,
        acao: "Lançamento no diário",
        detalhe: turma.nome + " · " + disc.nome + ": " +
          (novas ? novas + (novas === 1 ? " nota lançada" : " notas lançadas") : "") +
          (novas && removidas ? " e " : "") +
          (removidas ? removidas + (removidas === 1 ? " nota removida" : " notas removidas") : "") + "."
      });
    }

    pendentes = {};
    N.notificar({
      titulo: "Diário salvo",
      texto: [novas ? novas + " novas" : "", alteradas ? alteradas + " alteradas" : "", removidas ? removidas + " removidas" : ""]
        .filter(Boolean).join(" · ") + ".",
      tipo: "ok", ms: 5000
    });
    telaDiario(visao);
  }

  function confirmarDescarte() {
    if (!temPendencias()) return true;
    const ok = confirm("Existem lançamentos não salvos. Trocar a seleção vai descartá-los. Continuar?");
    if (ok) pendentes = {};
    return ok;
  }

  /** Aplica o mesmo valor em toda a coluna de um bimestre (util em prova única). */
  function preencherColuna() {
    const cfg = c();
    N.abrirModal({
      titulo: "Preencher coluna",
      subtitulo: Dados.turma(sel.turma).nome + " · " + Dados.disciplina(sel.disciplina).nome,
      largura: "estreito",
      conteudo:
        '<p class="medio texto-2">Aplica a mesma nota a todos os estudantes da turma no bimestre escolhido.</p>' +
        '<div class="grade-campos topo-14">' +
          '<div class="campo"><label for="pcBim">Bimestre</label><select class="selecao" id="pcBim">' +
            [1, 2, 3, 4].map(b => '<option value="' + b + '"' + (b === cfg.bimestreAtual ? " selected" : "") + ">" + b + "º bimestre</option>").join("") +
          "</select></div>" +
          '<div class="campo"><label for="pcValor">Nota</label>' +
            '<input class="entrada" id="pcValor" inputmode="decimal" placeholder="Ex.: 7,0"></div>' +
        "</div>" +
        '<label class="caixa-marcar topo-8"><input type="checkbox" id="pcVazios" checked>' +
        "<span>Preencher apenas os campos ainda vazios</span></label>",
      acoes: [
        { rotulo: "Cancelar", classe: "btn-neutro", valor: "fechar" },
        { rotulo: "Aplicar na coluna", classe: "btn-principal", aoClicar: function (e, api) {
          const bim = Number(api.$("#pcBim").value);
          const bruto = api.$("#pcValor").value.trim().replace(",", ".");
          const v = Number(bruto);
          if (bruto === "" || isNaN(v) || v < 0 || v > cfg.notaMaxima) {
            N.notificar({ texto: "Informe uma nota entre 0 e " + fmt.nota(cfg.notaMaxima) + ".", tipo: "erro" });
            return;
          }
          const soVazios = api.$("#pcVazios").checked;
          $$('.nota-in[data-bim="' + bim + '"]').forEach(function (campo) {
            if (soVazios && campo.value.trim() !== "") return;
            campo.value = fmt.nota(v);
            campo.dispatchEvent(new Event("input", { bubbles: true }));
          });
          N.fecharModal();
          N.notificar({ texto: "Coluna preenchida. Revise e salve o diário.", tipo: "info" });
        } }
      ]
    });
  }

  /* ======================================================== Atividades == */
  function telaAtividades(visao) {
    const todas = Dados.atividades({ professorId: eu.id });
    const lista = Atividades.ordenarPorUrgencia(
      sel.turmaAtividades ? todas.filter(a => a.turmaId === sel.turmaAtividades) : todas
    );

    visao.innerHTML =
      Casca.cabecalho("Minhas atividades",
        "Atividades das suas turmas, com prazo, pontuação e anexos.",
        '<button class="btn btn-principal" id="btnNovaAtv">' + Icone("mais") + "<span>Nova atividade</span></button>") +

      '<div class="barra-lancamento">' +
        '<span class="rotulo" style="margin:0">Turma</span>' +
        '<select class="selecao" id="aTurmaFiltro">' +
          '<option value="">Todas as minhas turmas</option>' +
          minhasTurmas().map(t => '<option value="' + t.id + '"' + (t.id === sel.turmaAtividades ? " selected" : "") + ">" +
            esc(t.nome) + "</option>").join("") + "</select>" +
        '<span class="esticar"></span>' +
        '<span class="pequeno texto-2">' + lista.length + " atividades · " +
        lista.filter(a => N.diasAte(a.entrega) < 0).length + " com prazo vencido</span>" +
      "</div>" +

      (lista.length
        ? '<div class="lista-atividades">' + lista.map(a => Atividades.cartao(a, { modo: "professor" })).join("") + "</div>"
        : '<section class="cartao">' + Casca.vazio("Nenhuma atividade publicada",
            "Use o botão “Nova atividade” para publicar a primeira.", "prancheta") + "</section>");

    $("#btnNovaAtv").addEventListener("click", novaAtividade);
    $("#aTurmaFiltro").addEventListener("change", function () {
      sel.turmaAtividades = this.value;
      telaAtividades(visao);
    });

    delegar(visao, "click", "[data-editar]", function (e, b) {
      Atividades.formulario({
        atividade: Dados.atividade(b.dataset.editar), professor: eu,
        aoSalvar: () => casca.recarregar()
      });
    });
    delegar(visao, "click", "[data-excluir]", function (e, b) {
      const a = Dados.atividade(b.dataset.excluir);
      N.confirmar({
        titulo: "Excluir atividade",
        texto: '"' + a.titulo + '" será removida do mural da turma, junto com os anexos e as marcações de entrega.',
        rotuloOk: "Excluir", perigo: true
      }).then(function (ok) {
        if (!ok) return;
        Dados.excluirAtividade(a.id, eu.id);
        N.notificar({ texto: "Atividade excluída.", tipo: "ok" });
        casca.recarregar();
      });
    });
    delegar(visao, "click", "[data-anexo]", function (e, a) {
      e.preventDefault();
      Atividades.abrirVisor(a.dataset.anexo);
    });
  }

  function novaAtividade() {
    Atividades.formulario({
      professor: eu,
      aoSalvar: function () { casca.irPara("atividades"); casca.recarregar(); }
    });
  }

  /* =========================================================== Turmas === */
  function telaTurmas(visao) {
    const cfg = c();
    const turmas = minhasTurmas();
    if (turmas.every(t => t.id !== sel.turmaAlunos)) sel.turmaAlunos = (turmas[0] || {}).id;
    const turma = Dados.turma(sel.turmaAlunos);
    const alunos = turma ? Dados.alunos({ turmaId: turma.id }) : [];
    const discs = turma ? minhasDisciplinasNaTurma(turma.id) : [];

    visao.innerHTML =
      Casca.cabecalho("Minhas turmas",
        "Notas e médias dos estudantes nos componentes que você leciona.") +

      '<div class="barra-lancamento">' +
        '<span class="rotulo" style="margin:0">Turma</span>' +
        '<select class="selecao" id="tSel">' + turmas.map(t =>
          '<option value="' + t.id + '"' + (t.id === sel.turmaAlunos ? " selected" : "") + ">" +
          esc(t.nome) + " — " + esc(Dados.etapaCurta(t.etapa)) + " · " + esc(t.sala) + "</option>").join("") + "</select>" +
        '<span class="esticar"></span>' +
        '<span class="pequeno texto-2">' + alunos.length + " estudantes matriculados</span>" +
      "</div>" +

      Casca.cartao({
        titulo: turma ? turma.nome : "—",
        sub: (turma ? Dados.etapaCurta(turma.etapa) + " · " : "") +
          (discs.length ? discs.map(d => d.nome).join(" · ") : "nenhum componente seu nesta matriz"),
        justo: true,
        corpo: alunos.length
          ? '<div class="rolagem-x"><table class="tabela"><thead><tr><th>Estudante</th>' +
            discs.map(d => '<th class="centro">' + esc(d.sigla) + "</th>").join("") +
            '<th class="centro">Média nos meus componentes</th><th>Situação</th></tr></thead><tbody>' +
            alunos.map(function (a) {
              const medias = discs.map(d => mediaAlunoDisciplina(a.id, d.id));
              const validas = medias.filter(m => m !== null);
              const geral = Dados.mediaDe(validas);
              return "<tr><td>" +
                '<div class="pessoa"><span class="avatar p roxo">' + N.iniciais(a.nome) + "</span>" +
                '<div><div class="nome">' + esc(a.nome) + '</div><div class="det">' + esc(a.matricula) + "</div></div></div></td>" +
                medias.map(m => '<td class="centro" style="font-variant-numeric:tabular-nums;font-weight:600;color:' +
                  Graficos.corPorNota(m, cfg.mediaMinima) + '">' + fmt.nota(m) + "</td>").join("") +
                '<td class="centro" style="font-weight:700;color:' + Graficos.corPorNota(geral, cfg.mediaMinima) + '">' +
                fmt.nota(geral) + "</td>" +
                "<td>" + Casca.selo(Dados.classificar(geral, validas.length ? 4 : 0, 4)) + "</td></tr>";
            }).join("") + "</tbody></table></div>"
          : Casca.vazio("Turma vazia", "Nenhum estudante matriculado nesta turma.", "usuarios")
      });

    const s = $("#tSel");
    if (s) s.addEventListener("change", function () { sel.turmaAlunos = this.value; telaTurmas(visao); });
  }
})();
