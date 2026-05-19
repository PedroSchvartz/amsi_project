Os testes manuais que ficaram pendentes ainda são necessários — os testes automatizados cobrem o backend, mas não verificam se a UI está se comportando corretamente. Aqui está uma lista
limpa e atualizada do que falta, levando em conta o que já foi confirmado:

---

Faltam testar

A1 — Offline (estava duplicando, agora corrigido)

- testei, agora só aparece a faixa vermelha no po, sem toast.

A2 — Desvincular clifor (não persistia, agora corrigido)

- Funcionou.

A3 — Reorganização de botões + excluir lançamento

- A ordem está certa, porém parte da tabela e dos botões ficam fora da tela, sem ficar obvio que tem mais coisa que precisa ser scrolada.
- O Fluxo de exclusão funcionou e o toast confirmou.

B — Login como Operador

- Menu mostra Dashboard, Lançamentos, Clifors — sem Usuários (confirmado)
- Modal de criar lançamento: sem botão + Novo Tipo (confirmado)
- Botão de fechar (journal-check) aparece e funciona (confirmado)
- Botão lápis não aparece na tabela (confirmado)
- /usuarios direto na URL redireciona para /home (falha, ele não só não redireciona como ta dando dois toast de erro, precisamos solucionar a fonte desse erro. Porém a tela não é populada, ela fica vazia (o que é certo), em vez de redirecionar para home, vamos fazer uma outra tela apropriada para "caminho não encontrado" que deve aparecer em vez de ficar uma tela branca.)
- Acessar /tipo_conta direto na URL (Falha catastrofica, não só permite que seja acessado como também popula com a opção de editar e deletar.)

B — Admin não perdeu nada

- Todos os 4 links do menu aparecem (confirmado)
- Lápis aparece, Excluir aparece dentro do modal, + Novo Tipo aparece (confirmado)

B — Consulta inalterado (Não confirmado.)

- Menu vazio, /tipo_lancamento redireciona para /home
