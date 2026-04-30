import json
import time
import os
import logging
from datetime import datetime
from collections import deque
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

# ── armazenamento em memória (últimas 500 requisições) ──────────────────────
_request_log: deque = deque(maxlen=500)
_log_file_path: str = None


def _init_log_file():
    global _log_file_path
    if _log_file_path is None:
        os.makedirs("logs", exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        _log_file_path = f"logs/requests_{timestamp}.json"
        with open(_log_file_path, "w", encoding="utf-8") as f:
            json.dump([], f)
    return _log_file_path


def _append_to_file(entry: dict):
    path = _init_log_file()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        data.append(entry)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.warning(f"Falha ao salvar log de request: {e}")


# ── middleware ───────────────────────────────────────────────────────────────
class RequestLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = round((time.time() - start) * 1000, 2)

        forwarded_for = request.headers.get("x-forwarded-for")
        ip = forwarded_for.split(",")[0].strip() if forwarded_for else request.client.host

        entry = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "method": request.method,
            "path": request.url.path,
            "query": str(request.url.query) if request.url.query else None,
            "status": response.status_code,
            "ip": ip,
            "duration_ms": duration_ms,
            "user_agent": request.headers.get("user-agent", ""),
        }

        _request_log.appendleft(entry)
        _append_to_file(entry)

        return response


# ── router com endpoint de UI ────────────────────────────────────────────────
router = APIRouter(tags=["Logs"])


@router.get("/logs/", response_model=list)
def listar_logs():
    return list(_request_log)


