# Narrativa "Sem o Quê?" — TCC AMSI
## O que quebraria (ou ficaria perigoso) se cada decisão técnica não tivesse sido tomada

> **Por que este documento existe:** a banca frequentemente pergunta não "como funciona X" mas "por que X era necessário?". Este documento responde com consequências concretas — não com "seria mais inseguro" mas com "aqui está exatamente o que um atacante conseguiria fazer" ou "aqui está o bug que apareceria".
>
> **Como usar com NotebookLM:** sobe este arquivo junto com `tematico_arquitetura.md` e `tematico_seguranca.md`. Pergunte: "O que aconteceria se o AMSI não usasse bcrypt?" — compare a resposta com o que você sabe.

---

## SEM BCRYPT (usando MD5 ou SHA-256)

**O que quebraria:**

Uma GPU RTX 4090 faz 164 bilhões de hashes MD5 por segundo. Se o banco de dados fosse comprometido (vazamento de senha hashed), um atacante com essa GPU testaria um dicionário de 10 bilhões de senhas comuns em menos de 1 minuto.

O tesoureiro usa a senha `Amsi@2024` em vários sistemas (como a maioria das pessoas). O atacante decifra o hash em segundos, obtém a senha, entra no sistema com perfil Administrador, e tem acesso a todos os dados financeiros e CPFs da associação.

Com bcrypt cost 12 (~4.000 hashes/segundo), o mesmo dicionário de 10 bilhões de senhas levaria mais de 28 dias — tornando o ataque de força bruta economicamente inviável.

**A diferença não é teórica.** Bancos de dados vazar é a normalidade: Adobe, LinkedIn, RockYou2024 — todos tiveram senhas MD5 e SHA-256 crackeadas em massa após vazamento.

---

## SEM TABELA `token_ativo` (JWT puro)

**O que quebraria:**

O presidente da associação usa o sistema em um computador público. Clica em "Sair". O token JWT fica registrado no histórico do browser ou em uma extensão maliciosa. Com JWT puro, esse token é válido por até 60 minutos após o logout.

Alguém com o token consegue fazer login na API diretamente (curl, Postman) e executar qualquer operação permitida ao perfil do usuário — criar lançamentos, marcar pagamentos, visualizar CPFs — por até 60 minutos depois que o usuário "saiu".

Com `token_ativo`: no momento do logout, o `jti` é deletado da tabela. A próxima requisição com aquele token recebe 401 — imediatamente, não depois de 60 minutos.

**Logout sem `token_ativo` é teatro.** O usuário vê a tela de login, mas o token ainda funciona.

---

## SEM MÚLTIPLOS SCHEMAS (um schema único para lançamento)

**O que quebraria:**

Com um único schema `LancamentoUnico` para criação e edição, o campo `data_pagamento` estaria disponível no formulário de criação.

Um Operador esperto percebe que ao criar um lançamento pode enviar:
```json
{ "valor": 500, "data_pagamento": "2026-01-01", ... }
```

O backend aceita. O lançamento nasce com `data_pagamento` preenchido — equivalente a já estar "efetivado" sem passar pelo fluxo de efetivação. O operador cria um lançamento de R$500 de "Condomínio" e marca como pago no mesmo ato, sem nenhuma validação adicional, sem comprovante, sem registro de quem efetivou.

Com `LancamentoCreate` sem `data_pagamento`: o campo simplesmente não existe no schema. Se o Operador enviar `data_pagamento` no body, o Pydantic ignora (campo extra) ou rejeita. A criação e a efetivação são operações separadas, com validações separadas.

---

## SEM SQLAlchemy ORM (SQL puro com concatenação de strings)

**O que quebraria:**

Um campo de busca na lista de lançamentos permite filtrar por nome do clifor. Com SQL puro concatenado:
```python
query = f"SELECT * FROM lancamento WHERE nome_clifor LIKE '%{filtro}%'"
```

Um usuário digita no campo de busca: `%' UNION SELECT senha_hash, email, null, null FROM usuario--`

A query se torna:
```sql
SELECT * FROM lancamento WHERE nome_clifor LIKE '%%' 
UNION SELECT senha_hash, email, null, null FROM usuario--'
```

