# Plano: Portão de aprovação do lançamento — o estado "Em análise"

## Contexto

Hoje o lançamento tem um fluxo de duas posições: ou está em aberto, ou está pago. Quem efetiva grava `data_pagamento` e o dinheiro entra no caixa na mesma hora, sem nenhuma conferência de terceiro.

**Comportamento-alvo (definido pelo Pedro):** o Operador ganha o poder de efetivar, mas a efetivação **não** leva direto a Pago — leva a um estado intermediário, **Em análise**. Só o Administrador tira dali, aprovando, e é a aprovação que faz o lançamento virar Pago e o dinheiro entrar no caixa.

Este plano fecha todas as decisões de design necessárias para execução direta — não há pontos em aberto abaixo.

### Duas premissas iniciais que o código desmentiu

1. **"Um perfil cadastra e o outro efetiva" não existe.** Operador já pode efetivar, nos dois lados: [`routes/lancamento.py:370`](../../backend/routes/lancamento.py) usa `exige_operador_ou_admin` no `PUT`, e o botão em [`ListaLancamentosPage.jsx:819`](../../AMSI_Frontend/src/pages/ListaLancamentosPage.jsx) aparece com `hasPerfilMinimo('Operador')`. Admin só é exclusivo em editar (`PATCH /editar`) e deletar (`DELETE`). A parte "Operador passa a efetivar" **já está pronta** — o trabalho todo é o portão de aprovação.
2. **Não existe coluna de estado.** Aberto/Vencido/Pago são todos derivados de `data_pagamento` ser nulo ou não. Não há o que "adicionar um valor no enum": o enum não existe.

---

## Decisões de design (fechadas)

| Decisão | Escolha | Por quê |
|---|---|---|
| Nome do estado | **Em análise** | Curto, cabe no badge da listagem, que já tem colunas apertadas. |
| Em análise conta no caixa? | **Não.** Fora de saldo, dashboard e resumo até a aprovação | É o sentido do portão: o Operador não mexe no caixa sozinho. Se contasse desde a efetivação, a "aprovação" seria auditoria, não autorização. |
| Inadimplência | **Só limpa na aprovação** | Coerente com o acima: enquanto não é dinheiro, a dívida do associado continua de pé. ⚠️ Consequência aceita conscientemente: quem pagou hoje segue marcado como inadimplente até o admin aprovar — se a fila demorar, pode aparecer em cobrança já tendo pago. |
| Como o estado é armazenado | **Derivado de timestamps**, sem coluna de enum | O código já deriva estado; um enum conviveria com as datas e as duas fontes divergiriam na primeira edição de admin. Uma verdade só. |
| Qual campo comanda o estado | **`data_efetivacao`** (carimbo do servidor), não `data_pagamento` | `data_pagamento` é digitada no formulário e pode ser retroativa ([`:930`](../../AMSI_Frontend/src/pages/ListaLancamentosPage.jsx)). Se ela comandasse o estado, um admin editando a data de pagamento no `PATCH /editar` mudaria o estado do lançamento sem querer. |
| Rejeição pelo admin | **Não existe.** Admin só aprova | Decisão do Pedro. O desfazer fica com o `PATCH /editar` (admin-only), que ganha as colunas novas para isso. |
| Admin efetivando | **Vai direto para Pago** | Ele aprovaria em seguida de qualquer jeito; dois cliques não acrescentam controle. Grava os dois lados na mesma operação — é efetivador e fechador do próprio lançamento, sem caso especial no código. |
| `id_usuario_fk_fechamento` | **Reaproveitada: passa a ser o admin que aprovou** ("quem tira de análise") | Zero migração de nome. O histórico já casa: quem fechou no fluxo antigo efetivamente aprovou. |
| Fila do admin | **Filtro `apenas_em_analise` na listagem.** Sem card no dashboard, sem notificação | Mínimo para a feature ser usável. Notificação via Telegram fica para fase futura. |
| Comprovante para aprovar | **Não exigido** | Nem todo recebimento tem PDF (espécie). Exigir travaria caso legítimo. |

---

## O ponto central: `data_pagamento` significa duas coisas

Este é o coração do trabalho e onde os bugs vão nascer. São **163 ocorrências em 18 arquivos**, e **não é find-and-replace** — cada uma responde a uma de duas perguntas que hoje coincidem e depois da mudança se separam:

- **Estado do fluxo** (o que o usuário vê e filtra) → passa a olhar `data_efetivacao`
- **Dinheiro realizado** (o que o caixa soma) → passa a olhar `data_aprovacao`

