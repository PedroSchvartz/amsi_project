import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trocarSenha, cadastrarEmail } from '../services/api';
import { logout } from '../services/auth';
import '../styles/login.css'; /* reutiliza o CSS do login — mesma estrutura visual */

/*
  TrocarSenhaPage.jsx — Troca de senha no primeiro acesso
  Exibida sem navbar (rota independente no App.jsx).
  Reutiliza as classes do login.css para consistência visual.
  O tema aplicado é o verde (padrão do login).

  Primeiro acesso: NÃO pede a senha atual (o login já autenticou com a senha inicial).
  O e-mail é OPCIONAL — quem entrou só pelo CPF pode cadastrar um aqui, na mesma tela,
  para receber avisos e poder recuperar a senha. Deixar em branco não bloqueia nada.
*/

function TrocarSenhaPage() {
	const navigate = useNavigate();

	const [form, setForm] = useState({
		email: '',
		nova_senha: '',
		confirmar_senha: ''
	});
	const [erro, setErro] = useState('');
	const [sucesso, setSucesso] = useState(false);
	const [enviando, setEnviando] = useState(false);

	// Mostra/esconde as senhas individualmente
	const [mostrar, setMostrar] = useState({
		nova_senha: false,
		confirmar_senha: false
	});

	const toggleMostrar = (campo) => setMostrar((p) => ({ ...p, [campo]: !p[campo] }));

	const handleChange = (e) => {
		setForm({ ...form, [e.target.name]: e.target.value });
		setErro('');
	};

	const validar = () => {
		if (form.nova_senha.length < 6) return 'A nova senha deve ter pelo menos 6 caracteres.';
		if (form.nova_senha !== form.confirmar_senha) return 'As senhas não conferem.';
		if (form.email.trim() && !form.email.includes('@')) return 'Informe um e-mail válido ou deixe em branco.';
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
			// E-mail é opcional. Cadastra ANTES de trocar a senha: se o e-mail for inválido
			// (domínio/duplicado), aborta sem ter mexido na senha — o usuário corrige ou limpa.
			const emailInformado = form.email.trim();
			if (emailInformado) {
				await cadastrarEmail(emailInformado);
			}

			await trocarSenha({ nova_senha: form.nova_senha });
			setSucesso(true);
			// Aguarda 2s para o usuário ler o feedback e redireciona para o login com o
			// identificador preenchido (o e-mail recém-cadastrado, se houver).
			setTimeout(() => {
				const userStr = localStorage.getItem('user');
				const emailAtual = emailInformado || (userStr ? (JSON.parse(userStr)?.email ?? '') : '');
				logout();
				navigate(emailAtual ? `/?email=${encodeURIComponent(emailAtual)}` : '/');
			}, 2000);
		} catch (err) {
			setErro(err.message || 'Erro ao salvar. Tente novamente.');
		} finally {
			setEnviando(false);
		}
	};

	return (
		/* Reutiliza .login-container para manter layout dividido igual ao login */
		<div className="login-container">
			{/* ── Lado esquerdo — branding ── */}
			<div className="login-branding">
				<div className="branding-title">AMSI</div>
				<div className="branding-divider" />
				<div className="branding-subtitle">Associação de Moradores de Santa Isabel</div>
				<p className="branding-tagline">Configure sua senha de acesso para continuar.</p>
			</div>

			{/* ── Lado direito — formulário ── */}
			<div className="login-form-side">
				<div className="login-box">
					<h2>Criar nova senha</h2>
					<p className="login-welcome">
						Este é seu primeiro acesso. Defina uma senha pessoal para continuar.
					</p>

					{/* Estado de sucesso */}
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
							Senha alterada com sucesso!
							<span style={{ fontSize: '0.78rem', opacity: 0.8 }}>
								Redirecionando para o login...
							</span>
						</div>
					) : (
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
								{/* Indicador de força */}
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

							{/* E-mail (opcional) — quem entrou só pelo CPF pode cadastrar aqui */}
							<div className="input-group">
								<label htmlFor="email">E-mail (opcional)</label>
								<input
									id="email"
									name="email"
									type="email"
									value={form.email}
									onChange={handleChange}
									placeholder="seu@email.com"
									autoComplete="email"
									style={{ width: '100%', boxSizing: 'border-box' }}
								/>
								<span style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
									Cadastre um e-mail para receber avisos e poder recuperar sua senha. Pode deixar em branco.
								</span>
							</div>

							{/* Mensagem de erro */}
							{erro && <div className="login-erro">{erro}</div>}

							{/* Botão de submit */}
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
										Salvando...
									</span>
								) : (
									'Salvar senha'
								)}
							</button>

							<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}

export default TrocarSenhaPage;
