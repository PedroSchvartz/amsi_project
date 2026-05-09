import pytest


@pytest.fixture
def lancamento(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "250.00",
        "data_vencimento": "2026-12-31",
        "natureza_lancamento": "Debito",
        "observacao": "lancamento pytest"
    }, headers=headers_admin)
    data = r.json()
    yield data
    client.delete(f"/lancamento/{data['id_lancamento']}", headers=headers_admin)


@pytest.fixture
def lancamento_vencido(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": "2020-01-01",
        "natureza_lancamento": "Credito",
        "observacao": "lancamento vencido pytest"
    }, headers=headers_admin)
    data = r.json()
    yield data
    client.delete(f"/lancamento/{data['id_lancamento']}", headers=headers_admin)


def test_criar_lancamento(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": "2026-06-30",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    client.delete(f"/lancamento/{data['id_lancamento']}", headers=headers_admin)


def test_criar_lancamento_sem_token(client, usuario_base, clifor_base, tipo_lancamento_base):
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "50.00",
        "data_vencimento": "2026-01-01",
        "natureza_lancamento": "Debito"
    })
    assert r.status_code == 401


def test_listar_lancamentos(client, headers_admin):
    r = client.get("/lancamento/", headers=headers_admin)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_buscar_lancamento(client, headers_admin, lancamento):
    r = client.get(f"/lancamento/{lancamento['id_lancamento']}", headers=headers_admin)
    assert r.status_code == 200


def test_buscar_lancamento_inexistente(client, headers_admin):
    r = client.get("/lancamento/999999", headers=headers_admin)
    assert r.status_code == 404


def test_fechar_lancamento(client, headers_admin, lancamento, usuario_base):
    r = client.put(f"/lancamento/{lancamento['id_lancamento']}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "valor_pago": "250.00",
        "data_pagamento": "2026-04-21T00:00:00"
    }, headers=headers_admin)
    assert r.status_code == 200
    assert r.json()["valor_pago"] == "250.00"


def test_deletar_lancamento(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "75.00",
        "data_vencimento": "2026-09-30",
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    id_lanc = r.json()["id_lancamento"]
    r = client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)
    assert r.status_code == 200
    r = client.get(f"/lancamento/{id_lanc}", headers=headers_admin)
    assert r.status_code == 404


# ================================================
# FILTROS — ISOLADOS
# ================================================

