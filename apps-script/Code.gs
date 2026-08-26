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
      const force = payload && (payload.forceRefresh || payload.nocache);
      result = Utils.createResponse(true, "Listas obtidas com sucesso", {
        hierarchy: getDropdownData(force)
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
    } else if (action === "verifyUserAccess") {
      result = verifyUserAccess(payload.email);
    } else if (action === "checkActivityStatus") {
      result = checkActivityStatus(payload);
    } else if (action === "uploadComplementaryDocs") {
      result = uploadComplementaryDocs(payload);
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
      const force = e && e.parameter && (e.parameter.forceRefresh === "true" || e.parameter.nocache === "true");
      const data = getDropdownData(force);
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
    
    formData.area = Utils.normalizeAreaName(formData.setor || formData.area);
    formData.setor = formData.area;
    
    formData.dataRelatorio = formData.dataRelatorio || (formData.mesReferencia && formData.anoReferencia ? (formData.mesReferencia + " / " + formData.anoReferencia) : formData.dataReposicao);
    
    // Validação de segurança dos campos obrigatórios básicos
    if (!formData.unidade || !formData.atividade || !formData.setor || !formData.responsavel || !formData.dataRelatorio) {
      return Utils.createResponse(false, "Campos obrigatórios faltando. Certifique-se de preencher Unidade, Atividade, Setor, Responsável e Mês/Ano.");
    }

    // Bibliotecas: distingue Responsável pelo Preenchimento do Responsável pela Execução.
    // Validação espelha a regra condicional do front-end, protegendo contra chamadas diretas
    // à API que ignorem a validação client-side.
    if (formData.area === "BIBLIOTECA" && !formData.responsavelPreenchimento) {
      return Utils.createResponse(false, "Campo obrigatório faltando: Nome do Responsável pelo Preenchimento.");
    }

    if (formData.area !== "PEDAGÓGICO") {
      formData.atividade = formData.atividade.toString().toUpperCase().trim();
    }

    // Validação de segurança das mídias anexadas (espelha as regras já aplicadas no front-end,
    // protegendo contra chamadas diretas à API que ignorem a validação client-side)
    if (formData.area !== "FUNDAÇÃO CASA") {
      const fileCount = formData.files ? formData.files.length : 0;
      if (fileCount < 3 || fileCount > 5) {
        return Utils.createResponse(false, "É obrigatório anexar entre 3 e 5 fotos ou vídeos como evidência da atividade (recebido: " + fileCount + ").");
      }

      const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
      // Vídeo não é comprimido (ao contrário da foto), então tem um teto menor para evitar
      // payloads Base64 gigantes que travam/estouram o timeout do envio.
      const MAX_VIDEO_SIZE_BYTES = 8 * 1024 * 1024;
      const MAX_VIDEOS_PER_SUBMISSION = 2;

      let videoCount = 0;
      for (let i = 0; i < formData.files.length; i++) {
        const f = formData.files[i];
        const isVideo = f.mimeType && f.mimeType.toString().startsWith("video/");
        const base64Only = (f.base64Data || "").split(",").pop();
        const approxBytes = Math.floor(base64Only.length * 0.75);

        if (isVideo) {
          videoCount++;
          if (approxBytes > MAX_VIDEO_SIZE_BYTES) {
            return Utils.createResponse(false, "O vídeo \"" + (f.name || "anexo") + "\" excede o limite máximo de 8MB. Grave um vídeo mais curto ou em qualidade menor.");
          }
        } else if (approxBytes > MAX_IMAGE_SIZE_BYTES) {
          return Utils.createResponse(false, "O arquivo \"" + (f.name || "anexo") + "\" excede o limite máximo de 15MB por mídia.");
        }
      }

      if (videoCount > MAX_VIDEOS_PER_SUBMISSION) {
        return Utils.createResponse(false, "É permitido anexar no máximo " + MAX_VIDEOS_PER_SUBMISSION + " vídeo(s) por envio (recebido: " + videoCount + "). As demais evidências devem ser fotos.");
      }
    } else {
      // Validação de segurança do Plano de Atividades da Fundação CASA (espelha a validação do
      // front-end, protegendo contra chamadas diretas à API): cada encontro enviado precisa ter
      // Data, Horário e Descrição preenchidos, para não gerar linhas incompletas ("---") no relatório.
      const plano = Array.isArray(formData.planoTabela) ? formData.planoTabela : [];
      const isPreenchido = function(v) {
        return v && v.toString().trim() !== "" && v.toString().trim() !== "---";
      };
      const temEncontroIncompleto = plano.some(function(item) {
        return !isPreenchido(item && item.data) || !isPreenchido(item && item.horario) || !isPreenchido(item && item.descricao);
      });

      if (plano.length === 0 || temEncontroIncompleto) {
        return Utils.createResponse(false, "É obrigatório preencher Data, Horário e Descrição de pelo menos 1 encontro completo no Plano de Atividades.");
      }
    }

    // 1. Cria a estrutura hierárquica de pastas no Google Drive
    const folders = getOrCreateFolderStructure(
      formData.setor,
      formData.dataRelatorio,
      formData.unidade,
      formData.atividade,
      formData.tipoPedagogico,
      formData.divisaoRegional,
      formData.responsavel,
      formData.mesReferencia,
      formData.anoReferencia
    );
    
    // 2. Upload rápido de arquivos anexados em Base64
    const targetUploadFolder = folders.registroFolder || folders.relatorioFolder || folders.activityFolder;
    if (formData.files && formData.files.length > 0 && targetUploadFolder) {
      uploadFilesToFolder(formData.files, targetUploadFolder, {
        unidade: formData.unidade,
        responsavel: formData.responsavel,
        atividade: formData.atividade,
        setor: formData.setor,
        mesReferencia: formData.mesReferencia
      });
    }
    
    // 3. Salva os dados textuais no Google Sheets da área
    const saveResult = saveResponseRow(formData);
    
    const relatorioFolderObj = folders.relatorioFolder || folders.activityFolder;
    const relatorioFolderId = relatorioFolderObj ? relatorioFolderObj.getId() : null;
    const registroFolderId = folders.registroFolder ? folders.registroFolder.getId() : null;

    // 4. Retorna confirmação e IDs para a compilação assíncrona do PDF
    return Utils.createResponse(true, "Dados salvos com sucesso no Google Sheets e Drive!", {
      sheetName: saveResult.sheetName,
      rowNumber: saveResult.rowNumber,
      relatorioFolderId: relatorioFolderId,
      registroFolderId: registroFolderId,
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

    const areaStr = formData.area || "N/D";
    const unidadeStr = formData.unidade || formData.centroAtendimento || "N/D";
    const atividadeStr = formData.atividade || "N/D";
    const respStr = formData.responsavel || "N/D";

    if (!relatorioFolderId || typeof relatorioFolderId !== "string" || relatorioFolderId.trim() === "") {
      const logDetails = "ID da pasta 'Relatório' ausente ou inválido [Área: " + areaStr + " | Unidade: " + unidadeStr + " | Atividade: " + atividadeStr + " | Resp: " + respStr + " | Aba: " + (sheetName || "N/D") + " | Linha: " + (rowNumber || "N/D") + "]";
      Utils.logError("Code.generatePdfReportAsync", logDetails);
      return Utils.createResponse(false, logDetails);
    }
    
    const relatorioFolder = DriveApp.getFolderById(relatorioFolderId);
    
    // Constrói o Google Docs, substitui placeholders, insere imagens e exporta em PDF
    const reportUrls = generateDocumentAndPdf(formData, relatorioFolder, registroFolderId);
    
    return Utils.createResponse(true, "Relatório PDF compilado com sucesso!", {
      pdfUrl: reportUrls.pdfUrl,
      docUrl: reportUrls.docUrl
    });
  } catch (error) {
    const areaStr = (formData && formData.area) || area || "N/D";
    const unidadeStr = (formData && (formData.unidade || formData.centroAtendimento)) || "N/D";
    const logDetails = "[Área: " + areaStr + " | Unidade: " + unidadeStr + " | Aba: " + (sheetName || "N/D") + " | Linha: " + (rowNumber || "N/D") + "] Erro: " + error.toString();
    
    Logger.log("Erro na Etapa 2 (generatePdfReportAsync): " + logDetails);
    Utils.logError("Code.generatePdfReportAsync", logDetails);
    return Utils.createResponse(false, "Falha na compilação em segundo plano " + logDetails);
  }
}

/**
 * Valida o e-mail do usuário contra a aba 'Responsaveis_Autorizados' no Sheets
 */
function verifyUserAccess(email) {
  try {
    if (!email) {
      return Utils.createResponse(false, "E-mail não fornecido.");
    }
    const authorizedUser = checkEmailInWhitelist(email.trim().toLowerCase());
    if (authorizedUser) {
      return Utils.createResponse(true, "Acesso autorizado.", {
        authorized: true,
        user: authorizedUser
      });
    } else {
      return Utils.createResponse(true, "Acesso não localizado na lista branca.", {
        authorized: false
      });
    }
  } catch (error) {
    return Utils.createResponse(false, "Erro ao verificar permissão: " + error.message);
  }
}

/**
 * Checa se a atividade existe e qual o estado atual dos anexos
 */
function checkActivityStatus(params) {
  try {
    const status = findActivityRowAndDocs(params);
    return Utils.createResponse(true, "Consulta realizada com sucesso.", status);
  } catch (error) {
    return Utils.createResponse(false, "Erro ao consultar atividade: " + error.message);
  }
}

/**
 * Salva arquivos de Inscrição e/ou Presença no Drive e atualiza a planilha do Sheets
 */
function uploadComplementaryDocs(payload) {
  try {
    const result = saveComplementaryDocsAndRow(payload);
    return Utils.createResponse(true, "Documentos salvos e planilha atualizada com sucesso!", result);
  } catch (error) {
    return Utils.createResponse(false, "Erro no upload complementar: " + error.message);
  }
}

