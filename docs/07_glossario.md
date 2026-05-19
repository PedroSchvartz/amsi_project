# 07 — Glossário Técnico

> **O que você aprende aqui:** definições rápidas e contextualizadas dos termos técnicos usados no projeto. Cada definição explica o conceito e aponta onde ele aparece no código.

---

## Backend / Python

### ORM (Object-Relational Mapper)
Camada que traduz objetos Python em operações SQL e vice-versa. No projeto: **SQLAlchemy**.

Sem ORM você escreve `SELECT * FROM lancamento WHERE id = 1`. Com ORM: `db.query(Lancamento).filter(Lancamento.id_lancamento == 1).first()`. O resultado é um objeto Python com atributos, não uma tupla de banco.

Vantagem: não precisa concatenar strings SQL (evita SQL injection), o código fica mais legível e portável.

📄 `backend/models/lancamento.py` — definição dos modelos ORM

---

### Pydantic
Biblioteca Python para validação de dados baseada em type hints. No projeto, define o "contrato" de cada rota: o que ela aceita e o que ela devolve.

```python
class LancamentoCreate(BaseModel):
    valor: Decimal   # Se vier "abc", Pydantic lança erro 422 automaticamente
```

Se o campo vier com tipo errado, FastAPI retorna `422 Unprocessable Entity` antes de executar qualquer lógica.

📄 `backend/schemas/` — todos os schemas Pydantic do projeto

---

### JWT (JSON Web Token)
Token assinado que carrega informações do usuário (id, perfil, expiração). O servidor não precisa consultar o banco para saber quem é o usuário — as informações estão no próprio token.

Estrutura: `header.payload.assinatura` (separados por `.`, cada parte em Base64).

**Stateless vs rastreado no projeto:** apesar de JWT ser "stateless", o projeto salva o `jti` (JWT ID) na tabela `token_ativo` para permitir logout real e sessão deslizante.

📄 `backend/auth/router.py` — criação do token no login
📄 `backend/models/token_ativo.py` — rastreamento do jti
📄 `AMSI_Frontend/src/services/auth.js` — leitura do token no frontend

---

### jti (JWT ID)
Campo obrigatório dentro do payload JWT que é um UUID único para aquele token específico. Permite identificar e invalidar tokens individualmente.

No projeto: ao fazer logout, o backend deleta o registro com aquele `jti` de `token_ativo`. Qualquer requisição futura com o mesmo token falha, mesmo que o `exp` ainda não tenha chegado.

---

### bcrypt
Algoritmo de hash para senhas. Características importantes:
- **Irreversível:** não dá para recuperar a senha original a partir do hash
- **Salt automático:** cada hash é único mesmo para senhas iguais
- **Lento intencionalmente:** dificulta ataques de força bruta

```python
hash_senha("123456")   # → "$2b$12$xK9P..." (diferente a cada chamada)
verificar_senha("123456", hash)  # → True (compara sem descriptografar)
```

📄 `backend/utils/auth_utils.py` — funções `hash_senha` e `verificar_senha`

---

### CORS (Cross-Origin Resource Sharing)
Mecanismo de segurança do browser que bloqueia requisições entre origens diferentes por padrão. Como o frontend roda em `localhost:5173` e o backend em `localhost:8000`, o browser bloquearia as requisições sem configuração de CORS.

O backend resolve isso com o `CORSMiddleware` que adiciona headers de permissão às respostas:

```python
# backend/main.py
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)
```

Em produção, `allow_origins=["*"]` pode ser restringido à URL do frontend.

---

### `Depends()` — Injeção de Dependência no FastAPI
Mecanismo do FastAPI para compartilhar lógica entre rotas sem repetição. Uma função marcada com `Depends()` é executada automaticamente antes da função da rota.

```python
@router.post("/lancamento/")
def criar_lancamento(
    db: Session = Depends(get_db),           # ← abre sessão com o banco
    _=Depends(exige_operador_ou_admin)       # ← valida JWT e perfil
):
    ...
```

Se `exige_operador_ou_admin` lançar uma exceção (ex: 401 ou 403), a função `criar_lancamento` **nunca executa**.

📄 `backend/auth/dependencies.py` — todas as dependências de autenticação
📄 `backend/database.py` — a dependência `get_db`

---

### Soft Delete
Estratégia de "exclusão" que não remove o registro do banco — apenas marca um campo `exclusao` com o timestamp da exclusão. O registro continua no banco mas é tratado como inexistente pelas queries.

```python
# Usuário "deletado" ainda existe na tabela
usuario.exclusao = datetime.now()
db.commit()

# Query que ignora deletados
db.query(Usuario).filter(Usuario.exclusao == None).all()
```

Usado para usuários no projeto. Preserva histórico e evita erros de FK em dados relacionados.

---

### N+1 Query (problema)
Antipadrão de banco de dados: buscar uma lista de N registros e depois fazer 1 query para cada para buscar um relacionamento = N+1 queries totais.

