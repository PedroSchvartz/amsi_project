import pytest


def test_login_sucesso(client):
    r = client.post("/auth/token", json={
        "email": "opedroschvartz@gmail.com",
        "senha": "senhaSecreta"
    })
    assert r.status_code == 200
    assert "access_token" in r.json()
    assert r.json()["token_type"] == "bearer"
    assert "primeiro_acesso" in r.json()


def test_login_senha_errada(client):
    r = client.post("/auth/token", json={
        "email": "opedroschvartz@gmail.com",
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
        "email": "opedroschvartz@gmail.com",
        "senha": "senhaSecreta"
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
        "email": "opedroschvartz@gmail.com",
        "senha": "senhaSecreta"
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

    r = client.get("/cliente_fornecedor/")
    assert r.status_code == 401