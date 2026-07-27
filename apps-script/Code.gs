/**
 * CONTROLADOR PRINCIPAL DO BACKEND (API HEADLESS GOOGLE APPS SCRIPT)
 * Recebe requisições via POST (JSON) e GET da hospedagem Vercel,
 * gerencia a gravação no Sheets, upload no Drive e geração do PDF no Docs.
 */

/**
 * Roteador HTTP POST para chamadas vindas do Frontend na Vercel
 * @param {Object} e Evento de requisição HTTP POST contendo postData
 * @return {TextOutput} Resposta JSON com cabeçalhos apropriados
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      return responseJSON(Utils.createResponse(false, "Payload de requisição inválido ou vazio."));
    }

    const action = payload.action;
    let result;

    if (action === "getDropdownData") {
      result = Utils.createResponse(true, "Listas obtidas com sucesso", {
        hierarchy: getDropdownData()
      });
    } else if (action === "submitForm") {
      result = submitForm(payload.formData);
    } else if (action === "generatePdfReportAsync") {
      result = generatePdfReportAsync(
        payload.sheetName,
        payload.rowNumber,
        payload.relatorioFolderId,
        payload.registroFolderId,
        payload.area,
        payload.formData
      );
    } else {
      result = Utils.createResponse(false, "Ação não reconhecida: '" + action + "'");
    }

    return responseJSON(result);

  } catch (error) {
    Logger.log("Erro no doPost: " + error.toString());
    Utils.logError("Code.doPost", error);
    return responseJSON(Utils.createResponse(false, "Erro interno na API Apps Script: " + error.message));
  }
}

/**
 * Roteador HTTP GET para testes diretos e obtenção de dados de dropdown
 * @param {Object} e Evento de requisição HTTP GET
 * @return {TextOutput} Resposta JSON ou HTML de status
 */
function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : null;
    if (action === "getDropdownData") {
      const data = getDropdownData();
      return responseJSON(Utils.createResponse(true, "Listas obtidas com sucesso", { hierarchy: data }));
    }
    
    return responseJSON(Utils.createResponse(true, "API Headless Google Apps Script ativa e operacional.", {
      system: CONFIG.SYSTEM_NAME,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    return responseJSON(Utils.createResponse(false, "Erro no doGet: " + error.message));
  }
}

/**
 * Auxiliar para formatar retorno em JSON puro
 */
function responseJSON(dataObject) {
  return ContentService.createTextOutput(JSON.stringify(dataObject))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ETAPA 1: Processamento síncrono rápido (< 1.5s)
 * Cria pastas no Drive, faz upload das imagens em Base64 e salva a linha no Sheets.
 * 
 * @param {Object} formData Dados do formulário
 * @return {Object} Retorno com IDs de pasta para a Etapa 2
 */
function submitForm(formData) {
  try {
    if (!formData) {
      return Utils.createResponse(false, "Dados do formulário não informados.");
    }
    
    formData.area = formData.setor || formData.area;
    
    formData.dataRelatorio = formData.dataRelatorio || (formData.mesReferencia && formData.anoReferencia ? (formData.mesReferencia + " / " + formData.anoReferencia) : formData.dataReposicao);
    
    // Validação de segurança dos campos obrigatórios básicos
    if (!formData.unidade || !formData.atividade || !formData.setor || !formData.responsavel || !formData.dataRelatorio) {
      return Utils.createResponse(false, "Campos obrigatórios faltando. Certifique-se de preencher Unidade, Atividade, Setor, Responsável e Mês/Ano.");
    }
    
    if (formData.setor.trim().toUpperCase() !== "PEDAGÓGICO") {
      formData.atividade = formData.atividade.toString().toUpperCase().trim();
    }
    
    // 1. Cria a estrutura hierárquica de pastas no Google Drive
    const folders = getOrCreateFolderStructure(
      formData.setor,
      formData.dataRelatorio,
      formData.unidade,
      formData.atividade,
      formData.tipoPedagogico,
      formData.divisaoRegional,
      formData.responsavel
    );
    
    // 2. Upload rápido de fotos anexadas em Base64
    if (formData.files && formData.files.length > 0 && folders.registroFolder) {
      uploadFilesToFolder(formData.files, folders.registroFolder, {
        unidade: formData.unidade,
        responsavel: formData.responsavel,
        atividade: formData.atividade
      });
    }
    
    // 3. Salva os dados textuais no Google Sheets da área
    const saveResult = saveResponseRow(formData);
    
    // 4. Retorna confirmação e IDs para a compilação assíncrona do PDF
    return Utils.createResponse(true, "Dados salvos com sucesso no Google Sheets e Drive!", {
      sheetName: saveResult.sheetName,
      rowNumber: saveResult.rowNumber,
      relatorioFolderId: folders.relatorioFolder.getId(),
      registroFolderId: folders.registroFolder ? folders.registroFolder.getId() : null,
      area: formData.area
    });
    
  } catch (error) {
    Logger.log("Erro na Etapa 1 (submitForm): " + error.toString());
    Utils.logError("Code.submitForm", error);
    return Utils.createResponse(false, "Erro ao gravar formulário: " + error.message);
  }
}

/**
 * ETAPA 2: Compilação do Google Docs e exportação do PDF
 * 
 * @param {string} sheetName Nome da aba
 * @param {number} rowNumber Número da linha no Sheets
 * @param {string} relatorioFolderId ID da pasta 'Relatório'
 * @param {string} registroFolderId ID da pasta 'Registro Fotográfico'
 * @param {string} area Nome da área
 * @param {Object} formData Dados do formulário
 * @return {Object} Links para o documento e PDF gerado
 */
function generatePdfReportAsync(sheetName, rowNumber, relatorioFolderId, registroFolderId, area, formData) {
  try {
    if (!formData) formData = {};
    formData.area = formData.area || area || formData.setor || "Pedagógico";
    formData.setor = formData.setor || formData.area;
    const relatorioFolder = DriveApp.getFolderById(relatorioFolderId);
    
    // Constrói o Google Docs, substitui placeholders, insere imagens e exporta em PDF
    const reportUrls = generateDocumentAndPdf(formData, relatorioFolder, registroFolderId);
    
    return Utils.createResponse(true, "Relatório PDF compilado com sucesso!", {
      pdfUrl: reportUrls.pdfUrl,
      docUrl: reportUrls.docUrl
    });
  } catch (error) {
    Logger.log("Erro na Etapa 2 (generatePdfReportAsync): " + error.toString());
    Utils.logError("Code.generatePdfReportAsync", error);
    return Utils.createResponse(false, "Falha na compilação em segundo plano: " + error.message);
  }
}
