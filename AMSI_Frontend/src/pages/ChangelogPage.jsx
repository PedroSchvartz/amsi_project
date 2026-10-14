import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/changelog.css';

// Changelog do sistema. Cada entrada é um DEPLOY (a data só aparece por deploy);
// dentro dele, cada ponto corresponde a um commit que subiu naquela versão.
// Para registrar um novo deploy, adicione um objeto no TOPO da lista (mais recente
// primeiro) com a data ISO 'AAAA-MM-DD' e um ponto por commit.
const DEPLOYS = [
	{
		data: '2026-10-14',
		pontos: [
			{
				titulo: 'Painel mais limpo e sem rolar de lado no celular',
				detalhe:
					'O painel foi reorganizado para caber na tela do celular sem rolagem horizontal. Os totais de ' +
					'Receitas, Despesas e Saldo do período ficam sempre lado a lado, e as listas quebram em linhas ' +
					'em vez de esticar para o lado.',
			},
			{
				titulo: 'Filtro de período em uma linha',
				detalhe:
					'O seletor de período ficou mais enxuto: um único campo De–Até com o botão Pesquisar. Os atalhos ' +
					'de período (mês atual, último mês, etc.) foram removidos. No celular o botão Pesquisar fica na ' +
					'linha do título e os campos de data descem logo abaixo.',
			},
			{
				titulo: 'Estornos / Reembolsos viram lista na Posição atual',
				detalhe:
					'A informação de estornos/reembolsos deixou de ser um cartão de total e passou a ser uma lista ' +
					'por tipo (como Receitas e Despesas), agora dentro do bloco "Posição atual". Continua visível ' +
					'apenas para a equipe (Administrador e Operador).',
			},
		],
	},
	{
		data: '2026-10-12',
		pontos: [
			{
				titulo: 'Desfazer uma etapa do lançamento em dois cliques',
				detalhe:
					'No histórico do lançamento, voltar uma etapa (de Pago para Em análise, ou de Em análise ' +
					'para Aberto) agora é em dois cliques: o primeiro troca o botão para "Confirmar" e o segundo ' +
					'conclui. Antes era preciso segurar o botão, o que confundia no celular.',
			},
			{
				titulo: 'Campos da edição de lançamento não estouram mais no celular',
				detalhe:
					'Na janela de editar lançamento, os campos deixaram de ultrapassar a borda no celular — ' +
					'tudo cabe dentro da janela e continua legível.',
			},
			{
				titulo: 'Gerar acesso por documento quando já há acesso por e-mail',
				detalhe:
					'No cadastro de cliente/fornecedor, o botão "Gerar acesso" passa a criar o acesso pelo ' +
					'documento (CPF/CNPJ) mesmo quando já existe um usuário vinculado que entra por e-mail. ' +
					'O bloqueio agora é só quando já há um acesso com aquele mesmo documento.',
			},
		],
	},
	{
		data: '2026-10-01',
		pontos: [
			{
				titulo: 'Primeiro acesso vai direto para o painel',
				detalhe:
					'Ao entrar com login e senha, você cai direto no painel — a troca de senha deixou de ser ' +
					'obrigatória no primeiro acesso. O painel já abre carregado com o mês atual.',
			},
			{
				titulo: 'Trocar a senha quando quiser',
				detalhe:
					'Um botão "Trocar Senha" ao lado do "Sair" abre uma janela para definir uma nova senha a ' +
					'qualquer momento. Basta informar a nova senha e confirmá-la (e um e-mail, se ainda não tiver). ' +
					'Não é mais preciso digitar a senha atual.',
			},
			{
				titulo: 'Esqueci minha senha agora pergunta o Login',
				detalhe:
					'A recuperação de senha passa a aceitar o seu Login (CPF ou e-mail). Se o Login for reconhecido e ' +
					'tiver e-mail, enviamos o link; caso contrário, uma mensagem clara orienta a corrigir ou procurar um administrador.',
			},
			{
				titulo: 'E-mail do usuário e do cliente/fornecedor independentes',
				detalhe:
					'Editar ou remover o e-mail de um usuário não altera mais os contatos do cliente/fornecedor vinculado, ' +
					'e vice-versa. O vínculo entre eles permanece; apenas os e-mails deixaram de ser copiados automaticamente.',
			},
			{
				titulo: 'Visual único',
				detalhe:
					'O tema alternativo foi removido — o sistema passa a usar apenas a identidade visual verde da Associação.',
			},
			{
				titulo: 'Restaurar sem e-mail e editar contato na tela de usuários',
				detalhe:
					'Agora dá para restaurar um usuário excluído mesmo sem e-mail cadastrado: ao restaurar, o sistema ' +
					'oferece cadastrar um e-mail para notificar ou apenas reativar sem notificação. A modal de edição ' +
					'passou a permitir alterar (ou cadastrar) o e-mail de contato, e a barra de filtros foi reorganizada ' +
					'para a busca ocupar a largura livre — com um layout próprio no celular.',
			},
			{
				titulo: 'Acesso por documento (CPF)',
				detalhe:
					'É possível gerar o acesso de um morador direto do cadastro, sem depender de e-mail. ' +
					'A senha inicial são os 5 primeiros dígitos do documento e a troca é obrigatória no primeiro login.',
			},
			{
				titulo: 'Login único como credencial',
				detalhe:
					'A entrada no sistema passa a ser sempre pelo Login (CPF do morador ou e-mail da equipe); ' +
					'o e-mail vira apenas contato e recuperação. Login, e-mail, CPF/CNPJ e RG são únicos, ' +
					'um acesso por cadastro, e o administrador pode editar o Login pela tela de usuários.',
			},
			{
				titulo: 'Cadastro com e-mail opcional e filtros na lista',
				detalhe:
					'O administrador pode criar um usuário sem e-mail, definindo a senha provisória no próprio modal; ' +
					'o e-mail só é exigido quando se opta por notificar. A lista de usuários ganhou busca e filtros ' +
					'por perfil, cargo e status, e a coluna Nome agora quebra em linhas.',
			},
			{
				titulo: 'Recuperação de senha informa o login',
				detalhe:
					'Os e-mails de esqueci/redefinir senha e de conta restaurada passam a indicar qual login usar, ' +
					'evitando que quem entra por CPF tente logar pelo e-mail.',
			},
		],
	},
];

