/**
 * Testes de integração leve para src/components/LancamentoModal.jsx
 *
 * Foco no acoplamento com o seletor de clifor em massa (feature 6.3):
 *   - abre o seletor pelo botão "Vários" (visível p/ Operador+)
 *   - confirmar 1 clifor mantém o modo único ("Novo Lançamento")
 *   - confirmar 2+ clifors troca o header para "Novo Lançamento em Massa"
 *     e o botão passa a ser "Editar seleção"
 *   - ✕ / CANCELAR chamam onFechar
 *
 * api/auth/toast mockados. O componente real MassaCliforSeletorModal é usado
 * (ambos consomem getClifors mockado), exercitando o fluxo de ponta a ponta.
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import LancamentoModal from '../components/LancamentoModal.jsx';
import * as api from '../services/api.js';
import * as auth from '../services/auth.js';

vi.mock('../services/api', () => ({
	getClifors: vi.fn(),
	getTiposConta: vi.fn(),
	createLancamento: vi.fn(() => Promise.resolve({})),
	createLancamentoMassa: vi.fn(() => Promise.resolve({ total_criados: 2 })),
	createTipoConta: vi.fn(() => Promise.resolve({ id_tipo_conta: 9 }))
}));

vi.mock('../services/auth', () => ({
	getUserFromToken: vi.fn(() => ({ sub: 5 })),
	isAdmin: vi.fn(() => false),
	hasPerfilMinimo: vi.fn(() => true)
}));

vi.mock('../components/ToastStack.jsx', () => ({
	useToast: () => ({ mostrarToast: vi.fn() })
}));

const CLIFORS = [
	{ id_clifor: 1, nome: 'Ana Cliente', tipo_clifor: 'C', cpf_cnpj: '11111111111', ativo: true, inadimplente: false },
	{ id_clifor: 2, nome: 'Bruno Fornecedor', tipo_clifor: 'F', cpf_cnpj: '22222222222', ativo: true, inadimplente: false }
];

const TIPOS = [{ id_tipo_conta: 10, descricao_conta: 'Mensalidade', natureza_conta: 'Credito' }];

beforeEach(() => {
	api.getClifors.mockResolvedValue(CLIFORS);
	api.getTiposConta.mockResolvedValue(TIPOS);
	auth.hasPerfilMinimo.mockReturnValue(true);
	auth.isAdmin.mockReturnValue(false);
});

// O nome do clifor aparece duas vezes com o seletor aberto: no <option> do select
// do modal de trás e na linha da tabela. Escopar no seletor, que é quem tem checkbox.
function linhaDe(nome) {
	return within(document.querySelector('table.cl-table')).getByText(nome).closest('tr');
}

describe('LancamentoModal — header e botão do seletor', () => {
	it('inicia no modo único ("Novo Lançamento") e mostra o botão "Vários"', async () => {
		render(<LancamentoModal onFechar={() => {}} />);
		expect(await screen.findByRole('heading', { name: 'Novo Lançamento' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Vários/ })).toBeInTheDocument();
	});

	it('Consulta (sem perfil mínimo Operador) não vê o botão de abrir o seletor', async () => {
		auth.hasPerfilMinimo.mockReturnValue(false);
		render(<LancamentoModal onFechar={() => {}} />);
		await screen.findByRole('heading', { name: 'Novo Lançamento' });
		expect(screen.queryByRole('button', { name: /Vários/ })).not.toBeInTheDocument();
	});
});

describe('LancamentoModal — seletor de clifor em massa', () => {
	it('abrir o seletor pelo botão "Vários" mostra a lista de clientes/fornecedores', async () => {
		render(<LancamentoModal onFechar={() => {}} />);
		await screen.findByRole('heading', { name: 'Novo Lançamento' });
		fireEvent.click(screen.getByRole('button', { name: /Vários/ }));
		expect(
			await screen.findByRole('heading', { name: 'Lista de Clientes/Fornecedores' })
		).toBeInTheDocument();
	});

	it('confirmar 1 clifor mantém o modo único', async () => {
		render(<LancamentoModal onFechar={() => {}} />);
		await screen.findByRole('heading', { name: 'Novo Lançamento' });
		fireEvent.click(screen.getByRole('button', { name: /Vários/ }));
		await screen.findByRole('heading', { name: 'Lista de Clientes/Fornecedores' });

		fireEvent.click(within(linhaDe('Ana Cliente')).getByRole('checkbox'));
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar seleção' }));

		// volta ao modal único
		expect(screen.getByRole('heading', { name: 'Novo Lançamento' })).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Novo Lançamento em Massa' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Vários/ })).toBeInTheDocument();
	});

	it('confirmar 2+ clifors troca para "Novo Lançamento em Massa" e botão "Editar seleção"', async () => {
		render(<LancamentoModal onFechar={() => {}} />);
		await screen.findByRole('heading', { name: 'Novo Lançamento' });
		fireEvent.click(screen.getByRole('button', { name: /Vários/ }));
		await screen.findByRole('heading', { name: 'Lista de Clientes/Fornecedores' });

		fireEvent.click(within(linhaDe('Ana Cliente')).getByRole('checkbox'));
		fireEvent.click(within(linhaDe('Bruno Fornecedor')).getByRole('checkbox'));
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar seleção' }));

		expect(screen.getByRole('heading', { name: 'Novo Lançamento em Massa' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Editar seleção/ })).toBeInTheDocument();
		expect(
			screen.getByDisplayValue('2 clientes/fornecedores selecionados')
		).toBeInTheDocument();
	});
});

describe('LancamentoModal — fechar', () => {
	it('clicar no ✕ chama onFechar', async () => {
		const onFechar = vi.fn();
		render(<LancamentoModal onFechar={onFechar} />);
		await screen.findByRole('heading', { name: 'Novo Lançamento' });
		fireEvent.click(screen.getByText('✕'));
		expect(onFechar).toHaveBeenCalledTimes(1);
	});

	it('clicar em CANCELAR chama onFechar', async () => {
		const onFechar = vi.fn();
		render(<LancamentoModal onFechar={onFechar} />);
		await screen.findByRole('heading', { name: 'Novo Lançamento' });
		fireEvent.click(screen.getByRole('button', { name: 'CANCELAR' }));
		expect(onFechar).toHaveBeenCalledTimes(1);
	});
});
