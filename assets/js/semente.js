/* ==========================================================================
   semente.js — carga inicial do Portal Ômega.

   Os dados institucionais (nome, endereço, INEP, telefone, data de fundação)
   são os registros públicos do Colégio Ômega. Já as pessoas — gestores,
   professores e estudantes — são fictícias: servem para demonstrar o sistema
   sem expor dados reais de ninguém.

   Roda uma única vez, no primeiro acesso do navegador. Tudo é gerado com um
   gerador pseudoaleatório de semente fixa, então a base nasce igual em
   qualquer máquina.
   ========================================================================== */
(function (global) {
  "use strict";

  const ANO = new Date().getFullYear();

  /* ---------------------------------------------------- Gerador com semente */
  function gerador(semente) {
    let a = semente >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* --------------------------------------------------- Matriz curricular -- */
  /**
   * O Ômega atende do Maternal ao Ensino Médio. O portal cobre as duas etapas
   * que trabalham com boletim bimestral: Anos Finais do Fundamental e Ensino
   * Médio. Cada componente declara em quais etapas é ofertado.
   *
   * No Ensino Médio entra apenas a Formação Geral Básica — itinerários
   * formativos não geram nota no boletim.
   */
  const FUND = "fundamental2";
  const MEDIO = "medio";

  const DISCIPLINAS = [
    { id: "lpo", nome: "Língua Portuguesa", sigla: "LPO", area: "Linguagens", cor: "#1b4f9c", etapas: [FUND, MEDIO] },
    { id: "art", nome: "Arte", sigla: "ART", area: "Linguagens", cor: "#4173bc", etapas: [FUND, MEDIO] },
    { id: "edf", nome: "Educação Física", sigla: "EDF", area: "Linguagens", cor: "#6d95d1", etapas: [FUND, MEDIO] },
    { id: "ing", nome: "Língua Inglesa", sigla: "ING", area: "Linguagens", cor: "#94b3e0", etapas: [FUND, MEDIO] },
    { id: "mat", nome: "Matemática", sigla: "MAT", area: "Matemática", cor: "#5b4b8a", etapas: [FUND, MEDIO] },
    { id: "cie", nome: "Ciências", sigla: "CIE", area: "Ciências da Natureza", cor: "#1c7a4f", etapas: [FUND] },
    { id: "bio", nome: "Biologia", sigla: "BIO", area: "Ciências da Natureza", cor: "#1c7a4f", etapas: [MEDIO] },
    { id: "fis", nome: "Física", sigla: "FIS", area: "Ciências da Natureza", cor: "#3f9a6d", etapas: [MEDIO] },
    { id: "qui", nome: "Química", sigla: "QUI", area: "Ciências da Natureza", cor: "#6bb894", etapas: [MEDIO] },
    { id: "his", nome: "História", sigla: "HIS", area: "Ciências Humanas", cor: "#a86c0c", etapas: [FUND, MEDIO] },
    { id: "geo", nome: "Geografia", sigla: "GEO", area: "Ciências Humanas", cor: "#c08c33", etapas: [FUND, MEDIO] },
    { id: "fil", nome: "Filosofia", sigla: "FIL", area: "Ciências Humanas", cor: "#d4a75c", etapas: [MEDIO] },
    { id: "soc", nome: "Sociologia", sigla: "SOC", area: "Ciências Humanas", cor: "#e0bd85", etapas: [MEDIO] },
    { id: "ere", nome: "Ensino Religioso", sigla: "ERE", area: "Ensino Religioso", cor: "#8a7fae", etapas: [FUND] }
  ];

  const AREAS = ["Linguagens", "Matemática", "Ciências da Natureza", "Ciências Humanas", "Ensino Religioso"];

  const ETAPAS = {
    fundamental2: { nome: "Ensino Fundamental — Anos Finais", curto: "Fundamental II" },
    medio: { nome: "Ensino Médio", curto: "Ensino Médio" }
  };

  const TURMAS = [
    { id: "t6a", nome: "6º ano A", etapa: FUND, serie: 6, turno: "Matutino", sala: "Sala 06", vagas: 20 },
    { id: "t7a", nome: "7º ano A", etapa: FUND, serie: 7, turno: "Matutino", sala: "Sala 07", vagas: 20 },
    { id: "t8a", nome: "8º ano A", etapa: FUND, serie: 8, turno: "Matutino", sala: "Sala 08", vagas: 20 },
    { id: "t9a", nome: "9º ano A", etapa: FUND, serie: 9, turno: "Matutino", sala: "Sala 09", vagas: 20 },
    { id: "tm1", nome: "1ª série EM", etapa: MEDIO, serie: 1, turno: "Matutino", sala: "Sala 11", vagas: 24 },
    { id: "tm2", nome: "2ª série EM", etapa: MEDIO, serie: 2, turno: "Matutino", sala: "Sala 12", vagas: 24 },
    { id: "tm3", nome: "3ª série EM", etapa: MEDIO, serie: 3, turno: "Matutino", sala: "Sala 13", vagas: 24 }
  ];

  const TURMAS_FUND = TURMAS.filter(t => t.etapa === FUND).map(t => t.id);
  const TURMAS_MEDIO = TURMAS.filter(t => t.etapa === MEDIO).map(t => t.id);
  const TODAS_TURMAS = TURMAS.map(t => t.id);

  /* --------------------------------------------------------------- Equipe - */
  const GESTORES = [
    { nome: "Cristiane Menezes Aragão", cargo: "Direção Geral", telefone: "(79) 3245-2017" },
    { nome: "Fábio Andrade Sobral", cargo: "Coordenação Pedagógica", telefone: "(79) 3245-2018" }
  ];

  const PROFESSORES = [
    // Anos Finais do Fundamental
    { nome: "Ana Cláudia Barreto Fontes", disciplinas: ["lpo"], turmas: TURMAS_FUND, formacao: "Licenciatura em Letras — UFS" },
    { nome: "Ivan Menezes Dantas", disciplinas: ["mat"], turmas: TURMAS_FUND, formacao: "Licenciatura em Matemática — UFS" },
    { nome: "Tatiane Andrade Feitosa", disciplinas: ["cie"], turmas: TURMAS_FUND, formacao: "Ciências Biológicas — UFS" },
    { nome: "Rogério Vasconcelos Prado", disciplinas: ["his", "geo"], turmas: TURMAS_FUND, formacao: "Licenciatura em História — UFS" },
    { nome: "Michele Freire Aragão", disciplinas: ["ing"], turmas: TURMAS_FUND, formacao: "Letras — Inglês — UNIT" },
    { nome: "Marta Bispo dos Santos", disciplinas: ["ere"], turmas: TURMAS_FUND, formacao: "Ciências da Religião — UNIT" },
    // Ensino Médio
    { nome: "Cláudio Rangel Mendonça", disciplinas: ["lpo"], turmas: TURMAS_MEDIO, formacao: "Licenciatura em Letras — UFS" },
    { nome: "Sandra Cavalcante Leite", disciplinas: ["mat"], turmas: TURMAS_MEDIO, formacao: "Licenciatura em Matemática — UFBA" },
    { nome: "Juliana Teles Macedo", disciplinas: ["bio"], turmas: TURMAS_MEDIO, formacao: "Ciências Biológicas — UFS" },
    { nome: "Everton Nunes Fraga", disciplinas: ["fis"], turmas: TURMAS_MEDIO, formacao: "Licenciatura em Física — UFS" },
    { nome: "Alexandre Bispo Carvalho", disciplinas: ["qui"], turmas: TURMAS_MEDIO, formacao: "Licenciatura em Química — UFS" },
    { nome: "Marcelo Franco Nascimento", disciplinas: ["his", "soc"], turmas: TURMAS_MEDIO, formacao: "Licenciatura em História — UFPE" },
    { nome: "Patrícia Guimarães Moura", disciplinas: ["geo", "fil"], turmas: TURMAS_MEDIO, formacao: "Licenciatura em Geografia — UFS" },
    { nome: "Simone Correia Pinheiro", disciplinas: ["ing"], turmas: TURMAS_MEDIO, formacao: "Letras — Inglês — UFS" },
    // Atendem as duas etapas
    { nome: "Larissa Sacramento Góis", disciplinas: ["art"], turmas: TODAS_TURMAS, formacao: "Artes Visuais — UFS" },
    { nome: "Diego Feitosa Passos", disciplinas: ["edf"], turmas: TODAS_TURMAS, formacao: "Educação Física — UNIT" }
  ];

  /* ------------------------------------------------------ Nomes fictícios - */
  const PRENOMES_F = ["Ana Luíza", "Beatriz", "Camila", "Cecília", "Clara", "Débora", "Eduarda", "Elisa",
    "Emanuelly", "Fernanda", "Gabriela", "Giovanna", "Helena", "Ingrid", "Isabela", "Isadora", "Júlia",
    "Larissa", "Laura", "Letícia", "Lívia", "Luana", "Manuela", "Mariana", "Maria Eduarda", "Melissa",
    "Nicole", "Rafaela", "Raquel", "Sarah", "Sofia", "Tainá", "Thaís", "Valentina", "Vitória", "Yasmin"];

  const PRENOMES_M = ["Arthur", "Bernardo", "Breno", "Bruno", "Caio", "Carlos Eduardo", "Daniel", "Davi",
    "Diego", "Enzo", "Erick", "Felipe", "Gabriel", "Guilherme", "Gustavo", "Heitor", "Henrique", "Igor",
    "João Pedro", "José Vitor", "Kauã", "Lucas", "Luiz Felipe", "Matheus", "Murilo", "Nícolas", "Otávio",
    "Pedro Henrique", "Rafael", "Renan", "Rodrigo", "Samuel", "Thiago", "Vinícius", "Vitor Hugo", "Yuri"];

  const SOBRENOMES = ["Santos", "Silva", "Oliveira", "Souza", "Nascimento", "Andrade", "Menezes", "Rezende",
    "Vasconcelos", "Barreto", "Fontes", "Feitosa", "Melo", "Prado", "Dantas", "Sobral", "Carvalho", "Rocha",
    "Freire", "Alves", "Lima", "Costa", "Araújo", "Cardoso", "Bispo", "Góis", "Passos", "Teles", "Cruz",
    "Macedo", "Rangel", "Sampaio", "Correia", "Batista", "Almeida", "Nunes", "Ferreira", "Moura", "Tavares",
    "Amaral", "Guimarães", "Leite", "Pinheiro", "Cavalcante", "Sacramento", "Franco", "Mendonça", "Fraga",
    "Aragão", "Nogueira"];

  const RESPONSAVEIS = ["Cleide", "Ronaldo", "Marlene", "Jorge", "Sandra", "Wilson", "Rosângela", "Nilton",
    "Vanessa", "Sebastião", "Adriana", "Márcio", "Cristiane", "Valdir", "Josefa", "Antônio", "Luciana", "Edson"];

  /* --------------------------------------------------------- Ferramentas -- */
  function semAcento(t) {
    return String(t).normalize("NFD")
      .replace(new RegExp("[" + String.fromCharCode(768) + "-" + String.fromCharCode(879) + "]", "g"), "");
  }

  function chaveEmail(nome) {
    const p = semAcento(nome).toLowerCase().split(/\s+/).filter(x => !/^(de|da|do|das|dos|e)$/.test(x));
    return (p[0] + "." + p[p.length - 1]).replace(/[^a-z.]/g, "");
  }

  /** Monta o e-mail garantindo que não repita nenhum já usado. */
  function emailUnico(nome, dominio, usados) {
    const base = chaveEmail(nome);
    let tentativa = base + "@" + dominio, i = 1;
    while (usados[tentativa]) { i += 1; tentativa = base + i + "@" + dominio; }
    usados[tentativa] = true;
    return tentativa;
  }

  function deslocar(dias) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dias);
    const z = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  }

  function carimbo(diasAtras, hora) {
    const d = new Date();
    d.setDate(d.getDate() - diasAtras);
    d.setHours(hora || 9, 20, 0, 0);
    return d.toISOString();
  }

  /* -------------------------------------------------------------- Montagem */
  function criar(embaralhar) {
    const rnd = gerador(19961114);          // data de fundação do Ômega
    const usuarios = [];
    const notas = [];
    const atividades = [];
    const conclusoes = [];
    const registro = [];
    const emailsUsados = {};
    const nomesUsados = {};

    const DOM_EQUIPE = "colegioomega.com.br";
    const DOM_ALUNO = "aluno.colegioomega.com.br";

    /* Gestores ----------------------------------------------------------- */
    GESTORES.forEach(function (g, i) {
      const id = "u_gestor_" + (i + 1);
      usuarios.push({
        id: id, papel: "gestor", nome: g.nome,
        email: emailUnico(g.nome, DOM_EQUIPE, emailsUsados),
        senhaHash: embaralhar("gestor123", id),
        matricula: "G" + String(101 + i),
        cargo: g.cargo, telefone: g.telefone,
        ativo: true, criadoEm: carimbo(230, 8), ultimoAcesso: carimbo(0, 7)
      });
    });

    /* Professores -------------------------------------------------------- */
    PROFESSORES.forEach(function (p, i) {
      const id = "u_prof_" + (i + 1);
      usuarios.push({
        id: id, papel: "professor", nome: p.nome,
        email: emailUnico(p.nome, DOM_EQUIPE, emailsUsados),
        senhaHash: embaralhar("prof123", id),
        matricula: "P" + String(2001 + i),
        disciplinas: p.disciplinas.slice(),
        turmas: p.turmas.slice(),
        formacao: p.formacao,
        telefone: "(79) 9" + String(8100 + Math.floor(rnd() * 1800)) + "-" + String(1000 + Math.floor(rnd() * 8999)),
        regime: p.turmas.length > 4 ? "40h semanais" : (i % 3 === 0 ? "Horista" : "30h semanais"),
        ativo: true,
        criadoEm: carimbo(220 - i * 4, 10),
        ultimoAcesso: carimbo(Math.floor(rnd() * 5), 14)
      });
    });

    const professorPorDisciplinaEtapa = {};
    usuarios.filter(u => u.papel === "professor").forEach(function (p) {
      p.disciplinas.forEach(function (d) {
        p.turmas.forEach(function (tid) {
          professorPorDisciplinaEtapa[d + "|" + tid] = p.id;
        });
      });
    });
    function professorDe(disciplinaId, turmaId) {
      return professorPorDisciplinaEtapa[disciplinaId + "|" + turmaId] || null;
    }

    /* Estudantes --------------------------------------------------------- */
    const POR_TURMA = { t6a: 14, t7a: 15, t8a: 14, t9a: 15, tm1: 16, tm2: 15, tm3: 14 };
    let seq = 0;

    function nomeInedito() {
      for (let tentativa = 0; tentativa < 400; tentativa++) {
        const pre = rnd() < 0.5
          ? PRENOMES_F[Math.floor(rnd() * PRENOMES_F.length)]
          : PRENOMES_M[Math.floor(rnd() * PRENOMES_M.length)];
        const s1 = SOBRENOMES[Math.floor(rnd() * SOBRENOMES.length)];
        let s2 = SOBRENOMES[Math.floor(rnd() * SOBRENOMES.length)];
        while (s2 === s1) s2 = SOBRENOMES[Math.floor(rnd() * SOBRENOMES.length)];
        const completo = pre + " " + s1 + " " + s2;
        if (!nomesUsados[completo]) { nomesUsados[completo] = true; return completo; }
      }
      return "Estudante " + (seq + 1);
    }

    TURMAS.forEach(function (turma) {
      const lista = [];
      for (let k = 0; k < POR_TURMA[turma.id]; k++) lista.push(nomeInedito());
      lista.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });

      lista.forEach(function (nome, idx) {
        seq += 1;
        const id = "u_aluno_" + seq;
        // 6º ano ~11 anos; 3ª série EM ~17 anos
        const idade = turma.etapa === FUND ? 5 + turma.serie : 14 + turma.serie;
        const anoNasc = ANO - idade;

        const aptidao = {};
        AREAS.forEach(function (a) { aptidao[a] = (rnd() * 3.2) - 1.6; });

        usuarios.push({
          id: id, papel: "aluno", nome: nome,
          email: emailUnico(nome, DOM_ALUNO, emailsUsados),
          senhaHash: embaralhar("aluno123", id),
          matricula: String(ANO) + String(1001 + seq),
          turmaId: turma.id,
          nascimento: anoNasc + "-" + String(1 + Math.floor(rnd() * 12)).padStart(2, "0") +
            "-" + String(1 + Math.floor(rnd() * 27)).padStart(2, "0"),
          responsavel: RESPONSAVEIS[Math.floor(rnd() * RESPONSAVEIS.length)] + " " +
            nome.split(" ").slice(-2).join(" "),
          telefone: "(79) 9" + String(8100 + Math.floor(rnd() * 1800)) + "-" + String(1000 + Math.floor(rnd() * 8999)),
          ativo: true,
          criadoEm: carimbo(215 - idx, 8),
          ultimoAcesso: carimbo(Math.floor(rnd() * 4), 19),
          _perfil: { base: 5.6 + rnd() * 2.6, aptidao: aptidao }
        });
      });
    });

    /* Notas -------------------------------------------------------------- */
    // Bimestres 1 e 2 fechados; o 3º em andamento (parcial); o 4º ainda não
    // começou. É esse recorte que faz a tela do aluno atualizar ao vivo
    // quando o professor lança uma nota nova.
    const dificuldade = {
      mat: -0.9, fis: -0.85, qui: -0.7, cie: -0.3, bio: -0.15, lpo: -0.1,
      ing: -0.2, his: 0.15, geo: 0.2, fil: 0.35, soc: 0.35, art: 0.9, edf: 1.1, ere: 1.0
    };

    const alunos = usuarios.filter(u => u.papel === "aluno");
    alunos.forEach(function (aluno) {
      const turma = TURMAS.find(t => t.id === aluno.turmaId);
      const doCurso = DISCIPLINAS.filter(d => d.etapas.indexOf(turma.etapa) > -1);

      doCurso.forEach(function (disc) {
        for (let bim = 1; bim <= 3; bim++) {
          if (bim === 3 && rnd() > 0.55) continue;   // 3º bimestre ainda parcial

          let v = aluno._perfil.base
            + aluno._perfil.aptidao[disc.area]
            + (dificuldade[disc.id] || 0)
            + (bim - 2) * 0.22
            + (rnd() * 2.4 - 1.2);

          v = Math.round(Math.max(1.5, Math.min(10, v)) * 2) / 2;

          notas.push({
            id: "n_" + aluno.id.split("_")[2] + "_" + disc.id + "_" + bim,
            alunoId: aluno.id,
            disciplinaId: disc.id,
            bimestre: bim,
            valor: v,
            lancadoPor: professorDe(disc.id, turma.id),
            lancadoEm: carimbo(bim === 1 ? 152 : bim === 2 ? 80 : Math.floor(rnd() * 20) + 2, 11),
            alteradoEm: null,
            alteradoPor: null
          });
        }
      });
      delete aluno._perfil;
    });

    /* Atividades --------------------------------------------------------- */
    const MODELOS = [
      { t: "Redação ENEM — proposta de intervenção", d: "lpo", tu: "tm3", p: "alta", pt: 3, prazo: 3,
        desc: "Texto dissertativo-argumentativo de 25 a 30 linhas em folha oficial. A proposta de intervenção precisa trazer agente, ação, meio, finalidade e detalhamento." },
      { t: "Lista 07 — função do 2º grau", d: "mat", tu: "tm1", p: "media", pt: 2, prazo: 5,
        desc: "Exercícios 1 a 18 da apostila (páginas 44 a 47). Apresentar o desenvolvimento completo de cada questão, não apenas a resposta final." },
      { t: "Relatório da titulação ácido-base", d: "qui", tu: "tm2", p: "alta", pt: 2.5, prazo: 1,
        desc: "Relatório individual da prática do laboratório: objetivo, materiais, procedimento, tabela de dados, cálculo da concentração e conclusão. Anexar foto da bancada montada." },
      { t: "Seminário: a Revolução Industrial e o trabalho hoje", d: "his", tu: "tm2", p: "media", pt: 3, prazo: 9,
        desc: "Grupos de 4 estudantes, 12 minutos de apresentação. Recortes por grupo: trabalho infantil, urbanização, movimento operário e automação." },
      { t: "Estudo do meio — Museu da Gente Sergipana", d: "geo", tu: "t8a", p: "media", pt: 2.5, prazo: 6,
        desc: "Roteiro de visita preenchido durante a saída de campo, com três registros fotográficos e um parágrafo sobre a formação cultural sergipana." },
      { t: "Cartografia do bairro Santos Dumont", d: "geo", tu: "t7a", p: "baixa", pt: 2, prazo: 13,
        desc: "Produzir um croqui do entorno do colégio identificando ruas, comércio, praças e pontos de ônibus. Incluir legenda e rosa dos ventos." },
      { t: "Avaliação bimestral — Leis de Newton", d: "fis", tu: "tm2", p: "alta", pt: 5, prazo: 6,
        desc: "Prova individual sem consulta. Conteúdo: as três leis, plano inclinado, força de atrito e sistemas de blocos. Trazer calculadora simples." },
      { t: "Mapa conceitual — corpo humano", d: "cie", tu: "t8a", p: "baixa", pt: 1.5, prazo: 12,
        desc: "Relacionar os sistemas do corpo humano às suas funções. Pode ser feito à mão ou digital, desde que legível." },
      { t: "Experimento: separação de misturas", d: "cie", tu: "t9a", p: "media", pt: 2, prazo: -4,
        desc: "Montar em casa uma filtração e uma decantação com materiais simples, fotografar cada etapa e explicar o que separou cada método." },
      { t: "Resenha crítica — texto de Durkheim", d: "soc", tu: "tm3", p: "media", pt: 2, prazo: 8,
        desc: "Resenha de 2 páginas sobre o capítulo “O que é fato social”: apresentação do autor, síntese e posicionamento fundamentado." },
      { t: "Fichamento — Alegoria da Caverna", d: "fil", tu: "tm1", p: "baixa", pt: 1.5, prazo: 14,
        desc: "Fichamento do trecho de A República (Livro VII). Separar as citações mais relevantes e comentar cada uma em pelo menos três linhas." },
      { t: "Releitura modernista — Semana de 22", d: "art", tu: "tm1", p: "baixa", pt: 2, prazo: 17,
        desc: "Releitura de uma obra da Semana de 22 em qualquer técnica, entregue com ficha técnica: título, técnica e justificativa em um parágrafo." },
      { t: "Avaliação prática — fundamentos do handebol", d: "edf", tu: "t9a", p: "baixa", pt: 2, prazo: 2,
        desc: "Avaliação de passe, recepção e arremesso na quadra coberta. Comparecer com roupa adequada; dispensados entregam o trabalho substitutivo." },
      { t: "Reading comprehension — Unit 4", d: "ing", tu: "tm3", p: "media", pt: 2, prazo: 7,
        desc: "Answer the questions from pages 62 to 65, focusing on reported speech. Handwritten answers only." },
      { t: "Simulado ENEM — Linguagens e Matemática", d: "lpo", tu: "tm3", p: "alta", pt: 4, prazo: 0,
        desc: "Simulado com 90 questões, das 13h às 18h. Chegar 20 minutos antes com documento com foto, caneta preta e lanche." },
      { t: "Interpretação de texto — crônica sergipana", d: "lpo", tu: "t6a", p: "media", pt: 2, prazo: 4,
        desc: "Ler a crônica entregue em sala e responder às dez questões de interpretação. Respostas completas, em frases inteiras." },
      { t: "Tabuada e operações — ficha 12", d: "mat", tu: "t6a", p: "baixa", pt: 1.5, prazo: 10,
        desc: "Ficha de cálculo mental com 40 operações. Fazer sem calculadora e conferir o resultado ao final." },
      { t: "Linha do tempo — Brasil Colônia", d: "his", tu: "t7a", p: "media", pt: 2, prazo: -2,
        desc: "Linha do tempo ilustrada de 1500 a 1822 com pelo menos dez marcos, cada um com data, título e uma frase de explicação." },
      { t: "Trabalho em dupla — estatística descritiva", d: "mat", tu: "tm2", p: "media", pt: 3, prazo: -6,
        desc: "Coletar dados reais de uma turma do colégio, montar tabela de frequência, calcular média, mediana e moda e produzir dois gráficos comentados." },
      { t: "Projeto de valores — respeito às diferenças", d: "ere", tu: "t9a", p: "baixa", pt: 1.5, prazo: 15,
        desc: "Produzir um cartaz em grupo sobre convivência e respeito, para exposição no pátio coberto durante a semana de valores." },
      { t: "Estudo dirigido — genética mendeliana", d: "bio", tu: "tm3", p: "media", pt: 2, prazo: 6,
        desc: "Resolver os 12 problemas de cruzamento montando o quadro de Punnett e indicando as proporções fenotípicas." },
      { t: "Produção textual — carta ao gestor escolar", d: "lpo", tu: "t8a", p: "media", pt: 2, prazo: 11,
        desc: "Carta argumentativa endereçada à direção propondo uma melhoria concreta no espaço do colégio. Mínimo de 20 linhas." }
    ];

    MODELOS.forEach(function (m, i) {
      atividades.push({
        id: "a_" + (i + 1),
        titulo: m.t,
        descricao: m.desc,
        disciplinaId: m.d,
        turmaId: m.tu,
        professorId: professorDe(m.d, m.tu),
        prioridade: m.p,
        pontuacao: m.pt,
        entrega: deslocar(m.prazo),
        criadoEm: carimbo(Math.max(1, 18 - i), 10),
        anexos: [],
        link: m.d === "lpo" && m.tu === "tm3" && m.p === "alta" && i > 10 ? "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem" : ""
      });
    });

    /* Entregas já marcadas ---------------------------------------------- */
    atividades.forEach(function (atv) {
      alunos.filter(a => a.turmaId === atv.turmaId).forEach(function (a) {
        const venceu = new Date(atv.entrega) < new Date();
        if (rnd() < (venceu ? 0.78 : 0.3)) {
          conclusoes.push({ atividadeId: atv.id, alunoId: a.id, em: carimbo(Math.floor(rnd() * 8) + 1, 20) });
        }
      });
    });

    /* Registro de auditoria --------------------------------------------- */
    registro.push({
      id: "r_1", tipo: "criacao", quando: carimbo(230, 8),
      autorId: "u_gestor_1", autorNome: GESTORES[0].nome,
      acao: "Ano letivo aberto",
      detalhe: "Configuração do ano letivo de " + ANO + ": " + TURMAS.length +
        " turmas do 6º ano à 3ª série e " + DISCIPLINAS.length + " componentes curriculares."
    });
    registro.push({
      id: "r_2", tipo: "criacao", quando: carimbo(220, 9),
      autorId: "u_gestor_1", autorNome: GESTORES[0].nome,
      acao: "Quadro docente cadastrado",
      detalhe: PROFESSORES.length + " contas de professor criadas e vinculadas aos componentes e às turmas."
    });
    registro.push({
      id: "r_3", tipo: "lancamento", quando: carimbo(152, 11),
      autorId: null, autorNome: "Sistema",
      acao: "Fechamento do 1º bimestre",
      detalhe: "Notas do 1º bimestre consolidadas em todas as turmas."
    });
    registro.push({
      id: "r_4", tipo: "lancamento", quando: carimbo(80, 11),
      autorId: null, autorNome: "Sistema",
      acao: "Fechamento do 2º bimestre",
      detalhe: "Notas do 2º bimestre consolidadas em todas as turmas."
    });

    /* Base final --------------------------------------------------------- */
    return {
      versao: 2,
      criadoEm: new Date().toISOString(),
      config: {
        escola: "Colégio Ômega",
        sigla: "Ω",
        lema: "Abrindo portas para o conhecimento",
        fundacao: "1996-11-14",
        inep: "28031350",
        endereco: "Rua Sargento Brasiliano, 472 — Santos Dumont",
        cep: "49087-580",
        cidade: "Aracaju",
        uf: "SE",
        telefone: "(79) 3245-2017",
        instagram: "@colegioomegaaracaju",
        anoLetivo: ANO,
        bimestreAtual: 3,
        mediaMinima: 6,
        mediaRecuperacao: 4,
        notaMaxima: 10
      },
      etapas: ETAPAS,
      disciplinas: DISCIPLINAS,
      turmas: TURMAS,
      usuarios: usuarios,
      notas: notas,
      atividades: atividades,
      conclusoes: conclusoes,
      registro: registro
    };
  }

  global.Semente = { criar: criar, DISCIPLINAS: DISCIPLINAS, AREAS: AREAS, ETAPAS: ETAPAS };
})(window);
