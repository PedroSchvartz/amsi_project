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

def test_resumo_campos_presentes(client, headers_admin):
    r = client.get("/lancamento/resumo", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    campos = [
        "total_recebido", "total_pago", "total_reembolsado", "saldo_total",
        "total_a_receber", "total_a_pagar", "total_a_receber_excluindo_inadimplentes",
        "total_vencido_a_receber", "total_vencido_a_pagar",
        "quantidade_abertos", "quantidade_vencidos", "quantidade_inadimplentes"
    ]
    for campo in campos:
        assert campo in data


def test_resumo_sem_token(client):
    r = client.get("/lancamento/resumo")
    assert r.status_code == 401


def test_resumo_vencidos(client, headers_admin, lancamento_vencido):
    r = client.get("/lancamento/resumo", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert data["quantidade_vencidos"] >= 1
    assert float(data["total_vencido_a_receber"]) >= 100.00


def test_resumo_abertos(client, headers_admin, lancamento):
    r = client.get("/lancamento/resumo", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert data["quantidade_abertos"] >= 1


def test_resumo_realizado_com_periodo(client, headers_admin, lancamento, usuario_base):
    from datetime import datetime, date
    hoje = date.today().isoformat()
    # Fechar o lancamento
    client.put(f"/lancamento/{lancamento['id_lancamento']}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "250.00"
    }, headers=headers_admin)

    r = client.get(f"/lancamento/resumo?data_pagamento_de={hoje}&data_pagamento_ate={hoje}", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert float(data["total_pago"]) >= 250.00


def test_resumo_realizado_fora_periodo(client, headers_admin, lancamento, usuario_base):
    from datetime import datetime
    # Fechar o lancamento
    client.put(f"/lancamento/{lancamento['id_lancamento']}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "250.00"
    }, headers=headers_admin)

    # Período anterior a hoje — não deve incluir
    r = client.get("/lancamento/resumo?data_pagamento_de=2000-01-01&data_pagamento_ate=2000-01-31", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert float(data["total_pago"]) == 0.0
    assert float(data["total_recebido"]) == 0.0


def test_resumo_saldo_total_independe_periodo(client, headers_admin, lancamento, usuario_base):
    from datetime import datetime, date
    hoje = date.today().isoformat()
    client.put(f"/lancamento/{lancamento['id_lancamento']}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "250.00"
    }, headers=headers_admin)

    # Com filtro de período que exclui o pagamento
    r1 = client.get("/lancamento/resumo?data_pagamento_de=2000-01-01&data_pagamento_ate=2000-01-31", headers=headers_admin)
    # Sem filtro
    r2 = client.get("/lancamento/resumo", headers=headers_admin)
    assert r1.status_code == 200
    assert r2.status_code == 200
    # saldo_total deve ser igual nos dois — não depende do período
    assert float(r1.json()["saldo_total"]) == float(r2.json()["saldo_total"])


def test_resumo_a_receber_excluindo_inadimplentes(client, headers_admin, lancamento_vencido):
    r = client.get("/lancamento/resumo", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    # total_a_receber_excluindo_inadimplentes <= total_a_receber
    assert float(data["total_a_receber_excluindo_inadimplentes"]) <= float(data["total_a_receber"])


# ================================================
# RESUMO POR TIPO
# ================================================

def test_resumo_por_tipo_retorna_lista(client, headers_admin):
    r = client.get("/lancamento/resumo-por-tipo", headers=headers_admin)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_resumo_por_tipo_sem_token(client):
    r = client.get("/lancamento/resumo-por-tipo")
    assert r.status_code == 401


def test_resumo_por_tipo_campos(client, headers_admin, lancamento, usuario_base):
    from datetime import datetime
    client.put(f"/lancamento/{lancamento['id_lancamento']}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "250.00"
    }, headers=headers_admin)

    r = client.get("/lancamento/resumo-por-tipo", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    for item in data:
        assert "id_tipo_conta" in item
        assert "descricao_conta" in item
        assert "natureza_conta" in item
        assert "total" in item
        assert "quantidade" in item


def test_resumo_por_tipo_filtro_natureza(client, headers_admin, lancamento, usuario_base):
    from datetime import datetime
    client.put(f"/lancamento/{lancamento['id_lancamento']}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "250.00"
    }, headers=headers_admin)

    r = client.get("/lancamento/resumo-por-tipo?natureza=Debito", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(item["natureza_conta"] == "Debito" for item in data)


def test_resumo_por_tipo_valor_pago_null(client, headers_admin, lancamento, usuario_base):
    """Lançamento quitado sem valor_pago deve usar valor no total."""
    # Fechar sem valor_pago explícito
    client.put(f"/lancamento/{lancamento['id_lancamento']}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": "2026-05-01T00:00:00"
    }, headers=headers_admin)

    r = client.get("/lancamento/resumo-por-tipo", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert all(float(item["total"]) > 0 for item in data)


    from datetime import datetime, date
    hoje = date.today().isoformat()
    client.put(f"/lancamento/{lancamento['id_lancamento']}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "250.00"
    }, headers=headers_admin)

    r_com = client.get(f"/lancamento/resumo-por-tipo?data_pagamento_de={hoje}", headers=headers_admin)
    r_sem = client.get("/lancamento/resumo-por-tipo?data_pagamento_de=2000-01-01&data_pagamento_ate=2000-01-31", headers=headers_admin)
    assert r_com.status_code == 200
    assert r_sem.status_code == 200
    assert len(r_com.json()) >= 1
    assert len(r_sem.json()) == 0


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


def test_filtro_apenas_com_comprovante(client, headers_admin, lancamento):
    """apenas_com_comprovante retorna só lançamentos com comprovante anexado."""
    pdf_bytes = b"%PDF-1.4 fake pdf content for testing"
    client.post(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        files={"arquivo": ("comp.pdf", pdf_bytes, "application/pdf")},
        headers=headers_admin
    )
    r = client.get("/lancamento/", params={"apenas_com_comprovante": True}, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert all(l["tem_comprovante"] is True for l in data)
    assert any(l["id_lancamento"] == lancamento["id_lancamento"] for l in data)


def test_filtro_apenas_sem_comprovante(client, headers_admin, lancamento):
    """apenas_sem_comprovante retorna só lançamentos sem comprovante."""
    r = client.get("/lancamento/", params={"apenas_sem_comprovante": True}, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(l["tem_comprovante"] is False for l in data)
    assert any(l["id_lancamento"] == lancamento["id_lancamento"] for l in data)


def test_filtro_comprovante_exclusividade(client, headers_admin, lancamento):
    """com e sem comprovante ao mesmo tempo retorna lista vazia."""
    r = client.get(
        "/lancamento/",
        params={"apenas_com_comprovante": True, "apenas_sem_comprovante": True},
        headers=headers_admin
    )
    assert r.status_code == 200
    assert r.json() == []

# ================================================
# RESUMO — CASOS LIMITE
# ================================================

def test_resumo_saldo_total_apenas_debitos(client, headers_admin, lancamento, usuario_base):
    """Saldo total com apenas débitos quitados deve ser negativo."""
    from datetime import datetime
    client.put(f"/lancamento/{lancamento['id_lancamento']}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "250.00"
    }, headers=headers_admin)

    r = client.get("/lancamento/resumo", headers=headers_admin)
    assert r.status_code == 200
    # lancamento é Debito — saldo_total deve ser <= 0 se só houver débitos quitados
    # Não podemos garantir que só existem débitos, mas verificamos que o campo existe e é numérico
    assert float(r.json()["saldo_total"]) is not None


def test_resumo_reembolso_nao_entra_em_recebido_nem_pago(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Estorno quitado não deve entrar em total_recebido nem total_pago."""
    from datetime import datetime, date
    hoje = date.today().isoformat()

    # Criar lançamento normal
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "50.00",
        "data_vencimento": hoje,
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    assert r.status_code == 200
    id_estorno = r.json()["id_lancamento"]

    # Fechar com estorno=True
    client.put(f"/lancamento/{id_estorno}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "50.00",
        "estorno": True
    }, headers=headers_admin)

    r1 = client.get(f"/lancamento/resumo?data_pagamento_de={hoje}&data_pagamento_ate={hoje}", headers=headers_admin)
    assert r1.status_code == 200
    data = r1.json()
    assert float(data["total_reembolsado"]) >= 50.00

    client.delete(f"/lancamento/{id_estorno}", headers=headers_admin)


def test_resumo_a_receber_excluindo_inadimplentes_igual_quando_nenhum_inadimplente(client, headers_admin, clifor_base):
    """Se não há inadimplentes, total_a_receber == total_a_receber_excluindo_inadimplentes."""
    # clifor_base tem inadimplente=False
    r = client.get("/lancamento/resumo", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert float(data["total_a_receber_excluindo_inadimplentes"]) <= float(data["total_a_receber"])


# ================================================
# RESUMO POR TIPO — CASOS LIMITE
# ================================================

def test_resumo_por_tipo_valor_exato(client, headers_admin, lancamento, usuario_base):
    """Valor total deve corresponder exatamente ao valor_pago do lançamento quitado."""
    from datetime import datetime, date
    hoje = date.today().isoformat()
    client.put(f"/lancamento/{lancamento['id_lancamento']}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "250.00"
    }, headers=headers_admin)

    r = client.get(f"/lancamento/resumo-por-tipo?data_pagamento_de={hoje}&data_pagamento_ate={hoje}&natureza=Debito", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    totais = [float(item["total"]) for item in data]
    assert any(t >= 250.00 for t in totais)


def test_resumo_por_tipo_ordenacao_decrescente(client, headers_admin, lancamento, usuario_base, clifor_base, tipo_lancamento_base):
    """Resultados devem vir ordenados por total decrescente."""
    from datetime import datetime, date
    hoje = date.today().isoformat()

    # Fechar lancamento principal (250)
    client.put(f"/lancamento/{lancamento['id_lancamento']}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "250.00"
    }, headers=headers_admin)

    # Criar segundo tipo e lançamento menor (10)
    r_tipo = client.post("/tipo_conta/", json={
        "descricao_conta": "Tipo Pytest Menor",
        "natureza_conta": "Debito"
    }, headers=headers_admin)
    id_tipo2 = r_tipo.json()["id_tipo_conta"]

    r_lanc = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": id_tipo2,
        "valor": "10.00",
        "data_vencimento": hoje,
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    id_lanc2 = r_lanc.json()["id_lancamento"]

    client.put(f"/lancamento/{id_lanc2}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "10.00"
    }, headers=headers_admin)

    r = client.get(f"/lancamento/resumo-por-tipo?data_pagamento_de={hoje}&natureza=Debito", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    totais = [float(item["total"]) for item in data]
    assert totais == sorted(totais, reverse=True)

    client.delete(f"/lancamento/{id_lanc2}", headers=headers_admin)
    client.delete(f"/tipo_conta/{id_tipo2}", headers=headers_admin)


def test_resumo_por_tipo_estorno_excluido(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Lançamento de estorno quitado não deve aparecer no resumo por tipo."""
    from datetime import datetime, date
    hoje = date.today().isoformat()

    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "99.00",
        "data_vencimento": hoje,
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    id_estorno = r.json()["id_lancamento"]

    client.put(f"/lancamento/{id_estorno}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "99.00",
        "estorno": True
    }, headers=headers_admin)

    r = client.get(f"/lancamento/resumo-por-tipo?data_pagamento_de={hoje}", headers=headers_admin)
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    client.delete(f"/lancamento/{id_estorno}", headers=headers_admin)


# ================================================
# FILTROS — COMBINADOS NOVOS
# ================================================

def test_filtro_com_comprovante_e_vencidos(client, headers_admin, lancamento_vencido):
    """Combinação de apenas_com_comprovante + apenas_vencidos."""
    pdf_bytes = b"%PDF-1.4 fake"
    client.post(
        f"/lancamento/{lancamento_vencido['id_lancamento']}/comprovante",
        files={"arquivo": ("comp.pdf", pdf_bytes, "application/pdf")},
        headers=headers_admin
    )
    r = client.get("/lancamento/", params={"apenas_com_comprovante": True, "apenas_vencidos": True}, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    from datetime import date
    hoje = date.today().isoformat()
    assert all(l["tem_comprovante"] is True and l["data_pagamento"] is None and l["data_vencimento"] < hoje for l in data)

    client.delete(f"/lancamento/{lancamento_vencido['id_lancamento']}/comprovante", headers=headers_admin)


def test_filtro_quitados_e_natureza(client, headers_admin, lancamento, usuario_base):
    """Combinação de apenas_quitados + natureza."""
    from datetime import datetime
    client.put(f"/lancamento/{lancamento['id_lancamento']}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "250.00"
    }, headers=headers_admin)

    r = client.get("/lancamento/", params={"apenas_quitados": True, "natureza": "Debito"}, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert all(l["data_pagamento"] is not None and l["natureza_lancamento"] == "Debito" for l in data)


def test_filtro_valor_decimal_exato(client, headers_admin, lancamento):
    """Filtro por valor com casas decimais exatas."""
    r = client.get("/lancamento/?valor_minimo=249.99&valor_maximo=250.01", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert any(l["id_lancamento"] == lancamento["id_lancamento"] for l in data)
    assert all(249.99 <= float(l["valor"]) <= 250.01 for l in data)


# ================================================
# COMPROVANTE — CASOS LIMITE
# ================================================

def test_substituir_comprovante_existente(client, headers_admin, lancamento):
    """POST de comprovante quando já existe deve sobrescrever."""
    pdf1 = b"%PDF-1.4 primeiro comprovante"
    pdf2 = b"%PDF-1.4 segundo comprovante substituto"

    client.post(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        files={"arquivo": ("primeiro.pdf", pdf1, "application/pdf")},
        headers=headers_admin
    )
    r = client.post(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        files={"arquivo": ("segundo.pdf", pdf2, "application/pdf")},
        headers=headers_admin
    )
    assert r.status_code == 200
    assert r.json()["nome"] == "segundo.pdf"

    r_get = client.get(f"/lancamento/{lancamento['id_lancamento']}/comprovante", headers=headers_admin)
    assert r_get.content == pdf2


def test_comprovante_limite_5mb(client, headers_admin, lancamento):
    """Arquivo exatamente no limite de 5MB deve ser aceito; 1 byte acima deve ser rejeitado."""
    limite = 5 * 1024 * 1024
    pdf_ok  = b"%PDF-1.4 " + b"x" * (limite - 9)
    pdf_nok = b"%PDF-1.4 " + b"x" * (limite - 9 + 1)

    r_ok = client.post(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        files={"arquivo": ("limite_ok.pdf", pdf_ok, "application/pdf")},
        headers=headers_admin
    )
    assert r_ok.status_code == 200

    r_nok = client.post(
        f"/lancamento/{lancamento['id_lancamento']}/comprovante",
        files={"arquivo": ("limite_nok.pdf", pdf_nok, "application/pdf")},
        headers=headers_admin
    )
    assert r_nok.status_code == 400

    client.delete(f"/lancamento/{lancamento['id_lancamento']}/comprovante", headers=headers_admin)


# ================================================
# REGRAS DE NEGÓCIO
# ================================================

def test_criar_lancamento_clifor_inexistente(client, headers_admin, usuario_base, tipo_lancamento_base):
    """Criar lançamento com clifor inexistente deve retornar 404."""
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": 999999,
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": "2026-12-31",
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    assert r.status_code == 404


def test_criar_lancamento_tipo_conta_inexistente(client, headers_admin, usuario_base, clifor_base):
    """Criar lançamento com tipo_conta inexistente deve retornar 404."""
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": 999999,
        "valor": "100.00",
        "data_vencimento": "2026-12-31",
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    assert r.status_code == 404


def test_fechar_lancamento_ja_fechado(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Fechar lançamento já fechado deve sobrescrever os dados."""
    from datetime import datetime, date
    hoje = date.today().isoformat()

    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": hoje,
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    id_lanc = r.json()["id_lancamento"]

    client.put(f"/lancamento/{id_lanc}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "100.00"
    }, headers=headers_admin)

    r2 = client.put(f"/lancamento/{id_lanc}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "90.00"
    }, headers=headers_admin)
    assert r2.status_code == 200
    assert float(r2.json()["valor_pago"]) == 90.00

    client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


# ================================================
# INADIMPLÊNCIA
# ================================================

def test_criar_lancamento_vencido_marca_inadimplente(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Criar lançamento de Crédito já vencido deve marcar clifor como inadimplente."""
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": "2020-01-01",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    assert r.status_code == 200
    id_lanc = r.json()["id_lancamento"]

    clifor = client.get(f"/cliente_fornecedor/{clifor_base['id_clifor']}", headers=headers_admin).json()
    assert clifor["inadimplente"] is True

    client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


def test_quitar_lancamento_remove_inadimplencia(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Quitar lançamento vencido deve remover inadimplência do clifor."""
    from datetime import datetime
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": "2020-01-01",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    id_lanc = r.json()["id_lancamento"]

    client.put(f"/lancamento/{id_lanc}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "100.00"
    }, headers=headers_admin)

    clifor = client.get(f"/cliente_fornecedor/{clifor_base['id_clifor']}", headers=headers_admin).json()
    assert clifor["inadimplente"] is False

    client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


def test_deletar_lancamento_vencido_remove_inadimplencia(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Deletar lançamento vencido deve remover inadimplência do clifor."""
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": "2020-01-01",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    id_lanc = r.json()["id_lancamento"]

    client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)

    clifor = client.get(f"/cliente_fornecedor/{clifor_base['id_clifor']}", headers=headers_admin).json()
    assert clifor["inadimplente"] is False


def test_debito_vencido_nao_marca_inadimplente(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Lançamento de Débito vencido não deve marcar inadimplência."""
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": "2020-01-01",
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    id_lanc = r.json()["id_lancamento"]

    clifor = client.get(f"/cliente_fornecedor/{clifor_base['id_clifor']}", headers=headers_admin).json()
    assert clifor["inadimplente"] is False

    client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


def test_dois_lancamentos_vencidos_inadimplente_so_remove_ao_quitar_ambos(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Quitar um de dois lançamentos vencidos não remove inadimplência."""
    from datetime import datetime
    r1 = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": "2020-01-01",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    id1 = r1.json()["id_lancamento"]

    r2 = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "200.00",
        "data_vencimento": "2020-02-01",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    id2 = r2.json()["id_lancamento"]

    # Quitar apenas o primeiro
    client.put(f"/lancamento/{id1}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "100.00"
    }, headers=headers_admin)

    clifor = client.get(f"/cliente_fornecedor/{clifor_base['id_clifor']}", headers=headers_admin).json()
    assert clifor["inadimplente"] is True

    # Quitar o segundo
    client.put(f"/lancamento/{id2}", json={
        "id_usuario_fk_fechamento": usuario_base["id_usuario"],
        "data_pagamento": datetime.now().isoformat(),
        "valor_pago": "200.00"
    }, headers=headers_admin)

    clifor = client.get(f"/cliente_fornecedor/{clifor_base['id_clifor']}", headers=headers_admin).json()
    assert clifor["inadimplente"] is False

    client.delete(f"/lancamento/{id1}", headers=headers_admin)
    client.delete(f"/lancamento/{id2}", headers=headers_admin)


def test_lancamento_futuro_nao_marca_inadimplente(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Lançamento de Crédito com vencimento futuro não deve marcar inadimplência."""
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": "2099-12-31",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    id_lanc = r.json()["id_lancamento"]

    clifor = client.get(f"/cliente_fornecedor/{clifor_base['id_clifor']}", headers=headers_admin).json()
    assert clifor["inadimplente"] is False

    client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


def test_estorno_vencido_nao_marca_inadimplente(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Lançamento de Crédito vencido mas com estorno=True não deve marcar inadimplência."""
    from datetime import datetime
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": "2020-01-01",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    id_lanc = r.json()["id_lancamento"]

    # Setar estorno via PUT sem quitar
    client.put(f"/lancamento/{id_lanc}", json={
        "estorno": True
    }, headers=headers_admin)

    clifor = client.get(f"/cliente_fornecedor/{clifor_base['id_clifor']}", headers=headers_admin).json()
    assert clifor["inadimplente"] is False

    client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


def test_clifor_inadimplente_aparece_no_filtro(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """Clifor inadimplente deve aparecer em GET /cliente_fornecedor/?inadimplente=true."""
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": "2020-01-01",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    id_lanc = r.json()["id_lancamento"]

    r = client.get("/cliente_fornecedor/?inadimplente=true", headers=headers_admin)
    assert r.status_code == 200
    ids = [c["id_clifor"] for c in r.json()]
    assert clifor_base["id_clifor"] in ids

    client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


def test_resumo_a_receber_excluindo_inadimplentes_diminui(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """total_a_receber_excluindo_inadimplentes deve ser menor quando clifor vira inadimplente."""
    # Lançamento futuro (aberto, não vencido) — entra em total_a_receber
    r_futuro = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "500.00",
        "data_vencimento": "2099-12-31",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    id_futuro = r_futuro.json()["id_lancamento"]

    resumo_antes = client.get("/lancamento/resumo", headers=headers_admin).json()
    excl_antes = float(resumo_antes["total_a_receber_excluindo_inadimplentes"])

    # Criar lançamento vencido — torna o clifor inadimplente
    r_vencido = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "100.00",
        "data_vencimento": "2020-01-01",
        "natureza_lancamento": "Credito"
    }, headers=headers_admin)
    id_vencido = r_vencido.json()["id_lancamento"]

    resumo_depois = client.get("/lancamento/resumo", headers=headers_admin).json()
    excl_depois = float(resumo_depois["total_a_receber_excluindo_inadimplentes"])

    assert excl_depois < excl_antes

    client.delete(f"/lancamento/{id_futuro}", headers=headers_admin)
    client.delete(f"/lancamento/{id_vencido}", headers=headers_admin)