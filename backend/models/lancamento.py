from sqlalchemy import Column, BigInteger, TIMESTAMP, Date, DECIMAL, Boolean, Text, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

import enum


class NaturezaLancamentoEnum(enum.Enum):
    Debito = "Debito"
    Credito = "Credito"


class Lancamento(Base):
    __tablename__ = "lancamento"

    id_lancamento = Column(BigInteger, primary_key=True, autoincrement=True)
    id_usuario_fk_lancamento = Column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=False)
    id_clifor_relacionado_fk = Column(BigInteger, ForeignKey("clientefornecedor.id_clifor"), nullable=False)
    id_tipo_conta_fk = Column(BigInteger, ForeignKey("tipo_conta.id_tipo_conta"), nullable=False)
    data_lancamento = Column(TIMESTAMP, nullable=False, server_default=func.now())
    valor = Column(DECIMAL(15, 2), nullable=False)
    data_vencimento = Column(Date, nullable=False)
    multa = Column(DECIMAL(15, 2), nullable=True)
    juros = Column(DECIMAL(15, 2), nullable=True)
    id_usuario_fk_fechamento = Column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=True)
    data_pagamento = Column(TIMESTAMP, nullable=True)
    valor_pago = Column(DECIMAL(15, 2), nullable=True)
    observacao = Column(Text, nullable=True)
    natureza_lancamento = Column(SAEnum(NaturezaLancamentoEnum, name="natureza_enum", values_callable=lambda x: [e.value for e in x]), nullable=False)
    estorno = Column(Boolean, nullable=False, default=False)

    usuario_lancamento = relationship("Usuario", foreign_keys=[id_usuario_fk_lancamento], backref="lancamentos_criados")
    usuario_fechamento = relationship("Usuario", foreign_keys=[id_usuario_fk_fechamento], backref="lancamentos_fechados")
    cliente_fornecedor = relationship("ClienteFornecedor", backref="lancamentos")
    tipo_conta_rel = relationship("tipo_conta", backref="lancamentos")