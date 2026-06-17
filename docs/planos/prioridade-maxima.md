# 🔴 Prioridade Máxima

Lista de itens de prioridade máxima do projeto AMSI. Acima de qualquer item do
`escopo_futuro.md` — resolver estes antes de retomar o backlog normal.

> Criado em 2026-06-16.

---

## 1. Testar (e finalizar) o fluxo de reset de senha e de cadastro de usuário com senha

**Status:** em desenvolvimento (WIP) — há código na árvore de trabalho ainda não finalizado.

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

## ✅ Feito nesta sessão (2026-06-16)

- **Limpeza da poluição SvelteKit** no frontend (era um scaffold Svelte commitado
  por cima de um app React+Vite): removidos do `package.json` os pacotes
  `@sveltejs/*`, `svelte`, `svelte-check`, `eslint-plugin-svelte`,
  `prettier-plugin-svelte` e os pacotes-lixo `dom`/`router`; removidos os scripts
  `prepare`/`check`/`check:watch` (baseados em `svelte-kit`); excluído
  `svelte.config.js`; `eslint.config.js` e `.prettierrc` reescritos sem Svelte.
  O app sempre rodou via `@vitejs/plugin-react` (`vite.config.js`), então nada
  da execução foi afetado — só ferramental (`lint`/`format`).
