import os


import os
import logging
from datetime import datetime

from typing import Optional, Dict, Any, List, Tuple

# ========== FUNÇÕES AUXILIARES ==========
def intput(prompt: str) -> int:
    while True:
        resposta = input(prompt).strip()
        if resposta.isdigit():
            return int(resposta)
        print("Essa pergunta aceita apenas números inteiros, por favor responda com números inteiros:")

def floatput(prompt: str) -> float:
    while True:
        resposta = input(prompt).strip()
        try:
            return float(resposta)
        except ValueError:
            print("Essa pergunta aceita apenas números inteiros e flutuantes, por favor responda com números válidos:")

def obriput(prompt: str) -> str:
    while True:
        resposta = input(prompt).strip()
        if resposta:
            return resposta
        print("A entrada não pode ser vazia. Por favor, insira algo.")

def boolput(prompt: str) -> bool:
    affirmatives = {"sim","ss", "s", "yes", "y", "1", "verdadeiro", "true", "claro", "certo", "positivo", "okay", "ok"}
    negatives = {"não", "nao", "n", "no", "0", "falso", "false", "negativo", "errado", "não mesmo", "nem"}
    while True:
        resposta = input(prompt).strip().lower()
        if resposta in affirmatives:
            return True
        elif resposta in negatives:
            return False
        print("Por favor, responda com uma variação de 'sim' ou 'não'.")

def colorir(texto: str, *, cor: str = None, fundo: str = None, estilo: Any = None, usar_cores: bool = True) -> str:
    if not usar_cores:
        return texto

    fg_cores = {
        "preto": 30, "vermelho": 31, "verde": 32, "amarelo": 33,
        "azul": 34, "magenta": 35, "ciano": 36, "branco": 37,
        "cinza": 90, "vermelho_claro": 91, "verde_claro": 92, "amarelo_claro": 93,
        "azul_claro": 94, "magenta_claro": 95, "ciano_claro": 96, "branco_claro": 97
    }
    bg_cores = {
        "preto": 40, "vermelho": 41, "verde": 42, "amarelo": 43,
        "azul": 44, "magenta": 45, "ciano": 46, "branco": 47,
        "cinza": 100, "vermelho_claro": 101, "verde_claro": 102, "amarelo_claro": 103,
        "azul_claro": 104, "magenta_claro": 105, "ciano_claro": 106, "branco_claro": 107
    }
    estilos = {"negrito": 1, "italico": 3, "underline": 4, "piscar": 5, "reverso": 7}

    ansi_codes = []
    if estilo:
        if isinstance(estilo, list):
            for s in estilo:
                code = estilos.get(s.lower())
                if code:
                    ansi_codes.append(str(code))
        else:
            code = estilos.get(estilo.lower())
            if code:
                ansi_codes.append(str(code))

    if cor:
        code = fg_cores.get(cor.lower())
        if code:
            ansi_codes.append(str(code))

    if fundo:
        code = bg_cores.get(fundo.lower())
        if code:
            ansi_codes.append(str(code))

    if ansi_codes:
        return f"\033[{';'.join(ansi_codes)}m{texto}\033[0m"
    else:
        return texto

from typing import List, Dict, Any, Union

from typing import Union, List, Dict, Any
import logging

