/**
 * MÓDULO DE AUTENTICAÇÃO FIREBASE E GERENCIAMENTO DE ÁREA RESTRITA (PEDAGÓGICO)
 * Permite que responsáveis autorizados façam login via Google e enviem
 * documentos complementares (Inscrição e Presença - apenas 1 PDF cada) por atividade.
 */

// Configuração do Firebase Project (Pode ser atualizada com as chaves reais do Console)
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
 * Inicializa os serviços do Firebase
 */
function initFirebase() {
  if (typeof firebase !== "undefined" && !firebase.apps.length) {
    try {
      firebaseApp = firebase.initializeApp(firebaseConfig);
      firebaseAuth = firebase.auth();

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
    alert("Firebase Auth ainda não foi configurado. Por favor, insira as chaves do Firebase Console no arquivo js/auth.js.");
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  firebaseAuth.signInWithPopup(provider)
    .then((result) => {
      handleUserLoggedIn(result.user);
    })
    .catch((error) => {
      console.error("Erro na autenticação do Firebase:", error);
      if (error.code === "auth/unauthorized-domain") {
        alert("Domínio não autorizado no Firebase Console. Adicione a URL do seu site no painel do Firebase Authentication (Configurações > Domínios Autorizados).");
      } else {
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
  showAuthLoading(true, "Verificando permissões do e-mail " + email + "...");

  callBackendAPI("verifyUserAccess", { email: email }, (response) => {
    showAuthLoading(false);
    const isAuthorized = response && response.success && (response.authorized === true || (response.data && response.data.authorized === true));
    const userProfile = response ? (response.user || (response.data && response.data.user)) : null;

    if (isAuthorized && userProfile) {
      currentUserProfile = userProfile;
      showRestrictedAreaModal(currentUserProfile);
    } else {
      const msg = response && response.message ? response.message : "";
      alert(
        "🚫 Acesso Não Autorizado\n\n" +
        "O e-mail (" + email + ") não está cadastrado na planilha de responsáveis autorizados.\n\n" +
        "Caso você seja um responsável de fábrica e precise de acesso, entre em contato com a equipe de Sistemas para liberar a permissão."
      );
      logoutUser();
    }
  }, (err) => {
    showAuthLoading(false);
    alert(
      "⚠️ Falha na Comunicação com o Servidor\n\n" +
      "Não foi possível consultar a permissão do e-mail (" + email + ").\n\n" +
      "Motivo provável: A nova versão da API do Google Apps Script precisa ser implantada em Produção/Homologação.\n\n" +
      "Siga a instrução no Apps Script: Clique em 'Implantar' ➔ 'Gerenciar implantações' ➔ 'Editar' ➔ Escolha 'Nova versão' ➔ 'Implantar'."
    );
    logoutUser();
  });
}

/**
 * Atualiza o estado da interface ao deslogar
 */
function handleUserLoggedOut() {
  currentUserProfile = null;
  const modal = document.getElementById("restrictedAreaModal");
  if (modal) modal.style.display = "none";
}

/**
 * Exibe/oculta o indicador de carregamento
 */
function showAuthLoading(show, message) {
  const statusElem = document.getElementById("authStatusMessage");
  if (statusElem) {
    statusElem.textContent = message || "";
    statusElem.style.display = show ? "block" : "none";
  }
}

/**
 * Abre o Modal da Área Restrita e carrega os dropdowns de Unidade e Atividade
 */
function showRestrictedAreaModal(profile) {
  const modal = document.getElementById("restrictedAreaModal");
  if (!modal) return;
  modal.style.display = "flex";

  const userDisplay = document.getElementById("userInfoDisplay");
  if (userDisplay) {
    userDisplay.textContent = profile.nome + " (" + profile.email + ")";
  }

  // Carrega as listas institucionais de Pedagógico para popular os selects
  if (typeof callBackendAPI === "function") {
    callBackendAPI("getDropdownData", {}, (response) => {
      const hierarchy = response && response.hierarchy ? response.hierarchy : (response || {});
      restrictedHierarchy = hierarchy;
      populateRestrictedUnidades(profile);
    });
  }

  resetRestrictedDocsForm();
}

/**
 * Popula a lista de unidades no modal restrito
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
  const norm = unidadeName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return norm.includes("JARDIM SAO LUIS") || norm.includes("JARDIM SAO LUIZ");
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
    atividade: atividade
  }, (response) => {
    const data = response ? (response.data || response) : {};
    if (response && response.success && typeof data.exists !== "undefined") {
      if (!data.exists) {
        if (statusBox) {
          statusBox.className = "status-box warning";
          statusBox.textContent = "⚠️ Atividade não localizada nos registros de relatórios pedagógicos. O relatório inicial do educador precisa ser enviado primeiro.";
        }
        if (submitBtn) submitBtn.disabled = true;
      } else {
        if (statusBox) {
          statusBox.className = "status-box success";
          let text = "✅ Atividade localizada! Documentos no sistema:";
          text += data.hasInscricao ? " [Inscrição: ENVIADO]" : " [Inscrição: PENDENTE]";
          text += data.hasPresenca ? " [Presença: ENVIADO]" : " [Presença: PENDENTE]";
          statusBox.textContent = text;
        }
        if (submitBtn) submitBtn.disabled = false;
      }
    }
  }, (err) => {
    if (statusBox) {
      statusBox.className = "status-box error";
      statusBox.textContent = "Erro ao consultar atividade: " + err;
    }
    if (submitBtn) submitBtn.disabled = true;
  });
}

/**
 * Envia os arquivos PDF de Inscrição e/ou Presença para o backend
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
  const atividade = document.getElementById("restritoAtividade").value;

  const fileInscricaoElem = document.getElementById("fileInscricao");
  const filePresencaElem = document.getElementById("filePresenca");

  const fileInsc = fileInscricaoElem.files[0];
  const filePres = filePresencaElem.files[0];

  if (!fileInsc && !filePres) {
    alert("Selecione ao menos um arquivo em formato PDF (Inscrição ou Presença) para enviar.");
    return;
  }

  // Validação estrita: apenas 1 arquivo em formato PDF por campo
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
      atividade: atividade,
      files: filesData
    };

    callBackendAPI("uploadComplementaryDocs", payload, (response) => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar Documentos Complementares";
      }
      if (response && response.success) {
        alert("Documentos PDF anexados e planilha atualizada com sucesso!");
        resetRestrictedDocsForm();
        checkActivityDocsStatus();
      } else {
        alert("Erro ao enviar documentos: " + (response ? response.message : "Resposta em branco do servidor."));
      }
    }, (err) => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar Documentos Complementares";
      }
      alert("Erro de comunicação ao enviar documentos: " + err);
    });
  }).catch((err) => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar Documentos Complementares";
    }
    alert("Erro na leitura local dos arquivos PDF: " + err);
  });
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
  const statusBox = document.getElementById("activityDocsStatus");
  if (statusBox) statusBox.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
});
