/**
 * Testes unitários para os filtros de src/components/UserList.jsx
 *
 * Filtro client-side: busca (nome/e-mail) + Perfil + Cargo + Status.
 * Status governa também o fetch de excluídos (incluir_excluidos): Ativos/Bloqueados
 * filtram em memória sobre os não-excluídos; Excluídos/Todos disparam o fetch ampliado.
 *
 * Presença de cada usuário é checada pelo e-mail (único e em td próprio).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserList from '../components/UserList.jsx';
import * as api from '../services/api.js';

const USUARIOS = [
	{ id_usuario: 1, nome: 'Ana', email: 'ana@x.com', perfil_de_acesso: 'Administrador', cargo: 'Presidente', bloqueado: false, exclusao: null },
	{ id_usuario: 2, nome: 'Bruno', email: 'bruno@y.com', perfil_de_acesso: 'Operador', cargo: 'Diretor', bloqueado: true, exclusao: null },
	{ id_usuario: 3, nome: 'Carla', email: 'carla@z.com', perfil_de_acesso: 'Consulta', cargo: null, bloqueado: false, exclusao: null }
];

vi.mock('../services/api.js', () => ({
	getUsers: vi.fn(() => Promise.resolve(USUARIOS.map((u) => ({ ...u })))),
	getAmbiente: vi.fn(() => Promise.resolve(null)),
	deleteUser: vi.fn(),
	resetarSenhaUsuario: vi.fn(),
	restaurarUsuario: vi.fn()
}));

vi.mock('../services/auth', () => ({
	getUserFromToken: () => ({ sub: '99' }),
	isAdmin: () => false
}));

vi.mock('react-router-dom', () => ({
	useNavigate: () => vi.fn()
}));

vi.mock('../versao', () => ({
	dataAtualizacaoFormatada: () => ''
}));

vi.mock('../components/ToastStack.jsx', () => ({
	useToast: () => ({ mostrarToast: vi.fn() })
}));

let container;
const selects = () => container.querySelectorAll('.user-list-filtros select');
const selectPerfil = () => selects()[0];
const selectCargo = () => selects()[1];
const selectStatus = () => selects()[2];
const inputBusca = () => container.querySelector('.user-list-filtro-busca');

beforeEach(async () => {
	vi.clearAllMocks();
	api.getUsers.mockImplementation(() => Promise.resolve(USUARIOS.map((u) => ({ ...u }))));
	container = render(<UserList />).container;
	await waitFor(() => expect(screen.getByText('ana@x.com')).toBeInTheDocument());
});

describe('UserList — filtros', () => {
	it('status padrão "Ativos" esconde bloqueados e excluídos', () => {
		expect(screen.queryByText('ana@x.com')).toBeInTheDocument();
		expect(screen.queryByText('carla@z.com')).toBeInTheDocument();
		expect(screen.queryByText('bruno@y.com')).not.toBeInTheDocument(); // bloqueado
	});

	it('busca por nome/e-mail filtra em memória', () => {
		fireEvent.change(inputBusca(), { target: { value: 'carla' } });
		expect(screen.queryByText('carla@z.com')).toBeInTheDocument();
		expect(screen.queryByText('ana@x.com')).not.toBeInTheDocument();
	});

	it('status "Bloqueados" mostra só os bloqueados (sem refetch)', () => {
		fireEvent.change(selectStatus(), { target: { value: 'bloqueados' } });
		expect(screen.queryByText('bruno@y.com')).toBeInTheDocument();
		expect(screen.queryByText('ana@x.com')).not.toBeInTheDocument();
		expect(api.getUsers).toHaveBeenCalledTimes(1); // não refez o fetch
	});

	it('status "Todos" refaz o fetch com incluir_excluidos e mostra todos', async () => {
		fireEvent.change(selectStatus(), { target: { value: 'todos' } });
		await waitFor(() => expect(api.getUsers).toHaveBeenCalledWith(true));
		expect(screen.queryByText('ana@x.com')).toBeInTheDocument();
		expect(screen.queryByText('bruno@y.com')).toBeInTheDocument();
		expect(screen.queryByText('carla@z.com')).toBeInTheDocument();
	});

	it('filtro de Perfil casa por igualdade', async () => {
		fireEvent.change(selectStatus(), { target: { value: 'todos' } });
		await waitFor(() => expect(api.getUsers).toHaveBeenCalledWith(true));
		fireEvent.change(selectPerfil(), { target: { value: 'Administrador' } });
		expect(screen.queryByText('ana@x.com')).toBeInTheDocument();
		expect(screen.queryByText('bruno@y.com')).not.toBeInTheDocument();
		expect(screen.queryByText('carla@z.com')).not.toBeInTheDocument();
	});

	it('filtro de Cargo casa por igualdade', async () => {
		fireEvent.change(selectStatus(), { target: { value: 'todos' } });
		await waitFor(() => expect(api.getUsers).toHaveBeenCalledWith(true));
		fireEvent.change(selectCargo(), { target: { value: 'Diretor' } });
		expect(screen.queryByText('bruno@y.com')).toBeInTheDocument();
		expect(screen.queryByText('ana@x.com')).not.toBeInTheDocument();
	});
});
