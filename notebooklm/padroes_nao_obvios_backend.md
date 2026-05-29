# Padrões Não-Óbvios do Backend — TCC AMSI
## 6 decisões de código que parecem erradas mas têm razão específica

> **Por que este documento existe:** esses são os padrões que um professor que *leu o código* vai perguntar. Não são perguntas sobre arquitetura geral — são perguntas sobre linhas específicas que parecem suspeitas à primeira vista. Se você não souber explicar, parece que não entende o próprio código.

---

## PADRÃO 1 — `verify_exp: False`: Ignorando a expiração do JWT propositalmente

**Arquivo:** `backend/auth/dependencies.py`, linha 40

**O código:**
```python
payload = jwt.decode(
    credentials.credentials,
    JWT_SECRET_KEY,
    algorithms=[JWT_ALGORITHM],
    options={"verify_exp": False}   # ← desabilita verificação de exp
)
```

**Por que parece errado:** JWTs têm um campo `exp` exatamente para controlar quando o token expira. Desabilitar a verificação parece abrir uma brecha — tokens velhos continuariam sendo aceitos.

**Por que está certo:**

A expiração não é controlada pelo campo `exp` do token — é controlada pelo campo `exp` da tabela `token_ativo` no banco de dados:

```python
# Verificação real da expiração (linha 56)
if token_ativo.exp < datetime.utcnow():
    db.delete(token_ativo)
    db.commit()
    raise HTTPException(status_code=401, detail="Sessão expirada")
```

O motivo para mover a expiração para o banco: **logout real**. Com JWT puro, clicar em "Sair" não invalida o token — ele continua funcionando até `exp`. Ao armazenar a expiração no banco e deletar o registro no logout, qualquer token pode ser invalidado imediatamente.

**A divisão de responsabilidades é:**
- Assinatura JWT → verifica **integridade** (token não foi falsificado)
- Tabela `token_ativo` → verifica **revogação** (token não foi invalidado por logout)
- Campo `exp` do `token_ativo` → verifica **expiração** (sessão não foi longa demais sem atividade)

O campo `exp` do JWT ainda existe no payload — mas é ignorado no servidor. Ele serve como referência para clientes que queiram checar localmente antes de enviar a requisição.

**O que um professor pode perguntar:**
- "Por que verificar assinatura se já vai ao banco de qualquer forma?" → Assinatura e banco respondem perguntas diferentes.
- "Se o banco cair, o que acontece?" → A query na `token_ativo` falha → 401 → acesso bloqueado. Comportamento seguro.

---

## PADRÃO 2 — `.first() is not None`: Otimização de performance na inadimplência

**Arquivo:** `backend/utils/inadimplencia.py`, linhas 17-23

**O código:**
```python
tem_vencido = db.query(Lancamento).filter(
    Lancamento.id_clifor_relacionado_fk == id_clifor,
    Lancamento.natureza_lancamento == "Credito",
    Lancamento.data_pagamento == None,
    Lancamento.estorno == False,
    Lancamento.data_vencimento < date.today()
).first() is not None
```

**Por que parece desnecessário:** `.first()` retorna um objeto ou `None`. `is not None` converte para booleano. Parece que poderia ser simplificado — por que não usar `.count() > 0`?

**Por que `.first()` é melhor que `.count()`:**

`.count()` executa `SELECT COUNT(*)` — o banco percorre **todos** os registros que satisfazem o filtro para contar.

`.first()` executa `SELECT ... LIMIT 1` — o banco **para na primeira ocorrência**.

Para determinar inadimplência, basta saber se existe *ao menos um* lançamento vencido e não pago. Se o clifor tem 50 cobranças vencidas, `.count()` percorre todas 50. `.first()` para na primeira.

**SQL gerado:**
```sql
-- .count() → percorre todos os registros
SELECT COUNT(*) FROM lancamento WHERE id_clifor = ? AND ...;

-- .first() → para no primeiro
SELECT * FROM lancamento WHERE id_clifor = ? AND ... LIMIT 1;
```

**Complexidade:** O(n) vs O(1) para o pior caso. Diferença negligenciável para dezenas de lançamentos, relevante para centenas ou milhares.

---

## PADRÃO 3 — `write-on-change`: Só grava no banco se o valor mudou

**Arquivo:** `backend/utils/inadimplencia.py`, linhas 25-27

