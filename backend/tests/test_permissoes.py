"""
Testes de controle de acesso.

Garante que endpoints restritos a Administrador retornam 403 quando
acessados por usuário com perfil Consulta, que endpoints de operador
retornam 403 para Consulta mas 2xx para Operador, e que usuários
bloqueados, suspensos ou excluídos não conseguem autenticar.
"""
import pytest


# ================================================
# ENDPOINTS ADMIN-ONLY — acesso por perfil Consulta (403)
# ================================================

def test_criar_usuario_proibido_consulta(client, headers_consulta):
    """POST /usuarios/ por Consulta retorna 403."""
    r = client.post("/usuarios/", json={
        "nome": "Nao Deve Criar",
        "email": "nao_cria_perm@amsi.com",
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_consulta)
    assert r.status_code == 403


def test_deletar_usuario_proibido_consulta(client, headers_consulta, usuario_base):
    """DELETE /usuarios/{id} por Consulta retorna 403."""
    r = client.delete(f"/usuarios/{usuario_base['id_usuario']}", headers=headers_consulta)
    assert r.status_code == 403


def test_resetar_senha_proibido_consulta(client, headers_consulta, usuario_base):
    """POST /usuarios/{id}/resetar-senha por Consulta retorna 403."""
    r = client.post(f"/usuarios/{usuario_base['id_usuario']}/resetar-senha", headers=headers_consulta)
    assert r.status_code == 403


def test_criar_tipo_conta_proibido_consulta(client, headers_consulta):
    """POST /tipo_conta/ por Consulta retorna 403."""
    r = client.post("/tipo_conta/", json={
        "descricao_conta": "Tipo Nao Permitido",
        "natureza_conta": "Debito"
    }, headers=headers_consulta)
    assert r.status_code == 403


def test_atualizar_tipo_conta_proibido_consulta(client, headers_consulta, tipo_lancamento_base):
    """PUT /tipo_conta/{id} por Consulta retorna 403."""
    r = client.put(f"/tipo_conta/{tipo_lancamento_base['id_tipo_conta']}",
                   json={"descricao_conta": "Tentativa Consulta"},
                   headers=headers_consulta)
    assert r.status_code == 403


def test_deletar_tipo_conta_proibido_consulta(client, headers_consulta, tipo_lancamento_base):
    """DELETE /tipo_conta/{id} por Consulta retorna 403."""
    r = client.delete(f"/tipo_conta/{tipo_lancamento_base['id_tipo_conta']}", headers=headers_consulta)
    assert r.status_code == 403


def test_deletar_clifor_proibido_consulta(client, headers_consulta, clifor_base):
    """DELETE /cliente_fornecedor/{id} por Consulta retorna 403."""
    r = client.delete(f"/cliente_fornecedor/{clifor_base['id_clifor']}", headers=headers_consulta)
    assert r.status_code == 403


def test_criar_clifor_proibido_consulta(client, headers_consulta):
    """POST /cliente_fornecedor/ por Consulta retorna 403."""
    r = client.post("/cliente_fornecedor/", json={
        "pessoafisica_juridica": True,
        "cpf_cnpj": "333.333.333-33",
        "rg_inscricaoestadual": "3333333",
        "nome": "CliFor Consulta Proibido",
        "datanascimento": "1990-01-01",
        "tipo_clifor": "C",
        "ativo": True,
        "inadimplente": False
    }, headers=headers_consulta)
    assert r.status_code == 403


def test_atualizar_clifor_proibido_consulta(client, headers_consulta, clifor_base):
    """PUT /cliente_fornecedor/{id} por Consulta retorna 403."""
    r = client.put(f"/cliente_fornecedor/{clifor_base['id_clifor']}",
                   json={"nome": "Tentativa Consulta"},
                   headers=headers_consulta)
    assert r.status_code == 403


def test_criar_lancamento_proibido_consulta(client, headers_consulta, usuario_base, clifor_base, tipo_lancamento_base):
    """POST /lancamento/ por Consulta retorna 403."""
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "10.00",
        "data_vencimento": "2099-12-31",
        "natureza_lancamento": "Debito"
    }, headers=headers_consulta)
    assert r.status_code == 403


