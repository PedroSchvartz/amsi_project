# Contexto de Negócio — TCC AMSI
## O problema real antes do sistema, o impacto esperado e as limitações de produto

> **Para que serve este documento:** responde às perguntas de banca que não são técnicas. Quando um professor perguntar "qual o impacto real para a associação?", "como vocês identificaram os requisitos?" ou "por que esse problema merecia um TCC?", as respostas estão aqui.

---

## QUEM É A AMSI

A Associação de Moradores de Santa Isabel é uma organização comunitária sem fins lucrativos localizada na zona rural do município de Santa Isabel. Associações desse tipo são comuns no interior do Brasil: uma diretoria eleita (presidente, vice-presidente, tesoureiro, secretário, diretores) administra recursos compartilhados — manutenção de espaços comunitários, taxas de condomínio, contratação de serviços.

A diretoria muda periodicamente por processo eleitoral. Isso significa que a pessoa responsável pela gestão financeira muda, e qualquer conhecimento não documentado vai embora com ela.

---

## A SITUAÇÃO ANTES DO SISTEMA

### Como a gestão financeira funcionava

Antes do AMSI, a gestão financeira da associação era feita com as ferramentas disponíveis: planilhas Excel, cadernos físicos e comunicação informal entre diretores.

O processo mensal típico de cobrança de mensalidade funcionava assim:
1. O tesoureiro abria a planilha Excel com os dados dos associados
2. Criava manualmente uma nova linha para o mês corrente
3. Conforme os pagamentos chegavam (em dinheiro, transferência ou depósito), atualizava a planilha
4. Para saber quem estava em atraso, varreria a planilha comparando datas de vencimento com colunas de pagamento

### Os quatro problemas concretos

**1. Cadastro descentralizado**
As informações dos associados ficavam em planilhas Excel em computadores pessoais dos diretores. Não havia uma fonte única e atualizada. Quando um diretor saía, levava sua versão da planilha. O novo diretor herdava uma versão desatualizada — ou nenhuma versão.

**2. Inadimplência calculada manualmente**
Não havia cálculo automático de inadimplência. Para saber quem estava em atraso, alguém precisava olhar cada linha da planilha, comparar a data de vencimento com a data atual, verificar se havia pagamento registrado. Esse processo era feito esporadicamente — o que significava que cobranças em atraso podiam passar semanas sem ser identificadas.

**3. Ausência de auditoria**
Excel não registra quem alterou qual célula, quando, e por qual motivo. Se um valor financeiro estava errado, não havia como saber se foi erro de digitação, se alguém havia alterado intencionalmente, ou se o valor original nunca estava correto. A falta de rastreabilidade criava desconfiança.

**4. Acesso restrito a um dispositivo**
A planilha ficava no computador de uma pessoa específica. Um diretor que precisasse verificar a situação de um associado enquanto viajava não tinha acesso. Uma reunião de diretoria precisava esperar a pessoa com a planilha estar presente.

---

## COMO OS REQUISITOS FORAM LEVANTADOS

O levantamento de requisitos foi feito em conversa direta com representantes da associação. O processo identificou:

**Requisitos funcionais principais:**
- Cadastro centralizado de associados com dados de contato e endereço
- Registro de lançamentos (cobranças e pagamentos) com data de vencimento
- Indicação automática de inadimplência por associado
- Registro de quem fez cada operação (autor e data)
- Acesso por diferentes pessoas com diferentes níveis de permissão
- Acesso pelo navegador, sem instalação de software

**Requisitos não-funcionais implícitos:**
- Não pode ser complicado demais para que uma pessoa sem formação técnica consiga usar
- Tem que funcionar em computadores comuns e celulares
- Dados não podem ser perdidos

---

## O QUE O SISTEMA ENTREGA

### Problemas resolvidos

| Problema original | Como o sistema resolve |
|---|---|
| Cadastro descentralizado | Banco de dados único e centralizado, acessível de qualquer dispositivo |
| Inadimplência manual | `atualizar_inadimplente()` recalcula automaticamente a cada operação |
| Sem auditoria | Cada lançamento registra `id_usuario_fk` (quem criou) e `created_at` (quando) |
| Acesso a um dispositivo | Interface web acessível de qualquer navegador com internet |

### O que o sistema faz em detalhe

**Cadastro de Clifors (Clientes e Fornecedores)**
Cada associado ou fornecedor tem um cadastro com nome, CPF/CNPJ, endereço e contatos. O cadastro é único — mudanças feitas por um operador aparecem para todos imediatamente.

**Lançamentos financeiros**
Um lançamento é qualquer movimento financeiro: cobrança de mensalidade (crédito — a associação recebe), pagamento de serviço (débito — a associação paga), multa, devolução. Cada lançamento tem: valor, data de vencimento, tipo de conta (categoria), clifor relacionado, quem criou, quando criou.

