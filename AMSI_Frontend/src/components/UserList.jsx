import { useState, useEffect } from 'react';
import { getUsers, deleteUser } from '../services/api';
import UserRegisterModal from './UserRegisterModal.jsx';
import ModalConfirm from './ModalConfirm.jsx';
import ToastStack, { useToast } from './ToastStack.jsx';
import '../styles/userList.css';

/*
  UserList.jsx — Lista de usuários do sistema
  Pendência do Lote 1 resolvida:
    - btn-outline-primary → btn-acao-editar
    - btn-outline-danger  → btn-acao-deletar
  Lógica de dados, filtros e modais: preservados integralmente.
*/

function UserList() {
	const [usuarios, setUsuarios] = useState([]);
	const [modalCadastro, setModalCadastro] = useState(false);
	const [confirmarDelete, setConfirmarDelete] = useState(null); // id do usuário a deletar
	const { toasts, mostrarToast, removerToast } = useToast();

	useEffect(() => {
		carregarUsuarios();
	}, []);

	const carregarUsuarios = async () => {
		try {
			const data = await getUsers();
			setUsuarios(data);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao carregar usuários', 'erro');
		}
	};

	const handleDeletar = async () => {
		if (!confirmarDelete) return;
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

	// Mapeia cargo para label legível
	const labelCargo = (cargo) => cargo || '—';

	return (
		<div className="user-list-container">

			{/* ── Cabeçalho + botão de cadastro ── */}
			<div className="d-flex justify-content-between align-items-center mb-4">
				<h2>Usuários</h2>
				<button
					className="btn-acao-editar"
					onClick={() => setModalCadastro(true)}
					style={{ padding: '8px 18px', fontSize: '0.875rem' }}
				>
					<i className="bi bi-person-plus" />
					Novo Usuário
				</button>
			</div>

			{/* ── Tabela de usuários ── */}
			<table className="table">
				<thead>
					<tr>
						<th>Nome</th>
						<th>E-mail</th>
						<th>Cargo</th>
						<th>Ações</th>
					</tr>
				</thead>
				<tbody>
					{usuarios.length === 0 ? (
						<tr>
							<td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
								Nenhum usuário encontrado.
							</td>
						</tr>
					) : (
						usuarios.map((u) => (
							<tr key={u.id_usuario}>
								<td>{u.nome}</td>
								<td>{u.email}</td>
								<td>{labelCargo(u.cargo)}</td>
								<td>
									{/* Ações — classes corrigidas conforme userList.css atualizado */}
									<div className="d-flex gap-2">
										<button
											className="btn-acao-deletar"
											onClick={() => setConfirmarDelete(u.id_usuario)}
											title="Remover usuário"
										>
											<i className="bi bi-trash" />
											Remover
										</button>
									</div>
								</td>
							</tr>
						))
					)}
				</tbody>
			</table>

			{/* ── Modal de cadastro ── */}
			{modalCadastro && (
				<UserRegisterModal
					onFechar={() => {
						setModalCadastro(false);
						carregarUsuarios();
					}}
				/>
			)}

			{/* ── Modal de confirmação de exclusão ── */}
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

			<ToastStack toasts={toasts} onRemover={removerToast} />
		</div>
	);
}

export default UserList;
