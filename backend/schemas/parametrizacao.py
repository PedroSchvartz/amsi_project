from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from decimal import Decimal


class ParametrizacaoCreate(BaseModel):
    nome: str
    id_tipo_conta_fk: int
    valor: Optional[Decimal] = None
    ids_clifor: List[int] = []


class ParametrizacaoUpdate(BaseModel):
    """Edicao = substituicao completa. O formulario sempre envia todos os campos,
    entao `valor` ausente/None limpa o valor e `ids_clifor` substitui a lista."""
    nome: str
    id_tipo_conta_fk: int
    valor: Optional[Decimal] = None
    ids_clifor: List[int] = []


class ParametrizacaoResponse(BaseModel):
    id_parametrizacao: int
    nome: str
    id_tipo_conta_fk: int
    descricao_tipo_conta: Optional[str] = None
    valor: Optional[Decimal] = None
    ids_clifor: List[int] = []
    total: int = 0

    model_config = ConfigDict(from_attributes=True)
