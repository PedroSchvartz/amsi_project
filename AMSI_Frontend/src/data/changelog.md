<!--
  Changelog da tela "Novidades & Atualizações" (ChangelogPage).

  Como editar:
    ## AAAA-MM-DD        -> um DEPLOY (data ISO). A ordem do arquivo é a da tela:
                            mais recente PRIMEIRO (o primeiro já abre expandido).
    ### Título do ponto  -> um PONTO (em geral, um commit) dentro do deploy.
    texto do detalhe     -> parágrafo do ponto, logo abaixo do título. Pode ocupar
                            uma ou várias linhas (são unidas por espaço). Linha em
                            branco separa os pontos.

  Qualquer coisa fora desse padrão (este comentário, por exemplo) é ignorada.
  Não precisa mexer em código para publicar um novo deploy: basta editar este arquivo.
-->

## 2026-11-13

### Dashboard: um mês por vez e novo card "Resultado"
O filtro do painel agora é um único campo de mês (sem mais "de/até"). O card "Saldo" foi substituído por "Resultado": Receitas menos Despesas do mês, somadas aos lançamentos de natureza "Resultado" do mês anterior. Esses lançamentos aparecem numa nova lista, "Resultado de <mês anterior>", logo abaixo das listas de Receitas e Despesas, para todos os perfis.

## 2026-11-12

### Lista de lançamentos agora é paginada
A lista de lançamentos passou a ser dividida em páginas de 50, com navegação numerada no rodapé e o total do conjunto filtrado no cabeçalho. As ações na linha (efetivar, aprovar, editar, excluir ou reverter) mantêm você na mesma página, em vez de voltar para a primeira.

### Tipos de conta "Resultado": registros que ficam fora do painel
Os tipos de conta agora podem ter a natureza "Resultado", além de Crédito e Débito. Lançamentos de um tipo "Resultado" aparecem normalmente na lista e na planilha, e o filtro de Natureza ganhou a opção "Resultado" — mas eles não entram em nenhum número do painel (receitas, despesas, saldo, a receber/pagar ou inadimplência). Como são neutros, não têm reembolso: ao lançar por um tipo "Resultado", o campo de reembolso aparece como "Não aplicável".

### Coluna "Lote do Associado" na planilha
A exportação de lançamentos ganhou a coluna "Lote do Associado" (o terreno do cliente/fornecedor), logo após o Nome/Razão Social, para os dois perfis.

### Último acesso na tela de Usuários
A lista de usuários passou a mostrar o último acesso de cada um — a data do login mais recente.

### Consulta vê contato e endereço apenas do próprio cadastro
Quem acessa apenas para consulta passa a ver os contatos e endereços somente do seu próprio cliente/fornecedor.

## 2026-10-28

### Editar lançamento não marca mais pagamento sem efetivar
Na edição de um lançamento (Administrador), os campos de pagamento ficam bloqueados até o lançamento ser efetivado. Antes era possível gravar data e valor de pagamento numa linha que continuava Aberta ou Vencida, com cara de paga.

### Novo lançamento começa limpo ao trocar o tipo
Ao trocar o Tipo de Conta na janela de novo lançamento, os clientes/fornecedores e o valor que vinham do tipo anterior são limpos, evitando herdar dados de uma seleção que não vale mais.

## 2026-10-22

### Painel de quem só consulta: basta escolher o mês
No painel de quem acessa apenas para consulta, o filtro de período deixou de pedir início e fim. Agora é um único seletor de mês: o sistema mostra do primeiro ao último dia do mês escolhido. Para a equipe (Administrador e Operador), o filtro De–Até continua igual.

### Receitas antes de Despesas no painel
As duas listas por tipo na parte de baixo do painel trocaram de lado para seguir a ordem dos totais do topo: Receitas à esquerda, Despesas à direita.

### Campo de observação no cadastro de cliente/fornecedor
O cadastro e a edição de cliente/fornecedor ganharam um campo "Observação" para anotações livres. O texto fica guardado no cadastro e aparece somente nessa tela.

## 2026-10-14

### Painel mais limpo e sem rolar de lado no celular
O painel foi reorganizado para caber na tela do celular sem rolagem horizontal. Os totais de Receitas, Despesas e Saldo do período ficam sempre lado a lado, e as listas quebram em linhas em vez de esticar para o lado.