**O código:**
```python
if clifor.inadimplente != tem_vencido:
    clifor.inadimplente = tem_vencido
    db.commit()
```

**Por que parece desnecessário:** `atualizar_inadimplente()` é chamada a cada criação, efetivação e exclusão de lançamento. Parece simples sempre atualizar o campo, sem verificar se mudou.

**Por que a verificação importa:**

Cada `db.commit()` escreve no banco de dados e no WAL (Write-Ahead Log) do PostgreSQL. Se Carlos tem 10 lançamentos, e o operador efetiva todos um por um, `atualizar_inadimplente()` é chamada 10 vezes para Carlos.

Nas 9 primeiras chamadas, Carlos continua inadimplente (ainda tem cobranças vencidas abertas). O campo não muda.

Na 10ª chamada, Carlos não tem mais cobranças vencidas abertas. O campo muda de `True` para `False`.

**Com a verificação:** 1 `db.commit()` (na 10ª chamada).
**Sem a verificação:** 10 `db.commit()` (em todas as chamadas), 9 deles escrevendo o mesmo valor.

**Impacto prático:** Menos writes no banco, menos churn no WAL, menor carga em operações em lote. É um padrão chamado "write-on-change" ou "dirty tracking".

---

## PADRÃO 4 — FormData sem `Content-Type`: Upload de comprovante

**Arquivo:** `AMSI_Frontend/src/services/api.js`, linhas 299-308

**O código:**
```javascript
export const anexarComprovante = async (id_lancamento, arquivo) => {
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    const response = await fetchComLoading(
        `${BASE_URL}/lancamento/${id_lancamento}/comprovante`,
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            // ← Note: NÃO tem 'Content-Type': 'application/json'
            body: formData
        }
    );
    return handleResponse(response);
};
```

**Compare com todas as outras chamadas:**
```javascript
function authHeaders() {
    return {
        'Content-Type': 'application/json',   // ← aqui está o Content-Type
        Authorization: `Bearer ${getToken()}`
    };
}
```

**Por que `anexarComprovante` não usa `authHeaders()`:**

Quando o body é um objeto `FormData`, o browser precisa definir automaticamente:
```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW
```

O `boundary` é um identificador aleatório gerado pelo browser para separar os campos do formulário no body. Se o developer definir manualmente `Content-Type: application/json`, o backend tenta parsear o body como JSON — e falha porque o body é binário multipart.

**Regra:** com `FormData`, nunca setar `Content-Type` manualmente. O browser sabe o valor correto; você não.

**Por que isso importa para o backend:**
```python
# backend/routes/lancamento.py
@router.post("/{id_lancamento}/comprovante")
async def anexar_comprovante(
    id_lancamento: int,
    arquivo: UploadFile = File(...),   # ← FastAPI lê do multipart/form-data
    ...
):
```

`UploadFile = File(...)` espera `multipart/form-data`. Se receber `application/json`, retorna 422.

---

## PADRÃO 5 — `setSessaoExpiradaCallback`: Módulo JS conectando a estado React

**Arquivo:** `AMSI_Frontend/src/services/api.js`, linhas 7-9

**O código:**
```javascript
// Callback registrado pelo MonitorSessao — chamado direto no 401, sem evento de window
let _onSessaoExpirada = null;
export const setSessaoExpiradaCallback = (cb) => { _onSessaoExpirada = cb; };
```

**Onde é chamado:**
```javascript
// Linha 62 — quando recebe 401
logout();
_onSessaoExpirada?.();
```

**Por que não usar `window.dispatchEvent`:**

`api.js` é um módulo JavaScript puro, não um componente React. Ele não pode:
- Importar `useState` ou `useContext` (hooks só funcionam em componentes/custom hooks)
- Importar o `App` diretamente (criaria dependência circular)
- Modificar estado React diretamente

**O problema que precisa resolver:** quando o backend retorna 401 (sessão expirada), o popup "Sessão expirada" no frontend precisa aparecer. Esse popup é um estado React (`useState`) gerenciado pelo `App.jsx`.

**A solução — injeção de callback:**

1. `App.jsx` registra uma função: `setSessaoExpiradaCallback(() => setMostrarPopupSessao(true))`
2. Quando `api.js` detecta 401: `_onSessaoExpirada?.()` chama a função registrada
3. O estado React é atualizado, o popup aparece

