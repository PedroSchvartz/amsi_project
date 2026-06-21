import pytest


@pytest.fixture
def endereco(client, headers_admin, clifor_base):
    r = client.post("/endereco/", json={
        "id_clifor_fk": clifor_base["id_clifor"],
        "enderecoprimario": True,
        "logradouro": "Rua Pytest",
        "numero": "100",
        "bairro": "Bairro Pytest",
        "cidade": "Cidade Pytest",
        "uf": "SP",
        "cep": "00000-000"
    }, headers=headers_admin)
    data = r.json()
    yield data
    client.delete(f"/endereco/{data['id_endereco']}", headers=headers_admin)


def test_criar_endereco(client, headers_admin, clifor_base):
    r = client.post("/endereco/", json={
        "id_clifor_fk": clifor_base["id_clifor"],
        "enderecoprimario": False,
        "logradouro": "Rua Pytest Temp",
        "numero": "200",
        "bairro": "Bairro Temp",
        "cidade": "Cidade Temp",
        "uf": "RJ",
        "cep": "11111-111"
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    client.delete(f"/endereco/{data['id_endereco']}", headers=headers_admin)


def test_criar_endereco_sem_token(client, clifor_base):
    r = client.post("/endereco/", json={
        "id_clifor_fk": clifor_base["id_clifor"],
        "enderecoprimario": True,
        "logradouro": "Rua Sem Token",
        "numero": "1",
        "bairro": "Bairro",
        "cidade": "Cidade",
        "uf": "SP",
        "cep": "00000-000"
    })
    assert r.status_code == 401


def test_listar_enderecos(client, headers_admin):
    r = client.get("/endereco/", headers=headers_admin)
    assert r.status_code == 200


def test_buscar_endereco(client, headers_admin, endereco):
    r = client.get(f"/endereco/{endereco['id_endereco']}", headers=headers_admin)
    assert r.status_code == 200


def test_atualizar_endereco(client, headers_admin, endereco):
    r = client.put(f"/endereco/{endereco['id_endereco']}",
                   json={"logradouro": "Rua Atualizada"},
                   headers=headers_admin)
    assert r.status_code == 200
    assert r.json()["logradouro"] == "Rua Atualizada"


def test_deletar_endereco(client, headers_admin, clifor_base):
    r = client.post("/endereco/", json={
        "id_clifor_fk": clifor_base["id_clifor"],
        "enderecoprimario": False,
        "logradouro": "Rua Para Deletar",
        "numero": "999",
        "bairro": "Bairro",
        "cidade": "Cidade",
        "uf": "MG",
        "cep": "22222-222"
    }, headers=headers_admin)
    id_end = r.json()["id_endereco"]
    r = client.delete(f"/endereco/{id_end}", headers=headers_admin)
    assert r.status_code == 200
    r = client.get(f"/endereco/{id_end}", headers=headers_admin)
    assert r.status_code == 404


def test_criar_endereco_clifor_inexistente(client, headers_admin):
    """Clifor inexistente retorna 404."""
    r = client.post("/endereco/", json={
        "id_clifor_fk": 999999,
        "enderecoprimario": False,
        "logradouro": "Rua Inexistente",
        "numero": "1",
        "bairro": "Bairro",
        "cidade": "Cidade",
        "uf": "SP",
        "cep": "00000-000"
    }, headers=headers_admin)
    assert r.status_code == 404


def test_atualizar_endereco_inexistente(client, headers_admin):
    """Endereço inexistente retorna 404."""
    r = client.put("/endereco/999999", json={"logradouro": "Rua X"}, headers=headers_admin)
    assert r.status_code == 404


def test_deletar_endereco_inexistente(client, headers_admin):
    """Endereço inexistente retorna 404."""
    r = client.delete("/endereco/999999", headers=headers_admin)
    assert r.status_code == 404


# ── Escopo por perfil (RBAC) ────────────────────────────────────────────────
# Escrita exige Operador+ (exige_operador_ou_admin), igual a lancamento/clifor;
# leitura continua liberada a qualquer autenticado (inclui Consulta).

def test_consulta_pode_listar_enderecos(client, headers_consulta):
    """Leitura permanece liberada para Consulta."""
    r = client.get("/endereco/", headers=headers_consulta)
    assert r.status_code == 200


def test_consulta_nao_cria_endereco(client, headers_consulta, clifor_base):
    """Consulta (somente leitura) não pode criar endereço → 403."""
    r = client.post("/endereco/", json={
        "id_clifor_fk": clifor_base["id_clifor"],
        "enderecoprimario": False,
        "logradouro": "Rua Consulta",
        "numero": "1",
        "bairro": "Bairro",
        "cidade": "Cidade",
        "uf": "SP",
        "cep": "00000-000"
    }, headers=headers_consulta)
    assert r.status_code == 403


def test_consulta_nao_atualiza_endereco(client, headers_consulta, endereco):
    """Consulta não pode atualizar endereço → 403."""
    r = client.put(f"/endereco/{endereco['id_endereco']}",
                   json={"logradouro": "Tentativa Consulta"},
                   headers=headers_consulta)
    assert r.status_code == 403


def test_consulta_nao_deleta_endereco(client, headers_consulta, endereco):
    """Consulta não pode deletar endereço → 403."""
    r = client.delete(f"/endereco/{endereco['id_endereco']}", headers=headers_consulta)
    assert r.status_code == 403


def test_operador_cria_endereco(client, headers_operador, headers_admin, clifor_base):
    """Operador pode criar endereço → 200 (a correção não deve restringir demais)."""
    r = client.post("/endereco/", json={
        "id_clifor_fk": clifor_base["id_clifor"],
        "enderecoprimario": False,
        "logradouro": "Rua Operador",
        "numero": "10",
        "bairro": "Bairro",
        "cidade": "Cidade",
        "uf": "SP",
        "cep": "00000-000"
    }, headers=headers_operador)
    assert r.status_code == 200
    client.delete(f"/endereco/{r.json()['id_endereco']}", headers=headers_admin)