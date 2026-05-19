# 05 — Frontend: Estrutura, Estado e Comunicação com o Backend

> **O que você aprende aqui:** como o React é organizado no projeto, como o roteamento protege páginas, como o estado é gerenciado, como uma chamada de API é feita e como o sistema de temas funciona.

---

## Estrutura de pastas

```
AMSI_Frontend/src/
│
├── main.jsx              ← Ponto de entrada: monta o React na <div id="root">
├── App.jsx               ← Define todas as rotas + componentes globais
│
├── pages/                ← Uma página por rota do sistema
│   ├── ListaLancamentosPage.jsx   ← A mais complexa (~1200 linhas)
│   ├── dashboard.jsx
│   ├── LancamentoPage.jsx
│   ├── TipoContaPage.jsx
│   ├── TrocarSenhaPage.jsx
│   └── NotFoundPage.jsx
│
├── components/           ← Partes reutilizáveis da interface
│   ├── Layout.jsx         ← Navbar + menu lateral + footer (envolve todas as páginas)
│   ├── LancamentoModal.jsx ← Modal de criar novo lançamento
│   ├── ToastStack.jsx     ← Sistema de notificações (Context Provider)
│   ├── ModalConfirm.jsx   ← Diálogo de confirmação genérico
│   ├── PrivateRoute.jsx   ← Proteção de rotas por autenticação/perfil
│   ├── ClientRegister.jsx ← Formulário de novo cliente/fornecedor
│   ├── ClientEdit.jsx     ← Formulário de edição de cliente/fornecedor
│   └── ErrorBoundary.jsx  ← Captura erros React e exibe fallback
│
├── services/             ← Lógica de comunicação e estado global
│   ├── api.js             ← Todas as funções de chamada HTTP
│   ├── auth.js            ← Lê/escreve token JWT no localStorage
│   └── loadingContext.jsx ← Context do spinner global
│
└── styles/               ← Um arquivo CSS por componente/página
    ├── theme.css          ← Variáveis CSS globais (fonte, cores, sombras)
    ├── layout.css
    ├── lancamento.css     ← Estilos do LancamentoModal (.lm-*)
    ├── listaLancamentos.css ← Estilos da ListaLancamentosPage (.ll-*)
    └── ...
```

---

## Roteamento e proteção de páginas

`App.jsx` define todas as rotas usando React Router. As rotas protegidas usam o componente `PrivateRoute`:

```jsx
// AMSI_Frontend/src/App.jsx
<Routes>
    {/* Rota pública */}
    <Route path="/" element={<LoginPage />} />

    {/* Rota protegida sem navbar (primeiro acesso) */}
    <Route path="/trocar-senha" element={
        <PrivateRoute><TrocarSenhaPage /></PrivateRoute>
    } />

    {/* Rotas protegidas com layout completo */}
    <Route element={<Layout />}>
        <Route path="/lancamentos" element={
            <PrivateRoute minPerfil="Operador">
                <ListaLancamentosPage />
            </PrivateRoute>
        } />
        <Route path="/usuarios" element={
            <PrivateRoute adminOnly>
                <UserListPage />
            </PrivateRoute>
        } />
    </Route>
</Routes>
```

`PrivateRoute` (`AMSI_Frontend/src/components/PrivateRoute.jsx`) faz três verificações:
1. `isAuthenticated()` — token existe e não expirou? Se não → redireciona para `/`
2. `adminOnly` — se verdadeiro, verifica `isAdmin()`. Se não for admin → redireciona
3. `minPerfil` — se definido, verifica `hasPerfilMinimo()`. Se abaixo → redireciona

---

## Gerenciamento de estado

O projeto usa três mecanismos distintos. A escolha entre eles não é aleatória:

### 1. `useState` — estado local do componente
Usado para qualquer dado que pertence a um único componente: valores de formulário, qual modal está aberto, resultado de uma busca.

```jsx
// AMSI_Frontend/src/pages/ListaLancamentosPage.jsx
const [lancamentos, setLancamentos] = useState([]);
const [modalAberto, setModalAberto] = useState(false);
const [filtros, setFiltros] = useState({ natureza: '', apenas_abertos: false, ... });
```

**Critério:** use `useState` quando só um componente (ou seus filhos diretos) precisa do dado.

### 2. Context API — estado global leve
Usado para dois casos específicos:

**`LoadingContext`** (`services/loadingContext.jsx`): o spinner de carregamento precisa ser ativado por `api.js` (que está fora da árvore React) e exibido por `App.jsx`. Um Context resolve isso sem passar props por toda a árvore.

```javascript
// api.js (fora do React) ativa o spinner
loadingBus.iniciar();   // ← loadingBus é um objeto que se conecta ao Context
// ...
loadingBus.finalizar();
```

**`ToastContext`** (`components/ToastStack.jsx`): qualquer componente em qualquer parte da árvore pode exibir uma notificação. Context evita que você precise passar `mostrarToast` como prop por vários níveis.

```jsx
// Em qualquer componente:
const { mostrarToast } = useToast();
mostrarToast('Lançamento criado com sucesso!');
mostrarToast('Erro ao salvar', 'erro');
```

