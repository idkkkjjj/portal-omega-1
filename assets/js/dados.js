/* ==========================================================================
   dados.js — camada de dados do sistema.

   Tudo fica no armazenamento local do navegador (localStorage). Nao existe
   servidor: a "sincronizacao em tempo real" acontece entre as abas abertas
   do mesmo navegador, via BroadcastChannel (com o evento storage como plano
   B). Quando o professor lanca uma nota, a aba do aluno recebe o aviso e
   redesenha o boletim sozinha.
   ========================================================================== */
(function (global) {
  "use strict";

  const CHAVE_BASE = "omega.base.v1";
  const CHAVE_ARQUIVOS = "omega.arquivos.v1";
  const CANAL = "omega.sincronia.v1";

  const LIMITE_REGISTRO = 400;          // eventos guardados na auditoria
  const LIMITE_ARQUIVOS_BYTES = 3.6 * 1024 * 1024;
  const LIMITE_ANEXOS_ATIVIDADE = 5;

  let base = null;
  const ouvintes = [];
  let canal = null;
  let ignorarProximoStorage = false;

  /* ================================================================ Senhas */
  /**
   * Resumo de senha com sal. NAO e criptografia forte — e uma funcao de
   * dispersao simples (FNV-1a duplo) apenas para nao guardar a senha em texto
   * puro no navegador. Num sistema em producao isso ficaria no servidor, com
   * bcrypt ou argon2.
   */
  function embaralhar(texto, sal) {
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    const s = String(sal) + "|" + String(texto) + "|" + String(sal);
    for (let volta = 0; volta < 3; volta++) {
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
        h2 = Math.imul((h2 + c * (i + volta + 1)) >>> 0, 2246822519) >>> 0;
      }
    }
    return h1.toString(36) + "." + h2.toString(36);
  }

  function conferirSenha(usuario, senha) {
    return !!usuario && usuario.senhaHash === embaralhar(senha, usuario.id);
  }

  /* ============================================================== Persistir */
  function ler() {
    try {
      const bruto = localStorage.getItem(CHAVE_BASE);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) {
      console.warn("[Ômega] base local ilegível, será recriada.", e);
      return null;
    }
  }

  function gravarBase() {
    try {
      ignorarProximoStorage = true;
      localStorage.setItem(CHAVE_BASE, JSON.stringify(base));
      return true;
    } catch (e) {
      console.error("[Ômega] falha ao gravar", e);
      if (global.N) {
        N.notificar({
          titulo: "Não foi possível salvar",
          texto: "O armazenamento do navegador está cheio. Remova anexos antigos em Atividades.",
          tipo: "erro", ms: 7000
        });
      }
      return false;
    } finally {
      setTimeout(function () { ignorarProximoStorage = false; }, 0);
    }
  }

  const VERSAO_ESPERADA = 2;

  function iniciar() {
    base = ler();
    // Base ausente, vazia ou de um schema anterior: recria do zero. Como a
    // matriz curricular passou a variar por etapa, uma base antiga não teria
    // como ser migrada de forma confiável.
    if (!base || !base.usuarios || !base.usuarios.length || base.versao !== VERSAO_ESPERADA) {
      base = Semente.criar(embaralhar);
      gravarBase();
    }
    if (!base.conclusoes) base.conclusoes = [];
    if (!base.registro) base.registro = [];
    if (!base.config.bimestreAtual) base.config.bimestreAtual = 3;
    indiceNotas = null;

    ligarSincronia();
    return base;
  }

  function reiniciar() {
    localStorage.removeItem(CHAVE_BASE);
    localStorage.removeItem(CHAVE_ARQUIVOS);
    base = Semente.criar(embaralhar);
    indiceNotas = null;
    gravarBase();
    avisar({ origem: "reinicio" });
  }

  /* ============================================================ Sincronia */
  function ligarSincronia() {
    if (canal !== null) return;
    if ("BroadcastChannel" in global) {
      canal = new BroadcastChannel(CANAL);
      canal.onmessage = function (ev) {
        if (!ev.data || ev.data.tipo !== "mudou") return;
        base = ler() || base;
        indiceNotas = null;
        avisar({ origem: "externo", detalhe: ev.data.detalhe });
      };
    } else {
      canal = false;
    }
    global.addEventListener("storage", function (e) {
      if (e.key !== CHAVE_BASE || ignorarProximoStorage) return;
      base = ler() || base;
      indiceNotas = null;
      avisar({ origem: "externo" });
    });
  }

  function transmitir(detalhe) {
    if (canal) {
      try { canal.postMessage({ tipo: "mudou", detalhe: detalhe, em: Date.now() }); }
      catch (e) { /* canal fechado */ }
    }
  }

  function assinar(fn) {
    ouvintes.push(fn);
    return function () {
      const i = ouvintes.indexOf(fn);
      if (i > -1) ouvintes.splice(i, 1);
    };
  }

  function avisar(info) {
    ouvintes.slice().forEach(function (fn) {
      try { fn(info || {}); } catch (e) { console.error("[Ômega] ouvinte falhou", e); }
    });
  }

  /**
   * Aplica uma mudanca na base, persiste e avisa todo mundo (esta aba e as
   * demais). `detalhe` viaja junto para que a outra aba saiba o que mudou.
   */
  function gravar(mutador, detalhe) {
    const r = mutador(base);
    if (r === false) return false;
    indiceNotas = null;
    const ok = gravarBase();
    if (!ok) return false;
    avisar({ origem: "local", detalhe: detalhe });
    transmitir(detalhe);
    return true;
  }

  /* ============================================================= Consultas */
  const estado = () => base;
  const config = () => base.config;

  const disciplinas = () => base.disciplinas.slice();
  const disciplina = id => base.disciplinas.find(d => d.id === id) || null;
  const turmas = () => base.turmas.slice();
  const turma = id => base.turmas.find(t => t.id === id) || null;

  const etapas = () => base.etapas || {};
  const nomeEtapa = chave => (base.etapas && base.etapas[chave] ? base.etapas[chave].nome : chave);
  const etapaCurta = chave => (base.etapas && base.etapas[chave] ? base.etapas[chave].curto : chave);

  /**
   * Componentes ofertados numa turma. O Ômega atende Anos Finais e Ensino
   * Médio, e as matrizes são diferentes: Ciências só existe no Fundamental,
   * Biologia/Física/Química/Filosofia/Sociologia só no Médio. Tudo que monta
   * boletim, diário ou estatística passa por aqui.
   */
  function disciplinasDaTurma(turmaId) {
    const t = turma(turmaId);
    if (!t) return disciplinas();
    return base.disciplinas.filter(d => !d.etapas || d.etapas.indexOf(t.etapa) > -1);
  }

  function disciplinasDoAluno(alunoId) {
    const a = usuario(alunoId);
    return a && a.turmaId ? disciplinasDaTurma(a.turmaId) : disciplinas();
  }

  function turmasDaEtapa(etapa) {
    return base.turmas.filter(t => t.etapa === etapa);
  }

  const usuario = id => base.usuarios.find(u => u.id === id) || null;
  const usuariosPorPapel = p => base.usuarios.filter(u => u.papel === p);
  const professores = () => usuariosPorPapel("professor");
  const gestores = () => usuariosPorPapel("gestor");

  function alunos(filtro) {
    let lista = usuariosPorPapel("aluno");
    if (filtro && filtro.turmaId) lista = lista.filter(a => a.turmaId === filtro.turmaId);
    if (filtro && filtro.ativos) lista = lista.filter(a => a.ativo);
    return lista.sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); });
  }

  function acharPorLogin(identificador) {
    const alvo = String(identificador || "").trim().toLowerCase();
    if (!alvo) return null;
    return base.usuarios.find(function (u) {
      return u.email.toLowerCase() === alvo || String(u.matricula).toLowerCase() === alvo;
    }) || null;
  }

  function nomeUsuario(id) {
    const u = usuario(id);
    return u ? u.nome : "—";
  }

  /* ------------------------------------------------------------- Notas --- */
  /**
   * Índice aluno -> notas, refeito sob demanda. Sem ele, montar o painel da
   * gestão varreria a lista inteira de notas uma vez por estudante e por
   * componente — com ~100 alunos isso já pesa.
   */
  let indiceNotas = null;

  function reconstruirIndice() {
    indiceNotas = Object.create(null);
    base.notas.forEach(function (n) {
      (indiceNotas[n.alunoId] || (indiceNotas[n.alunoId] = [])).push(n);
    });
  }

  function notasDoAluno(alunoId) {
    if (!indiceNotas) reconstruirIndice();
    return indiceNotas[alunoId] || [];
  }

  function nota(alunoId, disciplinaId, bimestre) {
    return notasDoAluno(alunoId).find(function (n) {
      return n.disciplinaId === disciplinaId && n.bimestre === bimestre;
    }) || null;
  }

  /**
   * Média com uma casa decimal. Toda média passa por aqui antes de virar
   * situação: assim o número que o usuário vê na tela é exatamente o mesmo que
   * o sistema comparou com a média mínima — sem "5,96 exibido como 6,0 e
   * marcado em vermelho".
   */
  function media1(soma, quantidade) {
    if (!quantidade) return null;
    return Math.round((soma / quantidade) * 10) / 10;
  }

  function mediaDe(valores) {
    return media1(valores.reduce((a, b) => a + b, 0), valores.length);
  }

  function classificar(media, lancadas, total) {
    const c = base.config;
    if (!lancadas) return { chave: "sem", rotulo: "Sem lançamento", classe: "selo-cinza", parcial: true };
    const fechado = lancadas >= total;
    if (media >= c.mediaMinima) {
      return { chave: "bom", rotulo: fechado ? "Aprovado" : "Acima da média", classe: "selo-verde", parcial: !fechado };
    }
    if (media >= c.mediaRecuperacao) {
      return { chave: "atencao", rotulo: fechado ? "Recuperação" : "Abaixo da média", classe: "selo-ambar", parcial: !fechado };
    }
    return { chave: "critico", rotulo: fechado ? "Reprovado" : "Crítico", classe: "selo-rubro", parcial: !fechado };
  }

  /**
   * Monta o boletim completo de um aluno: uma linha por componente curricular,
   * com as quatro notas bimestrais, media e situacao.
   */
  function boletim(alunoId) {
    const c = base.config;
    const doAluno = notasDoAluno(alunoId);
    const matriz = disciplinasDoAluno(alunoId);
    const linhas = matriz.map(function (d) {
      const bimestres = [null, null, null, null];
      doAluno.filter(n => n.disciplinaId === d.id).forEach(function (n) {
        if (n.bimestre >= 1 && n.bimestre <= 4) bimestres[n.bimestre - 1] = n;
      });
      const valores = bimestres.filter(Boolean).map(n => n.valor);
      const md = mediaDe(valores);
      const faltando = c.mediaMinima * 4 - valores.reduce((a, b) => a + b, 0);
      return {
        disciplina: d,
        bimestres: bimestres,
        lancadas: valores.length,
        media: md,
        situacao: classificar(md, valores.length, 4),
        // Quanto o aluno ainda precisa somar nos bimestres restantes para
        // fechar na media. Util no painel do estudante.
        precisaSomar: valores.length < 4 && md !== null && md < c.mediaMinima ? Math.max(0, faltando) : 0
      };
    });

    const comMedia = linhas.filter(l => l.media !== null);
    const mediaGeral = media1(comMedia.reduce((a, l) => a + l.media, 0), comMedia.length);

    return {
      alunoId: alunoId,
      linhas: linhas,
      mediaGeral: mediaGeral,
      totalLancadas: linhas.reduce((a, l) => a + l.lancadas, 0),
      totalPrevistas: matriz.length * 4,
      abaixo: linhas.filter(l => l.media !== null && l.media < c.mediaMinima),
      criticas: linhas.filter(l => l.media !== null && l.media < c.mediaRecuperacao),
      situacaoGeral: classificar(mediaGeral, comMedia.length ? 4 : 0, 4)
    };
  }

  /** Lanca ou atualiza uma nota. Devolve o tipo de operacao realizada. */
  function lancarNota(dados) {
    const valor = dados.valor === null || dados.valor === "" ? null : Number(dados.valor);
    if (valor !== null && (isNaN(valor) || valor < 0 || valor > base.config.notaMaxima)) return null;

    const existente = nota(dados.alunoId, dados.disciplinaId, dados.bimestre);
    const anterior = existente ? existente.valor : null;
    let operacao = "nenhuma";

    gravar(function (b) {
      if (valor === null) {
        if (!existente) return false;
        b.notas = b.notas.filter(n => n !== existente);
        operacao = "removida";
        return;
      }
      if (existente) {
        if (existente.valor === valor) { operacao = "nenhuma"; return false; }
        existente.valor = valor;
        existente.alteradoEm = new Date().toISOString();
        existente.alteradoPor = dados.autorId;
        operacao = "alterada";
      } else {
        b.notas.push({
          id: N.novoId("n"),
          alunoId: dados.alunoId,
          disciplinaId: dados.disciplinaId,
          bimestre: dados.bimestre,
          valor: valor,
          lancadoPor: dados.autorId,
          lancadoEm: new Date().toISOString(),
          alteradoEm: null,
          alteradoPor: null
        });
        operacao = "criada";
      }
    }, {
      tipo: "nota", alunoId: dados.alunoId, disciplinaId: dados.disciplinaId,
      bimestre: dados.bimestre, valor: valor, operacao: operacao
    });

    if (operacao !== "nenhuma" && dados.registrar !== false) {
      const d = disciplina(dados.disciplinaId);
      const nomeAluno = nomeUsuario(dados.alunoId);
      let texto;
      if (operacao === "criada") texto = "Nota " + N.fmt.nota(valor) + " lançada para " + nomeAluno + " em " + d.nome + " (" + dados.bimestre + "º bimestre).";
      else if (operacao === "alterada") texto = "Nota de " + nomeAluno + " em " + d.nome + " (" + dados.bimestre + "º bimestre) alterada de " + N.fmt.nota(anterior) + " para " + N.fmt.nota(valor) + ".";
      else texto = "Nota de " + nomeAluno + " em " + d.nome + " (" + dados.bimestre + "º bimestre) removida.";
      registrar({
        tipo: operacao === "criada" ? "lancamento" : operacao === "alterada" ? "alteracao" : "remocao",
        autorId: dados.autorId,
        acao: operacao === "criada" ? "Lançamento de nota" : operacao === "alterada" ? "Alteração de nota" : "Exclusão de nota",
        detalhe: texto
      });
    }
    return operacao;
  }

  /* --------------------------------------------------------- Atividades -- */
  function atividades(filtro) {
    let lista = base.atividades.slice();
    if (filtro) {
      if (filtro.turmaId) lista = lista.filter(a => a.turmaId === filtro.turmaId);
      if (filtro.professorId) lista = lista.filter(a => a.professorId === filtro.professorId);
      if (filtro.disciplinaId) lista = lista.filter(a => a.disciplinaId === filtro.disciplinaId);
    }
    return lista.sort(function (a, b) { return a.entrega.localeCompare(b.entrega); });
  }

  function atividade(id) { return base.atividades.find(a => a.id === id) || null; }

  function salvarAtividade(dados, autorId) {
    const nova = !dados.id;
    let idFinal = dados.id;
    gravar(function (b) {
      if (nova) {
        idFinal = N.novoId("a");
        b.atividades.push({
          id: idFinal,
          titulo: dados.titulo,
          descricao: dados.descricao || "",
          disciplinaId: dados.disciplinaId,
          turmaId: dados.turmaId,
          professorId: autorId,
          prioridade: dados.prioridade || "media",
          pontuacao: dados.pontuacao === "" || dados.pontuacao === null ? null : Number(dados.pontuacao),
          entrega: dados.entrega,
          criadoEm: new Date().toISOString(),
          anexos: dados.anexos || [],
          link: dados.link || ""
        });
      } else {
        const alvo = b.atividades.find(a => a.id === dados.id);
        if (!alvo) return false;
        Object.assign(alvo, {
          titulo: dados.titulo,
          descricao: dados.descricao || "",
          disciplinaId: dados.disciplinaId,
          turmaId: dados.turmaId,
          prioridade: dados.prioridade || "media",
          pontuacao: dados.pontuacao === "" || dados.pontuacao === null ? null : Number(dados.pontuacao),
          entrega: dados.entrega,
          anexos: dados.anexos || [],
          link: dados.link || "",
          atualizadoEm: new Date().toISOString()
        });
      }
    }, { tipo: "atividade", id: idFinal, nova: nova, turmaId: dados.turmaId });

    registrar({
      tipo: nova ? "criacao" : "alteracao",
      autorId: autorId,
      acao: nova ? "Nova atividade publicada" : "Atividade editada",
      detalhe: '"' + dados.titulo + '" — ' + (turma(dados.turmaId) || {}).nome + ", entrega em " + N.fmt.data(dados.entrega) + "."
    });
    return idFinal;
  }

  function excluirAtividade(id, autorId) {
    const alvo = atividade(id);
    if (!alvo) return false;
    (alvo.anexos || []).forEach(function (a) { Arquivos.remover(a.id); });
    gravar(function (b) {
      b.atividades = b.atividades.filter(a => a.id !== id);
      b.conclusoes = b.conclusoes.filter(c => c.atividadeId !== id);
    }, { tipo: "atividade", id: id, excluida: true, turmaId: alvo.turmaId });
    registrar({
      tipo: "remocao", autorId: autorId, acao: "Atividade excluída",
      detalhe: '"' + alvo.titulo + '" foi removida do mural da turma.'
    });
    return true;
  }

  function concluida(atividadeId, alunoId) {
    return base.conclusoes.some(c => c.atividadeId === atividadeId && c.alunoId === alunoId);
  }

  function alternarConclusao(atividadeId, alunoId) {
    const jaTem = concluida(atividadeId, alunoId);
    gravar(function (b) {
      if (jaTem) {
        b.conclusoes = b.conclusoes.filter(c => !(c.atividadeId === atividadeId && c.alunoId === alunoId));
      } else {
        b.conclusoes.push({ atividadeId: atividadeId, alunoId: alunoId, em: new Date().toISOString() });
      }
    }, { tipo: "conclusao", atividadeId: atividadeId, alunoId: alunoId });
    return !jaTem;
  }

  function contarConclusoes(atividadeId) {
    return base.conclusoes.filter(c => c.atividadeId === atividadeId).length;
  }

  /* -------------------------------------------------------------- Contas - */
  function proximaMatricula(papel) {
    if (papel === "aluno") {
      const nums = usuariosPorPapel("aluno")
        .map(a => parseInt(String(a.matricula).slice(4), 10))
        .filter(n => !isNaN(n));
      return String(base.config.anoLetivo) + String(Math.max(100, ...nums) + 1);
    }
    if (papel === "professor") {
      const nums = professores().map(p => parseInt(String(p.matricula).slice(1), 10)).filter(n => !isNaN(n));
      return "P" + String(Math.max(2000, ...nums) + 1);
    }
    const nums = gestores().map(g => parseInt(String(g.matricula).slice(1), 10)).filter(n => !isNaN(n));
    return "G" + String(Math.max(100, ...nums) + 1);
  }

  function emailDisponivel(email, ignorarId) {
    const alvo = String(email).trim().toLowerCase();
    return !base.usuarios.some(u => u.email.toLowerCase() === alvo && u.id !== ignorarId);
  }

  function criarUsuario(dados, autorId) {
    const id = N.novoId("u_" + dados.papel);
    const novo = Object.assign({
      id: id,
      ativo: true,
      criadoEm: new Date().toISOString(),
      ultimoAcesso: null,
      matricula: dados.matricula || proximaMatricula(dados.papel)
    }, dados);
    novo.senhaHash = embaralhar(dados.senha || "trocar123", id);
    delete novo.senha;

    gravar(function (b) { b.usuarios.push(novo); }, { tipo: "usuario", id: id, papel: dados.papel });

    registrar({
      tipo: "criacao", autorId: autorId,
      acao: dados.papel === "professor" ? "Professor cadastrado" : dados.papel === "aluno" ? "Aluno matriculado" : "Gestor cadastrado",
      detalhe: novo.nome + " — matrícula " + novo.matricula +
        (dados.papel === "aluno" ? " — " + (turma(novo.turmaId) || {}).nome : "") + "."
    });
    return novo;
  }

  function atualizarUsuario(id, campos, autorId) {
    const alvo = usuario(id);
    if (!alvo) return false;
    gravar(function () {
      Object.keys(campos).forEach(function (k) {
        if (k === "senha") { if (campos.senha) alvo.senhaHash = embaralhar(campos.senha, id); }
        else alvo[k] = campos[k];
      });
      alvo.atualizadoEm = new Date().toISOString();
    }, { tipo: "usuario", id: id });
    registrar({
      tipo: "alteracao", autorId: autorId, acao: "Cadastro atualizado",
      detalhe: alvo.nome + " (" + alvo.matricula + ") teve o cadastro alterado."
    });
    return true;
  }

  function alternarAtivo(id, autorId) {
    const alvo = usuario(id);
    if (!alvo) return false;
    gravar(function () { alvo.ativo = !alvo.ativo; }, { tipo: "usuario", id: id });
    registrar({
      tipo: alvo.ativo ? "criacao" : "remocao", autorId: autorId,
      acao: alvo.ativo ? "Conta reativada" : "Conta desativada",
      detalhe: alvo.nome + " — acesso " + (alvo.ativo ? "liberado" : "bloqueado") + "."
    });
    return alvo.ativo;
  }

  function marcarAcesso(id) {
    const alvo = usuario(id);
    if (!alvo) return;
    // Nao dispara aviso: e apenas um carimbo de auditoria.
    alvo.ultimoAcesso = new Date().toISOString();
    gravarBase();
  }

  /* ------------------------------------------------------------ Registro - */
  function registrar(evento) {
    gravar(function (b) {
      b.registro.unshift({
        id: N.novoId("r"),
        tipo: evento.tipo || "info",
        quando: new Date().toISOString(),
        autorId: evento.autorId || null,
        autorNome: evento.autorId ? nomeUsuario(evento.autorId) : "Sistema",
        acao: evento.acao,
        detalhe: evento.detalhe
      });
      if (b.registro.length > LIMITE_REGISTRO) b.registro.length = LIMITE_REGISTRO;
    }, { tipo: "registro" });
  }

  /* ========================================================== Estatisticas */
  /**
   * Agregados do painel da gestão.
   * `filtro` aceita o id de uma turma, ou { turmaId, etapa }. Sem filtro,
   * consolida a escola inteira (Anos Finais + Ensino Médio).
   */
  function estatisticas(filtro) {
    const c = base.config;
    const f = typeof filtro === "string" ? { turmaId: filtro } : (filtro || {});

    let lista = alunos(f.turmaId ? { turmaId: f.turmaId } : null);
    if (f.etapa) {
      lista = lista.filter(function (a) {
        const t = turma(a.turmaId);
        return t && t.etapa === f.etapa;
      });
    }

    // Boletim de cada estudante calculado uma vez só e reaproveitado.
    const boletins = {};
    lista.forEach(function (a) { boletins[a.id] = boletim(a.id); });

    const ids = {};
    lista.forEach(a => { ids[a.id] = true; });
    const notas = base.notas.filter(n => ids[n.alunoId]);

    /* Componentes presentes no escopo ------------------------------------ */
    const noEscopo = {};
    lista.forEach(function (a) {
      disciplinasDoAluno(a.id).forEach(function (d) { noEscopo[d.id] = true; });
    });

    const porDisciplina = base.disciplinas.filter(d => noEscopo[d.id]).map(function (d) {
      let soma = 0, lancamentos = 0, abaixo = 0, comNota = 0;
      lista.forEach(function (al) {
        const linha = boletins[al.id].linhas.find(l => l.disciplina.id === d.id);
        if (!linha || !linha.lancadas) return;
        comNota += 1;
        lancamentos += linha.lancadas;
        soma += linha.media * linha.lancadas;
        if (linha.media < c.mediaMinima) abaixo += 1;
      });
      return {
        disciplina: d,
        media: media1(soma, lancamentos),
        lancamentos: lancamentos,
        alunosAbaixo: abaixo,
        alunosComNota: comNota,
        percentualAbaixo: comNota ? (abaixo / comNota) * 100 : 0
      };
    });

    /* Média por turma ---------------------------------------------------- */
    const porTurma = base.turmas.map(function (t) {
      const daTurma = lista.filter(a => a.turmaId === t.id);
      const medias = daTurma.map(a => boletins[a.id].mediaGeral).filter(m => m !== null);
      return {
        turma: t,
        media: mediaDe(medias),
        alunos: daTurma.length,
        emRisco: medias.filter(m => m < c.mediaMinima).length
      };
    }).filter(t => t.alunos > 0);

    /* Média por etapa de ensino ------------------------------------------ */
    const porEtapa = Object.keys(base.etapas || {}).map(function (chave) {
      const daEtapa = lista.filter(function (a) {
        const t = turma(a.turmaId);
        return t && t.etapa === chave;
      });
      const medias = daEtapa.map(a => boletins[a.id].mediaGeral).filter(m => m !== null);
      return {
        etapa: chave,
        nome: base.etapas[chave].nome,
        curto: base.etapas[chave].curto,
        alunos: daEtapa.length,
        media: mediaDe(medias),
        emRisco: medias.filter(m => m < c.mediaMinima).length
      };
    }).filter(e => e.alunos > 0);

    /* Média por bimestre -------------------------------------------------- */
    const porBimestre = [1, 2, 3, 4].map(function (b) {
      const nb = notas.filter(n => n.bimestre === b);
      return {
        bimestre: b,
        media: media1(nb.reduce((a, n) => a + n.valor, 0), nb.length),
        lancamentos: nb.length
      };
    });

    /* Situação dos estudantes + fila de acompanhamento -------------------- */
    const distribuicao = { bom: 0, atencao: 0, critico: 0, sem: 0 };
    const emRisco = [];
    lista.forEach(function (a) {
      const bol = boletins[a.id];
      distribuicao[bol.situacaoGeral.chave] += 1;
      if (bol.abaixo.length) {
        emRisco.push({
          aluno: a, turma: turma(a.turmaId), media: bol.mediaGeral,
          disciplinas: bol.abaixo.map(l => l.disciplina),
          criticas: bol.criticas.length
        });
      }
    });
    emRisco.sort(function (x, y) {
      if (y.disciplinas.length !== x.disciplinas.length) return y.disciplinas.length - x.disciplinas.length;
      return (x.media || 0) - (y.media || 0);
    });

    /* Cobertura de lançamento --------------------------------------------- */
    // Cada etapa tem uma quantidade diferente de componentes, então o total
    // previsto é somado estudante a estudante.
    const bimAtual = c.bimestreAtual;
    let previstas = 0;
    lista.forEach(function (a) { previstas += disciplinasDoAluno(a.id).length * bimAtual; });
    const lancadas = notas.filter(n => n.bimestre <= bimAtual).length;

    const todas = notas.map(n => n.valor);
    return {
      totalAlunos: lista.length,
      totalProfessores: professores().filter(p => p.ativo).length,
      totalTurmas: porTurma.length,
      totalAtividades: base.atividades.length,
      mediaGeral: mediaDe(todas),
      porDisciplina: porDisciplina,
      porTurma: porTurma,
      porEtapa: porEtapa,
      porBimestre: porBimestre,
      distribuicao: distribuicao,
      emRisco: emRisco,
      boletins: boletins,
      cobertura: previstas ? (lancadas / previstas) * 100 : 0,
      lancadas: lancadas,
      previstas: previstas,
      piores: porDisciplina.filter(d => d.media !== null).sort((a, b) => a.media - b.media).slice(0, 5),
      melhores: porDisciplina.filter(d => d.media !== null).sort((a, b) => b.media - a.media).slice(0, 5)
    };
  }

  /* ============================================================== Arquivos */
  const Arquivos = {
    ler: function () {
      try { return JSON.parse(localStorage.getItem(CHAVE_ARQUIVOS) || "{}"); }
      catch (e) { return {}; }
    },
    gravar: function (mapa) {
      try { localStorage.setItem(CHAVE_ARQUIVOS, JSON.stringify(mapa)); return true; }
      catch (e) { return false; }
    },
    obter: function (id) { return this.ler()[id] || null; },
    remover: function (id) {
      const m = this.ler();
      delete m[id];
      this.gravar(m);
    },
    bytesUsados: function () {
      const bruto = localStorage.getItem(CHAVE_ARQUIVOS);
      return bruto ? bruto.length : 0;
    },
    /** Guarda um arquivo ja processado. Devolve false se estourar o limite. */
    guardar: function (registroArquivo) {
      const m = this.ler();
      m[registroArquivo.id] = registroArquivo;
      const tamanho = JSON.stringify(m).length;
      if (tamanho > LIMITE_ARQUIVOS_BYTES) return false;
      return this.gravar(m);
    }
  };

  /**
   * Le um arquivo escolhido pelo usuario. Imagens sao redimensionadas e
   * recomprimidas antes de ir para o armazenamento local — sem isso, duas
   * fotos de celular ja estourariam a cota do navegador.
   */
  function processarArquivo(arquivo) {
    return new Promise(function (resolver, rejeitar) {
      const ehImagem = /^image\//.test(arquivo.type);
      const leitor = new FileReader();
      leitor.onerror = function () { rejeitar(new Error("Não foi possível ler o arquivo.")); };

      leitor.onload = function () {
        if (!ehImagem) {
          if (arquivo.size > 320 * 1024) {
            rejeitar(new Error("Arquivos que não são imagem devem ter até 320 KB."));
            return;
          }
          resolver({
            id: N.novoId("f"), nome: arquivo.name, tipo: arquivo.type || "application/octet-stream",
            tamanho: arquivo.size, dados: leitor.result, imagem: false
          });
          return;
        }

        const img = new Image();
        img.onerror = function () { rejeitar(new Error("Imagem inválida.")); };
        img.onload = function () {
          const MAX = 1400;
          let l = img.width, a = img.height;
          if (l > MAX || a > MAX) {
            const fator = Math.min(MAX / l, MAX / a);
            l = Math.round(l * fator); a = Math.round(a * fator);
          }
          const tela = document.createElement("canvas");
          tela.width = l; tela.height = a;
          const ctx = tela.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, l, a);
          ctx.drawImage(img, 0, 0, l, a);
          const dados = tela.toDataURL("image/jpeg", 0.72);
          resolver({
            id: N.novoId("f"), nome: arquivo.name, tipo: "image/jpeg",
            tamanho: Math.round(dados.length * 0.75), dados: dados,
            imagem: true, largura: l, altura: a
          });
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  /* ========================================================== Exportacao == */
  function exportar() {
    return JSON.stringify({ base: base, arquivos: Arquivos.ler() }, null, 2);
  }

  function importar(texto) {
    const pacote = JSON.parse(texto);
    if (!pacote.base || !pacote.base.usuarios) throw new Error("Arquivo fora do formato esperado.");
    base = pacote.base;
    if (pacote.arquivos) Arquivos.gravar(pacote.arquivos);
    gravarBase();
    avisar({ origem: "importacao" });
    transmitir({ tipo: "importacao" });
  }

  /* ================================================================ Export */
  global.Dados = {
    iniciar: iniciar, reiniciar: reiniciar, gravar: gravar, assinar: assinar,
    estado: estado, config: config,
    embaralhar: embaralhar, conferirSenha: conferirSenha,

    disciplinas: disciplinas, disciplina: disciplina,
    turmas: turmas, turma: turma, turmasDaEtapa: turmasDaEtapa,
    etapas: etapas, nomeEtapa: nomeEtapa, etapaCurta: etapaCurta,
    disciplinasDaTurma: disciplinasDaTurma, disciplinasDoAluno: disciplinasDoAluno,
    usuario: usuario, professores: professores, gestores: gestores, alunos: alunos,
    acharPorLogin: acharPorLogin, nomeUsuario: nomeUsuario,
    criarUsuario: criarUsuario, atualizarUsuario: atualizarUsuario,
    alternarAtivo: alternarAtivo, marcarAcesso: marcarAcesso,
    proximaMatricula: proximaMatricula, emailDisponivel: emailDisponivel,

    media1: media1, mediaDe: mediaDe,
    notasDoAluno: notasDoAluno, nota: nota, lancarNota: lancarNota,
    boletim: boletim, classificar: classificar,

    atividades: atividades, atividade: atividade, salvarAtividade: salvarAtividade,
    excluirAtividade: excluirAtividade, concluida: concluida,
    alternarConclusao: alternarConclusao, contarConclusoes: contarConclusoes,

    registrar: registrar, estatisticas: estatisticas,
    Arquivos: Arquivos, processarArquivo: processarArquivo,
    exportar: exportar, importar: importar,
    LIMITE_ANEXOS_ATIVIDADE: LIMITE_ANEXOS_ATIVIDADE
  };
})(window);
