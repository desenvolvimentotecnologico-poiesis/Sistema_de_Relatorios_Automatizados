/**
 * GERENCIADOR DE DADOS DO GOOGLE SHEETS
 * Responsável por ler a planilha de listas institucionais e salvar respostas
 * estruturadas para cada uma das 4 frentes de trabalho.
 */

function getListsSpreadsheetConnection() {
  const listId = CONFIG.SPREADSHEET_LISTS_ID ? CONFIG.SPREADSHEET_LISTS_ID.trim() : "";
  if (!listId || listId.startsWith("INSIRA_O_ID")) {
    throw new Error("O ID da Planilha de Listas (SPREADSHEET_LISTS_ID) não foi configurado no Config.gs.");
  }
  try {
    return SpreadsheetApp.openById(listId);
  } catch (err) {
    throw new Error("Falha de conexão com a Planilha de Listas (SPREADSHEET_LISTS_ID: '" + listId + "'). Verifique o ID configurado.");
  }
}

function getResponsesSpreadsheetConnection(area) {
  let spreadsheetId = CONFIG.SPREADSHEET_RESPONSES_ID;
  let varName = "SPREADSHEET_RESPONSES_ID";
  
  if (area) {
    const areaNorm = Utils.normalizeAreaName(area);
    if (areaNorm === "PEDAGÓGICO" && CONFIG.SPREADSHEET_RESPONSES_PEDAGOGICO_ID && !CONFIG.SPREADSHEET_RESPONSES_PEDAGOGICO_ID.startsWith("INSIRA_O_ID")) {
      spreadsheetId = CONFIG.SPREADSHEET_RESPONSES_PEDAGOGICO_ID;
      varName = "SPREADSHEET_RESPONSES_PEDAGOGICO_ID";
    } else if (areaNorm === "ARTICULAÇÃO E DIFUSÃO" && CONFIG.SPREADSHEET_RESPONSES_ARTICULACAO_ID && !CONFIG.SPREADSHEET_RESPONSES_ARTICULACAO_ID.startsWith("INSIRA_O_ID")) {
      spreadsheetId = CONFIG.SPREADSHEET_RESPONSES_ARTICULACAO_ID;
      varName = "SPREADSHEET_RESPONSES_ARTICULACAO_ID";
    } else if (areaNorm === "FUNDAÇÃO CASA" && CONFIG.SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID && !CONFIG.SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID.startsWith("INSIRA_O_ID")) {
      spreadsheetId = CONFIG.SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID;
      varName = "SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID";
    } else if (areaNorm === "BIBLIOTECA" && CONFIG.SPREADSHEET_RESPONSES_BIBLIOTECA_ID && !CONFIG.SPREADSHEET_RESPONSES_BIBLIOTECA_ID.startsWith("INSIRA_O_ID")) {
      spreadsheetId = CONFIG.SPREADSHEET_RESPONSES_BIBLIOTECA_ID;
      varName = "SPREADSHEET_RESPONSES_BIBLIOTECA_ID";
    }
  }

  if (!spreadsheetId || spreadsheetId.startsWith("INSIRA_O_ID")) {
    throw new Error("O ID da Planilha de Respostas (" + varName + ") para '" + (area || "Geral") + "' não foi configurado no Config.gs.");
  }

  spreadsheetId = spreadsheetId.trim();

  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (err) {
    throw new Error("ID de Planilha Inválido no Config.gs (" + varName + ": '" + spreadsheetId + "').");
  }
}

function getDropdownData(forceRefresh) {
  try {
    const cache = CacheService.getScriptCache();
    if (!forceRefresh) {
      const cachedData = cache.get("poiesis_dropdown_hierarchy");
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    }

    const ss = getListsSpreadsheetConnection();
    const sheets = ss.getSheets();
    const hierarchy = {};
    
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const sheetName = sheet.getName().trim();
      const sheetUpper = sheetName.toUpperCase();
      
      if (sheet.isSheetHidden() || sheetName.startsWith("_")) {
        continue;
      }
      
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        hierarchy[sheetName] = [];
        continue;
      }
      
      const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      
      if (sheetUpper.includes("CASA")) {
        const casaMap = {};
        for (let j = 0; j < values.length; j++) {
          const divisao = values[j][0] ? values[j][0].toString().trim() : "";
          const centro = values[j][1] ? values[j][1].toString().trim() : "";
          if (divisao && centro) {
            if (!casaMap[divisao]) casaMap[divisao] = [];
            if (!casaMap[divisao].includes(centro)) {
              casaMap[divisao].push(centro);
            }
          }
        }
        hierarchy["Fundação Casa"] = casaMap;
      } else {
        hierarchy[sheetName] = [];
        for (let j = 0; j < values.length; j++) {
          const type = values[j][0] ? values[j][0].toString().trim() : "";
          const name = values[j][1] ? values[j][1].toString().trim() : "";
          if (name) {
            hierarchy[sheetName].push({ type: type, name: name });
          }
        }
      }
    }
    
    cache.put("poiesis_dropdown_hierarchy", JSON.stringify(hierarchy), 60);
    return hierarchy;
  } catch (error) {
    Logger.log("Erro no getDropdownData: " + error.toString());
    throw new Error("Falha ao obter listas institucionais: " + error.message);
  }
}

