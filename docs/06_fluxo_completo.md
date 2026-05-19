# 06 — Fluxo Completo: do Clique ao Banco

> **O que você aprende aqui:** rastrear uma ação real — criar um lançamento — desde o clique do usuário no browser até o dado ser salvo no banco e a tela ser atualizada. Cada passo aponta para o arquivo e a função reais.

---

## Ação rastreada: criar um lançamento

Um Operador está na página `/lancamentos`, clica em `+ Novo Lançamento`, preenche o formulário e clica em Salvar.

---

## Passo 1 — O clique abre o modal

**Arquivo:** `AMSI_Frontend/src/pages/ListaLancamentosPage.jsx`

```jsx
// Botão na página
<button onClick={() => setModalAberto(true)}>+ Novo Lançamento</button>

// Modal renderizado condicionalmente
{modalAberto && (
    <LancamentoModal onFechar={() => { setModalAberto(false); buscar(); }} />
)}
```

`buscar()` será chamado quando o modal fechar — ela recarrega a lista com os filtros ativos.

---

## Passo 2 — Modal carrega dados auxiliares

**Arquivo:** `AMSI_Frontend/src/components/LancamentoModal.jsx`

```jsx
// Quando o modal abre, useEffect executa uma vez
useEffect(() => {
    carregarDados();
}, []);

const carregarDados = async () => {
    const [cs, ts] = await Promise.all([getClifors(), getTiposConta()]);
    setClifors(cs);       // ← lista de clientes/fornecedores para o <select>
    setTiposConta(ts);    // ← lista de tipos de conta para o <select>
};
```

Duas requisições simultâneas (`Promise.all`) para `GET /cliente_fornecedor/` e `GET /tipo_conta/`.

---

## Passo 3 — Usuário preenche o formulário

O estado do formulário é controlado por `useState`:

```javascript
const [form, setForm] = useState({
    id_clifor_relacionado_fk: '',
    id_tipo_conta_fk: '',
    valor: '',
    data_vencimento: '',
    observacao: '',
    estorno: false
});
```

Cada `<input>` e `<select>` atualiza o estado via `handleChange`:

```javascript
const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked
        : name === 'valor' ? value.replace(/[^0-9,]/g, '')  // ← só dígitos e vírgula
        : value;
    setForm({ ...form, [name]: val });
};
```

---

## Passo 4 — Clique em Salvar: preparação do payload

**Arquivo:** `AMSI_Frontend/src/components/LancamentoModal.jsx`, função `handleSubmit`

```javascript
const handleSubmit = async (e) => {
    e.preventDefault();

    // Obtém o id do usuário logado lendo o JWT do localStorage
    // Não precisa ir ao backend — o dado está no próprio token
    const usuario = getUserFromToken();  // → { sub: "42", perfil: "Operador", ... }

    // Calcula a natureza final (inverte se for estorno)
    const tipoSelecionado = tiposConta.find(t => t.id_tipo_conta === parseInt(form.id_tipo_conta_fk));
    let natureza = tipoSelecionado?.natureza_conta;  // "Debito" ou "Credito"
    if (form.estorno) natureza = natureza === 'Debito' ? 'Credito' : 'Debito';

    await createLancamento({
        id_usuario_fk_lancamento: usuario.sub,
        id_clifor_relacionado_fk: parseInt(form.id_clifor_relacionado_fk),
        id_tipo_conta_fk:         parseInt(form.id_tipo_conta_fk),
        valor:                    parseFloat(form.valor.replace(',', '.')), // "150,00" → 150.00
        data_vencimento:          form.data_vencimento,
        natureza_lancamento:      natureza,
        observacao:               form.observacao || null,
        estorno:                  form.estorno
    });
};
```

---

## Passo 5 — Chamada HTTP

**Arquivo:** `AMSI_Frontend/src/services/api.js`, função `createLancamento`

```javascript
export const createLancamento = async (data) => {
    const response = await fetchComLoading(`${BASE_URL}/lancamento/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`   // ← JWT do localStorage
        },
        body: JSON.stringify(data)
    });
    return handleResponse(response);
};
```

`fetchComLoading` ativa o spinner global antes de enviar e o desativa no `finally`.

