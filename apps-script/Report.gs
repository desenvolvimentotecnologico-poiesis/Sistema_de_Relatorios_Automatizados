/**
 * GERENCIADOR DE RELATÓRIOS DO GOOGLE DOCS E PDF
 * Responsável por clonar o template Docs, substituir placeholders,
 * organizar imagens em grade (2 colunas) e gerar o PDF final.
 */

function getTemplateFileConnection(area) {
  let templateId = "";
  let varName = "";
  const areaUpper = area.trim().toUpperCase();
  
  if (areaUpper === "PEDAGÓGICO") {
    templateId = CONFIG.DOC_TEMPLATE_PEDAGOGICO_ID;
    varName = "DOC_TEMPLATE_PEDAGOGICO_ID";
  } else if (areaUpper === "ARTICULAÇÃO E DIFUSÃO") {
    templateId = CONFIG.DOC_TEMPLATE_ARTICULACAO_ID;
    varName = "DOC_TEMPLATE_ARTICULACAO_ID";
  } else if (areaUpper === "FUNDAÇÃO CASA") {
    templateId = CONFIG.DOC_TEMPLATE_FUNDACAO_CASA_ID;
    varName = "DOC_TEMPLATE_FUNDACAO_CASA_ID";
  } else if (areaUpper === "BIBLIOTECA" || areaUpper === "BIBLIOTECAS") {
    templateId = CONFIG.DOC_TEMPLATE_BIBLIOTECA_ID;
    varName = "DOC_TEMPLATE_BIBLIOTECA_ID";
  } else {
    throw new Error("Área institucional inválida: " + area);
  }
  
  if (!templateId || templateId.startsWith("INSIRA_O_ID")) {
    throw new Error("O ID do Template do Google Docs (" + varName + ") para a área '" + area + "' não foi configurado no Config.gs.");
  }
  
  templateId = templateId.trim();

  try {
    return DriveApp.getFileById(templateId);
  } catch (err) {
    throw new Error("ID de Template do Docs Inválido no Config.gs (" + varName + ": '" + templateId + "').");
  }
}

