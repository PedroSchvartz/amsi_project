# Diálogo Desenvolvedor-Professor — TCC AMSI
## 6 conversas sobre as decisões mais questionáveis do sistema

> **Por que este documento existe:** o NotebookLM gera Audio Overview como dois hosts debatendo. Fontes em formato de diálogo produzem outputs de áudio dramaticamente mais ricos do que documentação técnica. Este documento também é a melhor forma de praticar defesa sob pressão — o PROF não aceita resposta superficial.
>
> **DEV** = desenvolvedor defendendo a decisão | **PROF** = professor questionando, empurrando, não aceitando resposta genérica.

---

## DIÁLOGO 1 — `verify_exp: False`: Por que desabilitar a verificação de expiração do JWT?

**PROF:** Olha aqui na linha 40 de `dependencies.py`:
```python
options={"verify_exp": False}
```
Vocês estão decodificando o JWT *sem verificar a expiração*. Isso não é um bug de segurança? O JWT tem um campo `exp` exatamente para isso.

**DEV:** É contra-intuitivo, concordo. Mas tem uma razão específica. O sistema não usa o campo `exp` do token JWT para controlar a expiração — usa o campo `exp` da tabela `token_ativo` no banco de dados.

**PROF:** Por que duplicar? Se o JWT já carrega a expiração, por que guardar no banco também?

**DEV:** Porque o JWT puro não tem logout. Se eu deixasse o `exp` do token controlar a sessão, clicar em "Sair" não faria nada — o token continuaria válido por mais 60 minutos. A tabela `token_ativo` é o que permite logout real: no logout, deletamos o registro. A próxima requisição com aquele token busca o `jti` na tabela, não encontra, e recebe 401 imediatamente.

**PROF:** Mas então por que verificar a assinatura JWT se vocês estão verificando o banco de qualquer forma?

**DEV:** São duas coisas diferentes. A assinatura verifica *integridade* — garante que o token não foi falsificado. Se eu gerar um token com `{ "sub": "42", "perfil": "Administrador" }` sem a `SECRET_KEY`, a verificação da assinatura vai rejeitar. O banco verifica *revogação* — garante que o token foi emitido por nós e não foi invalidado. Os dois são necessários: sem verificação de assinatura, qualquer um pode criar um token falso; sem verificação no banco, logout é teatro.

**PROF:** E se o banco cair no meio de uma requisição autenticada?

**DEV:** A query na `token_ativo` falha, a exceção não é capturada pelo handler de token, e o usuário recebe 401. Ninguém consegue fazer operações enquanto o banco está fora. Isso é o comportamento correto do ponto de vista de segurança — em um sistema financeiro, é melhor recusar acesso do que permitir operações sem verificação.

**PROF:** Entendido. Uma última: por que não remover o campo `exp` do payload do token, já que vocês ignoram ele?

**DEV:** Compatibilidade e boas práticas. Qualquer biblioteca JWT vai se comportar de forma esperada com o token. Se algum dia quisermos adicionar um cliente mobile ou uma integração com terceiros que valida tokens diretamente, o `exp` ainda estará lá. E manter o campo no payload não tem custo — é só um número.

---

## DIÁLOGO 2 — Testes: 214 testes passando significa sistema correto?

**PROF:** O trabalho menciona 214 testes automatizados passando. Mas isso significa que o sistema está correto?

**DEV:** Significa que os 214 comportamentos que foram especificados como testes estão funcionando. Não é garantia de ausência de bugs — é garantia de ausência dos bugs que os testes cobrem.

**PROF:** Mas quem garantiu que vocês testaram as coisas certas?

**DEV:** Essa é uma pergunta genuinamente difícil. A abordagem foi: cada endpoint tem pelo menos um teste de caminho feliz e um de cenário de erro. Os cenários de erro cobriram os riscos mais altos: tentar criar um lançamento sem permissão, tentar fazer login com senha errada, tentar deletar um usuário com lançamentos ativos. Não é cobertura exaustiva — é cobertura orientada a risco.

**PROF:** Vocês mediram a cobertura de linhas de código?

**DEV:** Não formalmente — `pytest-cov` não foi configurado. Isso é uma limitação real. Para saber que 90% das linhas são executadas por algum teste, precisaríamos rodar `pytest --cov`. Adicionaríamos isso em uma versão de produção.

**PROF:** E a cobertura de frontend? Componentes React foram testados?

**DEV:** Não. Os 214 testes são todos de backend. O frontend não tem testes automatizados — regressões são detectadas manualmente. Em um projeto de maior escopo, adicionaríamos Vitest para testes de componentes e Playwright para testes end-to-end. É uma das limitações que documentamos explicitamente.

