"""
Vínculo Usuário ↔ Cliente/Fornecedor.

Gera o acesso (usuário CPF-only) a partir de um clifor. O e-mail do usuário e os
contatos do clifor são independentes: vincular/editar um não altera o outro.
"""

import re

from sqlalchemy.orm import Session

from models.cliente_fornecedor import ClienteFornecedor
from models.usuario import Usuario, AcessoEnum
from utils.auth_utils import hash_senha


class AcessoJaExisteError(Exception):
    """Já existe um usuário cujo login é este documento — não se cria um login duplicado."""


def gerar_acesso_clifor(clifor: ClienteFornecedor, db: Session, marcar_associado: bool = False) -> Usuario:
    """Cria um usuário CPF-only (login = documento do clifor) a partir do clifor.

    Item 13: usuário nasce sem e-mail, perfil Consulta, sem cargo, com senha inicial =
    5 primeiros dígitos do documento e primeiro_acesso=True (troca obrigatória no 1º login).
    `login` guarda só os dígitos do documento (o /auth/token normaliza a máscara na entrada).
    Não faz commit — quem chama commita. Levanta ValueError (sem documento) ou
    AcessoJaExisteError (login já usado) para o chamador tratar (400/409 na rota, skip no script).
    """
    doc = re.sub(r"\D", "", clifor.cpf_cnpj or "")
    if not doc:
        raise ValueError("clifor sem documento")
    # A unicidade é do LOGIN (o documento), não do clifor: um clifor pode ter vários acessos
    # (ex.: a equipe logando por e-mail + o morador logando pelo CPF). Só barra se já existe
    # um usuário cujo login é este documento — que é exatamente o acesso que este botão criaria.
    if db.query(Usuario).filter(Usuario.login == doc).first():
        raise AcessoJaExisteError()
    usuario = Usuario(
        nome=clifor.nome,
        email=None,
        login=doc,
        cargo=None,
        perfil_de_acesso=AcessoEnum.Consulta,
        primeiro_acesso=True,
        id_clifor_fk=clifor.id_clifor,
        senha=hash_senha(doc[:5]),
    )
    db.add(usuario)
    if marcar_associado:
        clifor.associado = True
    return usuario
