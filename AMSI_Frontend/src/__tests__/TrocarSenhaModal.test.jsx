/**
 * Testes de src/components/TrocarSenhaModal.jsx.
 *
 * Contrato (decisão registrada no changelog): a troca de senha NÃO pede a senha atual.
 * Valida senhas iguais e mínimo 6, e exige e-mail. Quando o usuário já tem e-mail, o campo
 * é só confirmação (não chama cadastrarEmail); quando não tem e digita um, cadastra antes
 * de trocar a senha.
 *
 * api e toast são mockados.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TrocarSenhaModal from '../components/TrocarSenhaModal.jsx';
import * as api from '../services/api.js';

vi.mock('../services/api.js', () => ({
	trocarSenha: vi.fn(() => Promise.resolve({})),
	cadastrarEmail: vi.fn(() => Promise.resolve({ email: 'nova@amsi.org' }))
}));

const mostrarToast = vi.fn();
vi.mock('../components/ToastStack.jsx', () => ({
	useToast: () => ({ mostrarToast })
}));

beforeEach(() => {
	vi.clearAllMocks();
});

function preencherSenhas(nova, confirmar) {
	fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: nova } });
	fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
		target: { value: confirmar }
	});
}

describe('TrocarSenhaModal', () => {
	it('usuário com e-mail: troca a senha sem senha atual e sem recadastrar e-mail', async () => {
		const onFechar = vi.fn();
		render(<TrocarSenhaModal usuario={{ email: 'maria@amsi.org' }} onFechar={onFechar} />);

		preencherSenhas('novasenha1', 'novasenha1');
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

		await waitFor(() =>
			expect(api.trocarSenha).toHaveBeenCalledWith({ nova_senha: 'novasenha1' })
		);
		expect(api.cadastrarEmail).not.toHaveBeenCalled();
		expect(onFechar).toHaveBeenCalled();
	});

	it('senhas diferentes: mostra erro e não chama a API', () => {
		render(<TrocarSenhaModal usuario={{ email: 'maria@amsi.org' }} onFechar={vi.fn()} />);

		preencherSenhas('novasenha1', 'outrasenha2');
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

		expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument();
		expect(api.trocarSenha).not.toHaveBeenCalled();
	});

	it('senha com menos de 6 caracteres: barra e não chama a API', () => {
		render(<TrocarSenhaModal usuario={{ email: 'maria@amsi.org' }} onFechar={vi.fn()} />);

		preencherSenhas('123', '123');
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

		expect(screen.getByText('A senha deve ter pelo menos 6 caracteres.')).toBeInTheDocument();
		expect(api.trocarSenha).not.toHaveBeenCalled();
	});

	it('usuário sem e-mail: cadastra o e-mail digitado antes de trocar a senha', async () => {
		const onFechar = vi.fn();
		render(<TrocarSenhaModal usuario={{ email: null }} onFechar={onFechar} />);

		preencherSenhas('novasenha1', 'novasenha1');
		fireEvent.change(screen.getByLabelText('E-mail'), {
			target: { value: 'nova@amsi.org' }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

		await waitFor(() => expect(api.trocarSenha).toHaveBeenCalled());
		expect(api.cadastrarEmail).toHaveBeenCalledWith('nova@amsi.org');
		expect(onFechar).toHaveBeenCalled();
	});

	it('usuário sem e-mail e sem digitar um: exige e-mail e não chama a API', () => {
		render(<TrocarSenhaModal usuario={{ email: null }} onFechar={vi.fn()} />);

		preencherSenhas('novasenha1', 'novasenha1');
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

		expect(screen.getByText('Informe um e-mail.')).toBeInTheDocument();
		expect(api.trocarSenha).not.toHaveBeenCalled();
		expect(api.cadastrarEmail).not.toHaveBeenCalled();
	});
});
