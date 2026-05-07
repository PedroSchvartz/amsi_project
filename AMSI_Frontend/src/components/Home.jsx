import '../styles/home.css';
import { Link } from 'react-router-dom';
import { isAdmin } from '../services/auth';

const cards = [
	{
		titulo: 'Dashboard',
		descricao: 'Visualize dados e métricas do sistema.',
		link: '/dashboard',
		label: 'Ver Dashboard'
	},
	{
		titulo: 'Lista de Lançamentos',
		descricao: 'Pesquise e gerencie os lançamentos financeiros.',
		link: '/tipo_lancamento',
		label: 'Ver Lançamentos'
	},
	{
		titulo: 'Clientes / Fornecedores',
		descricao: 'Gerencie os clientes e fornecedores cadastrados.',
		link: '/cliente_fornecedor',
		label: 'Ver lista'
	},
	{
		titulo: 'Usuários',
		descricao: 'Gerencie os usuários do sistema.',
		link: '/usuarios',
		label: 'Ver lista'
	}
];

function Home() {
	const admin = isAdmin();
	const user = JSON.parse(localStorage.getItem('user') || '{}');
	const nome = user?.nome || 'Usuário';

	if (!admin) {
		return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
	}

	return (
		<div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '48px 24px' }}>
			<div style={{ maxWidth: 960, margin: '0 auto' }}>
				<div className="home-welcome" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
					<h1>Olá, {nome} 👋</h1>
					<p>Bem-vindo ao sistema de gestão financeira da AMSI.</p>
				</div>

				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(2, 1fr)',
						gap: '1.5rem'
					}}
				>
					{cards.map((card) => (
						<div
							key={card.link}
							style={{
								background: 'var(--bg-card)',
								borderRadius: 12,
								padding: '24px',
								boxShadow: '0 2px 12px var(--shadow)',
								display: 'flex',
								flexDirection: 'column',
								gap: '12px'
							}}
						>
							<h5 style={{ margin: 0, fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>
								{card.titulo}
							</h5>
							<p
								style={{
									margin: 0,
									fontSize: '0.875rem',
									color: 'var(--text-muted)',
									flex: 1,
									textAlign: 'center'
								}}
							>
								{card.descricao}
							</p>
							<Link
								to={card.link}
								style={{
									display: 'block',
									textAlign: 'center',
									padding: '9px 0',
									borderRadius: 8,
									background: 'var(--primary)',
									color: '#fff',
									fontWeight: 600,
									fontSize: '0.875rem',
									textDecoration: 'none'
								}}
							>
								{card.label}
							</Link>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export default Home;
