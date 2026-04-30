import bcrypt
import uuid
from datetime import datetime, timedelta
from jose import jwt
from utils.config import JWT_SECRET_KEY, JWT_EXPIRE_MINUTES, JWT_ALGORITHM


def hash_senha(senha: str) -> str:
    senha_bytes = senha.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(senha_bytes, salt).decode('utf-8')


def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    return bcrypt.checkpw(
        senha_plana.encode('utf-8'),
        senha_hash.encode('utf-8')
    )


def criar_token_acesso(dados: dict) -> str:
    para_codificar = dados.copy()
    expira = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    para_codificar.update({
        "exp": expira,
        "jti": str(uuid.uuid4())
    })
    return jwt.encode(para_codificar, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)