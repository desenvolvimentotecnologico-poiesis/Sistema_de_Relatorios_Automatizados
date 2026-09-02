# SRA — Sistema de Relatórios Automatizados

Documentação técnica de arquitetura, desenvolvimento e operação do **SRA (Sistema de Relatórios Automatizados)** — Instituto Poiesis, Fábricas de Cultura e unidades da Fundação CASA.

> Para a explicação didática e operacional (uso dos formulários, trava anti-duplicidade, Área Restrita, pastas do Drive, manutenção programada, reconciliação, guia para gestores), veja **[`DOCUMENTACAO_SISTEMA.md`](DOCUMENTACAO_SISTEMA.md)**. Este README é o material técnico para quem desenvolve e opera o backend.

---

## 1. Visão Geral

Plataforma web *serverless/headless* que padroniza, valida e automatiza a coleta de indicadores e a emissão dos relatórios mensais de prestação de contas. Substitui a compilação manual de arquivos por um fluxo desacoplado:

- triagem e validação de dados no navegador (client-side);
- compressão de mídia nativa via Canvas API;
- registro estruturado em Google Sheets (uma aba por área);
- organização hierárquica de arquivos no Google Drive;
- geração do relatório em Google Docs e exportação em PDF.

**Quatro frentes**, cada uma com formulário e modelo de relatório próprios: **Pedagógico**, **Articulação & Difusão**, **Bibliotecas** e **Fundação CASA**. O Pedagógico ainda tem uma **Área Restrita** para anexo de Inscrição e Presença em PDF.

---

## 2. Arquitetura e Decisões Técnicas

Arquitetura *Serverless Jamstack* em duas camadas: **Frontend estático (Vercel Edge CDN)** e **Backend headless (Google Apps Script como adaptador REST do Google Workspace)**.

```
┌─────────────────────────────────────────────────────────┐
│              FRONTEND ESTÁTICO (Jamstack)                │
│                 Hospedado na Vercel (CDN)                │
│   HTML5 / CSS3  ──►  Compressão client-side (Canvas API) │
└────────────────────────────┬────────────────────────────┘
                             │  HTTP POST (JSON, action-based)
                             ▼
┌─────────────────────────────────────────────────────────┐
│            BACKEND HEADLESS (Apps Script /exec)          │
│              Fuso de execução: America/Sao_Paulo         │
│                                                         │
│  Code.gs (roteador HTTP)  ──►  Sheets.gs                 │
│                           ├──►  Drive.gs                 │
│                           ├──►  Report.gs (Docs ➔ PDF)   │
│                           └──►  Reconciliacao.gs         │
└────────────────────────────┬────────────────────────────┘
                             ▼
 ┌───────────────────────────────────────────────────────┐
 │                 GOOGLE WORKSPACE                       │
 │  Sheets  — respostas por área + aba _LOGS de auditoria │
 │  Drive   — estrutura de pastas, fotos e PDFs           │
 │  Docs    — um template por área                        │
 └───────────────────────────────────────────────────────┘
```

### Justificativas

- **Custo zero de infraestrutura:** Vercel Edge + runtime do Apps Script eliminam VMs, banco relacional e storage pago.
- **Compressão client-side:** `ImageCompressor` reduz o payload antes do POST, contornando limites de requisição do Apps Script e acelerando o envio em redes lentas.
- **Envio em 2 etapas:** `submitForm` (Etapa 1, rápida — grava a linha e sobe as fotos) e `generatePdfReportAsync` (Etapa 2, lenta — diagrama o Docs e exporta o PDF). Separar as etapas mantém o backend abaixo do teto de ~6 min por execução. Se a Etapa 2 falhar, a linha fica gravada sem PDF — situação tratada pela **reconciliação manual** (`Reconciliacao.gs`).
- **Trava anti-duplicidade:** a mesma atividade não pode ter dois relatórios no mesmo período. Verificada na consulta prévia (`checkReportStatus`) e revalidada sob `LockService` no momento de gravar (`Sheets.gs`). A chave de identidade varia por área (ver `DOCUMENTACAO_SISTEMA.md`, seção 4).
- **`safeReplaceText`:** substituição de placeholders `{{CAMPO}}` protegida contra caracteres reservados de regex (ex.: `R$`).
- **Fuso `America/Sao_Paulo`:** todo timestamp e formatação de data usam o fuso oficial, explicitamente.
- **Marcador `BACKEND_VERSION`** (`Code.gs`): devolvido pelo `doGet`; serve para confirmar, sem abrir o editor, se a implantação `/exec` já serve o código atual. **Deve ser incrementado a cada publicação do backend.**