**Por que não usar `window.addEventListener` / `dispatchEvent`:**

Funcionaria também, mas eventos de `window` são globais e difíceis de rastrear. O callback injetado é explícito — você sabe exatamente quem registrou e quem vai ser chamado.

**O padrão:** módulo não-React que precisa atualizar estado React usa callback injection. É uma alternativa ao Event Emitter pattern, mais simples para casos com um único subscriber.

---

## PADRÃO 6 — `QUERIES_ESPECIAIS`: Testes cientes de soft-delete

**Arquivo:** `backend/tests/conftest.py`, linhas 20-30

**O código:**
```python
def contar_tabelas(db):
    QUERIES_ESPECIAIS = {
        "usuario": "SELECT COUNT(*) FROM usuario WHERE exclusao IS NULL",
    }
    return {
        tabela: db.execute(
            __import__("sqlalchemy").text(
                QUERIES_ESPECIAIS.get(tabela, f"SELECT COUNT(*) FROM {tabela}")
            )
        ).scalar()
        for tabela in TABELAS_MONITORADAS
    }
```

**O contexto:** `db_snapshot` conta linhas de cada tabela antes e depois de todos os testes. Se qualquer tabela tiver contagens diferentes, falha com diagnóstico de qual tabela "ficou suja".

**Por que `usuario` precisa de query especial:**

A tabela `usuario` usa soft-delete — ao "deletar" um usuário, o sistema seta `exclusao = NOW()` em vez de executar `DELETE`. A linha continua na tabela.

Sem `QUERIES_ESPECIAIS`, o fluxo seria:

1. Antes dos testes: `usuario` tem 3 linhas → `snapshot_antes["usuario"] = 3`
2. Teste cria um usuário temporário → 4 linhas
3. Teste deleta o usuário (soft delete) → ainda 4 linhas, `exclusao` preenchido
4. Depois dos testes: `snapshot_depois["usuario"] = 4`
5. `db_snapshot` falha: "Tabela `usuario` ficou suja: antes=3, depois=4"

Mas o teste fez a coisa certa — "deletou" o usuário. A tabela tem 4 linhas fisicamente mas apenas 3 usuários ativos. Sem a query especial, o `db_snapshot` geraria um falso-positivo em todo teste que cria e deleta usuários.

**Com `QUERIES_ESPECIAIS`:**

```sql
SELECT COUNT(*) FROM usuario WHERE exclusao IS NULL
-- retorna 3 antes e depois — correto
```

O snapshot entende a semântica de negócio da tabela: "deletar" um usuário não reduz a contagem física de linhas, mas reduz a contagem de usuários ativos.

**O padrão:** testes que testam operações de soft-delete precisam ser cientes de que "delete" nesse sistema não é um `DELETE` SQL.

---

## PADRÃO 7 — `gerar_doc_ia()`: Reescrevendo a documentação para consumo por IA

**Arquivo:** `backend/main.py`, linhas 71-146

**O código:**
```python
def gerar_doc_ia(app, output_file="openapi_ai.yaml"):
    import yaml

    schema = app.openapi()
    components = schema.get("components", {}).get("schemas", {})

    def resolve_ref(ref):
        nome = ref.split("/")[-1]
        return components.get(nome, {})

    def extrair_campos(schema_obj):
        if "$ref" in schema_obj:
            schema_obj = resolve_ref(schema_obj["$ref"])
        if schema_obj.get("type") == "array":
            items = schema_obj.get("items", {})
            if "$ref" in items:
                items = resolve_ref(items["$ref"])
            schema_obj = items
        campos = {}
        for nome, info in schema_obj.get("properties", {}).items():
            tipo = info.get("type", "desconhecido")
            if "$ref" in info:
                tipo = info["$ref"].split("/")[-1]
            campos[nome] = {"tipo": tipo, "obrigatorio": nome in schema_obj.get("required", [])}
            if "enum" in info:
                campos[nome]["enum"] = info["enum"]
        return campos if campos else None

    # ... itera paths e gera lista de endpoints com campos resolvidos
    with open(output_file, "w", encoding="utf-8") as f:
        yaml.dump(resultado, f, allow_unicode=True, sort_keys=False)
```

**Quando é chamado:**
```python
# backend/main.py, linha 179
if __name__ == "__main__":
    gerar_doc_ia(app, output_file="openapi_ai.yaml")
    uvicorn.run("main:app", host=host, port=8000, reload=True)
```

