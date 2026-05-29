# Mapa de Conexões entre Decisões — TCC AMSI
## Como cada escolha técnica influencia e é influenciada pelas outras

> **Por que este documento existe:** na defesa de TCC, as perguntas mais difíceis são as encadeadas — "Mas se você usa X, como isso afeta Y?". Este documento mostra explicitamente as dependências entre decisões para que você possa navegar essas conexões com fluidez.
>
> **Como usar com NotebookLM:** sobe junto com `tematico_arquitetura.md`. Pergunte: "Como a decisão de usar JWT influenciou a decisão de criar a tabela token_ativo?" — o NotebookLM vai cruzar os dois documentos.

---

## O MAPA COMPLETO

```
PostgreSQL (DECIMAL, ENUM, ACID)
├── DECIMAL(15,2) ──────────────────► precisão monetária exata
├── ENUM nativo ────────────────────► SQLAlchemy mapeia diretamente
│                                        │
│                                        ▼
│                              NaturezaEnum, PerfilEnum em Python
│                              (type safety, sem strings soltas)
│
└── ACID + autocommit=False ─────────► db.commit() explícito obrigatório
                                            │
                                            ▼
                              Atomicidade: criar lançamento + atualizar
                              inadimplência deveria ser uma transação

SQLAlchemy ORM
├── Queries parametrizadas ─────────► elimina SQL Injection
├── ORM models ─────────────────────► Pydantic schemas separados por operação
│                                        │
│                                        ▼
│                              LancamentoCreate (sem data_pagamento)
│                              LancamentoEditAdmin (tudo opcional)
│                              LancamentoResponse (campos calculados)
│
└── joinedload ─────────────────────► resolve N+1 Problem
                                      1 query com JOIN vs 101 separadas

FastAPI
├── Pydantic embutido ──────────────► validação automática de todos os campos
│                                        │
│                                        ├──► 422 para tipos errados (antes do banco)
│                                        └──► schemas tipados = sem dicionários soltos
│
├── Depends() ──────────────────────► injeção de dependência nativa
│                                        │
│                                        ├──► get_db() → sessão do banco por requisição
│                                        └──► exige_admin() → guarda de permissão
│
└── OpenAPI automático ─────────────► /docs sempre atualizado com o código real

JWT
├── Stateless ──────────────────────► sem estado no servidor = múltiplos servidores OK
│
├── Sem logout real ────────────────► problema do JWT puro
│                                        │
│                                        ▼
│                              tabela token_ativo com jti
│                              → logout deleta jti → 401 imediato
│
└── Payload legível (Base64) ──────► dados não sensíveis no token
                                      (id e perfil OK; senha NUNCA)

RBAC (3 perfis)
├── Backend (exige_admin, etc.) ────► proteção real = 403 mesmo via Postman
│
└── Frontend (PrivateRoute) ────────► conveniência = esconde botões/rotas
                                      mas NÃO é a proteção real

React
├── textContent (não innerHTML) ────► elimina XSS automaticamente
│
├── localStorage para JWT ──────────► vulnerável a XSS (tradeoff reconhecido)
│   (em vez de cookie HttpOnly)          │
│                                        └──► mitigado: React não usa innerHTML
│                                              sem scripts de terceiros no sistema
│
└── storage event (logout sync) ────► logout em uma aba desconecta as outras

CSS Custom Properties
└── variáveis em :root ─────────────► tema verde e corporativo com 1 atributo
                                      nenhuma cor hardcoded nos componentes

Testes (pytest + TestClient)
├── Banco real ─────────────────────► detecta bugs de ENUM, FK, precisão decimal
│   (não mockado)                     que mock não detectaria
│
├── db_snapshot ────────────────────► força isolamento entre testes
│                                     sem teste frágil dependente de ordem
│
└── TestClient ─────────────────────► HTTP real sem servidor
                                      middleware, dependências, banco: tudo executa
```

---

## CADEIAS DE DEPENDÊNCIA CRÍTICAS

### Cadeia 1: Por que existem 3 schemas para Lançamento?

```
SQLAlchemy define o model Lancamento com todos os campos
    │
    ▼
Diferentes operações precisam de diferentes campos:
    │   Criar: sem data_pagamento (Operador não pode definir)
    │   Efetivar: só data_pagamento, valor_pago, multa, juros
    │   Editar Admin: todos os campos, todos opcionais
    │   Resposta: inclui nome_clifor calculado (do relacionamento)
    │
    ▼
Um único schema exporia campos que não devem ser editáveis por certos perfis
    │
    ▼
Pydantic: schemas separados garantem contrato estrito por operação
    │
    ▼
Resultado: Operador não consegue definir data_pagamento ao criar
           mesmo que tente enviar o campo — não está no LancamentoCreate
```

### Cadeia 2: Por que o banco tem a tabela `token_ativo`?

```
JWT é stateless (payload no token, sem estado no servidor)
    │ vantagem: múltiplos servidores sem Redis
    │
    ▼
JWT puro não tem logout: token válido até expirar
    │ problema: token roubado ou esquecido continua funcionando
    │
    ▼
Solução: tabela token_ativo com jti (UUID por token)
    │ cada login gera novo jti, salvo no banco
    │
    ▼
Logout deleta o jti do banco
    │ próxima requisição com aquele token: jti não encontrado = 401
    │
    ▼
Resultado: JWT stateless para leitura de perfil
           banco para revogação real
           melhor dos dois mundos
```

