/**
 * Testes de fiação do fluxo "Restaurar" em src/components/UserList.jsx
 *
 * Req 2: restaurar é desacoplado do e-mail.
 *   - excluído COM e-mail  → abre o ModalConfirm de sempre (notifica no e-mail atual)
 *   - excluído SEM e-mail  → abre a RestaurarUsuarioModal (cadastrar agora / cadastrar depois)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserList from '../components/UserList.jsx';
import * as api from '../services/api.js';

const USUARIOS = [
	{ id_usuario: 1, nome: 'Com Email', email: 'com@x.com', perfil_de_acesso: 'Consulta', cargo: null, bloqueado: false, exclusao: '2026-01-01T00:00:00' },
	{ id_usuario: 2, nome: 'Sem Email', email: null, perfil_de_acesso: 'Consulta', cargo: null, bloqueado: false, exclusao: '2026-01-01T00:00:00' }
];

vi.mock('../services/api.js', () => ({
	getUsers: vi.fn(() => Promise.resolve(USUARIOS.map((u) => ({ ...u })))),
	getAmbiente: vi.fn(() => Promise.resolve(null)),
	deleteUser: vi.fn(),
	resetarSenhaUsuario: vi.fn(),
	restaurarUsuario: vi.fn(() => Promise.resolve({}))
}));

vi.mock('../services/auth', () => ({
	getUserFromToken: () => ({ sub: '99' }),
	isAdmin: () => false
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../versao', () => ({ dataAtualizacaoFormatada: () => '' }));
vi.mock('../components/ToastStack.jsx', () => ({ useToast: () => ({ mostrarToast: vi.fn() }) }));

let container;
const selectStatus = () => container.querySelectorAll('.user-list-filtros select')[2];
const pesquisar = () => fireEvent.click(container.querySelector('.user-list-btn-filtrar'));
const botaoRestaurar = (nome) => screen.getByText(nome).closest('tr').querySelector('.btn-acao-editar');

beforeEach(async () => {
	vi.clearAllMocks();
	api.getUsers.mockImplementation(() => Promise.resolve(USUARIOS.map((u) => ({ ...u }))));
	container = render(<UserList />).container;
	await waitFor(() => expect(api.getUsers).toHaveBeenCalled());
	fireEvent.change(selectStatus(), { target: { value: 'excluidos' } });
	pesquisar();
	await screen.findByText('Com Email');
});

describe('UserList — restaurar desacoplado do e-mail', () => {
	it('excluído COM e-mail abre o ModalConfirm de restauração', () => {
		fireEvent.click(botaoRestaurar('Com Email'));
		expect(screen.getByText(/voltará a ter acesso ao sistema/i)).toBeInTheDocument();
		expect(screen.queryByText(/não tem e-mail para ser notificado/i)).not.toBeInTheDocument();
	});

	it('excluído SEM e-mail abre a RestaurarUsuarioModal', () => {
		fireEvent.click(botaoRestaurar('Sem Email'));
		expect(screen.getByText(/não tem e-mail para ser notificado/i)).toBeInTheDocument();
		expect(screen.queryByText(/voltará a ter acesso ao sistema/i)).not.toBeInTheDocument();
	});

	it('confirmar restauração de quem tem e-mail chama restaurarUsuario sem e-mail', async () => {
		fireEvent.click(botaoRestaurar('Com Email'));
		// O botão "Restaurar" da linha tem <i>; o de confirmar do ModalConfirm não.
		const confirmar = screen.getAllByRole('button', { name: 'Restaurar' }).find((b) => !b.querySelector('i'));
		fireEvent.click(confirmar);
		await waitFor(() => expect(api.restaurarUsuario).toHaveBeenCalled());
		expect(api.restaurarUsuario).toHaveBeenCalledWith(1, { email: undefined });
	});

	it('salvar e-mail na modal de quem não tem chama restaurarUsuario com o e-mail', async () => {
		fireEvent.click(botaoRestaurar('Sem Email'));
		fireEvent.change(screen.getByPlaceholderText(/e-mail para notificação/i), { target: { value: 'novo@amsi.com' } });
		fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
		await waitFor(() => expect(api.restaurarUsuario).toHaveBeenCalled());
		expect(api.restaurarUsuario).toHaveBeenCalledWith(2, { email: 'novo@amsi.com' });
	});
});
