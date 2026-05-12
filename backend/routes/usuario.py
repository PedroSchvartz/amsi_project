from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.usuario import Usuario
from schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioResponse
from utils.auth_utils import hash_senha
from utils.email_sender import enviar_email
from utils.config import FRONTEND_URL
from auth.dependencies import get_current_user, exige_admin
from typing import List
import secrets
import string
import dns.resolver

router = APIRouter(
    prefix="/usuarios",
    tags=["Usuários"]
)


def _gerar_senha_provisoria(tamanho: int = 12) -> str:
    caracteres = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(caracteres) for _ in range(tamanho))


def _validar_dominio_email(email: str) -> bool:
    try:
        dominio = email.split("@")[1]
        dns.resolver.resolve(dominio, "MX")
        return True
    except Exception:
        return False


@router.get("/", response_model=List[UsuarioResponse])
def listar_usuarios(db: Session = Depends(get_db), _=Depends(exige_admin)):
    return db.query(Usuario).all()


@router.get("/{id_usuario}", response_model=UsuarioResponse)
def buscar_usuario(id_usuario: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return usuario


@router.post("/", response_model=UsuarioResponse)
def criar_usuario(dados: UsuarioCreate, db: Session = Depends(get_db), _=Depends(exige_admin)):
    if not _validar_dominio_email(dados.email):
        raise HTTPException(status_code=400, detail="Domínio de email inválido ou inexistente")

    if db.query(Usuario).filter(Usuario.email == dados.email).first():
        raise HTTPException(status_code=409, detail="Email já cadastrado")

    senha_provisoria = _gerar_senha_provisoria()

    dados_dict = dados.model_dump()
    dados_dict["senha"] = hash_senha(senha_provisoria)
    dados_dict["primeiro_acesso"] = True

    usuario = Usuario(**dados_dict)
    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    # Enviar senha por email
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
          <p style="font-size:1.3rem;font-weight:600;color:#1B4332;margin:0 0 8px;">Bem-vindo(a) a AMSI! 👋</p>
          <p style="color:#6b7280;margin:0 0 20px;">Olá, <strong style="color:#2C2C2C;">{usuario.nome}</strong>! Sua conta foi criada com sucesso.</p>
          <p style="color:#2C2C2C;margin:0 0 12px;">Sua senha provisória:</p>
          <div style="background:#f4f1ec;border:1px solid #d1c9bf;border-radius:8px;padding:18px;text-align:center;margin:0 0 20px;">
            <p style="margin:0 0 4px;font-size:0.7rem;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;">senha</p>
            <p style="margin:0;font-size:1.5rem;font-weight:700;color:#1B4332;letter-spacing:0.2em;">{senha_provisoria}</p>
          </div>
          <div style="background:#fef9ec;border-left:4px solid #C9A84C;padding:12px 16px;border-radius:4px;margin:0 0 20px;">
            <p style="margin:0;font-size:0.85rem;color:#92400e;">⚠️ Você será solicitado a trocar esta senha no primeiro login.</p>
          </div>
          <div style="text-align:center;margin:0 0 20px;">
            <a href="{FRONTEND_URL}trocar-senha?senha={senha_provisoria}" style="display:inline-block;background:#1B4332;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:0.95rem;letter-spacing:0.03em;">Acessar o sistema →</a>
          </div>
          <p style="font-size:0.78rem;color:#6b7280;margin:0 0 12px;">Ou acesse: <a href="{FRONTEND_URL}trocar-senha?senha={senha_provisoria}" style="color:#1B4332;">{FRONTEND_URL}</a></p>
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
    enviado = enviar_email(usuario.email, "Sua senha de acesso — AMSI Project", corpo)
    if not enviado:
        db.delete(usuario)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Não foi possível enviar o email para este endereço. Verifique se o email é válido."
        )

    return usuario


@router.put("/{id_usuario}", response_model=UsuarioResponse)
def atualizar_usuario(id_usuario: int, dados: UsuarioUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    dados_dict = dados.model_dump(exclude_unset=True)
    if "senha" in dados_dict:
        dados_dict["senha"] = hash_senha(dados_dict["senha"])

    for campo, valor in dados_dict.items():
        setattr(usuario, campo, valor)

    db.commit()
    db.refresh(usuario)
    return usuario


@router.delete("/{id_usuario}")
def deletar_usuario(id_usuario: int, db: Session = Depends(get_db), _=Depends(exige_admin)):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    db.delete(usuario)
    db.commit()
    return {"detail": "Usuário deletado com sucesso"}

@router.post("/{id_usuario}/resetar-senha")
def resetar_senha(id_usuario: int, db: Session = Depends(get_db), _=Depends(exige_admin)):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    senha_provisoria = _gerar_senha_provisoria()
    usuario.senha = hash_senha(senha_provisoria)
    usuario.primeiro_acesso = True
    db.commit()

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
          <p style="color:#6b7280;margin:0 0 20px;">Olá, <strong style="color:#2C2C2C;">{usuario.nome}</strong>! Sua senha foi redefinida por um administrador.</p>
          <p style="color:#2C2C2C;margin:0 0 12px;">Sua nova senha provisória:</p>
          <div style="background:#f4f1ec;border:1px solid #d1c9bf;border-radius:8px;padding:18px;text-align:center;margin:0 0 20px;">
            <p style="margin:0 0 4px;font-size:0.7rem;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;">nova senha</p>
            <p style="margin:0;font-size:1.5rem;font-weight:700;color:#1B4332;letter-spacing:0.2em;">{senha_provisoria}</p>
          </div>
          <div style="background:#fef9ec;border-left:4px solid #C9A84C;padding:12px 16px;border-radius:4px;margin:0 0 20px;">
            <p style="margin:0;font-size:0.85rem;color:#92400e;">⚠️ Você será solicitado a trocar esta senha no próximo login.</p>
          </div>
          <div style="text-align:center;margin:0 0 20px;">
            <a href="{FRONTEND_URL}trocar-senha?senha={senha_provisoria}" style="display:inline-block;background:#1B4332;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:0.95rem;letter-spacing:0.03em;">Acessar o sistema →</a>
          </div>
          <p style="font-size:0.78rem;color:#6b7280;margin:0 0 12px;">Ou acesse: <a href="{FRONTEND_URL}trocar-senha?senha={senha_provisoria}" style="color:#1B4332;">{FRONTEND_URL}</a></p>
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
    try:
        enviar_email(usuario.email, "Redefinição de senha — AMSI Project", corpo)
    except Exception:
        pass

    return {"detail": "Senha redefinida e enviada por email"}

# ─── Clifor vinculado ao usuário ──────────────────────────────────────────────

from models.cliente_fornecedor import ClienteFornecedor
from schemas.cliente_fornecedor import ClienteFornecedorResponse
from sqlalchemy import func
from typing import Optional as Opt


@router.get("/{id_usuario}/clifor", response_model=ClienteFornecedorResponse)
def buscar_clifor_do_usuario(
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