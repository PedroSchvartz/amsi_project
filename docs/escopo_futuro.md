# Escopo Futuro — AMSI Project

Documento de referência para funcionalidades planejadas, melhorias técnicas e otimizações futuras do sistema AMSI. Itens ordenados por área, não por prioridade.

---

## 1. Infraestrutura de Testes

### 1.1 Aceleração do pytest com `ThreadManager`

**Contexto**

A suite de testes atual roda sequencialmente. Quando executada via `railway run` (banco remoto), cada query tem ~100–150ms de latência de rede, resultando em 8–12 minutos para as 244+ asserções. Localmente, com banco na memória, leva menos de 30 segundos.

O gargalo é I/O-bound (espera de resposta do banco) — exatamente o perfil onde `ThreadManager(tipo='io')` traz ganho real: enquanto uma thread aguarda resposta SQL, outras avançam suas próprias queries.

**Abordagem proposta**

1. **Agrupar os módulos de teste por independência de estado:** módulos que não compartilham fixtures com escrita (`test_tipo_conta`, `test_contato`, `test_endereco`, `test_lancamento`, etc.) podem rodar em paralelo sem conflito.

2. **Criar um runner customizado** (`tests/runner_paralelo.py`) que:
   - Descobre os módulos de teste com `pytest.collect`
   - Classifica cada módulo como `paralelo` (sem dependência de estado compartilhado) ou `sequencial` (fixtures que escrevem dados base usados por outros módulos)
   - Usa `ThreadManager(tipo='io', max_cap=8)` para submeter os grupos paralelos
   - Aguarda com `manager.join_all()` e então roda os sequenciais em ordem

3. **Isolamento de sessão por thread:** cada thread instancia seu próprio `TestClient(app)` e `SessionLocal()` — não compartilhar client nem db entre threads.

4. **Snapshot de banco por thread:** o `db_snapshot` atual é `scope="session"` global. Na versão paralela, cada thread registra seu snapshot antes/depois e reporta divergências individuais ao finalizar.

**Ganho esperado**

Com 8 threads paralelas e latência de 100ms por query:
- Sequencial: ~10 min
- Paralelo (grupos independentes): ~2–3 min

**Limitações conhecidas**

- Testes que dependem de `usuario_base`, `clifor_base` e `tipo_lancamento_base` precisam continuar sequenciais entre si (esses fixtures têm dependência em cadeia).
- `test_auth.py` e `test_permissoes.py` modificam estado do usuário admin — devem rodar em grupo isolado, após os demais.
- O `db_snapshot` global precisa ser desativado no modo paralelo e substituído pelo snapshot por thread.

---

## 2. Funcionalidades de Produto

### 2.1 Notificações em tempo real
- WebSocket ou SSE para notificar usuários sobre novos lançamentos vencidos ou alterações feitas por outros usuários na mesma sessão.

### 2.2 Relatórios exportáveis
- Exportação de lançamentos, resumos financeiros e inadimplência em PDF e XLSX.
- Filtros de período configuráveis pelo usuário no momento da exportação.

### 2.3 Dashboard financeiro avançado
- Gráfico de fluxo de caixa (receita x despesa por período)
- Projeção de inadimplência futura com base em vencimentos abertos
- Comparativo mês a mês

### 2.4 Perfil de acesso granular
- Atualmente RBAC com 3 níveis fixos (Admin / Operador / Consulta).
- Evolução: permissões por recurso (ex: Operador pode ver lançamentos mas não exportar).

### 2.5 Auditoria de lançamentos
- Histórico de alterações por lançamento (quem criou, quem editou, quando, o que mudou).
- Atualmente apenas o `log_atividade` registra ações por rota, não diff de campos.

---

## 3. Melhorias Técnicas

### 3.1 Variáveis de ambiente do admin de teste via env var
- O `conftest.py` atualmente hardcoda `senha: "opedro"` para o admin.
- Mover para `ADMIN_TESTE_EMAIL` e `ADMIN_TESTE_SENHA` em `config.py` (mesma convenção dos usuários de teste existentes).
- Permite trocar a senha sem alterar código.

