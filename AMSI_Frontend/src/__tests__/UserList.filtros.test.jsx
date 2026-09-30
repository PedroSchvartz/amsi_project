/**
 * Testes unitários para os filtros de src/components/UserList.jsx
 *
 * Padrão de Lançamentos (rascunho → aplica): os campos editam um rascunho e NADA filtra
 * até o clique em "Pesquisar". A lista abre VAZIA até a 1ª busca. O botão "Pesquisar"
 * pulsa (classe --pendente) enquanto há rascunho não aplicado. Status governa o fetch de
 * excluídos (incluir_excluidos): Excluídos/Todos disparam o fetch ampliado — mas só quando
 * a busca é APLICADA.
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
const botaoPesquisar = () => container.querySelector('.user-list-btn-filtrar');
const pesquisar = () => fireEvent.click(botaoPesquisar());

beforeEach(async () => {
	vi.clearAllMocks();
	api.getUsers.mockImplementation(() => Promise.resolve(USUARIOS.map((u) => ({ ...u }))));
	container = render(<UserList />).container;
	// Dados carregam no mount (ainda que não exibidos até Pesquisar).
	await waitFor(() => expect(api.getUsers).toHaveBeenCalled());
});

describe('UserList — filtros (rascunho → aplica)', () => {
	it('abre vazia: nenhuma linha até a 1ª Pesquisar', () => {
		expect(
			screen.getByText(/Use os filtros e clique em "Pesquisar"/)
		).toBeInTheDocument();
		expect(screen.queryByText('ana@x.com')).not.toBeInTheDocument();
		expect(screen.queryByText('carla@z.com')).not.toBeInTheDocument();
	});

	it('aplicar com o status padrão "Ativos" mostra ativos e esconde bloqueados', async () => {
		pesquisar();
		expect(await screen.findByText('ana@x.com')).toBeInTheDocument();
		expect(screen.queryByText('carla@z.com')).toBeInTheDocument();
		expect(screen.queryByText('bruno@y.com')).not.toBeInTheDocument(); // bloqueado
	});

	it('digitar NÃO filtra ao vivo; só filtra depois de Pesquisar', async () => {
		pesquisar();
		expect(await screen.findByText('ana@x.com')).toBeInTheDocument();
		// Mexe no rascunho: a lista aplicada não muda.
		fireEvent.change(inputBusca(), { target: { value: 'carla' } });
		expect(screen.queryByText('ana@x.com')).toBeInTheDocument();
		// Aplica: agora sim filtra.
		pesquisar();
		await waitFor(() => expect(screen.queryByText('ana@x.com')).not.toBeInTheDocument());
		expect(screen.queryByText('carla@z.com')).toBeInTheDocument();
	});

	it('status "Bloqueados" filtra em memória, sem refetch', async () => {
		fireEvent.change(selectStatus(), { target: { value: 'bloqueados' } });
		pesquisar();
		expect(await screen.findByText('bruno@y.com')).toBeInTheDocument();
		expect(screen.queryByText('ana@x.com')).not.toBeInTheDocument();
		expect(api.getUsers).toHaveBeenCalledTimes(1); // só o fetch do mount
	});

	it('status "Todos" refaz o fetch (incluir_excluidos) só ao aplicar', async () => {
		fireEvent.change(selectStatus(), { target: { value: 'todos' } });
		expect(api.getUsers).not.toHaveBeenCalledWith(true); // ainda não aplicou
		pesquisar();
		await waitFor(() => expect(api.getUsers).toHaveBeenCalledWith(true));
		expect(await screen.findByText('ana@x.com')).toBeInTheDocument();
		expect(screen.queryByText('bruno@y.com')).toBeInTheDocument();
		expect(screen.queryByText('carla@z.com')).toBeInTheDocument();
	});

	it('filtro de Perfil casa por igualdade', async () => {
		fireEvent.change(selectStatus(), { target: { value: 'todos' } });
		fireEvent.change(selectPerfil(), { target: { value: 'Administrador' } });
		pesquisar();
		await waitFor(() => expect(api.getUsers).toHaveBeenCalledWith(true));
		expect(await screen.findByText('ana@x.com')).toBeInTheDocument();
		expect(screen.queryByText('bruno@y.com')).not.toBeInTheDocument();
		expect(screen.queryByText('carla@z.com')).not.toBeInTheDocument();
	});

	it('filtro de Cargo casa por igualdade', async () => {
		fireEvent.change(selectStatus(), { target: { value: 'todos' } });
		fireEvent.change(selectCargo(), { target: { value: 'Diretor' } });
		pesquisar();
		expect(await screen.findByText('bruno@y.com')).toBeInTheDocument();
		expect(screen.queryByText('ana@x.com')).not.toBeInTheDocument();
	});

	it('o botão pulsa (--pendente) ao mexer e volta ao normal depois de aplicar', async () => {
		// Sem mexer, rascunho == aplicado → não pendente.
		expect(botaoPesquisar().className).not.toContain('user-list-btn-filtrar--pendente');
		fireEvent.change(inputBusca(), { target: { value: 'ana' } });
		expect(botaoPesquisar().className).toContain('user-list-btn-filtrar--pendente');
		expect(botaoPesquisar().textContent).toContain('Pesquisar');
		pesquisar();
		await waitFor(() =>
			expect(botaoPesquisar().className).not.toContain('user-list-btn-filtrar--pendente')
		);
	});
});
