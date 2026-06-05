# Plano: Fundação multi-associação — JWT como fonte de verdade + escopos por associação

## Contexto

O app será transformado em um gerenciador financeiro para **qualquer** associação de moradores, não só a AMSI. Isso exige duas mudanças estruturais que se reforçam mutuamente:

1. **JWT como fonte de verdade**: hoje `get_current_user` faz **2 leituras de banco** a cada request autenticado (TokenAtivo + Usuario). O JWT já contém `sub` (id_usuario) e `perfil`, mas não `cargo` nem `id_associacao`. Ao embutir esses dados no token, o `Usuario` DB lookup pode ser eliminado — fica só a validação do `TokenAtivo` (por índice em `jti`).

2. **Isolamento por associação**: hoje não existe `id_associacao` em nenhuma tabela. Toda a base é global. Ao adicionar o campo e derivá-lo do JWT, cada query filtra naturalmente pela associação do usuário autenticado, sem leitura extra.

**Benefício secundário — visibilidade graduada por perfil**: um `Consulta` não é bloqueado no endpoint; o próprio SQL retorna só o que ele pode ver, sem dois round-trips ("busca o perfil → decide o que retornar").

---

## Estado atual (diagnóstico completo)

| Aspecto | Hoje |
|---|---|
| JWT payload | `{ sub, perfil, exp, jti }` |
| `get_current_user` | decode → `TokenAtivo` (jti) → **`Usuario` (id_usuario)** → retorna ORM completo |
| `id_associacao` | ❌ não existe em nenhum modelo |
| Permissão | endpoint-level: 403 se perfil insuficiente |
| Filtro de dados | todos os registros da tabela (sem escopo por associação) |
| Modelos com dados financeiros | `ClienteFornecedor`, `Lancamento`, `TipoConta` |

---

## Fase 1 — Modelo `Associacao` + migration

### 1.1 Novo modelo `backend/models/associacao.py`
```python
class Associacao(Base):
    __tablename__ = "associacao"
    id_associacao = Column(BigInteger, primary_key=True, autoincrement=True)
    nome          = Column(String(255), nullable=False)
    cnpj          = Column(String(20),  nullable=True)
    criado_em     = Column(TIMESTAMP,   server_default=func.now())
```

### 1.2 Adicionar `id_associacao` FK nos modelos existentes

Tabelas que recebem o campo (todos com `nullable=False` após migração):
- `usuario`
- `cliente_fornecedor`
- `lancamento`
- `tipo_conta`

Padrão de adição em cada modelo:
```python
from sqlalchemy import ForeignKey
id_associacao = Column(BigInteger, ForeignKey("associacao.id_associacao"), nullable=False)
```

### 1.3 Script de migração SQL (executar no Railway via pgAdmin)
```sql
-- 1. Criar tabela
CREATE TABLE associacao (
    id_associacao BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    criado_em TIMESTAMP DEFAULT now()
);

-- 2. Inserir associação inicial (AMSI)
INSERT INTO associacao (nome) VALUES ('AMSI') RETURNING id_associacao;
-- Supondo que retornou id = 1

-- 3. Adicionar coluna (nullable primeiro, para backfill seguro)
ALTER TABLE usuario            ADD COLUMN id_associacao BIGINT REFERENCES associacao(id_associacao);
ALTER TABLE cliente_fornecedor ADD COLUMN id_associacao BIGINT REFERENCES associacao(id_associacao);
ALTER TABLE lancamento         ADD COLUMN id_associacao BIGINT REFERENCES associacao(id_associacao);
ALTER TABLE tipo_conta         ADD COLUMN id_associacao BIGINT REFERENCES associacao(id_associacao);

-- 4. Backfill todos os dados existentes para a associação inicial
UPDATE usuario            SET id_associacao = 1;
UPDATE cliente_fornecedor SET id_associacao = 1;
UPDATE lancamento         SET id_associacao = 1;
UPDATE tipo_conta         SET id_associacao = 1;

-- 5. Tornar NOT NULL após backfill
ALTER TABLE usuario            ALTER COLUMN id_associacao SET NOT NULL;
ALTER TABLE cliente_fornecedor ALTER COLUMN id_associacao SET NOT NULL;
ALTER TABLE lancamento         ALTER COLUMN id_associacao SET NOT NULL;
ALTER TABLE tipo_conta         ALTER COLUMN id_associacao SET NOT NULL;
```

