/**
 * GERENCIADOR PRINCIPAL DO FRONTEND (FÁBRICAS DE CULTURA)
 * Controla os formulários modulares, carregamento das listas institucionais,
 * compressão de mídia da câmera e envio de 2 etapas.
 */

let dropDownHierarchy = {};
let uploadedFiles = [];
let currentSubmittedData = null;
let isSubmitting = false;

// Estado da consulta prévia de duplicidade (ver setupDuplicateCheck)
let reportAlreadySubmitted = false;
let duplicateCheckMessage = "";

document.addEventListener("DOMContentLoaded", () => {
  initializeDropdowns();
  setupCalendarGrid();
  setupWeekdayGrid();
  setupDragAndDrop();
  setupFormSubmission();
  setupOutroFieldsListeners();
  setupNenhumExclusivity();
  setupCharacterCounters();
  initDynamicPlanoTable();
  setupUnloadGuard();
  setupDuplicateCheck();
});

/* 1b. CONSULTA PRÉVIA DE RELATÓRIO JÁ ENVIADO */

/**
 * Campos que identificam a atividade em cada formulário. A consulta só é disparada quando todos
 * os presentes na página estão preenchidos — é a mesma chave usada pelo backend para decidir se o
 * relatório já existe.
 */
const CAMPOS_CHAVE_DUPLICIDADE = [
  { id: "unidadeSelect", chave: "unidade" },
  { id: "centroCasaSelect", chave: "unidade" },
  { id: "divisaoRegionalSelect", chave: "divisaoRegional" },
  { id: "tipoPedagogicoSelect", chave: "tipoPedagogico" },
  { id: "atividadeSelect", chave: "atividade" },
  { id: "nomeAtividade", chave: "atividade" },
  { id: "anoReferencia", chave: "anoReferencia" },
  { id: "mesReferencia", chave: "mesReferencia" },
  { id: "dataRelatorio", chave: "dataRelatorio" }
];

/**
 * Consulta a planilha assim que a atividade fica identificada e, se o relatório já tiver sido
 * enviado, avisa quando e por quem e bloqueia o envio — o mesmo comportamento da Área Restrita.
 *
 * Sem isso, o educador só descobriria a recusa depois de preencher o formulário inteiro e anexar
 * as evidências. O aviso é criado por JavaScript, reaproveitando o estilo .status-box que a Área
 * Restrita já usa, para que nenhum dos quatro formulários precise ser alterado.
 */
function setupDuplicateCheck() {
  const form = document.getElementById("reportForm");
  if (!form) return;

  const campos = CAMPOS_CHAVE_DUPLICIDADE
    .map(def => ({ el: document.getElementById(def.id), chave: def.chave }))
    .filter(c => c.el);

  if (campos.length === 0) return;

  const aviso = document.createElement("div");
  aviso.id = "reportStatusBox";
  aviso.className = "status-box";
  aviso.style.display = "none";

  // O aviso é inserido logo abaixo do último campo que compõe a chave, que é o momento exato em
  // que a atividade fica identificada e a consulta pode responder: Mês de Referência no
  // Pedagógico e na Fundação CASA, o calendário na Articulação, a Data nas Bibliotecas. Colocá-lo
  // no fim da seção ou junto ao botão deixaria a resposta longe do campo que a provocou.
  const ancora = findDuplicateNoticeAnchor(form, campos);
  if (ancora) {
    ancora.insertAdjacentElement("afterend", aviso);
  } else {
    const rodape = form.querySelector(".form-footer");
    if (rodape) form.insertBefore(aviso, rodape); else form.appendChild(aviso);
  }

  let debounce = null;
  const agendarConsulta = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => runDuplicateCheck(form, campos, aviso), 400);
  };

  campos.forEach(c => {
    c.el.addEventListener("change", agendarConsulta);
    if (c.el.tagName === "INPUT") c.el.addEventListener("input", agendarConsulta);
  });

  // Articulação e Difusão: o dia faz parte da identidade da atividade, mas vem de uma grade de
  // caixas de seleção sem campo próprio, então é observada à parte.
  const calendario = document.getElementById("calendarGrid");
  if (calendario) {
    calendario.addEventListener("change", agendarConsulta);
    calendario.addEventListener("click", agendarConsulta);
  }

  // Fundação CASA: dias da semana + horário também compõem a identidade da atividade (é o que
  // separa a 1ª da 2ª turma), e ficam fora da lista de campos-chave por não terem um <select>.
  const gradeDiasSemana = document.getElementById("diasSemanaGrid");
  if (gradeDiasSemana) {
    gradeDiasSemana.addEventListener("change", agendarConsulta);
  }
  ["horarioInicio", "horarioTermino"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", agendarConsulta);
      el.addEventListener("input", agendarConsulta);
    }
  });
}

/**
 * Localiza o bloco depois do qual o aviso deve ser inserido: o campo da chave que aparece por
 * último no formulário, considerando também o calendário da Articulação, que participa da
 * identificação mas não é um campo comum.
 *
 * A ordem é lida do próprio DOM em vez de fixada por área, para que a âncora continue correta se
 * a ordem dos campos mudar em algum formulário.
 *
 * @returns {Element|null} O .form-group do último campo da chave, ou null se nada for encontrado
 */
