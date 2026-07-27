# Dívidas Técnicas — evolução do que já roda

Backlog de melhorias sobre o que **já existe em produção**: performance,
arquitetura, testes, deploy/DX e hardening de segurança. Nada aqui entrega
capacidade nova ao usuário final — para features novas, veja
[`demandas-novas.md`](./demandas-novas.md).

A numeração (1.1, 3.x, 4.x, 10) é preservada do antigo `escopo_futuro.md` porque
outros documentos ainda referenciam esses códigos.

---

## 1. Infraestrutura de Testes

### 1.1 Aceleração do pytest com `ThreadManager`

**Contexto**

A suite de testes atual roda sequencialmente. Quando executada via `railway run` (banco remoto), cada query tem ~100–150ms de latência de rede, resultando em 8–12 minutos para as 244+ asserções. Localmente, com banco na memória, leva menos de 30 segundos.

O gargalo é I/O-bound (espera de resposta do banco) — exatamente o perfil onde `ThreadManager(tipo='io')` traz ganho real: enquanto uma thread aguarda resposta SQL, outras avançam suas próprias queries.

**Abordagem proposta**

1. **Agrupar os módulos de teste por independência de estado:** módulos que não compartilham fixtures com escrita (`test_tipo_conta`, `test_contato`, `test_endereco`, `test_lancamento`, etc.) podem rodar em paralelo sem conflito.

2. **Criar um runner customizado** (`tests/runner_paralelo.py`) que:
   - Descobre os módulos de teste com `pytest.collect`
   - Classifica cada módulo como `paralelo` (sem dependência de estado compartilhado) ou `sequencial` (fixtures que escrevem dados base usados por outros módulos)
   - Usa `ThreadManager(tipo='io', max_cap=8)` para submeter os grupos paralelos
   - Aguarda com `manager.join_all()` e então roda os sequenciais em ordem

3. **Isolamento de sessão por thread:** cada thread instancia seu próprio `TestClient(app)` e `SessionLocal()` — não compartilhar client nem db entre threads.

4. **Snapshot de banco por thread:** o `db_snapshot` atual é `scope="session"` global. Na versão paralela, cada thread registra seu snapshot antes/depois e reporta divergências individuais ao finalizar.

**Ganho esperado**

Com 8 threads paralelas e latência de 100ms por query:
- Sequencial: ~10 min
- Paralelo (grupos independentes): ~2–3 min

**Limitações conhecidas**

- Testes que dependem de `usuario_base`, `clifor_base` e `tipo_lancamento_base` precisam continuar sequenciais entre si (esses fixtures têm dependência em cadeia).
- `test_auth.py` e `test_permissoes.py` modificam estado do usuário admin — devem rodar em grupo isolado, após os demais.
- O `db_snapshot` global precisa ser desativado no modo paralelo e substituído pelo snapshot por thread.

---

## 3. Melhorias Técnicas

### 3.2 Separação de banco de teste
- Criar um banco `railway_test` separado no Railway (ou SQLite em memória para CI local).
- Evitar que a suite de testes polua o banco de produção com dados temporários.

### 3.3 CI/CD automatizado
- GitHub Actions acionado em push para `main`:
  - Roda pytest localmente (banco SQLite em memória)
  - Se passar, aciona `railway up` automaticamente
  - Notifica resultado via email ou Slack

### 3.8 Corrigir N+1 query na listagem de lançamentos

> Identificado revisando um vídeo curto sobre erros comuns de performance em apps "vibe-coded" (2026-07-09) e conferido contra o código real do projeto — não é hipotético, o bug existe hoje.

**Problema:** `GET /lancamento/` ([`routes/lancamento.py`](../../backend/routes/lancamento.py), listagem principal — a mais usada, alimenta a tela de lançamentos) faz `.join(ClienteFornecedor, ...)` só para filtrar, mas não dá `joinedload(Lancamento.cliente_fornecedor)`. O `model_validator` de `LancamentoResponse` ([`schemas/lancamento.py`](../../backend/schemas/lancamento.py)) acessa `values.cliente_fornecedor.nome`/`.cpf_cnpj` na serialização — sem eager load, isso dispara uma query extra por linha retornada (N+1 clássico). O mesmo bug está em `GET /lancamento/por-usuario/{id}`.