### 2.1 Autenticação e Acesso Restrito (Firebase + Lista Branca)

A **Área Restrita** (anexo de Lista de Presença e Registro de Inscrição por atividade do Pedagógico) usa **Firebase Authentication (login Google)** + uma **Lista Branca no Google Sheets**.

1. **Autenticação:** login via Google (`prompt: select_account`). O sistema **não** força domínio no código — a lista de domínios autorizados fica no Firebase Console e o gate efetivo de autorização é a Lista Branca.
2. **Autorização:** o frontend chama `verifyUserAccess`, que consulta *server-side* a aba `Responsaveis_Autorizados`. A tela só oferece as unidades liberadas para aquele e-mail (uma, várias separadas por vírgula/ponto-e-vírgula, ou `Todas`). A consulta **nunca usa cache**.
3. **Status da atividade:** `checkActivityStatus` verifica na planilha se a atividade já tem registro e se os anexos (`Inscrição Enviada` / `Presença Enviada`) já foram enviados.
4. **Gravação auditável:** `uploadComplementaryDocs` salva os PDFs nas subpastas `Relação de Inscritos` e `Lista de Presença` e grava as colunas `Inscrição Enviada`, `Presença Enviada`, `Atualizado Por (Login)` e `Data/Hora Atualização`. O backend **revalida** e-mail na Lista Branca e permissão de unidade antes de gravar; reenvio é recusado se a atividade já tem os dois documentos.

### 2.2 Operação

- **Manutenção programada:** a propriedade de script `SRA_MAINTENANCE = ON` faz o backend recusar toda ação de gravação antes de tocar em planilha/pasta/arquivo (leituras continuam). A tela pública `manutencao.html` é ativada por roteamento na Vercel (`ops/vercel.maintenance.json` × `ops/vercel.normal.json`). A equipe libera o próprio acesso com `adminToken` igual a `SRA_ADMIN_TOKEN`. Passo a passo em `ops/CUTOVER-PRODUCAO.md`.
- **Reconciliação de relatórios pendentes:** `reconciliarRelatoriosPendentes` (`Reconciliacao.gs`), executada **manualmente** no editor quando o `_LOGS` registra falha de Etapa 2. Remonta o `formData` a partir da linha, recupera as pastas (idempotente) e compila só os relatórios ausentes.
- **Diagnóstico de integridade:** `diagnosticarPlanilhas` (`Diagnostico.gs`), somente leitura, aponta linhas gravadas com o cabeçalho desalinhado.

---

## 3. Pré-requisitos

| Ferramenta | Versão | Finalidade |
| :--- | :--- | :--- |
| **Node.js** | `>= 18` | Executar as ferramentas de CLI (servidor estático, Vercel CLI) |
| **npm / pnpm** | `>= 9` | Gerenciador de pacotes |
| **Vercel CLI** | `>= 33` | Simular produção e publicar o frontend |
| **Navegador** | Chrome `>= 115`, Firefox `>= 115`, Safari `>= 16.5` | Suporte a ES6+, CSS Grid e Canvas API |
| **Conta Google Workspace** | Institucional, com escrita no Drive | APIs de Sheets, Drive e Docs (o Apps Script roda "como" essa conta) |
| **Firebase Console** | Projeto `sra-acessos` ativo | Login Google da Área Restrita |

---

## 4. Configuração

### Backend — `apps-script/Config.gs` (objeto `CONFIG`)

