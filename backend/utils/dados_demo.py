"""
dados_demo.py — Gerador de dados de demonstração com limpeza reversível.

Gera clientes/fornecedores, endereços, contatos e lançamentos realistas (Faker
pt_BR) em volume customizável, registrando TODOS os IDs criados num manifesto
local. A limpeza lê esse manifesto e apaga exatamente o que foi gerado, na ordem
correta de chaves estrangeiras — deixando o banco como se os dados nunca tivessem
existido.

Diferente de `seed.py` (conjunto fixo, sem limpeza), aqui o foco é volume +
reversibilidade. Não altera o schema nem o `seed.py`.

Uso:
    cd backend

    # Gerar (banco local)
    python -X utf8 utils/dados_demo.py gerar --clifors 30 --meses 6
    python -X utf8 utils/dados_demo.py gerar --clifors 50 --pf-ratio 0.6 --mix 0.5,0.2,0.3

    # Listar lotes registrados
    python -X utf8 utils/dados_demo.py listar

    # Limpar (remove o último lote por padrão)
    python -X utf8 utils/dados_demo.py limpar
    python -X utf8 utils/dados_demo.py limpar --lote 20260612_221000
    python -X utf8 utils/dados_demo.py limpar --tudo

    # Mirando o banco do Railway (env de produção injetada localmente):
    railway run python -X utf8 utils/dados_demo.py gerar --clifors 40
    railway run python -X utf8 utils/dados_demo.py limpar
    # → o manifesto fica na SUA máquina; a limpeza posterior continua funcionando.

Produção (APP_ENV=production) é permitida, mas exige confirmação explícita:
no modo interativo, digite o nome do banco; em automação, passe `--sim --producao`.
"""

import os
import sys
import json
import glob
import random
import argparse
import unicodedata
from decimal import Decimal
from datetime import date, datetime, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from database import SessionLocal
from utils.config import DATABASE_URL, APP_ENV
from utils.frequentes import colorir

from models.usuario import Usuario, AcessoEnum
from models.tipo_conta import tipo_conta, NaturezaEnum
from models.cliente_fornecedor import ClienteFornecedor, TipoCliForEnum
from models.endereco import Endereco
from models.contato import Contato
from models.lancamento import Lancamento, NaturezaLancamentoEnum

try:
    from faker import Faker
except ImportError:
    print("Faker não está instalado. Rode:  pip install -r requirements.txt")
    sys.exit(1)


# ════════════════════════════════════════════════════════════════════════════
# CONSTANTES
# ════════════════════════════════════════════════════════════════════════════

MANIFEST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".dados_demo")
TAG_PREFIX = "__demo__"

# Mesmos tipos de conta padrão do seed.py — reaproveitados (criados só se faltarem).
TIPOS_CONTA = [
    {"descricao_conta": "Mensalidade do Associado", "natureza_conta": NaturezaEnum.Credito, "observacao": "Cobranca mensal dos associados"},
    {"descricao_conta": "Taxa de Condominio",        "natureza_conta": NaturezaEnum.Credito, "observacao": "Taxa condominial mensal"},
    {"descricao_conta": "Energia Eletrica",          "natureza_conta": NaturezaEnum.Debito,  "observacao": "Conta de energia da sede"},
    {"descricao_conta": "Agua e Esgoto",             "natureza_conta": NaturezaEnum.Debito,  "observacao": "Conta de agua da sede"},
    {"descricao_conta": "Manutencao Geral",          "natureza_conta": NaturezaEnum.Debito,  "observacao": "Servicos de manutencao"},
    {"descricao_conta": "Patrocinio",                "natureza_conta": NaturezaEnum.Credito, "observacao": "Receitas de patrocinio e doacoes"},
]

# Ordem de exclusão (filhos → pais) derivada do grafo de FK.
ORDEM_LIMPEZA = [
    ("lancamento",        Lancamento,         Lancamento.id_lancamento),
    ("contato",           Contato,            Contato.id_contato),
    ("endereco",          Endereco,           Endereco.id_endereco),
    ("clientefornecedor", ClienteFornecedor,  ClienteFornecedor.id_clifor),
    ("tipo_conta",        tipo_conta,         tipo_conta.id_tipo_conta),
]

