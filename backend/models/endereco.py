from sqlalchemy import Column, BigInteger, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Endereco(Base):
    __tablename__ = "endereco"

    id_endereco = Column(BigInteger, primary_key=True, autoincrement=True)
    id_clifor_fk = Column(BigInteger, ForeignKey("clientefornecedor.id_clifor"), nullable=False)
    enderecoprimario = Column(Boolean, nullable=False, default=False)
    logradouro = Column(String(255), nullable=False)
    numero = Column(String(255), nullable=False)
    complemento = Column(String(255), nullable=True, default=None)
    bairro = Column(String(255), nullable=False)
    cidade = Column(String(255), nullable=False)
    uf = Column(String(2), nullable=False)
    cep = Column(String(9), nullable=False)