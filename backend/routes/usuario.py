from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.usuario import Usuario
from models.token_ativo import TokenAtivo
from schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioResponse
from utils.auth_utils import hash_senha
from utils.email_sender import enviar_email
from utils.senha_token import gerar_token_senha, _link_definir_senha, FINALIDADE_CADASTRO, FINALIDADE_RESET
from utils.vinculo_clifor import garantir_email_no_clifor, sincronizar_email_clifor
from auth.dependencies import get_current_user, exige_admin, exige_admin_desenvolvedor
from typing import List
import secrets
import dns.resolver
from datetime import datetime

router = APIRouter(
    prefix="/usuarios",
    tags=["Usuários"]
)


def _validar_dominio_email(email: str) -> bool:
    try:
        dominio = email.split("@")[1]
        dns.resolver.resolve(dominio, "MX")
        return True
    except Exception:
        return False


@router.get("/", response_model=List[UsuarioResponse])
def listar_usuarios(
    incluir_excluidos: bool = False,
    db: Session = Depends(get_db),
    _=Depends(exige_admin)
):
    q = db.query(Usuario)
    if not incluir_excluidos:
        q = q.filter(Usuario.exclusao == None)  # noqa: E711
    return q.all()


@router.get("/{id_usuario}", response_model=UsuarioResponse)
def buscar_usuario(id_usuario: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    usuario = db.query(Usuario).filter(
        Usuario.id_usuario == id_usuario,
        Usuario.exclusao == None  # noqa: E711
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return usuario


@router.post("/", response_model=UsuarioResponse)
def criar_usuario(dados: UsuarioCreate, db: Session = Depends(get_db), usuario_atual: Usuario = Depends(exige_admin)):
    if dados.cargo.value == "Desenvolvedor" and usuario_atual.cargo.value != "Desenvolvedor":
        raise HTTPException(status_code=403, detail="Apenas usuários com cargo Desenvolvedor podem cadastrar outros desenvolvedores")

    if not _validar_dominio_email(dados.email):
        raise HTTPException(status_code=400, detail="Domínio de email inválido ou inexistente")

    if db.query(Usuario).filter(
        Usuario.email == dados.email,
        Usuario.exclusao == None  # noqa: E711
    ).first():
        raise HTTPException(status_code=409, detail="Email já cadastrado")

    dados_dict = dados.model_dump()
    # Senha inutilizável: ninguém conhece o valor em claro, então nenhum login casa.
    # O usuário define a senha real pelo link enviado por e-mail (token de uso único).
    dados_dict["senha"] = hash_senha(secrets.token_urlsafe(32))
    dados_dict["primeiro_acesso"] = True

    usuario = Usuario(**dados_dict)
    db.add(usuario)
    db.flush()  # garante id_usuario sem commitar — rollback total se o e-mail falhar

    token = gerar_token_senha(db, usuario, FINALIDADE_CADASTRO, ttl_horas=720)  # ~1 mês
    _link_acesso = _link_definir_senha(token)
    corpo = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#EFE6DD;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="600" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(27,67,50,0.10);">
        <tr><td style="background:#1B4332;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:2rem;font-weight:700;color:#C9A84C;letter-spacing:0.1em;">AMSI</p>
          <p style="margin:4px 0 0;font-size:0.72rem;color:rgba(255,255,255,0.6);letter-spacing:0.2em;text-transform:uppercase;">Associação de Moradores de Santa Isabel</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="font-size:1.3rem;font-weight:600;color:#1B4332;margin:0 0 8px;">Bem-vindo(a) à AMSI! 👋</p>
          <p style="color:#6b7280;margin:0 0 20px;">Olá, <strong style="color:#2C2C2C;">{usuario.nome}</strong>! Sua conta foi criada. Para acessar o sistema, defina sua senha clicando no botão abaixo.</p>
          <div style="text-align:center;margin:0 0 20px;">
            <a href="{_link_acesso}" style="display:inline-block;background:#1B4332;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:0.95rem;letter-spacing:0.03em;">Definir minha senha →</a>
          </div>
          <div style="background:#fef9ec;border-left:4px solid #C9A84C;padding:12px 16px;border-radius:4px;margin:0 0 20px;">
            <p style="margin:0;font-size:0.85rem;color:#92400e;">⚠️ Este link é pessoal e expira em 30 dias. Não o compartilhe com ninguém.</p>
          </div>
          <p style="font-size:0.78rem;color:#6b7280;margin:0;word-break:break-all;">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="{_link_acesso}" style="color:#1B4332;">{_link_acesso}</a></p>
        </td></tr>
        <tr><td style="padding:16px 40px;text-align:center;border-top:1px solid #d1c9bf;">
          <p style="margin:0;font-size:0.72rem;color:#a0a0a0;">© 2026 AMSI — Este é um email automático.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    enviado = enviar_email(usuario.email, "Bem-vindo(a) à AMSI — defina sua senha", corpo)
    if not enviado:
        db.rollback()  # desfaz usuário + token: nada é persistido
        raise HTTPException(
            status_code=502,
            detail="Não foi possível enviar o e-mail para este endereço. Verifique se o e-mail é válido."
        )

    db.commit()
    db.refresh(usuario)
    return usuario


@router.put("/{id_usuario}", response_model=UsuarioResponse)
def atualizar_usuario(id_usuario: int, dados: UsuarioUpdate, db: Session = Depends(get_db), _=Depends(exige_admin)):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    email_antigo = usuario.email
    dados_dict = dados.model_dump(exclude_unset=True)
    if "senha" in dados_dict:
        dados_dict["senha"] = hash_senha(dados_dict["senha"])

    for campo, valor in dados_dict.items():
        setattr(usuario, campo, valor)

    # Vínculo: se o e-mail mudou, sincroniza o contato no clifor vinculado.
    if usuario.email != email_antigo:
        sincronizar_email_clifor(usuario, email_antigo, db)

    db.commit()
    db.refresh(usuario)
    return usuario


@router.delete("/{id_usuario}")
def deletar_usuario(id_usuario: int, db: Session = Depends(get_db), _=Depends(exige_admin)):
    usuario = db.query(Usuario).filter(
        Usuario.id_usuario == id_usuario,
        Usuario.exclusao == None  # noqa: E711
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    usuario.exclusao = datetime.now()
    # Invalida sessão ativa imediatamente — impede uso do token até expirar
    db.query(TokenAtivo).filter(TokenAtivo.id_usuario_fk == id_usuario).delete()
    db.commit()
    return {"detail": "Usuário deletado com sucesso"}

@router.delete("/{id_usuario}/hard", include_in_schema=False)
def deletar_usuario_hard(
    id_usuario: int,
    db: Session = Depends(get_db),
    _=Depends(exige_admin_desenvolvedor)
):
    """Hard delete com cascade — remove a linha do banco.
    Disponível apenas para Administrador+Desenvolvedor. Oculto do OpenAPI/frontend."""
    from models.lancamento import Lancamento
    from models.login import Login
    from models.log_atividade import LogAtividade
    from models.cliente_fornecedor import ClienteFornecedor as _CliFor
    from models.senha_token import SenhaToken

    if id_usuario == 1:
        raise HTTPException(status_code=403, detail="Não é permitido deletar o usuário raiz do sistema")

    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # 1. Tokens ativos e tokens de definição de senha
    db.query(TokenAtivo).filter(TokenAtivo.id_usuario_fk == id_usuario).delete(synchronize_session=False)
    db.query(SenhaToken).filter(SenhaToken.id_usuario_fk == id_usuario).delete(synchronize_session=False)

    # 2. Lançamentos — aprovação (nullable) → NULL; criação (NOT NULL) → reassign admin raiz
    db.query(Lancamento).filter(Lancamento.id_usuario_fk_aprovacao == id_usuario)\
        .update({"id_usuario_fk_aprovacao": None}, synchronize_session=False)
    db.query(Lancamento).filter(Lancamento.id_usuario_fk_lancamento == id_usuario)\
        .update({"id_usuario_fk_lancamento": 1}, synchronize_session=False)

    # 3. Clifor — desvincular
    db.query(_CliFor).filter(_CliFor.id_usuario_fk == id_usuario)\
        .update({"id_usuario_fk": None}, synchronize_session=False)

    # 4. Log de atividade — tem ondelete=SET NULL no DB, mas nullificamos antes por segurança
    db.query(LogAtividade).filter(LogAtividade.id_usuario_fk == id_usuario)\
        .update({"id_usuario_fk": None}, synchronize_session=False)

    # 5. Logins (log_atividade.id_login_fk tem ondelete=SET NULL no DB)
    db.query(Login).filter(Login.id_usuario_fk == id_usuario).delete(synchronize_session=False)

    # 6. Usuário
    db.delete(usuario)
    db.commit()
    return {"detail": "Usuário permanentemente removido"}


@router.post("/{id_usuario}/restaurar", response_model=UsuarioResponse)
def restaurar_usuario(id_usuario: int, db: Session = Depends(get_db), _=Depends(exige_admin)):
    usuario = db.query(Usuario).filter(
        Usuario.id_usuario == id_usuario,
        Usuario.exclusao != None  # noqa: E711
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado ou não está excluído")

    # Reativa a conta. A senha antiga continua válida; ainda assim enviamos um link
    # para o usuário definir uma nova senha (caso a tenha esquecido).
    usuario.exclusao = None
    db.flush()

    token = gerar_token_senha(db, usuario, FINALIDADE_RESET, ttl_horas=48)
    _link_acesso = _link_definir_senha(token)
    corpo = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#EFE6DD;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="600" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(27,67,50,0.10);">
        <tr><td style="background:#1B4332;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:2rem;font-weight:700;color:#C9A84C;letter-spacing:0.1em;">AMSI</p>
          <p style="margin:4px 0 0;font-size:0.72rem;color:rgba(255,255,255,0.6);letter-spacing:0.2em;text-transform:uppercase;">Associação de Moradores de Santa Isabel</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="font-size:1.3rem;font-weight:600;color:#1B4332;margin:0 0 8px;">Sua conta foi restaurada ✅</p>
          <p style="color:#6b7280;margin:0 0 20px;">Olá, <strong style="color:#2C2C2C;">{usuario.nome}</strong>! Sua conta foi reativada por um administrador. Para garantir o acesso, defina uma nova senha clicando no botão abaixo.</p>
          <div style="text-align:center;margin:0 0 20px;">
            <a href="{_link_acesso}" style="display:inline-block;background:#1B4332;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:0.95rem;letter-spacing:0.03em;">Definir minha senha →</a>
          </div>
          <div style="background:#fef9ec;border-left:4px solid #C9A84C;padding:12px 16px;border-radius:4px;margin:0 0 20px;">
            <p style="margin:0;font-size:0.85rem;color:#92400e;">⚠️ Este link expira em 48 horas.</p>
          </div>
          <p style="font-size:0.78rem;color:#6b7280;margin:0;word-break:break-all;">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="{_link_acesso}" style="color:#1B4332;">{_link_acesso}</a></p>
        </td></tr>
        <tr><td style="padding:16px 40px;text-align:center;border-top:1px solid #d1c9bf;">
          <p style="margin:0;font-size:0.72rem;color:#a0a0a0;">© 2026 AMSI — Este é um email automático.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    enviado = enviar_email(usuario.email, "Conta restaurada — AMSI Project", corpo)
    if not enviado:
        db.rollback()  # desfaz exclusao=None e o token → a conta continua excluída
        raise HTTPException(
            status_code=502,
            detail="Falha ao enviar o e-mail de restauração. A conta NÃO foi reativada.",
        )

    db.commit()
    db.refresh(usuario)
    return usuario


@router.post("/{id_usuario}/resetar-senha")
def resetar_senha(id_usuario: int, db: Session = Depends(get_db), _=Depends(exige_admin)):
    usuario = db.query(Usuario).filter(
        Usuario.id_usuario == id_usuario,
        Usuario.exclusao == None  # noqa: E711
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Reset administrativo: NÃO altera a senha aqui — o usuário define a nova pelo
    # link enviado (token), sem trafegar senha em texto. Mas, por segurança, derruba
    # as sessões ativas e força primeiro_acesso=True (aplicado abaixo, após o e-mail).
    token = gerar_token_senha(db, usuario, FINALIDADE_RESET, ttl_horas=48)
    _link_acesso = _link_definir_senha(token)
    corpo = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#EFE6DD;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="600" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(27,67,50,0.10);">
        <tr><td style="background:#1B4332;padding:32px 40px;text-align:center;">
          <p style="margin:0;font-size:2rem;font-weight:700;color:#C9A84C;letter-spacing:0.1em;">AMSI</p>
          <p style="margin:4px 0 0;font-size:0.72rem;color:rgba(255,255,255,0.6);letter-spacing:0.2em;text-transform:uppercase;">Associação de Moradores de Santa Isabel</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="font-size:1.3rem;font-weight:600;color:#1B4332;margin:0 0 8px;">Redefinição de senha 🔐</p>
          <p style="color:#6b7280;margin:0 0 20px;">Olá, <strong style="color:#2C2C2C;">{usuario.nome}</strong>! Recebemos um pedido para redefinir a sua senha. Clique no botão abaixo para criar uma nova senha.</p>
          <div style="text-align:center;margin:0 0 20px;">
            <a href="{_link_acesso}" style="display:inline-block;background:#1B4332;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:0.95rem;letter-spacing:0.03em;">Redefinir minha senha →</a>
          </div>
          <div style="background:#fef9ec;border-left:4px solid #C9A84C;padding:12px 16px;border-radius:4px;margin:0 0 20px;">
            <p style="margin:0;font-size:0.85rem;color:#92400e;">⚠️ Este link expira em 48 horas. Se você não solicitou, ignore este e-mail — sua senha atual continua valendo.</p>
          </div>
          <p style="font-size:0.78rem;color:#6b7280;margin:0;word-break:break-all;">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="{_link_acesso}" style="color:#1B4332;">{_link_acesso}</a></p>
        </td></tr>
        <tr><td style="padding:16px 40px;text-align:center;border-top:1px solid #d1c9bf;">
          <p style="margin:0;font-size:0.72rem;color:#a0a0a0;">© 2026 AMSI — Este é um email automático.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    enviado = enviar_email(usuario.email, "Redefinição de senha — AMSI Project", corpo)
    if not enviado:
        db.rollback()  # desfaz o token; a senha nunca foi tocada
        raise HTTPException(
            status_code=502,
            detail="Falha ao enviar o e-mail de redefinição. Tente novamente.",
        )

    # E-mail enviado: derruba as sessões ativas e exige nova senha no próximo acesso.
    usuario.primeiro_acesso = True
    db.query(TokenAtivo).filter(TokenAtivo.id_usuario_fk == id_usuario).delete()

    db.commit()
    return {"detail": "Enviamos um link de redefinição de senha por e-mail."}

# ─── Clifor vinculado ao usuário ──────────────────────────────────────────────

from models.cliente_fornecedor import ClienteFornecedor
from schemas.cliente_fornecedor import ClienteFornecedorResponse
from sqlalchemy import func
from typing import Optional as Opt


@router.get("/{id_usuario}/clifor", response_model=ClienteFornecedorResponse)
def buscar_clifor_do_usuario(
    id_usuario: int,
    db: Session = Depends(get_db),
    usuario_atual=Depends(get_current_user)
):
    if usuario_atual.id_usuario != id_usuario and usuario_atual.perfil_de_acesso.value != "Administrador":
        raise HTTPException(status_code=403, detail="Acesso negado")
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    clifor = db.query(ClienteFornecedor).filter(
        ClienteFornecedor.id_usuario_fk == id_usuario
    ).first()

    if not clifor:
        raise HTTPException(status_code=404, detail="Nenhum cliente/fornecedor vinculado a este usuário")

    return clifor


@router.get("/{id_usuario}/clifor/sugestao", response_model=List[ClienteFornecedorResponse])
def sugerir_clifor_para_usuario(
    id_usuario: int,
    nome: Opt[str] = None,
    db: Session = Depends(get_db),
    _=Depends(exige_admin)
):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    termo = nome if nome else usuario.nome

    try:
        resultados = (
            db.query(ClienteFornecedor)
            .filter(ClienteFornecedor.id_usuario_fk == None)
            .filter(ClienteFornecedor.ativo == True)
            .order_by(func.similarity(ClienteFornecedor.nome, termo).desc())
            .limit(5)
            .all()
        )
    except Exception:
        resultados = (
            db.query(ClienteFornecedor)
            .filter(ClienteFornecedor.id_usuario_fk == None)
            .filter(ClienteFornecedor.ativo == True)
            .filter(ClienteFornecedor.nome.ilike(f"%{termo}%"))
            .limit(5)
            .all()
        )

    return resultados


@router.post("/{id_usuario}/clifor/{id_clifor}/associar", response_model=ClienteFornecedorResponse)
def associar_clifor_ao_usuario(
    id_usuario: int,
    id_clifor: int,
    db: Session = Depends(get_db),
    _=Depends(exige_admin)
):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    clifor = db.query(ClienteFornecedor).filter(ClienteFornecedor.id_clifor == id_clifor).first()
    if not clifor:
        raise HTTPException(status_code=404, detail="Cliente/Fornecedor não encontrado")

    if clifor.id_usuario_fk and clifor.id_usuario_fk != id_usuario:
        raise HTTPException(status_code=409, detail="Este cliente/fornecedor já está vinculado a outro usuário")

    clifor.id_usuario_fk = id_usuario
    # Vínculo: garante o e-mail do usuário entre os contatos do clifor.
    garantir_email_no_clifor(clifor, usuario, db)
    db.commit()
    db.refresh(clifor)
    return clifor


@router.delete("/{id_usuario}/clifor/desvincular")
def desvincular_clifor_do_usuario(
    id_usuario: int,
    db: Session = Depends(get_db),
    _=Depends(exige_admin)
):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    clifor = db.query(ClienteFornecedor).filter(
        ClienteFornecedor.id_usuario_fk == id_usuario
    ).first()

    if not clifor:
        raise HTTPException(status_code=404, detail="Nenhum cliente/fornecedor vinculado a este usuário")

    clifor.id_usuario_fk = None
    db.commit()
    return {"detail": "Cliente/Fornecedor desvinculado com sucesso"}


# ─── Exportação LGPD ──────────────────────────────────────────────────────────

from models.login import Login
from models.lancamento import Lancamento
from models.cliente_fornecedor import ClienteFornecedor as CliForModel


@router.get("/{id_usuario}/exportar-dados")
def exportar_dados_usuario(
    id_usuario: int,
    db: Session = Depends(get_db),
    _=Depends(exige_admin)
):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    clifor = db.query(CliForModel).filter(CliForModel.id_usuario_fk == id_usuario).first()

    lancamentos = []
    if clifor:
        lancamentos = db.query(Lancamento).filter(
            Lancamento.id_clifor_relacionado_fk == clifor.id_clifor
        ).all()

    logins = db.query(Login).filter(Login.id_usuario_fk == id_usuario).all()

    from models.log_atividade import LogAtividade
    atividades = db.query(LogAtividade).filter(
        LogAtividade.id_usuario_fk == id_usuario
    ).order_by(LogAtividade.timestamp).all()

    return {
        "usuario": {
            "id_usuario": usuario.id_usuario,
            "nome": usuario.nome,
            "email": usuario.email,
            "cargo": usuario.cargo.value,
            "perfil_de_acesso": usuario.perfil_de_acesso.value,
            "data_cadastro": usuario.data_cadastro,
            "notificacao": usuario.notificacao,
            "suspenso": usuario.suspenso,
            "bloqueado": usuario.bloqueado,
            "exclusao": usuario.exclusao,
        },
        "clifor": {
            "id_clifor": clifor.id_clifor,
            "nome": clifor.nome,
            "cpf_cnpj": clifor.cpf_cnpj,
            "rg_inscricaoestadual": clifor.rg_inscricaoestadual,
            "datanascimento": clifor.datanascimento,
            "pessoafisica_juridica": clifor.pessoafisica_juridica,
            "tipo_clifor": clifor.tipo_clifor.value,
            "ativo": clifor.ativo,
            "inadimplente": clifor.inadimplente,
            "enderecos": [
                {
                    "logradouro": e.logradouro,
                    "numero": e.numero,
                    "complemento": e.complemento,
                    "bairro": e.bairro,
                    "cidade": e.cidade,
                    "uf": e.uf,
                    "cep": e.cep,
                    "enderecoprimario": e.enderecoprimario,
                }
                for e in clifor.enderecos
            ],
            "contatos": [
                {
                    "tipocontato": c.tipocontato,
                    "info_do_contato": c.info_do_contato,
                    "contato_principal": c.contato_principal,
                }
                for c in clifor.contatos
            ],
        } if clifor else None,
        "lancamentos": [
            {
                "id_lancamento": l.id_lancamento,
                "natureza": l.natureza_lancamento.value,
                "valor": str(l.valor),
                "data_vencimento": l.data_vencimento,
                "data_lancamento": l.data_lancamento,
                "data_pagamento": l.data_pagamento,
                "valor_pago": str(l.valor_pago) if l.valor_pago else None,
                "estorno": l.estorno,
                "observacao": l.observacao,
            }
            for l in lancamentos
        ],
        "logins": [
            {
                "data_login": lg.data_login,
                "data_logout": lg.data_logout,
                "dispositivo_logado": lg.dispositivo_logado,
                "localizacao": lg.localizacao,
                "navegador": lg.navegador,
            }
            for lg in logins
        ],
        "atividades": [
            {
                "timestamp": a.timestamp,
                "metodo": a.metodo,
                "endpoint": a.endpoint,
                "entidade": a.entidade,
                "id_entidade": a.id_entidade,
                "descricao": a.descricao,
                "status_code": a.status_code,
            }
            for a in atividades
        ],
    }