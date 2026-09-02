/**
 * GERENCIADOR DE RELATÓRIOS DO GOOGLE DOCS E PDF
 * Responsável por clonar o template Docs, substituir placeholders,
 * organizar imagens em grade (2 colunas) e gerar o PDF final.
 */

function getTemplateFileConnection(area) {
  let templateId = "";
  let varName = "";
  const areaNorm = Utils.normalizeAreaName(area);
  
  if (areaNorm === "PEDAGÓGICO") {
    templateId = CONFIG.DOC_TEMPLATE_PEDAGOGICO_ID;
    varName = "DOC_TEMPLATE_PEDAGOGICO_ID";
  } else if (areaNorm === "ARTICULAÇÃO E DIFUSÃO") {
    templateId = CONFIG.DOC_TEMPLATE_ARTICULACAO_ID;
    varName = "DOC_TEMPLATE_ARTICULACAO_ID";
  } else if (areaNorm === "FUNDAÇÃO CASA") {
    templateId = CONFIG.DOC_TEMPLATE_FUNDACAO_CASA_ID;
    varName = "DOC_TEMPLATE_FUNDACAO_CASA_ID";
  } else if (areaNorm === "BIBLIOTECA") {
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
    const setorNorm = Utils.normalizeAreaName(data.area || data.setor);
    const unidadeSigla = Utils.getUnidadeSigla(data.unidade);
    const cleanCentro = Utils.sanitizeFileName(data.unidade || "").toUpperCase().replace(/\s+/g, "_");
    const cleanResponsavel = Utils.sanitizeFileName(data.responsavel || "").toUpperCase().replace(/\s+/g, "_");
    const cleanAtividade = Utils.sanitizeFileName(data.atividade || "").toUpperCase().replace(/\s+/g, "_");
    
    let documentName = "";
    // Trechos que identificam ESTE relatório dentro da pasta, usados para remover a versão
    // anterior sem tocar nos relatórios vizinhos. O Responsável fica de fora de propósito: é o
    // campo que pode mudar entre o envio original e o reenvio, e a versão antiga precisa sair
    // mesmo assim. Já a data/mês entra sempre que a pasta é compartilhada por vários períodos —
    // é o que impede o relatório de uma data apagar o de outra data da mesma atividade.
    let escopoDoRelatorio = [];

    if (setorNorm === "PEDAGÓGICO") {
      // Padrão Pedagógico: siglaUnidade_nomeResponsavel_nomeAtividade
      documentName = unidadeSigla + "_" + cleanResponsavel + "_" + cleanAtividade;
      // A pasta do Pedagógico já é única por Ano/Unidade/Mês/Tipo/Atividade.
      escopoDoRelatorio = [unidadeSigla, cleanAtividade];
    } else if (setorNorm === "ARTICULAÇÃO E DIFUSÃO") {
      // Padrão Articulação: dataDoPrimeiroDiaDaAtividade_siglaUnidade_nomeDoEvento
      const dataFormatada = Utils.buildArticulacaoDateKey(data.diasAtividade, data.mesReferencia, data.anoReferencia);
      documentName = dataFormatada + "_" + unidadeSigla + "_" + cleanAtividade;
      // A data completa (e não só mês/ano) entra no escopo porque a mesma atividade pode ter
      // ocorrências em dias diferentes do mesmo mês, e todas dividem a pasta da atividade:
      // sem o dia, o relatório de uma ocorrência apagaria o da outra.
      escopoDoRelatorio = [dataFormatada, unidadeSigla, cleanAtividade];
    } else if (setorNorm === "BIBLIOTECA") {
      // Padrão Biblioteca: dataDaAtividade_siglaUnidade_nomeAtividade_nomeResponsavel
      let dataAtiv = data.dataRelatorio ? Utils.formatDateToBR(data.dataRelatorio).replace(/\//g, "-") : "DATA";
      documentName = dataAtiv + "_" + unidadeSigla + "_" + cleanAtividade + "_" + cleanResponsavel;
      // Bibliotecas registram várias atividades no mesmo mês, e todas dividem a mesma pasta da
      // atividade. Sem a data no escopo, o relatório de uma data apagaria o de outra.
      escopoDoRelatorio = [dataAtiv, unidadeSigla, cleanAtividade];
    } else if (setorNorm === "FUNDAÇÃO CASA") {
      // Padrão Fundação CASA: "RELATORIO - [razão social] - [unidade] - [mês] - [dias+horário]".
      // O trecho de dias da semana + horário ("SEG-QUA 1415-1545") é o que diferencia a 1ª da 2ª
      // turma da mesma atividade no mesmo mês — as duas dividem a MESMA pasta da atividade, só o
      // nome do arquivo muda. Por isso esse trecho também entra no escopo da limpeza: sem ele, a
      // recompilação de uma turma apagaria o relatório da outra.
      const mesExtCasa = Utils.getMonthNameExtenso(data.mesReferencia).toUpperCase();
      const razaoDisplay = Utils.sanitizeFileName(data.responsavel || "").toUpperCase();
      const centroDisplay = Utils.sanitizeFileName(data.unidade || "").toUpperCase();
      const turmaFragment = Utils.buildCasaTurmaFragment(data.diasSemana, data.horarioInicio, data.horarioTermino);

      documentName = ["RELATORIO", razaoDisplay, centroDisplay, mesExtCasa]
        .concat(turmaFragment ? [turmaFragment] : [])
        .join(" - ");
      escopoDoRelatorio = [centroDisplay, mesExtCasa, turmaFragment].filter(function(p) { return p; });
    } else {
      documentName = unidadeSigla + "_" + cleanResponsavel + "_" + cleanAtividade;
      escopoDoRelatorio = [unidadeSigla, cleanAtividade];
    }
    
    // Remove a versão anterior deste mesmo relatório (Docs+PDF) antes de gerar a nova cópia,
    // evitando arquivos duplicados quando a compilação é reenviada (ex.: retentativa manual após
    // timeout de rede). A remoção usa o escopo montado acima em vez do nome completo do arquivo,
    // porque o nome completo inclui o Responsável, que pode mudar entre o envio original e o
    // reenvio — nesse caso o arquivo antigo não seria encontrado e ficaria duplicado ao lado do novo.
    //
    // A versão anterior esvaziava a pasta "Relatório" inteira fora da Fundação CASA. Isso apagava
    // também o relatório de qualquer OUTRA atividade que tivesse sido resolvida para a mesma pasta,
    // que é o que fazia atividades de título parecido "substituírem tudo, até os arquivos".
    //
    // Na Fundação CASA a pasta de destino é a própria pasta da atividade. Como duas turmas da mesma
    // atividade dividem essa pasta, o escopo montado acima inclui o trecho de dias+horário, para a
    // limpeza da recompilação de uma turma nunca alcançar o relatório da outra.
    Utils.removeFilesMatching(targetFolder, escopoDoRelatorio);

    const templateFile = getTemplateFileConnection(data.area || data.setor);
    const copiedFile = templateFile.makeCopy(documentName, targetFolder);
    const doc = DocumentApp.openById(copiedFile.getId());
    const body = doc.getBody();
    
    const contratoVal = Utils.formatField(data.contrato || data.numeroContrato || "");
    const impactoVal = Utils.formatField(data.impactoCultural || data.impactoTerritorial || "");

    Utils.safeReplaceText(body, "\\{\\{AREA\\}\\}", data.area);
    Utils.safeReplaceText(body, "\\{\\{DIVISAO_REGIONAL\\}\\}", String(data.divisaoRegional || "").toUpperCase());
    Utils.safeReplaceText(body, "\\{\\{CENTRO_ATENDIMENTO\\}\\}", String(data.unidade || "").toUpperCase());
    Utils.safeReplaceText(body, "\\{\\{UNIDADE\\}\\}", String(data.unidade || "").toUpperCase());
    Utils.safeReplaceText(body, "\\{\\{CONTRATO\\}\\}", contratoVal);
    Utils.safeReplaceText(body, "\\{\\{NUMERO_CONTRATO\\}\\}", contratoVal);
    Utils.safeReplaceText(body, "\\{\\{META_REFERENCIA\\}\\}", data.metaReferencia);
    Utils.safeReplaceText(body, "\\{\\{TIPO_PEDAGOGICO\\}\\}", data.tipoPedagogico);
    Utils.safeReplaceText(body, "\\{\\{ATIVIDADE\\}\\}", String(data.atividade || "").toUpperCase());
    Utils.safeReplaceText(body, "\\{\\{ANO_REFERENCIA\\}\\}", data.anoReferencia);
    Utils.safeReplaceText(body, "\\{\\{MES_REFERENCIA\\}\\}", data.mesReferencia);
    Utils.safeReplaceText(body, "\\{\\{DIAS_ATIVIDADE\\}\\}", data.diasAtividade);
    // Fundação CASA: dias da semana e horário da turma. Genérico: sem efeito nos templates que não
    // tiverem as marcações.
    Utils.safeReplaceText(body, "\\{\\{DIAS_SEMANA\\}\\}", data.diasSemana);
    Utils.safeReplaceText(body, "\\{\\{HORARIO\\}\\}", data.horarioAtividade || Utils.formatHorarioExtenso(data.horarioInicio, data.horarioTermino));
    Utils.safeReplaceText(body, "\\{\\{RESPONSAVEL\\}\\}", String(data.responsavel || "").toUpperCase());
    Utils.safeReplaceText(body, "\\{\\{RAZAO_SOCIAL\\}\\}", String(data.responsavel || "").toUpperCase());
    // Pedagógico, Articulação e Difusão e Bibliotecas: tags independentes para Responsável pelo
    // Preenchimento x Responsável pela Execução (quando "Sim" no formulário, ambos os valores
    // chegam iguais). Genérico: fica sem efeito nos templates que não tiverem essas marcações.
    Utils.safeReplaceText(body, "\\{\\{RESPONSAVEL_EXECUCAO\\}\\}", String(data.responsavel || "").toUpperCase());
    Utils.safeReplaceText(body, "\\{\\{RESPONSAVEL_PREENCHIMENTO\\}\\}", String(data.responsavelPreenchimento || "").toUpperCase());
    Utils.safeReplaceText(body, "\\{\\{HORARIO_INICIO\\}\\}", data.horarioInicio);
    Utils.safeReplaceText(body, "\\{\\{HORARIO_TERMINO\\}\\}", data.horarioTermino);
    Utils.safeReplaceText(body, "\\{\\{ENCONTROS_PREVISTOS\\}\\}", data.encontrosPrevistos);
    Utils.safeReplaceText(body, "\\{\\{ENCONTROS_REALIZADOS\\}\\}", data.encontrosRealizados);
    Utils.safeReplaceText(body, "\\{\\{CARGA_HORARIA_PREVISTA\\}\\}", data.cargaHorariaPrevista);
    Utils.safeReplaceText(body, "\\{\\{CARGA_HORARIA_REALIZADA\\}\\}", data.cargaHorariaRealizada);
    Utils.safeReplaceText(body, "\\{\\{CARGA_HORARIA_TOTAL\\}\\}", data.cargaHorariaTotal);
    Utils.safeReplaceText(body, "\\{\\{NUMERO_SESSOES\\}\\}", data.numSessoes);
    Utils.safeReplaceText(body, "\\{\\{NUM_SESSOES\\}\\}", data.numSessoes);
    
    const dateRelatorioFormatted = data.dataRelatorio ? Utils.formatDateToBR(data.dataRelatorio) : "";
    Utils.safeReplaceText(body, "\\{\\{DATA_RELATORIO\\}\\}", dateRelatorioFormatted);
    
    let diaVal = "";
    let mesVal = Utils.formatField(data.mesReferencia);
    let anoVal = Utils.formatField(data.anoReferencia);
    
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
    
    Utils.safeReplaceText(body, "\\{\\{DIA\\}\\}", diaVal);
    Utils.safeReplaceText(body, "\\{\\{DIA_RELATORIO\\}\\}", diaVal);
    Utils.safeReplaceText(body, "\\{\\{MES\\}\\}", mesVal);
    Utils.safeReplaceText(body, "\\{\\{MES_RELATORIO\\}\\}", mesVal);
    Utils.safeReplaceText(body, "\\{\\{ANO\\}\\}", anoVal);
    Utils.safeReplaceText(body, "\\{\\{ANO_RELATORIO\\}\\}", anoVal);

    const dateFormatted = data.dataReposicao ? Utils.formatDateToBR(data.dataReposicao) : "";
    Utils.safeReplaceText(body, "\\{\\{DATA_REPOSICAO\\}\\}", dateFormatted);
    
    Utils.safeReplaceText(body, "\\{\\{PUBLICO_TOTAL\\}\\}", data.publicoTotal);
    Utils.safeReplaceText(body, "\\{\\{PUBLICO_SESSAO\\}\\}", data.publicoSessao);
    Utils.safeReplaceText(body, "\\{\\{PERFIL_PUBLICO\\}\\}", data.perfilPublico);
    Utils.safeReplaceText(body, "\\{\\{FAIXA_ETARIA\\}\\}", data.faixaEtaria);
    Utils.safeReplaceText(body, "\\{\\{DESTAQUE_ACAO\\}\\}", data.destaqueAcao);
    Utils.safeReplaceText(body, "\\{\\{OBJETIVOS\\}\\}", data.objetivos);
    Utils.safeReplaceText(body, "\\{\\{IMPACTO_CULTURAL\\}\\}", impactoVal);
    Utils.safeReplaceText(body, "\\{\\{IMPACTO_TERRITORIAL\\}\\}", impactoVal);
    Utils.safeReplaceText(body, "\\{\\{LINGUAGEM_ARTISTICA\\}\\}", data.linguagemArtistica);
    Utils.safeReplaceText(body, "\\{\\{INCLUSAO_DIVERSIDADE\\}\\}", data.inclusaoDiversidade);
    Utils.safeReplaceText(body, "\\{\\{EFEMERIDE\\}\\}", data.efemeride);
    Utils.safeReplaceText(body, "\\{\\{RELATO\\}\\}", data.relato);
    Utils.safeReplaceText(body, "\\{\\{DESCRICAO_METODOLOGIA\\}\\}", data.descricaoMetodologia);
    Utils.safeReplaceText(body, "\\{\\{ENGAJAMENTO_PARTICIPACAO\\}\\}", data.engajamentoParticipacao);
    Utils.safeReplaceText(body, "\\{\\{PONTOS_FORTES\\}\\}", data.pontosFortes);
    Utils.safeReplaceText(body, "\\{\\{PONTOS_FRACOS\\}\\}", data.pontosFracos);
    
    // Substituição dinâmica da Declaração de Responsabilidade com Carimbo de Aceite Eletrônico
    const timestampBR = Utils.getFormattedTimestampExtensoBR(new Date());
    // Pedagógico, Articulação e Difusão e Bibliotecas: a assinatura/declaração deve sempre usar
    // o Responsável pelo Preenchimento, independentemente de quem seja o Responsável pela
    // Execução. Fundação CASA continua usando o Responsável padrão, sem alteração de comportamento.
    let responsavelNome = Utils.formatField(data.responsavel).toUpperCase();
    if (Utils.usesResponsavelPreenchimento(setorNorm) && data.responsavelPreenchimento) {
      responsavelNome = Utils.formatField(data.responsavelPreenchimento).toUpperCase();
    }

    let declaracaoTexto = "";
    if (setorNorm === "FUNDAÇÃO CASA") {
      declaracaoTexto = "DECLARAÇÃO DE RESPONSABILIDADE E CONFORMIDADE INSTITUCIONAL\n\n" +
        "1. Declaração de Conformidade com o ECA, Proteção de Imagem e Normas Internas:\n\n" +
        "Declaro que executei as atividades em conformidade com o Estatuto da Criança e do Adolescente (Lei nº 8.069/1990), observando integralmente as normas de segurança, disciplina, acesso e funcionamento da unidade da Fundação CASA, bem como as orientações da CONTRATANTE, não tendo praticado qualquer conduta incompatível com as regras institucionais.\n\n" +
        "Declaro que não captei, registrei, reproduzi, divulguei, compartilhei ou utilizei imagens, vídeos, áudios, dados pessoais ou quaisquer informações que permitam identificar adolescentes atendidos durante a execução das atividades, salvo quando previamente autorizado, por escrito, pela CONTRATANTE e/ou pela Fundação CASA, quando aplicável.\n\n" +
        "Declaro que todos os produtos, obras, materiais, registros ou demais itens produzidos durante a execução das atividades permaneceram integralmente na unidade da Fundação CASA onde foram desenvolvidos, não tendo sido retirados, cedidos, comercializados ou destinados a finalidade diversa daquela prevista contratualmente.\n\n" +
        "Declaro que tenho ciência das obrigações previstas nas cláusulas contratuais relativas à proteção de crianças e adolescentes, ao sigilo das informações, ao uso de imagem, à preservação dos materiais produzidos e às normas internas da Fundação CASA, afirmando que atuei em conformidade com tais disposições durante todo o período de execução dos serviços.\n\n" +
        "2. Declaração de Veracidade e Prestação de Contas:\n\n" +
        "Declaro que as informações e evidências apresentadas neste relatório correspondem às atividades efetivamente realizadas no período indicado e estão aptas a subsidiar o acompanhamento institucional e a prestação de contas.\n\n" +
        "[☑] TERMOS LIDOS E ACEITOS ELETRONICAMENTE NO ATO DO ENVIO\n" +
        "Declarante / Responsável: " + responsavelNome + "\n" +
        "Data/Hora do Registro: " + timestampBR + " (Horário Oficial de Brasília)";
    } else {
      declaracaoTexto = "DECLARAÇÃO DE RESPONSABILIDADE E CONFORMIDADE INSTITUCIONAL\n\n" +
        "Declaro que as informações e evidências apresentadas neste relatório correspondem às atividades efetivamente realizadas no período indicado e estão aptas a subsidiar o acompanhamento institucional e a prestação de contas.\n\n" +
        "[☑] TERMO LIDO E ACEITO ELETRONICAMENTE NO ATO DO ENVIO\n" +
        "Declarante / Responsável: " + responsavelNome + "\n" +
        "Data/Hora do Registro: " + timestampBR + " (Horário Oficial de Brasília)";
    }
    
    Utils.safeReplaceText(body, "\\{\\{DECLARACAO_RESPONSABILIDADE\\}\\}", declaracaoTexto);
    Utils.safeReplaceText(body, "\\{\\{DECLARACAO\\}\\}", declaracaoTexto);
    Utils.safeReplaceText(body, "\\{\\{TERMOS\\}\\}", declaracaoTexto);

    // Aplica negrito exclusivamente nos títulos e rótulos
    setBoldForRange(body, "DECLARAÇÃO DE RESPONSABILIDADE E CONFORMIDADE INSTITUCIONAL");
    setBoldForRange(body, "1. Declaração de Conformidade com o ECA, Proteção de Imagem e Normas Internas:");
    setBoldForRange(body, "2. Declaração de Veracidade e Prestação de Contas:");
    setBoldForRange(body, "\\[☑\\] TERMOS LIDOS E ACEITOS ELETRONICAMENTE NO ATO DO ENVIO");
    setBoldForRange(body, "\\[☑\\] TERMO LIDO E ACEITO ELETRONICAMENTE NO ATO DO ENVIO");
    setBoldForRange(body, "Declarante / Responsável:");
    setBoldForRange(body, "Data/Hora do Registro:");
    
    let position = body.findText("\\{\\{ANEXOS\\}\\}") || 
                   body.findText("\\{\\{PLANO_DE_ATIVIDADES\\}\\}") || 
                   body.findText("\\{\\{PLANO\\}\\}") || 
                   body.findText("\\{\\{TABELA\\}\\}") || 
                   body.findText("\\{\\{ENCONTROS\\}\\}");
    
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
      
      if (setorNorm === "FUNDAÇÃO CASA") {
        // Monta a Tabela Dinâmica do Plano de Atividades no Google Docs
        parentParagraph.setText("Plano de Atividades do Período:");
        if (data.planoTabela && Array.isArray(data.planoTabela) && data.planoTabela.length > 0) {
          try {
            const attachIndex = body.getChildIndex(parentParagraph);
            const table = body.insertTable(attachIndex + 1);
            table.setBorderWidth(1);
            table.setBorderColor("#C084FC");

            // Cabeçalho da Tabela
            const headerRow = table.appendTableRow();
            headerRow.appendTableCell("DATA");
            headerRow.appendTableCell("UNIDADE");
            headerRow.appendTableCell("HORÁRIO");
            headerRow.appendTableCell("DESCRIÇÃO DAS ATIVIDADES");

            // Remove a linha vazia inicial gerada automaticamente pelo DocumentApp
            if (table.getNumRows() > 1) {
              table.removeRow(0);
            }

            for (let i = 0; i < 4; i++) {
              const cell = headerRow.getCell(i);
              cell.setBackgroundColor("#E9D5FF");
              cell.setPaddingTop(8).setPaddingBottom(8).setPaddingLeft(8).setPaddingRight(8);
              const p = cell.getChild(0).asParagraph();
              p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
              const text = p.editAsText();
              text.setForegroundColor("#1E1B4B");
              text.setBold(true);
              text.setFontSize(10);
            }

            // Define larguras proporcionais
            try {
              table.setColumnWidth(0, 75);  // DATA
              table.setColumnWidth(1, 95);  // UNIDADE
              table.setColumnWidth(2, 105); // HORÁRIO
              table.setColumnWidth(3, 193); // DESCRIÇÃO DAS ATIVIDADES
            } catch (wErr) {
              Logger.log("Aviso de largura de colunas: " + wErr.toString());
            }

            const unidadeFinal = data.unidade || data.centroAtendimento || "Unidade CASA";

            // Preenche as linhas de conteúdo da tabela
            data.planoTabela.forEach((item, rIdx) => {
              const row = table.appendTableRow();
              row.appendTableCell(item.data || "---");
              row.appendTableCell(item.unidade || unidadeFinal);
              row.appendTableCell(item.horario || "---");
              row.appendTableCell(item.descricao || "---");

              const c0 = row.getCell(0);
              const c1 = row.getCell(1);
              const c2 = row.getCell(2);
              const c3 = row.getCell(3);

              c0.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
              c1.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
              c2.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);

              const rowBg = (rIdx % 2 === 0) ? "#FFFFFF" : "#FAF5FF";
              [c0, c1, c2, c3].forEach(cell => {
                cell.setBackgroundColor(rowBg);
                cell.setPaddingTop(6).setPaddingBottom(6).setPaddingLeft(8).setPaddingRight(8);
                const txt = cell.getChild(0).asParagraph().editAsText();
                txt.setForegroundColor("#1E293B");
                txt.setFontSize(9.5);
              });
            });
          } catch (tabErr) {
            Logger.log("Erro ao criar Tabela do Plano no Doc: " + tabErr.toString());
          }
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

        // Só recorre às fotos já gravadas no Drive quando o payload da Etapa 2 não trouxe nenhuma
        // imagem em Base64. A condição era avaliada a cada iteração ("imageBlobs.length === 0"),
        // então, após a primeira foto entrar na lista, ela passava a ser falsa e as demais fotos da
        // pasta eram ignoradas — o relatório saía com uma única imagem em vez das 3 a 5 enviadas.
        const usouImagensDoPayload = imageBlobs.length > 0;

        if (registroFolder) {
          try {
            const driveFiles = registroFolder.getFiles();
            while (driveFiles.hasNext()) {
              const file = driveFiles.next();
              const mimeType = file.getMimeType();
              if (mimeType && mimeType.startsWith("video/")) {
                hasVideo = true;
              } else if (!usouImagensDoPayload && mimeType && mimeType.startsWith("image/")) {
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
                cell.setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(4).setPaddingRight(4);
                if (imgIdx < imageBlobs.length) {
                  const p = cell.getChild(0).asParagraph();
                  p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
                  const img = p.appendInlineImage(imageBlobs[imgIdx]);
                  
                  const origWidth = img.getWidth() || 1;
                  const origHeight = img.getHeight() || 1;
                  const targetWidth = 210;
                  const maxHeight = 160;
                  
                  let newWidth = targetWidth;
                  let newHeight = (targetWidth / origWidth) * origHeight;
                  
                  if (newHeight > maxHeight) {
                    newWidth = (maxHeight / origHeight) * origWidth;
                    newHeight = maxHeight;
                  }
                  
                  img.setWidth(Math.round(newWidth));
                  img.setHeight(Math.round(newHeight));
                  imgIdx++;
                }
              }
            }

            // Remove a linha vazia inicial gerada automaticamente pelo DocumentApp
            if (table.getNumRows() > tableRows) {
              table.removeRow(0);
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
    // Aguarda a propagação do save do Google Docs antes de exportar o PDF: o getAs("application/pdf")
    // logo abaixo pode ler uma versão desatualizada do documento (sem as últimas substituições/imagens)
    // se executado imediatamente após saveAndClose(), devido à latência de sincronização do Docs.
    Utilities.sleep(1500);

    const pdfFileName = documentName + ".pdf";
    // A limpeza por atividade feita acima já removeu o PDF da versão anterior; esta remoção pelo
    // nome exato cobre o caso de um PDF homônimo criado nesta mesma execução.
    Utils.removeExistingFilesByName(targetFolder, pdfFileName);

    const pdfBlob = copiedFile.getAs("application/pdf");
    pdfBlob.setName(pdfFileName);
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

function setBoldForRange(body, textPattern) {
  try {
    let found = body.findText(textPattern);
    while (found) {
      const textElement = found.getElement().asText();
      const start = found.getStartOffset();
      const endInclusive = found.getEndOffsetInclusive();
      textElement.setBold(start, endInclusive, true);
      found = body.findText(textPattern, found);
    }
  } catch (err) {
    Logger.log("Erro ao aplicar negrito parcial: " + err.toString());
  }
}
