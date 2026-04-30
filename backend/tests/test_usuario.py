import pytest


def test_criar_usuario(client, headers_admin):
    r = client.post("/usuarios/", json={
        "nome": "Usuario Pytest Temp",
        "email": "pytest_temp@amsi.com",
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    # Se 409, usuário já existe de execução anterior — limpar e recriar
    if r.status_code == 409:
        todos = client.get("/usuarios/", headers=headers_admin).json()
        u = next((x for x in todos if x["email"] == "pytest_temp@amsi.com"), None)
        if u:
            logins = client.get(f"/login/por-usuario/{u['id_usuario']}", headers=headers_admin)
            if logins.is_success:
                for login in logins.json():
                    client.delete(f"/login/{login['id_login']}", headers=headers_admin)
            client.delete(f"/usuarios/{u['id_usuario']}", headers=headers_admin)
        r = client.post("/usuarios/", json={
            "nome": "Usuario Pytest Temp",
            "email": "pytest_temp@amsi.com",
            "cargo": "Associado",
            "perfil_de_acesso": "Consulta",
            "notificacao": False
        }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "pytest_temp@amsi.com"
    assert data["primeiro_acesso"] == True

    # Limpeza
    logins = client.get(f"/login/por-usuario/{data['id_usuario']}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{data['id_usuario']}", headers=headers_admin)


def test_criar_usuario_email_duplicado(client, headers_admin, usuario_base):
    r = client.post("/usuarios/", json={
        "nome": "Duplicado",
        "email": usuario_base["email"],
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 409


def test_criar_usuario_email_invalido(client, headers_admin):
    r = client.post("/usuarios/", json={
        "nome": "Email Invalido",
        "email": "teste@dominioqueprovavelmentenaoexiste12345.xyz",
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 400


def test_criar_usuario_sem_token(client):
    r = client.post("/usuarios/", json={
        "nome": "Sem Token",
        "email": "semtoken@amsi.com",
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    })
    assert r.status_code == 401


def test_listar_usuarios(client, headers_admin):
    r = client.get("/usuarios/", headers=headers_admin)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_buscar_usuario(client, headers_admin, usuario_base):
    r = client.get(f"/usuarios/{usuario_base['id_usuario']}", headers=headers_admin)
    assert r.status_code == 200
    assert r.json()["id_usuario"] == usuario_base["id_usuario"]


def test_buscar_usuario_inexistente(client, headers_admin):
    r = client.get("/usuarios/999999", headers=headers_admin)
    assert r.status_code == 404


def test_atualizar_usuario(client, headers_admin, usuario_base):
    r = client.put(f"/usuarios/{usuario_base['id_usuario']}",
                   json={"nome": "Nome Atualizado Pytest"},
                   headers=headers_admin)
    assert r.status_code == 200
    assert r.json()["nome"] == "Nome Atualizado Pytest"


def test_deletar_usuario_sem_token(client, usuario_base):
    r = client.delete(f"/usuarios/{usuario_base['id_usuario']}")
    assert r.status_code == 401


def test_resetar_senha(client, headers_admin, usuario_base):
    r = client.post(f"/usuarios/{usuario_base['id_usuario']}/resetar-senha",
                    headers=headers_admin)
    assert r.status_code == 200