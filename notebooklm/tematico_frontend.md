# Temático: Frontend — TCC AMSI
## Deep dive completo em React, SPA, estado e UX para o NotebookLM

> **Como usar:** sobe apenas este arquivo no NotebookLM para estudar o frontend isoladamente. Bom para perguntas sobre SPA, React, CSS Custom Properties, localStorage e sincronização de logout entre abas.

---

## 1. O QUE É SPA E POR QUE O AMSI É UMA

### Aplicação tradicional (Multi-Page Application)
Cada clique em um link faz o browser enviar uma requisição ao servidor. O servidor gera um HTML completo e devolve. O browser descarta a página atual e renderiza a nova. Navegação perceptível: a página "pisca", o scroll vai para o topo, qualquer estado local (filtros, inputs) é perdido.

### SPA (Single-Page Application)
O browser carrega um único `index.html` com todo o JavaScript da aplicação. Navegações subsequentes são interceptadas pelo React Router — o componente correto é renderizado sem nenhuma requisição ao servidor para HTML. O browser nunca "recarrega a página".

**Como o AMSI funciona como SPA:**
1. Usuário acessa `http://localhost:5173/lancamentos`
2. O servidor devolve sempre o mesmo `index.html` (configuração do Vite)
3. O React Router lê a URL e renderiza `LancamentoPage`
4. O React faz `GET /lancamento/` ao backend para buscar os dados
5. O componente renderiza a tabela com os dados recebidos

**Vantagens para o AMSI:**
- Navegação instantânea entre telas (sem recarregar)
- Estado mantido entre páginas (filtros, sessão do usuário)
- Experiência mais próxima de um app desktop

**Desvantagem:**
- Sem JavaScript, a aplicação não funciona (não crítico para sistema interno)
- SEO mais complexo (não relevante para sistema privado)

---

## 2. REACT 19 — MODELO MENTAL

### Componentes como funções puras
No React moderno (hooks, sem classes), um componente é uma função que recebe props e retorna JSX:

```jsx
// AMSI_Frontend/src/components/NavBar.jsx
function NavBar({ perfil, onLogout }) {
    return (
        <nav>
            <span>Logado como: {perfil}</span>
            <button onClick={onLogout}>Sair</button>
        </nav>
    );
}
```

A função é chamada toda vez que o estado ou as props mudam. O React compara o JSX anterior com o novo (Virtual DOM) e atualiza apenas o que mudou no DOM real.

### Hooks — estado e efeitos

**`useState`:** armazena estado local do componente

```jsx
const [lancamentos, setLancamentos] = useState([]);
const [carregando, setCarregando] = useState(true);
```

**`useEffect`:** executa código em resposta a mudanças (mount, unmount, dependências)

```jsx
useEffect(() => {
    // executa quando o componente monta
    buscarLancamentos();
    // função de cleanup executa no unmount
    return () => cancelarRequisicao();
}, []); // [] = executa só uma vez
```

**`useContext`:** acessa contextos globais sem prop drilling

```jsx
const { usuario, logout } = useContext(AuthContext);
```

---

## 3. ROTEAMENTO COM REACT ROUTER V7

### Estrutura de rotas do AMSI

```jsx
// AMSI_Frontend/src/App.jsx
<Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<PrivateRoute />}>           {/* Requer autenticação */}
        <Route element={<Layout />}>             {/* Inclui NavBar */}
            <Route path="/" element={<HomePage />} />
            <Route path="/lancamentos" element={<LancamentoPage />} />
            <Route path="/clientes" element={<ClientListPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route element={<AdminRoute />}>     {/* Requer Admin */}
                <Route path="/usuarios" element={<UserListPage />} />
            </Route>
        </Route>
    </Route>
</Routes>
```

### Como `PrivateRoute` funciona

```jsx
// AMSI_Frontend/src/components/PrivateRoute.jsx
function PrivateRoute() {
    const token = localStorage.getItem("token");
    if (!token) return <Navigate to="/login" replace />;
    // verifica se o token não está expirado
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (Date.now() / 1000 > payload.exp) {
        localStorage.clear();
        return <Navigate to="/login" replace />;
    }
    return <Outlet />;  // renderiza a rota filha
}
```

`Outlet` é onde as rotas filhas são renderizadas. `PrivateRoute` age como "portão" — se não autenticado, redireciona para login sem renderizar o conteúdo.

### Layout compartilhado