// 'AAAA-MM-DD' → 'dd/mm/aaaa' sem depender de fuso (evita o -1 dia do Date em UTC).
function formatarData(iso) {
	const [ano, mes, dia] = iso.split('-');
	return `${dia}/${mes}/${ano}`;
}

export default function ChangelogPage() {
	const navigate = useNavigate();
	// Todos os deploys começam colapsados, menos o mais recente (o primeiro da lista).
	const [abertos, setAbertos] = useState(() => new Set(DEPLOYS.length ? [DEPLOYS[0].data] : []));

	const alternar = (data) =>
		setAbertos((prev) => {
			const novo = new Set(prev);
			if (novo.has(data)) novo.delete(data);
			else novo.add(data);
			return novo;
		});

	return (
		<div className="changelog-page">
			<div className="changelog-page__head">
				<div>
					<h2 className="changelog-page__title">Novidades &amp; Atualizações</h2>
					<p className="changelog-page__subtitle">
						O que mudou no sistema a cada versão publicada.
					</p>
				</div>
				<button
					className="btn-acao-editar"
					onClick={() => navigate('/usuarios')}
					style={{ padding: '8px 18px', fontSize: '0.875rem' }}
					title="Voltar para Usuários"
				>
					<i className="bi bi-arrow-left" /> Voltar
				</button>
			</div>

			{DEPLOYS.map((deploy) => {
				const aberto = abertos.has(deploy.data);
				return (
					<section key={deploy.data} className="changelog-deploy">
						<button
							type="button"
							className="changelog-deploy__data"
							aria-expanded={aberto}
							onClick={() => alternar(deploy.data)}
						>
							<i className={`bi ${aberto ? 'bi-chevron-down' : 'bi-chevron-right'}`} />
							<i className="bi bi-rocket-takeoff" /> {formatarData(deploy.data)}
						</button>
						{aberto && (
							<ul className="changelog-deploy__pontos">
								{deploy.pontos.map((ponto) => (
									<li key={ponto.titulo} className="changelog-ponto">
										<span className="changelog-ponto__titulo">{ponto.titulo}</span>
										<span className="changelog-ponto__detalhe">{ponto.detalhe}</span>
									</li>
								))}
							</ul>
						)}
					</section>
				);
			})}
		</div>
	);
}
