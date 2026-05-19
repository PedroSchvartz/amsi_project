import { useState } from 'react';
import { updateUser } from '../services/api';
import ModalConfirm from './ModalConfirm.jsx';
import { useToast } from './ToastStack.jsx';

const CARGOS = ['Presidente', 'Tesoureiro', 'Secretário', 'Conselheiro', 'Associado', 'Desenvolvedor'];
const PERFIS = ['Administrador', 'Operador', 'Consulta'];

const s = {
	campo: { display: 'flex', flexDirection: 'column', marginBottom: 14 },
	label: {
		fontSize: '0.72rem',
		fontWeight: 500,
		color: 'var(--text-muted)',
		letterSpacing: '0.06em',
		textTransform: 'uppercase',
		marginBottom: 5
	},
	input: {
		padding: '9px 12px',
		borderRadius: 8,
		border: '1px solid var(--border)',
		background: 'var(--input-bg)',
		color: 'var(--text)',
		fontSize: '0.875rem',
		outline: 'none'
	}
};

function UserEditModal({ usuario, onFechar, onSalvo }) {
	const [form, setForm] = useState({
		nome: usuario.nome ?? '',
		cargo: usuario.cargo ?? '',
		perfil_de_acesso: usuario.perfil_de_acesso ?? '',
		notificacao: usuario.notificacao ?? false,
		bloqueado: usuario.bloqueado ?? false
	});
	const [salvando, setSalvando] = useState(false);
	const [confirmarNotificacao, setConfirmarNotificacao] = useState(false);
	const { mostrarToast } = useToast();

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
	};

	const handleRemoverNotificacao = async () => {
		setSalvando(true);
		try {
			await updateUser(usuario.id_usuario, { ...form, notificacao: false });
			setConfirmarNotificacao(false);
			onSalvo();
			onFechar();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao remover notificações', 'erro');
		} finally {
			setSalvando(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSalvando(true);
		try {
			await updateUser(usuario.id_usuario, form);
			onSalvo();
			onFechar();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao atualizar usuário', 'erro');
		} finally {
			setSalvando(false);
		}
	};

	return (
		<>
			{confirmarNotificacao && (
				<ModalConfirm
					titulo="Remover notificações"
					mensagem="Tem certeza que deseja remover as notificações deste usuário? Ele precisará reconfigurar o Telegram para recebê-las novamente."
					textoBotaoConfirmar="Remover"
					onConfirmar={handleRemoverNotificacao}
					onCancelar={() => setConfirmarNotificacao(false)}
					variante="perigo"
				/>
			)}
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
							Editar Usuário
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
						<div style={s.campo}>
							<label style={s.label}>Nome Completo</label>
							<input
								style={s.input}
								name="nome"
								value={form.nome}
								onChange={handleChange}
								required
							/>
						</div>
						<div style={s.campo}>
							<label style={s.label}>Cargo</label>
							<select
								style={s.input}
								name="cargo"
								value={form.cargo}
								onChange={handleChange}
								required
							>
								<option value="">Selecione</option>
								{CARGOS.map((c) => (
									<option key={c} value={c}>
										{c}
									</option>
								))}
							</select>
						</div>
						<div style={s.campo}>
							<label style={s.label}>Perfil de Acesso</label>
							<select
								style={s.input}
								name="perfil_de_acesso"
								value={form.perfil_de_acesso}
								onChange={handleChange}
								required
							>
								<option value="">Selecione</option>
								{PERFIS.map((p) => (
									<option key={p} value={p}>
										{p}
									</option>
								))}
							</select>
						</div>
						<div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
							{usuario.notificacao && (
								<button
									type="button"
									onClick={() => setConfirmarNotificacao(true)}
									style={{
										padding: '7px 14px',
										borderRadius: 8,
										border: '1px solid #dc2626',
										background: 'transparent',
										color: '#dc2626',
										fontSize: '0.8rem',
										fontWeight: 500,
										cursor: 'pointer',
										display: 'flex',
										alignItems: 'center',
										gap: 6
									}}
								>
									<i className="bi bi-bell-slash" /> Remover notificações
								</button>
							)}
							<label
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 8,
									fontSize: '0.875rem',
									color: 'var(--text)',
									cursor: 'pointer'
								}}
							>
								<input
									type="checkbox"
									name="bloqueado"
									checked={form.bloqueado}
									onChange={handleChange}
								/>
								Bloqueado
							</label>
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
								disabled={salvando}
								style={{
									padding: '8px 18px',
									borderRadius: 8,
									border: 'none',
									background: 'var(--primary)',
									color: '#fff',
									fontWeight: 600,
									cursor: 'pointer',
									opacity: salvando ? 0.7 : 1
								}}
							>
								{salvando ? 'Salvando...' : 'Salvar'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</>
	);
}

export default UserEditModal;
