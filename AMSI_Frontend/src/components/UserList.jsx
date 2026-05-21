import { useState, useEffect } from 'react';
import { getUsers, deleteUser, resetarSenhaUsuario, restaurarUsuario } from '../services/api';
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
	const [confirmarRestaurar, setConfirmarRestaurar] = useState(null);
	const [perfilCompleto, setPerfilCompleto] = useState(null);
	const [mostrarExcluidos, setMostrarExcluidos] = useState(false);
	const { mostrarToast } = useToast();
	const meuId = parseInt(getUserFromToken()?.sub);

	useEffect(() => {
		carregarUsuarios();
	}, [mostrarExcluidos]);

	const carregarUsuarios = async () => {
		try {
			const data = await getUsers(mostrarExcluidos);
			setUsuarios(data.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
		} catch (err) {
			mostrarToast(err.message || 'Erro ao carregar usuários', 'erro');
		}
	};

	const handleDeletar = async () => {
		try {
			await deleteUser(confirmarDelete.id_usuario);
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
			await resetarSenhaUsuario(confirmarReset.id_usuario);
			mostrarToast('Senha resetada. O usuário deverá criar uma nova senha no próximo login.');
			setConfirmarReset(null);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao resetar senha', 'erro');
			setConfirmarReset(null);
		}
	};

	const handleRestaurar = async () => {
		try {
			await restaurarUsuario(confirmarRestaurar.id_usuario);
			mostrarToast('Usuário restaurado com sucesso.');
			setConfirmarRestaurar(null);
			carregarUsuarios();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao restaurar usuário', 'erro');
			setConfirmarRestaurar(null);
		}
	};

	return (
		<div className="user-list-container">
			<div className="d-flex justify-content-between align-items-center mb-4">
				<h2>Usuários</h2>
				<div className="d-flex gap-2">
					<button
						className="btn-acao-editar"
						onClick={() => setMostrarExcluidos((v) => !v)}
						style={{ padding: '8px 18px', fontSize: '0.875rem' }}
						title={mostrarExcluidos ? 'Ocultar excluídos' : 'Mostrar excluídos'}
					>
						<i className={`bi ${mostrarExcluidos ? 'bi-eye-slash' : 'bi-eye'}`} />
						{mostrarExcluidos ? ' Ocultar excluídos' : ' Mostrar excluídos'}
					</button>
					<button
						className="btn-acao-editar"
						onClick={() => setModalCadastro(true)}
						style={{ padding: '8px 18px', fontSize: '0.875rem' }}
					>
						<i className="bi bi-person-plus" /> Novo Usuário
					</button>
				</div>
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
						usuarios.map((u) => {
							const excluido = !!u.exclusao;
							return (
								<tr key={u.id_usuario} style={excluido ? { opacity: 0.5 } : undefined}>
									<td>
										{u.nome}
										{excluido && (
											<span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#6b7280', color: '#fff', borderRadius: 4, padding: '1px 6px', verticalAlign: 'middle' }}>
												Excluído
											</span>
										)}
										{!excluido && u.bloqueado && (
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
											{excluido ? (
												<button
													className="btn-acao-editar"
													onClick={() => setConfirmarRestaurar(u)}
													title="Restaurar usuário"
													style={{ color: 'var(--primary)' }}
												>
													<i className="bi bi-arrow-counterclockwise" /> Restaurar
												</button>
											) : (
												<>
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
														onClick={() => setConfirmarReset(u)}
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
															setConfirmarDelete(u);
														}}
														title={u.id_usuario === meuId ? 'Não é possível remover sua própria conta' : 'Remover usuário'}
													>
														<i className="bi bi-trash" />
													</button>
												</>
											)}
										</div>
									</td>
								</tr>
							);
						})
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
					mensagem={<>Tem certeza que deseja remover <strong>{confirmarDelete.nome}</strong>? Esta ação não pode ser desfeita.</>}
					textoBotaoConfirmar="Remover"
					onConfirmar={handleDeletar}
					onCancelar={() => setConfirmarDelete(null)}
					variante="perigo"
				/>
			)}

			{confirmarReset && (
				<ModalConfirm
					titulo="Resetar senha"
					mensagem={<><strong>{confirmarReset.nome}</strong> será obrigado(a) a criar uma nova senha no próximo login. Confirma?</>}
					textoBotaoConfirmar="Confirmar"
					onConfirmar={handleReset}
					onCancelar={() => setConfirmarReset(null)}
					variante="perigo"
				/>
			)}

			{confirmarRestaurar && (
				<ModalConfirm
					titulo="Restaurar usuário"
					mensagem={<><strong>{confirmarRestaurar.nome}</strong> voltará a ter acesso ao sistema com o perfil e dados anteriores. Confirma?</>}
					textoBotaoConfirmar="Restaurar"
					onConfirmar={handleRestaurar}
					onCancelar={() => setConfirmarRestaurar(null)}
					variante="primario"
				/>
			)}

		</div>
	);
}

export default UserList;
