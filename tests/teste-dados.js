/* Verificações da camada de dados do Portal Ômega.
   Roda em Node, sem dependências:  node tests/teste-dados.js  */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..");

/* --------- ambiente falso mínimo --------- */
const armazem = {};
const localStorage = {
  getItem: k => (k in armazem ? armazem[k] : null),
  setItem: (k, v) => { armazem[k] = String(v); },
  removeItem: k => { delete armazem[k]; }
};

const janela = {
  localStorage, addEventListener() {}, console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Date, JSON, Number, String, Object, Array, Promise, RegExp, Error,
  isNaN, parseInt, parseFloat, Intl, Set, Map,
  document: {
    createElement() { return { setAttribute() {}, appendChild() {}, getContext() { return {}; }, style: {}, classList: { add() {}, remove() {}, toggle() {} } }; },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    body: { appendChild() {}, style: {} },
    addEventListener() {}
  }
};
janela.window = janela;
janela.global = janela;

const ctx = vm.createContext(janela);
["nucleo.js", "semente.js", "dados.js"].forEach(function (arq) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, "assets/js", arq), "utf8"), ctx, { filename: arq });
});

const { N, Dados } = janela;

/* ------------------------------- asserções ------------------------------- */
let ok = 0, falhas = 0;
function checar(nome, condicao, extra) {
  if (condicao) ok++;
  else { falhas++; console.log("  FALHOU: " + nome + (extra !== undefined ? " -> " + extra : "")); }
}
function titulo(t) { console.log("\n== " + t); }

titulo("Identificação da escola");
const base = Dados.iniciar();
const cfg = Dados.config();
checar("base criada", !!base);
checar("versão 2 do schema", base.versao === 2, base.versao);
checar("nome da escola", cfg.escola === "Colégio Ômega", cfg.escola);
checar("cidade/UF", cfg.cidade === "Aracaju" && cfg.uf === "SE", cfg.cidade + "/" + cfg.uf);
checar("código INEP", cfg.inep === "28031350", cfg.inep);
checar("endereço", /Sargento Brasiliano, 472/.test(cfg.endereco), cfg.endereco);
checar("CEP", cfg.cep === "49087-580", cfg.cep);
checar("telefone", cfg.telefone === "(79) 3245-2017", cfg.telefone);
checar("fundação em 1996", cfg.fundacao === "1996-11-14", cfg.fundacao);
checar("média mínima 6", cfg.mediaMinima === 6);
checar("recuperação 4", cfg.mediaRecuperacao === 4);

titulo("Etapas e matrizes curriculares");
const etapas = Dados.etapas();
checar("duas etapas", Object.keys(etapas).length === 2, Object.keys(etapas).join(","));
checar("nome dos Anos Finais", /Anos Finais/.test(Dados.nomeEtapa("fundamental2")), Dados.nomeEtapa("fundamental2"));
checar("nome do Ensino Médio", Dados.nomeEtapa("medio") === "Ensino Médio", Dados.nomeEtapa("medio"));
checar("14 componentes no catálogo", Dados.disciplinas().length === 14, Dados.disciplinas().length);

const turmas = Dados.turmas();
checar("7 turmas", turmas.length === 7, turmas.length);
checar("4 turmas nos Anos Finais", Dados.turmasDaEtapa("fundamental2").length === 4);
checar("3 turmas no Médio", Dados.turmasDaEtapa("medio").length === 3);
checar("toda turma declara etapa", turmas.every(t => !!etapas[t.etapa]));

const matFund = Dados.disciplinasDaTurma("t7a").map(d => d.id).sort();
const matMedio = Dados.disciplinasDaTurma("tm2").map(d => d.id).sort();
checar("Anos Finais com 9 componentes", matFund.length === 9, matFund.join(","));
checar("Ensino Médio com 12 componentes", matMedio.length === 12, matMedio.join(","));
checar("Ciências só no Fundamental", matFund.indexOf("cie") > -1 && matMedio.indexOf("cie") < 0);
checar("Ensino Religioso só no Fundamental", matFund.indexOf("ere") > -1 && matMedio.indexOf("ere") < 0);
checar("Bio/Fís/Quí só no Médio",
  ["bio", "fis", "qui"].every(x => matMedio.indexOf(x) > -1 && matFund.indexOf(x) < 0));
checar("Filosofia e Sociologia só no Médio",
  ["fil", "soc"].every(x => matMedio.indexOf(x) > -1 && matFund.indexOf(x) < 0));
checar("sem itinerários formativos no catálogo",
  !Dados.disciplinas().some(d => /itiner/i.test(d.nome)));
