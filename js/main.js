/**
 * GERENCIADOR PRINCIPAL DO FRONTEND (FÁBRICAS DE CULTURA)
 * Controla os formulários modulares, carregamento das listas institucionais,
 * compressão de mídia da câmera e envio de 2 etapas.
 */

let dropDownHierarchy = {};
let uploadedFiles = [];
let currentSubmittedData = null;

document.addEventListener("DOMContentLoaded", () => {
  initializeDropdowns();
  setupCalendarGrid();
  setupDragAndDrop();
  setupFormSubmission();
  setupOutroFieldsListeners();
  setupCharacterCounters();
});

/* Overlay de Carregamento Intuitivo com Barra de Progresso */
function showOverlay(message, percent = 10, title = "Processando Formulário...", isFormSubmission = false) {
  const overlay = document.getElementById("loadingOverlay");
  const msgEl = document.getElementById("overlayMessage");
  const titleEl = document.getElementById("overlayStepTitle");
  const subEl = document.getElementById("overlaySubtitle");
  const barFill = document.getElementById("loadingProgressBarFill");

  if (titleEl) titleEl.textContent = title;
  if (msgEl && message) msgEl.textContent = message;
  if (subEl) {
    if (isFormSubmission) {
      subEl.textContent = "⏱️ Este processo leva de 20 a 60 segundos para ser concluído. Por favor, aguarde e não feche nem recarregue a página.";
    } else {
      subEl.textContent = "Por favor, aguarde alguns segundos. Não feche nem recarregue esta página.";
    }
  }
  if (barFill && percent !== undefined) barFill.style.width = `${percent}%`;
  if (overlay) overlay.classList.remove("hidden");
}

function hideOverlay() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.add("hidden");
}

/* 1. CARREGAMENTO E POPULAÇÃO DE DROPDOWNS */
function initializeDropdowns() {
  showOverlay("Carregando unidades institucionais...");
  callBackendAPI("getDropdownData", {}, onDropdownDataReceived, onDropdownDataError);
}

function onDropdownDataReceived(response) {
  hideOverlay();
  const hierarchy = response && response.hierarchy ? response.hierarchy : (response || {});
  dropDownHierarchy = hierarchy;

  const unidadeSelect = document.getElementById("unidadeSelect");
  const tipoPedagogicoSelect = document.getElementById("tipoPedagogicoSelect");

  if (unidadeSelect) {
    unidadeSelect.innerHTML = '<option value="" disabled selected>Selecione a Unidade...</option>';
    
    Object.keys(hierarchy).forEach(key => {
      if (key !== "Fundação Casa") {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = key;
        unidadeSelect.appendChild(opt);
      }
    });

    unidadeSelect.addEventListener("change", updateAtividadeDropdown);
  }

  if (tipoPedagogicoSelect) {
    tipoPedagogicoSelect.addEventListener("change", updateAtividadeDropdown);
  }

  // Preenche a Divisão Regional da Fundação Casa se estiver presente
  const divisaoSelect = document.getElementById("divisaoRegionalSelect");
  if (divisaoSelect && hierarchy["Fundação Casa"]) {
    divisaoSelect.innerHTML = '<option value="" disabled selected>Selecione a Divisão Regional...</option>';
    Object.keys(hierarchy["Fundação Casa"]).forEach(dr => {
      const opt = document.createElement("option");
      opt.value = dr;
      opt.textContent = dr;
      divisaoSelect.appendChild(opt);
    });

    divisaoSelect.addEventListener("change", handleDivisaoCasaChange);
  }
}

function onDropdownDataError(errMessage) {
  hideOverlay();
  alert("Aviso de Conexão: " + errMessage);
}

