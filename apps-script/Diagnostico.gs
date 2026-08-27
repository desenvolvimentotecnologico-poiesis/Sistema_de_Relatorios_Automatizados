/**
 * DIAGNÓSTICO DE INTEGRIDADE DAS PLANILHAS DE RESPOSTAS (SOMENTE LEITURA)
 *
 * Ferramenta de apoio da equipe de Sistemas, executada manualmente pelo editor do Apps Script.
 * NENHUMA função deste arquivo escreve, move ou apaga qualquer dado — todas apenas leem as
 * planilhas e imprimem um relatório no Logger (Ver > Registros de execução).
 *
 * Serve para localizar as linhas gravadas enquanto o cabeçalho das abas estava desatualizado:
 * naquele período os valores entraram deslocados uma coluna à direita, então campos de texto
 * caíram em colunas numéricas e o último campo transbordou para fora do cabeçalho.
 *
 * COMO USAR
 *   1. Abra o projeto no editor do Apps Script.
 *   2. Selecione a função "diagnosticarPlanilhas" e clique em Executar.
 *   3. Abra "Registros de execução" e confira a lista de linhas suspeitas.
 */

/**
 * Colunas que só devem conter números em cada área. Um texto aqui é o sinal mais confiável de
 * que a linha entrou deslocada.
 */
const DIAGNOSTICO_COLUNAS_NUMERICAS = {
  "PEDAGÓGICO": ["Encontros Previstos", "Encontros Realizados", "Público Total"],
  "ARTICULAÇÃO E DIFUSÃO": ["Número de Sessões", "Público Total", "Público por Sessão"],
  "BIBLIOTECA": ["Público Total"],
  "FUNDAÇÃO CASA": ["Encontros Previstos", "Encontros Realizados"]
};

/**
 * Ponto de entrada: audita as quatro áreas e imprime o relatório consolidado.
 */
function diagnosticarPlanilhas() {
  const areas = ["Pedagógico", "Articulação e Difusão", "Bibliotecas", "Fundação Casa"];
  const linhas = [];

  linhas.push("========================================================");
  linhas.push("DIAGNÓSTICO DE INTEGRIDADE — SOMENTE LEITURA");
  linhas.push("Gerado em: " + Utils.getFormattedTimestampExtensoBR(new Date()));
  linhas.push("========================================================");

  let totalSuspeitas = 0;

  for (let i = 0; i < areas.length; i++) {
    let resultado;
    try {
      resultado = diagnosticarArea(areas[i]);
    } catch (err) {
      linhas.push("");
      linhas.push("[" + areas[i] + "] Não foi possível auditar: " + err.message);
      continue;
    }

    totalSuspeitas += resultado.suspeitas.length;

    linhas.push("");
    linhas.push("--------------------------------------------------------");
    linhas.push("ÁREA: " + resultado.area + "  (aba '" + resultado.aba + "')");
    linhas.push("Linhas de dados: " + resultado.totalLinhas + " | Suspeitas: " + resultado.suspeitas.length);

    if (resultado.colunasFaltando.length > 0) {
      linhas.push("Colunas do sistema ausentes no cabeçalho: " + resultado.colunasFaltando.join(", "));
    }

    if (resultado.suspeitas.length === 0) {
      linhas.push("Nenhuma linha desalinhada encontrada.");
      continue;
    }

    for (let s = 0; s < resultado.suspeitas.length; s++) {
      const susp = resultado.suspeitas[s];
      linhas.push("  Linha " + susp.linha + " | " + susp.identificacao);
      for (let m = 0; m < susp.motivos.length; m++) {
        linhas.push("      - " + susp.motivos[m]);
      }
    }
  }

  linhas.push("");
  linhas.push("========================================================");
  linhas.push(totalSuspeitas === 0
    ? "RESULTADO: nenhuma linha desalinhada encontrada."
    : "RESULTADO: " + totalSuspeitas + " linha(s) suspeita(s). Confira cada uma na planilha antes de corrigir.");
  linhas.push("Nenhum dado foi alterado por esta execução.");
  linhas.push("========================================================");

  const relatorio = linhas.join("\n");
  Logger.log(relatorio);
  return relatorio;
}

/**
 * Audita uma única área e devolve as linhas suspeitas de desalinhamento.
 *
 * @param {string} area Nome da área institucional
 * @return {Object} Resumo com aba, total de linhas, colunas ausentes e lista de suspeitas
 */
