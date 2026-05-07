from cryptography.fernet import Fernet
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator
from utils.config import ENCRYPTION_KEY


_fernet = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)


def criptografar(valor: str) -> str:
    if valor is None:
        return None
    return _fernet.encrypt(valor.encode()).decode()


def descriptografar(valor: str) -> str:
    if valor is None:
        return None
    return _fernet.decrypt(valor.encode()).decode()


class ColunaEncriptada(TypeDecorator):
    """TypeDecorator que criptografa ao gravar e descriptografa ao ler."""
    impl = String(512)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return criptografar(str(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return descriptografar(value)