/**
 * Testes unitários para src/components/MassaCliforSeletorModal.jsx
 *
 * Modal-seletor de clifors da criação em massa (feature 6.3). Cobre a lógica
 * própria do componente — sem backend nem rede:
 *   - carrega e lista os clifors (getClifors)
 *   - marcar/desmarcar uma linha (checkbox / clique na linha)
 *   - "Selecionar todos" / "Limpar" agem sobre o filtro atual
 *   - contador "X de Y selecionados" reflete o filtro
 *   - "Confirmar seleção" devolve os ids marcados via onConfirmar
 *   - ✕ / CANCELAR chamam onFechar
 *
 * getClifors e toast são mockados.
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import MassaCliforSeletorModal from '../components/MassaCliforSeletorModal.jsx';
import * as api from '../services/api.js';

vi.mock('../services/api.js', () => ({
	getClifors: vi.fn()
}));

vi.mock('../components/ToastStack.jsx', () => ({
	useToast: () => ({ mostrarToast: vi.fn() })
}));

const CLIFORS = [
	{ id_clifor: 1, nome: 'Ana Cliente', tipo_clifor: 'C', cpf_cnpj: '11111111111', ativo: true, inadimplente: false },
	{ id_clifor: 2, nome: 'Bruno Fornecedor', tipo_clifor: 'F', cpf_cnpj: '22222222222', ativo: true, inadimplente: false },
	{ id_clifor: 3, nome: 'Carla Cliente', tipo_clifor: 'C', cpf_cnpj: '33333333333', ativo: false, inadimplente: true }
];

beforeEach(() => {
	api.getClifors.mockResolvedValue(CLIFORS);
});

// Retorna a <tr> que contém o texto do nome (para mirar o checkbox da linha).
function linhaDe(nome) {
	return screen.getByText(nome).closest('tr');
}

describe('MassaCliforSeletorModal — carga e lista', () => {
	it('carrega e lista os clientes/fornecedores', async () => {
		render(<MassaCliforSeletorModal onConfirmar={() => {}} onFechar={() => {}} />);
		expect(await screen.findByText('Ana Cliente')).toBeInTheDocument();
		expect(api.getClifors).toHaveBeenCalledTimes(1);
		expect(screen.getByText('Bruno Fornecedor')).toBeInTheDocument();
		expect(screen.getByText('Carla Cliente')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Lista de Clientes/Fornecedores' })).toBeInTheDocument();
	});

	it('pré-marca os ids recebidos em "selecionados" e reflete no contador', async () => {
		render(<MassaCliforSeletorModal selecionados={[1]} onConfirmar={() => {}} onFechar={() => {}} />);
		await screen.findByText('Ana Cliente');
		expect(within(linhaDe('Ana Cliente')).getByRole('checkbox')).toBeChecked();
		expect(screen.getByText('1 de 3 selecionados')).toBeInTheDocument();
	});
});

describe('MassaCliforSeletorModal — marcação', () => {
	it('clicar na linha marca e desmarca o checkbox e atualiza o contador', async () => {
		render(<MassaCliforSeletorModal onConfirmar={() => {}} onFechar={() => {}} />);
		await screen.findByText('Ana Cliente');
		expect(screen.getByText('0 de 3 selecionados')).toBeInTheDocument();

		fireEvent.click(linhaDe('Ana Cliente'));
		expect(within(linhaDe('Ana Cliente')).getByRole('checkbox')).toBeChecked();
		expect(screen.getByText('1 de 3 selecionados')).toBeInTheDocument();

		fireEvent.click(linhaDe('Ana Cliente'));
		expect(within(linhaDe('Ana Cliente')).getByRole('checkbox')).not.toBeChecked();
		expect(screen.getByText('0 de 3 selecionados')).toBeInTheDocument();
	});

	it('"Selecionar todos" marca tudo e "Limpar" desmarca tudo', async () => {
		render(<MassaCliforSeletorModal onConfirmar={() => {}} onFechar={() => {}} />);
		await screen.findByText('Ana Cliente');

		fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }));
		expect(screen.getByText('3 de 3 selecionados')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
		expect(screen.getByText('0 de 3 selecionados')).toBeInTheDocument();
	});
});

describe('MassaCliforSeletorModal — filtro + ações em massa', () => {
	it('"Selecionar todos" age só sobre o filtro atual (busca por nome)', async () => {
		const onConfirmar = vi.fn();
		render(<MassaCliforSeletorModal onConfirmar={onConfirmar} onFechar={() => {}} />);
		await screen.findByText('Ana Cliente');

		// filtra por "Carla" → só 1 linha visível
		fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), {
			target: { value: 'Carla' }
		});
		expect(screen.queryByText('Ana Cliente')).not.toBeInTheDocument();
		expect(screen.getByText('0 de 1 selecionados')).toBeInTheDocument();

		// "Selecionar todos" marca só o que está no filtro
		fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }));
		expect(screen.getByText('1 de 1 selecionados')).toBeInTheDocument();

		// limpa o filtro: os outros 2 continuam desmarcados (1 de 3 no total)
		fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), {
			target: { value: '' }
		});
		expect(screen.getByText('1 de 3 selecionados')).toBeInTheDocument();

		// e a confirmação devolve só o id da Carla (3)
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar seleção' }));
		expect(onConfirmar).toHaveBeenCalledWith([3]);
	});

	it('"Limpar" desmarca só o que está no filtro atual', async () => {
		render(<MassaCliforSeletorModal onConfirmar={() => {}} onFechar={() => {}} />);
		await screen.findByText('Ana Cliente');

		// marca todos (3 de 3)
		fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }));
		expect(screen.getByText('3 de 3 selecionados')).toBeInTheDocument();

		// filtra por "Carla" e limpa → some só a Carla, sobram 2 marcados no total
		fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), {
			target: { value: 'Carla' }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
		expect(screen.getByText('0 de 1 selecionados')).toBeInTheDocument();

		fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), {
			target: { value: '' }
		});
		expect(screen.getByText('2 de 3 selecionados')).toBeInTheDocument();
	});
});

describe('MassaCliforSeletorModal — confirmar / fechar', () => {
	it('"Confirmar seleção" devolve os ids marcados via onConfirmar', async () => {
		const onConfirmar = vi.fn();
		render(<MassaCliforSeletorModal onConfirmar={onConfirmar} onFechar={() => {}} />);
		await screen.findByText('Ana Cliente');

		fireEvent.click(linhaDe('Ana Cliente'));
		fireEvent.click(linhaDe('Carla Cliente'));
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar seleção' }));

		expect(onConfirmar).toHaveBeenCalledTimes(1);
		expect(onConfirmar.mock.calls[0][0].sort()).toEqual([1, 3]);
	});

	it('clicar no ✕ chama onFechar', async () => {
		const onFechar = vi.fn();
		render(<MassaCliforSeletorModal onConfirmar={() => {}} onFechar={onFechar} />);
		await screen.findByText('Ana Cliente');
		fireEvent.click(screen.getByText('✕'));
		expect(onFechar).toHaveBeenCalledTimes(1);
	});

	it('clicar em CANCELAR chama onFechar', async () => {
		const onFechar = vi.fn();
		render(<MassaCliforSeletorModal onConfirmar={() => {}} onFechar={onFechar} />);
		await screen.findByText('Ana Cliente');
		fireEvent.click(screen.getByRole('button', { name: 'CANCELAR' }));
		expect(onFechar).toHaveBeenCalledTimes(1);
	});
});
