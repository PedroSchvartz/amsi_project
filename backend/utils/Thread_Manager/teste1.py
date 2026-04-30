import os
import threading
from datetime import datetime, timedelta
from typing import Callable, Any

import psutil


def calcular_threads_ideais(tipo: str = "io",
                             memoria_minima_mb: int = 500,
                             max_cap: int = 32) -> int:
    """
    Calcula o número ideal de threads/processos para este sistema.

    Parâmetros:
    -----------
    tipo : str
        'io' para tarefas I/O-bound, 'cpu' para CPU-bound.
    memoria_minima_mb : int
        Limite mínimo de memória disponível (em MB) antes de limitar threads.
    max_cap : int
        Valor máximo de threads permitido para tarefas I/O-bound.

    Retorna:
    --------
    int
        Número ideal de threads/processos.
    """
    nucleos = os.cpu_count() or 1
    mem_disponivel = psutil.virtual_memory().available
    carga = psutil.cpu_percent(interval=1)

    if tipo == "cpu":
        if carga > 80:
            return max(1, int(nucleos * 0.5))
        return max(1, nucleos)
    elif tipo == "io":
        if mem_disponivel < memoria_minima_mb * 1024 * 1024:
            return min(4, nucleos)
        return min(max_cap, max(4, nucleos * 2))
    else:
        raise ValueError("Tipo inválido. Use 'io' ou 'cpu'.")


class ThreadManager:
    """
    Gerencia execução de funções em threads, respeitando limite ideal.
    Usa um semáforo para bloquear submissões até haver capacidade.

    Exemplo de uso:
    --------------
    manager = ThreadManager(tipo='io')
    task = manager.submit(minha_func, arg1, arg2)
    result = task.join()
    """
    def __init__(self,
                 tipo: str = 'io',
                 memoria_minima_mb: int = 500,
                 max_cap: int = 32):
        self.max_threads = calcular_threads_ideais(tipo, memoria_minima_mb, max_cap)
        self._semaphore = threading.Semaphore(self.max_threads)
        self._lock = threading.Lock()
        self._tasks = set()

    def submit(self, func: Callable[..., Any], *args, **kwargs) -> threading.Thread:
        """
        Submete a função `func` para execução em thread. Se atingir o limite,
        aguarda até liberar capacidade.

        Retorna:
        --------
        threading.Thread
            Thread que executa `func(*args, **kwargs)`.
        """
        # Aguarda até que haja permissão para nova thread
        self._semaphore.acquire()

        def _wrapper():
            try:
                return func(*args, **kwargs)
            finally:
                # Libera permissão após conclusão
                self._semaphore.release()

        thread = threading.Thread(target=_wrapper, daemon=True)
        with self._lock:
            self._tasks.add(thread)
        thread.start()
        return thread

    def join_all(self, timeout: float = None) -> None:
        """
        Aguarda a conclusão de todas as threads submetidas.

        Parâmetros:
        -----------
        timeout : float | None
            Tempo máximo em segundos para aguardar cada thread.
        """
        with self._lock:
            tasks = list(self._tasks)
        for thread in tasks:
            thread.join(timeout)

    def active_count(self) -> int:
        """
        Retorna o número de threads ativas.
        """
        with self._lock:
            return sum(1 for t in self._tasks if t.is_alive())

    def shutdown(self) -> None:
        """
        Garante que todas as threads sejam concluídas (join) antes de encerrar.
        """
        self.join_all()