function updateAtividadeDropdown() {
  const unidadeSelect = document.getElementById("unidadeSelect");
  const tipoSelect = document.getElementById("tipoPedagogicoSelect");
  const atividadeSelect = document.getElementById("atividadeSelect");

  if (!atividadeSelect) return;

  const unidade = unidadeSelect ? unidadeSelect.value : "";
  const tipo = tipoSelect ? tipoSelect.value : "";

  // Se o campo de tipo existir no formulário, exige a seleção dos dois antes de liberar a Atividade
  if (tipoSelect && (!unidade || !tipo)) {
    atividadeSelect.innerHTML = '<option value="" disabled selected>Selecione a Unidade e o Tipo primeiro...</option>';
    atividadeSelect.disabled = true;
    return;
  }

  if (!unidade) {
    atividadeSelect.innerHTML = '<option value="" disabled selected>Selecione a Unidade primeiro...</option>';
    atividadeSelect.disabled = true;
    return;
  }

  atividadeSelect.innerHTML = '<option value="" disabled selected>Selecione a Atividade...</option>';
  atividadeSelect.disabled = false;

  const rawItems = dropDownHierarchy[unidade] || [];
  let filteredItems = rawItems;

  if (tipo) {
    const tipoNorm = tipo.toLowerCase().trim();
    filteredItems = rawItems.filter(item => {
      if (typeof item === "string") return true;
      if (!item.type) return true;
      const itemTypeNorm = item.type.toLowerCase().trim();
      return itemTypeNorm.includes(tipoNorm) || tipoNorm.includes(itemTypeNorm);
    });
  }

  if (filteredItems.length === 0) {
    filteredItems = rawItems; // Fallback para exibir todos se o filtro for estrito
  }

  filteredItems.forEach(item => {
    const name = typeof item === "string" ? item : item.name;
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    atividadeSelect.appendChild(opt);
  });
}

function handleDivisaoCasaChange(e) {
  const dr = e.target.value;
  const centroSelect = document.getElementById("centroCasaSelect");
  if (!centroSelect || !dropDownHierarchy["Fundação Casa"]) return;

  centroSelect.innerHTML = '<option value="" disabled selected>Selecione o Centro de Atendimento...</option>';
  centroSelect.disabled = false;

  const centros = dropDownHierarchy["Fundação Casa"][dr] || [];
  centros.forEach(centro => {
    const opt = document.createElement("option");
    opt.value = centro;
    opt.textContent = centro;
    centroSelect.appendChild(opt);
  });
}

/* 2. CONFIGURAÇÃO DE CAMPOS "OUTRO" DINÂMICOS E CONTADORES */
function setupOutroFieldsListeners() {
  document.querySelectorAll('input[type="checkbox"][value="Outro"]').forEach(chk => {
    chk.addEventListener("change", (e) => {
      const row = e.target.closest(".checkbox-outro-row") || e.target.parentElement;
      const input = row ? row.querySelector(".input-inline-outro") : null;
      if (input) {
        input.disabled = !e.target.checked;
        if (e.target.checked) {
          input.focus();
        } else {
          input.value = "";
        }
      }
    });
  });
}

function setupCharacterCounters() {
  const fields = document.querySelectorAll("[data-min-length], [data-max-length]");
  fields.forEach(field => {
    const minLen = parseInt(field.getAttribute("data-min-length") || "0", 10);
    const maxLen = parseInt(field.getAttribute("data-max-length") || "0", 10);

    if (maxLen > 0) {
      field.setAttribute("maxlength", maxLen);
    }
    if (minLen > 0) {
      field.setAttribute("minlength", minLen);
    }

    // Cria elemento de contador abaixo do campo se não existir
    let counterEl = field.parentElement.querySelector(".char-counter");
    if (!counterEl) {
      counterEl = document.createElement("div");
      counterEl.className = "char-counter";
      field.parentElement.appendChild(counterEl);
    }

    function updateCounter() {
      const currentLen = field.value.length;
      let text = `${currentLen}`;

      if (maxLen > 0) {
        text += ` / ${maxLen}`;
      }
      text += ` caracteres`;

      const isUnderMin = minLen > 0 && currentLen < minLen;
      const isOverMax = maxLen > 0 && currentLen > maxLen;

      if (isUnderMin) {
        text += ` (Mínimo: ${minLen})`;
        counterEl.className = "char-counter invalid";
      } else if (isOverMax) {
        text += ` (Máximo: ${maxLen})`;
        counterEl.className = "char-counter invalid";
      } else {
        counterEl.className = "char-counter valid";
      }

      counterEl.textContent = text;
    }

    field.addEventListener("input", updateCounter);
    updateCounter(); // Executa inicial
  });
}

