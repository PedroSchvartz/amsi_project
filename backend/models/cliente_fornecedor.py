from sqlalchemy import Column, BigInteger, String, Boolean, Date, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from database import Base

import enum


class TipoCliForEnum(enum.Enum):
    Cliente = "C"
    Fornecedor = "F"
    Ambos = "A"


class ClienteFornecedor(Base):
    __tablename__ = "clientefornecedor"

    id_clifor = Column(BigInteger, primary_key=True, autoincrement=True)
    id_usuario_fk = Column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=True)
    pessoafisica_juridica = Column(Boolean, nullable=False)
    cpf_cnpj = Column(String(255), nullable=False)
    rg_inscricaoestadual = Column(String(255), nullable=False)
    nome = Column(String(255), nullable=False)
    datanascimento = Column(Date, nullable=False)
    tipo_clifor = Column(SAEnum(TipoCliForEnum, name="tipo_clifor_enum", values_callable=lambda x: [e.value for e in x]), nullable=False)
    ativo = Column(Boolean, nullable=False, default=True)
    inadimplente = Column(Boolean, nullable=False, default=False)

    usuario = relationship("Usuario", backref="clientes_fornecedores")
    enderecos = relationship("Endereco", backref="cliente_fornecedor", cascade="all, delete-orphan")
    contatos = relationship("Contato", backref="cliente_fornecedor", cascade="all, delete-orphan")