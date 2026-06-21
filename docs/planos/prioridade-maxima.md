# 🔴 Prioridade Máxima

Lista de itens de prioridade máxima do projeto AMSI. Acima de qualquer item do
`escopo_futuro.md` — resolver estes antes de retomar o backlog normal.

> Criado em 2026-06-16.

---

## 1. Testar (e finalizar) o fluxo de reset de senha e de cadastro de usuário com senha

**Status:** ✅ **CONCLUÍDO** (commit `7a6336e`, finalizado/verificado em 2026-06-18).
Os 2 testes que estavam vermelhos passam, suíte completa 286/286 verde, o e-mail de
reset manda **link com token** (sem senha em plaintext — resolve o alto #3) e
`/esqueci-senha` responde neutro (sem enumeração de e-mail). Smoke-test de front
pendente apenas como conferência manual opcional. Detalhe histórico do que faltava abaixo.

**Contexto / onde está o código:**
- Backend (novos / modificados):
  - `backend/models/senha_token.py` — modelo do token de definição/redefinição de senha.
  - `backend/utils/senha_token.py` — geração/validação do token.
  - `backend/utils/rate_limit.py` — limitador (slowapi) usado no fluxo de login/senha.
  - `backend/auth/router.py` — rotas de autenticação (login, reset).
  - `backend/main.py` — registro do `limiter` / handler de `RateLimitExceeded`.
- Frontend:
  - Página de login com link **"Criar conta →"** (auto-cadastro com senha).
  - Dica **"esqueceu a senha?"** exibida após 3 falhas de login (escopo 2.9 — já commitado em `1c29a5c` / `bee29eb`).

**O que falta (2 testes vermelhos confirmados em 2026-06-16):**
- `backend/tests/test_auth.py::test_token_invalidado_apos_resetar_senha`
  — ao resetar a senha (admin: `POST /usuarios/{id}/resetar-senha`), o **token antigo
  do usuário deve ser invalidado** (passar a retornar 401). Hoje ainda retorna 200.
- `backend/tests/test_usuario.py::test_resetar_senha_seta_primeiro_acesso_true`
  — após o reset, **`primeiro_acesso` deve voltar para `True`**. Hoje fica `False`.

**Ações:**
1. Implementar a invalidação de tokens ativos no reset de senha (remover/expirar
   `TokenAtivo` do usuário) e setar `primeiro_acesso = True`.
2. Fazer os 2 testes acima passarem.
3. Smoke-test no front (como foi feito no 6.3):
   - Fluxo "esqueci a senha" → e-mail/token → definir nova senha → login.
   - Fluxo "Criar conta →" (cadastro de usuário com senha).
4. Conferir o achado de segurança relacionado: **senha em plaintext no e-mail/URL**
   (alto #3 da auditoria 2026-06-11) — não enviar senha; usar token de definição.

---

## 2. pytest deve **deletar de verdade** o conteúdo que gerou (hard delete)

**Status:** ✅ **CONCLUÍDO** (commit `11ac161`, verificado em 2026-06-18). A fixture
`_orfaos_de_teste` em `backend/tests/conftest.py` faz `DELETE /usuarios/{id}/hard` no
teardown da sessão para todo usuário criado durante a suíte; `db_snapshot` volta ao
baseline nos 286 testes. `usuario` é a **única** entidade com soft-delete (todas as
outras já usam `db.delete()` real), então a ação 3 não tinha trabalho. Detalhe abaixo.

**Problema:** o endpoint `DELETE /usuarios/{id}` faz **soft delete** — apenas seta
`usuario.exclusao = datetime.now()` (a linha permanece no banco e é filtrada por
`exclusao == None`). Testes que criam usuários e os "deletam" por esse caminho
**deixam a linha no banco**. Isso:
- faz o fixture `db_snapshot` (que compara contagem de linhas antes/depois) acusar
  "banco ficou sujo", ou
- acumula linhas órfãs de teste no banco de desenvolvimento ao longo do tempo.

**Já existe a solução no backend:** `DELETE /usuarios/{id}/hard`
(`deletar_usuario_hard` em `backend/routes/usuario.py:162`) — hard delete com cascade
real (tokens, login, lançamentos, clifor, logs, senha_token). Restrito a
**Administrador + Desenvolvedor** e oculto do OpenAPI.

**Ações:**
1. No teardown/fixtures do pytest, remover de verdade os registros gerados —
   via `DELETE /usuarios/{id}/hard` (com headers de Admin+Desenvolvedor) ou
   deleção direta na sessão de teste — em vez de depender do soft-delete.
2. Garantir que `db_snapshot` volte ao baseline em toda a suíte.
3. Aplicar o mesmo princípio a outras entidades que tenham soft-delete, se houver.

---

## 3. 🔴 BUG DE PRODUÇÃO — frontend não tem a página `/definir-senha` (link do e-mail dá 404)

**Status:** ✅ **CONCLUÍDO em código** (2026-06-21, ainda não deployado). Criada a página
`/definir-senha` (`AMSI_Frontend/src/pages/DefinirSenhaPage.jsx`) que lê o token do **fragment**,
valida via `POST /auth/validar-token-senha` e define a senha com auto-login; rota registrada no
`App.jsx`; fluxo self-service "Esqueceu a senha?" no `Login.jsx` (mensagem neutra, sem enumeração)
+ serviços `esqueciSenha`/`validarTokenSenha`/`definirSenha` em `api.js`; removido o `?senha=`
legado de `Login.jsx`/`TrocarSenhaPage.jsx`. Verificado no browser e no build de produção.
**Falta:** e2e do round-trip (ação 3) e deploy. Detalhe histórico abaixo.

**Problema:** o backend foi migrado para **links com token** (commit `7a6336e`, que fechou
o achado de senha em plaintext), mas a **página do frontend que consome o token nunca foi
criada**. O backend monta `{FRONTEND_URL}/definir-senha#token=...`
(`backend/utils/senha_token.py:117`) e envia esse link em **3 fluxos**:
- **Cadastro de novo usuário** (`backend/routes/usuario.py:80`) — a senha é um token
  aleatório inutilizável; o usuário só consegue logar definindo a senha pelo link.
- **Reset pelo admin** (`backend/routes/usuario.py:283`).
- **"Esqueci a senha" self-service** (`backend/auth/router.py:233`).

O frontend **não tem rota `/definir-senha`** (`AMSI_Frontend/src/App.jsx`) — o link cai no
catch-all `NotFoundPage` (404). Busca em todo o `src`: nenhuma referência a `definir-senha`,
`esqueci-senha` ou `validar-token-senha`. A dica *"Esqueceu sua senha? Confira seu e-mail!"*
é passiva (nada chama `/auth/esqueci-senha`).

**Impacto:** usuário recém-criado **não consegue definir senha nem logar**; reset de senha
idem. Passou despercebido porque os testes de backend usam usuários de bootstrap com senha
conhecida e `enviar_email` é stubado (286 verdes não exercitam o link real), e o smoke-test
de front (item 1, ação 3) nunca foi feito.

**Ações:**
1. Criar a página `/definir-senha` no React: lê o token do **fragment** (`#token=`), chama
   `POST /auth/validar-token-senha` para saudar/expirar, form de nova senha → `POST
   /auth/definir-senha` (que já faz auto-login e devolve sessão). Registrar a rota no `App.jsx`.
2. (Opcional/maior) tela self-service "esqueci a senha" que chama `POST /auth/esqueci-senha`.
3. Cobrir com e2e (Playwright) o round-trip completo.
4. Limpar o código legado de senha-em-query no `Login.jsx`/`TrocarSenhaPage.jsx`
   (`?senha=` em `/trocar-senha`) — o backend não envia mais esse formato.

---

## ✅ Feito nesta sessão (2026-06-16)

- **Limpeza da poluição SvelteKit** no frontend (era um scaffold Svelte commitado
  por cima de um app React+Vite): removidos do `package.json` os pacotes
  `@sveltejs/*`, `svelte`, `svelte-check`, `eslint-plugin-svelte`,
  `prettier-plugin-svelte` e os pacotes-lixo `dom`/`router`; removidos os scripts
  `prepare`/`check`/`check:watch` (baseados em `svelte-kit`); excluído
  `svelte.config.js`; `eslint.config.js` e `.prettierrc` reescritos sem Svelte.
  O app sempre rodou via `@vitejs/plugin-react` (`vite.config.js`), então nada
  da execução foi afetado — só ferramental (`lint`/`format`).
