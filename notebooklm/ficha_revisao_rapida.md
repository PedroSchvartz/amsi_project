# Ficha de Revisão Rápida — TCC AMSI
## Tudo que você precisa saber em uma página — para usar na manhã da defesa

> **Como usar:** leia do topo ao fim sem parar. Se travar em qualquer item, abra o documento temático correspondente. Na manhã da defesa, releia só esta ficha.

---

## NÚMEROS QUE A BANCA VAI PERGUNTAR

| O quê | Valor |
|---|---|
| Testes automatizados (todos passando) | **214** |
| Perfis de acesso | **3** (Consulta, Operador, Administrador) |
| Tabelas no banco | **8+** (lancamento, usuario, clientefornecedor, tipo_conta, token_ativo, endereco, contato, login) |
| Endpoints da API | **50+** |
| Arquivos de documentação | **11** (`docs/01` a `docs/11`) |
| Expiração do token JWT | **60 minutos** (deslizante) |
| bcrypt cost factor | **12** (~250ms por hash, ~4.000 hashes/s) |
| MD5 hashes/segundo (GPU RTX 4090) | **164 bilhões** — por isso não MD5 |
| Linhas de código Python (backend) | **~9.150** |
| Forma normal do banco | **3NF** |
| Versão do React | **19** |
| Versão do React Router | **7** |

---

## STACK DE TECNOLOGIAS — DECISÃO E MOTIVO

| Tecnologia | Por que escolhida | Por que não a alternativa |
|---|---|---|
| **PostgreSQL** | DECIMAL exato + ENUM nativo + ACID robusto | SQLite: lock de arquivo; MySQL: menos rigoroso em tipos |
| **FastAPI** | Pydantic embutido + docs OpenAPI auto | Django: gera HTML (AMSI só usa JSON); Flask: plugins conflitantes |
| **SQLAlchemy** | Queries parametrizadas (anti-injection) + mapeamento objeto-relacional | SQL puro: SQL injection; sem ORM: row[3] ilegível |
| **JWT híbrido** | Stateless + logout real via `token_ativo` | Sessions: requer Redis em múltiplos servidores; JWT puro: sem logout real |
| **React 19** | Maior ecossistema + React Router maduro | Vue: ecossistema menor; Angular: overhead para equipe pequena |
| **CSS Custom Properties** | Troca de tema com um atributo no `<html>` | Tailwind: classes condicionais para temas; hardcode: impossível de manter |
| **fetch nativo** | Sem dependência extra; `fetchComLoading` cobre os casos | Axios: 14KB sem necessidade |
| **bcrypt** | Lento por design; salt automático; tempo constante | MD5/SHA-256: muito rápidos para força bruta |

---

## VOCABULÁRIO DO DOMÍNIO (1 linha cada)

- **Lançamento:** registro central de qualquer movimento financeiro (cobrança ou pagamento)
- **Natureza:** direção do dinheiro — Crédito = associação recebe; Débito = associação paga
- **Clifor:** Cliente + Fornecedor — entidade associada a um lançamento
- **Efetivar:** registrar o pagamento (`data_pagamento`, `valor_pago`, comprovante)
- **Inadimplente:** clifor com pelo menos 1 lançamento Crédito, vencido, não pago, não estornado
- **Estorno:** inversão da natureza — Crédito com `estorno=True` efetivamente é um Débito
- **Soft delete:** marcar `exclusao = NOW()` em vez de `DELETE` — preserva histórico e FKs

---

## ARQUITETURA — 3 CAMADAS DO BACKEND

```
models/     → estrutura do banco (classe Python = tabela SQL)
schemas/    → contrato da API (o que cada rota aceita e devolve)
routes/     → orquestra tudo: recebe HTTP, valida permissão, chama lógica, devolve JSON
```

**Por que múltiplos schemas por entidade:**
`LancamentoCreate` não tem `data_pagamento` (Operador não pode definir ao criar).
`LancamentoEditAdmin` tem todos os campos opcionais (Admin pode editar qualquer coisa).
`LancamentoResponse` tem `nome_clifor` calculado (não está no banco, vem do relacionamento).

---

## SEGURANÇA — AS 4 PROTEÇÕES

| Ameaça | Proteção | Onde |
|---|---|---|
| SQL Injection | SQLAlchemy ORM (queries parametrizadas) + Pydantic (rejeita tipos errados) | `backend/models/`, `backend/schemas/` |
| XSS | React usa `textContent` (não `innerHTML`); sem `dangerouslySetInnerHTML` | `AMSI_Frontend/src/components/` |
| CSRF | Auth por header `Authorization: Bearer` (não cookie — browser não envia auto) | `AMSI_Frontend/src/services/api.js` |
| Senha fraca | bcrypt cost 12 + salt automático + comparação em tempo constante | `backend/utils/auth_utils.py` |

**Ponto fraco reconhecido:** sem rate limiting em `/auth/token`. Em produção: `slowapi`.

---

## JWT HÍBRIDO — FLUXO COMPLETO

