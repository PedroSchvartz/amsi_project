"""
Popula o banco local com dados de teste representativos.
Idempotente: nao duplica registros se executado mais de uma vez.

Uso:
    cd backend
    python -X utf8 utils/seed.py
"""

import sys
import os
from datetime import date, datetime
from decimal import Decimal

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import SessionLocal
from models.usuario import Usuario, CargoEnum, AcessoEnum
from models.tipo_conta import tipo_conta, NaturezaEnum
from models.cliente_fornecedor import ClienteFornecedor, TipoCliForEnum
from models.endereco import Endereco
from models.contato import Contato
from models.lancamento import Lancamento, NaturezaLancamentoEnum
from utils.bootstrap import garantir_admins_iniciais
from utils.frequentes import colorir

HOJE = date.today()
SEED_TAG = "__seed__"

ok  = lambda msg: print(colorir(msg, cor="verde"))
inf = lambda msg: print(colorir(msg, cor="azul"))
err = lambda msg: print(colorir(msg, cor="vermelho"))

# ============================================================
# DADOS
# ============================================================

TIPOS_CONTA = [
    {"descricao_conta": "Mensalidade do Associado", "natureza_conta": NaturezaEnum.Credito,  "observacao": "Cobranca mensal dos associados"},
    {"descricao_conta": "Taxa de Condominio",        "natureza_conta": NaturezaEnum.Credito,  "observacao": "Taxa condominial mensal"},
    {"descricao_conta": "Energia Eletrica",          "natureza_conta": NaturezaEnum.Debito,   "observacao": "Conta de energia da sede"},
    {"descricao_conta": "Agua e Esgoto",             "natureza_conta": NaturezaEnum.Debito,   "observacao": "Conta de agua da sede"},
    {"descricao_conta": "Manutencao Geral",          "natureza_conta": NaturezaEnum.Debito,   "observacao": "Servicos de manutencao"},
    {"descricao_conta": "Patrocinio",                "natureza_conta": NaturezaEnum.Credito,  "observacao": "Receitas de patrocinio e doacoes"},
]

CLIFORS = [
    {
        "nome": "Marcio Silva",
        "cpf_cnpj": "111.222.333-01",
        "rg_inscricaoestadual": "1122301",
        "pessoafisica_juridica": True,
        "datanascimento": date(1985, 3, 10),
        "tipo_clifor": TipoCliForEnum.Ambos,
        "contatos": [{"tipo": "Celular", "info": "(11) 91111-0001", "principal": True}],
        "endereco": {"logradouro": "Rua das Flores", "numero": "101", "bairro": "Centro", "cidade": "Santa Isabel", "uf": "SP", "cep": "07500-000"},
    },
    {
        "nome": "Joao Pereira",
        "cpf_cnpj": "111.222.333-02",
        "rg_inscricaoestadual": "1122302",
        "pessoafisica_juridica": True,
        "datanascimento": date(1978, 7, 22),
        "tipo_clifor": TipoCliForEnum.Ambos,
        "contatos": [{"tipo": "Email", "info": "joao@email.com", "principal": True}],
        "endereco": {"logradouro": "Av. Principal", "numero": "200", "bairro": "Jardim", "cidade": "Santa Isabel", "uf": "SP", "cep": "07500-100"},
    },
    {
        "nome": "Antonio Souza",
        "cpf_cnpj": "111.222.333-03",
        "rg_inscricaoestadual": "1122303",
        "pessoafisica_juridica": True,
        "datanascimento": date(1990, 11, 5),
        "tipo_clifor": TipoCliForEnum.Ambos,
        "contatos": [{"tipo": "Celular", "info": "(11) 93333-0003", "principal": True}],
        "endereco": {"logradouro": "Rua Nova", "numero": "45", "bairro": "Vila Nova", "cidade": "Santa Isabel", "uf": "SP", "cep": "07500-200"},
    },
    {
        "nome": "Energisa SP",
        "cpf_cnpj": "12.345.678/0001-99",
        "rg_inscricaoestadual": "IE-ENERGISA",
        "pessoafisica_juridica": False,
        "datanascimento": date(2000, 1, 1),
        "tipo_clifor": TipoCliForEnum.Fornecedor,
        "contatos": [{"tipo": "Telefone", "info": "0800-722-7272", "principal": True}],
        "endereco": {"logradouro": "Rodovia SP-070", "numero": "km 50", "bairro": "Industrial", "cidade": "Aruja", "uf": "SP", "cep": "07400-000"},
    },
    {
        "nome": "Sabesp",
        "cpf_cnpj": "43.776.517/0001-80",
        "rg_inscricaoestadual": "IE-SABESP",
        "pessoafisica_juridica": False,
        "datanascimento": date(1994, 6, 1),
        "tipo_clifor": TipoCliForEnum.Fornecedor,
        "contatos": [{"tipo": "Telefone", "info": "0800-055-0195", "principal": True}],
        "endereco": {"logradouro": "Rua Costa Carvalho", "numero": "300", "bairro": "Pinheiros", "cidade": "Sao Paulo", "uf": "SP", "cep": "05429-000"},
    },
]

