import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';
import { loginUser } from '../services/api.js';

function Login() {
	const navigate = useNavigate();
	const [email, setEmail] = useState('');
	const [senha, setSenha] = useState('');
	const [erro, setErro] = useState('');

	const handleSubmit = async (e) => {
		e.preventDefault();

		try {
			const data = await loginUser(email, senha);

			const token = data.access_token || data.token;

			if (!token) {
				throw new Error('Token não recebido');
			}

			localStorage.setItem('token', token);

			try {
				const payload = JSON.parse(atob(token.split('.')[1]));
				localStorage.setItem('expiresAt', payload.exp * 1000);
			} catch {
				localStorage.setItem('expiresAt', Date.now() + 240 * 240 * 1000);
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
		<div className="login-container">
			<div className="login-box">
				<h2>Login</h2>

				<form onSubmit={handleSubmit}>
					<input
						type="email"
						placeholder="Email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>

					<input
						type="password"
						placeholder="Senha"
						value={senha}
						onChange={(e) => setSenha(e.target.value)}
					/>

					<button type="submit">Entrar</button>

					{erro && <p style={{ color: 'red' }}>{erro}</p>}
				</form>
			</div>
		</div>
	);
}

export default Login;
