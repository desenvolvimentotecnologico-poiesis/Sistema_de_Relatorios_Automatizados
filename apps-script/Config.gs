/**
 * CONFIGURAÇÕES GLOBAIS DO SISTEMA GOOGLE WORKSPACE
 * Contém os IDs das Planilhas de Listas, Planilhas de Respostas, Pasta do Drive e Templates do Docs.
 */

const CONFIG = {
  // ID da planilha que contém as configurações das listas suspensas (Cada aba é uma Unidade)
  SPREADSHEET_LISTS_ID: "1eOxCSiYSvCyXjt3RNTirnb0eE1HKUjNqmLS5l56Qzbo",
  
  // ID padrão da planilha de respostas (fallback)
  SPREADSHEET_RESPONSES_ID: "1DLyNwlkw0gXnXuPPTJVt3G0AXZ2VXSfG1wPz9NAwIUo",
  
  // IDs das planilhas de respostas individuais separadas por área
  SPREADSHEET_RESPONSES_PEDAGOGICO_ID: "1G_aZ_FNNkvONnAY7J_f4YUd70NP3haO6gfgf0e2Roqk",
  SPREADSHEET_RESPONSES_ARTICULACAO_ID: "159bCzFiz0l5Y0IG8NWWKxLFUU96tDQQEP49B7aJNdVc",
  SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID: "19JDB64DSN8VLE5mF1Ahylp-VYIbQJtpbCiYtI31TGG0",
  SPREADSHEET_RESPONSES_BIBLIOTECA_ID: "1HkKWImwK7DIFNYy1hnTDYmpEVDz3jDMjmfjfZ8aYyPU",
  
  // Nomes das 4 abas da Planilha de Respostas para cada setor correspondente
  SHEET_RESPONSES_PEDAGOGICO: "Pedagógico",
  SHEET_RESPONSES_ARTICULACAO: "Articulação e Difusão",
  SHEET_RESPONSES_FUNDACAO_CASA: "Fundação Casa",
  SHEET_RESPONSES_BIBLIOTECA: "Bibliotecas",

  // ID da pasta raiz no Google Drive onde os relatórios e anexos serão organizados (FÁBRICAS DE CULTURA)
  DRIVE_ROOT_FOLDER_ID: "1D9ByVQpDc-YRiP-DGyM-KovijBeTA0K5",

  // IDs dos 4 modelos do Google Docs que servirão de templates para cada frente
  DOC_TEMPLATE_PEDAGOGICO_ID: "19VnXNuEJ-I47iPPBSTyq4ZNS4tpL759neGD7FHmHewA",
  DOC_TEMPLATE_ARTICULACAO_ID: "1ArZaZ8p2YQQoLndIzIRauCBxjvAIvl6YN3SDYTRSPds",
  DOC_TEMPLATE_FUNDACAO_CASA_ID: "1Nnh4ptK6znL1CX3rMOJJQha-aWKArh8TSBNNIR911Q0",
  DOC_TEMPLATE_BIBLIOTECA_ID: "1LQDwMp1kVA-xAk539zN4Q64ExhLEO9nmZXcnRkUeeR8",
  
  // Nome institucional do sistema usado nos títulos e cabeçalhos
  SYSTEM_NAME: "Portal de Relatórios - Fábricas de Cultura"
};
