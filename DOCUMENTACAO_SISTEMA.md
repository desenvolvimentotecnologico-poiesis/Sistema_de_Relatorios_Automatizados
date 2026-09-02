# 📘 Documentação Oficial: SRA - Sistema de Relatórios Automatizados
**Fábricas de Cultura • Instituto Poiesis**

> Esta documentação explica, de forma simples e didática, **tudo o que o SRA faz**: os formulários de cada frente de trabalho, a geração automática dos relatórios em PDF, a trava anti‑duplicidade, a Área Restrita, a organização das pastas no Google Drive, a manutenção programada e a reconciliação de relatórios pendentes. Serve tanto para quem vai **usar** o sistema quanto para quem vai **manter** o sistema no futuro.

---

## 📌 1. Visão Geral e Objetivo

### O que é o sistema?
O **SRA (Sistema de Relatórios Automatizados)** é uma plataforma web que automatiza, padroniza e organiza o registro de todas as atividades realizadas nas **Fábricas de Cultura** e nas unidades da **Fundação CASA** atendidas pelo **Instituto Poiesis**.

### Qual problema ele resolve?
Antes, cada relatório gerencial era montado à mão: juntar textos, tabelas e fotos num editor de texto, formatar página por página e enviar por e‑mail ou pasta solta. Isso é lento, inconsistente e difícil de auditar.

Com o SRA:
1. O profissional preenche **um formulário web** no computador ou no celular.
2. O sistema **salva os dados na planilha** e **organiza as fotos no Google Drive**, em pastas padronizadas.
3. O sistema **gera o relatório oficial em PDF**, já diagramado com a identidade visual da instituição, pronto para impressão ou auditoria — normalmente em menos de 1 minuto.
4. Uma **trava anti‑duplicidade** impede que a mesma atividade seja enviada duas vezes no mesmo período.

### O que o sistema NÃO faz
- Não substitui a conferência humana do conteúdo: quem preenche é responsável pela veracidade dos dados.
- Não permite **corrigir/reenviar** um relatório já enviado pela própria tela. Correções passam pela equipe de Sistemas (`sistemasdegestao@poiesis.org.br`).

---

## 🎨 2. As Quatro Frentes de Trabalho

O SRA é dividido em 4 frentes operacionais, cada uma com **cor, formulário e modelo de relatório próprios**:

| Frente | Cor | O que registra | Particularidades do formulário |
| :--- | :---: | :--- | :--- |
| **Pedagógico** | 🟣 Roxo | Trilhas, ateliês, cursos de férias, mediações e formações artísticas. | Campo **Tipo** (Trilha / Ateliê / Núcleo / Curso de Férias). Possui **Área Restrita** para anexar Inscrição e Presença em PDF. |
| **Articulação & Difusão** | 🟠 Laranja | Festivais, eventos, espetáculos, apresentações, saraus e uso de espaço. | **Calendário interativo**: o educador marca os **dias do mês** em que a atividade aconteceu. Cada dia é um relatório próprio. Campos de **Horário de Início/Término**, sessões e público por sessão. |
| **Bibliotecas** | 🟢 Verde‑água | Rodas de leitura, mediação literária, contação de histórias, saraus. | Campo **Data da Atividade** (uma data por relatório). A mesma atividade pode ter vários relatórios no mês, um por data. |
| **Fundação CASA** | 🔵 Azul | Oficinas e atividades nas unidades do atendimento socioeducativo. | Campo **Divisão Regional (DR)**. **Plano de Atividades**: tabela de encontros (data, horário e descrição) digitada no próprio formulário. **Dias da semana** + **Horário da atividade** (ver seção 4). Não anexa fotos. |

---

## 🔄 3. A Jornada do Dado (Envio em 2 Etapas)

Quando o usuário clica em **Enviar / Gerar Relatório**, o sistema executa um processo em **duas requisições** ao servidor do Google:

