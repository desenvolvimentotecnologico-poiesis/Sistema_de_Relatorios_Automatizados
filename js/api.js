/**
 * CAMADA DE COMUNICAÇÃO DE DADOS (FRONTEND VERCEL -> APPS SCRIPT API)
 * Gerencia a detecção automática de ambiente (Homologação vs. Produção)
 * e envia requisições HTTP POST para o Google Apps Script.
 */

// URLs públicas dos dois ambientes do Google Apps Script
const GAS_API_URL_HOMOLOG = "https://script.google.com/macros/s/AKfycby2BFuc7DSyLLz_VIK1OVstF1qknXLbd4Plc4e1CKF9mNR5uEzdCyxccQ9sMcqI04PF/exec";
const GAS_API_URL_PROD    = "https://script.google.com/macros/s/AKfycbxm5BpWN_4qsrBVuCfx020zW8s1SZHfdoRYVRN9EMnuY9VJ6afl4lYz39fk2_s7q16p4g/exec";

/**
 * Retorna dinamicamente a URL do Backend com base no Hostname do navegador
 * @returns {string} URL ativa do Apps Script
 */
function getActiveBackendUrl() {
  const host = (window.location.hostname || "").toLowerCase();

  // Ativa o backend de PRODUÇÃO se estiver no domínio de produção
  const isProduction = host.includes("sra-producao") || 
                       host === "sra.fabricasdecultura.org.br";

  // Em localhost, dev ou vercel de homologação, redireciona para HOMOLOGAÇÃO
  return isProduction ? GAS_API_URL_PROD : GAS_API_URL_HOMOLOG;
}

const GAS_API_URL = getActiveBackendUrl();

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
        console.error("Erro ao interpretar JSON:", text);
        if (onError) onError("Resposta inválida do servidor. Verifique a implantação do Apps Script.");
      }
    })
    .catch(err => {
      console.error("Erro de rede:", err);
      if (onError) onError("Erro de conexão ao comunicar com o servidor. Verifique sua conexão à internet.");
    });
}
