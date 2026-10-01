import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import '../styles/login.css';
import { loginUser, getUser, getDemoStatus, esqueciSenha } from '../services/api.js';
import logo from '../assets/AMSI_Logo.png';

function Login() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
	const [senha, setSenha] = useState('');
	const [erro, setErro] = useState('');
	const [modoDemo, setModoDemo] = useState(false);
	// Contador de falhas de credencial (401) por e-mail — controla a dica de senha esquecida
	const [tentativas, setTentativas] = useState(0);
	const [emailTentativas, setEmailTentativas] = useState('');
	// Autoatendimento "esqueci a senha": alterna o formulário de recuperação
	const [modoRecuperar, setModoRecuperar] = useState(false);
	const [enviandoRecuperar, setEnviandoRecuperar] = useState(false);
	const [msgRecuperar, setMsgRecuperar] = useState('');

	// Verifica se o backend está em modo demo para exibir o link de auto-registro
	useEffect(() => {
		getDemoStatus().then((res) => setModoDemo(res.demo_ativo ?? false));
	}, []);

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

			// Login direto: todos os perfis caem no dashboard (sem troca de senha forçada
			// nem cadastro de e-mail obrigatório). Deep links via ?redirect= são respeitados.
			const redirect = searchParams.get('redirect');
			navigate(redirect ?? '/dashboard');
		} catch (err) {
			setErro(err.message || 'Erro ao fazer login');
			// Só falha de credencial (401) conta para a dica; 403 (bloqueado/suspenso) não incrementa.
			if (err.status === 401) {
				setTentativas((prev) => (email === emailTentativas ? prev + 1 : 1));
				setEmailTentativas(email);
			}
		}
	};

	useEffect(() => {
		if (erro) {
			const timer = setTimeout(() => setErro(''), 60000);
			return () => clearTimeout(timer);
		}
	}, [erro]);

	// "Esqueci a senha": busca por Login (aceita login ou e-mail). O backend responde com
	// mensagem de sucesso quando reconhece o Login E ele tem e-mail cadastrado; caso
	// contrário (login desconhecido ou sem e-mail) lança erro com a mensagem a corrigir.
	const handleRecuperar = async (e) => {
		e.preventDefault();
		const identificador = email.trim();
		if (!identificador) {
			setErro('Informe seu Login para recuperar a senha.');
			return;
		}
		setErro('');
		setEnviandoRecuperar(true);
		try {
			const res = await esqueciSenha(identificador);
			setMsgRecuperar(
				res?.detail ||
					'Enviamos um e-mail para você; confira sua caixa de entrada. Se o problema persistir, contate um administrador.'
			);
		} catch (err) {
			setErro(
				err.message || 'Não reconhecemos esse Login. Corrija ou contate um administrador.'
			);
		} finally {
			setEnviandoRecuperar(false);
		}
	};

	const abrirRecuperar = () => {
		setErro('');
		setMsgRecuperar('');
		setModoRecuperar(true);
	};

	const voltarLogin = () => {
		setMsgRecuperar('');
		setModoRecuperar(false);
	};

	return (
		<>
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
						{modoRecuperar ? (
							/* ── Modo recuperação de senha (autoatendimento) ── */
							<>
								<h2>Recuperar senha</h2>
								<p className="login-welcome">
									Informe seu Login e enviaremos um link para você criar uma nova senha.
								</p>

								{msgRecuperar ? (
									<p
										style={{
											padding: '12px 14px',
											background: 'rgba(34,197,94,0.08)',
											border: '1px solid rgba(34,197,94,0.25)',
											borderRadius: 6,
											color: '#16a34a',
											fontSize: '0.82rem',
											textAlign: 'center'
										}}
									>
										{msgRecuperar}
									</p>
								) : (
									<form onSubmit={handleRecuperar}>
										<div className="input-group">
											<label htmlFor="login-recuperar">Login</label>
											<input
												id="login-recuperar"
												type="text"
												placeholder="seu login ou e-mail"
												value={email}
												onChange={(e) => setEmail(e.target.value)}
												required
											/>
										</div>

										<button type="submit" disabled={enviandoRecuperar}>
											{enviandoRecuperar ? 'Enviando…' : 'Enviar link de recuperação'}
										</button>

										{erro && <p className="login-erro">{erro}</p>}
									</form>
								)}

								<p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.82rem' }}>
									<button
										type="button"
										onClick={voltarLogin}
										style={{
											background: 'none',
											border: 'none',
											color: 'var(--primary)',
											fontWeight: 500,
											cursor: 'pointer',
											fontSize: '0.82rem',
											padding: 0
										}}
									>
										← Voltar para o login
									</button>
								</p>
							</>
						) : (
							/* ── Modo login normal ── */
							<>
								<h2>Bem-vindo</h2>
								<p className="login-welcome">Acesse sua conta para continuar</p>

								<form onSubmit={handleSubmit}>
									<div className="input-group">
										<label htmlFor="email">CPF ou Email</label>
										{/* type="text" (não "email"): o campo aceita CPF além de e-mail — item 4 */}
										<input
											id="email"
											type="text"
											placeholder="CPF ou seu@email.com"
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

									{tentativas >= 3 && email.trim() !== '' && email === emailTentativas && (
										<p className="login-dica-senha">Esqueceu sua senha? Confira seu e-mail!</p>
									)}
								</form>

								{/* Autoatendimento de recuperação de senha */}
								<p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.82rem' }}>
									<button
										type="button"
										onClick={abrirRecuperar}
										style={{
											background: 'none',
											border: 'none',
											color: 'var(--primary)',
											fontWeight: 500,
											cursor: 'pointer',
											fontSize: '0.82rem',
											padding: 0
										}}
									>
										Esqueceu a senha?
									</button>
								</p>

								{/* Link de auto-registro — visível apenas em modo demo */}
								{modoDemo && (
									<p
										style={{
											textAlign: 'center',
											marginTop: '8px',
											fontSize: '0.82rem',
											color: 'var(--text-muted)'
										}}
									>
										Participando do ensaio?{' '}
										<Link to="/demo-registro" style={{ color: 'var(--primary)', fontWeight: 500 }}>
											Criar conta →
										</Link>
									</p>
								)}
							</>
						)}
					</div>
				</div>
			</div>
		</>
	);
}

export default Login;
