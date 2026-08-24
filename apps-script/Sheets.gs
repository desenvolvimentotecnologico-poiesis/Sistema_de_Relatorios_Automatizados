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
        "Responsável", "Encontros Previstos", "Encontros Realizados", "Carga Horária Prevista",
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
        "Responsável", "Horário de Início", "Horário de Término", "Carga Horária Total", "Número de Sessões",
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
        "Razão Social (Responsável)", "Encontros Previstos", "Encontros Realizados", "Carga Horária Prevista",
        "Carga Horária Realizada", "Data de Eventual Reposição", "Destaque da Ação", "Objetivos da Atividade",
        "Impacto Territorial / Cultural", "Descrição das Ações e Metodologia", "Engajamento e Participação",
        "Pontos Fortes", "Pontos Fracos e Desafios"
      ]
    };
  } else if (areaNorm === "BIBLIOTECA") {
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
        Utils.formatField(data.pontosFracos)
      ];
    } else if (areaNorm === "BIBLIOTECA") {
      newRow = [
        timestamp,
        Utils.formatField(data.unidade),
        Utils.formatField(contratoVal),
        Utils.formatField(data.metaReferencia),
        Utils.formatField(data.atividade),
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
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
    } catch (lockErr) {
      throw new Error("O sistema está processando outro envio no momento. Aguarde alguns segundos e tente novamente.");
    }

    try {
      const duplicateRowNumber = findDuplicateActivityRow(sheet, data);
      if (duplicateRowNumber) {
        sheet.getRange(duplicateRowNumber, 1, 1, newRow.length).setValues([newRow]);
        Logger.log("Envio duplicado detectado para a mesma atividade. Linha " + duplicateRowNumber + " sobrescrita com os dados mais recentes.");
        return {
          sheetName: config.sheetName,
          rowNumber: duplicateRowNumber
        };
      }

      sheet.appendRow(newRow);

      return {
        sheetName: config.sheetName,
        rowNumber: sheet.getLastRow()
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
 * Localiza uma linha já existente na planilha de respostas para a mesma Unidade + Atividade
 * + Período de referência (Ano/Mês, ou Data da Atividade quando a área não usa Ano/Mês).
 * Usado para impedir o envio duplicado da mesma atividade (ex.: reenvio após timeout de rede).
 */
function findDuplicateActivityRow(sheet, data) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return null;

  const normalize = Utils.normalizeText;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalize);

  const idxUnidade = headers.findIndex(h => h.includes("UNIDADE"));
  const idxAtividade = headers.findIndex(h => h.includes("NOME DA ATIVIDADE"));
  const idxAno = headers.findIndex(h => h.includes("ANO DE REFERENCIA"));
  const idxMes = headers.findIndex(h => h.includes("MES DE REFERENCIA"));
  const idxData = headers.findIndex(h => h.includes("DATA DA ATIVIDADE"));

  if (idxUnidade === -1 || idxAtividade === -1) return null;

  const searchUnidade = normalize(data.unidade);
  const searchAtividade = normalize(data.atividade);
  const searchAno = data.anoReferencia ? data.anoReferencia.toString().trim() : "";
  const searchMes = normalizeMonthCode(data.mesReferencia);
  const searchData = normalize(data.dataRelatorio);

  if (!searchUnidade || !searchAtividade) return null;

  const usesPeriodo = idxAno !== -1 && idxMes !== -1;
  const usesData = !usesPeriodo && idxData !== -1;

  if (usesPeriodo && !searchAno && !searchMes) return null;
  if (usesData && !searchData) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowUnidade = normalize(row[idxUnidade]);
    const rowAtividade = normalize(row[idxAtividade]);
    if (rowUnidade !== searchUnidade || rowAtividade !== searchAtividade) continue;

    if (usesPeriodo) {
      const rowAno = row[idxAno] ? row[idxAno].toString().trim() : "";
      const rowMes = normalizeMonthCode(row[idxMes]);
      if (rowAno === searchAno && rowMes === searchMes) {
        return i + 2;
      }
    } else if (usesData) {
      const rowData = normalize(row[idxData]);
      if (rowData === searchData) {
        return i + 2;
      }
    } else {
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

  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

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
 * Localiza a atividade na planilha de respostas e verifica presença de documentos
 * Filtra rigorosamente por Unidade, Atividade, Ano de Referência e Mês de Referência
 */
function findActivityRowAndDocs(params) {
  const ss = getResponsesSpreadsheetConnection(params.setor);
  const config = getSheetConfigForArea(params.setor);
  const sheet = ss.getSheetByName(config.sheetName);

  if (!sheet) return { exists: false };

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { exists: false };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => h ? h.toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "");
  
  // Localização dinâmica flexível das colunas pelos cabeçalhos da planilha
  let idxUnidade = headers.findIndex(h => h.includes("UNIDADE"));
  let idxAtividade = headers.findIndex(h => h.includes("ATIVIDADE"));
  let idxAno = headers.findIndex(h => h.includes("ANO"));
  let idxMes = headers.findIndex(h => h.includes("MES"));

  if (idxUnidade === -1) idxUnidade = 1; // Fallback Coluna B
  if (idxAtividade === -1) idxAtividade = 4; // Fallback Coluna E
  if (idxAno === -1) idxAno = 5; // Fallback Coluna F
  if (idxMes === -1) idxMes = 6; // Fallback Coluna G

  const idxInscricao = headers.findIndex(h => h.includes("INSCRICAO"));
  const idxPresenca = headers.findIndex(h => h.includes("PRESENCA"));

  const searchUnidade = params.unidade ? params.unidade.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
  const searchAtividade = params.atividade ? params.atividade.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
  const searchAno = params.anoReferencia ? params.anoReferencia.toString().trim() : "";
  const searchMesNorm = normalizeMonthCode(params.mesReferencia);

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowUnidade = idxUnidade !== -1 && row[idxUnidade] ? row[idxUnidade].toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    const rowAtividade = idxAtividade !== -1 && row[idxAtividade] ? row[idxAtividade].toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    const rowAno = idxAno !== -1 && row[idxAno] ? row[idxAno].toString().trim() : "";
    const rowMesNorm = idxMes !== -1 && row[idxMes] ? normalizeMonthCode(row[idxMes]) : "";

    const matchUnidade = !searchUnidade || rowUnidade === searchUnidade;
    const matchAtividade = rowAtividade === searchAtividade;
    const matchAno = !searchAno || rowAno === searchAno;
    const matchMes = !searchMesNorm || rowMesNorm === searchMesNorm;

    if (matchUnidade && matchAtividade && matchAno && matchMes) {
      const hasInsc = idxInscricao !== -1 ? row[idxInscricao] === "Sim" : (lastCol >= 4 && row[lastCol - 4] === "Sim");
      const hasPres = idxPresenca !== -1 ? row[idxPresenca] === "Sim" : (lastCol >= 3 && row[lastCol - 3] === "Sim");

      return {
        exists: true,
        rowNumber: i + 2,
        hasInscricao: hasInsc,
        hasPresenca: hasPres
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

  if (sheet) {
    let lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    if (!headers.includes("Inscrição Enviada")) {
      sheet.getRange(1, lastCol + 1, 1, 4).setValues([[
        "Inscrição Enviada", "Presença Enviada", "Atualizado Por (Login)", "Data/Hora Atualização"
      ]]).setFontWeight("bold").setBackground("#e2e8f0");
      lastCol += 4;
    }

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
  const fileName = fileObj.name || "Documento.pdf";

  Utils.removeExistingFilesByName(folder, fileName);

  const blob = Utilities.newBlob(bytes, fileObj.mimeType || "application/pdf", fileName);
  folder.createFile(blob);
}