### 3.2 Separação de banco de teste
- Criar um banco `railway_test` separado no Railway (ou SQLite em memória para CI local).
- Evitar que a suite de testes polua o banco de produção com dados temporários.

### 3.3 CI/CD automatizado
- GitHub Actions acionado em push para `main`:
  - Roda pytest localmente (banco SQLite em memória)
  - Se passar, aciona `railway up` automaticamente
  - Notifica resultado via email ou Slack

### 3.4 Rate limiting nas rotas de autenticação
- `/auth/token` sem rate limit é vulnerável a brute force.
- Implementar limite por IP (ex: 10 tentativas/minuto) usando middleware ou Redis.

### 3.5 Remoção do `@sveltejs/adapter-vercel` desnecessário
- Pacote foi adicionado durante troubleshooting de deploy e nunca utilizado (`svelte.config.js` ainda usa `adapter-auto`).
- Remover de `package.json` para reduzir tamanho do bundle de instalação.

---

## 4. Deploy e Operação

### 4.1 Variável `APP_ENV` obrigatória no checklist de deploy
- Garantir que a skill `/deploy` bloqueie se `APP_ENV != production` no Railway.
- Atualmente verificada mas não bloqueante se esquecida.

### 4.2 Bootstrap como comando Railway
- Adicionar `railway run python utils/bootstrap.py` como etapa explícita do fluxo de deploy na skill `/deploy` (Fase 3, pós-healthcheck).
- Tornar idempotente: já é, mas documentar que pode ser rodado a qualquer momento sem risco.

### 4.3 URL canônica do frontend
- Configurar domínio customizado no Vercel (ex: `amsi.com.br`) em vez de `amsi-frontend.vercel.app`.
- Atualizar `FRONTEND_URL` no Railway após configurar o domínio.

---

## 5. Expansão de Proposta

> Cada item desta seção representa uma mudança de escopo significativa e merece planejamento dedicado em sessão própria antes de qualquer implementação.

### 5.1 Plataforma multi-associação

Atualmente o sistema é construído para gerenciar exclusivamente a AMSI (Associação de Moradores de Santa Isabel). A visão de longo prazo é transformá-lo em uma plataforma capaz de atender múltiplas associações de moradores independentes, cada uma com seus próprios usuários, lançamentos e configurações.

**O que muda na arquitetura:**
- Introdução de uma entidade `Associacao` no modelo de dados, à qual todos os recursos existentes (usuários, clientes/fornecedores, lançamentos, tipos de conta) passam a ser vinculados via chave estrangeira.
- Isolamento total de dados entre associações — nenhum usuário de uma associação enxerga dados de outra.
- Novo perfil de acesso `Super Admin` (acima de Administrador): gerencia associações, cria e desativa instâncias, acessa métricas consolidadas entre todas.
- Bootstrap multi-tenant: cada nova associação recebe seu próprio admin inicial via fluxo de onboarding.

**Impacto no deploy:**
- Um único backend Railway serve todas as associações (banco compartilhado com isolamento por `id_associacao`).
- Alternativa: deploy isolado por associação (mais simples operacionalmente, mais caro em infraestrutura).

**Pontos de atenção:**
- Migração do banco atual (AMSI) para o modelo multi-tenant sem perda de dados.
- Revisão completa das permissões RBAC para incluir o escopo da associação em cada verificação.
- Plano de precificação por associação (gratuito, plano básico, plano completo).

---

### 5.2 Geração de boletos automática

Como parte da expansão multi-associação, o sistema passará a gerar boletos bancários vinculados aos lançamentos de crédito em aberto — permitindo que a associação envie cobranças formais aos associados sem processo manual.

**Comportamento esperado:**
- A partir de um lançamento de crédito em aberto, o Admin ou Operador aciona a geração do boleto.
- O boleto é gerado com os dados do clifor, valor, vencimento e código de barras válido.
- O documento é enviado automaticamente por email ao clifor e fica disponível para download no sistema.
- Ao quitar o lançamento, o boleto é marcado como pago.