A requisição que sai do browser:
```
POST http://localhost:8000/lancamento/
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Content-Type: application/json

{
  "id_usuario_fk_lancamento": 42,
  "id_clifor_relacionado_fk": 7,
  "id_tipo_conta_fk": 3,
  "valor": 150.00,
  "data_vencimento": "2026-06-30",
  "natureza_lancamento": "Credito",
  "observacao": null,
  "estorno": false
}
```

---

## Passo 6 — Backend recebe a requisição

**Arquivo:** `backend/main.py`

O router de lançamento está registrado com prefixo `/lancamento`:
```python
app.include_router(lancamento_router, prefix="/lancamento")
```
FastAPI identifica que `POST /lancamento/` corresponde à função `criar_lancamento` em `backend/routes/lancamento.py`.

---

## Passo 7 — Dependências são resolvidas

Antes de executar a função, FastAPI resolve os `Depends()` na assinatura:

```python
@router.post("/", response_model=LancamentoResponse)
def criar_lancamento(
    dados: LancamentoCreate,                 # ← Pydantic valida o body
    db: Session = Depends(get_db),           # ← Abre sessão com o banco
    _=Depends(exige_operador_ou_admin)       # ← Valida JWT e verifica perfil
):
```

**`Depends(get_db)`** (`backend/database.py`):
```python
def get_db():
    db = SessionLocal()   # ← Abre conexão com PostgreSQL
    try:
        yield db          # ← Entrega a sessão para a função
    finally:
        db.close()        # ← Fecha após a função terminar (sempre)
```

**`Depends(exige_operador_ou_admin)`** (`backend/auth/dependencies.py`):
```
1. Extrai token do header Authorization
2. Decodifica JWT, extrai jti
3. Busca jti em token_ativo → não encontrado = 401
4. Verifica expiração → expirado = 401
5. Busca Usuario no banco
6. Verifica: perfil_de_acesso em ['Operador', 'Administrador'] → senão = 403
7. Renova expiração no banco e injeta X-Session-Expires no response
```

Se qualquer verificação falhar, a execução para aqui e a resposta é retornada imediatamente — a função `criar_lancamento` nunca chega a executar.

---

## Passo 8 — Pydantic valida o body

`LancamentoCreate` (`backend/schemas/lancamento.py`) recebe o JSON e valida cada campo:
- `valor: Decimal` — se vier string `"abc"`, retorna `422 Unprocessable Entity`
- `data_vencimento: date` — se o formato for inválido, retorna `422`
- `natureza_lancamento: NaturezaEnum` — só aceita `"Debito"` ou `"Credito"`

---

## Passo 9 — Lógica de negócio e persistência

**Arquivo:** `backend/routes/lancamento.py`, função `criar_lancamento`

```python
def criar_lancamento(dados: LancamentoCreate, db, _):
    # Valida que as FKs existem no banco
    if not db.query(Usuario).filter(...).first():
        raise HTTPException(404, "Usuário não encontrado")
    if not db.query(ClienteFornecedor).filter(...).first():
        raise HTTPException(404, "Cliente/Fornecedor não encontrado")

    # Cria o objeto ORM a partir dos dados validados
    lancamento = Lancamento(**dados.model_dump())
    db.add(lancamento)
    db.commit()           # ← INSERT na tabela lancamento no PostgreSQL
    db.refresh(lancamento) # ← Recarrega do banco (pega id gerado, timestamps, etc.)

    # Recalcula inadimplência do clifor afetado
    atualizar_inadimplente(lancamento.id_clifor_relacionado_fk, db)
    # Se o clifor tem créditos vencidos não pagos → clifor.inadimplente = True

    return lancamento      # ← FastAPI serializa via LancamentoResponse
```

O dado agora existe no banco PostgreSQL, na tabela `lancamento`.

---

## Passo 10 — Serialização da resposta

FastAPI usa `LancamentoResponse` (`backend/schemas/lancamento.py`) para converter o objeto ORM em JSON.

O `@model_validator` calcula `nome_clifor` e `tem_comprovante` a partir dos relacionamentos carregados:
```python
data.__dict__['nome_clifor'] = data.cliente_fornecedor.nome  # → "João Silva"
data.__dict__['tem_comprovante'] = data.comprovante is not None  # → False
```

