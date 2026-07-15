from sqlalchemy import Column, BigInteger, TIMESTAMP, Date, DECIMAL, Boolean, Text, ForeignKey, LargeBinary, String, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

from datetime import date
import enum


class NaturezaLancamentoEnum(enum.Enum):
    Debito = "Debito"
    Credito = "Credito"


class SituacaoLancamentoEnum(str, enum.Enum):
    """Situação derivada — não existe coluna de status no banco."""
    Aberto = "Aberto"
    EmAnalise = "Em análise"
    Pago = "Pago"
    Estorno = "Estorno"
    Vencido = "Vencido"


class Lancamento(Base):
    __tablename__ = "lancamento"

    id_lancamento = Column(BigInteger, primary_key=True, autoincrement=True)
    id_usuario_fk_lancamento = Column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=False)
    id_clifor_relacionado_fk = Column(BigInteger, ForeignKey("clientefornecedor.id_clifor"), nullable=False)
    id_tipo_conta_fk = Column(BigInteger, ForeignKey("tipo_conta.id_tipo_conta"), nullable=False)
    # UTC, igual aos outros carimbos (que vêm de datetime.utcnow() no Python).
    # func.now() puro devolveria a hora LOCAL do Postgres — o banco roda em
    # America/Sao_Paulo, então data_lancamento saía 3h atrás dos demais e a linha
    # do tempo da tela misturava dois relógios. Quem converte para o fuso do
    # usuário é o frontend.
    data_lancamento = Column(TIMESTAMP, nullable=False, server_default=text("timezone('utc', now())"))
    valor = Column(DECIMAL(15, 2), nullable=False)
    data_vencimento = Column(Date, nullable=False)
    multa = Column(DECIMAL(15, 2), nullable=True)
    juros = Column(DECIMAL(15, 2), nullable=True)
    # Efetivação (Operador ou Admin) — manda o lançamento para "Em análise".
    id_usuario_fk_efetivacao = Column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=True)
    data_efetivacao = Column(TIMESTAMP, nullable=True)
    # Aprovação (só Admin) — tira de "Em análise" e leva a "Pago".
    id_usuario_fk_aprovacao = Column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=True)
    data_aprovacao = Column(TIMESTAMP, nullable=True)
    # Edição (só Admin) — guarda apenas a ÚLTIMA: uma nova sobrescreve a anterior.
    # A linha do tempo mostra quem editou e quando, nunca o que mudou.
    id_usuario_fk_edicao = Column(BigInteger, ForeignKey("usuario.id_usuario"), nullable=True)
    data_edicao = Column(TIMESTAMP, nullable=True)
    # Data econômica do pagamento — digitada no formulário, pode ser retroativa.
    # Não comanda o estado (quem comanda é data_efetivacao).
    data_pagamento = Column(TIMESTAMP, nullable=True)
    valor_pago = Column(DECIMAL(15, 2), nullable=True)
    observacao = Column(Text, nullable=True)
    observacao_pagamento = Column(Text, nullable=True)
    natureza_lancamento = Column(SAEnum(NaturezaLancamentoEnum, name="natureza_enum", values_callable=lambda x: [e.value for e in x]), nullable=False)
    estorno = Column(Boolean, nullable=False, default=False)
    lote = Column(BigInteger, nullable=True)
    comprovante = Column(LargeBinary, nullable=True)
    comprovante_nome = Column(String(255), nullable=True)

    usuario_lancamento = relationship("Usuario", foreign_keys=[id_usuario_fk_lancamento], backref="lancamentos_criados")
    usuario_efetivacao = relationship("Usuario", foreign_keys=[id_usuario_fk_efetivacao], backref="lancamentos_efetivados")
    usuario_aprovacao = relationship("Usuario", foreign_keys=[id_usuario_fk_aprovacao], backref="lancamentos_aprovados")
    usuario_edicao = relationship("Usuario", foreign_keys=[id_usuario_fk_edicao], backref="lancamentos_editados")
    cliente_fornecedor = relationship("ClienteFornecedor", backref="lancamentos")
    tipo_conta_rel = relationship("tipo_conta", backref="lancamentos")

    @property
    def situacao(self) -> SituacaoLancamentoEnum:
        """Estado derivado. Fonte única da regra — o frontend consome isto pronto
        em vez de reimplementar a prioridade em cada tela.

        Em análise vence Vencido de propósito: um lançamento já pago não pode
        aparecer como vencido só porque o admin ainda não aprovou.
        """
        if self.estorno:
            return SituacaoLancamentoEnum.Estorno
        if self.data_aprovacao is not None:
            return SituacaoLancamentoEnum.Pago
        if self.data_efetivacao is not None:
            return SituacaoLancamentoEnum.EmAnalise
        if self.data_vencimento is not None and self.data_vencimento < date.today():
            return SituacaoLancamentoEnum.Vencido
        return SituacaoLancamentoEnum.Aberto