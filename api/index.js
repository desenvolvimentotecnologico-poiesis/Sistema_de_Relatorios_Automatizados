const { getSheetsService, getDriveService, getDocsService } = require("./_googleAuth");
const CONFIG = require("./_config");

const SPREADSHEET_LISTS_ID = CONFIG.SPREADSHEET_LISTS_ID;
const SPREADSHEET_USERS_ID = CONFIG.SPREADSHEET_USERS_ID;

const RESPONSES_SHEETS = {
  "PEDAGÓGICO": CONFIG.SPREADSHEET_RESPONSES_PEDAGOGICO_ID,
  "ARTICULAÇÃO E DIFUSÃO": CONFIG.SPREADSHEET_RESPONSES_ARTICULACAO_ID,
  "BIBLIOTECA": CONFIG.SPREADSHEET_RESPONSES_BIBLIOTECA_ID,
  "BIBLIOTECAS": CONFIG.SPREADSHEET_RESPONSES_BIBLIOTECA_ID,
  "FUNDAÇÃO CASA": CONFIG.SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID
};

function normalizeMonth(mes) {
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
 * Endpoint Vercel Serverless Function em Node.js
 */
module.exports = async (req, res) => {
  // Habilita cabeçalhos CORS
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  const action = body.action || req.query.action || "";

  try {
    switch (action) {
      case "verifyUserAccess":
        return res.status(200).json(await handleVerifyUserAccess(body));
      case "getDropdownData":
        return res.status(200).json(await handleGetDropdownData(body));
      case "checkActivityStatus":
        return res.status(200).json(await handleCheckActivityStatus(body));
      case "uploadComplementaryDocs":
        return res.status(200).json(await handleUploadComplementaryDocs(body));
      case "submitForm":
        return res.status(200).json(await handleSubmitForm(body));
      case "generatePdfReportAsync":
        return res.status(200).json(await handleGeneratePdfReportAsync(body));
      default:
        return res.status(400).json({ success: false, message: `Ação desconhecida ou não informada: '${action}'` });
    }
  } catch (err) {
    console.error("Erro na Vercel Serverless Function:", err);
    return res.status(500).json({ success: false, message: "Erro interno no servidor Vercel: " + err.message });
  }
};

/**
 * Valida o e-mail contra a planilha de usuários autorizados
 */
async function handleVerifyUserAccess(payload) {
  const email = (payload.email || "").trim().toLowerCase();
  if (!email) {
    return { success: false, message: "E-mail não fornecido." };
  }

  const sheets = getSheetsService();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_USERS_ID,
    range: "Responsaveis_Autorizados!A2:D100"
  });

  const rows = response.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    const rowEmail = rows[i][0] ? rows[i][0].toString().trim().toLowerCase() : "";
    if (rowEmail === email) {
      return {
        success: true,
        authorized: true,
        message: "Acesso autorizado.",
        user: {
          email: rowEmail,
          nome: rows[i][1] ? rows[i][1].toString().trim() : "Responsável",
          unidade: rows[i][2] ? rows[i][2].toString().trim() : "Todas",
          setor: rows[i][3] ? rows[i][3].toString().trim() : "Pedagógico"
        }
      };
    }
  }

  return { success: true, authorized: false, message: "E-mail não localizado na lista de autorizados." };
}

/**
 * Retorna as listas de atividades institucionais do Pedagógico
 */
async function handleGetDropdownData(payload) {
  const sheets = getSheetsService();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_LISTS_ID });
  const sheetList = meta.data.sheets || [];

  const hierarchy = {};

  for (const s of sheetList) {
    const title = s.properties.title.trim();
    const titleUpper = title.toUpperCase();
    if (s.properties.hidden || title.startsWith("_")) continue;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_LISTS_ID,
      range: `'${title}'!A2:B500`
    });

    const rows = res.data.values || [];

    if (titleUpper.includes("CASA")) {
      const casaMap = {};
      for (let j = 0; j < rows.length; j++) {
        const divisao = rows[j][0] ? rows[j][0].toString().trim() : "";
        const centro = rows[j][1] ? rows[j][1].toString().trim() : "";
        if (divisao && centro) {
          if (!casaMap[divisao]) casaMap[divisao] = [];
          if (!casaMap[divisao].includes(centro)) {
            casaMap[divisao].push(centro);
          }
        }
      }
      hierarchy["Fundação Casa"] = casaMap;
    } else {
      const items = [];
      for (const r of rows) {
        const type = r[0] ? r[0].toString().trim() : "";
        const name = r[1] ? r[1].toString().trim() : "";
        if (name) {
          items.push({ type: type, name: name });
        }
      }
      hierarchy[title] = items;
    }
  }

  return { success: true, hierarchy: hierarchy };
}

/**
 * Checa se a atividade existe no Sheets do setor e se possui Inscrição/Presença enviadas
 */
