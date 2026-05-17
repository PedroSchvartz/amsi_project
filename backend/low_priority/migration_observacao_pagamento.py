import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='lancamento' AND column_name='observacao_pagamento'"
    ))
    existe = result.fetchone()
    if existe:
        print("Coluna observacao_pagamento ja existe — nada a fazer.")
    else:
        conn.execute(text("ALTER TABLE lancamento ADD COLUMN observacao_pagamento TEXT"))
        conn.commit()
        print("OK: coluna observacao_pagamento adicionada com sucesso.")
