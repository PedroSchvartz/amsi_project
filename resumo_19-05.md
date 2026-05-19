# Resumo de alterações — 18–19/05/2026

---

# Dia 18/05 (a partir das 18:00)

## 1. ToastStack.jsx — Correção de deduplicação de toasts

Mecanismo de deduplicação baseado em `useRef(Set)` quebrava no React StrictMode (double-invoke). Substituído por verificação dentro do updater de estado:

```js
const mostrarToast = (mensagem, tipo = 'sucesso', duracao = 5000) => {
    if (!mensagem) return;
    const id = ++counter.current;
    setToasts((prev) => {
        if (prev.some((t) => t.mensagem === mensagem && t.tipo === tipo)) return prev;
        setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), duracao);
        return [...prev, { id, mensagem, tipo }];
    });
};
```

---

## 2. Backend — Endpoints de lançamento liberados para Operador

`backend/routes/lancamento.py`: todos os endpoints que usavam `get_current_user` foram trocados para `exige_operador_ou_admin`:

- `GET /resumo`, `GET /resumo-por-tipo`, `GET /`, `GET /{id}`
- `GET /por-clifor/{id}`, `GET /por-usuario/{id}`
- `GET /{id}/comprovante`, `POST /{id}/comprovante`, `DELETE /{id}/comprovante`

Import de `get_current_user` removido do arquivo.

---

## 3. Frontend — Modal "Ver Lançamento" (Operador, somente leitura)

`ListaLancamentosPage.jsx`:
- Estado `modalVer` adicionado
- Função `abrirModalVer(l)` adicionada
- Botão olho (`bi-eye`) na coluna de ações — visível apenas para perfil Operador (não admin)

---

## 4. LancamentoModal.jsx — Reorganização do layout

Novo layout em 6 linhas:
1. Cliente / Fornecedor (select full-width)
2. Tipo de Conta + Natureza (grid `1fr 1fr`)
3. Data de Vencimento + Valor + Reembolso (grid `1fr 1fr auto`)
4. Observação (textarea `rows=2`, sempre visível)
5. Separador `<hr>`
6. Rodapé: `+ Novo Tipo` (admin, esquerda) | Cancelar + Salvar (direita)

---

## 5. ClientRegister.jsx / ClientEdit.jsx — Tipo de Pessoa dinâmico

- Seletor `Tipo de Pessoa` inicia em **Pessoa Física** por padrão
- Label do campo nome alterna entre **Nome Completo** (PF) e **Razão Social** (PJ)
- Label da data alterna entre **Data de Nascimento** (PF) e **Data de Fundação** (PJ)

---

## 6. "Fechar Lançamento" renomeado para "Efetivar Lançamento"

- Ícone verde na tabela, título da modal e textos internos atualizados
- Modal passa a exibir seção de leitura com os dados de criação do lançamento (Cliente, Tipo, Natureza, Valor, Vencimento, Status, Observação) antes dos campos de efetivação

---

## 6b. Tabela de lançamentos — valores com vírgula como separador decimal

Funções `formatarValor` e `formatarTotal` adicionadas em `ListaLancamentosPage.jsx`:

```js
const formatarValor = (v) => v == null ? '—' : parseFloat(v).toFixed(2).replace('.', ',');
const formatarTotal = (l) => {
    if (l.valor_pago == null) return '—';
    const total = (parseFloat(l.valor_pago) || 0) + (parseFloat(l.multa) || 0) + (parseFloat(l.juros) || 0);
    return total.toFixed(2).replace('.', ',');
};
```

Usadas na tabela (`Valor` e `Total Pago`) e nas modais para exibição de valores read-only. Ao abrir as modais Efetivar e Editar, os valores vindos do backend (ponto decimal) são convertidos com `.replace('.', ',')` antes de popular os inputs.

---

## 7. Modal Efetivar — layout duas colunas

Estrutura `grid 1fr auto 1fr` com divisor vertical (`ll-efetiva-divider`):

**Coluna esquerda — leitura** (ícone 🔒):
- Cliente / Fornecedor
- Tipo de Conta
- Natureza + Vl. Lançamento
- Data de Vencimento + Status + Estorno (read-only, desabilitado)
- Observação do Lançamento

**Coluna direita — efetivação** (ícone ✏️):
- Data de Pagamento
- Valor Pago
- Multa + Juros
- Total Pago (exibido se multa ou juros preenchidos)
- Observação do Pagamento
- Comprovante (PDF)

---

## 7b. Modais Efetivar e Editar — cabeçalhos de coluna com ícones

Adicionado `ll-col-titulo` no topo de cada coluna para indicar visualmente o modo de cada seção:

