# Temático: Testes — TCC AMSI
## Deep dive completo em pytest, TestClient e estratégias de teste para o NotebookLM

> **Como usar:** sobe apenas este arquivo no NotebookLM para estudar testes isoladamente. Bom para perguntas sobre integração vs unitário, db_snapshot, fixtures e por que 214 testes importam.

---

## 1. POR QUE TESTES AUTOMATIZADOS IMPORTAM

### O problema sem testes

Um sistema sem testes automatizados tem um custo oculto: toda mudança é arriscada. Quando você modifica a função de cálculo de inadimplência para corrigir um bug, como sabe que não quebrou o fluxo de efetivação de pagamentos? Sem testes, a resposta é: "testando manualmente" — o que significa abrir o browser, fazer login, criar um lançamento, efetivar, verificar. Isso leva 5 minutos e cobre 1 cenário. O AMSI tem centenas de cenários.

### O que 214 testes garantem

Cada teste é um **cenário documentado e verificável automaticamente**. Ao mudar qualquer linha de código:
```bash
pytest tests/ -v
# em ~15 segundos: passou ou falhou — com diagnóstico preciso
```

Se um teste falha após uma mudança, você sabe exatamente qual comportamento foi quebrado, antes de qualquer deploy.

### Testes como documentação executável

```python
def test_operador_nao_pode_criar_usuario():
    response = client_operador.post("/usuario/", json={...})
    assert response.status_code == 403
```

Esse teste documenta que "Operador não pode criar usuário retorna 403". Não é documentação estática que pode ficar desatualizada — é um contrato executável que falha se o comportamento mudar.

---

## 2. TIPOS DE TESTE: INTEGRAÇÃO vs UNITÁRIO

### Teste unitário
Testa uma função em isolamento, sem dependências externas (banco, rede, arquivo).

```python
# Exemplo de unitário — NÃO é o padrão do AMSI
def test_hash_senha():
    hash = hash_senha("minhasenha")
    assert verificar_senha("minhasenha", hash) is True
    assert verificar_senha("outrasenha", hash) is False
```

**Vantagem:** rápido, fácil de escrever, fácil de diagnosticar quando falha.
**Limitação:** não testa a integração entre partes. Um teste unitário que passa não garante que a rota completa funciona.

### Teste de integração
Testa múltiplas camadas juntas — desde a requisição HTTP até o banco e a resposta.

```python
# Padrão do AMSI: integração
def test_criar_lancamento_operador(client_operador, db):
    response = client_operador.post("/lancamento/", json={
        "valor": 150.00,
        "natureza_lancamento": "Credito",
        "data_vencimento": "2026-06-01",
        "id_clifor_relacionado_fk": 1,
        "id_tipo_conta_fk": 1
    })
    assert response.status_code == 201
    data = response.json()
    assert data["valor"] == "150.00"
    assert data["id_lancamento"] is not None
```

Esse teste verifica a stack completa: HTTP → FastAPI roteamento → Pydantic validação → SQLAlchemy → PostgreSQL → serialização → resposta.

### Por que o AMSI prioriza integração

O maior risco do sistema não é "a função `hash_senha` quebrar" — é "a rota de criação de lançamento quebrar para um Operador". Testes de integração cobrem exatamente o que importa: as operações que os usuários reais fazem.

---

## 3. TESTCLIENT — O BACKEND SEM SERVIDOR

### Como funciona

`TestClient` do FastAPI/Starlette permite simular requisições HTTP sem subir um servidor HTTP real:

```python
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

# Simula um POST real
response = client.post("/lancamento/", json={...}, headers={"Authorization": "Bearer ..."})
print(response.status_code)  # 201
print(response.json())       # {...}
```

O `TestClient` usa o `httpx` internamente para fazer requisições diretas ao WSGI/ASGI da aplicação — sem TCP, sem porta, sem servidor. Mas o comportamento é idêntico ao de uma requisição real: middleware executar, dependências injetadas, banco consultado, resposta serializada.

### Banco real, não mockado

O teste usa um banco PostgreSQL real (o mesmo banco de desenvolvimento ou um banco de testes dedicado). Isso é crucial: se o código funciona com o banco real, ele funciona em produção. Se o banco fosse mockado, um bug de query seria invisível nos testes.

---

## 4. FIXTURES — O SISTEMA DE SETUP/TEARDOWN

### O que são fixtures no pytest

Fixtures são funções que preparam o contexto para um teste e fazem limpeza depois. São declaradas com `@pytest.fixture` e injetadas nos testes pelo nome do parâmetro.

