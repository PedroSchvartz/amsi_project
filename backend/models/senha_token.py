from sqlalchemy import Column, BigInteger, String, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from database import Base


class SenhaToken(Base):
    """Token de uso único para definição de senha (cadastro, reset e "esqueci a senha").

    Guardamos apenas o SHA-256 do token (nunca o valor em claro): um dump do banco
    não rende tokens utilizáveis. O token cru viaja só no fragment da URL (#token=),
    é trocado pelo corpo do POST e consumido uma única vez (usado_em).
    """
    __tablename__ = "senha_token"

    id            = Column(BigInteger, primary_key=True, autoincrement=True)
    id_usuario_fk = Column(BigInteger, ForeignKey("usuario.id_usuario", ondelete="CASCADE"), nullable=False)
    token_hash    = Column(String(64), nullable=False, unique=True, index=True)
    finalidade    = Column(String(20), nullable=False)  # "cadastro" | "reset"
    criado_em     = Column(TIMESTAMP, nullable=False, server_default=func.now())
    expira_em     = Column(TIMESTAMP, nullable=False)
    usado_em      = Column(TIMESTAMP, nullable=True)
