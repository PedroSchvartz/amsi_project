================================================================================
  AMSI PROJECT — RESUMO DE SESSÃO
================================================================================

DATA: 2026-05-19 (03h00) → 2026-05-20 (03h00)
AUTOR: PedroSchvartz + Claude Sonnet 4.6

--------------------------------------------------------------------------------
  COMMITS DO DIA
--------------------------------------------------------------------------------

  cdbdc71  docs: guia de instalação local (SETUP.md)              02:55
  845ba59  docs: guia técnico para estudantes de SI (8 arquivos)  03:13
  36ba05b  docs: segunda iteração dos guias técnicos              11:47
  a9e5bcc  docs: terceira iteração — 4 padrões não óbvios         12:54

  Pendente de commit: 14 correções de QA (13 arquivos alterados)

--------------------------------------------------------------------------------
  1. DOCUMENTAÇÃO TÉCNICA — docs/ (4 commits, ~2.200 linhas)
--------------------------------------------------------------------------------

  SETUP.md (novo)
    - Guia de instalação local completo: dependências, banco, config.env,
      variáveis de ambiente, como subir backend e frontend
    - Cobre Windows e ambientes Unix

  docs/00_indice.md (novo)
    - Índice com mapa de navegação dos 8 arquivos
    - Critério de conclusão: 14 perguntas ao final do guia

  docs/01_visao_geral.md (novo + expandido)
    - O que é o sistema, quem usa, como as partes se conectam
    - Seção "Vocabulário do domínio": Lançamento, Clifor, Natureza,
      Inadimplência, Estorno, Efetivar — termos de negócio explicados
      para quem não conhece o contexto da associação

  docs/02_stack.md (novo)
    - Justificativa de cada tecnologia: FastAPI, SQLAlchemy, PostgreSQL,
      React, Vite, JWT

  docs/03_backend.md (novo + expandido)
    - Estrutura de pastas (models/schemas/routes/auth/utils/tests)
    - Explicação de relationship() e lazy loading
    - Problema N+1 e por que joinedload existe
    - Como uma requisição atravessa o backend (passo a passo)
    - Como adicionar um novo campo a um lançamento
    - Testes automatizados com pytest:
      - Como rodar, estrutura de um teste
      - Fixtures compartilhadas (client, client_admin, client_operador)
      - db_snapshot: fiscal que garante banco limpo após os testes
      - Teardown em cascata: ordem correta de deleção respeitando FK

  docs/04_autenticacao.md (novo + expandido)
    - JWT: payload em Base64 (não criptografado), o que garante é integridade
    - "Stateless" vs "sem estado no banco" — distinção importante
    - Fluxo completo de login (6 passos)
    - Três formas de desativar um usuário:
        exclusao  — soft delete com timestamp, dado preservado para auditoria
        suspenso  — suspensão temporária, expira automaticamente por data
        bloqueado — booleano, requer ação humana para reverter
    - Sessão deslizante (sliding session) via X-Session-Expires
    - Sistema de permissões: hierarquia Consulta < Operador < Administrador

  docs/05_frontend.md (novo)
    - Organização do React: pages vs components vs services vs styles
    - Roteamento com React Router v7 e PrivateRoute
    - Como api.js funciona: fetchComLoading, handleResponse, interceptação de 401

  docs/06_fluxo_completo.md (novo + expandido)
    - Rastrear um clique do browser até o banco e de volta
    - Seção "E quando algo dá errado?": fluxos de 401, 403, 422 e 404
    - Tabela de status HTTP com o que cada um significa no sistema
    - 14 perguntas de verificação no final

  docs/07_glossario.md (novo)
    - Definições rápidas dos termos técnicos usados no projeto

  docs/08_padroes_nao_obvios.md (novo)
    - loadingBus singleton: como api.js ativa o spinner sem ser React
      (funções vazias substituídas pelo LoadingProvider via useEffect)
    - storage event: localStorage.clear() → e.key === null → multi-tab logout
    - FormData vs JSON: arquivos binários exigem multipart/form-data,
      backend usa UploadFile em vez de Body
    - (str, Enum): herança dupla torna enum JSON-serializável como string pura

--------------------------------------------------------------------------------
  2. CORREÇÕES DE QA — 13 itens (pendente commit)
