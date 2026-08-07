/**
 * MÓDULO DE AUTENTICAÇÃO FIREBASE E GERENCIAMENTO DE ÁREA RESTRITA (PEDAGÓGICO)
 * Permite que responsáveis autorizados façam login via Google e enviem
 * documentos complementares (Inscrição e Presença - apenas 1 PDF cada) por atividade.
 */

// Configuração do Firebase Project
const firebaseConfig = {
  apiKey: "AIzaSyDl7OvmyJX6Z4Kv1blveUHTUz30gQiMLNY",
  authDomain: "sra-acessos.firebaseapp.com",
  projectId: "sra-acessos",
  storageBucket: "sra-acessos.firebasestorage.app",
  messagingSenderId: "219584457893",
  appId: "1:219584457893:web:5618561d41f3ae1027f14c"
};

let firebaseApp = null;
let firebaseAuth = null;
let currentUserProfile = null;
let restrictedHierarchy = {};

/**
 * Inicializa os serviços do Firebase com persistência SESSION (desconecta ao fechar a guia)
 */
function initFirebase() {
  if (typeof firebase !== "undefined" && !firebase.apps.length) {
    try {
      firebaseApp = firebase.initializeApp(firebaseConfig);
      firebaseAuth = firebase.auth();

      // Define a persistência para SESSION (mantém enquanto a aba estiver aberta e desconecta ao fechar)
      firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .catch(err => console.warn("Aviso ao definir persistência do Firebase:", err));

      firebaseAuth.onAuthStateChanged((user) => {
        if (user) {
          handleUserLoggedIn(user);
        } else {
          handleUserLoggedOut();
        }
      });
    } catch (e) {
      console.warn("Firebase Auth aguardando chaves reais em js/auth.js:", e.message);
    }
  }
}

/**
 * Executa o Login via Google Auth Provider
 */
function loginWithGoogle() {
  if (!firebaseAuth) {
    alert("Firebase Auth ainda não foi configurado.");
    return;
  }
  showAuthLoading(true, "Abrindo janela de login do Google...");

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  firebaseAuth.signInWithPopup(provider)
    .then((result) => {
      handleUserLoggedIn(result.user);
    })
    .catch((error) => {
      showAuthLoading(false);
      console.error("Erro na autenticação do Firebase:", error);
      if (error.code === "auth/unauthorized-domain") {
        alert("Domínio não autorizado no Firebase Console. Adicione a URL do seu site nas configurações de Autenticação.");
      } else if (error.code !== "auth/popup-closed-by-user") {
        alert("Falha ao realizar login com o Google: " + error.message);
      }
    });
}

/**
 * Encerra a sessão do usuário
 */
function logoutUser() {
  if (firebaseAuth) {
    firebaseAuth.signOut().then(() => {
      handleUserLoggedOut();
    });
  } else {
    handleUserLoggedOut();
  }
}

/**
 * Valida o usuário logado contra a Lista Branca na Planilha de Usuários
 */
function handleUserLoggedIn(user) {
  const email = user ? (user.email || "") : "";
  showAuthLoading(true, "Carregando permissões da unidade para " + email + "...");

  callBackendAPI("verifyUserAccess", { email: email }, (response) => {
    const isAuthorized = response && response.success && (response.authorized === true || (response.data && response.data.authorized === true));
    const userProfile = response ? (response.user || (response.data && response.data.user)) : null;

    if (isAuthorized && userProfile) {
      currentUserProfile = userProfile;
      displayAuthenticatedView(currentUserProfile);
    } else {
      showAuthLoading(false);
      alert(
        "Acesso Não Autorizado\n\n" +
        "O e-mail (" + email + ") não está cadastrado na planilha de responsáveis autorizados.\n\n" +
        "Caso você seja um responsável de fábrica e precise de acesso, entre em contato com a equipe de Sistemas para liberar a permissão."
      );
      logoutUser();
    }
  }, (err) => {
    showAuthLoading(false);
    alert(
      "Falha na Comunicação com o Servidor\n\n" +
      "Não foi possível consultar a permissão do e-mail (" + email + ").\n\n" +
      "Verifique se a nova versão da API do Google Apps Script foi implantada."
    );
    logoutUser();
  });
}

/**
 * Atualiza a interface quando deslogado
 */
function handleUserLoggedOut() {
  currentUserProfile = null;
  showAuthLoading(false);

  const loginSec = document.getElementById("loginSection");
  const authSec = document.getElementById("authenticatedSection");

  if (loginSec) loginSec.style.display = "block";
  if (authSec) authSec.style.display = "none";
}

/**
 * Exibe/oculta a tela de carregamento (Overlay)
 */
