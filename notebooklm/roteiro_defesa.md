# Roteiro de Defesa — TCC AMSI
## Sistema de Gestão Financeira da Associação de Moradores de Santa Isabel

**Equipe:** Lucas Thierry Cordeiro de Oliveira, Nicolas Moreira Barbosa, Pedro Schvartz
**Orientadora:** Maria Cristina Tagliari Diniz
**Tempo total estimado:** 18–20 minutos

> **Como usar este roteiro com o NotebookLM:** sobe este arquivo como fonte e usa a função Audio Overview para gerar um podcast simulando a apresentação. Depois, faz perguntas ao NotebookLM como se fosse membro da banca.

---

## BLOCO 1 — ABERTURA (2 min)

**Fala sugerida:**

Bom dia/boa tarde. Meu nome é [nome], faço parte da equipe formada por Lucas, Nicolas e Pedro. Nossa orientadora é a professora Maria Cristina Tagliari Diniz.

Hoje apresentaremos o AMSI — um sistema de gestão financeira desenvolvido para a Associação de Moradores de Santa Isabel, uma organização comunitária localizada na zona rural do município de Santa Isabel.

O projeto nasceu de uma necessidade real: a associação controlava suas finanças em planilhas Excel, cadernos físicos e anotações avulsas. Ao longo desta apresentação, vamos mostrar como identificamos o problema, que sistema construímos, quais decisões técnicas tomamos e por quê, e o que aprendemos ao longo do processo.

---

## BLOCO 2 — O PROBLEMA REAL (3 min)

**Fala sugerida:**

A Associação de Moradores de Santa Isabel é uma entidade sem fins lucrativos que administra condomínio, mensalidades e despesas operacionais de seus associados.

Antes do sistema, o processo de gestão financeira tinha quatro problemas centrais:

**Problema 1 — Ausência de cadastro centralizado.** As informações dos associados ficavam em planilhas Excel diferentes, mantidas localmente por pessoas diferentes. Quando alguém saía da diretoria, parte do histórico ia junto.

**Problema 2 — Inadimplência invisível.** Para saber quem estava em atraso, alguém precisava varrer a planilha manualmente, linha por linha, comparando datas de vencimento com datas de pagamento. Esse processo era feito esporadicamente — o que significa que cobranças atrasadas ficavam semanas sem ação.

**Problema 3 — Sem auditoria.** Não havia registro de quem tinha feito qual alteração, quando, e com qual justificativa. Um valor errado não tinha histórico rastreável.

**Problema 4 — Acesso restrito.** As planilhas ficavam nos computadores de pessoas específicas. Um diretor viajando não tinha como consultar a situação financeira em tempo real.

**A solução proposta foi:** um sistema web acessível pelo navegador, com base de dados centralizada, que automatiza o cálculo de inadimplência, registra cada operação com autoria e permite diferentes níveis de acesso conforme o papel de cada usuário.

---

## BLOCO 3 — O QUE FOI CONSTRUÍDO (2 min)

**Fala sugerida:**

O resultado é um sistema web completo chamado AMSI, com três camadas integradas:

- **Frontend** em React 19, acessado pelo navegador
- **Backend** em Python com FastAPI, que processa toda a lógica de negócio
- **Banco de dados** PostgreSQL, que armazena os dados de forma persistente

O sistema tem três perfis de acesso:

- **Consulta:** visualiza lançamentos e dashboard. CPF/CNPJ sempre mascarado. Não pode criar, editar ou excluir nada.
- **Operador:** cria lançamentos, registra pagamentos, gerencia clientes e fornecedores.
- **Administrador:** acesso total, incluindo criar e editar usuários e configurações.

As funcionalidades principais são: cadastro de clientes e fornecedores; registro de lançamentos financeiros (receitas e despesas); efetivação de pagamentos com valor pago, multa, juros e comprovante em PDF; cálculo automático de inadimplência; dashboard financeiro com totais de receita, despesa, saldo e inadimplentes; e controle de acesso baseado em perfis.

---

## BLOCO 4 — ARQUITETURA E DECISÕES TÉCNICAS (4 min)

**Fala sugerida:**

Vou explicar as quatro decisões de arquitetura mais importantes, e o porquê de cada uma.

### Decisão 1: FastAPI em vez de Django ou Flask

Django é um framework full-stack projetado para aplicações que geram HTML no servidor. O AMSI é uma API REST pura — o backend só entrega JSON, o React cuida de todo o HTML. Usar Django seria como usar um caminhão para uma entrega de bicicleta.

Flask é minimalista, o que parece atraente — mas para montar o que o AMSI precisa (validação, JWT, CORS, documentação), seriam necessários quatro plugins separados com versões potencialmente conflitantes. FastAPI inclui validação automática com Pydantic, documentação OpenAPI gerada automaticamente em `/docs`, e injeção de dependência sem nenhuma configuração extra.