function getSheetConfigForArea(area) {
  const areaNorm = Utils.normalizeAreaName(area);
  
  if (areaNorm === "PEDAGÓGICO") {
    return {
      sheetName: CONFIG.SHEET_RESPONSES_PEDAGOGICO,
      headers: [
        "Carimbo de Data/Hora", "Unidade", "Número do Contrato", "Meta de Referência",
        "Tipo (Trilha/Ateliê/Núcleo)", "Nome da Atividade", "Ano de Referência", "Mês de Referência",
        "Responsável pelo Preenchimento", "Responsável pela Execução", "Encontros Previstos", "Encontros Realizados", "Carga Horária Prevista",
        "Carga Horária Realizada", "Data de Eventual Reposição", "Público Total", "Perfil do Público",
        "Faixa Etária Predominante", "Destaque da Ação", "Objetivos da Atividade", "Impacto Territorial / Cultural",
        "Descrição das Ações e Metodologia", "Engajamento e Participação", "Pontos Fortes", "Pontos Fracos e Desafios"
      ]
    };
  } else if (areaNorm === "ARTICULAÇÃO E DIFUSÃO") {
    return {
      sheetName: CONFIG.SHEET_RESPONSES_ARTICULACAO,
      headers: [
        "Carimbo de Data/Hora", "Unidade", "Número do Contrato", "Meta de Referência",
        "Nome da Atividade", "Ano de Referência", "Mês de Referência", "Dia(s) do Mês",
        "Responsável pelo Preenchimento", "Responsável pela Execução", "Horário de Início", "Horário de Término", "Carga Horária Total", "Número de Sessões",
        "Público Total", "Público por Sessão", "Perfil do Público", "Faixa Etária Predominante",
        "Destaque da Ação", "Objetivos da Atividade", "Impacto Territorial / Cultural",
        "Linguagem Artística", "Inclusão e Diversidade", "Efeméride", "Relato",
        "Descrição das Ações e Metodologia", "Pontos Fortes", "Pontos Fracos e Desafios"
      ]
    };
  } else if (areaNorm === "FUNDAÇÃO CASA") {
    return {
      sheetName: CONFIG.SHEET_RESPONSES_FUNDACAO_CASA,
      headers: [
        "Carimbo de Data/Hora", "Divisão Regional", "Centro de Atendimento (Unidade)", "Número do Contrato",
        "Meta de Referência", "Nome da Atividade", "Ano de Referência", "Mês de Referência",
        "Dias da Semana", "Horário",
        "Razão Social (Responsável)", "Encontros Previstos", "Encontros Realizados", "Carga Horária Prevista",
        "Carga Horária Realizada", "Data de Eventual Reposição", "Destaque da Ação", "Objetivos da Atividade",
        "Impacto Territorial / Cultural", "Descrição das Ações e Metodologia", "Engajamento e Participação",
        "Pontos Fortes", "Pontos Fracos e Desafios", "Plano de Atividades (JSON)"
      ]
    };
  } else if (areaNorm === "BIBLIOTECA") {
    return {
      sheetName: CONFIG.SHEET_RESPONSES_BIBLIOTECA,
      headers: [
        "Carimbo de Data/Hora", "Unidade", "Número do Contrato", "Meta de Referência",
        "Nome da Atividade", "Responsável pelo Preenchimento", "Responsável pela Execução", "Data da Atividade", "Horário de Início",
        "Horário de Término", "Público Total", "Perfil do Público", "Faixa Etária Predominante",
        "Destaque da Ação", "Objetivos da Atividade", "Impacto Territorial / Cultural",
        "Descrição das Ações e Metodologia", "Engajamento e Participação", "Pontos Fortes",
        "Pontos Fracos e Desafios"
      ]
    };
  } else {
    throw new Error("Área não identificada para configuração de tabela: " + area);
  }
}

/**
 * Renomeações de cabeçalho aplicadas automaticamente às abas já existentes.
 *
 * Sem isto, trocar o nome de uma coluna em getSheetConfigForArea faria ensureSheetHeaders tratar
 * o nome novo como uma coluna FALTANDO: ele inseriria uma coluna vazia ao lado e a antiga ficaria
 * órfã, com todo o histórico preso sob um rótulo que o sistema não usa mais. Renomear preserva a
 * coluna e os dados — muda apenas o texto do cabeçalho.
 *
 * A comparação é exata, então "Responsável pelo Preenchimento" nunca é confundido com
 * "Responsável". Aplicar de novo numa aba já renomeada não faz nada.
 */
const HEADER_RENAMES = [
  { de: "Responsável", para: "Responsável pela Execução" }
];

/**
 * Normaliza um cabeçalho de coluna para comparação (maiúsculas, sem acentos, espaços colapsados).
 */
function normalizeHeaderKey(header) {
  return Utils.normalizeText(header);
}

/**
 * Aplica as renomeações de cabeçalho pendentes na aba, preservando a coluna e seus dados.
 *
 * @return {boolean} true se algum cabeçalho foi renomeado
 */
function applyHeaderRenames(sheet, config) {
  const width = sheet.getLastColumn();
  if (width < 1) return false;

  const headerRow = sheet.getRange(1, 1, 1, width).getValues()[0];
  const chavesCanonicas = config.headers.map(normalizeHeaderKey);
  let renomeou = false;

  for (let r = 0; r < HEADER_RENAMES.length; r++) {
    const regra = HEADER_RENAMES[r];
    const chaveDe = normalizeHeaderKey(regra.de);
    const chavePara = normalizeHeaderKey(regra.para);

    // Só renomeia se a área realmente usa o nome novo — evita mexer em áreas que mantêm um rótulo
    // próprio para o mesmo conceito (ex.: "Razão Social (Responsável)" na Fundação CASA).
    if (chavesCanonicas.indexOf(chavePara) === -1) continue;

    for (let c = 0; c < headerRow.length; c++) {
      if (normalizeHeaderKey(headerRow[c]) !== chaveDe) continue;

      // Se o nome novo já existe em outra coluna, renomear criaria dois rótulos iguais e a
      // gravação por nome ficaria ambígua. Nesse caso a aba precisa ser conferida à mão.
      const jaExiste = headerRow.some(function(h, idx) {
        return idx !== c && normalizeHeaderKey(h) === chavePara;
      });
      if (jaExiste) {
        Logger.log("Renomeação ignorada em '" + config.sheetName + "': a coluna '" + regra.para + "' já existe além da coluna '" + regra.de + "'.");
        continue;
      }

      sheet.getRange(1, c + 1).setValue(regra.para)
        .setFontWeight("bold").setBackground("#f3f3f3");
      headerRow[c] = regra.para;
      renomeou = true;
      Logger.log("Coluna '" + regra.de + "' renomeada para '" + regra.para + "' na aba '" + config.sheetName + "'.");
    }
  }

  if (renomeou) SpreadsheetApp.flush();
  return renomeou;
}

/**
 * Lê o cabeçalho físico da aba e devolve a posição real (base 0) de cada coluna.
 */
function readHeaderLayout(sheet) {
  const width = sheet.getLastColumn();
  const layout = { keys: [], index: {}, width: width };
  if (width < 1) return layout;

  const row = sheet.getRange(1, 1, 1, width).getValues()[0];
  for (let i = 0; i < row.length; i++) {
    const key = normalizeHeaderKey(row[i]);
    layout.keys.push(key);
    if (key && layout.index[key] === undefined) {
      layout.index[key] = i;
    }
  }
  return layout;
}

