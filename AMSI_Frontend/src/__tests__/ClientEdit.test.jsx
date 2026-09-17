/**
 * Testes de src/components/ClientEdit.jsx — foco na regra:
 * remover o e-mail de um usuário vinculado exige desvincular o usuário, e
 * desvincular é admin-only.
 *
 *   - admin: clicar na lixeira do e-mail vinculado abre a confirmação; confirmar
 *     chama desvincularCliforDoUsuario e remove o e-mail
 *   - não-admin: clicar mostra mensagem de permissão, NÃO desvincula e NÃO remove
 *   - e-mail não vinculado: lixeira remove direto, sem confirmação nem desvínculo
 *
 * api/auth(isAdmin)/toast/react-router são mockados.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClientEdit from '../components/ClientEdit.jsx';
import * as api from '../services/api.js';
import * as auth from '../services/auth.js';

vi.mock('../services/api.js', () => ({
	getClifor: vi.fn(),
	getClifors: vi.fn(() => Promise.resolve([])),
	updateClifor: vi.fn(() => Promise.resolve({})),
	getEnderecosPorClifor: vi.fn(() => Promise.resolve([])),
	getContatosPorClifor: vi.fn(() => Promise.resolve([])),
	desvincularCliforDoUsuario: vi.fn(() => Promise.resolve({}))
}));

vi.mock('../services/auth.js', () => ({
	isAdmin: vi.fn(() => true)
}));

const mostrarToast = vi.fn();
vi.mock('../components/ToastStack.jsx', () => ({
	useToast: () => ({ mostrarToast, mostrarToasts: vi.fn() })
}));

vi.mock('react-router-dom', () => ({
	useParams: () => ({ id: '30' }),
	useNavigate: () => vi.fn()
}));

const USUARIO_VINCULADO = {
	id_usuario: 7,
	nome: 'Maria',
	email: 'maria@amsi.org',
	cargo: 'Diretor'
};

const CLIFOR = {
	id_clifor: 30,
	tipo_clifor: 'C',
	pessoafisica_juridica: true,
	nome: 'Cliente Teste',
	cpf_cnpj: '52998224725', // CPF válido — o submit roda validarCPF
	rg_inscricaoestadual: '',
	nome_usual: '',
	lote: '',
	datanascimento: '',
	ativo: true,
	bloqueado: false,
	associado: false,
	usuarios: [USUARIO_VINCULADO]
};

// Dois e-mails: o de índice 0 é o do usuário vinculado; o outro é livre.
const CONTATOS = [
	{ tipocontato: 'Email', info_do_contato: 'maria@amsi.org', contato_principal: true },
	{ tipocontato: 'Email', info_do_contato: 'outro@x.com', contato_principal: false }
];

beforeEach(() => {
	vi.clearAllMocks();
	auth.isAdmin.mockReturnValue(true);
	api.getClifor.mockResolvedValue(CLIFOR);
	api.getContatosPorClifor.mockResolvedValue(CONTATOS);
	api.getEnderecosPorClifor.mockResolvedValue([]);
	api.getClifors.mockResolvedValue([]);
});

async function renderPronto() {
	render(<ClientEdit />);
	// espera a carga assíncrona (form só aparece depois)
	await screen.findByDisplayValue('maria@amsi.org');
}

describe('ClientEdit — remover e-mail de usuário vinculado', () => {
	it('admin: confirmar remove o e-mail localmente, mas só desvincula ao Salvar', async () => {
		await renderPronto();
		// lixeira do e-mail vinculado (índice 0)
		fireEvent.click(screen.getAllByRole('button', { name: 'Remover e-mail' })[0]);

		// abre a confirmação, não age ainda
		expect(
			await screen.findByRole('heading', { name: 'Remover e-mail e desvincular usuário' })
		).toBeInTheDocument();

		// confirmar: remove o e-mail do estado local, mas NÃO chama a API ainda
		fireEvent.click(screen.getByRole('button', { name: 'Remover e desvincular' }));
		await waitFor(() =>
			expect(screen.queryByDisplayValue('maria@amsi.org')).not.toBeInTheDocument()
		);
		expect(api.desvincularCliforDoUsuario).not.toHaveBeenCalled();
		expect(api.updateClifor).not.toHaveBeenCalled();

		// só "Salvar Alterações" efetiva: desvincula E grava o clifor
		fireEvent.click(screen.getByRole('button', { name: /Salvar Altera/i }));
		await waitFor(() => expect(api.desvincularCliforDoUsuario).toHaveBeenCalledWith(7));
		expect(api.updateClifor).toHaveBeenCalled();
	});

	it('não-admin: mostra mensagem de permissão, não desvincula nem remove', async () => {
		auth.isAdmin.mockReturnValue(false);
		await renderPronto();
		fireEvent.click(screen.getAllByRole('button', { name: 'Remover e-mail' })[0]);

		expect(mostrarToast).toHaveBeenCalledWith(
			expect.stringContaining('administradores'),
			'erro'
		);
		expect(api.desvincularCliforDoUsuario).not.toHaveBeenCalled();
		// nada foi removido nem aberta confirmação
		expect(screen.getByDisplayValue('maria@amsi.org')).toBeInTheDocument();
		expect(
			screen.queryByRole('heading', { name: 'Remover e-mail e desvincular usuário' })
		).not.toBeInTheDocument();
	});

	it('e-mail não vinculado: remove direto, sem confirmação nem desvínculo', async () => {
		await renderPronto();
		// lixeira do e-mail livre (índice 1)
		fireEvent.click(screen.getAllByRole('button', { name: 'Remover e-mail' })[1]);

		await waitFor(() =>
			expect(screen.queryByDisplayValue('outro@x.com')).not.toBeInTheDocument()
		);
		expect(api.desvincularCliforDoUsuario).not.toHaveBeenCalled();
		expect(
			screen.queryByRole('heading', { name: 'Remover e-mail e desvincular usuário' })
		).not.toBeInTheDocument();
	});
});