```jsx
// AMSI_Frontend/src/components/Layout.jsx
function Layout() {
    return (
        <>
            <NavBar />          {/* sempre visível */}
            <main>
                <Outlet />      {/* conteúdo da página atual */}
            </main>
        </>
    );
}
```

O `Layout` envolve todas as páginas autenticadas. A `NavBar` não é remontada ao navegar — só o `Outlet` muda.

---

## 4. ESTADO GLOBAL — CONTEXTS

O AMSI usa dois Contexts para estado global (sem Redux ou Zustand):

### AuthContext
Armazena dados do usuário logado e funções de autenticação:
- `usuario`: objeto com id, nome, perfil
- `token`: JWT atual
- `login(token)`: salva token, decodifica payload
- `logout()`: limpa localStorage, redireciona

### ToastContext (ou similar)
Gerencia notificações (toast messages) globais:
- `showToast(mensagem, tipo)`: exibe notificação temporária
- Usado em qualquer componente sem passar props

**Por que não Redux/Zustand:**
O estado global do AMSI é simples: dados do usuário logado e notificações. Para isso, a API nativa do React (`createContext` + `useContext`) é suficiente. Redux adiciona 3 conceitos novos (actions, reducers, store) para resolver um problema que o AMSI não tem.

---

## 5. FETCH WRAPPER — `fetchComLoading`

### O problema com fetch nativo puro

Cada chamada de API exigiria:
1. Mostrar spinner manualmente
2. Enviar o token no header Authorization
3. Tratar erros HTTP (401, 403, 404, 500)
4. Esconder spinner no finally
5. Verificar o header `X-Session-Expires`

Se isso fosse repetido em cada componente, seria código duplicado em 30+ lugares.

### A solução: wrapper centralizado

```javascript
// AMSI_Frontend/src/services/api.js
async function fetchComLoading(url, options = {}) {
    mostrarSpinner();  // spinner global aparecer
    try {
        const token = localStorage.getItem("token");
        const response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers
            }
        });

        // renova sessão deslizante
        const novaExpiracao = response.headers.get("X-Session-Expires");
        if (novaExpiracao) {
            localStorage.setItem("sessionExpires", novaExpiracao);
        }

        if (response.status === 401) {
            localStorage.clear();
            window.location.href = "/login";
            return;
        }

        return response;
    } finally {
        esconderSpinner();  // sempre esconde, mesmo em erro
    }
}
```

Todo componente usa `fetchComLoading` em vez de `fetch` diretamente. O comportamento de spinner, autenticação e renovação de sessão é automático.

**Retry automático:** se o banco estiver adormecido (Railway/Render desligam instâncias ociosas), o fetch recebe erro de conexão. O wrapper tenta novamente após um delay antes de reportar falha.

---

## 6. CSS CUSTOM PROPERTIES — DOIS TEMAS

### Por que não Tailwind

Tailwind gera classes utilitárias: `class="text-green-700 bg-white p-4 rounded"`. Para temas diferentes (verde padrão vs corporativo escuro), você precisaria de classes condicionais em cada elemento ou configuração de variantes no `tailwind.config.js`.

### A solução com CSS Custom Properties

```css
/* AMSI_Frontend/src/styles/theme.css */
:root {
    --primary: #2d7a3a;
    --primary-dark: #1f5a2a;
    --bg: #ffffff;
    --text: #1a1a1a;
    --card-bg: #f8f9fa;
}

[data-theme="corporativo"] {
    --primary: #1a3a5c;
    --primary-dark: #0f2a45;
    --bg: #1e1e1e;
    --text: #e0e0e0;
    --card-bg: #2d2d2d;
}
```

Para trocar de tema:
```javascript
document.documentElement.setAttribute("data-theme", "corporativo");
```

Um único atributo no `<html>` troca todas as cores simultaneamente. **Nenhuma cor é hardcoded nos componentes** — sempre `var(--primary)`, `var(--bg)`. Um novo tema exige apenas adicionar um novo bloco no `theme.css`.

---

## 7. PROTEÇÃO CONTRA XSS NO REACT

### Como o React renderiza dados

```jsx
// Seguro — textContent
const nome = "<script>alert(1)</script>";
return <div>{nome}</div>;
// Renderiza o texto literal: <script>alert(1)</script>
// O browser exibe como texto, não executa como HTML
```

Internamente, JSX `{variavel}` compila para:
```javascript
React.createElement("div", null, nome)
// que chama: element.textContent = nome
```

