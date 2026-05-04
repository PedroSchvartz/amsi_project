import { useEffect, useState } from 'react';
import { getUsers, updateUser, resetarSenhaUsuario } from '../services/api.js';
import '../styles/userList.css';

function Toast({ mensagem, tipo, onClose }) {
	useEffect(() => {
		const t = setTimeout(onClose, 4000);
		return () => clearTimeout(t);
	}, [mensagem]);

	if (!mensagem) return null;

	return (
		<div className={`ul-toast ul-toast--${tipo}`}>
			<span>{mensagem}</span>
			<button className="ul-toast-close" onClick={onClose}>
				×
			</button>
		</div>
	);
}

function UserList() {
	const [usuarios, setUsuarios] = useState([]);
	const [loading, setLoading] = useState(true);
	const [toast, setToast] = useState({ mensagem: '', tipo: 'sucesso' });

	const [modalAberto, setModalAberto] = useState(false);
	const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
	const [formModal, setFormModal] = useState({
		nome: '',
		email: '',
		cargo: '',
		perfil_de_acesso: ''
	});
	const [erroModal, setErroModal] = useState('');
	const [sucessoModal, setSucessoModal] = useState('');

	const [modalConfirmarReset, setModalConfirmarReset] = useState(null);

	const mostrarToast = (mensagem, tipo = 'sucesso') => setToast({ mensagem, tipo });
	const fecharToast = () => setToast({ mensagem: '', tipo: 'sucesso' });

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
		setErroModal('');
		setSucessoModal('');
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
		setErroModal('');
		setSucessoModal('');
		try {
			await updateUser(usuarioSelecionado.id_usuario, {
				nome: formModal.nome,
				email: formModal.email,
				cargo: formModal.cargo,
				perfil_de_acesso: formModal.perfil_de_acesso,
				notificacao: usuarioSelecionado.notificacao ?? false
			});
			setSucessoModal('Usuário atualizado com sucesso!');
			setUsuarios((prev) =>
				prev
					.map((u) => (u.id_usuario === usuarioSelecionado.id_usuario ? { ...u, ...formModal } : u))
					.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
			);
			setTimeout(() => {
				handleFecharModal();
				mostrarToast('Usuário atualizado com sucesso!');
			}, 1200);
		} catch (err) {
			setErroModal(err.message || 'Erro ao atualizar usuário');
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
			<Toast mensagem={toast.mensagem} tipo={toast.tipo} onClose={fecharToast} />

			<h2>Lista de Usuários</h2>

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
									{erroModal && <p className="ul-erro-modal">{erroModal}</p>}
									{sucessoModal && <p className="ul-sucesso-modal">{sucessoModal}</p>}
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
				<div className="ul-overlay" onClick={() => setModalConfirmarReset(null)}>
					<div className="ul-modal-confirm" onClick={(e) => e.stopPropagation()}>
						<h5>Resetar senha</h5>
						<p>O usuário será obrigado a criar uma nova senha no próximo login. Confirma?</p>
						<div className="ul-confirm-buttons">
							<button className="btn btn-secondary" onClick={() => setModalConfirmarReset(null)}>
								Cancelar
							</button>
							<button className="btn btn-warning" onClick={handleConfirmarReset}>
								Confirmar
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default UserList;