checar("componentes comuns às duas etapas",
  ["lpo", "mat", "his", "geo", "art", "edf", "ing"].every(x => matFund.indexOf(x) > -1 && matMedio.indexOf(x) > -1));

titulo("Pessoas");
const alunos = Dados.alunos();
const profs = Dados.professores();
const gestores = Dados.gestores();
checar("103 estudantes", alunos.length === 103, alunos.length);
checar("16 professores", profs.length === 16, profs.length);
checar("2 gestores", gestores.length === 2, gestores.length);
checar("nenhum e-mail duplicado", new Set(base.usuarios.map(u => u.email)).size === base.usuarios.length);
checar("nenhuma matrícula duplicada", new Set(base.usuarios.map(u => u.matricula)).size === base.usuarios.length);
checar("nenhum nome de estudante duplicado", new Set(alunos.map(a => a.nome)).size === alunos.length);
checar("e-mails da equipe no domínio do colégio",
  profs.concat(gestores).every(u => /@colegioomega\.com\.br$/.test(u.email)));
checar("e-mails de estudante no subdomínio",
  alunos.every(a => /@aluno\.colegioomega\.com\.br$/.test(a.email)));
checar("todo estudante tem turma válida", alunos.every(a => !!Dados.turma(a.turmaId)));
checar("todo professor tem componente e turma",
  profs.every(p => p.disciplinas.length > 0 && p.turmas.length > 0));

// cada turma precisa ter professor para todos os componentes da sua matriz
let semDocente = [];
turmas.forEach(function (t) {
  Dados.disciplinasDaTurma(t.id).forEach(function (d) {
    const tem = profs.some(p => p.disciplinas.indexOf(d.id) > -1 && p.turmas.indexOf(t.id) > -1);
    if (!tem) semDocente.push(t.nome + "/" + d.sigla);
  });
});
checar("toda turma tem docente em todos os componentes", semDocente.length === 0, semDocente.join(" "));

checar("professor de Ciências não atende o Médio",
  profs.filter(p => p.disciplinas.indexOf("cie") > -1)
    .every(p => p.turmas.every(id => Dados.turma(id).etapa === "fundamental2")));
checar("professor de Biologia não atende o Fundamental",
  profs.filter(p => p.disciplinas.indexOf("bio") > -1)
    .every(p => p.turmas.every(id => Dados.turma(id).etapa === "medio")));

titulo("Notas");
checar("existem notas", base.notas.length > 1500, base.notas.length);
checar("todas entre 0 e 10", base.notas.every(n => n.valor >= 0 && n.valor <= 10));
checar("nada lançado no 4º bimestre", base.notas.every(n => n.bimestre <= 3));
checar("id de nota único", new Set(base.notas.map(n => n.id)).size === base.notas.length);
checar("sem duplicidade aluno+componente+bimestre",
  new Set(base.notas.map(n => n.alunoId + n.disciplinaId + n.bimestre)).size === base.notas.length);
checar("toda nota tem lançador válido", base.notas.every(n => !!Dados.usuario(n.lancadoPor)));
checar("lançador leciona o componente na turma do estudante", base.notas.every(function (n) {
  const p = Dados.usuario(n.lancadoPor);
  const a = Dados.usuario(n.alunoId);
  return p && a && p.disciplinas.indexOf(n.disciplinaId) > -1 && p.turmas.indexOf(a.turmaId) > -1;
}));
checar("nenhuma nota fora da matriz da turma", base.notas.every(function (n) {
  const a = Dados.usuario(n.alunoId);
  return Dados.disciplinasDaTurma(a.turmaId).some(d => d.id === n.disciplinaId);
}));

const somaB1 = base.notas.filter(n => n.bimestre === 1).length;
const previstoB1 = alunos.reduce((s, a) => s + Dados.disciplinasDoAluno(a.id).length, 0);
checar("1º bimestre completo", somaB1 === previstoB1, somaB1 + "/" + previstoB1);
const b3 = base.notas.filter(n => n.bimestre === 3).length;
checar("3º bimestre parcial", b3 > 0 && b3 < previstoB1, b3 + "/" + previstoB1);

