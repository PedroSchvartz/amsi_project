"""Registro em memória dos jobs de exportação de lançamentos.

Vive no processo porque o deploy roda em worker único (uvicorn sem --workers).
Consequência assumida: os jobs se perdem em restart/redeploy — aceitável para
arquivos efêmeros de exportação, que o usuário refaz num clique.

Cada job guarda o resultado (bytes do .xlsx) e um Event de cancelamento que o
worker consulta no laço de montagem da planilha. A entrega (download ou e-mail)
NÃO é decidida aqui: o job só gera e guarda; quem entrega são as rotas.
"""
import threading
import uuid
from datetime import datetime, timedelta

# Status possíveis de um job.
PROCESSANDO = "processando"
CONCLUIDO = "concluido"
CANCELADO = "cancelado"
ERRO = "erro"

# Jobs concluídos/parados são varridos depois disto — segura o suficiente para o
# polling do frontend baixar, sem vazar memória com resultados esquecidos.
_TTL = timedelta(minutes=15)

_JOBS: dict[str, dict] = {}
_lock = threading.Lock()


def _limpar_expirados():
    """Remove jobs velhos. Chamado ao criar — não precisa de agendador à parte."""
    limite = datetime.utcnow() - _TTL
    expirados = [jid for jid, j in _JOBS.items() if j["criado_em"] < limite]
    for jid in expirados:
        _JOBS.pop(jid, None)


def criar(user_id: int, filtros_desc: str, data_pesquisa: datetime) -> str:
    """Cria um job em estado 'processando' e devolve o id."""
    job_id = uuid.uuid4().hex
    with _lock:
        _limpar_expirados()
        _JOBS[job_id] = {
            "id": job_id,
            "user_id": user_id,
            "status": PROCESSANDO,
            "cancel_event": threading.Event(),
            "resultado": None,
            "filename": None,
            "filtros_desc": filtros_desc,
            "data_pesquisa": data_pesquisa,
            "error": None,
            "criado_em": datetime.utcnow(),
        }
    return job_id


def obter(job_id: str) -> dict | None:
    with _lock:
        return _JOBS.get(job_id)


def cancelado(job_id: str) -> bool:
    """True se o job foi marcado para cancelar — o worker consulta isto no laço."""
    job = obter(job_id)
    return bool(job and job["cancel_event"].is_set())


def marcar_concluido(job_id: str, resultado: bytes, filename: str):
    with _lock:
        job = _JOBS.get(job_id)
        if job and job["status"] == PROCESSANDO:
            job["resultado"] = resultado
            job["filename"] = filename
            job["status"] = CONCLUIDO


def marcar_erro(job_id: str, mensagem: str):
    with _lock:
        job = _JOBS.get(job_id)
        if job and job["status"] == PROCESSANDO:
            job["error"] = mensagem
            job["status"] = ERRO


def marcar_cancelado(job_id: str):
    with _lock:
        job = _JOBS.get(job_id)
        if job:
            job["status"] = CANCELADO


def cancelar(job_id: str):
    """Sinaliza o cancelamento; o worker para na próxima checagem."""
    job = obter(job_id)
    if job:
        job["cancel_event"].set()