function findDuplicateNoticeAnchor(form, campos) {
  const candidatos = campos.map(c => c.el);

  ["calendarGrid", "diasSemanaGrid", "horarioTermino"].forEach(id => {
    const el = document.getElementById(id);
    if (el) candidatos.push(el);
  });

  let ultimo = null;
  candidatos.forEach(el => {
    if (!ultimo) {
      ultimo = el;
      return;
    }
    // DOCUMENT_POSITION_FOLLOWING: "el" vem depois do candidato atual no documento
    if (ultimo.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
      ultimo = el;
    }
  });

  if (!ultimo) return null;
  return ultimo.closest(".form-group") || ultimo;
}

/**
 * Primeiro dia marcado na grade do calendário (Articulação e Difusão).
 * Devolve "" quando a grade não existe no formulário ou nenhum dia foi marcado.
 */
function getPrimeiroDiaSelecionado() {
  const calendario = document.getElementById("calendarGrid");
  if (!calendario) return "";

  const marcados = Array.from(calendario.querySelectorAll('input[type="checkbox"]:checked'))
    .map(chk => parseInt(chk.value, 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);

  return marcados.length > 0 ? String(marcados[0]) : "";
}

function runDuplicateCheck(form, campos, aviso) {
  const payload = {
    setor: form.querySelector('input[name="setor"]') ? form.querySelector('input[name="setor"]').value : ""
  };

  for (let c of campos) {
    const valor = (c.el.value || "").trim();
    // Enquanto a atividade não estiver completamente identificada não há o que consultar
    if (!valor) {
      resetDuplicateState(aviso);
      return;
    }
    payload[c.chave] = valor;
  }

  // Articulação e Difusão: sem nenhum dia marcado a atividade ainda não está identificada.
  if (document.getElementById("calendarGrid")) {
    const dia = getPrimeiroDiaSelecionado();
    if (!dia) {
      resetDuplicateState(aviso);
      return;
    }
    payload.diasAtividade = dia;
  }

  // Fundação CASA: dias da semana + horário completam a identidade. Enquanto não houver ao menos
  // um dia marcado e os dois horários preenchidos, a turma ainda não está identificada.
  if (document.getElementById("diasSemanaGrid")) {
    const diasSemana = getDiasSemanaSelecionados();
    const horarioInicio = (document.getElementById("horarioInicio") || {}).value || "";
    const horarioTermino = (document.getElementById("horarioTermino") || {}).value || "";
    if (!diasSemana || !horarioInicio || !horarioTermino) {
      resetDuplicateState(aviso);
      return;
    }
    payload.diasSemana = diasSemana;
    payload.horarioInicio = horarioInicio;
    payload.horarioTermino = horarioTermino;
  }

  aviso.className = "status-box info";
  aviso.textContent = "Verificando se esta atividade já possui relatório enviado...";
  aviso.style.display = "block";

  callBackendAPI("checkReportStatus", payload, (response) => {
    if (!response || !response.success) {
      // Uma falha de consulta não pode impedir um envio legítimo: o backend recusa de qualquer
      // forma na hora de gravar, então aqui o formulário segue liberado.
      resetDuplicateState(aviso);
      return;
    }

    if (response.alreadySubmitted) {
      const jaEstavaBloqueado = reportAlreadySubmitted;
      reportAlreadySubmitted = true;
      duplicateCheckMessage = response.detail || "Esta atividade já possui relatório enviado.";

      let texto = "Esta atividade já teve o relatório enviado";
      if (response.submittedAt) texto += " em " + response.submittedAt;
      if (response.submittedBy) texto += " por " + response.submittedBy;
      texto += ". Não é permitido enviar o relatório da mesma atividade duas vezes no mesmo período.";

      aviso.className = "status-box warning";
      aviso.textContent = texto;
      aviso.style.display = "block";
      setSubmitBlocked(form, true);

      // Leva o educador até o aviso apenas na transição para bloqueado, para não puxar a página
      // a cada nova consulta enquanto ele preenche o formulário.
      if (!jaEstavaBloqueado) {
        aviso.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    reportAlreadySubmitted = false;
    duplicateCheckMessage = "";
    aviso.className = "status-box success";
    aviso.textContent = "Atividade liberada: ainda não há relatório enviado para este período.";
    aviso.style.display = "block";
    setSubmitBlocked(form, false);
  }, () => {
    resetDuplicateState(aviso);
  });
}

function resetDuplicateState(aviso) {
  reportAlreadySubmitted = false;
  duplicateCheckMessage = "";
  aviso.style.display = "none";
  aviso.textContent = "";
  const form = document.getElementById("reportForm");
  if (form) setSubmitBlocked(form, false);
}

function setSubmitBlocked(form, blocked) {
  form.querySelectorAll('button[type="submit"]').forEach(btn => {
    btn.disabled = blocked;
  });
}

/**
 * Pede confirmação do navegador se a página for fechada ou recarregada durante o envio.
 *
 * O overlay já pede para não fechar a página, mas nada impedia o fechamento acidental. Fechar
 * entre a Etapa 1 e a Etapa 2 grava os dados na planilha sem gerar o relatório em PDF, e o
 * educador não tem como concluir depois: um novo envio é tratado como reenvio da mesma atividade.
 */
function setupUnloadGuard() {
  window.addEventListener("beforeunload", (e) => {
    if (!isSubmitting) return;
    e.preventDefault();
    // Navegadores atuais exibem uma mensagem padrão própria; o valor só precisa ser não vazio.
    e.returnValue = "";
    return "";
  });
}

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
  isSubmitting = false;
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.add("hidden");

  // Um relatório já enviado mantém o botão desabilitado: reabilitar aqui desfaria o bloqueio da
  // consulta prévia toda vez que um overlay fosse fechado.
  const submitBtns = document.querySelectorAll('button[type="submit"]');
  submitBtns.forEach(btn => {
    btn.disabled = reportAlreadySubmitted;
  });
}

/* 1. CARREGAMENTO E POPULAÇÃO DE DROPDOWNS */
function initializeDropdowns(forceRefresh = false) {
  showDropdownError(false);
  showOverlay(
    forceRefresh
      ? "Recarregando unidades institucionais do servidor..."
      : "Carregando unidades institucionais..."
  );

  const payload = forceRefresh ? { forceRefresh: true, nocache: true } : {};
  callBackendAPI("getDropdownData", payload, onDropdownDataReceived, onDropdownDataError);
}

function onDropdownDataReceived(response) {
  hideOverlay();

  // Se a chamada falhou no backend (ex.: instabilidade temporária na Planilha de Listas), o
  // objeto de resposta não tem "hierarchy". Sem essa checagem, o fallback abaixo usava a própria
  // resposta de erro ({success, message}) como se fosse a hierarquia de unidades, populando o
  // campo "Unidade" com opções falsas de valor "success"/"message" — permitindo um envio com
  // Unidade inválida e Atividade vazia (dropdown dependente ficava sem opções).
  if (!response || !response.success || !response.hierarchy) {
    const errorMsg = (response && response.message) || "Não foi possível carregar as listas institucionais. Recarregue a página ou clique em 'Tentar Novamente'.";
    onDropdownDataError(errorMsg);
    return;
  }

  showDropdownError(false);
  const hierarchy = response.hierarchy;
  dropDownHierarchy = hierarchy;

  const unidadeSelect = document.getElementById("unidadeSelect");
  const tipoPedagogicoSelect = document.getElementById("tipoPedagogicoSelect");

  if (unidadeSelect) {
    unidadeSelect.innerHTML = '<option value="" disabled selected>Selecione a Unidade...</option>';
    unidadeSelect.disabled = false;

    Object.keys(hierarchy).forEach(key => {
      if (key !== "Fundação Casa") {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = key;
        unidadeSelect.appendChild(opt);
      }
    });

    unidadeSelect.addEventListener("change", () => {
      updateTipoPedagogicoOptions();
      updateAtividadeDropdown();
    });
  }

  if (tipoPedagogicoSelect) {
    tipoPedagogicoSelect.addEventListener("change", updateAtividadeDropdown);
  }

  updateTipoPedagogicoOptions();

  // Preenche a Divisão Regional da Fundação Casa se estiver presente
  const divisaoSelect = document.getElementById("divisaoRegionalSelect");
  if (divisaoSelect && hierarchy["Fundação Casa"]) {
    divisaoSelect.innerHTML = '<option value="" disabled selected>Selecione a Divisão Regional...</option>';
    divisaoSelect.disabled = false;
    Object.keys(hierarchy["Fundação Casa"]).forEach(dr => {
      const opt = document.createElement("option");
      opt.value = dr;
      opt.textContent = dr;
      divisaoSelect.appendChild(opt);
    });

    divisaoSelect.addEventListener("change", handleDivisaoCasaChange);
  }
}

function updateTipoPedagogicoOptions() {
  const unidadeSelect = document.getElementById("unidadeSelect");
  const tipoPedagogicoSelect = document.getElementById("tipoPedagogicoSelect");
  if (!tipoPedagogicoSelect) return;

  const selectedUnidade = unidadeSelect ? unidadeSelect.value : "";
  const isJSL = isJardimSaoLuis(selectedUnidade);
  const isVNC = isVilaNovaCachoeirinha(selectedUnidade);

  let nucleoOpt = Array.from(tipoPedagogicoSelect.options).find(opt => opt.value === "Núcleo de Moda");

  if (isJSL) {
    if (!nucleoOpt) {
      nucleoOpt = document.createElement("option");
      nucleoOpt.value = "Núcleo de Moda";
      nucleoOpt.textContent = "Núcleo de Moda";
      tipoPedagogicoSelect.appendChild(nucleoOpt);
    }
  } else {
    if (nucleoOpt) {
      if (tipoPedagogicoSelect.value === "Núcleo de Moda") {
        tipoPedagogicoSelect.value = "";
      }
      nucleoOpt.remove();
    }
  }

  // Vila Nova Cachoeirinha: mantém as opções padrão do campo e soma Folia 25 / Folia 26. O value de
  // cada option precisa bater exatamente com a coluna A da planilha de atividades — matchActivityType
  // (shared-helpers.js) exige igualdade exata para esses dois tipos.
  ["Folia 25", "Folia 26"].forEach(folia => {
    let foliaOpt = Array.from(tipoPedagogicoSelect.options).find(opt => opt.value === folia);
    if (isVNC) {
      if (!foliaOpt) {
        foliaOpt = document.createElement("option");
        foliaOpt.value = folia;
        foliaOpt.textContent = folia;
        tipoPedagogicoSelect.appendChild(foliaOpt);
      }
    } else if (foliaOpt) {
      if (tipoPedagogicoSelect.value === folia) {
        tipoPedagogicoSelect.value = "";
      }
      foliaOpt.remove();
    }
  });
}

function onDropdownDataError(errMessage) {
  hideOverlay();
  const errorMsg = typeof errMessage === "string" ? errMessage : "Falha de conexão com o servidor ao consultar as listas.";
  showDropdownError(true, errorMsg);
}

/**
 * Exibe ou oculta o box de erro no topo do formulário com botão 'Tentar Novamente'
 */
function showDropdownError(show, message) {
  let errorBox = document.getElementById("formDropdownErrorBox");

  if (!errorBox && show) {
    const form = document.getElementById("reportForm");
    if (!form) return;

    errorBox = document.createElement("div");
    errorBox.id = "formDropdownErrorBox";
    errorBox.className = "status-box error";
    errorBox.style.cssText = "margin-bottom: 1.5rem; padding: 1rem 1.25rem;";
    errorBox.innerHTML = `
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
        <div style="display: flex; align-items: flex-start; gap: 0.75rem; flex: 1; min-width: 260px;">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink: 0; margin-top: 2px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <strong style="display: block; font-size: 0.95rem; margin-bottom: 0.25rem; color: #991b1b;">Não foi possível carregar as listas institucionais</strong>
            <span id="formDropdownErrorMessage" style="font-size: 0.88rem; line-height: 1.4; color: #b91c1c;">${escapeHtml(message || "Houve uma instabilidade temporária ao consultar o servidor.")}</span>
          </div>
        </div>
        <button type="button" id="btnRetryPublicDropdown" onclick="initializeDropdowns(true)" class="btn-primary" style="font-size: 0.85rem; padding: 0.5rem 1.1rem; display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; white-space: nowrap; border-radius: 6px;">
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Tentar Novamente
        </button>
      </div>
    `;

    // Insere no topo do formulário (antes da primeira seção)
    const firstSection = form.querySelector(".form-section") || form.firstElementChild;
    if (firstSection) {
      form.insertBefore(errorBox, firstSection);
    } else {
      form.appendChild(errorBox);
    }
  }

  if (errorBox) {
    errorBox.style.display = show ? "block" : "none";
    if (show && message) {
      const msgEl = errorBox.querySelector("#formDropdownErrorMessage");
      if (msgEl) msgEl.textContent = message;
    }
  }

  // Atualiza os selects para refletir o estado de erro
  const unidadeSelect = document.getElementById("unidadeSelect");
  const divisaoSelect = document.getElementById("divisaoRegionalSelect");
  const atividadeSelect = document.getElementById("atividadeSelect");

  if (show) {
    if (unidadeSelect) {
      unidadeSelect.innerHTML = '<option value="" disabled selected>Erro ao carregar. Clique em "Tentar Novamente" acima.</option>';
      unidadeSelect.disabled = true;
    }
    if (divisaoSelect) {
      divisaoSelect.innerHTML = '<option value="" disabled selected>Erro ao carregar. Clique em "Tentar Novamente" acima.</option>';
      divisaoSelect.disabled = true;
    }
    if (atividadeSelect) {
      atividadeSelect.innerHTML = '<option value="" disabled selected>Aguardando carregamento das unidades...</option>';
      atividadeSelect.disabled = true;
    }
  }
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

  const rawItems = dropDownHierarchy[unidade] || [];
  let filteredItems = rawItems;

  if (tipo) {
    filteredItems = rawItems.filter(item => {
      if (typeof item === "string") return true;
      if (!item.type || item.type.trim() === "") return false;
      return matchActivityType(item.type, tipo);
    });

    // Se nenhum item passou no filtro, verifica se a planilha sequer definiu a coluna "type"
    if (filteredItems.length === 0) {
      const hasAnyTypeDefined = rawItems.some(item => typeof item === "object" && item.type && item.type.trim() !== "");
      if (!hasAnyTypeDefined) {
        filteredItems = rawItems; // Fallback apenas para planilhas legadas sem coluna de tipo
      }
    }
  }

  if (filteredItems.length === 0) {
    const cleanTipo = escapeHtml(tipo);
    atividadeSelect.innerHTML = `<option value="" disabled selected>Nenhuma atividade de "${cleanTipo}" encontrada para esta unidade...</option>`;
    atividadeSelect.disabled = true;
    return;
  }

  atividadeSelect.innerHTML = '<option value="" disabled selected>Selecione a Atividade...</option>';
  atividadeSelect.disabled = false;

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

/* A opção "Nenhum" é exclusiva dentro do seu grupo: ao marcar "Nenhum", as
   demais opções (inclusive "Outro" e seu campo de texto) são desmarcadas; ao
   marcar qualquer outra opção, "Nenhum" se desmarca. Evita gravar na planilha
   uma combinação sem sentido como "Nenhum, Falhas técnicas". */
function setupNenhumExclusivity() {
  document.querySelectorAll('input[type="checkbox"][value="Nenhum"]').forEach(nenhum => {
    const grid = nenhum.closest(".checkbox-grid");
    if (!grid) return;

    const outros = Array.from(grid.querySelectorAll('input[type="checkbox"]')).filter(chk => chk !== nenhum);

    nenhum.addEventListener("change", () => {
      if (!nenhum.checked) return;
      outros.forEach(chk => { chk.checked = false; });
      const outroInput = grid.querySelector(".input-inline-outro");
      if (outroInput) {
        outroInput.disabled = true;
        outroInput.value = "";
      }
    });

    outros.forEach(chk => {
      chk.addEventListener("change", () => {
        if (chk.checked) nenhum.checked = false;
      });
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
      chk.dispatchEvent(new Event("change", { bubbles: true }));
    });

    calendarGrid.appendChild(dayBox);
  }
}

/* 3b. DIAS DA SEMANA (FUNDAÇÃO CASA) */
const DIAS_SEMANA_UTEIS = [
  { valor: "Segunda", sigla: "SEG" },
  { valor: "Terça", sigla: "TER" },
  { valor: "Quarta", sigla: "QUA" },
  { valor: "Quinta", sigla: "QUI" },
  { valor: "Sexta", sigla: "SEX" }
];

function setupWeekdayGrid() {
  const grid = document.getElementById("diasSemanaGrid");
  if (!grid) return;

  grid.innerHTML = "";
  DIAS_SEMANA_UTEIS.forEach(dia => {
    const box = document.createElement("label");
    box.className = "weekday-box";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.name = "diasSemana";
    chk.value = dia.valor;

    const txt = document.createElement("span");
    txt.textContent = dia.sigla;

    box.appendChild(chk);
    box.appendChild(txt);

    // O <label> já alterna o checkbox por associação; aqui só reflete o estado no visual e
    // propaga um "change" para a consulta prévia de duplicidade.
    chk.addEventListener("change", () => {
      box.classList.toggle("selected", chk.checked);
      chk.dispatchEvent(new Event("input", { bubbles: true }));
    });

    grid.appendChild(box);
  });
}

/**
 * Dias da semana marcados, na ordem Segunda -> Sexta, como "Segunda, Quarta".
 */
function getDiasSemanaSelecionados() {
  const grid = document.getElementById("diasSemanaGrid");
  if (!grid) return "";
  return Array.from(grid.querySelectorAll('input[type="checkbox"]:checked'))
    .map(chk => chk.value)
    .join(", ");
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
  if (isCasaForm) return;

  const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB em bytes
  // Vídeo não passa por compressão (ao contrário da foto, que cai para ~50-60KB via ImageCompressor),
  // então o teto é bem menor: evita payloads Base64 gigantes que travam/estouram o timeout do envio.
  const MAX_VIDEO_SIZE = 8 * 1024 * 1024; // 8MB em bytes
  const MAX_VIDEOS_PER_SUBMISSION = 2;

  // Formulários das demais áreas (Pedagógico, Articulação, Biblioteca): mínimo 3, máximo 5 mídias
  if (uploadedFiles.length + files.length > 5) {
    alert(`Limite Excedido: É permitido anexar no máximo 5 mídias por envio. Você já possui ${uploadedFiles.length} arquivo(s) selecionado(s).`);
    return;
  }

  let videoCount = uploadedFiles.filter(f => f.mimeType && f.mimeType.startsWith("video/")).length;
  const falhas = [];

  showOverlay("Otimizando e compactando mídias para envio...");
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isVideo = file.type.startsWith("video/");

    if (isVideo) {
      if (videoCount >= MAX_VIDEOS_PER_SUBMISSION) {
        alert(`Arquivo Ignorado: "${file.name}" — é permitido anexar no máximo ${MAX_VIDEOS_PER_SUBMISSION} vídeo(s) por envio. As demais evidências devem ser fotos.`);
        continue;
      }
      if (file.size > MAX_VIDEO_SIZE) {
        alert(`Arquivo Ignorado: "${file.name}" excede o limite máximo de 8MB por vídeo. Grave um vídeo mais curto ou em qualidade menor.`);
        continue;
      }
    } else if (file.size > MAX_IMAGE_SIZE) {
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
        if (isVideo) videoCount++;
      }
    } catch (err) {
      // Uma mídia descartada em silêncio fazia o educador acreditar que havia anexado 3 fotos
      // quando só 2 tinham entrado, e a falha só aparecia na validação do envio.
      console.warn("Falha ao processar mídia:", file.name, err);
      falhas.push(file.name || "arquivo sem nome");
    }
  }
  hideOverlay();
  renderPreviewGrid();

  if (falhas.length > 0) {
    alert(`Não foi possível processar ${falhas.length === 1 ? "o arquivo" : "os arquivos"}: ${falhas.join(", ")}.\n\nO arquivo pode estar corrompido ou em um formato não suportado. Selecione outra mídia no lugar.`);
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
      const cleanName = escapeHtml(fileObj.name || "Plano_de_Atividades.pdf");

      pdfItem.innerHTML = `
        <div class="pdf-preview-icon">📄</div>
        <div class="pdf-preview-details">
          <span class="pdf-preview-name">${cleanName}</span>
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
    } else if (fileObj.mimeType && fileObj.mimeType.startsWith("video/")) {
      // Exibição em formato card para Vídeo
      const videoItem = document.createElement("div");
      videoItem.className = "pdf-preview-item video-preview-item";

      const sizeMb = fileObj.size ? (fileObj.size / (1024 * 1024)).toFixed(2) : "Vídeo";
      const cleanVideoName = escapeHtml(fileObj.name || "Video.mp4");

      videoItem.innerHTML = `
        <div class="pdf-preview-icon">🎬</div>
        <div class="pdf-preview-details">
          <span class="pdf-preview-name">${cleanVideoName}</span>
          <span class="pdf-preview-size">${sizeMb} MB • Arquivo de Vídeo</span>
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

      videoItem.appendChild(btn);
      grid.appendChild(videoItem);
    } else {
      // Exibição em grade de miniaturas para imagens
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

    if (isSubmitting) return;

    // Trava final: com o relatório já enviado, nenhuma requisição chega a sair daqui. O botão já
    // está desabilitado pela consulta prévia, mas um submit disparado pelo teclado ou por um
    // navegador que ignore o estado do botão passaria por cima disso.
    if (reportAlreadySubmitted) {
      alert(duplicateCheckMessage || "Esta atividade já possui relatório enviado. Não é permitido enviar duas vezes no mesmo período.");
      setSubmitBlocked(form, true);
      return;
    }

    isSubmitting = true;

    const submitBtns = form.querySelectorAll('button[type="submit"]');
    submitBtns.forEach(btn => btn.disabled = true);

    const isCasaForm = form.getAttribute("data-theme") === "fundacaocasa";

    // Validação estrita da Seção de Evidências (Arquivos / Tabela)
    if (isCasaForm) {
      // Dias da semana e horário são obrigatórios e fazem parte da identidade da atividade.
      if (!getDiasSemanaSelecionados()) {
        alert("Atenção: selecione ao menos um dia da semana em que a atividade acontece.");
        document.getElementById("diasSemanaGrid").scrollIntoView({ behavior: "smooth", block: "center" });
        hideOverlay();
        return;
      }
      const hInicio = (document.getElementById("horarioInicio") || {}).value || "";
      const hTermino = (document.getElementById("horarioTermino") || {}).value || "";
      if (!hInicio || !hTermino) {
        alert("Atenção: preencha o horário de início e de término da atividade.");
        document.getElementById("horarioInicio").scrollIntoView({ behavior: "smooth", block: "center" });
        hideOverlay();
        return;
      }

      // Validação dos Cards do Plano de Atividades: um encontro com qualquer campo preenchido
      // precisa ter Data, Horário de Início, Horário de Término e Descrição todos preenchidos,
      // para não gerar linhas incompletas ("---") no relatório final. Cards totalmente vazios
      // (sobra dos encontros padrão não utilizados) são ignorados, não bloqueiam o envio.
      const container = document.getElementById("tabelaEncontrosBody");
      const cards = container ? Array.from(container.querySelectorAll(".encontro-card, tr")) : [];
      let hasCompleteEncontro = false;
      let incompleteIndex = -1;
      let incompleteMissing = [];

      cards.forEach((card, idx) => {
        const dataEl = card.querySelector(".input-plano-data");
        const inicioEl = card.querySelector(".input-plano-inicio");
        const fimEl = card.querySelector(".input-plano-fim");
        const descEl = card.querySelector(".input-plano-descricao");

        const dataVal = dataEl ? dataEl.value : "";
        const inicioVal = inicioEl ? inicioEl.value : "";
        const fimVal = fimEl ? fimEl.value : "";
        const descVal = descEl ? descEl.value.trim() : "";

        if (!dataVal && !inicioVal && !fimVal && !descVal) {
          return; // card vazio, nao utilizado: ignora
        }

        const missing = [];
        if (!dataVal) missing.push("Data do Encontro");
        if (!inicioVal) missing.push("Horário de Início");
        if (!fimVal) missing.push("Horário de Término");
        if (!descVal) missing.push("Descrição das Atividades");

        if (missing.length > 0) {
          if (incompleteIndex === -1) {
            incompleteIndex = idx;
            incompleteMissing = missing;
          }
        } else {
          hasCompleteEncontro = true;
        }
      });

      if (incompleteIndex !== -1) {
        alert(`Atenção: o Encontro ${incompleteIndex + 1} do Plano de Atividades está incompleto. Preencha: ${incompleteMissing.join(", ")}. Ou remova esse encontro caso não vá utilizá-lo.`);
        hideOverlay();
        return;
      }

      if (!hasCompleteEncontro) {
        alert("Atenção: Preencha ao menos 1 encontro completo (Data, Horário de Início, Horário de Término e Descrição) no Plano de Atividades.");
        hideOverlay();
        return;
      }
    } else {
      if (uploadedFiles.length < 3) {
        alert(`Atenção: É necessário anexar no mínimo 3 fotos ou vídeos como evidência da atividade (atualmente você anexou ${uploadedFiles.length}).`);
        hideOverlay();
        return;
      }
      if (uploadedFiles.length > 5) {
        alert(`Atenção: É permitido anexar no máximo 5 fotos ou vídeos como evidência da atividade (atualmente você anexou ${uploadedFiles.length}).`);
        hideOverlay();
        return;
      }
    }

    // Validação dos grupos de seleção múltipla marcados como obrigatórios
    if (!validateRequiredCheckboxGroups(form)) {
      hideOverlay();
      return;
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
        hideOverlay();
        return;
      }

      if (maxLen > 0 && valLen > maxLen) {
        alert(`O campo "${fieldName}" permite no máximo ${maxLen} caracteres (atualmente possui ${valLen}).`);
        field.focus();
        hideOverlay();
        return;
      }
    }

    const formDataObj = extractFormData(form);
    formDataObj.files = uploadedFiles;
    currentSubmittedData = formDataObj;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    showOverlay("Salvando dados da atividade na planilha e arquivos no Google Drive...", 35, "Etapa 1 de 2: Registrando Informações", true);

    callBackendAPI(
      "submitForm",
      { formData: formDataObj },
      onStage1Success,
      onStage1Error
    );
  });
}

