from sqlalchemy import Column, BigInteger, String, Integer, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from database import Base


class LogAtividade(Base):
    __tablename__ = "log_atividade"

    id_log        = Column(BigInteger, primary_key=True, autoincrement=True)
    id_login_fk   = Column(BigInteger, ForeignKey("login.id_login", ondelete="SET NULL"), nullable=True)
    id_usuario_fk = Column(BigInteger, ForeignKey("usuario.id_usuario", ondelete="SET NULL"), nullable=True)
    timestamp     = Column(TIMESTAMP, nullable=False, server_default=func.now())
    metodo        = Column(String(10), nullable=False)
    endpoint      = Column(String(255), nullable=False)
    entidade      = Column(String(100), nullable=True)
    id_entidade   = Column(BigInteger, nullable=True)
    descricao     = Column(String(255), nullable=True)
    status_code   = Column(Integer, nullable=False)
