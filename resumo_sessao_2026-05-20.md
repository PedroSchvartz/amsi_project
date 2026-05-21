================================================================================
  AMSI PROJECT — RESUMO DE SESSÃO
================================================================================

DATA: 2026-05-20 (04h00) → 2026-05-21 (02h00)
AUTOR: PedroSchvartz + Claude Sonnet 4.6

--------------------------------------------------------------------------------
  COMMITS DO DIA
--------------------------------------------------------------------------------

  b3d3a10  fix: 13 correções de QA — validações, permissões Consulta e UX   12:14
  535828f  fix: ajustes pós-testes — 214/214 passando                        12:30
  cd0f5cd  docs: atualiza docs/ para refletir permissões PERM-01             13:28
  523491b  feat: saldo split, cargo Presidente, testes de segurança e UX     01:33

  Total: 35 arquivos alterados, ~1.800 linhas líquidas de mudança

--------------------------------------------------------------------------------
  1. CORREÇÕES DE QA FINALIZADAS — commits b3d3a10 + 535828f
--------------------------------------------------------------------------------

  (Correções iniciadas na sessão anterior, commitadas e estabilizadas agora)

  BUG-01 — Efetivar lançamento sem data de pagamento
    Antes:  submit passava com data_pagamento null, mesmo sem data registrada
    Depois: frontend bloqueia com toast; backend retorna 422 se data_pagamento
            vier como null explícito (ajuste fino em 535828f: só rejeita quando
            o campo é enviado — não bloqueia {"estorno": true} sem data)
    Arquivos: ListaLancamentosPage.jsx, backend/routes/lancamento.py

  BUG-09 — Admin podia remover a própria conta
    Antes:  botão de lixeira funcionava inclusive para o usuário logado
    Depois: compara id_usuario com meuId (getUserFromToken().sub),
            exibe toast de aviso e não abre o modal
    Arquivo: UserList.jsx

  VAL-02 — Novo Lançamento sem campos obrigatórios
    Antes:  formulário vazio podia ser submetido
    Depois: validação JS antes do submit — clifor, tipo, valor > 0, data
    Arquivo: LancamentoModal.jsx

  VAL-03 — CPF/CNPJ vazio vs inválido com a mesma mensagem
    Antes:  ambos exibiam "CPF inválido."
    Depois: campo vazio → "CPF obrigatório." / inválido → "CPF inválido."
    Arquivos: ClientRegister.jsx, ClientEdit.jsx

  VAL-05 — E-mail inválido no cadastro de usuário
    Antes:  só validação nativa do browser (type="email")
    Depois: regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/ antes do submit
    Arquivo: UserRegisterModal.jsx

  VAL-06 — Bloquear usuário sem etapa de confirmação
    Antes:  marcar "Bloqueado" e salvar executava imediatamente
    Depois: intercepta mudança false→true, exibe ModalConfirm antes de persistir
    Arquivo: UserEditModal.jsx

  UX-02 — Topbar exibia o ID numérico do usuário como fallback
    Antes:  || payload?.sub || 'Usuário' expunha o ID (ex: "42")
    Depois: fallback vai direto para 'Usuário'
    Arquivo: Layout.jsx

  UX-04 — Badge "Bloqueado" ausente na lista de usuários
    Antes:  nenhum indicador visual de bloqueio
    Depois: badge vermelho "Bloqueado" inline ao lado do nome
    Arquivo: UserList.jsx

  UX-05 — Campo Natureza sem explicação de por que é read-only
    Depois: title="Preenchido automaticamente ao selecionar o Tipo de Conta"
    Arquivo: LancamentoModal.jsx

  UX-06 — Colunas Status e Ações sem tooltip
    Depois: data-tooltip adicionado em ambas as colunas
    Arquivo: ListaLancamentosPage.jsx

  PERM-01 — Perfil Consulta sem acesso às telas principais
    App.jsx: /dashboard, /lancamentos, /cliente_fornecedor abertos para Consulta
    Layout.jsx: menu inclui Consulta nas 3 rotas
    ClientList.jsx: "+ Novo" e "Editar" ocultos; CPF/CNPJ mascarado para Consulta
    ListaLancamentosPage.jsx: "+ Novo" oculto; CPF/CNPJ mascarado com
        click-to-reveal para Operador/Admin
    GET /lancamento/: get_current_user em vez de exige_operador_ou_admin
    PerfilCompletoPopup.jsx: Consulta vê o próprio perfil sem vincular/desvincular
    GET /{id}/clifor: liberado para self-or-admin

  Ajuste de teste (535828f):
    - test_permissoes.py: teste renomeado de proibido→permitido_consulta
    - test_cliente_fornecedor.py: ordenação usa locale pt_BR (acentos corretos)

  Estado dos testes: 214/214 passando

--------------------------------------------------------------------------------
  2. DOCUMENTAÇÃO — commit cd0f5cd