/**
 * Exige ao menos uma opção marcada em cada grupo de seleção múltipla obrigatório
 * (Faixa Etária, Perfil do Público, Impacto Territorial/Cultural, Pontos Fortes,
 * Pontos Fracos e Desafios, Dias do Mês).
 *
 * O atributo HTML "required" não serve para esses grupos: em um conjunto de checkboxes de mesmo
 * nome, o navegador passaria a exigir que TODAS as caixas fossem marcadas. Sem uma validação
 * própria, esses campos exibiam o asterisco de obrigatório mas o formulário era enviado com eles
 * em branco — era o caso de "Pontos Fracos e Desafios".
 *
 * O grupo é reconhecido como obrigatório pelo próprio HTML: um rótulo com <span class="required">
 * dentro de um .form-group que contenha caixas de seleção. Assim, os grupos que a Fundação CASA
 * declara sem asterisco continuam opcionais, como previsto para aquela área.
 *
 * @param {HTMLFormElement} form Formulário a validar
 * @returns {boolean} true se todos os grupos obrigatórios estão preenchidos
 */
function validateRequiredCheckboxGroups(form) {
  const groups = form.querySelectorAll(".form-group");

  for (let group of groups) {
    const labelEl = group.querySelector("label");
    if (!labelEl || !labelEl.querySelector(".required")) continue;

    const checkboxes = group.querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length === 0) continue;

    const fieldName = labelEl.textContent.replace("*", "").trim();
    const marcados = Array.from(checkboxes).filter(chk => chk.checked);

    if (marcados.length === 0) {
      alert(`Atenção: selecione ao menos uma opção em "${fieldName}".`);
      group.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }

    // "Outro" marcado sem descrição gravaria a palavra "Outro" isolada na planilha e no relatório
    const outroMarcado = marcados.some(chk => chk.value === "Outro");
    if (outroMarcado) {
      const outroInput = group.querySelector(".input-inline-outro");
      if (outroInput && outroInput.value.trim() === "") {
        alert(`Atenção: você marcou "Outro" em "${fieldName}". Descreva qual, ou desmarque a opção.`);
        outroInput.focus();
        return false;
      }
    }
  }

  return true;
}