```
[ Usuário preenche o formulário web ]
                 │
                 ▼
[ Otimização das fotos no próprio navegador ]   ← comprime imagens de celular em milissegundos
                 │
                 ▼
╔═════════════════ ETAPA 1 (rápida, ~2 s) ═════════════════╗
║ 1. Consulta prévia: esta atividade já tem relatório?     ║
║ 2. Cria/reaproveita a estrutura de pastas no Drive       ║
║ 3. Faz upload das fotos (quando a área usa fotos)        ║
║ 4. Grava a linha na planilha da área (sob trava/lock)    ║
╚═════════════════════════════════════════════════════════╝
                 │  (devolve: aba, número da linha, IDs das pastas)
                 ▼
╔═════════════════ ETAPA 2 (~20–40 s) ═════════════════════╗
║ 5. Copia o modelo oficial do Google Docs                 ║
║ 6. Substitui todas as marcações {{CAMPO}} pelos dados    ║
║ 7. Insere e redimensiona as fotos na grade              ║
║ 8. Monta a tabela do Plano de Atividades (Fundação CASA) ║
║ 9. Exporta em PDF e libera o botão de download          ║
╚═════════════════════════════════════════════════════════╝
```

**Por que 2 etapas?** O Google Apps Script tem um teto de ~6 minutos por execução. Separar o registro (rápido) da diagramação do PDF (lenta) mantém o sistema estável e dá um retorno rápido ao usuário. O custo é que, se a Etapa 2 falhar (oscilação de rede, recarregamento da página), a linha pode ficar gravada **sem** o PDF — situação tratada pela **Reconciliação Manual** (seção 9).

---

## 🔒 4. A Trava Anti‑Duplicidade

O SRA **não permite** dois relatórios para a mesma atividade no mesmo período. A verificação acontece em dois momentos:

1. **Consulta prévia** (enquanto o usuário preenche): assim que os campos que identificam a atividade estão completos, o sistema consulta a planilha e mostra um aviso — verde ("liberado") ou amarelo ("já enviado em tal data por tal pessoa").
2. **Revalidação definitiva** (no momento de gravar): a checagem roda **dentro de um `LockService`**, para que dois envios quase simultâneos não passem os dois. É aqui que a recusa é definitiva.

> A trava consulta **a planilha**, nunca as pastas do Drive. Apagar a **linha** libera um novo envio; apagar a **pasta** não libera nada.

### O que forma a "identidade" da atividade em cada área

| Área | Chave de identidade (o que não pode repetir no período) |
| :--- | :--- |
| **Pedagógico** | Unidade + Tipo + Nome da Atividade + Ano/Mês |
| **Articulação & Difusão** | Unidade + Nome da Atividade + Ano/Mês + **primeiro dia marcado no calendário** |
| **Bibliotecas** | Unidade + Nome da Atividade + **Data da Atividade** |
| **Fundação CASA** | Centro de Atendimento + Divisão Regional + Nome da Atividade + Ano/Mês + **Dias da Semana** + **Horário (início–fim)** |

### Fundação CASA: dias da semana + horário (turmas da mesma atividade)

Um oficineiro pode conduzir **duas turmas da mesma atividade, no mesmo centro e mês**, em horários diferentes (ex.: seg/qua 14h15–15h45 e seg/qua 16h30–18h). Para que ele consiga enviar **um relatório de cada turma**, o formulário da Fundação CASA tem, logo após o Mês de Referência:

- **Dias da semana**: 5 botões (Seg a Sex), seleção múltipla, obrigatório. Vai por extenso para a planilha (`"Segunda, Quarta"`) e abreviado para o nome do arquivo (`SEG-QUA`).
- **Horário da atividade**: início e término, obrigatórios. Ao preencher, **pré‑preenche automaticamente o horário de cada encontro** do Plano de Atividades (sem travar — a pessoa pode ajustar encontro a encontro).