/**
 * Garante que a aba de respostas contenha TODAS as colunas canônicas da área e devolve o layout
 * físico real do cabeçalho.
 *
 * Este é o ponto que corrige o desalinhamento em produção. Antes, o cabeçalho só era escrito
 * quando a aba era nova ou a célula A1 estava vazia; a linha de dados, por sua vez, era montada
 * como um array posicional. Quando uma coluna passou a ser inserida no MEIO do array canônico
 * (ex.: "Responsável pelo Preenchimento", antes de "Responsável"), as abas já existentes
 * continuaram com o cabeçalho antigo e cada novo envio gravou todos os valores dali em diante
 * deslocados uma coluna à direita — os dados apareciam sob o rótulo errado e o último campo
 * ("Pontos Fracos e Desafios") transbordava para fora do cabeçalho, invadindo as colunas de
 * controle da Área Restrita.
 *
 * A coluna ausente é inserida na sua posição canônica com insertColumnBefore, que desloca junto
 * os dados das linhas já gravadas — assim o histórico permanece alinhado ao seu cabeçalho.
 * A operação é idempotente: em execuções seguintes a coluna já existe e nada é alterado.
 */
function ensureSheetHeaders(sheet, config) {
  const headers = config.headers;
  let layout = readHeaderLayout(sheet);

  const isEmptySheet = sheet.getLastRow() === 0 || layout.keys.every(function(k) { return k === ""; });
  if (isEmptySheet) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight("bold").setBackground("#f3f3f3");
    SpreadsheetApp.flush();
    return readHeaderLayout(sheet);
  }

  // As renomeações vêm ANTES da checagem de colunas faltantes: um cabeçalho ainda com o nome
  // antigo seria lido como "coluna nova ausente" e ganharia uma coluna vazia ao lado.
  if (applyHeaderRenames(sheet, config)) {
    layout = readHeaderLayout(sheet);
  }

  for (let i = 0; i < headers.length; i++) {
    const key = normalizeHeaderKey(headers[i]);
    if (layout.index[key] !== undefined) continue;

    const currentWidth = sheet.getLastColumn();
    const insertAt = Math.min(i + 1, currentWidth + 1);

    if (insertAt <= currentWidth) {
      sheet.insertColumnBefore(insertAt);
    } else {
      sheet.insertColumnAfter(currentWidth);
    }

    sheet.getRange(1, insertAt).setValue(headers[i])
      .setFontWeight("bold").setBackground("#f3f3f3");
    SpreadsheetApp.flush();

    Logger.log("Coluna ausente '" + headers[i] + "' inserida na posição " + insertAt + " da aba '" + config.sheetName + "'.");
    layout = readHeaderLayout(sheet);
  }

  // Garante que colunas de texto livre que o Google Sheets tenderia a converter em data/número
  // ("1, 5, 10" -> data; "14:15 às 15:45" -> hora) usem formatação de texto simples (@).
  ["Dia(s) do Mês", "Dias da Semana", "Horário", "Plano de Atividades (JSON)"].forEach(function(nomeColuna) {
    const idxCol = layout.index[normalizeHeaderKey(nomeColuna)];
    if (idxCol !== undefined) {
      sheet.getRange(1, idxCol + 1, sheet.getMaxRows(), 1).setNumberFormat("@");
    }
  });

  return layout;
}

/**
 * Converte a linha canônica (array paralelo a config.headers) em um array na ordem FÍSICA real do
 * cabeçalho da aba, para que cada valor caia sob o seu próprio rótulo mesmo que a planilha tenha
 * colunas extras ou em ordem diferente da canônica.
 *
 * @param {Object} layout Layout físico devolvido por ensureSheetHeaders
 * @param {Array} headers Cabeçalhos canônicos da área
 * @param {Array} values Valores na ordem canônica
 */
function buildPhysicalRow(layout, headers, values) {
  const row = new Array(layout.width);
  for (let c = 0; c < layout.width; c++) {
    row[c] = "";
  }

  for (let i = 0; i < headers.length; i++) {
    const target = layout.index[normalizeHeaderKey(headers[i])];
    if (target !== undefined) {
      row[target] = values[i];
    }
  }
  return row;
}

/**
 * Verifica se a atividade já teve relatório enviado e devolve os dados do envio original.
 *
 * Usa exatamente o mesmo critério de identificação da deduplicação (Unidade + Atividade + Tipo +
 * Divisão Regional + Período), que é o mesmo par de chaves que a Área Restrita usa para localizar
 * a atividade na planilha.
 *
 * Consulta somente-leitura: não normaliza o cabeçalho nem grava nada. Se as colunas ainda não
 * puderem ser resolvidas, devolve "não existe" e o fluxo normal segue — a trava definitiva é a
 * revalidação dentro do LockService, em saveResponseRow.
 *
 * @return {Object} { exists, rowNumber, dataHora, responsavel }
 */
function findExistingSubmission(data) {
  try {
    const ss = getResponsesSpreadsheetConnection(data.area);
    const config = getSheetConfigForArea(data.area);
    const sheet = ss.getSheetByName(config.sheetName);
    if (!sheet || sheet.getLastRow() < 2) return { exists: false };

    const layout = readHeaderLayout(sheet);
    const rowNumber = findDuplicateActivityRow(sheet, data, layout);
    if (!rowNumber) return { exists: false };

    return describeExistingSubmission(sheet, layout, rowNumber);
  } catch (err) {
    // Uma falha na consulta não pode impedir um envio legítimo: o bloqueio definitivo acontece
    // de qualquer forma dentro do lock, na hora de gravar.
    Logger.log("Falha ao consultar envio anterior: " + err.toString());
    return { exists: false };
  }
}

/**
 * Extrai da linha localizada quando o relatório foi enviado e por quem, para a mensagem
 * apresentada ao educador.
 */
function describeExistingSubmission(sheet, layout, rowNumber) {
  const colOf = function(headerName) {
    const idx = layout.index[normalizeHeaderKey(headerName)];
    return idx === undefined ? -1 : idx;
  };

  const row = sheet.getRange(rowNumber, 1, 1, layout.width).getValues()[0];

  const idxCarimbo = colOf("Carimbo de Data/Hora");
  const valorCarimbo = idxCarimbo !== -1 ? row[idxCarimbo] : "";
  let dataHora = "";
  if (valorCarimbo instanceof Date && !isNaN(valorCarimbo.getTime())) {
    dataHora = Utils.getFormattedTimestampBR(valorCarimbo);
  } else if (valorCarimbo) {
    dataHora = valorCarimbo.toString().trim();
  }

  // A Fundação CASA não separa preenchimento de execução: ali o responsável é a Razão Social.
  const idxPreenchimento = colOf("Responsável pelo Preenchimento");
  const idxExecucao = colOf("Responsável pela Execução") !== -1
    ? colOf("Responsável pela Execução")
    : colOf("Razão Social (Responsável)");

  let responsavel = "";
  if (idxPreenchimento !== -1 && row[idxPreenchimento]) {
    responsavel = row[idxPreenchimento].toString().trim();
  }
  if (!responsavel && idxExecucao !== -1 && row[idxExecucao]) {
    responsavel = row[idxExecucao].toString().trim();
  }

  return {
    exists: true,
    rowNumber: rowNumber,
    dataHora: dataHora,
    responsavel: responsavel
  };
}

