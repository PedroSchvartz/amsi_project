from sqlalchemy import Column, BigInteger, String, Numeric, ForeignKey, Table
from sqlalchemy.orm import relationship
from database import Base


# Itens N:N da parametrizacao (join puro, sem colunas extras). ON DELETE CASCADE
# no lado da parametrizacao: apagar a parametrizacao apaga seus vinculos.
parametrizacao_clifor = Table(
    "parametrizacao_clifor",
    Base.metadata,
    Column(
        "id_parametrizacao_fk",
        BigInteger,
        ForeignKey("parametrizacao.id_parametrizacao", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "id_clifor_fk",
        BigInteger,
        ForeignKey("clientefornecedor.id_clifor"),
        primary_key=True,
    ),
)


class Parametrizacao(Base):
    """Selecao nomeada de clifors atrelada a um Tipo de Conta, com valor sugerido
    opcional. Um Tipo de Conta pode ter varias; alimentam o preenchimento
    automatico do Novo Lancamento ao escolher o tipo."""

    __tablename__ = "parametrizacao"

    id_parametrizacao = Column(BigInteger, primary_key=True, autoincrement=True)
    nome = Column(String(255), nullable=False)
    id_tipo_conta_fk = Column(BigInteger, ForeignKey("tipo_conta.id_tipo_conta"), nullable=False)
    valor = Column(Numeric(15, 2), nullable=True)

    tipo_conta_rel = relationship("tipo_conta")
    clifors = relationship("ClienteFornecedor", secondary=parametrizacao_clifor)
