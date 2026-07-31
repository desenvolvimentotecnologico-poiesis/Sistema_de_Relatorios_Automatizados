# 📘 Documentação Oficial: SRA - Sistema de Relatórios Automatizados
**Fábricas de Cultura • Instituto Poiesis**

> Esta documentação foi elaborada para explicar de forma simples, acessível e didática o funcionamento completo do **SRA (Sistema de Relatórios Automatizados)**, servindo tanto para pessoas sem conhecimento em tecnologia quanto para gestores e equipe de TI realizarem manutenções no futuro.

---

## 📌 1. Visão Geral e Objetivo do Sistema

### O que é o sistema?
O **SRA (Sistema de Relatórios Automatizados)** é uma plataforma web desenvolvida para automatizar, padronizar e organizar o registro de todas as atividades realizadas nas **Fábricas de Cultura** gerenciadas pelo **Instituto Poiesis**.

### Qual problema ele resolve?
Antes, o processo de criação de relatórios gerenciais exigia a compilação manual de textos, tabelas e fotos em arquivos de texto, formatação individual de páginas e envio por e-mail ou pastas soltas. 

Com o SRA:
1. O profissional preenche um formulário simples e intuitivo no computador ou celular.
2. O sistema organiza as fotos e dados automaticamente no **Google Drive** e **Google Sheets**.
3. O sistema gera um **relatório oficial em PDF** totalmente formatado, com identidade visual da instituição e pronto para impressão ou auditoria, em menos de 1 minuto.

---

## 🔄 2. Como o Sistema Funciona (Passo a Passo Simplificado)

Visualmente, a jornada do dado funciona como uma "linha de montagem" automática:

```
[ Usuário preenche o Formulário Web ]
                 │
                 ▼
[ Otimização das Fotos no Celular/PC ]  <-- Comprime fotos pesadas em milissegundos
                 │
                 ▼
 ┌───────────────┴───────────────┐
 │ 1. Salva dados na Planilha    │  <-- Registra linha no Google Sheets
 │ 2. Salva fotos no Drive       │  <-- Organiza pasta: Ano > Mês > Unidade > Atividade
 └───────────────┬───────────────┘
                 ▼
[ Copia o Template Oficial do Google Docs ]  <-- Substitui as palavras chaves {{EXEMPLO}}
                 │
                 ▼
[ Transforma em PDF e Libera o Download ]    <-- Exibe o botão de Download na tela!
```

---

## 🎨 3. As 4 Frentes de Trabalho e Suas Identidades Visuais

O SRA é dividido em 4 frentes operacionais institucionais, cada uma identificada por uma cor exclusiva em todo o sistema:

| Frente de Trabalho | Cor de Destaque | Tipo de Atividade Registrada |
| :--- | :---: | :--- |
| **Pedagógico** | 🟣 **Roxo** (`#8B5CF6`) | Cursos de formação artística, ateliês, trilhas e mediações. |
| **Articulação & Difusão** | 🟠 **Laranja** (`#F97316`) | Festivais, eventos, espetáculos, apresentações e uso de espaço. |
| **Bibliotecas** | 🟢 **Verde-Água / Teal** (`#0D9488`) | Rodas de leitura, mediação literária, contação de histórias e saraus. |
| **Fundação CASA** | 🔵 **Azul** (`#3B82F6`) | Atividades e oficinas realizadas nas unidades do atendimento socioeducativo. |

---

## 🛠️ 4. As Tecnologias Utilizadas (O que foi usado?)

Para garantir custo zero de servidores e alta disponibilidade, o sistema utiliza uma **Arquitetura Headless e Serverless**, integrada ao Google Workspace da instituição:

1. **Frontend (Interface do Usuário)**:
   - **HTML5 e CSS3 Vanilla**: Páginas leves, responsivas (funcionam em celulares, tablets e computadores) com o Design System oficial das Fábricas de Cultura.
   - **JavaScript (ES6)**: Responsável pela interatividade, validações de texto, calendário interativo e compressão inteligente de fotos no próprio navegador.
   - **Hospedagem Vercel**: Garante carregamento ultra-rápido da interface web.

2. **Backend & Automação (Google Apps Script)**:
   - Funciona como o "cérebro" do sistema sem custo de servidor. Conecta o site aos serviços do Google.

