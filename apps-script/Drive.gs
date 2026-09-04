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
  // A chave do cache precisa distinguir nomes que diferem só por pontuação: sanitizeCacheKey
  // troca todo caractere especial por "_", então "OFICINA - TEATRO" e "OFICINA _ TEATRO" gerariam
  // a MESMA chave e a segunda atividade receberia a pasta da primeira vinda do cache. O prefixo
  // de comprimento abaixo mantém a chave estável e ASCII sem permitir essa colisão.
  const folderKey = Utils.normalizeFolderKey(folderName);
  const rawKey = "folder_id_" + parentFolder.getId() + "_" + folderKey.length + "_" + folderKey;
  const cacheKey = Utils.sanitizeCacheKey(rawKey);
  const cache = CacheService.getScriptCache();
  const cachedId = cache.get(cacheKey);

  if (cachedId) {
    try {
      const cachedFolder = DriveApp.getFolderById(cachedId);

      // A pasta em cache só é confiável se (1) o nome ainda confere E (2) ela AINDA é filha da
      // parentFolder esperada. Sem a checagem de parentesco, uma entrada cujo alvo foi movido
      // para fora da árvore — ou criado solto na conta que executa o script — redireciona em
      // silêncio TODOS os envios daquela ramificação para o lugar errado, e o desvio persiste
      // pelas 6h de vida do cache. Foi exatamente o que aconteceu com a unidade Capão.
      const nomeConfere = Utils.normalizeFolderKey(cachedFolder.getName()) === folderKey;

      let filhaDaParent = false;
      if (nomeConfere) {
        const pais = cachedFolder.getParents();
        while (pais.hasNext()) {
          if (pais.next().getId() === parentFolder.getId()) {
            filhaDaParent = true;
            break;
          }
        }
      }

      if (nomeConfere && filhaDaParent) {
        return cachedFolder;
      }

      // Entrada furada: descarta agora em vez de esperar expirar, e segue para a resolução normal.
      Logger.log("Pasta em cache descartada (nome ou parentesco não confere): " + folderName);
      cache.remove(cacheKey);
    } catch (e) {
      Logger.log("Pasta em cache expirou ou foi deletada: " + folderName);
    }
  }

  const folders = parentFolder.getFoldersByName(folderName);
  let targetFolder = folders.hasNext() ? folders.next() : null;

  // Busca tolerante a acentuação, caixa e à troca de espaço por underscore, quando o nome exato
  // não é achado — o suficiente para reaproveitar pastas criadas antes da padronização de nomes.
  //
  // A normalização usada NÃO descarta hífens, parênteses e dígitos. A versão anterior removia todo
  // caractere não alfanumérico, o que fazia atividades distintas de título parecido (ex.:
  // "OFICINA - TEATRO" e "OFICINA TEATRO") resolverem para a MESMA pasta, e então o envio de uma
  // sobrescrevia as evidências e o relatório da outra.
  if (!targetFolder) {
    const subFolders = parentFolder.getFolders();
    while (subFolders.hasNext()) {
      const sf = subFolders.next();
      if (Utils.normalizeFolderKey(sf.getName()) === folderKey) {
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

/**
 * Prefixo de data usado no nome da pasta da atividade e no nome de cada foto.
 *
 * Só as áreas cuja pasta pode receber mais de uma ocorrência da mesma atividade no mês recebem
 * prefixo: Bibliotecas (pela Data da Atividade) e Articulação e Difusão (pelo primeiro dia
 * selecionado no calendário). Devolve "" para as demais, que seguem com o nome de sempre.
 *
 * @return {string} Data em DD-MM-AAAA, ou "" quando a área não usa prefixo
 */
function getActivityDatePrefix(setorNorm, dataRelatorio, mesReferencia, anoReferencia, diasAtividade) {
  if (setorNorm === "BIBLIOTECA") {
    return Utils.getDateFolderPrefix(dataRelatorio);
  }
  if (setorNorm === "ARTICULAÇÃO E DIFUSÃO") {
    return Utils.buildArticulacaoDateKey(diasAtividade, mesReferencia, anoReferencia);
  }
  return "";
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

function getOrCreateFolderStructure(setor, dataRelatorio, unidade, atividade, tipoPedagogico, divisaoRegional, responsavel, mesReferencia, anoReferencia, diasAtividade) {
  // Duas submissões simultâneas para a mesma atividade (ex.: duplo envio quase ao mesmo tempo)
  // podem cada uma checar "a subpasta já existe?" antes de qualquer uma delas terminar de criá-la,
  // resultando em pastas duplicadas ("Registro Fotográfico", "Relatório" etc.) para a mesma
  // atividade. O LockService serializa essa resolução de pastas entre chamadas concorrentes.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    throw new Error("O sistema está processando outro envio no momento. Aguarde alguns segundos e tente novamente.");
  }

  try {
    const rootFolder = getRootFolderConnection();
    const fabricasFolder = getOrCreateSubFolder(rootFolder, "Fábricas de Cultura");

    let anoStr = anoReferencia ? String(anoReferencia).trim() : "";
    let mesNum = mesReferencia ? String(mesReferencia).trim() : "";

    // dataRelatorio chega como STRING no envio normal do formulário, mas como objeto Date quando a
    // reconciliação a remonta lendo a célula da planilha. Delegar para Utils.formatDateToBR (que já
    // trata os dois casos, incluindo timezone) em vez de fazer split manual aqui evita duplicar essa
    // lógica — e evita quebrar silenciosamente: um split direto num Date cai no formato do
    // Date.toString() ("Thu Aug 27 2026..."), nenhuma das duas pontas bate com 4 dígitos, e o mês/ano
    // "extraído" fica vazio. Sem isso, a linha abaixo usava a data de HOJE como recuo, jogando a
    // atividade para o mês da execução da reconciliação em vez do mês em que ela realmente ocorreu.
    if (!anoStr || !mesNum) {
      if (dataRelatorio) {
        const dataFormatadaBR = Utils.formatDateToBR(dataRelatorio);
        const partesData = typeof dataFormatadaBR === "string" ? dataFormatadaBR.split("/") : [];
        if (partesData.length === 3) {
          mesNum = mesNum || partesData[1];
          anoStr = anoStr || partesData[2];
        }
      }
    }

    if (!anoStr) anoStr = new Date().getFullYear().toString();
    if (!mesNum) mesNum = (new Date().getMonth() + 1).toString().padStart(2, "0");
    if (mesNum.length === 1) mesNum = "0" + mesNum;

    let mesStr = getFormattedMonthName(mesNum);

    const setorNorm = Utils.normalizeAreaName(setor);
    const areaFolderName = Utils.getAreaFolderName(setor);

    // Bibliotecas e Articulação: a data entra no nome da pasta da atividade. Nessas duas áreas a
    // mesma atividade pode ocorrer em dias diferentes do mesmo mês, e a hierarquia de pastas vai
    // só até o mês — sem a data no nome, as ocorrências compartilhariam a pasta e as fotos de uma
    // substituiriam as da outra. No Pedagógico e na Fundação CASA o período já é único por pasta.
    let cleanAtividadeName = Utils.buildActivityFolderName(atividade);
    const prefixoDataPasta = getActivityDatePrefix(setorNorm, dataRelatorio, mesNum, anoStr, diasAtividade);
    if (prefixoDataPasta) {
      cleanAtividadeName = prefixoDataPasta + "_" + cleanAtividadeName;
    }

    const setorFolder = getOrCreateSubFolder(fabricasFolder, areaFolderName);
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
      if (setorNorm === "PEDAGÓGICO") {
        const cleanTipo = Utils.normalizeTipoPedagogicoFolderName(tipoPedagogico);
        if (cleanTipo) {
          parentFolder = getOrCreateSubFolder(mesFolder, cleanTipo);
        }
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
  } finally {
    lock.releaseLock();
  }
}

function uploadFilesToFolder(files, targetFolder, metadata = {}) {
  try {
    if (!files || files.length === 0) {
      return 0;
    }

    const setorNorm = Utils.normalizeAreaName(metadata.setor);
    const cleanAtividade = Utils.sanitizeFileName(metadata.atividade || "").toUpperCase().replace(/\s+/g, "_");

    // Bibliotecas e Articulação: a data também prefixa o nome de cada foto, para que o arquivo
    // continue identificável fora da pasta e para que a limpeza abaixo nunca alcance o lote de
    // outra ocorrência da mesma atividade.
    const prefixoData = getActivityDatePrefix(
      setorNorm, metadata.dataAtividade, metadata.mesReferencia, metadata.anoReferencia, metadata.diasAtividade
    );

    // Remove o lote de mídias do envio anterior DESTA atividade antes de gravar o novo: garante que
    // uma retentativa manual (ex.: após timeout de rede) substitua as mídias antigas em vez de
    // duplicá-las ou deixar sobras de um lote com mais arquivos. A remoção é restrita aos arquivos
    // cujo nome carrega o nome desta atividade — antes a pasta inteira era esvaziada, o que apagava
    // as evidências de qualquer outra atividade que tivesse caído na mesma pasta.
    const escopoDasMidias = prefixoData ? [prefixoData, cleanAtividade] : [cleanAtividade];
    Utils.removeFilesMatching(targetFolder, escopoDasMidias);

    for (let i = 0; i < files.length; i++) {
      const fileData = files[i];
      let base64 = fileData.base64Data || "";
      if (base64.includes(",")) {
        base64 = base64.split(",")[1];
      }
      const bytes = Utilities.base64Decode(base64);
      const mime = fileData.mimeType || "image/jpeg";

      const parts = (fileData.name || "arquivo.jpg").split(".");
      const ext = parts.length > 1 ? parts.pop().toLowerCase() : (mime === "application/pdf" ? "pdf" : "jpg");

      // A Fundação CASA não anexa arquivos (o Plano de Atividades é digitado no formulário e vira
      // tabela direto no relatório), então esta rotina só nomeia mídias das demais áreas:
      // [SiglaUnidade]_[NomeResponsavel]_[NomeAtividade]_[Index].[ext]. Bibliotecas e Articulação
      // recebem o prefixo de data ([DD-MM-AAAA]_...), como o relatório.
      const unidadeSigla = Utils.getUnidadeSigla(metadata.unidade);
      const cleanResponsavel = Utils.sanitizeFileName(metadata.responsavel || "").toUpperCase().replace(/\s+/g, "_");
      const indexStr = (i + 1).toString().padStart(2, "0");
      const cleanFileName = (prefixoData ? prefixoData + "_" : "") +
        unidadeSigla + "_" + cleanResponsavel + "_" + cleanAtividade + "_" + indexStr + "." + ext;

      const blob = Utilities.newBlob(bytes, mime, cleanFileName);
      targetFolder.createFile(blob);
    }

    return files.length;
  } catch (error) {
    Logger.log("Erro no uploadFilesToFolder: " + error.toString());
    throw new Error("Falha ao salvar anexos no Drive: " + error.message);
  }
}
