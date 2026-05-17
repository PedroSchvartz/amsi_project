# Requisitos MVP — Validação AMSI (13/05)

---

## Itens Mandatórios

### 1. Tela: Lançamentos — Exibição de Campos na Grid

**Tela:** Lista de Lançamentos

- A coluna **Cliente/Fornecedor** deve exibir `código + descrição` (não só o nome).
- A coluna **Tipo de Conta** deve exibir `código + descrição`.
- Incluir coluna com **Código e Nome do Usuário** que criou o lançamento.
- Incluir coluna com **Código e Descrição do Tipo de Lançamento**.

> **Bug relatado:** em alguns casos a grid não exibe o nome do cliente nem o nome da conta.

---

### 2. Tela: Lançamentos — Colunas Adicionais na Grid

**Tela:** Lista de Lançamentos

- Adicionar na grid as colunas:
  - **Data de Pagamento**
  - **Valor Pago**

---

### 3. Tela: Lançamentos — Edição de Lançamento

**Tela:** Lista de Lançamentos

- Permitir a **edição de um lançamento já realizado**.
- **Restrição de permissão:**
  - Somente o **usuário administrador** pode editar lançamentos realizados.
  - O **usuário comum não pode alterar** um lançamento já lançado.

---

### 5. Dashboard — Renomear Labels e Corrigir Cálculos

**Tela:** Dashboard

Alterar os labels e as regras de cálculo dos cards conforme a tabela abaixo:

| Label Atual | Novo Label | Regra de Cálculo |
|---|---|---|
| RECEITA RECEBIDA | TOTAL RECEITAS | Somar todas as contas de **crédito pagas** |
| DEPESA PAGA | TOTAL DESPESAS | Somar todas as contas de **débito pagas** |
| SALDO PERÍODO | SALDO PERÍODO | Total Receitas − Total Despesas |
| REEMBOLSOS | ESTORNOS / REEMBOLSOS | Somar lançamentos de reembolso com **natureza inversa** do tipo de conta (ver regra abaixo) |
| A RECEBER | TOTAL A RECEBER | Somar contas de crédito **ainda não pagas** |
| A PAGAR | TOTAL A PAGAR | Somar contas de débito **ainda não pagos** |
| A RECEBER (EXCL. INADIMPLENTES) | TOTAL INADIMPLÊNCIA | Somar contas de crédito não pagas **e vencidas** |

#### Regra de Cálculo — Estornos/Reembolsos

Reembolsos devem ser somados respeitando a **natureza inversa** do tipo de conta:

| Conta | Natureza | Valor | Reembolso | Operação |
|---|---|---|---|---|
| Mensalidade do Associado | Crédito | 100,00 | Sim | **Subtrair** 100,00 |
| Mensalidade do Associado | Crédito | 100,00 | Sim | **Subtrair** 100,00 |
| Energia Elétrica | Débito | 50,00 | Sim | **Somar** 50,00 |
| Energia Elétrica | Débito | 50,00 | Sim | **Somar** 50,00 |

**Resultado:** −100,00 + (−100,00) + 50,00 + 50,00 = **−100,00**

**Regra resumida:**
- Conta de natureza **Crédito** com reembolso → **subtrai** o valor
- Conta de natureza **Débito** com reembolso → **soma** o valor

---

### 6. Tela: Cliente/Fornecedor — Exclusão

**Tela:** Cadastro de Cliente/Fornecedor

- Implementar a **rotina de exclusão** de um cliente/fornecedor.
- **Restrição:** se o cliente/fornecedor estiver vinculado a algum lançamento, **não poderá ser excluído**.

---

### 7. Tipo de Conta — Edição

**Tela:** Cadastro de Tipo de Conta

- Criar tela/funcionalidade para **alterar (editar) um tipo de conta**.
- **Restrição:** se o tipo de conta já estiver em algum lançamento, **não poderá ser excluído**.

---

## Itens Não Mandatórios

### 4. Tela: Lançamentos — Total do Valor Pago

**Tela:** Fechar Lançamento (modal de baixa)

- Adicionar um campo calculado de **Total do Valor Pago** que some automaticamente:
  - Valor Pago + Multa + Juros

---

### 8. Tipo de Conta — Exclusão

**Tela:** Cadastro de Tipo de Conta

- Criar tela/funcionalidade para **excluir** um tipo de conta.
- **Restrição:** se o tipo de conta já estiver em algum lançamento, **não poderá ser excluído**.

---

### 9. Tela: Lançamentos — Separação de Campos no Modal de Baixa

**Tela:** Fechar Lançamento (modal de baixa)

- Exibir os dados do lançamento como **somente leitura (bloqueados)**:
  - Cliente/Fornecedor, Conta, Natureza, Vencimento, Valor
- Abrir para edição apenas os **campos de pagamento**:
  - Data de Pagamento, Valor Pago, Juros, Multa, Valor Total Pago, Observação

---

### 10. Tela: Lançamentos — Contraste do Status

**Tela:** Lista de Lançamentos

- O badge/pill de **Status** está com cor muito clara, quase ilegível.
- Aumentar o contraste para melhorar a leitura do texto dentro do badge.

---

### 11. Tela: Lançamentos — Separar Observação do Lançamento e do Pagamento

**Tela:** Fechar Lançamento (modal de baixa)

- O campo **Observação** preenchido no momento do cadastro do lançamento **não deve ser alterável** na baixa.
- Implementar **dois campos de observação distintos**:
  1. **Observação do Lançamento** — preenchida no cadastro, somente leitura na baixa
  2. **Observação do Pagamento** — preenchida no momento da baixa

---

### 12. Tela: Lançamentos — Remover Incremento por Clique nos Campos Monetários

**Tela:** Fechar Lançamento (modal de baixa)

- Os campos de valor monetário (Multa, Juros) possuem controles de incremento por centavos (spinner), o que é ineficiente.
- **Remover os controles de seta (spinner)** e permitir que o usuário **digite o valor diretamente**.

---

### 13. Dashboard — Erro nos Filtros de Período

**Tela:** Dashboard

- Os botões de período estão causando **erro** ao clicar:
  - Último Mês
  - Últimos 6 Meses
  - Ano Atual
  - Desde Sempre
- O filtro por **intervalo de datas customizado** também apresenta erro.
- Investigar e corrigir o comportamento dos filtros de período.

---

## Resumo por Prioridade

| # | Tela | Descrição | Mandatório |
|---|---|---|---|
| 1 | Lançamentos | Grid: exibir código+desc em clifor, tipo conta, usuário e tipo lançamento | Sim |
| 2 | Lançamentos | Grid: adicionar colunas Data de Pagamento e Valor Pago | Sim |
| 3 | Lançamentos | Permitir edição de lançamento (somente admin) | Sim |
| 5 | Dashboard | Renomear labels e corrigir cálculos dos cards | Sim |
| 6 | Cliente/Fornecedor | Implementar exclusão com restrição por lançamento | Sim |
| 7 | Tipo de Conta | Implementar edição de tipo de conta | Sim |
| 4 | Lançamentos | Campo total (valor + multa + juros) no modal de baixa | Não |
| 8 | Tipo de Conta | Implementar exclusão de tipo de conta | Não |
| 9 | Lançamentos | Separar campos bloqueados/editáveis no modal de baixa | Não |
| 10 | Lançamentos | Aumentar contraste do badge de Status | Não |
| 11 | Lançamentos | Separar observação do lançamento da observação do pagamento | Não |
| 12 | Lançamentos | Remover spinner dos campos monetários | Não |
| 13 | Dashboard | Corrigir erro nos filtros de período | Não |