def test_fechar_lancamento_proibido_consulta(client, headers_consulta, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """PUT /lancamento/{id} por Consulta retorna 403."""
    from datetime import datetime
    r_criar = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "10.00",
        "data_vencimento": "2099-12-31",
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    assert r_criar.status_code == 200
    id_lanc = r_criar.json()["id_lancamento"]
    try:
        r = client.put(f"/lancamento/{id_lanc}", json={
            "id_usuario_fk_fechamento": usuario_base["id_usuario"],
            "data_pagamento": datetime.now().isoformat(),
            "valor_pago": "10.00"
        }, headers=headers_consulta)
        assert r.status_code == 403
    finally:
        client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


def test_listar_sessoes_proibido_consulta(client, headers_consulta):
    """GET /login/ por Consulta retorna 403."""
    r = client.get("/login/", headers=headers_consulta)
    assert r.status_code == 403


def test_registrar_sessao_proibido_consulta(client, headers_consulta, usuario_base):
    """POST /login/ por Consulta retorna 403."""
    r = client.post("/login/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "dispositivo_logado": "Teste Consulta",
        "localizacao": "127.0.0.1",
        "navegador": "pytest"
    }, headers=headers_consulta)
    assert r.status_code == 403


# ================================================
# LOGIN — USUÁRIOS COM ACESSO BLOQUEADO
# ================================================

def test_login_usuario_bloqueado(client, headers_admin, consulta_session):
    """Usuário bloqueado não consegue autenticar — retorna 403."""
    from utils.config import CONSULTA_TESTE_EMAIL, CONSULTA_TESTE_SENHA
    if not consulta_session["disponivel"]:
        pytest.skip(consulta_session["motivo"])
    id_u = consulta_session["id_usuario"]
    client.put(f"/usuarios/{id_u}", json={"bloqueado": True}, headers=headers_admin)
    try:
        r = client.post("/auth/token", json={
            "email": CONSULTA_TESTE_EMAIL,
            "senha": CONSULTA_TESTE_SENHA,
        })
        assert r.status_code == 403
    finally:
        client.put(f"/usuarios/{id_u}", json={"bloqueado": False}, headers=headers_admin)


def test_login_usuario_suspenso(client, headers_admin, consulta_session):
    """Usuário suspenso não consegue autenticar — retorna 403."""
    from utils.config import CONSULTA_TESTE_EMAIL, CONSULTA_TESTE_SENHA
    from datetime import datetime, timedelta
    if not consulta_session["disponivel"]:
        pytest.skip(consulta_session["motivo"])
    id_u = consulta_session["id_usuario"]
    suspensao = (datetime.now() + timedelta(hours=1)).isoformat()
    client.put(f"/usuarios/{id_u}", json={"suspenso": suspensao}, headers=headers_admin)
    try:
        r = client.post("/auth/token", json={
            "email": CONSULTA_TESTE_EMAIL,
            "senha": CONSULTA_TESTE_SENHA,
        })
        assert r.status_code == 403
    finally:
        client.put(f"/usuarios/{id_u}", json={"suspenso": None}, headers=headers_admin)


def test_login_usuario_excluido(client, headers_admin, consulta_session):
    """Usuário marcado como excluído não consegue autenticar — retorna 403."""
    from utils.config import CONSULTA_TESTE_EMAIL, CONSULTA_TESTE_SENHA
    from datetime import datetime
    if not consulta_session["disponivel"]:
        pytest.skip(consulta_session["motivo"])
    id_u = consulta_session["id_usuario"]
    client.put(f"/usuarios/{id_u}", json={"exclusao": datetime.now().isoformat()}, headers=headers_admin)
    try:
        r = client.post("/auth/token", json={
            "email": CONSULTA_TESTE_EMAIL,
            "senha": CONSULTA_TESTE_SENHA,
        })
        assert r.status_code == 403
    finally:
        client.put(f"/usuarios/{id_u}", json={"exclusao": None}, headers=headers_admin)


# ================================================
# PERFIL OPERADOR — pode criar/fechar lançamentos e clifors
# mas NÃO pode excluir lançamentos, criar usuários ou editar tipo de conta
# ================================================

def test_criar_usuario_proibido_operador(client, headers_operador, operador_session):
    """POST /usuarios/ por Operador retorna 403."""
    if not operador_session["disponivel"]:
        pytest.skip(operador_session["motivo"])
    r = client.post("/usuarios/", json={
        "nome": "Nao Deve Criar",
        "email": "nao_cria_op@amsi.com",
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_operador)
    assert r.status_code == 403


def test_criar_tipo_conta_proibido_operador(client, headers_operador, operador_session):
    """POST /tipo_conta/ por Operador retorna 403."""
    if not operador_session["disponivel"]:
        pytest.skip(operador_session["motivo"])
    r = client.post("/tipo_conta/", json={
        "descricao_conta": "Tipo Operador Nao Permitido",
        "natureza_conta": "Debito"
    }, headers=headers_operador)
    assert r.status_code == 403


def test_deletar_lancamento_proibido_operador(client, headers_admin, headers_operador, operador_session, clifor_base, tipo_lancamento_base):
    """DELETE /lancamento/{id} por Operador retorna 403."""
    if not operador_session["disponivel"]:
        pytest.skip(operador_session["motivo"])
    r_criar = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": operador_session["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": 10.00,
        "data_vencimento": "2099-12-31",
        "natureza_lancamento": "Debito"
    }, headers=headers_operador)
    assert r_criar.status_code == 200, f"Pré-condição: criar lançamento falhou: {r_criar.text}"
    id_lanc = r_criar.json()["id_lancamento"]
    try:
        r = client.delete(f"/lancamento/{id_lanc}", headers=headers_operador)
        assert r.status_code == 403
    finally:
        client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