function showAuthLoading(show, message) {
  const overlay = document.getElementById("loadingOverlay");
  const msgEl = document.getElementById("overlayMessage");
  const titleEl = document.getElementById("overlayStepTitle");

  if (show) {
    if (titleEl) titleEl.textContent = "Verificando Permissões...";
    if (msgEl) msgEl.textContent = message || "Carregando permissões e atividades pedagógicas da unidade...";
    if (overlay) overlay.classList.remove("hidden");
  } else {
    if (overlay) overlay.classList.add("hidden");
  }
}

/**
 * Exibe a visão autenticada e carrega os dropdowns institucionais
 */
function displayAuthenticatedView(profile) {
  const loginSec = document.getElementById("loginSection");
  const authSec = document.getElementById("authenticatedSection");

  if (loginSec) loginSec.style.display = "none";
  if (authSec) authSec.style.display = "block";

  const userDisplay = document.getElementById("userInfoDisplay");
  if (userDisplay) {
    userDisplay.textContent = profile.nome + " (" + profile.email + ")";
  }

  showAuthLoading(true, "Carregando atividades pedagógicas da unidade (" + profile.unidade + ")...");

  if (typeof callBackendAPI === "function") {
    callBackendAPI("getDropdownData", {}, (response) => {
      showAuthLoading(false);
      const hierarchy = response && response.hierarchy ? response.hierarchy : (response || {});
      restrictedHierarchy = hierarchy;
      populateRestrictedUnidades(profile);
    }, (err) => {
      showAuthLoading(false);
      alert("Aviso: Falha ao obter lista de atividades pedagógicas do servidor: " + err);
    });
  } else {
    showAuthLoading(false);
  }

  resetRestrictedDocsForm();
}

/**
 * Popula a lista de unidades na tela restrita
 */
function populateRestrictedUnidades(profile) {
  const unidadeSelect = document.getElementById("restritoUnidade");
  if (!unidadeSelect) return;

  unidadeSelect.innerHTML = '<option value="" disabled selected>Selecione a Unidade...</option>';

  Object.keys(restrictedHierarchy).forEach(key => {
    if (key !== "Fundação Casa") {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = key;
      unidadeSelect.appendChild(opt);
    }
  });

  if (profile.unidade && profile.unidade.toLowerCase() !== "todas") {
    unidadeSelect.value = profile.unidade;
    unidadeSelect.disabled = true;
  } else {
    unidadeSelect.disabled = false;
  }

  onRestrictedUnidadeChange();
}

function isJardimSaoLuis(unidadeName) {
  if (!unidadeName) return false;
  const norm = unidadeName.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return norm.includes("JARDIM SAO LUIS") || norm.includes("JARDIM SAO LUIZ") || norm.includes("SAO LUIS") || norm.includes("SAO LUIZ") || norm.includes("JSL");
}

function onRestrictedUnidadeChange() {
  const unidadeSelect = document.getElementById("restritoUnidade");
  const tipoSelect = document.getElementById("restritoTipoPedagogico");
  if (!tipoSelect) return;

  const selectedUnidade = unidadeSelect ? unidadeSelect.value : "";
  const isJSL = isJardimSaoLuis(selectedUnidade);

  const label = document.getElementById("restritoTipoLabel");
  if (label) {
    label.innerHTML = isJSL
      ? 'Trilha, Ateliê ou Núcleo de Moda? <span class="required">*</span>'
      : 'Trilha ou Ateliê? <span class="required">*</span>';
  }

  let nucleoOpt = Array.from(tipoSelect.options).find(opt => opt.value === "Núcleo de Moda");

  if (isJSL) {
    if (!nucleoOpt) {
      nucleoOpt = document.createElement("option");
      nucleoOpt.value = "Núcleo de Moda";
      nucleoOpt.textContent = "Núcleo de Moda";
      tipoSelect.appendChild(nucleoOpt);
    }
  } else {
    if (nucleoOpt) {
      if (tipoSelect.value === "Núcleo de Moda") {
        tipoSelect.value = "";
      }
      nucleoOpt.remove();
    }
  }

  updateRestrictedAtividadeDropdown();
}

function matchActivityType(itemType, selectedTipo) {
  if (!itemType || typeof itemType !== "string") return false;

  const typeNorm = itemType.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const selectedNorm = selectedTipo.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (selectedNorm.includes("moda")) {
    return typeNorm.includes("moda") || (typeNorm.includes("nucleo") && !typeNorm.includes("trilha") && !typeNorm.includes("atelie"));
  }

  if (selectedNorm.includes("trilha")) {
    return typeNorm.includes("trilha") && !typeNorm.includes("moda");
  }

  if (selectedNorm.includes("atelie")) {
    return typeNorm.includes("atelie") && !typeNorm.includes("moda");
  }

  return typeNorm.includes(selectedNorm) || selectedNorm.includes(typeNorm);
}