A armadilha, em duas linhas do mesmo arquivo:

| Site | Pergunta que responde | Vira |
|---|---|---|
| `resumo` → `q_abertos` ([`:85`](../../backend/routes/lancamento.py)) | "ainda não virou dinheiro" | `data_aprovacao IS NULL` |
| listagem → `apenas_abertos` ([`:220`](../../backend/routes/lancamento.py)) | "ninguém encostou ainda" | `data_efetivacao IS NULL` |

Mesma linha de código hoje, sentidos opostos amanhã.

**Divergência intencional a documentar:** `total_vencido_a_receber` no dashboard **inclui** os em análise (o dinheiro não entrou), mas o filtro `apenas_vencidos` da listagem **exclui** (não se cobra quem já pagou; e o badge diria "Em análise", não "Vencido" — filtro e badge têm que casar). São perguntas diferentes, e as respostas divergem de propósito.

---

## Modelo de dados

| Momento | Quem | Quando (servidor) | Data econômica |
|---|---|---|---|
| Efetivação (Operador) | `id_usuario_fk_efetivacao` 🆕 | `data_efetivacao` 🆕 | `data_pagamento` (existente) |
| Aprovação (Admin) | `id_usuario_fk_fechamento` ♻️ (muda de sentido) | `data_aprovacao` 🆕 | — |

| Estado | Regra | Badge |
|---|---|---|
| Aberto | `data_efetivacao IS NULL` | `badge-aberto` |
| Em análise | `data_efetivacao IS NOT NULL AND data_aprovacao IS NULL` | `badge-analise` 🆕 |
| Pago | `data_aprovacao IS NOT NULL` | `badge-pago` |

Prioridade do badge: **Estorno > Pago > Em análise > Vencido > Aberto**. "Em análise" tem que vencer "Vencido", senão um lançamento já pago apareceria como vencido só porque o admin não aprovou ainda.

---

## Fase 1 — Banco

Conforme o `CLAUDE.md`: **`tabelas_do_banco.txt` primeiro**, depois model.

> **Correção durante a implementação.** O plano original mandava rodar um SQL à mão
> antes do deploy. Isso estava errado para este repositório: existe
> `main._aplicar_migracoes()`, que roda no startup de todo deploy, e
> `tests/test_migracoes.py` falha se um model declara coluna sem migração lá. Foi
> exatamente essa omissão que derrubou `/lancamento/` em produção no incidente da
> coluna `lote` (2026-06-17). A migração entrou lá — e isso **fecha de graça a janela
> de deploy** descrita mais abaixo, porque o ALTER e o backfill passam a rodar no
> mesmo processo que sobe o código novo.

Em `main._aplicar_migracoes()`, guardado por `if "data_efetivacao" not in cols`:

```sql
ALTER TABLE lancamento
    ADD COLUMN data_efetivacao TIMESTAMP,
    ADD COLUMN data_aprovacao TIMESTAMP,
    ADD COLUMN id_usuario_fk_efetivacao BIGINT REFERENCES usuario(id_usuario);

-- Backfill: todo o histórico foi efetivado E aprovado pela mesma pessoa,
-- que já está em id_Usuario_FK_Fechamento (que agora significa "aprovador").
-- SEM ISSO, todo lançamento pago do histórico vira "Aberto" e o dashboard de
-- produção zera no deploy.
UPDATE lancamento
   SET data_efetivacao = data_pagamento,
       data_aprovacao  = data_pagamento,
       id_usuario_fk_efetivacao = id_usuario_fk_fechamento
 WHERE data_pagamento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lancamento_em_analise
    ON lancamento(data_efetivacao)
 WHERE data_efetivacao IS NOT NULL AND data_aprovacao IS NULL;
```

Os **CHECKs ficaram de fora do startup**, em `backend/comentarios/migracao_em_analise.sql`
como passo opcional: o backend já garante as invariantes, e um CHECK que estoura no
startup derruba o deploy inteiro. Aplicar à mão, depois, se quiser blindar contra
`UPDATE` manual no banco.

Atualizar também o comentário da `id_Usuario_FK_Fechamento` no `tabelas_do_banco.txt` para o novo sentido (**aprovador**), já que o nome mente.

---

## Fase 2 — Backend (`model → schema → route`)

### `models/lancamento.py`
Três colunas novas + `relationship` do efetivador (espelhando `usuario_fechamento`).

### `schemas/lancamento.py`

