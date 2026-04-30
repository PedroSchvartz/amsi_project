import pytest


@pytest.fixture
def clifor(client, headers_admin, usuario_base):
    r = client.post("/cliente_fornecedor/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "pessoafisica_juridica": True,
        "cpf_cnpj": "222.222.222-22",
        "rg_inscricaoestadual": "2222222",
        "nome": "CliFor Pytest Fixture",
        "datanascimento": "1985-06-15",
        "tipo_clifor": "C",
        "ativo": True,
        "inadimplente": False
    }, headers=headers_admin)
    data = r.json()
    yield data
    client.delete(f"/cliente_fornecedor/{data['id_clifor']}", headers=headers_admin)


@pytest.fixture
def clifor_inadimplente(client, headers_admin, usuario_base):
    r = client.post("/cliente_fornecedor/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "pessoafisica_juridica": True,
        "cpf_cnpj": "444.444.444-44",
        "rg_inscricaoestadual": "4444444",
        "nome": "CliFor Inadimplente Pytest",
        "datanascimento": "1980-03-10",
        "tipo_clifor": "F",
        "ativo": True,
        "inadimplente": True
    }, headers=headers_admin)
    data = r.json()
    yield data
    client.delete(f"/cliente_fornecedor/{data['id_clifor']}", headers=headers_admin)


@pytest.fixture
def clifor_juridico(client, headers_admin, usuario_base):
    r = client.post("/cliente_fornecedor/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "pessoafisica_juridica": False,
        "cpf_cnpj": "55.555.555/0001-55",
        "rg_inscricaoestadual": "555555555",
        "nome": "Empresa Pytest Juridica",
        "datanascimento": "2005-01-01",
        "tipo_clifor": "F",
        "ativo": True,
        "inadimplente": False
    }, headers=headers_admin)
    data = r.json()
    yield data
    client.delete(f"/cliente_fornecedor/{data['id_clifor']}", headers=headers_admin)


def test_criar_clifor(client, headers_admin, usuario_base):
    r = client.post("/cliente_fornecedor/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "pessoafisica_juridica": False,
        "cpf_cnpj": "33.333.333/0001-33",
        "rg_inscricaoestadual": "333333333",
        "nome": "CliFor Pytest Temp",
        "datanascimento": "2000-01-01",
        "tipo_clifor": "F",
        "ativo": True,
        "inadimplente": False
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    client.delete(f"/cliente_fornecedor/{data['id_clifor']}", headers=headers_admin)


def test_criar_clifor_sem_token(client, usuario_base):
    r = client.post("/cliente_fornecedor/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "pessoafisica_juridica": True,
        "cpf_cnpj": "000.000.000-00",
        "rg_inscricaoestadual": "0000000",
        "nome": "Sem Token",
        "datanascimento": "1990-01-01",
        "tipo_clifor": "A",
        "ativo": True,
        "inadimplente": False
    })
    assert r.status_code == 401


def test_listar_clifors(client, headers_admin):
    r = client.get("/cliente_fornecedor/", headers=headers_admin)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_buscar_clifor(client, headers_admin, clifor):
    r = client.get(f"/cliente_fornecedor/{clifor['id_clifor']}", headers=headers_admin)
    assert r.status_code == 200


def test_buscar_clifor_inexistente(client, headers_admin):
    r = client.get("/cliente_fornecedor/999999", headers=headers_admin)
    assert r.status_code == 404


def test_atualizar_clifor(client, headers_admin, clifor):
    r = client.put(f"/cliente_fornecedor/{clifor['id_clifor']}",
                   json={"nome": "CliFor Atualizado"},
                   headers=headers_admin)
    assert r.status_code == 200
    assert r.json()["nome"] == "CliFor Atualizado"


# ================================================
# FILTROS — ISOLADOS
# ================================================

def test_filtro_nome_exato(client, headers_admin, clifor):
    r = client.get("/cliente_fornecedor/?nome=CliFor+Pytest+Fixture", headers=headers_admin)
    assert r.status_code == 200
    assert any(c["id_clifor"] == clifor["id_clifor"] for c in r.json())


def test_filtro_nome_parcial(client, headers_admin, clifor):
    r = client.get("/cliente_fornecedor/?nome=Pytest+Fixture", headers=headers_admin)
    assert r.status_code == 200
    assert any(c["id_clifor"] == clifor["id_clifor"] for c in r.json())


def test_filtro_nome_sem_resultado(client, headers_admin):
    r = client.get("/cliente_fornecedor/?nome=NomeQueNaoExisteXYZ123", headers=headers_admin)
    assert r.status_code == 200
    assert r.json() == []


