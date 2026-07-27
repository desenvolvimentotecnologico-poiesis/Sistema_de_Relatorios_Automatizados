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
  const cacheKey = "folder_id_" + parentFolder.getId() + "_" + folderName.replace(/\s+/g, "_");
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
  let targetFolder = folders.hasNext() ? folders.next() : parentFolder.createFolder(folderName);
  
  cache.put(cacheKey, targetFolder.getId(), 21600); // Cache por 6 horas
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

function getOrCreateFolderStructure(setor, dataRelatorio, unidade, atividade, tipoPedagogico, divisaoRegional, responsavel) {
  try {
    const rootFolder = getRootFolderConnection();
    
    const dateParts = dataRelatorio.split("-");
    const anoStr = dateParts[0];
    const mesNum = dateParts[1] || "01";
    const mesStr = getFormattedMonthName(mesNum);
    
    let folderDateStr = dataRelatorio;
    if (dateParts.length === 3 && dateParts[0].length === 4) {
      folderDateStr = dateParts[2] + "-" + dateParts[1] + "-" + dateParts[0];
    }
    
    const cleanAtividadeName = Utils.sanitizeFileName(atividade.trim()).toUpperCase().replace(/\s+/g, "_");
    
    const setorFolder = getOrCreateSubFolder(rootFolder, setor.trim().toUpperCase());
    const anoFolder = getOrCreateSubFolder(setorFolder, anoStr);
    
    let parentFolder;
    let atividadeFolderName;
    
    if (setor.trim().toUpperCase() === "FUNDAÇÃO CASA") {
      const drFolder = getOrCreateSubFolder(anoFolder, divisaoRegional ? divisaoRegional.trim() : "DR INDEFINIDA");
      const unidadeFolder = getOrCreateSubFolder(drFolder, unidade.trim());
      const mesFolder = getOrCreateSubFolder(unidadeFolder, mesStr);
      parentFolder = mesFolder;
      
      const cleanResponsavelName = Utils.sanitizeFileName(responsavel ? responsavel.trim() : "").toUpperCase().replace(/\s+/g, "_");
      atividadeFolderName = folderDateStr + "_" + cleanAtividadeName + "_" + cleanResponsavelName;
    } else {
      const unidadeFolder = getOrCreateSubFolder(anoFolder, unidade.trim());
      const mesFolder = getOrCreateSubFolder(unidadeFolder, mesStr);
      
      parentFolder = mesFolder;
      if (setor.trim().toUpperCase() === "PEDAGÓGICO" && tipoPedagogico) {
        parentFolder = getOrCreateSubFolder(mesFolder, tipoPedagogico.trim());
      }
      
      atividadeFolderName = folderDateStr + "_" + cleanAtividadeName;
    }
    
    const activityFolder = getOrCreateSubFolder(parentFolder, atividadeFolderName);
    
    let listaPresencaFolder = null;
    let relacaoInscritosFolder = null;
    let registroFolder = null;
    
    if (setor.trim().toUpperCase() !== "FUNDAÇÃO CASA") {
      if (setor.trim().toUpperCase() !== "ARTICULAÇÃO E DIFUSÃO") {
        listaPresencaFolder = getOrCreateSubFolder(activityFolder, "Lista de Presença");
        relacaoInscritosFolder = getOrCreateSubFolder(activityFolder, "Relação de Inscritos");
      }
      registroFolder = getOrCreateSubFolder(activityFolder, "Registro Fotográfico");
    }
    
    const relatorioFolder = getOrCreateSubFolder(activityFolder, "Relatório");
    
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
    
    const cleanUnidade = Utils.sanitizeFileName(metadata.unidade || "").toUpperCase().replace(/\s+/g, "_");
    const cleanResponsavel = Utils.sanitizeFileName(metadata.responsavel || "").toUpperCase().replace(/\s+/g, "_");
    const cleanAtividade = Utils.sanitizeFileName(metadata.atividade || "").toUpperCase().replace(/\s+/g, "_");
    
    for (let i = 0; i < files.length; i++) {
      const fileData = files[i];
      const bytes = Utilities.base64Decode(fileData.base64Data);
      const blob = Utilities.newBlob(bytes, fileData.mimeType, fileData.name);
      
      const createdFile = targetFolder.createFile(blob);
      
      const parts = fileData.name.split(".");
      const ext = parts.length > 1 ? parts.pop().toLowerCase() : "jpg";
      const indexStr = (i + 1).toString().padStart(2, "0");
      const cleanFileName = cleanUnidade + "_" + cleanResponsavel + "_" + cleanAtividade + "_" + indexStr + "." + ext;
      
      createdFile.setName(cleanFileName);
    }
    
    return files.length;
  } catch (error) {
    Logger.log("Erro no uploadFilesToFolder: " + error.toString());
    throw new Error("Falha ao salvar anexos no Drive: " + error.message);
  }
}
