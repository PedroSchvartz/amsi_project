from sqlalchemy import Column, BigInteger, String, Boolean, ForeignKey, Index
from database import Base


class Contato(Base):
    __tablename__ = "contato"
    # FK indexada (nome casa com a migração em main.py e o tabelas_do_banco.txt).
    __table_args__ = (Index("idx_contato_clifor", "id_clifor_fk"),)

    id_contato = Column(BigInteger, primary_key=True, autoincrement=True)
    id_clifor_fk = Column(BigInteger, ForeignKey("clientefornecedor.id_clifor"), nullable=False)
    tipocontato = Column(String(255), nullable=False)
    info_do_contato = Column(String(255), nullable=False)
    contato_principal = Column(Boolean, nullable=False, default=False)