const { google } = require("googleapis");

/**
 * Autentica com o Google Cloud usando a Conta de Serviço (Service Account)
 * @returns {google.auth.JWT} Cliente de Autenticação JWT do Google
 */
function getGoogleAuthClient() {
  const oauthClientId = process.env.OAUTH_CLIENT_ID;
  const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET;
  const oauthRefreshToken = process.env.OAUTH_REFRESH_TOKEN;

  // Prioridade 1: OAuth 2.0 com Refresh Token (Conta oficial humana da Poiesis)
  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    const oauth2Client = new google.auth.OAuth2(
      oauthClientId.trim(),
      oauthClientSecret.trim(),
      "https://developers.google.com/oauthplayground"
    );
    oauth2Client.setCredentials({
      refresh_token: oauthRefreshToken.trim()
    });
    return oauth2Client;
  }

  // Prioridade 2: Service Account JWT Bot
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("Credenciais do Google não configuradas na Vercel (cadastre OAUTH_REFRESH_TOKEN, OAUTH_CLIENT_ID e OAUTH_CLIENT_SECRET).");
  }

  privateKey = privateKey.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");

  return new google.auth.JWT(
    clientEmail,
    null,
    privateKey,
    [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents"
    ]
  );
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