/**
 * Monta a mensagem exibida ao educador quando o envio é recusado por já existir.
 */
function buildDuplicateMessage(info) {
  let msg = "Esta atividade já teve o relatório enviado";
  if (info && info.dataHora) msg += " em " + info.dataHora;
  if (info && info.responsavel) msg += " por " + info.responsavel;
  msg += ".\n\nNão é permitido enviar o relatório da mesma atividade duas vezes no mesmo período.";
  msg += "\n\nSe algum dado precisa ser corrigido, entre em contato com a equipe através do e-mail: sistemasdegestao@poiesis.org.br";
  return msg;
}

function saveResponseRow(data) {
  try {
    const ss = getResponsesSpreadsheetConnection(data.area);
    const config = getSheetConfigForArea(data.area);
    let sheet = ss.getSheetByName(config.sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(config.sheetName);
      sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers])
        .setFontWeight("bold").setBackground("#f3f3f3");
      SpreadsheetApp.flush();
    }

    const timestamp = Utils.getFormattedTimestampBR(new Date());
    let newRow = [];
    const areaNorm = Utils.normalizeAreaName(data.area);
    
    const contratoVal = data.contrato || data.numeroContrato || "";
    const impactoVal = data.impactoCultural || data.impactoTerritorial || "";

    if (areaNorm === "PEDAGÓGICO") {
      newRow = [
        timestamp,
        Utils.formatField(data.unidade),
        Utils.formatField(contratoVal),
        Utils.formatField(data.metaReferencia),
        Utils.formatField(data.tipoPedagogico),
        Utils.formatField(data.atividade),
        Utils.formatField(data.anoReferencia),
        Utils.formatField(data.mesReferencia),
        Utils.formatField(data.responsavelPreenchimento),
        Utils.formatField(data.responsavel),
        Utils.formatField(data.encontrosPrevistos),
        Utils.formatField(data.encontrosRealizados),
        Utils.formatField(data.cargaHorariaPrevista),
        Utils.formatField(data.cargaHorariaRealizada),
        Utils.formatField(data.dataReposicao),
        Utils.formatField(data.publicoTotal),
        Utils.formatField(data.perfilPublico),
        Utils.formatField(data.faixaEtaria),
        Utils.formatField(data.destaqueAcao),
        Utils.formatField(data.objetivos),
        Utils.formatField(impactoVal),
        Utils.formatField(data.descricaoMetodologia),
        Utils.formatField(data.engajamentoParticipacao),
        Utils.formatField(data.pontosFortes),
        Utils.formatField(data.pontosFracos)
      ];
    } else if (areaNorm === "ARTICULAÇÃO E DIFUSÃO") {
      newRow = [
        timestamp,
        Utils.formatField(data.unidade),
        Utils.formatField(contratoVal),
        Utils.formatField(data.metaReferencia),
        Utils.formatField(data.atividade),
        Utils.formatField(data.anoReferencia),
        Utils.formatField(data.mesReferencia),
        Utils.formatField(data.diasAtividade),
        Utils.formatField(data.responsavelPreenchimento),
        Utils.formatField(data.responsavel),
        Utils.formatField(data.horarioInicio),
        Utils.formatField(data.horarioTermino),
        Utils.formatField(data.cargaHorariaTotal),
        Utils.formatField(data.numSessoes),
        Utils.formatField(data.publicoTotal),
        Utils.formatField(data.publicoSessao),
        Utils.formatField(data.perfilPublico),
        Utils.formatField(data.faixaEtaria),
        Utils.formatField(data.destaqueAcao),
        Utils.formatField(data.objetivos),
        Utils.formatField(impactoVal),
        Utils.formatField(data.linguagemArtistica),
        Utils.formatField(data.inclusaoDiversidade),
        Utils.formatField(data.efemeride),
        Utils.formatField(data.relato),
        Utils.formatField(data.descricaoMetodologia),
        Utils.formatField(data.pontosFortes),
        Utils.formatField(data.pontosFracos)
      ];
    } else if (areaNorm === "FUNDAÇÃO CASA") {
      newRow = [
        timestamp,
        Utils.formatField(data.divisaoRegional),
        Utils.formatField(data.unidade),
        Utils.formatField(contratoVal),
        Utils.formatField(data.metaReferencia),
        Utils.formatField(data.atividade),
        Utils.formatField(data.anoReferencia),
        Utils.formatField(data.mesReferencia),
        Utils.formatField(data.diasSemana),
        Utils.formatField(data.horarioAtividade),
        Utils.formatField(data.responsavel),
        Utils.formatField(data.encontrosPrevistos),
        Utils.formatField(data.encontrosRealizados),
        Utils.formatField(data.cargaHorariaPrevista),
        Utils.formatField(data.cargaHorariaRealizada),
        Utils.formatField(data.dataReposicao),
        Utils.formatField(data.destaqueAcao),
        Utils.formatField(data.objetivos),
        Utils.formatField(impactoVal),
        Utils.formatField(data.descricaoMetodologia),
        Utils.formatField(data.engajamentoParticipacao),
        Utils.formatField(data.pontosFortes),
        Utils.formatField(data.pontosFracos),
        // Snapshot do Plano de Atividades para a reconciliação: a tabela de encontros só existe no
        // payload do navegador; sem isso, um relatório reconciliado da CASA sairia sem ela.
        (data.planoTabela && data.planoTabela.length ? JSON.stringify(data.planoTabela) : "")
      ];
    } else if (areaNorm === "BIBLIOTECA") {
      newRow = [
        timestamp,
        Utils.formatField(data.unidade),
        Utils.formatField(contratoVal),
        Utils.formatField(data.metaReferencia),
        Utils.formatField(data.atividade),
        Utils.formatField(data.responsavelPreenchimento),
        Utils.formatField(data.responsavel),
        Utils.formatField(data.dataRelatorio),
        Utils.formatField(data.horarioInicio),
        Utils.formatField(data.horarioTermino),
        Utils.formatField(data.publicoTotal),
        Utils.formatField(data.perfilPublico),
        Utils.formatField(data.faixaEtaria),
        Utils.formatField(data.destaqueAcao),
        Utils.formatField(data.objetivos),
        Utils.formatField(impactoVal),
        Utils.formatField(data.descricaoMetodologia),
        Utils.formatField(data.engajamentoParticipacao),
        Utils.formatField(data.pontosFortes),
        Utils.formatField(data.pontosFracos)
      ];
    }

    // Antiduplicação estrita: é proibido existir mais de um envio para a mesma Unidade + Atividade
    // + Período de referência (Ano/Mês, ou Data quando a área não usa Ano/Mês). Se já existir um
    // envio anterior (ex.: reenvio manual após timeout de rede), a linha existente é sobrescrita
    // com os dados mais recentes ao invés de gerar uma linha duplicada.
    //
    // A checagem + gravação roda dentro de um LockService: sem isso, dois envios quase simultâneos
    // para a mesma atividade poderiam ambos concluir a checagem antes que o primeiro terminasse de
    // gravar, e a proteção acima seria contornada por essa corrida (race condition).
    //
    // A normalização do cabeçalho também roda sob o lock: duas execuções concorrentes não podem
    // inserir a mesma coluna ausente ao mesmo tempo e duplicá-la.
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
    } catch (lockErr) {
      throw new Error("O sistema está processando outro envio no momento. Aguarde alguns segundos e tente novamente.");
    }

    try {
      const layout = ensureSheetHeaders(sheet, config);

      // Revalidação sob o lock: é aqui que a recusa é definitiva. A consulta feita no início do
      // envio pode ficar desatualizada se outro envio da mesma atividade for gravado enquanto
      // este ainda estava em andamento, e sem esta segunda checagem os dois passariam.
      const duplicateRowNumber = findDuplicateActivityRow(sheet, data, layout);

      // Fundação CASA, com confirmação explícita do usuário (ver Code.submitForm): em vez de
      // recusar, sobrescreve a linha já existente. Continua recusando sem exceção quando a
      // confirmação não veio junto — inclusive nesta mesma área — para que só o envio que passou
      // pelo aviso no front chegue a substituir algo.
      const podeSubstituir = areaNorm === "FUNDAÇÃO CASA" && data.confirmarSubstituicao === true;

      if (duplicateRowNumber) {
        const info = describeExistingSubmission(sheet, layout, duplicateRowNumber);

        if (!podeSubstituir) {
          const rastro = "Aba: " + config.sheetName + " | Linha: " + duplicateRowNumber +
            " | Unidade: " + (data.unidade || "N/D") +
            " | Atividade: " + (data.atividade || "N/D") +
            " | Tipo: " + (data.tipoPedagogico || "-") +
            " | Período: " + (data.anoReferencia || data.dataRelatorio || "N/D") + "/" + (data.mesReferencia || "-") +
            " | Envio original: " + (info.dataHora || "N/D") + " por " + (info.responsavel || "N/D");

          Logger.log("Reenvio recusado: a atividade já possui relatório enviado. " + rastro);
          Utils.logInfo("Sheets.saveResponseRow (reenvio recusado)", rastro);

          return { duplicate: true, info: info };
        }

        // A gravação abaixo sobrescreve esta linha por inteiro (dado descartado sem chance de
        // recuperação), então fica um rastro em _LOGS mesmo no caminho permitido.
        const rastroSubstituicao = "Aba: " + config.sheetName + " | Linha: " + duplicateRowNumber +
          " | Unidade: " + (data.unidade || "N/D") +
          " | Atividade: " + (data.atividade || "N/D") +
          " | Envio original: " + (info.dataHora || "N/D") + " por " + (info.responsavel || "N/D") +
          " | Substituído agora por: " + (data.responsavel || "N/D");
        Logger.log("Reenvio substituiu relatório existente (Fundação CASA, confirmado). " + rastroSubstituicao);
        Utils.logInfo("Sheets.saveResponseRow (reenvio substituiu relatorio - Fundacao CASA)", rastroSubstituicao);
      }

      const targetRow = duplicateRowNumber || (sheet.getLastRow() + 1);
      const physicalRow = buildPhysicalRow(layout, config.headers, newRow);
      const targetRange = sheet.getRange(targetRow, 1, 1, layout.width);
      targetRange.setNumberFormat("@");
      targetRange.setValues([physicalRow]);
      SpreadsheetApp.flush();

      return {
        sheetName: config.sheetName,
        rowNumber: targetRow
      };
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    Logger.log("Erro ao gravar dados na planilha: " + error.toString());
    throw new Error("Falha ao salvar respostas: " + error.message);
  }
}

