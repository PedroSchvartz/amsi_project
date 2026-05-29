# Temático: Banco de Dados — TCC AMSI
## Deep dive completo em PostgreSQL, modelagem e integridade para o NotebookLM

> **Como usar:** sobe apenas este arquivo no NotebookLM para estudar banco de dados isoladamente. Bom para perguntas sobre 3NF, ACID, PostgreSQL vs MySQL, N+1 problem e soft delete.

---

## 1. POR QUE POSTGRESQL

### PostgreSQL vs SQLite

**SQLite** é um banco de dados em arquivo único, sem servidor. Excelente para:
- Apps desktop
- Desenvolvimento local rápido
- Apps mobile

**Problema crítico para o AMSI:** SQLite tem lock de arquivo — apenas uma escrita por vez. Se dois operadores tentarem efetivar pagamentos simultaneamente, o segundo esperará o primeiro terminar. Para um sistema multi-usuário onde múltiplos operadores podem trabalhar ao mesmo tempo, SQLite seria um gargalo imediato.

### PostgreSQL vs MySQL

**MySQL** é uma escolha válida. Os motivos para preferir PostgreSQL no AMSI:

1. **Tipos ENUM nativos:** o AMSI usa ENUMs para `NaturezaEnum` (Credito/Debito), `PerfilEnum` (Administrador/Operador/Consulta) e outros. O SQLAlchemy mapeia `Column(Enum(NaturezaEnum))` diretamente para o tipo ENUM nativo do PostgreSQL. MySQL aceita ENUMs mas com comportamentos menos rigorosos em versões antigas.

2. **Precisão decimal:** `DECIMAL(15,2)` no PostgreSQL garante precisão aritmética exata para valores monetários. `0.1 + 0.2` em `DECIMAL` é exatamente `0.3`. Em `FLOAT`, seria `0.30000000000000004` — inaceitável para finanças.

3. **Rigor de tipos:** PostgreSQL rejeita valores inválidos por padrão. MySQL em modo permissivo aceita datas inválidas como `'2099-02-30'` sem erro.

4. **ACID robusto:** PostgreSQL tem isolamento de transações rigoroso com suporte completo a todos os níveis de isolamento (Read Committed, Repeatable Read, Serializable).

---

## 2. SCHEMA DO BANCO — AS 8 TABELAS

```
usuario
├── id_usuario (PK)
├── nome
├── email (unique)
├── senha_hash
├── perfil: ENUM (Administrador, Operador, Consulta)
├── cargo: ENUM (Presidente, VicePresidente, Diretor, Tesoureiro, Secretario, Associado)
├── ativo: boolean
└── created_at, updated_at, exclusao (soft delete)

lancamento
├── id_lancamento (PK)
├── valor: DECIMAL(15,2)
├── natureza_lancamento: ENUM (Credito, Debito)
├── data_vencimento: DATE
├── data_pagamento: DATE (NULL = não pago)
├── valor_pago: DECIMAL(15,2)
├── multa, juros: DECIMAL
├── estorno: boolean
├── comprovante_pdf: BYTEA (PDF em bytes)
├── id_usuario_fk → usuario (quem criou)
├── id_clifor_relacionado_fk → clientefornecedor
├── id_tipo_conta_fk → tipo_conta
└── created_at, updated_at, exclusao

clientefornecedor
├── id_clifor (PK)
├── nome
├── cpf_cnpj
├── inadimplente: boolean
└── created_at, updated_at, exclusao

tipo_conta
├── id_tipo_conta (PK)
├── descricao_conta
└── natureza_conta: ENUM (Credito, Debito)

token_ativo
├── id_token (PK)
├── jti (UUID único por sessão)
├── id_usuario_fk → usuario
└── expires_at

login (histórico de sessões)
├── id_login (PK)
├── id_usuario_fk → usuario
├── timestamp
├── ip
└── user_agent

endereco
├── id_endereco (PK)
├── id_clifor_fk → clientefornecedor
└── logradouro, numero, bairro, cidade, uf, cep

contato
├── id_contato (PK)
├── id_clifor_fk → clientefornecedor
└── tipo_contato, valor_contato
```