### 1.4 Atualizar `backend/utils/bootstrap.py`
O bootstrap cria o usuário admin inicial. Precisa:
- Criar (ou buscar) a `Associacao` default antes de criar o usuário
- Passar `id_associacao` ao criar o `Usuario`

---

## Fase 2 — JWT enriquecido

### 2.1 Atualizar `backend/utils/auth_utils.py`

Mudar assinatura de `criar_token_acesso`:
```python
# Antes: recebe dict arbitrário
def criar_token_acesso(dados: dict) -> str: ...

# Depois: recebe usuario e embute os claims necessários
def criar_token_acesso(usuario: "Usuario") -> str:
    payload = {
        "sub":           str(usuario.id_usuario),
        "perfil":        usuario.perfil_de_acesso.value,
        "cargo":         usuario.cargo.value,
        "id_associacao": usuario.id_associacao,
    }
    payload["exp"] = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload["jti"] = str(uuid.uuid4())
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
```

### 2.2 Atualizar chamada em `backend/auth/router.py`

```python
# Antes
token = criar_token_acesso({"sub": str(usuario.id_usuario), "perfil": ...})

# Depois
token = criar_token_acesso(usuario)
```

> **⚠️ Tokens existentes invalidam ao fazer deploy**: o JWT antigo não tem `id_associacao` — `get_current_user` novo levanta 401 por claims ausentes. Todos os usuários deslogam. Esperado e aceitável.

---

## Fase 3 — `ContextoUsuario` + dependency refator

### 3.1 Novo arquivo `backend/auth/contexto.py`

```python
from dataclasses import dataclass
from models.usuario import AcessoEnum, CargoEnum

@dataclass(frozen=True)
class ContextoUsuario:
    id_usuario:    int
    perfil:        AcessoEnum    # perfil_de_acesso
    cargo:         CargoEnum
    id_associacao: int
    jti:           str           # necessário no logout
```

`frozen=True` impede mutação acidental nas rotas.

### 3.2 Atualizar `backend/auth/dependencies.py`

`get_current_user` retorna `ContextoUsuario` em vez de `Usuario`:

```python
def get_current_user(...) -> ContextoUsuario:
    # 1. Decode JWT
    payload = jwt.decode(...)
    id_usuario    = payload.get("sub")
    jti           = payload.get("jti")
    perfil_str    = payload.get("perfil")
    cargo_str     = payload.get("cargo")
    id_associacao = payload.get("id_associacao")

    # Validar presença de todos os claims obrigatórios
    if not all([id_usuario, jti, perfil_str, cargo_str, id_associacao]):
        raise credentials_exception

    # 2. Única leitura de banco: verificar TokenAtivo por jti
    token_ativo = db.query(TokenAtivo).filter(TokenAtivo.jti == jti).first()
    if not token_ativo or token_ativo.exp < datetime.utcnow():
        ...  # expirou ou inválido

    # 3. Renovar sliding session (sem mudar)
    _renovar_token(token_ativo, db, response)

    # 4. Retornar contexto (sem novo SELECT em usuario)
    return ContextoUsuario(
        id_usuario    = int(id_usuario),
        perfil        = AcessoEnum(perfil_str),
        cargo         = CargoEnum(cargo_str),
        id_associacao = int(id_associacao),
        jti           = jti,
    )
```

`get_current_user_with_jti` pode ser **removido** — logout usa `ctx.jti` diretamente.

Atualizar `exige_admin`, `exige_operador_ou_admin`, `exige_perfil_minimo` para aceitar `ContextoUsuario`:
```python
def exige_admin(ctx: ContextoUsuario = Depends(get_current_user)) -> ContextoUsuario:
    if ctx.perfil != AcessoEnum.Administrador:
        raise HTTPException(403, "Acesso restrito a administradores")
    return ctx
```

### 3.3 Garantia de consistência: forçar re-login quando perfil muda

Sempre que um admin **altera o perfil, cargo, suspende ou bloqueia** um usuário, adicionar na mesma transação:
```python
db.query(TokenAtivo).filter(TokenAtivo.id_usuario_fk == id_usuario).delete()
```
JWT antigo (com claims desatualizados) é invalidado imediatamente. Afeta `routes/usuario.py`: `atualizar_usuario`, `suspender_usuario`, `bloquear_usuario`.

---

## Fase 4 — Escopo de associação em todas as rotas

### Padrão a aplicar em TODOS os `db.query(...)` de listagem e busca

```python
# Antes
registros = db.query(ClienteFornecedor).filter(...).all()

# Depois (ctx = ContextoUsuario injetado via Depends)
registros = db.query(ClienteFornecedor)\
              .filter(ClienteFornecedor.id_associacao == ctx.id_associacao)\
              .filter(...)\
              .all()
```