/**
 * Localiza uma linha já existente na planilha de respostas para a MESMA atividade, considerando
 * Unidade + Nome da Atividade + Tipo + Divisão Regional + Período de referência (Ano/Mês, ou Data
 * da Atividade quando a área não usa Ano/Mês).
 *
 * Usado para impedir o envio duplicado da mesma atividade (ex.: reenvio após timeout de rede).
 * Como um acerto aqui faz a linha existente ser SOBRESCRITA, a chave precisa identificar a
 * atividade sem ambiguidade: o Tipo (Trilha / Ateliê / Curso de Férias / Núcleo de Moda) e a
 * Divisão Regional entram na comparação sempre que a área os utiliza. Sem o Tipo, duas atividades
 * homônimas de tipos diferentes no Pedagógico eram tratadas como a mesma, e o envio de uma
 * apagava os dados da outra na planilha.
 */
function findDuplicateActivityRow(sheet, data, layout) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return null;

  const normalize = Utils.normalizeText;
  const headerIndex = layout && layout.index ? layout.index : readHeaderLayout(sheet).index;
  const colOf = function(headerName) {
    const idx = headerIndex[normalizeHeaderKey(headerName)];
    return idx === undefined ? -1 : idx;
  };

  // O Google Sheets converte automaticamente uma string de data (ex.: "2028-12-15") em um valor
  // de data real na célula quando ela é gravada via appendRow/setValues. Uma comparação de texto
  // simples entre o valor lido de volta (um objeto Date) e a string original enviada no próximo
  // envio nunca dá match, então a coluna "Data da Atividade" precisa ser normalizada para a mesma
  // chave AAAA-MM-DD dos dois lados antes de comparar.
  const toDateKey = function(v) {
    if (!v) return "";
    if (v instanceof Date && !isNaN(v.getTime())) {
      return Utilities.formatDate(v, "America/Sao_Paulo", "yyyy-MM-dd");
    }
    const str = v.toString().trim();
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return isoMatch[1] + "-" + isoMatch[2] + "-" + isoMatch[3];
    const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) return brMatch[3] + "-" + brMatch[2] + "-" + brMatch[1];
    return normalize(str);
  };

  // Resolução das colunas pelo nome canônico exato (ensureSheetHeaders garante que todas existam),
  // com recuo para "Centro de Atendimento (Unidade)" no caso da Fundação CASA.
  const idxUnidade = colOf("Unidade") !== -1 ? colOf("Unidade") : colOf("Centro de Atendimento (Unidade)");
  const idxAtividade = colOf("Nome da Atividade");
  const idxAno = colOf("Ano de Referência");
  const idxMes = colOf("Mês de Referência");
  const idxData = colOf("Data da Atividade");
  const idxTipo = colOf("Tipo (Trilha/Ateliê/Núcleo)");
  const idxDivisao = colOf("Divisão Regional");
  const idxDias = colOf("Dia(s) do Mês");
  const idxDiasSemana = colOf("Dias da Semana");
  const idxHorario = colOf("Horário");

  if (idxUnidade === -1 || idxAtividade === -1) return null;

  const searchUnidade = normalize(data.unidade);
  const searchAtividade = normalize(data.atividade);
  const searchAno = data.anoReferencia ? data.anoReferencia.toString().trim() : "";
  const searchMes = normalizeMonthCode(data.mesReferencia);
  const searchData = toDateKey(data.dataRelatorio);
  const searchTipo = normalize(data.tipoPedagogico);
  const searchDivisao = normalize(data.divisaoRegional);
  const searchDia = getFirstDayOfMonth(data.diasAtividade);
  const searchDiasSemana = Utils.weekdaySetKey(data.diasSemana);
  const searchHorario = Utils.horarioKey(data.horarioAtividade || Utils.formatHorarioExtenso(data.horarioInicio, data.horarioTermino));

  if (!searchUnidade || !searchAtividade) return null;

  // O período é a trava que separa o relatório deste mês do relatório de um mês anterior da MESMA
  // atividade. Como um acerto aqui faz a linha existente ser SOBRESCRITA, ele precisa ser
  // confirmado dos dois lados — nunca presumido.
  //
  // A versão anterior tinha um caminho em que, se as colunas de período não fossem localizadas,
  // qualquer linha com a mesma Unidade + Atividade era devolvida, de QUALQUER mês/ano: o envio de
  // março apagava o relatório de janeiro. Também bastava o Mês chegar vazio para o envio casar com
  // uma linha antiga de mês vazio. Agora, quando o período não pode ser determinado com certeza, a
  // função devolve null e o envio vira uma linha NOVA — uma linha a mais é recuperável, um
  // relatório sobrescrito não é.
  const usesPeriodo = idxAno !== -1 && idxMes !== -1;
  const usesData = !usesPeriodo && idxData !== -1;

  let searchPeriodo;
  let periodoDaLinha;

  if (usesPeriodo) {
    if (!searchAno || !searchMes) return null;
    searchPeriodo = searchAno + "-" + searchMes;
    periodoDaLinha = function(row) {
      const ano = row[idxAno] ? row[idxAno].toString().trim() : "";
      const mes = normalizeMonthCode(row[idxMes]);
      return ano && mes ? ano + "-" + mes : "";
    };
  } else if (usesData) {
    if (!searchData) return null;
    searchPeriodo = searchData;
    periodoDaLinha = function(row) { return toDateKey(row[idxData]); };
  } else {
    return null;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (normalize(row[idxUnidade]) !== searchUnidade) continue;
    if (normalize(row[idxAtividade]) !== searchAtividade) continue;

    // Discriminadores adicionais: só participam quando a área realmente os usa, para não impedir
    // a deduplicação nas áreas (e nas linhas legadas) em que a coluna não existe ou está vazia.
    if (idxTipo !== -1 && searchTipo && normalize(row[idxTipo]) !== searchTipo) continue;
    if (idxDivisao !== -1 && searchDivisao && normalize(row[idxDivisao]) !== searchDivisao) continue;

    // Articulação e Difusão: a mesma atividade pode acontecer em dias diferentes do mesmo mês, e
    // cada ocorrência é um relatório próprio. O dia entra na identidade pelo primeiro dia
    // selecionado no calendário, que é o mesmo critério usado para nomear o relatório.
    //
    // Só há duplicata quando o dia CONFERE dos dois lados. Se o dia não puder ser comparado
    // (envio sem dia, ou linha legada gravada sem o dia), a ocorrência não é tratada como a
    // mesma — cria uma linha nova em vez de arriscar bloquear/sobrescrever a ocorrência errada.
    if (idxDias !== -1) {
      const rowDia = getFirstDayOfMonth(row[idxDias]);
      if (!searchDia || !rowDia || rowDia !== searchDia) continue;
    }

    // Fundação CASA: a mesma atividade pode ter duas turmas no mesmo centro/mês, diferenciadas por
    // dias da semana + horário — os dois entram na identidade. A comparação é TOLERANTE com o
    // legado: uma linha antiga gravada antes dessas colunas existirem continua bloqueando um novo
    // envio do mesmo mês. Só há divergência quando os dois lados têm valor e eles não conferem.
    if (idxDiasSemana !== -1 && searchDiasSemana) {
      const rowDiasSemana = Utils.weekdaySetKey(row[idxDiasSemana]);
      if (rowDiasSemana && rowDiasSemana !== searchDiasSemana) continue;
    }
    if (idxHorario !== -1 && searchHorario) {
      const rowHorario = Utils.horarioKey(row[idxHorario]);
      if (rowHorario && rowHorario !== searchHorario) continue;
    }

    const rowPeriodo = periodoDaLinha(row);
    if (rowPeriodo && rowPeriodo === searchPeriodo) {
      return i + 2;
    }
  }
  return null;
}

