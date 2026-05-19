import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../services/auth';

function NotFoundPage() {
	const navigate = useNavigate();

	return (
		<div style={{
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			minHeight: '60vh',
			padding: '40px 20px',
			textAlign: 'center'
		}}>
			<i
				className="bi bi-sign-stop"
				style={{ fontSize: '4rem', color: 'var(--text-muted)', marginBottom: 24 }}
			/>
			<h2 style={{
				fontFamily: 'var(--font-display)',
				fontSize: '1.5rem',
				fontWeight: 700,
				margin: '0 0 10px',
				color: 'var(--text)'
			}}>
				Página não encontrada
			</h2>
			<p style={{
				fontSize: '0.9rem',
				color: 'var(--text-muted)',
				margin: '0 0 28px',
				maxWidth: 360
			}}>
				Este caminho não existe ou você não tem permissão para acessá-lo.
			</p>
			<button
				onClick={() => navigate(isAuthenticated() ? '/home' : '/')}
				style={{
					padding: '9px 24px',
					borderRadius: 8,
					border: 'none',
					background: 'var(--primary)',
					color: '#fff',
					fontWeight: 600,
					fontSize: '0.875rem',
					cursor: 'pointer'
				}}
			>
				Ir para o início
			</button>
		</div>
	);
}

export default NotFoundPage;