Os dois campos **entram na chave de identidade**: turmas com horário diferente são relatórios distintos e passam as duas. A comparação dos dias considera o **conjunto inteiro** (`{Seg, Qua}` = `{Qua, Seg}`), não só o primeiro dia.

**Transição:** para meses em que a 1ª turma já foi enviada **antes** desses campos existirem, a linha antiga fica com essas colunas vazias e continua bloqueando um 2º envio do mesmo mês. Para destravar, a equipe preenche **Horário** (e Dias da Semana) na linha já existente. Do mês seguinte em diante, ninguém precisa de retoque manual.

### Como recusar/liberar manualmente

- **Liberar** um novo envio da mesma atividade: apagar a **linha** correspondente na planilha da área.
- **Bloquear**: basta a linha existir. Mesmo sem pasta/PDF, a trava recusa.

---

## 🔐 5. Área Restrita (Anexo de Documentos Pedagógicos)

Página separada (`forms/area-restrita.html`), destinada aos **responsáveis autorizados de cada unidade** para anexar, por atividade do Pedagógico, **1 PDF de Registro de Inscrição** e **1 PDF de Lista de Presença**.

### Como funciona

1. **Login com a Conta Google Poiesis** (via Firebase Authentication). A sessão dura **enquanto a aba estiver aberta** e cai ao fechar.
2. O e‑mail é validado contra a **Lista Branca** — aba `Responsaveis_Autorizados` na Planilha de Usuários. Essa consulta **nunca usa cache**: incluir/remover alguém tem efeito imediato no próximo carregamento.
3. A lista de **Unidades** disponíveis na tela é limitada às unidades liberadas para aquele e‑mail (coluna Unidade da Lista Branca: uma unidade, várias separadas por vírgula, ou `Todas`).
4. O responsável seleciona **Unidade, Ano, Mês, Tipo e Atividade**. O sistema mostra o **status atual dos anexos** dessa atividade (se já existem Inscrição/Presença enviados).
5. Os dois PDFs são enviados juntos, salvos no Drive na pasta da atividade (`Lista de Presença` e `Relação de Inscritos`) e as colunas de controle da planilha são marcadas.
6. **Não é permitido reenviar**: se a atividade já tem os dois documentos, o envio é recusado.

### Segurança no servidor

O backend **revalida** tudo o que a tela já checa, para bloquear chamadas diretas à API:
- o e‑mail precisa constar na Lista Branca;
- a unidade informada precisa estar entre as unidades liberadas para aquele e‑mail (ou o e‑mail ter acesso `Todas`);
- os dois arquivos precisam ser PDF e vir na mesma requisição.

---

## 🛠️ 6. Arquitetura e Tecnologias

Arquitetura **headless / serverless**, sem custo de servidor, integrada ao Google Workspace da instituição:

| Camada | Tecnologia | Papel |
| :--- | :--- | :--- |
| **Interface** | HTML5 + CSS3 + JavaScript (ES6), hospedados na **Vercel** | Formulários responsivos, validações, calendário, compressão de fotos no navegador, consulta prévia de duplicidade. |
| **Autenticação (Área Restrita)** | **Firebase Authentication** (login Google) | Identifica o responsável antes de liberar o anexo de documentos. |
| **Backend / automação** | **Google Apps Script** (API via POST/GET) | "Cérebro" do sistema: grava na planilha, organiza o Drive, gera o PDF, aplica a trava e a manutenção programada. |
| **Dados** | **Google Sheets** | Uma aba por área com todas as respostas; planilha separada de Usuários (Lista Branca); planilha de Listas Institucionais (dropdowns). |
| **Arquivos** | **Google Drive** | Fotos originais, PDF e Google Docs de cada relatório, em pastas hierárquicas. |
| **Modelo** | **Google Docs** | Um template por área, com marcações `{{CAMPO}}` que o sistema substitui. |

### Ambientes

`js/api.js` detecta o ambiente pelo endereço do navegador:
- **Homologação** — `localhost`, IP local ou domínio contendo `homolog` → aponta para o Apps Script de homologação.
- **Produção** — demais domínios → aponta para o Apps Script de produção.