async function handleCheckActivityStatus(payload) {
  const setorUpper = (payload.setor || "PEDAGÓGICO").trim().toUpperCase();
  const spreadsheetId = RESPONSES_SHEETS[setorUpper] || process.env.SPREADSHEET_RESPONSES_PEDAGOGICO_ID;

  if (!spreadsheetId) {
    return { success: false, message: `ID de respostas para '${setorUpper}' não configurado nas variáveis da Vercel.` };
  }

  const sheets = getSheetsService();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: "Respostas!A1:Z5000"
  });

  const values = res.data.values || [];
  if (values.length < 2) return { success: true, exists: false };

  const headers = values[0].map(h => h ? h.toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "");

  let idxUnidade = headers.findIndex(h => h.includes("UNIDADE"));
  let idxAtividade = headers.findIndex(h => h.includes("ATIVIDADE"));
  let idxAno = headers.findIndex(h => h.includes("ANO"));
  let idxMes = headers.findIndex(h => h.includes("MES"));

  if (idxUnidade === -1) idxUnidade = 1;
  if (idxAtividade === -1) idxAtividade = 4;
  if (idxAno === -1) idxAno = 5;
  if (idxMes === -1) idxMes = 6;

  const idxInscricao = headers.findIndex(h => h.includes("INSCRICAO"));
  const idxPresenca = headers.findIndex(h => h.includes("PRESENCA"));

  const searchUnidade = (payload.unidade || "").trim().toUpperCase();
  const searchAtividade = (payload.atividade || "").trim().toUpperCase();
  const searchAno = (payload.anoReferencia || "").toString().trim();
  const searchMesNorm = normalizeMonth(payload.mesReferencia);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowUnidade = row[idxUnidade] ? row[idxUnidade].toString().trim().toUpperCase() : "";
    const rowAtividade = row[idxAtividade] ? row[idxAtividade].toString().trim().toUpperCase() : "";
    const rowAno = row[idxAno] ? row[idxAno].toString().trim() : "";
    const rowMesNorm = normalizeMonth(row[idxMes]);

    const matchUnidade = !searchUnidade || rowUnidade === searchUnidade;
    const matchAtividade = rowAtividade === searchAtividade;
    const matchAno = !searchAno || rowAno === searchAno;
    const matchMes = !searchMesNorm || rowMesNorm === searchMesNorm;

    if (matchUnidade && matchAtividade && matchAno && matchMes) {
      const hasInsc = idxInscricao !== -1 ? row[idxInscricao] === "Sim" : false;
      const hasPres = idxPresenca !== -1 ? row[idxPresenca] === "Sim" : false;

      return {
        success: true,
        exists: true,
        rowNumber: i + 1,
        hasInscricao: hasInsc,
        hasPresenca: hasPres
      };
    }
  }

  return { success: true, exists: false };
}

/**
 * Salva os arquivos PDF de Inscrição e Presença no Google Drive e atualiza o Sheets
 */
async function handleUploadComplementaryDocs(payload) {
  const status = await handleCheckActivityStatus(payload);
  if (!status.exists) {
    return { success: false, message: "Atividade não encontrada na planilha de respostas para este ano/mês." };
  }

  const drive = getDriveService();
  const sheets = getSheetsService();

  const rootFolderId = CONFIG.DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    return { success: false, message: "ID da pasta raiz do Drive (DRIVE_ROOT_FOLDER_ID) não configurado na Vercel." };
  }

  // Localiza/Cria subpastas: Setor -> Ano -> Unidade -> Mês -> Tipo -> Atividade
  const mesName = getMonthFolderName(payload.mesReferencia);
  const setorFolderId = await getOrCreateSubFolder(drive, rootFolderId, payload.setor || "Pedagógico");
  const anoFolderId = await getOrCreateSubFolder(drive, setorFolderId, payload.anoReferencia || "2026");
  const unidadeFolderId = await getOrCreateSubFolder(drive, anoFolderId, payload.unidade);
  const mesFolderId = await getOrCreateSubFolder(drive, unidadeFolderId, mesName);

  let parentFolderId = mesFolderId;
  if (payload.tipoPedagogico) {
    parentFolderId = await getOrCreateSubFolder(drive, mesFolderId, payload.tipoPedagogico);
  }

  const activityFolderId = await getOrCreateSubFolder(drive, parentFolderId, payload.atividade);
  const inscricaoFolderId = await getOrCreateSubFolder(drive, activityFolderId, "Relação de Inscritos");
  const presencaFolderId = await getOrCreateSubFolder(drive, activityFolderId, "Lista de Presença");

  let subiuInscricao = "Não";
  let subiuPresenca = "Não";

  if (payload.files && payload.files.length > 0) {
    for (const fileObj of payload.files) {
      const isPresenca = fileObj.docType === "filePresenca";
      const targetFolderId = isPresenca ? presencaFolderId : inscricaoFolderId;

      const base64Data = fileObj.base64Data.split(",")[1] || fileObj.base64Data;
      const buffer = Buffer.from(base64Data, "base64");

      await drive.files.create({
        requestBody: {
          name: fileObj.name,
          parents: [targetFolderId],
          mimeType: "application/pdf"
        },
        media: {
          mimeType: "application/pdf",
          body: require("stream").Readable.from(buffer)
        },
        supportsAllDrives: true,
        supportsTeamDrives: true
      });

      if (isPresenca) subiuPresenca = "Sim";
      else subiuInscricao = "Sim";
    }
  }

  // Atualiza colunas no Sheets
  const setorUpper = (payload.setor || "PEDAGÓGICO").trim().toUpperCase();
  const spreadsheetId = RESPONSES_SHEETS[setorUpper] || process.env.SPREADSHEET_RESPONSES_PEDAGOGICO_ID;
  const rowNum = status.rowNumber;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: "Respostas!1:1"
  });

  const headers = (res.data.values || [[]])[0].map(h => h ? h.toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "");

  let idxInsc = headers.findIndex(h => h.includes("INSCRICAO"));
  let idxPres = headers.findIndex(h => h.includes("PRESENCA"));
  let idxUser = headers.findIndex(h => h.includes("ATUALIZADO POR") || h.includes("LOGIN"));
  let idxData = headers.findIndex(h => h.includes("DATA/HORA ATUALIZACAO"));

  if (idxInsc === -1) {
    // Se colunas não existirem, adiciona ao final
    const colStart = String.fromCharCode(65 + headers.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `Respostas!${colStart}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [["Inscrição Enviada", "Presença Enviada", "Atualizado Por (Login)", "Data/Hora Atualização"]]
      }
    });
    idxInsc = headers.length;
    idxPres = headers.length + 1;
    idxUser = headers.length + 2;
    idxData = headers.length + 3;
  }

  const nowStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  if (subiuInscricao === "Sim") {
    const colChar = String.fromCharCode(65 + idxInsc);
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `Respostas!${colChar}${rowNum}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["Sim"]] }
    });
  }

  if (subiuPresenca === "Sim") {
    const colChar = String.fromCharCode(65 + idxPres);
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `Respostas!${colChar}${rowNum}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["Sim"]] }
    });
  }

  if (idxUser !== -1 && idxData !== -1) {
    const colUserChar = String.fromCharCode(65 + idxUser);
    const colDataChar = String.fromCharCode(65 + idxData);
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `Respostas!${colUserChar}${rowNum}:${colDataChar}${rowNum}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[payload.userName + " (" + payload.userEmail + ")", nowStr]] }
    });
  }

  return { success: true, message: "Documentos complementares salvos no Drive e na planilha com sucesso!" };
}

