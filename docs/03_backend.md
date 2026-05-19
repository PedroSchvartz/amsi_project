# 03 — Backend: Estrutura e Funcionamento

> **O que você aprende aqui:** como o backend é dividido em camadas, o papel de cada pasta, e o caminho completo que uma requisição percorre desde chegar no servidor até devolver JSON.

---

## Estrutura de pastas

```
backend/
├── main.py                  ← Ponto de entrada: cria o app, registra rotas, cria tabelas
├── database.py              ← Configura a conexão com o PostgreSQL
│
├── models/                  ← Camada de dados: define as tabelas como classes Python
│   ├── usuario.py
│   ├── lancamento.py
│   ├── cliente_fornecedor.py
│   ├── tipo_conta.py
│   ├── token_ativo.py
│   ├── endereco.py
│   ├── contato.py
│   └── login.py
│
├── schemas/                 ← Camada de contrato: valida entrada e formata saída
│   ├── lancamento.py        ← LancamentoCreate, LancamentoResponse, LancamentoEditAdmin
│   ├── usuario.py
│   └── ...
│
├── routes/                  ← Camada de rotas: define os endpoints HTTP
│   ├── lancamento.py        ← GET /lancamento/, POST /lancamento/, ...
│   ├── usuario.py
│   ├── cliente_fornecedor.py
│   └── ...
│
├── auth/                    ← Autenticação e autorização
│   ├── router.py            ← POST /auth/token, /auth/logout, /auth/trocar-senha
│   └── dependencies.py      ← get_current_user(), exige_admin(), exige_operador_ou_admin()
│
├── utils/                   ← Funções auxiliares sem dependência de rota
│   ├── config.py            ← Lê config.env
│   ├── auth_utils.py        ← hash_senha(), criar_token_acesso()
│   ├── inadimplencia.py     ← atualizar_inadimplente()
│   ├── bootstrap.py         ← Seed de usuários iniciais
│   └── email_sender.py      ← enviar_email()
│
└── tests/                   ← Testes automatizados com pytest
    ├── conftest.py           ← Fixtures compartilhadas (client, tokens, dados base)
    ├── test_lancamento.py
    └── ...
```

---

## As três camadas que importam

### Camada 1 — Models (`models/`)

Define a **estrutura do banco**. Cada classe Python representa uma tabela.

```python
# backend/models/lancamento.py
class Lancamento(Base):
    __tablename__ = "lancamento"

    id_lancamento = Column(BigInteger, primary_key=True, autoincrement=True)
    valor         = Column(DECIMAL(15, 2), nullable=False)
    data_vencimento = Column(Date, nullable=False)
    data_pagamento  = Column(TIMESTAMP, nullable=True)  # None = lançamento aberto
    natureza_lancamento = Column(Enum(NaturezaEnum))
    estorno       = Column(Boolean, default=False)
    # ...

    # Relacionamentos — SQLAlchemy faz o JOIN automaticamente
    cliente_fornecedor = relationship("ClienteFornecedor", back_populates="lancamentos")
    tipo_conta_rel     = relationship("TipoConta")
```

**Regra:** os models nunca saem do backend. Nenhum dado do banco é exposto diretamente ao frontend — sempre passa por um schema.

### Camada 2 — Schemas (`schemas/`)

Define o **contrato da API**: o que cada rota aceita e o que ela devolve. Um mesmo model pode ter múltiplos schemas.

Para `Lancamento`, existem três schemas principais em `backend/schemas/lancamento.py`:

| Schema | Usado em | Campos |
|---|---|---|
| `LancamentoCreate` | `POST /lancamento/` | Obrigatórios para criar: clifor, tipo, valor, vencimento, natureza |
| `LancamentoEditAdmin` | `PATCH /lancamento/{id}/editar` | Todos opcionais: permite edição parcial por admin |
| `LancamentoResponse` | Saída de todos os GETs | Inclui campos calculados: `nome_clifor`, `tem_comprovante`, `descricao_tipo_conta` |

O `LancamentoResponse` usa um `@model_validator` para calcular campos que não existem como coluna no banco:

```python
# backend/schemas/lancamento.py
class LancamentoResponse(BaseModel):
    id_lancamento: int
    valor: Decimal
    nome_clifor: Optional[str] = None       # ← não é coluna, vem do relacionamento
    tem_comprovante: bool = False            # ← não é coluna, calculado

    @model_validator(mode='before')
    @classmethod
    def extrair_campos_relacionados(cls, data):
        # Extrai nome_clifor do objeto cliente_fornecedor relacionado
        if hasattr(data, 'cliente_fornecedor') and data.cliente_fornecedor:
            data.__dict__['nome_clifor'] = data.cliente_fornecedor.nome
        # Calcula tem_comprovante a partir do campo binário
        data.__dict__['tem_comprovante'] = data.comprovante is not None
        return data

    model_config = ConfigDict(from_attributes=True)  # ← permite converter ORM → Pydantic
```

