/**
 * RECONCILIAÇÃO MANUAL DE RELATÓRIOS PENDENTES
 *
 * O envio é feito em 2 etapas (2 requisições HTTP separadas do navegador):
 *   Etapa 1 (submitForm) grava a linha na planilha + cria pastas + sobe fotos.
 *   Etapa 2 (generatePdfReportAsync) compila o Google Docs e exporta o PDF.
 *
 * Se a Etapa 2 falhar ou nunca chegar (oscilação de rede, recarregamento da página, resposta
 * transitória do Google), a linha fica gravada SEM relatório e não há aviso automático.
 *
 * Esta rotina é o conserto: rodada MANUALMENTE no editor do Apps Script quando o erro
 * "generatePdfReportAsync ... ausente ou inválido" aparecer no _LOGS. Ela varre as abas de
 * respostas, remonta os dados da linha, e compila o relatório que ficou faltando. É idempotente:
 * linha que já tem relatório na pasta é pulada.
 *
 * COMO USAR:
 *   1. Ajuste RECONCILIACAO_CONFIG abaixo (área, janela de dias, ou uma linha específica).
 *   2. Rode a função reconciliarRelatoriosPendentes.
 *   3. Confira o resumo no Logger e o registro no _LOGS da planilha.
 */

var RECONCILIACAO_CONFIG = {
  // "" = todas as áreas | "Pedagógico" | "Articulação e Difusão" | "Fundação Casa" | "Biblioteca"
  AREA: "",
  // > 0: mira SÓ essa linha da aba (exige AREA preenchida). 0: varre a janela de dias abaixo.
  LINHA: 0,
  // Só olha linhas cujo Carimbo de Data/Hora esteja dentro desta janela (evita varrer o histórico
  // inteiro). Ignorado quando LINHA > 0.
  DIAS_PARA_TRAS: 3,
  // true: apenas lista o que faria, sem compilar nada.
  DRY_RUN: false
};

var RECON_AREAS_PADRAO = ["Pedagógico", "Articulação e Difusão", "Fundação Casa", "Biblioteca"];

// Cabeçalho canônico da planilha -> chave do formData que generateDocumentAndPdf espera.
var RECON_MAPA_BASE = {
  "Unidade": "unidade",
  "Centro de Atendimento (Unidade)": "unidade",
  "Número do Contrato": "numeroContrato",
  "Meta de Referência": "metaReferencia",
  "Nome da Atividade": "atividade",
  "Ano de Referência": "anoReferencia",
  "Mês de Referência": "mesReferencia",
  "Responsável pela Execução": "responsavel",
  "Razão Social (Responsável)": "responsavel",
  "Responsável pelo Preenchimento": "responsavelPreenchimento",
  "Encontros Previstos": "encontrosPrevistos",
  "Encontros Realizados": "encontrosRealizados",
  "Carga Horária Prevista": "cargaHorariaPrevista",
  "Carga Horária Realizada": "cargaHorariaRealizada",
  "Data de Eventual Reposição": "dataReposicao",
  "Público Total": "publicoTotal",
  "Perfil do Público": "perfilPublico",
  "Faixa Etária Predominante": "faixaEtaria",
  "Destaque da Ação": "destaqueAcao",
  "Objetivos da Atividade": "objetivos",
  "Impacto Territorial / Cultural": "impactoCultural",
  "Descrição das Ações e Metodologia": "descricaoMetodologia",
  "Engajamento e Participação": "engajamentoParticipacao",
  "Pontos Fortes": "pontosFortes",
  "Pontos Fracos e Desafios": "pontosFracos"
};

var RECON_MAPA_POR_AREA = {
  "PEDAGÓGICO": {
    "Tipo (Trilha/Ateliê/Núcleo)": "tipoPedagogico"
  },
  "ARTICULAÇÃO E DIFUSÃO": {
    "Dia(s) do Mês": "diasAtividade",
    "Horário de Início": "horarioInicio",
    "Horário de Término": "horarioTermino",
    "Carga Horária Total": "cargaHorariaTotal",
    "Número de Sessões": "numSessoes",
    "Público por Sessão": "publicoSessao",
    "Linguagem Artística": "linguagemArtistica",
    "Inclusão e Diversidade": "inclusaoDiversidade",
    "Efeméride": "efemeride",
    "Relato": "relato"
  },
  "FUNDAÇÃO CASA": {
    "Divisão Regional": "divisaoRegional",
    "Dias da Semana": "diasSemana",
    "Horário": "horarioAtividade",
    "Plano de Atividades (JSON)": "__planoJson"
  },
  "BIBLIOTECA": {
    "Data da Atividade": "dataRelatorio",
    "Horário de Início": "horarioInicio",
    "Horário de Término": "horarioTermino"
  }
};

