import pytest
from fastapi.testclient import TestClient
from main import app


# ================================================
# CLIENT
# ================================================

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


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