--------------------------------------------------------------------------------

  docs/01_visao_geral.md  — tabela de perfis indica quais telas Consulta acessa
  docs/02_stack.md        — minPerfil="Consulta" para /lancamentos
  docs/03_backend.md      — get_current_user no exemplo de GET /lancamento/
  docs/04_autenticacao.md — permissões PERM-01 detalhadas
  docs/05_frontend.md     — minPerfil="Consulta" atualizado
  docs/08_padroes_nao_obvios.md
    - Seção 5 nova: padrão CPF/CNPJ mascarado por perfil
      (mascarar + click-to-reveal para Operador/Admin, sempre mascarado para Consulta)
  backend/openapi_ai.yaml — campo cpf_cnpj_clifor adicionado ao schema de lançamento

--------------------------------------------------------------------------------
  3. SALDO SPLIT — ClientList (commit 523491b)
--------------------------------------------------------------------------------

  Antes: coluna única "Saldo" com valor líquido
  Depois:
    - Duas colunas: "A Receber" (verde) e "A Pagar" (vermelho)
    - Cada header tem ícone ℹ com tooltip CSS explicando o significado
    - Clique na linha da tabela abre CliforResumoPopup

  CliforResumoPopup.jsx (novo componente)
    - Consome GET /cliente_fornecedor/{id}/resumo
    - Exibe cards: A Receber, A Pagar, Saldo Líquido
    - Detalha vencidos (a receber vencido, a pagar vencido)
    - Quantidade em aberto e vencidos por categoria
    - Fecha com ✕, botão "Fechar" ou clique no overlay

  clientList.css — estilos novos para:
    - .cl-th-info: wrapper do header com tooltip
    - .cl-th-icon: ícone ℹ com opacidade
    - .cl-tooltip-box: tooltip posicionado com transição de opacidade
    - .cl-row-clicavel: cursor pointer nas linhas

--------------------------------------------------------------------------------
  4. CARGO PRESIDENTE — commit 523491b
--------------------------------------------------------------------------------

  Problema: "Presidente" não estava em nenhum enum, causava 500 + CORS sumiço

  Correções:
    backend/schemas/usuario.py  — Presidente adicionado ao CargoEnum Pydantic
    backend/models/usuario.py   — Presidente adicionado ao CargoEnum SQLAlchemy
    PostgreSQL                  — ALTER TYPE cargo_enum ADD VALUE 'Presidente'
                                  (executado via script Python com SQLAlchemy)

  Frontend — 4 arquivos padronizados com lista completa:
    UserEditModal.jsx     — faltava Diretor
    UserRegisterModal.jsx — faltava Diretor
    UserRegister.jsx      — faltava Diretor e Desenvolvedor
    DemoRegistroPage.jsx  — faltava Presidente

  Ordem final: Presidente → Diretor → Tesoureiro → Secretário →
               Conselheiro → Associado → Desenvolvedor

--------------------------------------------------------------------------------
  5. BUGFIXES DE BACKEND — commit 523491b
--------------------------------------------------------------------------------

  Bug: resetar_senha operava em usuários com soft-delete
    Antes:  db.query(Usuario).filter(Usuario.id_usuario == id) — sem filtro de exclusao
    Depois: adiciona Usuario.exclusao == None ao filtro
    Arquivo: backend/routes/usuario.py

  Bug: CORS desaparecia em respostas 500
    Causa:  ServerErrorMiddleware (outermost/auto) capturava exceções não tratadas
            e devolvia plaintext sem passar pelo CORSMiddleware
    Correção: @app.exception_handler(Exception) registrado em main.py —
              opera dentro do CORSMiddleware, garante JSON + headers em todo 500
    Arquivo: backend/main.py

  Schema UsuarioUpdate — campos senha e primeiro_acesso adicionados
    Motivo: PUT /usuarios/{id} ignorava silenciosamente esses campos (Pydantic
            descartava por não estarem no schema), impossibilitando definir
            senha conhecida via admin nos testes
    Arquivo: backend/schemas/usuario.py
    Nota:   atualizar_usuario já tinha lógica de hash_senha — só faltava
            o campo no schema para chegar ao handler

--------------------------------------------------------------------------------
  6. UX DE PRIMEIRO ACESSO — commit 523491b
