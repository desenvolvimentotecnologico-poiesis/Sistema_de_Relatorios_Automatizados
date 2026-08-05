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
└─────────────────────────────────────────────────────────┘
```

### Justificativas Arquiteturais:

- **Zero Lock-in de Servidores Pagos (Custo Zero de Infraestrutura):** A utilização da Vercel Edge Network combinada ao runtime Serverless do Google Apps Script elimina custos fixos com máquinas virtuais, bancos de dados relacionais e serviços de storage.
- **Processamento de Mídia Client-Side (Offloading):** A compressão de imagens via Canvas API é realizada diretamente no navegador do usuário antes da transmissão HTTP. Isso reduz em até 85% o payload transferido e contorna o limite nativo de requisição HTTP (50MB) do Google Apps Script.
- **Fuso Horário Brasília (`America/Sao_Paulo`):** Todas as operações de timestamp e formatação de datas utilizam explicitamente o fuso horário oficial `America/Sao_Paulo` para garantir auditoria temporal sem divergências de servidor.
- **Resiliência Serverless & Cache:** Utilização do `CacheService` do Apps Script para memorizar IDs de pastas no Drive por até 6 horas, reduzindo em até 70% as chamadas da API do Google Workspace por envio.

### 2.1 Módulo de Autenticação e Controle de Acesso Restrito (Firebase + Lista Branca)

Para o envio de documentos complementares de prestação de contas (Lista de Presença e Registro de Inscrição por atividade), o sistema conta com uma camada de segurança baseada em **Firebase Authentication (Google Identity Provider)** integrada a uma **Lista Branca no Google Sheets**.

#### Fluxo Operacional de Autenticação:
1. **Autenticação:** O responsável da fábrica realiza login via Google Auth Provider (`@poiesis.org.br`).
2. **Autorização (Lista Branca):** O frontend envia a credencial para a API do Google Apps Script (`verifyUserAccess`), que realiza a consulta server-side na aba `Responsaveis_Autorizados` da Planilha Institucional.
3. **Validação de Registro:** O sistema verifica se o formulário primário da atividade já foi gravado no Sheets e se a pasta da atividade existe no Drive.
4. **Governança de Documentos:** Os arquivos de Inscrição e Presença são destinados automaticamente às subpastas `📁 Relação de Inscritos` e `📁 Lista de Presença` no Drive, e as colunas auditáveis (`Inscrição Enviada`, `Presença Enviada`, `Atualizado Por`, `Data/Hora Atualização`) são gravadas na planilha.

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
| `DRIVE_ROOT_FOLDER_ID` | `String` | ID da Pasta Raiz no Google Drive para armazenamento institucional | `'1A2b3C4d5E6f7G8h9I0j'` |
| `SHEET_RESPONSES_PEDAGOGICO` | `String` | Nome da aba na planilha para respostas do Pedagógico | `'Respostas_Pedagogico'` |
| `SHEET_RESPONSES_ARTICULACAO`| `String` | Nome da aba na planilha para respostas da Articulação | `'Respostas_Articulacao'` |
| `SHEET_RESPONSES_FUNDACAO_CASA`| `String` | Nome da aba na planilha para respostas da Fundação CASA | `'Respostas_Fundacao_Casa'` |
| `SHEET_RESPONSES_BIBLIOTECA` | `String` | Nome da aba na planilha para respostas da Biblioteca | `'Respostas_Biblioteca'` |
| `DOC_TEMPLATE_PEDAGOGICO_ID` | `String` | ID do arquivo modelo (Template) no Google Docs para Pedagógico | `'1Nnh4ptK6znL1CX3rMOJJQha-sample'` |
| `DOC_TEMPLATE_ARTICULACAO_ID`| `String` | ID do arquivo modelo (Template) no Google Docs para Articulação | `'1Nnh4ptK6znL1CX3rMOJJQha-sample'` |
| `DOC_TEMPLATE_FUNDACAO_CASA_ID`| `String` | ID do arquivo modelo (Template) no Google Docs para Fundação CASA | `'1Nnh4ptK6znL1CX3rMOJJQha-sample'` |
| `DOC_TEMPLATE_BIBLIOTECA_ID` | `String` | ID do arquivo modelo (Template) no Google Docs para Biblioteca | `'1Nnh4ptK6znL1CX3rMOJJQha-sample'` |

### Variáveis do Frontend (`js/api.js` e `js/auth.js`)

| Constant | Tipo | Descrição | Exemplo / Placeholder |
| :--- | :--- | :--- | :--- |
| `GAS_API_URL` | `String` | Endpoint público do Web App implantado no Google Apps Script | `'https://script.google.com/macros/s/AKfycb.../exec'` |
| `firebaseConfig.apiKey` | `String` | Chave de API pública do Firebase Auth | `'AIzaSy...'` |
| `firebaseConfig.authDomain` | `String` | Domínio do app Firebase | `'projeto.firebaseapp.com'` |
| `firebaseConfig.projectId` | `String` | ID do projeto no Firebase Console | `'projeto'` |

---

## 5. Guia de Instalação e Execução Local

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
   - **Tipo de tipo:** App da Web
   - **Executar como:** *Eu (Sua conta com permissão de escrita no Drive)*
   - **Quem tem acesso:** *Qualquer pessoa (Anyone)*
6. Copie a **URL do App da Web** emitida e cole no arquivo `js/api.js` na constante `GAS_API_URL`.

---

## 6. Estrutura de Diretórios

```
relatorio-poiesis/
├── apps-script/                    # Código-fonte Backend (Google Apps Script REST API)
│   ├── Code.gs                     # API Router HTTP (doPost e doGet)
│   ├── Config.gs                   # Definição de IDs, constantes e tabelas
│   ├── Drive.gs                    # Gestão da árvore de pastas no Drive e gravações
│   ├── Report.gs                   # Leitura do Docs, interpolação de dados e conversão PDF
│   ├── Sheets.gs                  # Leitura de dropdowns institucionais e inserção no Sheets
│   └── Utils.gs                    # Helpers globais (Formatadores de data BR, sanitização)
├── css/
│   └── styles.css                  # Design System corporativo, grid e regras de responsividade
├── forms/                          # Formulários Modulares por Área Operacional
│   ├── articulacao.html            # Módulo Articulação e Difusão
│   ├── biblioteca.html             # Módulo Bibliotecas
│   ├── fundacao-casa.html          # Módulo Fundação CASA (Cards de Encontros da Seção 03)
│   └── pedagogico.html             # Módulo Pedagógico
├── js/
│   ├── api.js                      # HTTP Client (Fetch API Wrapper com tratamento de erro)
│   ├── image-compressor.js         # Compressor client-side de imagem via Canvas API
│   └── main.js                     # Controlador de DOM, dinâmicas de formulário e modal
├── apresentacao.html               # Deck interativo de apresentação e treinamento institucional
├── index.html                      # Landing page e seletor de módulo operacional
├── logo-fabricas.png               # Asset institucional de marca
├── vercel.json                     # Roteamento e regras de servidor estático para a Vercel
└── README.md                       # Documentação técnica oficial do projeto
```

---

## 7. Scripts Úteis

| Comando / Ação | Descrição |
| :--- | :--- |
| `npx vercel dev` | Inicializa o ambiente de desenvolvimento estático local com Vercel Edge Server |
| `npx vercel --prod` | Realiza o deploy manual diretamente no ambiente de produção da Vercel |
| `git status` | Exibe o estado atual da árvore de arquivos e alterações pendentes |
| `git push origin main` | Envia commits para a branch principal e aciona o CI/CD automático da Vercel |

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
