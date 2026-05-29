# Analogias e Metáforas — TCC AMSI
## Como explicar cada conceito técnico de forma que qualquer pessoa entenda

> **Por que este documento existe:** o NotebookLM gera áudio mais rico quando as fontes têm analogias concretas. Além disso, em uma defesa de TCC, uma boa metáfora comunica compreensão profunda melhor do que uma definição técnica correta mas sem vida.
>
> **Como usar:** quando a banca perguntar sobre um conceito, dê a definição técnica primeiro, depois a analogia. Ex: "JWT é um token de autenticação assinado digitalmente — é como um crachá de conferência que o organizador assinou: você pode ler quem é o dono, mas não consegue falsificar a assinatura sem o carimbo do organizador."

---

## AUTENTICAÇÃO E SESSÃO

### JWT (JSON Web Token)
**A analogia do crachá de conferência:**
Quando você chega em um evento e apresenta seu convite, a organização te dá um crachá. Esse crachá tem seu nome, sua faixa de acesso (palestrante, visitante, organizador), e o prazo de validade. Você mostra esse crachá para entrar em cada sala — sem precisar voltar na recepção a cada vez.

JWT funciona igual: após o login, o servidor entrega um "crachá digital" (o token) com seu ID e perfil. Você apresenta esse crachá em cada requisição. O servidor lê o crachá sem precisar consultar o banco para saber quem você é.

A assinatura criptográfica do JWT é o carimbo do organizador: qualquer um pode ler o que está escrito no crachá, mas ninguém consegue falsificar o carimbo sem ter o selo original (a `SECRET_KEY` do servidor).

---

### JWT híbrido com `token_ativo`
**A analogia do crachá + lista de bloqueados:**
O JWT puro tem um problema: uma vez emitido, é válido até vencer — mesmo se você "devolver o crachá" (clicar em logout). É como uma conferência que não tem como cancelar um crachá perdido.

A solução do AMSI: além do crachá, o segurança mantém uma **lista de crachás válidos** (`token_ativo`). A cada entrada em uma sala, além de verificar o carimbo, o segurança consulta a lista. Se você foi demitido da conferência (logout), seu crachá é retirado da lista imediatamente — mesmo que o crachá em si ainda não esteja vencido.

---

### Sessão deslizante
**A analogia da torneira automática de banheiro público:**
A torneira abre quando você coloca a mão, e fica aberta enquanto você está usando. Se você parar de usar por um tempo, ela fecha sozinha. Mas se você continua usando, ela continua aberta — não fecha no meio da lavagem das mãos só porque passaram 30 segundos desde que você abriu.

A sessão deslizante funciona igual: cada requisição autenticada "renova o timer". Se você está trabalhando ativamente no sistema, a sessão nunca expira. Só expira depois de 60 minutos de inatividade.

---

### bcrypt vs MD5
**A analogia do cofre com combinação difícil:**
Imagine que você precisa guardar uma senha de forma que ninguém consiga descobri-la mesmo que roubem o cofre. MD5 é um cofre de metal fino — uma máquina industrial abre em segundos. bcrypt é um cofre de aço com 12 camadas de engrenagens — a mesma máquina levaria décadas.

MD5 é rápido por design (projetado para verificar integridade de arquivos, não para proteger senhas). bcrypt é lento por design — cada tentativa de força bruta leva ~250ms. Multiplicar por bilhões de tentativas torna o ataque impraticável.

---

### Salt no bcrypt
**A analogia dos selos personalizados:**
Se todos os funcionários assinassem com a mesma caneta e a mesma tinta, um ladrão que descobrisse a assinatura de um poderia replicar para todos. O salt é como dar a cada funcionário uma caneta com tinta única: mesmo que dois funcionários escrevam "abc123", as assinaturas ficam completamente diferentes.

O salt garante que duas pessoas com a mesma senha tenham hashes completamente diferentes. Uma "tabela rainbow" (dicionário pré-computado de hash → senha) se torna inútil porque cada senha tem um salt aleatório único.

---

## ARQUITETURA