def expoeAlternativas(
    alternativas: Union[List[str], Dict[Any, Any]],
    quantidade: int = 1,
    titulo: str = "Alternativas disponíveis",
    usar_cores: bool = True,
    escolha_unica: bool = True,
    expoe: str = 'chaves',
    retorno: str = None
) -> Any:
    """
    Exibe opções interativas para o usuário selecionar.
    Suporta lista de strings ou dicionário (chave -> valor).

    Para dict:
        - 'expoe' diz o que será exibido: 'chaves' ou 'valores'.
        - 'retorno' diz o que será retornado: 'chaves' ou 'valores'.
        - Se apenas um dos dois for passado, o outro assume o mesmo.
        - Se nenhum for passado, o usuário será perguntado.
    """

    def colorir(texto: str, cor: str) -> str:
        cores = {"azul": "94", "verde": "92", "amarelo": "93", "vermelho": "91"}
        return f"\033[{cores[cor]}m{texto}\033[0m" if usar_cores and cor in cores else texto

    # Verificação inicial
    is_dict = isinstance(alternativas, dict)
    if not alternativas or (not is_dict and not isinstance(alternativas, list)):
        raise ValueError("A lista de alternativas deve ser uma lista ou dicionário não vazio.")

    # Caso dicionário: decidir o que exibir e o que retornar
    if is_dict:
        if retorno is None and expoe is None:
            expoe = expoeAlternativas(
                alternativas=["chaves", "valores"],
                titulo="Escolha se a função lerá as chaves ou valores do dicionário."
            )
            retorno = expoeAlternativas(
                alternativas=["chaves", "valores"],
                titulo="Escolha se a função retornará as chaves ou valores do dicionário."
            )
        elif retorno is None:
            if expoe in ("chaves", "valores"):
                retorno = expoe
            else:
                expoe = expoeAlternativas(
                    alternativas=["chaves", "valores"],
                    titulo="Escolha se a função lerá as chaves ou valores do dicionário."
                )
                retorno = expoeAlternativas(
                    alternativas=["chaves", "valores"],
                    titulo="Escolha se a função retornará as chaves ou valores do dicionário."
                )
        elif expoe is None:
            if retorno in ("chaves", "valores"):
                expoe = retorno
            else:
                expoe = expoeAlternativas(
                    alternativas=["chaves", "valores"],
                    titulo="Escolha se a função lerá as chaves ou valores do dicionário."
                )
                retorno = expoeAlternativas(
                    alternativas=["chaves", "valores"],
                    titulo="Escolha se a função retornará as chaves ou valores do dicionário."
                )
        else:
            if expoe not in ("chaves", "valores") or retorno not in ("chaves", "valores"):
                expoe = expoeAlternativas(
                    alternativas=["chaves", "valores"],
                    titulo="Escolha se a função lerá as chaves ou valores do dicionário."
                )
                retorno = expoeAlternativas(
                    alternativas=["chaves", "valores"],
                    titulo="Escolha se a função retornará as chaves ou valores do dicionário."
                )

        # Definir lista de opções com base em 'expoe'
        if expoe == "chaves":
            opcoes = list(alternativas.keys())
        else:
            opcoes = list(alternativas.values())

    else:
        # Caso lista normal
        opcoes = alternativas.copy()
        expoe = retorno = 'nomes'

    # Ajusta quantidade
    if quantidade < 0:
        quantidade = 0
    if quantidade > len(opcoes):
        print(colorir(
            f"A quantidade requisitada ({quantidade}) é maior que as opções disponíveis ({len(opcoes)}).",
            "amarelo"
        ))
        quantidade = len(opcoes)

    selecionadas = []
    disponiveis = opcoes.copy()

    # Loop de seleção
    for idx in range(1, quantidade + 1):
        while True:
            print("\n" + colorir(titulo, "azul"))
            for i, opc in enumerate(disponiveis, start=1):
                print(f"  {i}. {opc}")
            if quantidade != 1:
                print(colorir(f"\nSeleção {idx} de {quantidade}:", "verde"))
            escolha = input("Digite o número ou o nome da opção desejada: ").strip()
            if not escolha:
                print(colorir("Entrada vazia. Tente novamente.", "vermelho"))
                continue

            opcao_escolhida = None
            if escolha.isdigit():
                num = int(escolha)
                if 1 <= num <= len(disponiveis):
                    opcao_escolhida = disponiveis[num - 1]
                else:
                    print(colorir("Número inválido. Tente novamente.", "vermelho"))
                    continue
            else:
                matchs = [op for op in disponiveis if op.lower() == escolha.lower()]
                if not matchs:
                    matchs = [op for op in disponiveis if op.lower().startswith(escolha.lower())]
                if len(matchs) == 1:
                    opcao_escolhida = matchs[0]
                else:
                    print(colorir("Opção não encontrada ou ambígua. Tente novamente.", "vermelho"))
                    continue

            confirma = boolput(colorir(f"Você escolheu '{opcao_escolhida}'. Confirma? (sim/não): ", "azul"))
            if confirma:
                selecionadas.append(opcao_escolhida)
                disponiveis.remove(opcao_escolhida)
                break
            else:
                print(colorir("Escolha cancelada. Selecione novamente.", "amarelo"))

    # Mapeia resultado para retorno correto
    resultados = []
    for sel in selecionadas:
        if is_dict:
            if expoe == 'chaves' and retorno == 'valores':
                resultados.append(alternativas[sel])
            elif expoe == 'valores' and retorno == 'chaves':
                for k, v in alternativas.items():
                    if v == sel:
                        resultados.append(k)
                        break
            else:
                resultados.append(sel)
        else:
            resultados.append(sel)

    if quantidade == 0:
        return [] if not escolha_unica else None
    return resultados[0] if escolha_unica else resultados