| Chave | Descrição |
| :--- | :--- |
| `SPREADSHEET_LISTS_ID` | Planilha das listas suspensas (cada aba é uma unidade/setor) |
| `SPREADSHEET_USERS_ID` | Planilha de usuários / Lista Branca. Se ficar com o placeholder, o backend usa a planilha de listas como fallback |
| `SPREADSHEET_RESPONSES_ID` | Planilha de respostas padrão (fallback quando a da área não está configurada) |
| `SPREADSHEET_RESPONSES_PEDAGOGICO_ID` / `_ARTICULACAO_ID` / `_FUNDACAO_CASA_ID` / `_BIBLIOTECA_ID` | Planilha de respostas de cada área |
| `SHEET_RESPONSES_PEDAGOGICO` / `_ARTICULACAO` / `_FUNDACAO_CASA` / `_BIBLIOTECA` | Nome da aba dentro da planilha de respostas de cada área |
| `DRIVE_ROOT_FOLDER_ID` | Pasta raiz no Drive para toda a árvore de pastas |
| `DOC_TEMPLATE_PEDAGOGICO_ID` / `_ARTICULACAO_ID` / `_FUNDACAO_CASA_ID` / `_BIBLIOTECA_ID` | Modelo do Google Docs de cada área |
| `SYSTEM_NAME` | Nome institucional usado em títulos |

Propriedades de script (Configurações do projeto → Propriedades do script), não versionadas:

| Propriedade | Uso |
| :--- | :--- |
| `SRA_MAINTENANCE` | `ON` ativa a manutenção programada (recusa gravações) |
| `SRA_ADMIN_TOKEN` | Token que libera o acesso da equipe durante a manutenção |

### Frontend — `js/api.js` e `js/auth.js`

| Constante | Onde | Descrição |
| :--- | :--- | :--- |
| `GAS_API_URL_HOMOLOG` | `js/api.js` | `/exec` do Apps Script de homologação (usado em `localhost`, IP local ou domínio contendo `homolog`) |
| `GAS_API_URL_PROD` | `js/api.js` | `/exec` do Apps Script de produção (demais domínios) |
| `firebaseConfig` | `js/auth.js` | `apiKey`, `authDomain`, `projectId`, etc. do projeto `sra-acessos` (identificadores públicos do Firebase Web) |

---

## 5. API (Google Apps Script)

Todas as chamadas são `POST` para a URL `/exec`, com corpo JSON contendo `action`. O `doGet` responde apenas um *health check* com `BACKEND_VERSION` e o estado de manutenção. Toda resposta tem a forma `{ success, message, ...dados }`.

Durante a manutenção programada, as ações de gravação (`submitForm`, `generatePdfReportAsync`, `uploadComplementaryDocs`) retornam `{ success: false, maintenance: true }` — a menos que o corpo inclua `adminToken` válido.

| Ação | Descrição | Campos principais do payload | Retorno |
| :--- | :--- | :--- | :--- |
| `getDropdownData` | Hierarquia das listas suspensas (unidades, tipos, atividades, DRs). | `forceRefresh?` | `{ hierarchy }` |
| `checkReportStatus` | Consulta prévia da trava: a atividade já tem relatório no período? | `setor`, `unidade`, `atividade`, `divisaoRegional?`, `tipoPedagogico?`, `anoReferencia?`, `mesReferencia?`, `dataRelatorio?`, `diasAtividade?`, `diasSemana?`, `horarioInicio?`, `horarioTermino?` | `{ alreadySubmitted, submittedAt, submittedBy, detail }` |
| `submitForm` (Etapa 1) | Cria/reaproveita pastas, sobe fotos e grava a linha (sob `LockService`). | `formData` (todos os campos da área + `files[]`) | `{ sheetName, rowNumber, relatorioFolderId, registroFolderId, area }` ou `{ success:false, duplicate:true, ... }` |
| `generatePdfReportAsync` (Etapa 2) | Clona o Docs, substitui `{{CAMPO}}`, insere as fotos, monta a tabela do Plano (CASA) e exporta o PDF. | `sheetName`, `rowNumber`, `relatorioFolderId`, `registroFolderId`, `area`, `formData` | `{ pdfUrl, docUrl }` |
| `verifyUserAccess` | Valida o e-mail contra `Responsaveis_Autorizados`. | `email` | `{ authorized, user }` |
| `checkActivityStatus` | Estado da atividade e dos anexos complementares (Área Restrita). | `setor`, `unidade`, `atividade`, `anoReferencia`, `mesReferencia`, `tipoPedagogico` | `{ exists, rowNumber, hasInscricao, hasPresenca }` |
| `uploadComplementaryDocs` | Salva os PDFs de Inscrição/Presença e grava as colunas auditáveis. | `userEmail`, `userName`, `setor`, `unidade`, `atividade`, `anoReferencia`, `mesReferencia`, `tipoPedagogico`, `files[]` | `{ success }` |