/**
 * Busca o e-mail na planilha exclusiva de Usuários da equipe de Sistemas
 */
function getUsersSpreadsheetConnection() {
  const usersId = CONFIG.SPREADSHEET_USERS_ID ? CONFIG.SPREADSHEET_USERS_ID.trim() : "";
  if (usersId && !usersId.startsWith("INSIRA_O_ID")) {
    try {
      return SpreadsheetApp.openById(usersId);
    } catch (err) {
      Logger.log("Falha ao abrir Planilha Exclusiva de Usuários: " + err.toString());
    }
  }
  return getListsSpreadsheetConnection();
}

function checkEmailInWhitelist(email) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();

  // Consulta sempre direto na planilha (sem CacheService) para que qualquer alteração de
  // permissão/unidade feita pela equipe de Sistemas reflita imediatamente em todo carregamento
  // de página, sem depender da expiração de um cache local.
  const ss = getUsersSpreadsheetConnection();
  const sheet = ss.getSheetByName("Responsaveis_Autorizados") || ss.getSheetByName("Usuários") || ss.getSheets()[0];

  if (!sheet) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  // A leitura era fixa em 4 colunas: uma aba com menos colunas fazia getRange lançar exceção e
  // derrubava o login inteiro da Área Restrita, em vez de apenas não encontrar o e-mail.
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return null;
  const numCols = Math.min(4, lastCol);

  const values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowEmail = values[i][0] ? values[i][0].toString().trim().toLowerCase() : "";
    if (rowEmail === cleanEmail) {
      const unidadeRaw = values[i][2] ? values[i][2].toString().trim() : "Todas";
      return {
        email: rowEmail,
        nome: values[i][1] ? values[i][1].toString().trim() : "Responsável",
        unidade: unidadeRaw || "Todas",
        unidades: Utils.parseUnidadesList(unidadeRaw),
        setor: values[i][3] ? values[i][3].toString().trim() : "Pedagógico"
      };
    }
  }
  return null;
}

