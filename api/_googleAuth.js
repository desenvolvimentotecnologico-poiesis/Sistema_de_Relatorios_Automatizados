const { google } = require("googleapis");

/**
 * Autentica com o Google Cloud usando a Conta de Serviço (Service Account)
 * @returns {google.auth.JWT} Cliente de Autenticação JWT do Google
 */
function getGoogleAuthClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("Variáveis de ambiente GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY não configuradas na Vercel.");
  }

  // Corrige formatação de quebras de linha na chave privada
  privateKey = privateKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT(
    clientEmail,
    null,
    privateKey,
    [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents"
    ]
  );

  return auth;
}

function getSheetsService() {
  const auth = getGoogleAuthClient();
  return google.sheets({ version: "v4", auth });
}

function getDriveService() {
  const auth = getGoogleAuthClient();
  return google.drive({ version: "v3", auth });
}

function getDocsService() {
  const auth = getGoogleAuthClient();
  return google.docs({ version: "v1", auth });
}

module.exports = {
  getGoogleAuthClient,
  getSheetsService,
  getDriveService,
  getDocsService
};