@router.get("/logs/ui", response_class=HTMLResponse)
def logs_ui():
    entries = list(_request_log)
    import json as _json
    entries_json = _json.dumps(entries, ensure_ascii=False)

    def status_class(code):
        if code < 300: return "ok"
        if code < 400: return "redirect"
        if code < 500: return "client-err"
        return "server-err"

    def dur_class(ms):
        if ms < 100: return "dur-fast"
        if ms < 500: return "dur-mid"
        return "dur-slow"

    rows = ""
    for e in entries:
        sc = status_class(e["status"])
        dc = dur_class(e["duration_ms"])
        path = e["path"]
        if e.get("query"):
            path += f"?{e['query']}"
        err_row = ' class="error-row"' if e["status"] >= 400 else ""
        rows += f"""
        <tr data-method="{e['method']}" data-status="{sc}"{err_row}>
            <td class="ts">{e['timestamp']}</td>
            <td class="method {e['method'].lower()}">{e['method']}</td>
            <td class="path">{path}</td>
            <td class="status {sc}">{e['status']}</td>
            <td class="dur {dc}">{e['duration_ms']} ms</td>
            <td class="ip">{e['ip']}</td>
        </tr>"""

    total = len(entries)
    ok = sum(1 for e in entries if e["status"] < 300)
    erros = sum(1 for e in entries if e["status"] >= 400)

    # JSON embutido para exportação (escapado para JS)
    json_data = json.dumps(entries, ensure_ascii=False, indent=2).replace('\\', '\\\\').replace('`', '\\`')

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AMSI · Request Log</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;500&display=swap');

  :root {{
    --bg: #0d0f12;
    --surface: #13161b;
    --border: #1e2330;
    --text: #e8ecf4;
    --muted: #7a8499;
    --green: #3dd68c;
    --yellow: #f0c040;
    --red: #f25f5c;
    --blue: #5b9cf6;
    --orange: #f4813f;
    --purple: #b87eff;
  }}

  * {{ box-sizing: border-box; margin: 0; padding: 0; }}

  body {{
    background: var(--bg);
    color: var(--text);
    font-family: 'IBM Plex Sans', sans-serif;
    font-weight: 300;
    min-height: 100vh;
  }}

  header {{
    border-bottom: 1px solid var(--border);
    padding: 20px 32px;
    display: flex;
    align-items: baseline;
    gap: 16px;
  }}

  header h1 {{
    font-family: 'IBM Plex Mono', monospace;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--blue);
  }}

  header span {{
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.75rem;
    color: var(--muted);
  }}

  .stats {{
    display: flex;
    gap: 1px;
    background: var(--border);
    border-bottom: 1px solid var(--border);
  }}

  .stat {{
    background: var(--surface);
    padding: 14px 28px;
    flex: 1;
  }}

  .stat-label {{
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 4px;
  }}

  .stat-value {{
    font-family: 'IBM Plex Mono', monospace;
    font-size: 1.6rem;
    font-weight: 600;
  }}

  .stat-value.green {{ color: var(--green); }}
  .stat-value.red   {{ color: var(--red); }}
  .stat-value.blue  {{ color: var(--blue); }}

  .toolbar {{
    padding: 10px 32px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.75rem;
    color: var(--muted);
  }}

  .toolbar button {{
    background: var(--border);
    border: 1px solid transparent;
    color: var(--text);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.7rem;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 2px;
    letter-spacing: 0.05em;
    transition: background 0.1s, border-color 0.1s;
  }}

  .toolbar button:hover {{ background: #2a2f3d; }}
  .toolbar button.active {{ border-color: var(--blue); color: var(--blue); }}
  .toolbar button.active.get    {{ border-color: var(--green);  color: var(--green); }}
  .toolbar button.active.post   {{ border-color: var(--blue);   color: var(--blue); }}
  .toolbar button.active.put    {{ border-color: var(--yellow); color: var(--yellow); }}
  .toolbar button.active.delete {{ border-color: var(--red);    color: var(--red); }}
  .toolbar button.active.ok         {{ border-color: var(--green);  color: var(--green); }}
  .toolbar button.active.client-err {{ border-color: var(--orange); color: var(--orange); }}
  .toolbar button.active.server-err {{ border-color: var(--red);    color: var(--red); }}
  .toolbar button.active.redirect   {{ border-color: var(--yellow); color: var(--yellow); }}
  .toolbar button.export {{ border-color: var(--purple); color: var(--purple); margin-left: auto; }}
  .toolbar button.export:hover {{ background: rgba(184,126,255,0.08); }}

  .sep {{ color: var(--border); margin: 0 4px; }}

  /* ── modal ── */
  .modal-overlay {{
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    z-index: 100;
    align-items: center;
    justify-content: center;
  }}
  .modal-overlay.open {{ display: flex; }}

  .modal {{
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    width: min(720px, 90vw);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }}

  .modal-header {{
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
  }}

  .modal-header span {{
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.8rem;
    color: var(--purple);
    flex: 1;
  }}

  .modal-header button {{
    background: var(--border);
    border: 1px solid transparent;
    color: var(--text);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.7rem;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 2px;
    letter-spacing: 0.05em;
    transition: background 0.1s;
  }}

  .modal-header button:hover {{ background: #2a2f3d; }}
  .modal-header button.copy-btn {{ border-color: var(--blue); color: var(--blue); }}
  .modal-header button.copy-btn.copied {{ border-color: var(--green); color: var(--green); }}
  .modal-header button.dl-btn {{ border-color: var(--green); color: var(--green); }}
  .modal-header button.close-btn {{ border-color: var(--muted); color: var(--muted); }}

  .modal-body {{
    overflow-y: auto;
    padding: 16px 20px;
  }}

  .modal-body pre {{
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.72rem;
    color: var(--text);
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.6;
  }}

  .table-wrap {{
    overflow-x: auto;
    padding: 0 0 40px;
  }}

  table {{
    width: 100%;
    border-collapse: collapse;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.78rem;
  }}

  thead tr {{ border-bottom: 1px solid var(--border); }}

  thead th {{
    padding: 10px 16px;
    text-align: left;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 400;
  }}

  tbody tr {{
    border-bottom: 1px solid #151820;
    transition: background 0.1s;
  }}

  tbody tr:hover {{ background: #151820; }}

  tbody tr.error-row {{
    background: rgba(242, 95, 92, 0.06);
    border-left: 2px solid var(--red);
  }}

  tbody tr.error-row:hover {{ background: rgba(242, 95, 92, 0.12); }}

  td {{ padding: 9px 16px; vertical-align: middle; }}

  .ts {{ color: var(--muted); white-space: nowrap; }}

  .method {{
    font-weight: 600;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }}
  .method.get     {{ color: var(--green); }}
  .method.post    {{ color: var(--blue); }}
  .method.put     {{ color: var(--yellow); }}
  .method.delete  {{ color: var(--red); }}
  .method.options {{ color: var(--purple); }}
  .method.patch   {{ color: var(--orange); }}

  .path {{ color: var(--text); word-break: break-all; }}

  .status {{ font-weight: 600; white-space: nowrap; }}
  .status.ok          {{ color: var(--green); }}
  .status.redirect    {{ color: var(--yellow); }}
  .status.client-err  {{ color: var(--orange); }}
  .status.server-err  {{ color: var(--red); }}

  .dur {{ white-space: nowrap; text-align: right; font-weight: 600; }}
  .dur-fast {{ color: var(--green); }}
  .dur-mid  {{ color: var(--yellow); }}
  .dur-slow {{ color: var(--red); }}

  .ip {{ color: var(--muted); white-space: nowrap; }}

  .hidden {{ display: none; }}

  .empty {{
    text-align: center;
    padding: 60px;
    color: var(--muted);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.8rem;
  }}
</style>
</head>
<body>

<header>
  <h1>AMSI · REQUEST LOG</h1>
  <span>últimas {total} requisições · {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</span>
</header>

<div class="stats">
  <div class="stat">
    <div class="stat-label">Total</div>
    <div class="stat-value blue">{total}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Sucesso (2xx)</div>
    <div class="stat-value green">{ok}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Erros (4xx/5xx)</div>
    <div class="stat-value red">{erros}</div>
  </div>
</div>

<div class="toolbar">
  <button onclick="location.reload()">↻ Atualizar</button>
  <button onclick="abrirModal()" style="border-color:var(--purple);color:var(--purple);">⬇ Exportar JSON</button>
  <span class="sep">|</span>
  <span>Método:</span>
  <button class="active" onclick="filterMethod(this, '')">Todos</button>
  <button class="get"    onclick="filterMethod(this, 'GET')">GET</button>
  <button class="post"   onclick="filterMethod(this, 'POST')">POST</button>
  <button class="put"    onclick="filterMethod(this, 'PUT')">PUT</button>
  <button class="delete" onclick="filterMethod(this, 'DELETE')">DELETE</button>
  <span class="sep">|</span>
  <span>Status:</span>
  <button class="active" onclick="filterStatus(this, '')">Todos</button>
  <button class="ok"         onclick="filterStatus(this, 'ok')">2xx</button>
  <button class="redirect"   onclick="filterStatus(this, 'redirect')">3xx</button>
  <button class="client-err" onclick="filterStatus(this, 'client-err')">4xx</button>
  <button class="server-err" onclick="filterStatus(this, 'server-err')">5xx</button>
  <button class="export" onclick="openModal()">⬇ Exportar JSON</button>
</div>

<!-- Modal -->
<div id="modal-overlay" onclick="fecharModal()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100;align-items:center;justify-content:center;">
  <div onclick="event.stopPropagation()" style="background:var(--surface);border:1px solid var(--border);border-radius:4px;width:min(700px,90vw);max-height:80vh;display:flex;flex-direction:column;">
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
      <span style="font-family:monospace;font-size:0.8rem;color:var(--blue);">EXPORTAR JSON</span>
      <div style="display:flex;gap:8px;">
        <button id="btn-copiar" onclick="copiarJSON()" style="background:var(--border);border:1px solid transparent;color:var(--text);font-family:monospace;font-size:0.7rem;padding:4px 14px;cursor:pointer;border-radius:2px;">Copiar</button>
        <button onclick="baixarJSON()" style="background:var(--border);border:1px solid var(--purple);color:var(--purple);font-family:monospace;font-size:0.7rem;padding:4px 14px;cursor:pointer;border-radius:2px;">⬇ Download</button>
        <button onclick="fecharModal()" style="background:transparent;border:none;color:var(--muted);font-size:1rem;cursor:pointer;padding:0 4px;">✕</button>
      </div>
    </div>
    <textarea id="json-preview" readonly style="flex:1;background:#0a0c0f;color:var(--green);font-family:monospace;font-size:0.72rem;padding:16px;border:none;resize:none;outline:none;overflow:auto;min-height:300px;"></textarea>
  </div>
</div>
<div class="table-wrap">
{'<table id="log-table"><thead><tr><th>Timestamp</th><th>Método</th><th>Rota</th><th>Status</th><th>Duração</th><th>IP</th></tr></thead><tbody>' + rows + '</tbody></table>' if entries else '<div class="empty">Nenhuma requisição registrada ainda.</div>'}
</div>

<!-- modal -->
<div class="modal-overlay" id="modal" onclick="closeOnOverlay(event)">
  <div class="modal">
    <div class="modal-header">
      <span>requests_{datetime.now().strftime("%Y-%m-%d_%H-%M-%S")}.json</span>
      <button class="copy-btn" id="copy-btn" onclick="copyJson()">⎘ Copiar</button>
      <button class="dl-btn" onclick="downloadJson()">⬇ Baixar</button>
      <button class="close-btn" onclick="closeModal()">✕ Fechar</button>
    </div>
    <div class="modal-body">
      <pre id="json-content"></pre>
    </div>
  </div>
</div>

<script>
  const JSON_DATA = `{json_data}`;
  const FILENAME = 'requests_{datetime.now().strftime("%Y-%m-%d_%H-%M-%S")}.json';

  let activeMethod = '';
  let activeStatus = '';

  function applyFilters() {{
    const rows = document.querySelectorAll('#log-table tbody tr');
    rows.forEach(row => {{
      const method = row.dataset.method || '';
      const status = row.dataset.status || '';
      const methodOk = !activeMethod || method === activeMethod;
      const statusOk = !activeStatus || status === activeStatus;
      row.classList.toggle('hidden', !(methodOk && statusOk));
    }});
  }}

  function filterMethod(btn, val) {{
    activeMethod = val;
    const methodBtns = [...btn.closest('.toolbar').querySelectorAll('button')].filter(b =>
      b.onclick && b.onclick.toString().includes('filterMethod')
    );
    methodBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
  }}

  function filterStatus(btn, val) {{
    activeStatus = val;
    const statusBtns = [...btn.closest('.toolbar').querySelectorAll('button')].filter(b =>
      b.onclick && b.onclick.toString().includes('filterStatus')
    );
    statusBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
  }}

  function openModal() {{
    document.getElementById('json-content').textContent = JSON_DATA;
    document.getElementById('modal').classList.add('open');
  }}

  function closeModal() {{
    document.getElementById('modal').classList.remove('open');
  }}

  function closeOnOverlay(e) {{
    if (e.target === document.getElementById('modal')) closeModal();
  }}

  function copyJson() {{
    navigator.clipboard.writeText(JSON_DATA).then(() => {{
      const btn = document.getElementById('copy-btn');
      btn.textContent = '✔ Copiado!';
      btn.classList.add('copied');
      setTimeout(() => {{
        btn.textContent = '⎘ Copiar';
        btn.classList.remove('copied');
      }}, 2000);
    }});
  }}

  function downloadJson() {{
    const blob = new Blob([JSON_DATA], {{type: 'application/json'}});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  }}

  document.addEventListener('keydown', e => {{
    if (e.key === 'Escape') closeModal();
  }});

  const _jsonData = {entries_json};

  function abrirModal() {{
    document.getElementById('json-preview').value = JSON.stringify(_jsonData, null, 2);
    const overlay = document.getElementById('modal-overlay');
    overlay.style.display = 'flex';
  }}

  function fecharModal() {{
    document.getElementById('modal-overlay').style.display = 'none';
  }}

  function copiarJSON() {{
    const ta = document.getElementById('json-preview');
    ta.select();
    document.execCommand('copy');
    const btn = document.getElementById('btn-copiar');
    btn.textContent = '✔ Copiado';
    setTimeout(() => btn.textContent = 'Copiar', 2000);
  }}

  function baixarJSON() {{
    const blob = new Blob([JSON.stringify(_jsonData, null, 2)], {{type: 'application/json'}});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'amsi_requests.json';
    a.click();
  }}
</script>

</body>
</html>"""
    return HTMLResponse(content=html)