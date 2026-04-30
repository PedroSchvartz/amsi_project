from sqlalchemy import Column, BigInteger, String, Boolean, Integer, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy import Enum as SAEnum
from database import Base
import enum

class CargoEnum(enum.Enum):
    Diretor = "Diretor"
    Tesoureiro = "Tesoureiro"
    Secretario = "Secretário"
    Conselheiro = "Conselheiro"
    Associado = "Associado"

class AcessoEnum(enum.Enum):
    Administrador = "Administrador"
    Consulta = "Consulta"

class Usuario(Base):
    __tablename__ = "usuario"

    id_usuario = Column(BigInteger, primary_key=True, autoincrement=True)
    senha = Column(String(255), nullable=False)
    nome = Column(String(255), nullable=False)
    data_cadastro = Column(TIMESTAMP, nullable=False, server_default=func.now())
    email = Column(String(255), nullable=False)
    cargo = Column(SAEnum(CargoEnum, name="cargo_enum"), nullable=False)
    perfil_de_acesso = Column(SAEnum(AcessoEnum, name="acesso_enum"), nullable=False)
    notificacao = Column(Boolean, nullable=False, default=False)
    suspenso = Column(TIMESTAMP, nullable=True, default=None)
    qtd_suspensao = Column(Integer, default=0)
    bloqueado = Column(Boolean, nullable=False, default=False)
    exclusao = Column(TIMESTAMP, nullable=True, default=None)
    primeiro_acesso = Column(Boolean, nullable=False, default=True)