/**
 * CONFIGURAÇÕES GLOBAIS DO SISTEMA GOOGLE WORKSPACE
 * Contém os IDs das Planilhas de Listas, Planilhas de Respostas, Pasta do Drive e Templates do Docs.
 */

const CONFIG = {
  // ID da planilha que contém as configurações das listas suspensas (Cada aba é uma Unidade)
  SPREADSHEET_LISTS_ID: "INSIRA_O_ID_DA_PLANILHA_DE_LISTAS_AQUI",
  
  // ID padrão da planilha de respostas (fallback)
  SPREADSHEET_RESPONSES_ID: "INSIRA_O_ID_DA_PLANILHA_DE_RESPOSTAS_GERAL_AQUI",
  
  // IDs das planilhas de respostas individuais separadas por área
  SPREADSHEET_RESPONSES_PEDAGOGICO_ID: "INSIRA_O_ID_DA_PLANILHA_PEDAGOGICO_AQUI",
  SPREADSHEET_RESPONSES_ARTICULACAO_ID: "INSIRA_O_ID_DA_PLANILHA_ARTICULACAO_AQUI",
  SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID: "INSIRA_O_ID_DA_PLANILHA_FUNDACAO_CASA_AQUI",
  SPREADSHEET_RESPONSES_BIBLIOTECA_ID: "INSIRA_O_ID_DA_PLANILHA_BIBLIOTECA_AQUI",
  
  // Nomes das 4 abas da Planilha de Respostas para cada setor correspondente
  SHEET_RESPONSES_PEDAGOGICO: "Pedagógico",
  SHEET_RESPONSES_ARTICULACAO: "Articulação e Difusão",
  SHEET_RESPONSES_FUNDACAO_CASA: "Fundação Casa",
  SHEET_RESPONSES_BIBLIOTECA: "Bibliotecas",

  // ID da pasta raiz no Google Drive onde os relatórios e anexos serão organizados
  DRIVE_ROOT_FOLDER_ID: "INSIRA_O_ID_DA_PASTA_RAIZ_DO_DRIVE_AQUI",

  // IDs dos 4 modelos do Google Docs que servirão de templates para cada frente
  DOC_TEMPLATE_PEDAGOGICO_ID: "INSIRA_O_ID_DO_TEMPLATE_PEDAGOGICO_AQUI",
  DOC_TEMPLATE_ARTICULACAO_ID: "INSIRA_O_ID_DO_TEMPLATE_ARTICULACAO_AQUI",
  DOC_TEMPLATE_FUNDACAO_CASA_ID: "INSIRA_O_ID_DO_TEMPLATE_FUNDACAO_CASA_AQUI",
  DOC_TEMPLATE_BIBLIOTECA_ID: "INSIRA_O_ID_DO_TEMPLATE_BIBLIOTECA_AQUI",
  
  // Nome institucional do sistema usado nos títulos e cabeçalhos
  SYSTEM_NAME: "SRA - Sistema de Relatórios Automatizados"
};