| Schema | Mudança |
|---|---|
| `LancamentoUpdate` | **Remover `id_usuario_fk_fechamento`** — ator vem do token, body não opina. Não aceita `data_efetivacao`/`data_aprovacao` (mesma regra do `estorno` no `LancamentoCreate`). |
| `LancamentoEditAdmin` | **Adicionar** `data_efetivacao` e `data_aprovacao` (nullable) — é o desfazer que sustenta "admin só aprova". Validar os invariantes no schema, espelhando os CHECKs. |
| `LancamentoResponse` | Adicionar `data_efetivacao`, `data_aprovacao`, `id_usuario_fk_efetivacao`, `nome_usuario_efetivacao`, `nome_usuario_fechamento` e `situacao` (estado calculado). |

**`situacao` calculada no backend** mata a duplicação do `statusLabel`, hoje repetido em [`ListaLancamentosPage.jsx:394`](../../AMSI_Frontend/src/pages/ListaLancamentosPage.jsx) e [`LoteLancamentosModal.jsx:36`](../../AMSI_Frontend/src/components/LoteLancamentosModal.jsx) — duas cópias que já teriam que aprender a nova regra de prioridade em sincronia.

### `routes/lancamento.py`

**`PUT /{id}` (efetivar)** — hoje `_=Depends(exige_operador_ou_admin)` descarta o usuário; passa a precisar do objeto real.
- **409 se `data_efetivacao` já preenchido.** 🔴 *Sem isso o portão é contornável:* o `PUT` não checa estado, só faz `setattr` ([`:379`](../../backend/routes/lancamento.py)). O front esconde o botão, a API não impede nada — hoje um Operador já pode dar `PUT` num lançamento pago e trocar `valor_pago`. Com o portão, viraria a porta dos fundos: efetiva R$ 100, admin aprova, novo `PUT` para R$ 10.000 sem passar por análise. Efetivar passa a ser **transição**, não update solto.
- Grava `data_efetivacao = now()` e `id_usuario_fk_efetivacao = current_user.id` **do token**.
- Se `current_user` é Administrador: grava também `data_aprovacao = now()` e `id_usuario_fk_fechamento = current_user.id` (direto para Pago).

**`POST /{id}/aprovar` (novo, `exige_admin`)**
- 404 inexistente · 409 se `data_efetivacao IS NULL` (não está em análise) · 409 se `data_aprovacao IS NOT NULL` (já aprovado).
- Grava `data_aprovacao = now()` e `id_usuario_fk_fechamento = current_user.id` **do token**.
- Chama `atualizar_inadimplente` (é a aprovação que limpa a inadimplência).
- Retorna `LancamentoResponse`.

**Classificação dos sites de query:**

| Arquivo / site | Pergunta | Vira |
|---|---|---|
| `lancamento.py:45` `q_periodo` | dinheiro realizado no período | `data_aprovacao != None` — **mantendo os filtros de data sobre `data_pagamento`** ¹ |
| `lancamento.py:59-60,67` recebido/pago/reembolso | dinheiro | herdam de `q_periodo` |
| `lancamento.py:85` `q_abertos` | dinheiro não realizado | `data_aprovacao == None` |
| `lancamento.py:113` `q_vencidos` | dinheiro vencido | herda de `q_abertos` |
| `lancamento.py:159` `resumo-por-tipo` | dinheiro | `data_aprovacao != None` |
| `lancamento.py:220` `apenas_abertos` | estado | `data_efetivacao == None` |
| `lancamento.py:223` `apenas_vencidos` | estado | `data_efetivacao == None AND vencimento < hoje` |
| `lancamento.py:227` `apenas_quitados` | estado | `data_aprovacao != None` |
| `apenas_em_analise` 🆕 | estado | `data_efetivacao != None AND data_aprovacao == None` |
| `utils/inadimplencia.py:20` | dinheiro (decisão: só limpa ao aprovar) | `data_aprovacao == None` |
| `cliente_fornecedor.py:56` `apenas_pendentes` | dinheiro | `data_aprovacao == None` |
| `cliente_fornecedor.py:88,106,112,118,125` totais | dinheiro | `data_aprovacao == None` |
| `usuario.py:527` | só serialização num dump | sem mudança de lógica |

¹ Um pagamento feito em 5/jun e aprovado em 7/jun tem que continuar contando em 5/jun — senão a fila de aprovação distorce o mês de competência.

---

## Fase 3 — Frontend

