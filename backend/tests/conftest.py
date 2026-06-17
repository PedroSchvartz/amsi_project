import warnings as _warnings

import pytest
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal


# ================================================
# STUB DE E-MAIL — evita chamadas reais ao Brevo
# ================================================
# Nenhum teste depende do envio real (nem do caminho 502 de falha): todos tratam
# enviar_email como caixa-preta que retorna True. Patchar aqui, no import do
# conftest (antes de qualquer fixture/teste), remove a dependência de rede — os
# timeouts de 15s do api.brevo.com deixavam a suíte lenta e intermitentemente
# vermelha. enviar_email é importado via `from ... import` em cada módulo, então
# substituímos a referência em cada um que os testes exercitam.
import routes.usuario as _routes_usuario
import auth.router as _auth_router


def _enviar_email_stub(*_args, **_kwargs):
    return True


_routes_usuario.enviar_email = _enviar_email_stub
_auth_router.enviar_email = _enviar_email_stub


TABELAS_MONITORADAS = [
    "usuario",
    "clientefornecedor",
    "lancamento",
    "endereco",
    "contato",
    "tipo_conta",
    "login",
]


def contar_tabelas(db):
    # Usuário usa soft-delete: contar apenas registros ativos para não gerar falso-alarme
    QUERIES_ESPECIAIS = {
        "usuario": "SELECT COUNT(*) FROM usuario WHERE exclusao IS NULL",
    }
    return {
        tabela: db.execute(
            __import__("sqlalchemy").text(QUERIES_ESPECIAIS.get(tabela, f"SELECT COUNT(*) FROM {tabela}"))
        ).scalar()
        for tabela in TABELAS_MONITORADAS
    }


# ================================================
# HOOK — sumário de pré-requisitos ausentes
# ================================================

def pytest_terminal_summary(terminalreporter, exitstatus, config):
    ausentes = getattr(config, "_prerequisitos_ausentes", [])
    if ausentes:
        terminalreporter.write_sep("=", "PRÉ-REQUISITOS AUSENTES (causaram skips)")
        for motivo in ausentes:
            terminalreporter.write_line(f"  • {motivo}")


# ================================================
# CLIENT
# ================================================

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


# ================================================
# AUTH ADMIN
# ================================================

@pytest.fixture(scope="session")
def token_admin(client):
    from utils.config import ADMIN_TESTE_EMAIL, ADMIN_TESTE_SENHA
    r = client.post("/auth/token", json={
        "email": ADMIN_TESTE_EMAIL,
        "senha": ADMIN_TESTE_SENHA
    })
    assert r.status_code == 200, (
        f"Falha ao autenticar admin de teste ({ADMIN_TESTE_EMAIL}): {r.text} — "
        "execute: python -X utf8 utils/bootstrap.py"
    )
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def headers_admin(token_admin):
    return {"Authorization": f"Bearer {token_admin}"}


# ================================================
# USUÁRIO DE CONSULTA — senha temporária por sessão
# ================================================

@pytest.fixture(scope="session")
def consulta_session(client, headers_admin):
    """
    Verifica se o usuário de consulta existe e pode autenticar.
    Se não existir, retorna disponivel=False com instrução para rodar o bootstrap.
    """
    from utils.config import CONSULTA_TESTE_EMAIL, CONSULTA_TESTE_SENHA

    r = client.get("/usuarios/", headers=headers_admin)
    todos = r.json() if r.is_success else []
    consulta = next((u for u in todos if u["email"] == CONSULTA_TESTE_EMAIL), None)

    if not consulta:
        yield {
            "disponivel": False,
            "motivo": (
                f"Usuário de consulta ({CONSULTA_TESTE_EMAIL}) não encontrado — "
                "execute: python -X utf8 utils/bootstrap.py"
            ),
            "id_usuario": None,
            "email": CONSULTA_TESTE_EMAIL,
            "senha_temp": None,
        }
        return

    yield {
        "disponivel": True,
        "motivo": None,
        "id_usuario": consulta["id_usuario"],
        "email": CONSULTA_TESTE_EMAIL,
        "senha_temp": CONSULTA_TESTE_SENHA,
    }