function updateRestrictedAtividadeDropdown() {
  const unidadeSelect = document.getElementById("restritoUnidade");
  const tipoSelect = document.getElementById("restritoTipoPedagogico");
  const atividadeSelect = document.getElementById("restritoAtividade");

  if (!atividadeSelect) return;

  const unidade = unidadeSelect ? unidadeSelect.value : "";
  const tipo = tipoSelect ? tipoSelect.value : "";

  if (!unidade || !tipo) {
    atividadeSelect.innerHTML = '<option value="" disabled selected>Selecione a Unidade e o Tipo primeiro...</option>';
    atividadeSelect.disabled = true;
    checkActivityDocsStatus();
    return;
  }

  const items = restrictedHierarchy[unidade] || [];
  atividadeSelect.innerHTML = '<option value="" disabled selected>Selecione a Atividade...</option>';

  let count = 0;
  items.forEach(item => {
    if (item && item.type && matchActivityType(item.type, tipo)) {
      const opt = document.createElement("option");
      opt.value = item.name;
      opt.textContent = item.name;
      atividadeSelect.appendChild(opt);
      count++;
    }
  });

  if (count > 0) {
    atividadeSelect.disabled = false;
  } else {
    atividadeSelect.innerHTML = '<option value="" disabled selected>Nenhuma atividade encontrada para este tipo.</option>';
    atividadeSelect.disabled = true;
  }

  checkActivityDocsStatus();
}

/**
 * Consulta no backend se a atividade já existe e se possui documentos pendentes
 */
function checkActivityDocsStatus() {
  const setor = document.getElementById("restritoSetor").value;
  const ano = document.getElementById("restritoAno").value;
  const mes = document.getElementById("restritoMes").value;
  const unidade = document.getElementById("restritoUnidade").value;
  const tipoPedagogico = document.getElementById("restritoTipoPedagogico") ? document.getElementById("restritoTipoPedagogico").value : "";
  const atividade = document.getElementById("restritoAtividade").value;

  const statusBox = document.getElementById("activityDocsStatus");
  const submitBtn = document.getElementById("submitDocsBtn");

  if (!setor || !ano || !mes || !unidade || !atividade) {
    if (statusBox) statusBox.style.display = "none";
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  if (statusBox) {
    statusBox.className = "status-box info";
    statusBox.textContent = "Verificando registros da atividade no sistema...";
    statusBox.style.display = "block";
  }

  callBackendAPI("checkActivityStatus", {
    setor: setor,
    anoReferencia: ano,
    mesReferencia: mes,
    unidade: unidade,
    tipoPedagogico: tipoPedagogico,
    atividade: atividade
  }, (response) => {
    const data = response ? (response.data || response) : {};
    if (response && response.success && typeof data.exists !== "undefined") {
      if (!data.exists) {
        if (statusBox) {
          statusBox.className = "status-box warning";
          statusBox.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align: text-bottom; margin-right: 6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>Atividade não localizada nos registros de relatórios pedagógicos deste mês/ano. O relatório inicial do educador precisa ser enviado primeiro.';
        }
        if (submitBtn) submitBtn.disabled = true;
      } else if (data.hasInscricao || data.hasPresenca) {
        if (statusBox) {
          statusBox.className = "status-box warning";
          statusBox.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align: text-bottom; margin-right: 6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>Os documentos (Inscrição e Presença) para esta atividade já foram enviados neste mês/ano. Não é permitido reenviar ou enviar duas vezes para a mesma atividade.';
        }
        if (submitBtn) submitBtn.disabled = true;
      } else {
        if (statusBox) {
          statusBox.className = "status-box success";
          statusBox.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align: text-bottom; margin-right: 6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>Atividade localizada! Por favor, anexe obrigatoriamente a Inscrição e a Presença para concluir o envio.';
        }
        if (submitBtn) submitBtn.disabled = false;
      }
    }
  }, (err) => {
    if (statusBox) {
      statusBox.className = "status-box error";
      statusBox.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align: text-bottom; margin-right: 6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Erro ao consultar atividade: ' + err;
    }
    if (submitBtn) submitBtn.disabled = true;
  });
}

/**
 * Envia os arquivos PDF de Inscrição e Presença para o backend
 */
function submitComplementaryDocs(event) {
  event.preventDefault();

  if (!currentUserProfile) {
    alert("Sessão expirada. Por favor, faça login novamente.");
    return;
  }

  const setor = document.getElementById("restritoSetor").value;
  const ano = document.getElementById("restritoAno").value;
  const mes = document.getElementById("restritoMes").value;
  const unidade = document.getElementById("restritoUnidade").value;
  const tipoPedagogico = document.getElementById("restritoTipoPedagogico") ? document.getElementById("restritoTipoPedagogico").value : "";
  const atividade = document.getElementById("restritoAtividade").value;

  const fileInscricaoElem = document.getElementById("fileInscricao");
  const filePresencaElem = document.getElementById("filePresenca");

  const fileInsc = fileInscricaoElem.files[0];
  const filePres = filePresencaElem.files[0];

  if (!fileInsc || !filePres) {
    alert("É obrigatório anexar AMBOS os arquivos PDF (Registro de Inscrição e Lista de Presença) antes de enviar.");
    return;
  }

  if (fileInsc && !isPdfFile(fileInsc)) {
    alert("O arquivo de Registro de Inscrição deve ser obrigatoriamente um documento em formato PDF.");
    return;
  }

  if (filePres && !isPdfFile(filePres)) {
    alert("O arquivo de Lista de Presença deve ser obrigatoriamente um documento em formato PDF.");
    return;
  }

  const submitBtn = document.getElementById("submitDocsBtn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando PDF...";
  }

  showAuthLoading(true, "Salvando arquivos PDF no Google Drive e atualizando a planilha de relatórios...");

  const promises = [];

  if (fileInsc) {
    promises.push(readFileAsBase64(fileInsc, "fileInscricao"));
  }
  if (filePres) {
    promises.push(readFileAsBase64(filePres, "filePresenca"));
  }

  Promise.all(promises).then((filesData) => {
    const payload = {
      userEmail: currentUserProfile.email,
      userName: currentUserProfile.nome,
      setor: setor,
      anoReferencia: ano,
      mesReferencia: mes,
      unidade: unidade,
      tipoPedagogico: tipoPedagogico,
      atividade: atividade,
      files: filesData
    };

    callBackendAPI("uploadComplementaryDocs", payload, (response) => {
      showAuthLoading(false);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar Documentos Complementares";
      }
      if (response && response.success) {
        showSuccessModal(unidade, atividade);
      } else {
        alert("Erro ao enviar documentos: " + (response ? response.message : "Resposta em branco do servidor."));
      }
    }, (err) => {
      showAuthLoading(false);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar Documentos Complementares";
      }
      alert("Erro de comunicação ao enviar documentos: " + err);
    });
  }).catch((err) => {
    showAuthLoading(false);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar Documentos Complementares";
    }
    alert("Erro na leitura local dos arquivos PDF: " + err);
  });
}

