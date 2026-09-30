import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, deleteUser, resetarSenhaUsuario, restaurarUsuario, getAmbiente } from '../services/api';
import { dataAtualizacaoFormatada } from '../versao';
import UserRegisterModal from './UserRegisterModal.jsx';
import UserEditModal from './UserEditModal.jsx';
import RestaurarUsuarioModal from './RestaurarUsuarioModal.jsx';
import PerfilCompletoPopup from './PerfilCompletoPopup.jsx';
import ModalConfirm from './ModalConfirm.jsx';
import { useToast } from './ToastStack.jsx';
import { getUserFromToken, isAdmin } from '../services/auth';
import '../styles/userList.css';

const FILTROS_INICIAL = { busca: '', perfil: '', cargo: '', status: 'ativos' };

function UserList() {
	const [usuarios, setUsuarios] = useState([]);
	const [modalCadastro, setModalCadastro] = useState(false);
	const [usuarioEditando, setUsuarioEditando] = useState(null);
	const [confirmarDelete, setConfirmarDelete] = useState(null);
	const [confirmarReset, setConfirmarReset] = useState(null);
	const [confirmarRestaurar, setConfirmarRestaurar] = useState(null);
	// Restaurar usuário SEM e-mail: abre a modal que separa reativação do envio da notificação.
	const [restaurarSemEmail, setRestaurarSemEmail] = useState(null);
	const [perfilCompleto, setPerfilCompleto] = useState(null);
	// Mesmo padrão da tela de Lançamentos: `filtros` é o rascunho que os campos editam;
	// `filtrosAplicados` é o que de fato filtra a lista — só muda ao clicar "Pesquisar".
	const [filtros, setFiltros] = useState(FILTROS_INICIAL);
	const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_INICIAL);
	// Igual a Lançamentos: a lista abre VAZIA e só exibe linhas depois da 1ª "Pesquisar".
	// Os dados são carregados no mount (lista pequena, filtro client-side); só o display fica
	// travado até a primeira busca.
	const [populado, setPopulado] = useState(false);
	const [ambiente, setAmbiente] = useState(null);
	const { mostrarToast } = useToast();
	const navigate = useNavigate();
	const meuId = parseInt(getUserFromToken()?.sub);

	// Só o backend traz os excluídos (incluir_excluidos): Excluídos/Todos precisam do fetch
	// ampliado; Ativos/Bloqueados filtram em memória sobre os não-excluídos. Deriva do status
	// APLICADO — o refetch só dispara quando a busca é aplicada, não ao mexer no rascunho.
	const incluirExcluidos = filtrosAplicados.status === 'excluidos' || filtrosAplicados.status === 'todos';

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

	// Reativa o usuário. `email` opcional: quando informado (modal "Salvar" de quem não tinha
	// e-mail), o backend cadastra e notifica; sem `email`, quem já tinha e-mail é notificado no
	// endereço atual e quem não tinha ("Cadastrar depois") só volta a ativo, sem notificação.
	const handleRestaurar = async (usuario, email) => {
		try {
			await restaurarUsuario(usuario.id_usuario, { email });
			const notificado = !!(email || usuario.email);
			mostrarToast(notificado ? 'Usuário restaurado. Enviamos um e-mail de acesso.' : 'Usuário restaurado.');
			setConfirmarRestaurar(null);
			setRestaurarSemEmail(null);
			carregarUsuarios();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao restaurar usuário', 'erro');
			setConfirmarRestaurar(null);
			setRestaurarSemEmail(null);
		}
	};

	const handleFiltroChange = (e) => {
		const { name, value } = e.target;
		setFiltros({ ...filtros, [name]: value });
	};

	const handleAplicar = (e) => {
		e.preventDefault();
		setFiltrosAplicados(filtros);
		setPopulado(true);
	};

	// Botão "Pesquisar" pulsa (amarelo) quando há filtro mexido sem reaplicar.
	const filtrosPendentes = JSON.stringify(filtros) !== JSON.stringify(filtrosAplicados);
	const rotuloBuscar = filtrosPendentes ? '⚠ Pesquisar ⚠' : 'Pesquisar';
	const classeBuscar = `user-list-btn-filtrar${filtrosPendentes ? ' user-list-btn-filtrar--pendente' : ''}`;

	const termo = filtrosAplicados.busca.trim().toLowerCase();
	const usuariosFiltrados = usuarios.filter((u) => {
		const excluido = !!u.exclusao;
		if (filtrosAplicados.status === 'ativos' && (excluido || u.bloqueado)) return false;
		if (filtrosAplicados.status === 'bloqueados' && (excluido || !u.bloqueado)) return false;
		if (filtrosAplicados.status === 'excluidos' && !excluido) return false;
		// 'todos': não filtra por status
		if (filtrosAplicados.perfil && u.perfil_de_acesso !== filtrosAplicados.perfil) return false;
		if (filtrosAplicados.cargo && (u.cargo || '') !== filtrosAplicados.cargo) return false;
		if (termo && !`${u.nome} ${u.email || ''}`.toLowerCase().includes(termo)) return false;
		return true;
	});
	// Antes da 1ª busca a lista fica vazia (paridade com Lançamentos).
	const linhas = populado ? usuariosFiltrados : [];

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
					{isAdmin() && (
						<button
							className="btn-acao-editar"
							onClick={() => navigate('/changelog')}
							style={{ padding: '8px 18px', fontSize: '0.875rem' }}
							title="Novidades e atualizações do sistema"
						>
							<i className="bi bi-megaphone" /> Changelog
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

			<form onSubmit={handleAplicar}>
				<div className="user-list-filtros">
					<input
						className="user-list-filtro-busca"
						type="search"
						name="busca"
						placeholder="Buscar por nome ou e-mail…"
						value={filtros.busca}
						onChange={handleFiltroChange}
					/>
					<button type="submit" className={classeBuscar}>
						{rotuloBuscar}
					</button>
					<select name="perfil" value={filtros.perfil} onChange={handleFiltroChange}>
						<option value="">Todos os perfis</option>
						<option value="Administrador">Administrador</option>
						<option value="Operador">Operador</option>
						<option value="Consulta">Consulta</option>
					</select>
					<select name="cargo" value={filtros.cargo} onChange={handleFiltroChange}>
						<option value="">Todos os cargos</option>
						<option value="Presidente">Presidente</option>
						<option value="Diretor">Diretor</option>
						<option value="Tesoureiro">Tesoureiro</option>
						<option value="Secretário">Secretário</option>
						<option value="Conselheiro">Conselheiro</option>
						<option value="Associado">Associado</option>
						<option value="Desenvolvedor">Desenvolvedor</option>
					</select>
					<select name="status" value={filtros.status} onChange={handleFiltroChange}>
						<option value="ativos">Ativos</option>
						<option value="bloqueados">Bloqueados</option>
						<option value="excluidos">Excluídos</option>
						<option value="todos">Todos</option>
					</select>
				</div>
			</form>

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
					{linhas.length === 0 ? (
						<tr>
							<td
								colSpan="5"
								style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}
							>
								{populado
									? 'Nenhum usuário encontrado.'
									: 'Use os filtros e clique em "Pesquisar" para listar os usuários.'}
							</td>
						</tr>
					) : (
						linhas.map((u) => {
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
													onClick={() => (u.email ? setConfirmarRestaurar(u) : setRestaurarSemEmail(u))}
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
						setPopulado(true);
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
					onConfirmar={() => handleRestaurar(confirmarRestaurar)}
					onCancelar={() => setConfirmarRestaurar(null)}
					variante="primario"
				/>
			)}

			{restaurarSemEmail && (
				<RestaurarUsuarioModal
					usuario={restaurarSemEmail}
					onRestaurar={(email) => handleRestaurar(restaurarSemEmail, email)}
					onFechar={() => setRestaurarSemEmail(null)}
				/>
			)}

		</div>
	);
}

export default UserList;
