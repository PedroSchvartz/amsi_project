from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from enum import Enum


class NaturezaEnum(str, Enum):
    Debito = "Debito"
    Credito = "Credito"


# O que o frontend manda para criar um lançamento
class LancamentoCreate(BaseModel):
    id_usuario_fk_lancamento: int
    id_clifor_relacionado_fk: int
    id_tipo_conta_fk: int
    valor: Decimal
    data_vencimento: date
    natureza_lancamento: NaturezaEnum
    observacao: Optional[str] = None


# O que o frontend manda para fechar/atualizar um lançamento
class LancamentoUpdate(BaseModel):
    id_usuario_fk_fechamento: Optional[int] = None
    data_pagamento: Optional[datetime] = None
    valor_pago: Optional[Decimal] = None
    multa: Optional[Decimal] = None
    juros: Optional[Decimal] = None
    observacao: Optional[str] = None
    estorno: Optional[bool] = None


# O que a API devolve
class LancamentoResponse(BaseModel):
    id_lancamento: int
    id_usuario_fk_lancamento: int
    id_clifor_relacionado_fk: int
    id_tipo_conta_fk: int
    data_lancamento: datetime
    valor: Decimal
    data_vencimento: date
    multa: Optional[Decimal] = None
    juros: Optional[Decimal] = None
    id_usuario_fk_fechamento: Optional[int] = None
    data_pagamento: Optional[datetime] = None
    valor_pago: Optional[Decimal] = None
    observacao: Optional[str] = None
    natureza_lancamento: NaturezaEnum
    estorno: bool
    tem_comprovante: bool = False
    comprovante_nome: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def calcular_tem_comprovante(cls, values):
        if hasattr(values, '__dict__'):
            values.__dict__['tem_comprovante'] = values.comprovante is not None
        elif isinstance(values, dict):
            values['tem_comprovante'] = values.get('comprovante') is not None
        return values

    model_config = ConfigDict(from_attributes=True)


# Totais agregados
class LancamentoResumo(BaseModel):
    # Realizados (quitados) — respeita filtro de período
    total_recebido: Decimal
    total_pago: Decimal
    total_reembolsado: Decimal
    # Saldo total desde o primeiro lançamento
    saldo_total: Decimal
    # Pendentes
    total_a_receber: Decimal
    total_a_pagar: Decimal
    total_a_receber_excluindo_inadimplentes: Decimal
    # Vencidos
    total_vencido_a_receber: Decimal
    total_vencido_a_pagar: Decimal
    quantidade_abertos: int
    quantidade_vencidos: int
    quantidade_inadimplentes: int


class ResumoPorTipo(BaseModel):
    id_tipo_conta: int
    descricao_conta: str
    natureza_conta: str
    total: Decimal
    quantidade: int