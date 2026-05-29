# Simulado de Banca Difícil — TCC AMSI
## Perguntas além do óbvio: as que a banca realmente faz

> **Como usar:** tente responder cada pergunta sem olhar a resposta. Cronômetro de 2 minutos por pergunta. O objetivo é articular uma resposta coerente, não decorar. Depois compare com a resposta sugerida e veja o que você deixou de mencionar.
>
> **Como usar com NotebookLM:** sobe este arquivo junto com `podcast_amsi_fonte_completa.md`. Use o chat do NotebookLM para fazer cada pergunta e veja se a IA concorda com sua resposta ou identifica lacunas.

---

## CATEGORIA 1 — PERGUNTAS DE NEGÓCIO (as que mais pegam)

---

**P: Por que vocês não usaram uma planilha Excel mais avançada? O que o sistema entrega que o Excel não entrega?**

R: Excel avançado resolve parcialmente dois dos quatro problemas: com fórmulas e macros, é possível calcular inadimplência automaticamente e criar dashboards. Mas não resolve: (1) acesso simultâneo multi-usuário — Excel em rede compartilhada tem conflitos de edição; (2) auditoria de quem alterou o quê e quando — Excel não rastreia autoria de mudança por padrão; (3) controle de acesso por perfil — qualquer pessoa com acesso ao arquivo vê tudo; (4) comprovantes anexados ao lançamento — seria necessário gerenciar arquivos separados. O sistema web resolve todos os quatro de forma integrada, com acesso pelo navegador sem instalar nada.

---

**P: O sistema foi validado com usuários reais da associação? Eles conseguiram usar?**

R: A validação com usuários reais é um ponto de limitação do projeto no escopo do TCC. O desenvolvimento foi orientado pelos requisitos levantados junto à associação, mas o sistema não passou por testes formais de usabilidade com os associados. Em um ciclo de desenvolvimento completo, faríamos testes de aceitação do usuário (UAT): sessões onde um tesoureiro real tentaria executar as tarefas principais enquanto observamos dificuldades. A interface usa Bootstrap e convenções padrão de sistemas web para minimizar a curva de aprendizado, mas esse ponto é um trabalho futuro reconhecido.

---

**P: Qual é o custo real para a associação manter esse sistema funcionando?**

R: O custo tem três componentes: (1) infraestrutura — o backend pode rodar em serviços como Railway ou Render a partir de gratuito/baixo custo; o frontend pode ser hospedado no Vercel gratuitamente; o banco PostgreSQL também tem planos gratuitos (Supabase, Neon). Para o volume de dados da associação, o custo mensal de infraestrutura seria próximo de zero inicialmente, escalando para alguns dólares com crescimento. (2) Manutenção — o sistema precisa de atualizações de segurança das dependências periodicamente. Sem um desenvolvedor interno, esse é um custo real de serviço. (3) Suporte — treinamento para novos membros da diretoria. O custo humano de suporte é provavelmente o maior.

---

**P: E se a internet cair na associação? O sistema fica inacessível?**

R: Sim, o sistema web requer conectividade. É uma limitação inerente a sistemas web e a contrapartida do benefício de acesso multi-dispositivo e multi-local. Para uso offline, seria necessário uma versão desktop com banco local — uma arquitetura completamente diferente. O Excel resolve o problema de offline, mas cria os outros quatro problemas mencionados. A decisão foi consciente: a associação tem acesso à internet e o benefício do acesso remoto superou a limitação offline.

---

**P: A LGPD se aplica a esse sistema? O que vocês fizeram para cumpri-la?**

R: Sim, a LGPD se aplica — o sistema armazena CPF/CNPJ, que são dados pessoais. O que o sistema faz que alinha com a LGPD: (1) dados pessoais são acessados apenas por usuários autorizados com autenticação JWT; (2) CPF/CNPJ é mascarado por padrão na interface — Consulta nunca vê o valor; (3) log de sessões permite rastrear quem acessou o quê. O que falta para conformidade plena: (1) CPF/CNPJ poderia ser criptografado em repouso no banco (atualmente em texto); (2) não há mecanismo formal de consentimento de uso de dados; (3) não há endpoint de "esquecimento" (direito ao apagamento) que exclua todos os dados de um indivíduo respeitando integridade referencial. São limitações reconhecidas para um sistema em produção real.

