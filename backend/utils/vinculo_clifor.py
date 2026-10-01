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
    """Já existe acesso ligado a este clifor (regra: 1 acesso por clifor) — não se cria outro."""


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
    # Regra B (1 acesso por clifor): se o clifor já tem usuário ativo, não gera outro.
    # CPF compartilhado não é caso real. Cobre também o antigo caso login==doc.
    if clifor.usuarios_vinculados:
        raise AcessoJaExisteError()
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