O sistema retorna os hashes de senha e emails de todos os usuários na mesma tela de listagem de lançamentos.

Com SQLAlchemy: `db.query(Lancamento).filter(Lancamento.nome_clifor.like(f"%{filtro}%"))` gera query parametrizada. O `filtro` vai como parâmetro separado — o banco trata como dado, não como SQL. A string maliciosa é buscada literalmente no nome do clifor e não encontra nada.

---

## SEM PYDANTIC SCHEMAS (validação manual por dicionário)

**O que quebraria:**

Sem Pydantic, cada rota precisaria validar manualmente:
```python
if "valor" not in body: raise HTTPException(400, "valor obrigatório")
if not isinstance(body["valor"], (int, float)): raise HTTPException(400, "valor deve ser número")
if body["valor"] <= 0: raise HTTPException(400, "valor positivo")
if "natureza_lancamento" not in body: raise HTTPException(400, "natureza obrigatória")
if body["natureza_lancamento"] not in ["Credito", "Debito"]: raise HTTPException(400, "natureza inválida")
# ... 10 campos = 30+ linhas de validação por rota
```

Esse código existe para cada rota. São 50+ rotas. Quem garante que a validação de `data_vencimento` em `criar_lancamento` é a mesma que em `editar_lancamento`? Ninguém — é código duplicado, inconsistente, e facilmente esquecido.

Com Pydantic, `LancamentoCreate(BaseModel)` define as regras uma vez. Qualquer rota que declare `dados: LancamentoCreate` tem a validação aplicada automaticamente e consistentemente.

O segundo risco sem Pydantic: campos extras passam sem validação. Um atacante envia `{"valor": 100, "id_usuario_fk": 1, "perfil": "Administrador"}` — o backend pegaria esses campos do dicionário e potencialmente os salvaria no banco.

---

## SEM `db_snapshot` NOS TESTES

**O que quebraria:**

Sem `db_snapshot`, cada teste que cria dados e esquece de apagar deixa o banco de testes "sujo". Na primeira execução, tudo passa. Na segunda execução:

1. `test_criar_clifor_duplicado` cria um clifor com CPF "123.456.789-00" e verifica que um segundo com o mesmo CPF retorna 409. Passa ✓
2. Na segunda execução, já existe o clifor do teste anterior (não foi apagado). A criação do "primeiro" clifor já retorna 409 — o teste falha ✗

Ou pior: 

3. `test_dashboard_sem_lancamentos` verifica que o total de receitas é R$0,00. Na segunda execução, existem lançamentos do teste anterior — o total não é zero, o teste falha ✗

Com `db_snapshot`: se qualquer teste deixar um registro no banco, a fixture aponta exatamente qual tabela ficou com contagem diferente. O teste é corrigido antes de virar um "teste frágil" que passa às vezes e falha em outras.

---

## SEM `joinedload` (lazy loading para todos os relacionamentos)

**O que quebraria:**

A tela de lançamentos exibe 200 lançamentos com o nome do clifor de cada um. Com lazy loading:

1. Query inicial: `SELECT * FROM lancamento LIMIT 200` → 1 query
2. Para renderizar cada linha, Python acessa `lancamento.cliente_fornecedor.nome`
3. SQLAlchemy faz `SELECT * FROM clientefornecedor WHERE id = ?` para cada lançamento
4. Total: 201 queries ao banco para renderizar uma única tela

Para um usuário com resposta aceitável de até 500ms, 201 queries ao banco local pode parecer rápido. Em produção com banco remoto (latência de rede de 10-50ms por query), 201 × 50ms = 10 segundos para carregar a tela.

Com `joinedload`: 1 query com JOIN traz todos os dados. A tela carrega em ~50ms independente de quantos lançamentos existirem.

---

## SEM `autocommit=False` NO SQLALCHEMY

**O que quebraria:**

Com `autocommit=True` (mode padrão do SQLite e alguns ORMs), cada operação é confirmada imediatamente no banco.

Cenário: operação de efetivação de lançamento envolve:
1. Atualizar `data_pagamento` no lançamento ✓ (commitado imediatamente)
2. Atualizar `valor_pago` no lançamento ✓ (commitado imediatamente)  
3. Chamar `atualizar_inadimplente()` → exceção inesperada