**Prova de que é acidental, não intencional:** `GET /lancamento/por-clifor/{id}` faz o `joinedload(Lancamento.cliente_fornecedor)` certo — só não foi replicado nos outros dois endpoints.

**Sugestão de correção:**
- Adicionar `joinedload(Lancamento.cliente_fornecedor)` nas options de `listar_lancamentos` e `listar_lancamentos_por_usuario`, igual já é feito em `listar_lancamentos_por_clifor`.
- Fix pontual, sem mudança de contrato de API — pode entrar isolado, sem esperar os itens abaixo.
- Vale considerar um teste que conte queries emitidas (ex.: listener de evento do SQLAlchemy) para pegar regressão desse tipo automaticamente, já que passou despercebido numa revisão manual.

### 3.9 Paginação em `GET /lancamento/`

> Mesma origem do 3.8 — vídeo sobre erros comuns de performance, conferido contra o código.

**Problema:** mesmo com todos os filtros de data/valor/status disponíveis, o endpoint sempre termina em `query.all()` — sem `limit`/`offset`, sem teto. Conforme a tabela de lançamentos cresce, cada carregamento da tela busca a tabela inteira.

**Relação com o plano 5.1:** a proposta de paginação (skip/limit + header `X-Total-Count`, teto de 1000) já está desenhada em [`multi-associacao-jwt-fundacao.md`](./multi-associacao-jwt-fundacao.md) como parte da plataforma multi-associação. Este item é a versão restrita — só `/lancamento/`, sem esperar aquele projeto maior — mas convém adotar o mesmo padrão de contrato para não ter que migrar duas vezes.

**Decisões ainda em aberto (backlog, não fechadas):**
- Tamanho de página default e máximo.
- Se o total vem num header (`X-Total-Count`) ou custa uma segunda query — impacto de custo a avaliar.
- Se o frontend usa paginação numerada ou scroll infinito na tabela de lançamentos.
- Se estende para `usuario`/`cliente_fornecedor` também ou fica só em lançamentos (a listagem que mais cresce).
- Depende do 3.8 estar corrigido primeiro — paginar por cima do N+1 só limita o dano, não resolve a causa.

### 3.10 Skeleton loaders no frontend

> Mesma origem do 3.8/3.9 — vídeo sobre erros comuns de performance.

**Problema:** hoje o frontend só tem um loading global (`services/loadingContext.jsx`) — um spinner/indicador único para qualquer requisição em andamento. Não há skeleton (placeholder de conteúdo) em nenhuma tela; durante o carregamento de listas o usuário vê tela vazia ou spinner central até a resposta completa chegar.

**Decisões ainda em aberto (backlog, não fechadas):**
- Prioridade de tela: lista de lançamentos primeiro (a mais pesada e a que ganha mais com 3.8+3.9), depois usuários/clifor.
- Componente genérico reutilizável (`<Skeleton />` parametrizado por linhas/colunas) vs. um skeleton específico por tela.
- Manter o spinner global só para transição entre rotas, reservando skeleton para dentro do conteúdo já montado (mistura os dois padrões, não substitui um pelo outro).
- Menor prioridade que 3.8/3.9 — é polimento de UX percebida, não corrige uma query real rodando a mais.

### 3.11 Cache de sessão no frontend — carregar uma vez, recarregar sob demanda

> 📋 **Plano técnico detalhado e fechado (pronto para execução):** [`cache-sessao-frontend.md`](./cache-sessao-frontend.md)

Mesma origem do 3.8/3.9/3.10 — vídeo sobre erros comuns de performance (ponto "sem cache, nem no browser"). Diferente dos três anteriores, este item já tem todas as decisões de design fechadas e não é backlog aberto — é um plano pronto para ser puxado direto para implementação.

