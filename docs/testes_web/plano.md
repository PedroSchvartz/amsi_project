# Plano de Testes — Interface Web AMSI

**Versão:** 1.1  
**Data:** 2026-05-28  
**Escopo:** Bateria completa de testes manuais/automatizados da versão web  
**URL base:** `http://localhost:5173` (local) ou URL de produção Vercel  
**Resultado esperado:** Prints em `docs/testes_web/prints/` + resultado em `resultado.md`

---

## Convenções

| Símbolo | Significado |
|---|---|
| 🟢 | Passou |
| 🔴 | Falhou |
| ⚠️ | Alerta / comportamento inesperado |
| 🖼️ | Screenshot obrigatório |
| `[ADM]` | Requer perfil Administrador |
| `[OP]` | Requer perfil Operador ou superior |
| `[CON]` | Qualquer perfil autenticado |

---

## Contas de teste

| Perfil | Email | Senha |
|---|---|---|
| Administrador | *(conta admin do sistema)* | *(senha do admin)* |
| Operador | `pytest_operador@amsi.com` | `operadorTeste123` |
| Consulta | `pytest_consulta@amsi.com` | `consultaTeste123` |

---

## Módulo 1 — Login (`/`)

### T01 · Tela de login — estado inicial `[público]`
**Ação:** Acessar `/` sem estar autenticado.  
**Esperado:** Exibir logo AMSI, campos Email e Senha, botão "Entrar", toggle de tema visível.  
🖼️ `prints/01_login_inicial.png`

---

### T02 · Toggle de tema na tela de login `[público]`
**Ação:** Clicar no botão de alternância de tema.  
**Esperado:** Tema alterna entre "verde" e "corporativo"; botão atualiza o rótulo; preferência persiste no `localStorage`.  
🖼️ `prints/02_login_tema_corporativo.png`

---

### T03 · Login com credenciais inválidas `[público]`
**Ação:** Preencher email inexistente + senha errada → clicar "Entrar".  
**Esperado:** Mensagem de erro em vermelho aparece abaixo do botão e desaparece após 3 s.  
🖼️ `prints/03_login_erro.png`

---

### T04 · Login com campos vazios `[público]`
**Ação:** Deixar ambos os campos em branco → clicar "Entrar".  
**Esperado:** Validação nativa HTML5 impede envio; campos ficam com destaque de obrigatório.  
🖼️ `prints/04_login_campos_vazios.png`

---

### T05 · Login bem-sucedido — Administrador `[ADM]`
**Ação:** Preencher credenciais válidas do Admin → clicar "Entrar".  
**Esperado:** Spinner de carregamento → redireciona para `/home`; token salvo no `localStorage`.  
🖼️ `prints/05_login_admin_sucesso.png`

---

### T06 · Login bem-sucedido — Operador `[OP]`
**Ação:** Preencher credenciais do Operador → "Entrar".  
**Esperado:** Redireciona para `/home`.  
🖼️ `prints/06_login_operador_sucesso.png`

---

### T07 · Login bem-sucedido — Consulta `[CON]`
**Ação:** Preencher credenciais do Consulta → "Entrar".  
**Esperado:** Redireciona para `/home`.  
🖼️ `prints/07_login_consulta_sucesso.png`

---

### T08 · Acesso direto a rota protegida sem login `[público]`
**Ação:** Tentar acessar `/home` sem estar autenticado.  
**Esperado:** Redireciona para `/` (login).  
🖼️ `prints/08_rota_protegida_sem_login.png`

---

## Módulo 2 — Trocar Senha (`/trocar-senha`)

### T09 · Tela de troca de senha — primeiro acesso `[CON]`
**Ação:** Logar com uma conta cuja flag `primeiro_acesso = true`.  
**Esperado:** Redireciona para `/trocar-senha`; exibe formulário de nova senha sem NavBar.  
🖼️ `prints/09_trocar_senha_tela.png`

---

### T10 · Troca de senha com confirmação divergente `[CON]`
**Ação:** Preencher nova senha e confirmação diferentes → submeter.  
**Esperado:** Mensagem de erro "As senhas não conferem" (ou similar).  
🖼️ `prints/10_trocar_senha_divergente.png`

---

### T11 · Troca de senha com sucesso `[CON]`
**Ação:** Preencher nova senha válida + confirmação idêntica → submeter.  
**Esperado:** Toast de sucesso → redireciona para `/home`.  
🖼️ `prints/11_trocar_senha_sucesso.png`

---

## Módulo 3 — Home (`/home`)

### T12 · Tela Home — Admin `[ADM]`
**Ação:** Acessar `/home` como Admin.  
**Esperado:** Cards de boas-vindas, notícias ou atalhos visíveis; NavBar com todos os itens de menu.  
🖼️ `prints/12_home_admin.png`