Com `autocommit=True`: os passos 1 e 2 estão no banco, o passo 3 não aconteceu. O banco fica em estado inconsistente — lançamento tem `data_pagamento` mas a inadimplência do clifor não foi recalculada.

Com `autocommit=False`: o SQLAlchemy agrupa todas as operações em uma transação. Uma exceção no passo 3 reverte os passos 1 e 2 (via rollback automático no `finally` do `get_db()`). O banco fica intacto — nenhuma mudança parcial.

---

## SEM SOFT DELETE (hard delete)

**O que quebraria imediatamente:**

Um Administrador exclui o clifor "Empresa X" que tem 47 lançamentos registrados. Com hard delete:
```sql
DELETE FROM clientefornecedor WHERE id_clifor = 5;
-- ERROR: violates foreign key constraint on table "lancamento"
-- DETAIL: Key (id_clifor) = (5) is still referenced from table "lancamento"
```

O banco rejeita. Para deletar o clifor, você precisaria deletar todos os 47 lançamentos primeiro — apagando o histórico financeiro inteiro do relacionamento.

Alternativa sem soft delete: remover as FKs. Com FKs removidas, `lancamento.id_clifor` aponta para um ID que não existe mais — dado "órfão". Queries que tentam acessar `lancamento.cliente_fornecedor.nome` retornam `None` ou quebram.

Com soft delete: o clifor recebe `exclusao = NOW()`, não aparece mais nas listagens, mas os 47 lançamentos continuam intactos com a FK válida. O histórico financeiro é preservado — auditável anos depois.

---

## SEM RBAC (mesmas permissões para todos os usuários)

**O que quebraria:**

Sem controle de acesso por perfil, qualquer usuário autenticado pode fazer qualquer coisa. Um novo associado recebe acesso ao sistema para consultar seus pagamentos — e pode:
- Ver o CPF de todos os outros 200 associados
- Criar lançamentos falsos cobrando valores que não devem
- Excluir lançamentos de inadimplência do próprio CPF

Com RBAC: o novo associado recebe perfil Consulta — vê apenas dados gerais, CPF mascarado, zero poder de alteração. Operadores criam e efetivam mas não tocam em configurações. Apenas Administradores têm acesso total.

**Importante:** RBAC no frontend sem RBAC no backend é inútil. Esconder o botão "Excluir" do Consulta não impede que ele faça `DELETE /lancamento/5` diretamente via Postman. A proteção real está em `exige_admin()` e `exige_operador_ou_admin()` no backend.

---

## SEM SESSÃO DESLIZANTE (expiração fixa)

**O que quebraria (em usabilidade):**

Token com expiração fixa de 60 minutos. Um tesoureiro começa a registrar os pagamentos do mês às 14:00. Às 15:01, no meio de um formulário de efetivação, recebe "Sessão expirada — faça login novamente". O formulário é descartado. Tudo que estava digitando é perdido.

Com sessão deslizante: cada requisição renova o timer. O tesoureiro que está ativamente usando o sistema às 14:00, 14:05, 14:10... nunca é desconectado. A sessão só expira após 60 minutos sem nenhuma ação.

Sem sessão deslizante, a escolha seria: token de 8 horas (segurança fraca — um computador esquecido aberto fica vulnerável por 8 horas) ou token de 60 minutos (desconexão frequente durante uso normal).

---

## SEM TESTE DE INTEGRAÇÃO COM BANCO REAL (mocks)

**O que quebraria (silenciosamente):**

Com banco mockado, o teste `test_criar_lancamento` substitui o PostgreSQL por um objeto Python que simula respostas. O teste passa.

Mas o modelo Python tem:
```python
natureza_lancamento = Column(Enum(NaturezaEnum), nullable=False)
```

E o ENUM no PostgreSQL foi criado como `('Credito', 'Debito')` — com acento em "Crédito" na documentação mas sem acento no código. O mock não valida o ENUM real do banco. Em produção, ao tentar inserir, o banco retorna:
```
ERROR: invalid input value for enum naturezaenum: "Crédito"
```

Com banco real nos testes: esse tipo de inconsistência é detectada na primeira execução dos testes, não no deploy em produção.
