from fastapi import Depends, HTTPException, status, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from datetime import datetime, timedelta
from database import get_db
from models.usuario import Usuario, AcessoEnum, CargoEnum
from models.token_ativo import TokenAtivo
from utils.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES

bearer_scheme = HTTPBearer()


def _renovar_token(token_ativo: TokenAtivo, db: Session, response: Response) -> datetime:
    """Sliding session: estende o exp do token, mas só grava no banco quando
    falta menos de metade da janela. Evita um write+commit em TODA requisição
    autenticada (gargalo de latência), preservando a renovação por atividade."""
    agora = datetime.utcnow()
    tempo_restante = token_ativo.exp - agora

    if tempo_restante <= timedelta(minutes=JWT_EXPIRE_MINUTES / 2):
        exp_efetivo = agora + timedelta(minutes=JWT_EXPIRE_MINUTES)
        token_ativo.exp = exp_efetivo
        db.commit()
    else:
        exp_efetivo = token_ativo.exp

    response.headers["X-Session-Expires"] = str(int(exp_efetivo.timestamp() * 1000))
    return exp_efetivo


def get_current_user(
    response: Response,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Decodificar sem verificar exp — vamos verificar pelo banco
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"verify_exp": False}
        )
        id_usuario: str = payload.get("sub")
        jti: str = payload.get("jti")
        if id_usuario is None or jti is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Verificar se token está ativo no banco
    token_ativo = db.query(TokenAtivo).filter(TokenAtivo.jti == jti).first()

    if not token_ativo:
        raise credentials_exception

    # Verificar se expirou — se sim, deletar e rejeitar
    if token_ativo.exp < datetime.utcnow():
        db.delete(token_ativo)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario = db.query(Usuario).filter(Usuario.id_usuario == int(id_usuario)).first()
    if usuario is None:
        raise credentials_exception

    # Renovar expiração e injetar no header
    _renovar_token(token_ativo, db, response)

    return usuario


def get_current_user_with_jti(
    response: Response,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> tuple:
    """Retorna (usuario, jti) — usado no logout."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"verify_exp": False}
        )
        id_usuario: str = payload.get("sub")
        jti: str = payload.get("jti")
        if id_usuario is None or jti is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    token_ativo = db.query(TokenAtivo).filter(TokenAtivo.jti == jti).first()
    if not token_ativo:
        raise credentials_exception

    if token_ativo.exp < datetime.utcnow():
        db.delete(token_ativo)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario = db.query(Usuario).filter(Usuario.id_usuario == int(id_usuario)).first()
    if usuario is None:
        raise credentials_exception

    _renovar_token(token_ativo, db, response)

    return usuario, jti


def exige_admin(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    if current_user.perfil_de_acesso != AcessoEnum.Administrador:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores"
        )
    return current_user


def exige_perfil_minimo(perfil: AcessoEnum):
    HIERARQUIA = [AcessoEnum.Consulta, AcessoEnum.Operador, AcessoEnum.Administrador]

    def _dep(current_user: Usuario = Depends(get_current_user)) -> Usuario:
        if HIERARQUIA.index(current_user.perfil_de_acesso) < HIERARQUIA.index(perfil):
            raise HTTPException(status_code=403, detail="Perfil insuficiente")
        return current_user

    return _dep


def exige_operador_ou_admin(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    if current_user.perfil_de_acesso not in (AcessoEnum.Administrador, AcessoEnum.Operador):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a operadores e administradores"
        )
    return current_user


def exige_admin_desenvolvedor(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    """Guard duplo: perfil Administrador E cargo Desenvolvedor.
    Usado em operações destrutivas que não devem ser acessíveis pelo frontend nem por admins comuns."""
    if current_user.perfil_de_acesso != AcessoEnum.Administrador:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores")
    if current_user.cargo != CargoEnum.Desenvolvedor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ação restrita a usuários com cargo Desenvolvedor")
    return current_user