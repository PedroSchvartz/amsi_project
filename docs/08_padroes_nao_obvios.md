# 08 — Padrões Não Óbvios

> **O que você aprende aqui:** quatro padrões do projeto que causam confusão no primeiro contato — não porque são complexos, mas porque são pouco ensinados. Cada seção explica o "por que funciona assim" antes de mostrar o código.

---

## 1. `loadingBus`: como `api.js` ativa o spinner sem ser um componente React

### O problema

`api.js` é um módulo JavaScript puro — não é um componente React e não pode usar hooks (`useState`, `useContext`). Mas ele precisa ativar um spinner enquanto uma requisição está em andamento.

Se você tentar importar `useLoading()` dentro de `api.js`, vai receber um erro: hooks só funcionam dentro de componentes React.

### A solução: Event Bus com objeto singleton

```javascript
// AMSI_Frontend/src/services/loadingContext.jsx

// Objeto singleton com implementações-placeholder
export const loadingBus = {
    iniciar: () => {},    // ← começa como função vazia
    finalizar: () => {}   // ← começa como função vazia
};
```

Quando `api.js` chama `loadingBus.iniciar()`, está chamando uma função vazia. Nada acontece ainda.

A mágica acontece no `LoadingProvider`, um componente React que "injeta" as implementações reais:

```javascript
// AMSI_Frontend/src/services/loadingContext.jsx

export function LoadingProvider({ children }) {
    const [contagem, setContagem] = useState(0);
    const iniciar  = useCallback(() => setContagem((n) => n + 1), []);
    const finalizar = useCallback(() => setContagem((n) => Math.max(0, n - 1)), []);

    // ← Aqui: substitui as funções vazias pelas implementações reais
    useEffect(() => {
        loadingBus.iniciar  = iniciar;
        loadingBus.finalizar = finalizar;
    }, [iniciar, finalizar]);
    // ...
}
```

Depois que `LoadingProvider` monta (o que acontece no startup do app em `App.jsx`), `loadingBus.iniciar` aponta para a função real do React. A partir daí, qualquer módulo que importe `loadingBus` consegue disparar o spinner.

### Por que usar contador e não booleano

```javascript
const iniciar  = () => setContagem((n) => n + 1);   // +1 por requisição
const finalizar = () => setContagem((n) => Math.max(0, n - 1)); // -1 por requisição
// Spinner visível quando contagem > 0
```

Se duas requisições são feitas em paralelo (`Promise.all`), o contador vai para 2. Quando a primeira termina, vai para 1 — spinner ainda visível. Quando a segunda termina, vai para 0 — spinner some. Com booleano, a primeira requisição terminando já esconderia o spinner mesmo com a segunda ainda em andamento.

### O delay de 300ms

```javascript
useEffect(() => {
    if (contagem > 0) {
        timerRef.current = setTimeout(() => setCarregando(true), 300);
    } else {
        clearTimeout(timerRef.current);
        setCarregando(false);
    }
}, [contagem]);
```

O spinner só aparece se a requisição durar mais de 300ms. Requisições rápidas (cache, rede local) não piscam o overlay escuro na tela — melhor UX.

### O padrão tem nome

Esse é o padrão **Event Bus** aplicado ao React: um objeto compartilhado que age como canal de comunicação entre partes do código que não têm uma referência direta entre si. É alternativa ao uso de Redux ou Context API em módulos não-React.

---

## 2. `storage` event: logout em uma aba detectado em todas as outras

### O problema

Um usuário está logado em duas abas do browser. Faz logout na aba 1. A aba 2 ainda mostra a interface autenticada — sem saber que a sessão foi encerrada. Como a aba 2 descobre?

### O mecanismo: `window.addEventListener('storage')`

O browser dispara o evento `storage` em todas as **outras abas** do mesmo domínio quando o `localStorage` é modificado. A aba que fez a modificação **não recebe** o evento.

```javascript
// AMSI_Frontend/src/App.jsx

useEffect(() => {
    const handleStorage = (e) => {
        if (e.key !== null) return;     // ← só reage ao localStorage.clear()
        if (location.pathname === '/') return;  // ← já está na tela de login
        setExpirado(true);              // ← dispara popup "Sessão expirada"
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
}, [location.pathname]);
```

### Por que `e.key === null`

