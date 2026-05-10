import { useState, useEffect } from 'react';
import { getUsers, updateUser, deleteUser, resetarSenhaUsuario } from '../services/api';
import UserRegisterModal from './UserRegisterModal.jsx';
import PerfilCompletoPopup from './PerfilCompletoPopup.jsx';
import ModalConfirm from './ModalConfirm.jsx';
import ToastStack, { useToast } from './ToastStack.jsx';
import '../styles/userList.css';

const CARGOS = ['Diretor', 'Tesoureiro', 'Secretário', 'Conselheiro', 'Associado', 'Desenvolvedor'];
const PERFIS = ['Administrador', 'Consulta'];

function UserList() {
	const [usuarios, setUsuarios] = useState([]);
	const [modalCadastro, setModalCadastro] = useState(false);
	const [confirmarDelete, setConfirmarDelete] = useState(null);
	const [confirmarReset, setConfirmarReset] = useState(null);
	const [perfilCompleto, setPerfilCompleto] = useState(null);
	const [usuarioEditando, setUsuarioEditando] = useState(null);
	const [formEdit, setFormEdit] = useState({});
	const { toasts, mostrarToast, removerToast } = useToast();

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

	const abrirEdicao = (u) => {
		setUsuarioEditando(u.id_usuario);
		setFormEdit({
			nome: u.nome,
			email: u.email,
			cargo: u.cargo,
			perfil_de_acesso: u.perfil_de_acesso,
			notificacao: u.notificacao ?? false
		});
	};

	const handleSalvar = async (id) => {
		try {
			await updateUser(id, formEdit);
			mostrarToast('Usuário atualizado com sucesso.');
			setUsuarioEditando(null);
			carregarUsuarios();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao atualizar usuário', 'erro');
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
						usuarios.map((u) =>
							usuarioEditando === u.id_usuario ? (
								<tr key={u.id_usuario}>
									<td>
										<input
											className="form-control"
											value={formEdit.nome}
											onChange={(e) => setFormEdit({ ...formEdit, nome: e.target.value })}
										/>
									</td>
									<td>
										<input
											type="email"
											className="form-control"
											value={formEdit.email}
											onChange={(e) => setFormEdit({ ...formEdit, email: e.target.value })}
										/>
									</td>
									<td>
										<select
											className="form-select"
											value={formEdit.cargo}
											onChange={(e) => setFormEdit({ ...formEdit, cargo: e.target.value })}
										>
											{CARGOS.map((c) => (
												<option key={c} value={c}>
													{c}
												</option>
											))}
										</select>
									</td>
									<td>
										<select
											className="form-select"
											value={formEdit.perfil_de_acesso}
											onChange={(e) =>
												setFormEdit({ ...formEdit, perfil_de_acesso: e.target.value })
											}
										>
											{PERFIS.map((p) => (
												<option key={p} value={p}>
													{p}
												</option>
											))}
										</select>
									</td>
									<td>
										<div className="d-flex gap-2">
											<button
												className="btn-acao-editar"
												onClick={() => handleSalvar(u.id_usuario)}
											>
												<i className="bi bi-check-lg" /> Salvar
											</button>
											<button className="btn-acao-deletar" onClick={() => setUsuarioEditando(null)}>
												<i className="bi bi-x-lg" /> Cancelar
											</button>
										</div>
									</td>
								</tr>
							) : (
								<tr key={u.id_usuario}>
									<td>{u.nome}</td>
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
												onClick={() => abrirEdicao(u)}
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
												onClick={() => setConfirmarDelete(u.id_usuario)}
												title="Remover usuário"
											>
												<i className="bi bi-trash" />
											</button>
										</div>
									</td>
								</tr>
							)
						)
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

			<ToastStack toasts={toasts} onRemover={removerToast} />
		</div>
	);
}

export default UserList;