3. **Banco de Dados e Armazenamento (Google Workspace)**:
   - **Google Sheets (Planilhas)**: Armazena os dados brutos de cada resposta para auditoria e prestação de contas.
   - **Google Drive**: Guarda os arquivos de imagem organizados por pastas e os relatórios em PDF.
   - **Google Docs (Documentos)**: Serve como "molde" (template) institucional para a diagramação dos relatórios.

---

## 📂 5. Organização Automática das Pastas no Google Drive

Toda vez que uma atividade é registrada, o sistema cria (ou reaproveita) a seguinte estrutura hierárquica dentro do Google Drive:

```
📁 Pasta Raiz (FÁBRICAS DE CULTURA)
 └── 📁 [Nome do Setor] (ex: Pedagógico)
      └── 📁 [Ano] (ex: 2026)
           └── 📁 [Nome da Unidade] (ex: Cidade Tiradentes)
                └── 📁 [Mês] (ex: 05 - Maio)
                     └── 📁 [Tipo de Ateliê / Trilha]
                          └── 📁 [Nome da Atividade]
                               ├── 📁 Registro Fotográfico  (Contém as imagens originais)
                               ├── 📁 Relatório             (Contém o PDF e o Docs gerados)
                               ├── 📁 Lista de Presença     (Quando aplicável)
                               └── 📁 Relação de Inscritos  (Quando aplicável)
```

---

## 🔧 6. Guia Prático de Manutenção para Gestores (Como Alterar o Sistema)

### A. Como atualizar as listas suspensas (Unidades, Cursos, Atividades)?
- **Onde alterar**: Não é necessário mexer em código! Abra a **Planilha de Listas Institucionais** do Google Sheets.
- Cada aba da planilha representa uma Unidade ou Setor. Adicione ou edite os nomes nas colunas correspondentes e o formulário atualizará sozinho.

### B. Como alterar o layout ou modelo do Relatório (PDF)?
- **Onde alterar**: Abra o modelo do **Google Docs** correspondente à área desejada.
- Você pode alterar logotipos, mudar a cor de cabeçalhos ou reorganizar parágrafos.
- **Atenção**: Mantenha as palavras-chave entre chaves duplas (ex: `{{UNIDADE}}`, `{{RESPONSAVEL}}`, `{{ANEXOS}}`), pois é nelas que o sistema insere os dados do formulário.

### C. O que fazer se alterar o código no Google Apps Script?
Toda vez que o arquivo `Code.gs`, `Report.gs`, `Drive.gs` ou `Sheets.gs` for alterado no editor do Google Apps Script:
1. Clique no botão azul **Implantar (Deploy)** no canto superior direito.
2. Escolha **Gerenciar implantações (Manage deployments)**.
3. Clique no ícone de lápis (Editar).
4. Na opção **Versão**, selecione **Nova versão (New version)**.
5. Clique em **Implantar**.

---

## ❓ 7. Perguntas Frequentes (FAQ)

#### 1. Por que o formulário leva de 20 a 60 segundos após clicar em Enviar?
O formulário executa um processo complexo de 2 etapas:
- **Etapa 1 (~2s)**: Salva os dados na planilha e faz upload das fotos.
- **Etapa 2 (~20-40s)**: O servidor do Google clona o documento do Google Docs, substitui dezenas de marcações de texto, ajusta o tamanho das imagens na grade e compila o arquivo em formato PDF.

#### 2. O que acontece se o usuário enviar fotos muito grandes (tiradas em celulares 4K)?
O sistema conta com um **Compressor Automático no Navegador** ([`js/image-compressor.js`](file:///c:/Users/giovannafreitas_poie/.gemini/antigravity-ide/scratch/relatorio-poiesis/js/image-compressor.js)). Antes de enviar para a internet, a imagem é otimizada para até 1000px de resolução sem perda visual perceptível, garantindo velocidade no envio.

#### 3. Onde o PDF final fica disponível?
- **Imediatamente**: Na própria tela do navegador, através do botão verde "Baixar Relatório em PDF".
- **Definitivamente**: Salvo automaticamente na pasta `Relatório` da atividade dentro do Google Drive institucional.

---

*Documentação elaborada pela equipe de Sistemas em Julho de 2026.*