def test_fechar_lancamento_permitido_operador(client, headers_operador, headers_admin, operador_session, usuario_base, clifor_base, tipo_lancamento_base):
    """PUT /lancamento/{id} por Operador retorna 200."""
    from datetime import datetime
    if not operador_session["disponivel"]:
        pytest.skip(operador_session["motivo"])
    r_criar = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": operador_session["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "15.00",
        "data_vencimento": "2099-12-31",
        "natureza_lancamento": "Debito"
    }, headers=headers_operador)
    assert r_criar.status_code == 200, f"Pré-condição: criar lançamento falhou: {r_criar.text}"
    id_lanc = r_criar.json()["id_lancamento"]
    try:
        r = client.put(f"/lancamento/{id_lanc}", json={
            "id_usuario_fk_fechamento": operador_session["id_usuario"],
            "data_pagamento": datetime.now().isoformat(),
            "valor_pago": "15.00"
        }, headers=headers_operador)
        assert r.status_code == 200
    finally:
        client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


def test_criar_lancamento_permitido_operador(client, headers_operador, operador_session, clifor_base, tipo_lancamento_base, headers_admin):
    """POST /lancamento/ por Operador retorna 200."""
    if not operador_session["disponivel"]:
        pytest.skip(operador_session["motivo"])
    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": operador_session["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": 25.00,
        "data_vencimento": "2099-12-31",
        "natureza_lancamento": "Credito"
    }, headers=headers_operador)
    assert r.status_code == 200
    client.delete(f"/lancamento/{r.json()['id_lancamento']}", headers=headers_admin)


def test_criar_clifor_permitido_operador(client, headers_operador, headers_admin, operador_session):
    """POST /cliente_fornecedor/ por Operador retorna 200."""
    if not operador_session["disponivel"]:
        pytest.skip(operador_session["motivo"])
    r = client.post("/cliente_fornecedor/", json={
        "pessoafisica_juridica": True,
        "cpf_cnpj": "222.222.222-22",
        "rg_inscricaoestadual": "2222222",
        "nome": "CliFor Operador Teste",
        "datanascimento": "1995-06-15",
        "tipo_clifor": "C",
        "ativo": True,
        "inadimplente": False
    }, headers=headers_operador)
    assert r.status_code == 200
    client.delete(f"/cliente_fornecedor/{r.json()['id_clifor']}", headers=headers_admin)


def test_deletar_clifor_proibido_operador(client, headers_operador, operador_session, clifor_base):
    """DELETE /cliente_fornecedor/{id} por Operador retorna 403."""
    if not operador_session["disponivel"]:
        pytest.skip(operador_session["motivo"])
    r = client.delete(f"/cliente_fornecedor/{clifor_base['id_clifor']}", headers=headers_operador)
    assert r.status_code == 403


# ================================================
# LANÇAMENTOS — restrição de leitura a Consulta
# ================================================

def test_listar_lancamentos_permitido_consulta(client, headers_consulta):
    """GET /lancamento/ por Consulta retorna 200 — perfil Consulta pode listar lançamentos."""
    r = client.get("/lancamento/", headers=headers_consulta)
    assert r.status_code == 200


def test_ver_lancamento_proibido_consulta(client, headers_consulta, headers_admin, usuario_base, clifor_base, tipo_lancamento_base):
    """GET /lancamento/{id} por Consulta retorna 403."""
    r_criar = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": usuario_base["id_usuario"],
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "10.00",
        "data_vencimento": "2099-12-31",
        "natureza_lancamento": "Debito"
    }, headers=headers_admin)
    assert r_criar.status_code == 200, f"Pré-condição: criar lançamento falhou: {r_criar.text}"
    id_lanc = r_criar.json()["id_lancamento"]
    try:
        r = client.get(f"/lancamento/{id_lanc}", headers=headers_consulta)
        assert r.status_code == 403
    finally:
        client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)