def test_filtro_natureza_debito(client, headers_admin, lancamento):
    r = client.get("/lancamento/?natureza=Debito", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(l["natureza_lancamento"] == "Debito" for l in data)
    assert any(l["id_lancamento"] == lancamento["id_lancamento"] for l in data)


def test_filtro_natureza_credito(client, headers_admin, lancamento_vencido):
    r = client.get("/lancamento/?natureza=Credito", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(l["natureza_lancamento"] == "Credito" for l in data)


def test_filtro_apenas_abertos(client, headers_admin, lancamento):
    r = client.get("/lancamento/?apenas_abertos=true", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(l["data_pagamento"] is None for l in data)
    assert any(l["id_lancamento"] == lancamento["id_lancamento"] for l in data)


def test_filtro_apenas_abertos_exclui_fechados(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    # Cria e fecha um lançamento
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "88.00",
        "data_vencimento": "2026-06-01",
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    id_lanc = r.json()["id_lancamento"]
    client.put(f"/lancamento/{id_lanc}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "valor_pago": "88.00",
        "data_pagamento": "2026-04-30T00:00:00"
    }, headers=headers_admin)

    r = client.get("/lancamento/?apenas_abertos=true", headers=headers_admin)
    ids = [l["id_lancamento"] for l in r.json()]
    assert id_lanc not in ids

    client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


def test_filtro_apenas_vencidos(client, headers_admin, lancamento_vencido):
    r = client.get("/lancamento/?apenas_vencidos=true", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(l["data_pagamento"] is None for l in data)
    assert any(l["id_lancamento"] == lancamento_vencido["id_lancamento"] for l in data)


def test_filtro_periodo_vencimento(client, headers_admin, lancamento):
    r = client.get("/lancamento/?data_vencimento_de=2026-12-01&data_vencimento_ate=2026-12-31", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert any(l["id_lancamento"] == lancamento["id_lancamento"] for l in data)


def test_filtro_data_lancamento(client, headers_admin, lancamento):
    # Criado hoje — filtrar por hoje deve incluir
    from datetime import date
    hoje = date.today().isoformat()
    r = client.get(f"/lancamento/?data_lancamento_de={hoje}", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert any(l["id_lancamento"] == lancamento["id_lancamento"] for l in data)


def test_filtro_data_lancamento_ate_passado(client, headers_admin, lancamento):
    # Nenhum lançamento foi criado antes de 2020
    r = client.get("/lancamento/?data_lancamento_ate=2019-12-31", headers=headers_admin)
    assert r.status_code == 200
    assert r.json() == []


def test_filtro_por_clifor(client, headers_admin, lancamento, clifor_base):
    r = client.get(f"/lancamento/?id_clifor={clifor_base['id_clifor']}", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(l["id_clifor_relacionado_fk"] == clifor_base["id_clifor"] for l in data)
    assert any(l["id_lancamento"] == lancamento["id_lancamento"] for l in data)


def test_filtro_estorno_false(client, headers_admin, lancamento):
    r = client.get("/lancamento/?estorno=false", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(l["estorno"] is False for l in data)


def test_filtro_valor_minimo(client, headers_admin, lancamento):
    r = client.get("/lancamento/?valor_minimo=200.00", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(float(l["valor"]) >= 200.00 for l in data)
    assert any(l["id_lancamento"] == lancamento["id_lancamento"] for l in data)


def test_filtro_valor_maximo(client, headers_admin, lancamento_vencido):
    r = client.get("/lancamento/?valor_maximo=150.00", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(float(l["valor"]) <= 150.00 for l in data)
    assert any(l["id_lancamento"] == lancamento_vencido["id_lancamento"] for l in data)


def test_filtro_valor_faixa(client, headers_admin, lancamento, lancamento_vencido):
    # lancamento=250, lancamento_vencido=100 — faixa 90-110 pega só o vencido
    r = client.get("/lancamento/?valor_minimo=90.00&valor_maximo=110.00", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(90.00 <= float(l["valor"]) <= 110.00 for l in data)
    ids = [l["id_lancamento"] for l in data]
    assert lancamento_vencido["id_lancamento"] in ids
    assert lancamento["id_lancamento"] not in ids


# ================================================
# FILTROS — COMBINADOS
# ================================================

def test_filtro_combinado_natureza_abertos(client, headers_admin, lancamento):
    r = client.get("/lancamento/?natureza=Debito&apenas_abertos=true", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(l["natureza_lancamento"] == "Debito" and l["data_pagamento"] is None for l in data)
    assert any(l["id_lancamento"] == lancamento["id_lancamento"] for l in data)


def test_filtro_combinado_clifor_natureza(client, headers_admin, lancamento, clifor_base):
    r = client.get(f"/lancamento/?id_clifor={clifor_base['id_clifor']}&natureza=Debito", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(
        l["id_clifor_relacionado_fk"] == clifor_base["id_clifor"] and l["natureza_lancamento"] == "Debito"
        for l in data
    )


def test_filtro_combinado_valor_natureza(client, headers_admin, lancamento, lancamento_vencido):
    # Credito acima de 50 — deve pegar lancamento_vencido (100, Credito) mas não lancamento (250, Debito)
    r = client.get("/lancamento/?natureza=Credito&valor_minimo=50.00", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(l["natureza_lancamento"] == "Credito" and float(l["valor"]) >= 50.00 for l in data)
    ids = [l["id_lancamento"] for l in data]
    assert lancamento_vencido["id_lancamento"] in ids
    assert lancamento["id_lancamento"] not in ids


# ================================================
# RESUMO
# ================================================

def test_resumo_lancamentos(client, headers_admin, lancamento_vencido):
    r = client.get("/lancamento/resumo", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    campos = ["total_a_receber", "total_a_pagar", "saldo_liquido",
              "total_vencido_a_receber", "total_vencido_a_pagar",
              "quantidade_abertos", "quantidade_vencidos"]
    for campo in campos:
        assert campo in data
    assert float(data["total_a_receber"]) >= 0
    assert float(data["total_a_pagar"]) >= 0
    assert data["quantidade_vencidos"] >= 1
    assert float(data["total_vencido_a_receber"]) >= 100.00


def test_resumo_saldo_liquido_calculo(client, headers_admin, lancamento, lancamento_vencido):
    r = client.get("/lancamento/resumo", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    esperado = round(float(data["total_a_receber"]) - float(data["total_a_pagar"]), 2)
    assert round(float(data["saldo_liquido"]), 2) == esperado


def test_resumo_lancamentos_filtro_clifor(client, headers_admin, lancamento, clifor_base):
    r = client.get(f"/lancamento/resumo?id_clifor={clifor_base['id_clifor']}", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert float(data["total_a_pagar"]) >= 0


def test_resumo_sem_resultados(client, headers_admin):
    r = client.get("/lancamento/resumo?id_clifor=999999", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert float(data["total_a_receber"]) == 0
    assert float(data["total_a_pagar"]) == 0
    assert data["quantidade_abertos"] == 0


def test_resumo_sem_token(client):
    r = client.get("/lancamento/resumo")
    assert r.status_code == 401


def test_resumo_filtro_valor_minimo(client, headers_admin, lancamento, lancamento_vencido):
    # valor_minimo=200 exclui lancamento_vencido (100) do resumo
    r = client.get("/lancamento/resumo?valor_minimo=200.00", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    # total_a_receber não deve incluir o lançamento de 100
    assert float(data["total_a_receber"]) == 0  # lancamento_vencido é Credito mas < 200


# ================================================
# COMPROVANTE
# ================================================

def test_anexar_comprovante(client, headers_admin, lancamento):
    """Anexa um PDF ao lançamento e verifica resposta."""
    pdf_bytes = b"%PDF-1.4 fake pdf content for testing"
    r = client.post(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        files={"arquivo": ("comprovante.pdf", pdf_bytes, "application/pdf")},
        headers=headers_admin
    )
    assert r.status_code == 200
    assert r.json()["nome"] == "comprovante.pdf"


def test_anexar_comprovante_tipo_invalido(client, headers_admin, lancamento):
    """Arquivo não-PDF deve retornar 400."""
    r = client.post(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        files={"arquivo": ("imagem.png", b"fakepng", "image/png")},
        headers=headers_admin
    )
    assert r.status_code == 400


def test_baixar_comprovante(client, headers_admin, lancamento):
    """Após anexar, deve ser possível baixar o comprovante."""
    pdf_bytes = b"%PDF-1.4 fake pdf content for testing"
    client.post(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        files={"arquivo": ("comprovante.pdf", pdf_bytes, "application/pdf")},
        headers=headers_admin
    )
    r = client.get(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        headers=headers_admin
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content == pdf_bytes


def test_baixar_comprovante_sem_arquivo(client, headers_admin, lancamento):
    """Lançamento sem comprovante deve retornar 404."""
    r = client.get(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        headers=headers_admin
    )
    assert r.status_code == 404


def test_tem_comprovante_no_response(client, headers_admin, lancamento):
    """Campo tem_comprovante deve ser False antes e True após anexar."""
    r = client.get(f"/lancamento/{lancamento['id_lancamento']}", headers=headers_admin)
    assert r.json()["tem_comprovante"] is False

    pdf_bytes = b"%PDF-1.4 fake pdf content"
    client.post(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        files={"arquivo": ("comp.pdf", pdf_bytes, "application/pdf")},
        headers=headers_admin
    )

    r = client.get(f"/lancamento/{lancamento['id_lancamento']}", headers=headers_admin)
    assert r.json()["tem_comprovante"] is True


def test_remover_comprovante(client, headers_admin, lancamento):
    """Anexa e depois remove o comprovante — deve retornar 200 e 404 na sequência."""
    pdf_bytes = b"%PDF-1.4 fake pdf content"
    client.post(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        files={"arquivo": ("comp.pdf", pdf_bytes, "application/pdf")},
        headers=headers_admin
    )
    r = client.delete(f"/lancamento/{lancamento['id_lancamento']}/comprovante", headers=headers_admin)
    assert r.status_code == 200

    r2 = client.get(f"/lancamento/{lancamento['id_lancamento']}/comprovante", headers=headers_admin)
    assert r2.status_code == 404


def test_remover_comprovante_inexistente(client, headers_admin, lancamento):
    """Tentar remover comprovante de lançamento sem comprovante retorna 404."""
    r = client.delete(f"/lancamento/{lancamento['id_lancamento']}/comprovante", headers=headers_admin)
    assert r.status_code == 404


def test_tem_comprovante_false_apos_remocao(client, headers_admin, lancamento):
    """Após remover comprovante, tem_comprovante deve ser False."""
    pdf_bytes = b"%PDF-1.4 fake pdf content"
    client.post(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        files={"arquivo": ("comp.pdf", pdf_bytes, "application/pdf")},
        headers=headers_admin
    )
    client.delete(f"/lancamento/{lancamento['id_lancamento']}/comprovante", headers=headers_admin)

    r = client.get(f"/lancamento/{lancamento['id_lancamento']}", headers=headers_admin)
    assert r.json()["tem_comprovante"] is False

def test_filtro_apenas_quitados(client, headers_admin, lancamento, usuario_base):
    """Filtro apenas_quitados retorna só lançamentos com data_pagamento."""
    from datetime import datetime
    # Fechar o lancamento para ter um quitado
    client.put(f"/lancamento/{lancamento['id_lancamento']}/fechar", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "50.00"
    }, headers=headers_admin)

    r = client.get("/lancamento/", params={"apenas_quitados": True}, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(l["data_pagamento"] is not None for l in data)


def test_filtro_apenas_vencidos(client, headers_admin, lancamento_vencido):
    """Filtro apenas_vencidos retorna só lançamentos vencidos e não pagos."""
    r = client.get("/lancamento/", params={"apenas_vencidos": True}, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    from datetime import date
    hoje = date.today().isoformat()
    assert all(
        l["data_pagamento"] is None and l["data_vencimento"] < hoje
        for l in data
    )


def test_filtro_quitados_e_vencidos_independentes(client, headers_admin, lancamento, lancamento_vencido, usuario_base):
    """Os filtros quitados e vencidos são independentes — não se excluem."""
    from datetime import datetime
    # Fechar lancamento para ter um quitado
    client.put(f"/lancamento/{lancamento['id_lancamento']}/fechar", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "50.00"
    }, headers=headers_admin)

    r1 = client.get("/lancamento/", params={"apenas_quitados": True}, headers=headers_admin)
    r2 = client.get("/lancamento/", params={"apenas_vencidos": True}, headers=headers_admin)
    assert r1.status_code == 200
    assert r2.status_code == 200
    ids_quitados = {l["id_lancamento"] for l in r1.json()}
    ids_vencidos = {l["id_lancamento"] for l in r2.json()}
    assert ids_quitados.isdisjoint(ids_vencidos)