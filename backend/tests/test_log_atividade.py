import pytest
from database import SessionLocal
from models.token_ativo import TokenAtivo
from models.log_atividade import LogAtividade
from jose import jwt as jose_jwt
from utils.config import JWT_SECRET_KEY, JWT_ALGORITHM


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _decode_jti(token: str) -> str:
    payload = jose_jwt.decode(
        token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM],
        options={"verify_exp": False}
    )
    return payload["jti"]


def _get_token_ativo(jti: str) -> dict | None:
    db = SessionLocal()
    try:
        ta = db.query(TokenAtivo).filter(TokenAtivo.jti == jti).first()
        if not ta:
            return None
        return {"id_login_fk": ta.id_login_fk, "id_usuario_fk": ta.id_usuario_fk}
    finally:
        db.close()


def _logs_do_login(id_login: int) -> list:
    db = SessionLocal()
    try:
        rows = (
            db.query(LogAtividade)
            .filter(LogAtividade.id_login_fk == id_login)
            .order_by(LogAtividade.timestamp)
            .all()
        )
        return [
            {
                "id_log": r.id_log,
                "metodo": r.metodo,
                "endpoint": r.endpoint,
                "entidade": r.entidade,
                "id_entidade": r.id_entidade,
                "status_code": r.status_code,
            }
            for r in rows
        ]
    finally:
        db.close()


def _criar_usuario_operador_temp(client, headers_admin, email: str, senha: str = "SenhaLog@123"):
    todos = client.get("/usuarios/", headers=headers_admin).json()
    existente = next((u for u in todos if u["email"] == email), None)
    if existente:
        logins = client.get(f"/login/por-usuario/{existente['id_usuario']}", headers=headers_admin)
        if logins.is_success:
            for l in logins.json():
                client.delete(f"/login/{l['id_login']}", headers=headers_admin)
        client.delete(f"/usuarios/{existente['id_usuario']}", headers=headers_admin)

    r = client.post("/usuarios/", json={
        "nome": "Log Test Operador",
        "email": email,
        "cargo": "Associado",
        "perfil_de_acesso": "Operador",
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 200, r.text
    u = r.json()
    r2 = client.put(f"/usuarios/{u['id_usuario']}", json={"senha": senha, "primeiro_acesso": False}, headers=headers_admin)
    assert r2.status_code == 200
    return u


def _limpar_usuario(client, headers_admin, id_usuario: int):
    logins = client.get(f"/login/por-usuario/{id_usuario}", headers=headers_admin)
    if logins.is_success:
        for l in logins.json():
            client.delete(f"/login/{l['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{id_usuario}", headers=headers_admin)


# ─── Fixture isolada para estes testes ───────────────────────────────────────

@pytest.fixture
def usuario_operador_log(client, headers_admin):
    """Usuário Operador temporário isolado para testes de log de atividade."""
    email = "pytest_log_ativ@amsi.com"
    senha = "SenhaLog@123"
    u = _criar_usuario_operador_temp(client, headers_admin, email, senha)
    yield {"usuario": u, "email": email, "senha": senha}
    _limpar_usuario(client, headers_admin, u["id_usuario"])


# ─── 1. TOKEN ATIVO — id_login_fk preenchido após login ──────────────────────

def test_login_preenche_id_login_fk(client, usuario_operador_log):
    """Após login, token_ativo.id_login_fk deve estar preenchido (não null)."""
    r = client.post("/auth/token", json={
        "email": usuario_operador_log["email"],
        "senha": usuario_operador_log["senha"]
    })
    assert r.status_code == 200
    jti = _decode_jti(r.json()["access_token"])

    token_ativo = _get_token_ativo(jti)
    assert token_ativo is not None
    assert token_ativo["id_login_fk"] is not None, "id_login_fk deve ser preenchido após login"


# ─── 2. MIDDLEWARE — captura POST 2xx ────────────────────────────────────────

def test_middleware_captura_post_200(
    client, headers_admin, usuario_operador_log,
    usuario_base, clifor_base, tipo_lancamento_base
):
    """POST com 200 deve gerar exatamente 1 registro em log_atividade."""
    r_login = client.post("/auth/token", json={
        "email": usuario_operador_log["email"],
        "senha": usuario_operador_log["senha"]
    })
    assert r_login.status_code == 200
    token = r_login.json()["access_token"]
    jti = _decode_jti(token)
    ta = _get_token_ativo(jti)
    id_login = ta["id_login_fk"]
    id_usuario = ta["id_usuario_fk"]

    logs_antes = len(_logs_do_login(id_login))
    headers_op = {"Authorization": f"Bearer {token}"}

    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": id_usuario,
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "99.00",
        "data_vencimento": "2026-12-31",
        "natureza_lancamento": "Debito",
        "observacao": "teste log middleware"
    }, headers=headers_op)
    assert r.status_code == 200
    id_lanc = r.json()["id_lancamento"]

    try:
        logs = _logs_do_login(id_login)
        assert len(logs) == logs_antes + 1

        ultimo = logs[-1]
        assert ultimo["metodo"] == "POST"
        assert "lancamento" in ultimo["endpoint"]
        assert ultimo["entidade"] == "lancamento"
        assert ultimo["status_code"] == 200
    finally:
        client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