/* 3. CALENDÁRIO PARA ARTICULAÇÃO E DIFUSÃO */
function setupCalendarGrid() {
  const calendarGrid = document.getElementById("calendarGrid");
  if (!calendarGrid) return;

  calendarGrid.innerHTML = "";
  for (let i = 1; i <= 31; i++) {
    const dayBox = document.createElement("div");
    dayBox.className = "calendar-day-box";
    dayBox.dataset.day = i;

    const numSpan = document.createElement("span");
    numSpan.className = "calendar-day-number";
    numSpan.textContent = i;

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.name = "diasAtividade";
    chk.value = i;

    dayBox.appendChild(numSpan);
    dayBox.appendChild(chk);

    dayBox.addEventListener("click", () => {
      chk.checked = !chk.checked;
      dayBox.classList.toggle("selected", chk.checked);
    });

    calendarGrid.appendChild(dayBox);
  }
}

/* 4. DRAG & DROP E COMPRESSÃO DE FOTOS */
function setupDragAndDrop() {
  const dropzone = document.getElementById("fileDropzone");
  const fileInput = document.getElementById("fileInput");
  if (!dropzone || !fileInput) return;

  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  });
}

async function handleFiles(files) {
  const form = document.getElementById("reportForm");
  const isCasaForm = form && form.getAttribute("data-theme") === "fundacaocasa";
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB em bytes

  if (isCasaForm) {
    // Formulário Fundação CASA: exige exatamente 1 arquivo em PDF
    if (files.length > 1) {
      alert("Aviso: O formulário da Fundação CASA permite anexar apenas 1 arquivo em formato PDF.");
    }
    const file = files[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      alert("Formato Incompatível: Por favor, selecione um arquivo no formato PDF.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert(`Arquivo muito grande: O PDF excede o limite permitido de 15MB (Tamanho do arquivo: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      return;
    }

    showOverlay("Carregando arquivo PDF do Plano de Atividades...");
    try {
      const base64Data = await readAsBase64(file);
      uploadedFiles = [{
        name: file.name,
        size: file.size,
        mimeType: "application/pdf",
        base64Data: base64Data,
        isPdf: true
      }];
    } catch (err) {
      alert("Erro ao ler o arquivo PDF: " + err.message);
    }
    hideOverlay();
    renderPreviewGrid();

  } else {
    // Formulários das demais áreas (Pedagógico, Articulação, Biblioteca): mínimo 3, máximo 5 mídias
    if (uploadedFiles.length + files.length > 5) {
      alert(`Limite Excedido: É permitido anexar no máximo 5 mídias por envio. Você já possui ${uploadedFiles.length} arquivo(s) selecionado(s).`);
      return;
    }

    showOverlay("Otimizando e compactando mídias para envio...");
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > MAX_FILE_SIZE) {
        alert(`Arquivo Ignorado: "${file.name}" excede o limite máximo de 15MB por mídia.`);
        continue;
      }

      try {
        if (file.type.startsWith("image/")) {
          const compressed = await ImageCompressor.compressFile(file);
          uploadedFiles.push(compressed);
        } else {
          const base64Data = await readAsBase64(file);
          uploadedFiles.push({
            name: file.name,
            size: file.size,
            mimeType: file.type || "video/mp4",
            base64Data: base64Data
          });
        }
      } catch (err) {
        console.warn("Falha ao processar mídia:", file.name, err);
      }
    }
    hideOverlay();
    renderPreviewGrid();
  }
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function renderPreviewGrid() {
  const grid = document.getElementById("previewGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const form = document.getElementById("reportForm");
  const isCasaForm = form && form.getAttribute("data-theme") === "fundacaocasa";

  uploadedFiles.forEach((fileObj, idx) => {
    if (isCasaForm || fileObj.isPdf || fileObj.mimeType === "application/pdf") {
      // Exibição em formato card para PDF
      const pdfItem = document.createElement("div");
      pdfItem.className = "pdf-preview-item";

      const sizeMb = fileObj.size ? (fileObj.size / (1024 * 1024)).toFixed(2) : "PDF";

      pdfItem.innerHTML = `
        <div class="pdf-preview-icon">📄</div>
        <div class="pdf-preview-details">
          <span class="pdf-preview-name">${fileObj.name || "Plano_de_Atividades.pdf"}</span>
          <span class="pdf-preview-size">${sizeMb} MB • Documento PDF</span>
        </div>
      `;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preview-remove";
      btn.textContent = "×";
      btn.onclick = () => {
        uploadedFiles.splice(idx, 1);
        renderPreviewGrid();
      };

      pdfItem.appendChild(btn);
      grid.appendChild(pdfItem);
    } else {
      // Exibição em grade de miniaturas para imagens e vídeos
      const item = document.createElement("div");
      item.className = "preview-item";

      const img = document.createElement("img");
      img.src = fileObj.base64Data.startsWith("data:") ? fileObj.base64Data : `data:${fileObj.mimeType};base64,${fileObj.base64Data}`;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preview-remove";
      btn.textContent = "×";
      btn.onclick = () => {
        uploadedFiles.splice(idx, 1);
        renderPreviewGrid();
      };

      item.appendChild(img);
      item.appendChild(btn);
      grid.appendChild(item);
    }
  });
}

/* 5. SUBMISSÃO DE FORMULÁRIO DE 2 ETAPAS */
function setupFormSubmission() {
  const form = document.getElementById("reportForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const isCasaForm = form.getAttribute("data-theme") === "fundacaocasa";

    // Validação estrita da Seção de Evidências (Arquivos)
    if (isCasaForm) {
      if (uploadedFiles.length !== 1) {
        alert("Atenção: É obrigatório fazer o upload do Plano de Atividades em formato PDF.");
        return;
      }
    } else {
      if (uploadedFiles.length < 3) {
        alert(`Atenção: É necessário anexar no mínimo 3 fotos ou vídeos como evidência da atividade (atualmente você anexou ${uploadedFiles.length}).`);
        return;
      }
      if (uploadedFiles.length > 5) {
        alert(`Atenção: É permitido anexar no máximo 5 fotos ou vídeos como evidência da atividade (atualmente você anexou ${uploadedFiles.length}).`);
        return;
      }
    }

    // Validação estrita de limites de caracteres mínimos/máximos antes do envio
    const minMaxFields = form.querySelectorAll("[data-min-length], [data-max-length]");
    for (let field of minMaxFields) {
      const minLen = parseInt(field.getAttribute("data-min-length") || "0", 10);
      const maxLen = parseInt(field.getAttribute("data-max-length") || "0", 10);
      const valLen = field.value.trim().length;

      const labelEl = field.parentElement.querySelector("label");
      const fieldName = labelEl ? labelEl.textContent.replace("*", "").trim() : "Campo de texto";

      if (minLen > 0 && valLen < minLen) {
        alert(`O campo "${fieldName}" requer no mínimo ${minLen} caracteres (atualmente possui ${valLen}).`);
        field.focus();
        return;
      }

      if (maxLen > 0 && valLen > maxLen) {
        alert(`O campo "${fieldName}" permite no máximo ${maxLen} caracteres (atualmente possui ${valLen}).`);
        field.focus();
        return;
      }
    }

    const formDataObj = extractFormData(form);
    formDataObj.files = uploadedFiles;
    currentSubmittedData = formDataObj;

    showOverlay("Salvando dados da atividade na planilha e arquivos no Google Drive...", 35, "Etapa 1 de 2: Registrando Informações", true);

    callBackendAPI(
      "submitForm",
      { formData: formDataObj },
      onStage1Success,
      onStage1Error
    );
  });
}