**Resumo:** hoje toda tela de listagem (lançamentos, clientes/fornecedores, usuários, tipos de conta, dashboard) busca os dados no backend toda vez que é montada, mesmo revisitada segundos depois sem nada ter mudado. O plano introduz um cache de sessão em memória (`services/cache.js`, sem `sessionStorage`): a primeira visita a uma tela busca do banco normalmente; visitas seguintes na mesma sessão reaproveitam o cache; um botão "Recarregar" em cada tela força busca nova; mutações (criar/editar/excluir) invalidam o cache do recurso automaticamente; logout limpa tudo.

> ⚠️ **Premissa desatualizada desde o commit `0bbdcf7`:** lançamentos, dashboard e
> clientes/fornecedores **não buscam mais ao montar** — carregam só no botão "Pesquisar".
> Ao puxar este item, seguir o contrato do [3.13](#313-persistência-dos-resultados-de-busca-na-sessão-regressão-do-pesquisar):
> sem auto-load na primeira visita; persistir o resultado da última busca até nova busca
> ou logout. As demais telas (usuários, tipos de conta) seguem buscando ao montar.

### 3.12 N+1 (pior que o 3.8) e falta de paginação em `GET /cliente_fornecedor/`

> Reportado pelo Pedro (2026-07-09): "tela de Clientes/Fornecedores demorando tanto para carregar". Diagnóstico feito na hora — causa raiz já identificada, fix ainda não aplicado (fica para quando este item for puxado).

**Causa raiz:** `listar_clifors` ([`routes/cliente_fornecedor.py:29-60`](../../backend/routes/cliente_fornecedor.py)) roda `db.query(ClienteFornecedor)...all()` sem eager load nenhum. `ClienteFornecedorResponse` ([`schemas/cliente_fornecedor.py:90-91`](../../backend/schemas/cliente_fornecedor.py)) inclui `enderecos` e `contatos` — duas relações lazy-loaded (`models/cliente_fornecedor.py:30-31`). Sem `joinedload`/`selectinload`, cada clifor da lista dispara **2 queries extras** (uma para endereços, uma para contatos) na hora de serializar. É o mesmo padrão de bug do [3.8](#38-corrigir-n1-query-na-listagem-de-lançamentos), só que aqui são 2 relações em vez de 1 — até **2N+1 queries** numa única resposta.

**Agravante:** `endereco.id_clifor_fk` e `contato.id_clifor_fk` ([`models/endereco.py:10`](../../backend/models/endereco.py), [`models/contato.py:9`](../../backend/models/contato.py)) não têm `index=True`. Postgres não indexa FK automaticamente — cada uma dessas N queries extras por lazy-load pode estar rodando sequential scan em vez de usar índice, o que piora conforme as tabelas crescem.

**Também sem paginação:** mesmo padrão do [3.9](#39-paginação-em-get-lancamento) — `.all()` sem `limit`/`offset`.

**Sugestão de correção (quando for puxado):**
1. Adicionar `joinedload(ClienteFornecedor.enderecos)` e `joinedload(ClienteFornecedor.contatos)` (ou `selectinload` — com duas coleções 1:N por linha, `selectinload` costuma escalar melhor que `joinedload`, que faz produto cartesiano no SQL; vale medir os dois antes de decidir).
2. Adicionar `index=True` nas duas colunas de FK (migração simples, sem quebra de compatibilidade).
3. Paginação segue o mesmo racional do 3.9 — pode ser resolvido junto, no mesmo padrão de contrato (skip/limit + `X-Total-Count`), para não implementar dois formatos de paginação diferentes no backend.
4. Medir antes/depois com `EXPLAIN ANALYZE` ou contagem de queries emitidas (mesma sugestão de teste do 3.8) para confirmar o ganho.

### 3.13 Persistência dos resultados de busca na sessão (regressão do "Pesquisar")

> Reportado pelo Pedro (2026-07-26), logo após subir o comportamento "telas não
> carregam ao abrir; botão Pesquisar" (commit `0bbdcf7`). É o outro lado da mesma
> moeda do [3.11](#311-cache-de-sessão-no-frontend--carregar-uma-vez-recarregar-sob-demanda).

**Comportamento atual (esquisito):** lançamentos, dashboard e clientes/fornecedores
guardam o resultado da busca em **estado do componente** (`useState`). Ao navegar para
outra tela e voltar, o componente desmonta/remonta, o estado zera e a tela volta vazia
("Clique em Pesquisar") — os resultados da última busca somem, mesmo sem nada ter
mudado. O usuário é obrigado a pesquisar de novo a cada ida-e-volta.

**Comportamento desejado:** a tela só busca quando o usuário clica em "Pesquisar", e o
resultado da última busca (com os filtros que a geraram) **permanece carregado** ao sair
e voltar à tela. Só é descartado quando:
- o usuário pesquisa de novo naquela tela (sobrescreve), ou
- faz logout/login.

**Implementação sugerida:**
- Mover o par `{ filtros aplicados, resultado }` de cada tela do `useState` local para
  um store de sessão **em memória, fora do componente** (o `services/cache.js` do 3.11
  ou um contexto React). Ao montar, se houver cache da tela, reidratar sem refazer a
  requisição.
- "Pesquisar" sobrescreve o cache daquela tela; logout limpa tudo (mesmo gancho do
  `localStorage.clear()` já existente no `auth.logout`).
- Não usar `sessionStorage`/`localStorage` para o resultado (dado sensível + volume) —
  memória da aba basta, alinhado ao 3.11.

**Relação com 3.11:** o 3.11 assume "primeira visita busca do banco normalmente"; isso
mudou quando o lazy-load + Pesquisar subiu. Ao puxar o 3.11, adotar **este** contrato
(sem auto-load; persistir por busca até nova busca ou logout) em vez do texto original.

---

## 4. Deploy e Operação

### 4.1 Variável `APP_ENV` obrigatória no checklist de deploy
- Garantir que a skill `/deploy` bloqueie se `APP_ENV != production` no Railway.
- Atualmente verificada mas não bloqueante se esquecida.

### 4.2 Bootstrap como comando Railway
- Adicionar `railway run python utils/bootstrap.py` como etapa explícita do fluxo de deploy na skill `/deploy` (Fase 3, pós-healthcheck).
- Tornar idempotente: já é, mas documentar que pode ser rodado a qualquer momento sem risco.

### 4.3 URL canônica do frontend
- Configurar domínio customizado no Vercel (ex: `amsi.com.br`) em vez de `amsi-frontend.vercel.app`.
- Atualizar `FRONTEND_URL` no Railway após configurar o domínio.

---

## 10. Segurança — endurecimento pendente

> A auditoria de **2026-06-11** teve seus itens **críticos e altos corrigidos e
> deployados** (escalonamento de privilégio, segredo JWT em produção, senha em
> plaintext no e-mail). Os itens médios de hardening já resolvidos também saíram:
> CORS restrito à origem e escape de HTML no `/logs/ui` (commit `433d0ff`) e rate
> limiting no login.
>
> O laudo completo — com localização no código, PoC e correção de cada item — está
> em [`../12_auditoria_seguranca.md`](../12_auditoria_seguranca.md), **local
> (gitignored)** por descrever falhas exploráveis de um sistema em produção. Não
> detalhar vetores aqui (arquivo versionado).

**Ainda pendente (a confirmar contra o código antes de fechar):**
- **Alinhamento do escopo de perfil `Consulta` nas rotas de endereço e contato** —
  garantir que a verificação de permissão nessas rotas seja consistente com o
  resto da aplicação. Ver detalhe no doc 12 e em [`../09_seguranca.md`](../09_seguranca.md).