---

## CATEGORIA 2 — PERGUNTAS DE ENGENHARIA AVANÇADA

---

**P: Vocês medem o tempo de resposta das APIs? O sistema seria lento com 500 usuários simultâneos?**

R: Não há medição formal de latência no projeto atual — não temos benchmarks de carga. A análise qualitativa é: o gargalo seria o banco de dados, não o FastAPI. Com 500 usuários simultâneos, o pool de conexões do SQLAlchemy (padrão de 5 conexões) seria o primeiro ponto de estrangulamento. A solução seria PgBouncer como pooler de conexões, multiplicando as conexões efetivas sem sobrecarregar o PostgreSQL. O FastAPI é assíncrono e lida bem com alta concorrência de I/O. Para 500 usuários simultâneos com operações mistas, estimamos que o sistema funcionaria com latência aceitável — mas só saberíamos com certeza após testes de carga com ferramentas como Locust.

---

**P: O `autocommit=False` garante atomicidade completa no caso de `criar lançamento + atualizar inadimplência`?**

R: Não completamente — e isso está documentado como um ponto de inconsistência potencial no projeto. O fluxo atual faz `db.commit()` após criar o lançamento, e depois chama `atualizar_inadimplente()`. Se `atualizar_inadimplente()` falhar após o commit do lançamento, o lançamento persiste mas o flag de inadimplência não é atualizado — inconsistência real. A solução correta seria envolver ambas as operações em uma única transação, com um único `db.commit()` ao final. Na prática, `atualizar_inadimplente()` é uma query simples e raramente falha — mas o design não é à prova de falhas. Em produção com requisitos de consistência forte, isso precisaria ser corrigido.

---

**P: Por que usar `token_ativo` em vez de simplesmente usar tokens de curta duração (ex: 5 minutos)?**

R: Tokens de 5 minutos resolveriam o problema de revogação — o token expira tão rápido que logout "funciona" na prática. O problema é a experiência do usuário: a cada 5 minutos, o usuário seria desconectado no meio de uma operação. O projeto usa tokens de 60 minutos com sessão deslizante (a cada requisição autenticada, a expiração é renovada). A tabela `token_ativo` permite revogar imediatamente qualquer token sem sacrificar a usabilidade. O trade-off é consultar o banco a cada requisição — uma leitura indexada por `jti` que é extremamente rápida. A alternativa de tokens curtos + refresh tokens é igualmente válida e evitaria a consulta ao banco, mas adiciona complexidade ao fluxo de renovação no frontend.

---

**P: Como o sistema garante que dois operadores não editem o mesmo lançamento simultaneamente criando conflito?**

R: O sistema não implementa lock otimista ou pessimista explicitamente — é um ponto de limitação real. Na prática, o risco é baixo porque a associação tem poucos operadores e os lançamentos raramente são editados simultaneamente. A solução correta seria lock otimista com campo `versao` ou `updated_at`: o cliente lê o lançamento com `updated_at = T1`; ao salvar, o backend verifica se `updated_at` ainda é `T1`; se outro usuário atualizou (agora é `T2`), o backend retorna 409 Conflict em vez de sobrescrever. Isso exigiria lógica adicional no frontend para tratar o conflito. Para o escopo e volume do projeto atual, a probabilidade de conflito simultâneo é negligenciável.

---

**P: Por que não usar WebSockets para atualizações em tempo real no dashboard?**

R: WebSockets seriam apropriados se múltiplos operadores precisassem ver atualizações uns dos outros em tempo real — o dashboard de um atualizando instantaneamente na tela de outro. Para o caso de uso da associação, esse nível de tempo real não é um requisito. O dashboard atualiza ao recarregar a página ou navegar até ela. WebSockets adicionariam complexidade de gerenciamento de conexões persistentes, autenticação da conexão WebSocket (diferente da autenticação REST) e estado compartilhado no servidor. REST com polling explícito (recarregar o dashboard) é suficiente para o volume e caso de uso atual.

