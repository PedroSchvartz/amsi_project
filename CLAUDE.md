# AMSI Project — orientação para o Claude

Sistema de **gestão financeira** para a Associação de Moradores de Santa Isabel.
TCC do Pedro com **aplicação real** — não é exercício acadêmico. MVP finalizado:
backend e frontend em produção.

## Stack

- **Backend**: FastAPI (Python) + PostgreSQL 17.4 — `backend/`
- **Frontend**: React + Vite (JSX) — `AMSI_Frontend/src/`, deploy na Vercel
- **Auth**: JWT próprio (HS256) + bcrypt

## Leia ANTES de codar (fontes da verdade)

Estes arquivos mandam mais que este resumo:

- `backend/comentarios/tabelas_do_banco.txt` — **SQL fonte da verdade** do banco.
  Confira nomes de coluna aqui antes de escrever qualquer model ou query.
- `backend/contexto_macro.txt` — estrutura e padrões de desenvolvimento do backend.
- `AMSI_Frontend/contexto_macro_front.txt` — estrutura, temas e contrato com a API.
- `openapi_ai.yaml` (raiz) — contrato da API.
- `backend/comentarios/fase_atual.txt` / `AMSI_Frontend/fase_atual_front.txt` — estado e pendências.

> ⚠️ As seções de **"fase atual" / "pendências"** desatualizam rápido, e alguns detalhes
> **se contradizem entre arquivos** (ID do admin, existência da trigger de inadimplência,
> contagem de testes). Não trate esses números/estados como verdade — leia o **código** e o
> **`tabelas_do_banco.txt`** para o estado real.

## Convenções inegociáveis

### Backend

- **Sempre `model → schema → route`** — nunca pular etapas. Registrar a route nova no `main.py`.
- Mudou o banco? Atualize `tabelas_do_banco.txt` **antes** → depois model → schema → route.
- **ENUMs sem acento**: `Debito`/`Credito` (natureza); `C`/`F`/`A` (tipo_clifor).
  Models usam `values_callable`.
- Identificador do usuário é o **EMAIL** (campo `login` foi removido).
- `LancamentoCreate` **não** aceita estorno — setar via `PUT` depois de criar.
- Reaproveite os helpers de `utils/frequentes.py` (boolput, configure_logging, etc.).
- Códigos de erro: 404 não-encontrado · 400 dado inválido · 401 não-autenticado ·
  403 sem permissão · 409 conflito · 500 deixe o FastAPI tratar. Nunca 200 com erro no body.
  Nunca retornar o campo `senha`.

### Frontend

- **Nunca cor hardcoded — sempre `var(--nome)`** (dois temas: verde padrão + corporativo).
- Componentes/Pages em PascalCase (Pages com sufixo `Page`); services camelCase agrupados
  em `services/api.js`; variáveis de domínio em português.
- Notificações: `ToastStack` + `useToast`. Confirmações: `ModalConfirm`.

## Como escrever código aqui

YAGNI: o mínimo que funciona. Prefira editar/remover a adicionar; não crie abstração
"para o futuro". Mas validação, segurança e tratamento de erro **nunca** entram no corte.

## Não commitar

- `config.env` — contém segredos. Use `config.env.example` como referência.