O `doGet` do backend devolve um **marcador de versão** (`BACKEND_VERSION`) — serve para confirmar, sem abrir o editor, se a implantação `/exec` já está servindo o código mais recente.

---

## 📂 7. Organização Automática das Pastas no Google Drive

A cada registro, o sistema cria (ou reaproveita) a estrutura da área.

**Fábricas de Cultura (Pedagógico, Articulação, Bibliotecas):**
```
📁 FÁBRICAS DE CULTURA
 └── 📁 [Área]                     (ex.: Pedagógico)
      └── 📁 [Ano]                 (ex.: 2026)
           └── 📁 [Unidade]        (ex.: Cidade Tiradentes)
                └── 📁 [Mês]       (ex.: 05 - Maio)
                     └── 📁 [Tipo] (só no Pedagógico: Trilha/Ateliê/…)
                          └── 📁 [Atividade]
                               ├── 📁 Registro Fotográfico   (imagens originais)
                               ├── 📁 Relatório              (PDF + Google Docs)
                               ├── 📁 Lista de Presença      (Área Restrita, quando aplicável)
                               └── 📁 Relação de Inscritos    (Área Restrita, quando aplicável)
```

**Fundação CASA** (hierarquia própria, e o PDF fica na própria pasta da atividade):
```
📁 FÁBRICAS DE CULTURA
 └── 📁 Fundação CASA
      └── 📁 [Ano]
           └── 📁 [Divisão Regional]     (ex.: DR2)
                └── 📁 [Centro de Atendimento]
                     └── 📁 [Mês]
                          └── 📁 [Atividade]     ← PDF + Docs ficam aqui
```

### Nomenclatura dos arquivos de relatório

| Área | Padrão do nome |
| :--- | :--- |
| **Pedagógico** | `SIGLA-UNIDADE_RESPONSÁVEL_ATIVIDADE` |
| **Articulação & Difusão** | `DD-MM-AAAA_SIGLA-UNIDADE_EVENTO` (data do 1º dia marcado) |
| **Bibliotecas** | `DD-MM-AAAA_SIGLA-UNIDADE_ATIVIDADE_RESPONSÁVEL` |
| **Fundação CASA** | `RELATORIO - [razão social] - [unidade] - [MÊS] - [SEG-QUA 1415-1545]` |

Na Fundação CASA, o trecho **dias abreviados + horário** é o que diferencia a 1ª da 2ª turma da mesma atividade — as duas dividem a **mesma pasta**, só o nome do arquivo muda. Antes de gerar uma nova versão, o sistema remove a versão anterior **daquele mesmo relatório** (pelo escopo do nome), sem tocar nos relatórios vizinhos.

---

## 🩹 8. Reconciliação Manual de Relatórios Pendentes

Se a **Etapa 2 falhar** (rede, recarregamento da página, resposta transitória do Google), a linha fica gravada na planilha **sem** o PDF, e aparece no `_LOGS` um erro do tipo `generatePdfReportAsync ... ausente ou inválido`.

Nesse caso, a equipe de Sistemas roda **manualmente**, no editor do Apps Script, a função **`reconciliarRelatoriosPendentes`** (arquivo `apps-script/Reconciliacao.gs`):

1. Ajustar, se quiser, o bloco `RECONCILIACAO_CONFIG` no topo:
   - `AREA` — `""` para todas, ou o nome de uma área;
   - `LINHA` — `0` para varrer a janela, ou o número exato de uma linha (exige `AREA`);
   - `DIAS_PARA_TRAS` — só olha envios dos últimos N dias (padrão: 3);
   - `DRY_RUN` — `true` apenas lista o que faria, sem compilar.
2. Rodar a função.
3. Conferir o resumo no Logger (`escaneadas / jaComRelatorio / compiladas / semDados / falhas` + detalhe por linha) e o registro no `_LOGS`.

