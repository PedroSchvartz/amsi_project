import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { validarTokenSenha, definirSenha, getUser } from '../services/api';
import '../styles/login.css'; /* reutiliza o CSS do login — mesma estrutura visual */

/*
  DefinirSenhaPage.jsx — Definição de senha por token de uso único
  Destino do link enviado por e-mail (cadastro, reset e "esqueci a senha").
  O token chega no FRAGMENT da URL (#token=...), nunca na query string, e por
  isso é lido de window.location.hash — useSearchParams só enxerga o "?".
  Rota pública (sem sessão): após definir a senha, o backend já devolve a sessão
  e fazemos o auto-login, indo direto para /home. Tema verde (padrão do login).
*/

// Extrai o token do fragment (#token=XXXX). Fora do componente: não depende de estado.
function lerTokenDoHash() {
	const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
	return new URLSearchParams(hash).get('token') ?? '';
}

function DefinirSenhaPage() {
	const navigate = useNavigate();
	const [token] = useState(lerTokenDoHash);

	// Estado da validação inicial do token: 'validando' | 'valido' | 'invalido'
	const [estado, setEstado] = useState('validando');
	const [nome, setNome] = useState('');

	const [form, setForm] = useState({ nova_senha: '', confirmar_senha: '' });
	const [mostrar, setMostrar] = useState({ nova_senha: false, confirmar_senha: false });
	const [erro, setErro] = useState('');
	const [enviando, setEnviando] = useState(false);

	// Valida o token (sem consumir) ao montar, para saudar o usuário ou já mostrar
	// "link expirado" antes de ele digitar a senha.
	useEffect(() => {
		if (!token) {
			setEstado('invalido');
			return;
		}
		let ativo = true;
		validarTokenSenha(token)
			.then((res) => {
				if (!ativo) return;
				if (res?.valido) {
					setNome(res.nome ?? '');
					setEstado('valido');
				} else {
					setEstado('invalido');
				}
			})
			.catch(() => ativo && setEstado('invalido'));
		return () => {
			ativo = false;
		};
	}, [token]);

	const toggleMostrar = (campo) => setMostrar((p) => ({ ...p, [campo]: !p[campo] }));

	const handleChange = (e) => {
		setForm({ ...form, [e.target.name]: e.target.value });
		setErro('');
	};

	const validar = () => {
		if (form.nova_senha.length < 6) return 'A nova senha deve ter pelo menos 6 caracteres.';
		if (form.nova_senha !== form.confirmar_senha) return 'As senhas não conferem.';
		return null;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const mensagemErro = validar();
		if (mensagemErro) {
			setErro(mensagemErro);
			return;
		}

		setEnviando(true);
		try {
			// Consome o token e já recebe a sessão (auto-login). Guarda igual ao Login.jsx.
			const data = await definirSenha({ token, senha_nova: form.nova_senha });
			const accessToken = data.access_token || data.token;
			if (!accessToken) throw new Error('Não foi possível iniciar a sessão.');

			localStorage.setItem('token', accessToken);
			localStorage.setItem('user', JSON.stringify(data));
			try {
				const payload = JSON.parse(atob(accessToken.split('.')[1]));
				localStorage.setItem('expiresAt', payload.exp * 1000);
				const usuario = await getUser(payload.sub);
				localStorage.setItem('user', JSON.stringify(usuario));
			} catch {
				// Sessão já está válida; falha ao buscar o perfil não impede o acesso.
			}
			navigate('/home');
		} catch (err) {
			// Token expirado/consumido entre a validação e o submit → volta para o estado inválido.
			const msg = err.message || 'Não foi possível definir a senha.';
			if (/inválido|expirado/i.test(msg)) {
				setEstado('invalido');
			} else {
				setErro(msg);
			}
		} finally {
			setEnviando(false);
		}
	};

	return (
		/* Reutiliza .login-container para manter o layout dividido igual ao login */
		<div className="login-container">
			{/* ── Lado esquerdo — branding ── */}
			<div className="login-branding">
				<div className="branding-title">AMSI</div>
				<div className="branding-divider" />
				<div className="branding-subtitle">Associação de Moradores de Santa Isabel</div>
				<p className="branding-tagline">Defina sua senha de acesso para continuar.</p>
			</div>

			{/* ── Lado direito — formulário ── */}
			<div className="login-form-side">
				<div className="login-box">
					{estado === 'validando' && (
						<div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
							<i
								className="bi bi-arrow-repeat"
								style={{
									fontSize: '1.6rem',
									display: 'block',
									marginBottom: 12,
									animation: 'spin 0.7s linear infinite'
								}}
							/>
							Validando seu link…
						</div>
					)}

					{estado === 'invalido' && (
						<>
							<h2>Link inválido ou expirado</h2>
							<p className="login-welcome">
								Este link já foi usado ou expirou. Solicite um novo na tela de login, em "Esqueceu a
								senha?".
							</p>
							<Link
								to="/"
								style={{
									display: 'inline-block',
									marginTop: 8,
									color: 'var(--primary)',
									fontWeight: 500,
									fontSize: '0.875rem'
								}}
							>
								← Voltar para o login
							</Link>
						</>
					)}

					{estado === 'valido' && (
						<>
							<h2>Criar sua senha</h2>
							<p className="login-welcome">
								{nome ? `Olá, ${nome}! ` : ''}Defina uma senha pessoal para acessar o sistema.
							</p>

							<form onSubmit={handleSubmit} autoComplete="off">
								{/* Nova senha */}
								<div className="input-group">
									<label htmlFor="nova_senha">Nova senha</label>
									<div style={{ position: 'relative', width: '100%' }}>
										<input
											id="nova_senha"
											name="nova_senha"
											type={mostrar.nova_senha ? 'text' : 'password'}
											value={form.nova_senha}
											onChange={handleChange}
											placeholder="Mínimo 6 caracteres"
											autoComplete="new-password"
											style={{ width: '100%', boxSizing: 'border-box', paddingRight: 42 }}
										/>
										<button
											type="button"
											onClick={() => toggleMostrar('nova_senha')}
											style={{
												position: 'absolute',
												right: 12,
												top: '50%',
												transform: 'translateY(-50%)',
												background: 'none',
												border: 'none',
												cursor: 'pointer',
												color: 'var(--text-muted)',
												fontSize: '0.9rem',
												padding: 0
											}}
											tabIndex={-1}
										>
											<i className={`bi ${mostrar.nova_senha ? 'bi-eye-slash' : 'bi-eye'}`} />
										</button>
									</div>
									{/* Indicador de força (mesmo padrão da TrocarSenhaPage) */}
									{form.nova_senha.length > 0 && (
										<div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
											{[1, 2, 3, 4].map((n) => (
												<div
													key={n}
													style={{
														flex: 1,
														height: 3,
														borderRadius: 2,
														background:
															form.nova_senha.length >= n * 3
																? n <= 1
																	? '#ef4444'
																	: n <= 2
																		? '#f59e0b'
																		: n <= 3
																			? '#3b82f6'
																			: '#16a34a'
																: 'var(--border)',
														transition: 'background 0.2s'
													}}
												/>
											))}
										</div>
									)}
								</div>

								{/* Confirmar nova senha */}
								<div className="input-group">
									<label htmlFor="confirmar_senha">Confirmar nova senha</label>
									<div style={{ position: 'relative', width: '100%' }}>
										<input
											id="confirmar_senha"
											name="confirmar_senha"
											type={mostrar.confirmar_senha ? 'text' : 'password'}
											value={form.confirmar_senha}
											onChange={handleChange}
											placeholder="Repita a nova senha"
											autoComplete="new-password"
											style={{ width: '100%', boxSizing: 'border-box', paddingRight: 42 }}
										/>
										<button
											type="button"
											onClick={() => toggleMostrar('confirmar_senha')}
											style={{
												position: 'absolute',
												right: 12,
												top: '50%',
												transform: 'translateY(-50%)',
												background: 'none',
												border: 'none',
												cursor: 'pointer',
												color: 'var(--text-muted)',
												fontSize: '0.9rem',
												padding: 0
											}}
											tabIndex={-1}
										>
											<i className={`bi ${mostrar.confirmar_senha ? 'bi-eye-slash' : 'bi-eye'}`} />
										</button>
									</div>
								</div>

								{erro && <div className="login-erro">{erro}</div>}

								<button type="submit" disabled={enviando}>
									{enviando ? (
										<span
											style={{
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												gap: 8
											}}
										>
											<i
												className="bi bi-arrow-repeat"
												style={{ animation: 'spin 0.7s linear infinite' }}
											/>
											Salvando…
										</span>
									) : (
										'Salvar senha'
									)}
								</button>
							</form>
						</>
					)}

					<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
				</div>
			</div>
		</div>
	);
}

export default DefinirSenhaPage;
