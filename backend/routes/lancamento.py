from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models.lancamento import Lancamento
from models.usuario import Usuario
from models.cliente_fornecedor import ClienteFornecedor
from models.tipo_conta import tipo_conta
from schemas.lancamento import LancamentoCreate, LancamentoUpdate, LancamentoResponse, LancamentoResumo, ResumoPorTipo
from auth.dependencies import get_current_user
from utils.inadimplencia import atualizar_inadimplente
from typing import List, Optional
from datetime import date
from decimal import Decimal

router = APIRouter(
    prefix="/lancamento",
    tags=["Lançamento"]
)


@router.get("/resumo", response_model=LancamentoResumo)
def resumo_lancamentos(
    data_pagamento_de: Optional[date] = None,
    data_pagamento_ate: Optional[date] = None,
    id_clifor: Optional[int] = None,
    id_tipo_conta: Optional[int] = None,
    natureza: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    hoje = date.today()

    # ── Base de todos os lançamentos (sem filtro de período) ──
    def q_base():
        q = db.query(Lancamento)
        if id_clifor is not None:
            q = q.filter(Lancamento.id_clifor_relacionado_fk == id_clifor)
        if id_tipo_conta is not None:
            q = q.filter(Lancamento.id_tipo_conta_fk == id_tipo_conta)
        if natureza is not None:
            q = q.filter(Lancamento.natureza_lancamento == natureza)
        return q

    # ── Base filtrada por período de pagamento (realizados) ──
    def q_periodo():
        q = q_base().filter(Lancamento.data_pagamento != None)
        if data_pagamento_de is not None:
            q = q.filter(func.date(Lancamento.data_pagamento) >= data_pagamento_de)
        if data_pagamento_ate is not None:
            q = q.filter(func.date(Lancamento.data_pagamento) <= data_pagamento_ate)
        return q

    def soma(query, campo=None):
        col = campo if campo is not None else func.coalesce(Lancamento.valor_pago, Lancamento.valor)
        return db.query(func.coalesce(func.sum(col), 0)).filter(
            Lancamento.id_lancamento.in_(query.with_entities(Lancamento.id_lancamento))
        ).scalar()

    # Realizados no período
    q_recebido = q_periodo().filter(Lancamento.natureza_lancamento == "Credito", Lancamento.estorno == False)
    q_pago     = q_periodo().filter(Lancamento.natureza_lancamento == "Debito",  Lancamento.estorno == False)
    q_reemb    = q_periodo().filter(Lancamento.estorno == True)

    total_recebido   = Decimal(soma(q_recebido))
    total_pago       = Decimal(soma(q_pago))
    total_reembolsado = Decimal(soma(q_reemb))

    # Saldo total desde o primeiro lançamento (ignora filtro de período)
    q_all_credito = q_base().filter(Lancamento.data_pagamento != None, Lancamento.natureza_lancamento == "Credito", Lancamento.estorno == False)
    q_all_debito  = q_base().filter(Lancamento.data_pagamento != None, Lancamento.natureza_lancamento == "Debito",  Lancamento.estorno == False)
    saldo_total = Decimal(soma(q_all_credito)) - Decimal(soma(q_all_debito))

    # Pendentes (abertos)
    q_abertos = q_base().filter(Lancamento.data_pagamento == None, Lancamento.estorno == False)
    q_a_receber = q_abertos.filter(Lancamento.natureza_lancamento == "Credito")
    q_a_pagar   = q_abertos.filter(Lancamento.natureza_lancamento == "Debito")

    total_a_receber = Decimal(db.query(func.coalesce(func.sum(Lancamento.valor), 0)).filter(
        Lancamento.id_lancamento.in_(q_a_receber.with_entities(Lancamento.id_lancamento))
    ).scalar())

    total_a_pagar = Decimal(db.query(func.coalesce(func.sum(Lancamento.valor), 0)).filter(
        Lancamento.id_lancamento.in_(q_a_pagar.with_entities(Lancamento.id_lancamento))
    ).scalar())

    # A receber excluindo inadimplentes
    ids_adimplentes = db.query(ClienteFornecedor.id_clifor).filter(ClienteFornecedor.inadimplente == False)
    total_a_receber_excl = Decimal(db.query(func.coalesce(func.sum(Lancamento.valor), 0)).filter(
        Lancamento.id_lancamento.in_(q_a_receber.with_entities(Lancamento.id_lancamento)),
        Lancamento.id_clifor_relacionado_fk.in_(ids_adimplentes)
    ).scalar())

    # Vencidos
    q_vencidos = q_abertos.filter(Lancamento.data_vencimento < hoje)
    total_vencido_a_receber = Decimal(db.query(func.coalesce(func.sum(Lancamento.valor), 0)).filter(
        Lancamento.id_lancamento.in_(q_vencidos.filter(Lancamento.natureza_lancamento == "Credito").with_entities(Lancamento.id_lancamento))
    ).scalar())
    total_vencido_a_pagar = Decimal(db.query(func.coalesce(func.sum(Lancamento.valor), 0)).filter(
        Lancamento.id_lancamento.in_(q_vencidos.filter(Lancamento.natureza_lancamento == "Debito").with_entities(Lancamento.id_lancamento))
    ).scalar())

    quantidade_abertos  = q_abertos.count()
    quantidade_vencidos = q_vencidos.count()
    quantidade_inadimplentes = db.query(func.count(ClienteFornecedor.id_clifor)).filter(ClienteFornecedor.inadimplente == True).scalar()

    return LancamentoResumo(
        total_recebido=total_recebido,
        total_pago=total_pago,
        total_reembolsado=total_reembolsado,
        saldo_total=saldo_total,
        total_a_receber=total_a_receber,
        total_a_pagar=total_a_pagar,
        total_a_receber_excluindo_inadimplentes=total_a_receber_excl,
        total_vencido_a_receber=total_vencido_a_receber,
        total_vencido_a_pagar=total_vencido_a_pagar,
        quantidade_abertos=quantidade_abertos,
        quantidade_vencidos=quantidade_vencidos,
        quantidade_inadimplentes=quantidade_inadimplentes,
    )


@router.get("/resumo-por-tipo", response_model=List[ResumoPorTipo])
def resumo_por_tipo(
    data_pagamento_de: Optional[date] = None,
    data_pagamento_ate: Optional[date] = None,
    natureza: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    q = (
        db.query(
            tipo_conta.id_tipo_conta,
            tipo_conta.descricao_conta,
            tipo_conta.natureza_conta,
            func.coalesce(func.sum(func.coalesce(Lancamento.valor_pago, Lancamento.valor)), 0).label("total"),
            func.count(Lancamento.id_lancamento).label("quantidade")
        )
        .join(Lancamento, Lancamento.id_tipo_conta_fk == tipo_conta.id_tipo_conta)
        .filter(Lancamento.data_pagamento != None, Lancamento.estorno == False)
    )
    if data_pagamento_de is not None:
        q = q.filter(func.date(Lancamento.data_pagamento) >= data_pagamento_de)
    if data_pagamento_ate is not None:
        q = q.filter(func.date(Lancamento.data_pagamento) <= data_pagamento_ate)
    if natureza is not None:
        q = q.filter(tipo_conta.natureza_conta == natureza)

    q = q.group_by(tipo_conta.id_tipo_conta, tipo_conta.descricao_conta, tipo_conta.natureza_conta)
    q = q.order_by(func.sum(func.coalesce(Lancamento.valor_pago, Lancamento.valor)).desc())

    return [
        ResumoPorTipo(
            id_tipo_conta=r.id_tipo_conta,
            descricao_conta=r.descricao_conta,
            natureza_conta=r.natureza_conta,
            total=Decimal(r.total),
            quantidade=r.quantidade
        )
        for r in q.all()
    ]


@router.get("/", response_model=List[LancamentoResponse])
def listar_lancamentos(
    id_clifor: Optional[int] = None,
    id_tipo_conta: Optional[int] = None,
    natureza: Optional[str] = None,
    apenas_abertos: Optional[bool] = None,
    apenas_vencidos: Optional[bool] = None,
    apenas_quitados: Optional[bool] = None,
    apenas_com_comprovante: Optional[bool] = None,
    apenas_sem_comprovante: Optional[bool] = None,
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
    if apenas_quitados:
        query = query.filter(Lancamento.data_pagamento != None)
    if apenas_com_comprovante:
        query = query.filter(Lancamento.comprovante != None)
    if apenas_sem_comprovante:
        query = query.filter(Lancamento.comprovante == None)
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
    atualizar_inadimplente(lancamento.id_clifor_relacionado_fk, db)
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
    atualizar_inadimplente(lancamento.id_clifor_relacionado_fk, db)
    return lancamento


@router.post("/{id_lancamento}/comprovante")
async def anexar_comprovante(
    id_lancamento: int,
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    lancamento = db.query(Lancamento).filter(Lancamento.id_lancamento == id_lancamento).first()
    if not lancamento:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")

    if arquivo.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são aceitos")

    conteudo = await arquivo.read()
    if len(conteudo) > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(status_code=400, detail="Arquivo muito grande. Máximo 5MB.")

    lancamento.comprovante = conteudo
    lancamento.comprovante_nome = arquivo.filename
    db.commit()
    return {"detail": "Comprovante anexado com sucesso", "nome": arquivo.filename}


@router.get("/{id_lancamento}/comprovante")
def baixar_comprovante(
    id_lancamento: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    lancamento = db.query(Lancamento).filter(Lancamento.id_lancamento == id_lancamento).first()
    if not lancamento:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    if not lancamento.comprovante:
        raise HTTPException(status_code=404, detail="Este lançamento não possui comprovante")

    return Response(
        content=lancamento.comprovante,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{lancamento.comprovante_nome or "comprovante.pdf"}"'}
    )


@router.delete("/{id_lancamento}/comprovante")
def remover_comprovante(
    id_lancamento: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    lancamento = db.query(Lancamento).filter(Lancamento.id_lancamento == id_lancamento).first()
    if not lancamento:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    if not lancamento.comprovante:
        raise HTTPException(status_code=404, detail="Este lançamento não possui comprovante")
    lancamento.comprovante = None
    lancamento.comprovante_nome = None
    db.commit()
    return {"detail": "Comprovante removido com sucesso"}


@router.delete("/{id_lancamento}")
def deletar_lancamento(id_lancamento: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    lancamento = db.query(Lancamento).filter(Lancamento.id_lancamento == id_lancamento).first()
    if not lancamento:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    id_clifor = lancamento.id_clifor_relacionado_fk
    db.delete(lancamento)
    db.commit()
    atualizar_inadimplente(id_clifor, db)
    return {"mensagem": "Lançamento deletado com sucesso"}