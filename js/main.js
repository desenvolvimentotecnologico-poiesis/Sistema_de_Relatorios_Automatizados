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
});

/* Overlay de Carregamento */
function showOverlay(message) {
  const overlay = document.getElementById("loadingOverlay");
  const msgEl = document.getElementById("overlayMessage");
  if (msgEl && message) msgEl.textContent = message;
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

    unidadeSelect.addEventListener("change", handleUnidadeChange);
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

function handleUnidadeChange(e) {
  const unidade = e.target.value;
  const atividadeSelect = document.getElementById("atividadeSelect");
  if (!atividadeSelect) return;

  atividadeSelect.innerHTML = '<option value="" disabled selected>Selecione a Atividade...</option>';
  atividadeSelect.disabled = false;

  const items = dropDownHierarchy[unidade] || [];
  items.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.name;
    opt.textContent = item.name;
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

/* 2. CONFIGURAÇÃO DE CAMPOS "OUTRO" DINÂMICOS */
function setupOutroFieldsListeners() {
  document.querySelectorAll('input[type="checkbox"][value="Outro"]').forEach(chk => {
    chk.addEventListener("change", (e) => {
      const row = e.target.closest(".checkbox-outro-row") || e.target.parentElement;
      const input = row ? row.querySelector(".input-inline-outro") : null;
      if (input) {
        input.disabled = !e.target.checked;
        if (e.target.checked) input.focus();
      }
    });
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
  showOverlay("Otimizando e compactando imagens para envio móbile...");
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const compressed = await ImageCompressor.compressFile(file);
      uploadedFiles.push(compressed);
    } catch (err) {
      console.warn("Falha ao compactar arquivo:", file.name, err);
    }
  }
  hideOverlay();
  renderPreviewGrid();
}

function renderPreviewGrid() {
  const grid = document.getElementById("previewGrid");
  if (!grid) return;
  grid.innerHTML = "";

  uploadedFiles.forEach((fileObj, idx) => {
    const item = document.createElement("div");
    item.className = "preview-item";

    const img = document.createElement("img");
    img.src = `data:${fileObj.mimeType};base64,${fileObj.base64Data}`;

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
  });
}

/* 5. SUBMISSÃO DE FORMULÁRIO DE 2 ETAPAS */
function setupFormSubmission() {
  const form = document.getElementById("reportForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const formDataObj = extractFormData(form);
    formDataObj.files = uploadedFiles;
    currentSubmittedData = formDataObj;

    showOverlay("Etapa 1: Salvando respostas no Google Sheets e fotos no Drive...");

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

  showOverlay("Etapa 2: Compilando relatório institucional em PDF no Google Docs...");

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