titulo("Login");
const gestor = Dados.acharPorLogin(gestores[0].email);
checar("gestor encontrado por e-mail", !!gestor && gestor.papel === "gestor");
checar("senha do gestor confere", Dados.conferirSenha(gestor, "gestor123"));
checar("senha errada recusada", !Dados.conferirSenha(gestor, "gestor124"));
const profMat = profs.find(p => p.disciplinas.indexOf("mat") > -1 && Dados.turma(p.turmas[0]).etapa === "medio");
checar("professor de Matemática do Médio existe", !!profMat);
checar("senha do professor confere", Dados.conferirSenha(profMat, "prof123"));
const alunoMedio = Dados.alunos({ turmaId: "tm2" })[0];
checar("estudante encontrado por e-mail", !!Dados.acharPorLogin(alunoMedio.email));
checar("estudante encontrado por matrícula", !!Dados.acharPorLogin(alunoMedio.matricula));
checar("senha do estudante confere", Dados.conferirSenha(alunoMedio, "aluno123"));

titulo("Boletim");
const bolMedio = Dados.boletim(alunoMedio.id);
checar("12 linhas no Médio", bolMedio.linhas.length === 12, bolMedio.linhas.length);
checar("48 notas previstas no Médio", bolMedio.totalPrevistas === 48, bolMedio.totalPrevistas);
const alunoFund = Dados.alunos({ turmaId: "t7a" })[0];
const bolFund = Dados.boletim(alunoFund.id);
checar("9 linhas no Fundamental", bolFund.linhas.length === 9, bolFund.linhas.length);
checar("36 notas previstas no Fundamental", bolFund.totalPrevistas === 36, bolFund.totalPrevistas);
checar("boletim do Médio não traz Ciências", !bolMedio.linhas.some(l => l.disciplina.id === "cie"));
checar("boletim do Fundamental não traz Filosofia", !bolFund.linhas.some(l => l.disciplina.id === "fil"));
checar("média geral calculada", bolMedio.mediaGeral > 0 && bolMedio.mediaGeral <= 10, bolMedio.mediaGeral);
const linhaMat = bolMedio.linhas.find(l => l.disciplina.id === "mat");
const somaMat = linhaMat.bimestres.filter(Boolean).reduce((s, n) => s + n.valor, 0);
checar("média do componente confere",
  linhaMat.media === Math.round((somaMat / linhaMat.lancadas) * 10) / 10);
checar("média sempre com 1 casa decimal",
  bolMedio.linhas.every(l => l.media === null || Math.abs(l.media * 10 - Math.round(l.media * 10)) < 1e-9));

titulo("Lançamento e correção de nota");
const antesQtd = Dados.estado().notas.length;
let op = Dados.lancarNota({ alunoId: alunoMedio.id, disciplinaId: "mat", bimestre: 4, valor: 8.5, autorId: profMat.id });
checar("nota nova criada", op === "criada", op);
checar("valor gravado", Dados.nota(alunoMedio.id, "mat", 4).valor === 8.5);
op = Dados.lancarNota({ alunoId: alunoMedio.id, disciplinaId: "mat", bimestre: 4, valor: 9, autorId: profMat.id });
checar("nota alterada", op === "alterada", op);
checar("carimbo de alteração", !!Dados.nota(alunoMedio.id, "mat", 4).alteradoEm);
op = Dados.lancarNota({ alunoId: alunoMedio.id, disciplinaId: "mat", bimestre: 4, valor: 9, autorId: profMat.id });
checar("valor igual não gera operação", op === "nenhuma", op);
op = Dados.lancarNota({ alunoId: alunoMedio.id, disciplinaId: "mat", bimestre: 4, valor: null, autorId: profMat.id });
checar("nota removida", op === "removida", op);
checar("base voltou ao tamanho original", Dados.estado().notas.length === antesQtd);
checar("nota acima da escala recusada",
  Dados.lancarNota({ alunoId: alunoMedio.id, disciplinaId: "mat", bimestre: 4, valor: 11, autorId: profMat.id }) === null);
checar("nota negativa recusada",
  Dados.lancarNota({ alunoId: alunoMedio.id, disciplinaId: "mat", bimestre: 4, valor: -1, autorId: profMat.id }) === null);
checar("índice de notas reflete a alteração",
  Dados.notasDoAluno(alunoMedio.id).length === Dados.estado().notas.filter(n => n.alunoId === alunoMedio.id).length);

titulo("Cadastro de contas");
const novoProf = Dados.criarUsuario({
  papel: "professor", nome: "Teste da Silva", email: "teste.silva@colegioomega.com.br",
  senha: "senha123", disciplinas: ["mat"], turmas: ["t6a"]
}, gestor.id);
checar("professor criado", !!Dados.usuario(novoProf.id));
checar("matrícula P gerada", /^P\d+$/.test(novoProf.matricula), novoProf.matricula);
checar("senha do novo professor confere", Dados.conferirSenha(Dados.usuario(novoProf.id), "senha123"));
checar("e-mail repetido detectado", !Dados.emailDisponivel("teste.silva@colegioomega.com.br"));
checar("e-mail livre aceito", Dados.emailDisponivel("outro.nome@colegioomega.com.br"));

