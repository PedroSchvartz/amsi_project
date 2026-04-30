from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional
from datetime import datetime
from enum import Enum


class CargoEnum(str, Enum):
    Diretor = "Diretor"
    Tesoureiro = "Tesoureiro"
    Secretario = "Secretário"
    Conselheiro = "Conselheiro"
    Associado = "Associado"


class AcessoEnum(str, Enum):
    Administrador = "Administrador"
    Consulta = "Consulta"


class UsuarioCreate(BaseModel):
    nome: str
    email: EmailStr
    cargo: CargoEnum
    perfil_de_acesso: AcessoEnum
    notificacao: bool = False
    # senha removida — gerada automaticamente pelo sistema


class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    cargo: Optional[CargoEnum] = None
    perfil_de_acesso: Optional[AcessoEnum] = None
    notificacao: Optional[bool] = None
    suspenso: Optional[datetime] = None
    qtd_suspensao: Optional[int] = None
    bloqueado: Optional[bool] = None
    exclusao: Optional[datetime] = None


class UsuarioResponse(BaseModel):
    id_usuario: int
    nome: str
    email: str
    cargo: CargoEnum
    perfil_de_acesso: AcessoEnum
    notificacao: bool
    suspenso: Optional[datetime] = None
    qtd_suspensao: int
    bloqueado: bool
    exclusao: Optional[datetime] = None
    data_cadastro: datetime
    primeiro_acesso: bool

    model_config = ConfigDict(from_attributes=True)