/* ==========================================================================
   atividades.js — cartao de atividade, formulario de publicacao e anexos.
   Compartilhado pelas telas do professor, do aluno e da gestao.
   ========================================================================== */
(function (global) {
  "use strict";

  const { esc, fmt, Icone, $ } = N;

  const PRIORIDADES = {
    alta:  { rotulo: "Prioridade alta",  curto: "Alta",  classe: "selo-rubro", peso: 0 },
    media: { rotulo: "Prioridade média", curto: "Média", classe: "selo-ambar", peso: 1 },
    baixa: { rotulo: "Prioridade baixa", curto: "Baixa", classe: "selo-azul",  peso: 2 }
  };

  /** Traduz a data de entrega em texto de urgencia. */
  function prazo(atividade) {
    const d = N.diasAte(atividade.entrega);
    if (d === null) return { dias: null, n: "—", u: "sem prazo", classe: "", texto: "Sem prazo definido" };
    if (d < 0) {
      const n = Math.abs(d);
      return { dias: d, n: n, u: n === 1 ? "dia em atraso" : "dias em atraso", classe: "atrasada", texto: "Atrasada há " + fmt.plural(n, "dia", "dias") };
    }
    if (d === 0) return { dias: 0, n: "hoje", u: "é o prazo", classe: "hoje", texto: "A entrega é hoje" };
    if (d === 1) return { dias: 1, n: 1, u: "dia restante", classe: "hoje", texto: "Entrega amanhã" };
    return { dias: d, n: d, u: "dias restantes", classe: "", texto: "Faltam " + fmt.plural(d, "dia", "dias") };
  }

  /**
   * Ordena por urgencia real: primeiro o que esta atrasado, depois o prazo
   * mais proximo e, em caso de empate, a prioridade definida pelo professor.
   */
  function ordenarPorUrgencia(lista) {
    return lista.slice().sort(function (a, b) {
      const pa = prazo(a), pb = prazo(b);
      const atrasoA = pa.dias < 0 ? 0 : 1;
      const atrasoB = pb.dias < 0 ? 0 : 1;
      if (atrasoA !== atrasoB) return atrasoA - atrasoB;
      if (pa.dias !== pb.dias) return pa.dias - pb.dias;
      return PRIORIDADES[a.prioridade].peso - PRIORIDADES[b.prioridade].peso;
    });
  }

  /* ------------------------------------------------------------- Anexos -- */
  function miniatura(ref) {
    const arq = Dados.Arquivos.obter(ref.id);
    if (arq && arq.imagem) {
      return '<img class="mini" src="' + arq.dados + '" alt="">';
    }
    return '<span class="mini">' + Icone("arquivo") + "</span>";
  }

  function anexosHtml(atividade, comRemover) {
    const lista = atividade.anexos || [];
    if (!lista.length && !atividade.link) return "";
    let html = '<div class="anexos">';
    lista.forEach(function (ref) {
      html += '<a class="anexo" href="#" data-anexo="' + ref.id + '">' +
        miniatura(ref) +
        '<span class="truncar"><span class="nm truncar">' + esc(ref.nome) + "</span>" +
        '<span class="tm">' + fmt.tamanho(ref.tamanho) + "</span></span>" +
        (comRemover ? '<button type="button" class="tirar" data-remover="' + ref.id + '" aria-label="Remover anexo">' + Icone("x") + "</button>" : "") +
        "</a>";
    });
    if (atividade.link) {
      html += '<a class="anexo" href="' + esc(atividade.link) + '" target="_blank" rel="noopener">' +
        '<span class="mini">' + Icone("externo") + "</span>" +
        '<span class="truncar"><span class="nm truncar">Material externo</span>' +
        '<span class="tm truncar">' + esc(atividade.link.replace(/^https?:\/\//, "").slice(0, 34)) + "</span></span></a>";
    }
    return html + "</div>";
  }

  /** Visualizador de imagem em tela cheia. */
  function abrirVisor(idArquivo) {
    const arq = Dados.Arquivos.obter(idArquivo);
    if (!arq) { N.notificar({ texto: "Anexo não encontrado.", tipo: "erro" }); return; }
    if (!arq.imagem) {
      const a = document.createElement("a");
      a.href = arq.dados; a.download = arq.nome;
      document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    const visor = document.createElement("div");
    visor.className = "visor-imagem";
    visor.innerHTML = '<button class="fechar-visor" aria-label="Fechar">&times;</button>' +
      '<img src="' + arq.dados + '" alt="' + esc(arq.nome) + '">';
    visor.addEventListener("click", function (e) {
      if (e.target === visor || e.target.classList.contains("fechar-visor")) visor.remove();
    });
    document.addEventListener("keydown", function fechar(e) {
      if (e.key === "Escape") { visor.remove(); document.removeEventListener("keydown", fechar); }
    });
    document.body.appendChild(visor);
  }

  /* ------------------------------------------------------------- Cartao -- */
  /**
   * opcoes = { modo:"aluno"|"professor"|"gestor", alunoId, mostrarTurma }
   */
  function cartao(atividade, opcoes) {
    const o = opcoes || {};
    const disc = Dados.disciplina(atividade.disciplinaId);
    const turma = Dados.turma(atividade.turmaId);
    const prof = Dados.usuario(atividade.professorId);
    const p = prazo(atividade);
    const prio = PRIORIDADES[atividade.prioridade] || PRIORIDADES.media;
    const feita = o.modo === "aluno" && o.alunoId ? Dados.concluida(atividade.id, o.alunoId) : false;

    const totalTurma = Dados.alunos({ turmaId: atividade.turmaId }).length;
    const feitas = Dados.contarConclusoes(atividade.id);

    let lateral = '<div class="contagem-prazo ' + (feita ? "" : p.classe) + '">' +
      '<div class="n">' + p.n + '</div><div class="u">' + esc(p.u) + "</div></div>";

    if (o.modo === "aluno") {
      lateral += '<button class="btn ' + (feita ? "btn-neutro" : "btn-principal") + ' btn-p" data-concluir="' + atividade.id + '">' +
        Icone(feita ? "atualizar" : "check") + "<span>" + (feita ? "Reabrir" : "Marcar entregue") + "</span></button>";
    } else if (o.modo === "professor") {
      lateral += '<div class="linha-flex" style="gap:4px">' +
        '<button class="btn btn-icone" data-editar="' + atividade.id + '" title="Editar atividade">' + Icone("lapis") + "</button>" +
        '<button class="btn btn-icone" data-excluir="' + atividade.id + '" title="Excluir atividade">' + Icone("lixeira") + "</button>" +
        "</div>";
    }

    return '<article class="atividade' + (feita ? " concluida" : "") + '" data-prio="' + atividade.prioridade +
      '" data-id="' + atividade.id + '">' +
      '<div class="faixa-prio"></div>' +
      '<div class="miolo">' +
        '<div class="topo-atv">' +
          '<div class="esticar">' +
            '<div class="titulo-atv">' + esc(atividade.titulo) + "</div>" +
            '<div class="disciplina-atv">' + esc(disc ? disc.nome : "—") +
              (o.mostrarTurma !== false ? " · " + esc(turma ? turma.nome : "—") : "") +
              (prof ? " · Prof. " + esc(N.primeiroNome(prof.nome)) + " " + esc(prof.nome.split(" ").pop()) : "") +
            "</div>" +
          "</div>" +
          '<span class="selo ' + prio.classe + '">' + prio.curto + "</span>" +
          (feita ? '<span class="selo selo-verde">Entregue</span>' : "") +
        "</div>" +
        (atividade.descricao ? '<p class="descricao-atv">' + esc(atividade.descricao) + "</p>" : "") +
        anexosHtml(atividade) +
        '<div class="rodape-atv">' +
          '<span class="dado">' + Icone("calendario") + "Entrega " + fmt.data(atividade.entrega) +
            " (" + fmt.diaSemana(atividade.entrega) + ")</span>" +
          (atividade.pontuacao ? '<span class="dado">' + Icone("estrela") + "Vale " + fmt.decimal(atividade.pontuacao) + " pontos</span>" : "") +
          (o.modo !== "aluno" && totalTurma
            ? '<span class="dado">' + Icone("checkCirculo") + feitas + " de " + totalTurma + " concluíram</span>"
            : "") +
          '<span class="dado">' + Icone("relogio") + "Publicada " + fmt.relativo(atividade.criadoEm) + "</span>" +
        "</div>" +
      "</div>" +
      '<div class="lateral-atv sem-impressao">' + lateral + "</div>" +
      "</article>";
  }

  /* --------------------------------------------------------- Formulario -- */
  /**
   * cfg = { atividade (opcional), professor, aoSalvar }
   */
  function formulario(cfg) {
    const editando = !!cfg.atividade;
    const atv = cfg.atividade || {
      titulo: "", descricao: "", disciplinaId: cfg.professor.disciplinas[0],
      turmaId: (cfg.professor.turmas && cfg.professor.turmas[0]) || Dados.turmas()[0].id,
      prioridade: "media", pontuacao: "", entrega: "", anexos: [], link: ""
    };
    // Copia de trabalho: so vai para a base quando o usuario salvar.
    let anexos = (atv.anexos || []).slice();

    const turmasDoProf = Dados.turmas().filter(function (t) {
      return cfg.professor.papel !== "professor" || !cfg.professor.turmas || cfg.professor.turmas.indexOf(t.id) > -1;
    });
    if (turmasDoProf.every(t => t.id !== atv.turmaId)) atv.turmaId = (turmasDoProf[0] || {}).id;

    /**
     * Componentes válidos para a turma escolhida: a matriz muda entre Anos
     * Finais e Ensino Médio, então o seletor é remontado a cada troca de turma.
     */
    function disciplinasValidas(turmaId) {
      return Dados.disciplinasDaTurma(turmaId).filter(function (d) {
        return cfg.professor.papel !== "professor" || cfg.professor.disciplinas.indexOf(d.id) > -1;
      });
    }

    function opcoesDisciplina(turmaId, selecionado) {
      const lista = disciplinasValidas(turmaId);
      if (!lista.length) return '<option value="">Nenhum componente seu nesta turma</option>';
      const alvo = lista.some(d => d.id === selecionado) ? selecionado : lista[0].id;
      return lista.map(d => '<option value="' + d.id + '"' + (d.id === alvo ? " selected" : "") +
        ">" + esc(d.nome) + "</option>").join("");
    }

    const html =
      '<div class="campo"><label for="fTitulo">Título da atividade <span class="obrig">*</span></label>' +
        '<input class="entrada" id="fTitulo" maxlength="120" value="' + esc(atv.titulo) + '" ' +
        'placeholder="Ex.: Lista 07 — funções do 2º grau"></div>' +

      '<div class="grade-campos">' +
        '<div class="campo"><label for="fDisciplina">Componente curricular <span class="obrig">*</span></label>' +
          '<select class="selecao" id="fDisciplina">' +
          opcoesDisciplina(atv.turmaId, atv.disciplinaId) +
          "</select></div>" +
        '<div class="campo"><label for="fTurma">Turma <span class="obrig">*</span></label>' +
          '<select class="selecao" id="fTurma">' +
          turmasDoProf.map(t => '<option value="' + t.id + '"' + (t.id === atv.turmaId ? " selected" : "") + ">" + esc(t.nome) + " — " + esc(Dados.etapaCurta(t.etapa)) + "</option>").join("") +
          "</select></div>" +
        '<div class="campo"><label for="fEntrega">Data de entrega <span class="obrig">*</span></label>' +
          '<input class="entrada" type="date" id="fEntrega" value="' + esc(atv.entrega) + '"></div>' +
        '<div class="campo"><label for="fPontos">Valor em pontos</label>' +
          '<input class="entrada" type="number" id="fPontos" min="0" max="10" step="0.5" ' +
          'value="' + (atv.pontuacao === null || atv.pontuacao === undefined ? "" : atv.pontuacao) + '" placeholder="Opcional">' +
          '<span class="ajuda">Deixe em branco se a atividade não valer nota.</span></div>' +
      "</div>" +

      '<div class="campo"><span class="rotulo">Prioridade</span>' +
        '<div class="segmentado" id="fPrioridade" role="group">' +
        Object.keys(PRIORIDADES).map(function (k) {
          return '<button type="button" data-prio="' + k + '" aria-pressed="' + (atv.prioridade === k) + '">' +
            PRIORIDADES[k].curto + "</button>";
        }).join("") + "</div>" +
        '<span class="ajuda">Define a cor e a ordem de exibição no mural dos estudantes.</span></div>' +

      '<div class="campo"><label for="fDescricao">Orientações para a turma</label>' +
        '<textarea class="area" id="fDescricao" maxlength="900" ' +
        'placeholder="O que precisa ser feito, formato de entrega, critérios de correção…">' + esc(atv.descricao) + "</textarea></div>" +

      '<div class="campo"><label for="fLink">Link de apoio</label>' +
        '<input class="entrada" type="url" id="fLink" value="' + esc(atv.link || "") + '" placeholder="https://…"></div>' +

      '<div class="campo"><span class="rotulo">Anexos</span>' +
        '<div class="solta-arquivo" id="fSolta" tabindex="0" role="button">' +
          Icone("upload") +
          "<strong>Clique para escolher ou arraste os arquivos aqui</strong>" +
          "<span>Imagens até " + Dados.LIMITE_ANEXOS_ATIVIDADE + " arquivos. Fotos são reduzidas automaticamente.</span>" +
        "</div>" +
        '<input type="file" id="fArquivo" multiple accept="image/*,.pdf,.txt" class="oculto">' +
        '<div id="fListaAnexos"></div></div>';

    const api = N.abrirModal({
      titulo: editando ? "Editar atividade" : "Nova atividade",
      subtitulo: editando ? atv.titulo : "A turma recebe a publicação imediatamente.",
      largura: "largo",
      conteudo: html,
      acoes: [
        { rotulo: "Cancelar", classe: "btn-neutro", valor: "fechar" },
        { rotulo: editando ? "Salvar alterações" : "Publicar atividade", classe: "btn-principal", icone: "check", aoClicar: salvar }
      ]
    });

    /* turma -> componentes ---------------------------------------------- */
    api.$("#fTurma").addEventListener("change", function () {
      api.$("#fDisciplina").innerHTML = opcoesDisciplina(this.value, api.$("#fDisciplina").value);
    });

    /* prioridade -------------------------------------------------------- */
    let prioridade = atv.prioridade;
    N.delegar(api.$("#fPrioridade"), "click", "button", function (e, b) {
      prioridade = b.dataset.prio;
      N.$$("#fPrioridade button", api.corpo).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    });

    /* data minima ------------------------------------------------------- */
    if (!editando && !api.$("#fEntrega").value) {
      const d = new Date(); d.setDate(d.getDate() + 7);
      api.$("#fEntrega").value = N.isoDe(d);
    }

    /* anexos ------------------------------------------------------------ */
    const lista = api.$("#fListaAnexos");
    const entradaArquivo = api.$("#fArquivo");
    const solta = api.$("#fSolta");

    function pintarAnexos() {
      lista.innerHTML = anexos.length ? anexosHtml({ anexos: anexos, link: "" }, true) : "";
    }
    pintarAnexos();

    N.delegar(lista, "click", "[data-remover]", function (e, b) {
      e.preventDefault(); e.stopPropagation();
      anexos = anexos.filter(a => a.id !== b.dataset.remover);
      pintarAnexos();
    });
    N.delegar(lista, "click", "[data-anexo]", function (e, a) {
      e.preventDefault();
      abrirVisor(a.dataset.anexo);
    });

    function receber(arquivos) {
      const restante = Dados.LIMITE_ANEXOS_ATIVIDADE - anexos.length;
      if (restante <= 0) {
        N.notificar({ texto: "Limite de " + Dados.LIMITE_ANEXOS_ATIVIDADE + " anexos por atividade.", tipo: "alerta" });
        return;
      }
      Array.prototype.slice.call(arquivos, 0, restante).forEach(function (arq) {
        Dados.processarArquivo(arq).then(function (registro) {
          if (!Dados.Arquivos.guardar(registro)) {
            N.notificar({ titulo: "Espaço esgotado", texto: "Remova anexos antigos antes de enviar novos.", tipo: "erro" });
            return;
          }
          anexos.push({ id: registro.id, nome: registro.nome, tipo: registro.tipo, tamanho: registro.tamanho, imagem: registro.imagem });
          pintarAnexos();
        }).catch(function (erro) {
          N.notificar({ titulo: "Anexo recusado", texto: erro.message, tipo: "erro" });
        });
      });
    }

    solta.addEventListener("click", () => entradaArquivo.click());
    solta.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); entradaArquivo.click(); } });
    entradaArquivo.addEventListener("change", function () { receber(this.files); this.value = ""; });
    ["dragenter", "dragover"].forEach(ev => solta.addEventListener(ev, function (e) {
      e.preventDefault(); solta.classList.add("sobre");
    }));
    ["dragleave", "drop"].forEach(ev => solta.addEventListener(ev, function (e) {
      e.preventDefault(); solta.classList.remove("sobre");
    }));
    solta.addEventListener("drop", function (e) { receber(e.dataTransfer.files); });

    /* gravacao ---------------------------------------------------------- */
    function salvar() {
      const titulo = api.$("#fTitulo").value.trim();
      const entrega = api.$("#fEntrega").value;

      if (titulo.length < 4) {
        N.notificar({ texto: "Dê um título com pelo menos 4 caracteres.", tipo: "erro" });
        api.$("#fTitulo").focus();
        return;
      }
      if (!entrega) {
        N.notificar({ texto: "Informe a data de entrega.", tipo: "erro" });
        api.$("#fEntrega").focus();
        return;
      }
      if (!api.$("#fDisciplina").value) {
        N.notificar({ texto: "Você não leciona nenhum componente da matriz dessa turma.", tipo: "erro" });
        return;
      }

      const id = Dados.salvarAtividade({
        id: cfg.atividade ? cfg.atividade.id : null,
        titulo: titulo,
        descricao: api.$("#fDescricao").value.trim(),
        disciplinaId: api.$("#fDisciplina").value,
        turmaId: api.$("#fTurma").value,
        prioridade: prioridade,
        pontuacao: api.$("#fPontos").value,
        entrega: entrega,
        link: api.$("#fLink").value.trim(),
        anexos: anexos
      }, cfg.professor.id);

      N.fecharModal();
      N.notificar({
        titulo: editando ? "Atividade atualizada" : "Atividade publicada",
        texto: titulo + " — entrega em " + fmt.data(entrega) + ".",
        tipo: "ok"
      });
      if (cfg.aoSalvar) cfg.aoSalvar(id);
    }
  }

  global.Atividades = {
    PRIORIDADES: PRIORIDADES, prazo: prazo, ordenarPorUrgencia: ordenarPorUrgencia,
    cartao: cartao, formulario: formulario, anexosHtml: anexosHtml, abrirVisor: abrirVisor
  };
})(window);
