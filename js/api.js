/**
 * CAMADA DE COMUNICAÇÃO DE DADOS (FRONTEND VERCEL -> APPS SCRIPT API)
 * Envia requisições via POST para a URL do Web App do Google Apps Script.
 */

// Insira aqui a URL oficial da sua Implantação Web App do Apps Script (terminando em /exec)
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbx_qOzuXxxDGCEwEveSk6zxmzDk87_aJcZdkX1j94xLwLrHfJhM7FxUkl9cboENayxpsA/exec";

/**
 * Envia requisições assíncronas para o Apps Script
 * @param {string} action Nome da ação ('getDropdownData', 'submitForm', 'generatePdfReportAsync')
 * @param {Object} payload Dados adicionais
 * @param {Function} onSuccess Callback de sucesso
 * @param {Function} onError Callback de erro
 */
function callBackendAPI(action, payload, onSuccess, onError) {
  if (!GAS_API_URL || GAS_API_URL.includes("INSIRA_AQUI")) {
    if (onError) onError("URL da API do Google Apps Script ainda não configurada em js/api.js.");
    return;
  }

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: action, ...payload })
  })
    .then(response => response.text())
    .then(text => {
      try {
        const data = JSON.parse(text);
        if (onSuccess) onSuccess(data);
      } catch (e) {
        Logger.log("Erro ao interpretar JSON:", text);
        if (onError) onError("Resposta inválida do servidor. Verifique a implantação do Apps Script.");
      }
    })
    .catch(err => {
      Logger.log("Erro de rede:", err);
      if (onError) onError("Erro de conexão ao comunicar com o servidor. Verifique sua conexão à internet.");
    });
}