const novoAluno = Dados.criarUsuario({
  papel: "aluno", nome: "Aluno de Teste", email: "aluno.teste@aluno.colegioomega.com.br",
  senha: "aluno123", turmaId: "t6a"
}, gestor.id);
checar("matrícula do ano corrente",
  novoAluno.matricula.indexOf(String(cfg.anoLetivo)) === 0, novoAluno.matricula);
const bolVazio = Dados.boletim(novoAluno.id);
checar("boletim novo vazio", bolVazio.totalLancadas === 0 && bolVazio.mediaGeral === null);
checar("boletim novo usa a matriz do 6º ano", bolVazio.linhas.length === 9, bolVazio.linhas.length);
checar("situação sem lançamento", bolVazio.situacaoGeral.chave === "sem", bolVazio.situacaoGeral.chave);
Dados.alternarAtivo(novoProf.id, gestor.id);
checar("conta desativada", Dados.usuario(novoProf.id).ativo === false);
Dados.alternarAtivo(novoProf.id, gestor.id);
checar("conta reativada", Dados.usuario(novoProf.id).ativo === true);

titulo("Atividades");
const atvs = Dados.atividades();
checar("atividades semeadas", atvs.length === 22, atvs.length);
checar("professor da atividade leciona o componente",
  atvs.every(a => { const p = Dados.usuario(a.professorId); return p && p.disciplinas.indexOf(a.disciplinaId) > -1; }));
checar("professor da atividade atende a turma",
  atvs.every(a => { const p = Dados.usuario(a.professorId); return p && p.turmas.indexOf(a.turmaId) > -1; }));
checar("componente pertence à matriz da turma",
  atvs.every(a => Dados.disciplinasDaTurma(a.turmaId).some(d => d.id === a.disciplinaId)),
  atvs.filter(a => !Dados.disciplinasDaTurma(a.turmaId).some(d => d.id === a.disciplinaId))
    .map(a => a.titulo).join(" | "));
checar("prazos em formato ISO", atvs.every(a => /^\d{4}-\d{2}-\d{2}$/.test(a.entrega)));
checar("há atividade atrasada e há futura",
  atvs.some(a => N.diasAte(a.entrega) < 0) && atvs.some(a => N.diasAte(a.entrega) > 0));

const idAtv = Dados.salvarAtividade({
  titulo: "Atividade de teste", descricao: "x", disciplinaId: "mat",
  turmaId: "t6a", prioridade: "alta", pontuacao: 2, entrega: "2030-01-01", anexos: []
}, profMat.id);
checar("atividade criada", !!Dados.atividade(idAtv));
Dados.salvarAtividade({ id: idAtv, titulo: "Renomeada", disciplinaId: "mat", turmaId: "t6a",
  prioridade: "baixa", pontuacao: 1, entrega: "2030-02-01", anexos: [] }, profMat.id);
checar("atividade editada", Dados.atividade(idAtv).titulo === "Renomeada");
checar("conclusão marcada", Dados.alternarConclusao(idAtv, novoAluno.id) === true);
checar("contagem de conclusões", Dados.contarConclusoes(idAtv) === 1);
checar("conclusão desmarcada", Dados.alternarConclusao(idAtv, novoAluno.id) === false);
Dados.excluirAtividade(idAtv, profMat.id);
checar("atividade excluída", !Dados.atividade(idAtv));

titulo("Estatísticas");
const t0 = Date.now();
const est = Dados.estatisticas();
const ms = Date.now() - t0;
checar("painel completo em menos de 1s", ms < 1000, ms + "ms");
checar("total de estudantes bate", est.totalAlunos === Dados.alunos().length, est.totalAlunos);
checar("média geral no intervalo", est.mediaGeral > 0 && est.mediaGeral <= 10, est.mediaGeral);
checar("uma linha por componente com lançamento", est.porDisciplina.length === 14, est.porDisciplina.length);
checar("percentual abaixo entre 0 e 100",
  est.porDisciplina.every(d => d.percentualAbaixo >= 0 && d.percentualAbaixo <= 100));
checar("distribuição soma o total",
  est.distribuicao.bom + est.distribuicao.atencao + est.distribuicao.critico + est.distribuicao.sem === est.totalAlunos,
  JSON.stringify(est.distribuicao));
