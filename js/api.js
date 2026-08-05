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
/**
 * Retorna a URL do endpoint backend.
 * Na Vercel Serverless, utiliza a rota nativa '/api' no mesmo domínio (0ms latência de CORS).
 */
function getActiveBackendUrl() {
  // Rota interna Vercel Serverless em Node.js
  return "/api";
}

const GAS_API_URL = getActiveBackendUrl();

/**
 * Envia requisições assíncronas para a Vercel Serverless API
 * @param {string} action Nome da ação ('getDropdownData', 'verifyUserAccess', 'checkActivityStatus', 'uploadComplementaryDocs')
 * @param {Object} payload Dados adicionais
 * @param {Function} onSuccess Callback de sucesso
 * @param {Function} onError Callback de erro
 * @param {number} [retryCount=0] Contador interno de tentativas
 */
function callBackendAPI(action, payload, onSuccess, onError, retryCount = 0) {
  const maxRetries = 2;
  const controller = new AbortController();
  const timeoutMs = 25000;
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: action, ...payload }),
    signal: controller.signal
  })
    .then(response => {
      clearTimeout(timeoutId);
      return response.text();
    })
    .then(text => {
      try {
        const data = JSON.parse(text);
        if (onSuccess) onSuccess(data);
      } catch (e) {
        console.error("Erro ao interpretar JSON (Tentativa " + (retryCount + 1) + "):", text);
        if (retryCount < maxRetries) {
          setTimeout(() => {
            callBackendAPI(action, payload, onSuccess, onError, retryCount + 1);
          }, 1000);
        } else {
          if (onError) onError("Resposta inválida do servidor Vercel.");
        }
      }
    })
    .catch(err => {
      clearTimeout(timeoutId);
      console.warn("Falha na chamada da Vercel API (Tentativa " + (retryCount + 1) + "):", err);
      if (retryCount < maxRetries) {
        setTimeout(() => {
          callBackendAPI(action, payload, onSuccess, onError, retryCount + 1);
        }, 1000);
      } else {
        if (err.name === "AbortError") {
          if (onError) onError("Tempo limite excedido na Vercel API. Tente novamente.");
        } else {
          if (onError) onError("Falha de conexão com o servidor Vercel.");
        }
      }
    });
}
