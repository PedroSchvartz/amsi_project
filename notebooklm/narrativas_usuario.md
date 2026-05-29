# Narrativas de Usuário — TCC AMSI
## Como o sistema muda o dia a dia das pessoas reais da associação

> **Por que este documento existe:** os outros documentos descrevem o sistema da perspectiva do desenvolvedor. Este descreve da perspectiva de quem usa. São as histórias que tornam o Audio Overview do NotebookLM mais humano e engajante — e que ajudam a responder perguntas da banca sobre impacto real.

---

## ANTES DO SISTEMA: A VIDA COM EXCEL E CADERNO

Para entender o que o sistema muda, é preciso entender o que existia antes.

A cada mês, o tesoureiro da AMSI abria uma planilha Excel no seu computador pessoal — aquele que fica em casa, que só ele acessa. A planilha tinha abas para cada mês: Janeiro 2024, Fevereiro 2024, e assim por diante. Cada linha era um associado.

Para registrar que João pagou a mensalidade de fevereiro, o tesoureiro:
1. Abria a planilha certa
2. Procurava a linha do João (ordenação alfabética, 83 associados)
3. Marcava a célula como "pago" e anotava a data
4. Salvava o arquivo

Parece simples. O problema: essa planilha não estava em lugar nenhum além do computador do tesoureiro. Se o presidente quisesse saber a situação financeira antes de uma reunião de diretoria, precisava ligar para o tesoureiro e pedir que enviasse o arquivo por WhatsApp. A versão enviada já estava desatualizada no momento em que chegava.

Quando o tesoureiro mudou — ao final do mandato — o novo tesoureiro recebeu o arquivo Excel. Mas não a lógica de como as colunas funcionavam. Não o histórico das exceções. Não a memória de por que o associado da linha 47 tinha um valor diferente dos outros.

Essa é a situação que o sistema veio resolver.

---

## HISTÓRIA 1 — MARIA (TESOUREIRA, PERFIL OPERADOR)

**Contexto:** É primeiro de março. Maria assumiu a tesouraria há três meses. Tem 47 mensalidades de fevereiro para registrar — chegaram via transferência bancária ao longo do mês, algumas em atraso.

**O que ela faz no sistema:**

Maria abre o navegador no computador de casa. Entra em `amsi.com`, digita email e senha. O sistema a reconhece como Operador e mostra o dashboard: saldo atual, total de receitas do mês, 12 lançamentos ainda em aberto.

Ela vai para a tela de Lançamentos. Vê a lista de cobranças de fevereiro que criou no dia 1º — cada mensalidade como um lançamento de Crédito, vencimento 10/02. 12 delas ainda têm `data_pagamento` em branco — estão abertas.

Para o primeiro da lista — "Condomínio Fevereiro — Carlos Mendes" — ela clica em "Efetivar". Um modal abre pedindo: data do pagamento, valor pago. Carlos pagou R$150,00 no dia 08/02, no valor exato. Ela preenche, clica em Salvar.

O sistema fecha o modal, mostra uma notificação verde "Lançamento efetivado com sucesso", e a linha de Carlos some da lista de abertos.

Ela repete para os outros 11. Em 8 minutos, todos os pagamentos recebidos estão registrados.

Dois associados não pagaram: Fábio e Beatriz. Os lançamentos deles continuam abertos, data_vencimento 10/02, hoje é 1º/03 — 19 dias de atraso. O sistema calculou automaticamente: `inadimplente = True` para os dois.

Maria não precisa fazer nada. Na próxima vez que o presidente acessar o dashboard, verá "2 inadimplentes" sem precisar perguntar para a Maria.

**O que ela não precisa mais fazer:**
- Procurar na planilha qual linha é de qual associado
- Calcular manualmente quem está em atraso
- Enviar a planilha atualizada para o presidente por WhatsApp
- Refazer os cálculos quando cometeu um erro de digitação

---

