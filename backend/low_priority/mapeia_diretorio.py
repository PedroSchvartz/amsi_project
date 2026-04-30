def mapeia_diretorio(raiz: str = ".", ignorar: list = None, nivel_max: int = None) -> str:
    import os

    if ignorar is None:
        ignorar = ["__pycache__", ".git", ".venv", "node_modules", ".idea"]

    linhas = []

    def formatar_tamanho(bytes_size):
        """Converte bytes para KB, MB, etc."""
        for unidade in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_size < 1024:
                return f"{bytes_size:.1f}{unidade}"
            bytes_size /= 1024
        return f"{bytes_size:.1f}PB"

    def _mapear(caminho, prefixo="", nivel=0):
        if nivel_max is not None and nivel > nivel_max:
            return

        try:
            itens = sorted(os.listdir(caminho))
        except PermissionError:
            return

        itens = [i for i in itens if i not in ignorar]

        for idx, item in enumerate(itens):
            caminho_completo = os.path.join(caminho, item)
            eh_ultimo = idx == len(itens) - 1
            conector = "└── " if eh_ultimo else "├── "

            if os.path.isfile(caminho_completo):
                tamanho = os.path.getsize(caminho_completo)
                tamanho_formatado = formatar_tamanho(tamanho)
                linhas.append(f"{prefixo}{conector}{item} ({tamanho_formatado})")
            else:
                linhas.append(f"{prefixo}{conector}{item}")

            if os.path.isdir(caminho_completo):
                extensao = "    " if eh_ultimo else "│   "
                _mapear(caminho_completo, prefixo + extensao, nivel + 1)

    nome_raiz = os.path.abspath(raiz)
    linhas.append(nome_raiz)
    _mapear(raiz)
    return "\n".join(linhas)

print(mapeia_diretorio("."))