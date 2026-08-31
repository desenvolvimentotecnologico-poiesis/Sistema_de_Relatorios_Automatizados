# Virada de produção — runbook (meio período)

Objetivo: publicar a versão de `homologacao` em produção **sem nenhum risco de
relatório perdido ou corrompido**, com testes controlados em produção antes de
reabrir para os usuários.

Princípio central: **quem garante que nada se perde é o interruptor do backend.**
A tela de manutenção do site é só comunicação. Enquanto `SRA_MAINTENANCE = ON`,
o backend recusa todo envio *antes* de tocar em qualquer planilha, pasta ou
arquivo — não importa se o usuário está com uma aba antiga aberta ou com cache.

---

## 0. Antes do dia

- [ ] Combinar data e turno com o solicitante (fora do fim/início de mês).
- [ ] Avisar as fábricas: sem envios durante a janela; previsão de retorno.
- [ ] Confirmar acesso: editor do Apps Script do **projeto de PRODUÇÃO** e painel
      da Vercel do projeto de produção.
- [ ] Definir a **chave de admin** da janela. Já existe uma pronta:

      Chave (SRA_ADMIN_TOKEN):  dec437ee16bcc4a013bed32ea5842b26

      Ela corresponde ao hash SHA-256 já embutido em `manutencao.html`.
      Para trocar por outra: gere um valor aleatório, calcule o SHA-256 dele,
      substitua `ADMIN_KEY_SHA256` em `manutencao.html` e use o mesmo valor na
      propriedade `SRA_ADMIN_TOKEN` do passo 1.
- [ ] Ter `homologacao` atualizada e validada (é o que vai para produção).

---

## 1. Congelar o backend  (≈5 min) — a partir daqui nada se perde

No editor do Apps Script do projeto de PRODUÇÃO:

1. **Configurações do projeto → Propriedades do script → Adicionar propriedade:**
   - `SRA_MAINTENANCE` = `ON`
   - `SRA_ADMIN_TOKEN` = `dec437ee16bcc4a013bed32ea5842b26` (ou a sua chave)
2. Cole os arquivos do backend da branch (conteúdo de `apps-script/`):
   `Code.gs`, `Config.gs`, `Drive.gs`, `Report.gs`, `Sheets.gs`, `Utils.gs`
   e **crie um arquivo novo `Diagnostico.gs`** com o conteúdo do arquivo homônimo.
   > `Config.gs` já está preenchido em produção — não sobrescreva os IDs reais.
   > Cole os outros arquivos; no `Config.gs`, mantenha os valores atuais.
3. Salvar tudo (Ctrl+S).
4. **Implantar → Gerenciar implantações → (implantação ativa) → ✏️ Editar →
   Versão: `Nova versão` → Implantar.**
   > Use **Editar a implantação existente**, NÃO "Nova implantação".
   > Editar mantém a MESMA URL `/exec`, então `GAS_API_URL_PROD` no front não muda.
   > Se criar uma implantação nova (URL nova), aí sim seria preciso mexer no
   > `js/api.js` — evite.
5. **Verificar o congelamento:**
   - Abrir a URL `GAS_API_URL_PROD` (a de produção, do `js/api.js`) no navegador.
     Deve responder JSON com `"maintenance": true` e o `backendVersion` novo
     (`2026-08-27.9 ...`).
   - No site de produção **ainda no ar**, tentar um envio de teste: deve falhar
     na hora com a mensagem de manutenção, **sem** criar linha na planilha nem
     pasta no Drive.

✅ Estado: nenhum envio é gravado a partir de agora. Zero risco de perda.

### Conferir "stragglers" (envios pela metade)

Se alguém fez a **Etapa 1** (planilha gravada) mas não a **Etapa 2** (PDF) nos
minutos anteriores ao congelamento, essa Etapa 2 será bloqueada. Olhe rápido as 4
abas de respostas: linhas recém-criadas sem PDF/link de relatório. Se houver,
anote (unidade + atividade + linha) para **regerar o PDF depois da janela** —
não há perda de dados, só falta o documento final.

---

## 2. Publicar a tela de manutenção para o público  (≈10 min)

Na sua máquina, na branch **`main`**:

```bash
git checkout main
git pull
git checkout homologacao -- manutencao.html
cp ops/vercel.maintenance.json vercel.json
git add manutencao.html vercel.json
git commit -m "ops: entra em manutencao programada para a virada de producao"
git push origin main
```

A Vercel publica em produção. O público passa a ver `manutencao.html` com a
previsão de retorno. Confirme abrindo o domínio de produção numa aba anônima.

> A regra da Vercel deixa passar quem tiver o cookie `sra_admin` (definido no
> passo 4). Todo o resto cai na tela de manutenção.

---

## 3. Subir o código novo e testar em produção  (maior parte da janela)

### 3a. Levar o front novo para produção (ainda atrás da manutenção)

```bash
git merge homologacao          # traz os 14 commits para a main
cp ops/vercel.maintenance.json vercel.json   # garante que a regra de manutencao continua
git add vercel.json
git commit -m "merge homologacao + mantem manutencao ativa"   # se o merge não pediu commit sozinho
git push origin main
```

