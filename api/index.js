const { getSheetsService, getDriveService } = require("./_googleAuth");
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
        }
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
  const res = await drive.files.list({ q: query, fields: "files(id, name)" });
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
