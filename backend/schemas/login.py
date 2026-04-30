from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


# O que o frontend manda para registrar um login
class LoginCreate(BaseModel):
    id_usuario_fk: int
    dispositivo_logado: str
    localizacao: str
    navegador: str


# O que o frontend manda para registrar um logout
class LoginUpdate(BaseModel):
    data_logout: Optional[datetime] = None


# O que a API devolve
class LoginResponse(BaseModel):
    id_login: int
    data_login: datetime
    data_logout: Optional[datetime] = None
    id_usuario_fk: int
    dispositivo_logado: str
    localizacao: str
    navegador: str

    model_config = ConfigDict(from_attributes=True)