## HISTÓRIA 2 — JOÃO (PRESIDENTE, PERFIL CONSULTA)

**Contexto:** É segunda-feira, 19h. Reunião de diretoria amanhã. João quer chegar com os números do mês na ponta da língua.

**O que ele faz no sistema:**

João está no celular, no sofá. Abre o AMSI pelo browser do celular — a interface é responsiva, funciona no mobile. Faz login com as credenciais que recebeu quando foi eleito presidente.

O sistema o reconhece como Consulta. Ele vai direto ao Dashboard.

Vê: Receitas de fevereiro: R$6.750,00. Despesas: R$1.200,00. Saldo: R$5.550,00. Lançamentos em aberto: 2. Valor em aberto: R$300,00. Inadimplentes: 2 — Fábio Costa e Beatriz Lima.

João tira um print da tela para mostrar na reunião. Ele sabe que pode citar os números com confiança — são os mesmos que Maria tem, em tempo real, porque o banco é centralizado.

Ele tenta clicar no nome de Fábio Costa para ver os dados completos. Vê nome, endereço, histórico de lançamentos — mas o CPF aparece como "•••.•••.•••-••". Perfil Consulta não vê documentos pessoais. Não é um erro: é deliberado. João precisa da informação financeira, não dos dados pessoais.

**O que mudou para João:**
- Antes: dependia de alguém enviar a planilha; a versão recebida podia estar desatualizada
- Agora: acessa pelo celular, dados atualizados em tempo real, sem precisar pedir nada para ninguém
- Limitação aceita: não pode criar nem editar nada — o sistema impediu que o presidente acidentalmente alterasse um lançamento

---

## HISTÓRIA 3 — ROBERTO (NOVO TESOUREIRO, PERFIL ADMINISTRADOR)

**Contexto:** Março, início de novo mandato. Roberto foi eleito tesoureiro. A associação tem 3 anos de histórico financeiro no sistema. O tesoureiro anterior era o Ricardo.

**O que ele faz no sistema:**

Roberto recebe o acesso Admin da diretoria anterior. Primeiro desafio: registrar a nova composição.

Ele acessa Configurações > Usuários. Vê a lista de usuários ativos: Ricardo (Administrador), Maria (Operador), João (Consulta), e mais 5 membros. Ricardo não faz mais parte da diretoria.

Roberto clica em "Desativar" no perfil do Ricardo. O sistema não deleta o registro — marca `exclusao = NOW()`. Ricardo some da lista de usuários ativos. Mas todos os lançamentos que Ricardo criou nos últimos 3 anos continuam lá, com o campo "criado por: Ricardo" intacto. O histórico é preservado.

Roberto cadastra os dois novos diretores, define os perfis, envia as senhas provisórias por e-mail.

Agora Roberto quer entender o histórico antes de assumir. Vai para Lançamentos, filtra por "2023", vê os 180 lançamentos do ano. Pode ver quem criou cada um (Ricardo, Maria). Pode ver os valores pagos, as datas, os comprovantes em PDF anexados.

**O que o soft-delete preservou para Roberto:**
- 3 anos de auditoria completa — quem fez o quê, quando
- Histórico de inadimplência — quais associados estiveram em atraso
- Comprovantes de pagamento arquivados
- Nomes dos responsáveis por cada lançamento, mesmo os que saíram da diretoria

Se o sistema fizesse hard delete, Roberto teria um histórico cheio de "usuário deletado" e relacionamentos quebrados.

---

## HISTÓRIA 4 — CARLOS (MORADOR COM DÉBITO, PERSPECTIVA INDIRETA)

**Contexto:** Carlos não usa o sistema diretamente — não tem acesso. Mas ele é afetado por ele.

**O que acontece com Carlos:**

Carlos pagou a mensalidade de janeiro no dia 15 de janeiro — 5 dias antes do vencimento (dia 20). Pagou certinho.

