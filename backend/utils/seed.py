"""
Popula o banco local com dados de teste representativos.
Idempotente: nao duplica registros se executado mais de uma vez.

No banco LOCAL (host localhost e APP_ENV != production) a senha de TODOS os
usuarios, de todos os perfis, vira "123" — ver SENHA_LOCAL_PADRAO em utils/bootstrap.

Uso:
    cd backend
    python -X utf8 utils/seed.py            # semeia (idempotente)
    python -X utf8 utils/seed.py --limpar   # ZERA o banco local e semeia do zero
"""

import sys
import os
import secrets
from datetime import date, datetime, timedelta
from decimal import Decimal

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.orm import Session
from database import SessionLocal
from models.usuario import Usuario, CargoEnum, AcessoEnum
from models.tipo_conta import tipo_conta, NaturezaEnum
from models.cliente_fornecedor import ClienteFornecedor, TipoCliForEnum
from models.endereco import Endereco
from models.contato import Contato
from models.lancamento import Lancamento, NaturezaLancamentoEnum
from utils.auth_utils import hash_senha
from utils.bootstrap import garantir_admins_iniciais, banco_e_local, SENHA_LOCAL_PADRAO
from utils.config import OPERADOR_TESTE_EMAIL
from utils.frequentes import colorir

HOJE = date.today()
SEED_TAG = "__seed__"

# Volume do seed — mantem o pedido do projeto: >= 20 usuarios e >= 200 lancamentos.
N_USUARIOS_EXTRA   = 20   # alem do admin + 3 usuarios de teste => 24 no total
N_ASSOCIADOS_EXTRA = 15   # clifors pagadores gerados, alem dos 5 nomeados => 20
MESES_HISTORICO    = 12   # meses de mensalidade/despesa gerados por pagador

ok  = lambda msg: print(colorir(msg, cor="verde"))
inf = lambda msg: print(colorir(msg, cor="azul"))
err = lambda msg: print(colorir(msg, cor="vermelho"))

# ============================================================
# DADOS
# ============================================================