---

### T13 · Tela Home — Operador `[OP]`
**Ação:** Acessar `/home` como Operador.  
**Esperado:** Home carrega; menu não exibe itens exclusivos de Admin (Usuários, Tipo de Conta).  
🖼️ `prints/13_home_operador.png`

---

### T14 · Tela Home — Consulta `[CON]`
**Ação:** Acessar `/home` como Consulta.  
**Esperado:** Home carrega; menu mais restrito que Operador.  
🖼️ `prints/14_home_consulta.png`

---

## Módulo 4 — Dashboard (`/dashboard`)

### T15 · Dashboard — carregamento inicial `[CON]`
**Ação:** Acessar `/dashboard`.  
**Esperado:** Gráficos, KPIs e indicadores financeiros carregam sem erros.  
🖼️ `prints/15_dashboard.png`

---

### T16 · Dashboard — clique em card de lançamentos vencidos `[CON]`
**Ação:** Clicar em card/atalho de "Vencidos" (se existir).  
**Esperado:** Redireciona para `/lancamentos?origemDashboard=true&apenas_vencidos=true` com filtros pré-carregados e banner informativo visível.  
🖼️ `prints/16_dashboard_click_vencidos.png`

---

## Módulo 5 — Usuários (`/usuarios`) — `[ADM]`

### T17 · Tela de usuários — listagem `[ADM]`
**Ação:** Acessar `/usuarios` como Admin.  
**Esperado:** Tabela com colunas Nome, E-mail, Cargo, Perfil, Ações; botões "Mostrar excluídos" e "Novo Usuário" visíveis.  
🖼️ `prints/17_usuarios_lista.png`

---

### T18 · Usuários — acesso negado para Operador `[OP]`
**Ação:** Tentar acessar `/usuarios` como Operador.  
**Esperado:** Redireciona ou exibe página de acesso negado.  
🖼️ `prints/18_usuarios_negado_operador.png`

---

### T19 · Modal "Novo Usuário" — abrir `[ADM]`
**Ação:** Clicar em "+ Novo Usuário".  
**Esperado:** Modal `UserRegisterModal` abre com formulário de cadastro.  
🖼️ `prints/19_modal_novo_usuario.png`

---

### T20 · Modal "Novo Usuário" — validação de campos obrigatórios `[ADM]`
**Ação:** Abrir modal e clicar em Salvar com campos vazios.  
**Esperado:** Campos obrigatórios ficam destacados; formulário não é enviado.  
🖼️ `prints/20_modal_novo_usuario_validacao.png`

---

### T21 · Modal "Novo Usuário" — cadastro bem-sucedido `[ADM]`
**Ação:** Preencher todos os campos válidos (Nome, Email, Cargo, Perfil) → Salvar.  
**Esperado:** Modal fecha; Toast "Usuário criado com sucesso"; novo usuário aparece na lista.  
🖼️ `prints/21_usuario_criado.png`

---

### T22 · Perfil Completo — popup `[ADM]`
**Ação:** Clicar no ícone de perfil (pessoa com linhas) de um usuário.  
**Esperado:** Popup `PerfilCompletoPopup` exibe todos os dados do usuário (incluindo cargo, acesso, suspensão).  
🖼️ `prints/22_perfil_completo_popup.png`

---

### T23 · Modal "Editar Usuário" `[ADM]`
**Ação:** Clicar no ícone de lápis de um usuário.  
**Esperado:** Modal `UserEditModal` abre pré-preenchido com dados do usuário.  
🖼️ `prints/23_modal_editar_usuario.png`

---

### T24 · Editar usuário — salvar `[ADM]`
**Ação:** Alterar o cargo → Salvar.  
**Esperado:** Modal fecha; Toast "Usuário atualizado"; lista reflete a alteração.  
🖼️ `prints/24_usuario_editado.png`

---

### T25 · Resetar senha — modal de confirmação `[ADM]`
**Ação:** Clicar no ícone de chave de um usuário.  
**Esperado:** `ModalConfirm` com título "Resetar senha" e variante perigo.  
🖼️ `prints/25_modal_resetar_senha.png`

---

### T26 · Resetar senha — confirmar `[ADM]`
**Ação:** Clicar em "Confirmar" no modal de reset.  
**Esperado:** Toast "Senha resetada. O usuário deverá criar uma nova senha..."; modal fecha.  
🖼️ `prints/26_senha_resetada.png`

---

### T27 · Deletar usuário — modal de confirmação `[ADM]`
**Ação:** Clicar no ícone de lixeira de um usuário (diferente do próprio).  
**Esperado:** `ModalConfirm` com título "Remover usuário" e variante perigo.  
🖼️ `prints/27_modal_deletar_usuario.png`

