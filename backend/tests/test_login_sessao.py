import pytest


@pytest.fixture
def sessao(client, headers_admin, usuario_base):
    r = client.post("/login/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "dispositivo_logado": "Pytest",
        "localizacao": "127.0.0.1",
        "navegador": "pytest-client"
    }, headers=headers_admin)
    data = r.json()
    yield data
    client.delete(f"/login/{data['id_login']}", headers=headers_admin)


def test_registrar_sessao(client, headers_admin, usuario_base):
    r = client.post("/login/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "dispositivo_logado": "Pytest Temp",
        "localizacao": "127.0.0.1",
        "navegador": "pytest"
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    client.delete(f"/login/{data['id_login']}", headers=headers_admin)


def test_registrar_sessao_sem_token(client, usuario_base):
    r = client.post("/login/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "dispositivo_logado": "Sem Token",
        "localizacao": "127.0.0.1",
        "navegador": "pytest"
    })
    assert r.status_code == 401


def test_listar_sessoes(client, headers_admin):
    r = client.get("/login/", headers=headers_admin)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_buscar_sessao(client, headers_admin, sessao):
    r = client.get(f"/login/{sessao['id_login']}", headers=headers_admin)
    assert r.status_code == 200


def test_registrar_logout_sessao(client, headers_admin, sessao):
    r = client.put(f"/login/{sessao['id_login']}",
                   json={"data_logout": "2026-04-21T12:00:00"},
                   headers=headers_admin)
    assert r.status_code == 200

def test_listar_sessoes_sem_token(client):
    r = client.get("/login/")
    assert r.status_code == 401


def test_buscar_sessao_inexistente(client, headers_admin):
    """Sessão inexistente retorna 404."""
    r = client.get("/login/999999", headers=headers_admin)
    assert r.status_code == 404


def test_deletar_sessao(client, headers_admin, usuario_base):
    """Sessão pode ser deletada — retorna 200."""
    r = client.post("/login/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "dispositivo_logado": "Pytest Delete",
        "localizacao": "127.0.0.1",
        "navegador": "pytest"
    }, headers=headers_admin)
    assert r.status_code == 200
    id_login = r.json()["id_login"]
    r_del = client.delete(f"/login/{id_login}", headers=headers_admin)
    assert r_del.status_code == 200


def test_deletar_sessao_inexistente(client, headers_admin):
    """Sessão inexistente retorna 404."""
    r = client.delete("/login/999999", headers=headers_admin)
    assert r.status_code == 404