function enableFormSubmitBtn() {
  const form = document.getElementById("reportForm");
  if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = reportAlreadySubmitted;
  }
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

  const isCasaForm = form.getAttribute("data-theme") === "fundacaocasa";
  if (isCasaForm) {
    const container = document.getElementById("tabelaEncontrosBody");
    const cards = container ? container.querySelectorAll(".encontro-card, tr") : [];
    const planoTabela = [];
    const unidadeAtual = data.unidade || data.centroAtendimento || getSelectedUnidadeName();

    cards.forEach(card => {
      const dataEl = card.querySelector(".input-plano-data");
      const inicioEl = card.querySelector(".input-plano-inicio");
      const fimEl = card.querySelector(".input-plano-fim");
      const descEl = card.querySelector(".input-plano-descricao");

      const rawData = dataEl ? dataEl.value : "";
      const inicio = inicioEl ? inicioEl.value : "";
      const fim = fimEl ? fimEl.value : "";
      const desc = descEl ? descEl.value.trim() : "";

      let dataFormatada = rawData;
      if (rawData && rawData.includes("-")) {
        const parts = rawData.split("-");
        if (parts.length === 3) {
          dataFormatada = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      let horarioStr = "";
      if (inicio && fim) {
        horarioStr = `Das ${inicio}h às ${fim}h`;
      } else if (inicio) {
        horarioStr = `${inicio}h`;
      } else if (fim) {
        horarioStr = `Até ${fim}h`;
      }

      if (dataFormatada || horarioStr || desc) {
        planoTabela.push({
          data: dataFormatada || "---",
          unidade: unidadeAtual || "CASA",
          horario: horarioStr || "---",
          descricao: desc || "---"
        });
      }
    });

    data.planoTabela = planoTabela;
    data.files = [];

    // Dias da semana + horário da turma: parte da identidade da atividade na Fundação CASA. O
    // backend renormaliza tudo em normalizeSubmissionKey (fonte única da chave), aqui só entrega
    // em forma legível. FormData já traz horarioInicio/horarioTermino pelos name= dos inputs.
    data.diasSemana = Array.isArray(data.diasSemana) ? data.diasSemana.join(", ") : (data.diasSemana || "");
    if (data.horarioInicio && data.horarioTermino) {
      data.horarioAtividade = `${data.horarioInicio} às ${data.horarioTermino}`;
    } else {
      data.horarioAtividade = data.horarioInicio || data.horarioTermino || "";
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
    // Recusa por duplicidade detectada no servidor (ex.: outro envio da mesma atividade concluiu
    // enquanto este estava em andamento). O estado é marcado ANTES de fechar o overlay, que
    // reabilita os botões conforme este mesmo sinalizador.
    if (response && response.duplicate) {
      reportAlreadySubmitted = true;
      duplicateCheckMessage = response.message;
      hideOverlay();
      // Um relatório já enviado não é falha do sistema: prefixar com "Erro na Etapa 1"
      // confundiria o educador. A mensagem do servidor já diz quando e por quem foi enviado.
      alert(response.message);
      return;
    }

    hideOverlay();
    enableFormSubmitBtn();
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
  enableFormSubmitBtn();
  alert("Erro de conexão na Etapa 1: " + errMessage);
}

function onStage2Success(response) {
  hideOverlay();
  enableFormSubmitBtn();
  if (response && response.success) {
    showSuccessCard(response.pdfUrl, response.docUrl);
  } else {
    alert("O formulário foi salvo no Sheets/Drive, mas houve uma divergência ao compilar o PDF. Por favor, entre em contato com a equipe através do e-mail: sistemasdegestao@poiesis.org.br\n\nDetalhes: " + (response ? response.message : "Erro desconhecido"));
  }
}

function onStage2Error(errMessage) {
  hideOverlay();
  alert("Aviso: Os dados foram salvos no Sheets, mas a compilação do PDF falhou na Etapa 2. Por favor, entre em contato através do e-mail: sistemasdegestao@poiesis.org.br\n\nDetalhes: " + errMessage);
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

function getSelectedUnidadeName() {
  const selUnidade = document.getElementById("centroCasaSelect") ||
    document.getElementById("unidadeSelect") ||
    document.getElementById("unidade") ||
    document.getElementById("centroAtendimento");
  if (selUnidade && selUnidade.value) {
    return selUnidade.value;
  }
  return "Selecione a Unidade";
}

function updatePlanoUnidades() {
  const nomeUnidade = getSelectedUnidadeName();
  const inputs = document.querySelectorAll(".input-plano-unidade");
  inputs.forEach(input => {
    input.value = nomeUnidade;
  });
}

// Horário mestre da atividade (campo "Horário da atividade") aplicado como padrão aos encontros
// do Plano de Atividades. Guardado aqui para saber quais encontros ainda espelham o valor mestre
// anterior e podem ser reescritos sem sobrepor um ajuste manual.
let planoHorarioMestre = { inicio: "", fim: "" };

/**
 * Copia o horário mestre para os encontros do Plano de Atividades. Só reescreve um campo de
 * encontro que esteja vazio ou que ainda contenha o valor mestre anterior — um horário editado à
 * mão no encontro é preservado. Não faz nada quando o campo mestre correspondente está vazio.
 */
function syncPlanoHorarioComMestre() {
  const novoInicio = (document.getElementById("horarioInicio") || {}).value || "";
  const novoFim = (document.getElementById("horarioTermino") || {}).value || "";
  const cards = document.querySelectorAll("#tabelaEncontrosBody .encontro-card");

  cards.forEach(card => {
    const inicioEl = card.querySelector(".input-plano-inicio");
    const fimEl = card.querySelector(".input-plano-fim");
    if (novoInicio && inicioEl && (inicioEl.value === "" || inicioEl.value === planoHorarioMestre.inicio)) {
      inicioEl.value = novoInicio;
    }
    if (novoFim && fimEl && (fimEl.value === "" || fimEl.value === planoHorarioMestre.fim)) {
      fimEl.value = novoFim;
    }
  });

  if (novoInicio) planoHorarioMestre.inicio = novoInicio;
  if (novoFim) planoHorarioMestre.fim = novoFim;
}

function initDynamicPlanoTable() {
  const tbody = document.getElementById("tabelaEncontrosBody");
  const btnAdd = document.getElementById("btnAddEncontro");
  if (!tbody) return;

  tbody.innerHTML = "";
  planoHorarioMestre = { inicio: "", fim: "" };

  const selUnidades = [
    document.getElementById("centroCasaSelect"),
    document.getElementById("unidadeSelect"),
    document.getElementById("divisaoRegionalSelect"),
    document.getElementById("unidade"),
    document.getElementById("centroAtendimento")
  ];

  selUnidades.forEach(sel => {
    if (sel) {
      sel.addEventListener("change", () => {
        setTimeout(updatePlanoUnidades, 50);
      });
    }
  });

  ["horarioInicio", "horarioTermino"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", syncPlanoHorarioComMestre);
  });

  // Cria 3 encontros padrão iniciais
  for (let i = 1; i <= 3; i++) {
    addEncontroRow("", "", "", "");
  }

  if (btnAdd) {
    btnAdd.onclick = () => {
      addEncontroRow("", "", "", "");
    };
  }
}

function addEncontroRow(dataVal, inicioVal, fimVal, descVal) {
  const container = document.getElementById("tabelaEncontrosBody");
  if (!container) return;

  // Um encontro novo já nasce com o horário mestre da atividade (ajustável depois).
  inicioVal = inicioVal || planoHorarioMestre.inicio || "";
  fimVal = fimVal || planoHorarioMestre.fim || "";

  const nomeUnidade = getSelectedUnidadeName();

  const card = document.createElement("div");
  card.className = "encontro-card";
  card.innerHTML = `
    <button type="button" class="btn-remove-row" title="Remover este encontro">×</button>
    <div class="encontro-header-row">
      <div class="encontro-field encontro-field-data">
        <label>DATA DO ENCONTRO <span class="required">*</span></label>
        <input type="date" class="input-plano-data" value="${dataVal}" min="2026-01-01">
      </div>

      <div class="encontro-field encontro-field-unidade">
        <label>UNIDADE</label>
        <input type="text" class="input-plano-unidade" value="${nomeUnidade}" readonly>
      </div>

      <div class="encontro-field encontro-field-horario">
        <label>HORÁRIO (INÍCIO ÀS FIM) <span class="required">*</span></label>
        <div class="horario-inputs-inline">
          <input type="time" class="input-plano-inicio" value="${inicioVal}" title="Horário de Início">
          <span class="horario-divisor">às</span>
          <input type="time" class="input-plano-fim" value="${fimVal}" title="Horário de Término">
        </div>
      </div>
    </div>

    <div class="encontro-body-row">
      <label>DESCRIÇÃO DAS ATIVIDADES <span class="required">*</span></label>
      <textarea class="input-plano-descricao" placeholder="Descreva detalhadamente as atividades realizadas neste encontro...">${descVal}</textarea>
    </div>
  `;

  const btnRemove = card.querySelector(".btn-remove-row");
  btnRemove.onclick = () => {
    if (container.querySelectorAll(".encontro-card").length <= 1) {
      alert("É necessário manter pelo menos 1 encontro no Plano de Atividades.");
      return;
    }
    card.remove();
  };

  container.appendChild(card);
}
