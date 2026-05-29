# Temático: Arquitetura — TCC AMSI
## Deep dive completo em decisões de arquitetura para estudo focado no NotebookLM

> **Como usar:** sobe apenas este arquivo no NotebookLM para estudar arquitetura isoladamente. Pergunte: "Por que o projeto usa FastAPI em vez de Django?" e compare com o que você sabe antes de olhar a resposta.

---

## 1. VISÃO GERAL DA ARQUITETURA

O AMSI é uma aplicação web de três camadas:

```
┌─────────────────────────────────────┐
│  CAMADA DE APRESENTAÇÃO             │
│  React 19 + Vite (AMSI_Frontend/)  │
│  Roda no browser do usuário        │
│  Porta 5173 em desenvolvimento     │
└──────────────────┬──────────────────┘
                   │ HTTP/JSON
                   │ (porta 8000)
┌──────────────────▼──────────────────┐
│  CAMADA DE APLICAÇÃO                │
│  FastAPI + Python (backend/)        │
│  Valida JWT, aplica RBAC            │
│  Executa lógica de negócio         │
│  Chama banco via SQLAlchemy        │
└──────────────────┬──────────────────┘
                   │ SQL
                   │ (porta 5432)
┌──────────────────▼──────────────────┐
│  CAMADA DE DADOS                    │
│  PostgreSQL                         │
│  8+ tabelas, ENUMs, DECIMAL         │
│  ACID, WAL, índices automáticos    │
└─────────────────────────────────────┘
```

**Regra fundamental:** o frontend NUNCA fala com o banco diretamente. Cada operação passa pelo backend, que aplica validação e autorização antes de qualquer query.

---

## 2. ORGANIZAÇÃO INTERNA DO BACKEND

O backend tem três camadas internas (dentro de `backend/`):

### Camada 1 — Models (`backend/models/`)
Define a estrutura do banco de dados como classes Python.

```python
# backend/models/lancamento.py
class Lancamento(Base):
    __tablename__ = "lancamento"
    id_lancamento = Column(Integer, primary_key=True)
    valor = Column(DECIMAL(15, 2), nullable=False)
    natureza_lancamento = Column(Enum(NaturezaEnum), nullable=False)
    data_vencimento = Column(Date, nullable=False)
    data_pagamento = Column(Date, nullable=True)  # NULL = não pago
    id_clifor_relacionado_fk = Column(Integer, ForeignKey("clientefornecedor.id_clifor"))
    cliente_fornecedor = relationship("ClienteFornecedor", lazy="select")
```

Models são a única fonte de verdade sobre o schema do banco. Quando o SQLAlchemy inicializa, cria as tabelas a partir dos models via `Base.metadata.create_all()`.

### Camada 2 — Schemas (`backend/schemas/`)
Define o contrato de cada operação da API — o que cada rota aceita e o que devolve.

**Por que múltiplos schemas por entidade:**

```python
# LancamentoCreate: campos que um Operador envia ao criar
class LancamentoCreate(BaseModel):
    valor: Decimal
    natureza_lancamento: NaturezaEnum
    data_vencimento: date
    id_clifor_relacionado_fk: int
    id_tipo_conta_fk: int
    # NÃO tem: id_lancamento, data_pagamento, valor_pago, created_at

# LancamentoEditAdmin: campos que um Admin pode editar (todos opcionais)
class LancamentoEditAdmin(BaseModel):
    valor: Optional[Decimal] = None
    data_vencimento: Optional[date] = None
    id_clifor_relacionado_fk: Optional[int] = None

# LancamentoResponse: o que o backend devolve (com campos calculados)
class LancamentoResponse(BaseModel):
    id_lancamento: int
    valor: Decimal
    nome_clifor: str  # ← calculado via @model_validator, não está no banco
    tem_comprovante: bool  # ← calculado
```

Se houvesse um único schema, um Operador poderia tentar enviar `data_pagamento` ao criar um lançamento. O Pydantic rejeitaria campos extras por padrão, mas os schemas separados documentam explicitamente o contrato e tornam o código autoexplicativo.

### Camada 3 — Routes (`backend/routes/`)
Orquestra as camadas anteriores: recebe a requisição HTTP, valida permissão, executa lógica de negócio, persiste no banco, devolve resposta.

```python
# backend/routes/lancamento.py
@router.post("/", response_model=LancamentoResponse)
def criar_lancamento(
    dados: LancamentoCreate,              # Pydantic valida automaticamente
    db: Session = Depends(get_db),        # sessão do banco injetada
    _=Depends(exige_operador_ou_admin)   # guarda de permissão
):
    lancamento = Lancamento(**dados.model_dump())
    db.add(lancamento)
    db.commit()
    db.refresh(lancamento)
    atualizar_inadimplente(dados.id_clifor_relacionado_fk, db)
    return lancamento
```

---

## 3. POR QUE FASTAPI E NÃO DJANGO OU FLASK

### Django: certo problema, ferramenta errada