function diagnosticarArea(area) {
  const areaNorm = Utils.normalizeAreaName(area);
  const config = getSheetConfigForArea(areaNorm);
  const ss = getResponsesSpreadsheetConnection(areaNorm);
  const sheet = ss.getSheetByName(config.sheetName);

  const resumo = {
    area: areaNorm,
    aba: config.sheetName,
    totalLinhas: 0,
    colunasFaltando: [],
    suspeitas: []
  };

  if (!sheet) {
    throw new Error("aba '" + config.sheetName + "' não encontrada na planilha desta área.");
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return resumo;

  const layout = readHeaderLayout(sheet);

  for (let h = 0; h < config.headers.length; h++) {
    if (layout.index[normalizeHeaderKey(config.headers[h])] === undefined) {
      resumo.colunasFaltando.push(config.headers[h]);
    }
  }

  const colOf = function(headerName) {
    const idx = layout.index[normalizeHeaderKey(headerName)];
    return idx === undefined ? -1 : idx;
  };

  const idxUnidade = colOf("Unidade") !== -1 ? colOf("Unidade") : colOf("Centro de Atendimento (Unidade)");
  const idxAtividade = colOf("Nome da Atividade");
  const idxAno = colOf("Ano de Referência");
  const idxMes = colOf("Mês de Referência");

  const colunasNumericas = DIAGNOSTICO_COLUNAS_NUMERICAS[areaNorm] || [];
  const ultimaColunaCanonica = colOf(config.headers[config.headers.length - 1]);

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  resumo.totalLinhas = values.length;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];

    // Ignora linhas totalmente vazias (sobras de formatação no fim da aba)
    const temConteudo = row.some(function(c) { return c !== "" && c !== null && c !== undefined; });
    if (!temConteudo) continue;

    const motivos = [];

    // Sinal 1: coluna que deveria ser numérica contendo texto
    for (let n = 0; n < colunasNumericas.length; n++) {
      const col = colOf(colunasNumericas[n]);
      if (col === -1) continue;
      const valor = row[col];
      if (valor === "" || valor === null || valor === undefined) continue;
      if (!ehValorNumerico(valor)) {
        motivos.push("'" + colunasNumericas[n] + "' deveria ser um número, mas contém: \"" + resumir(valor) + "\"");
      }
    }

    // Sinal 2: conteúdo além da última coluna do sistema, fora das colunas de controle conhecidas
    if (ultimaColunaCanonica !== -1) {
      for (let c = ultimaColunaCanonica + 1; c < row.length; c++) {
        const header = layout.keys[c] || "";
        const ehControle = header.indexOf("INSCRICAO") !== -1 || header.indexOf("PRESENCA") !== -1 ||
          header.indexOf("ATUALIZADO POR") !== -1 || header.indexOf("DATA/HORA ATUALIZACAO") !== -1;
        if (ehControle) continue;
        if (row[c] !== "" && row[c] !== null && row[c] !== undefined) {
          motivos.push("conteúdo transbordou para a coluna " + numeroParaLetraColuna(c + 1) +
            (header ? " ('" + header + "')" : " (sem cabeçalho)") + ": \"" + resumir(row[c]) + "\"");
        }
      }
    }

    if (motivos.length === 0) continue;

    const partes = [];
    if (idxUnidade !== -1) partes.push("Unidade: " + resumir(row[idxUnidade], 30));
    if (idxAtividade !== -1) partes.push("Atividade: " + resumir(row[idxAtividade], 40));
    if (idxAno !== -1 && idxMes !== -1) partes.push("Período: " + resumir(row[idxMes], 12) + "/" + resumir(row[idxAno], 6));

    resumo.suspeitas.push({
      linha: i + 2,
      identificacao: partes.join(" | "),
      motivos: motivos
    });
  }

  return resumo;
}

/**
 * Indica se o valor pode ser lido como número. Aceita as formas usadas nos formulários
 * ("8", "32h", "32:00", "1.250"), para não acusar um preenchimento legítimo como erro.
 */
function ehValorNumerico(valor) {
  if (typeof valor === "number") return true;
  const str = valor.toString().trim();
  if (str === "") return true;
  return /^[0-9]+([.,:][0-9]+)*\s*[hH]?$/.test(str);
}

/**
 * Encurta um valor para caber na linha do relatório.
 */
function resumir(valor, limite) {
  const max = limite || 60;
  let str = valor === null || valor === undefined ? "" : valor.toString().replace(/\s+/g, " ").trim();
  if (str.length > max) str = str.substring(0, max) + "...";
  return str;
}

/**
 * Converte o número da coluna (base 1) na letra usada pelo Google Sheets (1 = A, 27 = AA).
 */
function numeroParaLetraColuna(numero) {
  let n = numero;
  let letra = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}
