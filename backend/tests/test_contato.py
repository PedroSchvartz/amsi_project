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


def test_criar_contato_clifor_inexistente(client, headers_admin):
    """Clifor inexistente retorna 404."""
    r = client.post("/contato/", json={
        "id_clifor_fk": 999999,
        "tipocontato": "Telefone",
        "info_do_contato": "(11) 99999-9999",
        "contato_principal": False
    }, headers=headers_admin)
    assert r.status_code == 404


def test_atualizar_contato_inexistente(client, headers_admin):
    """Contato inexistente retorna 404."""
    r = client.put("/contato/999999", json={"info_do_contato": "(11) 11111-1111"}, headers=headers_admin)
    assert r.status_code == 404


def test_deletar_contato_inexistente(client, headers_admin):
    """Contato inexistente retorna 404."""
    r = client.delete("/contato/999999", headers=headers_admin)
    assert r.status_code == 404


# ── Escopo por perfil (RBAC) ────────────────────────────────────────────────
# Escrita exige Operador+ (exige_operador_ou_admin), igual a lancamento/clifor;
# leitura continua liberada a qualquer autenticado (inclui Consulta).

def test_consulta_pode_listar_contatos(client, headers_consulta):
    """Leitura permanece liberada para Consulta."""
    r = client.get("/contato/", headers=headers_consulta)
    assert r.status_code == 200


def test_consulta_nao_cria_contato(client, headers_consulta, clifor_base):
    """Consulta (somente leitura) não pode criar contato → 403."""
    r = client.post("/contato/", json={
        "id_clifor_fk": clifor_base["id_clifor"],
        "tipocontato": "Telefone",
        "info_do_contato": "(11) 99999-9999",
        "contato_principal": False
    }, headers=headers_consulta)
    assert r.status_code == 403


def test_consulta_nao_atualiza_contato(client, headers_consulta, contato):
    """Consulta não pode atualizar contato → 403."""
    r = client.put(f"/contato/{contato['id_contato']}",
                   json={"info_do_contato": "(11) 00000-0000"},
                   headers=headers_consulta)
    assert r.status_code == 403


def test_consulta_nao_deleta_contato(client, headers_consulta, contato):
    """Consulta não pode deletar contato → 403."""
    r = client.delete(f"/contato/{contato['id_contato']}", headers=headers_consulta)
    assert r.status_code == 403


def test_operador_cria_contato(client, headers_operador, headers_admin, clifor_base):
    """Operador pode criar contato → 200 (a correção não deve restringir demais)."""
    r = client.post("/contato/", json={
        "id_clifor_fk": clifor_base["id_clifor"],
        "tipocontato": "Email",
        "info_do_contato": "operador@teste.com",
        "contato_principal": False
    }, headers=headers_operador)
    assert r.status_code == 200
    client.delete(f"/contato/{r.json()['id_contato']}", headers=headers_admin)