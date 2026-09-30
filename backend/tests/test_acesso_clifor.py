"""
Item 13 (R0909.13) — gerar acesso (usuário com login por documento) a partir do clifor.

Dois caminhos:
  - Botão (rota POST /usuarios/clifor/{id}): QUALQUER clifor, NÃO marca associado.
  - Script one-time (helper gerar_acesso_clifor marcar_associado=True): marca associado.

Teardown obrigatório por causa do db_snapshot autouse (conta usuario/clifor/login).
Usuário criado tem FK id_clifor_fk → precisa desvincular antes do clifor ser apagado.
"""
import pytest

from database import SessionLocal
from models.cliente_fornecedor import ClienteFornecedor
from models.usuario import Usuario
from utils.vinculo_clifor import gerar_acesso_clifor, AcessoJaExisteError
from gerar_acessos_associados import clifors_elegiveis


# ================================================
# HELPERS / FIXTURES
# ================================================

def _limpar_acesso(client, headers_admin, id_usuario):
    """Hard-delete do usuário criado no teste (cascata token/login/clifor/logs).

    HARD (e não soft) por causa do `db_snapshot` autouse: o hard-delete devolve as
    contagens de usuario/login/token ao baseline. (O índice único de `login` hoje é
    PARCIAL — `WHERE exclusao IS NULL` —, então um soft-delete já liberaria o documento;
    mas o hard mantém o snapshot limpo, que é o que o teardown precisa garantir.)"""
    client.delete(f"/usuarios/{id_usuario}/hard", headers=headers_admin)


@pytest.fixture
def clifor_cliente_pf(client, headers_admin, usuario_base):
    r = client.post("/cliente_fornecedor/", json={
        "pessoafisica_juridica": True,
        "cpf_cnpj": "529.982.247-25",
        "rg_inscricaoestadual": "9090901",
        "nome": "Acesso Cliente PF Pytest",
        "datanascimento": "1990-01-01",
        "tipo_clifor": "C",
        "ativo": True,
        "inadimplente": False,
    }, headers=headers_admin)
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    client.delete(f"/cliente_fornecedor/{data['id_clifor']}", headers=headers_admin)


@pytest.fixture
def clifor_fornecedor_pj(client, headers_admin, usuario_base):
    r = client.post("/cliente_fornecedor/", json={
        "pessoafisica_juridica": False,
        "cpf_cnpj": "12.345.678/0001-95",
        "rg_inscricaoestadual": "9090902",
        "nome": "Acesso Fornecedor PJ Pytest",
        "datanascimento": "2005-01-01",
        "tipo_clifor": "F",
        "ativo": True,
        "inadimplente": False,
    }, headers=headers_admin)
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    client.delete(f"/cliente_fornecedor/{data['id_clifor']}", headers=headers_admin)


# ================================================
# BOTÃO — rota POST /usuarios/clifor/{id}
# ================================================

def test_botao_gera_acesso_cliente_pf(client, headers_admin, clifor_cliente_pf):
    """Cliente PF → 200; login = CPF (só dígitos), sem e-mail, perfil Consulta,
    primeiro_acesso True e o 'associado' do clifor NÃO muda (só o script marca)."""
    r = client.post(f"/usuarios/clifor/{clifor_cliente_pf['id_clifor']}", headers=headers_admin)
    assert r.status_code == 200, r.text
    u = r.json()
    try:
        assert u["login"] == "52998224725"
        assert u["email"] is None
        assert u["perfil_de_acesso"] == "Consulta"
        assert u["cargo"] is None
        assert u["primeiro_acesso"] is True
        assert u["id_clifor_fk"] == clifor_cliente_pf["id_clifor"]
        assert "senha" not in u

        r_clifor = client.get(
            f"/cliente_fornecedor/{clifor_cliente_pf['id_clifor']}", headers=headers_admin
        )
        # Regressão explícita: abrir o clifor com um usuário vinculado SEM e-mail não pode
        # quebrar a serialização (UsuarioVinculadoResponse.email tem que ser Optional).
        assert r_clifor.status_code == 200, r_clifor.text
        clifor = r_clifor.json()
        assert clifor["associado"] is False  # botão não mexe na flag
        vinculado = next(v for v in clifor["usuarios"] if v["id_usuario"] == u["id_usuario"])
        assert vinculado["email"] is None
    finally:
        _limpar_acesso(client, headers_admin, u["id_usuario"])