Em fevereiro, por um problema bancário, o pagamento não saiu. Hoje é dia 25 de fevereiro.

Maria entra no sistema. Vê Carlos na lista de inadimplentes: `inadimplente = True`. O sistema calculou isso automaticamente: tem um lançamento de Crédito, vencimento 20/02, `data_pagamento = NULL`, hoje é dia 25.

Maria liga para Carlos. Ele resolve o pagamento, faz a transferência.

Maria vai ao sistema, efetiva o lançamento de Carlos: data de pagamento 25/02, valor R$150,00. O sistema chama `atualizar_inadimplente()`. Verifica: tem algum lançamento de Crédito vencido e não pago de Carlos? Não — o único que estava em aberto acabou de ser efetivado. `inadimplente = False`.

Carlos volta ao estado regular, sem que ninguém precise fazer cálculo manual.

**A regra de inadimplência na prática:**
Carlos também tem um lançamento de janeiro com vencimento 20 de março do próximo ano — uma cota especial paga antecipadamente. Isso não torna Carlos inadimplente mesmo se ficar não pago por semanas — porque ainda não venceu. A regra é explícita: só lançamentos **vencidos** geram inadimplência.

---

## HISTÓRIA 5 — A REUNIÃO DE DIRETORIA (ANTES VS DEPOIS)

**Antes do sistema — reunião de março de 2022:**

O presidente abre a reunião: "Alguém trouxe os números de fevereiro?"

O tesoureiro: "Trouxe a planilha impressa, mas os últimos três pagamentos chegaram depois que imprimi."

O presidente: "Então não temos o número final?"

O tesoureiro: "Tenho no celular... mas a planilha não abre bem no celular."

Discussão sobre se o saldo era R$5.200 ou R$5.550. Dois diretores com versões diferentes da planilha no e-mail.

**Depois do sistema — reunião de março de 2026:**

O presidente abre o dashboard no notebook projetado na parede. Mostra: Receitas, Despesas, Saldo, Inadimplentes. Todos os diretores que abriram o AMSI no celular antes da reunião veem exatamente os mesmos números.

Ninguém pergunta "qual versão da planilha é a certa". Não existe versão — existe o banco de dados, que é um só.

---

## IMPACTO REAL: O QUE MUDOU

| Situação | Antes (Excel) | Depois (AMSI) |
|---|---|---|
| Saber quem está inadimplente | 20 min varrendo planilha manualmente | Dashboard mostra em tempo real |
| Verificar pagamento de um associado | Ligar para o tesoureiro | Qualquer Consulta acessa pelo celular |
| Passar o mandato para outro tesoureiro | Enviar o arquivo Excel + explicar as abas | O novo admin tem acesso ao histórico completo |
| Corrigir um valor errado | Editar célula, ninguém sabe quem mudou | Só Admin edita; cada lançamento tem autoria |
| Arquivar comprovante de pagamento | Pasta física ou drive | Anexado ao próprio lançamento no banco |
| Registrar que 47 pessoas pagaram | 47 edições manuais na planilha | 47 efetivações no sistema, cada uma com data e valor real |

---

## POR QUE ESSAS HISTÓRIAS IMPORTAM PARA A BANCA

Quando um professor pergunta "qual o impacto real do sistema para a associação?", a resposta não é "o sistema tem 50 endpoints e 214 testes". A resposta é:

**Maria não passa mais 2 horas por mês varrendo planilha para encontrar inadimplentes.**

**João sabe a situação financeira antes de qualquer reunião, sem depender de ninguém.**

**Roberto assumiu o mandato com 3 anos de histórico auditável intacto.**

**A associação tem agora uma fonte única de verdade sobre suas finanças, acessível de qualquer dispositivo, com registro de quem fez o quê.**

Esses são os resultados. As decisões técnicas — FastAPI, React, PostgreSQL, JWT, RBAC — existem para viabilizar esses resultados de forma confiável, segura e sustentável.