Quando `localStorage.setItem('chave', valor)` é chamado, o evento `storage` tem `e.key = 'chave'`.

Quando `localStorage.clear()` é chamado — que é o que o `logout()` faz — o evento tem `e.key = null`. O código usa isso para distinguir "algum dado foi atualizado" de "tudo foi apagado (logout)".

### O fluxo completo

```
Aba 1: usuário clica em "Sair"
  → frontend chama logout()
  → backend POST /auth/logout (deleta token_ativo)
  → frontend chama localStorage.clear()

Browser: dispara evento 'storage' em todas as outras abas
  → e.key = null (porque foi clear(), não setItem())

Aba 2: handleStorage executa
  → e.key === null → setExpirado(true)
  → popup "Sessão expirada" aparece
  → usuário precisa fazer login novamente
```

---

## 3. `FormData` vs JSON: por que o upload de comprovante é diferente

### O problema

Todas as funções em `api.js` enviam dados assim:

```javascript
body: JSON.stringify({ valor: 150, clifor: 7, ... })
headers: { 'Content-Type': 'application/json' }
```

Mas `anexarComprovante` é diferente:

```javascript
// AMSI_Frontend/src/services/api.js
export const anexarComprovante = async (id_lancamento, arquivo) => {
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    const response = await fetchComLoading(
        `${BASE_URL}/lancamento/${id_lancamento}/comprovante`,
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            // ← sem 'Content-Type' manual
            // ← sem JSON.stringify()
            body: formData
        }
    );
    return handleResponse(response);
};
```

### Por que não dá para usar JSON aqui

JSON só carrega texto. Um arquivo PDF é binário — bytes que não têm representação em UTF-8. Para enviar binário via HTTP, o encoding correto é `multipart/form-data`, que é o que `FormData` usa.

Quando você passa um `FormData` como `body`, o browser define automaticamente o `Content-Type` como `multipart/form-data; boundary=...` — por isso o cabeçalho não é definido manualmente (definir `Content-Type: application/json` quebraria o upload).

### O backend trata diferente também

Rota JSON normal:
```python
@router.post("/lancamento/")
def criar_lancamento(dados: LancamentoCreate, ...):
#                   ↑ Pydantic valida o body JSON
```

Rota de upload:
```python
@router.post("/{id_lancamento}/comprovante")
async def anexar_comprovante(
    id_lancamento: int,
    arquivo: UploadFile = File(...),  # ← parâmetro de arquivo, não JSON
    ...
):
    conteudo = await arquivo.read()   # ← lê os bytes
    if len(conteudo) > 5 * 1024 * 1024:
        raise HTTPException(400, "Arquivo muito grande. Máximo 5MB.")
    lancamento.comprovante = conteudo         # ← salva como LargeBinary
    lancamento.comprovante_nome = arquivo.filename
```

O backend lê os bytes, valida o tamanho, e salva diretamente na coluna `comprovante` (tipo `LargeBinary` no model).

### Resumo

| | Dados JSON | Upload de arquivo |
|---|---|---|
| Encoding | `application/json` | `multipart/form-data` |
| Frontend | `JSON.stringify(obj)` | `new FormData()` |
| Backend FastAPI | `dados: Schema` | `arquivo: UploadFile` |
| Banco | Colunas tipadas | `LargeBinary` |

---

## 4. `(str, Enum)` em Python: por que os enums herdam de `str`

### O problema

Todos os enums nos schemas do projeto têm essa forma:

```python
# backend/schemas/lancamento.py
class NaturezaEnum(str, Enum):
    Debito  = "Debito"
    Credito = "Credito"
```

A herança dupla `(str, Enum)` parece estranha. Por que não só `(Enum)`?

### O que acontece sem o `str`

```python
from enum import Enum

class NaturezaEnum(Enum):
    Debito = "Debito"

import json
json.dumps(NaturezaEnum.Debito)
# → TypeError: Object of type NaturezaEnum is not JSON serializable
```

Um `Enum` puro não é serializável em JSON. FastAPI tentaria serializar a resposta e quebraria com erro 500.

### O que o `str` resolve

```python
class NaturezaEnum(str, Enum):
    Debito = "Debito"

import json
json.dumps(NaturezaEnum.Debito)
# → '"Debito"'   ← funciona, porque NaturezaEnum.Debito é também uma str
```