```python
# backend/tests/conftest.py
@pytest.fixture(scope="session")
def db():
    # cria conexão com banco de teste
    yield SessionLocal()
    # teardown: fecha conexão

@pytest.fixture(scope="session")
def client():
    # TestClient sem autenticação
    yield TestClient(app)

@pytest.fixture(scope="session")
def client_admin(db):
    # cria usuário admin temporário no banco
    # faz login, obtém token
    # TestClient com header Authorization do admin
    token = fazer_login(email="admin_teste@amsi.com", senha="senha_teste")
    yield TestClient(app, headers={"Authorization": f"Bearer {token}"})
    # teardown: deleta o usuário admin temporário

@pytest.fixture(scope="session")
def client_operador(db):
    # idem para operador
    ...

@pytest.fixture(scope="session")
def client_consulta(db):
    # idem para consulta
    ...
```

### Escopo `session` vs `function`

`scope="session"`: a fixture é criada uma vez para toda a suite de testes e destruída no final. Os clientes HTTP são criados uma vez — mais eficiente.

`scope="function"` (padrão): a fixture é criada e destruída para cada teste. Usar para dados que precisam de isolamento total entre testes.

---

## 5. DB_SNAPSHOT — O FISCAL DE ISOLAMENTO

### O problema do estado compartilhado entre testes

Se um teste cria um lançamento e não o deleta, o próximo teste encontra o banco em estado diferente do esperado. Dependendo da ordem de execução, testes podem passar ou falhar aleatoriamente — o chamado "flaky test" (teste frágil).

### A solução: `db_snapshot`

```python
# backend/tests/conftest.py
@pytest.fixture(scope="session", autouse=True)
def db_snapshot(db):
    # ANTES de todos os testes: conta linhas de cada tabela
    antes = {
        "lancamento": db.query(Lancamento).count(),
        "clientefornecedor": db.query(ClienteFornecedor).count(),
        "usuario": db.query(Usuario).count(),
        "tipo_conta": db.query(TipoConta).count(),
        "token_ativo": db.query(TokenAtivo).count(),
    }

    yield  # todos os testes executam aqui

    # DEPOIS de todos os testes: conta novamente
    depois = {
        "lancamento": db.query(Lancamento).count(),
        "clientefornecedor": db.query(ClienteFornecedor).count(),
        "usuario": db.query(Usuario).count(),
        "tipo_conta": db.query(TipoConta).count(),
        "token_ativo": db.query(TokenAtivo).count(),
    }

    # Verifica se alguma tabela mudou
    for tabela in antes:
        assert antes[tabela] == depois[tabela], (
            f"Tabela '{tabela}' ficou suja: "
            f"antes={antes[tabela]}, depois={depois[tabela]}"
        )
```

`autouse=True` significa que essa fixture é aplicada automaticamente a todos os testes sem precisar ser declarada em cada um.

**O que acontece quando um teste falha no db_snapshot:**
```
FAILED tests/conftest.py::db_snapshot - AssertionError: Tabela 'lancamento' ficou suja: antes=5, depois=6
```
Isso indica que um teste criou um lançamento e não o apagou. O diagnóstico é imediato.

---

## 6. TEARDOWN EM CASCATA

### O problema das chaves estrangeiras

Se um teste cria um `TipoConta` e um `Lancamento` que referencia esse `TipoConta`, deletar o `TipoConta` antes do `Lancamento` viola a constraint de FK.

```sql
-- Erro: ainda existem lançamentos referenciando esse tipo_conta
DELETE FROM tipo_conta WHERE id_tipo_conta = 99;
-- ERROR: violates foreign key constraint on table "lancamento"
```

### A solução: deletar do filho para o pai

```python
# Ordem correta de teardown
def teardown_teste(db, id_lancamento, id_tipo_conta, id_clifor):
    # 1. deletar filho (o que tem a FK)
    db.query(Lancamento).filter_by(id_lancamento=id_lancamento).delete()
    db.commit()
    # 2. só agora deletar o pai
    db.query(TipoConta).filter_by(id_tipo_conta=id_tipo_conta).delete()
    db.query(ClienteFornecedor).filter_by(id_clifor=id_clifor).delete()
    db.commit()
```

A hierarquia de dependências do AMSI:
```
token_ativo → usuario
lancamento → usuario, clientefornecedor, tipo_conta
contato → clientefornecedor
endereco → clientefornecedor
login → usuario
```

**Ordem de deleção:** token_ativo → lancamento → login → contato/endereco → usuario → clientefornecedor → tipo_conta

---

## 7. COBERTURA DE CENÁRIOS

### O que cada arquivo de testes cobre

**`test_lancamento.py`**
- Criar lançamento como Operador → 201
- Criar lançamento como Consulta → 403
- Criar lançamento sem campos obrigatórios → 422
- Efetivar lançamento sem data de pagamento → 422
- Efetivar lançamento já efetivado → 400 (regra de negócio)
- Buscar lançamentos por filtro (data, natureza, status)
- Admin edita lançamento existente
- Operador tenta editar → 403