Resposta enviada ao frontend:
```json
HTTP/1.1 200 OK
X-Session-Expires: 1748000060000

{
  "id_lancamento": 87,
  "valor": "150.00",
  "data_vencimento": "2026-06-30",
  "natureza_lancamento": "Credito",
  "nome_clifor": "João Silva",
  "descricao_tipo_conta": "Condomínio",
  "tem_comprovante": false,
  "estorno": false,
  ...
}
```

---

## Passo 11 — Frontend processa a resposta

**Arquivo:** `AMSI_Frontend/src/services/api.js`, função `handleResponse`

```javascript
// Lê X-Session-Expires e renova a sessão no localStorage
const sessionExpires = response.headers.get('X-Session-Expires');
if (sessionExpires) localStorage.setItem('expiresAt', sessionExpires);

// Retorna o JSON do lançamento criado
return response.json();
```

---

## Passo 12 — Feedback e atualização da lista

**Arquivo:** `AMSI_Frontend/src/components/LancamentoModal.jsx`

```javascript
// Após o await createLancamento() retornar com sucesso:
mostrarToast('Lançamento criado com sucesso!');   // ← Toast verde no canto superior
setForm(FORM_INICIAL);                             // ← Reseta o formulário
onFechar();    // ← Chama o callback do pai (ListaLancamentosPage)
```

`onFechar` foi definida em `ListaLancamentosPage.jsx` como:
```javascript
() => { setModalAberto(false); buscar(); }
```

`buscar()` faz `GET /lancamento/` com os filtros ativos e atualiza a lista na tela.

---

## Diagrama resumido

```
BROWSER                          BACKEND                        BANCO
  │                                │                              │
  │  clique "+ Novo Lançamento"     │                              │
  │  setModalAberto(true)           │                              │
  │                                │                              │
  │  GET /cliente_fornecedor/       │                              │
  │  GET /tipo_conta/  ────────────►│                              │
  │◄─────────────────────────────── │── SELECT * FROM clifor ─────►│
  │                                │◄─────────────────────────────│
  │  usuário preenche form          │                              │
  │                                │                              │
  │  POST /lancamento/  ───────────►│                              │
  │  Authorization: Bearer eyJ...   │  exige_operador_ou_admin()   │
  │  Body: { valor, clifor, ... }   │  └─ valida JWT + perfil      │
  │                                │                              │
  │                                │  LancamentoCreate valida body│
  │                                │                              │
  │                                │  db.add() + db.commit() ────►│
  │                                │                              │  INSERT INTO lancamento
  │                                │◄─────────────────────────────│
  │                                │  atualizar_inadimplente()    │
  │◄─────────────────────────────── │  200 OK { id: 87, ... }      │
  │                                │                              │
  │  mostrarToast("Criado!")        │                              │
  │  GET /lancamento/ (buscar()) ──►│                              │
  │◄─────────────────────────────── │── SELECT * FROM lancamento ─►│
  │  atualiza tabela na tela        │◄─────────────────────────────│
```

---

## E quando algo dá errado?

O fluxo acima é o **caminho feliz**. Veja o que acontece nas falhas mais comuns:

### Caso 1 — Token expirado (401)

```
POST /lancamento/
Authorization: Bearer eyJ...  ← token expirado

Backend (get_current_user):
  1. Decodifica JWT, extrai jti
  2. Busca jti em token_ativo → encontra
  3. token_ativo.exp < agora → EXPIRADO
  4. Deleta o registro do banco
  5. Retorna HTTP 401 Unauthorized

Frontend (handleResponse em api.js):
  6. Detecta status 401
  7. Chama logout() → localStorage.clear()
  8. Exibe popup "Sessão expirada"
  9. Redireciona para /login
```

O usuário precisa fazer login novamente. Isso não é bug — é o comportamento esperado de segurança.

### Caso 2 — Sem permissão (403)

```
DELETE /lancamento/5
Authorization: Bearer eyJ...  ← token de Operador (não Admin)

Backend (exige_admin):
  1. get_current_user() valida o token → OK
  2. Verifica perfil: "Operador" não está em ['Administrador']
  3. Retorna HTTP 403 Forbidden

Frontend (handleResponse):
  4. Detecta status 403
  5. Lança exceção com a mensagem do backend
  6. LancamentoModal captura e exibe Toast vermelho: "Sem permissão"
```

