"""
Rotas exclusivas para modo de demonstração (APP_ENV=demo).

Todas as rotas retornam 403 automaticamente quando APP_ENV != "demo".
Para DESACOPLAR após o ensaio: mude APP_ENV=demo → APP_ENV=development
no config.env. Zero mudança de código necessária.

Endpoints:
  GET  /demo/status    — frontend verifica se modo demo está ativo
  POST /demo/registro  — estagiário cria sua própria conta sem email
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from database import get_db
from models.usuario import Usuario, CargoEnum, AcessoEnum
from schemas.usuario import UsuarioResponse
from utils.auth_utils import hash_senha
from utils.config import APP_ENV

router = APIRouter(
    prefix="/demo",
    tags=["Demo — Ensaio"]
)


class DemoRegistroRequest(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    cargo: CargoEnum = CargoEnum.Associado
    perfil_de_acesso: AcessoEnum = AcessoEnum.Consulta


def _exige_demo():
    """Bloqueia qualquer rota deste módulo fora do modo demo."""
    if APP_ENV != "demo":
        raise HTTPException(
            status_code=403,
            detail="Auto-registro disponível apenas em modo demo (APP_ENV=demo)."
        )


@router.get("/status")
def status_demo():
    """Informa ao frontend se o modo demo está ativo."""
    return {"demo_ativo": APP_ENV == "demo"}


@router.post("/registro", response_model=UsuarioResponse)
def demo_registro(dados: DemoRegistroRequest, db: Session = Depends(get_db)):
    """
    Cria uma conta de estagiário sem envio de email e sem DNS check.
    Perfil padrão: Consulta (somente leitura) — o menor privilégio.

    O perfil pode ser elevado explicitamente no corpo da requisição quando o
    modo demo estiver ativo. A proteção real contra abuso é APP_ENV=production,
    que desativa esta rota por completo (_exige_demo → 403).
    """
    _exige_demo()

    if len(dados.senha) < 6:
        raise HTTPException(
            status_code=400,
            detail="A senha deve ter no mínimo 6 caracteres."
        )

    if db.query(Usuario).filter(
        Usuario.email == dados.email,
        Usuario.exclusao == None  # noqa: E711
    ).first():
        raise HTTPException(status_code=409, detail="Este email já está cadastrado.")

    usuario = Usuario(
        nome=dados.nome,
        email=dados.email,
        senha=hash_senha(dados.senha),
        cargo=dados.cargo,
        perfil_de_acesso=dados.perfil_de_acesso,
        notificacao=False,
        bloqueado=False,
        primeiro_acesso=False   # sem obrigatoriedade de trocar senha no 1º login
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario
