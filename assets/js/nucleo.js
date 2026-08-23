/* ==========================================================================
   nucleo.js — utilidades compartilhadas: DOM, formatacao, icones, avisos,
   modais e caixas de confirmacao.
   ========================================================================== */
(function (global) {
  "use strict";

  /* ----------------------------------------------------------------- DOM -- */
  const $  = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));

  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /** Cria elemento a partir de uma string de HTML (usa o primeiro nó). */
  function deHtml(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /** Delegacao de eventos: raiz.on("click", ".seletor", fn) */
  function delegar(raiz, evento, seletor, fn) {
    raiz.addEventListener(evento, function (e) {
      const alvo = e.target.closest(seletor);
      if (alvo && raiz.contains(alvo)) fn.call(alvo, e, alvo);
    });
  }

  function debounce(fn, ms) {
    let id;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(id);
      id = setTimeout(() => fn.apply(ctx, args), ms || 220);
    };
  }

  /* --------------------------------------------------------- Formatacao -- */
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira",
    "quinta-feira", "sexta-feira", "sábado"];

  /** "2026-03-14" -> Date local (evita o deslocamento de fuso do parser ISO). */
  function dataDe(iso) {
    if (!iso) return null;
    if (iso instanceof Date) return iso;
    const p = String(iso).slice(0, 10).split("-");
    if (p.length !== 3) return new Date(iso);
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function isoDe(d) {
    const z = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  }

  function hojeIso() { return isoDe(new Date()); }

  /** Diferenca em dias inteiros entre hoje e uma data ISO (negativo = passado). */
  function diasAte(iso) {
    const alvo = dataDe(iso);
    if (!alvo) return null;
    const h = new Date();
    h.setHours(0, 0, 0, 0);
    alvo.setHours(0, 0, 0, 0);
    return Math.round((alvo - h) / 86400000);
  }

  const fmt = {
    /** 8.5 -> "8,5" ; null -> "—" */
    nota(v, vazio) {
      if (v === null || v === undefined || v === "" || isNaN(v)) return vazio === undefined ? "—" : vazio;
      return Number(v).toFixed(1).replace(".", ",");
    },
    decimal(v, casas) {
      if (v === null || v === undefined || isNaN(v)) return "—";
      return Number(v).toFixed(casas === undefined ? 1 : casas).replace(".", ",");
    },
    percentual(v, casas) {
      if (v === null || v === undefined || isNaN(v)) return "—";
      return Number(v).toFixed(casas === undefined ? 0 : casas).replace(".", ",") + "%";
    },
    data(iso) {
      const d = dataDe(iso);
      if (!d || isNaN(d)) return "—";
      const z = n => String(n).padStart(2, "0");
      return z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear();
    },
    dataCurta(iso) {
      const d = dataDe(iso);
      if (!d || isNaN(d)) return "—";
      return String(d.getDate()).padStart(2, "0") + " " + MESES_CURTO[d.getMonth()];
    },
    dataExtensa(iso) {
      const d = dataDe(iso);
      if (!d || isNaN(d)) return "—";
      return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear();
    },
    diaSemana(iso) {
      const d = dataDe(iso);
      return d && !isNaN(d) ? DIAS_SEMANA[d.getDay()] : "";
    },
    /** Carimbo completo a partir de um ISO com hora. */
    dataHora(isoCompleto) {
      const d = new Date(isoCompleto);
      if (isNaN(d)) return "—";
      const z = n => String(n).padStart(2, "0");
      return z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear() +
        " às " + z(d.getHours()) + ":" + z(d.getMinutes());
    },
    /** "há 3 dias", "agora mesmo" ... */
    relativo(isoCompleto) {
      const d = new Date(isoCompleto);
      if (isNaN(d)) return "—";
      const seg = Math.floor((Date.now() - d.getTime()) / 1000);
      if (seg < 60) return "agora mesmo";
      if (seg < 3600) { const m = Math.floor(seg / 60); return "há " + m + (m === 1 ? " minuto" : " minutos"); }
      if (seg < 86400) { const h = Math.floor(seg / 3600); return "há " + h + (h === 1 ? " hora" : " horas"); }
      const dias = Math.floor(seg / 86400);
      if (dias < 30) return "há " + dias + (dias === 1 ? " dia" : " dias");
      return fmt.data(d);
    },
    tamanho(bytes) {
      if (!bytes) return "0 KB";
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1048576) return (bytes / 1024).toFixed(0) + " KB";
      return (bytes / 1048576).toFixed(1).replace(".", ",") + " MB";
    },
    plural(n, singular, plural) {
      return n + " " + (n === 1 ? singular : plural);
    }
  };

  /** Faixa de sinais diacriticos combinantes (U+0300 a U+036F). */
  var RE_ACENTOS = new RegExp("[" + String.fromCharCode(768) + "-" + String.fromCharCode(879) + "]", "g");

  /** Remove acentos e caixa para comparacoes de busca. */
  function normalizar(txt) {
    return String(txt || "").normalize("NFD").replace(RE_ACENTOS, "").toLowerCase().trim();
  }

  const PARTICULAS = /^(de|da|do|das|dos|e)$/i;

  function iniciais(nome) {
    const partes = String(nome || "").trim().split(/\s+/).filter(p => p && !PARTICULAS.test(p));
    if (!partes.length) return "?";
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  function primeiroNome(nome) { return String(nome || "").trim().split(/\s+/)[0] || ""; }

  /** Gera um identificador curto e estavel o suficiente para uso local. */
  let contadorId = 0;
  function novoId(prefixo) {
    contadorId += 1;
    return (prefixo || "id") + "_" + Date.now().toString(36) + contadorId.toString(36) +
      Math.floor(Math.random() * 1296).toString(36);
  }

  /* --------------------------------------------------------------- Icones - */
  const TRACOS = {
    grade: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
    usuarios: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    usuario: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    usuarioMais: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
    livro: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    barras: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
    pizza: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    prancheta: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
    sino: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    engrenagem: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    mais: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    lapis: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    lixeira: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    busca: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    filtro: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    imprimir: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    olho: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    olhoOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checkCirculo: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    alerta: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    relogio: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    clipe: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    arquivo: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>',
    imagem: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    chevronDir: '<polyline points="9 18 15 12 9 6"/>',
    chevronBaixo: '<polyline points="6 9 12 15 18 9"/>',
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    predio: '<path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    tendencia: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    cadeado: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    email: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    telefone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    salvar: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    atualizar: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    estrela: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    formatura: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"/>',
    alvo: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    lista: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    raio: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    caixa: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    chave: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"/>',
    externo: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'
  };

  /**
   * Símbolo Ômega da instituição. `tom` define a cor do traço (herda a cor do
   * texto por padrão) e `barra` liga o filete vermelho da marca.
   */
  function Marca(opcoes) {
    const o = opcoes || {};
    return '<svg class="marca-omega" viewBox="0 0 64 64" fill="none" aria-hidden="true">' +
      '<path d="M18 45h10v-4a14 14 0 1 1 8 0v4h10" stroke="' + (o.tom || "currentColor") +
      '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
      (o.barra === false ? "" : '<rect x="18" y="52" width="28" height="4" rx="2" fill="#c1272d"/>') +
      "</svg>";
  }

  /** Devolve o markup de um icone. Uso: Icone("busca") */
  function Icone(nome, extra) {
    const d = TRACOS[nome];
    if (!d) return "";
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      (extra ? ' class="' + extra + '"' : "") + ">" + d + "</svg>";
  }

  /* ---------------------------------------------------------- Avisos ------ */
  function pilhaAvisos() {
    let p = document.getElementById("avisos");
    if (!p) {
      p = document.createElement("div");
      p.id = "avisos";
      p.setAttribute("role", "status");
      p.setAttribute("aria-live", "polite");
      document.body.appendChild(p);
    }
    return p;
  }

  const ICONE_AVISO = { ok: "checkCirculo", erro: "alerta", alerta: "alerta", info: "info" };

  /**
   * notificar("Nota salva", "ok")
   * notificar({ titulo: "Nova nota", texto: "Matemática — 3º bimestre", tipo: "ok", ms: 6000 })
   */
  function notificar(opcoes, tipo) {
    const o = typeof opcoes === "string" ? { texto: opcoes, tipo: tipo || "info" } : (opcoes || {});
    const t = o.tipo || "info";
    const cx = document.createElement("div");
    cx.className = "aviso-flutuante " + t;
    cx.innerHTML = Icone(ICONE_AVISO[t] || "info") +
      "<div>" + (o.titulo ? "<strong>" + esc(o.titulo) + "</strong>" : "") + esc(o.texto || "") + "</div>";
    pilhaAvisos().appendChild(cx);
    const some = () => {
      cx.classList.add("saindo");
      setTimeout(() => cx.remove(), 200);
    };
    setTimeout(some, o.ms || 3800);
    cx.addEventListener("click", some);
    return cx;
  }

  /* ----------------------------------------------------------- Modais ----- */
  let modalAberto = null;
  let focoAnterior = null;

  /**
   * abrirModal({
   *   titulo, subtitulo, conteudo (HTML|Element), largura: "largo"|"estreito",
   *   acoes: [{ rotulo, classe, valor, tipo:"submit" }], aoAbrir(corpo, api), aoConfirmar(api)
   * })
   */
  function abrirModal(cfg) {
    fecharModal();
    focoAnterior = document.activeElement;

    const fundo = document.createElement("div");
    fundo.className = "fundo-modal";
    fundo.setAttribute("role", "dialog");
    fundo.setAttribute("aria-modal", "true");

    const cx = document.createElement("div");
    cx.className = "modal" + (cfg.largura ? " " + cfg.largura : "");

    const topo = document.createElement("div");
    topo.className = "modal-topo";
    topo.innerHTML =
      "<div><h3>" + esc(cfg.titulo || "") + "</h3>" +
      (cfg.subtitulo ? '<div class="sub">' + esc(cfg.subtitulo) + "</div>" : "") + "</div>" +
      '<button type="button" class="btn btn-icone" data-fechar aria-label="Fechar">' + Icone("x") + "</button>";

    const corpo = document.createElement("div");
    corpo.className = "modal-corpo";
    if (typeof cfg.conteudo === "string") corpo.innerHTML = cfg.conteudo;
    else if (cfg.conteudo) corpo.appendChild(cfg.conteudo);

    cx.appendChild(topo);
    cx.appendChild(corpo);

    let rodape = null;
    if (cfg.acoes && cfg.acoes.length) {
      rodape = document.createElement("div");
      rodape.className = "modal-rodape";
      cfg.acoes.forEach(function (a) {
        const b = document.createElement("button");
        b.type = a.tipo || "button";
        b.className = "btn " + (a.classe || "btn-neutro") + (a.esquerda ? " esquerda" : "");
        b.innerHTML = (a.icone ? Icone(a.icone) : "") + "<span>" + esc(a.rotulo) + "</span>";
        if (a.valor === "fechar") b.setAttribute("data-fechar", "");
        if (a.aoClicar) b.addEventListener("click", function (e) { a.aoClicar(e, api); });
        rodape.appendChild(b);
      });
      cx.appendChild(rodape);
    }

    fundo.appendChild(cx);
    document.body.appendChild(fundo);
    document.body.style.overflow = "hidden";

    const api = {
      elemento: fundo, corpo: corpo, rodape: rodape,
      fechar: fecharModal,
      $: function (s) { return corpo.querySelector(s); },
      $$: function (s) { return $$(s, corpo); }
    };

    delegar(fundo, "click", "[data-fechar]", fecharModal);
    fundo.addEventListener("mousedown", function (e) { if (e.target === fundo) fecharModal(); });

    modalAberto = fundo;
    document.addEventListener("keydown", teclaModal);

    // foco inicial no primeiro campo util
    const primeiro = corpo.querySelector("input:not([type=hidden]), select, textarea, button");
    if (primeiro) setTimeout(() => primeiro.focus(), 40);

    if (cfg.aoAbrir) cfg.aoAbrir(corpo, api);
    return api;
  }

  function teclaModal(e) {
    if (!modalAberto) return;
    if (e.key === "Escape") { e.preventDefault(); fecharModal(); return; }
    if (e.key !== "Tab") return;
    const focaveis = $$("a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])", modalAberto)
      .filter(el => el.offsetParent !== null);
    if (!focaveis.length) return;
    const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  }

  function fecharModal() {
    if (!modalAberto) return;
    modalAberto.remove();
    modalAberto = null;
    document.body.style.overflow = "";
    document.removeEventListener("keydown", teclaModal);
    if (focoAnterior && focoAnterior.focus) { try { focoAnterior.focus(); } catch (e) { /* ignora */ } }
  }

  /** Caixa de confirmacao. Devolve Promise<boolean>. */
  function confirmar(cfg) {
    const o = typeof cfg === "string" ? { texto: cfg } : (cfg || {});
    return new Promise(function (resolver) {
      let respondido = false;
      const responder = function (v) { if (!respondido) { respondido = true; resolver(v); } };
      const api = abrirModal({
        titulo: o.titulo || "Confirmar operação",
        largura: "estreito",
        conteudo: '<p class="medio texto-2" style="margin:0">' + esc(o.texto || "") + "</p>",
        acoes: [
          { rotulo: o.rotuloCancelar || "Cancelar", classe: "btn-neutro", aoClicar: function () { responder(false); fecharModal(); } },
          { rotulo: o.rotuloOk || "Confirmar", classe: o.perigo ? "btn-perigo" : "btn-principal", aoClicar: function () { responder(true); fecharModal(); } }
        ]
      });
      const obs = new MutationObserver(function () {
        if (!document.body.contains(api.elemento)) { obs.disconnect(); responder(false); }
      });
      obs.observe(document.body, { childList: true });
    });
  }

  /* ------------------------------------------------------- Utilitarios --- */
  function baixar(nomeArquivo, conteudo, mime) {
    const blob = new Blob([conteudo], { type: mime || "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nomeArquivo;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  function ordenarPor(campo, crescente) {
    const dir = crescente === false ? -1 : 1;
    return function (a, b) {
      const x = typeof campo === "function" ? campo(a) : a[campo];
      const y = typeof campo === "function" ? campo(b) : b[campo];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      if (typeof x === "string") return x.localeCompare(y, "pt-BR") * dir;
      return (x < y ? -1 : 1) * dir;
    };
  }

  function agrupar(lista, chave) {
    return lista.reduce(function (acc, item) {
      const k = typeof chave === "function" ? chave(item) : item[chave];
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  }

  function media(valores) {
    const v = valores.filter(n => n !== null && n !== undefined && !isNaN(n));
    if (!v.length) return null;
    return v.reduce((a, b) => a + Number(b), 0) / v.length;
  }

  function limitar(n, min, max) { return Math.min(max, Math.max(min, n)); }

  /* Exposicao ------------------------------------------------------------- */
  global.N = {
    $: $, $$: $$, esc: esc, deHtml: deHtml, delegar: delegar, debounce: debounce,
    fmt: fmt, dataDe: dataDe, isoDe: isoDe, hojeIso: hojeIso, diasAte: diasAte,
    normalizar: normalizar, iniciais: iniciais, primeiroNome: primeiroNome, novoId: novoId,
    Icone: Icone, Marca: Marca, notificar: notificar,
    abrirModal: abrirModal, fecharModal: fecharModal, confirmar: confirmar,
    baixar: baixar, ordenarPor: ordenarPor, agrupar: agrupar, media: media, limitar: limitar,
    MESES: MESES, MESES_CURTO: MESES_CURTO
  };
})(window);
