"""
Script de importação de Clientes/Fornecedores a partir de CSV.

Fluxo por linha:
  1. Valida campos obrigatórios (CPF, RG, Nome Completo + Celular ou E-mail)
  2. Cria o CliFor  → captura id_clifor
  3. Cria contato(s) — Celular e/ou E-mail
  4. Se endereço completo, cria o endereço vinculado
  5. Linhas inválidas vão para 'pendentes_<arquivo_original>.csv'
  6. Erros de API vão para 'erros_importacao.txt'

INSTRUÇÕES:
  1. Preencha JWT_TOKEN com o seu token Bearer.
  2. Coloque o caminho do CSV em ARQUIVO_CSV.
  3. Execute: python importar_clifor.py
"""

import csv
import os
import re
import requests

# ============================================================
# CONFIGURAÇÃO — preencha antes de rodar
# ============================================================
JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsInBlcmZpbCI6IkFkbWluaXN0cmFkb3IiLCJleHAiOjE3ODI3NzAwMzksImp0aSI6ImNmM2M4YzI4LTI0OWEtNDBiNC1iMzY1LWU4OTU2OWFjMTAyMyJ9.bk5aNMqMwjYyYa3hi7r_ZzKJ9cygs3EC36_-LsRRstY"
BASE_URL   = "https://amsiproject-production.up.railway.app"
# ============================================================
ARQUIVO_CSV = r"C:\Users\schva\Downloads\AMBSI-Associados-CargaSistema.xlsx - Cadastros.csv"          # caminho para o seu CSV
# ============================================================

HEADERS = {
    "Authorization": f"Bearer {JWT_TOKEN}",
    "Content-Type": "application/json",
}

# Colunas esperadas no CSV
COL_CPF          = "CPF"
COL_RG           = "RG"
COL_NOME         = "Nome Completo"
COL_NOME_USUAL   = "Nome Usual"
COL_CELULAR      = "Celular"
COL_EMAIL        = "E-mail"
COL_LOGRADOURO   = "Endereço"
COL_NUMERO       = "Número"
COL_COMPLEMENTO  = "Complemento"
COL_BAIRRO       = "Bairro"
COL_CIDADE       = "Município"
COL_UF           = "UF"
COL_CEP          = "CEP"

erros: list[str] = []


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def vazio(valor: str) -> bool:
    return not valor or not valor.strip()


def limpar_cpf(cpf: str) -> str:
    """Remove formatação do CPF, mantém só dígitos."""
    return re.sub(r"\D", "", cpf)


def completo(row: dict) -> bool:
    """Retorna True se o registro tem os campos mínimos para cadastro."""
    tem_cpf    = not vazio(row.get(COL_CPF, ""))
    tem_rg     = not vazio(row.get(COL_RG, ""))
    tem_nome   = not vazio(row.get(COL_NOME, ""))
    tem_contato = (
        not vazio(row.get(COL_CELULAR, "")) or
        not vazio(row.get(COL_EMAIL, ""))
    )
    return tem_cpf and tem_rg and tem_nome and tem_contato


def endereco_completo(row: dict) -> bool:
    campos = [COL_LOGRADOURO, COL_NUMERO, COL_BAIRRO, COL_CIDADE, COL_UF, COL_CEP]
    return all(not vazio(row.get(c, "")) for c in campos)


def registrar_erro(mensagem: str) -> None:
    print(f"  [ERRO] {mensagem}")
    erros.append(mensagem)


# ─────────────────────────────────────────────
# Chamadas à API
# ─────────────────────────────────────────────

