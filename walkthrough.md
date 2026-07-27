# Roteiro Completo de Testes e Implantação (Conta Pessoal vs. Conta Empresa)

Este guia foi elaborado para acompanhá-lo em **duas fases de implantação**:
1. **FASE 1 (Homologação Pessoal)**: Testes completos usando seu Google Drive pessoal e sua conta pessoal da Vercel.
2. **FASE 2 (Produção Empresarial)**: Migração final para a conta da Vercel da empresa e os IDs das planilhas/pastas oficiais da organização.

---

## 🛠️ FASE 1: Homologação na Conta Pessoal (Passo a Passo)

### 1. Preparar a Estrutura no seu Google Drive Pessoal
Para realizar os testes sem afetar os dados da empresa:
1. No seu Google Drive pessoal, crie uma **Pasta Raiz** para o teste (ex: `[TESTE] Fábricas de Cultura`). Copie o ID dessa pasta (está na URL da pasta: `drive.google.com/drive/folders/ID_AQUI`).
2. Crie uma **Planilha de Teste** no Google Sheets para receber as respostas. Copie o ID dessa planilha.
3. Crie ou use uma planilha de listas suspensas (Unidades/Atividades) e copie seu ID.
4. Crie um modelo de documento no Google Docs contendo as tags (ex: `{{UNIDADE}}`, `{{ATIVIDADE}}`, `{{RESPONSAVEL}}`, `{{ANEXOS}}`) para servir de template. Copie seu ID.

---

### 2. Configurar o Google Apps Script Pessoal
1. Acesse [script.google.com](https://script.google.com/) logado na sua **conta pessoal do Google**.
2. Clique em **Novo projeto**.
3. Copie o conteúdo dos 6 arquivos da pasta local `apps-script/`:
   - `Code.gs`
   - `Config.gs`
   - `Drive.gs`
   - `Report.gs`
   - `Sheets.gs`
   - `Utils.gs`
4. No arquivo `Config.gs`, cole os IDs pessoais que você criou na etapa 1:
   ```javascript
   const CONFIG = {
     SPREADSHEET_LISTS_ID: "ID_DA_SUA_PLANILHA_DE_LISTAS_PESSOAL",
     SPREADSHEET_RESPONSES_ID: "ID_DA_SUA_PLANILHA_DE_RESPOSTAS_PESSOAL",
     SPREADSHEET_RESPONSES_PEDAGOGICO_ID: "ID_DA_SUA_PLANILHA_DE_RESPOSTAS_PESSOAL",
     SPREADSHEET_RESPONSES_ARTICULACAO_ID: "ID_DA_SUA_PLANILHA_DE_RESPOSTAS_PESSOAL",
     SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID: "ID_DA_SUA_PLANILHA_DE_RESPOSTAS_PESSOAL",
     SPREADSHEET_RESPONSES_BIBLIOTECA_ID: "ID_DA_SUA_PLANILHA_DE_RESPOSTAS_PESSOAL",
     DRIVE_ROOT_FOLDER_ID: "ID_DA_SUA_PASTA_RAIZ_PESSOAL",
     DOC_TEMPLATE_PEDAGOGICO_ID: "ID_DO_SEU_TEMPLATE_PESSOAL",
     DOC_TEMPLATE_ARTICULACAO_ID: "ID_DO_SEU_TEMPLATE_PESSOAL",
     DOC_TEMPLATE_FUNDACAO_CASA_ID: "ID_DO_SEU_TEMPLATE_PESSOAL",
     DOC_TEMPLATE_BIBLIOTECA_ID: "ID_DO_SEU_TEMPLATE_PESSOAL",
     SYSTEM_NAME: "Portal de Relatórios (Ambiente de Testes)"
   };
   ```
5. Clique no botão azul **Implantar -> Nova implantação**:
   - **Selecionar tipo**: App da Web
   - **Descrição**: Teste Pessoal v1
   - **Executar como**: *Você (sua conta pessoal)*
   - **Quem tem acesso**: *Qualquer pessoa (Anyone)*
6. Clique em **Implantar** (conceda as permissões do Google se solicitado).
7. Copie a **URL do app da Web** gerada (termina em `/exec`).

---

### 3. Conectar a URL no Frontend Local
1. Abra o arquivo local `js/api.js`.
2. Substitua a constante `GAS_API_URL` pela URL que você acabou de copiar:
   ```javascript
   const GAS_API_URL = "SUA_URL_PESSOAL_DO_APPS_SCRIPT_AQUI/exec";
   ```

---

### 4. Deploy no seu GitHub e Vercel Pessoal
1. No seu terminal (ou Git Bash), na pasta `relatorio-poiesis`:
   ```bash
   git init
   git add .
   git commit -m "Versão de teste pessoal Vercel"
   ```
2. Crie um repositório no seu **GitHub pessoal** (ex: `relatorio-poiesis-teste`) e faça o envio:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/relatorio-poiesis-teste.git
   git branch -M main
   git push -u origin main
   ```
3. Acesse a **Vercel** (`vercel.com`) com sua conta pessoal.
4. Clique em **Add New -> Project**, escolha o repositório `relatorio-poiesis-teste` e clique em **Deploy**.
5. Em segundos, sua URL pessoal da Vercel estará ativa!

---

### 5. Roteiro de Testes Recomendados
Faça os seguintes testes pelo computador e pelo seu **celular**:
- [ ] **Teste de Acesso Móbile**: Abra o link da Vercel no celular (iOS/Android) e verifique que a tela carrega sem pedir login do Google nem abrir em iFrame.
- [ ] **Teste de Câmera**: Entre em um formulário (ex: Pedagógico), clique no campo de anexo e tire uma foto diretamente pela câmera do celular.
- [ ] **Teste de Envios de Fotos Múltiplas**: Tire 3 ou 4 fotos em alta resolução. Observe se o compressor reduz as fotos e se o envio ocorre rapidamente.
- [ ] **Validação no Sheets**: Abra sua planilha no Google Drive e confirme se a nova linha foi salva corretamente na aba da área.
- [ ] **Validação no Drive e PDF**: Abra sua pasta no Drive e confirme a criação automática da pasta da atividade, salvamento das fotos e geração do PDF formatado a partir do Docs.

---

## 🏢 FASE 2: Transição para a Conta da Empresa (Produção)

Após validar 100% o funcionamento no ambiente pessoal:

1. **Atualizar IDs no Apps Script da Empresa**:
   - Abra o Google Apps Script na **conta Google da empresa**.
   - No `Config.gs`, insira os IDs **oficiais e definitivos** das planilhas, pastas e templates da instituição.
   - Faça a **Nova Implantação** no Apps Script institucional e copie a URL oficial de produção.

2. **Repositório da Empresa**:
   - Crie o repositório oficial na organização da empresa no GitHub (ex: `empresa/relatorio-poiesis-oficial`).
   - Atualize a URL oficial em `js/api.js`.
   - Faça o `git push` para o repositório da empresa.

3. **Deploy na Vercel da Empresa**:
   - Logue na conta Vercel da empresa (Pacote Pro).
   - Importe o repositório oficial da empresa e publique em domínio definitivo (ex: `relatorios.suaempresa.com.br`).
