/**
 * FUNÇÕES UTILITÁRIAS DO SISTEMA
 * Métodos compartilhados para tratamento de formatos, sanitização e retornos.
 */

var Utils = {
  /**
   * Formata datas no padrão brasileiro DD/MM/YYYY
   */
  formatDateToBR: function(dateStr) {
    if (!dateStr) return "";
    var str = String(dateStr).trim();
    if (str.includes("T")) {
      str = str.split("T")[0];
    }
    var parts = str.split(/[-/]/);
    if (parts.length !== 3) return dateStr;
    if (parts[0].length === 4) {
      return parts[2] + "/" + parts[1] + "/" + parts[0];
    }
    return str;
  },

  /**
   * Sanitiza nomes de arquivos removendo acentos e caracteres especiais
   */
  sanitizeFileName: function(text) {
    if (!text) return "";
    return String(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-_]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  /**
   * Retorna a sigla padronizada de 3 letras da unidade das Fábricas de Cultura
   */
  getUnidadeSigla: function(unidadeName) {
    if (!unidadeName) return "UNIDADE";
    var norm = String(unidadeName).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    
    if (norm.includes("CAPAO REDONDO")) return "CPR";
    if (norm.includes("DIADEMA")) return "DDM";
    if (norm.includes("HELIOPOLIS")) return "HLP";
    if (norm.includes("CORREIOS") || norm.includes("IGUAPE CORREIOS")) return "IGC";
    if (norm.includes("IGUAPE")) return "IGP";
    if (norm.includes("JACANA")) return "JCN";
    if (norm.includes("BRASILANDIA")) return "BRL";
    if (norm.includes("SAO LUIS") || norm.includes("SAO LUIZ")) return "JSL";
    if (norm.includes("OSASCO")) return "OSC";
    if (norm.includes("CACHOEIRINHA")) return "VNC";
    if (norm.includes("TAIPAS")) return "TAIPAS";
    
    return this.sanitizeFileName(unidadeName).toUpperCase().replace(/\s+/g, "_");
  },

  /**
   * Converte número do mês para o nome por extenso em Português
   */
  getMonthNameExtenso: function(mesStr) {
    if (!mesStr) return "Mes";
    var months = {
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
    var clean = String(mesStr).trim().toLowerCase();
    return months[clean] || this.sanitizeFileName(mesStr);
  },

  /**
   * Retorna timestamp formatado no fuso oficial America/Sao_Paulo (DD/MM/YYYY HH:mm:ss)
   */
  getFormattedTimestampBR: function(dateObj) {
    var d = dateObj || new Date();
    try {
      return Utilities.formatDate(d, "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
    } catch (e) {
      return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    }
  },

  /**
   * Retorna timestamp por extenso no fuso oficial America/Sao_Paulo
   */
  getFormattedTimestampExtensoBR: function(dateObj) {
    var d = dateObj || new Date();
    try {
      return Utilities.formatDate(d, "America/Sao_Paulo", "dd/MM/yyyy 'às' HH:mm:ss");
    } catch (e) {
      return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    }
  },

  /**
   * Converte valores nulos/indefinidos ou arrays em strings prontas para inserção
   */
  formatField: function(val) {
    if (val === null || val === undefined) return "";
    if (Array.isArray(val)) return val.join("; ");
    return String(val);
  },

  /**
   * Normaliza nomes de áreas institucionais ignorando maiúsculas/minúsculas e acentuação
   */
  normalizeAreaName: function(areaStr) {
    if (!areaStr) return "PEDAGÓGICO";
    var norm = String(areaStr).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (norm.includes("PEDAGOGICO")) return "PEDAGÓGICO";
    if (norm.includes("ARTICULACAO") || norm.includes("DIFUSAO")) return "ARTICULAÇÃO E DIFUSÃO";
    if (norm.includes("CASA")) return "FUNDAÇÃO CASA";
    if (norm.includes("BIBLIOTECA")) return "BIBLIOTECA";
    return String(areaStr).trim();
  },

  /**
   * Retorna o nome de pasta padronizado para o Google Drive para cada área:
   * Pedagógico; Bibliotecas; Articulação e Difusão; Fundação Casa
   */
  getAreaFolderName: function(areaStr) {
    if (!areaStr) return "Pedagógico";
    var norm = String(areaStr).trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (norm.includes("PEDAGOGICO")) return "Pedagógico";
    if (norm.includes("ARTICULACAO") || norm.includes("DIFUSAO")) return "Articulação e Difusão";
    if (norm.includes("CASA")) return "Fundação Casa";
    if (norm.includes("BIBLIOTECA")) return "Bibliotecas";
    return String(areaStr).trim();
  },

  /**
   * Normaliza os nomes de pastas para o tipo pedagógico no Google Drive:
   * Trilha; Ateliê; Núcleo de Moda; Curso de Férias
   */
  normalizeTipoPedagogicoFolderName: function(tipoStr) {
    if (!tipoStr) return "";
    var norm = String(tipoStr).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (norm.includes("ferias")) return "Curso de Férias";
    if (norm.includes("trilha")) return "Trilha";
    if (norm.includes("atelie")) return "Ateliê";
    if (norm.includes("moda")) return "Núcleo de Moda";
    return String(tipoStr).trim();
  },

  /**
   * Sanitiza chaves para o CacheService do Apps Script (máximo 250 caracteres, apenas ASCII)
   */
  sanitizeCacheKey: function(keyStr) {
    if (!keyStr) return "cache_key_default";
    var clean = String(keyStr)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    if (clean.length > 200) {
      clean = clean.substring(0, 200);
    }
    return clean;
  },

  /**
   * Substituição segura de texto no Google Docs prevenindo o erro 'Illegal group reference' com cifrão ($)
   */
  safeReplaceText: function(body, searchPattern, replacementText) {
    if (!body || !searchPattern) return;
    var safeText = this.formatField(replacementText);
    // Escapa '$' e '\' na string de substituição antes de enviar para o DocumentApp
    var escapedText = safeText.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
    body.replaceText(searchPattern, escapedText);
  },

  /**
   * Cria respostas padrão em formato JSON estruturado
   */
  createResponse: function(success, message, data) {
    var responseObj = {
      success: success,
      message: message
    };
    if (data && typeof data === "object") {
      for (var key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          responseObj[key] = data[key];
        }
      }
    }
    return responseObj;
  },

  /**
   * Grava logs de erro na aba _LOGS da planilha de respostas
   */
  logError: function(context, error) {
    try {
      var spreadsheetId = CONFIG.SPREADSHEET_RESPONSES_ID;
      if (!spreadsheetId || spreadsheetId.startsWith("INSIRA_O_ID")) {
        spreadsheetId = CONFIG.SPREADSHEET_RESPONSES_PEDAGOGICO_ID;
      }
      if (spreadsheetId && !spreadsheetId.startsWith("INSIRA_O_ID")) {
        var ss = SpreadsheetApp.openById(spreadsheetId);
        var sheet = ss.getSheetByName("_LOGS");
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