async function getOrCreateSubFolder(drive, parentId, folderName) {
  const cleanSearch = folderName.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const query = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    supportsTeamDrives: true,
    includeItemsFromTeamDrives: true
  });
  const files = res.data.files || [];

  for (const f of files) {
    const cleanSub = f.name.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanSub === cleanSearch) {
      return f.id;
    }
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId]
    },
    supportsAllDrives: true,
    supportsTeamDrives: true,
    fields: "id"
  });

  return created.data.id;
}

function getMonthFolderName(mesNum) {
  const months = {
    "01": "01 - Janeiro", "02": "02 - Fevereiro", "03": "03 - Março",
    "04": "04 - Abril", "05": "05 - Maio", "06": "06 - Junho",
    "07": "07 - Julho", "08": "08 - Agosto", "09": "09 - Setembro",
    "10": "10 - Outubro", "11": "11 - Novembro", "12": "12 - Dezembro"
  };
  return months[mesNum] || mesNum;
}

async function getOrCreateFullFolderStructure(drive, data) {
  const rootFolderId = CONFIG.DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error("ID da pasta raiz do Drive (DRIVE_ROOT_FOLDER_ID) não configurado na Vercel.");
  }

  const fabricasFolderId = await getOrCreateSubFolder(drive, rootFolderId, "Fábricas de Cultura");

  let anoStr = data.anoReferencia ? String(data.anoReferencia).trim() : "";
  let mesNum = data.mesReferencia ? String(data.mesReferencia).trim() : "";
  if (!anoStr) anoStr = new Date().getFullYear().toString();
  if (!mesNum) mesNum = (new Date().getMonth() + 1).toString().padStart(2, "0");
  if (mesNum.length === 1) mesNum = "0" + mesNum;
  const mesStr = getMonthFolderName(mesNum);

  const setorStr = (data.setor || data.area || "Pedagógico").trim();
  const setorUpper = setorStr.toUpperCase();
  const atividadeName = (data.atividade || "Atividade").trim();

  const setorFolderId = await getOrCreateSubFolder(drive, fabricasFolderId, setorStr);
  const anoFolderId = await getOrCreateSubFolder(drive, setorFolderId, anoStr);

  let parentFolderId;

  if (setorUpper === "FUNDAÇÃO CASA" || setorUpper === "FUNDACAO CASA") {
    const drFolderId = await getOrCreateSubFolder(drive, anoFolderId, data.divisaoRegional ? data.divisaoRegional.trim() : "DR INDEFINIDA");
    const drUnidadeFolderId = await getOrCreateSubFolder(drive, drFolderId, data.unidade ? data.unidade.trim() : "UNIDADE");
    parentFolderId = await getOrCreateSubFolder(drive, drUnidadeFolderId, mesStr);
  } else {
    const unidadeFolderId = await getOrCreateSubFolder(drive, anoFolderId, data.unidade ? data.unidade.trim() : "UNIDADE");
    const mesFolderId = await getOrCreateSubFolder(drive, unidadeFolderId, mesStr);
    parentFolderId = mesFolderId;

    if (setorUpper === "PEDAGÓGICO" && data.tipoPedagogico) {
      parentFolderId = await getOrCreateSubFolder(drive, mesFolderId, data.tipoPedagogico.trim());
    }
  }

  const activityFolderId = await getOrCreateSubFolder(drive, parentFolderId, atividadeName);

  let relatorioFolderId = activityFolderId;
  let registroFolderId = null;
  let listaPresencaFolderId = null;
  let relacaoInscritosFolderId = null;

  if (setorUpper !== "FUNDAÇÃO CASA" && setorUpper !== "FUNDACAO CASA") {
    registroFolderId = await getOrCreateSubFolder(drive, activityFolderId, "Registro Fotográfico");
    relatorioFolderId = await getOrCreateSubFolder(drive, activityFolderId, "Relatório");
    if (setorUpper === "PEDAGÓGICO") {
      listaPresencaFolderId = await getOrCreateSubFolder(drive, activityFolderId, "Lista de Presença");
      relacaoInscritosFolderId = await getOrCreateSubFolder(drive, activityFolderId, "Relação de Inscritos");
    }
  }

  return {
    activityFolderId,
    relatorioFolderId,
    registroFolderId,
    listaPresencaFolderId,
    relacaoInscritosFolderId
  };
}

