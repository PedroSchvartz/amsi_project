---
name: "source-command-deploy"
description: "Deploy completo do AMSI Project — verifica estado atual no Railway (backend) e Vercel (frontend), confere variáveis de ambiente, executa deploys em sequência e valida resultado. Use quando o usuário pedir para \"subir o projeto\", \"fazer deploy\", \"publicar nova versão\", \"atualizar o servidor\" ou \"subir nova versão no vercel e no railway\"."
---

# source-command-deploy

Use this skill when the user asks to run the migrated source command `deploy`.

## Command Template

# Deploy AMSI Project

Executar deploy completo do AMSI Project: backend FastAPI no Railway e frontend React/Vite no Vercel. Seguir as 5 fases abaixo em ordem, parando quando encontrar problemas que exijam intervenção do usuário.

**Diretório raiz do projeto:** `C:\Codigos\AMSI_Project_Desenvolvimento`
**Backend:** subpasta `backend/`
**Frontend:** subpasta `AMSI_Frontend/`

---

## FASE 1 — Descoberta do estado atual

### 1.1 Git status

```bash
git -C "C:\Codigos\AMSI_Project_Desenvolvimento" log --oneline -5
git -C "C:\Codigos\AMSI_Project_Desenvolvimento" status --short
```

Mostrar os últimos commits e se há mudanças não commitadas. Se houver mudanças não commitadas, alertar:
> "Há mudanças não commitadas. Recomendo commitar antes do deploy. Continuar mesmo assim?"

### 1.2 Status do Railway (backend)

```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\backend" && railway status
```

- Se retornar informações do projeto → capturar URL pública e status do último deploy. Marcar internamente `RAILWAY_LINKED=true`.
- Se retornar erro de "not linked", "no project", ou similar → marcar `RAILWAY_LINKED=false`. Executar `railway list` para mostrar projetos existentes na conta.

### 1.3 Status do Vercel (frontend)

```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\AMSI_Frontend" && vercel ls --prod 2>&1 | head -20
```

- Se retornar lista de deployments → capturar URL e status. Marcar `VERCEL_LINKED=true`.
- Se retornar erro de projeto não encontrado → marcar `VERCEL_LINKED=false`.

### 1.4 Pergunta ao usuário

Após mostrar o estado atual, perguntar:
> "O que deseja fazer?
> (1) Deploy de Backend + Frontend
> (2) Só Backend (Railway)
> (3) Só Frontend (Vercel)"

Continuar conforme a resposta. Se escolher (1) ou (2), executar Fases 2 e 3. Se escolher (1) ou (3), executar Fases 2 e 4. Sempre executar Fase 5 ao final.

---

## FASE 2 — Diagnóstico de variáveis de ambiente

Executar esta fase apenas se o deploy incluir o componente correspondente.

### 2.1 Variáveis do Railway (backend)

**NÃO** rode `railway variables` sem filtro: o dump completo joga **segredos** no log e é bloqueado pelo classificador de segurança. Verifique **presença** (0/1) de cada var, sem expor valores:

```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\backend" && for v in DATABASE_URL JWT_SECRET_KEY JWT_EXPIRE_MINUTES JWT_ALGORITHM APP_ENV FRONTEND_URL EMAIL_REMETENTE EMAIL_SENHA_APP; do echo "$v: $(railway variables --service "AMSI_Project" 2>/dev/null | grep -c "$v")"; done
```

Para conferir o **valor** de vars **não-secretas** (ok expor), filtre só elas:

```bash
railway variables --service "AMSI_Project" 2>/dev/null | grep -E "APP_ENV|FRONTEND_URL|JWT_EXPIRE_MINUTES|JWT_ALGORITHM"
```

**Obrigatórias — cada uma tem uma armadilha de _default silencioso_ se faltar (o app sobe mesmo assim e quebra em silêncio):**