/**
 * Extrai o primeiro dia do mês de uma seleção de dias ("5, 12, 19" -> "5").
 *
 * Normaliza para número sem zero à esquerda dos dois lados da comparação, para que "05" e "5"
 * — formas que aparecem conforme o valor venha do formulário ou de uma célula da planilha —
 * sejam reconhecidos como o mesmo dia.
 *
 * @return {string} O dia, ou "" se não houver dia reconhecível
 */
function getFirstDayOfMonth(diasAtividade) {
  if (!diasAtividade && diasAtividade !== 0) return "";

  // Se o Google Sheets converteu a célula em objeto Date (ex.: "1, 5, 10" interpretado como data)
  if (diasAtividade instanceof Date && !isNaN(diasAtividade.getTime())) {
    try {
      const diaNum = diasAtividade.getDate();
      return diaNum >= 1 && diaNum <= 31 ? String(diaNum) : "";
    } catch (e) {
      return "";
    }
  }

  const str = diasAtividade.toString().trim();
  if (!str) return "";

  // Se for uma lista de dias separada por vírgula/ponto-e-vírgula ("1, 5, 10", "1, 5, 2010", "5, 12, 19")
  const primeiro = str.split(/[,;]/)[0].replace(/[^0-9]/g, "");
  if (primeiro) {
    const numero = parseInt(primeiro, 10);
    if (!isNaN(numero) && numero >= 1 && numero <= 31) {
      return String(numero);
    }
  }

  // Se for uma data formatada ("2010-05-01" ou "01/05/2010")
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (brMatch) {
    const d = parseInt(brMatch[1], 10);
    if (!isNaN(d) && d >= 1 && d <= 31) return String(d);
  }

  return "";
}

/**
 * Normaliza a representação do mês para o código numérico de 2 dígitos ("01" a "12")
 */
function normalizeMonthCode(mes) {
  if (!mes) return "";
  const str = mes.toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (str.includes("JANEIRO") || str === "01" || str === "1") return "01";
  if (str.includes("FEVEREIRO") || str === "02" || str === "2") return "02";
  if (str.includes("MARCO") || str === "03" || str === "3") return "03";
  if (str.includes("ABRIL") || str === "04" || str === "4") return "04";
  if (str.includes("MAIO") || str === "05" || str === "5") return "05";
  if (str.includes("JUNHO") || str === "06" || str === "6") return "06";
  if (str.includes("JULHO") || str === "07" || str === "7") return "07";
  if (str.includes("AGOSTO") || str === "08" || str === "8") return "08";
  if (str.includes("SETEMBRO") || str === "09" || str === "9") return "09";
  if (str.includes("OUTUBRO") || str === "10") return "10";
  if (str.includes("NOVEMBRO") || str === "11") return "11";
  if (str.includes("DEZEMBRO") || str === "12") return "12";
  return str.replace(/[^0-9]/g, "");
}

/**
 * Localiza a atividade na planilha de respostas e verifica presença de documentos.
 * Filtra rigorosamente por Unidade, Atividade, Tipo, Ano de Referência e Mês de Referência.
 *
 * As colunas são resolvidas pelo nome canônico exato. A busca anterior era por "contém", com
 * recuos fixos de posição (colunas B/E/F/G) quando nada casava — o que, numa planilha cujo
 * cabeçalho tivesse mudado, apontava para colunas erradas e podia devolver a linha de outra
 * atividade. O Tipo entra no filtro para não confundir atividades homônimas de tipos diferentes.
 */
function findActivityRowAndDocs(params) {
  const ss = getResponsesSpreadsheetConnection(params.setor);
  const config = getSheetConfigForArea(params.setor);
  const sheet = ss.getSheetByName(config.sheetName);

  if (!sheet) return { exists: false };

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { exists: false };

  const normalize = Utils.normalizeText;
  const headerIndex = readHeaderLayout(sheet).index;
  const colOf = function(headerName) {
    const idx = headerIndex[normalizeHeaderKey(headerName)];
    return idx === undefined ? -1 : idx;
  };

  const idxUnidade = colOf("Unidade") !== -1 ? colOf("Unidade") : colOf("Centro de Atendimento (Unidade)");
  const idxAtividade = colOf("Nome da Atividade");
  const idxAno = colOf("Ano de Referência");
  const idxMes = colOf("Mês de Referência");
  const idxTipo = colOf("Tipo (Trilha/Ateliê/Núcleo)");
  const idxInscricao = colOf("Inscrição Enviada");
  const idxPresenca = colOf("Presença Enviada");

  // Sem a coluna que identifica a atividade não há como responder com segurança; devolver
  // "não existe" é preferível a apontar para a linha errada.
  if (idxAtividade === -1) return { exists: false };

  const searchUnidade = normalize(params.unidade);
  const searchAtividade = normalize(params.atividade);
  const searchAno = params.anoReferencia ? params.anoReferencia.toString().trim() : "";
  const searchMesNorm = normalizeMonthCode(params.mesReferencia);
  const searchTipo = normalize(params.tipoPedagogico);

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowUnidade = idxUnidade !== -1 ? normalize(row[idxUnidade]) : "";
    const rowAtividade = normalize(row[idxAtividade]);
    const rowAno = idxAno !== -1 && row[idxAno] ? row[idxAno].toString().trim() : "";
    const rowMesNorm = idxMes !== -1 && row[idxMes] ? normalizeMonthCode(row[idxMes]) : "";
    const rowTipo = idxTipo !== -1 ? normalize(row[idxTipo]) : "";

    const matchUnidade = !searchUnidade || rowUnidade === searchUnidade;
    const matchAtividade = rowAtividade === searchAtividade;
    const matchAno = !searchAno || rowAno === searchAno;
    const matchMes = !searchMesNorm || rowMesNorm === searchMesNorm;
    // Linhas legadas gravadas sem Tipo continuam elegíveis, para não travar a Área Restrita.
    const matchTipo = idxTipo === -1 || !searchTipo || !rowTipo || rowTipo === searchTipo;

    if (matchUnidade && matchAtividade && matchAno && matchMes && matchTipo) {
      return {
        exists: true,
        rowNumber: i + 2,
        hasInscricao: idxInscricao !== -1 && row[idxInscricao] === "Sim",
        hasPresenca: idxPresenca !== -1 && row[idxPresenca] === "Sim"
      };
    }
  }
  return { exists: false };
}