---

### T28 · Deletar usuário — cancelar `[ADM]`
**Ação:** Clicar em "Cancelar" no modal de confirmação.  
**Esperado:** Modal fecha sem excluir; usuário permanece na lista.  
🖼️ `prints/28_deletar_cancelado.png`

---

### T29 · Deletar usuário — confirmar `[ADM]`
**Ação:** Clicar em "Remover" no modal de confirmação.  
**Esperado:** Toast "Usuário removido"; usuário some da lista ativa.  
🖼️ `prints/29_usuario_deletado.png`

---

### T30 · Mostrar usuários excluídos `[ADM]`
**Ação:** Clicar em "Mostrar excluídos".  
**Esperado:** Lista exibe usuários com tag "Excluído" em cinza; botão muda para "Ocultar excluídos".  
🖼️ `prints/30_usuarios_excluidos.png`

---

### T31 · Restaurar usuário excluído `[ADM]`
**Ação:** Com excluídos visíveis, clicar em "Restaurar" de um usuário excluído.  
**Esperado:** `ModalConfirm` "Restaurar usuário" → confirmar → Toast "Usuário restaurado"; usuário some da lista de excluídos.  
🖼️ `prints/31_usuario_restaurado.png`

---

### T32 · Tentar deletar a própria conta `[ADM]`
**Ação:** Clicar na lixeira do usuário logado (própria conta).  
**Esperado:** Toast de aviso "Não é possível remover sua própria conta"; modal **não** abre.  
🖼️ `prints/32_deletar_propria_conta.png`

---

## Módulo 6 — Clientes/Fornecedores (`/cliente_fornecedor`)

### T33 · Lista de Clifors — carregamento `[CON]`
**Ação:** Acessar `/cliente_fornecedor`.  
**Esperado:** Tabela carrega com colunas Nome, Tipo, Documento (mascarado), Status, Inadimplente, A Receber, A Pagar, Ações.  
🖼️ `prints/33_clifors_lista.png`

---

### T34 · Clifors — filtro por nome `[CON]`
**Ação:** Digitar um nome parcial no campo "Buscar por nome...".  
**Esperado:** Lista filtra em tempo real exibindo apenas registros que contenham o texto.  
🖼️ `prints/34_clifors_filtro_nome.png`

---

### T35 · Clifors — filtro por tipo `[CON]`
**Ação:** Selecionar "Fornecedor" no dropdown de tipo.  
**Esperado:** Lista exibe apenas clifors do tipo F.  
🖼️ `prints/35_clifors_filtro_tipo.png`

---

### T36 · Clifors — filtro por status `[CON]`
**Ação:** Selecionar "Inadimplente" no dropdown de status.  
**Esperado:** Lista exibe apenas clifors inadimplentes.  
🖼️ `prints/36_clifors_filtro_inadimplente.png`

---

### T37 · CPF/CNPJ mascarado — revelar e ocultar `[OP]`
**Ação:** Clicar no documento mascarado de um clifor.  
**Esperado:** Documento é revelado no clique; segundo clique o mascara novamente. (Perfil Consulta vê sempre mascarado.)  
🖼️ `prints/37_cpf_revelar.png`

---

### T38 · Popup de resumo do clifor — abrir `[CON]`
**Ação:** Clicar em qualquer linha da tabela.  
**Esperado:** `CliforResumoPopup` abre com dados do clifor (nome, tipo, saldo, endereços, contatos).  
🖼️ `prints/38_clifor_popup_resumo.png`

---

### T39 · Popup de resumo do clifor — fechar `[CON]`
**Ação:** Clicar em "Fechar" ou fora do popup.  
**Esperado:** Popup fecha sem erros.  
🖼️ `prints/39_clifor_popup_fechado.png`

---

### T40 · Cadastrar novo Clifor — tela `[OP]`
**Ação:** Clicar em "+ Novo" → navega para `/cliente_fornecedor/novo`.  
**Esperado:** Formulário de cadastro com campos de dados pessoais, endereço e contato.  
🖼️ `prints/40_clifor_cadastro_tela.png`

---

### T41 · Cadastrar Clifor — validação CPF/CNPJ inválido `[OP]`
**Ação:** Preencher CPF inválido e submeter.  
**Esperado:** Mensagem de erro de validação; formulário não enviado.  
🖼️ `prints/41_clifor_cpf_invalido.png`

---

### T42 · Cadastrar Clifor — sucesso `[OP]`
**Ação:** Preencher todos os campos obrigatórios válidos → Salvar.  
**Esperado:** Toast de sucesso; redireciona para `/cliente_fornecedor`; novo clifor aparece na lista.  
🖼️ `prints/42_clifor_cadastrado.png`

