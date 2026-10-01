/**
 * Testes de src/components/ClientEdit.jsx.
 *
 * Mudança de comportamento (desacoplamento e-mail do clifor): o e-mail de contato do
 * clifor e o e-mail do usuário vinculado são independentes. Remover um e-mail da lista
 * de contatos NUNCA desvincula o usuário — só tira o contato do estado local; o vínculo
 * usuario↔clifor permanece. Não há mais confirmação "Remover e-mail e desvincular".
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

// Dois e-mails: o de índice 0 coincide com o do usuário vinculado; o outro é livre.
// Após o desacoplamento, essa coincidência não tem mais efeito especial.
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

describe('ClientEdit — remover e-mail não mexe no vínculo', () => {
	it('remover o e-mail que coincide com o do usuário vinculado só o tira da lista; não desvincula', async () => {
		await renderPronto();
		// lixeira do e-mail coincidente (índice 0) — sem confirmação
		fireEvent.click(screen.getAllByRole('button', { name: 'Remover e-mail' })[0]);

		await waitFor(() =>
			expect(screen.queryByDisplayValue('maria@amsi.org')).not.toBeInTheDocument()
		);
		expect(
			screen.queryByRole('heading', { name: /desvincular usuário/i })
		).not.toBeInTheDocument();
		expect(api.desvincularCliforDoUsuario).not.toHaveBeenCalled();

		// salvar grava o clifor e, ainda assim, nunca chama desvincular
		fireEvent.click(screen.getByRole('button', { name: /Salvar Altera/i }));
		await waitFor(() => expect(api.updateClifor).toHaveBeenCalled());
		expect(api.desvincularCliforDoUsuario).not.toHaveBeenCalled();
	});

	it('e-mail livre: remove direto, sem desvínculo', async () => {
		await renderPronto();
		// lixeira do e-mail livre (índice 1)
		fireEvent.click(screen.getAllByRole('button', { name: 'Remover e-mail' })[1]);

		await waitFor(() =>
			expect(screen.queryByDisplayValue('outro@x.com')).not.toBeInTheDocument()
		);
		expect(api.desvincularCliforDoUsuario).not.toHaveBeenCalled();
	});
});