**PROF:** Então como vocês garantem que o frontend não quebrou quando mudaram o backend?

**DEV:** Não garantimos automaticamente — garantimos manualmente ao testar o sistema no browser após cada mudança. Para um time de três pessoas em um TCC, isso foi suficiente. Para um sistema em produção com mais desenvolvedores, não seria suficiente.

**PROF:** Essa é uma resposta honesta. Aprecie isso.

---

## DIÁLOGO 3 — Arquitetura: Por que 3 schemas por entidade?

**PROF:** Para a entidade `Lancamento`, vocês têm `LancamentoCreate`, `LancamentoEditAdmin`, `LancamentoResponse` e mais alguns. Isso não é over-engineering para um TCC? Um único schema não seria mais simples?

**DEV:** A complexidade dos schemas existe para resolver um problema real de segurança e consistência, não por gosto de abstração. O problema concreto: um Operador que cria um lançamento não pode definir `data_pagamento`. Se houvesse um único schema com todos os campos, o Operador poderia enviar `data_pagamento` no body e burlar o fluxo de efetivação.

**PROF:** Mas vocês poderiam validar isso na rota, em vez de criar um schema separado.

**DEV:** Poderíamos, e seria mais simples no início. O problema é que validação na rota é imperativa — você escreve `if "data_pagamento" in body: raise 422`. Com 50 endpoints e múltiplos campos protegidos, esse código se repete e diverge. Schemas são declarativos — `LancamentoCreate` simplesmente não tem o campo `data_pagamento`. Não é possível enviá-lo porque o schema não o reconhece.

**PROF:** E `LancamentoResponse`? Por que separar o schema de saída?

**DEV:** Porque a resposta precisa de campos calculados que não estão no banco. O campo `nome_clifor` na resposta vem do relacionamento SQLAlchemy — `lancamento.cliente_fornecedor.nome` — não de uma coluna em `lancamento`. Se usássemos o model direto como resposta, seria necessário serialização manual de cada campo calculado. O `LancamentoResponse` com `@model_validator` faz isso de forma declarativa e testável.

**PROF:** E se o desenvolvedor se esquece de adicionar um novo campo nos três schemas?

**DEV:** Boa pergunta. Isso é um risco real — não há validação automática de que todos os schemas estão em sincronia. Em um sistema maior, adicionaríamos testes que verificam que os campos do model estão presentes nos schemas relevantes. No AMSI, a cobertura de testes por endpoint serve como rede de segurança indireta: se um campo novo no `LancamentoCreate` não for adicionado, o teste de criação falha.

---

## DIÁLOGO 4 — Negócio: Por que não usar uma planilha Excel mais avançada?

**PROF:** Olhando para a real necessidade da associação — uma pequena organização comunitária, algumas dezenas de associados, transações mensais previsíveis — por que um sistema web completo? Uma planilha Excel com macros não resolveria mais simplesmente?

**DEV:** Excel resolve dois dos quatro problemas que identificamos. O cálculo de inadimplência com fórmulas e o dashboard financeiro com gráficos — isso Excel faz bem. Os outros dois não resolve.

**PROF:** Quais dois?

**DEV:** Acesso multi-usuário e auditoria. Excel em rede compartilhada tem conflitos de edição — dois usuários editando simultaneamente corrompem o arquivo. E Excel não registra quem mudou qual célula, quando e por quê. Para uma organização com troca periódica de diretoria, o histórico auditável "quem criou este lançamento" é um requisito real, não apenas um desejo técnico.

**PROF:** E o controle de acesso por perfil?

**DEV:** Excel não tem isso nativamente. Qualquer pessoa com o arquivo tem acesso total. O sistema AMSI tem três perfis: Consulta (só lê, não vê CPF), Operador (cria e efetiva), Administrador (acesso total). Isso é difícil de replicar em Excel sem macros complexas que qualquer usuário com conhecimento básico consegue contornar.

**PROF:** Mas o custo de desenvolvimento de um sistema web é muito maior do que uma planilha avançada.

**DEV:** O custo de desenvolvimento inicial é maior, sim. O custo de manutenção a longo prazo depende de quem mantém. Para o TCC, o projeto entrega um MVP funcional. A questão de quem mantém o sistema depois que a equipe de desenvolvimento se forma é uma limitação real que reconhecemos.

**PROF:** E se a associação não tiver alguém técnico para manter?