| Modal | Coluna esquerda | Coluna direita |
|---|---|---|
| Efetivar | 🔒 `bi-lock` — Dados do Lançamento | ✏️ `bi-pencil-square` — Efetivação |
| Editar | ✏️ `bi-pencil` — Dados do Lançamento | ✏️ `bi-pencil-square` — Efetivação |

---

## 8. Modal Editar — espelho do Efetivar com tudo editável

Mesma estrutura de duas colunas, mas:

**Coluna esquerda — edição** (ícone ✏️):
- Cliente / Fornecedor (select)
- Tipo de Conta + Natureza (selects)
- Vl. Lançamento + Data de Vencimento
- Status (badge display) + Estorno (checkbox editável)
- Observação do Lançamento (textarea)

**Coluna direita — efetivação** (ícone ✏️):
- Mesma estrutura do modal Efetivar, mas todos editáveis

Botão **Excluir** mantido no rodapé (esquerda, admin only).

Campos adicionados ao payload PATCH: `data_pagamento`, `valor_pago`, `multa`, `juros`, `estorno`, comprovante via upload.

**Expansões necessárias para suportar o modal:**
- `EDITAR_INICIAL` recebeu `data_pagamento`, `valor_pago`, `multa`, `juros`, `observacao_pagamento`
- `abrirModalEditar` inicializa esses campos a partir do lançamento (com `.replace('.', ',')`)
- `handleConfirmarEditar` inclui os campos no payload e chama `uploadComprovante` se houver arquivo
- `totalPagoEditar()` — helper análogo ao `totalPago()`, calcula soma para o modal Editar
- `handleEditarChange` corrigido para tratar checkboxes (`type === 'checkbox' ? checked : value`)

---

## 9. Correções de UX / CSS (18/05)

| Problema | Solução |
|---|---|
| Modal estourava a tela (overflow) | Scroll no overlay (`ll-overlay`), não no modal |
| Scrollbar feia na borda da tela | `scrollbar-width: none` + `::-webkit-scrollbar { display: none }` |
| Input "Escolher Arquivo" sem padding | CSS `::file-selector-button` + padding no input |
| Texto ilegível no modo escuro (coluna leitura) | `color: var(--text-muted)` em todos os divs read-only |
| `gap` no form quebrando alinhamento horizontal | `gap: 12px` só no `form` (flex gap não afeta filhos de `.ll-row`) |

---

---

# Dia 19/05

## 9b. Checkbox Estorno — adicionado a ambas as modais (18/05)

Antes de ser reposicionado, o campo Estorno foi criado do zero em ambas as modais:
- **Efetivar**: adicionado na coluna direita com `formFechar.estorno` / `handleFecharChange`
- **Editar**: adicionado via expansão de `EDITAR_INICIAL` e `handleEditarChange`

---

## 10. Checkbox Estorno — movido para ao lado de Status

Em ambas as modais (Efetivar e Editar), o checkbox Estorno foi reposicionado para a mesma `ll-row` que o campo Status:

- **Efetivar**: Estorno na coluna esquerda — `disabled`, lê `lancamentoSelecionado?.estorno` (somente leitura)
- **Editar**: Estorno na coluna esquerda — editável, wired em `formEditar`

---

## 11. Checkbox Estorno — visual redondo

Nova classe `.ll-checkbox-round` em `listaLancamentos.css`:
- `appearance: none`, `border-radius: 50%`, 20×20 px
- Cor primária quando marcado, bolinha branca central como indicador
- `focus-visible` com outline na cor primária

---

## 12. Correções de UX / CSS (19/05)

| Problema | Solução |
|---|---|
| Estorno editável no modal Efetivar | `disabled` + `checked={!!lancamentoSelecionado?.estorno}` |
| `color: white` ilegível no modo claro | Removido de Valor Pago, Multa e Juros em ambas as modais |

---

## 13. Validação de campos monetários

Aplicado em todos os handlers: aceita apenas dígitos e vírgula (`/[^0-9,]/g`).

| Arquivo | Handler | Campos |
|---|---|---|
| `LancamentoModal.jsx` | `handleChange` | `valor` |
| `LancamentoPage.jsx` | `handleChange` | `valor` |
| `ListaLancamentosPage.jsx` | `handleFiltroChange` | `valor_minimo`, `valor_maximo` |
| `ListaLancamentosPage.jsx` | `handleFecharChange` | `valor_pago`, `multa`, `juros` |
| `ListaLancamentosPage.jsx` | `handleEditarChange` | `valor`, `valor_pago`, `multa`, `juros` |
