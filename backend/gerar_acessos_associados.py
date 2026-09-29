"""
Gera acessos (usuários com login por CPF) para os ASSOCIADOS a partir dos clifors.
Rodada ÚNICA de bootstrap do item 13.

Regras (definidas pelo Pedro):
  - Só clifor CLIENTE puro (tipo_clifor == "C") — "Ambos" NÃO conta.
  - Só pessoa física (pessoafisica_juridica == True) e ativo.
  - CPF válido (11 dígitos após remover a máscara).
Para cada elegível: cria usuário (perfil Consulta, sem cargo, sem e-mail, senha inicial =
5 primeiros dígitos do CPF, primeiro_acesso=True) E marca clifor.associado = True.
Idempotente: pula quem já tem acesso (login já existe).

⚠️ Roda no banco que o database.py apontar. Use no SANDBOX local para testar. Em PRODUÇÃO,
quem roda é o Pedro (conferir o alvo do DATABASE_URL antes).

    python gerar_acessos_associados.py
"""
import os
import re
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Importa todos os models para registrar os mappers do SQLAlchemy (relationships por nome).
import models.usuario  # noqa: F401
import models.cliente_fornecedor  # noqa: F401
import models.contato  # noqa: F401
import models.endereco  # noqa: F401
import models.login  # noqa: F401
import models.lancamento  # noqa: F401
import models.tipo_conta  # noqa: F401  (Lancamento tem relationship("tipo_conta") por nome)

from database import SessionLocal
from models.cliente_fornecedor import ClienteFornecedor, TipoCliForEnum
from utils.vinculo_clifor import gerar_acesso_clifor, AcessoJaExisteError


def clifors_elegiveis(db):
    """Clientes puros (tipo C), PF, ativos, com CPF de 11 dígitos."""
    candidatos = db.query(ClienteFornecedor).filter(
        ClienteFornecedor.tipo_clifor == TipoCliForEnum.Cliente,
        ClienteFornecedor.pessoafisica_juridica == True,  # noqa: E712
        ClienteFornecedor.ativo == True,  # noqa: E712
    ).all()
    return [c for c in candidatos if len(re.sub(r"\D", "", c.cpf_cnpj or "")) == 11]


def main():
    db = SessionLocal()
    criados, pulados = 0, 0
    try:
        elegiveis = clifors_elegiveis(db)
        print(f"Clifors elegíveis (Cliente PF ativo c/ CPF): {len(elegiveis)}")
        for clifor in elegiveis:
            try:
                usuario = gerar_acesso_clifor(clifor, db, marcar_associado=True)
                db.commit()
                criados += 1
                print(f"  + acesso criado: clifor {clifor.id_clifor} '{clifor.nome}' "
                      f"login={usuario.login} (senha inicial={usuario.login[:5]})")
            except AcessoJaExisteError:
                db.rollback()
                pulados += 1
                print(f"  = já tinha acesso: clifor {clifor.id_clifor} '{clifor.nome}'")
            except ValueError:
                db.rollback()
                pulados += 1
                print(f"  ! sem documento válido: clifor {clifor.id_clifor} '{clifor.nome}'")
        print(f"\nResumo: {criados} criado(s), {pulados} pulado(s).")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