---

### T43 · Editar Clifor — tela `[OP]`
**Ação:** Clicar em "Editar" de um clifor existente → navega para `/cliente_fornecedor/:id/editar`.  
**Esperado:** Formulário pré-preenchido com os dados atuais do clifor.  
🖼️ `prints/43_clifor_editar_tela.png`

---

### T44 · Editar Clifor — salvar alterações `[OP]`
**Ação:** Alterar um campo (ex.: nome) → Salvar.  
**Esperado:** Toast de sucesso; lista reflete a alteração.  
🖼️ `prints/44_clifor_editado.png`

---

### T45 · Excluir Clifor — modal de confirmação `[ADM]`
**Ação:** Clicar no ícone de lixeira de um clifor.  
**Esperado:** `ModalConfirm` "Excluir Cliente/Fornecedor" variante perigo.  
🖼️ `prints/45_modal_deletar_clifor.png`

---

### T46 · Excluir Clifor — confirmar `[ADM]`
**Ação:** Clicar em "Excluir" no modal.  
**Esperado:** Toast de sucesso; clifor some da lista. Se houver lançamentos vinculados, exibe erro 400 via Toast.  
🖼️ `prints/46_clifor_deletado.png`

---

### T47 · Clifors — Consulta não vê botão "+ Novo" `[CON]`
**Ação:** Acessar `/cliente_fornecedor` como Consulta.  
**Esperado:** Botão "+ Novo" ausente; botão "Editar" ausente na linha de cada clifor.  
🖼️ `prints/47_clifors_consulta_sem_botoes.png`

---

## Módulo 7 — Lançamentos (`/lancamentos`)

### T48 · Lista de lançamentos — carregamento `[CON]`
**Ação:** Acessar `/lancamentos`.  
**Esperado:** Seção de filtros + tabela TRANSAÇÕES carregam; contador de lançamentos exibido.  
🖼️ `prints/48_lancamentos_lista.png`

---

### T49 · Filtros — aplicar filtro por natureza `[CON]`
**Ação:** Selecionar "Crédito" no dropdown de Natureza → "Aplicar Filtros".  
**Esperado:** Tabela filtra; todos os registros exibidos têm natureza "Credito".  
🖼️ `prints/49_lancamentos_filtro_natureza.png`

---

### T50 · Filtros — aplicar filtro de status "Vencidos" `[CON]`
**Ação:** Marcar checkbox "Vencidos" → "Aplicar Filtros".  
**Esperado:** Apenas lançamentos vencidos (sem data_pagamento e data_vencimento < hoje) são exibidos.  
🖼️ `prints/50_lancamentos_filtro_vencidos.png`

---

### T51 · Filtros — botão "Limpar" `[CON]`
**Ação:** Aplicar qualquer filtro → clicar em "Limpar".  
**Esperado:** Todos os filtros são resetados; lista exibe todos os lançamentos.  
🖼️ `prints/51_lancamentos_filtro_limpar.png`

---

### T52 · Filtros pendentes — indicador visual `[CON]`
**Ação:** Alterar um filtro sem clicar em "Aplicar Filtros".  
**Esperado:** Botão "Aplicar Filtros" muda para "⚠ Aplicar Filtros ⚠" indicando filtros não aplicados.  
🖼️ `prints/52_lancamentos_filtro_pendente.png`

---

### T53 · CPF/CNPJ — revelar na tabela de lançamentos `[OP]`
**Ação:** Clicar no documento mascarado de um lançamento.  
**Esperado:** CPF/CNPJ revelado; segundo clique mascara. Consulta vê sempre mascarado.  
🖼️ `prints/53_lancamentos_cpf_revelar.png`

---

### T54 · Novo Lançamento — modal abrir `[OP]`
**Ação:** Clicar em "+ Novo Lançamento".  
**Esperado:** `LancamentoModal` abre com todos os campos de cadastro.  
🖼️ `prints/54_modal_novo_lancamento.png`

---

### T55 · Novo Lançamento — validação obrigatórios `[OP]`
**Ação:** Submeter modal com campos obrigatórios vazios.  
**Esperado:** Validação impede envio; campos destacados ou Toast de aviso.  
🖼️ `prints/55_lancamento_validacao.png`

---

### T56 · Novo Lançamento — cadastro bem-sucedido `[OP]`
**Ação:** Preencher todos os campos válidos (clifor, tipo, valor, vencimento, natureza) → Salvar.  
**Esperado:** Modal fecha; Toast "Lançamento criado"; novo lançamento aparece na tabela.  
🖼️ `prints/56_lancamento_criado.png`

