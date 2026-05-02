from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models.lancamento import Lancamento
from models.usuario import Usuario
from models.cliente_fornecedor import ClienteFornecedor
from models.tipo_conta import tipo_conta
from schemas.lancamento import LancamentoCreate, LancamentoUpdate, LancamentoResponse, LancamentoResumo
from auth.dependencies import get_current_user
from typing import List, Optional
from datetime import date
from decimal import Decimal

router = APIRouter(
    prefix="/lancamento",
    tags=["Lançamento"]
)


@router.get("/resumo", response_model=LancamentoResumo)
def resumo_lancamentos(
    id_clifor: Optional[int] = None,
    id_tipo_conta: Optional[int] = None,
    natureza: Optional[str] = None,
    apenas_abertos: Optional[bool] = None,
    data_vencimento_de: Optional[date] = None,
    data_vencimento_ate: Optional[date] = None,
    data_lancamento_de: Optional[date] = None,
    data_lancamento_ate: Optional[date] = None,
    estorno: Optional[bool] = None,
    valor_minimo: Optional[Decimal] = None,
    valor_maximo: Optional[Decimal] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    hoje = date.today()

    def base_query():
        q = db.query(Lancamento)
        if id_clifor is not None:
            q = q.filter(Lancamento.id_clifor_relacionado_fk == id_clifor)
        if id_tipo_conta is not None:
            q = q.filter(Lancamento.id_tipo_conta_fk == id_tipo_conta)
        if natureza is not None:
            q = q.filter(Lancamento.natureza_lancamento == natureza)
        if apenas_abertos:
            q = q.filter(Lancamento.data_pagamento == None)
        if data_vencimento_de is not None:
            q = q.filter(Lancamento.data_vencimento >= data_vencimento_de)
        if data_vencimento_ate is not None:
            q = q.filter(Lancamento.data_vencimento <= data_vencimento_ate)
        if data_lancamento_de is not None:
            q = q.filter(Lancamento.data_lancamento >= data_lancamento_de)
        if data_lancamento_ate is not None:
            q = q.filter(Lancamento.data_lancamento <= data_lancamento_ate)
        if estorno is not None:
            q = q.filter(Lancamento.estorno == estorno)
        if valor_minimo is not None:
            q = q.filter(Lancamento.valor >= valor_minimo)
        if valor_maximo is not None:
            q = q.filter(Lancamento.valor <= valor_maximo)
        return q

    q = base_query()

    total_a_receber = db.query(
        func.coalesce(func.sum(Lancamento.valor), 0)
    ).filter(
        Lancamento.natureza_lancamento == "Credito",
        Lancamento.data_pagamento == None,
        Lancamento.id_lancamento.in_(q.with_entities(Lancamento.id_lancamento))
    ).scalar()

    total_a_pagar = db.query(
        func.coalesce(func.sum(Lancamento.valor), 0)
    ).filter(
        Lancamento.natureza_lancamento == "Debito",
        Lancamento.data_pagamento == None,
        Lancamento.id_lancamento.in_(q.with_entities(Lancamento.id_lancamento))
    ).scalar()

    total_vencido_a_receber = db.query(
        func.coalesce(func.sum(Lancamento.valor), 0)
    ).filter(
        Lancamento.natureza_lancamento == "Credito",
        Lancamento.data_pagamento == None,
        Lancamento.data_vencimento < hoje,
        Lancamento.id_lancamento.in_(q.with_entities(Lancamento.id_lancamento))
    ).scalar()

    total_vencido_a_pagar = db.query(
        func.coalesce(func.sum(Lancamento.valor), 0)
    ).filter(
        Lancamento.natureza_lancamento == "Debito",
        Lancamento.data_pagamento == None,
        Lancamento.data_vencimento < hoje,
        Lancamento.id_lancamento.in_(q.with_entities(Lancamento.id_lancamento))
    ).scalar()

    quantidade_abertos = db.query(func.count(Lancamento.id_lancamento)).filter(
        Lancamento.data_pagamento == None,
        Lancamento.id_lancamento.in_(q.with_entities(Lancamento.id_lancamento))
    ).scalar()

    quantidade_vencidos = db.query(func.count(Lancamento.id_lancamento)).filter(
        Lancamento.data_pagamento == None,
        Lancamento.data_vencimento < hoje,
        Lancamento.id_lancamento.in_(q.with_entities(Lancamento.id_lancamento))
    ).scalar()

    return LancamentoResumo(
        total_a_receber=Decimal(total_a_receber),
        total_a_pagar=Decimal(total_a_pagar),
        saldo_liquido=Decimal(total_a_receber) - Decimal(total_a_pagar),
        total_vencido_a_receber=Decimal(total_vencido_a_receber),
        total_vencido_a_pagar=Decimal(total_vencido_a_pagar),
        quantidade_abertos=quantidade_abertos,
        quantidade_vencidos=quantidade_vencidos,
    )


@router.get("/", response_model=List[LancamentoResponse])
def listar_lancamentos(
    id_clifor: Optional[int] = None,
    id_tipo_conta: Optional[int] = None,
    natureza: Optional[str] = None,
    apenas_abertos: Optional[bool] = None,
    apenas_vencidos: Optional[bool] = None,
    data_vencimento_de: Optional[date] = None,
    data_vencimento_ate: Optional[date] = None,
    data_lancamento_de: Optional[date] = None,
    data_lancamento_ate: Optional[date] = None,
    estorno: Optional[bool] = None,
    valor_minimo: Optional[Decimal] = None,
    valor_maximo: Optional[Decimal] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    query = db.query(Lancamento).join(
        ClienteFornecedor,
        Lancamento.id_clifor_relacionado_fk == ClienteFornecedor.id_clifor
    )

    if id_clifor is not None:
        query = query.filter(Lancamento.id_clifor_relacionado_fk == id_clifor)
    if id_tipo_conta is not None:
        query = query.filter(Lancamento.id_tipo_conta_fk == id_tipo_conta)
    if natureza is not None:
        query = query.filter(Lancamento.natureza_lancamento == natureza)
    if apenas_abertos:
        query = query.filter(Lancamento.data_pagamento == None)
    if apenas_vencidos:
        query = query.filter(
            Lancamento.data_pagamento == None,
            Lancamento.data_vencimento < date.today()
        )
    if data_vencimento_de is not None:
        query = query.filter(Lancamento.data_vencimento >= data_vencimento_de)
    if data_vencimento_ate is not None:
        query = query.filter(Lancamento.data_vencimento <= data_vencimento_ate)
    if data_lancamento_de is not None:
        query = query.filter(Lancamento.data_lancamento >= data_lancamento_de)
    if data_lancamento_ate is not None:
        query = query.filter(Lancamento.data_lancamento <= data_lancamento_ate)
    if estorno is not None:
        query = query.filter(Lancamento.estorno == estorno)
    if valor_minimo is not None:
        query = query.filter(Lancamento.valor >= valor_minimo)
    if valor_maximo is not None:
        query = query.filter(Lancamento.valor <= valor_maximo)

    query = query.order_by(Lancamento.data_vencimento, ClienteFornecedor.nome)

    return query.all()


@router.get("/{id_lancamento}", response_model=LancamentoResponse)
def buscar_lancamento(id_lancamento: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    lancamento = db.query(Lancamento).filter(Lancamento.id_lancamento == id_lancamento).first()
    if not lancamento:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    return lancamento


@router.get("/por-clifor/{id_clifor}", response_model=List[LancamentoResponse])
def listar_lancamentos_por_clifor(id_clifor: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Lancamento).filter(
        Lancamento.id_clifor_relacionado_fk == id_clifor
    ).order_by(Lancamento.data_vencimento).all()


@router.get("/por-usuario/{id_usuario}", response_model=List[LancamentoResponse])
def listar_lancamentos_por_usuario(id_usuario: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Lancamento).filter(
        Lancamento.id_usuario_fk_lancamento == id_usuario
    ).join(
        ClienteFornecedor,
        Lancamento.id_clifor_relacionado_fk == ClienteFornecedor.id_clifor
    ).order_by(Lancamento.data_vencimento, ClienteFornecedor.nome).all()


@router.post("/", response_model=LancamentoResponse)
def criar_lancamento(dados: LancamentoCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if not db.query(Usuario).filter(Usuario.id_usuario == dados.id_usuario_fk_lancamento).first():
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if not db.query(ClienteFornecedor).filter(ClienteFornecedor.id_clifor == dados.id_clifor_relacionado_fk).first():
        raise HTTPException(status_code=404, detail="Cliente/Fornecedor não encontrado")
    if not db.query(tipo_conta).filter(tipo_conta.id_tipo_conta == dados.id_tipo_conta_fk).first():
        raise HTTPException(status_code=404, detail="Tipo de lançamento não encontrado")
    lancamento = Lancamento(**dados.model_dump())
    db.add(lancamento)
    db.commit()
    db.refresh(lancamento)
    return lancamento


@router.put("/{id_lancamento}", response_model=LancamentoResponse)
def fechar_lancamento(id_lancamento: int, dados: LancamentoUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    lancamento = db.query(Lancamento).filter(Lancamento.id_lancamento == id_lancamento).first()
    if not lancamento:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    if dados.id_usuario_fk_fechamento:
        if not db.query(Usuario).filter(Usuario.id_usuario == dados.id_usuario_fk_fechamento).first():
            raise HTTPException(status_code=404, detail="Usuário de fechamento não encontrado")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(lancamento, campo, valor)
    db.commit()
    db.refresh(lancamento)
    return lancamento


@router.delete("/{id_lancamento}")
def deletar_lancamento(id_lancamento: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    lancamento = db.query(Lancamento).filter(Lancamento.id_lancamento == id_lancamento).first()
    if not lancamento:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    db.delete(lancamento)
    db.commit()
    return {"mensagem": "Lançamento deletado com sucesso"}