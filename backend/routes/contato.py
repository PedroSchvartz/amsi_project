from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.contato import Contato
from models.cliente_fornecedor import ClienteFornecedor
from schemas.contato import ContatoCreate, ContatoUpdate, ContatoResponse
from auth.dependencies import get_current_user
from typing import List

router = APIRouter(
    prefix="/contato",
    tags=["Contato"]
)

@router.get("/", response_model=List[ContatoResponse])
def listar_contatos(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Contato).all()

@router.get("/{id_contato}", response_model=ContatoResponse)
def buscar_contato(id_contato: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    contato = db.query(Contato).filter(Contato.id_contato == id_contato).first()
    if not contato:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    return contato

@router.get("/por-clifor/{id_clifor}", response_model=List[ContatoResponse])
def listar_contatos_por_clifor(id_clifor: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Contato).filter(Contato.id_clifor_fk == id_clifor).all()

@router.post("/", response_model=ContatoResponse)
def criar_contato(dados: ContatoCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if not db.query(ClienteFornecedor).filter(ClienteFornecedor.id_clifor == dados.id_clifor_fk).first():
        raise HTTPException(status_code=404, detail="Cliente/Fornecedor não encontrado")
    contato = Contato(**dados.model_dump())
    db.add(contato)
    db.commit()
    db.refresh(contato)
    return contato

@router.put("/{id_contato}", response_model=ContatoResponse)
def atualizar_contato(id_contato: int, dados: ContatoUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    contato = db.query(Contato).filter(Contato.id_contato == id_contato).first()
    if not contato:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(contato, campo, valor)
    db.commit()
    db.refresh(contato)
    return contato

@router.delete("/{id_contato}")
def deletar_contato(id_contato: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    contato = db.query(Contato).filter(Contato.id_contato == id_contato).first()
    if not contato:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    db.delete(contato)
    db.commit()
    return {"mensagem": "Contato deletado com sucesso"}