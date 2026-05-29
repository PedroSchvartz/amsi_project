from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class LogAtividadeResponse(BaseModel):
    id_log:        int
    id_login_fk:   Optional[int] = None
    id_usuario_fk: Optional[int] = None
    timestamp:     datetime
    metodo:        str
    endpoint:      str
    entidade:      Optional[str] = None
    id_entidade:   Optional[int] = None
    descricao:     Optional[str] = None
    status_code:   int

    model_config = ConfigDict(from_attributes=True)
