from datetime import date
from sqlalchemy.orm import Session
from models.cliente_fornecedor import ClienteFornecedor
from models.lancamento import Lancamento


def atualizar_inadimplente(id_clifor: int, db: Session) -> None:
    """
    Reavalia e atualiza o campo inadimplente do clifor.
    Um clifor é inadimplente se tiver pelo menos um lançamento de Crédito
    vencido, não aprovado e não estornado.

    Olha data_aprovacao, não data_pagamento: enquanto o lançamento está Em análise
    o dinheiro ainda não entrou no caixa, então a dívida continua de pé. Efetivar
    não limpa a inadimplência — só a aprovação do admin limpa.
    """
    clifor = db.query(ClienteFornecedor).filter(ClienteFornecedor.id_clifor == id_clifor).first()
    if not clifor:
        return

    tem_vencido = db.query(Lancamento).filter(
        Lancamento.id_clifor_relacionado_fk == id_clifor,
        Lancamento.natureza_lancamento == "Credito",
        Lancamento.data_aprovacao == None,
        Lancamento.estorno == False,
        Lancamento.data_vencimento < date.today()
    ).first() is not None

    if clifor.inadimplente != tem_vencido:
        clifor.inadimplente = tem_vencido
        db.commit()