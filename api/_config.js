/**
 * CONFIGURAÇÃO GLOBAL DAS VARIÁVEIS DE AMBIENTE DA VERCEL
 * Mapeia todos os IDs das planilhas, pastas do Drive, templates do Google Docs e fallbacks gerais.
 */

module.exports = {
  // Planilha de listas suspensas institucionais e unidades
  SPREADSHEET_LISTS_ID: process.env.SPREADSHEET_LISTS_ID || "",

  // Planilha exclusiva da lista branca de usuários autorizados
  SPREADSHEET_USERS_ID: process.env.SPREADSHEET_USERS_ID || process.env.SPREADSHEET_LISTS_ID || "",

  // Planilha padrão de respostas (fallback geral)
  SPREADSHEET_RESPONSES_ID: process.env.SPREADSHEET_RESPONSES_ID || "",

  // Planilhas individuais de respostas por setor
  SPREADSHEET_RESPONSES_PEDAGOGICO_ID: process.env.SPREADSHEET_RESPONSES_PEDAGOGICO_ID || process.env.SPREADSHEET_RESPONSES_ID || "",
  SPREADSHEET_RESPONSES_ARTICULACAO_ID: process.env.SPREADSHEET_RESPONSES_ARTICULACAO_ID || process.env.SPREADSHEET_RESPONSES_ID || "",
  SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID: process.env.SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID || process.env.SPREADSHEET_RESPONSES_ID || "",
  SPREADSHEET_RESPONSES_BIBLIOTECA_ID: process.env.SPREADSHEET_RESPONSES_BIBLIOTECA_ID || process.env.SPREADSHEET_RESPONSES_ID || "",

  // Pasta raiz no Google Drive
  DRIVE_ROOT_FOLDER_ID: process.env.DRIVE_ROOT_FOLDER_ID || process.env.DRIVE_FABRICAS_FOLDER_ID || "",

  // Modelos do Google Docs por setor
  DOC_TEMPLATE_PEDAGOGICO_ID: process.env.DOC_TEMPLATE_PEDAGOGICO_ID || "",
  DOC_TEMPLATE_ARTICULACAO_ID: process.env.DOC_TEMPLATE_ARTICULACAO_ID || "",
  DOC_TEMPLATE_FUNDACAO_CASA_ID: process.env.DOC_TEMPLATE_FUNDACAO_CASA_ID || "",
  DOC_TEMPLATE_BIBLIOTECA_ID: process.env.DOC_TEMPLATE_BIBLIOTECA_ID || ""
};