```
Login:     email/senha → bcrypt.verify() → gera JWT com jti (UUID) → salva jti em token_ativo → devolve token
Requisição: valida assinatura JWT → busca jti em token_ativo (não acha = 401) → verifica exp → verifica perfil → renova X-Session-Expires
Logout:    deleta jti de token_ativo → token imediatamente inválido (mesmo antes de exp)
```

---

## BANCO — CONCEITOS-CHAVE

**3NF:** cada atributo não-chave depende só da PK da sua tabela. `nome_clifor` fica em `clientefornecedor`, não repetido em cada `lancamento`.

**ACID com `autocommit=False`:** nada persiste sem `db.commit()` explícito. Exceção antes do commit = banco intacto.

**N+1 resolvido com `joinedload`:** 100 lançamentos = 1 query com JOIN (não 101 queries separadas).

**Soft delete:** `exclusao = NOW()` em vez de `DELETE`. Motivo: integridade referencial + auditoria financeira.

**Inadimplência:** campo `inadimplente` em `clientefornecedor` é recalculado por `atualizar_inadimplente()` a cada criação/efetivação/exclusão de lançamento.

**DECIMAL(15,2):** `0.1 + 0.2 = 0.3` exato. FLOAT daria `0.30000000000000004`.

---

## TESTES — O QUE IMPORTA

- **214 testes** usando `TestClient` do FastAPI com **banco real** (não mockado)
- **Integração**, não unitário: testa a stack completa (HTTP → Pydantic → SQLAlchemy → PostgreSQL → resposta)
- **`db_snapshot`:** conta linhas antes/depois de todos os testes → detecta teste que esqueceu de limpar dados
- **Teardown em cascata:** deletar filhos antes dos pais (lançamento antes de tipo_conta → respeita FK)
- **Sem testes de frontend** → limitação reconhecida; usaríamos Vitest + Playwright

---

## FRONTEND — PADRÕES NÃO ÓBVIOS

**Logout em múltiplas abas:** `localStorage.clear()` dispara evento `storage` em todas as abas abertas. `App.jsx` escuta `e.key === null` para detectar o clear e exibir "Sessão encerrada".

**JWT no localStorage:** vulnerável a XSS (script injetado pode ler). Alternativa: cookie `HttpOnly` (JS não lê, mas reintroduz CSRF). Decisão: localStorage aceitável para sistema interno sem scripts de terceiros.

**PrivateRoute e AdminRoute:** proteção de UI (esconde botões e rotas). A proteção real está no backend — 403 para qualquer ação não autorizada, independente do frontend.

**`fetchComLoading`:** spinner automático + token no header + retry em erro de conexão + logout automático em 401 + renovação de sessão via `X-Session-Expires`.

---

## RBAC — QUEM PODE O QUÊ

| Ação | Consulta | Operador | Admin |
|---|---|---|---|
| Ver lançamentos | ✓ | ✓ | ✓ |
| Criar lançamento | ✗ | ✓ | ✓ |
| Efetivar lançamento | ✗ | ✓ | ✓ |
| Editar lançamento | ✗ | ✗ | ✓ |
| Excluir lançamento | ✗ | ✗ | ✓ |
| Ver CPF/CNPJ | ✗ | ✓ | ✓ |
| Gerenciar usuários | ✗ | ✗ | ✓ |
| Ver dashboard | ✓ | ✓ | ✓ |

---

## LIMITAÇÕES RECONHECIDAS (responda com honestidade + proposta)

| Limitação | O que faria em produção |
|---|---|
| Sem rate limiting no login | `slowapi` para limitar tentativas por IP |
| Sem Alembic (migrations) | `alembic revision --autogenerate` para cada mudança de schema |
| `create_all` em vez de migrations | Adequado para dev; perigoso em prod com dados reais |
| CPF/CNPJ em texto no banco | Criptografar em repouso com chave simétrica separada |
| CORS aberto em dev (`"*"`) | Em prod: `allow_origins=["https://dominio-real.com"]` |
| Sem testes de frontend | Vitest (unitário) + Playwright (end-to-end) |
| Sem 2FA | TOTP com `pyotp`, código por e-mail na segunda etapa do login |
| Sem índices customizados | `CREATE INDEX` em `data_vencimento` e `id_clifor_relacionado_fk` |

---

## ARQUIVOS QUE A BANCA PODE PEDIR PARA VER

| Pergunta | Arquivo |
|---|---|
| "Onde fica a validação de permissão?" | `backend/auth/dependencies.py` |
| "Como o hash de senha é feito?" | `backend/utils/auth_utils.py` |
| "Onde fica a lógica de inadimplência?" | `backend/utils/inadimplencia.py` |
| "Onde ficam os modelos do banco?" | `backend/models/lancamento.py` |
| "Onde ficam os schemas?" | `backend/schemas/lancamento.py` |
| "Como o frontend gerencia sessão?" | `AMSI_Frontend/src/services/api.js` |
| "Onde ficam os testes?" | `backend/tests/conftest.py` e `test_lancamento.py` |
| "Como o CORS está configurado?" | `backend/main.py` (linhas ~30-40) |
| "Onde estão os temas CSS?" | `AMSI_Frontend/src/styles/theme.css` |
