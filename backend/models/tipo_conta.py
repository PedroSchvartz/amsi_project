from sqlalchemy import Column, BigInteger, String, Text
from sqlalchemy import Enum as SAEnum
from database import Base

import enum


class NaturezaEnum(enum.Enum):
    Debito = "Debito"
    Credito = "Credito"


class tipo_conta(Base):
    __tablename__ = "tipo_conta"

    id_tipo_conta = Column(BigInteger, primary_key=True, autoincrement=True)
    descricao_conta = Column(String(255), nullable=False)
    natureza_conta = Column(SAEnum(NaturezaEnum, name="natureza_enum", values_callable=lambda x: [e.value for e in x]), nullable=False)
    observacao = Column(Text, nullable=True, default=None)