---

### T57 · Efetivar Lançamento — modal abrir `[OP]`
**Ação:** Clicar no ícone de "efetivar" (journal-check) de um lançamento em aberto.  
**Esperado:** Modal "Efetivar Lançamento" abre com duas colunas: dados do lançamento (somente leitura) + efetivação (editável).  
🖼️ `prints/57_modal_efetivar.png`

---

### T58 · Efetivar Lançamento — sem data de pagamento `[OP]`
**Ação:** Submeter modal de efetivação sem preencher a data de pagamento.  
**Esperado:** Toast de aviso "Informe a data de pagamento."  
🖼️ `prints/58_efetivar_sem_data.png`

---

### T59 · Efetivar Lançamento — com multa e juros `[OP]`
**Ação:** Preencher data, valor pago, multa e juros → submeter.  
**Esperado:** Campo "Total Pago" exibido dinamicamente com soma; Toast "Lançamento fechado com sucesso".  
🖼️ `prints/59_efetivar_com_encargos.png`

---

### T60 · Efetivar Lançamento — com comprovante PDF `[OP]`
**Ação:** Selecionar arquivo PDF ≤ 5 MB no campo comprovante → confirmar.  
**Esperado:** Lançamento fechado + comprovante anexado; ícone PDF aparece na linha.  
🖼️ `prints/60_efetivar_com_comprovante.png`

---

### T61 · Efetivar Lançamento — comprovante acima de 5 MB `[OP]`
**Ação:** Tentar selecionar PDF > 5 MB.  
**Esperado:** Toast "O arquivo excede o limite de 5MB."; arquivo não é selecionado.  
🖼️ `prints/61_comprovante_tamanho.png`

---

### T62 · Baixar comprovante `[CON]`
**Ação:** Clicar no ícone de PDF de um lançamento que já tem comprovante.  
**Esperado:** PDF é baixado pelo navegador.  
🖼️ `prints/62_baixar_comprovante.png`

---

### T63 · Remover comprovante — modal de confirmação `[OP]`
**Ação:** Abrir modal de efetivação/edição de lançamento com comprovante → clicar "Remover".  
**Esperado:** `ModalConfirm` "Remover comprovante" abre.  
🖼️ `prints/63_modal_remover_comprovante.png`

---

### T64 · Ver detalhes do Lançamento — Operador `[OP]`
**Ação:** Clicar no ícone de olho de um lançamento (visível apenas para Operador, não Admin).  
**Esperado:** Modal somente-leitura com todos os dados do lançamento; botão "Baixar PDF" visível se houver comprovante.  
🖼️ `prints/64_modal_ver_detalhes.png`

---

### T65 · Editar Lançamento — modal (Admin) `[ADM]`
**Ação:** Clicar no ícone de lápis de um lançamento como Admin.  
**Esperado:** Modal "Editar Lançamento" abre com todos os campos editáveis (clifor, tipo, valor, vencimento, natureza, efetivação).  
🖼️ `prints/65_modal_editar_lancamento.png`

---

### T66 · Editar Lançamento — salvar `[ADM]`
**Ação:** Alterar algum campo → Salvar.  
**Esperado:** Toast "Lançamento editado com sucesso"; lista atualiza.  
🖼️ `prints/66_lancamento_editado.png`

---

### T67 · Excluir Lançamento — modal de confirmação `[ADM]`
**Ação:** Dentro do modal de edição, clicar em "Excluir".  
**Esperado:** `ModalConfirm` "Excluir Lançamento" variante perigo.  
🖼️ `prints/67_modal_excluir_lancamento.png`

---

### T68 · Excluir Lançamento — confirmar `[ADM]`
**Ação:** Confirmar exclusão.  
**Esperado:** Toast "Lançamento excluído com sucesso"; modal fecha; lançamento some da lista.  
🖼️ `prints/68_lancamento_excluido.png`

---

### T69 · Lançamentos — Consulta não vê botão "+ Novo Lançamento" `[CON]`
**Ação:** Acessar `/lancamentos` como Consulta.  
**Esperado:** Botão "+ Novo Lançamento" ausente; ícone de efetivar ausente; ícone de editar ausente; apenas visualização.  
🖼️ `prints/69_lancamentos_consulta.png`

---

### T70 · Lançamentos pré-filtrados do Dashboard `[CON]`
**Ação:** Acessar `/lancamentos?origemDashboard=true&apenas_vencidos=true`.  
**Esperado:** Banner "Filtros pré-carregados do Dashboard" visível; checkbox "Vencidos" marcado; tabela filtrada.  
🖼️ `prints/70_lancamentos_origem_dashboard.png`

