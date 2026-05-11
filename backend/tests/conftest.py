import pytest
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal


TABELAS_MONITORADAS = [
    "usuario",
    "clientefornecedor",
    "lancamento",
    "endereco",
    "contato",
    "tipo_conta",
    "login",
]


def contar_tabelas(db):
    return {
        tabela: db.execute(__import__("sqlalchemy").text(f"SELECT COUNT(*) FROM {tabela}")).scalar()
        for tabela in TABELAS_MONITORADAS
    }


# ================================================
# CLIENT
# ================================================

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


# ================================================
# SNAPSHOT DO BANCO
# ================================================

@pytest.fixture(scope="session", autouse=True)
def db_snapshot(client, headers_admin):
    db = SessionLocal()
    snapshot_antes = contar_tabelas(db)
    db.close()

    # Registrar IDs de logins existentes antes dos testes
    ADMIN_EMAIL = "opedroschvartz@gmail.com"
    r_admin = client.get("/usuarios/", headers=headers_admin)
    admin = next((u for u in r_admin.json() if u["email"] == ADMIN_EMAIL), None)
    ids_logins_antes = set()
    if admin:
        r_logins = client.get(f"/login/por-usuario/{admin['id_usuario']}", headers=headers_admin)
        if r_logins.is_success:
            ids_logins_antes = {l["id_login"] for l in r_logins.json()}

    yield

    # Deletar logins do admin criados durante os testes
    if admin:
        r_logins = client.get(f"/login/por-usuario/{admin['id_usuario']}", headers=headers_admin)
        if r_logins.is_success:
            for login in r_logins.json():
                if login["id_login"] not in ids_logins_antes:
                    client.delete(f"/login/{login['id_login']}", headers=headers_admin)

    db = SessionLocal()
    snapshot_depois = contar_tabelas(db)
    db.close()

    divergencias = {
        tabela: (snapshot_antes[tabela], snapshot_depois[tabela])
        for tabela in TABELAS_MONITORADAS
        if snapshot_antes[tabela] != snapshot_depois[tabela]
    }

    if divergencias:
        linhas = "\n".join(
            f"  {tabela}: antes={antes}, depois={depois} (diff={depois - antes:+d})"
            for tabela, (antes, depois) in divergencias.items()
        )
        raise AssertionError(
            f"O banco ficou sujo após os testes. Tabelas com contagem diferente:\n{linhas}"
        )


# ================================================
# AUTH
# ================================================

@pytest.fixture(scope="session")
def token_admin(client):
    r = client.post("/auth/token", json={
        "email": "opedroschvartz@gmail.com",
        "senha": "123"
    })
    assert r.status_code == 200, f"Falha ao autenticar admin: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def headers_admin(token_admin):
    return {"Authorization": f"Bearer {token_admin}"}


# ================================================
# DADOS BASE — criados uma vez, usados em vários testes
# ================================================

@pytest.fixture(scope="session")
def tipo_lancamento_base(client, headers_admin):
    r = client.post("/tipo_conta/", json={
        "descricao_conta": "Tipo Pytest Base",
        "natureza_conta": "Debito",
        "observacao": "criado pelo pytest"
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    yield data
    client.delete(f"/tipo_conta/{data['id_tipo_conta']}", headers=headers_admin)


@pytest.fixture(scope="session")
def usuario_base(client, headers_admin):
    r = client.post("/usuarios/", json={
        "nome": "Usuario Pytest Base",
        "email": "pytest_base@amsi.com",
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    if r.status_code == 409:
        # Usuário já existe — buscar pelo email na listagem
        todos = client.get("/usuarios/", headers=headers_admin).json()
        data = next(u for u in todos if u["email"] == "pytest_base@amsi.com")
    else:
        assert r.status_code == 200
        data = r.json()
    yield data
    # Deletar lançamentos vinculados ao usuário antes de deletar o usuário
    lancamentos = client.get(f"/lancamento/por-usuario/{data['id_usuario']}", headers=headers_admin)
    if lancamentos.is_success:
        for l in lancamentos.json():
            client.delete(f"/lancamento/{l['id_lancamento']}", headers=headers_admin)
    # Deletar logins de sessão antes de deletar o usuário
    logins = client.get(f"/login/por-usuario/{data['id_usuario']}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{data['id_usuario']}", headers=headers_admin)


@pytest.fixture(scope="session")
def clifor_base(client, headers_admin, usuario_base):
    r = client.post("/cliente_fornecedor/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "pessoafisica_juridica": True,
        "cpf_cnpj": "111.111.111-11",
        "rg_inscricaoestadual": "1111111",
        "nome": "CliFor Pytest Base",
        "datanascimento": "1990-01-01",
        "tipo_clifor": "A",
        "ativo": True,
        "inadimplente": False
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    yield data
    client.delete(f"/cliente_fornecedor/{data['id_clifor']}", headers=headers_admin)