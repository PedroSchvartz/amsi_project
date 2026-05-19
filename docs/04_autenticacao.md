# 04 — Autenticação, JWT e Permissões

> **O que você aprende aqui:** como o login funciona, o que é um JWT e por que ele é usado, como o logout invalida a sessão antes do token expirar, e como o sistema decide se um usuário pode ou não acessar uma rota.

---

## O que é JWT e por que usar

JWT (JSON Web Token) é um token assinado que carrega informações sobre o usuário. A principal vantagem é que o **conteúdo do payload pode ser lido sem consultar o banco** — as informações estão no próprio token, codificadas em Base64.

Um JWT tem três partes separadas por `.`:

```
eyJhbGciOiJIUzI1NiJ9   ← Header (algoritmo de assinatura)
.eyJzdWIiOiI0MiJ9      ← Payload (dados: id do usuário, perfil, expiração)
.SflKxwRJSMeKKF2QT4fw  ← Assinatura (garante que não foi adulterado)
```

Decodificando o payload:
```json
{
  "sub": "42",                    ← id do usuário
  "perfil": "Administrador",      ← perfil de acesso
  "jti": "c3d4e5f6-...",          ← ID único deste token
  "exp": 1748000000               ← timestamp de expiração
}
```

**Importante: o payload não é criptografado — é só Base64.** Qualquer um que tiver o token consegue ler o `sub` e o `perfil`. O que o JWT garante não é sigilo, mas **integridade**: sem a chave secreta do servidor, não dá para falsificar a assinatura. O frontend usa isso em `getUserFromToken()` para ler o id e perfil sem fazer nenhuma requisição.

### "Stateless" não significa "sem estado no banco"

Você vai ouvir que JWT é "stateless". Isso significa que o **conteúdo** do token não exige ida ao banco — o servidor lê o payload diretamente. Mas stateless e "sem estado no banco" são coisas diferentes.

O projeto salva o `jti` (JWT ID) na tabela `token_ativo`. Por quê? Porque sem isso não existe logout real. O JWT continuaria válido até a expiração mesmo depois do usuário sair. Isso **não contradiz** o conceito de stateless — apenas adiciona a capacidade de **revogar tokens individualmente**.

Resumindo:
- Leitura do payload (id, perfil) → sem banco ✓ (stateless)
- Validação se o token ainda está ativo → banco obrigatório (revogação real)

O frontend **não precisa ir ao backend** para saber o id ou perfil do usuário — lê direto do token. Veja `AMSI_Frontend/src/services/auth.js`, função `getUserFromToken()`.

---

## Fluxo de login passo a passo

### 1. Frontend envia credenciais
```
POST /auth/token
Body: { "email": "pedro@amsi.com", "senha": "minha_senha" }
```

### 2. Backend valida (`backend/auth/router.py`, função `login`)

```python
# Passo 1: busca o usuário pelo email
usuario = db.query(Usuario).filter(Usuario.email == dados.email).first()
if not usuario:
    raise HTTPException(401)

# Passo 2: verifica a senha com bcrypt
if not verificar_senha(dados.senha, usuario.senha):
    raise HTTPException(401)

# Passo 3: verifica bloqueios
if usuario.bloqueado:         raise HTTPException(403, "Usuário bloqueado")
if usuario.suspenso > now():  raise HTTPException(403, "Usuário suspenso")
if usuario.exclusao:          raise HTTPException(403, "Usuário removido")
```

### 3. Invalida sessões anteriores (single session)
```python
# Um usuário só pode ter UMA sessão ativa
# Se fizer login numa segunda aba, a sessão anterior é encerrada
db.query(TokenAtivo).filter(TokenAtivo.id_usuario_fk == usuario.id_usuario).delete()
```

### 4. Gera o token JWT (`backend/utils/auth_utils.py`)
```python
payload = {
    "sub":    str(usuario.id_usuario),
    "perfil": usuario.perfil_de_acesso.value,
    "exp":    datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES),
    "jti":    str(uuid.uuid4())   # ← ID único para este token
}
token = jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")
```

### 5. Salva o jti no banco
```python
# backend/auth/router.py
token_ativo = TokenAtivo(
    jti=payload["jti"],
    id_usuario_fk=usuario.id_usuario,
    exp=datetime.utcfromtimestamp(payload["exp"])
)
db.add(token_ativo)
db.commit()
```

Ao guardar o `jti`, o backend pode invalidar o token imediatamente na hora do logout — sem esperar a expiração natural.