---

## Módulo 8 — Tipo de Conta (`/tipo_conta`) — `[ADM]`

### T71 · Tela de tipos de conta `[ADM]`
**Ação:** Acessar `/tipo_conta`.  
**Esperado:** Lista de tipos cadastrados com botão de adicionar novo tipo.  
🖼️ `prints/71_tipo_conta_lista.png`

---

### T72 · Tipo de Conta — acesso negado para Operador `[OP]`
**Ação:** Tentar acessar `/tipo_conta` como Operador.  
**Esperado:** Redireciona ou exibe acesso negado.  
🖼️ `prints/72_tipo_conta_negado.png`

---

### T73 · Criar novo tipo de conta `[ADM]`
**Ação:** Preencher descrição e natureza → Salvar.  
**Esperado:** Toast de sucesso; novo tipo aparece na lista.  
🖼️ `prints/73_tipo_conta_criado.png`

---

### T74 · Editar tipo de conta `[ADM]`
**Ação:** Clicar em editar de um tipo → alterar descrição → Salvar.  
**Esperado:** Toast de sucesso; lista atualizada.  
🖼️ `prints/74_tipo_conta_editado.png`

---

### T75 · Deletar tipo de conta `[ADM]`
**Ação:** Clicar em deletar de um tipo sem lançamentos vinculados → confirmar.  
**Esperado:** Toast de sucesso; tipo removido da lista.  
🖼️ `prints/75_tipo_conta_deletado.png`

---

## Módulo 9 — Componentes Globais

### T76 · NavBar — itens por perfil `[CON]`
**Ação:** Logar com cada perfil (Admin, Operador, Consulta) e comparar itens do menu.  
**Esperado:**  
- Admin: Home, Dashboard, Usuários, Clifors, Lançamentos, Tipo de Conta, Sair  
- Operador: Home, Dashboard, Clifors, Lançamentos, Sair  
- Consulta: Home, Dashboard, Clifors, Lançamentos, Sair  
🖼️ `prints/76_navbar_admin.png`, `prints/76_navbar_operador.png`, `prints/76_navbar_consulta.png`

---

### T77 · Toast de sucesso `[CON]`
**Ação:** Executar qualquer ação bem-sucedida (ex.: criar usuário).  
**Esperado:** Toast verde aparece no canto da tela e desaparece automaticamente após alguns segundos. Múltiplos toasts são empilhados.  
🖼️ `prints/77_toast_sucesso.png`

---

### T78 · Toast de erro `[CON]`
**Ação:** Executar ação que gera erro (ex.: criar clifor com CPF duplicado).  
**Esperado:** Toast vermelho exibe a mensagem de erro da API.  
🖼️ `prints/78_toast_erro.png`

---

### T79 · Modal de sessão expirada `[CON]`
**Ação:** Aguardar expiração do token (ou forçar via `localStorage.setItem('expiresAt', 1)`) dentro do sistema.  
**Esperado:** Overlay "Sessão expirada" com ícone de cadeado e botão "Ir para o Login" aparece.  
🖼️ `prints/79_sessao_expirada.png`

---

### T80 · Modal de sessão expirada — clicar "Ir para o Login" `[CON]`
**Ação:** Clicar em "Ir para o Login" no modal de sessão expirada.  
**Esperado:** Modal fecha; `localStorage` limpo; redireciona para `/`.  
🖼️ `prints/80_sessao_redireciona.png`

---

### T81 · Monitor de rede offline `[CON]`
**Ação:** Desativar o adaptador de rede (ou DevTools → Network → Offline).  
**Esperado:** Banner vermelho "Sem conexão com a internet — aguardando reconexão…" aparece no topo da tela.  
🖼️ `prints/81_monitor_offline.png`

---

### T82 · Monitor de rede — reconexão `[CON]`
**Ação:** Reativar a rede após simular offline.  
**Esperado:** Banner desaparece; página recarrega automaticamente.  
🖼️ `prints/82_monitor_reconexao.png`

---

### T83 · Spinner global de carregamento `[CON]`
**Ação:** Iniciar qualquer requisição lenta (throttle de rede em DevTools).  
**Esperado:** Overlay semi-transparente com spinner animado cobre a tela; desaparece ao concluir.  
🖼️ `prints/83_spinner.png`

---

## Módulo 10 — Erro e Páginas Especiais

### T84 · Página 404 `[público]`
**Ação:** Acessar `/rota-que-nao-existe` (autenticado ou não).  
**Esperado:** Componente `NotFoundPage` exibido com mensagem amigável e link para voltar.  
🖼️ `prints/84_404.png`

---