ok   = lambda m: print(colorir(m, cor="verde"))
inf  = lambda m: print(colorir(m, cor="azul"))
warn = lambda m: print(colorir(m, cor="amarelo"))
err  = lambda m: print(colorir(m, cor="vermelho"))


# ════════════════════════════════════════════════════════════════════════════
# GUARD DE AMBIENTE
# ════════════════════════════════════════════════════════════════════════════

def _alvo_db():
    """Retorna (host, nome_banco, alvo_str, is_producao) sem expor credenciais."""
    url = make_url(DATABASE_URL)
    host = url.host or "local"
    nome = url.database or "?"
    is_prod = APP_ENV == "production"
    return host, nome, f"{host}/{nome}", is_prod


def _confirmar(acao, sim, producao):
    """
    Mostra o banco alvo e exige confirmação.
    - Não-produção: 'sim' (ou --sim).
    - Produção: digitar o nome do banco (ou --sim --producao em automação).
    Retorna True se confirmado.
    """
    host, nome, alvo, is_prod = _alvo_db()
    print()
    if is_prod:
        warn(f"⚠  ALVO DE PRODUÇÃO  →  {alvo}   (APP_ENV=production)")
    else:
        inf(f"Alvo: {alvo}   (APP_ENV={APP_ENV})")
    print(f"Ação: {acao}")

    if sim:
        if is_prod and not producao:
            err("Recusado: alvo é produção. Em modo automático use --sim JUNTO de --producao.")
            return False
        warn("Confirmação automática (--sim).")
        return True

    try:
        if is_prod:
            resp = input(colorir(f"Para confirmar em PRODUÇÃO, digite o nome do banco ({nome}): ", cor="amarelo")).strip()
            if resp != nome:
                err("Nome não confere. Operação cancelada.")
                return False
            return True
        resp = input("Confirmar? [sim/N]: ").strip().lower()
        if resp in ("sim", "s", "y", "yes"):
            return True
        err("Operação cancelada.")
        return False
    except EOFError:
        err("Sem terminal interativo. Use --sim (e --producao, se for produção).")
        return False


# ════════════════════════════════════════════════════════════════════════════
# MANIFESTO
# ════════════════════════════════════════════════════════════════════════════

def _novo_manifesto(parametros):
    lote_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    _, _, alvo, _ = _alvo_db()
    return {
        "lote_id": lote_id,
        "criado_em": datetime.now().isoformat(timespec="seconds"),
        "alvo_db": alvo,
        "app_env": APP_ENV,
        "parametros": parametros,
        "ids": {tabela: [] for tabela, _, _ in ORDEM_LIMPEZA},
    }


def _salvar_manifesto(man):
    os.makedirs(MANIFEST_DIR, exist_ok=True)
    caminho = os.path.join(MANIFEST_DIR, f"lote_{man['lote_id']}.json")
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=2)
    return caminho


def _arquivos_lote():
    return sorted(glob.glob(os.path.join(MANIFEST_DIR, "lote_*.json")))


def _carregar(caminho):
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def _total_ids(man):
    return sum(len(v) for v in man["ids"].values())


# ════════════════════════════════════════════════════════════════════════════
# GERAÇÃO
# ════════════════════════════════════════════════════════════════════════════

def _admin(db: Session):
    return db.query(Usuario).filter(
        Usuario.perfil_de_acesso == AcessoEnum.Administrador,
        Usuario.exclusao == None,  # noqa: E711
    ).first()


def _norm(s: str) -> str:
    """Folding p/ casar nomes ignorando acento e caixa: 'Energia Eletrica' ~ 'Energia Elétrica'."""
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.strip().casefold()


def _garantir_tipos(db: Session, man):
    """Upsert dos tipos padrão, casando nomes existentes de forma acento/caixa-insensível
    (reusa um 'Energia Elétrica' já cadastrado em vez de duplicar). Registra no manifesto
    apenas os criados agora."""
    por_norm = {}
    for t in db.query(tipo_conta).all():
        por_norm.setdefault(_norm(t.descricao_conta), t)  # mantém o primeiro encontrado

    resultado = {}
    for dados in TIPOS_CONTA:
        chave = dados["descricao_conta"]
        existente = por_norm.get(_norm(chave))
        if existente:
            resultado[chave] = existente
            continue
        novo = tipo_conta(**dados)
        db.add(novo)
        db.flush()
        man["ids"]["tipo_conta"].append(novo.id_tipo_conta)
        por_norm[_norm(chave)] = novo  # evita duplicar dentro do próprio lote
        resultado[chave] = novo
    return resultado


