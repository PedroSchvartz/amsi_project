"""
Testes novos — cobertura das funcionalidades adicionadas no MVP.
Arquivo: backend/tests/test_novos_mvp.py
"""
import pytest
from datetime import datetime, date


# ================================================
# FIXTURES LOCAIS
# ================================================

@pytest.fixture
def tipo_credito(client, headers_admin):
    """Tipo de conta Crédito para uso nos testes de reembolso."""
    r = client.post("/tipo_conta/", json={
        "descricao_conta": "Tipo Credito MVP",
        "natureza_conta": "Credito"
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    yield data
    client.delete(f"/tipo_conta/{data['id_tipo_conta']}", headers=headers_admin)


@pytest.fixture
def tipo_debito(client, headers_admin):
    """Tipo de conta Débito para uso nos testes de reembolso."""
    r = client.post("/tipo_conta/", json={
        "descricao_conta": "Tipo Debito MVP",
        "natureza_conta": "Debito"
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    yield data
    client.delete(f"/tipo_conta/{data['id_tipo_conta']}", headers=headers_admin)


@pytest.fixture
def clifor_sem_lancamento(client, headers_admin, usuario_base):
    """Clifor sem nenhum lançamento — para testar exclusão."""
    r = client.post("/cliente_fornecedor/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "pessoafisica_juridica": True,
        "cpf_cnpj": "999.999.999-99",
        "rg_inscricaoestadual": "9999999",
        "nome": "CliFor Sem Lancamento MVP",
        "datanascimento": "1995-05-05",
        "tipo_clifor": "C",
        "ativo": True,
        "inadimplente": False
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    yield data
    # Só deleta se ainda existir
    client.delete(f"/cliente_fornecedor/{data['id_clifor']}", headers=headers_admin)


@pytest.fixture
def lancamento_editavel(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Lançamento aberto para testar edição admin."""
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "300.00",
        "data_vencimento": "2099-12-31",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    yield data
    client.delete(f"/lancamento/{data['id_lancamento']}", headers=headers_admin)



# ================================================
# EDIÇÃO DE LANÇAMENTO — ADMIN
# ================================================

def test_editar_lancamento_admin_altera_valor(client, headers_admin, lancamento_editavel):
    """Admin consegue editar valor e vencimento de um lançamento."""
    r = client.patch(f"/lancamento/{lancamento_editavel['id_lancamento']}/editar", json={
        "valor": "999.00",
        "data_vencimento": "2099-06-30"
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert float(data["valor"]) == 999.00
    assert data["data_vencimento"] == "2099-06-30"


def test_editar_lancamento_admin_altera_natureza(client, headers_admin, lancamento_editavel):
    """Admin consegue alterar a natureza do lançamento."""
    r = client.patch(f"/lancamento/{lancamento_editavel['id_lancamento']}/editar", json={
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    assert r.status_code == 200
    assert r.json()["natureza_lancamento"] == "Debito"


def test_editar_lancamento_usuario_comum_proibido(client, headers_consulta, lancamento_editavel):
    """Usuário com perfil Consulta não pode editar lançamento — deve retornar 403."""
    r = client.patch(f"/lancamento/{lancamento_editavel['id_lancamento']}/editar", json={
        "valor": "1.00"
    }, headers=headers_consulta)
    assert r.status_code == 403


def test_editar_lancamento_inexistente_retorna_404(client, headers_admin):
    """Editar lançamento inexistente retorna 404."""
    r = client.patch("/lancamento/999999/editar", json={
        "valor": "1.00"
    }, headers=headers_admin)
    assert r.status_code == 404


# ================================================
# DELETE CLIFOR — BLOQUEIO POR LANÇAMENTO VINCULADO
# ================================================

def test_deletar_clifor_sem_lancamento(client, headers_admin, clifor_sem_lancamento):
    """Clifor sem lançamentos pode ser excluído."""
    r = client.delete(f"/cliente_fornecedor/{clifor_sem_lancamento['id_clifor']}", headers=headers_admin)
    assert r.status_code == 200


def test_deletar_clifor_com_lancamento_bloqueado(client, headers_admin, clifor_base, usuario_base, tipo_lancamento_base):
    """Clifor com lançamento vinculado não pode ser excluído — deve retornar 409."""
    # Criar lançamento vinculado ao clifor_base
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "10.00",
        "data_vencimento": "2099-12-31",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    assert r.status_code == 200
    id_lancamento = r.json()["id_lancamento"]

    # Tentar deletar o clifor
    r_del = client.delete(f"/cliente_fornecedor/{clifor_base['id_clifor']}", headers=headers_admin)
    assert r_del.status_code == 409

    # Limpeza
    client.delete(f"/lancamento/{id_lancamento}", headers=headers_admin)


# ================================================
# DELETE TIPO CONTA — BLOQUEIO POR LANÇAMENTO VINCULADO
# ================================================

def test_deletar_tipo_conta_com_lancamento_bloqueado(client, headers_admin, tipo_lancamento_base, clifor_base, usuario_base):
    """Tipo de conta com lançamento vinculado não pode ser excluído — deve retornar 409."""
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "10.00",
        "data_vencimento": "2099-12-31",
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    assert r.status_code == 200
    id_lancamento = r.json()["id_lancamento"]

    r_del = client.delete(f"/tipo_conta/{tipo_lancamento_base['id_tipo_conta']}", headers=headers_admin)
    assert r_del.status_code == 409

    # Limpeza
    client.delete(f"/lancamento/{id_lancamento}", headers=headers_admin)


def test_deletar_tipo_conta_sem_lancamento(client, headers_admin):
    """Tipo de conta sem lançamentos pode ser excluído."""
    r = client.post("/tipo_conta/", json={
        "descricao_conta": "Tipo Para Deletar MVP",
        "natureza_conta": "Debito"
    }, headers=headers_admin)
    assert r.status_code == 200
    id_tipo = r.json()["id_tipo_conta"]

    r_del = client.delete(f"/tipo_conta/{id_tipo}", headers=headers_admin)
    assert r_del.status_code == 200


# ================================================
# RESUMO — CAMPO total_inadimplencia
# ================================================

def test_resumo_total_inadimplencia_presente(client, headers_admin):
    """Campo total_inadimplencia deve existir no resumo."""
    r = client.get("/lancamento/resumo", headers=headers_admin)
    assert r.status_code == 200
    assert "total_inadimplencia" in r.json()


def test_resumo_total_inadimplencia_soma_creditos_vencidos(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """total_inadimplencia deve somar créditos vencidos e não pagos."""
    # Criar lançamento de crédito vencido
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "77.00",
        "data_vencimento": "2000-01-01",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    assert r.status_code == 200
    id_lancamento = r.json()["id_lancamento"]

    r_resumo = client.get("/lancamento/resumo", headers=headers_admin)
    assert r_resumo.status_code == 200
    assert float(r_resumo.json()["total_inadimplencia"]) >= 77.00

    client.delete(f"/lancamento/{id_lancamento}", headers=headers_admin)


def test_resumo_total_inadimplencia_nao_inclui_debito_vencido(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """total_inadimplencia não deve incluir débitos vencidos, apenas créditos."""
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "200.00",
        "data_vencimento": "2000-01-01",
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    assert r.status_code == 200
    id_lancamento = r.json()["id_lancamento"]

    r_antes = client.get("/lancamento/resumo", headers=headers_admin).json()
    inadimplencia_antes = float(r_antes["total_inadimplencia"])

    # Débito vencido não deve ter alterado total_inadimplencia
    # (o lançamento acima é débito — não deve contar)
    r_depois = client.get("/lancamento/resumo", headers=headers_admin).json()
    assert float(r_depois["total_inadimplencia"]) == inadimplencia_antes

    client.delete(f"/lancamento/{id_lancamento}", headers=headers_admin)


# ================================================
# REEMBOLSO COM NATUREZA DÉBITO — soma (inverso)
# ================================================

def test_resumo_reembolso_debito_soma(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Estorno de conta Débito deve SOMAR no total_reembolsado (natureza inversa)."""
    hoje = date.today().isoformat()

    base_reembolsado = float(
        client.get(f"/lancamento/resumo?data_pagamento_de={hoje}&data_pagamento_ate={hoje}", headers=headers_admin)
        .json()["total_reembolsado"]
    )

    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "80.00",
        "data_vencimento": hoje,
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    assert r.status_code == 200
    id_lancamento = r.json()["id_lancamento"]

    try:
        client.put(f"/lancamento/{id_lancamento}", json={
            "id_usuario_fk_fechamento": usuario_base["id_usuario"],
            "data_pagamento": datetime.now().isoformat(),
            "valor_pago": "80.00",
            "estorno": True
        }, headers=headers_admin)

        r_resumo = client.get(f"/lancamento/resumo?data_pagamento_de={hoje}&data_pagamento_ate={hoje}", headers=headers_admin)
        assert r_resumo.status_code == 200
        # Débito estornado: delta de total_reembolsado deve ser +80
        assert float(r_resumo.json()["total_reembolsado"]) - base_reembolsado == 80.0
    finally:
        client.delete(f"/lancamento/{id_lancamento}", headers=headers_admin)


def test_resumo_reembolso_regra_exemplo_spec(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """
    Valida o exemplo exato do spec:
    2x Crédito R$100 (subtrai) + 2x Débito R$50 (soma) = delta de -100
    """
    hoje = date.today().isoformat()
    ids = []

    base_reembolsado = float(
        client.get(f"/lancamento/resumo?data_pagamento_de={hoje}&data_pagamento_ate={hoje}", headers=headers_admin)
        .json()["total_reembolsado"]
    )

    try:
        # 2 estornos de Crédito R$100
        for _ in range(2):
            r = client.post("/lancamento/", json={
                "id_usuario_fk_lancamento": usuario_base["id_usuario"],
                "id_clifor_relacionado_fk": clifor_base["id_clifor"],
                "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
                "valor": "100.00",
                "data_vencimento": hoje,
                "natureza_lancamento": "Credito"
            }, headers=headers_admin)
            assert r.status_code == 200
            id_l = r.json()["id_lancamento"]
            ids.append(id_l)
            client.put(f"/lancamento/{id_l}", json={
                "id_usuario_fk_fechamento": usuario_base["id_usuario"],
                "data_pagamento": datetime.now().isoformat(),
                "valor_pago": "100.00",
                "estorno": True
            }, headers=headers_admin)

        # 2 estornos de Débito R$50
        for _ in range(2):
            r = client.post("/lancamento/", json={
                "id_usuario_fk_lancamento": usuario_base["id_usuario"],
                "id_clifor_relacionado_fk": clifor_base["id_clifor"],
                "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
                "valor": "50.00",
                "data_vencimento": hoje,
                "natureza_lancamento": "Debito"
            }, headers=headers_admin)
            assert r.status_code == 200
            id_l = r.json()["id_lancamento"]
            ids.append(id_l)
            client.put(f"/lancamento/{id_l}", json={
                "id_usuario_fk_fechamento": usuario_base["id_usuario"],
                "data_pagamento": datetime.now().isoformat(),
                "valor_pago": "50.00",
                "estorno": True
            }, headers=headers_admin)

        r_resumo = client.get(f"/lancamento/resumo?data_pagamento_de={hoje}&data_pagamento_ate={hoje}", headers=headers_admin)
        assert r_resumo.status_code == 200
        # delta: -100 + -100 + 50 + 50 = -100
        assert float(r_resumo.json()["total_reembolsado"]) - base_reembolsado == -100.0
    finally:
        for id_l in ids:
            client.delete(f"/lancamento/{id_l}", headers=headers_admin)
        