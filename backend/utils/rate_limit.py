"""Limiter compartilhado (slowapi) para os endpoints públicos sensíveis.

Fica ATIVO apenas em produção. Em dev/teste o limiter nasce desligado (`enabled=False`)
para não atrapalhar a suíte automatizada, que faz muitos logins em sequência a partir
do mesmo IP. O teste de rate limit liga `limiter.enabled = True` pontualmente.

Storage em memória — suficiente para a instância única do Railway.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from utils.config import APP_ENV

limiter = Limiter(key_func=get_remote_address, enabled=(APP_ENV == "production"))
