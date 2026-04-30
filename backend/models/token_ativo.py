from sqlalchemy import Column, BigInteger, String, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from database import Base


class TokenAtivo(Base):
    __tablename__ = "token_ativo"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    jti = Column(String(255), nullable=False, unique=True)
    id_usuario_fk = Column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=False)
    criado_em = Column(TIMESTAMP, nullable=False, server_default=func.now())
    exp = Column(TIMESTAMP, nullable=False)