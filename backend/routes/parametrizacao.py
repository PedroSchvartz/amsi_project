from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from models.parametrizacao import Parametrizacao
from models.tipo_conta import tipo_conta as TipoConta
from models.cliente_fornecedor import ClienteFornecedor
from schemas.parametrizacao import ParametrizacaoCreate, ParametrizacaoUpdate, ParametrizacaoResponse
from auth.dependencies import exige_admin, exige_operador_ou_admin

router = APIRouter(
    prefix="/parametrizacao",
    tags=["Parametrização"]
)


def _to_response(p: Parametrizacao) -> ParametrizacaoResponse:
    ids = [c.id_clifor for c in p.clifors]
    return ParametrizacaoResponse(
        id_parametrizacao=p.id_parametrizacao,
        nome=p.nome,
        id_tipo_conta_fk=p.id_tipo_conta_fk,
        descricao_tipo_conta=p.tipo_conta_rel.descricao_conta if p.tipo_conta_rel else None,
        valor=p.valor,
        ids_clifor=ids,
        total=len(ids),
    )


def _validar_tipo(db: Session, id_tipo_conta: int) -> None:
    if not db.query(TipoConta).filter(TipoConta.id_tipo_conta == id_tipo_conta).first():
        raise HTTPException(status_code=404, detail="Tipo de conta não encontrado")


def _resolver_clifors(db: Session, ids: List[int]) -> List[ClienteFornecedor]:
    ids = list(dict.fromkeys(ids or []))  # dedup preservando ordem
    if not ids:
        return []
    encontrados = db.query(ClienteFornecedor).filter(ClienteFornecedor.id_clifor.in_(ids)).all()
    if len(encontrados) != len(ids):
        raise HTTPException(status_code=400, detail="Um ou mais clientes/fornecedores não existem.")
    return encontrados


@router.get("/", response_model=List[ParametrizacaoResponse])
def listar_parametrizacoes(
    id_tipo_conta: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(exige_operador_ou_admin),
):
    """Lista as parametrizacoes. Com `id_tipo_conta`, filtra as daquele tipo —
    o Novo Lancamento usa isso para carregar a selecao ao escolher o Tipo de Conta."""
    q = db.query(Parametrizacao)
    if id_tipo_conta is not None:
        q = q.filter(Parametrizacao.id_tipo_conta_fk == id_tipo_conta)
    return [_to_response(p) for p in q.order_by(Parametrizacao.nome).all()]


@router.post("/", response_model=ParametrizacaoResponse)
def criar_parametrizacao(dados: ParametrizacaoCreate, db: Session = Depends(get_db), _=Depends(exige_admin)):
    _validar_tipo(db, dados.id_tipo_conta_fk)
    p = Parametrizacao(nome=dados.nome, id_tipo_conta_fk=dados.id_tipo_conta_fk, valor=dados.valor)
    p.clifors = _resolver_clifors(db, dados.ids_clifor)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_response(p)


@router.put("/{id_parametrizacao}", response_model=ParametrizacaoResponse)
def atualizar_parametrizacao(
    id_parametrizacao: int,
    dados: ParametrizacaoUpdate,
    db: Session = Depends(get_db),
    _=Depends(exige_admin),
):
    p = db.query(Parametrizacao).filter(Parametrizacao.id_parametrizacao == id_parametrizacao).first()
    if not p:
        raise HTTPException(status_code=404, detail="Parametrização não encontrada")
    _validar_tipo(db, dados.id_tipo_conta_fk)
    p.nome = dados.nome
    p.id_tipo_conta_fk = dados.id_tipo_conta_fk
    p.valor = dados.valor
    p.clifors = _resolver_clifors(db, dados.ids_clifor)
    db.commit()
    db.refresh(p)
    return _to_response(p)


@router.delete("/{id_parametrizacao}")
def deletar_parametrizacao(id_parametrizacao: int, db: Session = Depends(get_db), _=Depends(exige_admin)):
    p = db.query(Parametrizacao).filter(Parametrizacao.id_parametrizacao == id_parametrizacao).first()
    if not p:
        raise HTTPException(status_code=404, detail="Parametrização não encontrada")
    db.delete(p)
    db.commit()
    return {"mensagem": "Parametrização excluída com sucesso"}
