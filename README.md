# SRA — Sistema de Relatórios Automatizados

Documentação técnica oficial de arquitetura, desenvolvimento e operação do **SRA (Sistema de Relatórios Automatizados)** para o **Instituto Poiesis** e as **Fábricas de Cultura**.

---

## 1. Visão Geral (Overview)

O **SRA (Sistema de Relatórios Automatizados)** é uma plataforma web Serverless/Headless projetada para padronizar, validar e automatizar a coleta de indicadores operacionais e a emissão documental de relatórios mensais de prestação de contas das Fábricas de Cultura. 

O sistema substitui o fluxo legado de compilação manual de arquivos por um ecossistema desacoplado que executa triagem de dados client-side, compressores de mídia nativos via Canvas API, registro estruturado em banco de dados no Google Sheets, governança hierárquica de arquivos no Google Drive e geração determinística de relatórios documentais em Google Docs e PDF.

---

## 2. Arquitetura e Decisões Técnicas

O projeto foi construído sob uma **arquitetura Serverless Jamstack desacoplada**, dividida estritamente em duas camadas: **Frontend Estático (Edge CDN)** e **Backend Headless (Google Workspace REST Adapter)**.

```
┌─────────────────────────────────────────────────────────┐
│              FRONTEND ESTÁTICO (Jamstack)               │
│        Hosted on Vercel Edge Global Network (CDN)        │
│                                                         │
│   HTML5 / CSS3 Tokens  ──►  Client-Side Compression      │
│                              (Canvas API Web Worker)    │
└────────────────────────────┬────────────────────────────┘
                             │
                  HTTP POST / GET (JSON payload)
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│            BACKEND HEADLESS (Apps Script API)           │
│             Execution Context: America/Sao_Paulo        │
│                                                         │
│  Code.gs (HTTP Router) ──►  Sheets.gs (Google Sheets)   │
│                        ├──► Drive.gs (Google Drive)     │
│                        └──► Report.gs (Docs ➔ PDF)      │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌───────────────────────────────────────────────────────┐
 │               GOOGLE WORKSPACE STORAGE                │
 │  Google Sheets (Aba de Registros + _LOGS Auditoria)  │
 │  Google Drive  (Estrutura de Pastas e PDFs de Envio)  │
 │  Google Docs   (Templates Dinâmicos de Impressão)    │
 └───────────────────────────────────────────────────────┘
```

### Justificativas Arquiteturais:

- **Zero Lock-in de Servidores Pagos (Custo Zero de Infraestrutura):** A utilização da Vercel Edge Network combinada ao runtime Serverless do Google Apps Script elimina custos fixos com máquinas virtuais, bancos de dados relacionais e serviços de storage.
- **Processamento de Mídia Client-Side (Offloading):** A compressão de imagens via Canvas API (`ImageCompressor.compressFile`) é realizada diretamente no navegador do usuário antes da transmissão HTTP. Isso reduz em até 85% o payload transferido e contorna o limite nativo de requisição HTTP (50MB) do Google Apps Script.
- **Substituição Segura de Placeholders (`safeReplaceText`):** Proteção contra falhas de parsing ao enviar caracteres reservados de regex (como `$`, ex: "R$ 500,00").
- **Sanitização de Chaves no CacheService (`sanitizeCacheKey`):** Conformidade estrita com o limite de 250 caracteres ASCII do Google Apps Script para cache de subpastas do Drive por até 6 horas.
- **Fuso Horário Brasília (`America/Sao_Paulo`):** Todas as operações de timestamp e formatação de datas utilizam explicitamente o fuso horário oficial `America/Sao_Paulo` para garantir auditoria temporal sem divergências de servidor.

### 2.1 Módulo de Autenticação e Controle de Acesso Restrito (Firebase + Lista Branca)

Para o envio de documentos complementares de prestação de contas (Lista de Presença e Registro de Inscrição por atividade), o sistema conta com uma camada de segurança baseada em **Firebase Authentication (Google Identity Provider)** integrada a uma **Lista Branca no Google Sheets**.