checar("cobertura entre 0 e 100", est.cobertura >= 0 && est.cobertura <= 100, est.cobertura);
checar("previstas somam a matriz de cada estudante",
  est.previstas === Dados.alunos().reduce((s, a) => s + Dados.disciplinasDoAluno(a.id).length * cfg.bimestreAtual, 0),
  est.previstas);
checar("duas etapas no recorte", est.porEtapa.length === 2, est.porEtapa.map(e => e.curto).join(","));
checar("etapas somam o total de estudantes",
  est.porEtapa.reduce((s, e) => s + e.alunos, 0) === est.totalAlunos);
checar("7 turmas com estudantes", est.porTurma.length === 7, est.porTurma.length);
checar("exatas entre as piores médias",
  est.piores.slice(0, 5).some(d => ["mat", "fis", "qui"].indexOf(d.disciplina.id) > -1),
  est.piores.map(d => d.disciplina.sigla + ":" + d.media).join(" "));

const estFund = Dados.estatisticas({ etapa: "fundamental2" });
checar("recorte por etapa filtra estudantes", estFund.totalAlunos < est.totalAlunos, estFund.totalAlunos);
checar("recorte do Fundamental não traz componentes do Médio",
  !estFund.porDisciplina.some(d => ["bio", "fis", "qui", "fil", "soc"].indexOf(d.disciplina.id) > -1),
  estFund.porDisciplina.map(d => d.disciplina.sigla).join(","));
checar("recorte do Fundamental traz Ciências",
  estFund.porDisciplina.some(d => d.disciplina.id === "cie"));
const estTurma = Dados.estatisticas("tm1");
checar("recorte por turma", estTurma.totalAlunos === Dados.alunos({ turmaId: "tm1" }).length, estTurma.totalAlunos);
checar("recorte por turma usa a matriz do Médio", estTurma.porDisciplina.length === 12, estTurma.porDisciplina.length);

titulo("Classificação");
checar("aprovado", Dados.classificar(7, 4, 4).chave === "bom");
checar("recuperação", Dados.classificar(5, 4, 4).chave === "atencao");
checar("reprovado", Dados.classificar(3, 4, 4).chave === "critico");
checar("sem lançamento", Dados.classificar(null, 0, 4).chave === "sem");
checar("parcial marcado", Dados.classificar(7, 2, 4).parcial === true);
checar("rótulo fechado", Dados.classificar(7, 4, 4).rotulo === "Aprovado");
checar("6,0 exato é aprovação", Dados.classificar(6, 4, 4).chave === "bom");

titulo("Formatação");
checar("nota com vírgula", N.fmt.nota(8.5) === "8,5", N.fmt.nota(8.5));
checar("nota vazia", N.fmt.nota(null) === "—");
checar("data brasileira", N.fmt.data("2026-03-09") === "09/03/2026", N.fmt.data("2026-03-09"));
checar("data extensa", N.fmt.dataExtensa("2026-03-09") === "9 de março de 2026", N.fmt.dataExtensa("2026-03-09"));
checar("normalizar remove acento", N.normalizar("João Coração") === "joao coracao", N.normalizar("João Coração"));
checar("iniciais", N.iniciais("Ana Beatriz Nogueira Lima") === "AL", N.iniciais("Ana Beatriz Nogueira Lima"));
checar("iniciais ignoram partículas", N.iniciais("Marta Bispo dos Santos") === "MS", N.iniciais("Marta Bispo dos Santos"));
checar("plural", N.fmt.plural(1, "dia", "dias") === "1 dia");
checar("tamanho legível", N.fmt.tamanho(2048) === "2 KB", N.fmt.tamanho(2048));

titulo("Exportar / importar / persistência");
const pacote = Dados.exportar();
checar("exportação é JSON válido", (() => { try { JSON.parse(pacote); return true; } catch (e) { return false; } })());
const marcador = Dados.estado().usuarios.length;
Dados.importar(pacote);
checar("importação preserva usuários", Dados.estado().usuarios.length === marcador);
checar("gravou no armazenamento", !!armazem["omega.base.v1"]);
checar("dados relidos batem",
  JSON.parse(armazem["omega.base.v1"]).usuarios.length === Dados.estado().usuarios.length);
const kb = armazem["omega.base.v1"].length / 1024;
checar("base cabe folgado no localStorage (< 2 MB)", kb < 2048, kb.toFixed(0) + " KB");

console.log("\n=====================================");
console.log("  " + ok + " verificações ok, " + falhas + " falhas");
console.log("=====================================");
process.exit(falhas ? 1 : 0);
