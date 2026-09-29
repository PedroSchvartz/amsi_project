import pytest

from utils.config import ADMIN_TESTE_EMAIL
from utils.rate_limit import limiter


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
        "cargo": None,
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


def test_login_sucesso(client, headers_admin, senha_admin):
    """Testa login com usuário temporário para não invalidar a sessão do admin."""
    # Criar usuário temporário
    r = client.post("/usuarios/", json={
        "nome": "Login Sucesso Teste",
        "email": "login_sucesso_teste@amsi.com",
        "cargo": None,
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
        "senha": senha_admin
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


# ================================================
# ITEM 4 — LOGIN POR CPF OU E-MAIL (campo usuario.login)
# ================================================

def test_login_por_cpf(client, headers_admin):
    """Usuário com 'login' (CPF) autentica por ele no /auth/token."""
    email = "pytest_login_cpf@amsi.com"
    senha = "SenhaTest@123"
    cpf = "999.888.777-66"
    u = _criar_usuario_com_senha(client, headers_admin, email, senha)
    id_u = u["id_usuario"]
    try:
        r = client.put(f"/usuarios/{id_u}", json={"login": cpf}, headers=headers_admin)
        assert r.status_code == 200, r.text
        assert r.json()["login"] == cpf

        r2 = client.post("/auth/token", json={"email": cpf, "senha": senha})
        assert r2.status_code == 200, r2.text
        assert "access_token" in r2.json()
    finally:
        _limpar_usuario(client, headers_admin, id_u)


def test_login_por_email_ainda_funciona(client, headers_admin):
    """Não-regressão: mesmo com 'login' setado, o e-mail continua autenticando."""
    email = "pytest_login_email_ok@amsi.com"
    senha = "SenhaTest@123"
    u = _criar_usuario_com_senha(client, headers_admin, email, senha)
    id_u = u["id_usuario"]
    try:
        client.put(f"/usuarios/{id_u}", json={"login": "111.222.333-44"}, headers=headers_admin)
        r = client.post("/auth/token", json={"email": email, "senha": senha})
        assert r.status_code == 200, r.text
    finally:
        _limpar_usuario(client, headers_admin, id_u)


def test_login_identificador_inexistente(client):
    """Identificador (CPF) que não existe → 401, como e-mail inexistente."""
    r = client.post("/auth/token", json={"email": "000.000.000-00", "senha": "qualquer"})
    assert r.status_code == 401


def test_criar_usuario_login_duplicado(client, headers_admin):
    """Login é único: criar outro usuário com o mesmo 'login' → 409."""
    cpf = "555.444.333-22"
    a = _criar_usuario_com_senha(client, headers_admin, "pytest_login_dup_a@amsi.com", "SenhaTest@123")
    id_a = a["id_usuario"]
    try:
        assert client.put(f"/usuarios/{id_a}", json={"login": cpf}, headers=headers_admin).status_code == 200
        r = client.post("/usuarios/", json={
            "nome": "Login Dup B",
            "email": "pytest_login_dup_b@amsi.com",
            "login": cpf,
            "cargo": None,
            "perfil_de_acesso": "Consulta",
            "notificacao": False
        }, headers=headers_admin)
        assert r.status_code == 409, r.text
        # B não pode ter sido criado (o 409 acontece antes de persistir/enviar e-mail)
        todos = client.get("/usuarios/", headers=headers_admin).json()
        assert not any(x["email"] == "pytest_login_dup_b@amsi.com" for x in todos)
    finally:
        _limpar_usuario(client, headers_admin, id_a)


def test_atualizar_usuario_login_duplicado(client, headers_admin):
    """Login é único também no update: PUT com 'login' já usado por outro → 409
    (converte o IntegrityError do índice único num 409 limpo)."""
    cpf = "777.666.555-44"
    a = _criar_usuario_com_senha(client, headers_admin, "pytest_login_upd_a@amsi.com", "SenhaTest@123")
    b = _criar_usuario_com_senha(client, headers_admin, "pytest_login_upd_b@amsi.com", "SenhaTest@123")
    id_a, id_b = a["id_usuario"], b["id_usuario"]
    try:
        assert client.put(f"/usuarios/{id_a}", json={"login": cpf}, headers=headers_admin).status_code == 200
        r = client.put(f"/usuarios/{id_b}", json={"login": cpf}, headers=headers_admin)
        assert r.status_code == 409, r.text
    finally:
        _limpar_usuario(client, headers_admin, id_a)
        _limpar_usuario(client, headers_admin, id_b)


# ================================================
# CADASTRO DE E-MAIL (self-service) — usuário CPF-only sem e-mail
# ================================================

def test_cadastrar_email_sucesso(client, headers_admin):
    """Usuário sem e-mail (Email NULL) cadastra o próprio e-mail via /auth/cadastrar-email."""
    email = "pytest_cad_email@amsi.com"
    novo = "pytest_cad_email_novo@amsi.com"
    senha = "SenhaTest@123"
    u = _criar_usuario_com_senha(client, headers_admin, email, senha)
    id_u = u["id_usuario"]
    try:
        # Token ANTES de zerar o e-mail (nulificar o e-mail não invalida a sessão).
        token = _login(client, email, senha)

        # Admin zera o e-mail → valida a coluna nullable.
        r_null = client.put(f"/usuarios/{id_u}", json={"email": None}, headers=headers_admin)
        assert r_null.status_code == 200, r_null.text
        assert r_null.json()["email"] is None

        r = client.post("/auth/cadastrar-email", json={"email": novo},
                        headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == novo

        estado = client.get(f"/usuarios/{id_u}", headers=headers_admin).json()
        assert estado["email"] == novo
    finally:
        _limpar_usuario(client, headers_admin, id_u)


def test_cadastrar_email_duplicado(client, headers_admin):
    """Cadastrar um e-mail que outro usuário ativo já tem → 409."""
    email_a = "pytest_cad_dup_a@amsi.com"
    senha = "SenhaTest@123"
    a = _criar_usuario_com_senha(client, headers_admin, email_a, senha)
    b = _criar_usuario_com_senha(client, headers_admin, "pytest_cad_dup_b@amsi.com", senha)
    id_a, id_b = a["id_usuario"], b["id_usuario"]
    try:
        token_b = _login(client, "pytest_cad_dup_b@amsi.com", senha)
        r = client.post("/auth/cadastrar-email", json={"email": email_a},
                        headers={"Authorization": f"Bearer {token_b}"})
        assert r.status_code == 409, r.text
    finally:
        _limpar_usuario(client, headers_admin, id_a)
        _limpar_usuario(client, headers_admin, id_b)


def test_cadastrar_email_dominio_invalido(client, headers_admin):
    """E-mail com domínio inexistente (sem MX) → 400."""
    email = "pytest_cad_dom@amsi.com"
    senha = "SenhaTest@123"
    u = _criar_usuario_com_senha(client, headers_admin, email, senha)
    id_u = u["id_usuario"]
    try:
        token = _login(client, email, senha)
        r = client.post("/auth/cadastrar-email",
                        json={"email": "usuario@dominio-que-nao-existe-amsi.invalido"},
                        headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 400, r.text
    finally:
        _limpar_usuario(client, headers_admin, id_u)


def test_cadastrar_email_sem_token(client):
    """POST /auth/cadastrar-email sem autenticação → 401."""
    r = client.post("/auth/cadastrar-email", json={"email": "qualquer@amsi.com"})
    assert r.status_code == 401


def test_header_session_expires(client, headers_admin):
    r = client.get("/usuarios/", headers=headers_admin)
    assert r.status_code == 200
    assert "x-session-expires" in r.headers


def test_logout(client, headers_admin, senha_admin):
    # Criar usuário temporário para testar logout sem afetar sessão do admin
    r = client.post("/usuarios/", json={
        "nome": "Logout Teste",
        "email": "logout_teste@amsi.com",
        "cargo": None,
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
        "senha": senha_admin
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
        "senha": senha_admin
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


def test_trocar_senha_primeiro_acesso_dispensa_senha_atual(client, headers_admin):
    """No PRIMEIRO acesso a senha atual NÃO é reexigida (o login já autenticou). Enviar só
    senha_nova → 200; primeiro_acesso vira False e a senha nova passa a valer, a antiga não."""
    email = "pytest_primeiro_sem_atual@amsi.com"
    senha = "SenhaTest@123"
    u = _criar_usuario_com_senha(client, headers_admin, email, senha)
    id_u = u["id_usuario"]
    try:
        client.put(f"/usuarios/{id_u}", json={"primeiro_acesso": True}, headers=headers_admin)
        token = _login(client, email, senha)

        r = client.post("/auth/trocar-senha", json={
            "senha_nova": "NovaSenha@456"
        }, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text

        estado = client.get(f"/usuarios/{id_u}", headers=headers_admin).json()
        assert estado["primeiro_acesso"] is False
        assert client.post("/auth/token", json={"email": email, "senha": "NovaSenha@456"}).status_code == 200
        assert client.post("/auth/token", json={"email": email, "senha": senha}).status_code == 401
    finally:
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


# ================================================
# RATE LIMITING (hardening de auth já implementado)
# ================================================
# O limiter (utils/rate_limit.py) nasce DESLIGADO em dev/teste (enabled=False)
# para não atrapalhar o restante da suíte, que faz muitos logins em sequência a
# partir do mesmo IP. Aqui ligamos pontualmente para validar o 429 de verdade e
# desligamos de novo em um finally — mesmo que o teste falhe — para não vazar
# estado para os testes vizinhos que dependem do limiter desligado.

def test_rate_limit_login(client):
    """POST /auth/token aceita 10/minute por IP; a 11ª tentativa em diante deve
    retornar 429. Usa credenciais inválidas de propósito: como o login falha
    antes de qualquer escrita (ver auth/router.py), nenhum usuário ou registro
    de login é criado — não suja o banco nem exige limpeza no db_snapshot."""
    limiter.enabled = True
    try:
        respostas = [
            client.post("/auth/token", json={
                "email": "naoexiste_ratelimit@amsi.com",
                "senha": "qualquer"
            }).status_code
            for _ in range(15)
        ]
    finally:
        limiter.enabled = False

    assert respostas[:10] == [401] * 10, f"Esperava 401 nas 10 primeiras tentativas: {respostas}"
    assert all(codigo == 429 for codigo in respostas[10:]), (
        f"Esperava 429 a partir da 11ª tentativa: {respostas}"
    )


def test_rate_limit_esqueci_senha(client):
    """POST /auth/esqueci-senha aceita 5/minute por IP; a 6ª tentativa em diante
    deve retornar 429. Usa email inexistente: a rota responde com a mensagem
    neutra (_MENSAGEM_NEUTRA_ESQUECI) sem tocar o banco nem enviar e-mail, então
    é seguro bater várias vezes em sequência."""
    limiter.enabled = True
    try:
        respostas = [
            client.post("/auth/esqueci-senha", json={
                "email": "naoexiste_ratelimit_esqueci@amsi.com"
            }).status_code
            for _ in range(8)
        ]
    finally:
        limiter.enabled = False

    assert respostas[:5] == [200] * 5, f"Esperava 200 nas 5 primeiras tentativas: {respostas}"
    assert all(codigo == 429 for codigo in respostas[5:]), (
        f"Esperava 429 a partir da 6ª tentativa: {respostas}"
    )


