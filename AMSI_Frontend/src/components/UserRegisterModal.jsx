import { useState } from 'react';
import { useToast } from './ToastStack.jsx';
import { createUser } from '../services/api';

const campo = { display: 'flex', flexDirection: 'column', marginBottom: 14 };
const label = {
	fontSize: '0.72rem',
	fontWeight: 500,
	color: 'var(--text-muted)',
	letterSpacing: '0.06em',
	textTransform: 'uppercase',
	marginBottom: 5
};
const input = {
	padding: '9px 12px',
	borderRadius: 8,
	border: '1px solid var(--border)',
	background: 'var(--input-bg)',
	color: 'var(--text)',
	fontSize: '0.875rem',
	outline: 'none'
};

function UserRegisterModal({ onFechar }) {
	const VAZIO = { nome: '', login: '', email: '', senha: '', notificacao: false, cargo: '', perfil_de_acesso: '' };
	const [form, setForm] = useState(VAZIO);
	const { mostrarToast } = useToast();

	const handleChange = (e) => {
		const { name, type, value, checked } = e.target;
		setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
	};

	const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

	const handleSubmit = async (e) => {
		e.preventDefault();
		// Login-only: a coluna login é a única credencial que autentica — sempre obrigatória.
		if (!form.login.trim()) {
			mostrarToast('Informe o login.', 'aviso');
			return;
		}
		const temEmail = !!form.email.trim();
		// Notificar por e-mail exige e-mail (o backend também barra).
		if (form.notificacao && !temEmail) {
			mostrarToast('Para notificar por e-mail, informe um e-mail.', 'aviso');
			return;
		}
		// E-mail, se preenchido, tem que ser válido.
		if (temEmail && !emailValido(form.email)) {
			mostrarToast('E-mail inválido.', 'aviso');
			return;
		}
		// Sem e-mail não há link "defina sua senha": o admin digita a senha provisória (≥6).
		if (!temEmail && form.senha.trim().length < 6) {
			mostrarToast('Sem e-mail, informe uma senha provisória de ao menos 6 caracteres.', 'aviso');
			return;
		}
		try {
			await createUser(form);
			mostrarToast('Usuário cadastrado com sucesso!');
			setForm(VAZIO);
		} catch (err) {
			const msg = err.message === 'Failed to fetch'
				? 'Não foi possível conectar ao servidor.'
				: (err.message || 'Erro ao cadastrar usuário');
			mostrarToast(msg, 'erro');
		}
	};

	return (
		<>
			<div
				style={{
					position: 'fixed',
					inset: 0,
					background: 'rgba(0,0,0,0.55)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 9980,
					padding: 20
				}}
				onClick={onFechar}
			>
				<div
					style={{
						background: 'var(--bg-card)',
						borderRadius: 14,
						width: '100%',
						maxWidth: 480,
						maxHeight: '90vh',
						overflowY: 'auto',
						padding: '32px 36px',
						boxShadow: '0 16px 48px var(--shadow)'
					}}
					onClick={(e) => e.stopPropagation()}
				>
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							marginBottom: 24
						}}
					>
						<h4
							style={{
								margin: 0,
								fontFamily: 'var(--font-display)',
								color: 'var(--primary)',
								fontWeight: 700
							}}
						>
							Cadastrar Usuário
						</h4>
						<button
							onClick={onFechar}
							style={{
								background: 'transparent',
								border: 'none',
								cursor: 'pointer',
								fontSize: '1.2rem',
								color: 'var(--text-muted)'
							}}
						>
							✕
						</button>
					</div>

					<form onSubmit={handleSubmit}>
						<div style={campo}>
							<label style={label}>Nome Completo</label>
							<input style={input} name="nome" value={form.nome} onChange={handleChange} required />
						</div>
						<div style={campo}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
								<label style={{ ...label, marginBottom: 0 }}>Login</label>
								<label
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 6,
										fontSize: '0.78rem',
										color: 'var(--text-muted)',
										textTransform: 'none',
										letterSpacing: 'normal',
										cursor: 'pointer'
									}}
								>
									<input
										type="checkbox"
										name="notificacao"
										checked={form.notificacao}
										onChange={handleChange}
									/>
									Notificar por Email
								</label>
							</div>
							<input style={input} name="login" value={form.login} onChange={handleChange} required />
						</div>
						<div style={campo}>
							<label style={label}>Email{form.notificacao ? '' : ' (opcional)'}</label>
							<input
								style={input}
								type="email"
								name="email"
								value={form.email}
								onChange={handleChange}
								required={form.notificacao}
							/>
						</div>
						{!form.email.trim() && (
							<div style={campo}>
								<label style={label}>Senha provisória</label>
								<input
									style={input}
									type="password"
									name="senha"
									value={form.senha}
									onChange={handleChange}
									autoComplete="new-password"
									required
								/>
								<span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
									Sem e-mail, defina a senha aqui (mín. 6). O usuário troca no 1º acesso.
								</span>
							</div>
						)}
						<div style={campo}>
							<label style={label}>Cargo</label>
							<select
								style={input}
								name="cargo"
								value={form.cargo}
								onChange={handleChange}
							>
								<option value="">Sem cargo</option>
								<option value="Presidente">Presidente</option>
								<option value="Diretor">Diretor</option>
								<option value="Tesoureiro">Tesoureiro</option>
								<option value="Secretário">Secretário</option>
								<option value="Conselheiro">Conselheiro</option>
								<option value="Desenvolvedor">Desenvolvedor</option>
							</select>
						</div>
						<div style={campo}>
							<label style={label}>Perfil de Acesso</label>
							<select
								style={input}
								name="perfil_de_acesso"
								value={form.perfil_de_acesso}
								onChange={handleChange}
								required
							>
								<option value="">Selecione</option>
								<option value="Administrador">Administrador</option>
								<option value="Operador">Operador</option>
								<option value="Consulta">Consulta</option>
							</select>
						</div>
						<div
							style={{
								display: 'flex',
								justifyContent: 'flex-end',
								gap: 10,
								marginTop: 20,
								paddingTop: 16,
								borderTop: '1px solid var(--border)'
							}}
						>
							<button
								type="button"
								onClick={onFechar}
								style={{
									padding: '8px 18px',
									borderRadius: 8,
									border: '1px solid var(--border)',
									background: 'transparent',
									color: 'var(--text)',
									fontWeight: 500,
									cursor: 'pointer'
								}}
							>
								Cancelar
							</button>
							<button
								type="submit"
								style={{
									padding: '8px 18px',
									borderRadius: 8,
									border: 'none',
									background: 'var(--primary)',
									color: '#fff',
									fontWeight: 600,
									cursor: 'pointer'
								}}
							>
								Salvar
							</button>
						</div>
					</form>
				</div>
			</div>
		</>
	);
}

export default UserRegisterModal;