Ao herdar de `str`, cada membro do enum **é também uma string**. O Python e o Pydantic conseguem serializá-lo diretamente para JSON como `"Debito"`, não como `{"__type": "NaturezaEnum", "value": "Debito"}`.

### Validação automática que isso habilita

```python
class LancamentoCreate(BaseModel):
    natureza_lancamento: NaturezaEnum
```

Se o body JSON tiver `"natureza_lancamento": "Invalido"`, Pydantic retorna automaticamente:
```json
{
  "detail": [
    { "loc": ["body", "natureza_lancamento"],
      "msg": "value is not a valid enumeration member; permitted: 'Debito', 'Credito'" }
  ]
}
```

Com status 422 — sem nenhum código adicional. A validação de enumeração é gratuita.

### Os enums no projeto

| Enum | Arquivo | Valores |
|---|---|---|
| `NaturezaEnum` | `schemas/lancamento.py`, `schemas/tipo_conta.py` | `"Debito"`, `"Credito"` |
| `CargoEnum` | `schemas/usuario.py` | `"Diretor"`, `"Tesoureiro"`, `"Secretário"`, `"Conselheiro"`, `"Associado"`, `"Desenvolvedor"` |
| `AcessoEnum` | `schemas/usuario.py` | `"Administrador"`, `"Operador"`, `"Consulta"` |
| `TipoCliForEnum` | `schemas/cliente_fornecedor.py` | `"C"` (Cliente), `"F"` (Fornecedor), `"A"` (Ambos) |

---

## 5. CPF/CNPJ mascarado por padrão com click-to-reveal por perfil

### O problema

O estudante abre a tabela de lançamentos e vê CPF/CNPJ exibindo `••••••••`. Clica para revelar — funciona para Operador e Admin, mas não para Consulta. Procura no código e encontra três mecanismos distintos trabalhando juntos.

### O mecanismo

```javascript
// AMSI_Frontend/src/pages/ListaLancamentosPage.jsx

function rassurarCpfCnpj(valor) {
    if (!valor) return '—';
    return valor.replace(/\d/g, '•');   // substitui cada dígito por •
}

const [cpfVisivelLanc, setCpfVisivelLanc] = useState({});
// Estrutura: { [id_lancamento]: true }
// Ausente na chave = mascarado; true = visível
```

Na renderização da célula:

```jsx
{isConsulta() ? (
    // Consulta: sempre mascarado, sem onClick
    <span>{rassurarCpfCnpj(l.cpf_cnpj_clifor)}</span>
) : cpfVisivelLanc[l.id_lancamento] ? (
    // Operador/Admin com campo revelado: mostra valor real, click para remascarar
    <span style={{ cursor: 'pointer' }}
          onClick={() => setCpfVisivelLanc(p => ({ ...p, [l.id_lancamento]: false }))}>
        {l.cpf_cnpj_clifor}
    </span>
) : (
    // Operador/Admin com campo mascarado: click para revelar
    <span style={{ cursor: 'pointer', letterSpacing: 2 }}
          onClick={() => setCpfVisivelLanc(p => ({ ...p, [l.id_lancamento]: true }))}>
        {rassurarCpfCnpj(l.cpf_cnpj_clifor)}
    </span>
)}
```

### Por que três ramos e não dois

O ramo do meio (`cpfVisivelLanc[id] === true`) é necessário para o **click de volta** — revelar o CPF e depois poder remascarar. Sem ele, uma vez revelado não haveria como ocultar novamente.

### Por que Consulta nunca revela

`isConsulta()` retorna `true` para o perfil com menor acesso. CPF/CNPJ é dado pessoal sensível. O perfil Consulta existe justamente para dar visibilidade a lançamentos sem expor informações de identificação dos clifors — então o mascaramento é definitivo, sem handler de click.

O mesmo padrão existe na tabela de clientes/fornecedores (`ClientList.jsx`): `onClick={() => !consulta && toggleCpf(c.id_clifor)}` — o handler está registrado mas é um no-op para Consulta.

---

## Próximo passo

Volte ao [07_glossario.md](./07_glossario.md) para consultar termos técnicos pontuais, ou ao [06_fluxo_completo.md](./06_fluxo_completo.md) para tentar responder as 14 perguntas de verificação.
