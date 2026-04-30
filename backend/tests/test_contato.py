import pytest


@pytest.fixture
def contato(client, headers_admin, clifor_base):
    r = client.post("/contato/", json={
        "id_clifor_fk": clifor_base["id_clifor"],
        "tipocontato": "Telefone",
        "info_do_contato": "(11) 99999-9999",
        "contato_principal": True
    }, headers=headers_admin)
    data = r.json()
    yield data
    client.delete(f"/contato/{data['id_contato']}", headers=headers_admin)


def test_criar_contato(client, headers_admin, clifor_base):
    r = client.post("/contato/", json={
        "id_clifor_fk": clifor_base["id_clifor"],
        "tipocontato": "Email",
        "info_do_contato": "pytest@teste.com",
        "contato_principal": False
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    client.delete(f"/contato/{data['id_contato']}", headers=headers_admin)


def test_criar_contato_sem_token(client, clifor_base):
    r = client.post("/contato/", json={
        "id_clifor_fk": clifor_base["id_clifor"],
        "tipocontato": "Telefone",
        "info_do_contato": "(11) 00000-0000",
        "contato_principal": False
    })
    assert r.status_code == 401


def test_listar_contatos(client, headers_admin):
    r = client.get("/contato/", headers=headers_admin)
    assert r.status_code == 200


def test_buscar_contato(client, headers_admin, contato):
    r = client.get(f"/contato/{contato['id_contato']}", headers=headers_admin)
    assert r.status_code == 200


def test_atualizar_contato(client, headers_admin, contato):
    r = client.put(f"/contato/{contato['id_contato']}",
                   json={"info_do_contato": "(11) 88888-8888"},
                   headers=headers_admin)
    assert r.status_code == 200
    assert r.json()["info_do_contato"] == "(11) 88888-8888"


def test_deletar_contato(client, headers_admin, clifor_base):
    r = client.post("/contato/", json={
        "id_clifor_fk": clifor_base["id_clifor"],
        "tipocontato": "Telefone",
        "info_do_contato": "(11) 77777-7777",
        "contato_principal": False
    }, headers=headers_admin)
    id_cont = r.json()["id_contato"]
    r = client.delete(f"/contato/{id_cont}", headers=headers_admin)
    assert r.status_code == 200
    r = client.get(f"/contato/{id_cont}", headers=headers_admin)
    assert r.status_code == 404