O site de produção agora tem o código novo, mas **todo mundo continua vendo a
tela de manutenção** (só o cookie de admin passa).

### 3b. Backend já está no código novo (feito no passo 1). Só confira:

- `GAS_API_URL_PROD` no navegador → `backendVersion` novo + `"maintenance": true`.

### 3c. Testes controlados em produção

1. No domínio de produção, abrir `manutencao.html` → **Acesso administrativo** →
   digitar a chave → você é redirecionado para a aplicação real (cookie
   `sra_admin` setado; o front passa a mandar `adminToken` nas gravações).
2. Fazer **um envio completo (Etapa 1 + Etapa 2) por área**, com dados de teste
   claramente identificados (ex.: atividade `TESTE VIRADA <data>`), ou a
   atividade real que o solicitante autorizou:
   - [ ] Pedagógico
   - [ ] Articulação e Difusão
   - [ ] Bibliotecas
   - [ ] Fundação CASA
   - [ ] Área Restrita (upload de Inscrição/Presença)
3. Conferir em cada um:
   - [ ] a linha caiu na planilha **sob os cabeçalhos certos** (a migração
         automática de cabeçalho roda no 1º envio de cada área);
   - [ ] pasta no Drive com prefixo `DD-MM-AAAA` onde previsto (Bibliotecas e
         Articulação); sem prefixo em Pedagógico e Fundação CASA;
   - [ ] PDF gerado com **todas** as fotos;
   - [ ] um 2º envio idêntico é **bloqueado** com o aviso "já enviado";
   - [ ] aba `_LOGS` sem sobrescrita inesperada.
4. No editor, rodar `diagnosticarPlanilhas` (só leitura) e **guardar o
   resultado** — são as linhas legadas desalinhadas, para ajuste posterior fora
   da janela.
5. Limpar os registros de teste (linhas + pastas no Drive), ou deixá-los
   marcados, conforme combinado com o solicitante.

**Plano B de acesso** (se o cookie de admin não liberar a navegação na Vercel):
suba a branch já mesclada como **deploy de pré-visualização** (Preview) da Vercel
com o `vercel.json` **normal** (`ops/vercel.normal.json`). A URL de preview não
tem "homolog" no domínio, então fala com o backend de **produção**. Abra-a com
`?admin=<chave>` e faça os testes por lá; o público continua no `main` (produção)
vendo a manutenção.

Se algo falhar aqui: ver **Rollback** no fim. Nada foi reaberto ao público.

---

## 4. Reabrir  (≈10 min)

1. Voltar o roteamento normal do site:

   ```bash
   git checkout main
   cp ops/vercel.normal.json vercel.json
   git add vercel.json
   git commit -m "ops: encerra manutencao programada"
   git push origin main
   ```

2. No Apps Script: **Propriedades do script → apagar `SRA_MAINTENANCE`**
   (ou trocar para `OFF`). Não precisa reimplantar.
3. Verificar imediatamente:
   - [ ] `GAS_API_URL_PROD` no navegador → `"maintenance": false`, versão nova;
   - [ ] abrir um formulário no domínio de produção: listas carregam;
   - [ ] fazer **um** envio real de validação final (ou pedir a uma fábrica de
         confiança) e conferir planilha + Drive + PDF.
4. **Apagar a propriedade `SRA_ADMIN_TOKEN`** (encerra o acesso de bypass).
5. Limpar o cookie de admin do seu navegador (ou fechar o navegador).

---

## 5. Pós-virada (mesmo dia)

- [ ] Acompanhar os primeiros envios reais de cada área (conferência por amostra:
      alinhamento de colunas + pasta no Drive).
- [ ] Agendar, em separado, o ajuste das linhas legadas apontadas por
      `diagnosticarPlanilhas`.
- [ ] Regerar o PDF de eventuais "stragglers" do passo 1.
- [ ] Avisar solicitante e fábricas que o sistema voltou.

---

## Rollback (a qualquer momento antes do passo 4)

Nada a desfazer nos dados: o congelamento garantiu que nada foi gravado. A
migração de cabeçalho só **insere coluna** (não apaga) e só rodou nas linhas de
teste que você controla.

- **Front:** Vercel → Deployments → o deployment de produção anterior →
  **Promote to Production** (volta o site pré-virada na hora).
- **Backend:** Apps Script → Gerenciar implantações → ✏️ Editar → Versão →
  escolher a **versão anterior** → Implantar. Mesma URL.
- Apagar `SRA_MAINTENANCE` e `SRA_ADMIN_TOKEN`.

---

## Resumo de arquivos desta entrega

| Arquivo | Papel |
| :-- | :-- |
| `manutencao.html` | Tela pública de manutenção (autossuficiente) + acesso admin |
| `ops/vercel.maintenance.json` | `vercel.json` da janela (tudo cai na manutenção, exceto cookie admin) |
| `ops/vercel.normal.json` | `vercel.json` normal, para restaurar no fim |
| `apps-script/Code.gs` | Interruptor `SRA_MAINTENANCE` + bypass `SRA_ADMIN_TOKEN` + `maintenance` no doGet |
| `js/api.js` | Anexa `adminToken` nas gravações quando a chave está presente (inócuo fora da manutenção) |
