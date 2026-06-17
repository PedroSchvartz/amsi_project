"""Guarda contra a classe de bug que derrubou GET /lancamento/ em produção.

Incidente (2026-06-17): o modelo `Lancamento` ganhou a coluna `lote`, mas o
`ALTER TABLE` que a cria só existia no `bootstrap.py` (rodado à mão, local).
Em produção o bootstrap nunca roda e o `create_all` não altera tabela que já
existe — então a coluna faltava no banco e todo SELECT do modelo quebrava com
`UndefinedColumn`. Os testes não pegaram porque a base local *tinha* a coluna
(o bootstrap havia rodado nela).

A correção foi mover a migração para `main._aplicar_migracoes()`, que roda no
startup de todo deploy. Estes testes garantem que toda coluna declarada num
modelo exista de fato no banco — ou seja, que exista migração para ela. São
read-only (não alteram schema), então rodam com segurança no banco de dev.
"""
from sqlalchemy import inspect as sa_inspect

# Importar `app` garante que main._aplicar_migracoes() já rodou contra este banco
# (é o mesmo caminho do startup de produção), então a checagem reflete o que um
# deploy real teria aplicado — não o que o bootstrap manual deixou para trás.
from main import app  # noqa: F401
from database import engine, Base


def _colunas_faltando():
    """Pares (tabela, coluna) que o modelo declara mas o banco não tem."""
    insp = sa_inspect(engine)
    tabelas_no_banco = set(insp.get_table_names())
    faltando = []
    for nome_tabela, tabela in Base.metadata.tables.items():
        if nome_tabela not in tabelas_no_banco:
            # create_all deveria ter criado; se não existe é outro problema (não o
            # que estamos guardando aqui), então não mascaramos — registramos.
            faltando.append((nome_tabela, "<tabela inexistente>"))
            continue
        cols_banco = {c["name"] for c in insp.get_columns(nome_tabela)}
        for coluna in tabela.columns:
            if coluna.name not in cols_banco:
                faltando.append((nome_tabela, coluna.name))
    return faltando


def test_colunas_dos_modelos_existem_no_banco():
    """Toda coluna de todo modelo precisa existir no banco após as migrações.

    Se falhar: você adicionou uma coluna a um modelo sem a migração correspondente
    em `main._aplicar_migracoes()`. Adicione o ALTER TABLE lá (idempotente), não só
    no bootstrap.py — senão quebra em produção (a tabela já existe e o create_all
    não a altera).
    """
    faltando = _colunas_faltando()
    assert not faltando, (
        "Colunas declaradas no modelo mas ausentes no banco "
        f"(falta migração em main._aplicar_migracoes()): {faltando}"
    )


def test_coluna_lote_existe_em_lancamento():
    """Regressão direta do incidente: a coluna `lote` precisa existir em lancamento."""
    cols = {c["name"] for c in sa_inspect(engine).get_columns("lancamento")}
    assert "lote" in cols, (
        "Coluna 'lote' ausente em lancamento — a migração de main._aplicar_migracoes() "
        "não rodou ou foi removida. Foi exatamente isso que quebrou /lancamento/ em prod."
    )
