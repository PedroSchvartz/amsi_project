import { useEffect, useState, useRef } from 'react';
import { getUsers, updateUser, resetarSenhaUsuario } from '../services/api.js';
import PerfilCompletoPopup from './PerfilCompletoPopup.jsx';
import UserRegisterModal from './UserRegisterModal.jsx';
import ToastStack, { useToast } from './ToastStack.jsx';
import ModalConfirm from './ModalConfirm.jsx';
import '../styles/userList.css';

function UserList() {
	const [usuarios, setUsuarios] = useState([]);
	const [loading, setLoading] = useState(true);
	const [toasts, setToasts] = useState([]);
	const toastCounterRef = useRef(0);
	const [modalCadastro, setModalCadastro] = useState(false);

	const [modalAberto, setModalAberto] = useState(false);
	const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
	const [formModal, setFormModal] = useState({
		nome: '',
		email: '',
		cargo: '',
		perfil_de_acesso: ''
	});
	const [modalConfirmarReset, setModalConfirmarReset] = useState(null);
	const [perfilCompletoUsuario, setPerfilCompletoUsuario] = useState(null);

	const mostrarToast = (mensagem, tipo = 'sucesso') => {
		const id = ++toastCounterRef.current;
		setToasts((prev) => [...prev, { id, mensagem, tipo }]);
		setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
	};

	useEffect(() => {
		fetchUsers();
	}, []);

	async function fetchUsers() {
		try {
			setLoading(true);
			const data = await getUsers();
			setUsuarios(data.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
		} catch (err) {
			mostrarToast('Erro ao carregar usuários', 'erro');
		} finally {
			setLoading(false);
		}
	}

	const handleEdit = (user) => {
		setUsuarioSelecionado(user);
		setFormModal({
			nome: user.nome,
			email: user.email,
			cargo: user.cargo,
			perfil_de_acesso: user.perfil_de_acesso
		});
		setModalAberto(true);
	};

	const handleFecharModal = () => {
		setModalAberto(false);
		setUsuarioSelecionado(null);
	};

	const handleChangeModal = (e) => {
		setFormModal({ ...formModal, [e.target.name]: e.target.value });
	};

	const handleSalvar = async () => {
		try {
			await updateUser(usuarioSelecionado.id_usuario, {
				nome: formModal.nome,
				email: formModal.email,
				cargo: formModal.cargo,
				perfil_de_acesso: formModal.perfil_de_acesso,
				notificacao: usuarioSelecionado.notificacao ?? false
			});
			setUsuarios((prev) =>
				prev
					.map((u) => (u.id_usuario === usuarioSelecionado.id_usuario ? { ...u, ...formModal } : u))
					.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
			);
			handleFecharModal();
			mostrarToast('Usuário atualizado com sucesso!');
		} catch (err) {
			mostrarToast(err.message || 'Erro ao atualizar usuário', 'erro');
		}
	};

	const handleConfirmarReset = async () => {
		try {
			await resetarSenhaUsuario(modalConfirmarReset);
			setModalConfirmarReset(null);
			mostrarToast('Senha resetada. O usuário deverá criar uma nova senha no próximo login.');
		} catch (err) {
			setModalConfirmarReset(null);
			mostrarToast(err.message || 'Erro ao resetar senha', 'erro');
		}
	};

	if (loading) return <p>Carregando...</p>;

	return (
		<div className="user-list-container">
			<div
				style={{
					position: 'fixed',
					top: 20,
					right: 20,
					display: 'flex',
					flexDirection: 'column',
					gap: 8,
					zIndex: 99999,
					maxWidth: 320
				}}
			>
				{toasts.map((t) => (
					<div
						key={t.id}
						style={{
							background: t.tipo === 'erro' ? '#dc2626' : '#16a34a',
							color: '#fff',
							padding: '10px 16px',
							borderRadius: 8,
							boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
							fontSize: '0.85rem',
							fontWeight: 500,
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							gap: 12
						}}
					>
						<span>{t.mensagem}</span>
						<button
							onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
							style={{
								background: 'transparent',
								border: 'none',
								color: '#fff',
								cursor: 'pointer',
								fontSize: '1rem'
							}}
						>
							×
						</button>
					</div>
				))}
			</div>

			{modalCadastro && (
				<UserRegisterModal
					onFechar={() => {
						setModalCadastro(false);
						fetchUsers();
					}}
				/>
			)}

			{perfilCompletoUsuario && (
				<PerfilCompletoPopup
					usuario={perfilCompletoUsuario}
					onFechar={() => setPerfilCompletoUsuario(null)}
				/>
			)}

			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					marginBottom: 16
				}}
			>
				<h2 style={{ margin: 0 }}>Lista de Usuários</h2>
				<button
					onClick={() => setModalCadastro(true)}
					style={{
						padding: '8px 18px',
						borderRadius: 8,
						border: 'none',
						background: 'var(--primary)',
						color: '#fff',
						fontWeight: 600,
						fontSize: '0.875rem',
						cursor: 'pointer'
					}}
				>
					+ Cadastrar Usuário
				</button>
			</div>

			<table className="table table-striped">
				<thead>
					<tr>
						<th>Nome</th>
						<th>Email</th>
						<th>Cargo</th>
						<th>Perfil</th>
						<th>Ações</th>
					</tr>
				</thead>
				<tbody>
					{usuarios.map((user) => (
						<tr key={user.id_usuario}>
							<td>{user.nome}</td>
							<td>{user.email}</td>
							<td>{user.cargo}</td>
							<td>{user.perfil_de_acesso}</td>
							<td className="d-flex gap-2">
								<button
									className="btn btn-sm btn-outline-secondary"
									onClick={() => setPerfilCompletoUsuario(user)}
									title="Ver perfil completo"
								>
									<i className="bi bi-person-lines-fill"></i>
								</button>
								<button
									className="btn btn-sm btn-outline-primary"
									onClick={() => handleEdit(user)}
									title="Editar"
								>
									<i className="bi bi-pencil"></i>
								</button>
								<button
									className="btn btn-sm btn-outline-warning"
									onClick={() => setModalConfirmarReset(user.id_usuario)}
									title="Resetar senha"
								>
									<i className="bi bi-key"></i>
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>

			{/* MODAL EDIÇÃO */}
			{modalAberto && (
				<>
					<div className="modal-backdrop fade show" onClick={handleFecharModal} />
					<div className="modal fade show d-block" tabIndex="-1" role="dialog">
						<div className="modal-dialog modal-dialog-centered" role="document">
							<div className="modal-content">
								<div className="modal-header">
									<h5 className="modal-title">Editar Usuário</h5>
									<button type="button" className="btn-close" onClick={handleFecharModal} />
								</div>
								<div className="modal-body">
									<div className="mb-3">
										<label className="form-label">Nome Completo</label>
										<input
											className="form-control"
											name="nome"
											value={formModal.nome}
											onChange={handleChangeModal}
										/>
									</div>
									<div className="mb-3">
										<label className="form-label">Email</label>
										<input
											type="email"
											className="form-control"
											name="email"
											value={formModal.email}
											onChange={handleChangeModal}
										/>
									</div>
									<div className="mb-3">
										<label className="form-label">Cargo</label>
										<select
											className="form-select"
											name="cargo"
											value={formModal.cargo}
											onChange={handleChangeModal}
										>
											<option value="">Selecione</option>
											<option value="Diretor">Diretor</option>
											<option value="Tesoureiro">Tesoureiro</option>
											<option value="Secretário">Secretário</option>
											<option value="Conselheiro">Conselheiro</option>
											<option value="Associado">Associado</option>
											<option value="Desenvolvedor">Desenvolvedor</option>
										</select>
									</div>
									<div className="mb-3">
										<label className="form-label">Perfil de Acesso</label>
										<select
											className="form-select"
											name="perfil_de_acesso"
											value={formModal.perfil_de_acesso}
											onChange={handleChangeModal}
										>
											<option value="">Selecione</option>
											<option value="Administrador">Administrador</option>
											<option value="Consulta">Consulta</option>
										</select>
									</div>
								</div>
								<div className="modal-footer">
									<button className="btn btn-secondary" onClick={handleFecharModal}>
										Cancelar
									</button>
									<button className="btn btn-primary" onClick={handleSalvar}>
										Salvar
									</button>
								</div>
							</div>
						</div>
					</div>
				</>
			)}

			{/* MODAL CONFIRMAR RESET DE SENHA */}
			{modalConfirmarReset && (
				<ModalConfirm
					titulo="Resetar senha"
					mensagem="O usuário será obrigado a criar uma nova senha no próximo login. Confirma?"
					textoBotaoConfirmar="Confirmar"
					textoBotaoCancelar="Cancelar"
					onConfirmar={handleConfirmarReset}
					onCancelar={() => setModalConfirmarReset(null)}
					variante="perigo"
				/>
			)}
		</div>
	);
}

export default UserList;
