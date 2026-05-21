# AMSI Project — Guia Técnico para Estudantes

Bem-vindo ao projeto AMSI. Esta pasta contém um guia técnico completo pensado para quem está tendo o primeiro contato com o código.

> **Antes de começar:** se ainda não rodou o projeto na sua máquina, siga primeiro o [SETUP.md](../SETUP.md) na raiz do repositório. Ele explica como instalar dependências, configurar o banco e subir backend e frontend.

Leia os arquivos **na ordem abaixo**. Cada um assume que você leu os anteriores.

---

## Mapa de navegação

| # | Arquivo | O que você aprende |
|---|---|---|
| 1 | [01_visao_geral.md](./01_visao_geral.md) | O que é o sistema, quem usa, como as partes se conectam |
| 2 | [02_stack.md](./02_stack.md) | Por que cada tecnologia foi escolhida |
| 3 | [03_backend.md](./03_backend.md) | Como o backend é organizado e como uma requisição é processada |
| 4 | [04_autenticacao.md](./04_autenticacao.md) | Como login, JWT, logout e permissões funcionam |
| 5 | [05_frontend.md](./05_frontend.md) | Como o React é organizado, roteamento, estado e chamadas de API |
| 6 | [06_fluxo_completo.md](./06_fluxo_completo.md) | Rastrear um clique do browser até o banco e de volta |
| 7 | [07_glossario.md](./07_glossario.md) | Definições rápidas dos termos técnicos usados no projeto |
| 8 | [08_padroes_nao_obvios.md](./08_padroes_nao_obvios.md) | Padrões que causam confusão no primeiro contato: loadingBus, storage event, FormData, str+Enum |
| 9 | [09_seguranca.md](./09_seguranca.md) | Como o sistema previne SQL Injection, XSS, CSRF, bcrypt, JWT híbrido, CORS e auditoria |
| 10 | [10_decisoes_arquiteturais.md](./10_decisoes_arquiteturais.md) | Por que FastAPI, PostgreSQL, JWT, 3 camadas, normalização 3NF, ACID, React, fetch nativo |
| 11 | [11_perguntas_de_banca.md](./11_perguntas_de_banca.md) | Q&A: perguntas prováveis de professores com respostas baseadas no código real |

---

## Como usar este guia

- Cada arquivo pode ser aberto diretamente no VS Code ou no GitHub
- Referências a arquivos do projeto usam caminhos relativos à raiz: `backend/routes/lancamento.py`
- Trechos de código são do projeto real — você pode abrir o arquivo e localizar a linha indicada

---

## Critério de conclusão

Você terminou o guia quando conseguir responder, **só com os arquivos do projeto**, as 14 perguntas listadas ao final de [06_fluxo_completo.md](./06_fluxo_completo.md).

Se estiver preparando uma defesa de TCC, leia também os arquivos 09, 10 e 11 — e tente responder cada pergunta do 11 sem consultar antes de verificar a resposta.
