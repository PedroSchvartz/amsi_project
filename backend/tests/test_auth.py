import pytest

from utils.config import ADMIN_TESTE_EMAIL, ADMIN_TESTE_SENHA


# ================================================
# HELPERS — usuário isolado com senha conhecida
# ================================================

def _criar_usuario_com_senha(client, headers_admin, email, senha="SenhaTest@123"):
    """Cria (ou recria) usuário via admin com senha conhecida.
    Idempotente: limpa qualquer usuário ativo com o mesmo email de runs anteriores.
    """
    todos = client.get("/usuarios/", headers=headers_admin).json()
    existente = next((u for u in todos if u["email"] == email), None)
    if existente:
        logins = client.get(f"/login/por-usuario/{existente['id_usuario']}", headers=headers_admin)
        if logins.is_success:
            for login in logins.json():
                client.delete(f"/login/{login['id_login']}", headers=headers_admin)
        client.delete(f"/usuarios/{existente['id_usuario']}", headers=headers_admin)

    r = client.post("/usuarios/", json={
        "nome": "Auth Test Temp",
        "email": email,
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 200, f"Falha ao criar usuário: {r.text}"
    u = r.json()

    # Define senha conhecida + marca primeiro_acesso=False via PUT
    r2 = client.put(f"/usuarios/{u['id_usuario']}", json={
        "senha": senha,
        "primeiro_acesso": False
    }, headers=headers_admin)
    assert r2.status_code == 200, f"Falha ao definir senha: {r2.text}"
    return u


def _limpar_usuario(client, headers_admin, id_usuario):
    """Remove logins e faz soft-delete do usuário temporário."""
    logins = client.get(f"/login/por-usuario/{id_usuario}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{id_usuario}", headers=headers_admin)


def _login(client, email, senha):
    r = client.post("/auth/token", json={"email": email, "senha": senha})
    assert r.status_code == 200, f"Login falhou: {r.text}"
    return r.json()["access_token"]


def test_login_sucesso(client, headers_admin):
    """Testa login com usuário temporário para não invalidar a sessão do admin."""
    # Criar usuário temporário
    r = client.post("/usuarios/", json={
        "nome": "Login Sucesso Teste",
        "email": "login_sucesso_teste@amsi.com",
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    if r.status_code == 409:
        todos = client.get("/usuarios/", headers=headers_admin).json()
        id_temp = next(u["id_usuario"] for u in todos if u["email"] == "login_sucesso_teste@amsi.com")
    else:
        assert r.status_code == 200
        id_temp = r.json()["id_usuario"]

    # Resetar senha e obter a provisória via email não é viável no teste —
    # usamos o admin para verificar estrutura do response
    r2 = client.post("/auth/token", json={
        "email": ADMIN_TESTE_EMAIL,
        "senha": ADMIN_TESTE_SENHA
    })
    assert r2.status_code == 200
    assert "access_token" in r2.json()
    assert r2.json()["token_type"] == "bearer"
    assert "primeiro_acesso" in r2.json()

    # Atualizar headers_admin com o novo token
    headers_admin["Authorization"] = f"Bearer {r2.json()['access_token']}"

    # Limpeza
    logins = client.get(f"/login/por-usuario/{id_temp}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{id_temp}", headers=headers_admin)


def test_login_senha_errada(client):
    r = client.post("/auth/token", json={
        "email": ADMIN_TESTE_EMAIL,
        "senha": "senhaErrada"
    })
    assert r.status_code == 401


def test_login_email_inexistente(client):
    r = client.post("/auth/token", json={
        "email": "naoexiste@amsi.com",
        "senha": "qualquer"
    })
    assert r.status_code == 401


def test_header_session_expires(client, headers_admin):
    r = client.get("/usuarios/", headers=headers_admin)
    assert r.status_code == 200
    assert "x-session-expires" in r.headers


def test_logout(client, headers_admin):
    # Criar usuário temporário para testar logout sem afetar sessão do admin
    r = client.post("/usuarios/", json={
        "nome": "Logout Teste",
        "email": "logout_teste@amsi.com",
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    if r.status_code == 409:
        todos = client.get("/usuarios/", headers=headers_admin).json()
        id_usuario_temp = next(u["id_usuario"] for u in todos if u["email"] == "logout_teste@amsi.com")
    else:
        assert r.status_code == 200
        id_usuario_temp = r.json()["id_usuario"]

    # Resetar senha para poder autenticar
    client.post(f"/usuarios/{id_usuario_temp}/resetar-senha", headers=headers_admin)

    # Não conseguimos autenticar porque não sabemos a senha provisória
    # Então testamos o logout com o próprio admin numa chamada isolada
    # e imediatamente reautenticamos
    r_login = client.post("/auth/token", json={
        "email": ADMIN_TESTE_EMAIL,
        "senha": ADMIN_TESTE_SENHA
    })
    token_temp = r_login.json()["access_token"]
    headers_temp = {"Authorization": f"Bearer {token_temp}"}

    # Isso vai invalidar a sessão atual do admin — logo abaixo reautenticamos
    r = client.post("/auth/logout", headers=headers_temp)
    assert r.status_code == 200

    # Token inválido após logout
    r = client.get("/usuarios/", headers=headers_temp)
    assert r.status_code == 401

    # Reautenticar admin para restaurar sessão
    r_re = client.post("/auth/token", json={
        "email": ADMIN_TESTE_EMAIL,
        "senha": ADMIN_TESTE_SENHA
    })
    novo_token = r_re.json()["access_token"]
    headers_admin["Authorization"] = f"Bearer {novo_token}"

    # Limpeza do usuário temporário
    logins = client.get(f"/login/por-usuario/{id_usuario_temp}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{id_usuario_temp}", headers=headers_admin)


def test_request_sem_token(client):
    r = client.get("/usuarios/")
    assert r.status_code == 401

    r = client.get("/lancamento/")
    assert r.status_code == 401


# ================================================
# TROCAR SENHA
# ================================================

def test_trocar_senha_senha_atual_errada(client, headers_admin):
    """POST /auth/trocar-senha com senha_atual errada deve retornar 401."""
    email = "pytest_trocar_errada@amsi.com"
    senha = "SenhaTest@123"
    u = _criar_usuario_com_senha(client, headers_admin, email, senha)
    id_u = u["id_usuario"]
    token = _login(client, email, senha)
    try:
        r = client.post("/auth/trocar-senha", json={
            "senha_atual": "senhaErradaQualquer",
            "senha_nova": "NovaSenha@456"
        }, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401
    finally:
        _limpar_usuario(client, headers_admin, id_u)


def test_trocar_senha_seta_primeiro_acesso_false(client, headers_admin):
    """Após trocar_senha, o flag primeiro_acesso deve ser False."""
    email = "pytest_primeiro_acesso_trocar@amsi.com"
    senha = "SenhaTest@123"
    u = _criar_usuario_com_senha(client, headers_admin, email, senha)
    id_u = u["id_usuario"]

    # Simular primeiro acesso pendente
    client.put(f"/usuarios/{id_u}", json={"primeiro_acesso": True}, headers=headers_admin)

    token = _login(client, email, senha)
    r = client.post("/auth/trocar-senha", json={
        "senha_atual": senha,
        "senha_nova": "NovaSenha@456"
    }, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200

    estado = client.get(f"/usuarios/{id_u}", headers=headers_admin).json()
    assert estado["primeiro_acesso"] is False

    # Limpeza
    _limpar_usuario(client, headers_admin, id_u)


# ================================================
# INVALIDAÇÃO DE TOKEN — garantia end-to-end
# ================================================

def test_token_invalidado_apos_resetar_senha(client, headers_admin):
    """Após admin resetar senha, o token anterior do usuário deve ser rejeitado."""
    email = "pytest_token_reset@amsi.com"
    senha = "SenhaTest@123"
    u = _criar_usuario_com_senha(client, headers_admin, email, senha)
    id_u = u["id_usuario"]

    token_antigo = _login(client, email, senha)

    # Confirmar que o token funciona antes do reset
    assert client.get("/lancamento/", headers={"Authorization": f"Bearer {token_antigo}"}).status_code == 200

    # Admin reseta a senha — deve invalidar token_ativo
    client.post(f"/usuarios/{id_u}/resetar-senha", headers=headers_admin)

    # Token antigo deve ser rejeitado
    r = client.get("/lancamento/", headers={"Authorization": f"Bearer {token_antigo}"})
    assert r.status_code == 401

    # Limpeza (Login records + soft-delete)
    logins = client.get(f"/login/por-usuario/{id_u}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    # resetar-senha não faz soft-delete — precisamos deletar explicitamente
    client.delete(f"/usuarios/{id_u}", headers=headers_admin)


def test_token_invalidado_apos_soft_delete(client, headers_admin):
    """Após soft-delete do usuário, o token dele deve ser rejeitado imediatamente."""
    email = "pytest_token_softdel@amsi.com"
    senha = "SenhaTest@123"
    u = _criar_usuario_com_senha(client, headers_admin, email, senha)
    id_u = u["id_usuario"]

    token_antigo = _login(client, email, senha)

    # Confirmar que o token funciona antes do delete
    assert client.get("/lancamento/", headers={"Authorization": f"Bearer {token_antigo}"}).status_code == 200

    # Limpar Login records antes do soft-delete (manter banco limpo)
    logins = client.get(f"/login/por-usuario/{id_u}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)

    # Admin faz soft-delete — deve invalidar token_ativo
    client.delete(f"/usuarios/{id_u}", headers=headers_admin)

    # Token antigo deve ser rejeitado
    r = client.get("/lancamento/", headers={"Authorization": f"Bearer {token_antigo}"})
    assert r.status_code == 401

    r = client.get("/cliente_fornecedor/")
    assert r.status_code == 401


