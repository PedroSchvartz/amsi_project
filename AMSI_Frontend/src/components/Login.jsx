import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';
import { loginUser, getUser } from '../services/api.js';
import logo from '../assets/AMSI_Logo.png';

function Login() {
	const navigate = useNavigate();
	const [email, setEmail] = useState('');
	const [senha, setSenha] = useState('');
	const [erro, setErro] = useState('');
	const [tema, setTema] = useState('verde');

	useEffect(() => {
		if (tema === 'corporativo') {
			document.documentElement.setAttribute('data-theme', 'corporativo');
		} else {
			document.documentElement.removeAttribute('data-theme');
		}
		localStorage.setItem('amsi_tema', tema);
	}, [tema]);

	const toggleTema = () => {
		setTema((t) => (t === 'verde' ? 'corporativo' : 'verde'));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			const data = await loginUser(email, senha);
			const token = data.access_token || data.token;
			if (!token) throw new Error('Token não recebido');

			localStorage.setItem('token', token);
			localStorage.setItem('user', JSON.stringify(data));

			try {
				const payload = JSON.parse(atob(token.split('.')[1]));
				localStorage.setItem('expiresAt', payload.exp * 1000);
				const usuario = await getUser(payload.sub);
				localStorage.setItem('user', JSON.stringify(usuario));
			} catch (errUser) {
				console.error('Erro ao buscar usuário:', errUser);
				if (!localStorage.getItem('expiresAt')) {
					try {
						const payload = JSON.parse(atob(token.split('.')[1]));
						localStorage.setItem('expiresAt', payload.exp * 1000);
					} catch {}
				}
			}

			if (data.primeiro_acesso) {
				navigate('/trocar-senha');
			} else {
				navigate('/home');
			}
		} catch (err) {
			setErro(err.message || 'Erro ao fazer login');
		}
	};

	useEffect(() => {
		if (erro) {
			const timer = setTimeout(() => setErro(''), 3000);
			return () => clearTimeout(timer);
		}
	}, [erro]);

	return (
		<>
			<button className="theme-toggle" onClick={toggleTema}>
  <span
    className="dot"
    style={{
      background: tema === 'verde' ? '#38BDF8' : '#1B4332'
    }}
  />
  {tema === 'verde' ? 'Tema Corporativo' : 'Tema Verde'}
</button>

			<div className="login-container">
				<div className="login-branding">
					<img src={logo} alt="AMSI Logo" className="branding-logo" />
					<h1 className="branding-title">AMSI</h1>
					<p className="branding-subtitle">Associação de Moradores de Santa Isabel</p>
					<div className="branding-divider" />
					<p className="branding-tagline">
						Sistema de gestão financeira para associações de moradores
					</p>
				</div>

				<div className="login-form-side">
					<div className="login-box">
						<h2>Bem-vindo</h2>
						<p className="login-welcome">Acesse sua conta para continuar</p>

						<form onSubmit={handleSubmit}>
							<div className="input-group">
								<label htmlFor="email">Email</label>
								<input
									id="email"
									type="email"
									placeholder="seu@email.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
								/>
							</div>

							<div className="input-group">
								<label htmlFor="senha">Senha</label>
								<input
									id="senha"
									type="password"
									placeholder="••••••••"
									value={senha}
									onChange={(e) => setSenha(e.target.value)}
									required
								/>
							</div>

							<button type="submit">Entrar</button>

							{erro && <p className="login-erro">{erro}</p>}
						</form>
					</div>
				</div>
			</div>
		</>
	);
}

export default Login;
