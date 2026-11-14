/**
 * Dashboard: filtro de mês único, card Resultado (Receitas − Despesas + lançamentos
 * Resultado do mês anterior) e lista Resultado como última seção, para todos os perfis.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Dashboard from '../pages/dashboard.jsx';
import * as api from '../services/api.js';

vi.mock('../services/api.js', () => ({
	getLancamentosResumo: vi.fn(),
	getResumoPorTipo: vi.fn(),
	getClifors: vi.fn(() => Promise.resolve([]))
}));

let consulta = false;
vi.mock('../services/auth', () => ({ isConsulta: () => consulta }));
vi.mock('../services/cache', () => ({ getCache: () => null, setCache: vi.fn() }));
vi.mock('react-router-dom', () => ({
	Link: ({ children }) => <a>{children}</a>,
	useNavigate: () => vi.fn()
}));

function prepararApi() {
	api.getLancamentosResumo.mockResolvedValue({ total_recebido: 2970, total_pago: 475 });
	api.getResumoPorTipo.mockImplementation((p) => {
		if (p.natureza === 'Resultado')
			return Promise.resolve([
				{ id_tipo_conta: 1, descricao_conta: 'Saldo anterior', total: 1000, quantidade: 1 },
				{ id_tipo_conta: 2, descricao_conta: 'Ajuste', total: 300, quantidade: 2 }
			]);
		return Promise.resolve([]);
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	prepararApi();
});

describe.each([false, true])('Dashboard (consulta=%s)', (ehConsulta) => {
	beforeEach(() => {
		consulta = ehConsulta;
	});

	it('tem um único campo de mês e nenhum card Saldo', async () => {
		const { container } = render(<Dashboard />);
		await screen.findByText('Resultado');
		expect(container.querySelectorAll('input[type="month"]')).toHaveLength(1);
		expect(screen.queryByText('Saldo')).toBeNull();
	});

	it('Resultado = receitas − despesas + Σ Resultado do mês anterior', async () => {
		render(<Dashboard />);
		// 2970 − 475 + 1000 + 300 = 3795
		await screen.findByText('3.795,00');
		const chamada = api.getResumoPorTipo.mock.calls.find(([p]) => p.natureza === 'Resultado')[0];
		const hoje = new Date();
		const ant = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
		expect(chamada.data_pagamento_de).toBe(
			`${ant.getFullYear()}-${String(ant.getMonth() + 1).padStart(2, '0')}-01`
		);
	});

	it('lista Resultado fica logo abaixo de Receitas/Despesas, no 1º bloco', async () => {
		const { container } = render(<Dashboard />);
		await screen.findByText('Saldo anterior');
		const primeiro = container.querySelector('section.dash-bloco');
		const cols = primeiro.querySelector('.dash-cols');
		const card = cols.nextElementSibling;
		expect(card.textContent).toContain('Saldo anterior');
		expect(card.textContent).toContain('Resultado de');
	});
});

it('mês anterior de janeiro é dezembro do ano anterior', async () => {
	consulta = false;
	const { container } = render(<Dashboard />);
	await screen.findByText('Resultado');
	fireEvent.change(container.querySelector('input[type="month"]'), { target: { value: '2027-01' } });
	fireEvent.click(screen.getByText(/Pesquisar/));
	await waitFor(() => {
		const chamadas = api.getResumoPorTipo.mock.calls.filter(([p]) => p.natureza === 'Resultado');
		const ultima = chamadas[chamadas.length - 1][0];
		expect(ultima.data_pagamento_de).toBe('2026-12-01');
		expect(ultima.data_pagamento_ate).toBe('2026-12-31');
	});
});
