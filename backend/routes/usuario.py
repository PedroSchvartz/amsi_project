from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.usuario import Usuario
from schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioResponse
from utils.auth_utils import hash_senha
from utils.email_sender import enviar_email
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
          <p style="font-size:0.78rem;color:#6b7280;margin:0;">Se não reconhece este cadastro, ignore este email.</p>
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
        enviar_email(usuario.email, "Sua senha de acesso — AMSI Project", corpo)
    except Exception:
        pass  # não bloqueia o cadastro se o email falhar

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
          <p style="font-size:0.78rem;color:#6b7280;margin:0;">Se não solicitou este reset, entre em contato com o administrador imediatamente.</p>
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