/**
 * Salva a resposta do formulário principal na aba e planilha do setor correspondente
 */
async function handleSubmitForm(payload) {
  const data = payload.formData || payload;
  const setorUpper = (data.area || data.setor || "PEDAGÓGICO").trim().toUpperCase();
  const spreadsheetId = RESPONSES_SHEETS[setorUpper] || CONFIG.SPREADSHEET_RESPONSES_ID;

  if (!spreadsheetId) {
    return { success: false, message: `ID de planilha de respostas para '${setorUpper}' não configurado nas Variáveis da Vercel.` };
  }

  const drive = getDriveService();
  const sheets = getSheetsService();
  const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  // 1. Cria estrutura de pastas no Drive
  const { relatorioFolderId, registroFolderId } = await getOrCreateFullFolderStructure(drive, data);

  // 2. Salva anexos de fotos no Drive com a nomenclatura institucional exata do Apps Script
  const targetUploadFolder = registroFolderId || relatorioFolderId;
  if (data.files && data.files.length > 0 && targetUploadFolder) {
    await uploadFilesToFolder(drive, data.files, targetUploadFolder, data);
  }

  const contratoVal = data.contrato || data.numeroContrato || "";
  const impactoVal = data.impactoCultural || data.impactoTerritorial || "";

  const formatField = val => {
    if (val === null || val === undefined) return "";
    if (Array.isArray(val)) return val.join("; ");
    return String(val);
  };

  let newRow = [];
  let sheetName = "Respostas";

  if (setorUpper === "PEDAGÓGICO") {
    sheetName = "Pedagógico";
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
  } else if (setorUpper === "ARTICULAÇÃO E DIFUSÃO") {
    sheetName = "Articulação e Difusão";
    newRow = [
      timestamp,
      formatField(data.unidade),
      formatField(contratoVal),
      formatField(data.metaReferencia),
      formatField(data.categoriaAtividade),
      formatField(data.atividade),
      formatField(data.anoReferencia),
      formatField(data.mesReferencia),
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
      formatField(data.linguagemArtistica),
      formatField(data.inclusaoDiversidade),
      formatField(data.efemeride),
      formatField(data.relato),
      formatField(data.descricaoMetodologia),
      formatField(data.pontosFortes),
      formatField(data.pontosFracos)
    ];
  } else if (setorUpper === "FUNDAÇÃO CASA") {
    sheetName = "Fundação Casa";
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
  } else if (setorUpper === "BIBLIOTECA" || setorUpper === "BIBLIOTECAS") {
    sheetName = "Bibliotecas";
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

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: `'${sheetName}'!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [newRow] }
  });

  const updatedRange = (appendRes.data.updates && appendRes.data.updates.updatedRange) || "Respostas!A2";
  const rowNumberMatch = updatedRange.match(/!A?([0-9]+)/);
  const rowNumber = rowNumberMatch ? parseInt(rowNumberMatch[1], 10) : 2;

  return {
    success: true,
    message: "Respostas registradas com sucesso na planilha!",
    sheetName: sheetName,
    rowNumber: rowNumber,
    relatorioFolderId: relatorioFolderId,
    registroFolderId: registroFolderId,
    area: setorUpper,
    data: {
      sheetName: sheetName,
      rowNumber: rowNumber,
      relatorioFolderId: relatorioFolderId,
      registroFolderId: registroFolderId,
      area: setorUpper
    }
  };
}

function getUnidadeSigla(unidadeName) {
  if (!unidadeName) return "UNIDADE";
  const norm = unidadeName.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  if (norm.includes("CAPAO REDONDO")) return "CPR";
  if (norm.includes("DIADEMA")) return "DDM";
  if (norm.includes("HELIOPOLIS")) return "HLP";
  if (norm.includes("IGUAPE")) return "IGP";
  if (norm.includes("JACANA") || norm.includes("JACANAA")) return "JCN";
  if (norm.includes("BRASILANDIA")) return "BRL";
  if (norm.includes("JARDIM SAO LUIS") || norm.includes("JARDIM SAO LUIZ")) return "JSL";
  if (norm.includes("OSASCO")) return "OSC";
  if (norm.includes("VILA NOVA CACHOEIRINHA") || norm.includes("CACHOEIRINHA")) return "VNC";
  if (norm.includes("TAIPAS")) return "TAIPAS";
  return sanitizeFileName(unidadeName).toUpperCase().replace(/\s+/g, "_");
}

function sanitizeFileName(text) {
  if (!text) return "";
  return text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s-_]/g, "").replace(/\s+/g, " ").trim();
}

function getMonthNameExtenso(mesStr) {
  if (!mesStr) return "Mes";
  const months = {
    "01": "Janeiro", "1": "Janeiro", "janeiro": "Janeiro",
    "02": "Fevereiro", "2": "Fevereiro", "fevereiro": "Fevereiro",
    "03": "Março", "3": "Março", "marco": "Março", "março": "Março",
    "04": "Abril", "4": "Abril", "abril": "Abril",
    "05": "Maio", "5": "Maio", "maio": "Maio",
    "06": "Junho", "6": "Junho", "junho": "Junho",
    "07": "Julho", "7": "Julho", "julho": "Julho",
    "08": "Agosto", "8": "Agosto", "agosto": "Agosto",
    "09": "Setembro", "9": "Setembro", "setembro": "Setembro",
    "10": "Outubro", "outubro": "Outubro",
    "11": "Novembro", "novembro": "Novembro",
    "12": "Dezembro", "dezembro": "Dezembro"
  };
  const clean = String(mesStr).trim().toLowerCase();
  return months[clean] || sanitizeFileName(mesStr);
}

function formatDateToBR(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return dateStr;
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

/**
 * Compila o relatório em PDF usando Google Docs Template e Google Drive
 */
async function handleGeneratePdfReportAsync(payload) {
  const data = payload.formData || payload;
  const setorUpper = (data.area || data.setor || "PEDAGÓGICO").trim().toUpperCase();

  let templateId = "";
  if (setorUpper === "PEDAGÓGICO") templateId = CONFIG.DOC_TEMPLATE_PEDAGOGICO_ID;
  else if (setorUpper === "ARTICULAÇÃO E DIFUSÃO") templateId = CONFIG.DOC_TEMPLATE_ARTICULACAO_ID;
  else if (setorUpper === "FUNDAÇÃO CASA" || setorUpper === "FUNDACAO CASA") templateId = CONFIG.DOC_TEMPLATE_FUNDACAO_CASA_ID;
  else if (setorUpper === "BIBLIOTECA" || setorUpper === "BIBLIOTECAS") templateId = CONFIG.DOC_TEMPLATE_BIBLIOTECA_ID;

  const drive = getDriveService();
  const relatorioFolderId = payload.relatorioFolderId || data.relatorioFolderId || CONFIG.DRIVE_ROOT_FOLDER_ID;

  if (!templateId) {
    const folderRes = await drive.files.get({
      fileId: relatorioFolderId,
      fields: "webViewLink",
      supportsAllDrives: true,
      supportsTeamDrives: true
    });
    return {
      success: true,
      message: "Relatório registrado com sucesso!",
      pdfUrl: folderRes.data.webViewLink || "https://drive.google.com",
      docUrl: folderRes.data.webViewLink || "https://drive.google.com"
    };
  }

  const unidadeSigla = getUnidadeSigla(data.unidade);
  const cleanCentro = sanitizeFileName(data.unidade || "").toUpperCase().replace(/\s+/g, "_");
  const cleanResponsavel = sanitizeFileName(data.responsavel || "").toUpperCase().replace(/\s+/g, "_");
  const cleanAtividade = sanitizeFileName(data.atividade || "").toUpperCase().replace(/\s+/g, "_");

  let documentName = "";
  if (setorUpper === "PEDAGÓGICO") {
    documentName = `${unidadeSigla}_${cleanResponsavel}_${cleanAtividade}`;
  } else if (setorUpper === "ARTICULAÇÃO E DIFUSÃO") {
    let diaStr = data.diasAtividade ? String(data.diasAtividade).split(",")[0].trim() : "01";
    if (diaStr.length === 1) diaStr = "0" + diaStr;
    const mesStr = data.mesReferencia || "01";
    const anoStr = data.anoReferencia || new Date().getFullYear().toString();
    documentName = `${diaStr}-${mesStr}-${anoStr}_${unidadeSigla}_${cleanAtividade}`;
  } else if (setorUpper === "BIBLIOTECA" || setorUpper === "BIBLIOTECAS") {
    let dataAtiv = data.dataRelatorio ? formatDateToBR(data.dataRelatorio).replace(/\//g, "-") : "DATA";
    documentName = `${dataAtiv}_${unidadeSigla}_${cleanAtividade}_${cleanResponsavel}`;
  } else if (setorUpper === "FUNDAÇÃO CASA" || setorUpper === "FUNDACAO CASA") {
    const mesExt = getMonthNameExtenso(data.mesReferencia);
    documentName = `${mesExt}_${cleanCentro}_${cleanAtividade}_${cleanResponsavel}`;
  } else {
    documentName = `${unidadeSigla}_${cleanResponsavel}_${cleanAtividade}`;
  }

  // Clona o template do Google Docs diretamente na pasta Relatório
  const copyRes = await drive.files.copy({
    fileId: templateId,
    requestBody: {
      name: documentName,
      parents: [relatorioFolderId]
    },
    supportsAllDrives: true,
    supportsTeamDrives: true
  });

  const copiedDocId = copyRes.data.id;
  const docs = getDocsService();

  const contratoVal = String(data.contrato || data.numeroContrato || "");
  const impactoVal = String(data.impactoCultural || data.impactoTerritorial || "");
  const formatField = val => (val === null || val === undefined) ? "" : (Array.isArray(val) ? val.join("; ") : String(val));

  const nowBR = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const responsavelNome = formatField(data.responsavel).toUpperCase();
  let declaracaoTexto = "";
  if (setorUpper === "FUNDAÇÃO CASA" || setorUpper === "FUNDACAO CASA") {
    declaracaoTexto = "DECLARAÇÃO DE RESPONSABILIDADE E CONFORMIDADE INSTITUCIONAL\n\n" +
      "1. Declaração de Conformidade com o ECA, Proteção de Imagem e Normas Internas:\n\n" +
      "Declaro que executei as atividades em conformidade com o Estatuto da Criança e do Adolescente (Lei nº 8.069/1990), observando integralmente as normas de segurança, disciplina, acesso e funcionamento da unidade da Fundação CASA, bem como as orientações da CONTRATANTE, não tendo praticado qualquer conduta incompatível com as regras institucionais.\n\n" +
      "Declaro que não captei, registrei, reproduzi, divulguei, compartilhei ou utilizei imagens, vídeos, áudios, dados pessoais ou quaisquer informações que permitam identificar adolescentes atendidos durante a execução das atividades, salvo quando previamente autorizado, por escrito, pela CONTRATANTE e/ou pela Fundação CASA, quando aplicável.\n\n" +
      "Declaro que todos os produtos, obras, materiais, registros ou demais itens produzidos durante a execução das atividades permaneceram integralmente na unidade da Fundação CASA onde foram desenvolvidos, não tendo sido retirados, cedidos, comercializados ou destinados a finalidade diversa daquela prevista contratualmente.\n\n" +
      "Declaro que tenho ciência das obrigações previstas nas cláusulas contratuais relativas à proteção de crianças e adolescentes, ao sigilo das informações, ao uso de imagem, à preservação dos materiais produzidos e às normas internas da Fundação CASA, afirmando que atuei em conformidade com tais disposições durante todo o período de execução dos serviços.\n\n" +
      "2. Declaração de Veracidade e Prestação de Contas:\n\n" +
      "Declaro que as informações e evidências apresentadas neste relatório correspondem às atividades efetivamente realizadas no período indicado e estão aptas a subsidiar o acompanhamento institucional e a prestação de contas.\n\n" +
      "[☑] TERMOS LIDOS E ACEITOS ELETRONICAMENTE NO ATO DO ENVIO\n" +
      "Declarante / Responsável: " + responsavelNome + "\n" +
      "Data/Hora do Registro: " + nowBR + " (Horário Oficial de Brasília)";
  } else {
    declaracaoTexto = "DECLARAÇÃO DE RESPONSABILIDADE E CONFORMIDADE INSTITUCIONAL\n\n" +
      "Declaro que as informações e evidências apresentadas neste relatório correspondem às atividades efetivamente realizadas no período indicado e estão aptas a subsidiar o acompanhamento institucional e a prestação de contas.\n\n" +
      "[☑] TERMO LIDO E ACEITO ELETRONICAMENTE NO ATO DO ENVIO\n" +
      "Declarante / Responsável: " + responsavelNome + "\n" +
      "Data/Hora do Registro: " + nowBR + " (Horário Oficial de Brasília)";
  }

  // Preenche TODOS os placeholders no Docs garantindo que string vazia vire espaço " " para evitar erro 400 na API v1
  const createReplaceReq = (tag, val) => {
    let strVal = (val === null || val === undefined) ? " " : String(val);
    if (strVal.trim() === "") strVal = " ";
    return {
      replaceAllText: {
        containsText: { text: tag, matchCase: true },
        replaceText: strVal
      }
    };
  };

async function uploadFilesToFolder(drive, files, targetFolderId, data = {}) {
  try {
    if (!files || !Array.isArray(files) || files.length === 0 || !targetFolderId) {
      return [];
    }

    const setorUpper = (data.setor || data.area || "").toString().trim().toUpperCase();
    const uploadedFiles = [];

    for (let i = 0; i < files.length; i++) {
      const fileData = files[i];
      let base64 = fileData.base64Data || "";
      if (base64.includes(",")) {
        base64 = base64.split(",")[1];
      }
      if (!base64) continue;

      const buffer = Buffer.from(base64, "base64");
      const mime = fileData.mimeType || fileData.type || (setorUpper === "FUNDAÇÃO CASA" || setorUpper === "FUNDACAO CASA" ? "application/pdf" : "image/jpeg");

      const parts = (fileData.name || "arquivo.jpg").split(".");
      const ext = parts.length > 1 ? parts.pop().toLowerCase() : (mime === "application/pdf" ? "pdf" : "jpg");

      let cleanFileName = "";
      if (setorUpper === "FUNDAÇÃO CASA" || setorUpper === "FUNDACAO CASA") {
        const mesExt = getMonthNameExtenso(data.mesReferencia);
        const cleanCentro = sanitizeFileName(data.unidade || "").toUpperCase().replace(/\s+/g, "_");
        const cleanAtividade = sanitizeFileName(data.atividade || "").toUpperCase().replace(/\s+/g, "_");
        cleanFileName = `${mesExt}_${cleanCentro}_${cleanAtividade}_PlanoDeAtividade.${ext}`;
      } else {
        const unidadeSigla = getUnidadeSigla(data.unidade);
        const cleanResponsavel = sanitizeFileName(data.responsavel || "").toUpperCase().replace(/\s+/g, "_");
        const cleanAtividade = sanitizeFileName(data.atividade || "").toUpperCase().replace(/\s+/g, "_");
        const indexStr = (i + 1).toString().padStart(2, "0");
        cleanFileName = `${unidadeSigla}_${cleanResponsavel}_${cleanAtividade}_${indexStr}.${ext}`;
      }

      const createdFile = await drive.files.create({
        requestBody: {
          name: cleanFileName,
          parents: [targetFolderId],
          mimeType: mime
        },
        media: {
          mimeType: mime,
          body: require("stream").Readable.from(buffer)
        },
        supportsAllDrives: true,
        supportsTeamDrives: true,
        fields: "id, name, webViewLink"
      });

      await drive.permissions.create({
        fileId: createdFile.data.id,
        requestBody: { role: "reader", type: "anyone" },
        supportsAllDrives: true,
        supportsTeamDrives: true
      }).catch(() => {});

      uploadedFiles.push({
        id: createdFile.data.id,
        name: cleanFileName,
        mimeType: mime,
        uri: `https://lh3.googleusercontent.com/d/${createdFile.data.id}`
      });
    }

    return uploadedFiles;
  } catch (error) {
    console.error("Erro no uploadFilesToFolder:", error.message);
    return [];
  }
}