def test_filtro_tipo_clifor_cliente(client, headers_admin, clifor):
    r = client.get("/cliente_fornecedor/?tipo_clifor=C", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(c["tipo_clifor"] == "C" for c in data)
    assert any(c["id_clifor"] == clifor["id_clifor"] for c in data)


def test_filtro_tipo_clifor_fornecedor(client, headers_admin, clifor_inadimplente):
    r = client.get("/cliente_fornecedor/?tipo_clifor=F", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(c["tipo_clifor"] == "F" for c in data)
    assert any(c["id_clifor"] == clifor_inadimplente["id_clifor"] for c in data)


def test_filtro_inadimplente_true(client, headers_admin, clifor_inadimplente):
    r = client.get("/cliente_fornecedor/?inadimplente=true", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(c["inadimplente"] is True for c in data)
    assert any(c["id_clifor"] == clifor_inadimplente["id_clifor"] for c in data)


def test_filtro_inadimplente_false(client, headers_admin, clifor):
    r = client.get("/cliente_fornecedor/?inadimplente=false", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(c["inadimplente"] is False for c in data)
    assert any(c["id_clifor"] == clifor["id_clifor"] for c in data)


def test_filtro_ativo_true(client, headers_admin, clifor):
    r = client.get("/cliente_fornecedor/?ativo=true", headers=headers_admin)
    assert r.status_code == 200
    assert all(c["ativo"] is True for c in r.json())


def test_filtro_pessoafisica(client, headers_admin, clifor):
    r = client.get("/cliente_fornecedor/?pessoafisica_juridica=true", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(c["pessoafisica_juridica"] is True for c in data)
    assert any(c["id_clifor"] == clifor["id_clifor"] for c in data)


def test_filtro_pessoajuridica(client, headers_admin, clifor_juridico):
    r = client.get("/cliente_fornecedor/?pessoafisica_juridica=false", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(c["pessoafisica_juridica"] is False for c in data)
    assert any(c["id_clifor"] == clifor_juridico["id_clifor"] for c in data)


def test_filtro_apenas_pendentes(client, headers_admin, clifor_base, tipo_lancamento_base, usuario_base):
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "50.00",
        "data_vencimento": "2026-12-31",
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    assert r.status_code == 200
    id_lanc = r.json()["id_lancamento"]

    r = client.get("/cliente_fornecedor/?apenas_pendentes=true", headers=headers_admin)
    assert r.status_code == 200
    assert any(c["id_clifor"] == clifor_base["id_clifor"] for c in r.json())

    client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


# ================================================
# FILTROS — COMBINADOS
# ================================================

def test_filtro_combinado_tipo_inadimplente(client, headers_admin, clifor_inadimplente):
    r = client.get("/cliente_fornecedor/?tipo_clifor=F&inadimplente=true", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(c["tipo_clifor"] == "F" and c["inadimplente"] is True for c in data)
    assert any(c["id_clifor"] == clifor_inadimplente["id_clifor"] for c in data)


def test_filtro_combinado_nome_tipo(client, headers_admin, clifor):
    r = client.get("/cliente_fornecedor/?nome=Fixture&tipo_clifor=C", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(c["tipo_clifor"] == "C" for c in data)
    assert any(c["id_clifor"] == clifor["id_clifor"] for c in data)


def test_filtro_combinado_pf_ativo(client, headers_admin, clifor):
    r = client.get("/cliente_fornecedor/?pessoafisica_juridica=true&ativo=true", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(c["pessoafisica_juridica"] is True and c["ativo"] is True for c in data)


# ================================================
# RESUMO
# ================================================

def test_resumo_clifor(client, headers_admin, clifor_base, usuario_base, tipo_lancamento_base):
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "300.00",
        "data_vencimento": "2020-01-01",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    assert r.status_code == 200
    id_lanc = r.json()["id_lancamento"]

    r = client.get(f"/cliente_fornecedor/{clifor_base['id_clifor']}/resumo", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()

    campos = ["id_clifor", "nome", "total_a_receber", "total_a_pagar", "saldo_liquido",
              "total_vencido_a_receber", "total_vencido_a_pagar",
              "quantidade_abertos", "quantidade_vencidos"]
    for campo in campos:
        assert campo in data

    assert data["id_clifor"] == clifor_base["id_clifor"]
    assert float(data["total_a_receber"]) >= 300.00
    assert float(data["total_vencido_a_receber"]) >= 300.00
    assert data["quantidade_vencidos"] >= 1

    client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


def test_resumo_clifor_saldo_liquido_calculo(client, headers_admin, clifor_base, usuario_base, tipo_lancamento_base):
    r = client.get(f"/cliente_fornecedor/{clifor_base['id_clifor']}/resumo", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    esperado = round(float(data["total_a_receber"]) - float(data["total_a_pagar"]), 2)
    assert round(float(data["saldo_liquido"]), 2) == esperado


def test_resumo_clifor_inexistente(client, headers_admin):
    r = client.get("/cliente_fornecedor/999999/resumo", headers=headers_admin)
    assert r.status_code == 404


def test_resumo_clifor_sem_lancamentos(client, headers_admin, clifor):
    r = client.get(f"/cliente_fornecedor/{clifor['id_clifor']}/resumo", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert float(data["total_a_receber"]) == 0
    assert float(data["total_a_pagar"]) == 0
    assert data["quantidade_abertos"] == 0
    assert data["quantidade_vencidos"] == 0


def test_resumo_clifor_sem_token(client, clifor_base):
    r = client.get(f"/cliente_fornecedor/{clifor_base['id_clifor']}/resumo")
    assert r.status_code == 401