#### Fluxo Operacional de Autenticação:
1. **Autenticação:** O responsável da fábrica realiza login via Google Auth Provider (`@poiesis.org.br`).
2. **Autorização (Lista Branca):** O frontend envia a credencial para a API do Google Apps Script (`verifyUserAccess`), que realiza a consulta server-side na aba `Responsaveis_Autorizados` da Planilha Institucional.
3. **Validação de Registro:** O sistema verifica se o formulário primário da atividade já foi gravado no Sheets e se a pasta da atividade existe no Drive (`checkActivityStatus`).
4. **Governança de Documentos:** Os arquivos de Inscrição e Presença são destinados automaticamente às subpastas `📁 Relação de Inscritos` e `📁 Lista de Presença` no Drive, e as colunas auditáveis (`Inscrição Enviada`, `Presença Enviada`, `Atualizado Por`, `Data/Hora Atualização`) são gravadas na planilha (`uploadComplementaryDocs`).

---

## 3. Pré-requisitos

Para ambiente de desenvolvimento local e manutenção do projeto, são recomendadas as seguintes ferramentas:

| Ferramenta / Dependência | Versão Recomendada | Finalidade |
| :--- | :--- | :--- |
| **Node.js** | `>= 18.x.x` | Gerenciamento de runtime e execução de ferramentas de CLI |
| **npm / pnpm** | `>= 9.x.x` | Gerenciador de pacotes local |
| **Vercel CLI** | `>= 33.x.x` | Simulação de ambiente de produção e deploy local |
| **Navegador Web** | Chrome `>= 115`, Firefox `>= 115`, Safari `>= 16.5` | Suporte nativo a ES6+, CSS Grid `:has()` e Canvas API |
| **Conta Google Workspace** | Institucional | Acesso às APIs do Google Sheets, Drive e Docs |
| **Firebase Console** | Projeto Ativo | Autenticação Google OAuth para Responsáveis de Fábrica |

---

## 4. Variáveis de Ambiente e Configuração

O backend em Google Apps Script centraliza suas constantes e variáveis institucionais de ambiente no arquivo `apps-script/Config.gs`.

### Variáveis do Backend (`apps-script/Config.gs`)

| Variável | Tipo | Descrição | Exemplo de Valor / Pattern |
| :--- | :--- | :--- | :--- |
| `SPREADSHEET_LISTS_ID` | `String` | ID da planilha que contém as listas suspensas institucionais | `'1A2b3C4d5E6f7G8h9I0j'` |
| `SPREADSHEET_USERS_ID` | `String` | ID da planilha de lista branca de usuários autorizados | `'1A2b3C4d5E6f7G8h9I0j'` |
| `SPREADSHEET_RESPONSES_ID` | `String` | ID padrão da planilha de respostas (fallback) | `'1A2b3C4d5E6f7G8h9I0j'` |
| `SPREADSHEET_RESPONSES_PEDAGOGICO_ID` | `String` | ID da planilha de respostas do Pedagógico | `'1A2b3C4d5E6f7G8h9I0j'` |
| `SPREADSHEET_RESPONSES_ARTICULACAO_ID`| `String` | ID da planilha de respostas de Articulação | `'1A2b3C4d5E6f7G8h9I0j'` |
| `SPREADSHEET_RESPONSES_FUNDACAO_CASA_ID`| `String` | ID da planilha de respostas da Fundação CASA | `'1A2b3C4d5E6f7G8h9I0j'` |
| `SPREADSHEET_RESPONSES_BIBLIOTECA_ID` | `String` | ID da planilha de respostas da Biblioteca | `'1A2b3C4d5E6f7G8h9I0j'` |
| `DRIVE_ROOT_FOLDER_ID` | `String` | ID da Pasta Raiz no Google Drive para armazenamento institucional | `'1A2b3C4d5E6f7G8h9I0j'` |
| `DOC_TEMPLATE_PEDAGOGICO_ID` | `String` | ID do arquivo modelo (Template) no Google Docs para Pedagógico | `'1Nnh4ptK6znL1CX3rMOJJQha-sample'` |
| `DOC_TEMPLATE_ARTICULACAO_ID`| `String` | ID do arquivo modelo (Template) no Google Docs para Articulação | `'1Nnh4ptK6znL1CX3rMOJJQha-sample'` |
| `DOC_TEMPLATE_FUNDACAO_CASA_ID`| `String` | ID do arquivo modelo (Template) no Google Docs para Fundação CASA | `'1Nnh4ptK6znL1CX3rMOJJQha-sample'` |
| `DOC_TEMPLATE_BIBLIOTECA_ID` | `String` | ID do arquivo modelo (Template) no Google Docs para Biblioteca | `'1Nnh4ptK6znL1CX3rMOJJQha-sample'` |

### Variáveis do Frontend (`js/api.js` e `js/auth.js`)

