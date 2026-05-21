/**
 * DemoRegistroPage — Auto-registro para estagiários no modo de ensaio.
 *
 * Esta página só é acessível / útil quando o backend está com APP_ENV=demo.
 * Para desacoplar após o ensaio: mude APP_ENV=demo → APP_ENV=development.
 * O link para esta página some automaticamente do Login quando o modo demo
 * está inativo.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/login.css';
import { demoRegistro } from '../services/api.js';
import logo from '../assets/AMSI_Logo.png';

function DemoRegistroPage() {
	const navigate = useNavigate();

	const [nome, setNome]               = useState('');
	const [email, setEmail]             = useState('');
	const [cargo, setCargo]             = useState('Associado');
	const [perfil, setPerfil]           = useState('Administrador');
	const [senha, setSenha]             = useState('');
	const [confirmar, setConfirmar]     = useState('');
	const [erro, setErro]               = useState('');
	const [sucesso, setSucesso]         = useState(false);
	const [carregando, setCarregando]   = useState(false);

	const CARGOS = [
		'Presidente',
		'Diretor',
		'Tesoureiro',
		'Secretário',
		'Conselheiro',
		'Associado',
		'Desenvolvedor',
	];

	const PERFIS = ['Administrador', 'Operador', 'Consulta'];

	const handleSubmit = async (e) => {
		e.preventDefault();
		setErro('');

		if (senha !== confirmar) {
			setErro('As senhas não coincidem.');
			return;
		}
		if (senha.length < 6) {
			setErro('A senha deve ter no mínimo 6 caracteres.');
			return;
		}

		setCarregando(true);
		try {
			await demoRegistro({ nome, email, senha, cargo, perfil_de_acesso: perfil });
			setSucesso(true);
			setTimeout(() => navigate('/'), 3000);
		} catch (err) {
			setErro(err.message || 'Não foi possível criar a conta.');
		} finally {
			setCarregando(false);
		}
	};

	return (
		<div className="login-container">
			{/* ── Lado esquerdo: branding ── */}
			<div className="login-branding">
				<img src={logo} alt="AMSI Logo" className="branding-logo" />
				<h1 className="branding-title">AMSI</h1>
				<p className="branding-subtitle">Associação de Moradores de Santa Isabel</p>
				<div className="branding-divider" />
				<p className="branding-tagline">
					Crie sua conta para participar do ensaio de apresentação
				</p>
			</div>

			{/* ── Lado direito: formulário ── */}
			<div className="login-form-side">
				<div className="login-box">
					{sucesso ? (
						<>
							<div style={{
								textAlign: 'center',
								padding: '32px 0',
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: '16px'
							}}>
								<i
									className="bi bi-check-circle-fill"
									style={{ fontSize: '3rem', color: 'var(--primary)' }}
								/>
								<h2 style={{ fontFamily: 'Cormorant Garamond, serif' }}>
									Conta criada!
								</h2>
								<p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
									Redirecionando para o login…
								</p>
							</div>
						</>
					) : (
						<>
							<h2>Criar conta</h2>
							<p className="login-welcome">
								Preencha os dados abaixo para participar do ensaio
							</p>

							{/* Banner de aviso — modo de ensaio */}
							<div style={{
								background: 'rgba(201,168,76,0.10)',
								border: '1px solid rgba(201,168,76,0.35)',
								borderRadius: '8px',
								padding: '10px 14px',
								marginBottom: '24px',
								fontSize: '0.78rem',
								color: 'var(--text-muted)',
								display: 'flex',
								alignItems: 'center',
								gap: '8px'
							}}>
								<i className="bi bi-cone-striped" style={{ color: '#C9A84C', flexShrink: 0 }} />
								Conta de ensaio — sem envio de email.
							</div>

							<form onSubmit={handleSubmit}>
								<div className="input-group">
									<label htmlFor="nome">Nome completo</label>
									<input
										id="nome"
										type="text"
										placeholder="Seu nome"
										value={nome}
										onChange={(e) => setNome(e.target.value)}
										required
									/>
								</div>

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
									<label htmlFor="cargo">Cargo</label>
									<select
										id="cargo"
										value={cargo}
										onChange={(e) => setCargo(e.target.value)}
										required
										style={{
											width: '100%',
											padding: '13px 16px',
											background: 'var(--input-bg)',
											border: '1px solid var(--border)',
											borderRadius: '8px',
											fontFamily: 'DM Sans, sans-serif',
											fontSize: '0.9rem',
											color: 'var(--text)',
											outline: 'none',
											cursor: 'pointer',
											appearance: 'auto',
										}}
									>
										{CARGOS.map((c) => (
											<option key={c} value={c}>{c}</option>
										))}
									</select>
								</div>

								<div className="input-group">
									<label htmlFor="perfil">Perfil de acesso</label>
									<select
										id="perfil"
										value={perfil}
										onChange={(e) => setPerfil(e.target.value)}
										required
										style={{
											width: '100%',
											padding: '13px 16px',
											background: 'var(--input-bg)',
											border: '1px solid var(--border)',
											borderRadius: '8px',
											fontFamily: 'DM Sans, sans-serif',
											fontSize: '0.9rem',
											color: 'var(--text)',
											outline: 'none',
											cursor: 'pointer',
											appearance: 'auto',
										}}
									>
										{PERFIS.map((p) => (
											<option key={p} value={p}>{p}</option>
										))}
									</select>
								</div>

								<div className="input-group">
									<label htmlFor="senha">Senha</label>
									<input
										id="senha"
										type="password"
										placeholder="Mínimo 6 caracteres"
										value={senha}
										onChange={(e) => setSenha(e.target.value)}
										required
									/>
								</div>

								<div className="input-group">
									<label htmlFor="confirmar">Confirmar senha</label>
									<input
										id="confirmar"
										type="password"
										placeholder="Repita a senha"
										value={confirmar}
										onChange={(e) => setConfirmar(e.target.value)}
										required
									/>
								</div>

								<button type="submit" disabled={carregando}>
									{carregando ? 'Criando conta…' : 'Criar conta'}
								</button>

								{erro && <p className="login-erro">{erro}</p>}
							</form>

							<p style={{
								textAlign: 'center',
								marginTop: '20px',
								fontSize: '0.82rem',
								color: 'var(--text-muted)'
							}}>
								Já tem conta?{' '}
								<Link
									to="/"
									style={{ color: 'var(--primary)', fontWeight: 500 }}
								>
									Fazer login
								</Link>
							</p>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

export default DemoRegistroPage;