Criação de registros — `id_associacao` vem sempre do contexto, nunca do body:
```python
novo = ClienteFornecedor(
    ...
    id_associacao = ctx.id_associacao,
)
```

Arquivos afetados: `routes/cliente_fornecedor.py`, `routes/lancamento.py`, `routes/tipo_conta.py`, `routes/usuario.py`, `routes/login.py`, `routes/log_atividade.py`.

---

## Fase 5 — Paginação de listas (mesma superfície da Fase 4)

> **⚠️ Esta fase EXIGE atualizações no frontend** (ver "Impacto no frontend" ao final). Toda rota de listagem passa a devolver no máximo um lote — o front precisa enviar o tamanho do lote, paginar e renderizar os controles. Sem o ajuste do front, listas grandes vêm truncadas silenciosamente.

**Motivação:** hoje todo `listar_*` devolve a tabela inteira. Conforme as associações crescem (e com multi-associação, somando todas), uma única resposta pode trazer milhares de registros — payload pesado, lento, e desnecessário (o usuário vê uma página por vez). A paginação resolve isso retornando faixas (item 1–100, 101–200, …), com o **tamanho do lote definido pelo frontend** e um **teto imposto pelo backend**.

### 5.1 Dependency reutilizável `backend/utils/paginacao.py`

Centraliza os parâmetros e o teto num único lugar — FastAPI valida e rejeita (422) automaticamente quem pedir acima do limite, sem código manual:

```python
from dataclasses import dataclass
from fastapi import Query

LIMITE_MAXIMO = 1000   # teto duro do backend (frontend nunca recebe mais que isso por requisição)
LIMITE_PADRAO = 100    # usado quando o frontend não envia 'limit'

@dataclass(frozen=True)
class Paginacao:
    skip: int
    limit: int

def paginacao_params(
    skip:  int = Query(0,            ge=0,             description="Quantos registros pular (offset). Ex.: 100 começa no item 101."),
    limit: int = Query(LIMITE_PADRAO, ge=1, le=LIMITE_MAXIMO, description="Tamanho do lote. Máximo 1000."),
) -> Paginacao:
    return Paginacao(skip=skip, limit=limit)
```

> O teto é **1000** (e não 1001) por ser o número redondo que mantém o payload sob controle; `le=1000` faz o FastAPI devolver 422 automaticamente se o front pedir mais.

### 5.2 Padrão a aplicar em cada endpoint de listagem

Antes de aplicar `offset`/`limit`, contar o total (para o front saber quantas páginas existem) e devolvê-lo no header `X-Total-Count` — **mesmo padrão do `X-Session-Expires` já existente**, então o corpo continua sendo um array puro (menor quebra no front):

```python
@router.get("/", response_model=list[ClienteFornecedorResponse])
def listar_clifors(
    response: Response,
    pag: Paginacao = Depends(paginacao_params),
    db: Session = Depends(get_db),
    ctx: ContextoUsuario = Depends(get_current_user),
):
    base = db.query(ClienteFornecedor)\
             .filter(ClienteFornecedor.id_associacao == ctx.id_associacao)\
             .filter(...)                      # demais filtros já existentes

    response.headers["X-Total-Count"] = str(base.count())   # total ANTES de paginar
    return base.offset(pag.skip).limit(pag.limit).all()
```

### 5.3 Expor o header no CORS

`X-Total-Count` precisa entrar em `expose_headers` (`backend/main.py`), junto do `X-Session-Expires` que já está lá — senão o JavaScript do front não consegue lê-lo:

```python
expose_headers=["X-Session-Expires", "X-Total-Count"],
```

### 5.4 Escopo — onde aplicar e onde NÃO

- **Aplicar** nos endpoints que devolvem **listas de registros**: `listar_clifors`, `listar_lancamentos`, `listar_usuarios`, `listar_logins`, `log_atividade`, `listar_tipo_conta`, endereços/contatos por clifor.
- **NÃO aplicar** em endpoints de **agregação/resumo** (`/resumo`, saldos, dashboard) — retornam um objeto calculado, não uma lista paginável.

### Impacto no frontend (obrigatório nesta fase)