---

## 3. NORMALIZAÇÃO — 3NF

### O que são formas normais

**1FN (Primeira Forma Normal):** cada célula contém um valor atômico (não divisível). Sem grupos repetidos. Exemplo de violação: coluna `telefones` com valor `"(11)99999-9999, (11)88888-8888"`.

**2FN (Segunda Forma Normal):** cada atributo não-chave depende da chave primária inteira (relevante quando a PK é composta). Sem dependências parciais.

**3FN (Terceira Forma Normal):** nenhum atributo não-chave depende de outro atributo não-chave. Sem dependências transitivas.

### Como o AMSI está em 3FN

**Violação hipotética (antes da normalização):**
```
lancamento(id, valor, descricao_tipo_conta, natureza_tipo_conta, nome_clifor, cpf_clifor, ...)
```
- `descricao_tipo_conta` depende de `id_tipo_conta`, não de `id_lancamento` → violação 3FN
- `nome_clifor` depende de `id_clifor`, não de `id_lancamento` → violação 3FN

**Como está no projeto (3FN):**
```
lancamento(id, valor, id_tipo_conta_fk, id_clifor_fk, ...)
tipo_conta(id, descricao_conta, natureza_conta)
clientefornecedor(id, nome, cpf_cnpj, ...)
```

Cada atributo não-chave depende exclusivamente da PK da sua tabela. Quando a descrição de um tipo de conta muda, muda em um único lugar (`tipo_conta.descricao_conta`) — não em todas as linhas de `lancamento` que referenciam aquele tipo.

### O trade-off da normalização
3FN exige JOINs para reconstruir dados completos. Para exibir uma lista de lançamentos com o nome do clifor e a descrição do tipo de conta, são necessários dois JOINs. O projeto resolve isso com `joinedload` no SQLAlchemy e campos calculados em `LancamentoResponse`.

---

## 4. ACID — PROPRIEDADES DE TRANSAÇÃO

### O que significa ACID

**A — Atomicidade:** uma transação é tudo ou nada. Se qualquer operação falhar, nenhuma mudança é persistida.

**C — Consistência:** o banco sempre vai de um estado válido para outro estado válido. Constraints (FK, NOT NULL, UNIQUE) são sempre respeitadas.

**I — Isolamento:** transações simultâneas não se interferem. O nível de isolamento padrão do PostgreSQL é "Read Committed" — uma transação não vê mudanças não confirmadas de outras transações.

**D — Durabilidade:** dados confirmados (commitados) persistem mesmo se o servidor cair. PostgreSQL usa WAL (Write-Ahead Log) — antes de modificar dado em disco, registra a intenção no log. Em crash, o log é usado para recuperar o estado.

### Como o AMSI implementa ACID

```python
# backend/database.py
SessionLocal = sessionmaker(
    autocommit=False,  # nunca commita automaticamente
    autoflush=False,   # nunca faz flush automático
    bind=engine
)

def get_db():
    db = SessionLocal()
    try:
        yield db       # entrega a sessão para a rota
    finally:
        db.close()     # fecha sempre, inclusive em exceções
```

Com `autocommit=False`, nenhuma mudança vai ao banco sem um `db.commit()` explícito. Se uma exceção for lançada antes do commit, a sessão é fechada no `finally` sem commit — o banco não é alterado.

**Exemplo prático:**
```python
# Se isso lançar exceção após o add() mas antes do commit():
db.add(lancamento)
db.commit()   # ← só aqui o dado persiste
```
Uma exceção entre `db.add()` e `db.commit()` resulta em nenhuma mudança no banco.

### Ponto de atenção no AMSI

```python
db.commit()                          # ← commit 1: lançamento salvo
atualizar_inadimplente(clifor_id, db) # ← se falhar, lançamento já persistiu
```

Se `atualizar_inadimplente()` falhar após o commit do lançamento, temos uma inconsistência: lançamento existe, flag de inadimplência não foi atualizada. A correção seria envolver ambas as operações em uma única transação.

---

## 5. O PROBLEMA N+1 E COMO O AMSI RESOLVE

### O que é o N+1 problem