def _parse_mix(texto):
    partes = [float(x) for x in texto.split(",")]
    if len(partes) != 3:
        raise argparse.ArgumentTypeError("--mix espera 3 valores: pago,aberto,inadimplente")
    total = sum(partes)
    if total <= 0:
        raise argparse.ArgumentTypeError("--mix não pode somar zero")
    return [p / total for p in partes]  # normaliza


def _telefone_br(fake):
    return f"({fake.random_int(11, 99)}) 9{fake.numerify('####-####')}"


def _cep_br(fake):
    """Faker pt_BR ora devolve o CEP com traço, ora sem — normaliza p/ XXXXX-XXX."""
    d = "".join(c for c in fake.postcode() if c.isdigit()).ljust(8, "0")[:8]
    return f"{d[:5]}-{d[5:]}"


def gerar(args):
    det_inad = getattr(args, "inadimplentes", None)
    if det_inad is not None and not (0 <= det_inad <= args.clifors):
        err(f"--inadimplentes {det_inad} inválido: use um valor entre 0 e --clifors ({args.clifors}).")
        return
    if not _confirmar(f"GERAR ~{args.clifors} clifors e lançamentos de {args.meses} meses",
                      args.sim, args.producao):
        return

    fake = Faker("pt_BR")
    man = _novo_manifesto({
        "clifors": args.clifors,
        "pf_ratio": args.pf_ratio,
        "meses": args.meses,
        "mix": args.mix,
        "inadimplentes": det_inad,
    })

    db: Session = SessionLocal()
    try:
        admin = _admin(db)
        if not admin:
            err("Nenhum administrador encontrado. Rode antes:  python -X utf8 utils/bootstrap.py")
            return
        uid = admin.id_usuario

        inf("\n=== Tipos de conta ===")
        tipos = _garantir_tipos(db, man)
        criados_tipos = len(man["ids"]["tipo_conta"])
        ok(f"  {criados_tipos} criado(s), {len(TIPOS_CONTA) - criados_tipos} reaproveitado(s).")

        credito = [tipos["Mensalidade do Associado"], tipos["Taxa de Condominio"], tipos["Patrocinio"]]
        debito  = [tipos["Energia Eletrica"], tipos["Agua e Esgoto"], tipos["Manutencao Geral"]]

        # Evita CPF/CNPJ repetidos (entre si e com o que já existe no banco).
        existentes = {x[0] for x in db.query(ClienteFornecedor.cpf_cnpj).all()}

        def doc_unico(gerador):
            for _ in range(50):
                d = gerador()
                if d not in existentes:
                    existentes.add(d)
                    return d
            return gerador()  # fallback improvável

        inf("\n=== Clientes / Fornecedores ===")
        # Decide PF/PJ de antemão; no modo determinístico, garante PF suficientes
        # (só clientes/PF podem ficar inadimplentes).
        is_pf_list = [random.random() < args.pf_ratio for _ in range(args.clifors)]
        if det_inad is not None:
            faltam = det_inad - sum(1 for v in is_pf_list if v)
            if faltam > 0:
                idx_pj = [i for i, v in enumerate(is_pf_list) if not v]
                random.shuffle(idx_pj)
                for i in idx_pj[:faltam]:
                    is_pf_list[i] = True
        clifors = []
        for is_pf in is_pf_list:
            if is_pf:
                nome = fake.name()
                doc = doc_unico(fake.cpf)
                nasc = fake.date_of_birth(minimum_age=18, maximum_age=80)
                rg = str(fake.random_number(digits=9, fix_len=True))
                tipo_cf = TipoCliForEnum.Cliente
            else:
                nome = fake.company()
                doc = doc_unico(fake.cnpj)
                # Inscrição Estadual + data de fundação. Preenchidos (e não nulos)
                # para o gerador funcionar mesmo em bancos onde a migração de
                # opcionalidade de rg/datanascimento ainda não foi aplicada.
                nasc = fake.date_between(start_date="-30y", end_date="-1y")
                rg = "IE" + str(fake.random_number(digits=9, fix_len=True))
                tipo_cf = TipoCliForEnum.Fornecedor

            cf = ClienteFornecedor(
                id_usuario_fk=uid,
                pessoafisica_juridica=is_pf,
                cpf_cnpj=doc,
                rg_inscricaoestadual=rg,
                nome=nome,
                datanascimento=nasc,
                tipo_clifor=tipo_cf,
                ativo=True,
                inadimplente=False,
            )
            db.add(cf)
            db.flush()
            man["ids"]["clientefornecedor"].append(cf.id_clifor)

            end = Endereco(
                id_clifor_fk=cf.id_clifor,
                enderecoprimario=True,
                logradouro=fake.street_name(),
                numero=str(fake.building_number()),
                bairro=fake.bairro(),
                cidade=fake.city(),
                uf=fake.estado_sigla(),
                cep=_cep_br(fake),
            )
            db.add(end)
            db.flush()
            man["ids"]["endereco"].append(end.id_endereco)

            if random.random() < 0.5:
                tipo_ct, info = "Email", fake.email()
            else:
                tipo_ct, info = "Telefone", _telefone_br(fake)
            ct = Contato(
                id_clifor_fk=cf.id_clifor,
                tipocontato=tipo_ct,
                info_do_contato=info,
                contato_principal=True,
            )
            db.add(ct)
            db.flush()
            man["ids"]["contato"].append(ct.id_contato)

            clifors.append((cf, is_pf, tipo_cf))

        ok(f"  {len(clifors)} clifor(s) + endereços + contatos criados.")

        # Modo determinístico: escolhe exatamente N clientes para inadimplência.
        ids_inadimplentes = set()
        if det_inad is not None:
            clientes = [cf for cf, _pf, tcf in clifors if tcf == TipoCliForEnum.Cliente]
            if det_inad > len(clientes):  # rede de segurança (não deve ocorrer)
                err(f"--inadimplentes {det_inad} excede os clientes gerados ({len(clientes)}).")
                db.rollback()
                return
            ids_inadimplentes = {cf.id_clifor for cf in random.sample(clientes, det_inad)}
            inf(f"  Inadimplência determinística: {det_inad} cliente(s) marcado(s).")

        inf("\n=== Lançamentos ===")
        hoje = date.today()
        janela = max(args.meses * 30, 1)
        peso_pago, peso_aberto, peso_inad = args.mix
        # No modo determinístico o peso de inadimplência é ignorado; o --mix passa
        # a controlar só a razão pago:aberto dos lançamentos não-vencidos.
        pa_total = peso_pago + peso_aberto
        pesos_pa = ((peso_pago / pa_total, peso_aberto / pa_total) if pa_total > 0
                    else (1.0, 0.0))
        tag = f"{TAG_PREFIX}:{man['lote_id']}"
        total_lanc = 0

        for cf, is_pf, tipo_cf in clifors:
            pool = credito if tipo_cf == TipoCliForEnum.Cliente else debito
            natureza = (NaturezaLancamentoEnum.Credito if tipo_cf == TipoCliForEnum.Cliente
                        else NaturezaLancamentoEnum.Debito)
            # Espelha utils/inadimplencia.py: inadimplente = tem crédito vencido,
            # não pago e não estornado. Inserimos via ORM (sem passar pela rota que
            # recalcula), então marcamos o flag aqui mesmo.
            cf_inadimplente = False
            forcar_inad = cf.id_clifor in ids_inadimplentes  # só no modo determinístico
            for i in range(args.meses):
                if det_inad is not None:
                    # Determinístico: o 1º lançamento do cliente escolhido é o crédito
                    # vencido não pago; todo o resto (e os não-escolhidos) fica pago/aberto.
                    status = "inadimplente" if (forcar_inad and i == 0) else \
                        random.choices(("pago", "aberto"), weights=pesos_pa)[0]
                else:
                    status = random.choices(
                        ("pago", "aberto", "inadimplente"),
                        weights=(peso_pago, peso_aberto, peso_inad),
                    )[0]
                tp = random.choice(pool)
                valor = Decimal(f"{random.uniform(50, 2000):.2f}")

                campos = dict(
                    id_usuario_fk_lancamento=uid,
                    id_clifor_relacionado_fk=cf.id_clifor,
                    id_tipo_conta_fk=tp.id_tipo_conta,
                    valor=valor,
                    natureza_lancamento=natureza,
                    observacao=tag,
                )

                if status == "aberto":
                    campos["data_vencimento"] = hoje + timedelta(days=random.randint(1, 45))
                else:
                    venc = hoje - timedelta(days=random.randint(1, janela))
                    campos["data_vencimento"] = venc
                    if status == "pago":
                        pago_em = venc + timedelta(days=random.randint(0, 5))
                        if pago_em > hoje:
                            pago_em = hoje
                        valor_pago = valor
                        if random.random() < 0.15:  # alguns com multa+juros
                            multa = (valor * Decimal("0.02")).quantize(Decimal("0.01"))
                            juros = (valor * Decimal("0.01")).quantize(Decimal("0.01"))
                            campos["multa"] = multa
                            campos["juros"] = juros
                            valor_pago = valor + multa + juros
                        campos["data_pagamento"] = datetime.combine(pago_em, datetime.min.time())
                        campos["valor_pago"] = valor_pago
                        campos["id_usuario_fk_fechamento"] = uid
                    elif natureza == NaturezaLancamentoEnum.Credito:
                        # inadimplente: crédito vencido e sem pagamento
                        cf_inadimplente = True

                lanc = Lancamento(**campos)
                db.add(lanc)
                db.flush()
                man["ids"]["lancamento"].append(lanc.id_lancamento)
                total_lanc += 1

            if cf_inadimplente:
                cf.inadimplente = True

        db.commit()
        if det_inad is not None:
            ok(f"  {total_lanc} lançamento(s) criados — {len(ids_inadimplentes)} cliente(s) "
               f"inadimplente(s) (determinístico); demais pago/aberto "
               f"= {pesos_pa[0]:.2f}/{pesos_pa[1]:.2f}.")
        else:
            ok(f"  {total_lanc} lançamento(s) criados (mix pago/aberto/inadimplente "
               f"= {peso_pago:.2f}/{peso_aberto:.2f}/{peso_inad:.2f}).")

        caminho = _salvar_manifesto(man)
        print()
        ok(f"✨ Lote {man['lote_id']} gerado — {_total_ids(man)} registros no total.")
        inf(f"   Manifesto: {caminho}")
        inf(f"   Para reverter:  python -X utf8 utils/dados_demo.py limpar --lote {man['lote_id']}")

    except Exception as e:
        db.rollback()
        import traceback
        err(f"\n✖ Erro na geração (rollback feito): {e}")
        traceback.print_exc()
    finally:
        db.close()