def format_dict_str(dicts: list[dict]) -> str:
    """
    Formata uma lista de dicionários em uma "tabela" textual com cabeçalhos e linhas alinhadas.
    """
    if not dicts:
        return "Nenhum dado para exibir."
    
    # Determina a lista de colunas preservando a ordem da primeira ocorrência
    columns = []
    for d in dicts:
        for key in d.keys():
            if key not in columns:
                columns.append(key)
    
    # Calcula a largura máxima de cada coluna
    widths = []
    for col in columns:
        max_width = len(str(col))
        for d in dicts:
            value = str(d.get(col, ""))
            if len(value) > max_width:
                max_width = len(value)
        widths.append(max_width)
    
    # Monta cabeçalho e divisória
    header = " | ".join(str(col).ljust(width) for col, width in zip(columns, widths))
    divider = "-+-".join("-" * width for width in widths)
    
    # Monta as linhas de dados
    rows = "\n".join(
        " | ".join(str(d.get(col, "")).ljust(width) for col, width in zip(columns, widths))
        for d in dicts
    )
    
    return f"\n{divider}\n{header}\n{divider}\n{rows}"

def convert_dict_lists(alternativas: Dict[Any, Any]) -> Tuple[List[Any], List[Any]]:
    """
    Converte um dicionário em duas listas paralelas: chaves e valores, na ordem de inserção.
    """
    return list(alternativas.keys()), list(alternativas.values())

from typing import Union, List, Dict, Any
import logging
def configure_logging(
    log_file: str = "app.log",
    console_level: int = logging.INFO,
    file_level: int = logging.DEBUG,
    use_timestamp: bool = True
) -> logging.Logger:
    """
    Configura o sistema de logging da aplicação com níveis separados para console e arquivo.

    :param log_file: Nome ou caminho do arquivo de log. Se for apenas o nome (sem diretório),
                     o arquivo será criado dentro de "logs/".
    :param console_level: Nível mínimo de mensagens a exibir no console que devem ser escolhidas com um numero. pode ser:
     10: DEBUG, Mostra absolutamente tudo;
     20: info, mostra tudo menos as mensagems de debug
     30: WARNING, Abaixo de info mostrando coisas que são inesperadas |
     40: ERROR, Abaixo de Warning mostra erros que não impedem o código de funcionar.
     50: CRITICAL, Abaixo de ERROR, erros que param o código.
    :param file_level: Nível mínimo de mensagens a registrar no arquivo.
    :param use_timestamp: Se True e log_file for igual ao padrão "app.log", adiciona data/hora
                          ao nome (ex: log_2025-04-17_18-30-22.log). Caso False, usa o nome fornecido.
    :return: Instância do logger configurado.
    """
    logger = logging.getLogger()
    if getattr(configure_logging, "_configured", False):
        return logger

    # Gera nome com timestamp se padrão e solicitado
    if log_file.strip().lower() == "app.log" and use_timestamp:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        actual_log = f"logs/log_{timestamp}.log"
    else:
        actual_log = (
            os.path.join("logs_temporarios", log_file)
            if not os.path.dirname(log_file)
            else log_file
        )

    # Garante existência do diretório
    log_dir = os.path.dirname(actual_log) or "."
    os.makedirs(log_dir, exist_ok=True)

    # Configura logger para capturar ambos os níveis mínimos
    logger.setLevel(min(console_level, file_level))

    # Formatter padrão
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Handler de console
    ch = logging.StreamHandler()
    ch.setLevel(console_level)
    ch.setFormatter(formatter)
    logger.addHandler(ch)

    # Handler de arquivo
    fh = logging.FileHandler(actual_log, encoding="utf-8")
    fh.setLevel(file_level)
    fh.setFormatter(formatter)
    logger.addHandler(fh)

    # Marca como configurado
    configure_logging._configured = True

    logger.debug(f"Logging iniciado.")
    logger.debug(f"Arquivo de log: {os.path.abspath(actual_log)}")
    logger.debug(f"Script executado: {os.path.abspath(__file__)}")

    return logger

from datetime import datetime

def get_timestamp() -> str:
    """
    Retorna a data e hora atual no formato:
    YYYY_MM_DD_HH_MM_SS
    Exemplo: '2025_04_24_09_50_32'
    """
    return datetime.now().strftime("%Y_%m_%d_%H_%M_%S")