Como a resposta deixa de trazer "tudo de uma vez", o front precisa, em cada tela de lista (clifors, lançamentos, usuários, logins, logs):
1. **Enviar** `?skip=&limit=` nas chamadas de `api.js` (escolher um tamanho de página, ex.: 50 ou 100).
2. **Ler** o header `X-Total-Count` da resposta (o `handleResponse`/`fetchComLoading` precisa expor o header, não só o corpo).
3. **Renderizar** controles de paginação (próxima/anterior ou números de página) e recalcular `skip` a cada navegação.
4. **Coordenar o release**: subir back e front juntos — se o back paginar com `limit` padrão 100 e o front antigo continuar esperando a lista inteira, as telas mostram só os 100 primeiros registros **sem erro visível**.

---

## Fase 6 — Visibilidade graduada por perfil (campos, não linhas)

> *Fase independente, pode ser implementada separadamente depois das fases 1–5.*

Em vez de bloquear no endpoint, retornar schemas diferentes por perfil. Exemplo para o próprio usuário:

```python
class UsuarioResponseConsulta(BaseModel):
    id_usuario: int
    nome: str
    email: str

class UsuarioResponseCompleto(UsuarioResponseConsulta):
    cargo: str
    perfil_de_acesso: str
    data_cadastro: datetime
    suspenso: Optional[datetime]
    bloqueado: bool
```

No handler, escolher o schema pelo `ctx.perfil`. Aplica-se a qualquer recurso onde Consulta vê menos campos (clifors sem CPF, etc.).

---

## Sequência de implementação

1. **Fase 1** (migration SQL + modelos Python + bootstrap) — app continua funcional, auth não muda ainda.
2. **Fase 2 + 3** (JWT + ContextoUsuario) — numa única sessão; todos os tokens expiram ao deploy.
3. **Fase 4** (escopos) — pode ser feita em sub-grupos por arquivo de rota.
4. **Fase 5** (paginação) — mesma superfície da Fase 4 (faz sentido fazer junto, rota por rota). **Exige release coordenado back+front.**
5. **Fase 6** (visibilidade) — opcional, não bloqueia o sistema.

---

## Verificação por fase

| Fase | Como verificar |
|---|---|
| 1 | `SELECT COUNT(*) FROM associacao` → 1 linha; `SELECT id_associacao FROM usuario LIMIT 5` → todos com valor `1` |
| 2+3 | Inspecionar JWT em jwt.io → ver claims `cargo`, `id_associacao`; Railway logs → **zero** `SELECT ... FROM usuario WHERE id_usuario=` por request |
| 4 | Dados de uma associação não aparecem para usuário de outra (teste manual com 2 usuários de associações distintas) |
| 5 | `GET /clifor/?limit=10` → retorna ≤10 itens + header `X-Total-Count`; `?limit=5000` → **422** (acima do teto); `?skip=10` → começa no 11º registro |
| 6 | Login como Consulta → `GET /usuarios/me` → resposta sem `cargo`/`perfil_de_acesso` |

---

## Arquivos críticos

| Arquivo | Mudança |
|---|---|
| NEW `backend/models/associacao.py` | Novo modelo |
| `backend/models/usuario.py` | + `id_associacao` FK |
| `backend/models/cliente_fornecedor.py` | + `id_associacao` FK |
| `backend/models/lancamento.py` | + `id_associacao` FK |
| `backend/models/tipo_conta.py` | + `id_associacao` FK |
| `backend/utils/auth_utils.py` | `criar_token_acesso(usuario)` — assinatura nova |
| NEW `backend/auth/contexto.py` | `ContextoUsuario` dataclass |
| `backend/auth/dependencies.py` | `get_current_user` retorna `ContextoUsuario` |
| `backend/auth/router.py` | nova assinatura + logout usa `ctx.jti` |
| NEW `backend/utils/paginacao.py` | dependency `Paginacao` + teto `LIMITE_MAXIMO=1000` (Fase 5) |
| `backend/routes/*.py` (6 arquivos) | filtro `id_associacao` + aceitar `ContextoUsuario` (Fase 4); `skip`/`limit` + header `X-Total-Count` nas listagens (Fase 5) |
| `backend/main.py` | `expose_headers` += `X-Total-Count` (Fase 5) |
| `backend/utils/bootstrap.py` | criar/buscar `Associacao` antes de criar admin |
| **Frontend `AMSI_Frontend/`** | **`api.js` envia `skip`/`limit` e expõe `X-Total-Count`; telas de lista renderizam controles de paginação (Fase 5 — ver "Impacto no frontend")** |
| SQL via pgAdmin | migration da Fase 1.3 |

*Criado em: 2026-06-03 · Atualizado em: 2026-06-05 (Fase 5 — paginação adicionada)*
