from sqlalchemy import Column, BigInteger, String, Boolean, Date
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
    pessoafisica_juridica = Column(Boolean, nullable=False)
    cpf_cnpj = Column(String(255), nullable=False)
    rg_inscricaoestadual = Column(String(255), nullable=True)
    nome = Column(String(255), nullable=False)
    nome_usual = Column(String(255), nullable=True)
    lote = Column(String(255), nullable=True)
    datanascimento = Column(Date, nullable=True)
    tipo_clifor = Column(SAEnum(TipoCliForEnum, name="tipo_clifor_enum", values_callable=lambda x: [e.value for e in x]), nullable=False)
    ativo = Column(Boolean, nullable=False, default=True)
    inadimplente = Column(Boolean, nullable=False, default=False)
    bloqueado = Column(Boolean, nullable=False, default=False)
    associado = Column(Boolean, nullable=False, default=False)

    # O vinculo com usuario agora vive em Usuario.id_clifor_fk (um clifor -> N usuarios);
    # o backref "usuarios" (lista) e definido la, em models/usuario.py.
    enderecos = relationship("Endereco", backref="cliente_fornecedor", cascade="all, delete-orphan")
    contatos = relationship("Contato", backref="cliente_fornecedor", cascade="all, delete-orphan")

    @property
    def usuarios_vinculados(self):
        # Usuarios ativos ligados a este clifor. O soft-delete (routes/usuario.py) marca
        # exclusao mas NAO zera id_clifor_fk, entao um usuario excluido continua no backref
        # "usuarios" — filtramos para nunca expo-lo como vinculado.
        return [u for u in self.usuarios if u.exclusao is None]