**`test_usuario.py`**
- Admin cria usuário → 201
- Admin cria usuário com email duplicado → 409
- Operador tenta criar usuário → 403
- Admin não pode deletar a si mesmo → 400
- Alterar senha com token correto → 200
- Alterar senha com senha atual errada → 400

**`test_permissoes.py`**
- Cada endpoint sensível testado com cada perfil insuficiente
- Confirma 403 para Consulta em rotas de Operador
- Confirma 403 para Operador em rotas de Admin
- Confirma 401 para requisição sem token

**`test_cliente_fornecedor.py`**
- Criar clifor → 201
- Criar clifor com CPF duplicado → 409
- Deletar clifor com lançamentos ativos → 400 (regra de integridade)
- Verificar flag inadimplente após criar lançamento vencido

---

## 8. PADRÃO DE TESTE COMPLETO

### Exemplo: testando a regra de inadimplência

```python
def test_inadimplencia_atualiza_apos_criar_lancamento_vencido(
    client_operador, db
):
    # SETUP: criar clifor
    resp_clifor = client_operador.post("/cliente-fornecedor/", json={
        "nome": "Associado Teste"
    })
    clifor_id = resp_clifor.json()["id_clifor"]

    # SETUP: criar tipo de conta
    resp_tipo = client_operador.post("/tipo-conta/", json={
        "descricao_conta": "Mensalidade Teste",
        "natureza_conta": "Credito"
    })
    tipo_id = resp_tipo.json()["id_tipo_conta"]

    # ACT: criar lançamento com data de vencimento no passado
    resp_lanc = client_operador.post("/lancamento/", json={
        "valor": 100.00,
        "natureza_lancamento": "Credito",
        "data_vencimento": "2020-01-01",  # data passada = vencido
        "id_clifor_relacionado_fk": clifor_id,
        "id_tipo_conta_fk": tipo_id
    })
    assert resp_lanc.status_code == 201
    lancamento_id = resp_lanc.json()["id_lancamento"]

    # ASSERT: clifor deve estar inadimplente
    resp_clifor_atual = client_operador.get(f"/cliente-fornecedor/{clifor_id}")
    assert resp_clifor_atual.json()["inadimplente"] is True

    # TEARDOWN: deletar lançamento → tipo_conta → clifor
    client_operador.delete(f"/lancamento/{lancamento_id}")
    client_operador.delete(f"/tipo-conta/{tipo_id}")
    client_operador.delete(f"/cliente-fornecedor/{clifor_id}")
```

Esse teste documenta e verifica o comportamento completo da regra de negócio de inadimplência — do HTTP até o banco e de volta.

---

## 9. O QUE OS TESTES NÃO COBREM

### Sem testes de frontend
O projeto tem 214 testes de backend. O frontend (React) não tem testes automatizados. Regressões no frontend são detectadas apenas manualmente. Ferramentas que cobririam isso: **Vitest** (testes de componentes React), **Playwright** ou **Cypress** (testes end-to-end).

### Sem medição de cobertura de linhas
`pytest-cov` mediria qual porcentagem das linhas do código Python é executada pelos testes. O projeto não usa. Alguns caminhos de código (tratamento de erros raros, edge cases) podem não ter cobertura. Para um projeto de produção, cobertura acima de 80% seria o mínimo.

### Sem testes de carga
Não há testes de performance — não sabemos como o sistema se comporta com 100 usuários simultâneos. Ferramentas: **Locust** para simular carga, **k6** para scripts de stress test.

### Sem testes de contrato de API
Se o backend mudar um campo da resposta de um endpoint sem atualizar o frontend, o erro só aparece em tempo de execução. Não há validação automática de que o frontend e o backend estão em sincronia.

---

## 10. RESUMO: O QUE APRENDER COM OS TESTES DO AMSI

| Conceito | Como aparece no AMSI |
|---|---|
| Teste de integração | TestClient + banco PostgreSQL real, sem mocks |
| Fixture de sessão | `client_admin`, `client_operador`, `client_consulta` criados uma vez |
| Isolamento via `db_snapshot` | Conta linhas antes/depois de toda a suite |
| Teardown em cascata | Deleta filho antes do pai para respeitar FK |
| Teste de happy path | `status_code == 201` + verificação dos dados retornados |
| Teste de cenário de erro | `status_code == 403` para perfil insuficiente |
| Teste de regra de negócio | Criar lançamento vencido → verificar flag inadimplente |
| Documentação executável | Cada teste descreve um comportamento esperado do sistema |