---

## CATEGORIA 3 — PERGUNTAS SOBRE O PROCESSO DE DESENVOLVIMENTO

---

**P: Quais foram os maiores erros que vocês cometeram durante o desenvolvimento?**

R: Três erros concretos que aprendemos ao longo do projeto:

(1) **Começar sem testes.** As primeiras versões do sistema foram desenvolvidas sem testes automatizados. Quando adicionamos os 214 testes, encontramos bugs que já existiam há versões — incluindo casos de permissão que deveriam retornar 403 mas retornavam 200. Ter começado com TDD teria evitado esses regressos.

(2) **Múltiplos schemas por entidade foi subestimado.** Inicialmente tentamos usar um único schema por entidade. Rapidamente ficou claro que criar e editar um lançamento precisam de campos diferentes — o que forçou a refatoração para os schemas `Create`, `EditAdmin` e `Response`. Planejar isso desde o início teria economizado retrabalho.

(3) **`create_all` em vez de Alembic.** Durante o desenvolvimento, recriamos o banco várias vezes ao mudar o schema. Em um projeto real com dados reais, isso seria catastrófico. A decisão de não usar Alembic foi de conveniência, mas é a limitação mais séria para uma transição para produção.

---

**P: Se tivessem que começar do zero com o que sabem hoje, o que fariam diferente?**

R: Quatro coisas concretas:

(1) **Alembic desde o primeiro commit.** Setup inicial é pequeno; benefício ao longo do projeto é enorme.

(2) **Testes desde a primeira rota.** Não esperar ter "algo funcionando" para começar a testar.

(3) **Separação de schemas planejada antes de escrever o primeiro endpoint.** Com modelos de dados bem pensados, a estrutura das camadas fica mais limpa.

(4) **Validação de usabilidade mais cedo.** Mostrar o sistema para alguém da associação em um estágio inicial teria revelado requisitos de UX que só descobrimos no final.

---

**P: Como foi a divisão de trabalho entre os três integrantes da equipe?**

R: [Esta pergunta varia por equipe — prepare sua resposta honesta sobre como o trabalho foi dividido. Pontos importantes para mencionar: quem ficou responsável por qual parte do código, como vocês coordenaram mudanças, se usaram branches separadas, como resolveram conflitos de visão técnica.]

---

## CATEGORIA 4 — PERGUNTAS "PEGADINHA" TÉCNICAS

---

**P: Vocês disseram que o React protege contra XSS. Mas e se o backend devolver HTML no JSON e o frontend renderizar com `dangerouslySetInnerHTML`?**

R: Excelente ponto. O projeto não usa `dangerouslySetInnerHTML` em nenhum componente — foi verificado explicitamente. A proteção do React contra XSS é condicional a isso: qualquer uso de `dangerouslySetInnerHTML` reintroduz a vulnerabilidade. A segunda linha de defesa é o backend: o Pydantic não sanitiza HTML nos campos de texto por padrão — se alguém salvar `<script>...</script>` no nome de um clifor, o backend aceita. A proteção vem exclusivamente do React não usar `innerHTML`. Em produção com requisitos de segurança mais rigorosos, adicionaríamos sanitização de HTML no backend para campos de texto livre.

---

**P: O JWT está no `localStorage`. Isso não é vulnerável a XSS?**

R: Sim — é a crítica padrão ao `localStorage` para tokens. Se houver uma vulnerabilidade XSS no frontend (um script injetado por um terceiro), esse script pode ler `localStorage.getItem("token")` e roubar o token. A alternativa é armazenar o token em cookie `HttpOnly` — que JavaScript não consegue ler. O problema de `HttpOnly` é que reintroduz CSRF, exigindo proteção adicional. Para o contexto do projeto — aplicação interna, sem JavaScript de terceiros, React protegendo XSS — `localStorage` é aceitável. Em uma aplicação pública com scripts de tracking ou widgets de terceiros embutidos, `HttpOnly` cookie com proteção CSRF seria o correto.