# ============================================================
# HELPERS
# ============================================================

def _admin(db):
    return db.query(Usuario).filter(
        Usuario.email == "opedroschvartz@gmail.com",
        Usuario.exclusao == None
    ).first()


def _upsert_tipo(db, dados):
    existente = db.query(tipo_conta).filter(tipo_conta.descricao_conta == dados["descricao_conta"]).first()
    if existente:
        return existente
    novo = tipo_conta(**dados)
    db.add(novo)
    db.flush()
    ok(f"  + Tipo de conta: {novo.descricao_conta}")
    return novo


def _upsert_clifor(db, dados, id_admin):
    existente = db.query(ClienteFornecedor).filter(ClienteFornecedor.cpf_cnpj == dados["cpf_cnpj"]).first()
    if existente:
        return existente

    contatos_raw = dados.pop("contatos")
    endereco_raw = dados.pop("endereco")

    novo = ClienteFornecedor(id_usuario_fk=id_admin, **dados)
    db.add(novo)
    db.flush()

    db.add(Endereco(id_clifor_fk=novo.id_clifor, enderecoprimario=True, **endereco_raw))
    for c in contatos_raw:
        db.add(Contato(id_clifor_fk=novo.id_clifor, tipocontato=c["tipo"], info_do_contato=c["info"], contato_principal=c["principal"]))

    db.flush()
    ok(f"  + Cliente/Fornecedor: {novo.nome}")
    return novo


def _lanc(db, **kwargs):
    l = Lancamento(**kwargs)
    db.add(l)
    db.flush()
    return l


# ============================================================
# SEED
# ============================================================