**Pontos de atenção:**
- Requer integração com uma API bancária ou gateway de boletos (ex: Banco do Brasil, Sicoob, Asaas, Pagar.me).
- A escolha da instituição depende da conta bancária da associação.
- Merece sessão de planejamento dedicada para definir provedor e modelo de integração.

---

## 6. Geração de Lançamentos em Massa e Recorrentes

> Merece planejamento dedicado em sessão própria antes de qualquer implementação.

### 6.1 Criação em massa

Funcionalidade que permite criar múltiplos lançamentos de uma só vez a partir de um template configurável — útil para cobranças pontuais que se aplicam a um conjunto de associados.

**Comportamento esperado:**
- O usuário define um template de lançamento: natureza (débito/crédito/estorno), valor, tipo de conta, vencimento base e descrição.
- Seleciona um conjunto de clientes/fornecedores (por filtro: todos, inadimplentes, ativos, por tipo, etc.).
- O sistema gera um lançamento individual para cada clifor selecionado, com vencimento calculado a partir da data base (ex: todo dia 10 do mês corrente).
- Preview antes de confirmar: exibe a lista de lançamentos que serão criados, com totais.
- Rollback em caso de falha parcial: se algum lançamento falhar durante a criação em lote, os já criados são desfeitos (transação atômica).

**Implementação técnica sugerida:**
- Novo endpoint `POST /lancamento/massa` recebendo template + lista de `id_clifor`.
- Usar `ThreadManager(tipo='io')` para criar os lançamentos em paralelo, respeitando o limite de conexões do banco.
- Retornar relatório de resultado: quantos criados, quantos falharam e por quê.

### 6.2 Lançamentos recorrentes

Extensão natural da criação em massa: em vez de acionar manualmente todo mês, o Admin configura uma regra de recorrência e o sistema gera os lançamentos automaticamente na data definida.

**Comportamento esperado:**
- O Admin define um template recorrente com frequência (mensal, bimestral, anual), dia de vencimento e clifors-alvo.
- Na data configurada, o sistema gera automaticamente os lançamentos sem intervenção manual.
- O Admin recebe um email de confirmação listando o que foi gerado.
- É possível pausar, editar ou encerrar uma recorrência a qualquer momento.
- Lançamentos gerados por recorrência ficam marcados com a origem (`recorrente`) para rastreabilidade.

**Implementação técnica sugerida:**
- Tabela `lancamento_recorrente` com template, regra de frequência e próxima data de execução.
- Job agendado (APScheduler ou Railway Cron) que roda diariamente e verifica quais templates devem disparar naquele dia.
- Reutiliza a lógica de criação em massa (6.1) internamente.

---

## 7. Portal do Associado

> Merece planejamento dedicado em sessão própria antes de qualquer implementação.

### 7.1 Visualização do próprio clifor

Usuários que possuem um clifor vinculado à sua conta terão acesso a uma área de autoatendimento onde podem visualizar sua própria situação financeira com a associação — sem depender do Admin para consultar informações básicas.

**O que o associado pode ver:**
- Seus lançamentos em aberto e quitados, com valores e vencimentos.
- Situação de inadimplência.
- Comprovantes anexados aos lançamentos quitados.
- Boletos disponíveis para download (quando a funcionalidade 5.2 estiver ativa).

**O que o associado não pode ver:**
- Lançamentos de outros clifors.
- Dados financeiros globais da associação.
- Usuários do sistema.

**Implementação técnica sugerida:**
- Novo endpoint `GET /minha-conta` que retorna os lançamentos do clifor vinculado ao usuário autenticado.
- A vinculação clifor ↔ usuário já existe no modelo atual — basta expor os dados filtrados.
- Frontend: nova rota `/minha-conta` acessível a todos os perfis (Consulta, Operador, Admin).