# ════════════════════════════════════════════════════════════════════════════
# LISTAGEM
# ════════════════════════════════════════════════════════════════════════════

def listar(args):
    arquivos = _arquivos_lote()
    if not arquivos:
        warn("Nenhum lote registrado em " + MANIFEST_DIR)
        return
    inf(f"Lotes registrados ({len(arquivos)}):\n")
    for caminho in arquivos:
        man = _carregar(caminho)
        contagens = ", ".join(f"{t}={len(man['ids'][t])}" for t, _, _ in ORDEM_LIMPEZA)
        print(colorir(f"• {man['lote_id']}", cor="verde")
              + f"  ({man['criado_em']})  alvo={man['alvo_db']}  env={man.get('app_env','?')}")
        print(f"    total={_total_ids(man)}  [{contagens}]")


# ════════════════════════════════════════════════════════════════════════════
# LIMPEZA
# ════════════════════════════════════════════════════════════════════════════

def limpar(args):
    arquivos = _arquivos_lote()
    if not arquivos:
        warn("Nenhum lote para limpar em " + MANIFEST_DIR)
        return

    if args.tudo:
        alvos = arquivos
    elif args.lote:
        alvos = [c for c in arquivos if _carregar(c)["lote_id"] == args.lote]
        if not alvos:
            err(f"Lote '{args.lote}' não encontrado.")
            return
    else:
        alvos = [arquivos[-1]]  # mais recente

    mans = [(_carregar(c), c) for c in alvos]
    _, _, alvo_atual, _ = _alvo_db()

    # Verifica se os manifestos batem com o banco atualmente apontado.
    divergentes = [m["lote_id"] for m, _ in mans if m["alvo_db"] != alvo_atual]
    if divergentes and not args.sim:
        err(f"O banco atual ({alvo_atual}) não corresponde ao alvo dos lotes: "
            f"{', '.join(divergentes)}.")
        err("Aponte para o banco correto ou force com --sim se tiver certeza.")
        return

    lotes_desc = ", ".join(m["lote_id"] for m, _ in mans)
    total = sum(_total_ids(m) for m, _ in mans)
    if not _confirmar(f"LIMPAR {len(mans)} lote(s) [{lotes_desc}] — {total} registros", args.sim, args.producao):
        return

    db: Session = SessionLocal()
    try:
        removidos = {tabela: 0 for tabela, _, _ in ORDEM_LIMPEZA}
        for tabela, Model, pk in ORDEM_LIMPEZA:
            ids = []
            for man, _ in mans:
                ids.extend(man["ids"].get(tabela, []))
            if not ids:
                continue
            n = db.query(Model).filter(pk.in_(ids)).delete(synchronize_session=False)
            removidos[tabela] = n
        db.commit()

        for _, caminho in mans:
            os.remove(caminho)

        print()
        ok("✨ Limpeza concluída. Registros removidos:")
        for tabela, _, _ in ORDEM_LIMPEZA:
            print(f"   {tabela}: {removidos[tabela]}")
        ok(f"   Total: {sum(removidos.values())}")
        inf(f"   {len(mans)} manifesto(s) removido(s).")

    except Exception as e:
        db.rollback()
        import traceback
        err(f"\n✖ Erro na limpeza (rollback feito): {e}")
        traceback.print_exc()
    finally:
        db.close()


