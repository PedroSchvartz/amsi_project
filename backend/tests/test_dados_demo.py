"""
Testa a ferramenta utils/dados_demo.py: geração + limpeza reversível.

O foco é o contrato central: depois de gerar e depois limpar, o banco volta
EXATAMENTE ao estado anterior ("como se nunca tivesse existido"). O fixture
autouse db_snapshot (conftest.py) reforça isso ao final da sessão.

MANIFEST_DIR é redirecionado para um tmp_path por teste, então estes testes não
tocam os manifestos reais em utils/.dados_demo/.
"""

import argparse

import pytest
from sqlalchemy import text

from database import SessionLocal
import utils.dados_demo as dd

TABELAS = ("clientefornecedor", "endereco", "contato", "lancamento", "tipo_conta")


def _ns(**kw):
    """Namespace de args equivalente ao argparse, com --sim (sem confirmação)."""
    base = dict(sim=True, producao=False, lote=None, tudo=False)
    base.update(kw)
    return argparse.Namespace(**base)


def _counts():
    db = SessionLocal()
    try:
        return {t: db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar() for t in TABELAS}
    finally:
        db.close()


def _admin_existe():
    from models.usuario import Usuario, AcessoEnum
    db = SessionLocal()
    try:
        return db.query(Usuario).filter(
            Usuario.perfil_de_acesso == AcessoEnum.Administrador,
            Usuario.exclusao == None,  # noqa: E711
        ).first() is not None
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _requer_admin():
    if not _admin_existe():
        pytest.skip("Nenhum administrador no banco — rode utils/bootstrap.py")


def test_gerar_e_limpar_reversivel(tmp_path, monkeypatch):
    monkeypatch.setattr(dd, "MANIFEST_DIR", str(tmp_path / ".dados_demo"))

    antes = _counts()
    dd.gerar(_ns(clifors=3, pf_ratio=0.7, meses=2, mix=[0.5, 0.25, 0.25]))

    arquivos = dd._arquivos_lote()
    assert len(arquivos) == 1, "deveria existir exatamente 1 manifesto após gerar"
    man = dd._carregar(arquivos[0])
    assert len(man["ids"]["clientefornecedor"]) == 3
    assert len(man["ids"]["endereco"]) == 3
    assert len(man["ids"]["contato"]) == 3
    assert len(man["ids"]["lancamento"]) == 6  # clifors * meses

    meio = _counts()
    assert meio["clientefornecedor"] == antes["clientefornecedor"] + 3
    assert meio["endereco"] == antes["endereco"] + 3
    assert meio["contato"] == antes["contato"] + 3
    assert meio["lancamento"] == antes["lancamento"] + 6

    dd.limpar(_ns(lote=man["lote_id"]))

    assert dd._arquivos_lote() == [], "o manifesto deveria ter sido removido"
    assert _counts() == antes, "limpar deve restaurar o estado exato do banco"


def test_inadimplencia_marcada_para_pf_com_credito_vencido(tmp_path, monkeypatch):
    monkeypatch.setattr(dd, "MANIFEST_DIR", str(tmp_path / ".dados_demo"))

    antes = _counts()
    # 100% PF, 100% inadimplente → todo clifor recebe crédito vencido não pago.
    dd.gerar(_ns(clifors=2, pf_ratio=1.0, meses=1, mix=[0.0, 0.0, 1.0]))

    man = dd._carregar(dd._arquivos_lote()[0])
    ids = man["ids"]["clientefornecedor"]
    assert len(ids) == 2

    from models.cliente_fornecedor import ClienteFornecedor
    db = SessionLocal()
    try:
        flags = [c.inadimplente for c in db.query(ClienteFornecedor)
                 .filter(ClienteFornecedor.id_clifor.in_(ids)).all()]
    finally:
        db.close()
    assert flags and all(flags), "clifor PF com crédito vencido deve ficar inadimplente"

    dd.limpar(_ns(lote=man["lote_id"]))
    assert _counts() == antes


def test_limpar_recusa_banco_divergente(tmp_path, monkeypatch):
    """Se o manifesto aponta para outro banco, limpar sem --sim deve recusar."""
    monkeypatch.setattr(dd, "MANIFEST_DIR", str(tmp_path / ".dados_demo"))

    antes = _counts()
    dd.gerar(_ns(clifors=2, pf_ratio=0.5, meses=1, mix=[1.0, 0.0, 0.0]))
    caminho = dd._arquivos_lote()[0]
    man = dd._carregar(caminho)

    # Falseia o alvo_db do manifesto e tenta limpar sem --sim → não deve apagar nada.
    man["alvo_db"] = "host_falso/banco_falso"
    with open(caminho, "w", encoding="utf-8") as f:
        import json
        json.dump(man, f, ensure_ascii=False, indent=2)

    dd.limpar(argparse.Namespace(sim=False, producao=False, lote=man["lote_id"], tudo=False))
    # Recusou: manifesto e dados continuam lá.
    assert dd._arquivos_lote(), "limpar não deveria remover o manifesto divergente"
    assert _counts()["clientefornecedor"] == antes["clientefornecedor"] + 2

    # Limpeza real para não sujar o banco (força com --sim).
    dd.limpar(_ns(lote=man["lote_id"], sim=True))
    assert _counts() == antes
