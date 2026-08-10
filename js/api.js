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

  // Em localhost, IP local ou qualquer subdomínio contendo "homolog", usa o backend de HOMOLOGAÇÃO
  const isHomologation = host.includes("localhost") || 
                         host.includes("127.0.0.1") || 
                         host.includes("homolog");

  // No domínio principal da Vercel (sistema-de-relatorios-automatizados.vercel.app) ou domínio oficial, usa PRODUÇÃO
  return isHomologation ? GAS_API_URL_HOMOLOG : GAS_API_URL_PROD;
}

const GAS_API_URL = getActiveBackendUrl();

/**
 * Utilitário global para sanitizar strings e prevenir injeções de HTML/XSS no DOM
 * @param {string} str String a ser sanitizada
 * @returns {string} String com entidades HTML codificadas com segurança
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Envia requisições assíncronas para o Apps Script com re-tentativa automática
 * @param {string} action Nome da ação ('getDropdownData', 'verifyUserAccess', 'checkActivityStatus', 'uploadComplementaryDocs')
 * @param {Object} payload Dados adicionais
 * @param {Function} onSuccess Callback de sucesso
 * @param {Function} onError Callback de erro
 * @param {number} [retryCount=0] Contador interno de tentativas
 */
function callBackendAPI(action, payload, onSuccess, onError, retryCount = 0) {
  if (!GAS_API_URL || GAS_API_URL.includes("INSIRA_AQUI")) {
    if (onError) onError("URL da API do Google Apps Script ainda não configurada em js/api.js.");
    return;
  }

  // Ações de gravação/compilação não devem re-tentar automaticamente para impedir duplicação de dados no servidor
  const isWriteAction = action === "submitForm" || action === "uploadComplementaryDocs" || action === "generatePdfReportAsync";
  const maxRetries = isWriteAction ? 0 : 2; 
  const timeoutMs = isWriteAction ? 90000 : 35000; // 90s para gravação/PDF, 35s para consultas leves

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: action, ...payload }),
    signal: controller.signal
  })
    .then(response => {
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
      }
      return response.text();
    })
    .then(text => {
      try {
        const data = JSON.parse(text);
        if (onSuccess) onSuccess(data);
      } catch (e) {
        console.error("Erro ao interpretar JSON (Tentativa " + (retryCount + 1) + "):", text);
        if (retryCount < maxRetries) {
          console.warn("Re-tentando conexão com o servidor em 1.5s...");
          setTimeout(() => {
            callBackendAPI(action, payload, onSuccess, onError, retryCount + 1);
          }, 1500);
        } else {
          if (onError) onError("Resposta inválida do servidor. Verifique a implantação do Apps Script.");
        }
      }
    })
    .catch(err => {
      clearTimeout(timeoutId);
      console.warn("Oscilação de rede ou inicialização a frio (Tentativa " + (retryCount + 1) + "):", err);
      if (retryCount < maxRetries) {
        console.warn("Re-tentando conexão em 1.5s...");
        setTimeout(() => {
          callBackendAPI(action, payload, onSuccess, onError, retryCount + 1);
        }, 1500);
      } else {
        if (err.name === "AbortError") {
          if (onError) onError("O servidor demorou para responder. Por favor, verifique se a operação foi concluída.");
        } else {
          if (onError) onError("Falha de conexão ao comunicar com o servidor: " + (err.message || "Verifique sua conexão com a internet."));
        }
      }
    });
}