import os
def acha_caminho(nome_final, diretorio_atual=os.getcwd()):
    """
    Procura um arquivo específico pelo nome de forma recursiva em todos os subdiretórios.

    :param nome_final: Nome do arquivo a ser procurado.
    :param diretorio_atual: Diretório onde a busca começará.
    :return: Caminho completo do arquivo encontrado ou None se não for encontrado.
    """
    try:
        # Verifica arquivos no diretório atual
        if nome_final in os.listdir(diretorio_atual):
            caminho_arquivo = os.path.join(diretorio_atual, nome_final)
            if os.path.isfile(caminho_arquivo):  # Garante que é realmente um arquivo
                print(f"\033[92m\n- Arquivo: {nome_final} encontrado no caminho de:\n{caminho_arquivo}.\033[0m")
                return caminho_arquivo

        # Se não encontrado no diretório atual, verifica subdiretórios
        for entrada in os.listdir(diretorio_atual):
            caminho_entrada = os.path.join(diretorio_atual, entrada)
            if os.path.isdir(caminho_entrada):  # Apenas diretórios
                resultado = acha_caminho(nome_final, caminho_entrada)
                if resultado:
                    return resultado
    except PermissionError:
        # Permissão negada, mas continua a busca
        print(f"Sem permissão para acessar o diretório: {diretorio_atual}")
    except FileNotFoundError:
        # O diretório não existe, continuar com segurança
        print(f"O diretório não existe: {diretorio_atual}")
    except Exception as e:
        # Tratamento para outros tipos de erro não previstos
        print(f"Erro inesperado no diretório {diretorio_atual}: {e}")

    # Caso não encontre nada em todo o processo
    print(f'\033[91m\n- Arquivo: {nome_final} não foi encontrado no diretório:\n {diretorio_atual}.\033[0m')
    return None

def abrir_arquivo_com_encodings(caminho_arquivo, encodings=["utf-8", "latin-1", "iso-8859-1"]):
    """
    Tenta abrir um arquivo com múltiplos encodings.
    :param caminho_arquivo: Caminho completo do arquivo.
    :param encodings: Lista de encodings a serem testados.
    :return: Conteúdo do arquivo ou None se não for possível abrir.
    """
    for encoding in encodings:
        try:
            with open(caminho_arquivo, 'r', encoding=encoding) as f:
                return f.readlines()  # Retorna todas as linhas do arquivo
        except UnicodeDecodeError:
            continue  # Tenta o próximo encoding
        except Exception as e:
            print(f"Erro ao tentar abrir o arquivo {caminho_arquivo} com o encoding {encoding}: {e}")
            return None  # Se ocorreu outro erro, retorna None
    print(f"Não foi possível abrir o arquivo {caminho_arquivo} com os encodings fornecidos.")
    return None

import os
from datetime import datetime

def salvar_em_txt(dado, nome_arquivo="saida", pasta="resultados"):
    """
    Salva o conteúdo fornecido em um arquivo .txt com um nome opcional.

    Parâmetros:
    ----------
    dado : qualquer tipo
        O conteúdo a ser salvo no arquivo. Será convertido para string.
    
    nome_arquivo : str, opcional
        O nome base do arquivo (sem extensão). Um timestamp será adicionado automaticamente.
        Padrão é "saida".
    
    pasta : str, opcional
        O nome da pasta onde o arquivo será salvo. Será criada se não existir.
        Padrão é "resultados".

    Retorna:
    -------
    None. Apenas imprime o caminho completo do arquivo salvo.
    """
    # Cria a pasta se não existir
    os.makedirs(pasta, exist_ok=True)

    # Gera um nome de arquivo com data e hora para evitar sobrescrita
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    nome_completo = f"{nome_arquivo}_{timestamp}.txt"
    caminho_completo = os.path.join(pasta, nome_completo)

    # Converte o conteúdo para string e salva
    with open(caminho_completo, "w", encoding="utf-8") as arquivo:
        arquivo.write(str(dado))

    # Mostra o caminho completo
    print(f"\n✅ Arquivo salvo com sucesso em:\n{os.path.abspath(caminho_completo)}")

try:
    from utils.Thread_Manager.teste1 import ThreadManager
except ImportError:
    from Thread_Manager.teste1 import ThreadManager

import os
import re
import time
from datetime import datetime, timedelta
from collections import defaultdict
from queue import Queue
from typing import List, Tuple