**Critério:** use Context quando múltiplos componentes não relacionados hierarquicamente precisam acessar o mesmo estado.

### 3. `localStorage` — persistência entre sessões
Usado para dados que precisam sobreviver a um recarregamento da página:
- `token` — o JWT de autenticação
- `expiresAt` — quando a sessão expira (em ms)
- `amsi_tema` — preferência de tema (verde ou corporativo)

**Critério:** use localStorage para preferências do usuário e dados de sessão.

---

## Como uma chamada de API funciona

Toda chamada HTTP no projeto passa por `fetchComLoading()` em `services/api.js`. Entender essa função é entender como qualquer interação com o backend funciona.

```javascript
// AMSI_Frontend/src/services/api.js (simplificado)

async function fetchComLoading(url, options = {}) {
    loadingBus.iniciar();          // 1. Ativa o spinner global
    try {
        let response = await fetch(url, options);

        // 2. Retry automático se o banco Vercel estiver adormecido
        if (!response.ok && response instanceof TypeError) {
            await new Promise(r => setTimeout(r, 4000));
            response = await fetch(url, options);
        }

        return response;
    } finally {
        loadingBus.finalizar();    // 3. Desativa o spinner (sempre, mesmo com erro)
    }
}

async function handleResponse(response) {
    // 4. Lê a expiração da sessão do header e atualiza localStorage
    const sessionExpires = response.headers.get('X-Session-Expires');
    if (sessionExpires) localStorage.setItem('expiresAt', sessionExpires);

    // 5. Logout automático se o backend retornar 401
    if (response.status === 401) {
        logout();
        _onSessaoExpirada?.();    // ← Dispara popup "Sessão expirada"
        throw new Error('sessao-expirada');
    }

    // 6. Extrai mensagem de erro amigável do JSON
    if (!response.ok) {
        const err = await response.json();
        throw new Error(Array.isArray(err.detail)
            ? err.detail.map(e => e.msg).join(', ')
            : err.detail || 'Erro desconhecido');
    }

    return response.json();
}
```

Exemplo de uma função de API concreta:
```javascript
// AMSI_Frontend/src/services/api.js
export const createLancamento = async (data) => {
    const response = await fetchComLoading(`${BASE_URL}/lancamento/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`   // ← Token JWT do localStorage
        },
        body: JSON.stringify(data)
    });
    return handleResponse(response);
};
```

---

## Sistema de temas com CSS Custom Properties

O projeto tem dois temas: **verde** (padrão) e **corporativo** (dark mode).

### Como as variáveis são definidas

`AMSI_Frontend/src/styles/theme.css` declara variáveis em `:root` (tema verde padrão) e as sobrescreve em `[data-theme="corporativo"]`:

```css
/* tema verde — padrão */
:root {
    --primary:    #1B4332;
    --bg:         #EFE6DD;
    --bg-card:    #ffffff;
    --text:       #1a1a1a;
    --text-muted: #6b7280;
    --border:     #d9d0c7;
}

/* tema corporativo (dark) — sobrescreve quando html tem data-theme="corporativo" */
[data-theme="corporativo"] {
    --primary:    #38BDF8;
    --bg:         #0F172A;
    --bg-card:    #1e293b;
    --text:       #f1f5f9;
    --text-muted: #94a3b8;
    --border:     #334155;
}
```

### Como o tema é aplicado

`Layout.jsx` lê a preferência do `localStorage` e aplica o atributo no `<html>`:

```javascript
// AMSI_Frontend/src/components/Layout.jsx
useEffect(() => {
    if (tema === 'corporativo') {
        document.documentElement.setAttribute('data-theme', 'corporativo');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('amsi_tema', tema);
}, [tema]);
```

### Como adicionar uma nova variável de cor

1. Declare em `theme.css` dentro de `:root` com o valor do tema verde
2. Declare novamente dentro de `[data-theme="corporativo"]` com o valor do tema escuro
3. Use `var(--minha-variavel)` em qualquer arquivo CSS do projeto

**Regra do projeto:** nenhuma cor é hardcoded. Sempre `var(--nome)`.

---

## Componentes: como se comunicam

O padrão é **props de dados para baixo, callbacks para cima**:

```jsx
// Pai (ListaLancamentosPage) envia callback para filho (LancamentoModal)
<LancamentoModal
    onFechar={() => {
        setModalAberto(false);
        buscar();          // ← Recarrega a lista após fechar o modal
    }}
/>

// Filho (LancamentoModal) chama o callback ao concluir
const handleSubmit = async (e) => {
    await createLancamento(payload);
    mostrarToast('Lançamento criado!');
    onFechar();            // ← Notifica o pai que terminou
};
```

Para confirmações de ação destrutiva, o projeto usa `ModalConfirm` genérico:

```jsx
<ModalConfirm
    titulo="Excluir Lançamento"
    mensagem="Esta ação não pode ser desfeita."
    onConfirmar={handleDeletar}
    onCancelar={() => setConfirmarDeletar(false)}
/>
```

---

## Próximo passo

Continue em [06_fluxo_completo.md](./06_fluxo_completo.md) para ver tudo isso junto em um exemplo real rastreado do clique até o banco.