# ================================================
# PRÉ-REQUISITOS — avisa antes e registra para o sumário final
# ================================================

@pytest.fixture(scope="session")
def operador_session(client, headers_admin):
    """
    Verifica se o usuário de operador existe e pode autenticar.
    Se não existir, retorna disponivel=False com instrução para rodar o bootstrap.
    """
    from utils.config import OPERADOR_TESTE_EMAIL, OPERADOR_TESTE_SENHA

    r = client.get("/usuarios/", headers=headers_admin)
    todos = r.json() if r.is_success else []
    operador = next((u for u in todos if u["email"] == OPERADOR_TESTE_EMAIL), None)

    if not operador:
        yield {
            "disponivel": False,
            "motivo": (
                f"Usuário de operador ({OPERADOR_TESTE_EMAIL}) não encontrado — "
                "execute: python -X utf8 utils/bootstrap.py"
            ),
            "id_usuario": None,
            "email": OPERADOR_TESTE_EMAIL,
            "senha_temp": None,
        }
        return

    yield {
        "disponivel": True,
        "motivo": None,
        "id_usuario": operador["id_usuario"],
        "email": OPERADOR_TESTE_EMAIL,
        "senha_temp": OPERADOR_TESTE_SENHA,
    }


@pytest.fixture(scope="session", autouse=True)
def prerequisitos(request, consulta_session, operador_session):
    ausentes = []

    if not consulta_session["disponivel"]:
        ausentes.append(consulta_session["motivo"])
    if not operador_session["disponivel"]:
        ausentes.append(operador_session["motivo"])

    request.config._prerequisitos_ausentes = ausentes

    if ausentes:
        for motivo in ausentes:
            _warnings.warn(
                f"PRÉ-REQUISITO AUSENTE: {motivo}",
                UserWarning,
                stacklevel=2,
            )

    yield


# ================================================
# AUTH CONSULTA
# ================================================

@pytest.fixture(scope="session")
def token_consulta(client, consulta_session):
    if not consulta_session["disponivel"]:
        pytest.skip(f"Pré-requisito ausente: {consulta_session['motivo']}")
    r = client.post("/auth/token", json={
        "email": consulta_session["email"],
        "senha": consulta_session["senha_temp"],
    })
    assert r.status_code == 200, f"Falha ao autenticar usuário de consulta: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def headers_consulta(token_consulta):
    return {"Authorization": f"Bearer {token_consulta}"}


# ================================================
# AUTH OPERADOR
# ================================================

@pytest.fixture(scope="session")
def token_operador(client, operador_session):
    if not operador_session["disponivel"]:
        pytest.skip(f"Pré-requisito ausente: {operador_session['motivo']}")
    r = client.post("/auth/token", json={
        "email": operador_session["email"],
        "senha": operador_session["senha_temp"],
    })
    assert r.status_code == 200, f"Falha ao autenticar usuário de operador: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def headers_operador(token_operador):
    return {"Authorization": f"Bearer {token_operador}"}


# ================================================
# SNAPSHOT DO BANCO
# ================================================

