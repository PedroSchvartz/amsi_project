"""Testes do fluxo de definição de senha por token de uso único.

Cobre o que estava SEM teste automatizado (lacuna registrada no item 3, ação 3 de
`docs/planos/prioridade-maxima.md`): os endpoints públicos `/auth/validar-token-senha`,
`/auth/definir-senha` e `/auth/esqueci-senha`, mais o caminho real de geração do link
no cadastro (`POST /usuarios/`).

O token cru só existe no momento da geração (em repouso é só o SHA-256), então:
  - nos casos de borda geramos o token direto pelo util `gerar_token_senha` (o mesmo
    caminho que monta o link do e-mail) e comitamos para o TestClient enxergar;
  - no teste ponta-a-ponta capturamos o link do e-mail de cadastro via monkeypatch e
    consumimos o token de verdade.

Cleanup respeita o `db_snapshot`: todo usuário criado tem seus logins removidos e é
soft-deletado (some da contagem ativa); a tabela `senha_token` não é monitorada.
"""

import re

import pytest

from database import SessionLocal
from models.usuario import Usuario
from models.senha_token import SenhaToken
from utils.senha_token import gerar_token_senha, FINALIDADE_RESET


MENSAGEM_NEUTRA = "Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha."


# ================================================
# HELPERS
# ================================================

def _gerar_token(id_usuario, finalidade=FINALIDADE_RESET, ttl_horas=48):
    """Gera um token de definição de senha pelo mesmo util usado no e-mail e comita
    (sessão separada do TestClient). Retorna o token cru. ttl_horas negativo nasce expirado."""
    db = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
        token = gerar_token_senha(db, usuario, finalidade, ttl_horas=ttl_horas)
        db.commit()
        return token
    finally:
        db.close()


def _conta_tokens_reset_ativos(id_usuario):
    """Quantos tokens de reset não usados o usuário tem (prova que o e-mail gerou um)."""
    db = SessionLocal()
    try:
        return (
            db.query(SenhaToken)
            .filter(
                SenhaToken.id_usuario_fk == id_usuario,
                SenhaToken.finalidade == FINALIDADE_RESET,
                SenhaToken.usado_em.is_(None),
            )
            .count()
        )
    finally:
        db.close()


def _limpar_usuario(client, headers_admin, id_usuario):
    """Remove os logins e faz soft-delete do usuário temporário (db_snapshot limpo)."""
    logins = client.get(f"/login/por-usuario/{id_usuario}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{id_usuario}", headers=headers_admin)