def buscar_em_arquivos(
    extensoes: List[str] = None,
    termos_procurados: List[str] = None,
    sensivel: bool = True,
    base_dir: str = os.getcwd(),
    Salva: bool = False,
    exibir: int = 0,
    max_workers: int = 8,
    update_interval: float = 0.1,
) -> List[Tuple[str, dict]]:

    caminhos = []
    total_bytes = 0
    for root, _, files in os.walk(base_dir):
        for f in files:
            if not extensoes or any(f.lower().endswith(ext.lower()) for ext in extensoes):
                p = os.path.join(root, f)
                caminhos.append(p)
                try:
                    total_bytes += os.path.getsize(p)
                except OSError:
                    pass
    if not caminhos:
        print("Nenhum arquivo para processar.")
        return []

    if isinstance(termos_procurados, str):
        termos_procurados = [termos_procurados]
    if not termos_procurados:
        print("Erro: termos_procurados inválido.")
        return []

    print(f"Processando {len(caminhos)} arquivos (~{total_bytes} bytes) em até {max_workers} threads...")

    encontrados      = defaultdict(lambda: defaultdict(int))
    linhas_por_arquivo = defaultdict(lambda: defaultdict(list))  # path -> term -> [(n, linha)]
    erros            = []
    processed_bytes  = 0
    start            = time.time()
    last_update      = start
    bar_len          = 40
    last_remaining   = 0.0
    last_eta         = None

    q = Queue()

    def _worker(path: str):
        counts  = defaultdict(int)
        linhas  = defaultdict(list)
        erro    = None
        try:
            file_linhas = abrir_arquivo_com_encodings(path) or []
            for n, line in enumerate(file_linhas, start=1):
                for term in termos_procurados:
                    if sensivel:
                        encontrou = term.lower() in line.lower()
                    else:
                        pat       = r'\b' + re.escape(term) + r'\b'
                        encontrou = bool(re.search(pat, line, re.IGNORECASE))
                    if encontrou:
                        counts[term] += 1
                        if exibir == 1:
                            linhas[term].append((n, line.rstrip('\n')))
        except Exception as e:
            erro = str(e)
        try:
            sz = os.path.getsize(path)
        except OSError:
            sz = 0
        q.put((path, counts, linhas, sz, erro))

    manager = ThreadManager(tipo='io', max_cap=max_workers)
    [manager.submit(_worker, p) for p in caminhos]

    while manager.active_count() > 0:
        now = time.time()
        if now - last_update >= update_interval:
            while not q.empty():
                path, cnts, lins, sz, erro = q.get_nowait()
                if cnts:
                    encontrados[path] = cnts
                if lins:
                    linhas_por_arquivo[path] = lins
                if erro:
                    erros.append((path, erro))
                processed_bytes += sz

            elapsed = now - start
            if processed_bytes > 0:
                avg            = processed_bytes / elapsed
                last_remaining = (total_bytes - processed_bytes) / avg if avg else 0
                last_eta       = datetime.now() + timedelta(seconds=last_remaining)

            frac   = processed_bytes / total_bytes if total_bytes else 0
            filled = int(bar_len * frac)
            bar    = '=' * filled + '-' * (bar_len - filled)
            eta    = last_eta.strftime('%H:%M:%S') if last_eta else '--:--:--'

            print(
                f"\r[{bar}] {frac:.1%}  "
                f"Elapsed: {elapsed:.1f}s  "
                f"Remaining: {last_remaining:.1f}s  "
                f"ETA: {eta}",
                end=''
            )
            last_update = now
        time.sleep(0.01)

    manager.shutdown()
    while not q.empty():
        path, cnts, lins, sz, erro = q.get_nowait()
        if cnts:
            encontrados[path] = cnts
        if lins:
            linhas_por_arquivo[path] = lins
        if erro:
            erros.append((path, erro))
        processed_bytes += sz

    total_elapsed = time.time() - start
    end_clock     = datetime.now().strftime('%H:%M:%S')
    print(
        f"\r[{'=' * bar_len}] 100.0%  "
        f"Elapsed: {total_elapsed:.1f}s  "
        f"Remaining: 0.0s  "
        f"ETA: {end_clock}"
    )

    if erros:
        print(f"\n\033[33m{len(erros)} arquivo(s) com erro:\033[0m")
        for path, msg in erros:
            print(f"  \033[31m✗\033[0m {path}: {msg}")

    print("\nBusca concluída.\n")

    resultados = sorted(
        encontrados.items(),
        key=lambda x: sum(x[1].values()),
        reverse=True
    )

    if not resultados:
        print(f"\033[31mNenhum termo encontrado em {len(caminhos)} arquivos.\033[0m")
        return []

    # exibe
    print(_formatar_resultado(resultados, exibir=exibir, linhas_por_arquivo=linhas_por_arquivo))

    # salva
    if Salva:
        _salvar_resultado(resultados, exibir=exibir, linhas_por_arquivo=linhas_por_arquivo, base_dir=base_dir)

    return resultados

