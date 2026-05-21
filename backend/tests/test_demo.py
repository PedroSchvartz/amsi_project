"""
Testes para o módulo de modo demo (routes/demo.py).

CONDIÇÃO DE EXECUÇÃO
--------------------
Todos os testes deste arquivo são pulados automaticamente quando
APP_ENV != "demo". Isso implementa o acoplamento/desacoplamento:

  Acoplar  → APP_ENV=demo        (config.env)
  Desacoplar → APP_ENV=development

Para rodar individualmente:
    cd backend
    pytest tests/test_demo.py -v
"""

import pytest
from database import SessionLocal
from models.token_ativo import TokenAtivo
from utils.config import APP_ENV

# ────────────────────────────────────────────────────────────────────────────
# MARCA DE SKIP — aplicada a TODOS os testes deste arquivo
# ────────────────────────────────────────────────────────────────────────────

pytestmark = pytest.mark.skipif(
    APP_ENV != "demo",
    reason="Módulo demo desacoplado — testes só executam com APP_ENV=demo no config.env"
)

# ────────────────────────────────────────────────────────────────────────────
# CONSTANTES
# ────────────────────────────────────────────────────────────────────────────

_EMAIL_DEMO = "pytest_demo_registro@amsi.com"
_NOME_DEMO  = "Usuário Demo Pytest"
_SENHA_DEMO = "senhaDemo123"


# ────────────────────────────────────────────────────────────────────────────
# HELPER DE LIMPEZA
# Isola o usuário de demo do db_snapshot: apaga token_ativo (FK sem cascade),
# logins e o próprio usuário.
# ────────────────────────────────────────────────────────────────────────────

def _limpar_usuario_demo(client, headers_admin, email: str = _EMAIL_DEMO):
    """Remove completamente o usuário de demo e seus registros dependentes."""
    todos = client.get("/usuarios/", headers=headers_admin)
    if not todos.is_success:
        return
    usuario = next((u for u in todos.json() if u["email"] == email), None)
    if not usuario:
        return

    uid = usuario["id_usuario"]

    # 1. token_ativo — FK sem ON DELETE CASCADE; deve vir antes do DELETE usuário
    db = SessionLocal()
    try:
        db.query(TokenAtivo).filter(TokenAtivo.id_usuario_fk == uid).delete()
        db.commit()
    finally:
        db.close()

    # 2. login — também tem FK para usuário
    logins = client.get(f"/login/por-usuario/{uid}", headers=headers_admin)
    if logins.is_success:
        for registro in logins.json():
            client.delete(f"/login/{registro['id_login']}", headers=headers_admin)

    # 3. usuário
    client.delete(f"/usuarios/{uid}", headers=headers_admin)


# ────────────────────────────────────────────────────────────────────────────
# /demo/status
# ────────────────────────────────────────────────────────────────────────────

class TestDemoStatus:
    def test_status_retorna_demo_ativo_true(self, client):
        """GET /demo/status deve confirmar que o modo demo está ativo."""
        r = client.get("/demo/status")
        assert r.status_code == 200
        assert r.json() == {"demo_ativo": True}

    def test_status_nao_exige_autenticacao(self, client):
        """O endpoint de status é público — não pode exigir token."""
        r = client.get("/demo/status")
        # 401 ou 403 indicariam proteção indevida
        assert r.status_code not in (401, 403)


# ────────────────────────────────────────────────────────────────────────────
# /demo/registro
# ────────────────────────────────────────────────────────────────────────────