---

**P: O hash bcrypt está correto mas e o timing attack? Como o `checkpw` protege contra isso?**

R: `bcrypt.checkpw()` da biblioteca `passlib/bcrypt` usa comparação em tempo constante — o tempo de execução não varia dependendo de quantos caracteres do hash conferem. Sem isso, um atacante poderia medir microssegundos de diferença na resposta do servidor para inferir caracteres do hash corretos progressivamente. A comparação em tempo constante elimina esse canal lateral. O ponto está documentado em `backend/utils/auth_utils.py`.

---

**P: O sistema tem `autoflush=False` no SQLAlchemy. Qual a diferença em relação a `autoflush=True`?**

R: Com `autoflush=True` (padrão do SQLAlchemy), o SQLAlchemy envia automaticamente as mudanças pendentes (`db.add()`) para o banco antes de executar qualquer query de leitura — para que a query leia dados consistentes com o estado da sessão. O problema é que isso pode causar commits parciais implícitos em momentos inesperados. Com `autoflush=False`, nada vai ao banco sem um `db.flush()` ou `db.commit()` explícito — o controle é total. O código do projeto é explícito sobre quando persiste dados, o que alinha com o princípio de `autocommit=False`.

---

**P: O `joinedload` sempre é melhor que o lazy loading?**

R: Não — depende do caso de uso. `joinedload` faz um JOIN na query inicial: uma query que busca 100 lançamentos com `joinedload(Lancamento.cliente_fornecedor)` retorna 100 linhas com dados duplicados do join. Se a maioria dos lançamentos tem o mesmo clifor, você transmite dados repetidos desnecessariamente. Lazy loading pode ser mais eficiente se você só precisa do clifor de 2 dos 100 lançamentos — faz 2 queries extras em vez de um JOIN grande. `joinedload` é ideal quando você sabe que vai acessar o relacionamento para todos os registros. No caso do AMSI, a lista de lançamentos sempre exibe o nome do clifor para cada linha — `joinedload` é a escolha correta.

---

## CATEGORIA 5 — PERGUNTAS FILOSÓFICAS / DE ENGENHARIA DE SOFTWARE

---

**P: Vocês usaram TDD (Test-Driven Development)? Por que ou por que não?**

R: Não usamos TDD de forma sistemática. As primeiras funcionalidades foram desenvolvidas sem testes, que foram adicionados posteriormente. Em retrospecto, a ausência de TDD resultou em descobrir bugs regressivos mais tarde do que o necessário. TDD teria três benefícios concretos neste projeto: (1) forçaria a pensar no contrato de cada rota antes de implementar; (2) os testes de permissão teriam revelado furos de segurança mais cedo; (3) o `db_snapshot` e a estrutura de fixtures teriam sido pensados desde o início. A barreira foi a curva de aprendizado inicial com pytest e TestClient — que já tínhamos investido no meio do projeto.

---

**P: O sistema é monolítico ou baseado em microsserviços? Qual seria a vantagem de microsserviços aqui?**

R: O sistema é um monólito — backend e banco em um único processo e repositório. Para o escopo atual, isso é a escolha correta: menor complexidade operacional, desenvolvimento mais rápido, sem latência de rede entre serviços. Microsserviços fariam sentido se partes do sistema tivessem requisitos de escala muito diferentes — por exemplo, se o módulo de relatórios precisasse de muito mais processamento que o módulo de lançamentos. Para uma associação de moradores com dezenas de usuários, o overhead de orquestração de microsserviços (service discovery, load balancing, comunicação entre serviços) superaria qualquer benefício. O monólito bem estruturado em camadas é mais fácil de manter para uma equipe pequena.

---

**P: Como vocês garantem que o código do frontend e do backend estão em sincronia? O que acontece se o backend muda um campo e o frontend não é atualizado?**