@pytest.fixture
def usuario_token(client, headers_admin):
    """Usuário dedicado (perfil Consulta) para os testes. Idempotente: limpa sobra de
    runs anteriores; no teardown remove logins + soft-delete."""
    email = "pytest_definir_senha@amsi.com"
    todos = client.get("/usuarios/", headers=headers_admin).json()
    antigo = next((u for u in todos if u["email"] == email), None)
    if antigo:
        _limpar_usuario(client, headers_admin, antigo["id_usuario"])

    r = client.post("/usuarios/", json={
        "nome": "Definir Senha Teste",
        "email": email,
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 200, f"Falha ao criar usuário: {r.text}"
    data = r.json()
    yield data
    _limpar_usuario(client, headers_admin, data["id_usuario"])


# ================================================
# /auth/validar-token-senha
# ================================================

def test_validar_token_valido_retorna_nome(client, usuario_token):
    token = _gerar_token(usuario_token["id_usuario"])
    r = client.post("/auth/validar-token-senha", json={"token": token})
    assert r.status_code == 200
    body = r.json()
    assert body["valido"] is True
    assert body["nome"] == usuario_token["nome"]


def test_validar_token_inexistente_retorna_invalido(client):
    r = client.post("/auth/validar-token-senha", json={"token": "token-que-nao-existe"})
    assert r.status_code == 200
    assert r.json() == {"valido": False, "nome": None}


def test_validar_token_expirado_retorna_invalido(client, usuario_token):
    token = _gerar_token(usuario_token["id_usuario"], ttl_horas=-1)  # já nasce expirado
    r = client.post("/auth/validar-token-senha", json={"token": token})
    assert r.status_code == 200
    assert r.json()["valido"] is False


# ================================================
# /auth/definir-senha
# ================================================

def test_definir_senha_happy_path_faz_auto_login(client, usuario_token):
    token = _gerar_token(usuario_token["id_usuario"])
    nova = "NovaSenha@123"

    r = client.post("/auth/definir-senha", json={"token": token, "senha_nova": nova})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["primeiro_acesso"] is False
    access = body["access_token"]
    assert access

    # A sessão devolvida (auto-login) é válida num endpoint protegido
    r_protegido = client.get("/lancamento/", headers={"Authorization": f"Bearer {access}"})
    assert r_protegido.status_code == 200

    # E a senha foi mesmo gravada: dá pra logar com ela
    r_login = client.post("/auth/token", json={"email": usuario_token["email"], "senha": nova})
    assert r_login.status_code == 200


def test_definir_senha_token_so_funciona_uma_vez(client, usuario_token):
    token = _gerar_token(usuario_token["id_usuario"])

    r1 = client.post("/auth/definir-senha", json={"token": token, "senha_nova": "Senha@123"})
    assert r1.status_code == 200

    # Reuso do mesmo token (uso único) → 400
    r2 = client.post("/auth/definir-senha", json={"token": token, "senha_nova": "Outra@456"})
    assert r2.status_code == 400
    assert re.search(r"inválido|expirado", r2.json()["detail"], re.IGNORECASE)


def test_definir_senha_token_invalido_retorna_400(client):
    r = client.post("/auth/definir-senha", json={"token": "lixo", "senha_nova": "Senha@123"})
    assert r.status_code == 400


def test_definir_senha_curta_nao_consome_token(client, usuario_token):
    """Senha < 6 é barrada ANTES de consumir o token — o token continua válido."""
    token = _gerar_token(usuario_token["id_usuario"])

    r = client.post("/auth/definir-senha", json={"token": token, "senha_nova": "123"})
    assert r.status_code == 400

    r_valida = client.post("/auth/validar-token-senha", json={"token": token})
    assert r_valida.json()["valido"] is True


# ================================================
# /auth/esqueci-senha  (sem enumeração de e-mail)
# ================================================

def test_esqueci_senha_email_inexistente_resposta_neutra(client):
    r = client.post("/auth/esqueci-senha", json={"email": "naoexiste@amsi.com"})
    assert r.status_code == 200
    assert r.json()["detail"] == MENSAGEM_NEUTRA


def test_esqueci_senha_email_existente_resposta_neutra_e_gera_token(client, usuario_token):
    id_u = usuario_token["id_usuario"]
    antes = _conta_tokens_reset_ativos(id_u)

    r = client.post("/auth/esqueci-senha", json={"email": usuario_token["email"]})
    assert r.status_code == 200
    # Mesma mensagem do e-mail inexistente — não revela se a conta existe
    assert r.json()["detail"] == MENSAGEM_NEUTRA
    # Mas por baixo gerou um token de reset utilizável
    assert _conta_tokens_reset_ativos(id_u) == antes + 1


# ================================================
# Ponta a ponta: cadastro → link do e-mail → define senha
# ================================================

def test_cadastro_emite_link_que_define_senha(client, headers_admin, monkeypatch):
    """Exercita o caminho real: criar usuário dispara o e-mail com o link, capturamos
    o token do FRAGMENT, validamos, definimos a senha e logamos com ela."""
    capturado = {}

    def _captura_email(destinatario, assunto, corpo):
        capturado["corpo"] = corpo
        return True

    monkeypatch.setattr("routes.usuario.enviar_email", _captura_email)

    email = "pytest_cadastro_link@amsi.com"
    todos = client.get("/usuarios/", headers=headers_admin).json()
    antigo = next((u for u in todos if u["email"] == email), None)
    if antigo:
        _limpar_usuario(client, headers_admin, antigo["id_usuario"])

    r = client.post("/usuarios/", json={
        "nome": "Cadastro Link Teste",
        "email": email,
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 200, r.text
    id_u = r.json()["id_usuario"]

    try:
        # O token chega no FRAGMENT do link (#token=...), nunca na query string
        m = re.search(r"/definir-senha#token=([A-Za-z0-9_\-]+)", capturado.get("corpo", ""))
        assert m, "Link de definição de senha não encontrado no e-mail de cadastro"
        token = m.group(1)

        r_valida = client.post("/auth/validar-token-senha", json={"token": token})
        assert r_valida.status_code == 200 and r_valida.json()["valido"] is True

        r_define = client.post("/auth/definir-senha", json={"token": token, "senha_nova": "Senha@123"})
        assert r_define.status_code == 200, r_define.text
        assert r_define.json()["access_token"]

        r_login = client.post("/auth/token", json={"email": email, "senha": "Senha@123"})
        assert r_login.status_code == 200
    finally:
        _limpar_usuario(client, headers_admin, id_u)
