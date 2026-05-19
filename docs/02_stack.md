# 02 — Stack de Tecnologias

> **O que você aprende aqui:** por que cada tecnologia foi escolhida e qual problema ela resolve. Não é um tutorial de nenhuma delas — é o contexto para entender as decisões do projeto.

---

## Backend

### PostgreSQL — banco de dados relacional
Armazena todos os dados de forma persistente. Foi escolhido por ser robusto, suportar tipos nativos como `ENUM` (usado para `natureza_lancamento`, `perfil_de_acesso`, `cargo`) e ter boa integração com SQLAlchemy.

O banco fica em `localhost:5432` em desenvolvimento. As credenciais vêm de `config.env` e são lidas por `backend/utils/config.py`.

### SQLAlchemy — ORM (Object-Relational Mapper)
Permite escrever operações de banco em Python, sem SQL manual. Cada tabela do banco é representada como uma classe Python em `backend/models/`.

```python
# Sem SQLAlchemy (SQL puro):
cursor.execute("SELECT * FROM lancamento WHERE id_clifor_relacionado_fk = %s", (id,))

# Com SQLAlchemy:
db.query(Lancamento).filter(Lancamento.id_clifor_relacionado_fk == id).all()
```

Além de mais legível, o ORM protege contra SQL injection e cuida do ciclo de vida da conexão.

As tabelas são criadas automaticamente na primeira execução via `Base.metadata.create_all(bind=engine)` em `backend/main.py` (linha ~19).

### FastAPI — framework web Python
Define as rotas HTTP do backend (`GET /lancamento/`, `POST /auth/token`, etc.). Foi escolhido por:
- Ser assíncrono e performático
- Gerar documentação automática (`/docs`)
- Ter integração nativa com Pydantic para validação
- Usar `Depends()` para injeção de dependência (autenticação, sessão de banco)

O ponto de entrada é `backend/main.py`. Cada grupo de rotas fica em um arquivo separado dentro de `backend/routes/`.

### Pydantic — validação de dados
Define o "contrato" de cada rota: o que ela aceita e o que ela devolve. Se o frontend mandar um campo com tipo errado, o Pydantic rejeita **antes** de o código de negócio executar.

```python
# backend/schemas/lancamento.py
class LancamentoCreate(BaseModel):
    valor: Decimal          # Se vier string "abc", Pydantic lança erro 422
    data_vencimento: date   # Se vier "32/13/2026", erro 422
```

Os schemas ficam em `backend/schemas/`. Há sempre distinção entre schema de **entrada** (Create/Update) e de **saída** (Response).

### python-jose + bcrypt — autenticação
- **python-jose**: cria e valida tokens JWT (sessão do usuário)
- **bcrypt**: faz hash de senhas. Senhas nunca são salvas em texto puro no banco

```python
# backend/utils/auth_utils.py
hash_senha("minha_senha")      # → "$2b$12$..."  (hash bcrypt)
verificar_senha("minha_senha", hash)  # → True ou False
```

O fluxo completo está em [04_autenticacao.md](./04_autenticacao.md).

---

## Frontend

### React 19 — biblioteca de interface
Constrói a interface como uma árvore de **componentes**. Cada componente é uma função JavaScript que retorna JSX (HTML-like) e re-renderiza automaticamente quando seu estado muda.

```jsx
// Um componente simples
function Badge({ status }) {
    return <span className={`badge badge-${status}`}>{status}</span>;
}
```

O ponto de entrada é `AMSI_Frontend/src/main.jsx`, que monta o React na `<div id="root">` do `index.html`.

### React Router v7 — roteamento no browser
Permite navegar entre páginas sem recarregar o browser (SPA — Single Page Application). Cada rota mapeia uma URL para um componente.

```jsx
// AMSI_Frontend/src/App.jsx
<Route path="/lancamentos" element={
    <PrivateRoute minPerfil="Operador">
        <ListaLancamentosPage />
    </PrivateRoute>
} />
```

`PrivateRoute` verifica se o usuário está autenticado e tem o perfil mínimo antes de renderizar a página.

### Vite — ferramenta de build
Servidor de desenvolvimento ultrarrápido e empacotador para produção. Em dev, roda em `localhost:5173`. Para produção, gera arquivos estáticos otimizados.

Configurado em `AMSI_Frontend/vite.config.js`. As variáveis de ambiente prefixadas com `VITE_` ficam em `AMSI_Frontend/.env` e são acessadas via `import.meta.env.VITE_API_URL`.

### fetch nativo — cliente HTTP
O projeto usa o `fetch` nativo do browser (sem Axios ou similar), encapsulado em `fetchComLoading()` em `AMSI_Frontend/src/services/api.js`. O wrapper adiciona:
- Spinner global automático
- Retry automático se o banco estiver adormecido
- Leitura do header `X-Session-Expires` para renovar a sessão
- Logout automático em caso de 401

### CSS nativo com Custom Properties — estilização
Sem Tailwind, sem Styled Components. CSS puro com variáveis (`--primary`, `--bg-card`, `--text`) definidas em `AMSI_Frontend/src/styles/theme.css`. Dois temas: verde (padrão) e corporativo (dark mode), trocados via `data-theme` no elemento `<html>`.

---

## Por que não usamos X?

| "Por que não..." | Resposta curta |
|---|---|
| Redux/Zustand | Estado local (`useState`) e dois Contexts são suficientes para o escopo do projeto |
| Axios | `fetch` nativo atende, o wrapper `fetchComLoading` cobre os casos especiais |
| Tailwind | CSS modular por componente é mais explícito para quem está aprendendo |
| Django/Flask | FastAPI tem validação automática via Pydantic e documentação gerada grátis |
| MySQL | PostgreSQL tem suporte nativo a ENUMs, melhor para os tipos do domínio |

---

## Próximo passo

Continue em [03_backend.md](./03_backend.md) para ver como o backend é organizado em camadas.
