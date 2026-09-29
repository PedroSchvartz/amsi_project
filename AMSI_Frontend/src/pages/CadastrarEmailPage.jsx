import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cadastrarEmail } from '../services/api';
import '../styles/login.css'; /* reutiliza o CSS do login — mesma estrutura visual */

/*
  CadastrarEmailPage.jsx — Convite para cadastrar e-mail
  Exibida a CADA login de quem entrou só pelo CPF e ainda não tem e-mail (Email NULL) —
  enquanto não cadastrar, o convite reaparece. É DISPENSÁVEL: dá para pular e cadastrar
  depois, não bloqueia o sistema. Sem navbar (rota independente no App.jsx).
*/

function CadastrarEmailPage() {
	const navigate = useNavigate();

	const [email, setEmail] = useState('');
	const [erro, setErro] = useState('');
	const [sucesso, setSucesso] = useState(false);
	const [enviando, setEnviando] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!email.trim()) {
			setErro('Informe um e-mail.');
			return;
		}
		setEnviando(true);
		try {
			const resp = await cadastrarEmail(email.trim());
			// Reflete o e-mail novo no user guardado (para não reabrir esta tela no próximo login).
			try {
				const userStr = localStorage.getItem('user');
				if (userStr) {
					const user = JSON.parse(userStr);
					user.email = resp?.email ?? email.trim();
					localStorage.setItem('user', JSON.stringify(user));
				}
			} catch {
				/* localStorage indisponível — segue o fluxo, o e-mail já foi salvo no backend */
			}
			setSucesso(true);
			setTimeout(() => navigate('/home'), 1500);
		} catch (err) {
			setErro(err.message || 'Erro ao cadastrar o e-mail.');
		} finally {
			setEnviando(false);
		}
	};

	const pular = () => navigate('/home');

	return (
		<div className="login-container">
			{/* ── Lado esquerdo — branding ── */}
			<div className="login-branding">
				<div className="branding-title">AMSI</div>
				<div className="branding-divider" />
				<div className="branding-subtitle">Associação de Moradores de Santa Isabel</div>
				<p className="branding-tagline">Cadastre um e-mail para receber avisos e recuperar o acesso.</p>
			</div>

			{/* ── Lado direito — formulário ── */}
			<div className="login-form-side">
				<div className="login-box">
					<h2>Cadastrar e-mail</h2>
					<p className="login-welcome">
						Você entrou usando seu CPF e ainda não tem um e-mail cadastrado. Cadastre um para
						receber notificações e poder recuperar sua senha.
					</p>

					{sucesso ? (
						<div
							style={{
								padding: '16px',
								background: 'rgba(34,197,94,0.08)',
								border: '1px solid rgba(34,197,94,0.25)',
								borderRadius: 8,
								color: '#16a34a',
								fontSize: '0.875rem',
								textAlign: 'center',
								display: 'flex',
								flexDirection: 'column',
								gap: 8
							}}
						>
							<i className="bi bi-check-circle" style={{ fontSize: '1.5rem' }} />
							E-mail cadastrado com sucesso!
							<span style={{ fontSize: '0.78rem', opacity: 0.8 }}>Redirecionando...</span>
						</div>
					) : (
						<form onSubmit={handleSubmit}>
							<div className="input-group">
								<label htmlFor="email">Email</label>
								<input
									id="email"
									type="email"
									placeholder="seu@email.com"
									value={email}
									onChange={(e) => {
										setEmail(e.target.value);
										setErro('');
									}}
									required
								/>
							</div>

							{erro && <div className="login-erro">{erro}</div>}

							<button type="submit" disabled={enviando}>
								{enviando ? 'Salvando…' : 'Cadastrar e-mail'}
							</button>

							<p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.82rem' }}>
								<button
									type="button"
									onClick={pular}
									style={{
										background: 'none',
										border: 'none',
										color: 'var(--text-muted)',
										fontWeight: 500,
										cursor: 'pointer',
										fontSize: '0.82rem',
										padding: 0
									}}
								>
									Pular por agora
								</button>
							</p>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}

export default CadastrarEmailPage;