| Arquivo | Mudança |
|---|---|
| [`ListaLancamentosPage.jsx:260`](../../AMSI_Frontend/src/pages/ListaLancamentosPage.jsx) | **Remover `id_usuario_fk_fechamento: usuario?.sub` do payload** — vem do token agora. |
| [`LoteLancamentosModal.jsx:141`](../../AMSI_Frontend/src/components/LoteLancamentosModal.jsx) | Mesma remoção no `base` do loop. |
| `statusLabel` (2 arquivos) | Consumir `situacao` do backend, eliminando a duplicação. |
| `listaLancamentos.css` | `.badge-analise` — **cor via `var(--)`, nunca hardcoded** (dois temas). |
| `ListaLancamentosPage.jsx` filtros | Checkbox "Apenas em análise" → `apenas_em_analise`. |
| `ListaLancamentosPage.jsx` ações | Botão aprovar: `admin && l.data_efetivacao && !l.data_aprovacao`. Confirmação por `ModalConfirm`, feedback por `ToastStack`. |
| `LoteLancamentosModal.jsx` | Ação de aprovar em massa, no mesmo padrão de loop client-side do `confirmarEfetivar`. |
| Modal de ver detalhes | Exibir "Efetivado por X em DD/MM · Aprovado por Y em DD/MM" — é o que torna o portão auditável na prática. |
| `services/api.js` | `aprovarLancamento(id)`. |

---

## Fase 4 — Testes

`test_lancamento.py` tem **46 referências a `data_pagamento`** que quebram de propósito — a maioria por assumir que efetivar já soma no resumo. `test_permissoes.py` (2) e `test_novos_mvp.py` (7) idem. Os specs e2e (`lancamentos.spec.js`, `lancamentos_massa.spec.js`) também.

Casos novos:

- Operador efetiva → `situacao == "Em análise"`, **não** entra em `total_recebido`/`saldo_total`
- Admin aprova → entra no resumo, com a data de competência sendo a `data_pagamento` (não a de aprovação)
- Operador chamando `POST /aprovar` → **403**
- Aprovar lançamento em aberto → **409**; aprovar duas vezes → **409**
- `PUT` em lançamento já efetivado → **409** (o buraco da porta dos fundos)
- Admin efetiva → cai direto em Pago, com efetivador e fechador = ele
- Efetivador/aprovador **ignoram o body** e saem do token
- Inadimplência: efetivar **não** limpa; aprovar limpa
- Badge/`situacao`: em análise vencido → "Em análise", não "Vencido"
- `seed.py` e `dados_demo.py` precisam gerar os campos novos coerentes com os CHECKs

---

## Deploy

1. Deploy backend (Railway) — a migração roda sozinha no startup
2. Deploy frontend (Vercel)

Não há SQL manual a rodar antes. O buraco da janela de deploy que o plano original
previa **deixou de existir**: como o ALTER e o backfill rodam no startup do backend
novo, não há instante em que as colunas existam e o código antigo ainda esteja de pé
gravando `data_pagamento` sem `data_efetivacao`.

Conferir depois do deploy (esperado: `0` em tudo) — a query está em
`backend/comentarios/migracao_em_analise.sql`, seção `[VERIFICACAO]`:

```sql
SELECT COUNT(*) FROM Lancamento
 WHERE data_pagamento IS NOT NULL AND data_efetivacao IS NULL;
```

---

## Fora de escopo (explicitamente adiado)

- **Notificação ao admin** (Telegram/e-mail) quando algo entra em análise. Já existem `telegram_id` e a flag `Notificacao` no `Usuario`. Merece fase própria — sem isso a fila depende do admin lembrar de olhar o filtro.
- **Card no dashboard** com contagem/total em análise (acrescentaria campos ao `LancamentoResumo`).
- **Rejeição com motivo.** Admin só aprova; desfazer é pelo `PATCH /editar`.
- ~~**Renomear `id_usuario_fk_fechamento`.** O nome mente um pouco ("fechamento" = aprovação), mas renomear em produção adiciona risco ao mesmo deploy que já tem um backfill delicado. Fica documentado no `tabelas_do_banco.txt`.~~
  **Revertido — a renomeação foi feita.** Documentar que o nome mente não impede ninguém de ler `fechamento` e entender "fechamento": o comentário só existe para quem abre o `tabelas_do_banco.txt`, e a tela mostra a coluna como "Aprovado por". Coluna de auditoria com nome que mente custa mais caro do que um `RENAME COLUMN` — que, sendo só catálogo, nem reescreve a tabela. Hoje é `id_usuario_fk_aprovacao`.

  As demais linhas deste plano ficam como estavam: são o registro do que foi decidido na época, não a descrição do código de hoje.