class TestDemoRegistro:
    """
    Cada teste usa a fixture autouse `_isolamento` que garante ausência do
    usuário de demo antes e depois da execução, mantendo o db_snapshot limpo.
    """

    @pytest.fixture(autouse=True)
    def _isolamento(self, client, headers_admin):
        _limpar_usuario_demo(client, headers_admin)
        yield
        _limpar_usuario_demo(client, headers_admin)

    # ── Caminho feliz ────────────────────────────────────────────────────────

    def test_registro_retorna_200_e_dados_corretos(self, client):
        """POST /demo/registro deve criar usuário e retornar os dados."""
        r = client.post("/demo/registro", json={
            "nome": _NOME_DEMO,
            "email": _EMAIL_DEMO,
            "senha": _SENHA_DEMO,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == _EMAIL_DEMO
        assert data["nome"] == _NOME_DEMO

    def test_registro_perfil_default_e_administrador(self, client):
        """Sem perfil_de_acesso informado, o default deve ser Administrador."""
        r = client.post("/demo/registro", json={
            "nome": _NOME_DEMO,
            "email": _EMAIL_DEMO,
            "senha": _SENHA_DEMO,
        })
        assert r.status_code == 200
        assert r.json()["perfil_de_acesso"] == "Administrador"

    def test_registro_salva_perfil_informado(self, client, headers_admin):
        """Os três perfis válidos devem ser persistidos corretamente."""
        for perfil in ("Administrador", "Operador", "Consulta"):
            _limpar_usuario_demo(client, headers_admin)  # garante email livre em cada volta
            r = client.post("/demo/registro", json={
                "nome": _NOME_DEMO,
                "email": _EMAIL_DEMO,
                "senha": _SENHA_DEMO,
                "perfil_de_acesso": perfil,
            })
            assert r.status_code == 200, f"Falhou para perfil '{perfil}': {r.text}"
            assert r.json()["perfil_de_acesso"] == perfil

    def test_registro_perfil_invalido_retorna_422(self, client):
        """Perfil fora do enum deve ser rejeitado pelo Pydantic (422)."""
        r = client.post("/demo/registro", json={
            "nome": _NOME_DEMO,
            "email": _EMAIL_DEMO,
            "senha": _SENHA_DEMO,
            "perfil_de_acesso": "SuperAdmin",
        })
        assert r.status_code == 422

    def test_registro_sem_obrigatoriedade_de_trocar_senha(self, client):
        """primeiro_acesso deve ser False — sem redirecionamento obrigatório."""
        r = client.post("/demo/registro", json={
            "nome": _NOME_DEMO,
            "email": _EMAIL_DEMO,
            "senha": _SENHA_DEMO,
        })
        assert r.status_code == 200
        assert r.json()["primeiro_acesso"] is False

    def test_registro_permite_login_imediato(self, client):
        """Usuário criado via demo deve conseguir autenticar na sequência."""
        client.post("/demo/registro", json={
            "nome": _NOME_DEMO,
            "email": _EMAIL_DEMO,
            "senha": _SENHA_DEMO,
        })
        r = client.post("/auth/token", json={
            "email": _EMAIL_DEMO,
            "senha": _SENHA_DEMO,
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data.get("primeiro_acesso") is False

    def test_registro_nao_exige_autenticacao(self, client):
        """O endpoint de registro é público — qualquer um pode criar conta."""
        r = client.post("/demo/registro", json={
            "nome": _NOME_DEMO,
            "email": _EMAIL_DEMO,
            "senha": _SENHA_DEMO,
        })
        assert r.status_code not in (401, 403)

    # ── Cenários de erro ─────────────────────────────────────────────────────

    def test_registro_email_duplicado_retorna_409(self, client):
        """Segundo registro com o mesmo email deve retornar 409 Conflict."""
        payload = {"nome": _NOME_DEMO, "email": _EMAIL_DEMO, "senha": _SENHA_DEMO}
        client.post("/demo/registro", json=payload)
        r = client.post("/demo/registro", json=payload)
        assert r.status_code == 409

    def test_registro_senha_curta_retorna_400(self, client):
        """Senha com menos de 6 caracteres deve retornar 400."""
        r = client.post("/demo/registro", json={
            "nome": _NOME_DEMO,
            "email": _EMAIL_DEMO,
            "senha": "abc",
        })
        assert r.status_code == 400

    def test_registro_email_invalido_retorna_422(self, client):
        """Email malformado deve ser rejeitado pelo Pydantic (422)."""
        r = client.post("/demo/registro", json={
            "nome": _NOME_DEMO,
            "email": "nao-e-um-email",
            "senha": _SENHA_DEMO,
        })
        assert r.status_code == 422

    def test_registro_campos_obrigatorios_ausentes_retornam_422(self, client):
        """Body incompleto deve retornar 422."""
        r = client.post("/demo/registro", json={"nome": _NOME_DEMO})
        assert r.status_code == 422

    def test_registro_salva_cargo_informado(self, client):
        """O cargo escolhido pelo usuário deve ser persistido."""
        r = client.post("/demo/registro", json={
            "nome": _NOME_DEMO,
            "email": _EMAIL_DEMO,
            "senha": _SENHA_DEMO,
            "cargo": "Tesoureiro",
        })
        assert r.status_code == 200
        assert r.json()["cargo"] == "Tesoureiro"

    def test_registro_cargo_default_e_associado(self, client):
        """Quando cargo não é informado, o default deve ser Associado."""
        r = client.post("/demo/registro", json={
            "nome": _NOME_DEMO,
            "email": _EMAIL_DEMO,
            "senha": _SENHA_DEMO,
        })
        assert r.status_code == 200
        assert r.json()["cargo"] == "Associado"

    def test_registro_cargo_invalido_retorna_422(self, client):
        """Cargo fora do enum deve ser rejeitado pelo Pydantic (422)."""
        r = client.post("/demo/registro", json={
            "nome": _NOME_DEMO,
            "email": _EMAIL_DEMO,
            "senha": _SENHA_DEMO,
            "cargo": "CargoInexistente",
        })
        assert r.status_code == 422


# ────────────────────────────────────────────────────────────────────────────
# VERIFICAÇÃO DE DESACOPLAMENTO
# Documenta o comportamento esperado quando APP_ENV != "demo".
# Não é possível testar o 403 diretamente sem mudar o env em runtime,
# mas o teste a seguir verifica que a guarda existe no código-fonte.
# ────────────────────────────────────────────────────────────────────────────

class TestDemoDesacoplamento:
    def test_guarda_de_modo_demo_existe_no_codigo(self):
        """
        Garante que a função _exige_demo() lança HTTPException 403
        quando APP_ENV não é 'demo'.
        Simula o desacoplamento via mock sem alterar o ambiente real.
        """
        import unittest.mock as mock
        from fastapi import HTTPException
        import routes.demo as demo_module

        # Patch direto na variável do módulo — sem reload (que desfaria o patch)
        with mock.patch.object(demo_module, "APP_ENV", "development"):
            with pytest.raises(HTTPException) as exc_info:
                demo_module._exige_demo()
            assert exc_info.value.status_code == 403
