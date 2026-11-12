"""Invariante de segurança: o perfil Consulta só enxerga os dados do PRÓPRIO clifor
vinculado nas rotas de endereço e contato — nunca a base inteira.

É o gap que sobrou da reunião 2026-09-09 (a restrição era só de UI; a API vazava). Espelha
o escopo já aplicado em `GET /lancamento/` (item 7). Admin/Operador seguem vendo tudo.
"""

import uuid

import pytest


@pytest.fixture
def consulta_com_clifor(client, headers_admin, consulta_session):
    """Vincula o usuário Consulta de teste a um clifor PRÓPRIO e cria um clifor ALHEIO;
    cada um ganha 1 endereço e 1 contato. Teardown desvincula e apaga tudo (db_snapshot).

    CPFs únicos por execução: a fixture é function-scoped (roda a cada teste) e um CPF fixo
    colidiria (409) entre os testes se um teardown falhasse."""
    if not consulta_session["disponivel"]:
        pytest.skip(consulta_session["motivo"])
    id_consulta = consulta_session["id_usuario"]

    def _doc():
        # Documento único: cpf e rg entram na regra de credencial única (item 13); valor fixo
        # colidiria (409) na 2ª criação.
        return str(uuid.uuid4().int)[:11]

    def _clifor(nome):
        r = client.post("/cliente_fornecedor/", json={
            "pessoafisica_juridica": True, "cpf_cnpj": _doc(), "rg_inscricaoestadual": _doc(),
            "nome": nome, "datanascimento": "1990-01-01",
            "tipo_clifor": "A", "ativo": True, "inadimplente": False,
        }, headers=headers_admin)
        assert r.status_code == 200, r.text
        return r.json()["id_clifor"]

    def _endereco(id_clifor, logradouro):
        r = client.post("/endereco/", json={
            "id_clifor_fk": id_clifor, "enderecoprimario": True, "logradouro": logradouro,
            "numero": "1", "bairro": "B", "cidade": "C", "uf": "SP", "cep": "00000-000",
        }, headers=headers_admin)
        assert r.status_code == 200, r.text
        return r.json()["id_endereco"]

    def _contato(id_clifor, info):
        r = client.post("/contato/", json={
            "id_clifor_fk": id_clifor, "tipocontato": "email",
            "info_do_contato": info, "contato_principal": True,
        }, headers=headers_admin)
        assert r.status_code == 200, r.text
        return r.json()["id_contato"]

    proprio = _clifor("CliFor Proprio Consulta")
    alheio = _clifor("CliFor Alheio Consulta")
    dados = {
        "proprio": proprio, "alheio": alheio,
        "end_proprio": _endereco(proprio, "Rua Propria"),
        "end_alheio": _endereco(alheio, "Rua Alheia"),
        "cont_proprio": _contato(proprio, "proprio@x.com"),
        "cont_alheio": _contato(alheio, "alheio@x.com"),
    }
    r = client.post(f"/usuarios/{id_consulta}/clifor/{proprio}/associar", headers=headers_admin)
    assert r.is_success, r.text
    yield dados
    # Teardown: desvincula primeiro (o clifor próprio não pode ser apagado enquanto vinculado),
    # depois endereços/contatos, depois os clifors. Tenta TODOS os deletes e só então falha alto
    # se algum clifor não saiu — assim um vazamento vira ERRO explícito, não lixo silencioso no
    # db_snapshot.
    client.delete(f"/usuarios/{id_consulta}/clifor/desvincular", headers=headers_admin)
    for id_end in (dados["end_proprio"], dados["end_alheio"]):
        client.delete(f"/endereco/{id_end}", headers=headers_admin)
    for id_cont in (dados["cont_proprio"], dados["cont_alheio"]):
        client.delete(f"/contato/{id_cont}", headers=headers_admin)
    falhas = []
    for id_clifor in (proprio, alheio):
        r = client.delete(f"/cliente_fornecedor/{id_clifor}", headers=headers_admin)
        if not r.is_success:
            falhas.append((id_clifor, r.status_code, r.text))
    assert not falhas, f"teardown não apagou clifor(s): {falhas}"


# ================================================
# ENDEREÇO
# ================================================

def test_consulta_listar_enderecos_so_do_proprio(client, headers_consulta, headers_admin, consulta_com_clifor):
    d = consulta_com_clifor
    r = client.get("/endereco/", headers=headers_consulta)
    assert r.status_code == 200
    linhas = r.json()
    assert d["end_proprio"] in {e["id_endereco"] for e in linhas}
    assert d["alheio"] not in {e["id_clifor_fk"] for e in linhas}, \
        "Consulta não pode ver endereços de outro clifor"
    # Admin segue vendo os dois clifors (o escopo é só do Consulta).
    linhas_admin = client.get("/endereco/", headers=headers_admin).json()
    clifors_admin = {e["id_clifor_fk"] for e in linhas_admin}
    assert d["proprio"] in clifors_admin and d["alheio"] in clifors_admin


def test_consulta_buscar_endereco_alheio_403(client, headers_consulta, consulta_com_clifor):
    d = consulta_com_clifor
    assert client.get(f"/endereco/{d['end_alheio']}", headers=headers_consulta).status_code == 403
    # O próprio continua acessível.
    assert client.get(f"/endereco/{d['end_proprio']}", headers=headers_consulta).status_code == 200


def test_consulta_enderecos_por_clifor_alheio_403(client, headers_consulta, consulta_com_clifor):
    d = consulta_com_clifor
    assert client.get(f"/endereco/por-clifor/{d['alheio']}", headers=headers_consulta).status_code == 403
    assert client.get(f"/endereco/por-clifor/{d['proprio']}", headers=headers_consulta).status_code == 200


# ================================================
# CONTATO
# ================================================

def test_consulta_listar_contatos_so_do_proprio(client, headers_consulta, headers_admin, consulta_com_clifor):
    d = consulta_com_clifor
    r = client.get("/contato/", headers=headers_consulta)
    assert r.status_code == 200
    linhas = r.json()
    assert d["cont_proprio"] in {c["id_contato"] for c in linhas}
    assert d["alheio"] not in {c["id_clifor_fk"] for c in linhas}, \
        "Consulta não pode ver contatos de outro clifor"
    linhas_admin = client.get("/contato/", headers=headers_admin).json()
    clifors_admin = {c["id_clifor_fk"] for c in linhas_admin}
    assert d["proprio"] in clifors_admin and d["alheio"] in clifors_admin


def test_consulta_buscar_contato_alheio_403(client, headers_consulta, consulta_com_clifor):
    d = consulta_com_clifor
    assert client.get(f"/contato/{d['cont_alheio']}", headers=headers_consulta).status_code == 403
    assert client.get(f"/contato/{d['cont_proprio']}", headers=headers_consulta).status_code == 200


def test_consulta_contatos_por_clifor_alheio_403(client, headers_consulta, consulta_com_clifor):
    d = consulta_com_clifor
    assert client.get(f"/contato/por-clifor/{d['alheio']}", headers=headers_consulta).status_code == 403
    assert client.get(f"/contato/por-clifor/{d['proprio']}", headers=headers_consulta).status_code == 200
