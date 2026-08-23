/* ==========================================================================
   sessao.js — autenticacao e controle de acesso.

   A sessao vive em sessionStorage (e nao em localStorage) de proposito: assim
   cada aba do navegador pode estar logada com um usuario diferente. E isso
   que permite abrir o professor numa aba e o aluno na outra para ver o
   boletim sendo atualizado ao vivo.
   ========================================================================== */
(function (global) {
  "use strict";

  const CHAVE = "omega.sessao.v1";

  const PAGINAS = {
    gestor: "gestor.html",
    professor: "professor.html",
    aluno: "aluno.html"
  };

  const ROTULOS = {
    gestor: "Gestão escolar",
    professor: "Corpo docente",
    aluno: "Estudante"
  };

  // Nomes exibidos no seletor de perfil da tela de acesso.
  const NOMES_FORM = { gestor: "Gestão", professor: "Professor", aluno: "Aluno" };

  function ler() {
    try {
      const bruto = sessionStorage.getItem(CHAVE);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) { return null; }
  }

  function escrever(s) {
    if (s) sessionStorage.setItem(CHAVE, JSON.stringify(s));
    else sessionStorage.removeItem(CHAVE);
  }

  /** Usuario logado nesta aba (ou null). */
  function atual() {
    const s = ler();
    if (!s) return null;
    const u = Dados.usuario(s.usuarioId);
    if (!u || !u.ativo) { escrever(null); return null; }
    return u;
  }

  function contexto() {
    const s = ler();
    if (!s) return null;
    return {
      usuario: atual(),
      personificando: !!s.gestorOrigem,
      gestorOrigem: s.gestorOrigem ? Dados.usuario(s.gestorOrigem) : null
    };
  }

  /**
   * Tenta autenticar. Aceita e-mail ou matricula como identificador.
   * Devolve { ok:true, usuario } ou { ok:false, erro, campo }.
   */
  function entrar(identificador, senha, papelEsperado) {
    const u = Dados.acharPorLogin(identificador);
    if (!u) return { ok: false, erro: "Não encontramos nenhuma conta com esse e-mail ou matrícula.", campo: "identificador" };
    if (!Dados.conferirSenha(u, senha)) return { ok: false, erro: "Senha incorreta. Verifique e tente novamente.", campo: "senha" };
    if (!u.ativo) return { ok: false, erro: "Esta conta está desativada. Procure a secretaria da escola.", campo: "identificador" };
    if (papelEsperado && u.papel !== papelEsperado) {
      return {
        ok: false,
        erro: "Esta conta é do perfil " + (NOMES_FORM[u.papel] || u.papel) + ". Selecione esse perfil para continuar.",
        campo: "perfil"
      };
    }
    escrever({ usuarioId: u.id, em: Date.now() });
    Dados.marcarAcesso(u.id);
    return { ok: true, usuario: u };
  }

  function sair() {
    escrever(null);
    location.href = "index.html";
  }

  /**
   * Protege uma pagina interna. Se ninguem estiver logado, ou o papel nao
   * bater, devolve para o portal. Sempre chamar no inicio do script da pagina.
   */
  function exigir(papel) {
    const u = atual();
    if (!u) {
      sessionStorage.setItem("omega.destino", location.pathname.split("/").pop() + location.hash);
      location.replace("index.html?acesso=necessario");
      return null;
    }
    if (papel && u.papel !== papel) {
      location.replace(PAGINAS[u.papel] || "index.html");
      return null;
    }
    return u;
  }

  /**
   * "Acessar como": o gestor assume temporariamente a conta de um professor
   * ou aluno para conferir o que a pessoa enxerga. Fica registrado na
   * auditoria e um aviso permanente aparece no topo da tela.
   */
  function personificar(usuarioId) {
    const s = ler();
    const eu = atual();
    if (!eu || eu.papel !== "gestor") return false;
    const alvo = Dados.usuario(usuarioId);
    if (!alvo || !alvo.ativo) return false;

    escrever({ usuarioId: alvo.id, gestorOrigem: s.gestorOrigem || eu.id, em: Date.now() });
    Dados.registrar({
      tipo: "info", autorId: eu.id, acao: "Acesso assistido",
      detalhe: eu.nome + " abriu o sistema com a conta de " + alvo.nome + " (" + ROTULOS[alvo.papel].toLowerCase() + ")."
    });
    location.href = PAGINAS[alvo.papel];
    return true;
  }

  function encerrarPersonificacao() {
    const s = ler();
    if (!s || !s.gestorOrigem) return false;
    escrever({ usuarioId: s.gestorOrigem, em: Date.now() });
    location.href = PAGINAS.gestor;
    return true;
  }

  function paginaDe(papel) { return PAGINAS[papel] || "index.html"; }
  function rotuloDe(papel) { return ROTULOS[papel] || papel; }

  global.Sessao = {
    atual: atual, contexto: contexto, entrar: entrar, sair: sair, exigir: exigir,
    personificar: personificar, encerrarPersonificacao: encerrarPersonificacao,
    paginaDe: paginaDe, rotuloDe: rotuloDe, PAPEIS: ROTULOS
  };
})(window);