Django é um framework full-stack: vem com ORM próprio, sistema de templates HTML, painel administrativo, autenticação embutida, sistema de forms.

O AMSI é uma **API REST pura** — o backend só devolve JSON. O React faz todo o HTML. Django traria:
- Templates HTML: desnecessários (React faz isso)
- Admin embutido: desnecessário (o AMSI tem sua própria interface)
- Sistema de migrations próprio: o projeto usa SQLAlchemy, que tem seu próprio ORM
- ORM próprio: o projeto usa SQLAlchemy, não Django ORM

Usar Django seria carregar 80% de funcionalidades sem usar nenhuma delas.

### Flask: minimalismo com custo de montagem

Flask é deliberadamente minimalista. Para o AMSI, precisaríamos:
- `Flask-SQLAlchemy` (integração ORM)
- `Marshmallow` ou `Pydantic` (validação de dados)
- `Flask-JWT-Extended` (autenticação JWT)
- `Flask-CORS` (Cross-Origin Resource Sharing)
- `Flask-Testing` (testes)

Cada plugin: documentação própria, versões potencialmente conflitantes, manutenção independente. Um upgrade de `Flask-JWT-Extended` pode quebrar a integração com `Flask-SQLAlchemy`.

### FastAPI: tudo que o AMSI precisa, sem o que não precisa

FastAPI resolve nativamente os problemas que mais importam:

- **Pydantic embutido:** validação automática de todos os campos de entrada
- **Injeção de dependência:** `Depends()` sem configuração extra
- **Documentação OpenAPI:** acessível em `/docs`, gerada do código automaticamente
- **Async nativo:** suporte a operações assíncronas sem boilerplate
- **Type hints:** o próprio Python define o contrato

```python
@router.get("/{id}", response_model=LancamentoResponse)
def buscar_lancamento(id: int, db=Depends(get_db), _=Depends(exige_consulta_ou_mais)):
    # id já é int — o FastAPI converteu e validou automaticamente
    # db é a sessão do banco — injetada automaticamente
    # _ garante que o usuário está autenticado
```

---

## 4. POR QUE 3 CAMADAS (MODELS / SCHEMAS / ROUTES)

### O anti-padrão de tudo junto

```python
# ANTI-PADRÃO — não existe no projeto
@app.post("/lancamento")
def criar(body: dict, db = Depends(get_db)):
    if "valor" not in body:
        raise HTTPException(400, "valor obrigatório")
    if not isinstance(body["valor"], (int, float)):
        raise HTTPException(400, "valor deve ser número")
    if body["valor"] <= 0:
        raise HTTPException(400, "valor deve ser positivo")
    db.execute(f"INSERT INTO lancamento (valor) VALUES ({body['valor']})")
    return {"ok": True}
```

Problemas: validação manual (repetida em cada rota), SQL string (vulnerável a injection), sem tipagem, impossível de testar em isolamento.

### A separação de responsabilidades no AMSI

| Camada | Pergunta que responde | Se mudar, impacta |
|---|---|---|
| `models/` | Quais colunas existem no banco? | Schema do banco |
| `schemas/` | O que cada operação aceita/devolve? | Contrato da API |
| `routes/` | Como as peças se conectam para uma operação? | Lógica de negócio |

Quando um requisito muda, você sabe exatamente onde mexer. Adicionar um campo ao lançamento: `models/` (nova coluna), `schemas/` (novo campo no Create e Response), `routes/` (passar o campo para o model). Nada mais precisa mudar.

---

## 5. POR QUE JWT E NÃO SESSÕES TRADICIONAIS

### Sessions: estado no servidor

Sessions tradicionais guardam o estado de autenticação no servidor (memória ou Redis). O browser recebe um `session_id` em cookie, que o servidor usa para buscar o estado.

**Problema de escala:** se você tiver dois servidores, a sessão criada no servidor A não existe no servidor B. Soluções: sticky sessions (usuário sempre vai ao mesmo servidor — perde resiliência) ou Redis compartilhado (adiciona dependência de infraestrutura).

### JWT: estado no token

O payload JWT viaja com o token:
```json
{ "sub": "42", "perfil": "Operador", "jti": "c3d4e5f6", "exp": 1748000000 }
```

Qualquer servidor com a chave secreta valida o token sem consultar estado compartilhado. Escalar horizontalmente é adicionar instâncias de FastAPI sem configurar compartilhamento de sessão.

### O problema do JWT puro

JWT puro não tem logout. Um token é válido até `exp`, independente de o usuário clicar "sair". Um token comprometido seria válido por até 60 minutos.

### A solução híbrida do AMSI

A tabela `token_ativo` armazena o `jti` (UUID único por token) de cada sessão ativa. A cada requisição, além de validar a assinatura, o backend busca o `jti` na tabela. Logout deleta o registro — token imediatamente inválido.

| | Sessions | JWT puro | JWT híbrido (AMSI) |
|---|---|---|---|
| Estado no servidor | Sim (toda sessão) | Não | Mínimo (só jti) |
| Logout real | Sim | Não | Sim |
| Múltiplos servidores | Requer Redis | Funciona | Funciona |
| Perfil do usuário | Ida ao banco | Lido do token | Lido do token |