/**
 * Revalida no backend o que a Área Restrita já checa no front-end: o e-mail precisa constar
 * na Lista Branca e a unidade informada no envio precisa estar entre as unidades liberadas para
 * esse e-mail (ou o e-mail ter acesso "Todas"). Sem isso, uma chamada direta à API (a URL do
 * Apps Script é pública, visível em js/api.js) poderia contornar completamente a trava de
 * permissão de unidade e enviar documentos em nome de qualquer e-mail para qualquer unidade.
 */
function authorizeComplementaryDocsUpload(payload) {
  const email = payload && payload.userEmail ? payload.userEmail.toString().trim().toLowerCase() : "";
  if (!email) {
    throw new Error("Acesso não autorizado: e-mail do responsável não informado.");
  }

  const authorizedUser = checkEmailInWhitelist(email);
  if (!authorizedUser) {
    throw new Error("Acesso não autorizado: e-mail não consta na lista de responsáveis autorizados.");
  }

  const unidadesPermitidas = authorizedUser.unidades || Utils.parseUnidadesList(authorizedUser.unidade);
  const acessoTotal = unidadesPermitidas.some(u => Utils.normalizeText(u) === "TODAS");

  if (!acessoTotal) {
    const unidadeAlvo = Utils.normalizeText(payload.unidade);
    const isAllowed = unidadesPermitidas.some(u => Utils.normalizeText(u) === unidadeAlvo);
    if (!unidadeAlvo || !isAllowed) {
      throw new Error("Acesso não autorizado: este e-mail não tem permissão para enviar documentos para a unidade '" + (payload.unidade || "N/D") + "'.");
    }
  }
}

/**
 * Grava documentos no Drive e atualiza colunas de controle na planilha
 */
function saveComplementaryDocsAndRow(payload) {
  authorizeComplementaryDocsUpload(payload);

  const activityInfo = findActivityRowAndDocs(payload);
  if (!activityInfo.exists) {
    throw new Error("Atividade não localizada nos registros pedagógicos deste mês/ano.");
  }
  if (activityInfo.hasInscricao || activityInfo.hasPresenca) {
    throw new Error("Os documentos desta atividade já foram enviados anteriormente neste mês/ano. Não é permitido o reenvio.");
  }

  const hasInscFile = payload.files && payload.files.some(function(f) { return f.docType === "fileInscricao"; });
  const hasPresFile = payload.files && payload.files.some(function(f) { return f.docType === "filePresenca"; });

  if (!hasInscFile || !hasPresFile) {
    throw new Error("É obrigatório enviar ambos os arquivos PDF (Registro de Inscrição e Lista de Presença) simultaneamente.");
  }

  const folders = getOrCreateFolderStructure(
    payload.setor,
    payload.mesReferencia + "/" + payload.anoReferencia,
    payload.unidade,
    payload.atividade,
    payload.tipoPedagogico || "",
    "",
    payload.userName,
    payload.mesReferencia,
    payload.anoReferencia
  );

  let subiuInscricao = "Não";
  let subiuPresenca = "Não";

  if (payload.files && payload.files.length > 0) {
    for (let i = 0; i < payload.files.length; i++) {
      const f = payload.files[i];
      if (f.docType === "fileInscricao" && (folders.relacaoInscritosFolder || folders.activityFolder)) {
        const targetFolder = folders.relacaoInscritosFolder || folders.activityFolder;
        uploadSingleFile(f, targetFolder, payload);
        subiuInscricao = "Sim";
      } else if (f.docType === "filePresenca" && (folders.listaPresencaFolder || folders.activityFolder)) {
        const targetFolder = folders.listaPresencaFolder || folders.activityFolder;
        uploadSingleFile(f, targetFolder, payload);
        subiuPresenca = "Sim";
      }
    }
  }

  const ss = getResponsesSpreadsheetConnection(payload.setor);
  const config = getSheetConfigForArea(payload.setor);
  const sheet = ss.getSheetByName(config.sheetName);

  if (sheet && activityInfo.exists) {
    const controlHeaders = ["Inscrição Enviada", "Presença Enviada", "Atualizado Por (Login)", "Data/Hora Atualização"];
    let layout = readHeaderLayout(sheet);

    if (layout.index[normalizeHeaderKey(controlHeaders[0])] === undefined) {
      sheet.getRange(1, layout.width + 1, 1, controlHeaders.length).setValues([controlHeaders])
        .setFontWeight("bold").setBackground("#e2e8f0");
      SpreadsheetApp.flush();
      layout = readHeaderLayout(sheet);
    }

    const timestamp = Utils.getFormattedTimestampBR(new Date());
    const controlValues = [
      subiuInscricao === "Sim" ? "Sim" : (activityInfo.hasInscricao ? "Sim" : "Não"),
      subiuPresenca === "Sim" ? "Sim" : (activityInfo.hasPresenca ? "Sim" : "Não"),
      payload.userEmail,
      timestamp
    ];

    // Cada coluna de controle é gravada na sua própria posição, localizada pelo nome. A gravação
    // anterior assumia que essas 4 colunas eram sempre as 4 últimas da planilha (getLastColumn - 3);
    // bastava a planilha ganhar qualquer outra coluna à direita para os quatro valores caírem sobre
    // dados de outras colunas.
    for (let c = 0; c < controlHeaders.length; c++) {
      const colIdx = layout.index[normalizeHeaderKey(controlHeaders[c])];
      if (colIdx !== undefined) {
        sheet.getRange(activityInfo.rowNumber, colIdx + 1).setValue(controlValues[c]);
      }
    }
    SpreadsheetApp.flush();
  }

  return { success: true };
}

function uploadSingleFile(fileObj, folder, payload) {
  let base64 = fileObj.base64Data || "";
  if (base64.includes(",")) base64 = base64.split(",")[1];
  const bytes = Utilities.base64Decode(base64);
  const fileName = fileObj.name || "Documento.pdf";

  Utils.removeExistingFilesByName(folder, fileName);

  const blob = Utilities.newBlob(bytes, fileObj.mimeType || "application/pdf", fileName);
  folder.createFile(blob);
}

