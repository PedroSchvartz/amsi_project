from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from jose import jwt, JWTError
from database import SessionLocal
from utils.config import JWT_SECRET_KEY, JWT_ALGORITHM

_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

_SKIP_PREFIXES = (
    "/demo/",
    "/logs/",
    "/docs",
    "/openapi.json",
    "/redoc",
)

_ENTIDADE_MAP = {
    "lancamento":          "lancamento",
    "usuarios":            "usuario",
    "cliente_fornecedor":  "clifor",
    "tipo_conta":          "tipo_conta",
    "endereco":            "endereco",
    "contato":             "contato",
    "login":               "login",
    "auth":                "auth",
    "log-atividade":       "log_atividade",
}


def _parse_entidade(path: str):
    parts = [p for p in path.split("/") if p]
    if not parts:
        return None, None
    entidade = _ENTIDADE_MAP.get(parts[0])
    id_entidade = None
    if len(parts) > 1:
        try:
            id_entidade = int(parts[1])
        except ValueError:
            pass
    return entidade, id_entidade


class ActivityLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if request.method not in _MUTATING_METHODS:
            return response

        path = request.url.path
        if path == "/" or any(path.startswith(p) for p in _SKIP_PREFIXES):
            return response

        if response.status_code >= 300:
            return response

        auth_header = request.headers.get("authorization", "")
        if not auth_header.lower().startswith("bearer "):
            return response

        token = auth_header[7:]
        try:
            payload = jwt.decode(
                token,
                JWT_SECRET_KEY,
                algorithms=[JWT_ALGORITHM],
                options={"verify_exp": False},
            )
            jti = payload.get("jti")
        except JWTError:
            return response

        if not jti:
            return response

        entidade, id_entidade = _parse_entidade(path)
        descricao = f"{request.method} {path}"

        db = SessionLocal()
        try:
            from models.token_ativo import TokenAtivo
            from models.log_atividade import LogAtividade

            token_ativo = db.query(TokenAtivo).filter(TokenAtivo.jti == jti).first()
            if not token_ativo:
                return response

            log = LogAtividade(
                id_login_fk=token_ativo.id_login_fk,
                id_usuario_fk=token_ativo.id_usuario_fk,
                metodo=request.method,
                endpoint=path[:255],
                entidade=entidade,
                id_entidade=id_entidade,
                descricao=descricao[:255],
                status_code=response.status_code,
            )
            db.add(log)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

        return response