| Variável | Armadilha se ausente |
|---|---|
| `DATABASE_URL` | sem banco; falha no startup |
| `JWT_SECRET_KEY` | usa fallback hardcoded inseguro → tokens forjáveis |
| `JWT_EXPIRE_MINUTES` | default **5 min** → sessão estoura no meio de um formulário |
| `JWT_ALGORITHM` | default `HS256` (ok, mas explicitar é melhor) |
| `APP_ENV` | default `development` → `/logs` exposto, comportamento de dev |
| `FRONTEND_URL` | links de e-mail/CORS apontam para URL errada |
| `EMAIL_REMETENTE` / `EMAIL_SENHA_APP` | e-mails (bootstrap, reset) **falham em silêncio** |

**Se faltar alguma, oferecer setar — sourcing os segredos do `config.env` local** (gitignored, já preenchido), sem pedir para o usuário colar segredo no chat. Detalhes que evitam as ciladas que já pegamos:

- **Não monte `KEY=VALOR` na linha de comando para segredos.** O PowerShell 5.1 corrompe argumentos com aspas/espaços embutidos, e o `config.env` pode ter valor entre aspas + comentário inline (ex.: `EMAIL_SENHA_APP="abcd efgh"  # nota`). Use o **próprio `python-dotenv`** (mesma lib do backend) para extrair o valor exato e injete via **stdin**:

```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\backend" && for K in JWT_SECRET_KEY EMAIL_REMETENTE EMAIL_SENHA_APP; do
  python -c "from dotenv import dotenv_values; import sys; sys.stdout.write(dotenv_values('../config.env')['$K'])" | railway variables set "$K" --stdin --service "AMSI_Project" --skip-deploys >/dev/null 2>&1
  echo "$K exit=$?"
done
```

- Vars **não-secretas** podem ir direto: `railway variables set "JWT_EXPIRE_MINUTES=60" --service "AMSI_Project" --skip-deploys`.
- Use **`--skip-deploys` em todas** e dispare **um** redeploy só no fim — a chamada `set` que dispara deploy automático às vezes retorna exit≠0; desacoplar é mais confiável:

```bash
railway redeploy --service "AMSI_Project" --yes
```

- Se a PowerShell/terminal **não** estiver na pasta `backend/` (onde está o link), passe `--project <ID> --environment production --service "AMSI_Project"` nos comandos `set`.
- **Setar `JWT_SECRET_KEY` invalida os tokens atuais** (todos deslogam) — esperado.
- Chamadas em rajada podem falhar por rate-limit transitório; **re-tente** a var que deu exit≠0.

Só continuar após confirmar presença = 1 para todas. Se `RAILWAY_LINKED=false`: pular por enquanto (tratado na Fase 3).

### 2.2 Variáveis do Vercel (frontend)

```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\AMSI_Frontend" && vercel env ls 2>&1
```

> ⚠️ **GOTCHA CENTRAL — Vite inlina `VITE_*` em BUILD TIME.** Setar/alterar uma `VITE_` **não** tem efeito no site até um **novo `vercel --prod`** (rebuild). Uma var adicionada *depois* do último build fica "presente porém fora do bundle" — foi exatamente o bug que nos custou um deploy. **Toda mudança de `VITE_` exige rebuild na Fase 4.**

Verificar `VITE_API_URL`:
- Deve existir em **Production** (é o ambiente que `vercel --prod` usa) e apontar para a URL do Railway, não `localhost`.
- **Development** é bom ter (usado por `vercel dev`).
- **Preview** só funciona se o projeto tiver **repositório Git conectado**. Em deploy via CLI (sem Git), Preview é inacessível — **não tente setar** (o CLI retorna `does not have a connected Git repository`).

Se `VITE_API_URL` estiver ausente/errada, capturar a URL do Railway (Fase 1) e setar (valor não é segredo, pode ir direto):

```bash
echo "https://URL_RAILWAY" | vercel env add VITE_API_URL production
echo "https://URL_RAILWAY" | vercel env add VITE_API_URL development
```