--------------------------------------------------------------------------------

  Link do e-mail de boas-vindas:
    {FRONTEND_URL}?email={email}&redirect=/trocar-senha?senha={senha_provisoria}

  Login.jsx — pré-preenche senha do campo de login
    Antes:  email preenchido, senha vazia (usuário precisava digitar a provisória)
    Depois: extrai senha do parâmetro redirect; campo login já vem preenchido
    Fluxo:  usuário clica no link → clica "Entrar" → TrocarSenhaPage com
            "Senha atual" também preenchida → só digita nova senha 2x

  TrocarSenhaPage.jsx — retorna ao login com email preenchido
    Antes:  logout() → navigate('/')  — campo email vazio
    Depois: lê email do localStorage antes de logout() (que chama localStorage.clear())
            → navigate('/?email=...') — campo email pré-preenchido

  UserList.jsx — modais de confirmação exibem nome do usuário
    Antes:  estados guardavam só o id_usuario; mensagens genéricas
    Depois: estados guardam o objeto completo; mensagens com <strong>{nome}</strong>
      Remover:   "Tem certeza que deseja remover João Silva?"
      Resetar:   "João Silva será obrigado(a) a criar uma nova senha..."
      Restaurar: "João Silva voltará a ter acesso ao sistema..."

  UserRegisterModal.jsx — mensagem de erro de rede melhorada
    Antes:  err.message genérico ou "Erro ao cadastrar usuário"
    Depois: "Não foi possível conectar ao servidor." quando err.message === 'Failed to fetch'

--------------------------------------------------------------------------------
  7. MODO DEMO — commit 523491b
--------------------------------------------------------------------------------

  DemoRegistroPage.jsx (novo)
    - Rota pública /demo-registro
    - Formulário de auto-registro: nome, e-mail, senha, cargo, perfil
    - Consome POST /demo/registro (endpoint existente)
    - Redireciona para login com e-mail preenchido após cadastro

  backend/routes/demo.py (novo, já existia mas não commitado)
    - POST /demo/registro: cria usuário sem exigir autenticação
    - GET /demo/status: informa se o modo demo está ativo
    - Controlado pela variável DEMO_ATIVO no config.env

  backend/tests/test_demo.py (novo)
    - 17 testes cobrindo status, registro, perfil, cargo, validações

--------------------------------------------------------------------------------
  8. SUITE DE TESTES — 247/247 passando (commit 523491b)
--------------------------------------------------------------------------------

  Antes da sessão: 214 testes

  Novos testes adicionados: 33

  test_auth.py (+10 testes)
    Helper _registrar_demo substituído por _criar_usuario_com_senha:
      - Cria via endpoint admin (filtra exclusao == None, sem conflito de email)
      - Idempotente: remove usuário ativo de mesmo email antes de criar
      - Define senha conhecida via PUT (agora possível com schema atualizado)
      - Usa _limpar_usuario no finally para cleanup mesmo em falhas
    test_trocar_senha_senha_atual_errada     — 401 com senha errada
    test_trocar_senha_seta_primeiro_acesso_false — flag resetado após troca
    test_token_invalidado_apos_resetar_senha — token rejeitado após reset admin
    test_token_invalidado_apos_soft_delete   — token rejeitado após exclusão

  test_cliente_fornecedor.py (+3 testes)
    - test_saldos_clifors_retorna_lista: verifica total_a_receber/total_a_pagar
      (não mais saldo_liquido)
    - test_saldos_clifor_calculo: compara saldos endpoint com resumo por clifor
    - test_saldo_clifor_sem_lancamentos_e_zero: clifor sem lançamentos → 0.0/0.0

  test_lancamento.py (+2 testes)
    - test_fechamento_com_multa_e_juros: multa=10.00, juros=5.50 persistem
    - test_fechamento_sem_multa_e_juros_ficam_nulos: None quando não enviados

  test_novos_mvp.py (+6 testes)
    - test_soft_delete_usuario_invisivel_na_listagem
    - test_soft_delete_usuario_aparece_com_incluir_excluidos
    - test_restaurar_usuario
    - test_restaurar_usuario_nao_admin_proibido
    - test_restaurar_usuario_inexistente
    - test_email_reutilizavel_apos_soft_delete

  test_usuario.py (+3 testes)
    - test_buscar_usuario_excluido_retorna_404
    - test_resetar_senha_usuario_excluido_retorna_404
    - test_restaurar_usuario_ja_ativo_retorna_404

  test_permissoes.py (correção)
    - test_login_usuario_excluido: 401 em vez de 403 (soft-delete invisível à query
      de auth → "Email ou senha incorretos" — comportamento correto)

  test_demo.py (novo, 17 testes)
    - TestDemoStatus: status retorna demo_ativo, não exige autenticação
    - TestDemoRegistro: 200 + dados corretos, perfil/cargo padrão e customizável,
      422 para perfil/cargo inválido, permite login imediato, sem obrigação
      de trocar senha, email duplicado → 409, senha curta → 400
    - TestDemoDesacoplamento: guarda de modo demo existe no código

  conftest.py
    - db_snapshot: tabela usuario usa SELECT COUNT(*) WHERE exclusao IS NULL
      (soft-delete mantém a linha no banco; contagem filtrada evita falso alarme)

--------------------------------------------------------------------------------
  VARIÁVEIS DE AMBIENTE RELEVANTES
--------------------------------------------------------------------------------

  FRONTEND_URL   — base do link enviado nos e-mails de boas-vindas e reset de senha
                   (padrão: https://amsi-project-chzs.vercel.app)
                   Setar http://localhost:5173 para testes locais com link funcional

================================================================================
