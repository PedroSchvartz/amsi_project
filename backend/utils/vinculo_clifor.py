"""
Vínculo Usuário ↔ Cliente/Fornecedor.

Regra de negócio: um clifor vinculado a um usuário sempre carrega ao menos o
e-mail desse usuário entre seus contatos. Estas funções centralizam essa garantia
para TODOS os caminhos de vínculo (associar pela aba Usuários, cadastro/edição de
clifor) e a sincronização quando o e-mail do usuário muda.
"""

from sqlalchemy.orm import Session

from models.contato import Contato
from models.cliente_fornecedor import ClienteFornecedor
from models.usuario import Usuario

TIPO_EMAIL = "Email"


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
    if not usuario:
        return
    clifor = db.query(ClienteFornecedor).filter(
        ClienteFornecedor.id_usuario_fk == usuario.id_usuario
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