function generateDocumentAndPdf(data, targetFolder, registroFolderId) {
  try {
    const templateFile = getTemplateFileConnection(data.area);
    
    const cleanUnidade = Utils.sanitizeFileName(data.unidade || "").toUpperCase().replace(/\s+/g, "_");
    const cleanResponsavel = Utils.sanitizeFileName(data.responsavel || "").toUpperCase().replace(/\s+/g, "_");
    const cleanAtividade = Utils.sanitizeFileName(data.atividade || "").toUpperCase().replace(/\s+/g, "_");
    
    const documentName = "RELATÓRIO_MENSAL_DE_ATIVIDADES_" + cleanUnidade + "_" + cleanResponsavel + "_" + cleanAtividade;
    
    const copiedFile = templateFile.makeCopy(documentName, targetFolder);
    const doc = DocumentApp.openById(copiedFile.getId());
    const body = doc.getBody();
    
    body.replaceText("\\{\\{AREA\\}\\}", data.area || "");
    body.replaceText("\\{\\{DIVISAO_REGIONAL\\}\\}", (data.divisaoRegional || "").toUpperCase());
    body.replaceText("\\{\\{CENTRO_ATENDIMENTO\\}\\}", (data.unidade || "").toUpperCase());
    body.replaceText("\\{\\{UNIDADE\\}\\}", (data.unidade || "").toUpperCase());
    body.replaceText("\\{\\{CONTRATO\\}\\}", data.contrato || "");
    body.replaceText("\\{\\{META_REFERENCIA\\}\\}", data.metaReferencia || "");
    body.replaceText("\\{\\{TIPO_PEDAGOGICO\\}\\}", data.tipoPedagogico || "");
    body.replaceText("\\{\\{ATIVIDADE\\}\\}", (data.atividade || "").toUpperCase());
    body.replaceText("\\{\\{ANO_REFERENCIA\\}\\}", data.anoReferencia || "");
    body.replaceText("\\{\\{MES_REFERENCIA\\}\\}", data.mesReferencia || "");
    body.replaceText("\\{\\{DIAS_ATIVIDADE\\}\\}", data.diasAtividade || "");
    body.replaceText("\\{\\{RESPONSAVEL\\}\\}", (data.responsavel || "").toUpperCase());
    body.replaceText("\\{\\{RAZAO_SOCIAL\\}\\}", (data.responsavel || "").toUpperCase());
    body.replaceText("\\{\\{HORARIO_INICIO\\}\\}", data.horarioInicio || "");
    body.replaceText("\\{\\{HORARIO_TERMINO\\}\\}", data.horarioTermino || "");
    body.replaceText("\\{\\{ENCONTROS_PREVISTOS\\}\\}", data.encontrosPrevistos || "");
    body.replaceText("\\{\\{ENCONTROS_REALIZADOS\\}\\}", data.encontrosRealizados || "");
    body.replaceText("\\{\\{CARGA_HORARIA_PREVISTA\\}\\}", data.cargaHorariaPrevista || "");
    body.replaceText("\\{\\{CARGA_HORARIA_REALIZADA\\}\\}", data.cargaHorariaRealizada || "");
    body.replaceText("\\{\\{CARGA_HORARIA_TOTAL\\}\\}", data.cargaHorariaTotal || "");
    body.replaceText("\\{\\{NUMERO_SESSOES\\}\\}", data.numSessoes || "");
    body.replaceText("\\{\\{NUM_SESSOES\\}\\}", data.numSessoes || "");
    
    const dateRelatorioFormatted = data.dataRelatorio ? Utils.formatDateToBR(data.dataRelatorio) : "";
    body.replaceText("\\{\\{DATA_RELATORIO\\}\\}", dateRelatorioFormatted);
    
    let diaVal = "";
    let mesVal = data.mesReferencia || "";
    let anoVal = data.anoReferencia || "";
    
    if (data.dataRelatorio) {
      const dateParts = data.dataRelatorio.split("-");
      if (dateParts.length === 3) {
        if (dateParts[0].length === 4) {
          anoVal = anoVal || dateParts[0];
          mesVal = mesVal || dateParts[1];
          diaVal = dateParts[2];
        } else {
          diaVal = dateParts[0];
          mesVal = mesVal || dateParts[1];
          anoVal = anoVal || dateParts[2];
        }
      }
    }
    
    body.replaceText("\\{\\{DIA\\}\\}", diaVal);
    body.replaceText("\\{\\{DIA_RELATORIO\\}\\}", diaVal);
    body.replaceText("\\{\\{MES\\}\\}", mesVal);
    body.replaceText("\\{\\{MES_RELATORIO\\}\\}", mesVal);
    body.replaceText("\\{\\{ANO\\}\\}", anoVal);
    body.replaceText("\\{\\{ANO_RELATORIO\\}\\}", anoVal);

    const dateFormatted = data.dataReposicao ? Utils.formatDateToBR(data.dataReposicao) : "";
    body.replaceText("\\{\\{DATA_REPOSICAO\\}\\}", dateFormatted);
    
    body.replaceText("\\{\\{PUBLICO_TOTAL\\}\\}", data.publicoTotal || "");
    body.replaceText("\\{\\{PUBLICO_SESSAO\\}\\}", data.publicoSessao || "");
    body.replaceText("\\{\\{PERFIL_PUBLICO\\}\\}", data.perfilPublico || "");
    body.replaceText("\\{\\{FAIXA_ETARIA\\}\\}", data.faixaEtaria || "");
    body.replaceText("\\{\\{DESTAQUE_ACAO\\}\\}", data.destaqueAcao || "");
    body.replaceText("\\{\\{OBJETIVOS\\}\\}", data.objetivos || "");
    body.replaceText("\\{\\{IMPACTO_CULTURAL\\}\\}", data.impactoCultural || "");
    body.replaceText("\\{\\{RELATO\\}\\}", data.relato || "");
    body.replaceText("\\{\\{DESCRICAO_METODOLOGIA\\}\\}", data.descricaoMetodologia || "");
    body.replaceText("\\{\\{ENGAJAMENTO_PARTICIPACAO\\}\\}", data.engajamentoParticipacao || "");
    body.replaceText("\\{\\{PONTOS_FORTES\\}\\}", data.pontosFortes || "");
    body.replaceText("\\{\\{PONTOS_FRACOS\\}\\}", data.pontosFracos || "");
    
    const position = body.findText("\\{\\{ANEXOS\\}\\}");
    
    if (position) {
      const element = position.getElement();
      const parentParagraph = element.getParent().asParagraph();
      element.asText().setText("");
      
      let registroFolder = null;
      if (registroFolderId) {
        try {
          registroFolder = DriveApp.getFolderById(registroFolderId);
        } catch (fErr) {
          Logger.log("Erro ao abrir pasta por ID: " + fErr.toString());
        }
      }
      
      let imageCount = 0;
      
      if (registroFolder) {
        try {
          const driveFiles = registroFolder.getFiles();
          const imageBlobs = [];
          while (driveFiles.hasNext()) {
            const file = driveFiles.next();
            const mimeType = file.getMimeType();
            if (mimeType && mimeType.startsWith("image/")) {
              imageBlobs.push(file.getBlob());
            }
          }
          
          if (imageBlobs.length > 0) {
            const tableRows = Math.ceil(imageBlobs.length / 2);
            const table = body.appendTable();
            table.setBorderWidth(0);
            
            let imgIdx = 0;
            for (let r = 0; r < tableRows; r++) {
              const row = table.appendTableRow();
              for (let c = 0; c < 2; c++) {
                const cell = row.appendTableCell();
                cell.setPaddingTop(6).setPaddingBottom(6).setPaddingLeft(6).setPaddingRight(6);
                if (imgIdx < imageBlobs.length) {
                  const p = cell.getChild(0).asParagraph();
                  p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                  const img = p.appendInlineImage(imageBlobs[imgIdx]);
                  
                  const origWidth = img.getWidth();
                  const origHeight = img.getHeight();
                  const targetWidth = 220;
                  
                  if (origWidth > targetWidth) {
                    const ratio = targetWidth / origWidth;
                    img.setWidth(targetWidth);
                    img.setHeight(origHeight * ratio);
                  }
                  imgIdx++;
                }
              }
            }
            imageCount = imageBlobs.length;
          }
        } catch (driveErr) {
          Logger.log("Erro ao ler fotos do Drive: " + driveErr.toString());
        }
      }
      
      if (imageCount === 0) {
        parentParagraph.appendText("Nenhuma imagem/evidência enviada.");
      }
    }
    
    doc.saveAndClose();
    
    const pdfBlob = copiedFile.getAs("application/pdf");
    pdfBlob.setName(documentName + ".pdf");
    const pdfFile = targetFolder.createFile(pdfBlob);
    
    copiedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      docUrl: copiedFile.getUrl(),
      pdfUrl: pdfFile.getUrl()
    };
  } catch (error) {
    Logger.log("Erro no generateDocumentAndPdf: " + error.toString());
    throw new Error("Falha na geração do relatório documental: " + error.message);
  }
}
