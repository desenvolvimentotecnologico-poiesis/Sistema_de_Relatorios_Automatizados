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
   * Monta o nome padronizado da pasta da atividade no Drive.
   *
   * O formato é mantido idêntico ao que o sistema sempre gerou (sanitização + MAIÚSCULAS +
   * espaços trocados por underscore) para que as pastas já criadas em produção continuem sendo
   * reaproveitadas. A separação entre atividades de nome parecido é garantida por
   * normalizeFolderKey (busca) e removeFilesMatching (limpeza), não por mudança de formato.
   */
  buildActivityFolderName: function(atividade) {
    var base = atividade ? String(atividade).trim() : "ATIVIDADE";
    var clean = this.sanitizeFileName(base).toUpperCase().replace(/\s+/g, "_");
    return clean || "ATIVIDADE";
  },

  /**
   * Devolve a data da atividade no formato DD-MM-AAAA, usada como prefixo da pasta e dos arquivos
   * nas Bibliotecas.
   *
   * Bibliotecas registram várias atividades por mês, e a pasta é organizada por mês — sem a data
   * no nome, dois envios da mesma atividade em dias diferentes caem na mesma pasta e as fotos do
   * segundo substituem as do primeiro. O formato DD-MM-AAAA é o mesmo já usado no nome do
   * relatório da área, e dentro da pasta de um mês ele também ordena cronologicamente.
   *
   * @return {string} Data em DD-MM-AAAA, ou "" se não for uma data reconhecível
   */
  getDateFolderPrefix: function(dataAtividade) {
    if (!dataAtividade) return "";
    var br = this.formatDateToBR(dataAtividade);
    var clean = String(br).replace(/\//g, "-").trim();
    return /^\d{2}-\d{2}-\d{4}$/.test(clean) ? clean : "";
  },

  /**
   * Monta a data da ocorrência de Articulação e Difusão em DD-MM-AAAA, a partir do primeiro dia
   * selecionado no calendário.
   *
   * Fonte única desse formato: ele nomeia o relatório, a pasta da atividade e cada foto. Se cada
   * ponto montasse a data por conta própria, uma divergência faria a limpeza do reenvio não
   * encontrar os arquivos da versão anterior, que ficariam duplicados ao lado dos novos.
   */
  buildArticulacaoDateKey: function(diasAtividade, mesReferencia, anoReferencia) {
    var dia = "";
    if (diasAtividade instanceof Date && !isNaN(diasAtividade.getTime())) {
      dia = String(diasAtividade.getDate());
    } else if (diasAtividade) {
      var raw = String(diasAtividade).trim();
      var firstPart = raw.split(/[,;]/)[0].replace(/[^0-9]/g, "");
      if (firstPart) {
        var num = parseInt(firstPart, 10);
        if (!isNaN(num) && num >= 1 && num <= 31) {
          dia = String(num);
        }
      }
      if (!dia) {
        var match = raw.match(/^(\d{1,2})[\/\-]/);
        if (match) dia = String(parseInt(match[1], 10));
      }
    }
    if (!dia) dia = "01";
    if (dia.length === 1) dia = "0" + dia;

    var mes = mesReferencia ? String(mesReferencia).trim() : "01";
    if (mes.length === 1) mes = "0" + mes;

    var ano = anoReferencia ? String(anoReferencia).trim() : new Date().getFullYear().toString();

    return dia + "-" + mes + "-" + ano;
  },

  // Ordem canônica dos dias úteis. Base única para exibição na planilha, abreviação no nome do
  // arquivo e comparação de duplicidade da Fundação CASA (onde a mesma atividade pode ter duas
  // turmas no mesmo mês, diferenciadas por dias da semana + horário).
  WEEKDAY_ORDER: ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA"],
  WEEKDAY_LABELS: { SEGUNDA: "Segunda", TERCA: "Terça", QUARTA: "Quarta", QUINTA: "Quinta", SEXTA: "Sexta" },
  WEEKDAY_ABBR: { SEGUNDA: "SEG", TERCA: "TER", QUARTA: "QUA", QUINTA: "QUI", SEXTA: "SEX" },

  /**
   * Converte qualquer representação de dias da semana (array, "Segunda, Quarta", "SEG;QUA",
   * "segunda-feira") no conjunto canônico ordenado de Segunda a Sexta, sem repetição.
   *
   * @return {Array<string>} chaves ("SEGUNDA".."SEXTA") na ordem da semana
   */
  parseWeekdaySet: function(value) {
    if (value === null || value === undefined || value === "") return [];
    var raw = Array.isArray(value) ? value.join(",") : String(value);
    var tokens = raw.split(/[,;/|]+/);
    var found = {};
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i].normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
        .toUpperCase().replace(/[^A-Z]/g, "");
      if (!t) continue;
      if (t.indexOf("SEGUNDA") === 0 || t === "SEG") found.SEGUNDA = true;
      else if (t.indexOf("TERCA") === 0 || t === "TER") found.TERCA = true;
      else if (t.indexOf("QUARTA") === 0 || t === "QUA") found.QUARTA = true;
      else if (t.indexOf("QUINTA") === 0 || t === "QUI") found.QUINTA = true;
      else if (t.indexOf("SEXTA") === 0 || t === "SEX") found.SEXTA = true;
    }
    var out = [];
    for (var k = 0; k < this.WEEKDAY_ORDER.length; k++) {
      if (found[this.WEEKDAY_ORDER[k]]) out.push(this.WEEKDAY_ORDER[k]);
    }
    return out;
  },

  /** Dias da semana por extenso para a planilha: "Segunda, Quarta". */
  formatWeekdaysExtenso: function(value) {
    var self = this;
    return this.parseWeekdaySet(value).map(function(k) { return self.WEEKDAY_LABELS[k]; }).join(", ");
  },

  /** Dias da semana abreviados para o nome do arquivo: "SEG-QUA". */
  abbreviateWeekdays: function(value) {
    var self = this;
    return this.parseWeekdaySet(value).map(function(k) { return self.WEEKDAY_ABBR[k]; }).join("-");
  },

  /** Chave de comparação do conjunto de dias (ordem canônica). "" quando vazio. */
  weekdaySetKey: function(value) {
    return this.parseWeekdaySet(value).join("|");
  },

  /**
   * Normaliza um horário isolado para "HH:MM" em 24h. Aceita "14:15", "1415", "14h15", "14h",
   * "2:15 PM". Devolve "" quando não reconhece.
   */
  normalizeTime: function(value) {
    if (value === null || value === undefined) return "";
    var s = String(value).trim().toLowerCase();
    if (!s) return "";
    var pm = /p\.?\s*m\.?/.test(s);
    var am = /a\.?\s*m\.?/.test(s);
    var h, m;
    if (s.indexOf(":") !== -1) {
      var parts = s.replace(/[^0-9:]/g, "").split(":");
      h = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
    } else {
      var digits = s.replace(/[^0-9]/g, "");
      if (digits.length === 3) { h = parseInt(digits.slice(0, 1), 10); m = parseInt(digits.slice(1), 10); }
      else if (digits.length === 4) { h = parseInt(digits.slice(0, 2), 10); m = parseInt(digits.slice(2), 10); }
      else if (digits.length >= 1 && digits.length <= 2) { h = parseInt(digits, 10); m = 0; }
      else return "";
    }
    if (isNaN(h) || isNaN(m)) return "";
    if (pm && h < 12) h += 12;
    if (am && h === 12) h = 0;
    if (h < 0 || h > 23 || m < 0 || m > 59) return "";
    return (h < 10 ? "0" + h : "" + h) + ":" + (m < 10 ? "0" + m : "" + m);
  },

  /** Horário por extenso para a planilha: "14:15 às 15:45". */
  formatHorarioExtenso: function(inicio, fim) {
    var hi = this.normalizeTime(inicio);
    var hf = this.normalizeTime(fim);
    if (hi && hf) return hi + " às " + hf;
    return hi || hf || "";
  },

  /** Horário abreviado para o nome do arquivo: "1415-1545". */
  abbreviateHorario: function(inicio, fim) {
    var hi = this.normalizeTime(inicio).replace(":", "");
    var hf = this.normalizeTime(fim).replace(":", "");
    if (hi && hf) return hi + "-" + hf;
    return hi || hf || "";
  },

  /**
   * Chave de comparação do horário a partir de qualquer forma ("14:15 às 15:45", "1415-1545",
   * "14:15"). Usada para casar o valor gravado na planilha com o do novo envio. "" quando vazio.
   */
  horarioKey: function(value) {
    if (value === null || value === undefined) return "";
    var s = String(value).trim();
    if (!s) return "";
    var parts = s.split(new RegExp("\\s*(?:\u00e0s|as|-|\u2013|\u2014)\\s*", "i"))
      .filter(function(p) { return p.trim() !== ""; });
    var hi = this.normalizeTime(parts[0] || "");
    var hf = this.normalizeTime(parts[1] || "");
    if (!hi && !hf) return "";
    return hi + "~" + hf;
  },

  /**
   * Trecho que diferencia as turmas da Fundação CASA no nome do arquivo do relatório:
   * "SEG-QUA 1415-1545". É o único ponto que separa dois relatórios da mesma atividade/mês na
   * mesma pasta, então também entra no escopo da limpeza da versão anterior.
   */
  buildCasaTurmaFragment: function(diasSemana, horarioInicio, horarioFim) {
    var dias = this.abbreviateWeekdays(diasSemana);
    var hora = this.abbreviateHorario(horarioInicio, horarioFim);
    return [dias, hora].filter(function(p) { return p; }).join(" ");
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
   * Indica se a área distingue Responsável pelo Preenchimento x Responsável pela Execução
   * (Pedagógico, Articulação e Difusão, Bibliotecas). Fundação CASA fica de fora porque já tem
   * um conceito de responsável próprio (Razão Social) e declaração de responsabilidade distinta.
   * Centralizado aqui para Code.gs e Report.gs nunca divergirem sobre quais áreas usam a regra.
   */
  usesResponsavelPreenchimento: function(areaNorm) {
    return areaNorm === "BIBLIOTECA" || areaNorm === "PEDAGÓGICO" || areaNorm === "ARTICULAÇÃO E DIFUSÃO";
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
   * Sanitiza chaves para o CacheService do Apps Script (máximo 250 caracteres, apenas ASCII).
   *
   * A sanitização é lossy por natureza — troca todo caractere especial por "_" e corta o excedente
   * —, então duas chaves distintas podem virar a mesma string. Numa chave de pasta do Drive isso
   * significaria devolver a pasta de OUTRA atividade a partir do cache. O sufixo de hash abaixo
   * deriva do texto original completo e torna essa colisão inviável na prática.
   */
  sanitizeCacheKey: function(keyStr) {
    if (!keyStr) return "cache_key_default";
    var original = String(keyStr);
    var clean = original
      .normalize("NFD")
      .replace(new RegExp("[\u0300-\u036f]", "g"), "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    var suffix = "_" + this.shortHash(original);
    var maxBase = 200 - suffix.length;
    if (clean.length > maxBase) {
      clean = clean.substring(0, maxBase);
    }
    return clean + suffix;
  },

  /**
   * Hash curto e estável (hexadecimal) de uma string, usado para desambiguar chaves de cache.
   */
  shortHash: function(text) {
    try {
      var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(text), Utilities.Charset.UTF_8);
      var hex = "";
      for (var i = 0; i < 6; i++) {
        var b = (bytes[i] + 256) % 256;
        hex += (b < 16 ? "0" : "") + b.toString(16);
      }
      return hex;
    } catch (e) {
      // Recuo determinístico caso o serviço de digest não esteja disponível na execução
      var h = 0;
      var str = String(text);
      for (var j = 0; j < str.length; j++) {
        h = ((h << 5) - h + str.charCodeAt(j)) | 0;
      }
      return Math.abs(h).toString(16);
    }
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
   * Normaliza texto para comparação (maiúsculas, sem acentos, sem espaços nas pontas e com
   * espaços internos colapsados). Usado para comparar nomes de unidades/atividades vindos de
   * fontes distintas (planilhas, payloads). O colapso de espaços internos evita que a mesma
   * atividade digitada com espaço duplo seja tratada como uma atividade diferente.
   */
  normalizeText: function(str) {
    if (!str) return "";
    return str.toString().trim().toUpperCase().normalize("NFD")
      .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
      .replace(/\s+/g, " ");
  },

  /**
   * Normaliza o nome de uma pasta do Drive para localizar uma pasta equivalente já existente.
   *
   * Só ignora diferenças que NÃO alteram a identidade da pasta: acentuação, caixa e a escolha
   * entre espaço e underscore como separador (pastas antigas foram criadas com espaço, as novas
   * usam underscore). Todos os demais caracteres — hífen, parênteses, dígitos — são preservados,
   * porque são justamente o que distingue duas atividades de nome parecido
   * (ex.: "OFICINA - TEATRO" x "OFICINA TEATRO"). Achatar esses caracteres faria duas atividades
   * distintas cairem na mesma pasta e uma sobrescrever as evidências da outra.
   */
  normalizeFolderKey: function(name) {
    if (!name) return "";
    return String(name).normalize("NFD")
      .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
      .toUpperCase()
      .trim()
      .replace(/[\s_]+/g, "_");
  },

  /**
   * Remove do Drive qualquer arquivo existente com o mesmo nome antes de gravar uma nova versão,
   * evitando duplicidade quando o mesmo relatório/anexo é reenviado (ex.: retentativa após timeout)
   */
  removeExistingFilesByName: function(folder, fileName) {
    if (!folder || !fileName) return;
    try {
      var existingFiles = folder.getFilesByName(fileName);
      while (existingFiles.hasNext()) {
        var oldFile = existingFiles.next();
        try {
          oldFile.setTrashed(true);
        } catch (e) {
          Logger.log("Aviso ao remover duplicado no Drive ('" + fileName + "'): " + e.message);
        }
      }
    } catch (e) {
      Logger.log("Erro ao buscar arquivos duplicados ('" + fileName + "'): " + e.message);
    }
  },

  /**
   * Remove da pasta do Drive apenas os arquivos que pertencem à atividade informada, identificados
   * pelo nome da atividade embutido no padrão de nomenclatura do sistema
   * ([SIGLA]_[RESPONSAVEL]_[ATIVIDADE]_[NN].ext e [MES]_[UNIDADE]_[ATIVIDADE]_...).
   *
   * Substitui a limpeza total da pasta usada anteriormente. Limpar a pasta inteira garantia que um
   * reenvio da mesma atividade substituísse o lote anterior (mesmo se o Responsável tivesse mudado
   * entre os envios, o que altera o nome do arquivo), mas apagava junto as evidências de qualquer
   * OUTRA atividade que tivesse caído na mesma pasta. Restringir a remoção ao nome da atividade
   * preserva as duas garantias e elimina o dano colateral entre atividades distintas.
   *
   * @param {Folder} folder Pasta do Drive a limpar
   * @param {Array<string>} requireAll Trechos que o nome do arquivo precisa conter TODOS para ser
   *   removido. Quanto mais específico, mais estreita é a remoção: passar apenas a atividade
   *   remove todas as versões dela na pasta; acrescentar a data/mês limita à versão daquele
   *   período, o que importa nas áreas em que a mesma pasta guarda relatórios de datas diferentes.
   * @param {Array<string>} [preserveTokens] Trechos que blindam um arquivo contra a remoção, mesmo
   *   casando com requireAll (ex.: o Plano de Atividade da Fundação CASA, que divide a pasta com o
   *   relatório e foi enviado na Etapa 1 do mesmo envio).
   */
  removeFilesMatching: function(folder, requireAll, preserveTokens) {
    if (!folder) return;

    var self = this;
    var required = (requireAll || [])
      .map(function(t) { return self.normalizeFolderKey(t); })
      .filter(function(t) { return t !== ""; });

    // Sem nenhum critério não há como delimitar o que pertence a este envio; nesse caso é mais
    // seguro não remover nada do que arriscar apagar arquivos de terceiros.
    if (required.length === 0) return;

    var keep = (preserveTokens || []).map(function(t) { return self.normalizeFolderKey(t); });

    try {
      var files = folder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        var fileKey = this.normalizeFolderKey(file.getName());

        var matchesAll = required.every(function(token) {
          return fileKey.indexOf(token) !== -1;
        });
        if (!matchesAll) continue;

        var isProtected = keep.some(function(token) {
          return token && fileKey.indexOf(token) !== -1;
        });
        if (isProtected) continue;

        try {
          file.setTrashed(true);
        } catch (e) {
          Logger.log("Aviso ao remover versão anterior da atividade: " + e.message);
        }
      }
    } catch (e) {
      Logger.log("Erro ao remover arquivos anteriores da atividade: " + e.message);
    }
  },

  /**
   * Converte a coluna "Unidade" da Lista Branca em um array de unidades liberadas para upload.
   * Aceita múltiplas unidades separadas por vírgula ou ponto-e-vírgula (ex.: "Diadema, Heliópolis"),
   * ou o valor "Todas" para acesso irrestrito a todas as unidades.
   */
  parseUnidadesList: function(unidadeStr) {
    var raw = (unidadeStr || "").toString().trim();
    if (!raw) return ["Todas"];
    var parts = raw.split(/[,;]/).map(function(p) { return p.trim(); }).filter(function(p) { return p.length > 0; });
    if (parts.length === 0) return ["Todas"];
    var hasTodas = parts.some(function(p) { return p.toUpperCase() === "TODAS"; });
    return hasTodas ? ["Todas"] : parts;
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
    this.writeLog(context, error, "#f8d7da");
  },

  /**
   * Grava na aba _LOGS um evento relevante que NÃO é um erro (ex.: uma linha sobrescrita por
   * reenvio). O Logger do Apps Script só é visível no editor e expira; eventos que descartam
   * dados já gravados precisam de um rastro consultável pela equipe na própria planilha.
   */
  logInfo: function(context, message) {
    this.writeLog(context, message, "#f8d7da");
  },

  /**
   * Rotina compartilhada de gravação na aba _LOGS.
   */
  writeLog: function(context, detail, headerColor) {
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
          sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground(headerColor);
        }
        sheet.appendRow([new Date(), context, detail ? detail.toString() : ""]);
      }
    } catch (e) {
      Logger.log("Falha ao gravar log: " + e.toString());
    }
  }
};

