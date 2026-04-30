from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.endereco import Endereco
from models.cliente_fornecedor import ClienteFornecedor
from schemas.endereco import EnderecoCreate, EnderecoUpdate, EnderecoResponse
from auth.dependencies import get_current_user
from typing import List

router = APIRouter(
    prefix="/endereco",
    tags=["Endereço"]
)

@router.get("/", response_model=List[EnderecoResponse])
def listar_enderecos(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Endereco).all()

@router.get("/{id_endereco}", response_model=EnderecoResponse)
def buscar_endereco(id_endereco: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    endereco = db.query(Endereco).filter(Endereco.id_endereco == id_endereco).first()
    if not endereco:
        raise HTTPException(status_code=404, detail="Endereço não encontrado")
    return endereco

@router.get("/por-clifor/{id_clifor}", response_model=List[EnderecoResponse])
def listar_enderecos_por_clifor(id_clifor: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Endereco).filter(Endereco.id_clifor_fk == id_clifor).all()

@router.post("/", response_model=EnderecoResponse)
def criar_endereco(dados: EnderecoCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if not db.query(ClienteFornecedor).filter(ClienteFornecedor.id_clifor == dados.id_clifor_fk).first():
        raise HTTPException(status_code=404, detail="Cliente/Fornecedor não encontrado")
    endereco = Endereco(**dados.model_dump())
    db.add(endereco)
    db.commit()
    db.refresh(endereco)
    return endereco

@router.put("/{id_endereco}", response_model=EnderecoResponse)
def atualizar_endereco(id_endereco: int, dados: EnderecoUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    endereco = db.query(Endereco).filter(Endereco.id_endereco == id_endereco).first()
    if not endereco:
        raise HTTPException(status_code=404, detail="Endereço não encontrado")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(endereco, campo, valor)
    db.commit()
    db.refresh(endereco)
    return endereco

@router.delete("/{id_endereco}")
def deletar_endereco(id_endereco: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    endereco = db.query(Endereco).filter(Endereco.id_endereco == id_endereco).first()
    if not endereco:
        raise HTTPException(status_code=404, detail="Endereço não encontrado")
    db.delete(endereco)
    db.commit()
    return {"mensagem": "Endereço deletado com sucesso"}