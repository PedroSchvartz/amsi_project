from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, exists
from database import get_db
from models.cliente_fornecedor import ClienteFornecedor
from models.endereco import Endereco
from models.contato import Contato
from models.lancamento import Lancamento
from models.usuario import Usuario
from schemas.cliente_fornecedor import (
    ClienteFornecedorCreate,
    ClienteFornecedorUpdate,
    ClienteFornecedorResponse,
    CliForResumo
)
from auth.dependencies import get_current_user
from typing import List, Optional
from datetime import date
from decimal import Decimal

router = APIRouter(
    prefix="/cliente_fornecedor",
    tags=["Cliente/Fornecedor"]
)


@router.get("/", response_model=List[ClienteFornecedorResponse])
def listar_clifors(
    nome: Optional[str] = None,
    tipo_clifor: Optional[str] = None,
    ativo: Optional[bool] = None,
    inadimplente: Optional[bool] = None,
    apenas_pendentes: Optional[bool] = None,
    pessoafisica_juridica: Optional[bool] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    query = db.query(ClienteFornecedor)

    if nome is not None:
        query = query.filter(ClienteFornecedor.nome.ilike(f"%{nome}%"))
    if tipo_clifor is not None:
        query = query.filter(ClienteFornecedor.tipo_clifor == tipo_clifor)
    if ativo is not None:
        query = query.filter(ClienteFornecedor.ativo == ativo)
    if inadimplente is not None:
        query = query.filter(ClienteFornecedor.inadimplente == inadimplente)
    if pessoafisica_juridica is not None:
        query = query.filter(ClienteFornecedor.pessoafisica_juridica == pessoafisica_juridica)
    if apenas_pendentes:
        query = query.filter(
            exists().where(
                (Lancamento.id_clifor_relacionado_fk == ClienteFornecedor.id_clifor) &
                (Lancamento.data_pagamento == None)
            )
        )

    return query.all()


@router.get("/{id_clifor}/resumo", response_model=CliForResumo)
def resumo_clifor(id_clifor: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    clifor = db.query(ClienteFornecedor).filter(ClienteFornecedor.id_clifor == id_clifor).first()
    if not clifor:
        raise HTTPException(status_code=404, detail="Cliente/Fornecedor não encontrado")

    hoje = date.today()

    total_a_receber = db.query(
        func.coalesce(func.sum(Lancamento.valor), 0)
    ).filter(
        Lancamento.id_clifor_relacionado_fk == id_clifor,
        Lancamento.natureza_lancamento == "Credito",
        Lancamento.data_pagamento == None
    ).scalar()

    total_a_pagar = db.query(
        func.coalesce(func.sum(Lancamento.valor), 0)
    ).filter(
        Lancamento.id_clifor_relacionado_fk == id_clifor,
        Lancamento.natureza_lancamento == "Debito",
        Lancamento.data_pagamento == None
    ).scalar()

    total_vencido_a_receber = db.query(
        func.coalesce(func.sum(Lancamento.valor), 0)
    ).filter(
        Lancamento.id_clifor_relacionado_fk == id_clifor,
        Lancamento.natureza_lancamento == "Credito",
        Lancamento.data_pagamento == None,
        Lancamento.data_vencimento < hoje
    ).scalar()

    total_vencido_a_pagar = db.query(
        func.coalesce(func.sum(Lancamento.valor), 0)
    ).filter(
        Lancamento.id_clifor_relacionado_fk == id_clifor,
        Lancamento.natureza_lancamento == "Debito",
        Lancamento.data_pagamento == None,
        Lancamento.data_vencimento < hoje
    ).scalar()

    quantidade_abertos = db.query(func.count(Lancamento.id_lancamento)).filter(
        Lancamento.id_clifor_relacionado_fk == id_clifor,
        Lancamento.data_pagamento == None
    ).scalar()

    quantidade_vencidos = db.query(func.count(Lancamento.id_lancamento)).filter(
        Lancamento.id_clifor_relacionado_fk == id_clifor,
        Lancamento.data_pagamento == None,
        Lancamento.data_vencimento < hoje
    ).scalar()

    return CliForResumo(
        id_clifor=clifor.id_clifor,
        nome=clifor.nome,
        total_a_receber=Decimal(total_a_receber),
        total_a_pagar=Decimal(total_a_pagar),
        saldo_liquido=Decimal(total_a_receber) - Decimal(total_a_pagar),
        total_vencido_a_receber=Decimal(total_vencido_a_receber),
        total_vencido_a_pagar=Decimal(total_vencido_a_pagar),
        quantidade_abertos=quantidade_abertos,
        quantidade_vencidos=quantidade_vencidos,
    )


@router.get("/{id_clifor}", response_model=ClienteFornecedorResponse)
def buscar_clifor(id_clifor: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    clifor = db.query(ClienteFornecedor).filter(ClienteFornecedor.id_clifor == id_clifor).first()
    if not clifor:
        raise HTTPException(status_code=404, detail="Cliente/Fornecedor não encontrado")
    return clifor


@router.post("/", response_model=ClienteFornecedorResponse)
def criar_clifor(dados: ClienteFornecedorCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if dados.id_usuario_fk:
        if not db.query(Usuario).filter(Usuario.id_usuario == dados.id_usuario_fk).first():
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

    clifor_data = dados.model_dump(exclude={"enderecos", "contatos"})
    clifor = ClienteFornecedor(**clifor_data)
    db.add(clifor)
    db.flush()  # gera id_clifor sem commitar

    if dados.enderecos:
        for end in dados.enderecos:
            db.add(Endereco(id_clifor_fk=clifor.id_clifor, **end.model_dump()))

    if dados.contatos:
        for cont in dados.contatos:
            db.add(Contato(id_clifor_fk=clifor.id_clifor, **cont.model_dump()))

    db.commit()
    db.refresh(clifor)
    return clifor


@router.put("/{id_clifor}", response_model=ClienteFornecedorResponse)
def atualizar_clifor(id_clifor: int, dados: ClienteFornecedorUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    clifor = db.query(ClienteFornecedor).filter(ClienteFornecedor.id_clifor == id_clifor).first()
    if not clifor:
        raise HTTPException(status_code=404, detail="Cliente/Fornecedor não encontrado")

    if dados.id_usuario_fk:
        if not db.query(Usuario).filter(Usuario.id_usuario == dados.id_usuario_fk).first():
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

    for campo, valor in dados.model_dump(exclude_unset=True, exclude={"enderecos", "contatos"}).items():
        setattr(clifor, campo, valor)

    if dados.enderecos:
        for end in dados.enderecos:
            db.add(Endereco(id_clifor_fk=clifor.id_clifor, **end.model_dump()))

    if dados.contatos:
        for cont in dados.contatos:
            db.add(Contato(id_clifor_fk=clifor.id_clifor, **cont.model_dump()))

    db.commit()
    db.refresh(clifor)
    return clifor


@router.delete("/{id_clifor}")
def deletar_clifor(id_clifor: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    clifor = db.query(ClienteFornecedor).filter(ClienteFornecedor.id_clifor == id_clifor).first()
    if not clifor:
        raise HTTPException(status_code=404, detail="Cliente/Fornecedor não encontrado")
    db.delete(clifor)
    db.commit()
    return {"mensagem": "Cliente/Fornecedor deletado com sucesso"}