### 6. Devolve o token ao frontend
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "primeiro_acesso": false
}
```

O frontend guarda em `localStorage.setItem('token', access_token)`.

---

## Fluxo de uma requisição autenticada

Após o login, todo request envia o token no header:

```
GET /lancamento/
Authorization: Bearer eyJhbGci...
```

No backend, `backend/auth/dependencies.py`, a função `get_current_user()` executa a cada requisição:

```
1. Extrai o token do header Authorization
2. Decodifica o JWT (sem verificar exp — isso é feito no banco)
3. Extrai "jti" do payload
4. Busca o jti na tabela token_ativo:
   ├── Não encontrado → token inválido ou logout feito → retorna 401
   └── Encontrado:
       ├── Se token_ativo.exp < agora → token expirado → deleta registro → retorna 401
       └── Se válido:
           ├── Busca o Usuario no banco pelo "sub"
           └── Renova a expiração: token_ativo.exp = agora + JWT_EXPIRE_MINUTES
               └── Injeta X-Session-Expires no header da resposta
```

### Sessão deslizante (sliding session)

A expiração é renovada a cada requisição bem-sucedida. Se você está usando o sistema ativamente, nunca é desconectado. A sessão só expira se ficar inativa por `JWT_EXPIRE_MINUTES` minutos (configurado em `config.env`).

O frontend lê o header `X-Session-Expires` e atualiza `localStorage.expiresAt`. O `MonitorSessao` em `App.jsx` verifica isso a cada 30 segundos.

---

## Fluxo de logout

```
POST /auth/logout
Authorization: Bearer eyJhbGci...
```

Backend (`backend/auth/router.py`, função `logout`):

```python
# 1. Deleta o token da tabela token_ativo
#    → Token imediatamente inválido, mesmo antes do exp
db.query(TokenAtivo).filter(TokenAtivo.jti == jti).delete()

# 2. Registra data_logout no histórico de sessões
login_ativo = db.query(Login).filter(...).first()
login_ativo.data_logout = datetime.now()

db.commit()
```

Frontend (`AMSI_Frontend/src/services/auth.js`, função `logout`):
```javascript
await fetch(`${BASE_URL}/auth/logout`, { method: 'POST', headers: authHeaders() });
localStorage.clear();   // ← Remove token, dados do usuário, expiresAt
```

O `localStorage.clear()` dispara o evento `storage` no browser, o que faz outras abas abertas do sistema detectarem o logout e redirecionarem para o login.

---

## Sistema de permissões

### A hierarquia
```
Consulta  <  Operador  <  Administrador
```

Implementada em `AMSI_Frontend/src/services/auth.js`:
```javascript
const HIERARQUIA = ['Consulta', 'Operador', 'Administrador'];

export const hasPerfilMinimo = (perfilRequerido) => {
    const perfil = getPerfil();
    return HIERARQUIA.indexOf(perfil) >= HIERARQUIA.indexOf(perfilRequerido);
};
```

### Como proteger uma rota no backend

Em `backend/auth/dependencies.py` existem três funções prontas:

```python
# Qualquer usuário autenticado
@router.get("/minha-rota")
def minha_rota(db=Depends(get_db), user=Depends(get_current_user)):
    ...

# Apenas Operador ou Administrador
@router.post("/lancamento/")
def criar_lancamento(db=Depends(get_db), _=Depends(exige_operador_ou_admin)):
    ...

# Apenas Administrador
@router.delete("/usuario/{id}")
def deletar_usuario(db=Depends(get_db), _=Depends(exige_admin)):
    ...
```

### Como proteger uma rota no frontend

Em `AMSI_Frontend/src/App.jsx`, envolva a página com `PrivateRoute`:

```jsx
// Acesso mínimo: Operador
<Route path="/lancamentos" element={
    <PrivateRoute minPerfil="Operador">
        <ListaLancamentosPage />
    </PrivateRoute>
} />

// Apenas Admin
<Route path="/usuarios" element={
    <PrivateRoute adminOnly>
        <UserListPage />
    </PrivateRoute>
} />
```

E dentro dos componentes, use `isAdmin()` ou `hasPerfilMinimo()` para mostrar/esconder elementos:
```jsx
// AMSI_Frontend/src/pages/ListaLancamentosPage.jsx
{isAdmin() && (
    <button onClick={() => setConfirmarDeletar(true)}>Excluir</button>
)}
```

---

## Resumo: o que acontece quando um token expirado chega

1. `get_current_user()` decodifica o JWT e extrai o `jti`
2. Busca `jti` em `token_ativo`
3. Encontrou o registro, mas `token_ativo.exp < datetime.utcnow()`
4. Deleta o registro do banco
5. Retorna `HTTP 401 Unauthorized`
6. Frontend recebe 401 em `handleResponse()` (`api.js`)
7. Frontend chama `logout()` → `localStorage.clear()`
8. Frontend chama `_onSessaoExpirada()` → exibe popup "Sessão expirada"
9. Usuário precisa fazer login novamente

---

## Próximo passo

Continue em [05_frontend.md](./05_frontend.md) para ver como o React é organizado e como ele se comunica com o backend.
