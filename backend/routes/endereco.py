from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.endereco import Endereco
from models.cliente_fornecedor import ClienteFornecedor
from models.usuario import Usuario, AcessoEnum
from schemas.endereco import EnderecoCreate, EnderecoUpdate, EnderecoResponse
from auth.dependencies import get_current_user, exige_operador_ou_admin
from typing import List

router = APIRouter(
    prefix="/endereco",
    tags=["Endereço"]
)

@router.get("/", response_model=List[EnderecoResponse])
def listar_enderecos(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    # Consulta so enxerga os enderecos do proprio clifor (espelha o item 7 em /lancamento/);
    # sem clifor vinculado, lista vazia. Admin/Operador veem tudo.
    q = db.query(Endereco)
    if current_user.perfil_de_acesso == AcessoEnum.Consulta:
        if current_user.id_clifor_fk is None:
            return []
        q = q.filter(Endereco.id_clifor_fk == current_user.id_clifor_fk)
    return q.all()

@router.get("/{id_endereco}", response_model=EnderecoResponse)
def buscar_endereco(id_endereco: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    endereco = db.query(Endereco).filter(Endereco.id_endereco == id_endereco).first()
    if not endereco:
        raise HTTPException(status_code=404, detail="Endereço não encontrado")
    if current_user.perfil_de_acesso == AcessoEnum.Consulta and endereco.id_clifor_fk != current_user.id_clifor_fk:
        raise HTTPException(status_code=403, detail="Sem permissão para este endereço")
    return endereco

@router.get("/por-clifor/{id_clifor}", response_model=List[EnderecoResponse])
def listar_enderecos_por_clifor(id_clifor: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    if current_user.perfil_de_acesso == AcessoEnum.Consulta and id_clifor != current_user.id_clifor_fk:
        raise HTTPException(status_code=403, detail="Sem permissão para este cliente/fornecedor")
    return db.query(Endereco).filter(Endereco.id_clifor_fk == id_clifor).all()

@router.post("/", response_model=EnderecoResponse)
def criar_endereco(dados: EnderecoCreate, db: Session = Depends(get_db), _=Depends(exige_operador_ou_admin)):
    if not db.query(ClienteFornecedor).filter(ClienteFornecedor.id_clifor == dados.id_clifor_fk).first():
        raise HTTPException(status_code=404, detail="Cliente/Fornecedor não encontrado")
    endereco = Endereco(**dados.model_dump())
    db.add(endereco)
    db.commit()
    db.refresh(endereco)
    return endereco

@router.put("/{id_endereco}", response_model=EnderecoResponse)
def atualizar_endereco(id_endereco: int, dados: EnderecoUpdate, db: Session = Depends(get_db), _=Depends(exige_operador_ou_admin)):
    endereco = db.query(Endereco).filter(Endereco.id_endereco == id_endereco).first()
    if not endereco:
        raise HTTPException(status_code=404, detail="Endereço não encontrado")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(endereco, campo, valor)
    db.commit()
    db.refresh(endereco)
    return endereco

@router.delete("/{id_endereco}")
def deletar_endereco(id_endereco: int, db: Session = Depends(get_db), _=Depends(exige_operador_ou_admin)):
    endereco = db.query(Endereco).filter(Endereco.id_endereco == id_endereco).first()
    if not endereco:
        raise HTTPException(status_code=404, detail="Endereço não encontrado")
    db.delete(endereco)
    db.commit()
    return {"mensagem": "Endereço deletado com sucesso"}