function extractFormData(form) {
  const data = {};
  const formData = new FormData(form);

  for (let [key, value] of formData.entries()) {
    if (data[key]) {
      if (!Array.isArray(data[key])) {
        data[key] = [data[key]];
      }
      data[key].push(value);
    } else {
      data[key] = value;
    }
  }

  // Normaliza aliases de contrato
  data.contrato = data.numeroContrato || data.contrato || "";
  data.numeroContrato = data.contrato;

  // Função auxiliar para juntar arrays de checkboxes e processar campo "Outro"
  const formatCheckboxField = (fieldName, outroFieldName) => {
    let raw = data[fieldName];
    if (!raw) return "";
    let arr = Array.isArray(raw) ? raw : [raw];
    let outroVal = outroFieldName && data[outroFieldName] ? data[outroFieldName].trim() : "";

    arr = arr.map(item => {
      if (item === "Outro" && outroVal) {
        return `Outro: ${outroVal}`;
      }
      return item;
    });

    return arr.join("; ");
  };

  data.faixaEtaria = formatCheckboxField("faixaEtaria", "");
  data.perfilPublico = formatCheckboxField("perfilPublico", "perfilPublicoOutro");
  data.impactoCultural = formatCheckboxField("impactoTerritorial", "impactoTerritorialOutro") || formatCheckboxField("impactoCultural", "impactoCulturalOutro");
  data.impactoTerritorial = data.impactoCultural;
  data.pontosFortes = formatCheckboxField("pontosFortes", "pontosFortesOutro");
  data.pontosFracos = formatCheckboxField("pontosFracos", "pontosFracosOutro");

  // Garante que setor e area estejam sempre preenchidos
  data.setor = data.setor || "Pedagógico";
  data.area = data.area || data.setor;

  // Se dataRelatorio não estiver definido no formulário, constrói a partir de mês/ano
  if (!data.dataRelatorio) {
    if (data.mesReferencia && data.anoReferencia) {
      data.dataRelatorio = `${data.mesReferencia} / ${data.anoReferencia}`;
    } else if (data.dataReposicao) {
      data.dataRelatorio = data.dataReposicao;
    } else {
      data.dataRelatorio = new Date().toLocaleDateString("pt-BR");
    }
  }

  // Coleta os checkboxes de dias selecionados
  if (Array.isArray(data.diasAtividade)) {
    data.diasAtividade = data.diasAtividade.join(", ");
  }

  return data;
}

