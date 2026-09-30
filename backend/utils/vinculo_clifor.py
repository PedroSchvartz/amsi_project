"""
Vínculo Usuário ↔ Cliente/Fornecedor.

Regra de negócio: um clifor vinculado a um usuário sempre carrega ao menos o
e-mail desse usuário entre seus contatos. Estas funções centralizam essa garantia
para TODOS os caminhos de vínculo (associar pela aba Usuários, cadastro/edição de
clifor) e a sincronização quando o e-mail do usuário muda.
"""

import re

from sqlalchemy.orm import Session

from models.contato import Contato
from models.cliente_fornecedor import ClienteFornecedor
from models.usuario import Usuario, AcessoEnum
from utils.auth_utils import hash_senha

TIPO_EMAIL = "Email"


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


def _igual(a: str, b: str) -> bool:
    return (a or "").strip().casefold() == (b or "").strip().casefold()


def _tem_email(clifor: ClienteFornecedor, email: str) -> bool:
    return any(
        c.tipocontato == TIPO_EMAIL and _igual(c.info_do_contato, email)
        for c in clifor.contatos
    )


def garantir_email_no_clifor(clifor: ClienteFornecedor, usuario: Usuario, db: Session) -> None:
    """Garante que o clifor tenha um contato de e-mail igual ao do usuário.

    Adiciona um novo contato Email se faltar; não duplica e não mexe nos contatos
    existentes (mesmo que já haja outro e-mail diferente). Idempotente.
    """
    if not usuario or not usuario.email or not clifor:
        return
    if _tem_email(clifor, usuario.email):
        return
    # principal só se o clifor ainda não tiver nenhum contato
    principal = len(clifor.contatos) == 0
    db.add(Contato(
        id_clifor_fk=clifor.id_clifor,
        tipocontato=TIPO_EMAIL,
        info_do_contato=usuario.email,
        contato_principal=principal,
    ))


def sincronizar_email_clifor(usuario: Usuario, email_antigo: str, db: Session) -> None:
    """Após troca de e-mail do usuário, atualiza o contato no clifor vinculado.

    Se existir um contato Email com o e-mail antigo, atualiza para o novo; caso
    contrário (foi removido por algum motivo), re-adiciona via garantir_email_no_clifor.
    """
    if not usuario or not usuario.id_clifor_fk:
        return
    clifor = db.query(ClienteFornecedor).filter(
        ClienteFornecedor.id_clifor == usuario.id_clifor_fk
    ).first()
    if not clifor:
        return

    atualizado = False
    for c in clifor.contatos:
        if c.tipocontato == TIPO_EMAIL and _igual(c.info_do_contato, email_antigo):
            c.info_do_contato = usuario.email
            atualizado = True
    if not atualizado:
        garantir_email_no_clifor(clifor, usuario, db)
