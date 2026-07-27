# Portal de Relatórios Poiesis & Fábricas de Cultura (Versão Vercel + Google Apps Script)

Sistema de Relatórios Mensais reestruturado com frontend **HTML/JS estático para hospedagem na Vercel** e backend **Google Apps Script Headless** integrado ao Google Sheets, Drive e Docs.

---

## 📁 Estrutura de Pastas do Projeto Remodelado

```
relatorio-poiesis-vercel/
├── apps-script/                    # Backend Headless (Cole no Google Apps Script)
│   ├── Code.gs                     # API Router HTTP (doPost e doGet)
│   ├── Config.gs                   # IDs das planilhas, pasta raiz do Drive e modelos Docs
│   ├── Drive.gs                    # Criação hierárquica de pastas e upload de fotos
│   ├── Report.gs                   # Edição do modelo no Docs e conversão para PDF
│   ├── Sheets.gs                  # Leitura de listas e salvamento das linhas
│   └── Utils.gs                    # Funções auxiliares de formatação
│
├── css/
│   └── styles.css                  # Estilos corporativos unificados e responsivos
│
├── forms/                          # Formulários Modulares por Setor
│   ├── pedagogico.html             # Módulo Pedagógico
│   ├── articulacao.html            # Módulo Articulação e Difusão
│   ├── fundacao-casa.html          # Módulo Fundação CASA
│   └── biblioteca.html             # Módulo Bibliotecas
│
├── js/
│   ├── api.js                      # Conector fetch para o Apps Script
│   ├── image-compressor.js         # Compressor client-side de fotos móbile (Canvas)
│   └── main.js                     # Controlador de dropdowns, formulários e modal
│
├── index.html                      # Menu principal de seleção de área
├── logo-fabricas.png               # Imagem da logomarca institucional
├── vercel.json                     # Configuração de rotas limpas na Vercel
└── README.md                       # Manual de instalação e deploy
```

---

## 🚀 Passo a Passo para Implantação em Produção

### Etapa 1: Configurar e Implantar o Google Apps Script (Backend)
1. Acesse o [Google Apps Script](https://script.google.com/).
2. Crie ou abra o projeto de script vinculado à sua planilha.
3. Copie o conteúdo dos 6 arquivos da pasta `apps-script/` (`Code.gs`, `Config.gs`, `Drive.gs`, `Report.gs`, `Sheets.gs`, `Utils.gs`).
4. No arquivo `Config.gs`, certifique-se de preencher os IDs reais das suas planilhas e pastas do Drive.
5. Clique em **Implantar -> Nova implantação**:
   - **Tipo**: App da Web
   - **Executar como**: *Você (sua conta institucional)*
   - **Quem tem acesso**: *Qualquer pessoa (Anyone)*
6. Clique em **Implantar** e copie a **URL do App da Web** gerada (ex: `https://script.google.com/macros/s/.../exec`).

---

### Etapa 2: Atualizar a URL no Frontend
1. Abra o arquivo `js/api.js`.
2. Cole a URL obtida na constante `GAS_API_URL`:
   ```javascript
   const GAS_API_URL = "SUA_URL_DO_APPS_SCRIPT_AQUI/exec";
   ```

---

### Etapa 3: Subir no GitHub e Publicar na Vercel
1. Inicialize o Git na pasta raiz do projeto:
   ```bash
   git init
   git add .
   git commit -m "Projeto remodelado Poiesis para Vercel"
   ```
2. Crie um repositório no seu GitHub e envie o código (`git push`).
3. Acesse o painel da **Vercel** (`vercel.com`).
4. Clique em **Add New -> Project**, selecione o repositório do GitHub e clique em **Deploy**.
5. Pronto! Seu aplicativo estará no ar em segundos com URL própria (ex: `https://seu-projeto.vercel.app`), com carregamento instantâneo e total suporte a celulares.
