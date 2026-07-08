from utils.request_logger import _request_log

# _request_log é um deque em memória (maxlen=500), não tabela monitorada pelo
# db_snapshot — por isso não precisamos limpar nada ao injetar entradas aqui.


def test_logs_ui_escapa_payload_xss(client):
    payload = "<img src=x onerror=alert(1)>"
    _request_log.appendleft({
        "timestamp": "2026-06-21 00:00:00", "method": "GET",
        "path": "/" + payload, "query": None, "status": 404,
        "ip": payload, "duration_ms": 1.0, "user_agent": "pytest",
    })
    r = client.get("/logs/ui")
    assert r.status_code == 200
    assert payload not in r.text                                  # cru NÃO aparece
    assert "&lt;img src=x onerror=alert(1)&gt;" in r.text         # forma escapada aparece


def test_logs_ui_neutraliza_breakout_de_script(client):
    _request_log.appendleft({
        "timestamp": "2026-06-21 00:00:00", "method": "GET",
        "path": "/x", "query": "q=</script><script>alert(2)</script>",
        "status": 404, "ip": "1.2.3.4", "duration_ms": 1.0, "user_agent": "pytest",
    })
    r = client.get("/logs/ui")
    assert r.status_code == 200
    assert "<script>alert(2)</script>" not in r.text              # breakout neutralizado