### Filtro de período em uma linha
O seletor de período ficou mais enxuto: um único campo De–Até com o botão Pesquisar. Os atalhos de período (mês atual, último mês, etc.) foram removidos. No celular o botão Pesquisar fica na linha do título e os campos de data descem logo abaixo.

### Estornos / Reembolsos viram lista na Posição atual
A informação de estornos/reembolsos deixou de ser um cartão de total e passou a ser uma lista por tipo (como Receitas e Despesas), agora dentro do bloco "Posição atual". Continua visível apenas para a equipe (Administrador e Operador).

## 2026-10-12

### Desfazer uma etapa do lançamento em dois cliques
No histórico do lançamento, voltar uma etapa (de Pago para Em análise, ou de Em análise para Aberto) agora é em dois cliques: o primeiro troca o botão para "Confirmar" e o segundo conclui. Antes era preciso segurar o botão, o que confundia no celular.

### Campos da edição de lançamento não estouram mais no celular
Na janela de editar lançamento, os campos deixaram de ultrapassar a borda no celular — tudo cabe dentro da janela e continua legível.

### Gerar acesso por documento quando já há acesso por e-mail
No cadastro de cliente/fornecedor, o botão "Gerar acesso" passa a criar o acesso pelo documento (CPF/CNPJ) mesmo quando já existe um usuário vinculado que entra por e-mail. O bloqueio agora é só quando já há um acesso com aquele mesmo documento.

## 2026-10-01

### Primeiro acesso vai direto para o painel
Ao entrar com login e senha, você cai direto no painel — a troca de senha deixou de ser obrigatória no primeiro acesso. O painel já abre carregado com o mês atual.

### Trocar a senha quando quiser
Um botão "Trocar Senha" ao lado do "Sair" abre uma janela para definir uma nova senha a qualquer momento. Basta informar a nova senha e confirmá-la (e um e-mail, se ainda não tiver). Não é mais preciso digitar a senha atual.

### Esqueci minha senha agora pergunta o Login
A recuperação de senha passa a aceitar o seu Login (CPF ou e-mail). Se o Login for reconhecido e tiver e-mail, enviamos o link; caso contrário, uma mensagem clara orienta a corrigir ou procurar um administrador.

### E-mail do usuário e do cliente/fornecedor independentes
Editar ou remover o e-mail de um usuário não altera mais os contatos do cliente/fornecedor vinculado, e vice-versa. O vínculo entre eles permanece; apenas os e-mails deixaram de ser copiados automaticamente.

### Visual único
O tema alternativo foi removido — o sistema passa a usar apenas a identidade visual verde da Associação.

### Restaurar sem e-mail e editar contato na tela de usuários
Agora dá para restaurar um usuário excluído mesmo sem e-mail cadastrado: ao restaurar, o sistema oferece cadastrar um e-mail para notificar ou apenas reativar sem notificação. A modal de edição passou a permitir alterar (ou cadastrar) o e-mail de contato, e a barra de filtros foi reorganizada para a busca ocupar a largura livre — com um layout próprio no celular.

### Acesso por documento (CPF)
É possível gerar o acesso de um morador direto do cadastro, sem depender de e-mail. A senha inicial são os 5 primeiros dígitos do documento e a troca é obrigatória no primeiro login.

### Login único como credencial
A entrada no sistema passa a ser sempre pelo Login (CPF do morador ou e-mail da equipe); o e-mail vira apenas contato e recuperação. Login, e-mail, CPF/CNPJ e RG são únicos, um acesso por cadastro, e o administrador pode editar o Login pela tela de usuários.

### Cadastro com e-mail opcional e filtros na lista
O administrador pode criar um usuário sem e-mail, definindo a senha provisória no próprio modal; o e-mail só é exigido quando se opta por notificar. A lista de usuários ganhou busca e filtros por perfil, cargo e status, e a coluna Nome agora quebra em linhas.

### Recuperação de senha informa o login
Os e-mails de esqueci/redefinir senha e de conta restaurada passam a indicar qual login usar, evitando que quem entra por CPF tente logar pelo e-mail.