| Constant | Tipo | Descrição | Exemplo / Placeholder |
| :--- | :--- | :--- | :--- |
| `GAS_API_URL_HOMOLOG` | `String` | Endpoint público do Apps Script para ambiente de Homologação / Localhost | `'https://script.google.com/macros/s/AKfycb.../exec'` |
| `GAS_API_URL_PROD` | `String` | Endpoint público do Apps Script para ambiente de Produção | `'https://script.google.com/macros/s/AKfycb.../exec'` |
| `firebaseConfig.apiKey` | `String` | Chave de API pública do Firebase Auth | `'AIzaSy...'` |
| `firebaseConfig.authDomain` | `String` | Domínio do app Firebase | `'sra-acessos.firebaseapp.com'` |
| `firebaseConfig.projectId` | `String` | ID do projeto no Firebase Console | `'sra-acessos'` |

---

## 5. Documentação da API REST (Google Apps Script)

Todas as requisições utilizam o método `POST` enviando um payload JSON estruturado com a propriedade `action`.

### 5.1 Endpoints e Ações Suportadas

#### 1. `action: "getDropdownData"`
- **Descrição:** Obtém a hierarquia completa de listas suspensas (Unidades, Cursos, Divisões Regionais) a partir do Google Sheets.
- **Payload:** `{ "action": "getDropdownData", "forceRefresh": false }`
- **Retorno:** `{ "success": true, "message": "Listas obtidas com sucesso", "hierarchy": { ... } }`

#### 2. `action: "submitForm"` (Etapa 1)
- **Descrição:** Cria a estrutura de pastas no Drive, realiza o upload dos anexos comprimidos e salva os dados na planilha correspondente à área.
- **Payload:** `{ "action": "submitForm", "formData": { "unidade": "...", "atividade": "...", "setor": "...", ... } }`
- **Retorno:** `{ "success": true, "sheetName": "...", "rowNumber": 10, "relatorioFolderId": "...", "registroFolderId": "..." }`

#### 3. `action: "generatePdfReportAsync"` (Etapa 2)
- **Descrição:** Clona o modelo do Google Docs, realiza a substituição dos placeholders (`safeReplaceText`), insere as evidências em grade 2 colunas e compila o PDF.
- **Payload:** `{ "action": "generatePdfReportAsync", "relatorioFolderId": "...", "registroFolderId": "...", "area": "...", "formData": { ... } }`
- **Retorno:** `{ "success": true, "pdfUrl": "https://drive.google.com/...", "docUrl": "https://docs.google.com/..." }`

#### 4. `action: "verifyUserAccess"`
- **Descrição:** Valida o e-mail do usuário autenticado no Firebase contra a lista branca da aba `Responsaveis_Autorizados`.
- **Payload:** `{ "action": "verifyUserAccess", "email": "usuario@poiesis.org.br" }`
- **Retorno:** `{ "success": true, "authorized": true, "user": { "nome": "...", "unidade": "..." } }`

#### 5. `action: "checkActivityStatus"`
- **Descrição:** Consulta se a atividade pedagógica já possui registro inicial e se os anexos complementares (Inscrição/Presença) foram submetidos.
- **Payload:** `{ "action": "checkActivityStatus", "setor": "Pedagógico", "anoReferencia": "2026", "mesReferencia": "05", "unidade": "...", "atividade": "..." }`
- **Retorno:** `{ "success": true, "exists": true, "hasInscricao": false, "hasPresenca": false }`

#### 6. `action: "uploadComplementaryDocs"`
- **Descrição:** Salva os arquivos PDF de Inscrição e Presença nas subpastas apropriadas do Google Drive e atualiza a planilha auditável.
- **Payload:** `{ "action": "uploadComplementaryDocs", "userEmail": "...", "userName": "...", "setor": "Pedagógico", "files": [ ... ] }`
- **Retorno:** `{ "success": true }`

---

## 6. Guia de Instalação e Execução Local

### Passo 1: Clonar o Repositório

```bash
git clone https://github.com/gigifs/relatorio-poiesis.git
cd relatorio-poiesis
```

### Passo 2: Execução do Frontend Localmente

O frontend consiste em arquivos estáticos (HTML/CSS/JS) e pode ser servido utilizando qualquer servidor HTTP estático ou a **Vercel CLI**:

```bash
# Opção A: Executar usando Vercel CLI (Recomendado)
npx vercel dev

# Opção B: Executar usando um servidor estático leve (Node.js http-server)
npx http-server ./ -p 3000
```

