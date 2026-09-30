/**
 * Testes unitários para src/components/UserRegisterModal.jsx
 *
 * Regime login-only + e-mail opcional:
 *   - Login é sempre obrigatório (única credencial que autentica).
 *   - E-mail é opcional, mas vira obrigatório quando "Notificar por Email" está marcado.
 *   - Sem e-mail, o campo "Senha provisória" aparece e é obrigatório (≥6); com e-mail some.
 *
 * api/toast são mockados.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserRegisterModal from '../components/UserRegisterModal.jsx';
import * as api from '../services/api.js';

vi.mock('../services/api.js', () => ({
	createUser: vi.fn(() => Promise.resolve({}))
}));

const mostrarToast = vi.fn();
vi.mock('../components/ToastStack.jsx', () => ({
	useToast: () => ({ mostrarToast })
}));

let container;
const campo = (nome) => container.querySelector(`[name="${nome}"]`);
// Submete pelo evento do form (e não pelo clique): o clique passa pela validação
// nativa de `required` do jsdom, que barra o envio antes do nosso handler — e é
// justamente a validação JS (login/e-mail/senha condicionais) que queremos testar.
const submeter = () => fireEvent.submit(container.querySelector('form'));

beforeEach(() => {
	vi.clearAllMocks();
	api.createUser.mockResolvedValue({});
	container = render(<UserRegisterModal onFechar={() => {}} />).container;
});

describe('UserRegisterModal — login-only + e-mail opcional', () => {
	it('exige login: sem login, não chama a API e avisa', async () => {
		fireEvent.change(campo('nome'), { target: { value: 'Fulano' } });
		submeter();
		await waitFor(() => expect(mostrarToast).toHaveBeenCalledWith('Informe o login.', 'aviso'));
		expect(api.createUser).not.toHaveBeenCalled();
	});

	it('exige e-mail quando "Notificar por Email" está marcado', async () => {
		fireEvent.change(campo('nome'), { target: { value: 'Fulano' } });
		fireEvent.change(campo('login'), { target: { value: '123.456.789-09' } });
		fireEvent.click(campo('notificacao')); // marca notificar
		submeter();
		await waitFor(() =>
			expect(mostrarToast).toHaveBeenCalledWith('Para notificar por e-mail, informe um e-mail.', 'aviso')
		);
		expect(api.createUser).not.toHaveBeenCalled();
	});

	it('sem e-mail, mostra o campo de senha provisória e exige ≥6', async () => {
		expect(campo('senha')).not.toBeNull(); // visível quando não há e-mail
		fireEvent.change(campo('nome'), { target: { value: 'Fulano' } });
		fireEvent.change(campo('login'), { target: { value: 'moradorcpf' } });
		fireEvent.change(campo('senha'), { target: { value: '123' } }); // curta
		submeter();
		await waitFor(() =>
			expect(mostrarToast).toHaveBeenCalledWith(
				'Sem e-mail, informe uma senha provisória de ao menos 6 caracteres.',
				'aviso'
			)
		);
		expect(api.createUser).not.toHaveBeenCalled();
	});

	it('sem e-mail + senha válida: chama a API com login, senha e email nulo', async () => {
		fireEvent.change(campo('nome'), { target: { value: 'Morador' } });
		fireEvent.change(campo('login'), { target: { value: 'moradorcpf' } });
		fireEvent.change(campo('senha'), { target: { value: 'SenhaProv1' } });
		submeter();
		await waitFor(() => expect(api.createUser).toHaveBeenCalled());
		expect(api.createUser).toHaveBeenCalledWith(
			expect.objectContaining({ login: 'moradorcpf', senha: 'SenhaProv1', email: '' })
		);
	});

	it('com e-mail válido, o campo de senha some e a API recebe o e-mail', async () => {
		fireEvent.change(campo('nome'), { target: { value: 'Equipe' } });
		fireEvent.change(campo('login'), { target: { value: 'equipe@amsi.com' } });
		fireEvent.change(campo('email'), { target: { value: 'equipe@amsi.com' } });
		expect(campo('senha')).toBeNull(); // some quando há e-mail
		submeter();
		await waitFor(() => expect(api.createUser).toHaveBeenCalled());
		expect(api.createUser).toHaveBeenCalledWith(
			expect.objectContaining({ login: 'equipe@amsi.com', email: 'equipe@amsi.com' })
		);
	});
});
