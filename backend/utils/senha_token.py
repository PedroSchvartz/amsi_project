"""Helpers para o fluxo de definição de senha por token de uso único.

Centraliza a geração, validação e consumo dos tokens de `senha_token`, usados por:
  - cadastro de novo usuário (finalidade="cadastro")
  - reset de senha pelo admin e autoatendimento "esqueci a senha" (finalidade="reset")
  - restauração de conta excluída (finalidade="reset")

Segurança: o token cru só existe em memória no momento da geração; em repouso guardamos
apenas o SHA-256. O link entrega o token no FRAGMENT da URL (#token=), nunca na query
string — o fragment não é enviado a nenhum servidor (nem no header Referer), então não
aparece em logs de acesso.
"""

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from models.senha_token import SenhaToken
from models.usuario import Usuario
from utils.config import FRONTEND_URL

FINALIDADE_CADASTRO = "cadastro"
FINALIDADE_RESET = "reset"


def _hash_token(token_cru: str) -> str:
    return hashlib.sha256(token_cru.encode("utf-8")).hexdigest()


def gerar_token_senha(db: Session, usuario: Usuario, finalidade: str, ttl_horas: int) -> str:
    """Gera um token de uso único, persiste apenas o hash e retorna o token cru.

    Invalida (marca usado_em) os tokens anteriores não usados do mesmo usuário/finalidade,
    para que um link antigo deixe de valer quando um novo é emitido. NÃO faz commit —
    o chamador controla a transação (apenas db.flush()).
    """
    agora = datetime.utcnow()
    (
        db.query(SenhaToken)
        .filter(
            SenhaToken.id_usuario_fk == usuario.id_usuario,
            SenhaToken.finalidade == finalidade,
            SenhaToken.usado_em == None,  # noqa: E711
        )
        .update({"usado_em": agora}, synchronize_session=False)
    )

    token_cru = secrets.token_urlsafe(32)
    registro = SenhaToken(
        id_usuario_fk=usuario.id_usuario,
        token_hash=_hash_token(token_cru),
        finalidade=finalidade,
        expira_em=agora + timedelta(hours=ttl_horas),
    )
    db.add(registro)
    db.flush()
    return token_cru


def _buscar_token_valido(db: Session, token_cru: str) -> Optional[SenhaToken]:
    """Retorna o registro se o token existe, não foi usado e não expirou; senão None."""
    if not token_cru:
        return None
    registro = (
        db.query(SenhaToken)
        .filter(SenhaToken.token_hash == _hash_token(token_cru))
        .first()
    )
    if not registro or registro.usado_em is not None:
        return None
    if registro.expira_em <= datetime.utcnow():
        return None
    return registro


def _usuario_do_token(db: Session, registro: Optional[SenhaToken]) -> Optional[Usuario]:
    if not registro:
        return None
    return (
        db.query(Usuario)
        .filter(
            Usuario.id_usuario == registro.id_usuario_fk,
            Usuario.exclusao == None,  # noqa: E711
        )
        .first()
    )


def inspecionar_token_senha(db: Session, token_cru: str) -> Optional[Usuario]:
    """Valida o token (existe / não usado / não expirado) SEM consumir. Retorna o usuário ou None.

    Usado pela tela de definição de senha para saudar o usuário e mostrar "link expirado"
    antes de ele digitar a nova senha.
    """
    return _usuario_do_token(db, _buscar_token_valido(db, token_cru))


def consumir_token_senha(db: Session, token_cru: str) -> Optional[Usuario]:
    """Valida e marca o token como usado (uso único). Retorna o usuário ou None.

    NÃO faz commit — o chamador persiste a marcação de uso junto com a troca de senha,
    de modo que tudo aconteça na mesma transação.
    """
    registro = _buscar_token_valido(db, token_cru)
    usuario = _usuario_do_token(db, registro)
    if not usuario:
        return None
    registro.usado_em = datetime.utcnow()
    return usuario


def _link_definir_senha(token_cru: str) -> str:
    """Monta o link com o token no FRAGMENT (#token=), nunca na query string."""
    return f"{FRONTEND_URL}/definir-senha#token={token_cru}"
