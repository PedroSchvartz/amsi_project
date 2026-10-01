/**
 * Testes do modo "Esqueci a senha" de src/components/Login.jsx.
 *
 * Contrato (decisão registrada no changelog): a recuperação busca por Login (aceita login
 * ou e-mail) e responde com DUAS mensagens distintas — sucesso (Login reconhecido e com
 * e-mail) vs falha (não reconhecido/sem e-mail). Abandonou-se a mensagem neutra única.
 *
 * api e react-router são mockados; o fluxo de recuperação não navega.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '../components/Login.jsx';
import * as api from '../services/api.js';

vi.mock('../services/api.js', () => ({
	loginUser: vi.fn(),
	getUser: vi.fn(),
	getDemoStatus: vi.fn(() => Promise.resolve({ demo_ativo: false })),
	esqueciSenha: vi.fn()
}));

vi.mock('react-router-dom', () => ({
	useNavigate: () => vi.fn(),
	useSearchParams: () => [{ get: () => null }],
	Link: ({ children }) => children
}));

beforeEach(() => {
	vi.clearAllMocks();
	api.getDemoStatus.mockResolvedValue({ demo_ativo: false });
});

async function abrirRecuperacao() {
	render(<Login />);
	fireEvent.click(await screen.findByRole('button', { name: /Esqueceu a senha/i }));
	return screen.getByLabelText('Login');
}

describe('Login — recuperação de senha por Login', () => {
	it('Login reconhecido com e-mail: mostra a mensagem de sucesso do backend', async () => {
		const sucesso = 'Enviamos um e-mail para você; confira sua caixa de entrada.';
		api.esqueciSenha.mockResolvedValue({ detail: sucesso });

		const input = await abrirRecuperacao();
		fireEvent.change(input, { target: { value: 'maria@amsi.org' } });
		fireEvent.click(screen.getByRole('button', { name: /Enviar link de recupera/i }));

		expect(api.esqueciSenha).toHaveBeenCalledWith('maria@amsi.org');
		expect(await screen.findByText(sucesso)).toBeInTheDocument();
		// Em sucesso o formulário some (não há mais botão de envio)
		expect(
			screen.queryByRole('button', { name: /Enviar link de recupera/i })
		).not.toBeInTheDocument();
	});

	it('Login não reconhecido: mostra a mensagem de erro e mantém o formulário', async () => {
		const falha = 'Não reconhecemos esse Login. Corrija ou contate um administrador.';
		api.esqueciSenha.mockRejectedValue(new Error(falha));

		const input = await abrirRecuperacao();
		fireEvent.change(input, { target: { value: 'naoexiste' } });
		fireEvent.click(screen.getByRole('button', { name: /Enviar link de recupera/i }));

		expect(await screen.findByText(falha)).toBeInTheDocument();
		// Em falha o formulário continua disponível para nova tentativa
		expect(
			screen.getByRole('button', { name: /Enviar link de recupera/i })
		).toBeInTheDocument();
	});

	it('sem informar o Login: nem chama a API', async () => {
		const input = await abrirRecuperacao();
		fireEvent.change(input, { target: { value: '   ' } });
		fireEvent.click(screen.getByRole('button', { name: /Enviar link de recupera/i }));

		expect(api.esqueciSenha).not.toHaveBeenCalled();
		expect(
			screen.getByText('Informe seu Login para recuperar a senha.')
		).toBeInTheDocument();
	});
});