function onStage1Success(response) {
  if (!response || !response.success) {
    hideOverlay();
    alert("Erro na Etapa 1: " + (response ? response.message : "Resposta nula"));
    return;
  }

  showOverlay("Compilando documento oficial e exportando PDF no Google Drive...", 75, "Etapa 2 de 2: Gerando PDF", true);

  const stage1Data = response;
  callBackendAPI(
    "generatePdfReportAsync",
    {
      sheetName: stage1Data.sheetName,
      rowNumber: stage1Data.rowNumber,
      relatorioFolderId: stage1Data.relatorioFolderId,
      registroFolderId: stage1Data.registroFolderId,
      area: stage1Data.area,
      formData: currentSubmittedData
    },
    onStage2Success,
    onStage2Error
  );
}

function onStage1Error(errMessage) {
  hideOverlay();
  alert("Erro de conexão na Etapa 1: " + errMessage);
}

function onStage2Success(response) {
  hideOverlay();
  if (response && response.success) {
    showSuccessCard(response.pdfUrl, response.docUrl);
  } else {
    alert("O formulário foi salvo, mas houve uma divergência ao compilar o PDF: " + (response ? response.message : "Erro desconhecido"));
  }
}

function onStage2Error(errMessage) {
  hideOverlay();
  alert("Aviso: Os dados foram salvos no Sheets, mas a compilação do PDF falhou na Etapa 2: " + errMessage);
}

function showSuccessCard(pdfUrl, docUrl) {
  const formCard = document.getElementById("formCard");
  const successCard = document.getElementById("successCard");
  if (formCard) formCard.classList.add("hidden");

  if (successCard) {
    successCard.classList.remove("hidden");
    const pdfBtn = document.getElementById("pdfDownloadBtn");
    if (pdfBtn && pdfUrl) {
      pdfBtn.href = pdfUrl;
      pdfBtn.target = "_blank";
    }
  }
}