### Cadeia 3: Por que o `db_snapshot` é necessário se os testes são escritos com cuidado?

```
Cada teste cria dados no banco (clifor, tipo_conta, lançamento)
    │
    ▼
Teardown manual: deletar filho antes do pai (respeita FK)
    │ problema: um erro no teste (exception) pode pular o teardown
    │
    ▼
Dados ficam no banco
    │
    ▼
Próximo teste assume banco limpo, mas encontra dados do anterior
    │
    ▼
Resultado: teste passa segunda-feira, falha sexta
           (flaky test — frágil, dependente de ordem)
    │
    ▼
db_snapshot detecta: "tabela lancamento tem 1 registro a mais"
    │ indica qual teste não limpou
    │
    ▼
Teste corrigido antes de virar problema em produção
```

### Cadeia 4: Por que não usar Redux para estado global?

```
Estado global necessário no AMSI:
    1. Dados do usuário logado (id, nome, perfil)
    2. Notificações toast (mensagens de sucesso/erro)
    │
    ▼
Redux: actions + reducers + store + selectors
    │ 4 novos conceitos para gerenciar 2 pedaços de estado simples
    │
    ▼
createContext + useContext: 1 conceito, já incluído no React
    │ AuthContext para usuário
    │ ToastContext para notificações
    │
    ▼
Resultado: estado global funcional sem dependência adicional
           sem 4 camadas de indireção para atualizar um nome de usuário
```

---

## COMO CADA DECISÃO AFETA ESCALABILIDADE

```
JWT híbrido
├── Leitura do payload → sem query ao banco (stateless)
└── Verificação de revogação → 1 query indexada por jti (rápida)

PostgreSQL
├── Conexões: pooler (PgBouncer em produção) para escalar
└── Queries: joinedload reduz drasticamente o número de queries

FastAPI
├── Async nativo: aguenta muitas requisições simultâneas de I/O
└── Stateless: adicionar instâncias = escala horizontal direta

React SPA
├── Build estático: pode ser servido por CDN (sem servidor)
└── Sem SSR: frontend escala separado do backend
```

---

## DECISÕES INDEPENDENTES (que não se influenciam)

Nem todas as decisões estão conectadas. Essas são genuinamente independentes:

- **CSS Custom Properties** e **PostgreSQL**: escolhas completamente separadas. Mudar o banco não afeta o sistema de temas e vice-versa.

- **React Router** e **bcrypt**: o roteamento do frontend não tem relação com o algoritmo de hash de senhas.

- **Recharts** (biblioteca de gráficos) e **SQLAlchemy**: como os dados são buscados do banco não afeta como são exibidos em gráficos.

Saber distinguir decisões conectadas de decisões independentes demonstra maturidade de engenharia.

---

## TENSÕES ENTRE DECISÕES (trade-offs reais)

### Tensão 1: Segurança vs Usabilidade no JWT

**JWT no localStorage:** fácil de implementar, mas vulnerável a XSS (script pode ler).
**Cookie HttpOnly:** script não pode ler (mais seguro), mas reintroduz CSRF.

O AMSI escolheu localStorage + React (proteção XSS via textContent). A tensão foi reconhecida e documentada como limitação.

### Tensão 2: Normalização vs Performance

**3NF:** sem repetição de dados, banco consistente.
**Trade-off:** JOINs necessários para recuperar dados completos.

O AMSI resolve com `joinedload` (JOIN eficiente) e `@model_validator` (calcula `nome_clifor` no schema). A tensão existe — a resolução é explícita.

### Tensão 3: JWT Stateless vs Logout Real

**JWT puro stateless:** sem estado no servidor, escala horizontalmente sem Redis.
**Logout real:** exige estado (tabela `token_ativo` com jti).

O AMSI aceita o custo mínimo de estado (apenas o jti, não o payload inteiro) para ter logout real. A tensão foi o motivo de criar o modelo híbrido.

### Tensão 4: Testes de integração vs Velocidade

**Banco real:** detecta bugs reais, mas mais lento de executar.
**Banco mockado:** mais rápido, mas pode mascarar problemas de integração.

O AMSI escolheu banco real — 214 testes levam mais para executar do que unitários mockados, mas a confiança é maior. A tensão foi consciente.

---

## COMO USAR NA DEFESA

Quando a banca fizer uma pergunta encadeada como **"Se vocês mudassem X, o que mais precisaria mudar?"**, use este mapa:

**Exemplo:** "Se vocês trocassem JWT por sessions, o que mudaria?"
- `token_ativo` deixaria de ser necessária (sessions já têm logout nativo)
- Redis seria necessário para compartilhar state entre servidores
- `Authorization: Bearer` no header viraria cookie de sessão
- A proteção CSRF precisaria ser adicionada (cookies são enviados automaticamente)
- `getUserFromToken()` no frontend precisaria de um endpoint separado para buscar dados do usuário

**A resposta demonstra** que você entende JWT não como uma tecnologia isolada mas como parte de uma rede de decisões.
