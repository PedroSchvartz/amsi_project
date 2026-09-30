import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, deleteUser, resetarSenhaUsuario, restaurarUsuario, getAmbiente } from '../services/api';
import { dataAtualizacaoFormatada } from '../versao';
import UserRegisterModal from './UserRegisterModal.jsx';
import UserEditModal from './UserEditModal.jsx';
import PerfilCompletoPopup from './PerfilCompletoPopup.jsx';
import ModalConfirm from './ModalConfirm.jsx';
import { useToast } from './ToastStack.jsx';
import { getUserFromToken, isAdmin } from '../services/auth';
import '../styles/userList.css';

function UserList() {
	const [usuarios, setUsuarios] = useState([]);
	const [modalCadastro, setModalCadastro] = useState(false);
	const [usuarioEditando, setUsuarioEditando] = useState(null);
	const [confirmarDelete, setConfirmarDelete] = useState(null);
	const [confirmarReset, setConfirmarReset] = useState(null);
	const [confirmarRestaurar, setConfirmarRestaurar] = useState(null);
	const [perfilCompleto, setPerfilCompleto] = useState(null);
	const [busca, setBusca] = useState('');
	const [filtroPerfil, setFiltroPerfil] = useState('');
	const [filtroCargo, setFiltroCargo] = useState('');
	const [filtroStatus, setFiltroStatus] = useState('ativos');
	const [ambiente, setAmbiente] = useState(null);
	const { mostrarToast } = useToast();
	const navigate = useNavigate();
	const meuId = parseInt(getUserFromToken()?.sub);

	// Só o backend traz os excluídos (incluir_excluidos): Excluídos/Todos precisam do fetch
	// ampliado; Ativos/Bloqueados filtram em memória sobre os não-excluídos.
	const incluirExcluidos = filtroStatus === 'excluidos' || filtroStatus === 'todos';

	useEffect(() => {
		carregarUsuarios();
	}, [incluirExcluidos]);

	useEffect(() => {
		getAmbiente().then(setAmbiente);
	}, []);

	const carregarUsuarios = async () => {
		try {
			const data = await getUsers(incluirExcluidos);
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

	const termo = busca.trim().toLowerCase();
	const usuariosFiltrados = usuarios.filter((u) => {
		const excluido = !!u.exclusao;
		if (filtroStatus === 'ativos' && (excluido || u.bloqueado)) return false;
		if (filtroStatus === 'bloqueados' && (excluido || !u.bloqueado)) return false;
		if (filtroStatus === 'excluidos' && !excluido) return false;
		// 'todos': não filtra por status
		if (filtroPerfil && u.perfil_de_acesso !== filtroPerfil) return false;
		if (filtroCargo && (u.cargo || '') !== filtroCargo) return false;
		if (termo && !`${u.nome} ${u.email || ''}`.toLowerCase().includes(termo)) return false;
		return true;
	});

	return (
		<div className="user-list-container">
			<div className="d-flex justify-content-between align-items-center mb-4">
				<h2>
					Usuários{' '}
					<span style={{ fontSize: '0.6em', fontWeight: 'normal', color: 'var(--text-muted)' }}>
						{ambiente ? `${ambiente} ` : ''}{dataAtualizacaoFormatada()}
					</span>
				</h2>
				<div className="d-flex gap-2">
					{isAdmin() && (
						<button
							className="btn-acao-editar"
							onClick={() => navigate('/backlog')}
							style={{ padding: '8px 18px', fontSize: '0.875rem' }}
							title="Backlog e anotações (.md)"
						>
							<i className="bi bi-journal-text" /> Backlog
						</button>
					)}
					<button
						className="btn-acao-editar"
						onClick={() => setModalCadastro(true)}
						style={{ padding: '8px 18px', fontSize: '0.875rem' }}
					>
						<i className="bi bi-person-plus" /> Novo Usuário
					</button>
				</div>
			</div>

			<div className="user-list-filtros">
				<input
					className="user-list-filtro-busca"
					type="search"
					placeholder="Buscar por nome ou e-mail…"
					value={busca}
					onChange={(e) => setBusca(e.target.value)}
				/>
				<select value={filtroPerfil} onChange={(e) => setFiltroPerfil(e.target.value)}>
					<option value="">Todos os perfis</option>
					<option value="Administrador">Administrador</option>
					<option value="Operador">Operador</option>
					<option value="Consulta">Consulta</option>
				</select>
				<select value={filtroCargo} onChange={(e) => setFiltroCargo(e.target.value)}>
					<option value="">Todos os cargos</option>
					<option value="Presidente">Presidente</option>
					<option value="Diretor">Diretor</option>
					<option value="Tesoureiro">Tesoureiro</option>
					<option value="Secretário">Secretário</option>
					<option value="Conselheiro">Conselheiro</option>
					<option value="Associado">Associado</option>
					<option value="Desenvolvedor">Desenvolvedor</option>
				</select>
				<select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
					<option value="ativos">Ativos</option>
					<option value="bloqueados">Bloqueados</option>
					<option value="excluidos">Excluídos</option>
					<option value="todos">Todos</option>
				</select>
			</div>

			<div className="user-list-table-wrapper">
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
					{usuariosFiltrados.length === 0 ? (
						<tr>
							<td
								colSpan="5"
								style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}
							>
								Nenhum usuário encontrado.
							</td>
						</tr>
					) : (
						usuariosFiltrados.map((u) => {
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
			</div>

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