async function insertImageGridIntoDocs(drive, docs, documentId, registroFolderId) {
  try {
    let docRes = await docs.documents.get({ documentId });
    let content = docRes.data.body.content || [];

    let targetIndex = -1;
    for (const element of content) {
      if (element.paragraph) {
        for (const run of element.paragraph.elements || []) {
          if (run.textRun && run.textRun.content && run.textRun.content.includes("{{ANEXOS}}")) {
            targetIndex = run.startIndex + run.textRun.content.indexOf("{{ANEXOS}}");
            break;
          }
        }
      }
      if (targetIndex !== -1) break;
    }

    if (targetIndex === -1) {
      return;
    }

    const imageUris = [];
    let hasVideo = false;

    if (registroFolderId) {
      try {
        const driveList = await drive.files.list({
          q: `'${registroFolderId}' in parents and trashed = false`,
          fields: "files(id, name, mimeType)",
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          supportsTeamDrives: true,
          includeItemsFromTeamDrives: true
        });

        for (const file of driveList.data.files || []) {
          if (file.mimeType && file.mimeType.startsWith("video/")) {
            hasVideo = true;
          } else if (file.mimeType && file.mimeType.startsWith("image/")) {
            await drive.permissions.create({
              fileId: file.id,
              requestBody: { role: "reader", type: "anyone" },
              supportsAllDrives: true,
              supportsTeamDrives: true
            }).catch(() => {});
            imageUris.push(`https://lh3.googleusercontent.com/d/${file.id}`);
          }
        }
      } catch (e) {
        console.warn("Erro ao buscar fotos na pasta do Drive:", e.message);
      }
    }

    if (imageUris.length === 0) {
      let noPicText = "Nenhuma imagem/evidência fotográfica enviada.";
      if (hasVideo) {
        noPicText += "\n\n🎬 NOTA DE EVIDÊNCIA EM VÍDEO: Esta atividade possui registro(s) audiovisual(is) em vídeo salvo(s) diretamente na pasta de evidências da atividade no Google Drive.";
      }
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              replaceAllText: {
                containsText: { text: "{{ANEXOS}}", matchCase: true },
                replaceText: noPicText
              }
            }
          ]
        }
      });
      return;
    }

    const numRows = Math.ceil(imageUris.length / 2);

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            replaceAllText: {
              containsText: { text: "{{ANEXOS}}", matchCase: true },
              replaceText: " "
            }
          },
          {
            insertTable: {
              rows: numRows,
              columns: 2,
              location: { index: targetIndex }
            }
          }
        ]
      }
    });

    docRes = await docs.documents.get({ documentId });
    content = docRes.data.body.content || [];

    let createdTable = null;
    for (const element of content) {
      if (element.table && element.startIndex >= targetIndex) {
        createdTable = element.table;
        break;
      }
    }

    if (!createdTable) return;

    const imageRequests = [];
    let imgIdx = 0;

    for (let r = 0; r < createdTable.tableRows.length; r++) {
      const row = createdTable.tableRows[r];
      for (let c = 0; c < row.tableCells.length; c++) {
        if (imgIdx < imageUris.length) {
          const cell = row.tableCells[c];
          const cellStartIndex = cell.content[0].startIndex;

          imageRequests.push({
            insertInlineImage: {
              uri: imageUris[imgIdx],
              location: { index: cellStartIndex },
              objectSize: {
                width: { magnitude: 220, unit: "PT" }
              }
            }
          });
          imgIdx++;
        }
      }
    }

    if (imageRequests.length > 0) {
      imageRequests.sort((a, b) => b.insertInlineImage.location.index - a.insertInlineImage.location.index);
      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests: imageRequests }
      });
    }

    if (hasVideo) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: targetIndex + 1 },
                text: "\n\n🎬 NOTA DE EVIDÊNCIA EM VÍDEO: Esta atividade possui registro(s) audiovisual(is) em vídeo salvo(s) diretamente na pasta de evidências da atividade no Google Drive."
              }
            }
          ]
        }
      });
    }
  } catch (err) {
    console.warn("Erro ao inserir grade de fotos no Docs:", err.message);
  }
}

  let planoTexto = "Plano de Atividades do Período:";
  if (data.planoTabela && Array.isArray(data.planoTabela) && data.planoTabela.length > 0) {
    planoTexto += "\n" + data.planoTabela.map(item => `${item.data || "---"} | ${item.unidade || "UNIDADE"} | ${item.horario || "---"} | ${item.descricao || "---"}`).join("\n");
  }

  const replaceRequests = [
    createReplaceReq("{{AREA}}", formatField(data.area)),
    createReplaceReq("{{DIVISAO_REGIONAL}}", formatField(data.divisaoRegional).toUpperCase()),
    createReplaceReq("{{CENTRO_ATENDIMENTO}}", formatField(data.unidade).toUpperCase()),
    createReplaceReq("{{UNIDADE}}", formatField(data.unidade).toUpperCase()),
    createReplaceReq("{{CONTRATO}}", contratoVal),
    createReplaceReq("{{NUMERO_CONTRATO}}", contratoVal),
    createReplaceReq("{{META_REFERENCIA}}", formatField(data.metaReferencia)),
    createReplaceReq("{{TIPO_PEDAGOGICO}}", formatField(data.tipoPedagogico)),
    createReplaceReq("{{ATIVIDADE}}", formatField(data.atividade).toUpperCase()),
    createReplaceReq("{{ANO_REFERENCIA}}", formatField(data.anoReferencia)),
    createReplaceReq("{{MES_REFERENCIA}}", formatField(data.mesReferencia)),
    createReplaceReq("{{DIAS_ATIVIDADE}}", formatField(data.diasAtividade)),
    createReplaceReq("{{RESPONSAVEL}}", formatField(data.responsavel).toUpperCase()),
    createReplaceReq("{{RAZAO_SOCIAL}}", formatField(data.responsavel).toUpperCase()),
    createReplaceReq("{{HORARIO_INICIO}}", formatField(data.horarioInicio)),
    createReplaceReq("{{HORARIO_TERMINO}}", formatField(data.horarioTermino)),
    createReplaceReq("{{ENCONTROS_PREVISTOS}}", formatField(data.encontrosPrevistos)),
    createReplaceReq("{{ENCONTROS_REALIZADOS}}", formatField(data.encontrosRealizados)),
    createReplaceReq("{{CARGA_HORARIA_PREVISTA}}", formatField(data.cargaHorariaPrevista)),
    createReplaceReq("{{CARGA_HORARIA_REALIZADA}}", formatField(data.cargaHorariaRealizada)),
    createReplaceReq("{{CARGA_HORARIA_TOTAL}}", formatField(data.cargaHorariaTotal)),
    createReplaceReq("{{NUMERO_SESSOES}}", formatField(data.numSessoes)),
    createReplaceReq("{{NUM_SESSOES}}", formatField(data.numSessoes)),
    createReplaceReq("{{DATA_RELATORIO}}", formatField(data.dataRelatorio)),
    createReplaceReq("{{DATA_REPOSICAO}}", formatField(data.dataReposicao)),
    createReplaceReq("{{PUBLICO_TOTAL}}", formatField(data.publicoTotal)),
    createReplaceReq("{{PUBLICO_SESSAO}}", formatField(data.publicoSessao)),
    createReplaceReq("{{PERFIL_PUBLICO}}", formatField(data.perfilPublico)),
    createReplaceReq("{{FAIXA_ETARIA}}", formatField(data.faixaEtaria)),
    createReplaceReq("{{DESTAQUE_ACAO}}", formatField(data.destaqueAcao)),
    createReplaceReq("{{OBJETIVOS}}", formatField(data.objetivos)),
    createReplaceReq("{{IMPACTO_CULTURAL}}", impactoVal),
    createReplaceReq("{{IMPACTO_TERRITORIAL}}", impactoVal),
    createReplaceReq("{{LINGUAGEM_ARTISTICA}}", formatField(data.linguagemArtistica)),
    createReplaceReq("{{INCLUSAO_DIVERSIDADE}}", formatField(data.inclusaoDiversidade)),
    createReplaceReq("{{EFEMERIDE}}", formatField(data.efemeride)),
    createReplaceReq("{{RELATO}}", formatField(data.relato)),
    createReplaceReq("{{DESCRICAO_METODOLOGIA}}", formatField(data.descricaoMetodologia)),
    createReplaceReq("{{ENGAJAMENTO_PARTICIPACAO}}", formatField(data.engajamentoParticipacao)),
    createReplaceReq("{{PONTOS_FORTES}}", formatField(data.pontosFortes)),
    createReplaceReq("{{PONTOS_FRACOS}}", formatField(data.pontosFracos)),
    createReplaceReq("{{PLANO_DE_ATIVIDADES}}", planoTexto),
    createReplaceReq("{{PLANO}}", planoTexto),
    createReplaceReq("{{TABELA}}", planoTexto),
    createReplaceReq("{{ENCONTROS}}", planoTexto),
    createReplaceReq("{{DECLARACAO_RESPONSABILIDADE}}", declaracaoTexto),
    createReplaceReq("{{DECLARACAO}}", declaracaoTexto),
    createReplaceReq("{{TERMOS}}", declaracaoTexto)
  ];

  try {
    await docs.documents.batchUpdate({
      documentId: copiedDocId,
      requestBody: { requests: replaceRequests }
    });
  } catch (e) {
    console.warn("Erro ao preencher texto no Docs:", e.message);
  }

  // Insere a grade de fotos de 2 colunas na tag {{ANEXOS}}
  const registroFolderId = payload.registroFolderId || data.registroFolderId;
  await insertImageGridIntoDocs(drive, docs, copiedDocId, registroFolderId);

  // Exporta o Google Doc preenchido em formato PDF e salva na pasta Relatório
  let pdfUrl = "";
  try {
    const pdfRes = await drive.files.export({
      fileId: copiedDocId,
      mimeType: "application/pdf"
    }, { responseType: "arraybuffer" });

    const pdfBuffer = Buffer.from(pdfRes.data);

    const pdfFileCreated = await drive.files.create({
      requestBody: {
        name: documentName + ".pdf",
        parents: [relatorioFolderId],
        mimeType: "application/pdf"
      },
      media: {
        mimeType: "application/pdf",
        body: require("stream").Readable.from(pdfBuffer)
      },
      supportsAllDrives: true,
      supportsTeamDrives: true,
      fields: "id, webViewLink"
    });

    pdfUrl = pdfFileCreated.data.webViewLink;
  } catch (pdfErr) {
    console.warn("Aviso ao exportar PDF:", pdfErr.message);
  }

  const docFile = await drive.files.get({
    fileId: copiedDocId,
    fields: "id, webViewLink",
    supportsAllDrives: true,
    supportsTeamDrives: true
  });

  return {
    success: true,
    message: "Relatório gerado com sucesso no Google Drive!",
    pdfUrl: pdfUrl || docFile.data.webViewLink,
    docUrl: docFile.data.webViewLink
  };
}
