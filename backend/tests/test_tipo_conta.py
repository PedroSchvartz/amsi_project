import pytest


@pytest.fixture
def tipo(client, headers_admin):
    r = client.post("/tipo_conta/", json={
        "descricao_conta": "Tipo Pytest Fixture",
        "natureza_conta": "Credito"
    }, headers=headers_admin)
    data = r.json()
    yield data
    client.delete(f"/tipo_conta/{data['id_tipo_conta']}", headers=headers_admin)


def test_criar_tipo(client, headers_admin):
    r = client.post("/tipo_conta/", json={
        "descricao_conta": "Tipo Pytest Temp",
        "natureza_conta": "Debito"
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    client.delete(f"/tipo_conta/{data['id_tipo_conta']}", headers=headers_admin)


def test_criar_tipo_sem_token(client):
    r = client.post("/tipo_conta/", json={
        "descricao_conta": "Tipo Sem Token",
        "natureza_conta": "Debito"
    })
    assert r.status_code == 401


def test_listar_tipos(client, headers_admin):
    r = client.get("/tipo_conta/", headers=headers_admin)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_buscar_tipo(client, headers_admin, tipo):
    r = client.get(f"/tipo_conta/{tipo['id_tipo_conta']}", headers=headers_admin)
    assert r.status_code == 200


def test_buscar_tipo_inexistente(client, headers_admin):
    r = client.get("/tipo_conta/999999", headers=headers_admin)
    assert r.status_code == 404


def test_atualizar_tipo(client, headers_admin, tipo):
    r = client.put(f"/tipo_conta/{tipo['id_tipo_conta']}",
                   json={"descricao_conta": "Tipo Atualizado"},
                   headers=headers_admin)
    assert r.status_code == 200
    assert r.json()["descricao_conta"] == "Tipo Atualizado"


def test_deletar_tipo_sem_token(client, tipo):
    r = client.delete(f"/tipo_conta/{tipo['id_tipo_conta']}")
    assert r.status_code == 401