### Caso 3 — Dado inválido (422)

```
POST /lancamento/
Body: { "valor": "abc", ... }  ← string onde era esperado número

Backend (Pydantic, LancamentoCreate):
  1. Tenta converter "abc" para Decimal
  2. Falha na validação
  3. Retorna HTTP 422 Unprocessable Entity
     {
       "detail": [
         { "loc": ["body", "valor"], "msg": "value is not a valid decimal" }
       ]
     }

Frontend (handleResponse):
  4. Detecta status 422
  5. Extrai a mensagem de erro do campo "detail"
  6. Exibe Toast vermelho com o detalhe
```

Na prática, isso raramente acontece para o usuário final porque os campos monetários do frontend filtram `/[^0-9,]/g` antes de enviar. O 422 aparece principalmente durante desenvolvimento ou integração.

### Caso 4 — FK não encontrada (404)

```
POST /lancamento/
Body: { "id_clifor_relacionado_fk": 9999, ... }  ← clifor que não existe

Backend (criar_lancamento):
  1. Valida o body com Pydantic → OK (9999 é um inteiro válido)
  2. Executa: db.query(ClienteFornecedor).filter(id == 9999).first()
  3. Resultado: None
  4. raise HTTPException(404, "Cliente/Fornecedor não encontrado")
  5. Retorna HTTP 404 Not Found

Frontend (handleResponse):
  6. Detecta status 404
  7. Lança exceção com a mensagem do backend
  8. Exibe Toast vermelho: "Cliente/Fornecedor não encontrado"
```

### Resumo dos códigos HTTP usados no projeto

| Código | Significado | Quando ocorre |
|---|---|---|
| `200` | Sucesso | Rota executou normalmente |
| `201` | Criado | Alguns POSTs retornam 201 em vez de 200 |
| `401` | Não autenticado | Token ausente, inválido ou expirado |
| `403` | Sem permissão | Token válido mas perfil insuficiente |
| `404` | Não encontrado | Recurso ou FK inexistente |
| `422` | Dados inválidos | Pydantic rejeitou o body |

---

## Critérios de verificação

Você terminou o guia quando conseguir responder estas 14 perguntas **só com os arquivos do projeto**:

**Backend**
1. Em qual arquivo e função você adiciona um novo filtro ao `GET /lancamento/`? Por que a query usa `joinedload`?
2. O que é o `@model_validator` em `LancamentoResponse`? Por que ele existe se o campo já está no banco?
3. Qual é a diferença prática entre `LancamentoCreate`, `LancamentoEditAdmin` e `LancamentoResponse`? Por que três schemas para a mesma entidade?
4. Se você quiser que uma nova rota seja acessível só para Operador e Admin, o que você escreve na assinatura da função?
5. O que acontece no banco quando um usuário faz logout? Por que isso é necessário se o JWT tem `exp`?

**Autenticação**
6. Um token JWT expirado chega no backend. Liste os passos exatos que `get_current_user()` executa antes de retornar 401.
7. O que é o `jti` dentro do token? Onde ele é salvo e por quê?
8. Um usuário abre o sistema em duas abas e faz login nas duas. O que acontece com a primeira sessão?

**Frontend**
9. Um estudante quer adicionar uma nova página `/relatorios` acessível só para Admin. Quais arquivos ele precisa editar e o que escreve em cada um?
10. O que `fetchComLoading()` faz diferente de um `fetch()` normal? Por que ele tenta de novo em caso de `TypeError`?
11. Por que `ListaLancamentosPage.jsx` usa `useState` para os formulários mas `ToastContext` para notificações? Qual é o critério para escolher um ou outro?
12. Como o sistema sabe que a sessão expirou sem precisar fazer uma requisição extra ao backend?

**CSS / Temas**
13. Como você adiciona uma nova cor que funciona automaticamente nos dois temas? Onde ela é declarada?

**Testes**
14. O que a fixture `db_snapshot` garante? O que acontece se um teste criar um registro e não deletá-lo?

---

## Próximo passo

Continue em [07_glossario.md](./07_glossario.md) para ter definições rápidas dos termos técnicos usados no projeto.