Acesse o aplicativo em `http://localhost:3000`.

### Passo 3: Implantação e Publicação do Backend (Google Apps Script)

1. Acesse o [Google Apps Script Dashboard](https://script.google.com/).
2. Crie um novo projeto ou selecione o projeto vinculado ao Google Workspace institucional.
3. Transfira o código-fonte localizado no diretório local `apps-script/` para o editor web:
   - `Code.gs`
   - `Config.gs`
   - `Drive.gs`
   - `Report.gs`
   - `Sheets.gs`
   - `Utils.gs`
4. No arquivo `Config.gs`, atualize os IDs de pastas, planilhas e templates.
5. Clique em **Implantar** ➔ **Nova implantação**:
   - **Tipo de implantação:** App da Web
   - **Executar como:** *Eu (Sua conta com permissão de escrita no Drive)*
   - **Quem tem acesso:** *Qualquer pessoa (Anyone)*
6. Copie a **URL do App da Web** emitida e cole nos arquivos `js/api.js` nas constantes `GAS_API_URL_HOMOLOG` e `GAS_API_URL_PROD`.

---

## 7. Estrutura de Diretórios

```
relatorio-poiesis/
├── .gitignore                       # Regras de ignorar dependências locais e temporários
├── apps-script/                    # Código-fonte Backend (Google Apps Script REST API)
│   ├── Code.gs                     # API Router HTTP (doPost e doGet)
│   ├── Config.gs                   # Definição de IDs, constantes e tabelas
│   ├── Drive.gs                    # Gestão da árvore de pastas no Drive (suporte a Curso de Férias)
│   ├── Report.gs                   # Leitura do Docs, interpolação de dados e conversão PDF
│   ├── Sheets.gs                   # Leitura de dropdowns institucionais e inserção no Sheets
│   └── Utils.gs                    # Helpers globais (Siglas como IGC/IGP, safe replace, normalização)
├── css/
│   └── styles.css                  # Design System corporativo, grid e regras de responsividade
├── forms/                          # Formulários Modulares por Área Operacional
│   ├── articulacao.html            # Módulo Articulação e Difusão
│   ├── biblioteca.html             # Módulo Bibliotecas
│   ├── fundacao-casa.html          # Módulo Fundação CASA (Cards de Encontros da Seção 03)
│   ├── pedagogico.html             # Módulo Pedagógico (Meta 'Cursos de Férias' e Tipo 'Curso de Férias')
│   └── area-restrita.html          # Módulo de Acesso Restrito (Firebase Auth + Cursos de Férias)
├── js/
│   ├── api.js                      # HTTP Client (Fetch API Wrapper com tratamento de erros, escapeHtml e retentativas)
│   ├── auth.js                     # Gerenciador de Autenticação Firebase e Lista Branca
│   ├── image-compressor.js         # Compressor client-side de imagem via Canvas API
│   └── main.js                     # Controlador de DOM, dinâmicas de formulário e preview de mídias sanitizadas
├── apresentacao.html               # Deck interativo de apresentação e treinamento institucional
├── index.html                      # Landing page e seletor de módulo operacional
├── logo-fabricas.png               # Asset institucional de marca
├── vercel.json                     # Roteamento e regras de servidor estático para a Vercel
└── README.md                       # Documentação técnica oficial do projeto
```

---

## 8. Padrões e Boas Práticas

### Convenções de Commits (Conventional Commits)
Este repositório adota o padrão de commits convencionais para rastreabilidade de alterações:

- `feat:` Adição de nova funcionalidade ou módulo.
- `fix:` Correção de bug ou falha de comportamento.
- `style:` Alterações de formatação, layout CSS ou ajustes visuais.
- `refactor:` Reestruturação de código sem alteração de funcionalidade.
- `docs:` Alterações em arquivos de documentação (`README.md`, `DOCUMENTACAO_SISTEMA.md`).

### Padrão de Codificação e Estilo
- **JavaScript Client-Side:** Utiliza ES6+ nativo sem dependências de compilação pesadas (Webpack/Babel). Manter escopos isolados e manipulação de DOM baseada em seletores declarativos.
- **Validação de Formulários:** Todos os formulários realizam sanitização e verificação de campos obrigatórios client-side antes da emissão da requisição HTTP POST.
- **Fuso Horário e Datas:** Formatar sempre timestamps e datas utilizando o locale `pt-BR` e o fuso horário `America/Sao_Paulo`.
