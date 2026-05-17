import { useState } from 'react';
import ToastStack, { useToast } from './ToastStack.jsx';
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
	const [form, setForm] = useState({ nome: '', email: '', cargo: '', perfil_de_acesso: '' });
	const { toasts, mostrarToast, removerToast } = useToast();

	const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			await createUser(form);
			mostrarToast('Usuário cadastrado com sucesso!');
			setForm({ nome: '', email: '', cargo: '', perfil_de_acesso: '' });
		} catch (err) {
			mostrarToast(err.message || 'Erro ao cadastrar usuário', 'erro');
		}
	};

	return (
		<>
			<ToastStack toasts={toasts} onRemover={removerToast} />
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
							<label style={label}>Email</label>
							<input
								style={input}
								type="email"
								name="email"
								value={form.email}
								onChange={handleChange}
								required
							/>
						</div>
						<div style={campo}>
							<label style={label}>Cargo</label>
							<select
								style={input}
								name="cargo"
								value={form.cargo}
								onChange={handleChange}
								required
							>
								<option value="">Selecione</option>
								<option value="Presidente">Presidente</option>
								<option value="Tesoureiro">Tesoureiro</option>
								<option value="Secretário">Secretário</option>
								<option value="Conselheiro">Conselheiro</option>
								<option value="Associado">Associado</option>
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