def alterar_em_arquivos(
    resultados: List[Tuple[str, dict]],
    mapa: dict,
    sensivel: bool = True,
    max_workers: int = 8,
    update_interval: float = 0.1,
) -> None:
    """
    Recebe o resultado raw de buscar_em_arquivos e um dicionário de substituição.
    Modifica os arquivos em disco em uma única passagem por linha.
    Usa ThreadManager para controlar número de threads.
    """
    # filtra só arquivos que têm ao menos um termo no mapa
    alvos = [(path, counts) for path, counts in resultados if any(t in mapa for t in counts)]

    if not alvos:
        print("Nenhum arquivo para alterar.")
        return

    total_bytes = 0
    for path, _ in alvos:
        try:
            total_bytes += os.path.getsize(path)
        except OSError:
            pass

    print(f"Alterando {len(alvos)} arquivo(s) (~{total_bytes} bytes) em até {max_workers} threads...")

    processed_bytes  = 0
    start            = time.time()
    last_update      = start
    bar_len          = 40
    last_remaining   = 0.0
    last_eta         = None

    q = Queue()

    def _worker(path: str, counts: dict):
        termos_no_arquivo = [t for t in counts if t in mapa]
        substituicoes     = 0
        erro              = None
        try:
            linhas = abrir_arquivo_com_encodings(path)
            if linhas is None:
                raise ValueError("Não foi possível abrir o arquivo")

            novas_linhas = []
            for linha in linhas:
                nova_linha = linha
                for termo in termos_no_arquivo:
                    substituto = mapa[termo]
                    if sensivel:
                        if termo.lower() in nova_linha.lower():
                            nova_linha = re.sub(re.escape(termo), substituto, nova_linha, flags=re.IGNORECASE)
                            substituicoes += 1
                    else:
                        pat = r'\b' + re.escape(termo) + r'\b'
                        nova, n = re.subn(pat, substituto, nova_linha, flags=re.IGNORECASE)
                        if n:
                            nova_linha = nova
                            substituicoes += n
                novas_linhas.append(nova_linha)

            with open(path, "w", encoding="utf-8") as f:
                f.writelines(novas_linhas)

        except Exception as e:
            erro = str(e)

        try:
            sz = os.path.getsize(path)
        except OSError:
            sz = 0
        q.put((path, substituicoes, sz, erro))

    manager = ThreadManager(tipo='io', max_cap=max_workers)
    [manager.submit(_worker, path, counts) for path, counts in alvos]

    arquivos_alterados  = 0
    total_substituicoes = 0
    erros               = []

    while manager.active_count() > 0:
        now = time.time()
        if now - last_update >= update_interval:
            while not q.empty():
                path, subs, sz, erro = q.get_nowait()
                if erro:
                    erros.append((path, erro))
                else:
                    arquivos_alterados  += 1
                    total_substituicoes += subs
                processed_bytes += sz

            elapsed = now - start
            if processed_bytes > 0:
                avg            = processed_bytes / elapsed
                last_remaining = (total_bytes - processed_bytes) / avg if avg else 0
                last_eta       = datetime.now() + timedelta(seconds=last_remaining)

            frac   = processed_bytes / total_bytes if total_bytes else 0
            filled = int(bar_len * frac)
            bar    = '=' * filled + '-' * (bar_len - filled)
            eta    = last_eta.strftime('%H:%M:%S') if last_eta else '--:--:--'

            print(
                f"\r[{bar}] {frac:.1%}  "
                f"Elapsed: {elapsed:.1f}s  "
                f"Remaining: {last_remaining:.1f}s  "
                f"ETA: {eta}",
                end=''
            )
            last_update = now
        time.sleep(0.01)

    manager.shutdown()
    while not q.empty():
        path, subs, sz, erro = q.get_nowait()
        if erro:
            erros.append((path, erro))
        else:
            arquivos_alterados  += 1
            total_substituicoes += subs
        processed_bytes += sz

    total_elapsed = time.time() - start
    end_clock     = datetime.now().strftime('%H:%M:%S')
    print(
        f"\r[{'=' * bar_len}] 100.0%  "
        f"Elapsed: {total_elapsed:.1f}s  "
        f"Remaining: 0.0s  "
        f"ETA: {end_clock}"
    )

    print(f"\nAlterados: {arquivos_alterados} arquivo(s), {total_substituicoes} substituição(ões) no total.")

    if erros:
        print(f"\n\033[33m{len(erros)} arquivo(s) com erro:\033[0m")
        for path, msg in erros:
            print(f"  \033[31m✗\033[0m {path}: {msg}")