def criar_clifor(row: dict) -> int | None:
    """Cria o CliFor e retorna o id_clifor gerado, ou None em caso de erro."""
    cpf_limpo = limpar_cpf(row[COL_CPF])
    nome      = row[COL_NOME].strip()

    payload = {
        "pessoafisica_juridica": True,
        "cpf_cnpj":              cpf_limpo,
        "rg_inscricaoestadual":  row[COL_RG].strip(),
        "nome":                  nome,
        "tipo_clifor":           "C",
        "ativo":                 True,
        "inadimplente":          False,
    }

    # DataNascimento é opcional — omite se ausente
    # (campo não existe no CSV; deixamos sem enviar)

    try:
        resp = requests.post(
            f"{BASE_URL}/cliente_fornecedor/",
            json=payload,
            headers=HEADERS,
            timeout=30,
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            return data.get("id_clifor")
        else:
            registrar_erro(
                f"CliFor '{nome}' (CPF {cpf_limpo}) — "
                f"HTTP {resp.status_code}: {resp.text[:300]}"
            )
            return None
    except Exception as exc:
        registrar_erro(f"CliFor '{nome}' — Exceção: {exc}")
        return None


def criar_contato(id_clifor: int, tipo: str, info: str, principal: bool) -> None:
    payload = {
        "id_clifor_fk":      id_clifor,
        "tipocontato":       tipo,
        "info_do_contato":   info.strip(),
        "contato_principal": principal,
    }
    try:
        resp = requests.post(
            f"{BASE_URL}/contato/",
            json=payload,
            headers=HEADERS,
            timeout=30,
        )
        if resp.status_code not in (200, 201):
            registrar_erro(
                f"Contato {tipo} para clifor {id_clifor} — "
                f"HTTP {resp.status_code}: {resp.text[:300]}"
            )
        else:
            print(f"    [OK] Contato {tipo} cadastrado.")
    except Exception as exc:
        registrar_erro(f"Contato {tipo} para clifor {id_clifor} — Exceção: {exc}")


def criar_endereco(id_clifor: int, row: dict) -> None:
    payload = {
        "id_clifor_fk":      id_clifor,
        "enderecoprimario":  True,
        "logradouro":        row[COL_LOGRADOURO].strip(),
        "numero":            row[COL_NUMERO].strip(),
        "complemento":       row.get(COL_COMPLEMENTO, "").strip() or None,
        "bairro":            row[COL_BAIRRO].strip(),
        "cidade":            row[COL_CIDADE].strip(),
        "uf":                row[COL_UF].strip().upper(),
        "cep":               row[COL_CEP].strip(),
    }
    try:
        resp = requests.post(
            f"{BASE_URL}/endereco/",
            json=payload,
            headers=HEADERS,
            timeout=30,
        )
        if resp.status_code not in (200, 201):
            registrar_erro(
                f"Endereço para clifor {id_clifor} — "
                f"HTTP {resp.status_code}: {resp.text[:300]}"
            )
        else:
            print(f"    [OK] Endereço cadastrado.")
    except Exception as exc:
        registrar_erro(f"Endereço para clifor {id_clifor} — Exceção: {exc}")


# ─────────────────────────────────────────────
# Salvar arquivos de saída
# ─────────────────────────────────────────────

def salvar_pendentes(pendentes: list[dict], colunas: list[str]) -> None:
    if not pendentes:
        print("\nNenhum registro pendente.")
        return

    base     = os.path.splitext(os.path.basename(ARQUIVO_CSV))[0]
    arquivo  = f"pendentes_{base}.csv"

    with open(arquivo, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=colunas, delimiter="\t")
        writer.writeheader()
        writer.writerows(pendentes)

    print(f"\n{len(pendentes)} registro(s) pendente(s) salvo(s) em '{arquivo}'.")


def salvar_erros() -> None:
    if not erros:
        print("Nenhum erro de API registrado.")
        return

    arquivo = "erros_importacao.txt"
    with open(arquivo, "w", encoding="utf-8") as f:
        f.write(f"Total de erros: {len(erros)}\n")
        f.write("=" * 55 + "\n\n")
        for linha in erros:
            f.write(linha + "\n")

    print(f"{len(erros)} erro(s) de API registrado(s) em '{arquivo}'.")


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def main() -> None:
    if JWT_TOKEN == "SEU_TOKEN_AQUI":
        print("ATENÇÃO: Preencha a variável JWT_TOKEN antes de executar o script.")
        return

    if not os.path.exists(ARQUIVO_CSV):
        print(f"ATENÇÃO: Arquivo '{ARQUIVO_CSV}' não encontrado.")
        return

    print(f"Lendo '{ARQUIVO_CSV}'...")

    with open(ARQUIVO_CSV, newline="", encoding="utf-8-sig") as f:
        reader    = csv.DictReader(f, delimiter="\t")
        todas     = list(reader)
        colunas   = reader.fieldnames or []

    print(f"{len(todas)} linha(s) encontrada(s).\n")

    pendentes: list[dict] = []
    cadastrados = 0

    for i, row in enumerate(todas, start=1):
        nome_log = row.get(COL_NOME, f"linha {i}").strip() or f"linha {i}"
        print(f"[{i}/{len(todas)}] {nome_log}")

        if not completo(row):
            print("  → Incompleto. Enviando para pendentes.")
            pendentes.append(row)
            continue

        # 1. Criar CliFor
        id_clifor = criar_clifor(row)
        if id_clifor is None:
            print("  → Falha ao criar CliFor. Enviando para pendentes.")
            pendentes.append(row)
            continue

        print(f"  [OK] CliFor criado (id={id_clifor}).")

        # 2. Criar contato(s)
        tem_celular = not vazio(row.get(COL_CELULAR, ""))
        tem_email   = not vazio(row.get(COL_EMAIL, ""))

        if tem_celular:
            # Celular é o principal se não houver e-mail
            criar_contato(id_clifor, "Celular", row[COL_CELULAR], principal=not tem_email)

        if tem_email:
            # E-mail é sempre principal (ou único)
            criar_contato(id_clifor, "E-mail", row[COL_EMAIL], principal=True)

        # 3. Criar endereço (se completo)
        if endereco_completo(row):
            criar_endereco(id_clifor, row)
        else:
            print("  → Endereço incompleto, pulando cadastro de endereço.")

        cadastrados += 1

    # Relatórios finais
    print(f"\n{'='*55}")
    print(f"Concluído: {cadastrados} cadastrado(s), {len(pendentes)} pendente(s).")

    salvar_pendentes(pendentes, list(colunas))
    salvar_erros()


if __name__ == "__main__":
    main()