def test_botao_gera_acesso_fornecedor_pj(client, headers_admin, clifor_fornecedor_pj):
    """Qualquer clifor pode virar usuário: fornecedor PJ também gera acesso (login = CNPJ dígitos)."""
    r = client.post(f"/usuarios/clifor/{clifor_fornecedor_pj['id_clifor']}", headers=headers_admin)
    assert r.status_code == 200, r.text
    u = r.json()
    try:
        assert u["login"] == "12345678000195"
        assert u["email"] is None
        assert u["perfil_de_acesso"] == "Consulta"
    finally:
        _limpar_acesso(client, headers_admin, u["id_usuario"])


def test_botao_login_com_e_sem_mascara(client, headers_admin, clifor_cliente_pf):
    """Login por documento tolera máscara: autentica com CPF puro E com pontuação,
    usando os 5 primeiros dígitos como senha inicial."""
    r = client.post(f"/usuarios/clifor/{clifor_cliente_pf['id_clifor']}", headers=headers_admin)
    assert r.status_code == 200, r.text
    u = r.json()
    try:
        r_puro = client.post("/auth/token", json={"email": "52998224725", "senha": "52998"})
        assert r_puro.status_code == 200, r_puro.text

        r_mask = client.post("/auth/token", json={"email": "529.982.247-25", "senha": "52998"})
        assert r_mask.status_code == 200, r_mask.text
        assert r_mask.json()["primeiro_acesso"] is True
    finally:
        _limpar_acesso(client, headers_admin, u["id_usuario"])


def test_botao_senha_errada_401(client, headers_admin, clifor_cliente_pf):
    """Regressão: senha diferente dos 5 primeiros dígitos → 401."""
    r = client.post(f"/usuarios/clifor/{clifor_cliente_pf['id_clifor']}", headers=headers_admin)
    u = r.json()
    try:
        r_err = client.post("/auth/token", json={"email": "52998224725", "senha": "00000"})
        assert r_err.status_code == 401
    finally:
        _limpar_acesso(client, headers_admin, u["id_usuario"])


def test_botao_duplicado_409(client, headers_admin, clifor_cliente_pf):
    """Gerar acesso duas vezes para o mesmo documento → 409 (índice único de login)."""
    r1 = client.post(f"/usuarios/clifor/{clifor_cliente_pf['id_clifor']}", headers=headers_admin)
    assert r1.status_code == 200, r1.text
    u = r1.json()
    try:
        r2 = client.post(f"/usuarios/clifor/{clifor_cliente_pf['id_clifor']}", headers=headers_admin)
        assert r2.status_code == 409, r2.text
    finally:
        _limpar_acesso(client, headers_admin, u["id_usuario"])


def test_botao_clifor_inexistente_404(client, headers_admin):
    r = client.post("/usuarios/clifor/99999999", headers=headers_admin)
    assert r.status_code == 404


def test_botao_sem_token_401(client, clifor_cliente_pf):
    r = client.post(f"/usuarios/clifor/{clifor_cliente_pf['id_clifor']}")
    assert r.status_code == 401


def test_botao_nao_admin_403(client, headers_consulta, clifor_cliente_pf):
    r = client.post(
        f"/usuarios/clifor/{clifor_cliente_pf['id_clifor']}", headers=headers_consulta
    )
    assert r.status_code == 403


