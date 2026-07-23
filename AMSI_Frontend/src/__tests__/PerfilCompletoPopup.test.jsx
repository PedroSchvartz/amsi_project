/**
 * Testes unitários para src/components/PerfilCompletoPopup.jsx
 *
 * Cobre o que o componente decide sozinho — sem backend nem rede:
 *   - dados básicos do usuário sempre aparecem
 *   - carrega o clifor vinculado (getCliforDoUsuario) e renderiza a seção
 *   - estado "sem clifor vinculado"
 *   - RBAC: Consulta NÃO vê busca/associar nem botão "Desvincular";
 *     não-Consulta vê
 *   - callbacks: ✕ e "Fechar" chamam onFechar; abrir confirmação de desvincular
 *
 * api/auth(isConsulta)/toast são mockados.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import PerfilCompletoPopup from '../components/PerfilCompletoPopup.jsx';
import * as api from '../services/api.js';
import * as auth from '../services/auth.js';

vi.mock('../services/api.js', () => ({
	getCliforDoUsuario: vi.fn(),
	getSugestaoClifor: vi.fn(() => Promise.resolve([])),
	associarCliforAoUsuario: vi.fn(() => Promise.resolve({})),
	desvincularCliforDoUsuario: vi.fn(() => Promise.resolve({}))
}));

vi.mock('../services/auth.js', () => ({
	isConsulta: vi.fn(() => false)
}));

vi.mock('../components/ToastStack.jsx', () => ({
	useToast: () => ({ mostrarToast: vi.fn() })
}));

const USUARIO = {
	id_usuario: 7,
	nome: 'Maria',
	email: 'maria@amsi.org',
	cargo: 'Tesoureira',
	perfil_de_acesso: 'Operador',
	bloqueado: false
};

const CLIFOR = {
	id_clifor: 30,
	nome: 'Cliente Vinculado',
	tipo_clifor: 'C',
	datanascimento: '1990-05-10',
	cpf_cnpj: '12345678900',
	rg_inscricaoestadual: 'MG123',
	inadimplente: false,
	enderecos: [],
	contatos: []
};

beforeEach(() => {
	auth.isConsulta.mockReturnValue(false);
	api.getCliforDoUsuario.mockResolvedValue(CLIFOR);
	api.getSugestaoClifor.mockResolvedValue([]);
});

describe('PerfilCompletoPopup — dados básicos', () => {
	it('mostra nome, email, cargo e perfil do usuário', async () => {
		render(<PerfilCompletoPopup usuario={USUARIO} onFechar={() => {}} />);
		expect(screen.getByRole('heading', { name: /Perfil Completo — Maria/ })).toBeInTheDocument();
		expect(screen.getByText('maria@amsi.org')).toBeInTheDocument();
		expect(screen.getByText('Tesoureira')).toBeInTheDocument();
		expect(screen.getByText('Operador')).toBeInTheDocument();
		// espera a carga assíncrona do clifor para não vazar act()
		await screen.findByText('Cliente Vinculado');
	});
});

describe('PerfilCompletoPopup — clifor vinculado', () => {
	it('renderiza a seção do clifor vinculado após a carga', async () => {
		render(<PerfilCompletoPopup usuario={USUARIO} onFechar={() => {}} />);
		expect(await screen.findByText('Cliente Vinculado')).toBeInTheDocument();
		expect(api.getCliforDoUsuario).toHaveBeenCalledWith(USUARIO.id_usuario);
		expect(screen.getByText('Cliente / Fornecedor Vinculado')).toBeInTheDocument();
	});

	it('mostra estado "sem clifor vinculado" quando a api retorna null', async () => {
		api.getCliforDoUsuario.mockResolvedValue(null);
		render(<PerfilCompletoPopup usuario={USUARIO} onFechar={() => {}} />);
		expect(await screen.findByText('Nenhum Cliente/Fornecedor vinculado.')).toBeInTheDocument();
	});
});

describe('PerfilCompletoPopup — RBAC', () => {
	it('não-Consulta vê o botão "Desvincular" no clifor vinculado', async () => {
		render(<PerfilCompletoPopup usuario={USUARIO} onFechar={() => {}} />);
		await screen.findByText('Cliente Vinculado');
		expect(screen.getByRole('button', { name: 'Desvincular' })).toBeInTheDocument();
	});

	it('Consulta NÃO vê o botão "Desvincular"', async () => {
		auth.isConsulta.mockReturnValue(true);
		render(<PerfilCompletoPopup usuario={USUARIO} onFechar={() => {}} />);
		await screen.findByText('Cliente Vinculado');
		expect(screen.queryByRole('button', { name: 'Desvincular' })).not.toBeInTheDocument();
	});

	it('sem clifor, não-Consulta vê o campo de busca para associar', async () => {
		api.getCliforDoUsuario.mockResolvedValue(null);
		render(<PerfilCompletoPopup usuario={USUARIO} onFechar={() => {}} />);
		await screen.findByText('Nenhum Cliente/Fornecedor vinculado.');
		expect(screen.getByPlaceholderText('Buscar por nome...')).toBeInTheDocument();
		expect(api.getSugestaoClifor).toHaveBeenCalled();
	});

	it('sem clifor, Consulta NÃO vê o campo de busca para associar', async () => {
		auth.isConsulta.mockReturnValue(true);
		api.getCliforDoUsuario.mockResolvedValue(null);
		render(<PerfilCompletoPopup usuario={USUARIO} onFechar={() => {}} />);
		await screen.findByText('Nenhum Cliente/Fornecedor vinculado.');
		expect(screen.queryByPlaceholderText('Buscar por nome...')).not.toBeInTheDocument();
		expect(api.getSugestaoClifor).not.toHaveBeenCalled();
	});
});

describe('PerfilCompletoPopup — callbacks', () => {
	it('clicar no ✕ chama onFechar', async () => {
		const onFechar = vi.fn();
		render(<PerfilCompletoPopup usuario={USUARIO} onFechar={onFechar} />);
		await screen.findByText('Cliente Vinculado');
		fireEvent.click(screen.getByText('✕'));
		expect(onFechar).toHaveBeenCalledTimes(1);
	});

	it('clicar em "Fechar" chama onFechar', async () => {
		const onFechar = vi.fn();
		render(<PerfilCompletoPopup usuario={USUARIO} onFechar={onFechar} />);
		await screen.findByText('Cliente Vinculado');
		fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
		expect(onFechar).toHaveBeenCalledTimes(1);
	});

	it('clicar em "Desvincular" abre a confirmação (ModalConfirm)', async () => {
		render(<PerfilCompletoPopup usuario={USUARIO} onFechar={() => {}} />);
		await screen.findByText('Cliente Vinculado');
		fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }));
		// ModalConfirm real renderiza o título e o botão de confirmar customizado
		expect(
			screen.getByRole('heading', { name: 'Desvincular Cliente/Fornecedor' })
		).toBeInTheDocument();
	});
});
