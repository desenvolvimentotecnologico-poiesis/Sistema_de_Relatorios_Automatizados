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

function matchActivityType(itemType, selectedTipo) {
  if (!itemType || typeof itemType !== "string") return false;

  const typeNorm = itemType.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const selectedNorm = selectedTipo.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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
