from pydantic import BaseModel, ConfigDict
from typing import Optional


# O que o frontend manda para criar um contato
class ContatoCreate(BaseModel):
    id_clifor_fk: int
    tipocontato: str
    info_do_contato: str
    contato_principal: bool = False


# O que o frontend manda para atualizar um contato
class ContatoUpdate(BaseModel):
    tipocontato: Optional[str] = None
    info_do_contato: Optional[str] = None
    contato_principal: Optional[bool] = None


# O que a API devolve
class ContatoResponse(BaseModel):
    id_contato: int
    id_clifor_fk: int
    tipocontato: str
    info_do_contato: str
    contato_principal: bool

    model_config = ConfigDict(from_attributes=True)