### Camadas (Models / Schemas / Routes)
**A analogia do restaurante:**
- **Models** são o **estoque do restaurante** — ingredientes brutos, organizados nas prateleiras (tabelas do banco). Você não serve os ingredientes diretamente para o cliente.
- **Schemas** são o **cardápio e o formulário de pedido** — definem exatamente o que o cliente pode pedir (POST), o que pode modificar (PATCH), e o que vai receber no prato (Response). O formulário de pedido não tem o campo "estoque mínimo do ingrediente" porque isso não é informação para o cliente.
- **Routes** são o **atendente** — recebe o pedido, verifica se o cliente pode pedir aquilo (permissão), vai buscar no estoque, monta o prato conforme a receita, e entrega formatado.

---

### Múltiplos schemas por entidade
**A analogia dos formulários de RH:**
Quando uma empresa contrata alguém, usa um formulário de admissão (com dados do candidato). Quando demite, usa um formulário de desligamento (com datas e motivo). Quando promove, usa um formulário de alteração salarial. O mesmo funcionário, três formulários diferentes — cada um captura apenas o que é relevante para aquela operação.

`LancamentoCreate`, `LancamentoEditAdmin` e `LancamentoResponse` são os três formulários para o mesmo lançamento. Usar um único formulário para tudo significaria que um Operador poderia preencher campos que só o Admin deveria tocar.

---

### Injeção de dependência com `Depends()`
**A analogia do kit de ferramentas automático:**
Imagine um eletricista que, antes de entrar em qualquer obra, precisa de: chave de fenda, multímetro e EPI. Sem injeção de dependência, ele teria que buscar cada ferramenta em lugares diferentes toda vez. Com injeção, alguém já deixa o kit completo na porta da obra — ele pega e trabalha.

`Depends(get_db)` e `Depends(exige_operador_ou_admin)` são o kit. Antes da função da rota executar uma linha de código de negócio, o FastAPI já preparou a sessão do banco e validou as permissões — entregues como parâmetros prontos para usar.

---

### FastAPI vs Django
**A analogia do cozinheiro vs o restaurante completo:**
Django é um restaurante completo: cozinha, salão, cardápio, caixa, sistema de reservas, tudo incluído. Excelente se você precisa de tudo isso.

O AMSI só precisa de um cozinheiro que prepare pratos e entregue para o garçom (React). Contratar um restaurante inteiro para ter apenas o cozinheiro é desperdício. FastAPI é o cozinheiro especializado: faz muito bem o que precisa ser feito, sem trazer a estrutura de restaurante que não será usada.

---

### REST vs GraphQL
**A analogia do cardápio fixo vs o buffet personalizado:**
REST é um cardápio fixo: você pede "Prato 3" e recebe exatamente o que está descrito. Eficiente, previsível. GraphQL é um buffet onde você monta seu prato dizendo exatamente quais ingredientes quer — muito mais flexível, mas mais complexo de montar.

Para o AMSI, cada tela sempre precisa dos mesmos campos. A tela de lançamentos sempre quer `id`, `valor`, `natureza`, `nome_clifor`. Não há variação. Cardápio fixo (REST) é a escolha certa — o buffet (GraphQL) adicionaria complexidade sem trazer benefício.

---

## BANCO DE DADOS

### ORM (SQLAlchemy)
**A analogia do tradutor automático:**
Você fala Python. O banco fala SQL. Sem ORM, você escreve SQL como string:
```python
f"SELECT * FROM lancamento WHERE id = {id}"
```
É como falar para um estrangeiro usando um dicionário letra por letra — funciona, mas é lento e arriscado (SQL injection é o equivalente de usar a palavra errada com consequências graves).

O SQLAlchemy é o tradutor automático que converte `db.query(Lancamento).filter_by(id=id).first()` para SQL parametrizado correto e seguro. Você fala Python, o banco recebe SQL — sem risco de "palavra errada".

---

