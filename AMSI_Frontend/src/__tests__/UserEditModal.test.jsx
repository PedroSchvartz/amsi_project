/**
 * Testes unitários para src/components/UserEditModal.jsx
 *
 * Foco: o campo "Login" (login-only — a coluna login é a ÚNICA credencial que autentica).
 *   - pré-preenche com o login atual (CPF ou e-mail)
 *   - campo livre: salva o texto como digitado, SEM normalizar dígitos (aceita e-mail e CPF)
 *   - campo em branco salva login = null (conta sem login)
 *
 * api/toast são mockados; getCliforDoUsuario resolve null (sem vínculo).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserEditModal from '../components/UserEditModal.jsx';
import * as api from '../services/api.js';

vi.mock('../services/api.js', () => ({
	updateUser: vi.fn(() => Promise.resolve({})),
	getCliforDoUsuario: vi.fn(() => Promise.resolve(null))
}));

const mostrarToast = vi.fn();
vi.mock('../components/ToastStack.jsx', () => ({
	useToast: () => ({ mostrarToast })
}));

const USUARIO = {
	id_usuario: 1,
	nome: 'Pedro Schvartz',
	login: null,
	cargo: null,
	perfil_de_acesso: 'Administrador',
	notificacao: false,
	bloqueado: false
};

const campoLogin = () => screen.getByPlaceholderText(/CPF ou e-mail/i);
const campoEmail = () => screen.getByPlaceholderText(/e-mail de contato/i);
const btnSalvar = () => screen.getByRole('button', { name: /Salvar/ });

beforeEach(() => {
	vi.clearAllMocks();
	api.getCliforDoUsuario.mockResolvedValue(null);
	api.updateUser.mockResolvedValue({});
});

describe('UserEditModal — campo Login', () => {
	it('pré-preenche o campo com o login atual', async () => {
		render(<UserEditModal usuario={{ ...USUARIO, login: 'pedro@amsi.com' }} onFechar={() => {}} onSalvo={() => {}} />);
		await waitFor(() => expect(api.getCliforDoUsuario).toHaveBeenCalled());
		expect(campoLogin()).toHaveValue('pedro@amsi.com');
	});

	it('aceita e-mail como login e salva verbatim (sem normalizar)', async () => {
		render(<UserEditModal usuario={USUARIO} onFechar={() => {}} onSalvo={() => {}} />);
		await waitFor(() => expect(api.getCliforDoUsuario).toHaveBeenCalled());
		fireEvent.change(campoLogin(), { target: { value: 'equipe@amsi.com' } });
		fireEvent.click(btnSalvar());
		await waitFor(() => expect(api.updateUser).toHaveBeenCalled());
		expect(api.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ login: 'equipe@amsi.com' }));
	});

	it('aceita CPF como login e salva como digitado, sem tirar a máscara', async () => {
		render(<UserEditModal usuario={USUARIO} onFechar={() => {}} onSalvo={() => {}} />);
		await waitFor(() => expect(api.getCliforDoUsuario).toHaveBeenCalled());
		fireEvent.change(campoLogin(), { target: { value: '123.456.789-09' } });
		fireEvent.click(btnSalvar());
		await waitFor(() => expect(api.updateUser).toHaveBeenCalled());
		expect(api.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ login: '123.456.789-09' }));
	});

	it('campo em branco salva login = null', async () => {
		render(<UserEditModal usuario={{ ...USUARIO, login: 'pedro@amsi.com' }} onFechar={() => {}} onSalvo={() => {}} />);
		await waitFor(() => expect(api.getCliforDoUsuario).toHaveBeenCalled());
		fireEvent.change(campoLogin(), { target: { value: '   ' } });
		fireEvent.click(btnSalvar());
		await waitFor(() => expect(api.updateUser).toHaveBeenCalled());
		expect(api.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ login: null }));
	});
});

describe('UserEditModal — campo E-mail', () => {
	it('pré-preenche o campo com o e-mail atual', async () => {
		render(<UserEditModal usuario={{ ...USUARIO, email: 'contato@amsi.com' }} onFechar={() => {}} onSalvo={() => {}} />);
		await waitFor(() => expect(api.getCliforDoUsuario).toHaveBeenCalled());
		expect(campoEmail()).toHaveValue('contato@amsi.com');
	});

	it('editar o e-mail salva o novo valor', async () => {
		render(<UserEditModal usuario={{ ...USUARIO, email: 'antigo@amsi.com' }} onFechar={() => {}} onSalvo={() => {}} />);
		await waitFor(() => expect(api.getCliforDoUsuario).toHaveBeenCalled());
		fireEvent.change(campoEmail(), { target: { value: 'novo@amsi.com' } });
		fireEvent.click(btnSalvar());
		await waitFor(() => expect(api.updateUser).toHaveBeenCalled());
		expect(api.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ email: 'novo@amsi.com' }));
	});

	it('cadastra e-mail em usuário que não tinha (campo vazio → preenchido)', async () => {
		render(<UserEditModal usuario={USUARIO} onFechar={() => {}} onSalvo={() => {}} />);
		await waitFor(() => expect(api.getCliforDoUsuario).toHaveBeenCalled());
		expect(campoEmail()).toHaveValue('');
		fireEvent.change(campoEmail(), { target: { value: 'primeiro@amsi.com' } });
		fireEvent.click(btnSalvar());
		await waitFor(() => expect(api.updateUser).toHaveBeenCalled());
		expect(api.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ email: 'primeiro@amsi.com' }));
	});

	it('campo em branco salva email = null', async () => {
		render(<UserEditModal usuario={{ ...USUARIO, email: 'contato@amsi.com' }} onFechar={() => {}} onSalvo={() => {}} />);
		await waitFor(() => expect(api.getCliforDoUsuario).toHaveBeenCalled());
		fireEvent.change(campoEmail(), { target: { value: '   ' } });
		fireEvent.click(btnSalvar());
		await waitFor(() => expect(api.updateUser).toHaveBeenCalled());
		expect(api.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ email: null }));
	});
});
