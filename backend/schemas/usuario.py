from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional
from datetime import datetime
from enum import Enum


class CargoEnum(str, Enum):
    Presidente = "Presidente"
    Diretor = "Diretor"
    Tesoureiro = "Tesoureiro"
    Secretario = "Secretário"
    Conselheiro = "Conselheiro"
    Associado = "Associado"
    Desenvolvedor = "Desenvolvedor"


class AcessoEnum(str, Enum):
    Administrador = "Administrador"
    Operador = "Operador"
    Consulta = "Consulta"


class UsuarioCreate(BaseModel):
    nome: str
    # E-mail opcional: sem e-mail, o usuario nasce so com login (CPF) e senha provisoria
    # digitada pelo admin. Obrigatorio (validado na rota) so quando notificacao=True.
    email: Optional[EmailStr] = None
    login: Optional[str] = None  # UNICA credencial que autentica; obrigatorio na pratica (rota + front)
    cargo: Optional[CargoEnum] = None
    perfil_de_acesso: AcessoEnum
    notificacao: bool = False
    # Senha provisoria: usada SO no cadastro sem e-mail (nao ha link para enviar). Com
    # e-mail, e ignorada — a senha real vem pelo link "defina sua senha".
    senha: Optional[str] = None


class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    login: Optional[str] = None  # identificador alternativo (CPF); item 4
    cargo: Optional[CargoEnum] = None
    perfil_de_acesso: Optional[AcessoEnum] = None
    notificacao: Optional[bool] = None
    suspenso: Optional[datetime] = None
    qtd_suspensao: Optional[int] = None
    bloqueado: Optional[bool] = None
    exclusao: Optional[datetime] = None
    senha: Optional[str] = None
    primeiro_acesso: Optional[bool] = None
    id_clifor_fk: Optional[int] = None


class RestaurarRequest(BaseModel):
    # Body OPCIONAL do POST /usuarios/{id}/restaurar. Quando o usuário não tem e-mail, o
    # admin pode informar um aqui ("Salvar" na modal) para cadastrá-lo e notificar. Sem body
    # (ou email=None) = "Cadastrar depois": só reativa, sem notificar.
    email: Optional[EmailStr] = None


class UsuarioResponse(BaseModel):
    id_usuario: int
    nome: str
    email: Optional[str] = None  # NULL = usuario CPF-only sem e-mail ainda
    login: Optional[str] = None  # identificador alternativo (CPF); item 4
    cargo: Optional[CargoEnum] = None
    perfil_de_acesso: AcessoEnum
    notificacao: bool
    suspenso: Optional[datetime] = None
    qtd_suspensao: int
    bloqueado: bool
    exclusao: Optional[datetime] = None
    data_cadastro: datetime
    primeiro_acesso: bool
    id_clifor_fk: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)