Acontece quando você busca N registros e depois acessa um relacionamento de cada um — resultando em 1 query inicial + N queries adicionais = N+1 queries.

**Exemplo com lazy loading:**
```python
lancamentos = db.query(Lancamento).all()  # 1 query: SELECT * FROM lancamento
for l in lancamentos:
    print(l.cliente_fornecedor.nome)      # 1 query POR lancamento: SELECT * FROM clientefornecedor WHERE id = ?
# Total: 1 + N queries
```

Para 100 lançamentos, são 101 queries. Para 1000, são 1001. O banco de dados é o gargalo mais comum — multiplicar as queries por 100 tem impacto real de performance.

### A solução: `joinedload`

```python
from sqlalchemy.orm import joinedload

lancamentos = (
    db.query(Lancamento)
    .options(joinedload(Lancamento.cliente_fornecedor))
    .options(joinedload(Lancamento.tipo_conta))
    .all()
)
# Total: 1 query com JOIN
# SELECT lancamento.*, clientefornecedor.*, tipo_conta.*
# FROM lancamento
# LEFT OUTER JOIN clientefornecedor ON ...
# LEFT OUTER JOIN tipo_conta ON ...
```

Uma única query com JOINs traz todos os dados necessários. O SQLAlchemy monta os objetos Python a partir do resultado — cada `lancamento.cliente_fornecedor` já está carregado em memória.

**Arquivos relevantes:** `backend/routes/lancamento.py`

---

## 6. SOFT DELETE — POR QUE NÃO DELETAR DE VERDADE

### O que é soft delete
Em vez de `DELETE FROM tabela WHERE id = ?`, o sistema registra uma data de exclusão: `UPDATE tabela SET exclusao = NOW() WHERE id = ?`. O registro continua no banco, mas não aparece nas queries normais.

### Por que o AMSI usa soft delete

**Motivo 1 — Integridade referencial:**
Se um usuário criou 50 lançamentos e o deletamos com `DELETE`, as 50 linhas de `lancamento` teriam `id_usuario_fk` apontando para um ID que não existe mais. O PostgreSQL lançaria erro de FK. Com soft delete, o usuário continua "existindo" no banco — apenas marcado como excluído.

**Motivo 2 — Auditoria financeira:**
O histórico financeiro não deve ser apagado. Se um associado que saiu da associação tinha lançamentos, esses lançamentos continuam no histórico. O campo `exclusao` registra quando e (indiretamente) por quem o registro foi "removido".

**Motivo 3 — Reversibilidade:**
Um registro soft-deleted pode ser reativado. Um `DELETE` real é irreversível.

### Como as queries filtram registros excluídos

```python
# Queries normais incluem o filtro de exclusão
db.query(Usuario).filter(Usuario.exclusao.is_(None)).all()
# ou via relacionamento configurado
```

Em `backend/routes/*.py`, todas as queries de leitura filtram por `exclusao IS NULL`.

---

## 7. INADIMPLÊNCIA — O CAMPO CALCULADO

### O problema de calcular em tempo real
Toda vez que alguém abre a lista de clifors, calcular inadimplência em tempo real exigiria: para cada clifor, fazer uma query nos lançamentos filtrando por Crédito + vencido + não pago. Para 1000 clifors, seriam 1000 queries.

### A solução: campo desnormalizado com recálculo pontual

O campo `inadimplente` na tabela `clientefornecedor` é intencionalmente desnormalizado — é um cache calculado. A função `atualizar_inadimplente()` é chamada nos momentos exatos em que o estado pode mudar:
1. Ao criar um lançamento (novo débito pode tornar o clifor inadimplente)
2. Ao efetivar um lançamento (pagamento pode remover inadimplência)
3. Ao excluir um lançamento

```python
# backend/utils/inadimplencia.py
def atualizar_inadimplente(id_clifor: int, db: Session):
    tem_debito_vencido = db.query(Lancamento).filter(
        Lancamento.id_clifor_relacionado_fk == id_clifor,
        Lancamento.natureza_lancamento == NaturezaEnum.Credito,
        Lancamento.data_vencimento < date.today(),
        Lancamento.data_pagamento.is_(None),
        Lancamento.estorno == False,
        Lancamento.exclusao.is_(None)
    ).first()

    clifor = db.query(ClienteFornecedor).filter_by(id_clifor=id_clifor).first()
    clifor.inadimplente = tem_debito_vencido is not None
    db.commit()
```