### Decisão 2: PostgreSQL em vez de MySQL ou SQLite

SQLite tem lock de arquivo: apenas uma escrita por vez. Para um sistema multi-usuário com vários operadores simultâneos, seria um gargalo imediato.

PostgreSQL foi escolhido por dois motivos concretos: suporte nativo a tipos ENUM (que o SQLAlchemy mapeia diretamente para as classes Python), e tipo DECIMAL com precisão arbitrária para valores monetários — garantindo que `0.1 + 0.2` seja exatamente `0.3`, sem os erros de arredondamento típicos de ponto flutuante.

### Decisão 3: JWT híbrido em vez de sessões tradicionais

Sessions tradicionais guardam estado no servidor. Para dois servidores, você precisaria de Redis compartilhado. JWT carrega o payload no próprio token — qualquer servidor com a chave secreta valida sem consultar estado centralizado.

O problema do JWT puro é que não há logout real: o token é válido até expirar, independente de o usuário ter clicado em "sair". A solução híbrida do AMSI: cada token tem um identificador único (`jti`), salvo na tabela `token_ativo`. No logout, o registro é deletado. A cada requisição, o backend busca o `jti` na tabela — token sem registro recebe 401. Logout real, sem abrir mão das vantagens de escala do JWT.

### Decisão 4: Arquitetura em 3 camadas

O backend é dividido em: `models/` (estrutura do banco), `schemas/` (contrato da API — o que cada rota aceita e devolve) e `routes/` (lógica e orquestração).

O motivo para ter schemas separados do model: um Operador não pode definir `data_pagamento` ao criar um lançamento. Um schema `LancamentoCreate` não inclui esse campo; `LancamentoEditAdmin` o inclui como opcional. Sem essa separação, seria necessário validação manual em cada rota.

---

## BLOCO 5 — FUNCIONALIDADES EM PRÁTICA (3 min)

**Fala sugerida:**

Vou descrever o fluxo de uso mais comum para ilustrar como as partes se integram.

**Fluxo: Operador registra pagamento de mensalidade**

1. O operador faz login. O backend valida email e senha, cria um token JWT com perfil "Operador", salva o `jti` na tabela `token_ativo`, e devolve o token para o frontend.

2. O frontend armazena o token no `localStorage` e redireciona para o dashboard.

3. Na tela de lançamentos, o operador vê a lista de lançamentos abertos — cobranças ainda não pagas.

4. O operador clica em "Efetivar" em um lançamento. Um modal pede: data de pagamento, valor pago, e opcionalmente multa, juros e comprovante.

5. O frontend envia `PATCH /lancamento/{id}/efetivar` com o token no header.

6. O backend valida o token, verifica que o usuário tem perfil Operador ou Administrador, valida os dados com Pydantic, atualiza o lançamento no banco, recalcula o flag de inadimplência para o clifor relacionado, e devolve o lançamento atualizado.

7. O frontend atualiza a tabela sem recarregar a página.

**Cálculo automático de inadimplência:** sempre que um lançamento é criado, efetivado ou excluído, a função `atualizar_inadimplente()` é chamada. Ela verifica se o clifor tem pelo menos um lançamento de Crédito vencido e não pago — se sim, marca `inadimplente = True`. Se todos os débitos foram pagos, o flag vira `False`. O operador nunca precisa marcar inadimplência manualmente.

---

## BLOCO 6 — SEGURANÇA (2 min)

**Fala sugerida:**

Quatro proteções de segurança são implementadas explicitamente:

**SQL Injection:** o SQLAlchemy gera queries parametrizadas automaticamente. O valor do usuário nunca é interpolado como string SQL. Antes de chegar ao banco, o Pydantic já rejeita tipos inválidos — um campo que espera inteiro retorna erro 422 para qualquer string.

**XSS (Cross-Site Scripting):** o React compila JSX para `React.createElement()`, que usa a API DOM com `textContent` em vez de `innerHTML`. Qualquer conteúdo é tratado como texto puro — jamais executado como código HTML. Se alguém salvar `<script>alert(1)</script>` no nome de um associado, o React exibirá esse texto literalmente na tela.

**CSRF:** a autenticação usa header `Authorization: Bearer`, não cookie. Um browser nunca envia headers personalizados automaticamente para outro domínio — um site malicioso não consegue incluir o token da vítima em uma requisição forjada.

**Senhas:** armazenadas com bcrypt, cost factor 12. Uma GPU moderna faz 10 bilhões de hashes MD5 por segundo — mas apenas 4 mil hashes bcrypt com esse custo. Salt automático garante que duas senhas iguais geram hashes diferentes, tornando tabelas rainbow inúteis.