R: Não há contrato formal de API versionado — essa é uma limitação real. O FastAPI gera automaticamente um schema OpenAPI em `/docs` que descreve todos os endpoints e seus tipos. Se o backend mudar um campo, o OpenAPI reflete a mudança. O frontend usa fetch manual — não há geração automática de tipos a partir do OpenAPI. Em uma evolução do projeto, usaríamos `openapi-typescript-codegen` para gerar automaticamente tipos TypeScript a partir do schema OpenAPI, e os erros de tipo no frontend seriam capturados em tempo de compilação (com TypeScript). Atualmente, a sincronização depende de comunicação entre os desenvolvedores — que, para uma equipe de três pessoas, foi gerenciável.

---

**P: Por que não usaram TypeScript no frontend?**

R: A decisão foi pedagógica e de velocidade. A equipe tinha mais experiência com JavaScript puro, e introduzir TypeScript teria adicionado uma curva de aprendizado no momento em que o foco era entregar funcionalidades. TypeScript traria benefícios reais: autocompletar mais preciso nos objetos de resposta da API, captura em tempo de compilação de tipos errados (passar string onde number é esperado), e contratos explícitos entre componentes. Em uma versão de produção ou com mais tempo de desenvolvimento, TypeScript seria a escolha. O projeto atual compensa com `PropTypes` implícito e convenções de nomenclatura claras.

---

## CATEGORIA 6 — PERGUNTAS SOBRE O CÓDIGO QUE O PROFESSOR PODE TER LIDO

> Esta categoria assume que o professor abriu os arquivos do projeto antes da defesa. São as perguntas mais difíceis — específicas demais para responder sem ter entendido o código.

---

**P: Na linha 40 de `backend/auth/dependencies.py`, o código usa `options={"verify_exp": False}`. Por que desabilitar a verificação de expiração do JWT?**

R: É intencional e tem razão específica. A expiração não é controlada pelo claim `exp` do token JWT — é controlada pelo campo `exp` da tabela `token_ativo` no banco de dados. Ao verificar cada requisição, o sistema busca o `jti` (ID único do token) na tabela e verifica se `token_ativo.exp < datetime.utcnow()`. Isso permite logout real: no logout, o registro é deletado e o token é imediatamente inválido, mesmo que seu `exp` ainda não tenha vencido. Se usássemos o `exp` do JWT, logout seria teatro — o token continuaria válido por até 60 minutos após o usuário clicar em "Sair". A assinatura JWT continua sendo verificada (integridade); apenas o controle de expiração foi movido para o banco (revogação).

---

**P: Em `backend/utils/inadimplencia.py`, o código usa `.first() is not None` em vez de `.count() > 0`. Qual a diferença e por que importa?**

R: `.first()` gera `SELECT ... LIMIT 1` — o banco para na primeira ocorrência. `.count()` gera `SELECT COUNT(*)` — o banco percorre todos os registros que satisfazem o filtro. Para determinar inadimplência, basta saber se existe *ao menos um* lançamento vencido e não pago. Se o clifor tem 50 cobranças vencidas, `.count()` percorre todas 50; `.first()` para na primeira. É uma otimização O(1) vs O(n) para o pior caso. Para dezenas de lançamentos, a diferença é imperceptível. Para centenas, relevante.

---

**P: Na mesma função, o `db.commit()` está dentro de um `if clifor.inadimplente != tem_vencido`. Por que não sempre atualizar?**

R: `atualizar_inadimplente()` é chamada a cada criação, efetivação e exclusão de lançamento. Se o operador efetiva 10 lançamentos de um clifor em sequência, a função é chamada 10 vezes. Nas 9 primeiras, o flag não muda (clifor ainda inadimplente). Na 10ª, muda. Sem o `if`, seriam 10 `db.commit()` com 9 deles escrevendo o mesmo valor — churn desnecessário no WAL (Write-Ahead Log) do PostgreSQL. Com o `if`: 1 commit. É o padrão "write-on-change": só gravar quando o valor efetivamente mudou.

---

**P: A função `anexarComprovante` em `api.js` não usa `authHeaders()` e não define `Content-Type`. Por que essa inconsistência?**