Exemplo: 100 lançamentos, acessar `lancamento.cliente_fornecedor.nome` em cada = 101 queries.

Solução no projeto: `joinedload()` do SQLAlchemy faz um `JOIN` e traz tudo em 1 query.

📄 `backend/routes/lancamento.py` — uso de `joinedload`

---

## Frontend / JavaScript

### `useState`
Hook do React para criar estado dentro de um componente. Quando o estado muda, o componente re-renderiza automaticamente.

```javascript
const [modalAberto, setModalAberto] = useState(false);
// modalAberto: valor atual
// setModalAberto: função para atualizar
setModalAberto(true);  // ← dispara re-render
```

---

### `useEffect`
Hook do React para executar código em resposta a mudanças. O array de dependências controla quando ele executa:

```javascript
useEffect(() => {
    carregarDados();   // ← executa uma vez quando o componente monta
}, []);                // ← array vazio = só na montagem

useEffect(() => {
    buscar(filtros);   // ← executa sempre que filtros mudar
}, [filtros]);
```

---

### Context API
Mecanismo do React para compartilhar estado entre componentes sem passar props manualmente por toda a árvore.

No projeto: `ToastContext` (notificações) e `LoadingContext` (spinner). Qualquer componente, não importa quão profundo na árvore, pode chamar `useToast()` ou `useLoading()`.

📄 `AMSI_Frontend/src/components/ToastStack.jsx` — ToastContext
📄 `AMSI_Frontend/src/services/loadingContext.jsx` — LoadingContext

---

### SPA (Single Page Application)
Aplicação web que carrega o HTML uma única vez e troca o conteúdo via JavaScript sem recarregar a página. O React Router simula a navegação entre URLs sem fazer novas requisições ao servidor de arquivos.

---

### CSS Custom Properties (Variáveis CSS)
Variáveis nativas do CSS declaradas com `--nome` e usadas com `var(--nome)`. Diferente de variáveis de pré-processadores (Sass, Less), funcionam em tempo real e podem ser sobrescritas por seletores.

```css
:root { --primary: #1B4332; }
[data-theme="corporativo"] { --primary: #38BDF8; }

/* Em qualquer componente: */
.meu-botao { background: var(--primary); }
/* Muda automaticamente com o tema, sem JavaScript */
```

📄 `AMSI_Frontend/src/styles/theme.css` — todas as variáveis do projeto

---

### `localStorage`
Armazenamento do browser que persiste entre recarregamentos de página (ao contrário do `sessionStorage`). No projeto guarda: `token` (JWT), `expiresAt` (expiração da sessão em ms) e `amsi_tema` (preferência de tema).

Limitações: sincronizado entre abas do mesmo domínio (o que o projeto usa para detectar logout em outra aba), mas não é seguro para dados sensíveis em produção.

---

### Sliding Session (Sessão Deslizante)
Estratégia de sessão onde a expiração é renovada a cada ação do usuário. Em vez de deslogar após X minutos do login, desloga após X minutos de **inatividade**.

No projeto: o backend renova `token_ativo.exp` a cada requisição autenticada e envia o novo timestamp no header `X-Session-Expires`. O frontend atualiza `localStorage.expiresAt`.

---

### RBAC (Role-Based Access Control)
Controle de acesso baseado em papéis (perfis). Em vez de definir permissões por usuário individualmente, define por papel e atribui o papel ao usuário.

No projeto: três papéis — Consulta, Operador, Administrador — em hierarquia crescente. O perfil fica gravado no JWT e é verificado a cada requisição.

---

## Próximo passo

Volte ao [06_fluxo_completo.md](./06_fluxo_completo.md) e tente responder as 14 perguntas de verificação sem consultar ninguém.

Se travar em alguma, o índice de onde encontrar cada resposta:

| Pergunta | Arquivo principal |
|---|---|
| 1 | `backend/routes/lancamento.py` |
| 2 | `backend/schemas/lancamento.py` |
| 3 | `backend/schemas/lancamento.py` |
| 4 | `backend/auth/dependencies.py` |
| 5 | `backend/auth/router.py`, `backend/models/token_ativo.py` |
| 6 | `backend/auth/dependencies.py` — `get_current_user()` |
| 7 | `backend/auth/router.py`, `backend/models/token_ativo.py` |
| 8 | `backend/auth/router.py` — login, seção "Invalida sessões anteriores" |
| 9 | `AMSI_Frontend/src/App.jsx`, `AMSI_Frontend/src/components/PrivateRoute.jsx` |
| 10 | `AMSI_Frontend/src/services/api.js` — `fetchComLoading()` |
| 11 | `AMSI_Frontend/src/services/loadingContext.jsx`, `ToastStack.jsx` |
| 12 | `AMSI_Frontend/src/App.jsx` — `MonitorSessao`, `localStorage.expiresAt` |
| 13 | `AMSI_Frontend/src/styles/theme.css` |
| 14 | `backend/tests/conftest.py` — fixture `db_snapshot` |
