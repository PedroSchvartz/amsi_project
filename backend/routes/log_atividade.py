from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.log_atividade import LogAtividade
from schemas.log_atividade import LogAtividadeResponse
from auth.dependencies import exige_admin
from typing import List

router = APIRouter(
    prefix="/log-atividade",
    tags=["Log de Atividade"]
)


@router.get("/por-sessao/{id_login}", response_model=List[LogAtividadeResponse])
def listar_por_sessao(
    id_login: int,
    db: Session = Depends(get_db),
    _=Depends(exige_admin),
):
    return (
        db.query(LogAtividade)
        .filter(LogAtividade.id_login_fk == id_login)
        .order_by(LogAtividade.timestamp)
        .all()
    )


@router.get("/por-usuario/{id_usuario}", response_model=List[LogAtividadeResponse])
def listar_por_usuario(
    id_usuario: int,
    db: Session = Depends(get_db),
    _=Depends(exige_admin),
):
    return (
        db.query(LogAtividade)
        .filter(LogAtividade.id_usuario_fk == id_usuario)
        .order_by(LogAtividade.timestamp)
        .all()
    )