Setar **antes** da Fase 4 — o rebuild de lá é o que assa o valor no bundle.

---

## FASE 3 — Deploy do Backend (Railway)

### 3.1 Projeto já linkado (`RAILWAY_LINKED=true`)

```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\backend" && railway up --service "AMSI_Project" 2>&1
```

> O `--service` é **obrigatório**: o projeto tem mais de um serviço e `railway up` sozinho falha com `Multiple services found`. O mesmo vale para `railway redeploy`/`railway variables` (o serviço linkado aparece como `None` no `railway status`).

Monitorar o output. O Railway executará o build (Nixpacks) e depois o health check em `GET /` (configurado no `railway.toml` com timeout de 30s).

> **Só mudou variável de ambiente?** Não precisa `railway up` (rebuild). Um `railway redeploy --service "AMSI_Project" --yes` reinicia o serviço com as novas vars, bem mais rápido.

### 3.2 Projeto não linkado (`RAILWAY_LINKED=false`)

```bash
# Listar projetos existentes na conta
railway list 2>&1
```

Mostrar a lista e perguntar ao usuário:
> "O projeto já existe na conta (escolha o número) ou devo criar um novo?"

**Se existir e precisar linkar:**
```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\backend" && railway link
```

**Se for novo:**
```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\backend" && railway init
```

Após linkar/criar, executar o deploy:
```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\backend" && railway up --service "AMSI_Project" 2>&1
```

### 3.3 Verificar resultado

Após o deploy:
```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\backend" && railway status 2>&1
```

Capturar a URL pública do serviço para usar na Fase 4.

Se o deploy falhar: executar `railway logs --tail 30` e mostrar as últimas linhas. A causa mais comum de falha de startup é `DATABASE_URL` incorreta ou banco inacessível.

---

## FASE 4 — Deploy do Frontend (Vercel)

### 4.1 Verificação de pré-condição (build)

Ler `AMSI_Frontend/svelte.config.js` e `AMSI_Frontend/vercel.json`. O projeto usa Vite como runner de build (não SvelteKit diretamente) e gera saída em `dist/`. Verificar se `outputDirectory` no `vercel.json` é `dist` — se não for, alertar antes de continuar.

### 4.2 Projeto já linkado (`VERCEL_LINKED=true`)

```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\AMSI_Frontend" && vercel --prod 2>&1
```

### 4.3 Projeto não linkado (`VERCEL_LINKED=false`)

O CLI do Vercel fará perguntas interativas na primeira execução. Orientar o usuário:
- "Link to existing project?" → Sim (se já existe na conta) / Não (se novo)
- Nome sugerido: `amsi-project`
- Root directory: `.` (já está em AMSI_Frontend/)

```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\AMSI_Frontend" && vercel --prod 2>&1
```

### 4.4 Verificar resultado

Capturar a URL do deployment na saída do comando. Se falhar, mostrar o erro completo — a causa mais comum é `VITE_API_URL` não configurada (Fase 2.2).

---

## FASE 5 — Verificação final

### 5.1 Testar backend

> ⚠️ **ARMADILHA QUE JÁ NOS PEGOU (2026-10-01): `GET / → 200` NÃO prova que o deploy novo
> subiu.** Quando o build/deploy do Railway **falha**, o Railway mantém a **imagem anterior no
> ar**, servindo `200` normalmente. Um `curl 200` em cima da imagem velha dá "verde" falso — foi
> o que me fez reportar "deployado e verificado" com o backend rodando código de semanas antes
> (login e esqueci-senha quebrados em prod). **200 é condição necessária, não suficiente.** Faça
> os TRÊS passos abaixo, nesta ordem, e só declare sucesso se os três passarem.

**(a) O deploy mais recente SUCEDEU?** (pega build/deploy falho que deixou a imagem velha no ar)

```bash
cd "C:\Codigos\AMSI_Project_Desenvolvimento\backend" && railway status 2>&1 | grep -A2 "All resources"
```

A linha do serviço `AMSI_Project` **não** pode conter `Deploy failed` nem `Crashed`, e o tempo
entre parênteses tem de ser **recente** (minutos, compatível com este deploy) — se disser
`Deploy failed (10h ...)` ou um tempo velho, o build novo **não** entrou. Nesse caso puxe o
motivo e corrija **antes** de qualquer outra coisa:

```bash
railway logs --build 2>&1 | tail -40   # erro do build; e confira o timestamp da imagem ativa
```

**(b) Processo no ar** (necessário, não suficiente):

```bash
curl -s -o /dev/null -w "%{http_code}" https://URL_RAILWAY/ 2>&1   # espera 200; se não, aguardar 30s e repetir
```

**(c) O código NOVO está mesmo servindo?** (a prova que o 200 não dá) — confirme no `/openapi.json`
de prod um elemento de contrato que **este** deploy mudou e compare com o código commitado. Ex.
real do pacote 2026-10 (o campo de recuperação virou `login`): em prod velho vinha `email`.

```bash
curl -s https://URL_RAILWAY/openapi.json \
  | python -c "import sys,json; print(json.load(sys.stdin)['components']['schemas']['EsqueciSenhaRequest'])"
# tem de refletir o schema do backend/auth/router.py commitado; se vier o campo antigo, prod está defasada
```

Se a mudança do deploy não for de schema, use um request que **só o código novo** responde certo
(ex.: um corpo que daria `422 Field required` no contrato antigo e `200`/esperado no novo). Só
passe para 5.2 quando (a), (b) e (c) baterem.

### 5.2 Testar frontend

```bash
# Substituir URL_VERCEL pela URL capturada na Fase 4
curl -s -o /dev/null -w "%{http_code}" https://URL_VERCEL/ 2>&1
```

Esperado: `200`.

### 5.3 Teste funcional (além do HTTP 200)

200 só prova que o processo subiu — **não** que as env vars pegaram. Confirmar o que de fato quebrou antes:

- **Sessão (`JWT_EXPIRE_MINUTES`):** conferir o valor server-side e/ou o header de sessão num login real:
```bash
railway variables --service "AMSI_Project" 2>/dev/null | grep -E "JWT_EXPIRE_MINUTES"   # deve ser 60, não vazio/5
```
  Num login pelo front, o header `X-Session-Expires` (ou `localStorage.expiresAt`) deve ficar ~`JWT_EXPIRE_MINUTES` à frente — não ~5 min.
- **E-mail (`EMAIL_*`):** disparar um reset de senha (ou rerodar o bootstrap) e confirmar recebimento — prova que as credenciais SMTP pegaram.
- **`VITE_API_URL` no bundle:** abrir o site, logar e cadastrar algo. Se as chamadas vão para a URL do Railway (não `localhost`/`undefined`), o build assou a var certa. Se falham com base errada → a var foi setada **após** o último build: refazer `vercel --prod`.

### 5.4 Exibir resumo

```
=== DEPLOY AMSI CONCLUÍDO ===

Backend (Railway):
  URL: https://[url-railway]
  Deploy: [✓ sucesso recente | ✗ FALHOU/velho]   <- 5.1(a): se falhou, imagem velha no ar
  HTTP /: [✓ 200 | ✗ ERRO]                        <- 5.1(b)
  Código novo servindo: [✓ contrato confere | ✗ defasado]  <- 5.1(c): o 200 não prova isto

Frontend (Vercel):
  URL: https://[url-vercel]
  HTTP /: [✓ 200 | ✗ ERRO]
  Carimbo no bundle: [✓ data de hoje | ✗ velho]

VITE_API_URL configurada: https://[url-railway]
```

> Só escreva "CONCLUÍDO" se **Deploy** e **Código novo servindo** estiverem ✓. HTTP 200 sozinho
> é o sinal falso da armadilha 5.1 — nunca declare sucesso só com ele.

---