Toda vez que o servidor sobe localmente, `openapi_ai.yaml` é regravado antes do Uvicorn iniciar.

**Por que parece desnecessário:** FastAPI já gera documentação automática em `/docs` (Swagger UI) e `/openapi.json`. O schema OpenAPI gerado por `app.openapi()` já existe — por que reescrever em outro arquivo?

**Por que existe:**

O schema OpenAPI padrão usa `$ref` para evitar repetição:

```json
{
  "requestBody": {
    "content": {
      "application/json": {
        "schema": { "$ref": "#/components/schemas/LancamentoCreate" }
      }
    }
  },
  "components": {
    "schemas": {
      "LancamentoCreate": {
        "properties": {
          "descricao": { "type": "string" },
          "valor": { "type": "number" }
        }
      }
    }
  }
}
```

Para um humano usando Swagger UI, os `$ref` são expandidos visualmente. Para uma ferramenta de IA (ou para o próprio desenvolvedor pedindo ajuda ao ChatGPT/Claude), `$ref` são ponteiros que precisam ser seguidos manualmente. Se você colar o `/openapi.json` bruto num chat de IA e perguntar "quais campos o endpoint POST /lancamento aceita?", a IA precisa navegar para `components/schemas/LancamentoCreate` para encontrar a resposta.

`gerar_doc_ia()` resolve todos os `$ref` recursivamente e produz um YAML flat:

```yaml
- endpoint: POST /lancamento
  descricao: Criar lançamento
  request_body:
    descricao: {tipo: string, obrigatorio: true}
    valor: {tipo: number, obrigatorio: true}
    natureza_lancamento: {tipo: string, enum: [Credito, Debito], obrigatorio: true}
  response_200:
    id_lancamento: {tipo: integer, obrigatorio: true}
    ...
```

**A decisão de design que isso revela:**

O sistema foi desenvolvido com IA como colaborador ativo. `openapi_ai.yaml` é um artefato criado especificamente para que uma ferramenta de IA possa responder "o que este endpoint recebe e retorna?" sem precisar resolver ponteiros. É documentação-como-código: nunca fica desatualizada porque é regenerada automaticamente a cada start do servidor.

**Casos de uso reais:**
- Colar `openapi_ai.yaml` num chat para pedir que a IA escreva um teste de integração para um endpoint específico
- Verificar rapidamente quais campos um endpoint aceita sem abrir o Swagger
- Documentação legível por humanos sem HTML/UI

**O que um professor pode perguntar:**
- "Por que regenerar toda vez que o servidor sobe? Isso não é lento?" → A geração é O(número de endpoints) com resolução de `$ref` — milissegundos. Roda antes do `uvicorn.run()`, não bloqueia requests.
- "Isso não quebra se os schemas mudarem?" → É o oposto — como regera automaticamente, nunca pode ficar desatualizado. É mais confiável que documentação escrita à mão.
- "Vocês realmente usaram IA para desenvolver?" → Sim, e esse arquivo é evidência disso. É um artefato do processo de desenvolvimento, não apenas do produto.

---

## RESUMO: OS 7 PADRÕES

| Padrão | Arquivo | Linha | Por que parece errado | Por que está certo |
|---|---|---|---|---|
| `verify_exp: False` | `auth/dependencies.py` | 40 | Ignora expiração do JWT | Expiração está no banco, não no token |
| `.first() is not None` | `utils/inadimplencia.py` | 17-23 | Por que não `.count() > 0`? | LIMIT 1 vs COUNT(*) — O(1) vs O(n) |
| `write-on-change` | `utils/inadimplencia.py` | 25-27 | Commit condicional parece paranóia | Evita writes desnecessários no WAL |
| FormData sem Content-Type | `src/services/api.js` | 299-308 | Faltou o header | Browser define `boundary` automaticamente |
| `setSessaoExpiradaCallback` | `src/services/api.js` | 7-9 | Callback global parece hack | Módulo JS não pode usar hooks React |
| `QUERIES_ESPECIAIS` | `tests/conftest.py` | 20-30 | Query diferente para `usuario` | Soft-delete não remove linhas fisicamente |
| `gerar_doc_ia()` | `main.py` | 71-146 | FastAPI já gera `/openapi.json` | Resolve `$ref` para consumo direto por IA |
