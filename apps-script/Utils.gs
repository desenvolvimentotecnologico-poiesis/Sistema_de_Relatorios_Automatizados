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

  getUnidadeSigla: function(unidadeName) {
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
    
    // Caso seja um nome não listado, sanitiza em maiúsculas
    return this.sanitizeFileName(unidadeName).toUpperCase().replace(/\s+/g, "_");
  },

  getMonthNameExtenso: function(mesStr) {
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
    return months[clean] || this.sanitizeFileName(mesStr);
  },

  getFormattedTimestampBR: function(dateObj) {
    const d = dateObj || new Date();
    try {
      return Utilities.formatDate(d, "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
    } catch (e) {
      return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    }
  },

  getFormattedTimestampExtensoBR: function(dateObj) {
    const d = dateObj || new Date();
    try {
      return Utilities.formatDate(d, "America/Sao_Paulo", "dd/MM/yyyy 'às' HH:mm:ss");
    } catch (e) {
      return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    }
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
