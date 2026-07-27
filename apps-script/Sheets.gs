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

function getDropdownData() {
  try {
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get("poiesis_dropdown_hierarchy");
    if (cachedData) {
      return JSON.parse(cachedData);
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
    
    cache.put("poiesis_dropdown_hierarchy", JSON.stringify(hierarchy), 300);
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
        "Tipo (Trilha/Ateliê)", "Nome da Atividade", "Ano de Referência", "Mês de Referência",
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
        "Destaque da Ação", "Objetivos da Atividade", "Impacto Territorial / Cultural", "Relato",
        "Descrição das Ações e Metodologia", "Pontos Fortes", "Pontos Fracos e Desafios"
      ]
    };
  } else if (areaUpper === "FUNDAÇÃO CASA") {
    return {
      sheetName: CONFIG.SHEET_RESPONSES_FUNDACAO_CASA,
      headers: [
        "Carimbo de Data/Hora", "Divisão Regional", "Centro de Atendimento (Unidade)", "Número do Contrato",
        "Meta de Referência", "Nome da Atividade", "Ano de Referência", "Mês de Referência",
        "Razão Social (Responsável)", "Encontros Previstos", "Encontros Realizados", "Data de Eventual Reposição",
        "Destaque da Ação", "Objetivos da Atividade", "Impacto Territorial / Cultural", "Descrição das Ações e Metodologia",
        "Engajamento e Participação", "Pontos Fortes", "Pontos Fracos e Desafios"
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
    
    const timestamp = new Date();
    let newRow = [];
    const areaUpper = data.area.trim().toUpperCase();
    
    if (areaUpper === "PEDAGÓGICO") {
      newRow = [
        timestamp, data.unidade || "", data.contrato || "", data.metaReferencia || "",
        data.tipoPedagogico || "", data.atividade || "", data.anoReferencia || "", data.mesReferencia || "",
        data.responsavel || "", data.encontrosPrevistos || "", data.encontrosRealizados || "",
        data.cargaHorariaPrevista || "", data.cargaHorariaRealizada || "", data.dataReposicao || "",
        data.publicoTotal || "", data.perfilPublico || "", data.faixaEtaria || "", data.destaqueAcao || "",
        data.objetivos || "", data.impactoCultural || "", data.descricaoMetodologia || "",
        data.engajamentoParticipacao || "", data.pontosFortes || "", data.pontosFracos || ""
      ];
    } else if (areaUpper === "ARTICULAÇÃO E DIFUSÃO") {
      newRow = [
        timestamp, data.unidade || "", data.contrato || "", data.metaReferencia || "",
        data.atividade || "", data.anoReferencia || "", data.mesReferencia || "", data.diasAtividade || "",
        data.responsavel || "", data.horarioInicio || "", data.horarioTermino || "", data.cargaHorariaTotal || "",
        data.numSessoes || "", data.publicoTotal || "", data.publicoSessao || "", data.perfilPublico || "",
        data.faixaEtaria || "", data.destaqueAcao || "", data.objetivos || "", data.impactoCultural || "",
        data.relato || "", data.descricaoMetodologia || "", data.pontosFortes || "", data.pontosFracos || ""
      ];
    } else if (areaUpper === "FUNDAÇÃO CASA") {
      newRow = [
        timestamp, data.divisaoRegional || "", data.unidade || "", data.contrato || "",
        data.metaReferencia || "", data.atividade || "", data.anoReferencia || "", data.mesReferencia || "",
        data.responsavel || "", data.encontrosPrevistos || "", data.encontrosRealizados || "",
        data.dataReposicao || "", data.destaqueAcao || "", data.objetivos || "", data.impactoCultural || "",
        data.descricaoMetodologia || "", data.engajamentoParticipacao || "", data.pontosFortes || "", data.pontosFracos || ""
      ];
    } else if (areaUpper === "BIBLIOTECA" || areaUpper === "BIBLIOTECAS") {
      newRow = [
        timestamp, data.unidade || "", data.contrato || "", data.metaReferencia || "",
        data.atividade || "", data.responsavel || "", data.dataRelatorio || "", data.horarioInicio || "",
        data.horarioTermino || "", data.publicoTotal || "", data.perfilPublico || "", data.faixaEtaria || "",
        data.destaqueAcao || "", data.objetivos || "", data.impactoCultural || "", data.descricaoMetodologia || "",
        data.engajamentoParticipacao || "", data.pontosFortes || "", data.pontosFracos || ""
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
