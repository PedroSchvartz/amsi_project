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
    <h2>Bem-vindo ao AMSI Project</h2>
    <p>Olá, <strong>{usuario.nome}</strong>!</p>
    <p>Sua conta foi criada. Use a senha abaixo para fazer seu primeiro acesso:</p>
    <h3 style="background:#f4f4f4;padding:10px;letter-spacing:2px;">{senha_provisoria}</h3>
    <p>Você será solicitado a trocar a senha no primeiro login.</p>
    <p><small>Se não reconhece este cadastro, ignore este email.</small></p>
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
    <h2>Redefinição de senha — AMSI Project</h2>
    <p>Olá, <strong>{usuario.nome}</strong>!</p>
    <p>Sua senha foi redefinida por um administrador. Use a senha abaixo para acessar:</p>
    <h3 style="background:#f4f4f4;padding:10px;letter-spacing:2px;">{senha_provisoria}</h3>
    <p>Você será solicitado a trocar a senha no próximo login.</p>
    <p><small>Se não solicitou este reset, entre em contato com o administrador.</small></p>
    """
    try:
        enviar_email(usuario.email, "Redefinição de senha — AMSI Project", corpo)
    except Exception:
        pass

    return {"detail": "Senha redefinida e enviada por email"}