--------------------------------------------------------------------------------

  Metodologia: agente Claude com acesso ao browser testou o sistema e gerou
  relatório com 22 itens. Após triagem com Pedro, 13 foram corrigidos.

  BUG-01 — Efetivar lançamento sem data de pagamento
    Antes: submit passava com data_pagamento null, lançamento era "fechado"
           sem data registrada
    Depois: frontend bloqueia (toast "Informe a data de pagamento.")
            backend retorna 422 se data_pagamento vier null
    Arquivos: ListaLancamentosPage.jsx, backend/routes/lancamento.py

  BUG-09 — Admin podia remover a própria conta
    Antes: botão de lixeira funcionava para qualquer usuário, incluindo o logado
    Depois: compara id do usuário a remover com meuId (getUserFromToken().sub),
            exibe toast de aviso e não abre o modal de confirmação
    Arquivo: UserList.jsx

  VAL-02 — Novo Lançamento sem campos obrigatórios
    Antes: formulário vazio podia ser submetido (só validação nativa do browser)
    Depois: validação JS antes do submit — clifor, tipo_conta, valor > 0,
            data_vencimento; cada campo faltando gera toast específico
    Arquivo: LancamentoModal.jsx

  VAL-03 — CPF/CNPJ vazio vs inválido com mesma mensagem
    Antes: campo vazio e campo com valor inválido exibiam "CPF inválido."
    Depois: campo vazio → "CPF obrigatório." / valor inválido → "CPF inválido."
            Mesmo padrão para CNPJ
    Arquivos: ClientRegister.jsx, ClientEdit.jsx

  VAL-05 — E-mail inválido no cadastro de usuário
    Antes: só validação nativa do browser (type="email")
    Depois: regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/ antes do submit
    Arquivo: UserRegisterModal.jsx

  VAL-06 — Bloquear usuário sem etapa de confirmação
    Antes: marcar "Bloqueado" e clicar Salvar executava imediatamente
    Depois: intercepta mudança false→true, exibe ModalConfirm "Bloquear usuário"
            antes de persistir; cancelar mantém modal aberto sem salvar
    Arquivo: UserEditModal.jsx

  UX-02 — Nome na topbar exibia ID numérico do usuário como fallback
    Antes: nomeUsuario = usuarioLocal?.nome || payload?.sub || 'Usuário'
           se localStorage vazio, exibia o ID (ex: "42") em vez do nome
    Depois: fallback vai direto para 'Usuário', sem expor o ID
    Arquivo: Layout.jsx

  UX-04 — Usuários bloqueados invisíveis na lista
    Antes: nenhum indicador visual de bloqueio na tabela
    Depois: badge vermelho "Bloqueado" inline ao lado do nome na linha
    Arquivo: UserList.jsx

  UX-05 — Campo Natureza sem explicação de por que é read-only
    Antes: input sem title, usuário não entendia o campo
    Depois: title="Preenchido automaticamente ao selecionar o Tipo de Conta"
    Arquivo: LancamentoModal.jsx

  UX-06 — Colunas Status e Ações sem tooltip na tabela de lançamentos
    Antes: 8 de 10 colunas tinham data-tooltip, Status e Ações não tinham
    Depois: data-tooltip adicionado em ambas
    Arquivo: ListaLancamentosPage.jsx

  PERM-01 — Perfil Consulta sem acesso às telas principais
    Antes: Consulta recebia menu vazio e 403 em /dashboard, /lancamentos,
           /cliente_fornecedor
    Depois (conjunto de 7 mudanças):
      App.jsx
        - /dashboard, /lancamentos, /cliente_fornecedor: minPerfil="Consulta"
      Layout.jsx
        - menuLinks inclui Consulta para as 3 rotas acima
        - isConsulta() importado de auth.js
      ClientList.jsx
        - "+ Novo" e "Editar" ocultos para Consulta
        - CPF/CNPJ sempre mascarado para Consulta, sem click-to-reveal
      ListaLancamentosPage.jsx
        - "+ Novo Lançamento" oculto para Consulta (hasPerfilMinimo('Operador'))
        - CPF/CNPJ mascarado por padrão para todos
        - Click-to-reveal habilitado para Operador/Admin
      backend/routes/lancamento.py
        - GET /lancamento/: trocou exige_operador_ou_admin → get_current_user
          (Consulta consegue listar lançamentos; escrita continua restrita)
      PerfilCompletoPopup.jsx
        - Consulta pode abrir o próprio perfil e ver clifor vinculado
        - Botões "Desvincular" e seção de associação ocultos para Consulta
        - getSugestaoClifor não é chamado para Consulta
      backend/routes/usuario.py
        - GET /{id_usuario}/clifor: trocou exige_admin → get_current_user
          com guarda self-or-admin (Consulta só lê o próprio clifor)

--------------------------------------------------------------------------------
  RESULTADO DOS TESTES (QA com browser)
--------------------------------------------------------------------------------

  Rodada 1: 21/22 PASS — FAIL em PERM-01d (botão + Novo Lançamento visível
            para Consulta; tabela vazia por 403 no GET /lancamento/)
  Rodada 2: 5/5 PASS — PERM-01d totalmente corrigido

  Itens que o QA não testou (fora do roteiro): perfil Consulta tentando abrir
  o próprio PerfilCompletoPopup — corrigido após observação do Pedro.

  Itens explicitamente não corrigidos (decisão do Pedro):
    BUG-02 — Marcador __seed__ no nome de usuário: é intencional
    VAL-04 — Toast avalanche ao submeter formulário inválido: comportamento desejado
    UX-07 — Item já implementado (QA testou versão antiga)
    UX-08 — Parte do esforço mobile (adiado)

--------------------------------------------------------------------------------
  ESTADO DOS TESTES AUTOMATIZADOS (backend)
--------------------------------------------------------------------------------

  Antes da sessão: 201 testes passando (conforme commit 10439f6)
  Impacto das mudanças desta sessão:
    - GET /lancamento/ agora usa get_current_user → testes existentes continuam
      passando (exige_operador_ou_admin era o guard; client_operador e
      client_admin continuam funcionando)
    - GET /{id_usuario}/clifor agora usa self-or-admin → testes que usam
      client_admin continuam funcionando
  Recomendado: rodar pytest após commit para confirmar

--------------------------------------------------------------------------------
  ARQUIVOS ALTERADOS (pendente commit)
--------------------------------------------------------------------------------

  AMSI_Frontend/src/App.jsx
  AMSI_Frontend/src/components/ClientEdit.jsx
  AMSI_Frontend/src/components/ClientList.jsx
  AMSI_Frontend/src/components/ClientRegister.jsx
  AMSI_Frontend/src/components/LancamentoModal.jsx
  AMSI_Frontend/src/components/Layout.jsx
  AMSI_Frontend/src/components/PerfilCompletoPopup.jsx
  AMSI_Frontend/src/components/UserEditModal.jsx
  AMSI_Frontend/src/components/UserList.jsx
  AMSI_Frontend/src/components/UserRegisterModal.jsx
  AMSI_Frontend/src/pages/ListaLancamentosPage.jsx
  backend/routes/lancamento.py
  backend/routes/usuario.py

================================================================================
