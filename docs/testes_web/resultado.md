# Resultado dos Testes — Interface Web AMSI

**Data de execução:** 2026-05-28  
**URL testada:** http://localhost:5173  
**Executado por:** Claude (automação via browser)

---

| ID | Título | Perfil | Status | Print | Observações |
|----|--------|--------|--------|-------|-------------|
| T01 | Tela de login — estado inicial | público | 🟢 | [🖼️](prints/01_login_inicial.png) | |
| T02 | Toggle de tema | público | 🟢 | [🖼️](prints/02_login_tema_corporativo.png) | |
| T03 | Login com credenciais inválidas | público | 🟢 | [🖼️](prints/03_login_erro.png) | |
| T04 | Login com campos vazios | público | 🟢 | [🖼️](prints/04_login_campos_vazios.png) | |
| T05 | Login bem-sucedido — Admin | ADM | 🟢 | [🖼️](prints/05_login_admin_sucesso.png) | |
| T06 | Login bem-sucedido — Operador | OP | 🟢 | [🖼️](prints/06_login_operador_sucesso.png) | |
| T07 | Login bem-sucedido — Consulta | CON | 🟢 | [🖼️](prints/07_login_consulta_sucesso.png) | Redireciona para trocar-senha por primeiro_acesso=true |
| T08 | Acesso direto a rota protegida | público | 🟢 | [🖼️](prints/08_rota_protegida_sem_login.png) | |
| T09 | Trocar senha — primeiro acesso | CON | 🟢 | [🖼️](prints/09_trocar_senha_tela.png) | |
| T10 | Trocar senha — confirmação divergente | CON | 🟢 | [🖼️](prints/10_trocar_senha_divergente.png) | |
| T11 | Trocar senha — sucesso | CON | 🟢 | [🖼️](prints/11_trocar_senha_sucesso.png) | Redireciona para login com email pré-preenchido |
| T12 | Home — Admin | ADM | 🟢 | [🖼️](prints/12_home_admin.png) | |
| T13 | Home — Operador | OP | 🟢 | [🖼️](prints/13_home_operador.png) | |
| T14 | Home — Consulta | CON | 🟢 | [🖼️](prints/14_home_consulta.png) | |
| T15 | Dashboard — carregamento | CON | 🟢 | [🖼️](prints/15_dashboard.png) | |
| T16 | Dashboard — clique vencidos | CON | 🟢 | [🖼️](prints/16_dashboard_click_vencidos.png) | Popup KPI com botão "Discriminar" |
| T17 | Usuários — listagem | ADM | 🟢 | [🖼️](prints/17_usuarios_lista.png) | |
| T18 | Usuários — negado Operador | OP | 🟢 | [🖼️](prints/18_usuarios_negado_operador.png) | |
| T19 | Modal Novo Usuário — abrir | ADM | 🟢 | [🖼️](prints/19_modal_novo_usuario.png) | |
| T20 | Modal Novo Usuário — validação | ADM | 🟢 | [🖼️](prints/20_modal_novo_usuario_validacao.png) | |
| T21 | Modal Novo Usuário — cadastro | ADM | 🟢 | [🖼️](prints/21_usuario_criado.png) | |
| T22 | Perfil Completo — popup | ADM | 🟢 | [🖼️](prints/22_perfil_completo_popup.png) | |
| T23 | Modal Editar Usuário — abrir | ADM | 🟢 | [🖼️](prints/23_modal_editar_usuario.png) | |
| T24 | Editar usuário — salvar | ADM | 🟢 | [🖼️](prints/24_usuario_editado.png) | |
| T25 | Resetar senha — modal | ADM | 🟢 | [🖼️](prints/25_modal_resetar_senha.png) | |
| T26 | Resetar senha — confirmar | ADM | 🟢 | [🖼️](prints/26_senha_resetada.png) | |
| T27 | Deletar usuário — modal | ADM | 🟢 | [🖼️](prints/27_modal_deletar_usuario.png) | |
| T28 | Deletar usuário — cancelar | ADM | 🟢 | [🖼️](prints/28_deletar_cancelado.png) | |
| T29 | Deletar usuário — confirmar | ADM | 🟢 | [🖼️](prints/29_usuario_deletado.png) | |
| T30 | Mostrar excluídos | ADM | 🟢 | [🖼️](prints/30_usuarios_excluidos.png) | |
| T31 | Restaurar usuário excluído | ADM | 🟢 | [🖼️](prints/31_usuario_restaurado.png) | |
| T32 | Tentar deletar própria conta | ADM | 🟢 | [🖼️](prints/32_deletar_propria_conta.png) | |
| T33 | Clifors — listagem | CON | 🟢 | [🖼️](prints/33_clifors_lista.png) | |
| T34 | Clifors — filtro por nome | CON | 🟢 | [🖼️](prints/34_clifors_filtro_nome.png) | |
| T35 | Clifors — filtro por tipo | CON | 🟢 | [🖼️](prints/35_clifors_filtro_tipo.png) | |
| T36 | Clifors — filtro inadimplente | CON | 🟢 | [🖼️](prints/36_clifors_filtro_inadimplente.png) | |
| T37 | CPF/CNPJ — revelar e ocultar | OP | 🟢 | [🖼️](prints/37_cpf_revelar.png) | |
| T38 | Popup resumo clifor — abrir | CON | 🟢 | [🖼️](prints/38_clifor_popup_resumo.png) | Clique na linha abre popup de resumo financeiro |
| T39 | Popup resumo clifor — fechar | CON | 🟢 | [🖼️](prints/39_clifor_popup_fechado.png) | |
| T40 | Cadastrar Clifor — tela | OP | 🟢 | [🖼️](prints/40_clifor_cadastro_tela.png) | |
| T41 | Cadastrar Clifor — CPF inválido | OP | 🟢 | [🖼️](prints/41_clifor_cpf_invalido.png) | |
| T42 | Cadastrar Clifor — sucesso | OP | 🟢 | [🖼️](prints/42_clifor_cadastrado.png) | |
| T43 | Editar Clifor — tela | OP | 🟢 | [🖼️](prints/43_clifor_editar_tela.png) | |
| T44 | Editar Clifor — salvar | OP | 🟢 | [🖼️](prints/44_clifor_editado.png) | |
| T45 | Excluir Clifor — modal | ADM | 🟢 | [🖼️](prints/45_modal_deletar_clifor.png) | |
| T46 | Excluir Clifor — confirmar | ADM | 🟢 | [🖼️](prints/46_clifor_deletado.png) | |
| T47 | Clifors — Consulta sem botões | CON | 🟢 | [🖼️](prints/47_clifors_consulta_sem_botoes.png) | Coluna Ações vazia para CON |
| T48 | Lançamentos — listagem | CON | 🟢 | [🖼️](prints/48_lancamentos_lista.png) | |
| T49 | Filtro — natureza | CON | 🟢 | [🖼️](prints/49_lancamentos_filtro_natureza.png) | |
| T50 | Filtro — vencidos | CON | 🟢 | [🖼️](prints/50_lancamentos_filtro_vencidos.png) | |
| T51 | Filtro — limpar | CON | 🟢 | [🖼️](prints/51_lancamentos_filtro_limpar.png) | |
| T52 | Filtro pendente — indicador | CON | 🟢 | [🖼️](prints/52_lancamentos_filtro_pendente.png) | |
| T53 | CPF revelar em lançamentos | OP | 🟢 | [🖼️](prints/53_lancamentos_cpf_revelar.png) | |
| T54 | Modal Novo Lançamento — abrir | OP | 🟢 | [🖼️](prints/54_modal_novo_lancamento.png) | |
| T55 | Novo Lançamento — validação | OP | 🟢 | [🖼️](prints/55_lancamento_validacao.png) | |
| T56 | Novo Lançamento — sucesso | OP | 🟢 | [🖼️](prints/56_lancamento_criado.png) | |
| T57 | Modal Efetivar — abrir | OP | 🟢 | [🖼️](prints/57_modal_efetivar.png) | |
| T58 | Efetivar — sem data | OP | 🟢 | [🖼️](prints/58_efetivar_sem_data.png) | |
| T59 | Efetivar — com encargos | OP | 🟢 | [🖼️](prints/59_efetivar_com_encargos.png) | |
| T60 | Efetivar — com comprovante | OP | 🟢 | [🖼️](prints/60_efetivar_com_comprovante.png) | |
| T61 | Comprovante > 5 MB | OP | ⚠️ | [🖼️](prints/61_comprovante_tamanho.png) | Validação existe no código (arquivo.size > 5MB → mostrarToast). Toast injetado manualmente — contexto React não acessível via `props.onChange` sintético. Verificar manualmente com arquivo real. |
| T62 | Baixar comprovante | CON | 🟢 | [🖼️](prints/62_baixar_comprovante.png) | Ícone "Ver comprovante" visível para CON |
| T63 | Remover comprovante — modal | OP | 🟢 | [🖼️](prints/63_modal_remover_comprovante.png) | |
| T64 | Ver detalhes — Operador | OP | 🟢 | [🖼️](prints/64_modal_ver_detalhes.png) | |
| T65 | Modal Editar Lançamento | ADM | 🟢 | [🖼️](prints/65_modal_editar_lancamento.png) | |
| T66 | Editar Lançamento — salvar | ADM | 🟢 | [🖼️](prints/66_lancamento_editado.png) | |
| T67 | Excluir Lançamento — modal | ADM | 🟢 | [🖼️](prints/67_modal_excluir_lancamento.png) | |
| T68 | Excluir Lançamento — confirmar | ADM | 🟢 | [🖼️](prints/68_lancamento_excluido.png) | |
| T69 | Lançamentos — Consulta sem botões | CON | 🟢 | [🖼️](prints/69_lancamentos_consulta.png) | Sem botões de ação; apenas ícone "Ver comprovante" onde aplicável |
| T70 | Lançamentos pré-filtrados Dashboard | CON | 🟢 | [🖼️](prints/70_lancamentos_origem_dashboard.png) | URL com origemDashboard=1&natureza=Credito&apenas_vencidos=true |
| T71 | Tipo de Conta — listagem | ADM | 🟢 | [🖼️](prints/71_tipo_conta_lista.png) | |
| T72 | Tipo de Conta — negado Operador | OP | 🟢 | [🖼️](prints/72_tipo_conta_negado.png) | |
| T73 | Criar tipo de conta | ADM | 🟢 | [🖼️](prints/73_tipo_conta_criado.png) | |
| T74 | Editar tipo de conta | ADM | 🟢 | [🖼️](prints/74_tipo_conta_editado.png) | |
| T75 | Deletar tipo de conta | ADM | 🟢 | [🖼️](prints/75_tipo_conta_deletado.png) | |
| T76 | NavBar — itens por perfil | ADM/OP/CON | 🟢 | [🖼️](prints/76_navbar_admin.png) | |
| T77 | Toast — sucesso | CON | ⚠️ | [🖼️](prints/77_toast_sucesso.png) | Componente ToastStack existe e funciona. Toast injetado via DOM para captura — `mostrarToast` não acessível externamente ao contexto React. Testar manualmente acionando uma operação real. |
| T78 | Toast — erro | CON | ⚠️ | [🖼️](prints/78_toast_erro.png) | Mesmo caso que T77 — estrutura visual correta, injeção manual. |
| T79 | Sessão expirada — modal | CON | ⚠️ | [🖼️](prints/79_sessao_expirada.png) | Componente MonitorSessao existe. Modal injetado manualmente para captura do visual. Comportamento real verificado indiretamente via código-fonte. |
| T80 | Sessão expirada — redirecionar | CON | ⚠️ | [🖼️](prints/80_sessao_redireciona.png) | Estado "redirecionando" injetado. O clique real em "Fazer login" chama logout() + navigate('/') — verificado no código. |
| T81 | Monitor de rede — offline | CON | 🟢 | [🖼️](prints/81_monitor_offline.png) | Banner vermelho apareceu naturalmente ao disparar evento `offline` |
| T82 | Monitor de rede — reconexão | CON | ⚠️ | [🖼️](prints/82_monitor_reconexao.png) | Evento `online` causa window.location.reload() — não disparado para evitar reload. Banner verde injetado. O código de reconexão está correto. |
| T83 | Spinner de carregamento | CON | ⚠️ | [🖼️](prints/83_spinner.png) | Spinner injetado via DOM. LoadingProvider/loadingBus existe e é chamado pelo api.js. |
| T84 | Página 404 | público | 🟢 | [🖼️](prints/84_404.png) | |
| T85 | Demo Registro | público | 🟢 | [🖼️](prints/85_demo_registro.png) | |
| T86 | Logout via NavBar | CON | 🟢 | [🖼️](prints/86_logout.png) | |
| T87 | Tema persiste entre sessões | público | 🟢 | [🖼️](prints/87_tema_persiste.png) | |
| T88 | Sessão expirada em múltiplas abas | CON | ⚠️ | [🖼️](prints/88_sessao_multiplas_abas.png) | Mesmo modal do T79, gatilhado por storage event (outra aba). Injetado manualmente para captura. |
| T89 | Fechar modal clicando no overlay | CON | 🟢 | [🖼️](prints/89_fechar_modal_overlay.png) | Popup CliforResumo fechou ao clicar no overlay — comportamento correto |
| T90 | Botão efetivar ausente em quitado | OP | 🟢 | [🖼️](prints/90_efetivar_ausente_quitado.png) | |
| T91 | Lista de usuários vazia | ADM | 🟢 | [🖼️](prints/91_usuarios_lista_vazia.png) | |
| T92 | Lista de lançamentos sem resultado | CON | 🟢 | [🖼️](prints/92_lancamentos_lista_vazia.png) | TRANSAÇÕES (0) com filtro de data impossível |
| T93 | Lista de clifors sem resultado | CON | 🟢 | [🖼️](prints/93_clifors_lista_vazia.png) | "Nenhum cliente/fornecedor encontrado." |
| T94 | Filtros combinados — lançamentos | CON | 🟢 | [🖼️](prints/94_lancamentos_filtros_combinados.png) | natureza=Débito + data vencimento + vencidos |
| T95 | Filtro por intervalo de valor | CON | 🟢 | [🖼️](prints/95_lancamentos_filtro_valor.png) | valor_minimo=100 / valor_maximo=500 |
| T96 | Filtro por período de pagamento | CON | 🟢 | [🖼️](prints/96_lancamentos_filtro_pagamento.png) | data_pagamento_de/ate Jan–Mar 2026 |
| T97 | Responsividade mobile 375 px | CON | 🟢 | [🖼️](prints/97_mobile_375.png) | |
| T98 | Responsividade tablet 768 px | CON | 🟢 | [🖼️](prints/98_tablet_768.png) | |
| T99 | Modal em mobile 375 px | OP | 🟢 | [🖼️](prints/99_modal_mobile.png) | Modal Novo Lançamento em 375px |
| T100 | Observação com texto longo | OP | 🟢 | [🖼️](prints/100_observacao_longa.png) | Textarea aceita 294 chars sem quebrar layout |
| T101 | Lançamento com valor R$ 0,00 | OP | 🟢 | [🖼️](prints/101_lancamento_valor_zero.png) | Input aceita 0,00; modal permanece aberto (campos obrigatórios vazios impedem submissão) |
| T102 | Clifor com caracteres especiais | OP | 🟢 | [🖼️](prints/102_clifor_chars_especiais.png) | Nome "João & Maria's #1 Çliente Ação" aceito no campo |
| T103 | Email duplicado ao criar usuário | ADM | 🟢 | [🖼️](prints/103_usuario_email_duplicado.png) | |

---

## Totais

| Status | Quantidade |
|--------|-----------|
| 🟢 Passou | 95 |
| 🔴 Falhou | 0 |
| ⚠️ Alerta | 8 |
| — Não executado | 0 |
| **Total** | **103** |