**Por que esse validator existe?** Porque o frontend precisa de `nome_clifor` para exibir na tabela, mas esse dado está em outra tabela. Em vez de o frontend fazer uma segunda requisição, o backend já resolve o JOIN e inclui o campo na resposta.

### Camada 3 — Routes (`routes/`)

Define os **endpoints HTTP** e orquestra as camadas anteriores.

```python
# backend/routes/lancamento.py (simplificado)
@router.post("/", response_model=LancamentoResponse)
def criar_lancamento(
    dados: LancamentoCreate,                    # ← Pydantic valida o body automaticamente
    db: Session = Depends(get_db),              # ← SQLAlchemy abre sessão com o banco
    _=Depends(exige_operador_ou_admin)          # ← JWT validado, perfil verificado
):
    lancamento = Lancamento(**dados.model_dump())
    db.add(lancamento)
    db.commit()
    db.refresh(lancamento)
    atualizar_inadimplente(lancamento.id_clifor_relacionado_fk, db)
    return lancamento  # ← FastAPI serializa via LancamentoResponse automaticamente
```

---

## Como uma requisição atravessa o backend

Exemplo: `GET /lancamento/?apenas_abertos=true` com token JWT no header.

```
1. main.py registrou o router de lancamento com prefixo "/lancamento"
   FastAPI identifica a rota correta

2. FastAPI resolve os Depends() antes de executar a função:
   ├── get_db()               → abre sessão com PostgreSQL
   └── exige_operador_ou_admin() → valida JWT, verifica perfil
       └── Se inválido → retorna 401 ou 403 antes de qualquer query

3. A função listar_lancamentos() executa:
   ├── Monta query SQLAlchemy com joinedload (evita N+1 queries)
   ├── Aplica filtro: filter(Lancamento.data_pagamento == None)
   └── Executa: db.query(...).all()

4. FastAPI serializa a lista de objetos ORM com LancamentoResponse
   └── O @model_validator calcula nome_clifor, tem_comprovante, etc.

5. Retorna JSON:
   [
     { "id_lancamento": 1, "valor": "150.00", "nome_clifor": "João Silva", ... },
     ...
   ]
```

---

## O problema do N+1 e por que usamos joinedload

Se você buscar 100 lançamentos e depois acessar `lancamento.cliente_fornecedor.nome` em cada um, o SQLAlchemy faz **1 query para os lançamentos + 100 queries para os clientes** = 101 queries.

Com `joinedload`, o SQLAlchemy faz um `JOIN` e traz tudo em **1 query**:

```python
# backend/routes/lancamento.py
db.query(Lancamento)
  .options(
      joinedload(Lancamento.cliente_fornecedor),
      joinedload(Lancamento.tipo_conta_rel),
      joinedload(Lancamento.usuario_lancamento)
  )
  .all()
```

---

## Como adicionar um novo campo a um lançamento

Se amanhã você precisar adicionar um campo `categoria` ao lançamento:

1. **`backend/models/lancamento.py`** — adicionar a coluna no model
2. **`backend/schemas/lancamento.py`** — adicionar ao `LancamentoCreate` (se for na criação), `LancamentoEditAdmin` (se for editável) e `LancamentoResponse` (se for retornado)
3. Reiniciar o backend — `Base.metadata.create_all()` só cria tabelas novas, **não altera** existentes. Para adicionar coluna em tabela existente, use `ALTER TABLE` no banco manualmente ou crie uma migration com Alembic

---

## O que `main.py` faz

```python
# backend/main.py (resumido)

# 1. Importa todos os models (necessário para o create_all reconhecê-los)
from models import usuario, lancamento, tipo_conta, ...

# 2. Cria as tabelas no banco se ainda não existirem
Base.metadata.create_all(bind=engine)

# 3. Cria o app FastAPI
app = FastAPI(title="AMSI Project")

# 4. Adiciona middlewares
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)
app.add_middleware(RequestLoggerMiddleware)

# 5. Registra os routers
app.include_router(lancamento_router, prefix="/lancamento")
app.include_router(auth_router,       prefix="/auth")
# ...

# 6. Endpoint de health check
@app.get("/")
def root():
    return {"status": "online"}
```

---

## Próximo passo

Continue em [04_autenticacao.md](./04_autenticacao.md) para entender como o login, o JWT e as permissões funcionam.