# 20 tipos de conta (10 Credito + 10 Debito). O gerador em massa rotaciona por
# todos, entao os 20 aparecem em lancamentos. Os 6 primeiros de cada natureza
# sao referenciados nominalmente no bloco de lancamentos realistas — nao renomear
# as chaves "Mensalidade do Associado", "Taxa de Condominio", "Energia Eletrica",
# "Agua e Esgoto", "Manutencao Geral" e "Patrocinio" sem ajustar o bloco.
TIPOS_CONTA = [
    # Receitas (Credito)
    {"descricao_conta": "Mensalidade do Associado", "natureza_conta": NaturezaEnum.Credito, "observacao": "Cobranca mensal dos associados"},
    {"descricao_conta": "Taxa de Condominio",       "natureza_conta": NaturezaEnum.Credito, "observacao": "Taxa condominial mensal"},
    {"descricao_conta": "Patrocinio",               "natureza_conta": NaturezaEnum.Credito, "observacao": "Receitas de patrocinio"},
    {"descricao_conta": "Doacao",                   "natureza_conta": NaturezaEnum.Credito, "observacao": "Doacoes recebidas"},
    {"descricao_conta": "Aluguel do Salao de Festas","natureza_conta": NaturezaEnum.Credito,"observacao": "Locacao do salao da sede"},
    {"descricao_conta": "Taxa de Matricula",        "natureza_conta": NaturezaEnum.Credito, "observacao": "Adesao de novo associado"},
    {"descricao_conta": "Venda de Rifa",            "natureza_conta": NaturezaEnum.Credito, "observacao": "Receita de rifas e bazares"},
    {"descricao_conta": "Receita de Evento",        "natureza_conta": NaturezaEnum.Credito, "observacao": "Arrecadacao de eventos"},
    {"descricao_conta": "Rendimento de Aplicacao",  "natureza_conta": NaturezaEnum.Credito, "observacao": "Juros de aplicacao financeira"},
    {"descricao_conta": "Taxa Extra de Obras",      "natureza_conta": NaturezaEnum.Credito, "observacao": "Rateio para obras da sede"},
    # Despesas (Debito)
    {"descricao_conta": "Energia Eletrica",         "natureza_conta": NaturezaEnum.Debito,  "observacao": "Conta de energia da sede"},
    {"descricao_conta": "Agua e Esgoto",            "natureza_conta": NaturezaEnum.Debito,  "observacao": "Conta de agua da sede"},
    {"descricao_conta": "Manutencao Geral",         "natureza_conta": NaturezaEnum.Debito,  "observacao": "Servicos de manutencao"},
    {"descricao_conta": "Material de Limpeza",      "natureza_conta": NaturezaEnum.Debito,  "observacao": "Produtos de limpeza"},
    {"descricao_conta": "Material de Escritorio",   "natureza_conta": NaturezaEnum.Debito,  "observacao": "Papelaria e suprimentos"},
    {"descricao_conta": "Servicos Contabeis",       "natureza_conta": NaturezaEnum.Debito,  "observacao": "Honorarios de contabilidade"},
    {"descricao_conta": "Internet e Telefonia",     "natureza_conta": NaturezaEnum.Debito,  "observacao": "Link de internet e telefone"},
    {"descricao_conta": "Vigilancia e Seguranca",   "natureza_conta": NaturezaEnum.Debito,  "observacao": "Monitoramento da sede"},
    {"descricao_conta": "Jardinagem",               "natureza_conta": NaturezaEnum.Debito,  "observacao": "Manutencao de areas verdes"},
    {"descricao_conta": "Folha de Pagamento",       "natureza_conta": NaturezaEnum.Debito,  "observacao": "Salarios de funcionarios"},
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

# Pools para geracao em massa — deterministica (sem random), para contagens estaveis.
_PRIMEIROS = ["Ana", "Bruno", "Carla", "Diego", "Elaine", "Fabio", "Gabriela", "Hugo", "Ines", "Jorge",
              "Karina", "Lucas", "Marta", "Nelson", "Olivia", "Paulo", "Renata", "Sergio", "Tania", "Vitor"]
_SOBRENOMES = ["Almeida", "Barbosa", "Cardoso", "Dias", "Esteves", "Freitas", "Gomes", "Henrique", "Lima", "Moraes",
               "Nunes", "Oliveira", "Prado", "Queiroz", "Ramos", "Santos", "Teixeira", "Uchoa", "Vieira", "Xavier"]
# Perfis dos usuarios demo: mais Consulta/Operador, alguns Administrador.
_PERFIS_ROT = [AcessoEnum.Consulta, AcessoEnum.Operador, AcessoEnum.Consulta, AcessoEnum.Operador, AcessoEnum.Administrador]
_CARGOS_ROT = [CargoEnum.Associado, CargoEnum.Conselheiro, CargoEnum.Secretario, CargoEnum.Diretor, CargoEnum.Tesoureiro]


# ============================================================
# HELPERS
# ============================================================

def _exigir_local():
    """Barra a limpeza destrutiva se o alvo nao for o Postgres local."""
    if not banco_e_local():
        err("✖ Recusado: alvo nao e local. A limpeza (--limpar) so roda em localhost.")
        raise SystemExit(1)


def _limpar_banco(db):
    """Zera TODAS as tabelas do schema public — TRUNCATE ... RESTART IDENTITY CASCADE."""
    tabelas = [r[0] for r in db.execute(text(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    ))]
    if not tabelas:
        return
    lista = ", ".join(f'"{t}"' for t in tabelas)
    db.execute(text(f"TRUNCATE {lista} RESTART IDENTITY CASCADE"))
    db.commit()
    ok(f"  banco local zerado ({len(tabelas)} tabelas): TRUNCATE ... RESTART IDENTITY CASCADE")


def _forcar_senha_local(db):
    """Regra local: a senha de TODO usuario, de qualquer perfil, vira '123'."""
    db.query(Usuario).update(
        {Usuario.senha: hash_senha(SENHA_LOCAL_PADRAO)}, synchronize_session=False
    )
    db.commit()
    ok(f"  senha de todos os usuarios definida como '{SENHA_LOCAL_PADRAO}' (regra local)")


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


def _dt(d: date) -> datetime:
    """Converte um date (carimbos do seed) no datetime que as colunas TIMESTAMP esperam."""
    return datetime(d.year, d.month, d.day)


def _nome(i: int) -> str:
    return f"{_PRIMEIROS[i % len(_PRIMEIROS)]} {_SOBRENOMES[(i * 7) % len(_SOBRENOMES)]}"


def _venc(base: date, k: int, dia: int = 15) -> date:
    """Vencimento no dia `dia` do mes `k` meses atras de `base` (k<0 => meses no futuro)."""
    total = base.year * 12 + (base.month - 1) - k
    y, m0 = divmod(total, 12)
    return date(y, m0 + 1, dia)


def _rot(seq, i):
    return seq[i % len(seq)]


def _gerar_usuarios_extra(db):
    """Cria N_USUARIOS_EXTRA usuarios demo (perfis variados). Idempotente por email.

    Local: senha 123 (reafirmada por _forcar_senha_local). Nao-local: senha aleatoria,
    para nunca deixar uma senha conhecida num banco remoto.
    """
    local = banco_e_local()
    criados = 0
    for n in range(1, N_USUARIOS_EXTRA + 1):
        email = f"demo{n:02d}@amsi.local"
        if db.query(Usuario).filter(Usuario.email == email).first():
            continue
        senha = SENHA_LOCAL_PADRAO if local else secrets.token_urlsafe(9)
        db.add(Usuario(
            email=email,
            nome=_nome(n),
            senha=hash_senha(senha),
            cargo=_rot(_CARGOS_ROT, n),
            perfil_de_acesso=_rot(_PERFIS_ROT, n),
            notificacao=False,
            bloqueado=False,
            primeiro_acesso=False,
        ))
        criados += 1
    db.commit()
    ok(f"  + {criados} usuarios demo criados (perfis variados)")


def _gerar_associados(db, id_admin):
    """Cria N_ASSOCIADOS_EXTRA clientes pagadores. Idempotente por cpf_cnpj. Retorna a lista."""
    novos = []
    for i in range(N_ASSOCIADOS_EXTRA):
        dados = {
            "nome": _nome(i + 3),
            "cpf_cnpj": f"{700 + i:03d}.{100 + i:03d}.{200 + i:03d}-{i:02d}",
            "rg_inscricaoestadual": f"RG{500000 + i}",
            "pessoafisica_juridica": True,
            "datanascimento": date(1980 + (i % 20), (i % 12) + 1, (i % 27) + 1),
            "tipo_clifor": TipoCliForEnum.Cliente,
            "contatos": [{"tipo": "Celular", "info": f"(11) 9{4000 + i:04d}-{1000 + i:04d}", "principal": True}],
            "endereco": {"logradouro": f"Rua {_SOBRENOMES[i % len(_SOBRENOMES)]}", "numero": str(10 + i),
                         "bairro": "Centro", "cidade": "Santa Isabel", "uf": "SP", "cep": f"07500-{i:03d}"},
        }
        novos.append(_upsert_clifor(db, dados, id_admin))
    db.commit()
    return novos


def _lancamentos_massa(associados, fornecedores, staff_ids, admin_ids, oper_ids, tipos):
    """Gera receitas por associado e despesas por fornecedor, cobrindo as 5 situacoes
    de forma deterministica. Rotaciona por TODOS os tipos de conta (os 20 aparecem em
    lancamentos). Ancorado em HOJE."""
    # Tipos separados por natureza, na ordem de TIPOS_CONTA (determinismo).
    tipos_credito = [t for t in tipos.values() if t.natureza_conta == NaturezaEnum.Credito]
    tipos_debito  = [t for t in tipos.values() if t.natureza_conta == NaturezaEnum.Debito]
    CR = NaturezaLancamentoEnum.Credito
    DB = NaturezaLancamentoEnum.Debito
    out = []

    # Receitas: cada associado cobra um tipo de receita (rotacionado => cobre os 10
    # tipos Credito). 12 meses passados (situacao por rotacao) + 1 mes futuro (Aberto).
    for i, c in enumerate(associados):
        criador = _rot(staff_ids, i)
        tp_cr = _rot(tipos_credito, i)
        for k in range(1, MESES_HISTORICO + 1):
            venc = _venc(HOJE, k)
            d = dict(id_usuario_fk_lancamento=criador, id_clifor_relacionado_fk=c.id_clifor,
                     id_tipo_conta_fk=tp_cr.id_tipo_conta, valor=Decimal("100.00"),
                     data_vencimento=venc, natureza_lancamento=CR, observacao=SEED_TAG)
            r = (i + k) % 10
            if r <= 5:        # Pago (60%)
                d.update(data_pagamento=_dt(venc), valor_pago=Decimal("100.00"),
                         id_usuario_fk_aprovacao=_rot(admin_ids, i + k))
            elif r <= 7:      # Vencido (20%) — nada efetivado
                pass
            elif r == 8:      # Em analise (10%) — efetivado, sem aprovacao
                d.update(data_efetivacao=_dt(venc), id_usuario_fk_efetivacao=_rot(oper_ids, i + k),
                         data_pagamento=_dt(venc), valor_pago=Decimal("100.00"), data_aprovacao=None)
            else:             # Estorno (10%)
                d.update(estorno=True, data_pagamento=_dt(venc), valor_pago=Decimal("100.00"),
                         id_usuario_fk_aprovacao=_rot(admin_ids, i + k),
                         observacao_pagamento="Estorno de mensalidade")
            out.append(d)
        out.append(dict(id_usuario_fk_lancamento=criador, id_clifor_relacionado_fk=c.id_clifor,
                        id_tipo_conta_fk=tp_cr.id_tipo_conta, valor=Decimal("100.00"),
                        data_vencimento=_venc(HOJE, -1), natureza_lancamento=CR, observacao=SEED_TAG))

    # Despesas mensais (Debito): rotaciona o tipo por (k+j) => cobre os 10 tipos Debito.
    # O valor segue o fornecedor; a maioria paga, algumas vencidas.
    fornec  = [fornecedores["energisa"], fornecedores["sabesp"]]
    valores = [Decimal("300.00"), Decimal("140.00")]
    for k in range(1, MESES_HISTORICO + 1):
        for j in range(len(fornec)):
            venc = _venc(HOJE, k, dia=10)
            tp = _rot(tipos_debito, k + j)
            d = dict(id_usuario_fk_lancamento=_rot(staff_ids, k + j), id_clifor_relacionado_fk=fornec[j].id_clifor,
                     id_tipo_conta_fk=tp.id_tipo_conta, valor=valores[j],
                     data_vencimento=venc, natureza_lancamento=DB, observacao=SEED_TAG)
            if (k + j) % 6 != 5:   # maioria paga
                d.update(data_pagamento=_dt(venc), valor_pago=valores[j],
                         id_usuario_fk_aprovacao=_rot(admin_ids, k + j))
            out.append(d)

    return out


def _lanc(db, **kwargs):
    """Cria um lançamento do seed.

    Quem tem data_pagamento no seed representa um lançamento já quitado, então
    nasce efetivado E aprovado — senão o backend o leria como Aberto (o estado vem
    de data_efetivacao, não de data_pagamento) e o dashboard do seed viria zerado.
    """
    if kwargs.get("data_pagamento") is not None:
        kwargs.setdefault("data_efetivacao", kwargs["data_pagamento"])
        kwargs.setdefault("data_aprovacao", kwargs["data_pagamento"])
        kwargs.setdefault("id_usuario_fk_efetivacao", kwargs.get("id_usuario_fk_aprovacao"))
    l = Lancamento(**kwargs)
    db.add(l)
    db.flush()
    return l


# ============================================================
# SEED
# ============================================================

def seed(limpar=False):
    if limpar:
        _exigir_local()
        inf("\n=== Limpando banco local ===")
        db0: Session = SessionLocal()
        try:
            _limpar_banco(db0)
        finally:
            db0.close()

    inf("\n=== Bootstrap de admins ===")
    garantir_admins_iniciais()

    db: Session = SessionLocal()
    try:
        admin = _admin(db)
        if not admin:
            err("Admin nao encontrado. Rode o bootstrap primeiro.")
            return

        inf("\n=== Usuarios demo ===")
        _gerar_usuarios_extra(db)
        if banco_e_local():
            _forcar_senha_local(db)

        inf("\n=== Tipos de conta ===")
        tipos = {d["descricao_conta"]: _upsert_tipo(db, d) for d in TIPOS_CONTA}

        inf("\n=== Clientes / Fornecedores ===")
        clifors = {d["nome"]: _upsert_clifor(db, dict(d), admin.id_usuario) for d in CLIFORS}
        associados_extra = _gerar_associados(db, admin.id_usuario)
        ok(f"  + {len(associados_extra)} associados pagadores gerados")

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
        # Efetivação normalmente é do Operador; aprovação só do Admin. Usar o operador
        # de teste deixa a linha do tempo de "Em análise" realista (efetivou != aprovou).
        operador = db.query(Usuario).filter(Usuario.email == OPERADOR_TESTE_EMAIL).first()
        oid = operador.id_usuario if operador else uid
        CR = NaturezaLancamentoEnum.Credito
        DB = NaturezaLancamentoEnum.Debito

        # Pools para a geracao em massa: aprovacao so de Admin; efetivacao/criacao de staff.
        admin_ids = [u.id_usuario for u in db.query(Usuario).filter(
            Usuario.perfil_de_acesso == AcessoEnum.Administrador, Usuario.exclusao == None).all()]
        oper_ids = [u.id_usuario for u in db.query(Usuario).filter(
            Usuario.perfil_de_acesso == AcessoEnum.Operador, Usuario.exclusao == None).all()] or admin_ids
        staff_ids = admin_ids + oper_ids

        lancamentos = [
            # Mensalidades Marcio — jan a jun pagas
            *[dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=marcio.id_clifor,
                   id_tipo_conta_fk=men.id_tipo_conta, valor=Decimal("100.00"),
                   data_vencimento=date(2026, m, 20), natureza_lancamento=CR,
                   data_pagamento=datetime(2026, m, 5), valor_pago=Decimal("100.00"),
                   id_usuario_fk_aprovacao=uid, observacao=SEED_TAG)
              for m in range(1, 7)],

            # Mensalidades Joao — jan a mai pagas, jun em aberto
            *[dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=joao.id_clifor,
                   id_tipo_conta_fk=men.id_tipo_conta, valor=Decimal("100.00"),
                   data_vencimento=date(2026, m, 20), natureza_lancamento=CR,
                   data_pagamento=datetime(2026, m, 6), valor_pago=Decimal("100.00"),
                   id_usuario_fk_aprovacao=uid, observacao=SEED_TAG)
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
                 id_usuario_fk_aprovacao=uid, observacao=SEED_TAG),
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=energisa.id_clifor,
                 id_tipo_conta_fk=ene.id_tipo_conta, valor=Decimal("298.50"),
                 data_vencimento=date(2026, 5, 10), natureza_lancamento=DB,
                 data_pagamento=datetime(2026, 5, 8), valor_pago=Decimal("298.50"),
                 id_usuario_fk_aprovacao=uid, observacao=SEED_TAG),
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=energisa.id_clifor,
                 id_tipo_conta_fk=ene.id_tipo_conta, valor=Decimal("310.00"),
                 data_vencimento=date(2026, 6, 10), natureza_lancamento=DB,
                 observacao=SEED_TAG),

            # Agua — 1 paga, 1 em aberto
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=sabesp.id_clifor,
                 id_tipo_conta_fk=agu.id_tipo_conta, valor=Decimal("145.00"),
                 data_vencimento=date(2026, 5, 15), natureza_lancamento=DB,
                 data_pagamento=datetime(2026, 5, 14), valor_pago=Decimal("145.00"),
                 id_usuario_fk_aprovacao=uid, observacao=SEED_TAG),
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=sabesp.id_clifor,
                 id_tipo_conta_fk=agu.id_tipo_conta, valor=Decimal("132.00"),
                 data_vencimento=date(2026, 6, 15), natureza_lancamento=DB,
                 observacao=SEED_TAG),

            # Manutencao — paga
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=sabesp.id_clifor,
                 id_tipo_conta_fk=man.id_tipo_conta, valor=Decimal("500.00"),
                 data_vencimento=date(2026, 3, 1), natureza_lancamento=DB,
                 data_pagamento=datetime(2026, 3, 10), valor_pago=Decimal("500.00"),
                 id_usuario_fk_aprovacao=uid, observacao=SEED_TAG,
                 observacao_pagamento="Servico de manutencao quitado"),

            # Patrocinio recebido
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=marcio.id_clifor,
                 id_tipo_conta_fk=pat.id_tipo_conta, valor=Decimal("1000.00"),
                 data_vencimento=date(2026, 1, 5), natureza_lancamento=CR,
                 data_pagamento=datetime(2026, 1, 5), valor_pago=Decimal("1000.00"),
                 id_usuario_fk_aprovacao=uid, observacao=SEED_TAG),

            # Reembolso credito (subtrai no dashboard)
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=marcio.id_clifor,
                 id_tipo_conta_fk=men.id_tipo_conta, valor=Decimal("50.00"),
                 data_vencimento=date(2026, 2, 20), natureza_lancamento=CR,
                 estorno=True, data_pagamento=datetime(2026, 2, 20), valor_pago=Decimal("50.00"),
                 id_usuario_fk_aprovacao=uid, observacao=SEED_TAG,
                 observacao_pagamento="Reembolso de mensalidade paga em duplicidade"),

            # Reembolso debito (soma no dashboard)
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=energisa.id_clifor,
                 id_tipo_conta_fk=ene.id_tipo_conta, valor=Decimal("50.00"),
                 data_vencimento=date(2026, 3, 10), natureza_lancamento=DB,
                 estorno=True, data_pagamento=datetime(2026, 3, 10), valor_pago=Decimal("50.00"),
                 id_usuario_fk_aprovacao=uid, observacao=SEED_TAG,
                 observacao_pagamento="Credito concedido pela Energisa"),

            # ════════════════════════════════════════════════════════════════
            # MATRIZ DE SITUACOES — ancorada em HOJE para ser deterministica em
            # qualquer data de execucao. Cobre as 5 situacoes derivadas
            # (Aberto, Vencido, Em analise, Pago, Estorno) em Credito e Debito.
            # A situacao vem de Lancamento.situacao (nao ha coluna de status).
            # ════════════════════════════════════════════════════════════════

            # Aberto — vencimento no futuro, nada efetivado
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=joao.id_clifor,
                 id_tipo_conta_fk=men.id_tipo_conta, valor=Decimal("100.00"),
                 data_vencimento=HOJE + timedelta(days=25), natureza_lancamento=CR,
                 observacao=SEED_TAG),
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=energisa.id_clifor,
                 id_tipo_conta_fk=ene.id_tipo_conta, valor=Decimal("305.00"),
                 data_vencimento=HOJE + timedelta(days=20), natureza_lancamento=DB,
                 observacao=SEED_TAG),

            # Vencido — vencimento no passado, nao efetivado
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=antonio.id_clifor,
                 id_tipo_conta_fk=tax.id_tipo_conta, valor=Decimal("150.00"),
                 data_vencimento=HOJE - timedelta(days=40), natureza_lancamento=CR,
                 observacao=SEED_TAG),
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=sabesp.id_clifor,
                 id_tipo_conta_fk=agu.id_tipo_conta, valor=Decimal("138.00"),
                 data_vencimento=HOJE - timedelta(days=35), natureza_lancamento=DB,
                 observacao=SEED_TAG),

            # Em analise — efetivado pelo operador, aprovacao do admin pendente
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=marcio.id_clifor,
                 id_tipo_conta_fk=men.id_tipo_conta, valor=Decimal("100.00"),
                 data_vencimento=HOJE - timedelta(days=5), natureza_lancamento=CR,
                 data_efetivacao=_dt(HOJE - timedelta(days=2)), id_usuario_fk_efetivacao=oid,
                 data_pagamento=_dt(HOJE - timedelta(days=2)), valor_pago=Decimal("100.00"),
                 data_aprovacao=None, observacao=SEED_TAG),
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=sabesp.id_clifor,
                 id_tipo_conta_fk=man.id_tipo_conta, valor=Decimal("420.00"),
                 data_vencimento=HOJE - timedelta(days=10), natureza_lancamento=DB,
                 data_efetivacao=_dt(HOJE - timedelta(days=3)), id_usuario_fk_efetivacao=oid,
                 data_pagamento=_dt(HOJE - timedelta(days=3)), valor_pago=Decimal("420.00"),
                 data_aprovacao=None, observacao=SEED_TAG),

            # Pago — efetivado e aprovado (helper preenche efetivacao+aprovacao)
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=marcio.id_clifor,
                 id_tipo_conta_fk=pat.id_tipo_conta, valor=Decimal("800.00"),
                 data_vencimento=HOJE - timedelta(days=20), natureza_lancamento=CR,
                 data_pagamento=_dt(HOJE - timedelta(days=18)), valor_pago=Decimal("800.00"),
                 id_usuario_fk_aprovacao=uid, observacao=SEED_TAG),
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=energisa.id_clifor,
                 id_tipo_conta_fk=ene.id_tipo_conta, valor=Decimal("290.00"),
                 data_vencimento=HOJE - timedelta(days=15), natureza_lancamento=DB,
                 data_pagamento=_dt(HOJE - timedelta(days=14)), valor_pago=Decimal("290.00"),
                 id_usuario_fk_aprovacao=uid, observacao=SEED_TAG),

            # Estorno — estorno=True vence todas as outras regras, ancorado em HOJE
            dict(id_usuario_fk_lancamento=uid, id_clifor_relacionado_fk=joao.id_clifor,
                 id_tipo_conta_fk=men.id_tipo_conta, valor=Decimal("100.00"),
                 data_vencimento=HOJE - timedelta(days=8), natureza_lancamento=CR,
                 estorno=True, data_pagamento=_dt(HOJE - timedelta(days=8)), valor_pago=Decimal("100.00"),
                 id_usuario_fk_aprovacao=uid, observacao=SEED_TAG,
                 observacao_pagamento="Estorno de mensalidade no mes corrente"),
        ]

        # Volume em massa: mensalidades dos associados gerados + despesas mensais.
        lancamentos += _lancamentos_massa(
            associados_extra, {"energisa": energisa, "sabesp": sabesp},
            staff_ids, admin_ids, oper_ids, tipos,
        )

        for dados in lancamentos:
            _lanc(db, **dados)

        db.commit()
        total_users = db.query(Usuario).filter(Usuario.exclusao == None).count()
        total_clifors = db.query(ClienteFornecedor).count()
        ok(f"\n✨ Seed concluido: {total_users} usuarios, {total_clifors} clientes/fornecedores, {len(lancamentos)} lancamentos.")

    except Exception as e:
        db.rollback()
        import traceback
        err(f"\n✖ Erro durante seed: {e}")
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    limpar = any(a in ("--limpar", "--reset", "limpar", "reset") for a in sys.argv[1:])
    seed(limpar=limpar)