### N+1 Problem
**A analogia do garçom que pergunta para cada mesa:**
Imagine um restaurante com 100 mesas. O garçom precisa saber o nome de cada cliente para chamar. Sem `joinedload` (lazy loading): o garçom vai até a mesa 1, pergunta o nome, anota; vai até a mesa 2, pergunta o nome, anota; vai até a mesa 3... — 100 viagens separadas.

Com `joinedload`: o garçom usa um microfone e pede para todos falarem o nome ao mesmo tempo — 1 viagem, 100 respostas.

Lazy loading: 100 lançamentos = 101 queries ao banco (1 para os lançamentos + 100 para os nomes dos clifors).
`joinedload`: 100 lançamentos = 1 query com JOIN.

---

### 3NF (Terceira Forma Normal)
**A analogia da agenda de contatos:**
Se você anota o endereço do seu amigo João em cada evento que ele foi convidado ("festa de aniversário — João, Rua das Flores 123"; "churrasco — João, Rua das Flores 123"), quando João se mudar você precisa atualizar em todos os eventos.

Se você tiver um cadastro central de João com o endereço atualizado, e nos eventos colocar apenas "convidado: João", a mudança de endereço é feita uma vez — e todos os eventos refletem automaticamente.

3NF: `descricao_tipo_conta` fica na tabela `tipo_conta`, não repetida em cada linha de `lancamento`. Quando a descrição muda, muda em um lugar.

---

### ACID
**A analogia da transferência bancária:**
Você transfere R$100 da sua conta para outra. O banco debita R$100 da sua conta (operação 1). Aí o servidor cai antes de creditar na outra conta (operação 2). Sem ACID: R$100 sumiu do sistema. Com ACID (Atomicidade): se a operação 2 falha, a operação 1 é revertida. Tudo ou nada.

O `autocommit=False` do SQLAlchemy garante que o banco só persiste mudanças quando o código chama `db.commit()` explicitamente. Uma exceção antes do commit = banco intacto.

---

### Soft Delete
**A analogia do arquivo morto:**
Uma empresa não joga fora contratos antigos de clientes que encerraram o relacionamento. Arquiva. O contrato não é mais ativo, mas o histórico existe para consulta futura, auditorias, questões legais.

Soft delete: o registro de um clifor excluído não é deletado do banco — recebe um timestamp em `exclusao`. O histórico financeiro continua intacto. A empresa (associação) pode auditar o passado sem limitações.

---

### PostgreSQL DECIMAL vs FLOAT
**A analogia da régua milimetrada vs estimativa a olho:**
Para medir um cano de encanamento, você usa régua — precisão é essencial, um erro de 2mm pode fazer o cano não encaixar. Para estimar quanto falta para o próximo posto de gasolina, você olha o marcador — precisão de 5km é suficiente.

`FLOAT` é a estimativa: rápido, mas `0.1 + 0.2 = 0.30000000000000004`. Para quilometragem, irrelevante. Para finanças, inaceitável — centavos importam. `DECIMAL(15,2)` é a régua milimetrada: preciso, sem arredondamentos.

---

## SEGURANÇA

### SQL Injection
**A analogia do formulário malicioso:**
Imagine um formulário de busca que pergunta seu nome e o servidor procura: "SELECT * FROM pessoas WHERE nome = '[O QUE VOCÊ DIGITOU]'". Se você digitar `' OR '1'='1`, a query vira: `WHERE nome = '' OR '1'='1'` — que retorna todos os registros porque `'1'='1'` é sempre verdadeiro.

O Pydantic é o fiscal antes do formulário: se o campo espera um número inteiro e você manda texto, o formulário é devolvido com erro 422 antes de qualquer query acontecer. O SQLAlchemy usa queries parametrizadas — o valor vai separado da query, nunca concatenado.

---

### XSS (Cross-Site Scripting)
**A analogia do quadro negro vs projetor:**
Se você escreve `<script>alert(1)</script>` em um quadro negro, aparece como texto — não executa. Se você coloca esse código em um projetor conectado a um computador e o projetor interpreta como HTML, o código executa.

`innerHTML` é o projetor. `textContent` é o quadro negro. O React usa `textContent` (via `React.createElement`) — qualquer conteúdo é tratado como texto puro, nunca como HTML executável.

