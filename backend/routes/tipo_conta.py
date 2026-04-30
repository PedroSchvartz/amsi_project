from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.tipo_conta import tipo_conta as TipoConta
from schemas.tipo_conta import TipoLancamentoCreate, TipoLancamentoUpdate, TipoLancamentoResponse
from auth.dependencies import get_current_user, exige_admin
from typing import List

router = APIRouter(
    prefix="/tipo_conta",
    tags=["Tipo de Lançamento"]
)

@router.get("/", response_model=List[TipoLancamentoResponse])
def listar_tipos(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(TipoConta).all()

@router.get("/{id_tipo_conta}", response_model=TipoLancamentoResponse)
def buscar_tipo(id_tipo_conta: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    tipo = db.query(TipoConta).filter(TipoConta.id_tipo_conta == id_tipo_conta).first()
    if not tipo:
        raise HTTPException(status_code=404, detail="Tipo de lançamento não encontrado")
    return tipo

@router.post("/", response_model=TipoLancamentoResponse)
def criar_tipo(dados: TipoLancamentoCreate, db: Session = Depends(get_db), _=Depends(exige_admin)):
    tipo = TipoConta(**dados.model_dump())
    db.add(tipo)
    db.commit()
    db.refresh(tipo)
    return tipo

@router.put("/{id_tipo_conta}", response_model=TipoLancamentoResponse)
def atualizar_tipo(id_tipo_conta: int, dados: TipoLancamentoUpdate, db: Session = Depends(get_db), _=Depends(exige_admin)):
    tipo = db.query(TipoConta).filter(TipoConta.id_tipo_conta == id_tipo_conta).first()
    if not tipo:
        raise HTTPException(status_code=404, detail="Tipo de lançamento não encontrado")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(tipo, campo, valor)
    db.commit()
    db.refresh(tipo)
    return tipo

@router.delete("/{id_tipo_conta}")
def deletar_tipo(id_tipo_conta: int, db: Session = Depends(get_db), _=Depends(exige_admin)):
    tipo = db.query(TipoConta).filter(TipoConta.id_tipo_conta == id_tipo_conta).first()
    if not tipo:
        raise HTTPException(status_code=404, detail="Tipo de lançamento não encontrado")
    db.delete(tipo)
    db.commit()
    return {"mensagem": "Tipo de lançamento deletado com sucesso"}