---

## 6. POR QUE REST E NÃO GRAPHQL

### GraphQL brilha quando...
O cliente precisa de flexibilidade para pedir exatamente os campos que quer. Útil em aplicações com muitas telas que precisam de subconjuntos diferentes dos mesmos dados — ex: uma tela mobile que só quer 3 campos, uma tela desktop que quer 15.

### REST é suficiente quando...
Os endpoints têm respostas fixas e bem definidas. O AMSI: cada tela sempre precisa dos mesmos campos. A lista de lançamentos sempre pede `id`, `valor`, `natureza`, `nome_clifor`, `data_vencimento`, `data_pagamento`. Não há variação.

REST tem vantagens adicionais neste contexto:
- FastAPI gera documentação OpenAPI automática para REST — não para GraphQL
- Debug com `curl` ou Postman é mais simples (requisições HTTP padrão)
- Mais familiar para o time

---

## 7. O PADRÃO MVC E COMO O AMSI SE RELACIONA

### MVC clássico
- **Model:** dados e regras de negócio
- **View:** apresentação (HTML renderizado pelo servidor)
- **Controller:** orquestra Model e View em resposta a uma requisição

### O AMSI não é MVC puro

O backend não gera HTML (não há View no servidor). O React faz o papel de View. A separação é:

| MVC clássico | AMSI backend | AMSI frontend |
|---|---|---|
| Model | `models/` + `schemas/` | Estado React (useState) |
| View | (não existe) | Componentes JSX |
| Controller | `routes/` | (não existe explicitamente) |

A camada `schemas/` adiciona algo que MVC clássico não tem: um **contrato explícito** entre o que o cliente envia e o que o servidor aceita. Isso é mais próximo de um padrão Clean Architecture (entidades, use cases, interfaces) do que MVC.

---

## 8. INJEÇÃO DE DEPENDÊNCIA COM `Depends()`

### O que é injeção de dependência
Em vez de cada função criar suas dependências (banco de dados, usuário autenticado), um framework injeta essas dependências automaticamente.

### Como o FastAPI usa `Depends()`

```python
# backend/database.py
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()  # sempre fecha, mesmo em erro

# backend/auth/dependencies.py
def get_current_user(
    token: str = Depends(oauth2_scheme),  # lê o header Authorization
    db: Session = Depends(get_db)         # sessão do banco
):
    # valida token, busca usuário no banco, retorna objeto usuario
    ...
```

```python
# backend/routes/lancamento.py
@router.get("/")
def listar(
    db: Session = Depends(get_db),            # banco injetado
    usuario = Depends(get_current_user)       # usuário autenticado injetado
):
    # db e usuario já estão disponíveis, validados e prontos para uso
```

**Vantagem para testes:** nos testes, `get_db` é substituído por uma função que retorna uma sessão de banco de teste. A lógica da rota não muda — só a dependência é trocada.

---

## 9. SESSÃO DESLIZANTE (SLIDING SESSION)

### O problema da expiração fixa
Com expiração fixa de 60 minutos, um usuário que fica 59 minutos usando o sistema é desconectado enquanto está trabalhando. Uma sessão de 8 horas seria insegura (token válido por muito tempo).

### A solução do AMSI
A cada requisição autenticada, o backend devolve no header `X-Session-Expires` um novo timestamp de expiração:

```
X-Session-Expires: 2026-05-21T15:30:00Z
```

O frontend (`api.js`) lê esse header e atualiza o `sessionExpires` no `localStorage`. O timer de logout automático é renovado. Enquanto o usuário estiver ativo (fazendo requisições), a sessão nunca expira. Após 60 minutos de inatividade, o token expira e o usuário é desconectado.

---

## 10. PADRÃO DE CÁLCULO COM `@model_validator`

### O problema
O frontend precisa exibir o nome do clifor em cada linha da tabela de lançamentos. Mas o nome está na tabela `clientefornecedor`, não em `lancamento`. O model de resposta precisa incluir esse dado calculado.

### A solução

```python
# backend/schemas/lancamento.py
class LancamentoResponse(BaseModel):
    id_lancamento: int
    valor: Decimal
    nome_clifor: str = ""      # ← campo calculado, não existe no banco
    tem_comprovante: bool = False

    @model_validator(mode="after")
    def preencher_campos_calculados(self) -> "LancamentoResponse":
        # acessa o relacionamento SQLAlchemy carregado com joinedload
        if hasattr(self, "__lancamento_obj__"):
            obj = self.__lancamento_obj__
            if obj.cliente_fornecedor:
                self.nome_clifor = obj.cliente_fornecedor.nome
            self.tem_comprovante = obj.comprovante_pdf is not None
        return self
```

O `@model_validator` executa após a criação do schema, calculando campos derivados de relacionamentos. O frontend recebe `nome_clifor` diretamente na resposta sem precisar fazer uma segunda requisição.