function showSuccessModal(unidade, atividade) {
  const modal = document.getElementById("successModal");
  const textEl = document.getElementById("successSummaryText");

  if (textEl) {
    textEl.textContent = `Os documentos da atividade "${atividade}" (${unidade}) foram gravados com sucesso nas subpastas do Google Drive e registrados na planilha do Pedagógico.`;
  }

  if (modal) {
    modal.style.display = "flex";
  }
}

function resetFormForNewSubmission() {
  const modal = document.getElementById("successModal");
  if (modal) modal.style.display = "none";

  resetRestrictedDocsForm();
  
  const atividadeSelect = document.getElementById("restritoAtividade");
  if (atividadeSelect) atividadeSelect.value = "";
  
  checkActivityDocsStatus();
}

function isPdfFile(file) {
  if (!file) return false;
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

function readFileAsBase64(file, typeKey) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        docType: typeKey,
        name: file.name,
        mimeType: "application/pdf",
        base64Data: reader.result
      });
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function resetRestrictedDocsForm() {
  const fileInsc = document.getElementById("fileInscricao");
  const filePres = document.getElementById("filePresenca");
  if (fileInsc) fileInsc.value = "";
  if (filePres) filePres.value = "";

  const anoSelect = document.getElementById("restritoAno");
  if (anoSelect) anoSelect.value = "";

  const mesSelect = document.getElementById("restritoMes");
  if (mesSelect) mesSelect.value = "";

  const tipoSelect = document.getElementById("restritoTipoPedagogico");
  if (tipoSelect) tipoSelect.value = "";

  const atividadeSelect = document.getElementById("restritoAtividade");
  if (atividadeSelect) {
    atividadeSelect.value = "";
    atividadeSelect.innerHTML = '<option value="" disabled selected>Selecione a Unidade e o Tipo primeiro...</option>';
    atividadeSelect.disabled = true;
  }

  const statusBox = document.getElementById("activityDocsStatus");
  if (statusBox) statusBox.style.display = "none";

  const submitBtn = document.getElementById("submitDocsBtn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Enviar Documentos Complementares";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
});
