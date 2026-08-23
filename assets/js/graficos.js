/* ==========================================================================
   graficos.js — graficos em SVG escritos a mao, sem biblioteca externa.

   O SVG e desenhado no tamanho real do container (nada de viewBox esticado),
   entao os textos saem sempre nitidos. Um ResizeObserver redesenha quando a
   largura muda.
   ========================================================================== */
(function (global) {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";

  const COR = {
    marca: "#1b4f9c",
    verde: "#1c7a4f",
    ambar: "#a86c0c",
    rubro: "#a53225",
    roxo: "#5b4b8a",
    grade: "#e5e9ed",
    eixo: "#c3ccd4",
    texto: "#55636f",
    texto2: "#8593a0",
    corte: "#a53225"
  };

  function no(tag, atrib) {
    const e = document.createElementNS(SVGNS, tag);
    if (atrib) Object.keys(atrib).forEach(k => e.setAttribute(k, atrib[k]));
    return e;
  }

  function texto(x, y, conteudo, atrib) {
    const t = no("text", Object.assign({
      x: x, y: y, fill: COR.texto, "font-size": "11",
      "font-family": "inherit"
    }, atrib || {}));
    t.textContent = conteudo;
    return t;
  }

  function fmtN(v, casas) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return Number(v).toFixed(casas === undefined ? 1 : casas).replace(".", ",");
  }

  function corPorNota(v, minima, recuperacao) {
    if (v === null || v === undefined) return COR.eixo;
    if (v >= (minima || 6)) return COR.verde;
    if (v >= (recuperacao || 4)) return COR.ambar;
    return COR.rubro;
  }

  /* -------------------------------------------------------------- Balao -- */
  let balao = null;
  function mostrarBalao(ev, html) {
    if (!balao) {
      balao = document.createElement("div");
      balao.className = "dica-grafico";
      document.body.appendChild(balao);
    }
    balao.innerHTML = html;
    balao.style.left = ev.clientX + "px";
    balao.style.top = ev.clientY + "px";
    balao.style.display = "block";
  }
  function esconderBalao() { if (balao) balao.style.display = "none"; }

  function ligarBalao(elemento, html) {
    elemento.style.cursor = "default";
    elemento.addEventListener("mousemove", e => mostrarBalao(e, html));
    elemento.addEventListener("mouseleave", esconderBalao);
  }

  /* ------------------------------------------------------- Infraestrutura */
  const observados = new WeakMap();

  function montar(container, cfg, desenhista) {
    container.classList.add("area-grafico");
    const desenhar = function () {
      const largura = Math.max(240, Math.floor(container.clientWidth));
      if (observados.get(container) === largura + "|" + cfg._selo) return;
      observados.set(container, largura + "|" + cfg._selo);
      container.innerHTML = "";
      const svg = desenhista(largura, cfg);
      svg.setAttribute("role", "img");
      if (cfg.descricao) {
        const t = no("title"); t.textContent = cfg.descricao;
        svg.insertBefore(t, svg.firstChild);
        svg.setAttribute("aria-label", cfg.descricao);
      }
      container.appendChild(svg);
    };

    cfg._selo = String(Math.random());
    desenhar();

    if (!container._observadorGrafico && "ResizeObserver" in global) {
      let ultimo = container.clientWidth;
      container._observadorGrafico = new ResizeObserver(function () {
        const l = container.clientWidth;
        if (Math.abs(l - ultimo) < 4) return;
        ultimo = l;
        container._redesenhar && container._redesenhar();
      });
      container._observadorGrafico.observe(container);
    }
    container._redesenhar = desenhar;
  }

  /* ================================================== Barras horizontais == */
  /**
   * cfg = { dados:[{rotulo, valor, sufixo, cor, detalhe}], max, corte:{valor,rotulo},
   *         corPorValor:true, alturaBarra, formato }
   */
  function barrasHorizontais(container, cfg) {
    montar(container, cfg, function (largura) {
      const dados = cfg.dados || [];
      const alturaBarra = cfg.alturaBarra || 20;
      const espaco = 12;
      const margemEsq = cfg.margemEsq || 128;
      const margemDir = 52;
      const topo = cfg.corte ? 20 : 6;
      const altura = topo + dados.length * (alturaBarra + espaco) + 8;
      const larguraUtil = Math.max(60, largura - margemEsq - margemDir);
      const max = cfg.max || Math.max.apply(null, dados.map(d => d.valor || 0).concat([1]));

      const svg = no("svg", { width: largura, height: altura });

      // Linha de corte (a media minima da escola, por exemplo)
      if (cfg.corte) {
        const x = margemEsq + (cfg.corte.valor / max) * larguraUtil;
        svg.appendChild(no("line", {
          x1: x, y1: topo - 6, x2: x, y2: altura - 6,
          stroke: COR.corte, "stroke-width": 1, "stroke-dasharray": "3 3", opacity: .65
        }));
        svg.appendChild(texto(x, topo - 10, cfg.corte.rotulo || ("média " + fmtN(cfg.corte.valor)), {
          "text-anchor": "middle", "font-size": "10", "font-weight": "700", fill: COR.corte
        }));
      }

      dados.forEach(function (d, i) {
        const y = topo + i * (alturaBarra + espaco);
        const valor = d.valor === null || d.valor === undefined ? 0 : d.valor;
        const w = Math.max(2, (valor / max) * larguraUtil);
        const cor = d.cor || (cfg.corPorValor ? corPorNota(d.valor, cfg.corte && cfg.corte.valor, cfg.recuperacao) : COR.marca);

        // trilho
        svg.appendChild(no("rect", {
          x: margemEsq, y: y, width: larguraUtil, height: alturaBarra,
          rx: 3, fill: "#eef1f4"
        }));

        const barra = no("rect", { x: margemEsq, y: y, width: w, height: alturaBarra, rx: 3, fill: cor });
        svg.appendChild(barra);

        const rot = texto(margemEsq - 10, y + alturaBarra / 2 + 4, d.rotulo, {
          "text-anchor": "end", "font-size": "11.5", fill: "#17242f", "font-weight": "500"
        });
        svg.appendChild(rot);

        svg.appendChild(texto(margemEsq + larguraUtil + 8, y + alturaBarra / 2 + 4,
          d.valor === null ? "—" : (cfg.formato ? cfg.formato(d.valor) : fmtN(d.valor)) + (d.sufixo || ""), {
          "text-anchor": "start", "font-size": "11.5", "font-weight": "700", fill: "#17242f"
        }));

        const alvo = no("rect", {
          x: 0, y: y - espaco / 2, width: largura, height: alturaBarra + espaco,
          fill: "transparent"
        });
        ligarBalao(alvo, "<b>" + d.rotulo + "</b><br>" +
          (cfg.formato ? cfg.formato(d.valor) : fmtN(d.valor)) + (d.sufixo || "") +
          (d.detalhe ? "<br>" + d.detalhe : ""));
        svg.appendChild(alvo);
      });

      return svg;
    });
  }

  /* ==================================================== Barras verticais == */
  /** cfg = { dados:[{rotulo, valor, cor, detalhe}], max, corte, formato } */
  function barras(container, cfg) {
    montar(container, cfg, function (largura) {
      const dados = cfg.dados || [];
      const altura = cfg.altura || 210;
      const margem = { topo: 14, dir: 10, base: 30, esq: 34 };
      const areaL = largura - margem.esq - margem.dir;
      const areaA = altura - margem.topo - margem.base;
      const max = cfg.max || Math.max.apply(null, dados.map(d => d.valor || 0).concat([1]));
      const passo = areaL / Math.max(1, dados.length);
      const largBarra = Math.min(cfg.larguraMax || 46, passo * 0.62);

      const svg = no("svg", { width: largura, height: altura });

      // grade + eixo Y
      const marcas = cfg.marcas || [0, max / 2, max];
      marcas.forEach(function (m) {
        const y = margem.topo + areaA - (m / max) * areaA;
        svg.appendChild(no("line", {
          x1: margem.esq, y1: y, x2: largura - margem.dir, y2: y,
          stroke: COR.grade, "stroke-width": 1
        }));
        svg.appendChild(texto(margem.esq - 8, y + 4, fmtN(m, cfg.casasEixo === undefined ? 0 : cfg.casasEixo), {
          "text-anchor": "end", "font-size": "10", fill: COR.texto2
        }));
      });

      if (cfg.corte) {
        const y = margem.topo + areaA - (cfg.corte.valor / max) * areaA;
        svg.appendChild(no("line", {
          x1: margem.esq, y1: y, x2: largura - margem.dir, y2: y,
          stroke: COR.corte, "stroke-width": 1.2, "stroke-dasharray": "4 3", opacity: .75
        }));
      }

      dados.forEach(function (d, i) {
        const cx = margem.esq + passo * i + passo / 2;
        const valor = d.valor === null || d.valor === undefined ? 0 : d.valor;
        const h = Math.max(d.valor === null ? 0 : 2, (valor / max) * areaA);
        const y = margem.topo + areaA - h;
        const cor = d.cor || (cfg.corPorValor ? corPorNota(d.valor, cfg.corte && cfg.corte.valor) : COR.marca);

        if (d.valor !== null) {
          svg.appendChild(no("rect", {
            x: cx - largBarra / 2, y: y, width: largBarra, height: h, rx: 3, fill: cor
          }));
          svg.appendChild(texto(cx, y - 6, cfg.formato ? cfg.formato(d.valor) : fmtN(d.valor), {
            "text-anchor": "middle", "font-size": "11", "font-weight": "700", fill: "#17242f"
          }));
        } else {
          svg.appendChild(no("rect", {
            x: cx - largBarra / 2, y: margem.topo + areaA - 3, width: largBarra, height: 3,
            rx: 1.5, fill: "#dde2e7"
          }));
        }

        svg.appendChild(texto(cx, altura - 10, d.rotulo, {
          "text-anchor": "middle", "font-size": "10.5", fill: COR.texto
        }));

        const alvo = no("rect", { x: cx - passo / 2, y: 0, width: passo, height: altura, fill: "transparent" });
        ligarBalao(alvo, "<b>" + d.rotulo + "</b><br>" +
          (d.valor === null ? "sem lançamento" : (cfg.formato ? cfg.formato(d.valor) : fmtN(d.valor))) +
          (d.detalhe ? "<br>" + d.detalhe : ""));
        svg.appendChild(alvo);
      });

      // eixo base
      svg.appendChild(no("line", {
        x1: margem.esq, y1: margem.topo + areaA, x2: largura - margem.dir, y2: margem.topo + areaA,
        stroke: COR.eixo, "stroke-width": 1
      }));

      return svg;
    });
  }

  /* ================================================================ Linha = */
  /** cfg = { rotulos:[], series:[{nome, cor, pontos:[]}], max, corte, area:true } */
  function linha(container, cfg) {
    montar(container, cfg, function (largura) {
      const altura = cfg.altura || 220;
      const margem = { topo: 16, dir: 16, base: 30, esq: 34 };
      const areaL = largura - margem.esq - margem.dir;
      const areaA = altura - margem.topo - margem.base;
      const rotulos = cfg.rotulos || [];
      const max = cfg.max || 10;
      const passo = rotulos.length > 1 ? areaL / (rotulos.length - 1) : 0;

      const svg = no("svg", { width: largura, height: altura });
      const marcas = cfg.marcas || [0, 2, 4, 6, 8, 10];

      marcas.forEach(function (m) {
        const y = margem.topo + areaA - (m / max) * areaA;
        svg.appendChild(no("line", {
          x1: margem.esq, y1: y, x2: largura - margem.dir, y2: y,
          stroke: m === (cfg.corte && cfg.corte.valor) ? COR.corte : COR.grade,
          "stroke-width": 1,
          "stroke-dasharray": m === (cfg.corte && cfg.corte.valor) ? "4 3" : "0",
          opacity: m === (cfg.corte && cfg.corte.valor) ? .7 : 1
        }));
        svg.appendChild(texto(margem.esq - 8, y + 4, fmtN(m, 0), {
          "text-anchor": "end", "font-size": "10", fill: COR.texto2
        }));
      });

      rotulos.forEach(function (r, i) {
        svg.appendChild(texto(margem.esq + passo * i, altura - 10, r, {
          "text-anchor": "middle", "font-size": "10.5", fill: COR.texto
        }));
      });

      (cfg.series || []).forEach(function (serie) {
        const cor = serie.cor || COR.marca;
        const pts = [];
        serie.pontos.forEach(function (v, i) {
          if (v === null || v === undefined) return;
          pts.push({
            x: margem.esq + passo * i,
            y: margem.topo + areaA - (v / max) * areaA,
            v: v, rotulo: rotulos[i]
          });
        });
        if (!pts.length) return;

        if (cfg.area && pts.length > 1) {
          let d = "M" + pts[0].x + "," + (margem.topo + areaA);
          pts.forEach(p => { d += " L" + p.x + "," + p.y; });
          d += " L" + pts[pts.length - 1].x + "," + (margem.topo + areaA) + " Z";
          svg.appendChild(no("path", { d: d, fill: cor, opacity: .1 }));
        }

        let linhaD = "";
        pts.forEach(function (p, i) { linhaD += (i ? " L" : "M") + p.x + "," + p.y; });
        svg.appendChild(no("path", {
          d: linhaD, fill: "none", stroke: cor, "stroke-width": 2.2,
          "stroke-linecap": "round", "stroke-linejoin": "round"
        }));

        pts.forEach(function (p) {
          svg.appendChild(no("circle", { cx: p.x, cy: p.y, r: 4.2, fill: "#fff", stroke: cor, "stroke-width": 2.2 }));
          const alvo = no("circle", { cx: p.x, cy: p.y, r: 14, fill: "transparent" });
          ligarBalao(alvo, "<b>" + (serie.nome || "") + "</b><br>" + p.rotulo + ": " + fmtN(p.v));
          svg.appendChild(alvo);
        });
      });

      return svg;
    });
  }

  /* ================================================================ Rosca = */
  /** cfg = { dados:[{rotulo, valor, cor}], centro:{valor, rotulo}, espessura } */
  function rosca(container, cfg) {
    montar(container, cfg, function (largura) {
      const altura = cfg.altura || 200;
      const dados = (cfg.dados || []).filter(d => d.valor > 0);
      const total = dados.reduce((a, d) => a + d.valor, 0);
      const cx = largura / 2, cy = altura / 2;
      const raio = Math.min(largura, altura) / 2 - 8;
      const esp = cfg.espessura || 26;
      const svg = no("svg", { width: largura, height: altura });

      if (!total) {
        svg.appendChild(no("circle", { cx: cx, cy: cy, r: raio - esp / 2, fill: "none", stroke: "#eef1f4", "stroke-width": esp }));
        svg.appendChild(texto(cx, cy + 4, "sem dados", { "text-anchor": "middle", "font-size": "12", fill: COR.texto2 }));
        return svg;
      }

      let angulo = -Math.PI / 2;
      dados.forEach(function (d) {
        const fatia = (d.valor / total) * Math.PI * 2;
        const fim = angulo + fatia;
        const r = raio - esp / 2;
        const x1 = cx + r * Math.cos(angulo), y1 = cy + r * Math.sin(angulo);
        const x2 = cx + r * Math.cos(fim), y2 = cy + r * Math.sin(fim);
        const grande = fatia > Math.PI ? 1 : 0;

        // Circulo completo precisa de dois arcos para nao virar um ponto.
        let caminho;
        if (dados.length === 1) {
          caminho = no("circle", { cx: cx, cy: cy, r: r, fill: "none", stroke: d.cor, "stroke-width": esp });
        } else {
          caminho = no("path", {
            d: "M" + x1 + "," + y1 + " A" + r + "," + r + " 0 " + grande + " 1 " + x2 + "," + y2,
            fill: "none", stroke: d.cor, "stroke-width": esp
          });
        }
        ligarBalao(caminho, "<b>" + d.rotulo + "</b><br>" + d.valor + " (" +
          fmtN((d.valor / total) * 100, 0) + "%)");
        svg.appendChild(caminho);
        angulo = fim;
      });

      if (cfg.centro) {
        svg.appendChild(texto(cx, cy + 2, String(cfg.centro.valor), {
          "text-anchor": "middle", "font-size": "26", "font-weight": "700", fill: "#17242f"
        }));
        svg.appendChild(texto(cx, cy + 20, cfg.centro.rotulo, {
          "text-anchor": "middle", "font-size": "10.5", fill: COR.texto2
        }));
      }
      return svg;
    });
  }

  /* ============================================================== Legenda = */
  function legenda(container, itens) {
    container.className = "legenda";
    container.innerHTML = itens.map(function (i) {
      return '<span><i style="background:' + i.cor + '"></i>' + i.rotulo +
        (i.valor !== undefined ? ' <b style="color:#17242f">' + i.valor + "</b>" : "") + "</span>";
    }).join("");
  }

  global.Graficos = {
    barras: barras, barrasHorizontais: barrasHorizontais, linha: linha,
    rosca: rosca, legenda: legenda, COR: COR, corPorNota: corPorNota
  };
})(window);
