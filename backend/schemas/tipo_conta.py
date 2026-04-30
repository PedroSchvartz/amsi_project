from pydantic import BaseModel, ConfigDict
from typing import Optional
from enum import Enum


class NaturezaEnum(str, Enum):
    Debito = "Debito"
    Credito = "Credito"


class TipoLancamentoCreate(BaseModel):
    descricao_conta: str
    natureza_conta: NaturezaEnum
    observacao: Optional[str] = None


class TipoLancamentoUpdate(BaseModel):
    descricao_conta: Optional[str] = None
    natureza_conta: Optional[NaturezaEnum] = None
    observacao: Optional[str] = None


class TipoLancamentoResponse(BaseModel):
    id_tipo_conta: int
    descricao_conta: str
    natureza_conta: NaturezaEnum
    observacao: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)