function reconciliarRelatoriosPendentes() {
  var cfg = RECONCILIACAO_CONFIG;
  var resumo = { modo: cfg.DRY_RUN ? "DRY_RUN" : "COMPILAR", escaneadas: 0, jaComRelatorio: 0, compiladas: 0, semDados: 0, falhas: 0, detalhes: [] };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(60000);
  } catch (e) {
    Logger.log("Reconciliação: outra execução (ou um envio) está com o lock. Tente de novo em instantes.");
    return resumo;
  }

  try {
    var areas = cfg.AREA ? [cfg.AREA] : RECON_AREAS_PADRAO;
    if (cfg.LINHA > 0 && !cfg.AREA) {
      Logger.log("Reconciliação: LINHA > 0 exige AREA preenchida em RECONCILIACAO_CONFIG.");
      return resumo;
    }
    var limiteData = new Date(Date.now() - (cfg.DIAS_PARA_TRAS * 24 * 60 * 60 * 1000));

    for (var a = 0; a < areas.length; a++) {
      try {
        reconciliarArea_(areas[a], cfg, limiteData, resumo);
      } catch (errArea) {
        resumo.falhas++;
        resumo.detalhes.push("[" + areas[a] + "] ERRO NA ÁREA: " + errArea);
      }
    }
  } finally {
    lock.releaseLock();
  }

  var txt = "Reconciliação concluída.\n" + JSON.stringify(resumo, null, 2);
  Logger.log(txt);
  try { Utils.logInfo("Reconciliacao.reconciliarRelatoriosPendentes", txt); } catch (e) {}
  return resumo;
}

function reconciliarArea_(area, cfg, limiteData, resumo) {
  var ss = getResponsesSpreadsheetConnection(area);
  var config = getSheetConfigForArea(area);
  var sheet = ss.getSheetByName(config.sheetName);
  if (!sheet || sheet.getLastRow() < 2) return;

  var layout = readHeaderLayout(sheet);
  var idxCarimbo = layout.index[normalizeHeaderKey("Carimbo de Data/Hora")];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (var i = 0; i < values.length; i++) {
    var rowNumber = i + 2;
    if (cfg.LINHA > 0 && rowNumber !== cfg.LINHA) continue;

    var row = values[i];

    if (cfg.LINHA === 0 && idxCarimbo !== undefined) {
      var carimbo = reconParseCarimbo_(row[idxCarimbo]);
      if (carimbo && carimbo < limiteData) continue;
    }

    resumo.escaneadas++;

    var formData;
    try {
      formData = reconstruirFormDataDaLinha_(layout, row, area);
    } catch (e) {
      resumo.semDados++;
      resumo.detalhes.push("[" + area + " L" + rowNumber + "] sem dados suficientes: " + e);
      continue;
    }

    if (!formData.unidade || !formData.atividade) {
      resumo.semDados++;
      resumo.detalhes.push("[" + area + " L" + rowNumber + "] linha sem Unidade/Atividade — ignorada");
      continue;
    }

    var folders;
    try {
      folders = getOrCreateFolderStructure(
        formData.setor, formData.dataRelatorio, formData.unidade, formData.atividade,
        formData.tipoPedagogico, formData.divisaoRegional, formData.responsavel,
        formData.mesReferencia, formData.anoReferencia, formData.diasAtividade
      );
    } catch (e) {
      resumo.falhas++;
      resumo.detalhes.push("[" + area + " L" + rowNumber + "] falha ao resolver pastas: " + e);
      continue;
    }

    var relatorioFolder = folders.relatorioFolder || folders.activityFolder;
    var registroFolderId = folders.registroFolder ? folders.registroFolder.getId() : null;

    if (relatorioFolder && reconRelatorioJaExiste_(relatorioFolder, formData)) {
      resumo.jaComRelatorio++;
      resumo.detalhes.push("[" + area + " L" + rowNumber + "] OK — relatório já está na pasta (" + formData.atividade + ")");
      continue;
    }

    if (cfg.DRY_RUN) {
      resumo.compiladas++;
      resumo.detalhes.push("[" + area + " L" + rowNumber + "] PENDENTE — compilaria: " + formData.atividade + " / " + formData.unidade);
      continue;
    }

    try {
      var urls = generateDocumentAndPdf(formData, relatorioFolder, registroFolderId);
      resumo.compiladas++;
      resumo.detalhes.push("[" + area + " L" + rowNumber + "] COMPILADO: " + (urls.pdfUrl || urls.docUrl || "sem URL"));
    } catch (e) {
      resumo.falhas++;
      resumo.detalhes.push("[" + area + " L" + rowNumber + "] FALHA ao compilar: " + e);
    }
  }
}

