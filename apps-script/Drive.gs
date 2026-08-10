/**
 * GERENCIADOR DE ARQUIVOS E PASTAS DO GOOGLE DRIVE
 * Responsável por criar a hierarquia institucional de pastas e salvar anexos.
 */

function getRootFolderConnection() {
  const rootId = CONFIG.DRIVE_ROOT_FOLDER_ID ? CONFIG.DRIVE_ROOT_FOLDER_ID.trim() : "";
  if (!rootId || rootId.startsWith("INSIRA_O_ID")) {
    throw new Error("O ID da Pasta Raiz do Drive (DRIVE_ROOT_FOLDER_ID) não foi configurado no Config.gs.");
  }
  try {
    return DriveApp.getFolderById(rootId);
  } catch (err) {
    throw new Error("Falha ao abrir Pasta Raiz do Drive (DRIVE_ROOT_FOLDER_ID: '" + rootId + "'). Verifique se o ID pertence a uma pasta válida.");
  }
}

function getOrCreateSubFolder(parentFolder, folderName) {
  const rawKey = "folder_id_" + parentFolder.getId() + "_" + folderName;
  const cacheKey = Utils.sanitizeCacheKey(rawKey);
  const cache = CacheService.getScriptCache();
  const cachedId = cache.get(cacheKey);
  
  if (cachedId) {
    try {
      return DriveApp.getFolderById(cachedId);
    } catch (e) {
      Logger.log("Pasta em cache expirou ou foi deletada: " + folderName);
    }
  }
  
  const folders = parentFolder.getFoldersByName(folderName);
  let targetFolder = folders.hasNext() ? folders.next() : null;
  
  // Busca insensível a maiúsculas/minúsculas e alfanumérica se o nome exato não for achado
  if (!targetFolder) {
    const cleanSearch = folderName.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const subFolders = parentFolder.getFolders();
    while (subFolders.hasNext()) {
      const sf = subFolders.next();
      const cleanSubName = sf.getName().toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (cleanSubName === cleanSearch) {
        targetFolder = sf;
        break;
      }
    }
  }

  if (!targetFolder) {
    targetFolder = parentFolder.createFolder(folderName);
  }
  
  try {
    cache.put(cacheKey, targetFolder.getId(), 21600); // Cache por 6 horas
  } catch (cErr) {
    Logger.log("Aviso ao gravar no CacheService: " + cErr.message);
  }

  return targetFolder;
}

function getFormattedMonthName(monthStr) {
  const months = {
    "01": "01 - Janeiro", "02": "02 - Fevereiro", "03": "03 - Março",
    "04": "04 - Abril", "05": "05 - Maio", "06": "06 - Junho",
    "07": "07 - Julho", "08": "08 - Agosto", "09": "09 - Setembro",
    "10": "10 - Outubro", "11": "11 - Novembro", "12": "12 - Dezembro"
  };
  return months[monthStr] || monthStr;
}

