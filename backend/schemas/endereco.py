from pydantic import BaseModel, ConfigDict
from typing import Optional


# O que o frontend manda para criar um endereço
class EnderecoCreate(BaseModel):
    id_clifor_fk: int
    enderecoprimario: bool = False
    logradouro: str
    numero: str
    complemento: Optional[str] = None
    bairro: str
    cidade: str
    uf: str
    cep: str


# O que o frontend manda para atualizar um endereço
class EnderecoUpdate(BaseModel):
    enderecoprimario: Optional[bool] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    cep: Optional[str] = None


# O que a API devolve
class EnderecoResponse(BaseModel):
    id_endereco: int
    id_clifor_fk: int
    enderecoprimario: bool
    logradouro: str
    numero: str
    complemento: Optional[str] = None
    bairro: str
    cidade: str
    uf: str
    cep: str

    model_config = ConfigDict(from_attributes=True)