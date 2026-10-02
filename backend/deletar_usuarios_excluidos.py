"""
Hard-delete dos usuarios SOFT-DELETADOS (Exclusao IS NOT NULL) do banco LOCAL.

Rodada de limpeza antes de promover o sandbox para producao: remove de vez os perfis
marcados como "Excluido". NAO roda em producao -- aborta se o alvo nao for o banco local
(usa banco_e_local() do bootstrap). A DATABASE_URL e carregada pelo proprio backend; o
script nunca a imprime.

Por padrao e SOMENTE-RELATORIO (dry-run): lista os excluidos e a pegada de FK de cada um.
Com --apply, executa a remocao numa unica transacao (tudo-ou-nada).

FKs tratadas (fonte: comentarios/tabelas_do_banco.txt):
  login.id_usuario_fk         (NOT NULL, RESTRICT)  -> apaga as linhas
  token_ativo.id_usuario_fk   (NOT NULL, RESTRICT)  -> apaga as linhas
  lancamento efetivacao/aprovacao/edicao (nullable, RESTRICT) -> seta NULL
  lancamento id_usuario_fk_lancamento (NOT NULL, autor)       -> TRAVA: nao hard-deleta
  log_atividade.id_usuario_fk (SET NULL)  /  senha_token.id_usuario_fk (CASCADE) -> automatico

    python deletar_usuarios_excluidos.py            # relatorio (dry-run)
    python deletar_usuarios_excluidos.py --apply    # executa a remocao
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from sqlalchemy.engine.url import make_url

from database import SessionLocal
from utils.bootstrap import banco_e_local
from utils.config import DATABASE_URL


def main():
    aplicar = "--apply" in sys.argv[1:]

    # Guarda de seguranca: so o banco LOCAL. Nunca producao.
    if not banco_e_local():
        host = make_url(DATABASE_URL).host or "(vazio)"
        print(f"ABORTADO: o alvo NAO e o banco local (host={host!r}). "
              "Este script so roda no sandbox. Nada foi tocado.")
        sys.exit(1)

    db = SessionLocal()
    try:
        excluidos = db.execute(text(
            "SELECT id_usuario, nome, login, email FROM usuario "
            "WHERE exclusao IS NOT NULL ORDER BY id_usuario"
        )).fetchall()

        if not excluidos:
            print("Alvo: banco LOCAL. Nenhum usuario marcado como excluido. Nada a fazer.")
            return

        ids = [r.id_usuario for r in excluidos]
        autores = {row[0] for row in db.execute(text(
            "SELECT DISTINCT id_usuario_fk_lancamento FROM lancamento "
            "WHERE id_usuario_fk_lancamento = ANY(:ids)"
        ), {"ids": ids})}

        print(f"Alvo: banco LOCAL. Usuarios excluidos encontrados: {len(excluidos)}\n")
        deletaveis = []
        for r in excluidos:
            uid = r.id_usuario
            cont = lambda q: db.execute(text(q), {"u": uid}).scalar()  # noqa: E731
            n_login = cont("SELECT count(*) FROM login WHERE id_usuario_fk=:u")
            n_token = cont("SELECT count(*) FROM token_ativo WHERE id_usuario_fk=:u")
            n_efet = cont("SELECT count(*) FROM lancamento WHERE id_usuario_fk_efetivacao=:u")
            n_apr = cont("SELECT count(*) FROM lancamento WHERE id_usuario_fk_aprovacao=:u")
            n_edi = cont("SELECT count(*) FROM lancamento WHERE id_usuario_fk_edicao=:u")
            autor = uid in autores
            flag = "   >> AUTOR DE LANCAMENTO (TRAVA; nao sera deletado)" if autor else ""
            print(f"  id={uid}  nome={r.nome!r}  login={r.login!r}")
            print(f"     login={n_login} token={n_token} "
                  f"efetivacao={n_efet} aprovacao={n_apr} edicao={n_edi}{flag}")
            if not autor:
                deletaveis.append(uid)

        bloqueados = sorted(autores)
        print(f"\nDeletaveis: {len(deletaveis)}  |  "
              f"Travados (autor de lancamento): {len(bloqueados)}")

        if not aplicar:
            print("\n[DRY-RUN] Nada foi alterado. Rode com --apply para executar.")
            return

        if bloqueados:
            print(f"\nABORTADO (--apply): ha excluidos que sao AUTORES de lancamento "
                  f"(ids={bloqueados}). Hard-deletar apagaria autoria financeira. "
                  "Decida antes (manter soft-deletado ou reatribuir). Nada foi alterado.")
            sys.exit(2)

        if not deletaveis:
            print("\nNada a deletar.")
            return

        p = {"ids": deletaveis}
        db.execute(text("UPDATE lancamento SET id_usuario_fk_efetivacao=NULL "
                        "WHERE id_usuario_fk_efetivacao = ANY(:ids)"), p)
        db.execute(text("UPDATE lancamento SET id_usuario_fk_aprovacao=NULL "
                        "WHERE id_usuario_fk_aprovacao = ANY(:ids)"), p)
        db.execute(text("UPDATE lancamento SET id_usuario_fk_edicao=NULL "
                        "WHERE id_usuario_fk_edicao = ANY(:ids)"), p)
        db.execute(text("DELETE FROM token_ativo WHERE id_usuario_fk = ANY(:ids)"), p)
        db.execute(text("DELETE FROM login WHERE id_usuario_fk = ANY(:ids)"), p)
        n = db.execute(text("DELETE FROM usuario WHERE id_usuario = ANY(:ids)"), p).rowcount
        db.commit()
        print(f"\nOK. {n} usuario(s) excluido(s) removido(s) em definitivo do banco local.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