def test_login_por_email_ainda_funciona(client, headers_admin):
    """Regressão do login: e-mail continua autenticando (o fallback de dígitos não o quebra)."""
    from utils.config import ADMIN_TESTE_EMAIL
    from utils.bootstrap import banco_e_local, SENHA_LOCAL_PADRAO
    from utils.config import ADMIN_TESTE_SENHA
    senha = SENHA_LOCAL_PADRAO if banco_e_local() else ADMIN_TESTE_SENHA
    r = client.post("/auth/token", json={"email": ADMIN_TESTE_EMAIL, "senha": senha})
    assert r.status_code == 200, r.text
    # Sessão única (_emitir_sessao purga o token anterior do usuário): este login como
    # admin INVALIDA o token que o fixture de sessão headers_admin carrega. Reaponta o
    # fixture para o token novo, senão os testes/teardowns seguintes que reusam
    # headers_admin quebram com 401 (mesmo padrão de test_auth.test_login_sucesso).
    headers_admin["Authorization"] = f"Bearer {r.json()['access_token']}"


# ================================================
# SCRIPT — helper gerar_acesso_clifor(marcar_associado=True) + seleção de elegíveis
# ================================================

def test_helper_script_marca_associado_e_e_idempotente(client, headers_admin, clifor_cliente_pf):
    """O caminho do script cria o usuário E marca clifor.associado=True; a 2ª chamada
    levanta AcessoJaExisteError (idempotência do script)."""
    db = SessionLocal()
    id_usuario = None
    id_clifor = clifor_cliente_pf["id_clifor"]
    try:
        clifor = db.query(ClienteFornecedor).filter(
            ClienteFornecedor.id_clifor == id_clifor
        ).first()
        usuario = gerar_acesso_clifor(clifor, db, marcar_associado=True)
        db.commit()
        db.refresh(usuario)
        db.refresh(clifor)
        id_usuario = usuario.id_usuario

        assert usuario.login == "52998224725"
        assert usuario.email is None
        assert clifor.associado is True

        with pytest.raises(AcessoJaExisteError):
            gerar_acesso_clifor(clifor, db, marcar_associado=True)
        db.rollback()
    finally:
        # Fecha a sessão ORM ANTES de limpar via API (libera a conexão do pool) e
        # remove o usuário via API (desvincula a FK + soft-delete). O helper não
        # autentica, então não há registro de login para limpar.
        db.close()
        if id_usuario is not None:
            _limpar_acesso(client, headers_admin, id_usuario)


def test_selecao_script_inclui_cliente_pf_exclui_ambos_forn_pj(client, headers_admin):
    """A query de elegíveis do script: inclui Cliente PF; exclui Ambos, Fornecedor e PJ."""
    def _criar(pf, tipo, cpf, nome):
        r = client.post("/cliente_fornecedor/", json={
            "pessoafisica_juridica": pf,
            "cpf_cnpj": cpf,
            # RG vazio: RG virou único quando preenchido, e estes 4 clifors coexistem.
            "rg_inscricaoestadual": "",
            "nome": nome,
            "datanascimento": "1990-01-01",
            "tipo_clifor": tipo,
            "ativo": True,
            "inadimplente": False,
        }, headers=headers_admin)
        assert r.status_code == 200, r.text
        return r.json()["id_clifor"]

    id_cliente_pf = _criar(True, "C", "111.222.333-96", "Elegivel Cliente PF")
    id_ambos_pf = _criar(True, "A", "111.222.333-97", "Nao Elegivel Ambos PF")
    id_forn_pf = _criar(True, "F", "111.222.333-98", "Nao Elegivel Fornecedor PF")
    id_cliente_pj = _criar(False, "C", "11.222.333/0001-96", "Nao Elegivel Cliente PJ")

    db = SessionLocal()
    try:
        ids = {c.id_clifor for c in clifors_elegiveis(db)}
        assert id_cliente_pf in ids
        assert id_ambos_pf not in ids
        assert id_forn_pf not in ids
        assert id_cliente_pj not in ids
    finally:
        db.close()
        for i in (id_cliente_pf, id_ambos_pf, id_forn_pf, id_cliente_pj):
            client.delete(f"/cliente_fornecedor/{i}", headers=headers_admin)