**Efetivação de pagamentos**
Quando um pagamento é recebido, o operador registra: data de pagamento, valor efetivamente pago, multa e juros (se houver), e pode anexar o comprovante em PDF. O lançamento muda de status "Aberto" para "Efetivado".

**Inadimplência automática**
A cada criação, efetivação ou exclusão de lançamento, o sistema recalcula se o clifor tem cobranças vencidas e não pagas. O flag `inadimplente` é atualizado automaticamente — nenhuma operação manual.

**Dashboard financeiro**
Resumo com: total de receitas do período, total de despesas, saldo, número de lançamentos em aberto, valor total em aberto, e lista de clifors inadimplentes.

**Controle de acesso**
Três perfis com permissões progressivas: Consulta, Operador, Administrador. Um associado com perfil Consulta pode ver a situação financeira mas não alterar nada e não vê CPF/CNPJ de outros associados.

---

## LIMITAÇÕES DO PRODUTO (PERSPECTIVA DE NEGÓCIO)

### O que o sistema não entrega

**Relatórios exportáveis:** o dashboard mostra os dados mas não gera relatórios em PDF ou Excel para reuniões de diretoria. Um diretor que queira apresentar o balanço em uma reunião precisa fazer prints de tela.

**Histórico de versões de lançamento:** se um lançamento é editado, o valor anterior não é preservado. Para auditoria completa, seria necessário um log de mudanças por campo (audit trail).

**App mobile nativo:** a interface é responsiva e funciona no celular, mas não é um aplicativo nativo instalável. Sem internet, não funciona.

**Aprovação de pagamentos:** qualquer operador pode efetivar qualquer pagamento sem aprovação de um segundo usuário (four-eyes principle). Para valores altos, um segundo aprovador seria mais seguro.

**Notificações de vencimento:** a infraestrutura para envio de e-mail existe (`utils/email_sender.py`) mas o envio automático de lembretes antes do vencimento não foi implementado no escopo do TCC.

---

## PERSPECTIVA DO USUÁRIO FINAL

### Quem usaria o sistema no dia a dia

**Tesoureiro (perfil Administrador ou Operador):** usa o sistema diariamente para criar lançamentos de cobrança no início de cada mês, efetivar pagamentos conforme chegam, e verificar inadimplência.

**Presidente e diretores (perfil Consulta ou Operador):** usam o dashboard para acompanhar a saúde financeira da associação antes das reuniões de diretoria.

**Secretário (perfil Operador):** gerencia o cadastro de associados — inclui novos moradores, atualiza dados de contato.

### O que muda na prática para o tesoureiro

Antes: abrir planilha → encontrar a aba do mês → adicionar linha manualmente → comparar datas para encontrar inadimplentes.

Depois: abrir o sistema → criar lançamento preenchendo o formulário → o sistema marca inadimplência automaticamente → dashboard mostra quem está em atraso.

O processo de cobrança mensal sai de 1–2 horas de trabalho manual para 10–15 minutos de registro.

---

## POR QUE ISSO MERECE UM TCC

O projeto une três dimensões que um TCC deve demonstrar:

**1. Problema real com usuário real**
A AMSI é uma organização existente com um problema documentado. O sistema não foi construído para um cenário hipotético.

**2. Decisões técnicas justificadas**
Cada escolha tecnológica tem uma justificativa baseada no caso de uso — não "usamos React porque é popular", mas "usamos React porque o ecossistema de componentes disponíveis é mais amplo e a transferibilidade da habilidade para o mercado de trabalho é relevante".

**3. Qualidade verificável**
214 testes automatizados. Documentação de 11 arquivos. Arquitetura em camadas com separação de responsabilidades. O sistema não é apenas funcional — é construído de forma que outro desenvolvedor possa entender, modificar e testar.

---

## RESPOSTAS PREPARADAS PARA PERGUNTAS DE NEGÓCIO FREQUENTES

**"A associação vai usar de fato?"**
O sistema foi desenvolvido como MVP (Produto Mínimo Viável) para validação do conceito. A adoção real depende de treinamento dos usuários e hospedagem em infraestrutura acessível — passos que estão além do escopo do TCC mas são o próximo passo natural.

**"Quantos usuários a associação tem?"**
[Responder com o número real de associados da AMSI — informação que a equipe deve ter do levantamento de requisitos.]

**"O sistema está em produção?"**
O sistema está em estado de desenvolvimento avançado, com todas as funcionalidades do MVP implementadas e testadas. Colocar em produção exigiria: resolver as migrações de banco com Alembic, configurar CORS para o domínio de produção, e treinar os usuários da associação.

**"O sistema foi aprovado pela diretoria da AMSI?"**
[Responder com base no que foi de fato apresentado ou validado com a associação durante o desenvolvimento.]
