from sqlalchemy import Column, BigInteger, String, Boolean, Integer, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from database import Base
import enum

class CargoEnum(enum.Enum):
    Presidente = "Presidente"
    Diretor = "Diretor"
    Tesoureiro = "Tesoureiro"
    Secretario = "Secretário"
    Conselheiro = "Conselheiro"
    Associado = "Associado"
    Desenvolvedor = "Desenvolvedor"

class AcessoEnum(enum.Enum):
    Administrador = "Administrador"
    Operador = "Operador"
    Consulta = "Consulta"

class Usuario(Base):
    __tablename__ = "usuario"

    id_usuario = Column(BigInteger, primary_key=True, autoincrement=True)
    senha = Column(String(255), nullable=False)
    nome = Column(String(255), nullable=False)
    data_cadastro = Column(TIMESTAMP, nullable=False, server_default=func.now())
    email = Column(String(255), nullable=False)
    # values_callable: o cargo_enum no banco guarda os VALORES (ex.: "Secretário"
    # acentuado), nao os nomes dos membros — sem isto, gravar Secretario quebra.
    # nullable (item 15): "Associado" saiu das telas; ex-Associados ficam sem cargo (NULL).
    cargo = Column(SAEnum(CargoEnum, name="cargo_enum", values_callable=lambda x: [e.value for e in x]), nullable=True)
    perfil_de_acesso = Column(SAEnum(AcessoEnum, name="acesso_enum"), nullable=False)
    notificacao = Column(Boolean, nullable=False, default=False)
    suspenso = Column(TIMESTAMP, nullable=True, default=None)
    qtd_suspensao = Column(Integer, default=0)
    bloqueado = Column(Boolean, nullable=False, default=False)
    exclusao = Column(TIMESTAMP, nullable=True, default=None)
    primeiro_acesso = Column(Boolean, nullable=False, default=True)
    # Vinculo usuario -> clifor (lado "muitos"): um clifor pode ter varios usuarios,
    # cada usuario pertence a no maximo um clifor. Nullable: equipe (admin/operador)
    # pode nao ter clifor. backref "usuarios" da a lista de usuarios no clifor.
    id_clifor_fk = Column(BigInteger, ForeignKey("clientefornecedor.id_clifor"), nullable=True)

    clifor = relationship("ClienteFornecedor", backref="usuarios")