**Regra de negócio embutida:** só lançamentos de **Crédito** (o clifor deve à associação), **vencidos** (data_vencimento < hoje), **não pagos** (data_pagamento IS NULL) e **não estornados** contam para inadimplência. Um lançamento com vencimento futuro não torna o clifor inadimplente antes da data.

---

## 8. ÍNDICES NO BANCO

### Índices automáticos do PostgreSQL
O PostgreSQL cria automaticamente índices B-tree para:
- Chaves primárias (`id_lancamento`, `id_clifor`, etc.)
- Colunas com constraint UNIQUE (`email` de usuário)
- Chaves estrangeiras **não** recebem índice automático no PostgreSQL (diferente do MySQL)

### Índices customizados — o que falta

O projeto não define índices customizados. As colunas mais consultadas sem índice explícito:
- `lancamento.data_vencimento` — usada em todo filtro de inadimplência e dashboard
- `lancamento.id_clifor_relacionado_fk` — usada em toda query de inadimplência
- `lancamento.exclusao` — filtrada em toda query de listagem

Em produção com volume alto (milhares de lançamentos), esses índices reduziriam significativamente o tempo das queries de inadimplência e listagem.

```sql
-- Índices que seriam adicionados em produção
CREATE INDEX idx_lancamento_vencimento ON lancamento(data_vencimento);
CREATE INDEX idx_lancamento_clifor ON lancamento(id_clifor_relacionado_fk);
CREATE INDEX idx_lancamento_exclusao ON lancamento(exclusao) WHERE exclusao IS NULL;
```

---

## 9. ALEMBIC — POR QUE NÃO FOI USADO

### O que é Alembic
Alembic é a ferramenta padrão de migrations para SQLAlchemy. Uma migration é um script Python que descreve como modificar o schema do banco (adicionar coluna, criar tabela, alterar tipo).

### O que o projeto usa em vez disso

```python
# backend/main.py
Base.metadata.create_all(bind=engine)
```

`create_all()` **cria tabelas que não existem** mas **não altera tabelas existentes**. Se você adicionar uma coluna ao model `Lancamento` e reiniciar o servidor, `create_all` não executa `ALTER TABLE` — a nova coluna simplesmente não existe no banco até você recriar o banco manualmente.

### Por que foi uma escolha consciente (mas com riscos)

Em desenvolvimento: recriar o banco a cada mudança de schema é rápido e sem dados reais para perder. `create_all` é suficiente.

Em produção: o banco tem dados reais. Mudar o schema sem migration resulta em inconsistências entre o que o Python espera e o que o banco tem. O sistema quebraria silenciosamente ou lançaria erros nas queries.

**A resposta honesta para a banca:** Alembic foi deixado de fora por simplicidade durante o desenvolvimento. É uma limitação real para qualquer deploy em produção com dados reais.

---

## 10. RESUMO: DECISÕES DE BANCO E SUAS JUSTIFICATIVAS

| Decisão | Alternativa rejeitada | Por quê foi rejeitada |
|---|---|---|
| PostgreSQL | SQLite | Lock de arquivo — sem suporte multi-usuário |
| PostgreSQL | MySQL | Menos rigoroso em tipos, sem ENUM nativo equivalente |
| DECIMAL(15,2) | FLOAT | Imprecisão de ponto flutuante inaceitável em finanças |
| ENUM nativo | VARCHAR com check | Mais legível, mapeamento direto com SQLAlchemy |
| Soft delete | Hard delete | Integridade referencial + auditoria financeira |
| Campo `inadimplente` desnormalizado | Cálculo em tempo real | Performance: evita N queries por clifor na listagem |
| `autocommit=False` | autocommit padrão | Controle explícito de transações para atomicidade |
| `token_ativo` para JWT | Tokens de curta duração | Melhor UX: sessão deslizante sem desconexões frequentes |
