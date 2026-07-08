# ponto de entrada, registra as rotas
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import logging

from database import engine, Base
from models import usuario, tipo_conta, cliente_fornecedor, endereco, contato, login, lancamento, token_ativo, log_atividade, senha_token
from routes import usuario as usuario_router
from routes import login as login_router
from routes import tipo_conta as tipo_lancamento_router
from routes import cliente_fornecedor as clifor_router
from routes import endereco as endereco_router
from routes import contato as contato_router
from routes import lancamento as lancamento_router
from routes import demo as demo_router
from routes import log_atividade as log_atividade_router
from auth.router import router as auth_router

from fastapi.middleware.cors import CORSMiddleware
from utils.request_logger import RequestLoggerMiddleware, router as logs_router
from utils.config import APP_ENV, FRONTEND_URL
from utils.activity_log_middleware import ActivityLogMiddleware
from utils.rate_limit import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

Base.metadata.create_all(bind=engine)


def _aplicar_migracoes():
    """Aplica migrações incrementais que o create_all não consegue (ALTER TABLE)."""
    from sqlalchemy import text, inspect as sa_inspect
    insp = sa_inspect(engine)

    # Extensão: pg_trgm (necessária para func.similarity usada em sugestão de clifor)
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        conn.commit()

    # Migration: id_login_fk em token_ativo
    if "token_ativo" in insp.get_table_names():
        cols = [c["name"] for c in insp.get_columns("token_ativo")]
        if "id_login_fk" not in cols:
            with engine.connect() as conn:
                conn.execute(text(
                    "ALTER TABLE token_ativo "
                    "ADD COLUMN id_login_fk BIGINT REFERENCES login(id_login) ON DELETE SET NULL"
                ))
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS idx_token_ativo_login ON token_ativo(id_login_fk)"
                ))
                conn.commit()

    # Migration: coluna 'lote' em lancamento (lançamento em massa).
    # Antes vivia só no bootstrap.py (rodado à mão); precisa rodar no startup de
    # TODO deploy, senão o SELECT do modelo Lancamento (que inclui 'lote') quebra
    # em produção com UndefinedColumn.
    if "lancamento" in insp.get_table_names():
        cols = [c["name"] for c in insp.get_columns("lancamento")]
        if "lote" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE lancamento ADD COLUMN lote BIGINT"))
                conn.commit()


_aplicar_migracoes()

from fastapi.security import HTTPBearer
from fastapi.openapi.utils import get_openapi

app = FastAPI(
    title="AMSI Project",
    description="Sistema de gestão e registro de contas da associação de moradores",
    version="0.1.0"
)

http_bearer = HTTPBearer(auto_error=False)

