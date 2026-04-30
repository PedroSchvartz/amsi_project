import os
import re
import shutil
import time
from datetime import datetime, timedelta
from queue import Queue

try:
    from utils.Thread_Manager.teste1 import ThreadManager
except ImportError:
    from Thread_Manager.teste1 import ThreadManager


def _formatar_bytes(total: int) -> str:
    for unidade in ['B', 'KB', 'MB', 'GB', 'TB']:
        if total < 1024:
            return f"{total:.1f}{unidade}"
        total /= 1024
    return f"{total:.1f}PB"


def limpar_cache(
    base_dir: str = os.getcwd(),
    padroes: list = None,
    ignorar: list = None,
    max_workers: int = 8,
    update_interval: float = 0.1,
) -> dict:
    """
    Remove arquivos e diretórios cujo nome contenha qualquer padrão de `padroes`.

    Parâmetros:
    -----------
    base_dir      : diretório raiz da varredura
    padroes       : lista de termos a buscar no nome (padrão: ["cache"])
    ignorar       : lista de caminhos absolutos ou nomes a ignorar
    max_workers   : limite de threads
    update_interval: intervalo de atualização da barra (segundos)

    Retorna:
    --------
    dict com chaves: removidos, bytes_liberados, itens, erros
    """
    if padroes is None:
        padroes = ["cache"]
    padroes_lower = [p.lower() for p in padroes]

    ignorar_set = set()
    ignorar_set.add(os.path.abspath(__file__).lower())
    ignorar_set.add(os.path.basename(__file__).lower())
    if ignorar:
        for i in ignorar:
            ignorar_set.add(os.path.abspath(i).lower())
            ignorar_set.add(os.path.basename(i).lower())

    def _ignorado(caminho: str, nome: str) -> bool:
        return (
            os.path.abspath(caminho).lower() in ignorar_set
            or nome.lower() in ignorar_set
        )

    def _bate_padrao(nome: str) -> bool:
        nome_lower = nome.lower()
        return any(p in nome_lower for p in padroes_lower)

    alvos        = []
    nao_alvos    = []
    total_bytes  = 0

    for root, dirs, files in os.walk(base_dir, topdown=False):
        for nome in dirs + files:
            caminho = os.path.join(root, nome)
            if _ignorado(caminho, nome):
                continue
            if _bate_padrao(nome):
                alvos.append(caminho)
                try:
                    if os.path.isfile(caminho):
                        total_bytes += os.path.getsize(caminho)
                    else:
                        for r, _, fs in os.walk(caminho):
                            for f in fs:
                                try:
                                    total_bytes += os.path.getsize(os.path.join(r, f))
                                except OSError:
                                    pass
                except OSError:
                    pass
            else:
                nao_alvos.append(nome)

    if not alvos:
        print("Nenhum cache encontrado.")
        return {"removidos": 0, "bytes_liberados": 0, "itens": [], "erros": []}

    print(f"Removendo {len(alvos)} item(ns) (~{_formatar_bytes(total_bytes)}) em até {max_workers} threads...")

    processed_bytes = 0
    start           = time.time()
    last_update     = start
    bar_len         = 40
    last_remaining  = 0.0
    last_eta        = None

    q = Queue()

    def _worker(caminho: str):
        erro = None
        sz   = 0
        try:
            if os.path.isfile(caminho):
                sz = os.path.getsize(caminho)
                os.remove(caminho)
            elif os.path.isdir(caminho):
                for r, _, fs in os.walk(caminho):
                    for f in fs:
                        try:
                            sz += os.path.getsize(os.path.join(r, f))
                        except OSError:
                            pass
                shutil.rmtree(caminho)
        except Exception as e:
            erro = str(e)
        q.put((caminho, sz, erro))

    manager  = ThreadManager(tipo='io', max_cap=max_workers)
    [manager.submit(_worker, caminho) for caminho in alvos]

    removidos = 0
    erros     = []
    deletados = []

    while manager.active_count() > 0:
        now = time.time()
        if now - last_update >= update_interval:
            while not q.empty():
                caminho, sz, erro = q.get_nowait()
                if erro:
                    erros.append((caminho, erro))
                else:
                    removidos += 1
                    deletados.append(caminho)
                processed_bytes += sz

            elapsed = now - start
            if processed_bytes > 0:
                avg            = processed_bytes / elapsed
                last_remaining = (total_bytes - processed_bytes) / avg if avg else 0
                last_eta       = datetime.now() + timedelta(seconds=last_remaining)

            frac   = processed_bytes / total_bytes if total_bytes else 0
            filled = int(bar_len * frac)
            bar    = '=' * filled + '-' * (bar_len - filled)
            eta    = last_eta.strftime('%H:%M:%S') if last_eta else '--:--:--'

            print(
                f"\r[{bar}] {frac:.1%}  "
                f"Elapsed: {elapsed:.1f}s  "
                f"Remaining: {last_remaining:.1f}s  "
                f"ETA: {eta}",
                end=''
            )
            last_update = now
        time.sleep(0.01)

    manager.shutdown()
    while not q.empty():
        caminho, sz, erro = q.get_nowait()
        if erro:
            erros.append((caminho, erro))
        else:
            removidos += 1
            deletados.append(caminho)
        processed_bytes += sz

    total_elapsed = time.time() - start
    end_clock     = datetime.now().strftime('%H:%M:%S')
    print(
        f"\r[{'=' * bar_len}] 100.0%  "
        f"Elapsed: {total_elapsed:.1f}s  "
        f"Remaining: 0.0s  "
        f"ETA: {end_clock}"
    )

    if deletados:
        print("\nItens removidos:")
        for caminho in deletados:
            print(f"  \033[32m✓\033[0m {caminho}")

    liberados_fmt = _formatar_bytes(processed_bytes)
    print(f"\nCache limpo: {removidos} item(ns) removido(s) — {liberados_fmt} liberado(s).")

    if erros:
        print(f"\n\033[33m{len(erros)} erro(s):\033[0m")
        for caminho, msg in erros:
            print(f"  \033[31m✗\033[0m {caminho}: {msg}")

    # Sugestões: nomes não deletados que contêm "cache" mas não eram cobertos por nenhum padrão
    sugestoes = set()
    for nome in nao_alvos:
        nome_lower = nome.lower()
        if "cache" in nome_lower:
            # extrai o trecho exato que contém "cache" (ex: "__pycache__" -> "__pycache__")
            sugestoes.add(nome_lower)

    if sugestoes:
        print(f"\n\033[33mNomes não cobertos pelos padrões atuais que contêm 'cache':\033[0m")
        for s in sorted(sugestoes):
            print(f"  \033[93m?\033[0m '{s}' — adicionar em padroes?")

    return {
        "removidos":      removidos,
        "bytes_liberados": processed_bytes,
        "itens":          deletados,
        "erros":          erros,
    }


if __name__ == "__main__":
    limpar_cache()