> As ações de formulário (`submitForm`, `generatePdfReportAsync`, `checkReportStatus`, `getDropdownData`) **não têm autenticação** — a URL `/exec` é pública e de acesso "Anyone". Só a Área Restrita (`verifyUserAccess` / `uploadComplementaryDocs`) e a manutenção (`adminToken`) são protegidas. É uma escolha da arquitetura; ver seção 9 do review em `DOCUMENTACAO_SISTEMA.md`.

---

## 6. Instalação e Execução Local

### Frontend

```bash
git clone https://github.com/desenvolvimentotecnologico-poiesis/Sistema_de_Relatorios_Automatizados.git
cd Sistema_de_Relatorios_Automatizados

# Opção A — Vercel CLI (simula produção)
npx vercel dev

# Opção B — servidor estático leve
npx http-server ./ -p 3000 -c-1
```

Acesse `http://localhost:3000`. Em `localhost` o frontend aponta automaticamente para o backend de **homologação**.

### Backend (Google Apps Script)

O diretório `apps-script/` é um **espelho manual** do projeto no Apps Script — não há `clasp` nem CI. Para publicar:

1. Abra o projeto em [script.google.com](https://script.google.com/) vinculado à conta institucional.
2. Cole o conteúdo de cada arquivo `.gs` de `apps-script/`:
   `Code.gs`, `Config.gs`, `Sheets.gs`, `Drive.gs`, `Report.gs`, `Reconciliacao.gs`, `Utils.gs`, `Diagnostico.gs`.
3. Em `Config.gs`, preencha os IDs de planilhas, pasta raiz e templates.
4. **Incremente `BACKEND_VERSION`** em `Code.gs`.
5. **Implantar → Gerenciar implantações → Editar → Versão: Nova versão → Implantar.**
   - Tipo: *App da Web* · Executar como: *eu* · Quem tem acesso: *Qualquer pessoa*.
6. Se a URL `/exec` mudar, atualize `GAS_API_URL_HOMOLOG` / `GAS_API_URL_PROD` em `js/api.js`.
7. Confirme no `doGet` que o `backendVersion` retornado é o novo.

---

## 7. Estrutura do Projeto

```
Sistema_de_Relatorios_Automatizados/
├── .gitignore
├── README.md                       # Este documento (técnico)
├── DOCUMENTACAO_SISTEMA.md          # Documentação didática/operacional
├── index.html                      # Landing page — seletor de frente
├── apresentacao.html               # Deck de apresentação/treinamento
├── manutencao.html                 # Tela pública de manutenção programada
├── logo-fabricas.png
├── vercel.json                     # Config da Vercel (cleanUrls, trailingSlash)
├── css/
│   └── styles.css                  # Design System, grid e responsividade
├── forms/
│   ├── pedagogico.html
│   ├── articulacao.html            # Calendário de dias do mês
│   ├── biblioteca.html
│   ├── fundacao-casa.html          # Plano de Atividades + dias da semana + horário
│   └── area-restrita.html          # Firebase Auth + anexo de Inscrição/Presença
├── js/
│   ├── api.js                      # Cliente HTTP + detecção de ambiente + retentativas
│   ├── auth.js                     # Firebase Auth + regras da Área Restrita
│   ├── main.js                     # Formulários, calendário, dias da semana, consulta
│   │                               #   prévia de duplicidade, envio em 2 etapas
│   ├── image-compressor.js         # Compressão de imagem via Canvas API
│   └── shared-helpers.js           # Regras compartilhadas entre main.js e auth.js
├── apps-script/
│   ├── Code.gs                     # Roteador HTTP, Etapa 1/2, manutenção, chave de identidade
│   ├── Config.gs                   # IDs de planilhas, abas e templates
│   ├── Sheets.gs                   # Cabeçalhos por área, gravação da linha, trava anti-duplicidade
│   ├── Drive.gs                    # Árvore de pastas e nomes de arquivos
│   ├── Report.gs                   # Google Docs → PDF (nome + escopo do relatório)
│   ├── Reconciliacao.gs            # Reconciliação manual de relatórios pendentes
│   ├── Utils.gs                    # Helpers (datas, textos, dias/horário, siglas, respostas)
│   └── Diagnostico.gs              # Auditoria de integridade das planilhas (somente leitura)
└── ops/
    ├── CUTOVER-PRODUCAO.md          # Passo a passo da virada de produção / manutenção
    ├── vercel.maintenance.json      # vercel.json com o roteamento de manutenção
    └── vercel.normal.json           # vercel.json com o roteamento normal
```

---

## 8. Padrões e Boas Práticas

### Commits (Conventional Commits, com escopo opcional)

`feat:` nova funcionalidade · `fix:` correção de bug · `docs:` documentação · `style:` formatação/CSS · `refactor:` reestruturação sem mudança de comportamento · `ops:` operação/infra (manutenção, roteamento, virada).

Exemplos do histórico: `feat(fundacao-casa): ...`, `fix(drive): ...`, `ops: encerra manutencao programada`.

Mensagens de commit terminam com:

```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

### Código

- **JavaScript client-side:** ES6+ nativo, sem build (Webpack/Babel). Escopos isolados, manipulação de DOM por seletores.
- **Apps Script:** ES6+ (runtime V8). Funções são globais entre arquivos `.gs` — um arquivo pode chamar funções de outro sem `import`.
- **Validação:** cada formulário sanitiza e valida os campos obrigatórios no cliente antes do POST; o backend **revalida** as regras críticas (obrigatórios, permissões da Área Restrita, trava anti-duplicidade), pois a API é pública.
- **Datas e fuso:** sempre `pt-BR` e `America/Sao_Paulo`.
- **Colunas novas na planilha:** basta adicionar ao array de `headers` da área em `Sheets.gs`; `ensureSheetHeaders` insere a coluna na posição canônica e realinha o histórico na primeira gravação seguinte.

---

## 9. Fluxo de Solicitação de Alterações

Toda alteração no SRA (novo campo, nova atividade, mudança de regra ou de layout) segue este caminho de aprovação antes de chegar ao Setor de Sistemas:

1. **Supervisão da unidade** — origina a solicitação (ou dá o aval a quem pediu).
2. **Coordenação de área (Sede)** — analisa necessidade e viabilidade.
3. **Júnior** (assessor da superintendência e solicitante do projeto) — aprovação final.
4. **Setor de Sistemas** — implementa e publica.

### Divisão de responsabilidades

| Responsável | Escopo |
| :--- | :--- |
| **Coordenação de Área / Gestores** | Planilha de atividades (listas suspensas), planilha de respostas e verificação dos relatórios já preenchidos. Inclusões/ajustes de atividade partem da coordenação da área. |
| **Setor de Sistemas** | Código, lógica, segurança e design; Lista Branca da Área Restrita; modelo do relatório (Google Docs); publicação do backend; manutenção programada; reconciliação de relatórios pendentes. |

Detalhamento completo em [`DOCUMENTACAO_SISTEMA.md`](DOCUMENTACAO_SISTEMA.md), seções 10 e 11.
