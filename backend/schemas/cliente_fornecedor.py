from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date
from decimal import Decimal
from enum import Enum


class TipoCliForEnum(str, Enum):
    Cliente = "C"
    Fornecedor = "F"
    Ambos = "A"


# ─── Inline (sem id_clifor_fk — preenchido pela route) ────────────────────────

class EnderecoInline(BaseModel):
    enderecoprimario: bool = False
    logradouro: str
    numero: str
    complemento: Optional[str] = None
    bairro: str
    cidade: str
    uf: str
    cep: str


class EnderecoInlineResponse(EnderecoInline):
    id_endereco: int
    id_clifor_fk: int
    model_config = ConfigDict(from_attributes=True)


class ContatoInline(BaseModel):
    tipocontato: str
    info_do_contato: str
    contato_principal: bool = False


class ContatoInlineResponse(ContatoInline):
    id_contato: int
    id_clifor_fk: int
    model_config = ConfigDict(from_attributes=True)


# ─── Create ───────────────────────────────────────────────────────────────────

class ClienteFornecedorCreate(BaseModel):
    id_usuario_fk: Optional[int] = None
    pessoafisica_juridica: bool
    cpf_cnpj: str
    rg_inscricaoestadual: str
    nome: str
    datanascimento: date
    tipo_clifor: TipoCliForEnum
    ativo: bool = True
    inadimplente: bool = False
    enderecos: Optional[List[EnderecoInline]] = None
    contatos: Optional[List[ContatoInline]] = None


# ─── Update ───────────────────────────────────────────────────────────────────

class ClienteFornecedorUpdate(BaseModel):
    id_usuario_fk: Optional[int] = None
    pessoafisica_juridica: Optional[bool] = None
    cpf_cnpj: Optional[str] = None
    rg_inscricaoestadual: Optional[str] = None
    nome: Optional[str] = None
    datanascimento: Optional[date] = None
    tipo_clifor: Optional[TipoCliForEnum] = None
    ativo: Optional[bool] = None
    inadimplente: Optional[bool] = None
    enderecos: Optional[List[EnderecoInline]] = None
    contatos: Optional[List[ContatoInline]] = None


# ─── Response ─────────────────────────────────────────────────────────────────

class ClienteFornecedorResponse(BaseModel):
    id_clifor: int
    id_usuario_fk: Optional[int] = None
    pessoafisica_juridica: bool
    cpf_cnpj: str
    rg_inscricaoestadual: str
    nome: str
    datanascimento: date
    tipo_clifor: TipoCliForEnum
    ativo: bool
    inadimplente: bool
    enderecos: List[EnderecoInlineResponse] = []
    contatos: List[ContatoInlineResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ─── Resumo ───────────────────────────────────────────────────────────────────

class CliForResumo(BaseModel):
    id_clifor: int
    nome: str
    total_a_receber: Decimal
    total_a_pagar: Decimal
    saldo_liquido: Decimal
    total_vencido_a_receber: Decimal
    total_vencido_a_pagar: Decimal
    quantidade_abertos: int
    quantidade_vencidos: int