# Rate limiting (slowapi) — limiter ativo só em produção; ver utils/rate_limit.py
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — origens explícitas (corrige o allow_origins=["*"] da auditoria #5; o par
# "*" + allow_credentials=True é inválido pela spec e abre a API a qualquer site).
# Produção: só o domínio do frontend (Vercel). Fora de produção: libera também o
# dev server do Vite, para o fluxo local e a suíte E2E.
_origens_cors = [FRONTEND_URL.rstrip("/")]
if APP_ENV != "production":
    _origens_cors += ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origens_cors,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Expires"],
)
app.add_middleware(ActivityLogMiddleware)
app.add_middleware(RequestLoggerMiddleware)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Garante que exceções não tratadas retornem JSON com headers CORS."""
    logging.exception(f"Exceção não tratada em {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor. Contate o administrador."},
    )

app.include_router(auth_router)
app.include_router(usuario_router.router)
app.include_router(login_router.router)
app.include_router(tipo_lancamento_router.router)
app.include_router(clifor_router.router)
app.include_router(endereco_router.router)
app.include_router(contato_router.router)
app.include_router(lancamento_router.router)
app.include_router(demo_router.router)
app.include_router(log_atividade_router.router)
if APP_ENV != "production":
    app.include_router(logs_router)


@app.get("/")
def root():
    # "ambiente" é usado pelo health-check de deploy e pelo gate da suíte E2E
    # do frontend (que se recusa a rodar contra APP_ENV=production).
    return {"status": "online", "ambiente": APP_ENV}


def gerar_doc_ia(app, output_file="openapi_ai.yaml"):
    import yaml

    schema = app.openapi()
    components = schema.get("components", {}).get("schemas", {})
    resultado = []

    def resolve_ref(ref):
        nome = ref.split("/")[-1]
        return components.get(nome, {})

    def extrair_campos(schema_obj):
        if not schema_obj:
            return None
        if "$ref" in schema_obj:
            schema_obj = resolve_ref(schema_obj["$ref"])
        # array — extrai campos do item
        if schema_obj.get("type") == "array":
            items = schema_obj.get("items", {})
            if "$ref" in items:
                items = resolve_ref(items["$ref"])
            schema_obj = items
        campos = {}
        for nome, info in schema_obj.get("properties", {}).items():
            tipo = info.get("type", "desconhecido")
            if "$ref" in info:
                tipo = info["$ref"].split("/")[-1]
            campos[nome] = {
                "tipo": tipo,
                "obrigatorio": nome in schema_obj.get("required", [])
            }
            if "enum" in info:
                campos[nome]["enum"] = info["enum"]
            if "default" in info:
                campos[nome]["default"] = info["default"]
        return campos if campos else None

    for path, methods in schema.get("paths", {}).items():
        for method, data in methods.items():
            endpoint = {
                "endpoint": f"{method.upper()} {path}",
                "descricao": data.get("summary") or data.get("description") or "",
                "parametros": [],
                "request_body": None,
                "response_200": None,
                "respostas": list(data.get("responses", {}).keys())
            }

            for param in data.get("parameters", []):
                endpoint["parametros"].append({
                    "nome": param.get("name"),
                    "local": param.get("in"),
                    "obrigatorio": param.get("required", False),
                    "tipo": param.get("schema", {}).get("type", "desconhecido")
                })

            body = data.get("requestBody", {})
            if body:
                content = body.get("content", {}).get("application/json", {})
                body_schema = content.get("schema", {})
                endpoint["request_body"] = extrair_campos(body_schema)

            resp_200 = data.get("responses", {}).get("200", {})
            if resp_200:
                content = resp_200.get("content", {}).get("application/json", {})
                resp_schema = content.get("schema", {})
                if resp_schema:
                    endpoint["response_200"] = extrair_campos(resp_schema)

            resultado.append(endpoint)

    with open(output_file, "w", encoding="utf-8") as f:
        yaml.dump(resultado, f, allow_unicode=True, sort_keys=False)

    print(f"\n📄 Documento para IA gerado em: {output_file}\n")
    return

from utils.config import NGROK_TOKEN, NGROK_DOMAIN, APP_HOST, APP_PORT

if __name__ == "__main__":
    import uvicorn
    import time
    from utils.frequentes import configure_logging, boolput, colorir
    configure_logging()

    online = boolput("Deseja rodar online?: ")

    if online:
        from pyngrok import ngrok
        host = "0.0.0.0"
        ngrok.set_auth_token(NGROK_TOKEN)
        time.sleep(2)
        tunnel = ngrok.connect(APP_PORT, domain=NGROK_DOMAIN)
        print(colorir(cor="azul", texto="\n========================================"))
        print(f"\nAcesse: https://{NGROK_DOMAIN}\n")
        print(colorir(cor="azul", texto="========================================"))
        logging.info(f"URL pública: https://{NGROK_DOMAIN}")

        logs_publico = boolput("Deseja que /logs/ui fique acessível publicamente?: ")
        if logs_publico:
            print(colorir(cor="amarelo", texto="⚠  /logs/ui acessível via ngrok — qualquer um pode ver."))
        else:
            print(colorir(cor="verde", texto="✔  /logs/ui disponível apenas em http://localhost:8000/logs/ui"))
    else:
        host = "localhost"
        print(f"\n========================================\nAcesse: http://localhost:8000\n========================================\n")

    logging.info("Começou a execussão")
    gerar_doc_ia(app, output_file="openapi_ai.yaml")
    uvicorn.run("main:app", host=host, port=8000, reload=True)
    logging.info("Finalizou a execussão")