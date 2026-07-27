/**
 * FUNÇÕES UTILITÁRIAS DO SISTEMA
 * Métodos compartilhados para tratamento de formatos, sanitização e retornos.
 */

var Utils = {
  formatDateToBR: function(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  },
  
  sanitizeFileName: function(text) {
    if (!text) return "";
    return text
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-_]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  createResponse: function(success, message, data = {}) {
    return {
      success: success,
      message: message,
      ...data
    };
  },

  logError: function(context, error) {
    try {
      let spreadsheetId = CONFIG.SPREADSHEET_RESPONSES_ID;
      if (!spreadsheetId || spreadsheetId.startsWith("INSIRA_O_ID")) {
        spreadsheetId = CONFIG.SPREADSHEET_RESPONSES_PEDAGOGICO_ID;
      }
      if (spreadsheetId && !spreadsheetId.startsWith("INSIRA_O_ID")) {
        const ss = SpreadsheetApp.openById(spreadsheetId);
        let sheet = ss.getSheetByName("_LOGS");
        if (!sheet) {
          sheet = ss.insertSheet("_LOGS");
          sheet.appendRow(["Data/Hora", "Contexto", "Erro"]);
          sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f8d7da");
        }
        sheet.appendRow([new Date(), context, error.toString()]);
      }
    } catch (e) {
      Logger.log("Falha ao gravar erro: " + e.toString());
    }
  }
};