A rotina é **idempotente**: ela remonta o `formData` a partir das colunas da planilha, recupera as pastas (operação que nunca duplica pastas) e **só compila as linhas cujo relatório ainda não está na pasta**. Roda sob `LockService`, então não conflita com um envio em andamento.

Para a Fundação CASA, o **Plano de Atividades** (tabela de encontros) é gravado como JSON numa coluna própria da aba na Etapa 1, para que um relatório reconciliado saia completo, com a tabela.

> Por decisão da área, a reconciliação é **sempre manual** — não há gatilho automático nem auto‑correção silenciosa: o erro permanece visível no `_LOGS` para que a equipe saiba que precisa rodar a função.

---

## 🚧 9. Manutenção Programada

Para janelas de virada/manutenção, o sistema tem um interruptor no backend:

- **`SRA_MAINTENANCE = ON`** (Propriedades do script do Apps Script) faz o backend **recusar toda ação de gravação** (envio de formulário, geração de PDF, anexo da Área Restrita) **antes de tocar em qualquer planilha, pasta ou arquivo**. As ações de leitura (carregar listas, login, consultas de status) continuam funcionando.
- A **tela pública** `manutencao.html` é ativada por regra de roteamento na Vercel e serve apenas de comunicação.
- A equipe técnica libera o próprio acesso para testes controlados enviando um **`adminToken`** igual à propriedade `SRA_ADMIN_TOKEN`.
- Desligar: apagar/alterar a propriedade `SRA_MAINTENANCE` (não precisa reimplantar) e restaurar o roteamento normal na Vercel.

O passo a passo completo da virada está em `ops/CUTOVER-PRODUCAO.md`.

---

## 🧭 10. Guia Prático de Manutenção (para Gestores)

### A. Atualizar as listas suspensas (Unidades, Tipos, Atividades)
Não precisa mexer em código. Abra a **Planilha de Listas Institucionais**; cada aba representa uma unidade/setor. Adicione ou edite os nomes nas colunas correspondentes — o formulário se atualiza sozinho no próximo carregamento.

### B. Alterar o layout do relatório (PDF)
Abra o **Google Docs** modelo da área. Pode mudar logotipos, cores de cabeçalho, ordem de parágrafos. **Mantenha as marcações entre chaves duplas** (`{{UNIDADE}}`, `{{RESPONSAVEL}}`, `{{ATIVIDADE}}`, `{{ANEXOS}}`, e — na Fundação CASA — `{{DIAS_SEMANA}}` e `{{HORARIO}}`), pois é onde o sistema insere os dados.

### C. Liberar / remover acesso na Área Restrita (Lista Branca)
Abra a **Planilha de Usuários**, aba **`Responsaveis_Autorizados`**:
- **Incluir**: e‑mail corporativo (coluna A), Nome (B), Unidade (C), Setor (D).
- **Coluna C (Unidade)**: uma unidade (`Diadema`); várias separadas por vírgula/ponto‑e‑vírgula (`Diadema, Heliópolis, Osasco`); ou `Todas` para acesso irrestrito.
- **Remover**: apague a linha do e‑mail. Efeito imediato no próximo login (sem cache).

### D. Publicar alterações no Google Apps Script
Depois de editar qualquer arquivo `.gs` (`Code.gs`, `Report.gs`, `Drive.gs`, `Sheets.gs`, `Utils.gs`, `Reconciliacao.gs`) no editor:
1. Botão **Implantar (Deploy)** → **Gerenciar implantações**.
2. Ícone de lápis (Editar) → **Versão: Nova versão**.
3. **Implantar**. Confirme pelo `BACKEND_VERSION` no `doGet` que a URL `/exec` já serve o código novo.

### E. Adicionar colunas na planilha de respostas
Não é preciso criar as colunas à mão. Ao publicar o backend, o sistema insere as colunas novas na posição certa **na primeira gravação seguinte** e desloca os dados antigos para permanecerem alinhados. Colunas de texto livre (dias, horário, JSON do plano) recebem formato de texto automaticamente.