# ════════════════════════════════════════════════════════════════════════════
# CLI
# ════════════════════════════════════════════════════════════════════════════

def main():
    p = argparse.ArgumentParser(
        prog="dados_demo.py",
        description="Gera e remove dados de demonstração de forma reversível.",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("gerar", help="gera um lote de dados")
    g.add_argument("--clifors", type=int, default=20, help="nº de clientes/fornecedores (padrão 20)")
    g.add_argument("--pf-ratio", type=float, default=0.7, help="proporção pessoa física (0..1, padrão 0.7)")
    g.add_argument("--meses", type=int, default=6, help="meses de lançamentos por clifor (padrão 6)")
    g.add_argument("--mix", type=_parse_mix, default="0.6,0.15,0.25",
                   help="pago,aberto,inadimplente (padrão 0.6,0.15,0.25)")
    g.add_argument("--inadimplentes", type=int, default=None,
                   help="nº EXATO de clientes inadimplentes (determinístico; ignora o peso "
                        "de inadimplência do --mix). Só clientes/PF ficam inadimplentes.")
    g.add_argument("--sim", action="store_true", help="pula a confirmação interativa")
    g.add_argument("--producao", action="store_true", help="reconhece alvo de produção em modo automático")
    g.set_defaults(func=gerar)

    l = sub.add_parser("listar", help="lista os lotes registrados")
    l.set_defaults(func=listar)

    c = sub.add_parser("limpar", help="remove um lote (último por padrão)")
    grp = c.add_mutually_exclusive_group()
    grp.add_argument("--lote", help="lote_id específico a remover")
    grp.add_argument("--tudo", action="store_true", help="remove todos os lotes")
    c.add_argument("--sim", action="store_true", help="pula a confirmação / força banco divergente")
    c.add_argument("--producao", action="store_true", help="reconhece alvo de produção em modo automático")
    c.set_defaults(func=limpar)

    args = p.parse_args()
    # --mix pode chegar como string (default) — normaliza.
    if getattr(args, "mix", None) is not None and isinstance(args.mix, str):
        args.mix = _parse_mix(args.mix)
    args.func(args)


if __name__ == "__main__":
    main()
