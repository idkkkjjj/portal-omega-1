/* ==========================================================================
   boletim.js — montagem da tabela de boletim.

   A mesma tabela serve para o aluno (somente leitura) e para a gestao
   (celulas editaveis). Isso evita ter duas versoes que sairiam do ar uma da
   outra na primeira mudanca de regra.
   ========================================================================== */
(function (global) {
  "use strict";

  const { esc, fmt, Icone } = N;

  const BIMESTRES = [1, 2, 3, 4];

  function classeNota(valor, minima) {
    if (valor === null || valor === undefined) return "vaga";
    return valor < minima ? "abaixo" : "";
  }

  /** Cabecalho com os dados do estudante e o resumo do desempenho. */
  function cabecalho(aluno, dados) {
    const t = Dados.turma(aluno.turmaId);
    const c = Dados.config();
    const abaixo = dados.abaixo.length;
    return '<div class="cabecalho-boletim">' +
      '<div class="identificacao">' +
        '<span class="avatar g roxo">' + N.iniciais(aluno.nome) + "</span>" +
        "<div><h2>" + esc(aluno.nome) + "</h2>" +
        '<div class="meta">Matrícula ' + esc(aluno.matricula) + " · " + esc(t ? t.nome : "sem turma") +
        (t ? " · " + esc(Dados.etapaCurta(t.etapa)) + " · " + esc(t.turno) : "") +
        " · Ano letivo " + c.anoLetivo + "</div></div>" +
      "</div>" +
      '<div class="resumo">' +
        '<div class="item"><div class="r">Média geral</div>' +
          '<div class="v" style="color:' + Graficos.corPorNota(dados.mediaGeral, c.mediaMinima, c.mediaRecuperacao) + '">' +
          fmt.nota(dados.mediaGeral) + "</div></div>" +
        '<div class="item"><div class="r">Abaixo da média</div><div class="v">' +
          abaixo + '<span style="font-size:.8rem;font-weight:500;color:var(--texto-2)"> de ' +
          Dados.disciplinasDoAluno(aluno.id).length + "</span></div></div>" +
        '<div class="item"><div class="r">Notas lançadas</div><div class="v">' +
          dados.totalLancadas + '<span style="font-size:.8rem;font-weight:500;color:var(--texto-2)"> / ' +
          dados.totalPrevistas + "</span></div></div>" +
        '<div class="item"><div class="r">Situação</div><div class="v" style="font-size:.95rem;padding-top:6px">' +
          Casca.selo(dados.situacaoGeral) + "</div></div>" +
      "</div></div>";
  }

  /** Papel timbrado que so aparece na impressao. */
  function timbrado(aluno) {
    const c = Dados.config();
    const t = Dados.turma(aluno.turmaId);
    return '<div class="papel-timbrado">' +
      "<h1>" + esc(c.escola) + "</h1>" +
      "<p>" + esc(c.endereco || "") + " — " + esc(c.cidade) + "/" + esc(c.uf) +
      " · CEP " + esc(c.cep || "") + " · INEP " + esc(c.inep) + " · " + esc(c.telefone || "") + "</p>" +
      '<p style="margin-top:8px"><strong>Boletim escolar — ' + c.anoLetivo + "</strong> · " +
      esc(aluno.nome) + " · Matrícula " + esc(aluno.matricula) + " · " + esc(t ? t.nome : "") +
      (t ? " · " + esc(Dados.nomeEtapa(t.etapa)) : "") + "</p>" +
      "</div>";
  }

  /**
   * Tabela do boletim.
   * opcoes = { editavel, mostrarMeta (dica de quanto falta), destacar:[chaves] }
   */
  function tabela(alunoId, opcoes) {
    const o = opcoes || {};
    const c = Dados.config();
    const dados = Dados.boletim(alunoId);

    const linhas = dados.linhas.map(function (l) {
      const celulas = BIMESTRES.map(function (b) {
        const n = l.bimestres[b - 1];
        const chave = l.disciplina.id + ":" + b;
        if (o.editavel) {
          const cls = n ? (n.valor < c.mediaMinima ? "baixa" : "boa") : "";
          return '<td class="centro"><input class="nota-in ' + cls + '" type="text" inputmode="decimal" ' +
            'value="' + (n ? fmt.nota(n.valor) : "") + '" ' +
            'data-disciplina="' + l.disciplina.id + '" data-bimestre="' + b + '" ' +
            'aria-label="' + esc(l.disciplina.nome) + ", " + b + 'º bimestre" ' +
            'title="' + (n ? "Lançada por " + esc(Dados.nomeUsuario(n.lancadoPor)) + " em " + fmt.dataHora(n.lancadoEm) +
              (n.alteradoEm ? " · alterada em " + fmt.dataHora(n.alteradoEm) : "") : "Sem lançamento") + '"></td>';
        }
        const destaque = o.destacar && o.destacar.indexOf(chave) > -1 ? " recem" : "";
        return '<td class="celula-nota ' + classeNota(n ? n.valor : null, c.mediaMinima) + destaque + '"' +
          (n ? ' title="Lançada em ' + fmt.dataHora(n.lancadoEm) + '"' : "") + ">" +
          (n ? fmt.nota(n.valor) : "—") + "</td>";
      }).join("");

      const cor = Graficos.corPorNota(l.media, c.mediaMinima, c.mediaRecuperacao);
      const pct = l.media === null ? 0 : Math.min(100, (l.media / c.notaMaxima) * 100);
      const classeBarra = l.media === null ? "" : l.media >= c.mediaMinima ? "verde" : l.media >= c.mediaRecuperacao ? "ambar" : "rubro";

      return '<tr class="' + (l.media !== null && l.media < c.mediaMinima ? "risco" : "") + '">' +
        '<td class="disc">' + esc(l.disciplina.nome) +
          '<span class="eixo">' + esc(l.disciplina.area) + "</span></td>" +
        celulas +
        '<td class="media" style="color:' + cor + '">' + fmt.nota(l.media) + "</td>" +
        "<td>" + Casca.selo(l.situacao) + "</td>" +
        (o.editavel ? "" :
          '<td class="sem-impressao"><div class="medidor">' +
          '<span class="barra ' + classeBarra + '"><span style="width:' + pct + '%"></span></span>' +
          '<span class="v">' + (l.media === null ? "—" : fmt.decimal(l.media)) + "</span></div></td>") +
        "</tr>";
    }).join("");

    const rodapeMedia = '<tr><td>Média geral do estudante</td>' +
      BIMESTRES.map(function (b) {
        const doBim = dados.linhas.map(l => l.bimestres[b - 1]).filter(Boolean).map(n => n.valor);
        const m = Dados.mediaDe(doBim);
        return '<td class="centro">' + fmt.nota(m) + "</td>";
      }).join("") +
      '<td class="centro" style="color:' + Graficos.corPorNota(dados.mediaGeral, c.mediaMinima) + '">' +
      fmt.nota(dados.mediaGeral) + "</td>" +
      "<td>" + Casca.selo(dados.situacaoGeral) + "</td>" +
      (o.editavel ? "" : '<td class="sem-impressao"></td>') + "</tr>";

    return '<div class="rolagem-x"><table class="tabela tabela-boletim">' +
      "<thead><tr><th>Componente curricular</th>" +
      BIMESTRES.map(b => '<th class="centro">' + b + "º bim.</th>").join("") +
      '<th class="centro">Média</th><th>Situação</th>' +
      (o.editavel ? "" : '<th class="sem-impressao">Desempenho</th>') + "</tr></thead>" +
      "<tbody>" + linhas + "</tbody>" +
      "<tfoot>" + rodapeMedia + "</tfoot>" +
      "</table></div>";
  }

  /** Rodape de assinaturas — visivel apenas ao imprimir. */
  function assinaturas() {
    return '<div class="assinaturas" style="display:none">' +
      "<div>Coordenação Pedagógica</div><div>Direção</div><div>Responsável</div></div>";
  }

  /**
   * Liga a edicao das celulas. Cada campo salva ao sair (blur) ou no Enter,
   * e a navegacao entre celulas funciona com as setas do teclado.
   */
  function ligarEdicao(container, alunoId, autorId, aoSalvar) {
    const c = Dados.config();
    const campos = N.$$(".nota-in", container);

    function interpretar(txt) {
      const limpo = String(txt).trim().replace(",", ".");
      if (limpo === "") return null;
      const v = Number(limpo);
      if (isNaN(v)) return undefined;          // valor invalido
      return Math.round(N.limitar(v, 0, c.notaMaxima) * 10) / 10;
    }

    campos.forEach(function (campo, indice) {
      const original = campo.value;

      campo.addEventListener("focus", function () { campo.select(); });

      campo.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); campo.blur(); }
        if (e.key === "Escape") { campo.value = original; campo.blur(); }
        const colunas = 4;
        let destino = null;
        if (e.key === "ArrowDown") destino = indice + colunas;
        if (e.key === "ArrowUp") destino = indice - colunas;
        if (destino !== null && campos[destino]) { e.preventDefault(); campos[destino].focus(); }
      });

      campo.addEventListener("blur", function () {
        const v = interpretar(campo.value);
        if (v === undefined) {
          N.notificar({ texto: "Valor inválido. Use números de 0 a " + c.notaMaxima + ".", tipo: "erro" });
          campo.value = original;
          return;
        }
        const atualTexto = v === null ? "" : fmt.nota(v);
        if (atualTexto === original.trim()) { campo.value = original; return; }

        const r = Dados.lancarNota({
          alunoId: alunoId,
          disciplinaId: campo.dataset.disciplina,
          bimestre: Number(campo.dataset.bimestre),
          valor: v,
          autorId: autorId
        });
        if (r && r !== "nenhuma" && aoSalvar) aoSalvar(r);
      });
    });
  }

  global.Boletim = {
    cabecalho: cabecalho, tabela: tabela, timbrado: timbrado,
    assinaturas: assinaturas, ligarEdicao: ligarEdicao
  };
})(window);