---

## 🗂️ 11. Estrutura de Arquivos do Projeto

```
index.html                     Página inicial (escolha da frente de trabalho)
apresentacao.html              Apresentação/treinamento do sistema
manutencao.html                Tela pública de manutenção programada
forms/
  pedagogico.html              Formulário do Pedagógico
  articulacao.html             Formulário de Articulação & Difusão (calendário)
  biblioteca.html              Formulário das Bibliotecas
  fundacao-casa.html           Formulário da Fundação CASA (plano + dias/horário)
  area-restrita.html           Área Restrita (anexo de Inscrição/Presença)
css/styles.css                 Design System das Fábricas de Cultura
js/
  api.js                       Comunicação com o Apps Script + detecção de ambiente
  auth.js                      Login Firebase e regras da Área Restrita
  main.js                      Lógica dos formulários, calendário, dias da semana,
                               consulta prévia de duplicidade, envio em 2 etapas
  image-compressor.js          Compressão de fotos no navegador
  shared-helpers.js            Utilitários compartilhados
apps-script/
  Code.gs                      Roteador da API, Etapa 1/2, manutenção, chave de identidade
  Sheets.gs                    Cabeçalhos por área, gravação da linha, trava anti-duplicidade
  Drive.gs                     Estrutura de pastas e nomes de arquivos
  Report.gs                    Geração do Google Docs + exportação em PDF
  Reconciliacao.gs             Reconciliação manual de relatórios pendentes
  Utils.gs                     Funções utilitárias (datas, textos, dias/horário, respostas)
  Config.gs                    IDs das planilhas, abas e templates
  Diagnostico.gs               Rotinas de diagnóstico
ops/CUTOVER-PRODUCAO.md         Passo a passo da virada de produção / manutenção
```

---

## ❓ 12. Perguntas Frequentes (FAQ)

**1. Por que o envio leva de 20 a 60 segundos?**
São 2 etapas: a Etapa 1 (~2 s) grava a linha e sobe as fotos; a Etapa 2 (~20–40 s) clona o Google Docs, substitui dezenas de marcações, ajusta as imagens e exporta o PDF.

**2. E se o usuário enviar fotos enormes (celular 4K)?**
O **compressor no navegador** (`js/image-compressor.js`) reduz cada imagem para ~1000 px antes do envio, sem perda visual perceptível — garantindo velocidade.

**3. Onde fica o PDF?**
Imediatamente, no botão verde de download na tela. Definitivamente, na pasta `Relatório` da atividade no Google Drive (na Fundação CASA, na própria pasta da atividade).

**4. Recebi o aviso "esta atividade já teve o relatório enviado". O que faço?**
É a trava anti‑duplicidade: já existe um relatório para essa atividade no período. Se algum dado precisa ser corrigido, contate `sistemasdegestao@poiesis.org.br`. Não há reenvio pela tela.

**5. A linha foi gravada mas o PDF não saiu. E agora?**
A Etapa 2 falhou. A equipe de Sistemas roda a função **`reconciliarRelatoriosPendentes`** (seção 8), que compila o relatório faltante a partir dos dados já gravados.

**6. Um oficineiro da Fundação CASA tem 2 turmas da mesma oficina no mesmo mês. Como enviar os 2 relatórios?**
Cada turma tem **dias da semana + horário** diferentes; basta preencher esses campos e enviar duas vezes — o sistema trata como relatórios distintos. (Se a 1ª turma foi enviada antes desses campos existirem, a equipe preenche Horário/Dias na linha antiga para destravar.)

**7. A Área Restrita pede login toda vez?**
Sim — a sessão é por aba e cai ao fechar, por segurança. É só entrar de novo com a Conta Google Poiesis.

---

*Documentação mantida pela equipe de Sistemas — Instituto Poiesis. Última revisão: setembro de 2026.*