@pytest.fixture(scope="session", autouse=True)
def db_snapshot(client, headers_admin, usuario_base, clifor_base, tipo_lancamento_base, consulta_session, operador_session):
    db = SessionLocal()
    snapshot_antes = contar_tabelas(db)
    db.close()

    from utils.config import ADMIN_TESTE_EMAIL
    ADMIN_EMAIL = ADMIN_TESTE_EMAIL
    todos_usuarios = client.get("/usuarios/", headers=headers_admin).json()

    admin = next((u for u in todos_usuarios if u["email"] == ADMIN_EMAIL), None)
    ids_logins_admin_antes = set()
    if admin:
        r = client.get(f"/login/por-usuario/{admin['id_usuario']}", headers=headers_admin)
        if r.is_success:
            ids_logins_admin_antes = {l["id_login"] for l in r.json()}

    ids_logins_consulta_antes = set()
    if consulta_session["id_usuario"]:
        r = client.get(f"/login/por-usuario/{consulta_session['id_usuario']}", headers=headers_admin)
        if r.is_success:
            ids_logins_consulta_antes = {l["id_login"] for l in r.json()}

    ids_logins_operador_antes = set()
    if operador_session["id_usuario"]:
        r = client.get(f"/login/por-usuario/{operador_session['id_usuario']}", headers=headers_admin)
        if r.is_success:
            ids_logins_operador_antes = {l["id_login"] for l in r.json()}

    yield

    # Limpar logins gerados durante os testes para admin, consulta e operador
    for id_usuario, ids_antes in [
        (admin["id_usuario"] if admin else None, ids_logins_admin_antes),
        (consulta_session["id_usuario"], ids_logins_consulta_antes),
        (operador_session["id_usuario"], ids_logins_operador_antes),
    ]:
        if id_usuario:
            r = client.get(f"/login/por-usuario/{id_usuario}", headers=headers_admin)
            if r.is_success:
                for login in r.json():
                    if login["id_login"] not in ids_antes:
                        client.delete(f"/login/{login['id_login']}", headers=headers_admin)

    db = SessionLocal()
    snapshot_depois = contar_tabelas(db)
    db.close()

    divergencias = {
        tabela: (snapshot_antes[tabela], snapshot_depois[tabela])
        for tabela in TABELAS_MONITORADAS
        if snapshot_antes[tabela] != snapshot_depois[tabela]
    }

    if divergencias:
        linhas = "\n".join(
            f"  {tabela}: antes={antes}, depois={depois} (diff={depois - antes:+d})"
            for tabela, (antes, depois) in divergencias.items()
        )
        raise AssertionError(
            f"O banco ficou sujo após os testes. Tabelas com contagem diferente:\n{linhas}"
        )


# ================================================
# DADOS BASE — criados uma vez, usados em vários testes
# ================================================

@pytest.fixture(scope="session")
def tipo_lancamento_base(client, headers_admin):
    r = client.post("/tipo_conta/", json={
        "descricao_conta": "Tipo Pytest Base",
        "natureza_conta": "Debito",
        "observacao": "criado pelo pytest"
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    yield data
    lancamentos = client.get("/lancamento/", headers=headers_admin)
    if lancamentos.is_success:
        for l in lancamentos.json():
            if l["id_tipo_conta_fk"] == data["id_tipo_conta"]:
                client.delete(f"/lancamento/{l['id_lancamento']}", headers=headers_admin)
    client.delete(f"/tipo_conta/{data['id_tipo_conta']}", headers=headers_admin)


@pytest.fixture(scope="session")
def usuario_base(client, headers_admin):
    r = client.post("/usuarios/", json={
        "nome": "Usuario Pytest Base",
        "email": "pytest_base@amsi.com",
        "cargo": "Associado",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    if r.status_code == 409:
        todos = client.get("/usuarios/", headers=headers_admin).json()
        data = next(u for u in todos if u["email"] == "pytest_base@amsi.com")
    else:
        assert r.status_code == 200
        data = r.json()
    yield data
    lancamentos = client.get(f"/lancamento/por-usuario/{data['id_usuario']}", headers=headers_admin)
    if lancamentos.is_success:
        for l in lancamentos.json():
            client.delete(f"/lancamento/{l['id_lancamento']}", headers=headers_admin)
    logins = client.get(f"/login/por-usuario/{data['id_usuario']}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{data['id_usuario']}", headers=headers_admin)


@pytest.fixture(scope="session")
def clifor_base(client, headers_admin, usuario_base):
    r = client.post("/cliente_fornecedor/", json={
        "id_usuario_fk": usuario_base["id_usuario"],
        "pessoafisica_juridica": True,
        "cpf_cnpj": "111.111.111-11",
        "rg_inscricaoestadual": "1111111",
        "nome": "CliFor Pytest Base",
        "datanascimento": "1990-01-01",
        "tipo_clifor": "A",
        "ativo": True,
        "inadimplente": False
    }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    yield data
    lancamentos = client.get("/lancamento/", headers=headers_admin)
    if lancamentos.is_success:
        for l in lancamentos.json():
            if l["id_clifor_relacionado_fk"] == data["id_clifor"]:
                client.delete(f"/lancamento/{l['id_lancamento']}", headers=headers_admin)
    client.delete(f"/cliente_fornecedor/{data['id_clifor']}", headers=headers_admin)