function getOrCreateFolderStructure(setor, dataRelatorio, unidade, atividade, tipoPedagogico, divisaoRegional, responsavel, mesReferencia, anoReferencia) {
  try {
    const rootFolder = getRootFolderConnection();
    const fabricasFolder = getOrCreateSubFolder(rootFolder, "Fábricas de Cultura");
    
    let anoStr = anoReferencia ? String(anoReferencia).trim() : "";
    let mesNum = mesReferencia ? String(mesReferencia).trim() : "";

    if (!anoStr || !mesNum) {
      if (dataRelatorio) {
        const cleanStr = String(dataRelatorio).replace(/\s+/g, "");
        const parts = cleanStr.split(/[-/]/);
        if (parts.length >= 2) {
          if (parts[0].length === 4) {
            anoStr = anoStr || parts[0];
            mesNum = mesNum || parts[1];
          } else if (parts[parts.length - 1].length === 4) {
            anoStr = anoStr || parts[parts.length - 1];
            mesNum = mesNum || parts[0];
          }
        }
      }
    }

    if (!anoStr) anoStr = new Date().getFullYear().toString();
    if (!mesNum) mesNum = (new Date().getMonth() + 1).toString().padStart(2, "0");
    if (mesNum.length === 1) mesNum = "0" + mesNum;

    let mesStr = getFormattedMonthName(mesNum);

    const setorNorm = Utils.normalizeAreaName(setor);
    const cleanAtividadeName = Utils.sanitizeFileName(atividade ? atividade.trim() : "ATIVIDADE").toUpperCase().replace(/\s+/g, "_");
    
    const setorFolder = getOrCreateSubFolder(fabricasFolder, setor ? setor.trim() : "PEDAGÓGICO");
    const anoFolder = getOrCreateSubFolder(setorFolder, anoStr);
    
    let parentFolder;
    
    if (setorNorm === "FUNDAÇÃO CASA") {
      const drFolder = getOrCreateSubFolder(anoFolder, divisaoRegional ? divisaoRegional.trim() : "DR INDEFINIDA");
      const drUnidadeFolder = getOrCreateSubFolder(drFolder, unidade ? unidade.trim() : "UNIDADE");
      parentFolder = getOrCreateSubFolder(drUnidadeFolder, mesStr);
    } else {
      const unidadeFolder = getOrCreateSubFolder(anoFolder, unidade ? unidade.trim() : "UNIDADE");
      const mesFolder = getOrCreateSubFolder(unidadeFolder, mesStr);
      
      parentFolder = mesFolder;
      if (setorNorm === "PEDAGÓGICO" && tipoPedagogico) {
        parentFolder = getOrCreateSubFolder(mesFolder, tipoPedagogico.trim());
      }
    }
    
    const activityFolder = getOrCreateSubFolder(parentFolder, cleanAtividadeName);
    
    let listaPresencaFolder = null;
    let relacaoInscritosFolder = null;
    let registroFolder = null;
    let relatorioFolder = null;

    if (setorNorm === "FUNDAÇÃO CASA") {
      relatorioFolder = activityFolder;
      registroFolder = null;
    } else {
      registroFolder = getOrCreateSubFolder(activityFolder, "Registro Fotográfico");
      relatorioFolder = getOrCreateSubFolder(activityFolder, "Relatório");
      if (setorNorm === "PEDAGÓGICO") {
        listaPresencaFolder = getOrCreateSubFolder(activityFolder, "Lista de Presença");
        relacaoInscritosFolder = getOrCreateSubFolder(activityFolder, "Relação de Inscritos");
      }
    }
    
    return {
      activityFolder: activityFolder,
      listaPresencaFolder: listaPresencaFolder,
      relacaoInscritosFolder: relacaoInscritosFolder,
      relatorioFolder: relatorioFolder,
      registroFolder: registroFolder
    };
  } catch (error) {
    Logger.log("Erro no getOrCreateFolderStructure: " + error.toString());
    throw new Error("Falha na organização de pastas no Drive: " + error.message);
  }
}

function uploadFilesToFolder(files, targetFolder, metadata = {}) {
  try {
    if (!files || files.length === 0) {
      return 0;
    }
    
    const setorUpper = metadata.setor ? metadata.setor.toString().trim().toUpperCase() : "";
    
    for (let i = 0; i < files.length; i++) {
      const fileData = files[i];
      let base64 = fileData.base64Data || "";
      if (base64.includes(",")) {
        base64 = base64.split(",")[1];
      }
      const bytes = Utilities.base64Decode(base64);
      const mime = fileData.mimeType || (setorUpper === "FUNDAÇÃO CASA" ? "application/pdf" : "image/jpeg");
      const blob = Utilities.newBlob(bytes, mime, fileData.name || "arquivo");
      
      const createdFile = targetFolder.createFile(blob);
      
      const parts = (fileData.name || "arquivo.jpg").split(".");
      const ext = parts.length > 1 ? parts.pop().toLowerCase() : (mime === "application/pdf" ? "pdf" : "jpg");
      
      let cleanFileName = "";
      if (setorUpper === "FUNDAÇÃO CASA") {
        // Formato Fundação CASA: [MesPorExtenso]_[NomeCentroAtendimento]_[NomeAtividade]_PlanoDeAtividade.pdf
        const mesExt = Utils.getMonthNameExtenso(metadata.mesReferencia);
        const cleanCentro = Utils.sanitizeFileName(metadata.unidade || "").toUpperCase().replace(/\s+/g, "_");
        const cleanAtividade = Utils.sanitizeFileName(metadata.atividade || "").toUpperCase().replace(/\s+/g, "_");
        cleanFileName = mesExt + "_" + cleanCentro + "_" + cleanAtividade + "_PlanoDeAtividade." + ext;
      } else {
        // Formato Demais Áreas: [SiglaUnidade]_[NomeResponsavel]_[NomeAtividade]_[Index].[ext]
        const unidadeSigla = Utils.getUnidadeSigla(metadata.unidade);
        const cleanResponsavel = Utils.sanitizeFileName(metadata.responsavel || "").toUpperCase().replace(/\s+/g, "_");
        const cleanAtividade = Utils.sanitizeFileName(metadata.atividade || "").toUpperCase().replace(/\s+/g, "_");
        const indexStr = (i + 1).toString().padStart(2, "0");
        cleanFileName = unidadeSigla + "_" + cleanResponsavel + "_" + cleanAtividade + "_" + indexStr + "." + ext;
      }
      
      createdFile.setName(cleanFileName);
    }
    
    return files.length;
  } catch (error) {
    Logger.log("Erro no uploadFilesToFolder: " + error.toString());
    throw new Error("Falha ao salvar anexos no Drive: " + error.message);
  }
}