R: Não é inconsistência — é necessário. Quando o body é um objeto `FormData` (upload de arquivo), o browser precisa gerar automaticamente o header `Content-Type: multipart/form-data; boundary=XXXX`, onde `boundary` é um identificador único gerado pelo browser para separar os campos do formulário no body. Se o developer definir manualmente `Content-Type: application/json`, o backend tenta parsear o body como JSON e falha — o arquivo binário não é JSON válido. Todas as outras funções usam `authHeaders()` porque enviam JSON. `anexarComprovante` envia `FormData` binário — o `Content-Type` tem que vir do browser, não do developer.

---

**P: Em `conftest.py`, a função `contar_tabelas` tem um dicionário `QUERIES_ESPECIAIS` com uma query diferente para `usuario`. Por que não usar `COUNT(*)` padrão para todas as tabelas?**

R: A tabela `usuario` usa soft-delete. "Deletar" um usuário não remove a linha do banco — seta `exclusao = NOW()`. Sem a query especial, o db_snapshot usaria `SELECT COUNT(*) FROM usuario` — que contaria usuários deletados com soft-delete como se ainda existissem. Um teste que cria e "deleta" um usuário deixaria a contagem maior do que antes, e o snapshot falharia com falso-positivo. A query `SELECT COUNT(*) FROM usuario WHERE exclusao IS NULL` conta apenas usuários ativos — a mesma semântica que o código da aplicação usa. O teste precisa entender a lógica de negócio da tabela que está monitorando.

---

**P: O que acontece se o banco de dados PostgreSQL ficar fora do ar enquanto um usuário autenticado tenta fazer uma operação?**

R: Duas situações:
1. Durante a validação do token (`get_current_user`): a query `db.query(TokenAtivo).filter(...)` falha com exceção de conexão. O FastAPI captura como erro interno e retorna 500, ou a exceção propaga e retorna 401 dependendo de como foi tratada. O usuário não consegue completar a operação.
2. Durante a operação em si: a query de negócio falha com exceção. `get_db()` tem `finally: db.close()` — a sessão é fechada, o `db.commit()` nunca é chamado, nenhuma mudança persiste.

Em ambos os casos, o sistema é seguro por falha: sem banco = sem operação. Para um sistema financeiro, bloquear o acesso é preferível a permitir operações sem verificação de autenticação.

---

**P: Em `backend/main.py`, existe a função `gerar_doc_ia()` que cria um arquivo `openapi_ai.yaml`. O FastAPI já gera documentação em `/openapi.json`. Por que criar um segundo arquivo de documentação?**

R: O `/openapi.json` padrão usa ponteiros `$ref` para evitar repetição: `{ "schema": { "$ref": "#/components/schemas/LancamentoCreate" } }`. Para visualização humana no Swagger UI, os `$ref` são expandidos automaticamente. Para uma ferramenta de IA (ChatGPT, Claude), `$ref` são ponteiros que precisam ser navegados manualmente — a IA recebe um JSON referenciando um schema que está em outro lugar no mesmo documento. `gerar_doc_ia()` resolve todos os `$ref` recursivamente e produz um YAML flat onde cada endpoint já contém os campos expandidos com tipos, obrigatoriedade e enums. É documentação-como-código: roda antes do `uvicorn.run()` a cada start do servidor, então nunca fica desatualizada. Revela que o desenvolvimento foi feito com IA como colaborador ativo — o arquivo é um artefato do processo de desenvolvimento, não apenas do produto.

---

## COMO USAR ESTAS PERGUNTAS NO NOTEBOOKLM

Após subir este arquivo e o `podcast_amsi_fonte_completa.md` no NotebookLM:

1. **Modo estudo:** selecione uma pergunta, tente responder em voz alta por 2 minutos, depois pergunte ao NotebookLM: *"A minha resposta sobre [tema] está completa? O que eu deixei de mencionar?"*

2. **Modo simulação:** peça ao NotebookLM: *"Faça o papel de um professor rigoroso de engenharia de software e me questione sobre a decisão de usar JWT com tabela token_ativo."*

3. **Modo exploração:** peça ao NotebookLM: *"Quais outras perguntas difíceis um professor poderia fazer sobre a arquitetura de autenticação que não estão neste documento?"*
