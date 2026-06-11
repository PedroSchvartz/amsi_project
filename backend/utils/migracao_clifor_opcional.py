"""
Migração: torna rg_inscricaoestadual e datanascimento OPCIONAIS na tabela
clientefornecedor (DROP NOT NULL).

Idempotente — pode rodar quantas vezes quiser (DROP NOT NULL não falha se a
coluna já for nullable). Aplica-se ao banco apontado por DATABASE_URL.

Uso:
    # Banco local
    python -X utf8 utils/migracao_clifor_opcional.py

    # Banco de produção (Railway), usando as env vars do projeto linkado
    railway run python -X utf8 utils/migracao_clifor_opcional.py
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import SessionLocal

COLUNAS = ["rg_inscricaoestadual", "datanascimento"]


def migrar():
    db = SessionLocal()
    dialect = db.bind.dialect.name
    if dialect != "postgresql":
        print(f"⚠ Banco '{dialect}' não é PostgreSQL — migração ignorada "
              f"(em testes as tabelas já nascem com as colunas nullable pelo model).")
        db.close()
        return

    try:
        for coluna in COLUNAS:
            db.execute(
                text(f"ALTER TABLE clientefornecedor ALTER COLUMN {coluna} DROP NOT NULL")
            )
            print(f"✔ clientefornecedor.{coluna} agora aceita NULL")
        db.commit()
        print("✨ Migração concluída.")
    except Exception as e:
        db.rollback()
        print(f"✖ Erro na migração: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrar()