### 7.2 Notificações configuráveis pelo próprio usuário

Usuários com clifor vinculado poderão optar por receber notificações por email sobre movimentações na sua conta — de forma opt-in, sem que o Admin precise configurar nada.

**Notificações disponíveis:**
- Novo lançamento criado em seu nome.
- Lançamento próximo do vencimento (X dias antes, configurável).
- Lançamento vencido e ainda em aberto.
- Lançamento quitado (confirmação de pagamento registrado).

**Comportamento:**
- Na tela de perfil do usuário, um painel de preferências permite ativar/desativar cada tipo de notificação individualmente.
- A preferência é salva no modelo `Usuario` (campo `notificacao` já existe — expandir para granularidade por tipo de evento).
- O envio usa a infraestrutura de email já existente (`enviar_email`).

---

## 8. Relatórios

### 8.1 Relatório de atividade financeira em PDF

Geração de um documento PDF discriminando toda a movimentação financeira da associação em um período, com o objetivo de transparência para os associados e prestação de contas da diretoria.

**Conteúdo esperado do documento:**
- Cabeçalho com nome da associação, período do relatório e data de geração.
- Resumo executivo: total recebido, total pago, saldo do período, total de inadimplência em aberto.
- Seção de entradas (créditos): lançamentos discriminados por tipo de conta, com nome do clifor, valor, data de vencimento e status (quitado/aberto).
- Seção de saídas (débitos): mesma estrutura das entradas.
- Seção de inadimplência: clifors com lançamentos de crédito vencidos e ainda abertos, com valor acumulado por clifor.
- Totais por tipo de conta (onde foi gasto / de onde veio cada real).
- Rodapé com assinatura eletrônica do administrador que gerou o relatório.

**Implementação técnica sugerida:**
- Biblioteca `reportlab` ou `weasyprint` no backend para geração do PDF.
- Novo endpoint `GET /relatorio/atividade?periodo_inicio=&periodo_fim=` restrito a Admin.
- Retorna o PDF como `application/pdf` para download direto pelo navegador.
- O frontend oferece um seletor de período e botão "Gerar PDF".

---

## 9. Distribuição

> Cada item desta seção merece planejamento dedicado em sessão própria antes de qualquer implementação.

### 9.1 App mobile (PWA)

O frontend React já é estruturalmente compatível com Progressive Web App. Com ajustes pontuais, o sistema pode ser instalado como app no celular (Android e iOS) sem necessidade de publicação em loja.

**O que habilitar:**
- `manifest.json` com ícone, nome e cor de tema da AMSI.
- Service Worker para cache offline das telas principais (dashboard, lista de lançamentos).
- Ícone de "Instalar app" na tela de login.

**Benefício imediato:** associados e operadores acessam o sistema pelo celular com a mesma experiência do desktop, sem depender do browser.

**Limitações do PWA vs app nativo:**
- Notificações push dependem de suporte do navegador (Chrome/Android funciona bem; iOS tem restrições).
- Acesso a câmera (para foto de comprovante) funciona via PWA mas com menos controle que nativo.

### 9.2 Integração PIX

Permitir que associados paguem seus lançamentos via PIX gerado pelo próprio sistema, com conciliação automática ao receber a confirmação de pagamento.

**Comportamento esperado:**
- A partir de um lançamento em aberto no portal do associado (7.1), um botão "Pagar via PIX" gera um QR Code com valor e chave da associação.
- Ao confirmar o pagamento via webhook do gateway, o lançamento é automaticamente quitado e o comprovante de PIX anexado.
- O Admin vê a baixa no dashboard em tempo real.

**Implementação técnica sugerida:**
- Integração com gateway que suporte PIX (Asaas, Pagar.me, Gerencianet/Efí).
- Webhook `POST /pagamento/pix/callback` recebe confirmação e aciona a quitação.
- Complementa a geração de boletos (5.2) — o associado escolhe a forma de pagamento preferida.

---

*Última atualização: 2026-06-03*
