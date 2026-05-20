import { useState, useEffect } from 'react';
import { getUsers, deleteUser, resetarSenhaUsuario } from '../services/api';
import UserRegisterModal from './UserRegisterModal.jsx';
import UserEditModal from './UserEditModal.jsx';
import PerfilCompletoPopup from './PerfilCompletoPopup.jsx';
import ModalConfirm from './ModalConfirm.jsx';
import { useToast } from './ToastStack.jsx';
import { getUserFromToken } from '../services/auth';
import '../styles/userList.css';

function UserList() {
	const [usuarios, setUsuarios] = useState([]);
	const [modalCadastro, setModalCadastro] = useState(false);
	const [usuarioEditando, setUsuarioEditando] = useState(null);
	const [confirmarDelete, setConfirmarDelete] = useState(null);
	const [confirmarReset, setConfirmarReset] = useState(null);
	const [perfilCompleto, setPerfilCompleto] = useState(null);
	const { mostrarToast } = useToast();
	const meuId = parseInt(getUserFromToken()?.sub);

	useEffect(() => {
		carregarUsuarios();
	}, []);

	const carregarUsuarios = async () => {
		try {
			const data = await getUsers();
			setUsuarios(data.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
		} catch (err) {
			mostrarToast(err.message || 'Erro ao carregar usuários', 'erro');
		}
	};

	const handleDeletar = async () => {
		try {
			await deleteUser(confirmarDelete);
			mostrarToast('Usuário removido com sucesso.');
			setConfirmarDelete(null);
			carregarUsuarios();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao remover usuário', 'erro');
			setConfirmarDelete(null);
		}
	};

	const handleReset = async () => {
		try {
			await resetarSenhaUsuario(confirmarReset);
			mostrarToast('Senha resetada. O usuário deverá criar uma nova senha no próximo login.');
			setConfirmarReset(null);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao resetar senha', 'erro');
			setConfirmarReset(null);
		}
	};

	return (
		<div className="user-list-container">
			<div className="d-flex justify-content-between align-items-center mb-4">
				<h2>Usuários</h2>
				<button
					className="btn-acao-editar"
					onClick={() => setModalCadastro(true)}
					style={{ padding: '8px 18px', fontSize: '0.875rem' }}
				>
					<i className="bi bi-person-plus" /> Novo Usuário
				</button>
			</div>

			<table className="table">
				<thead>
					<tr>
						<th>Nome</th>
						<th>E-mail</th>
						<th>Cargo</th>
						<th>Perfil</th>
						<th>Ações</th>
					</tr>
				</thead>
				<tbody>
					{usuarios.length === 0 ? (
						<tr>
							<td
								colSpan="5"
								style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}
							>
								Nenhum usuário encontrado.
							</td>
						</tr>
					) : (
						usuarios.map((u) => (
							<tr key={u.id_usuario}>
								<td>
									{u.nome}
									{u.bloqueado && (
										<span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#dc2626', color: '#fff', borderRadius: 4, padding: '1px 6px', verticalAlign: 'middle' }}>
											Bloqueado
										</span>
									)}
								</td>
								<td>{u.email}</td>
								<td>{u.cargo || '—'}</td>
								<td>{u.perfil_de_acesso}</td>
								<td>
									<div className="d-flex gap-2">
										<button
											className="btn-acao-editar"
											onClick={() => setPerfilCompleto(u)}
											title="Ver perfil completo"
										>
											<i className="bi bi-person-lines-fill" />
										</button>
										<button
											className="btn-acao-editar"
											onClick={() => setUsuarioEditando(u)}
											title="Editar"
										>
											<i className="bi bi-pencil" />
										</button>
										<button
											className="btn-acao-editar"
											onClick={() => setConfirmarReset(u.id_usuario)}
											title="Resetar senha"
										>
											<i className="bi bi-key" />
										</button>
										<button
											className="btn-acao-deletar"
											onClick={() => {
												if (u.id_usuario === meuId) {
													mostrarToast('Não é possível remover sua própria conta.', 'aviso');
													return;
												}
												setConfirmarDelete(u.id_usuario);
											}}
											title={u.id_usuario === meuId ? 'Não é possível remover sua própria conta' : 'Remover usuário'}
										>
											<i className="bi bi-trash" />
										</button>
									</div>
								</td>
							</tr>
						))
					)}
				</tbody>
			</table>

			{modalCadastro && (
				<UserRegisterModal
					onFechar={() => {
						setModalCadastro(false);
						carregarUsuarios();
					}}
				/>
			)}

			{usuarioEditando && (
				<UserEditModal
					usuario={usuarioEditando}
					onFechar={() => setUsuarioEditando(null)}
					onSalvo={() => {
						mostrarToast('Usuário atualizado com sucesso.');
						carregarUsuarios();
					}}
				/>
			)}

			{perfilCompleto && (
				<PerfilCompletoPopup usuario={perfilCompleto} onFechar={() => setPerfilCompleto(null)} />
			)}

			{confirmarDelete && (
				<ModalConfirm
					titulo="Remover usuário"
					mensagem="Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita."
					textoBotaoConfirmar="Remover"
					onConfirmar={handleDeletar}
					onCancelar={() => setConfirmarDelete(null)}
					variante="perigo"
				/>
			)}

			{confirmarReset && (
				<ModalConfirm
					titulo="Resetar senha"
					mensagem="O usuário será obrigado a criar uma nova senha no próximo login. Confirma?"
					textoBotaoConfirmar="Confirmar"
					onConfirmar={handleReset}
					onCancelar={() => setConfirmarReset(null)}
					variante="perigo"
				/>
			)}

		</div>
	);
}

export default UserList;
