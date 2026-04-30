from sqlalchemy import Column, BigInteger, String, Boolean, ForeignKey
from database import Base


class Contato(Base):
    __tablename__ = "contato"

    id_contato = Column(BigInteger, primary_key=True, autoincrement=True)
    id_clifor_fk = Column(BigInteger, ForeignKey("clientefornecedor.id_clifor"), nullable=False)
    tipocontato = Column(String(255), nullable=False)
    info_do_contato = Column(String(255), nullable=False)
    contato_principal = Column(Boolean, nullable=False, default=False)