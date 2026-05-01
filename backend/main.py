# ponto de entrada, registra as rotas
from fastapi import FastAPI
import logging

from database import engine, Base
from models import usuario, tipo_conta, cliente_fornecedor, endereco, contato, login, lancamento, token_ativo
from routes import usuario as usuario_router
from routes import login as login_router
from routes import tipo_conta as tipo_lancamento_router
from routes import cliente_fornecedor as clifor_router
from routes import endereco as endereco_router
from routes import contato as contato_router
from routes import lancamento as lancamento_router
from auth.router import router as auth_router

from fastapi.middleware.cors import CORSMiddleware
from utils.request_logger import RequestLoggerMiddleware, router as logs_router

Base.metadata.create_all(bind=engine)

from fastapi.security import HTTPBearer
from fastapi.openapi.utils import get_openapi

app = FastAPI(
    title="AMSI Project",
    description="Sistema de gestão e registro de contas da associação de moradores",
    version="0.1.0"
)

http_bearer = HTTPBearer(auto_error=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggerMiddleware)

app.include_router(auth_router)
app.include_router(usuario_router.router)
app.include_router(login_router.router)
app.include_router(tipo_lancamento_router.router)
app.include_router(clifor_router.router)
app.include_router(endereco_router.router)
app.include_router(contato_router.router)
app.include_router(lancamento_router.router)
app.include_router(logs_router)


@app.get("/")
def root():
    return {"status": "online"}


def gerar_doc_ia(app, output_file="openapi_ai.yaml"):
    import yaml

    schema = app.openapi()
    components = schema.get("components", {}).get("schemas", {})
    resultado = []

    def resolve_ref(ref):
        nome = ref.split("/")[-1]
        return components.get(nome, {})

    def extrair_campos(schema_obj):
        if "$ref" in schema_obj:
            schema_obj = resolve_ref(schema_obj["$ref"])
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
        return campos

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

            # parâmetros de path/query
            for param in data.get("parameters", []):
                endpoint["parametros"].append({
                    "nome": param.get("name"),
                    "local": param.get("in"),
                    "obrigatorio": param.get("required", False),
                    "tipo": param.get("schema", {}).get("type", "desconhecido")
                })

            # request body
            body = data.get("requestBody", {})
            if body:
                content = body.get("content", {}).get("application/json", {})
                body_schema = content.get("schema", {})
                endpoint["request_body"] = extrair_campos(body_schema)

            # response 200
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