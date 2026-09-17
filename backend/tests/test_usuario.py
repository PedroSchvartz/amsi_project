import pytest


def test_criar_usuario(client, headers_admin):
    r = client.post("/usuarios/", json={
        "nome": "Usuario Pytest Temp",
        "email": "pytest_temp@amsi.com",
        "cargo": None,
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
            "cargo": None,
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


def test_criar_usuario_cargo_null_round_trip(client, headers_admin):
    """Item 15: cargo é opcional — criar sem cargo devolve cargo=None e o GET não dá 500."""
    r = client.post("/usuarios/", json={
        "nome": "Usuario Sem Cargo",
        "email": "pytest_sem_cargo@amsi.com",
        "cargo": None,
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    if r.status_code == 409:
        todos = client.get("/usuarios/", headers=headers_admin).json()
        u = next((x for x in todos if x["email"] == "pytest_sem_cargo@amsi.com"), None)
        if u:
            logins = client.get(f"/login/por-usuario/{u['id_usuario']}", headers=headers_admin)
            if logins.is_success:
                for login in logins.json():
                    client.delete(f"/login/{login['id_login']}", headers=headers_admin)
            client.delete(f"/usuarios/{u['id_usuario']}", headers=headers_admin)
        r = client.post("/usuarios/", json={
            "nome": "Usuario Sem Cargo",
            "email": "pytest_sem_cargo@amsi.com",
            "cargo": None,
            "perfil_de_acesso": "Consulta",
            "notificacao": False
        }, headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert data["cargo"] is None

    # GET individual não deve quebrar na serialização de cargo NULL
    g = client.get(f"/usuarios/{data['id_usuario']}", headers=headers_admin)
    assert g.status_code == 200
    assert g.json()["cargo"] is None

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
        "cargo": None,
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 409


def test_criar_usuario_email_invalido(client, headers_admin):
    r = client.post("/usuarios/", json={
        "nome": "Email Invalido",
        "email": "teste@dominioqueprovavelmentenaoexiste12345.xyz",
        "cargo": None,
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 400


def test_criar_usuario_sem_token(client):
    r = client.post("/usuarios/", json={
        "nome": "Sem Token",
        "email": "semtoken@amsi.com",
        "cargo": None,
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

# ─── Clifor vinculado ao usuário ──────────────────────────────────────────────

def test_clifor_do_usuario_sem_vinculo(client, headers_admin, usuario_base):
    """Usuário sem clifor vinculado retorna 404."""
    # usuario_base tem clifor_fk — usamos um usuário limpo
    r = client.post("/usuarios/", json={
        "nome": "Usuario Sem Clifor",
        "email": "pytest_sem_clifor@amsi.com",
        "cargo": None,
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    if r.status_code == 409:
        todos = client.get("/usuarios/", headers=headers_admin).json()
        u = next(x for x in todos if x["email"] == "pytest_sem_clifor@amsi.com")
    else:
        assert r.status_code == 200
        u = r.json()

    r2 = client.get(f"/usuarios/{u['id_usuario']}/clifor", headers=headers_admin)
    assert r2.status_code == 404

    # limpeza
    logins = client.get(f"/login/por-usuario/{u['id_usuario']}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{u['id_usuario']}", headers=headers_admin)


def test_clifor_do_usuario_com_vinculo(client, headers_admin, usuario_base, clifor_base):
    """Usuário com clifor vinculado retorna o clifor correto."""
    r = client.get(f"/usuarios/{usuario_base['id_usuario']}/clifor", headers=headers_admin)
    assert r.status_code == 200
    data = r.json()
    assert data["id_clifor"] == clifor_base["id_clifor"]


def test_sugestao_clifor_retorna_lista(client, headers_admin, usuario_base):
    """Endpoint de sugestão retorna lista (pode ser vazia)."""
    r = client.get(f"/usuarios/{usuario_base['id_usuario']}/clifor/sugestao", headers=headers_admin)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_sugestao_clifor_com_nome(client, headers_admin, usuario_base):
    """Sugestão com nome explícito retorna lista."""
    r = client.get(
        f"/usuarios/{usuario_base['id_usuario']}/clifor/sugestao",
        params={"nome": "Pytest"},
        headers=headers_admin
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_associar_clifor_ao_usuario(client, headers_admin):
    """Associa um clifor livre a um usuário e verifica o vínculo."""
    # Cria usuário temporário
    u = client.post("/usuarios/", json={
        "nome": "Usuario Associar Pytest",
        "email": "pytest_associar@amsi.com",
        "cargo": None,
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert u.status_code == 200
    usuario = u.json()

    # Cria clifor sem vínculo
    c = client.post("/cliente_fornecedor/", json={
        "pessoafisica_juridica": True,
        "cpf_cnpj": "222.222.222-22",
        "rg_inscricaoestadual": "2222222",
        "nome": "CliFor Para Associar",
        "datanascimento": "1985-05-05",
        "tipo_clifor": "C",
    }, headers=headers_admin)
    assert c.status_code == 200
    clifor = c.json()

    # Associa
    r = client.post(
        f"/usuarios/{usuario['id_usuario']}/clifor/{clifor['id_clifor']}/associar",
        headers=headers_admin
    )
    assert r.status_code == 200
    assert r.json()["id_clifor"] == clifor["id_clifor"]

    # Verifica via GET
    r2 = client.get(f"/usuarios/{usuario['id_usuario']}/clifor", headers=headers_admin)
    assert r2.status_code == 200
    assert r2.json()["id_clifor"] == clifor["id_clifor"]

    # Limpeza
    client.delete(f"/cliente_fornecedor/{clifor['id_clifor']}", headers=headers_admin)
    logins = client.get(f"/login/por-usuario/{usuario['id_usuario']}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{usuario['id_usuario']}", headers=headers_admin)


def test_associar_clifor_a_dois_usuarios(client, headers_admin):
    """Relação 1‑n: o mesmo clifor pode ser vinculado a dois usuários (sem 409)."""
    # Usa clifor e usuários próprios (descartáveis) para não sujar o clifor compartilhado:
    # cada associar injeta o e-mail do usuário como contato; o delete do clifor cascateia.
    usuario1 = _vinc_criar_usuario(client, headers_admin, "pytest_1n_a@amsi.com")
    usuario2 = _vinc_criar_usuario(client, headers_admin, "pytest_1n_b@amsi.com")
    clifor = _vinc_criar_clifor(client, headers_admin, "131.313.131-31", "CliFor 1-n")

    # Ambos podem apontar para o mesmo clifor — antes o segundo dava 409.
    assert _vinc_associar(client, headers_admin, usuario1, clifor)
    assert _vinc_associar(client, headers_admin, usuario2, clifor)

    r1 = client.get(f"/usuarios/{usuario1['id_usuario']}/clifor", headers=headers_admin)
    r2 = client.get(f"/usuarios/{usuario2['id_usuario']}/clifor", headers=headers_admin)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["id_clifor"] == clifor["id_clifor"]
    assert r2.json()["id_clifor"] == clifor["id_clifor"]

    # Limpeza: remove os dois usuários e, por fim, o clifor (cascateia os contatos).
    _vinc_limpar(client, headers_admin, usuario1)
    _vinc_limpar(client, headers_admin, usuario2, clifor)

def test_desvincular_clifor_do_usuario(client, headers_admin):
    """Desvincula clifor de um usuário e verifica que voltou a 404."""
    u = client.post("/usuarios/", json={
        "nome": "Usuario Desvincular Pytest",
        "email": "pytest_desvincular@amsi.com",
        "cargo": None,
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert u.status_code == 200
    usuario = u.json()

    c = client.post("/cliente_fornecedor/", json={
        "pessoafisica_juridica": True,
        "cpf_cnpj": "333.333.333-33",
        "rg_inscricaoestadual": "3333333",
        "nome": "CliFor Para Desvincular",
        "datanascimento": "1990-03-03",
        "tipo_clifor": "C",
    }, headers=headers_admin)
    assert c.status_code == 200
    clifor = c.json()

    client.post(
        f"/usuarios/{usuario['id_usuario']}/clifor/{clifor['id_clifor']}/associar",
        headers=headers_admin
    )

    r = client.delete(f"/usuarios/{usuario['id_usuario']}/clifor/desvincular", headers=headers_admin)
    assert r.status_code == 200

    r2 = client.get(f"/usuarios/{usuario['id_usuario']}/clifor", headers=headers_admin)
    assert r2.status_code == 404

    client.delete(f"/cliente_fornecedor/{clifor['id_clifor']}", headers=headers_admin)
    logins = client.get(f"/login/por-usuario/{usuario['id_usuario']}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{usuario['id_usuario']}", headers=headers_admin)


def test_desvincular_clifor_sem_vinculo(client, headers_admin):
    """Desvincular usuário sem clifor retorna 404."""
    u = client.post("/usuarios/", json={
        "nome": "Usuario Sem Vinculo Desv",
        "email": "pytest_semvinculo_desv@amsi.com",
        "cargo": None,
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert u.status_code == 200
    usuario = u.json()

    r = client.delete(f"/usuarios/{usuario['id_usuario']}/clifor/desvincular", headers=headers_admin)
    assert r.status_code == 404

    logins = client.get(f"/login/por-usuario/{usuario['id_usuario']}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{usuario['id_usuario']}", headers=headers_admin)


# ─── Vínculo: clifor sempre carrega o e-mail do usuário ───────────────────────

def _vinc_emails(clifor_json):
    """E-mails (info_do_contato) presentes nos contatos do clifor."""
    return [c["info_do_contato"] for c in clifor_json.get("contatos", [])
            if c["tipocontato"] == "Email"]


def _vinc_criar_usuario(client, headers_admin, email):
    r = client.post("/usuarios/", json={
        "nome": f"Vinc {email}", "email": email, "cargo": None,
        "perfil_de_acesso": "Consulta", "notificacao": False,
    }, headers=headers_admin)
    assert r.status_code == 200, r.text
    return r.json()


def _vinc_criar_clifor(client, headers_admin, cpf, nome, contatos=None):
    payload = {
        "pessoafisica_juridica": True, "cpf_cnpj": cpf,
        "rg_inscricaoestadual": cpf.replace(".", "").replace("-", ""),
        "nome": nome, "datanascimento": "1990-01-01", "tipo_clifor": "C",
    }
    if contatos is not None:
        payload["contatos"] = contatos
    r = client.post("/cliente_fornecedor/", json=payload, headers=headers_admin)
    assert r.status_code == 200, r.text
    return r.json()


def _vinc_associar(client, headers_admin, usuario, clifor):
    r = client.post(
        f"/usuarios/{usuario['id_usuario']}/clifor/{clifor['id_clifor']}/associar",
        headers=headers_admin)
    assert r.status_code == 200, r.text
    return r.json()


def _vinc_limpar(client, headers_admin, usuario, clifor=None):
    # Remove o usuário antes do clifor: usuario.id_clifor_fk referencia o clifor
    # e a FK bloquearia o delete se o clifor saísse primeiro.
    logins = client.get(f"/login/por-usuario/{usuario['id_usuario']}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{usuario['id_usuario']}", headers=headers_admin)
    if clifor:
        client.delete(f"/cliente_fornecedor/{clifor['id_clifor']}", headers=headers_admin)


def test_associar_garante_email_do_usuario(client, headers_admin):
    """Associar um clifor sem e-mail adiciona o e-mail do usuário como contato."""
    usuario = _vinc_criar_usuario(client, headers_admin, "pytest_vinc_add@amsi.com")
    clifor = _vinc_criar_clifor(client, headers_admin, "444.444.444-44", "CliFor Sem Email")
    r = client.post(
        f"/usuarios/{usuario['id_usuario']}/clifor/{clifor['id_clifor']}/associar",
        headers=headers_admin)
    assert r.status_code == 200
    assert "pytest_vinc_add@amsi.com" in _vinc_emails(r.json())
    _vinc_limpar(client, headers_admin, usuario, clifor)


def test_associar_nao_duplica_email(client, headers_admin):
    """Se o clifor já tem o e-mail do usuário, associar não duplica."""
    usuario = _vinc_criar_usuario(client, headers_admin, "pytest_vinc_nodup@amsi.com")
    clifor = _vinc_criar_clifor(
        client, headers_admin, "555.555.555-55", "CliFor Com Email",
        contatos=[{"tipocontato": "Email", "info_do_contato": "pytest_vinc_nodup@amsi.com", "contato_principal": True}])
    r = client.post(
        f"/usuarios/{usuario['id_usuario']}/clifor/{clifor['id_clifor']}/associar",
        headers=headers_admin)
    assert r.status_code == 200
    assert _vinc_emails(r.json()).count("pytest_vinc_nodup@amsi.com") == 1
    _vinc_limpar(client, headers_admin, usuario, clifor)


def test_associar_preserva_email_diferente(client, headers_admin):
    """Clifor com e-mail diferente: associar adiciona o do usuário e mantém o outro."""
    usuario = _vinc_criar_usuario(client, headers_admin, "pytest_vinc_user@amsi.com")
    clifor = _vinc_criar_clifor(
        client, headers_admin, "666.666.666-66", "CliFor Outro Email",
        contatos=[{"tipocontato": "Email", "info_do_contato": "outro@exemplo.com", "contato_principal": True}])
    r = client.post(
        f"/usuarios/{usuario['id_usuario']}/clifor/{clifor['id_clifor']}/associar",
        headers=headers_admin)
    assert r.status_code == 200
    emails = _vinc_emails(r.json())
    assert "outro@exemplo.com" in emails
    assert "pytest_vinc_user@amsi.com" in emails
    _vinc_limpar(client, headers_admin, usuario, clifor)


def test_trocar_email_usuario_sincroniza_clifor(client, headers_admin):
    """Trocar o e-mail do usuário atualiza o contato de e-mail no clifor vinculado."""
    usuario = _vinc_criar_usuario(client, headers_admin, "pytest_vinc_sync@amsi.com")
    clifor = _vinc_criar_clifor(client, headers_admin, "888.888.888-88", "CliFor Sync Email")
    vinculado = _vinc_associar(client, headers_admin, usuario, clifor)
    assert "pytest_vinc_sync@amsi.com" in _vinc_emails(vinculado)

    r = client.put(f"/usuarios/{usuario['id_usuario']}",
                   json={"email": "pytest_vinc_sync_novo@amsi.com"}, headers=headers_admin)
    assert r.status_code == 200, r.text

    r2 = client.get(f"/cliente_fornecedor/{clifor['id_clifor']}", headers=headers_admin)
    emails = _vinc_emails(r2.json())
    assert "pytest_vinc_sync_novo@amsi.com" in emails
    assert "pytest_vinc_sync@amsi.com" not in emails
    _vinc_limpar(client, headers_admin, usuario, clifor)


def test_associar_email_case_insensitive(client, headers_admin):
    """Match de e-mail ignora caixa: não duplica se diferir só em maiúsculas/minúsculas."""
    usuario = _vinc_criar_usuario(client, headers_admin, "pytest_vinc_case@amsi.com")
    clifor = _vinc_criar_clifor(
        client, headers_admin, "999.999.999-99", "CliFor Email Maiusculo",
        contatos=[{"tipocontato": "Email", "info_do_contato": "PYTEST_VINC_CASE@AMSI.COM", "contato_principal": True}])
    r = client.post(
        f"/usuarios/{usuario['id_usuario']}/clifor/{clifor['id_clifor']}/associar",
        headers=headers_admin)
    assert r.status_code == 200
    emails = _vinc_emails(r.json())
    assert len(emails) == 1, "não deve duplicar e-mail que difere só na caixa"
    assert emails[0] == "PYTEST_VINC_CASE@AMSI.COM"  # preserva o original
    _vinc_limpar(client, headers_admin, usuario, clifor)


def test_trocar_email_usuario_sem_clifor_nao_quebra(client, headers_admin):
    """Trocar o e-mail de um usuário sem clifor vinculado não deve dar erro (sync sai cedo)."""
    usuario = _vinc_criar_usuario(client, headers_admin, "pytest_vinc_noclifor@amsi.com")
    r = client.put(f"/usuarios/{usuario['id_usuario']}",
                   json={"email": "pytest_vinc_noclifor_novo@amsi.com"}, headers=headers_admin)
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "pytest_vinc_noclifor_novo@amsi.com"
    _vinc_limpar(client, headers_admin, usuario)


def test_sugestao_exclui_clifor_ja_vinculado(client, headers_admin):
    """Sugestão não deve trazer o clifor que o próprio usuário já tem vinculado."""
    usuario = _vinc_criar_usuario(client, headers_admin, "pytest_sug_excl@amsi.com")
    clifor = _vinc_criar_clifor(client, headers_admin, "141.414.141-41", "CliFor Sugestao Excluir")
    _vinc_associar(client, headers_admin, usuario, clifor)

    r = client.get(
        f"/usuarios/{usuario['id_usuario']}/clifor/sugestao",
        params={"nome": "CliFor Sugestao Excluir"},
        headers=headers_admin)
    assert r.status_code == 200
    ids = [c["id_clifor"] for c in r.json()]
    assert clifor["id_clifor"] not in ids, "o clifor já vinculado ao usuário não deve ser sugerido"

    _vinc_limpar(client, headers_admin, usuario, clifor)


def test_desvincular_nao_afeta_outro_usuario_do_mesmo_clifor(client, headers_admin):
    """1‑n: desvincular um usuário não remove o vínculo de outro que compartilha o clifor."""
    usuario1 = _vinc_criar_usuario(client, headers_admin, "pytest_desv_iso_a@amsi.com")
    usuario2 = _vinc_criar_usuario(client, headers_admin, "pytest_desv_iso_b@amsi.com")
    clifor = _vinc_criar_clifor(client, headers_admin, "151.515.151-51", "CliFor Desvincular Isolado")
    _vinc_associar(client, headers_admin, usuario1, clifor)
    _vinc_associar(client, headers_admin, usuario2, clifor)

    # Desvincula só o usuario1.
    r = client.delete(f"/usuarios/{usuario1['id_usuario']}/clifor/desvincular", headers=headers_admin)
    assert r.status_code == 200

    # usuario1 sem vínculo (404); usuario2 permanece vinculado.
    assert client.get(f"/usuarios/{usuario1['id_usuario']}/clifor", headers=headers_admin).status_code == 404
    r2 = client.get(f"/usuarios/{usuario2['id_usuario']}/clifor", headers=headers_admin)
    assert r2.status_code == 200
    assert r2.json()["id_clifor"] == clifor["id_clifor"]

    _vinc_limpar(client, headers_admin, usuario1)
    _vinc_limpar(client, headers_admin, usuario2, clifor)


def test_clifor_expoe_usuarios_vinculados(client, headers_admin):
    """O GET do clifor devolve os usuários ligados a ele (lado N do 1‑n),
    sem nunca expor 'senha' e excluindo usuários soft‑deletados."""
    usuario1 = _vinc_criar_usuario(client, headers_admin, "pytest_expo_a@amsi.com")
    usuario2 = _vinc_criar_usuario(client, headers_admin, "pytest_expo_b@amsi.com")
    clifor = _vinc_criar_clifor(client, headers_admin, "161.616.161-61", "CliFor Expoe Usuarios")
    _vinc_associar(client, headers_admin, usuario1, clifor)
    _vinc_associar(client, headers_admin, usuario2, clifor)

    r = client.get(f"/cliente_fornecedor/{clifor['id_clifor']}", headers=headers_admin)
    assert r.status_code == 200
    usuarios = r.json()["usuarios"]
    ids = {u["id_usuario"] for u in usuarios}
    assert ids == {usuario1["id_usuario"], usuario2["id_usuario"]}
    # Contrato seguro: só o subconjunto público, nunca a senha.
    assert all("senha" not in u for u in usuarios)
    assert {u["email"] for u in usuarios} == {"pytest_expo_a@amsi.com", "pytest_expo_b@amsi.com"}

    # Soft‑delete de um usuário: ele some da lista exposta (exclusao não zera id_clifor_fk).
    assert client.delete(f"/usuarios/{usuario1['id_usuario']}", headers=headers_admin).status_code == 200
    r2 = client.get(f"/cliente_fornecedor/{clifor['id_clifor']}", headers=headers_admin)
    assert r2.status_code == 200
    ids2 = {u["id_usuario"] for u in r2.json()["usuarios"]}
    assert ids2 == {usuario2["id_usuario"]}

    _vinc_limpar(client, headers_admin, usuario1)
    _vinc_limpar(client, headers_admin, usuario2, clifor)


def test_criar_usuario_cargo_desenvolvedor(client, headers_admin):
    """Cargo Desenvolvedor deve ser aceito como válido."""
    r = client.post("/usuarios/", json={
        "nome": "Dev Pytest",
        "email": "pytest_dev@amsi.com",
        "cargo": "Desenvolvedor",
        "perfil_de_acesso": "Administrador",
        "notificacao": False
    }, headers=headers_admin)
    if r.status_code == 409:
        todos = client.get("/usuarios/", headers=headers_admin).json()
        u = next(x for x in todos if x["email"] == "pytest_dev@amsi.com")
    else:
        assert r.status_code == 200
        u = r.json()
        assert u["cargo"] == "Desenvolvedor"

    logins = client.get(f"/login/por-usuario/{u['id_usuario']}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{u['id_usuario']}", headers=headers_admin)


def test_criar_usuario_cargo_invalido(client, headers_admin):
    """Cargo inválido deve retornar 422."""
    r = client.post("/usuarios/", json={
        "nome": "Cargo Invalido Pytest",
        "email": "pytest_cargo_invalido@amsi.com",
        "cargo": "CargoQueNaoExiste",
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 422

def test_criar_usuario_primeiro_acesso_true(client, headers_admin):
    """Usuário criado deve sempre ter primeiro_acesso=True."""
    r = client.post("/usuarios/", json={
        "nome": "Primeiro Acesso Pytest",
        "email": "pytest_primeiro_acesso@amsi.com",
        "cargo": None,
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 200
    u = r.json()
    assert u["primeiro_acesso"] is True

    logins = client.get(f"/login/por-usuario/{u['id_usuario']}", headers=headers_admin)
    if logins.is_success:
        for login in logins.json():
            client.delete(f"/login/{login['id_login']}", headers=headers_admin)
    client.delete(f"/usuarios/{u['id_usuario']}", headers=headers_admin)


def test_resetar_senha_seta_primeiro_acesso_true(client, headers_admin, usuario_base):
    """Após resetar senha, primeiro_acesso do usuário deve ser True."""
    # Primeiro, simular que o usuário já fez o primeiro acesso
    client.put(f"/usuarios/{usuario_base['id_usuario']}", json={
        "primeiro_acesso": False
    }, headers=headers_admin)

    # Resetar senha
    r = client.post(f"/usuarios/{usuario_base['id_usuario']}/resetar-senha", headers=headers_admin)
    assert r.status_code == 200

    # Verificar que primeiro_acesso voltou para True
    r_usuario = client.get(f"/usuarios/{usuario_base['id_usuario']}", headers=headers_admin)
    assert r_usuario.status_code == 200
    assert r_usuario.json()["primeiro_acesso"] is True


def test_atualizar_campos_permitidos(client, headers_admin, usuario_base):
    """nome, cargo, perfil_de_acesso, bloqueado e notificacao devem ser atualizáveis."""
    r = client.put(f"/usuarios/{usuario_base['id_usuario']}", json={
        "nome": "Nome Atualizado Pytest",
        "cargo": "Diretor",
        "perfil_de_acesso": "Administrador",
        "bloqueado": True,
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 200
    u = r.json()
    assert u["nome"] == "Nome Atualizado Pytest"
    assert u["cargo"] == "Diretor"
    assert u["perfil_de_acesso"] == "Administrador"
    assert u["bloqueado"] is True

    # Reverter
    client.put(f"/usuarios/{usuario_base['id_usuario']}", json={
        "nome": usuario_base["nome"],
        "cargo": usuario_base["cargo"],
        "perfil_de_acesso": usuario_base["perfil_de_acesso"],
        "bloqueado": False
    }, headers=headers_admin)


# ================================================
# ISOLAMENTO — usuários excluídos são invisíveis
# ================================================

def test_buscar_usuario_excluido_retorna_404(client, headers_admin):
    """GET /usuarios/{id} de usuário soft-deletado deve retornar 404."""
    r = client.post("/usuarios/", json={
        "nome": "Busca Excluido Pytest",
        "email": "pytest_busca_excluido@amsi.com",
        "cargo": None,
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 200
    id_u = r.json()["id_usuario"]

    client.delete(f"/usuarios/{id_u}", headers=headers_admin)

    r = client.get(f"/usuarios/{id_u}", headers=headers_admin)
    assert r.status_code == 404


def test_resetar_senha_usuario_excluido_retorna_404(client, headers_admin):
    """POST /usuarios/{id}/resetar-senha em usuário soft-deletado deve retornar 404."""
    r = client.post("/usuarios/", json={
        "nome": "Reset Excluido Pytest",
        "email": "pytest_reset_excluido@amsi.com",
        "cargo": None,
        "perfil_de_acesso": "Consulta",
        "notificacao": False
    }, headers=headers_admin)
    assert r.status_code == 200
    id_u = r.json()["id_usuario"]

    client.delete(f"/usuarios/{id_u}", headers=headers_admin)

    r = client.post(f"/usuarios/{id_u}/resetar-senha", headers=headers_admin)
    assert r.status_code == 404


def test_restaurar_usuario_ja_ativo_retorna_404(client, headers_admin, usuario_base):
    """POST /usuarios/{id}/restaurar em usuário ativo deve retornar 404
    (restaurar só faz sentido para usuários que estão excluídos)."""
    r = client.post(f"/usuarios/{usuario_base['id_usuario']}/restaurar", headers=headers_admin)
    assert r.status_code == 404