### T85 · Demo Registro (`/demo-registro`) `[público]`
**Ação:** Acessar `/demo-registro`.  
**Esperado:** Página de auto-registro (visível apenas se `APP_ENV=demo`); formulário de criação de conta para ensaio.  
🖼️ `prints/85_demo_registro.png`

---

## Módulo 11 — Logout e Sessão

### T86 · Logout via NavBar `[CON]`
**Ação:** Clicar em "Sair" no menu de navegação (qualquer perfil).  
**Esperado:** `localStorage` limpo (`token`, `user`, `expiresAt` removidos); redireciona para `/`; tentar acessar `/home` volta ao login.  
🖼️ `prints/86_logout.png`

---

### T87 · Tema persiste entre sessões `[público]`
**Ação:** Na tela de login, selecionar o tema "Corporativo" → fazer login → navegar por algumas telas → fazer logout → voltar à tela de login.  
**Esperado:** O tema permanece "Corporativo" na tela de login após o logout (valor preservado no `localStorage`).  
🖼️ `prints/87_tema_persiste.png`

---

### T88 · Sessão expirada em múltiplas abas `[CON]`
**Ação:** Abrir o sistema em duas abas com o mesmo usuário logado → na aba A, clicar em "Sair" (logout) → observar a aba B sem recarregá-la.  
**Esperado:** Aba B exibe o modal "Sessão expirada" automaticamente (detecta `localStorage.clear()` via evento `storage`).  
🖼️ `prints/88_sessao_multiplas_abas.png`

---

## Módulo 12 — Comportamento de Modais

### T89 · Fechar modal clicando no overlay `[CON]`
**Ação:** Abrir qualquer modal com overlay (ex.: "Efetivar Lançamento", "Editar Lançamento", "Ver Detalhes") → clicar fora da área do modal (no fundo escurecido).  
**Esperado:** Modal fecha sem executar nenhuma ação; dados preenchidos são descartados.  
🖼️ `prints/89_fechar_modal_overlay.png`

---

### T90 · Botão "Efetivar" ausente em lançamento já quitado `[OP]`
**Ação:** Na lista de lançamentos, localizar um lançamento com `data_pagamento` preenchida (status "Pago").  
**Esperado:** Ícone de efetivar (journal-check) **não aparece** na linha; somente os ícones de olho/lápis e PDF estão presentes.  
🖼️ `prints/90_efetivar_ausente_quitado.png`

---

## Módulo 13 — Estados Vazios

### T91 · Lista de usuários vazia `[ADM]`
**Ação:** Acessar `/usuarios` com a opção "Mostrar excluídos" ativa quando não há usuários excluídos.  
**Esperado:** Linha da tabela exibe "Nenhum usuário encontrado." centralizado; sem erros de JavaScript.  
🖼️ `prints/91_usuarios_lista_vazia.png`

---

### T92 · Lista de lançamentos sem resultado de filtro `[CON]`
**Ação:** Aplicar filtro com combinação impossível (ex.: Natureza = Crédito + Tipo de Conta que só tem débitos) → "Aplicar Filtros".  
**Esperado:** Contador "TRANSAÇÕES (0)"; célula "Nenhum lançamento encontrado" ocupa toda a linha; sem erro.  
🖼️ `prints/92_lancamentos_lista_vazia.png`

---

### T93 · Lista de Clifors sem resultado de filtro `[CON]`
**Ação:** Digitar no campo de busca um nome que certamente não existe (ex.: "xyzxyzxyz").  
**Esperado:** Mensagem "Nenhum cliente/fornecedor encontrado." exibida; sem erros.  
🖼️ `prints/93_clifors_lista_vazia.png`

---

## Módulo 14 — Filtros Combinados

### T94 · Lançamentos — múltiplos filtros simultâneos `[CON]`
**Ação:** Selecionar Natureza = "Crédito" + marcar "Abertos" + definir intervalo de vencimento (ex.: próximos 30 dias) → "Aplicar Filtros".  
**Esperado:** Todos os lançamentos exibidos satisfazem simultaneamente os três critérios; contador atualizado.  
🖼️ `prints/94_lancamentos_filtros_combinados.png`

---

### T95 · Lançamentos — filtro por intervalo de valor `[CON]`
**Ação:** Preencher "Valor mínimo" = 100 e "Valor máximo" = 500 → "Aplicar Filtros".  
**Esperado:** Apenas lançamentos com valor original entre R$ 100,00 e R$ 500,00 são exibidos.  
🖼️ `prints/95_lancamentos_filtro_valor.png`

---

