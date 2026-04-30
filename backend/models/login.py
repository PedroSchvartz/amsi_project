from sqlalchemy import Column, BigInteger, String, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class Login(Base):
    __tablename__ = "login"

    id_login = Column(BigInteger, primary_key=True, autoincrement=True)
    data_login = Column(TIMESTAMP, nullable=False, server_default=func.now())
    data_logout = Column(TIMESTAMP, nullable=True, default=None)
    id_usuario_fk = Column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=False)
    dispositivo_logado = Column(String(255), nullable=False)
    localizacao = Column(String(255), nullable=False)
    navegador = Column(String(255), nullable=False)

    usuario = relationship("Usuario", backref="logins")