def _formatar_resultado(
    resultados: List[Tuple[str, dict]],
    exibir: int,
    linhas_por_arquivo: dict = None,  # necessário para exibir=1
) -> str:
    """
    Formata os resultados conforme o modo de exibição.
    - 0: raw (lista simples)
    - 1: por arquivo, com linhas onde o termo aparece
    - 2: por arquivo, ordenado por total de ocorrências
    - 3: agrupado por termo, arquivos ordenados por frequência
    """
    linhas = []

    if exibir == 0:
        for path, counts in resultados:
            total = sum(counts.values())
            linhas.append(f"{path} — {total} ocorrência(s): {dict(counts)}")

    elif exibir == 1:
        for path, counts in resultados:
            total = sum(counts.values())
            linhas.append(f"\n{'='*80}")
            linhas.append(f"Arquivo: {path}  ({total} ocorrência(s))")
            linhas.append('='*80)
            arquivo_linhas = (linhas_por_arquivo or {}).get(path, {})
            for term, ocorrencias in counts.items():
                linhas.append(f"\n  Termo: '{term}'  ({ocorrencias}x)")
                for n, linha in arquivo_linhas.get(term, []):
                    linhas.append(f"    L{n:>5}: {linha}")

    elif exibir == 2:
        for path, counts in resultados:
            total = sum(counts.values())
            linhas.append(f"{path} — {total} ocorrência(s)")
            for term, count in sorted(counts.items(), key=lambda x: x[1], reverse=True):
                linhas.append(f"  '{term}': {count}x")

    elif exibir == 3:
        # reagrupa por termo
        por_termo: dict = defaultdict(list)
        for path, counts in resultados:
            for term, count in counts.items():
                por_termo[term].append((path, count))
        # ordena termos por total de ocorrências
        por_termo_sorted = sorted(
            por_termo.items(),
            key=lambda x: sum(c for _, c in x[1]),
            reverse=True
        )
        for term, arquivos in por_termo_sorted:
            total_term = sum(c for _, c in arquivos)
            linhas.append(f"\n{'='*80}")
            linhas.append(f"Termo: '{term}'  ({total_term} ocorrência(s) em {len(arquivos)} arquivo(s))")
            linhas.append('='*80)
            for path, count in sorted(arquivos, key=lambda x: x[1], reverse=True):
                linhas.append(f"  {count:>5}x  {path}")

    return "\n".join(linhas)

def _salvar_resultado(
    resultados: List[Tuple[str, dict]],
    exibir: int,
    linhas_por_arquivo: dict,
    base_dir: str,
) -> None:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nome      = f"busca_{timestamp}.txt"
    destino   = os.path.join(base_dir, nome)

    conteudo = []

    # sempre salva o raw (opção 0)
    conteudo.append("=" * 80)
    conteudo.append("RESULTADO RAW (opção 0)")
    conteudo.append("=" * 80)
    conteudo.append(_formatar_resultado(resultados, exibir=0))

    # salva a opção escolhida se diferente de 0
    if exibir != 0:
        conteudo.append("\n" + "=" * 80)
        conteudo.append(f"RESULTADO FORMATADO (opção {exibir})")
        conteudo.append("=" * 80)
        conteudo.append(_formatar_resultado(resultados, exibir=exibir, linhas_por_arquivo=linhas_por_arquivo))

    with open(destino, "w", encoding="utf-8") as f:
        f.write("\n".join(conteudo))

    print(f"\033[32mResultado salvo em: {destino}\033[0m")

def cores():
    print("\033[31mEste texto é vermelho\033[0m")  # Vermelho
    print("\033[33mEste texto é amarelo\033[0m")  # Amarelo
    print("\033[32mEste texto é verde\033[0m")    # Verde
    print("\033[30;47mTexto preto com fundo branco\033[0m")


import os
from datetime import datetime
def achaCaminho(nomeFinal, diretorio_de_onde_pesquisar=os.getcwd(), grauInfo = 1,nivel=0):
    """
    Função que busca recursivamente um arquivo ou diretório dentro de um caminho especificado.

    Parâmetros:
    - nomeFinal: Nome do arquivo ou diretório a ser encontrado.
    - diretorio_de_onde_pesquisar: Caminho base para iniciar a busca (padrão: diretório atual).
    - nivel: Controle do nível de profundidade para formatar a saída.
    - grauInfo: é o controle do grau de informação no terminal do código, indo de 0 a 3 onde 0 não da informação nenhuma (e não polui o terminal) e 3 fala absolutamente tudo o que ele está olhando e fazendo (a ponto de desacelerar o código)
        - 0: Não da informação nenhuma, simplesmente retorna na variavel  sem dar informação.
        - 1: Diz quando termina.
        - 2: Diz os diretórios que está conferindo e o que há acima.
        - 3: Diz os arquivos que está conferindo e o que há acima.

    Retorna:
    - O caminho completo do arquivo/diretório encontrado ou None caso não seja encontrado.
    """
    indent = "  " * nivel  # Adiciona indentação para facilitar a leitura da saída
    if grauInfo >= 2:
        print(f"{indent}\033[93m[+] Pesquisando em: {diretorio_de_onde_pesquisar}\033[0m")

    for dirpath, dirnames, filenames in os.walk(diretorio_de_onde_pesquisar, topdown=True):
        # Verifica se o nome procurado está na lista de arquivos
        if nomeFinal in filenames:
            caminhoInteiro = os.path.join(dirpath, nomeFinal)
            if grauInfo >= 1:
                print(f"{indent}\033[92m\n✔ Arquivo encontrado: {caminhoInteiro}\033[0m")
            return caminhoInteiro

        # Verifica se o nome procurado está na lista de diretórios
        if nomeFinal in dirnames:
            caminhoInteiro = os.path.join(dirpath, nomeFinal)
            if grauInfo >= 1:
                print(f"{indent}\033[94m\n✔ Diretório encontrado: {caminhoInteiro}\033[0m")
            return caminhoInteiro
        
        # Chama a função recursivamente para cada diretório encontrado
        for subdir in dirnames:
            caminho_subdir = os.path.join(dirpath, subdir)
            resultado = achaCaminho(nomeFinal, caminho_subdir,grauInfo ,nivel + 1)
            if resultado:
                return resultado
    if grauInfo >= 3:
        print(f"{indent}\033[91m[-] {nomeFinal} não encontrado em {diretorio_de_onde_pesquisar}\033[0m")
    return None