/**
 * Remonta o objeto formData a partir de uma linha da planilha, no formato que
 * generateDocumentAndPdf espera. As fotos não são reconstruídas: elas já estão no Drive e são
 * lidas da pasta de Registro Fotográfico pelo próprio generateDocumentAndPdf.
 */
function reconstruirFormDataDaLinha_(layout, row, area) {
  var areaNorm = Utils.normalizeAreaName(area);
  var mapa = {};
  var k;
  for (k in RECON_MAPA_BASE) { if (Object.prototype.hasOwnProperty.call(RECON_MAPA_BASE, k)) mapa[k] = RECON_MAPA_BASE[k]; }
  var extra = RECON_MAPA_POR_AREA[areaNorm] || {};
  for (k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) mapa[k] = extra[k]; }

  var fd = { area: areaNorm, setor: areaNorm, files: [] };

  for (var header in mapa) {
    if (!Object.prototype.hasOwnProperty.call(mapa, header)) continue;
    var idx = layout.index[normalizeHeaderKey(header)];
    if (idx === undefined) continue;
    var chave = mapa[header];
    var valor = row[idx];
    var vazio = (fd[chave] === undefined || fd[chave] === null || fd[chave] === "");
    if (vazio && valor !== undefined && valor !== null && valor !== "") {
      fd[chave] = valor;
    }
  }

  fd.contrato = fd.numeroContrato || fd.contrato || "";
  fd.numeroContrato = fd.contrato;
  fd.impactoTerritorial = fd.impactoCultural || "";

  if (areaNorm === "FUNDAÇÃO CASA") {
    if (fd.__planoJson) {
      try {
        var parsed = JSON.parse(fd.__planoJson);
        fd.planoTabela = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        fd.planoTabela = [];
      }
    }
    delete fd.__planoJson;

    var partes = String(fd.horarioAtividade || "")
      .split(new RegExp("\\s*(?:\u00e0s|as|-|\u2013|\u2014)\\s*", "i"))
      .filter(function (p) { return p.trim() !== ""; });
    fd.horarioInicio = Utils.normalizeTime(partes[0] || "");
    fd.horarioTermino = Utils.normalizeTime(partes[1] || "");
  }

  // Consolida a chave/identidade exatamente como no envio (dataRelatorio, atividade em MAIÚSCULAS
  // fora do Pedagógico, dias/horário da CASA).
  normalizeSubmissionKey(fd);
  return fd;
}

/**
 * Confere se a pasta de destino já contém o relatório desta linha, usando o mesmo escopo de nome
 * que generateDocumentAndPdf usa para limpar a versão anterior (montarNomeEEscopoRelatorio_).
 */
function reconRelatorioJaExiste_(folder, formData) {
  var escopo = montarNomeEEscopoRelatorio_(formData).escopoDoRelatorio
    .map(function (t) { return Utils.normalizeFolderKey(t); })
    .filter(function (t) { return t !== ""; });
  if (escopo.length === 0) return false;

  var files = folder.getFiles();
  while (files.hasNext()) {
    var nome = Utils.normalizeFolderKey(files.next().getName());
    var casaTudo = escopo.every(function (t) { return nome.indexOf(t) !== -1; });
    if (casaTudo) return true;
  }
  return false;
}

function reconParseCarimbo_(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  var s = String(v).trim();
  var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T]+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10),
      parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6] || "0", 10));
  }
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
