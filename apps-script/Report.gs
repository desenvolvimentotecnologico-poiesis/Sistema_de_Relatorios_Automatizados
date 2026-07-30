/**
 * GERENCIADOR DE RELATÓRIOS DO GOOGLE DOCS E PDF
 * Responsável por clonar o template Docs, substituir placeholders,
 * organizar imagens em grade (2 colunas) e gerar o PDF final.
 */

function getTemplateFileConnection(area) {
  let templateId = "";
  let varName = "";
  const areaStr = (area || "Pedagógico").toString();
  const areaUpper = areaStr.trim().toUpperCase();
  
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
    if (!data) data = {};
    const setorUpper = data.area ? data.area.trim().toUpperCase() : "PEDAGÓGICO";
    const unidadeSigla = Utils.getUnidadeSigla(data.unidade);
    const cleanCentro = Utils.sanitizeFileName(data.unidade || "").toUpperCase().replace(/\s+/g, "_");
    const cleanResponsavel = Utils.sanitizeFileName(data.responsavel || "").toUpperCase().replace(/\s+/g, "_");
    const cleanAtividade = Utils.sanitizeFileName(data.atividade || "").toUpperCase().replace(/\s+/g, "_");
    
    let documentName = "";
    
    if (setorUpper === "PEDAGÓGICO") {
      // Padrão Pedagógico: siglaUnidade_nomeResponsavel_nomeAtividade
      documentName = unidadeSigla + "_" + cleanResponsavel + "_" + cleanAtividade;
    } else if (setorUpper === "ARTICULAÇÃO E DIFUSÃO") {
      // Padrão Articulação: dataDoPrimeiroDiaDaAtividade_siglaUnidade_nomeDoEvento
      let diaStr = data.diasAtividade ? String(data.diasAtividade).split(",")[0].trim() : "01";
      if (diaStr.length === 1) diaStr = "0" + diaStr;
      const mesStr = data.mesReferencia || "01";
      const anoStr = data.anoReferencia || new Date().getFullYear().toString();
      const dataFormatada = diaStr + "-" + mesStr + "-" + anoStr;
      documentName = dataFormatada + "_" + unidadeSigla + "_" + cleanAtividade;
    } else if (setorUpper === "BIBLIOTECA" || setorUpper === "BIBLIOTECAS") {
      // Padrão Biblioteca: dataDaAtividade_siglaUnidade_nomeAtividade_nomeResponsavel
      let dataAtiv = data.dataRelatorio ? Utils.formatDateToBR(data.dataRelatorio).replace(/\//g, "-") : "DATA";
      documentName = dataAtiv + "_" + unidadeSigla + "_" + cleanAtividade + "_" + cleanResponsavel;
    } else if (setorUpper === "FUNDAÇÃO CASA") {
      // Padrão Fundação CASA: mesPorExtenso_nomeCentroAtendimento_nomeAtividade_nomeResponsavel
      const mesExt = Utils.getMonthNameExtenso(data.mesReferencia);
      documentName = mesExt + "_" + cleanCentro + "_" + cleanAtividade + "_" + cleanResponsavel;
    } else {
      documentName = unidadeSigla + "_" + cleanResponsavel + "_" + cleanAtividade;
    }
    
    const templateFile = getTemplateFileConnection(data.area || data.setor);
    const copiedFile = templateFile.makeCopy(documentName, targetFolder);
    const doc = DocumentApp.openById(copiedFile.getId());
    const body = doc.getBody();
    
    const formatField = function(val) {
      if (val === null || val === undefined) return "";
      if (Array.isArray(val)) return val.join("; ");
      return String(val);
    };

    const contratoVal = formatField(data.contrato || data.numeroContrato || "");
    const impactoVal = formatField(data.impactoCultural || data.impactoTerritorial || "");

    body.replaceText("\\{\\{AREA\\}\\}", formatField(data.area));
    body.replaceText("\\{\\{DIVISAO_REGIONAL\\}\\}", formatField(data.divisaoRegional).toUpperCase());
    body.replaceText("\\{\\{CENTRO_ATENDIMENTO\\}\\}", formatField(data.unidade).toUpperCase());
    body.replaceText("\\{\\{UNIDADE\\}\\}", formatField(data.unidade).toUpperCase());
    body.replaceText("\\{\\{CONTRATO\\}\\}", contratoVal);
    body.replaceText("\\{\\{NUMERO_CONTRATO\\}\\}", contratoVal);
    body.replaceText("\\{\\{META_REFERENCIA\\}\\}", formatField(data.metaReferencia));
    body.replaceText("\\{\\{TIPO_PEDAGOGICO\\}\\}", formatField(data.tipoPedagogico));
    body.replaceText("\\{\\{ATIVIDADE\\}\\}", formatField(data.atividade).toUpperCase());
    body.replaceText("\\{\\{ANO_REFERENCIA\\}\\}", formatField(data.anoReferencia));
    body.replaceText("\\{\\{MES_REFERENCIA\\}\\}", formatField(data.mesReferencia));
    body.replaceText("\\{\\{DIAS_ATIVIDADE\\}\\}", formatField(data.diasAtividade));
    body.replaceText("\\{\\{RESPONSAVEL\\}\\}", formatField(data.responsavel).toUpperCase());
    body.replaceText("\\{\\{RAZAO_SOCIAL\\}\\}", formatField(data.responsavel).toUpperCase());
    body.replaceText("\\{\\{HORARIO_INICIO\\}\\}", formatField(data.horarioInicio));
    body.replaceText("\\{\\{HORARIO_TERMINO\\}\\}", formatField(data.horarioTermino));
    body.replaceText("\\{\\{ENCONTROS_PREVISTOS\\}\\}", formatField(data.encontrosPrevistos));
    body.replaceText("\\{\\{ENCONTROS_REALIZADOS\\}\\}", formatField(data.encontrosRealizados));
    body.replaceText("\\{\\{CARGA_HORARIA_PREVISTA\\}\\}", formatField(data.cargaHorariaPrevista));
    body.replaceText("\\{\\{CARGA_HORARIA_REALIZADA\\}\\}", formatField(data.cargaHorariaRealizada));
    body.replaceText("\\{\\{CARGA_HORARIA_TOTAL\\}\\}", formatField(data.cargaHorariaTotal));
    body.replaceText("\\{\\{NUMERO_SESSOES\\}\\}", formatField(data.numSessoes));
    body.replaceText("\\{\\{NUM_SESSOES\\}\\}", formatField(data.numSessoes));
    
    const dateRelatorioFormatted = data.dataRelatorio ? Utils.formatDateToBR(data.dataRelatorio) : "";
    body.replaceText("\\{\\{DATA_RELATORIO\\}\\}", dateRelatorioFormatted);
    
    let diaVal = "";
    let mesVal = formatField(data.mesReferencia);
    let anoVal = formatField(data.anoReferencia);
    
    if (data.dataRelatorio) {
      const dateParts = String(data.dataRelatorio).split("-");
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
    
    body.replaceText("\\{\\{PUBLICO_TOTAL\\}\\}", formatField(data.publicoTotal));
    body.replaceText("\\{\\{PUBLICO_SESSAO\\}\\}", formatField(data.publicoSessao));
    body.replaceText("\\{\\{PERFIL_PUBLICO\\}\\}", formatField(data.perfilPublico));
    body.replaceText("\\{\\{FAIXA_ETARIA\\}\\}", formatField(data.faixaEtaria));
    body.replaceText("\\{\\{DESTAQUE_ACAO\\}\\}", formatField(data.destaqueAcao));
    body.replaceText("\\{\\{OBJETIVOS\\}\\}", formatField(data.objetivos));
    body.replaceText("\\{\\{IMPACTO_CULTURAL\\}\\}", impactoVal);
    body.replaceText("\\{\\{IMPACTO_TERRITORIAL\\}\\}", impactoVal);
    body.replaceText("\\{\\{LINGUAGEM_ARTISTICA\\}\\}", formatField(data.linguagemArtistica));
    body.replaceText("\\{\\{INCLUSAO_DIVERSIDADE\\}\\}", formatField(data.inclusaoDiversidade));
    body.replaceText("\\{\\{EFEMERIDE\\}\\}", formatField(data.efemeride));
    body.replaceText("\\{\\{RELATO\\}\\}", formatField(data.relato));
    body.replaceText("\\{\\{DESCRICAO_METODOLOGIA\\}\\}", formatField(data.descricaoMetodologia));
    body.replaceText("\\{\\{ENGAJAMENTO_PARTICIPACAO\\}\\}", formatField(data.engajamentoParticipacao));
    body.replaceText("\\{\\{PONTOS_FORTES\\}\\}", formatField(data.pontosFortes));
    body.replaceText("\\{\\{PONTOS_FRACOS\\}\\}", formatField(data.pontosFracos));
    
    // Substituição dinâmica da Declaração de Responsabilidade com Carimbo de Aceite Eletrônico
    const timestampBR = Utils.getFormattedTimestampExtensoBR(new Date());
    const responsavelNome = formatField(data.responsavel).toUpperCase();
    
    let declaracaoTexto = "";
    if (setorUpper === "FUNDAÇÃO CASA") {
      declaracaoTexto = "DECLARAÇÃO DE RESPONSABILIDADE E CONFORMIDADE INSTITUCIONAL\n\n" +
        "\"Declaro que executei as atividades em conformidade com o Estatuto da Criança e do Adolescente (Lei nº 8.069/1990), observando integralmente as normas de segurança, disciplina, acesso e funcionamento da unidade da Fundação CASA, bem como as orientações da CONTRATANTE, não tendo praticado qualquer conduta incompatível com as regras institucionais.\n\n" +
        "Declaro que não captei, registrei, reproduzi, divulguei, compartilhei ou utilizei imagens, vídeos, áudios, dados pessoais ou quaisquer informações que permitam identificar adolescentes atendidos durante a execução das atividades.\n\n" +
        "Declaro que as informações e evidências apresentadas neste relatório correspondem às atividades efetivamente realizadas no período indicado e estão aptas a subsidiar o acompanhamento institucional e a prestação de contas.\"\n\n" +
        "[☑] TERMOS LIDOS E ACEITOS ELETRONICAMENTE NO ATO DO ENVIO\n" +
        "Declarante / Responsável: " + responsavelNome + "\n" +
        "Data/Hora do Registro: " + timestampBR + " (Horário Oficial de Brasília)";
    } else {
      declaracaoTexto = "DECLARAÇÃO DE RESPONSABILIDADE E CONFORMIDADE INSTITUCIONAL\n\n" +
        "\"Declaro que as informações e evidências apresentadas neste relatório correspondem às atividades efetivamente realizadas no período indicado e estão aptas a subsidiar o acompanhamento institucional e a prestação de contas.\"\n\n" +
        "[☑] TERMO LIDO E ACEITO ELETRONICAMENTE NO ATO DO ENVIO\n" +
        "Declarante / Responsável: " + responsavelNome + "\n" +
        "Data/Hora do Registro: " + timestampBR + " (Horário Oficial de Brasília)";
    }
    
    body.replaceText("\\{\\{DECLARACAO_RESPONSABILIDADE\\}\\}", declaracaoTexto);
    body.replaceText("\\{\\{DECLARACAO\\}\\}", declaracaoTexto);
    body.replaceText("\\{\\{TERMOS\\}\\}", declaracaoTexto);
    
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
      
      if (setorUpper === "FUNDAÇÃO CASA") {
        let pdfFileName = "Plano de Atividades em PDF";
        let pdfUrl = "";

        if (registroFolder) {
          try {
            const files = registroFolder.getFiles();
            if (files.hasNext()) {
              const pdfF = files.next();
              pdfFileName = pdfF.getName();
              pdfUrl = pdfF.getUrl();
            }
          } catch (err) {
            Logger.log("Erro ao buscar PDF na pasta de Plano de Atividade: " + err.toString());
          }
        }

        parentParagraph.setText("Plano de Atividades (PDF) anexado no Google Drive:");
        if (pdfUrl) {
          const linkText = parentParagraph.appendText("\n👉 Clique aqui para visualizar o Plano de Atividades em PDF (" + pdfFileName + ")");
          linkText.setLinkUrl(pdfUrl);
          linkText.setBold(true);
        } else {
          parentParagraph.appendText("\n" + pdfFileName + " (Salvo na subpasta 'Plano de Atividade' no Google Drive)");
        }
      } else {
        let imageCount = 0;
        let hasVideo = false;
        const imageBlobs = [];

        if (data.files && Array.isArray(data.files) && data.files.length > 0) {
          data.files.forEach(f => {
            if (f.mimeType && f.mimeType.startsWith("video/")) {
              hasVideo = true;
            } else if (f.base64Data && (!f.mimeType || f.mimeType.startsWith("image/"))) {
              try {
                let base64 = f.base64Data;
                if (base64.includes(",")) base64 = base64.split(",")[1];
                const decoded = Utilities.base64Decode(base64);
                const blob = Utilities.newBlob(decoded, f.mimeType || "image/jpeg", f.name || "foto.jpg");
                imageBlobs.push(blob);
              } catch (bErr) {
                Logger.log("Erro ao converter Base64 da foto: " + bErr.toString());
              }
            }
          });
        }

        if (registroFolder) {
          try {
            const driveFiles = registroFolder.getFiles();
            while (driveFiles.hasNext()) {
              const file = driveFiles.next();
              const mimeType = file.getMimeType();
              if (mimeType && mimeType.startsWith("video/")) {
                hasVideo = true;
              } else if (imageBlobs.length === 0 && mimeType && mimeType.startsWith("image/")) {
                imageBlobs.push(file.getBlob());
              }
            }
          } catch (driveErr) {
            Logger.log("Erro ao ler fotos da pasta do Drive: " + driveErr.toString());
          }
        }

        if (imageBlobs.length > 0) {
          try {
            const attachIndex = body.getChildIndex(parentParagraph);
            const tableRows = Math.ceil(imageBlobs.length / 2);
            const table = body.insertTable(attachIndex + 1);
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
          } catch (imgTableErr) {
            Logger.log("Erro ao criar tabela de imagens no Doc: " + imgTableErr.toString());
          }
        }
        
        if (imageCount === 0) {
          parentParagraph.appendText("Nenhuma imagem/evidência fotográfica enviada.");
        }

        if (hasVideo) {
          const videoNotice = body.appendParagraph("\n🎬 NOTA DE EVIDÊNCIA EM VÍDEO: Esta atividade possui registro(s) audiovisual(is) em vídeo salvo(s) diretamente na pasta de evidências da atividade no Google Drive.");
          videoNotice.setItalic(true).setFontSize(9.5).setForegroundColor("#4C1D95");
        }
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
