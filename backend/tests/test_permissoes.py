"""
Testes de controle de acesso.

Garante que endpoints restritos a Administrador retornam 403 quando
acessados por usuário com perfil Consulta, e que usuários bloqueados,
suspensos ou excluídos não conseguem autenticar.
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
