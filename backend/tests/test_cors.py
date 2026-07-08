from utils.config import FRONTEND_URL

# CORS deixou de ser allow_origins=["*"] (auditoria #5). Em dev/teste a origem do
# frontend (Vercel) e o dev server do Vite são permitidos; qualquer outra origem
# não recebe header CORS — o navegador bloqueia a resposta.

_FRONTEND = FRONTEND_URL.rstrip("/")


def test_cors_ecoa_origem_do_frontend(client):
    """A origem do frontend é permitida e ecoada no Access-Control-Allow-Origin."""
    r = client.get("/", headers={"Origin": _FRONTEND})
    assert r.headers.get("access-control-allow-origin") == _FRONTEND


def test_cors_libera_dev_server_do_vite(client):
    """Fora de produção o dev server do Vite (localhost:5173) é permitido."""
    origem = "http://localhost:5173"
    r = client.get("/", headers={"Origin": origem})
    assert r.headers.get("access-control-allow-origin") == origem


def test_cors_nao_ecoa_origem_desconhecida(client):
    """Origem arbitrária não recebe header CORS (não há mais wildcard)."""
    r = client.get("/", headers={"Origin": "https://evil.example.com"})
    acao = r.headers.get("access-control-allow-origin")
    assert acao != "https://evil.example.com"
    assert acao != "*"