def seed():
    inf("\n=== Bootstrap de admins ===")
    garantir_admins_iniciais()

    db: Session = SessionLocal()
    try:
        admin = _admin(db)
        if not admin:
            err("Admin nao encontrado. Rode o bootstrap primeiro.")
            return

        inf("\n=== Tipos de conta ===")
        tipos = {d["descricao_conta"]: _upsert_tipo(db, d) for d in TIPOS_CONTA}

        inf("\n=== Clientes / Fornecedores ===")
        clifors = {d["nome"]: _upsert_clifor(db, dict(d), admin.id_usuario) for d in CLIFORS}

        db.commit()

        ja_existe = db.query(Lancamento).filter(Lancamento.observacao == SEED_TAG).count()
        if ja_existe:
            ok(f"\n+ Lancamentos de seed ja existem ({ja_existe}). Pulando.")
            return

        inf("\n=== Lancamentos ===")

        men = tipos["Mensalidade do Associado"]
        tax = tipos["Taxa de Condominio"]
        ene = tipos["Energia Eletrica"]
        agu = tipos["Agua e Esgoto"]
        man = tipos["Manutencao Geral"]
        pat = tipos["Patrocinio"]

        marcio   = clifors["Marcio Silva"]
        joao     = clifors["Joao Pereira"]
        antonio  = clifors["Antonio Souza"]
        energisa = clifors["Energisa SP"]
        sabesp   = clifors["Sabesp"]

        uid = admin.id_usuario
        CR = NaturezaLancamentoEnum.Credito
        DB = NaturezaLancamentoEnum.Debito

        lancamentos = [
            # Mensalidades Marcio — jan a jun pagas
            *[dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=marcio.id_clifor,
                   id_tipo_conta_fk=men.id_tipo_conta, valor=Decimal("100.00"),
                   data_vencimento=date(2026, m, 20), natureza_lancamento=CR,
                   data_pagamento=datetime(2026, m, 5), valor_pago=Decimal("100.00"),
                   id_usuario_fk_fechamento=uid, observacao=SEED_TAG)
              for m in range(1, 7)],

            # Mensalidades Joao — jan a mai pagas, jun em aberto
            *[dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=joao.id_clifor,
                   id_tipo_conta_fk=men.id_tipo_conta, valor=Decimal("100.00"),
                   data_vencimento=date(2026, m, 20), natureza_lancamento=CR,
                   data_pagamento=datetime(2026, m, 6), valor_pago=Decimal("100.00"),
                   id_usuario_fk_fechamento=uid, observacao=SEED_TAG)
              for m in range(1, 6)],
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=joao.id_clifor,
                 id_tipo_conta_fk=men.id_tipo_conta, valor=Decimal("100.00"),
                 data_vencimento=date(2026, 6, 20), natureza_lancamento=CR,
                 observacao=SEED_TAG),

            # Antonio — taxa condominial vencida (mar-mai, inadimplente)
            *[dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=antonio.id_clifor,
                   id_tipo_conta_fk=tax.id_tipo_conta, valor=Decimal("150.00"),
                   data_vencimento=date(2026, m, 15), natureza_lancamento=CR,
                   observacao=SEED_TAG)
              for m in range(3, 6)],

            # Energia — 2 pagas, 1 em aberto
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=energisa.id_clifor,
                 id_tipo_conta_fk=ene.id_tipo_conta, valor=Decimal("320.00"),
                 data_vencimento=date(2026, 4, 10), natureza_lancamento=DB,
                 data_pagamento=datetime(2026, 4, 9), valor_pago=Decimal("320.00"),
                 id_usuario_fk_fechamento=uid, observacao=SEED_TAG),
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=energisa.id_clifor,
                 id_tipo_conta_fk=ene.id_tipo_conta, valor=Decimal("298.50"),
                 data_vencimento=date(2026, 5, 10), natureza_lancamento=DB,
                 data_pagamento=datetime(2026, 5, 8), valor_pago=Decimal("298.50"),
                 id_usuario_fk_fechamento=uid, observacao=SEED_TAG),
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=energisa.id_clifor,
                 id_tipo_conta_fk=ene.id_tipo_conta, valor=Decimal("310.00"),
                 data_vencimento=date(2026, 6, 10), natureza_lancamento=DB,
                 observacao=SEED_TAG),

            # Agua — 1 paga, 1 em aberto
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=sabesp.id_clifor,
                 id_tipo_conta_fk=agu.id_tipo_conta, valor=Decimal("145.00"),
                 data_vencimento=date(2026, 5, 15), natureza_lancamento=DB,
                 data_pagamento=datetime(2026, 5, 14), valor_pago=Decimal("145.00"),
                 id_usuario_fk_fechamento=uid, observacao=SEED_TAG),
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=sabesp.id_clifor,
                 id_tipo_conta_fk=agu.id_tipo_conta, valor=Decimal("132.00"),
                 data_vencimento=date(2026, 6, 15), natureza_lancamento=DB,
                 observacao=SEED_TAG),

            # Manutencao — paga com multa e juros
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=sabesp.id_clifor,
                 id_tipo_conta_fk=man.id_tipo_conta, valor=Decimal("500.00"),
                 data_vencimento=date(2026, 3, 1), natureza_lancamento=DB,
                 data_pagamento=datetime(2026, 3, 10), valor_pago=Decimal("522.00"),
                 multa=Decimal("10.00"), juros=Decimal("12.00"),
                 id_usuario_fk_fechamento=uid, observacao=SEED_TAG,
                 observacao_pagamento="Pago com atraso — boleto vencido"),

            # Patrocinio recebido
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=marcio.id_clifor,
                 id_tipo_conta_fk=pat.id_tipo_conta, valor=Decimal("1000.00"),
                 data_vencimento=date(2026, 1, 5), natureza_lancamento=CR,
                 data_pagamento=datetime(2026, 1, 5), valor_pago=Decimal("1000.00"),
                 id_usuario_fk_fechamento=uid, observacao=SEED_TAG),

            # Reembolso credito (subtrai no dashboard)
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=marcio.id_clifor,
                 id_tipo_conta_fk=men.id_tipo_conta, valor=Decimal("50.00"),
                 data_vencimento=date(2026, 2, 20), natureza_lancamento=CR,
                 estorno=True, data_pagamento=datetime(2026, 2, 20), valor_pago=Decimal("50.00"),
                 id_usuario_fk_fechamento=uid, observacao=SEED_TAG,
                 observacao_pagamento="Reembolso de mensalidade paga em duplicidade"),

            # Reembolso debito (soma no dashboard)
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=energisa.id_clifor,
                 id_tipo_conta_fk=ene.id_tipo_conta, valor=Decimal("50.00"),
                 data_vencimento=date(2026, 3, 10), natureza_lancamento=DB,
                 estorno=True, data_pagamento=datetime(2026, 3, 10), valor_pago=Decimal("50.00"),
                 id_usuario_fk_fechamento=uid, observacao=SEED_TAG,
                 observacao_pagamento="Credito concedido pela Energisa"),
        ]

        for dados in lancamentos:
            _lanc(db, **dados)

        db.commit()
        ok(f"\n✨ Seed concluido: {len(lancamentos)} lancamentos criados.")

    except Exception as e:
        db.rollback()
        import traceback
        err(f"\n✖ Erro durante seed: {e}")
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