import sys
import os
import importlib.util

def executar_funcao_externa(caminho_projeto: str, nome_modulo: str = "main", nome_funcao: str = "main"):
    """
    Importa dinamicamente e executa uma função de um módulo externo dado seu caminho absoluto.

    Parâmetros:
    - caminho_projeto (str): Caminho até a pasta que contém o módulo.
    - nome_modulo (str): Nome do arquivo .py (sem o .py). Padrão: 'main'.
    - nome_funcao (str): Nome da função que será chamada. Padrão: 'main'.

    Retorna:
    - Resultado da execução da função, se bem-sucedido.
    """
    if not os.path.isdir(caminho_projeto):
        print(f"❌ Caminho inválido: {caminho_projeto}")
        return

    if caminho_projeto not in sys.path:
        sys.path.insert(0, caminho_projeto)

    try:
        spec = importlib.util.find_spec(nome_modulo)
        if spec is None:
            raise ImportError(f"Módulo '{nome_modulo}' não encontrado em {caminho_projeto}")
        modulo = importlib.import_module(nome_modulo)
        funcao = getattr(modulo, nome_funcao)
        print(f"✅ Executando {nome_funcao}() do módulo {nome_modulo}...")
        return funcao()
    except ImportError as e:
        print(f"❌ Erro de importação: {e}")
    except AttributeError:
        print(f"❌ O módulo '{nome_modulo}' não tem a função '{nome_funcao}'")
    except Exception as e:
        print(f"❌ Erro ao executar a função: {e}")

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

# print(mapeia_diretorio("."))
import time
import sys

def loading_spinner(segundos: int = 0):
    segundos = round(segundos)
    segundos = max(0, segundos)  # Garante que não seja negativo
    tipo = "Decrescente"
    if segundos == 0:
        tipo = "Crescente"
    
    if tipo == "Decrescente":
        spinner = ['|', '/', '-', '\\']
        i = 0

        for s in range(segundos, -1, -1):
            sys.stdout.write(f"\r{s}s {spinner[i % len(spinner)]}")
            sys.stdout.flush()
            time.sleep(1)
            i += 1

        print("\nTempo esgotado!")
    else:
        spinner = ['|', '/', '-', '\\']
        i = 0
        s = 0

        while True:
            sys.stdout.write(f"\r{s}s {spinner[i % len(spinner)]}")
            sys.stdout.flush()
            time.sleep(1)
            i += 1
            s += 1

# Exemplo de uso
if __name__ == "__main__":
    configure_logging()
    logging.info("Começou a execussão")

    # Supondo que a função boolput já esteja definida conforme seu código original.
    # opcoes = ["Maçã", "Banana", "Laranja", "Uva"]
    # print(expoeAlternativas(opcoes, 2))\

    # print(mapeia_diretorio("."))

    # ======================================================================

    # os_termos_procurados=[
    #     'AMSI',
    #     'tipo_conta',
    #     'tipo_conta',
    #     'tipo_conta',
    #     'tipo_conta',
    #     'tipo_conta',
    #     'tipo_conta',
    #     "tipo_conta_fk",
    #     'tipo_conta',
    #     'tipo_conta',
    #     'TipoConta',
    # ]


    # lista = buscar_em_arquivos(
    # termos_procurados=os_termos_procurados,
    # base_dir="C:\Codigos",
    # extensoes=['.py'],
    # max_workers=10,
    # sensivel=False   ,
    # update_interval=0.5,
    # exibir=2,   # ou 0,1, 2, 3 conforme quiser
    # Salva=True  # ou False
    # )

    # Substituicao_dos_termos={
    #     'ansi': 'AMSI',
    #     'tipo_lancamento': 'Tipo_conta',
    # }

#     alterar_em_arquivos(
#     resultados=lista,
#     mapa=Substituicao_dos_termos,
#     sensivel=False,
#     )

    # print(format_dict_str([{"arquivo": caminho, **contagem} for caminho, contagem in lista]))
    # conta = 0
    # for i in lista:
    #     print(f"{conta}- {i}")

    logging.info("Terminou a execussão")