### T96 · Lançamentos — filtro por período de pagamento `[CON]`
**Ação:** Preencher "Pagamento de" e "Pagamento até" com um intervalo de datas passado → "Aplicar Filtros".  
**Esperado:** Apenas lançamentos com `data_pagamento` dentro do intervalo são exibidos; status de todos deve ser "Pago".  
🖼️ `prints/96_lancamentos_filtro_pagamento.png`

---

## Módulo 15 — Responsividade

> Para estes testes usar DevTools → Toggle Device Toolbar (ou redimensionar a janela).

### T97 · Layout mobile — 375 px (iPhone SE) `[CON]`
**Ação:** Redimensionar o navegador para 375 × 667 px → navegar por Home, Lançamentos e Clifors.  
**Esperado:** Nenhum elemento ultrapassa a largura da tela; textos legíveis; botões clicáveis sem sobreposição; menu adaptado (hambúrguer ou scroll horizontal).  
🖼️ `prints/97_mobile_375.png`

---

### T98 · Layout tablet — 768 px (iPad) `[CON]`
**Ação:** Redimensionar para 768 × 1024 px → navegar pelas mesmas telas.  
**Esperado:** Layout intermediário sem quebras visuais; tabelas com scroll horizontal se necessário.  
🖼️ `prints/98_tablet_768.png`

---

### T99 · Modal em mobile — 375 px `[OP]`
**Ação:** Em 375 px, abrir o modal de "Efetivar Lançamento" (ou outro modal de duas colunas).  
**Esperado:** Modal ocupa a maior parte da tela; campos empilhados verticalmente; formulário utilizável sem scroll excessivo.  
🖼️ `prints/99_modal_mobile.png`

---

## Módulo 16 — Limites e Caracteres Especiais

### T100 · Observação com texto muito longo `[OP]`
**Ação:** No modal de novo lançamento, preencher o campo "Observação" com 500+ caracteres → Salvar.  
**Esperado:** Ou o campo limita a entrada visualmente/via `maxLength`, ou o backend aceita e exibe truncado na tabela; sem erro 500.  
🖼️ `prints/100_observacao_longa.png`

---

### T101 · Lançamento com valor R$ 0,00 `[OP]`
**Ação:** Criar lançamento com valor = 0,00.  
**Esperado:** Backend retorna erro de validação (valor deve ser > 0) ou Toast de aviso; lançamento **não** é criado.  
🖼️ `prints/101_lancamento_valor_zero.png`

---

### T102 · Clifor com caracteres especiais no nome `[OP]`
**Ação:** Cadastrar clifor com nome contendo acentos, cedilha, hífen e apóstrofo (ex.: `D'Avila & Irmãos – Ltda.`).  
**Esperado:** Clifor criado com sucesso; nome exibido corretamente na lista sem corrupção de encoding.  
🖼️ `prints/102_clifor_chars_especiais.png`

---

### T103 · Email duplicado ao criar usuário `[ADM]`
**Ação:** Tentar cadastrar um usuário com um email já existente no sistema.  
**Esperado:** Toast de erro com mensagem clara sobre email duplicado; modal permanece aberto para correção.  
🖼️ `prints/103_usuario_email_duplicado.png`

---

## Resumo de Cobertura

| Módulo | Testes | Perfis cobertos |
|---|---|---|
| Login | T01–T08 | Público, ADM, OP, CON |
| Trocar Senha | T09–T11 | CON |
| Home | T12–T14 | ADM, OP, CON |
| Dashboard | T15–T16 | CON |
| Usuários | T17–T32 | ADM, OP (negado) |
| Clifors | T33–T47 | ADM, OP, CON |
| Lançamentos | T48–T70 | ADM, OP, CON |
| Tipo de Conta | T71–T75 | ADM, OP (negado) |
| Componentes Globais | T76–T83 | ADM, OP, CON |
| Erro / Especial | T84–T85 | Público |
| Logout e Sessão | T86–T88 | CON |
| Comportamento de Modais | T89–T90 | OP, CON |
| Estados Vazios | T91–T93 | ADM, CON |
| Filtros Combinados | T94–T96 | CON |
| Responsividade | T97–T99 | CON, OP |
| Limites e Chars Especiais | T100–T103 | ADM, OP |
| **Total** | **103 testes** | **todos os perfis** |

---

## Ordem de execução recomendada

1. Iniciar o backend (`uvicorn main:app --reload`) e o frontend (`npm run dev`)
2. Executar os testes de Login primeiro (T01–T08) para verificar autenticação
3. Executar módulos na ordem do documento, trocando de perfil conforme necessário
4. Ao final de cada módulo, verificar se há Toasts de erro inesperados no console do navegador
5. Consolidar prints em `docs/testes_web/prints/` com os nomes exatos indicados
6. Preencher `resultado.md` com status `🟢 / 🔴 / ⚠️` para cada teste