## Casos edge e troubleshooting

| Situação | Ação |
|---|---|
| `railway status` → "not linked" | Executar `railway list`, pedir ao usuário escolher ou criar projeto |
| Env vars faltando no Railway | Oferecer setar sourcing do `config.env` local via dotenv+stdin (ver 2.1); não pedir segredo no chat |
| `railway variables set` de segredo dá exit≠0 | PS 5.1 corrompe aspas/espaços embutidos → usar `--stdin`+dotenv (2.1). Se persistir, é rate-limit transitório → re-tentar a var |
| `railway variables set` sem `--skip-deploys` falha | A chamada que dispara deploy automático às vezes retorna exit≠0 → usar `--skip-deploys` e disparar `railway redeploy --yes` à parte |
| `railway variables/set` → "No linked project" | Terminal fora de `backend/` → passar `--project <ID> --environment production --service "AMSI_Project"` |
| `VITE_API_URL` ausente ou localhost | Detectar URL do Railway, confirmar com usuário, setar via `vercel env add` (Production+Development) |
| Mudança em `VITE_` não reflete no site | Vite inlina em build time → refazer `vercel --prod` (rebuild) |
| `vercel env add ... preview` → "no connected Git repository" | Projeto é CLI-only (sem Git) → Preview é inacessível; **pular** Preview, usar só Production+Development |
| `railway up` falha | Mostrar `railway logs --tail 30`, identificar causa, orientar correção |
| `railway status` → `Deploy failed`/`Crashed` porém `curl /` dá 200 | Imagem ANTERIOR no ar (falso verde). Código novo NÃO está servindo → `railway logs --build` p/ a causa, corrigir e resubir. Ver 5.1(a)/(c) |
| Deploy de backend bloqueado pelo classificador (`Production Deploy`) | Claude não roda `railway up`/`redeploy` em prod — o Pedro roda o comando, ou adiciona regra Bash de permissão |
| `vercel --prod` falha no build | Verificar output de erro — geralmente `VITE_API_URL` não configurada ou conflito de deps |
| Token Vercel/Railway expirado | Orientar `vercel login` ou `railway login` antes de continuar |
| Mudanças não commitadas | Alertar antes da Fase 1, mas não bloquear se o usuário quiser continuar |
| Deploy do backend OK, frontend bloqueado | O Railway permanece com a nova versão — não fazer rollback automático |

---

## Referência — Variáveis de ambiente

**Backend (Railway, serviço `AMSI_Project`)** — segredos vêm do `config.env` local (gitignored):

| Variável | Obrigatória | Origem do valor | Se ausente |
|---|---|---|---|
| `DATABASE_URL` | ✅ | plugin Postgres do Railway (referência) | falha no startup |
| `JWT_SECRET_KEY` | ✅ | `config.env` local | fallback inseguro → tokens forjáveis |
| `JWT_EXPIRE_MINUTES` | ✅ | valor fixo (prod: `60`) | default 5 min → sessão estoura |
| `JWT_ALGORITHM` | ⚠️ | valor fixo `HS256` | default ok, mas explicitar |
| `APP_ENV` | ✅ | valor fixo `production` | default `development` → `/logs` exposto |
| `FRONTEND_URL` | ✅ | URL do Vercel | links/CORS errados |
| `EMAIL_REMETENTE` | ✅ | `config.env` local | e-mails falham em silêncio |
| `EMAIL_SENHA_APP` | ✅ | `config.env` local (senha de app Gmail) | e-mails falham em silêncio |

**Frontend (Vercel, projeto `amsi-frontend`)** — `VITE_*` inlinadas em **build time**:

| Variável | Obrigatória | Valor | Observação |
|---|---|---|---|
| `VITE_API_URL` | ✅ | URL do Railway | Production (obrigatório) + Development; Preview só com repo Git |
| `VITE_DB_SLEEP_MS` | ❌ | default `120000` | retry quando o banco "acorda"; opcional |