---

### CSRF
**A analogia do sequestro de ação:**
Você está logado no banco online (com cookie de sessão). Um site malicioso tem uma imagem invisível com `src="banco.com/transferir?valor=1000&destino=ladrão"`. Quando seu browser carrega a página, automaticamente faz a requisição para o banco com seu cookie — o banco não sabe que não foi você.

Isso só funciona com cookie (que o browser envia automaticamente). O AMSI usa header `Authorization: Bearer` — o browser nunca envia headers personalizados automaticamente para outro domínio. O site malicioso não tem como incluir o token da vítima.

---

## TESTES

### db_snapshot
**A analogia do inventário de loja:**
Uma loja faz inventário antes e depois de uma promoção. Se depois da promoção o estoque for diferente do esperado (além das vendas registradas), algo está errado — produto saiu sem ser registrado.

`db_snapshot` conta as linhas de cada tabela antes de todos os testes e depois. Se alguma tabela cresceu ou encolheu além do esperado, o teste do "fiscal" falha, apontando exatamente qual tabela ficou "suja". Todo teste é obrigado a limpar o que sujou.

---

### Teste de integração vs unitário
**A analogia de testar um carro:**
Teste unitário: girar a roda do carro no laboratório e verificar que ela gira. Rápido, isolado, mas não garante que o carro anda.

Teste de integração: pegar o carro, ligar o motor, colocar em primeira marcha e dirigir 100 metros. Mais lento, mas verifica que motor, câmbio, rodas e volante funcionam juntos como esperado.

O AMSI usa integração: uma requisição HTTP real, banco real, resposta real. Garante que a stack completa funciona, não apenas cada peça isolada.

---

### Teardown em cascata
**A analogia de desmontar um móvel de encaixe:**
Você montou uma estante com suportes que encaixam nas laterais e prateleiras que encaixam nos suportes. Para desmontar, você não começa pelas laterais — as prateleiras travaram. Você remove as prateleiras primeiro (filhos), depois os suportes (intermediários), depois as laterais (pai).

No banco: lançamentos referenciam `tipo_conta` via FK. Para deletar o `tipo_conta`, você deleta os lançamentos primeiro (filho antes do pai). Inverter a ordem viola a constraint de FK e o banco rejeita.

---

## FRONTEND

### SPA (Single-Page Application)
**A analogia do quadro branco vs slide show:**
Um slide show tradicional: para mudar o slide, o projetor apaga tudo e projeta o novo. Uma tela com quadro branco: você apaga apenas o que mudou e escreve o novo conteúdo — o quadro continua lá.

Aplicação tradicional: cada clique em um link carrega uma página nova do servidor (apaga e recomeça). SPA: o React atualiza apenas o componente que mudou — a NavBar continua, o spinner não aparece, o scroll não volta para o topo.

---

### CSS Custom Properties (variáveis)
**A analogia do controle de iluminação central:**
Em uma casa sem automação, para mudar de "modo dia" para "modo noite" você ajusta cada lâmpada individualmente: sala, quarto, corredor, banheiro. Com um sistema centralizado, você aperta um botão e todos os ambientes mudam de uma vez.

CSS Custom Properties são o sistema centralizado: `--primary: #2d7a3a` no `:root`. Para trocar de tema verde para corporativo, um único `setAttribute("data-theme", "corporativo")` no `<html>` muda todas as cores da interface simultaneamente.

---

### fetchComLoading
**A analogia do assistente pessoal:**
Toda vez que você precisa fazer uma ligação, você teria que: pegar o telefone, discar o número, identificar quem você é, esperar a resposta, interpretar o tom de voz (sucesso/erro), e desligar — repetindo esse ritual em cada chamada.

`fetchComLoading` é o assistente: você diz o que quer ("buscar lançamentos") e ele cuida de tudo automaticamente — mostrar o spinner, incluir o token, renovar a sessão, detectar erros 401/403 e reagir adequadamente. Você só recebe o resultado.