`textContent` é a API DOM para texto puro. Caracteres como `<`, `>`, `"` são convertidos para entidades HTML (`&lt;`, `&gt;`, `&quot;`) — exibidos na tela como texto, nunca interpretados como markup ou scripts.

### O único ponto de atenção

`dangerouslySetInnerHTML={{ __html: conteudo }}` — essa prop bypassa a proteção. É o equivalente de `element.innerHTML = conteudo`. O projeto não usa essa prop em nenhum componente. Verificado explicitamente.

---

## 8. SINCRONIZAÇÃO DE LOGOUT ENTRE ABAS

### O problema
Um usuário tem o AMSI aberto em duas abas. Na aba 1, faz logout. A aba 2 continua mostrando a interface como se o usuário ainda estivesse logado.

### A solução: Storage Event

```javascript
// AMSI_Frontend/src/App.jsx
useEffect(() => {
    const handleStorageChange = (e) => {
        if (e.key === null) {
            // localStorage.clear() foi chamado (logout)
            // mostrar popup "Sessão encerrada" e redirecionar
            setMostrarPopupSessaoEncerrada(true);
        }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
}, []);
```

**Como funciona:** `localStorage.clear()` (chamado no logout) dispara o evento `storage` em **todas as outras abas abertas** do mesmo domínio. A aba que fez o logout não recebe o evento — já foi redirecionada diretamente.

**`e.key === null`** é a assinatura de `clear()`. Um `setItem` geraria `e.key = "token"`. `clear()` gera `e.key = null`.

---

## 9. MASCARAMENTO DE DADOS SENSÍVEIS

### CPF/CNPJ mascarado por padrão

```jsx
// valor exibido por padrão para TODOS os perfis
"•••.•••.•••-••"

// somente para Operador e Admin, com click para revelar:
const [revelado, setRevelado] = useState(false);
return (
    <span onClick={() => perfil !== "Consulta" && setRevelado(!revelado)}>
        {revelado ? cpfCnpjReal : "•••.•••.•••-••"}
    </span>
);
```

**Fluxo de segurança:** o frontend solicita o dado real ao backend apenas quando necessário (na efetivação de um pagamento, por exemplo). Na listagem geral, `LancamentoResponse` pode incluir o CPF — mas o frontend decide não exibir para perfil Consulta.

**Segunda linha de defesa:** no backend, schemas de resposta poderiam omitir `cpf_cnpj` para perfil Consulta. O projeto faz isso na exibição, mas para defesa em profundidade seria melhor omitir na resposta da API também.

---

## 10. GESTÃO DE FORMULÁRIOS E MODAIS

### Padrão de modal controlado

```jsx
// Estado do modal no componente pai
const [modalAberto, setModalAberto] = useState(false);
const [lancamentoEmEdicao, setLancamentoEmEdicao] = useState(null);

// Abrindo para edição
<button onClick={() => {
    setLancamentoEmEdicao(lancamento);
    setModalAberto(true);
}}>Editar</button>

// O modal recebe os dados e callbacks
<LancamentoModal
    isOpen={modalAberto}
    lancamento={lancamentoEmEdicao}
    onClose={() => setModalAberto(false)}
    onSalvar={(dadosAtualizados) => {
        atualizarLista(dadosAtualizados);
        setModalAberto(false);
    }}
/>
```

**Por que não usar um gerenciador de formulários (React Hook Form, Formik):**
Os formulários do AMSI são relativamente simples. A validação principal está no backend (Pydantic). Adicionar uma biblioteca de formulários para 4-5 campos por formulário adicionaria complexidade sem benefício proporcional.

---

## 11. RESUMO: DECISÕES DE FRONTEND E JUSTIFICATIVAS

| Decisão | Alternativa | Por que a alternativa foi rejeitada |
|---|---|---|
| CSS Custom Properties | Tailwind | Themes via variáveis são mais simples; sem dependência adicional |
| fetch nativo + wrapper | Axios | Evita 14KB de dependência; fetchComLoading cobre todos os casos |
| useState + Context | Redux/Zustand | Estado global é simples (usuário + notificações); Redux seria overkill |
| React Router | Next.js | AMSI não precisa de SSR; SPA pura é suficiente para sistema interno |
| JavaScript | TypeScript | Curva de aprendizado; projeto de TCC com prazo definido |
| Bootstrap | Material UI | Menor curva, componentes mais simples, sem opinião de design forte |
