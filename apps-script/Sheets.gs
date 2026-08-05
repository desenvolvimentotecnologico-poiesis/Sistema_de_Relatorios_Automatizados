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
    const areaUpper = area.trim().toUpperCase();
    if (areaUpper === "PEDAGÓGICO" && CONFIG.SPREADSHEET_RESPONSES_PEDAGOGICO_ID && !CONFIG.SPREADSHEET_RESPONSES_PEDAGOGICO_ID.startsWith("INSIRA_O_ID")) {
      spreadsheetId = CONFIG.SPREADSHEET_RESPONSES_PEDAGOGICO_ID;
      varName = "SPREADSHEET_RESPONSES_PEDAGOGICO_ID";
    } else if (areaUpper === "ARTICULAÇÃO E DIFUSÃO" && CONFIG.SPREADSHEET_RESPONSES_ARTICULACAO_ID && !CONFIG.SPREADSHEET_RESPONSES_ARTICULACAO_ID.startsWith("INSIRA_O_ID")) {
      spreadsheetId = CONFIG.SPREADSHEET_RESPONSES_ARTICULACAO_ID;
      varName = "SPREADSHEET_RESPONSES_ARTICULACAO_ID";
    } else if (areaUpper === "FUNDAÇÃO CASA" && CONFIG.SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID && !CONFIG.SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID.startsWith("INSIRA_O_ID")) {
      spreadsheetId = CONFIG.SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID;
      varName = "SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID";
    } else if ((areaUpper === "BIBLIOTECA" || areaUpper === "BIBLIOTECAS") && CONFIG.SPREADSHEET_RESPONSES_BIBLIOTECA_ID && !CONFIG.SPREADSHEET_RESPONSES_BIBLIOTECA_ID.startsWith("INSIRA_O_ID")) {
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
  const areaUpper = area.trim().toUpperCase();
  
  if (areaUpper === "PEDAGÓGICO") {
    return {
      sheetName: CONFIG.SHEET_RESPONSES_PEDAGOGICO,
      headers: [
        "Carimbo de Data/Hora", "Unidade", "Número do Contrato", "Meta de Referência",
        "Tipo (Trilha/Ateliê/Núcleo)", "Nome da Atividade", "Ano de Referência", "Mês de Referência",
        "Responsável", "Encontros Previstos", "Encontros Realizados", "Carga Horária Prevista",
        "Carga Horária Realizada", "Data de Eventual Reposição", "Público Total", "Perfil do Público",
        "Faixa Etária Predominante", "Destaque da Ação", "Objetivos da Atividade", "Impacto Territorial / Cultural",
        "Descrição das Ações e Metodologia", "Engajamento e Participação", "Pontos Fortes", "Pontos Fracos e Desafios"
      ]
    };
  } else if (areaUpper === "ARTICULAÇÃO E DIFUSÃO") {
    return {
      sheetName: CONFIG.SHEET_RESPONSES_ARTICULACAO,
      headers: [
        "Carimbo de Data/Hora", "Unidade", "Número do Contrato", "Meta de Referência",
        "Nome da Atividade", "Ano de Referência", "Mês de Referência", "Dia(s) do Mês",
        "Responsável", "Horário de Início", "Horário de Término", "Carga Horária Total", "Número de Sessões",
        "Público Total", "Público por Sessão", "Perfil do Público", "Faixa Etária Predominante",
        "Destaque da Ação", "Objetivos da Atividade", "Impacto Territorial / Cultural",
        "Linguagem Artística", "Inclusão e Diversidade", "Efeméride", "Relato",
        "Descrição das Ações e Metodologia", "Pontos Fortes", "Pontos Fracos e Desafios"
      ]
    };
  } else if (areaUpper === "FUNDAÇÃO CASA") {
    return {
      sheetName: CONFIG.SHEET_RESPONSES_FUNDACAO_CASA,
      headers: [
        "Carimbo de Data/Hora", "Divisão Regional", "Centro de Atendimento (Unidade)", "Número do Contrato",
        "Meta de Referência", "Nome da Atividade", "Ano de Referência", "Mês de Referência",
        "Razão Social (Responsável)", "Encontros Previstos", "Encontros Realizados", "Carga Horária Prevista",
        "Carga Horária Realizada", "Data de Eventual Reposição", "Destaque da Ação", "Objetivos da Atividade",
        "Impacto Territorial / Cultural", "Descrição das Ações e Metodologia", "Engajamento e Participação",
        "Pontos Fortes", "Pontos Fracos e Desafios"
      ]
    };
  } else if (areaUpper === "BIBLIOTECA" || areaUpper === "BIBLIOTECAS") {
    return {
      sheetName: CONFIG.SHEET_RESPONSES_BIBLIOTECA,
      headers: [
        "Carimbo de Data/Hora", "Unidade", "Número do Contrato", "Meta de Referência",
        "Nome da Atividade", "Responsável", "Data da Atividade", "Horário de Início",
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

function saveResponseRow(data) {
  try {
    const ss = getResponsesSpreadsheetConnection(data.area);
    const config = getSheetConfigForArea(data.area);
    let sheet = ss.getSheetByName(config.sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(config.sheetName);
      sheet.appendRow(config.headers);
      sheet.getRange(1, 1, 1, config.headers.length).setFontWeight("bold").setBackground("#f3f3f3");
    } else {
      const lastRow = sheet.getLastRow();
      if (lastRow === 0) {
        sheet.appendRow(config.headers);
        sheet.getRange(1, 1, 1, config.headers.length).setFontWeight("bold").setBackground("#f3f3f3");
      } else {
        const firstCellVal = sheet.getRange(1, 1).getValue();
        if (!firstCellVal || firstCellVal.toString().trim() === "") {
          sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
          sheet.getRange(1, 1, 1, config.headers.length).setFontWeight("bold").setBackground("#f3f3f3");
        }
      }
    }
    
    const timestamp = Utils.getFormattedTimestampBR(new Date());
    let newRow = [];
    const areaUpper = data.area.trim().toUpperCase();
    
    const contratoVal = data.contrato || data.numeroContrato || "";
    const impactoVal = data.impactoCultural || data.impactoTerritorial || "";

    const formatField = function(val) {
      if (val === null || val === undefined) return "";
      if (Array.isArray(val)) return val.join("; ");
      return String(val);
    };

    if (areaUpper === "PEDAGÓGICO") {
      newRow = [
        timestamp,
        formatField(data.unidade),
        formatField(contratoVal),
        formatField(data.metaReferencia),
        formatField(data.tipoPedagogico),
        formatField(data.atividade),
        formatField(data.anoReferencia),
        formatField(data.mesReferencia),
        formatField(data.responsavel),
        formatField(data.encontrosPrevistos),
        formatField(data.encontrosRealizados),
        formatField(data.cargaHorariaPrevista),
        formatField(data.cargaHorariaRealizada),
        formatField(data.dataReposicao),
        formatField(data.publicoTotal),
        formatField(data.perfilPublico),
        formatField(data.faixaEtaria),
        formatField(data.destaqueAcao),
        formatField(data.objetivos),
        formatField(impactoVal),
        formatField(data.descricaoMetodologia),
        formatField(data.engajamentoParticipacao),
        formatField(data.pontosFortes),
        formatField(data.pontosFracos)
      ];
    } else if (areaUpper === "ARTICULAÇÃO E DIFUSÃO") {
      newRow = [
        timestamp,
        formatField(data.unidade),
        formatField(contratoVal),
        formatField(data.metaReferencia),
        formatField(data.atividade),
        formatField(data.anoReferencia),
        formatField(data.mesReferencia),
        formatField(data.diasAtividade),
        formatField(data.responsavel),
        formatField(data.horarioInicio),
        formatField(data.horarioTermino),
        formatField(data.cargaHorariaTotal),
        formatField(data.numSessoes),
        formatField(data.publicoTotal),
        formatField(data.publicoSessao),
        formatField(data.perfilPublico),
        formatField(data.faixaEtaria),
        formatField(data.destaqueAcao),
        formatField(data.objetivos),
        formatField(impactoVal),
        formatField(data.linguagemArtistica),
        formatField(data.inclusaoDiversidade),
        formatField(data.efemeride),
        formatField(data.relato),
        formatField(data.descricaoMetodologia),
        formatField(data.pontosFortes),
        formatField(data.pontosFracos)
      ];
    } else if (areaUpper === "FUNDAÇÃO CASA") {
      newRow = [
        timestamp,
        formatField(data.divisaoRegional),
        formatField(data.unidade),
        formatField(contratoVal),
        formatField(data.metaReferencia),
        formatField(data.atividade),
        formatField(data.anoReferencia),
        formatField(data.mesReferencia),
        formatField(data.responsavel),
        formatField(data.encontrosPrevistos),
        formatField(data.encontrosRealizados),
        formatField(data.cargaHorariaPrevista),
        formatField(data.cargaHorariaRealizada),
        formatField(data.dataReposicao),
        formatField(data.destaqueAcao),
        formatField(data.objetivos),
        formatField(impactoVal),
        formatField(data.descricaoMetodologia),
        formatField(data.engajamentoParticipacao),
        formatField(data.pontosFortes),
        formatField(data.pontosFracos)
      ];
    } else if (areaUpper === "BIBLIOTECA" || areaUpper === "BIBLIOTECAS") {
      newRow = [
        timestamp,
        formatField(data.unidade),
        formatField(contratoVal),
        formatField(data.metaReferencia),
        formatField(data.atividade),
        formatField(data.responsavel),
        formatField(data.dataRelatorio),
        formatField(data.horarioInicio),
        formatField(data.horarioTermino),
        formatField(data.publicoTotal),
        formatField(data.perfilPublico),
        formatField(data.faixaEtaria),
        formatField(data.destaqueAcao),
        formatField(data.objetivos),
        formatField(impactoVal),
        formatField(data.descricaoMetodologia),
        formatField(data.engajamentoParticipacao),
        formatField(data.pontosFortes),
        formatField(data.pontosFracos)
      ];
    }
    
    sheet.appendRow(newRow);
    
    return {
      sheetName: config.sheetName,
      rowNumber: sheet.getLastRow()
    };
  } catch (error) {
    Logger.log("Erro ao gravar dados na planilha: " + error.toString());
    throw new Error("Falha ao salvar respostas: " + error.message);
  }
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
  const ss = getUsersSpreadsheetConnection();
  let sheet = ss.getSheetByName("Responsaveis_Autorizados") || ss.getSheetByName("Usuários") || ss.getSheets()[0];
  
  if (!sheet) {
    return null;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  for (let i = 0; i < values.length; i++) {
    const rowEmail = values[i][0] ? values[i][0].toString().trim().toLowerCase() : "";
    if (rowEmail === email) {
      return {
        email: rowEmail,
        nome: values[i][1] ? values[i][1].toString().trim() : "Responsável",
        unidade: values[i][2] ? values[i][2].toString().trim() : "Todas",
        setor: values[i][3] ? values[i][3].toString().trim() : "Pedagógico"
      };
    }
  }
  return null;
}

/**
 * Localiza a atividade na planilha de respostas e verifica presença de documentos
 */
function findActivityRowAndDocs(params) {
  const ss = getResponsesSpreadsheetConnection(params.setor);
  const config = getSheetConfigForArea(params.setor);
  const sheet = ss.getSheetByName(config.sheetName);

  if (!sheet) return { exists: false };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { exists: false };

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const searchAtividade = params.atividade ? params.atividade.trim().toUpperCase() : "";
  const searchUnidade = params.unidade ? params.unidade.trim().toUpperCase() : "";

  for (let i = 0; i < values.length; i++) {
    const rowUnidade = values[i][1] ? values[i][1].toString().trim().toUpperCase() : "";
    const rowAtividade = values[i][5] ? values[i][5].toString().trim().toUpperCase() : "";

    if (rowUnidade === searchUnidade && rowAtividade === searchAtividade) {
      const lastCol = sheet.getLastColumn();
      return {
        exists: true,
        rowNumber: i + 2,
        hasInscricao: values[i][lastCol - 4] === "Sim",
        hasPresenca: values[i][lastCol - 3] === "Sim"
      };
    }
  }
  return { exists: false };
}

/**
 * Grava documentos no Drive e atualiza colunas de controle na planilha
 */
function saveComplementaryDocsAndRow(payload) {
  const folders = getOrCreateFolderStructure(
    payload.setor,
    payload.mesReferencia + "/" + payload.anoReferencia,
    payload.unidade,
    payload.atividade,
    "", "", payload.userName,
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

  if (sheet) {
    let lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    if (!headers.includes("Inscrição Enviada")) {
      sheet.getRange(1, lastCol + 1, 1, 4).setValues([[
        "Inscrição Enviada", "Presença Enviada", "Atualizado Por (Login)", "Data/Hora Atualização"
      ]]).setFontWeight("bold").setBackground("#e2e8f0");
      lastCol += 4;
    }

    const activityInfo = findActivityRowAndDocs(payload);
    const timestamp = Utils.getFormattedTimestampBR(new Date());

    if (activityInfo.exists) {
      const colStart = sheet.getLastColumn() - 3;
      sheet.getRange(activityInfo.rowNumber, colStart, 1, 4).setValues([[
        subiuInscricao === "Sim" ? "Sim" : (activityInfo.hasInscricao ? "Sim" : "Não"),
        subiuPresenca === "Sim" ? "Sim" : (activityInfo.hasPresenca ? "Sim" : "Não"),
        payload.userEmail,
        timestamp
      ]]);
    }
  }

  return { success: true };
}

function uploadSingleFile(fileObj, folder, payload) {
  let base64 = fileObj.base64Data || "";
  if (base64.includes(",")) base64 = base64.split(",")[1];
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, fileObj.mimeType, fileObj.name);
  const file = folder.createFile(blob);
  const sigla = Utils.getUnidadeSigla(payload.unidade);
  const cleanAtv = Utils.sanitizeFileName(payload.atividade).toUpperCase().replace(/\s+/g, "_");
  file.setName(sigla + "_" + fileObj.docType + "_" + cleanAtv + "_" + fileObj.name);
}

