"""
Script de limpeza total do sistema.

Ordem de deleção (respeita as FKs):
  1. Contatos
  2. Endereços
  3. Lançamentos
  4. CliFor (ClienteFornecedor)
  5. Tipos de Conta

Erros são salvos em: erros_limpeza_total.txt

INSTRUÇÕES:
  1. Preencha JWT_TOKEN com o seu token Bearer.
  2. Execute: python limpar_tudo.py
"""

import requests

# ============================================================
# CONFIGURAÇÃO — preencha antes de rodar
# ============================================================
JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsInBlcmZpbCI6IkFkbWluaXN0cmFkb3IiLCJleHAiOjE3ODI3ODE5NjUsImp0aSI6IjE0OTgyY2Q3LTk1MGMtNDc4NC04MTgyLTU2MWM4YTcxYzRjNyJ9.BdxhD9hQ6WkPw0bBIX9kCOL62xZ3KfqG6vC7w27mA0A"
BASE_URL  = "https://amsiproject-production.up.railway.app"
# ============================================================

HEADERS = {
    "Authorization": f"Bearer {JWT_TOKEN}",
    "Content-Type": "application/json",
}

erros: list[str] = []


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def registrar_erro(mensagem: str) -> None:
    print(f"  [ERRO] {mensagem}")
    erros.append(mensagem)


def listar_ids(endpoint: str, campo_id: str) -> list[int]:
    """Busca a lista de recursos e retorna os IDs encontrados."""
    url = f"{BASE_URL}{endpoint}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = next((v for v in data.values() if isinstance(v, list)), [])
        else:
            items = []

        return [item[campo_id] for item in items if campo_id in item]

    except Exception as exc:
        registrar_erro(f"Falha ao listar '{endpoint}': {exc}")
        return []


def deletar_item(endpoint_base: str, item_id: int, nome_recurso: str) -> bool:
    """Envia DELETE para um item específico. Retorna True se bem-sucedido."""
    url = f"{BASE_URL}{endpoint_base}/{item_id}"
    try:
        resp = requests.delete(url, headers=HEADERS, timeout=30)
        if resp.status_code in (200, 204):
            print(f"  [OK] {nome_recurso} {item_id} deletado.")
            return True
        else:
            registrar_erro(
                f"{nome_recurso} {item_id} — "
                f"HTTP {resp.status_code}: {resp.text[:200]}"
            )
            return False
    except Exception as exc:
        registrar_erro(f"{nome_recurso} {item_id} — Exceção: {exc}")
        return False


def deletar_todos(endpoint_lista: str, endpoint_delete: str,
                  campo_id: str, nome_recurso: str) -> None:
    """Lista todos os IDs e deleta um a um."""
    print(f"\n{'='*55}")
    print(f"Buscando todos os {nome_recurso}...")
    ids = listar_ids(endpoint_lista, campo_id)

    if not ids:
        print(f"  Nenhum {nome_recurso} encontrado (ou erro na listagem).")
        return

    print(f"  {len(ids)} {nome_recurso}(s) encontrado(s). Iniciando deleção...")
    ok = 0
    for item_id in ids:
        if deletar_item(endpoint_delete, item_id, nome_recurso):
            ok += 1

    print(f"\n  Resultado {nome_recurso}: {ok}/{len(ids)} deletado(s).")


def salvar_erros() -> None:
    if not erros:
        print("\nNenhum erro registrado.")
        return

    arquivo = "erros_limpeza_total.txt"
    with open(arquivo, "w", encoding="utf-8") as f:
        f.write(f"Total de erros: {len(erros)}\n")
        f.write("=" * 55 + "\n\n")
        for linha in erros:
            f.write(linha + "\n")

    print(f"\n{len(erros)} erro(s) registrado(s) em '{arquivo}'.")


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def main() -> None:
    if JWT_TOKEN == "SEU_TOKEN_AQUI":
        print("ATENÇÃO: Preencha a variável JWT_TOKEN antes de executar o script.")
        return

    print("Iniciando limpeza total do sistema...")
    print(f"Alvo: {BASE_URL}")

    # 1. Contatos (dependem de CliFor)
    deletar_todos(
        endpoint_lista="/contato/",
        endpoint_delete="/contato",
        campo_id="id_contato",
        nome_recurso="Contato",
    )

    # 2. Endereços (dependem de CliFor)
    deletar_todos(
        endpoint_lista="/endereco/",
        endpoint_delete="/endereco",
        campo_id="id_endereco",
        nome_recurso="Endereço",
    )

    # 3. Lançamentos (dependem de CliFor e tipo_conta)
    deletar_todos(
        endpoint_lista="/lancamento/",
        endpoint_delete="/lancamento",
        campo_id="id_lancamento",
        nome_recurso="Lançamento",
    )

    # 4. CliFor (dependem de nada mais após contatos/endereços/lançamentos removidos)
    deletar_todos(
        endpoint_lista="/cliente_fornecedor/",
        endpoint_delete="/cliente_fornecedor",
        campo_id="id_clifor",
        nome_recurso="CliFor",
    )

    # 5. Tipos de Conta (sem dependências restantes)
    deletar_todos(
        endpoint_lista="/tipo_conta/",
        endpoint_delete="/tipo_conta",
        campo_id="id_tipo_conta",
        nome_recurso="Tipo de Conta",
    )

    salvar_erros()
    print("\nProcesso concluído.")


if __name__ == "__main__":
    main()