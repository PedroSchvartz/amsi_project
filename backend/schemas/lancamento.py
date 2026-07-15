from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from enum import Enum


class NaturezaEnum(str, Enum):
    Debito = "Debito"
    Credito = "Credito"


class SituacaoEnum(str, Enum):
    """Espelha SituacaoLancamentoEnum do model — a regra vive lá."""
    Aberto = "Aberto"
    EmAnalise = "Em análise"
    Pago = "Pago"
    Estorno = "Estorno"
    Vencido = "Vencido"


class LancamentoCreate(BaseModel):
    id_usuario_fk_lancamento: int
    id_clifor_relacionado_fk: int
    id_tipo_conta_fk: int
    valor: Decimal
    data_vencimento: date
    natureza_lancamento: NaturezaEnum
    observacao: Optional[str] = None


class LancamentoMassaCreate(BaseModel):
    """Template de um lançamento aplicado a vários clifors de uma vez.

    Espelha os campos de LancamentoCreate (sem `estorno` — a natureza já vem com o
    flip de reembolso aplicado pelo frontend), trocando o id_clifor único por uma lista.
    """
    id_usuario_fk_lancamento: int
    ids_clifor: List[int]
    id_tipo_conta_fk: int
    valor: Decimal
    data_vencimento: date
    natureza_lancamento: NaturezaEnum
    observacao: Optional[str] = None


class LancamentoMassaResponse(BaseModel):
    lote: int
    total_criados: int
    ids: List[int]


class LancamentoUpdate(BaseModel):
    """Efetivação — leva o lançamento de Aberto para Em análise.

    Não aceita os atores nem os carimbos do fluxo: quem efetivou e quem aprovou saem
    do token, e data_efetivacao/data_aprovacao são do servidor. O corpo não opina —
    senão o registro de quem passou para Em análise não provaria nada.
    """
    data_pagamento: Optional[datetime] = None
    valor_pago: Optional[Decimal] = None
    multa: Optional[Decimal] = None
    juros: Optional[Decimal] = None
    observacao_pagamento: Optional[str] = None
    estorno: Optional[bool] = None


class LancamentoEditAdmin(BaseModel):
    """Edição completa — apenas administradores.

    Não aceita os carimbos do fluxo (data_efetivacao/data_aprovacao) nem o de edição:
    todos são do servidor. Aceitá-los deixaria o admin apagar um evento da linha do
    tempo em silêncio, e a tela existe justamente para provar quem fez o quê.
    Consequência assumida: aprovação é definitiva, não há desfazer.
    """
    id_clifor_relacionado_fk: Optional[int] = None
    id_tipo_conta_fk: Optional[int] = None
    valor: Optional[Decimal] = None
    data_vencimento: Optional[date] = None
    natureza_lancamento: Optional[NaturezaEnum] = None
    observacao: Optional[str] = None
    observacao_pagamento: Optional[str] = None
    data_pagamento: Optional[datetime] = None
    valor_pago: Optional[Decimal] = None
    multa: Optional[Decimal] = None
    juros: Optional[Decimal] = None
    estorno: Optional[bool] = None


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
    id_usuario_fk_efetivacao: Optional[int] = None
    data_efetivacao: Optional[datetime] = None
    id_usuario_fk_fechamento: Optional[int] = None
    data_aprovacao: Optional[datetime] = None
    id_usuario_fk_edicao: Optional[int] = None
    data_edicao: Optional[datetime] = None
    data_pagamento: Optional[datetime] = None
    valor_pago: Optional[Decimal] = None
    observacao: Optional[str] = None
    observacao_pagamento: Optional[str] = None
    natureza_lancamento: NaturezaEnum
    estorno: bool
    lote: Optional[int] = None
    situacao: SituacaoEnum
    tem_comprovante: bool = False
    comprovante_nome: Optional[str] = None
    nome_clifor: Optional[str] = None
    cpf_cnpj_clifor: Optional[str] = None
    descricao_tipo_conta: Optional[str] = None
    nome_usuario_lancamento: Optional[str] = None
    nome_usuario_efetivacao: Optional[str] = None
    nome_usuario_fechamento: Optional[str] = None
    nome_usuario_edicao: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def calcular_tem_comprovante(cls, values):
        if hasattr(values, '__dict__'):
            values.__dict__['tem_comprovante'] = values.comprovante is not None
            cf = getattr(values, 'cliente_fornecedor', None)
            if cf:
                values.__dict__['nome_clifor'] = cf.nome
                values.__dict__['cpf_cnpj_clifor'] = cf.cpf_cnpj
            tc = getattr(values, 'tipo_conta_rel', None)
            if tc:
                values.__dict__['descricao_tipo_conta'] = tc.descricao_conta
            u = getattr(values, 'usuario_lancamento', None)
            if u:
                values.__dict__['nome_usuario_lancamento'] = u.nome
            ue = getattr(values, 'usuario_efetivacao', None)
            if ue:
                values.__dict__['nome_usuario_efetivacao'] = ue.nome
            uf = getattr(values, 'usuario_fechamento', None)
            if uf:
                values.__dict__['nome_usuario_fechamento'] = uf.nome
            ued = getattr(values, 'usuario_edicao', None)
            if ued:
                values.__dict__['nome_usuario_edicao'] = ued.nome
        elif isinstance(values, dict):
            values['tem_comprovante'] = values.get('comprovante') is not None
        return values

    model_config = ConfigDict(from_attributes=True)


class LancamentoResumo(BaseModel):
    total_recebido: Decimal
    total_pago: Decimal
    total_reembolsado: Decimal
    saldo_total: Decimal
    total_a_receber: Decimal
    total_a_pagar: Decimal
    total_inadimplencia: Decimal
    total_a_receber_excluindo_inadimplentes: Decimal
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