# ─── 3. MIDDLEWARE — NÃO captura GET ─────────────────────────────────────────

def test_middleware_nao_captura_get(client, usuario_operador_log):
    """GET não deve gerar nenhum registro em log_atividade."""
    r_login = client.post("/auth/token", json={
        "email": usuario_operador_log["email"],
        "senha": usuario_operador_log["senha"]
    })
    token = r_login.json()["access_token"]
    jti = _decode_jti(token)
    ta = _get_token_ativo(jti)
    id_login = ta["id_login_fk"]

    logs_antes = len(_logs_do_login(id_login))

    headers_op = {"Authorization": f"Bearer {token}"}
    r = client.get("/lancamento/", headers=headers_op)
    assert r.status_code == 200

    assert len(_logs_do_login(id_login)) == logs_antes, "GET não deve gerar registro"


# ─── 4. MIDDLEWARE — NÃO captura 403 ─────────────────────────────────────────

def test_middleware_nao_captura_403(client, usuario_operador_log):
    """Ação bloqueada (403) não deve gerar registro em log_atividade."""
    r_login = client.post("/auth/token", json={
        "email": usuario_operador_log["email"],
        "senha": usuario_operador_log["senha"]
    })
    token = r_login.json()["access_token"]
    jti = _decode_jti(token)
    ta = _get_token_ativo(jti)
    id_login = ta["id_login_fk"]

    logs_antes = len(_logs_do_login(id_login))

    # Operador tenta deletar lancamento — proibido (403)
    r = client.delete("/lancamento/999999", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403

    assert len(_logs_do_login(id_login)) == logs_antes, "403 não deve gerar registro"


# ─── 5. GET /log-atividade/por-sessao ────────────────────────────────────────

def test_log_por_sessao_retorna_acoes(
    client, headers_admin, usuario_operador_log,
    usuario_base, clifor_base, tipo_lancamento_base
):
    """Endpoint retorna lista de ações vinculadas à sessão."""
    r_login = client.post("/auth/token", json={
        "email": usuario_operador_log["email"],
        "senha": usuario_operador_log["senha"]
    })
    token = r_login.json()["access_token"]
    jti = _decode_jti(token)
    ta = _get_token_ativo(jti)
    id_login = ta["id_login_fk"]
    id_usuario = ta["id_usuario_fk"]
    headers_op = {"Authorization": f"Bearer {token}"}

    r = client.post("/lancamento/", json={
        "id_usuario_fk_lancamento": id_usuario,
        "id_clifor_relacionado_fk": clifor_base["id_clifor"],
        "id_tipo_conta_fk": tipo_lancamento_base["id_tipo_conta"],
        "valor": "77.00",
        "data_vencimento": "2026-12-31",
        "natureza_lancamento": "Credito"
    }, headers=headers_op)
    assert r.status_code == 200
    id_lanc = r.json()["id_lancamento"]

    try:
        r_log = client.get(f"/log-atividade/por-sessao/{id_login}", headers=headers_admin)
        assert r_log.status_code == 200
        logs = r_log.json()
        assert len(logs) >= 1
        assert any("/lancamento" in l["endpoint"] for l in logs)
    finally:
        client.delete(f"/lancamento/{id_lanc}", headers=headers_admin)


# ─── 6. GET /log-atividade/por-usuario ───────────────────────────────────────

def test_log_por_usuario_retorna_lista(client, headers_admin, usuario_operador_log):
    """Endpoint por-usuario retorna lista (pode estar vazia)."""
    id_u = usuario_operador_log["usuario"]["id_usuario"]
    r = client.get(f"/log-atividade/por-usuario/{id_u}", headers=headers_admin)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ─── 7. Acesso negado — Consulta e Operador ──────────────────────────────────

def test_log_por_sessao_negado_consulta(client, headers_consulta, consulta_session):
    if not consulta_session["disponivel"]:
        pytest.skip("Usuário de consulta não disponível")
    r = client.get("/log-atividade/por-sessao/1", headers=headers_consulta)
    assert r.status_code == 403


def test_log_por_sessao_negado_operador(client, headers_operador, operador_session):
    if not operador_session["disponivel"]:
        pytest.skip("Usuário de operador não disponível")
    r = client.get("/log-atividade/por-sessao/1", headers=headers_operador)
    assert r.status_code == 403


def test_log_por_usuario_negado_consulta(client, headers_consulta, consulta_session):
    if not consulta_session["disponivel"]:
        pytest.skip("Usuário de consulta não disponível")
    r = client.get("/log-atividade/por-usuario/1", headers=headers_consulta)
    assert r.status_code == 403


def test_log_por_usuario_negado_operador(client, headers_operador, operador_session):
    if not operador_session["disponivel"]:
        pytest.skip("Usuário de operador não disponível")
    r = client.get("/log-atividade/por-usuario/1", headers=headers_operador)
    assert r.status_code == 403


# ─── 8. Exportar dados — bloco "atividades" ──────────────────────────────────

def test_exportar_dados_contem_atividades(client, headers_admin, usuario_base):
    """GET /exportar-dados deve incluir chave 'atividades' com lista."""
    r = client.get(
        f"/usuarios/{usuario_base['id_usuario']}/exportar-dados",
        headers=headers_admin
    )
    assert r.status_code == 200
    data = r.json()
    assert "atividades" in data
    assert isinstance(data["atividades"], list)


def test_exportar_dados_campos_usuario(client, headers_admin, usuario_base):
    """GET /exportar-dados deve incluir dados cadastrais do usuário sem senha."""
    r = client.get(
        f"/usuarios/{usuario_base['id_usuario']}/exportar-dados",
        headers=headers_admin
    )
    assert r.status_code == 200
    data = r.json()
    assert "usuario" in data
    assert "senha" not in data["usuario"], "Senha não deve ser exposta na exportação"
    assert data["usuario"]["id_usuario"] == usuario_base["id_usuario"]


def test_exportar_dados_negado_consulta(client, headers_consulta, consulta_session, usuario_base):
    if not consulta_session["disponivel"]:
        pytest.skip("Usuário de consulta não disponível")
    r = client.get(
        f"/usuarios/{usuario_base['id_usuario']}/exportar-dados",
        headers=headers_consulta
    )
    assert r.status_code == 403


def test_exportar_dados_negado_operador(client, headers_operador, operador_session, usuario_base):
    if not operador_session["disponivel"]:
        pytest.skip("Usuário de operador não disponível")
    r = client.get(
        f"/usuarios/{usuario_base['id_usuario']}/exportar-dados",
        headers=headers_operador
    )
    assert r.status_code == 403