**DEV:** É um risco real e documentado em `contexto_negocio.md`. A resposta honesta: o sistema foi construído com documentação extensa e código legível para facilitar a manutenção por qualquer desenvolvedor, não apenas pelos autores. Mas sem alguém técnico disponível, uma planilha Excel é de fato mais sustentável operacionalmente. A decisão de usar um sistema web foi baseada na premissa de que a associação terá acesso a suporte técnico.

---

## DIÁLOGO 5 — Limitações: Rate limiting ausente é grave?

**PROF:** O sistema não tem rate limiting no endpoint `/auth/token`. Um atacante poderia fazer 10.000 tentativas de senha por segundo. Isso não é uma vulnerabilidade crítica?

**DEV:** É uma limitação conhecida e documentada. Em produção, adicionaríamos rate limiting com `slowapi`. A mitigação que existe hoje é o bcrypt com cost factor 12, que limita as tentativas a aproximadamente 4.000 por segundo no servidor — porque cada verificação de senha leva ~250ms de processamento.

**PROF:** Mas 4.000 tentativas por segundo ainda é muito. Uma senha de 8 caracteres pode ter no máximo 95^8 = 6 trilhões de combinações, mas um ataque de dicionário com 10 milhões de senhas comuns terminaria em menos de uma hora.

**DEV:** Correto. Sem rate limiting, um ataque de dicionário contra senhas fracas é viável. O bcrypt dificulta mas não impede. A segunda linha de defesa é política de senha — o sistema requer senhas de pelo menos 8 caracteres com critérios de complexidade. Mas você está certo: em produção, rate limiting é necessário.

**PROF:** Então por que não implementou agora?

**DEV:** Priorização de escopo do TCC. Os recursos de desenvolvimento foram alocados para funcionalidades de negócio e cobertura de testes. Rate limiting foi classificado como melhoria de produção, não como requisito do MVP. Reconhecemos que essa é uma decisão de risco — e a documentamos explicitamente como ponto de melhoria.

**PROF:** Se vocês fossem colocar em produção amanhã, o que adicionariam primeiro?

**DEV:** Rate limiting em `/auth/token` com `slowapi`, limitando a 10 tentativas por minuto por IP. É uma adição de menos de 20 linhas de código. Depois, Alembic para migrations de banco — `create_all()` não é suficiente para produção com dados reais.

---

## DIÁLOGO 6 — Banco: O flag `inadimplente` viola 3NF?

**PROF:** O campo `inadimplente` em `clientefornecedor` é derivado dos dados em `lancamento` — você pode calcular se alguém é inadimplente consultando os lançamentos. Ter essa informação também em `clientefornecedor` não viola a Terceira Forma Normal?

**DEV:** Tecnicamente, sim — é uma dependência transitiva. `inadimplente` pode ser derivado de `lancamento`, portanto depende indiretamente da tabela `lancamento`, não só da PK de `clientefornecedor`. É uma desnormalização intencional.

**PROF:** Intencional como assim? Vocês sabiam que estavam violando 3NF?

**DEV:** Sabíamos. E a razão é performance. Se `inadimplente` não existisse como campo, toda query que carrega a lista de clifors precisaria de um subquery: para cada clifor, verificar se tem lançamentos de Crédito vencidos e não pagos. Com 1.000 clifors, seriam 1.000 subqueries na mesma requisição.

**PROF:** Mas vocês têm dezenas de associados, não milhares.

**DEV:** Hoje, sim. O design leva em conta que a regra de inadimplência é verificada a cada carregamento da lista de clifors, e que a lista de clifors aparece em vários contextos do sistema. A desnormalização troca consistência garantida pelo banco por performance. A consistência é mantida por código: `atualizar_inadimplente()` é chamada em toda operação que pode mudar o status.

**PROF:** E se alguém fizer uma query direta no banco sem passar pelo sistema e modificar um lançamento?

**DEV:** O flag ficaria inconsistente até que alguma operação do sistema chamasse `atualizar_inadimplente()`. Essa é a fragilidade da desnormalização: você abdica da garantia do banco pela performance da aplicação. Em sistemas financeiros de missão crítica, um trigger no banco seria mais robusto. Para o MVP da AMSI, a abordagem por código foi considerada suficiente.

**PROF:** Vale mencionar o padrão que isso implementa?

**DEV:** Sim — é um cache calculado. O campo `inadimplente` é um cache do resultado de uma query complexa. Como qualquer cache, pode ficar stale se o mecanismo de invalidação falhar. O mecanismo de invalidação aqui é o código, não o banco. É um trade-off explícito, não um descuido.