Um ponto de melhoria reconhecido: não há rate limiting no endpoint de login. Em produção, adicionaríamos `slowapi` para limitar tentativas de força bruta por IP.

---

## BLOCO 7 — QUALIDADE E TESTES (1 min 30 s)

**Fala sugerida:**

O projeto tem 214 testes automatizados, todos passando.

Os testes usam `TestClient` do FastAPI, que simula requisições HTTP reais contra um banco de dados real — não mockado. Isso é chamado de teste de integração: o teste valida a stack completa, da requisição HTTP até a resposta do banco.

Cada endpoint tem ao menos um teste de caminho feliz e um teste de cenário de erro — por exemplo, verificar que uma requisição com perfil Consulta recebe 403 ao tentar criar um lançamento.

Uma fixture chamada `db_snapshot` atua como fiscal de isolamento: conta as linhas de cada tabela antes e depois de todos os testes. Se qualquer teste criar um registro e esquecer de apagar, a suite inteira falha indicando exatamente qual tabela ficou "suja". Isso impede o acúmulo de dados entre testes que causa resultados inconsistentes dependendo da ordem de execução.

---

## BLOCO 8 — LIMITAÇÕES E TRABALHOS FUTUROS (2 min)

**Fala sugerida:**

Todo projeto tem limitações, e é importante ser honesto sobre elas.

**Limitações atuais conhecidas:**

1. **Sem rate limiting no login:** o endpoint `/auth/token` não tem proteção contra força bruta automatizada. O bcrypt dificulta, mas não impede completamente.

2. **Sem Alembic (migrations):** o projeto usa `create_all()` para criar tabelas. Em produção, alterar um model não aplica a mudança no banco automaticamente — seria necessário `ALTER TABLE` manual. Para um sistema em produção com dados reais, Alembic é indispensável.

3. **CORS em desenvolvimento:** o backend aceita requisições de qualquer origem (`allow_origins=["*"]`). Em produção, isso seria restringido ao domínio do frontend.

4. **Sem frontend de testes:** há 214 testes de backend, mas zero testes de componentes React. Uma regressão no frontend só seria detectada manualmente.

5. **CPF/CNPJ sem criptografia no banco:** o dado é mascarado na exibição, mas armazenado em texto no banco. Em uma versão de produção com requisitos de LGPD rigorosos, seria criptografado com uma chave separada.

**Trabalhos futuros:**

- Autenticação de dois fatores com TOTP
- Relatórios exportáveis em PDF
- Notificações de vencimento por e-mail (estrutura já existe em `utils/email_sender.py`)
- Alembic para migrations de produção
- Rate limiting no login

---

## BLOCO 9 — CONCLUSÃO (1 min)

**Fala sugerida:**

O AMSI entrega uma solução concreta para um problema real de uma organização comunitária real. O processo do TCC nos forçou a tomar decisões de engenharia justificadas — não apenas "funciona", mas "por que funciona assim e o que seria diferente em outra abordagem".

As principais aprendizagens foram: a importância de separar responsabilidades em camadas testáveis; que segurança não é uma feature adicionada no final, mas uma consequência de escolhas de design; e que 214 testes automatizados passando dão uma confiança na mudança de código que nenhuma revisão manual consegue replicar.

Estamos à disposição para as perguntas da banca. Obrigado.

---

## PONTOS DE ATENÇÃO PARA A APRESENTAÇÃO

- **Não memorize o roteiro** — internalize os conceitos, use o roteiro como âncora
- **Se travar em uma pergunta técnica**, diga: *"Deixa eu rastrear isso no código"* — é melhor que inventar
- **Para perguntas de negócio**, sempre volte para o problema original: planilha Excel → problema real → o que o sistema resolve
- **Para críticas às limitações**, antecipe: *"Reconhecemos que X é uma limitação — em produção faríamos Y por causa de Z"*
- Lembre que a banca quer ver que você **entende o que fez**, não que você memorizou respostas

---

## TRANSIÇÕES RECOMENDADAS

| De | Para | Frase de transição |
|---|---|---|
| Problema | Solução | *"Com esses quatro problemas identificados, o requisito do sistema ficou claro..."* |
| Solução | Arquitetura | *"Para construir isso, precisamos justificar cada escolha técnica..."* |
| Arquitetura | Funcionalidades | *"Na prática, como essas decisões se traduzem em uso real?"* |
| Funcionalidades | Segurança | *"Um sistema que gerencia dados financeiros e CPFs tem obrigação de ser seguro..."* |
| Segurança | Testes | *"Como garantimos que essas proteções funcionam de fato?"* |
| Testes | Limitações | *"214 testes passando não significa sistema perfeito..."* |
| Limitações | Conclusão | *"Com esse panorama, o que o projeto entregou de verdade?"* |
