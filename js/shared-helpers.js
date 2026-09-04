/**
 * FUNCOES COMPARTILHADAS ENTRE main.js E auth.js
 * Regras de negocio identicas usadas tanto no formulario publico (Pedagogico)
 * quanto na Area Restrita, extraidas para evitar duplicacao e divergencia futura.
 */

function normalizeText(str) {
  if (!str) return "";
  return str.toString().trim().toUpperCase().normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/\s+/g, " ");
}

function isJardimSaoLuis(unidadeName) {
  if (!unidadeName) return false;
  const norm = unidadeName.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return norm.includes("JARDIM SAO LUIS") || norm.includes("JARDIM SAO LUIZ") || norm.includes("SAO LUIS") || norm.includes("SAO LUIZ") || norm.includes("JSL");
}

function isVilaNovaCachoeirinha(unidadeName) {
  if (!unidadeName) return false;
  const norm = unidadeName.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return norm.includes("CACHOEIRINHA") || norm.includes("VNC");
}

/**
 * Sincroniza uma <option> de valor fixo num <select>: cria (se ainda nao existir) quando
 * shouldExist e true, remove (limpando a selecao se estava nela) quando e false. Usada para somar
 * opcoes condicionais ao campo Tipo de Atividade (ex.: Folia 25/26 em Vila Nova Cachoeirinha)
 * tanto no formulario publico (main.js) quanto na Area Restrita (auth.js), sem duplicar a logica.
 */
function syncSelectOption(selectEl, optionValue, shouldExist) {
  let opt = Array.from(selectEl.options).find(o => o.value === optionValue);
  if (shouldExist) {
    if (!opt) {
      opt = document.createElement("option");
      opt.value = optionValue;
      opt.textContent = optionValue;
      selectEl.appendChild(opt);
    }
  } else if (opt) {
    if (selectEl.value === optionValue) {
      selectEl.value = "";
    }
    opt.remove();
  }
}

function matchActivityType(itemType, selectedTipo) {
  if (!itemType || typeof itemType !== "string") return false;

  // O \s+ -> " " colapsa espacos duplos/irregulares que sobrevivem na planilha (so passa por
  // .trim(), nas pontas) - sem isso, "Folia  25" (espaco duplo) nunca bateria com a opcao fixa
  // "Folia 25" na igualdade exata usada mais abaixo.
  const typeNorm = itemType.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
  const selectedNorm = selectedTipo.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

  if (selectedNorm.includes("ferias")) {
    return typeNorm.includes("ferias");
  }

  if (selectedNorm.includes("moda")) {
    return typeNorm.includes("moda") || (typeNorm.includes("nucleo") && !typeNorm.includes("trilha") && !typeNorm.includes("atelie") && !typeNorm.includes("ferias"));
  }

  if (selectedNorm.includes("trilha")) {
    return typeNorm.includes("trilha") && !typeNorm.includes("moda") && !typeNorm.includes("ferias");
  }

  if (selectedNorm.includes("atelie")) {
    return typeNorm.includes("atelie") && !typeNorm.includes("moda") && !typeNorm.includes("ferias");
  }

  // "Folia 25" / "Folia 26" (exclusivo de Vila Nova Cachoeirinha) exige igualdade exata com a
  // coluna A da planilha de atividades. O fallback generico logo abaixo (substring nos dois
  // sentidos) faria um eventual tipo "Folia" sem ano casar com a selecao "Folia 25" via
  // selectedNorm.includes(typeNorm) - este ramo evita esse falso positivo.
  if (selectedNorm.startsWith("folia")) {
    return typeNorm === selectedNorm;
  }

  return typeNorm.includes(selectedNorm) || selectedNorm.includes(typeNorm);
}
