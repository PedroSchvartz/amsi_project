/**
 * Testes unitários para src/components/LoteLancamentosModal.jsx
 *
 * Componente da feature 6.3 (lançamento em massa). Cobre o que a lógica do
 * componente decide sozinha — sem backend nem rede:
 *   - carrega os lançamentos do lote (getLancamentos({ lote }))
 *   - estado vazio
 *   - renderização condicional de ações por perfil (RBAC)
 *   - callbacks onEditarUm / onEfetivarUm / onFechar
 *
 * api/auth/toast são mockados; getLancamentos é o que alimenta a lista.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import LoteLancamentosModal from '../components/LoteLancamentosModal';
import * as api from '../services/api';
import * as auth from '../services/auth';

vi.mock('../services/api', () => ({
	getLancamentos: vi.fn(),
	fecharLancamento: vi.fn(() => Promise.resolve({})),
	editarLancamento: vi.fn(() => Promise.resolve({})),
	deleteLancamento: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../services/auth', () => ({
	isAdmin: vi.fn(() => false),
	hasPerfilMinimo: vi.fn(() => false),
	getUserFromToken: vi.fn(() => ({ sub: 1 })),
}));

vi.mock('../components/ToastStack.jsx', () => ({
	useToast: () => ({ mostrarToast: vi.fn() }),
}));

const LOTE = 1718700000000; // epoch ms qualquer

const ABERTO = {
	id_lancamento: 101,
	nome_clifor: 'Cliente Aberto',
	descricao_tipo_conta: 'Mensalidade',
	data_vencimento: '2099-12-31', // futuro → status "Aberto"
	valor: 100.5,
	data_pagamento: null,
	estorno: false,
	lote: LOTE,
};
const PAGO = {
	id_lancamento: 102,
	nome_clifor: 'Cliente Pago',
	descricao_tipo_conta: 'Mensalidade',
	data_vencimento: '2099-12-31',
	valor: 80,
	valor_pago: 80,
	data_pagamento: '2026-06-10',
	estorno: false,
	lote: LOTE,
};

beforeEach(() => {
	api.getLancamentos.mockResolvedValue([ABERTO, PAGO]);
	auth.isAdmin.mockReturnValue(false);
	auth.hasPerfilMinimo.mockReturnValue(false);
});

describe('LoteLancamentosModal — carga', () => {
	it('busca os lançamentos filtrando pelo lote da prop', async () => {
		render(<LoteLancamentosModal lote={LOTE} onFechar={() => {}} />);
		expect(await screen.findByText('Cliente Aberto')).toBeInTheDocument();
		expect(api.getLancamentos).toHaveBeenCalledWith({ lote: LOTE });
		expect(screen.getByText('Cliente Pago')).toBeInTheDocument();
		expect(screen.getByText(/Lançamentos do Lote/)).toBeInTheDocument();
	});

	it('mostra o estado vazio quando o lote não tem lançamentos', async () => {
		api.getLancamentos.mockResolvedValue([]);
		render(<LoteLancamentosModal lote={LOTE} onFechar={() => {}} />);
		expect(await screen.findByText('Nenhum lançamento neste lote.')).toBeInTheDocument();
	});
});

describe('LoteLancamentosModal — RBAC de ações', () => {
	it('Consulta vê "ver detalhes" e não vê editar/excluir/efetivar', async () => {
		// isAdmin=false, hasPerfilMinimo('Operador')=false (padrão do beforeEach)
		render(<LoteLancamentosModal lote={LOTE} onFechar={() => {}} />);
		await screen.findByText('Cliente Aberto');
		expect(screen.getAllByTitle('Ver detalhes').length).toBe(2);
		expect(screen.queryByTitle('Editar este lançamento')).not.toBeInTheDocument();
		expect(screen.queryByTitle('Excluir este lançamento')).not.toBeInTheDocument();
		expect(screen.queryByTitle('Efetivar este lançamento')).not.toBeInTheDocument();
	});

	it('Operador vê efetivar (só nos abertos) e não vê editar/excluir', async () => {
		auth.hasPerfilMinimo.mockReturnValue(true); // Operador
		render(<LoteLancamentosModal lote={LOTE} onFechar={() => {}} />);
		await screen.findByText('Cliente Aberto');
		// Só a linha "ABERTO" (sem data_pagamento e sem estorno) ganha o botão de efetivar
		expect(screen.getAllByTitle('Efetivar este lançamento').length).toBe(1);
		expect(screen.queryByTitle('Editar este lançamento')).not.toBeInTheDocument();
		expect(screen.queryByTitle('Excluir este lançamento')).not.toBeInTheDocument();
	});

	it('Admin vê editar e excluir e não vê "ver detalhes"', async () => {
		auth.isAdmin.mockReturnValue(true);
		auth.hasPerfilMinimo.mockReturnValue(true);
		render(<LoteLancamentosModal lote={LOTE} onFechar={() => {}} />);
		await screen.findByText('Cliente Aberto');
		expect(screen.getAllByTitle('Editar este lançamento').length).toBe(2);
		expect(screen.getAllByTitle('Excluir este lançamento').length).toBe(2);
		expect(screen.queryByTitle('Ver detalhes')).not.toBeInTheDocument();
	});
});

describe('LoteLancamentosModal — callbacks', () => {
	it('clicar em editar-um chama onEditarUm com o lançamento da linha', async () => {
		auth.isAdmin.mockReturnValue(true);
		auth.hasPerfilMinimo.mockReturnValue(true);
		const onEditarUm = vi.fn();
		render(<LoteLancamentosModal lote={LOTE} onEditarUm={onEditarUm} onFechar={() => {}} />);
		await screen.findByText('Cliente Aberto');
		fireEvent.click(screen.getAllByTitle('Editar este lançamento')[0]);
		expect(onEditarUm).toHaveBeenCalledTimes(1);
		expect(onEditarUm.mock.calls[0][0].id_lancamento).toBe(ABERTO.id_lancamento);
	});

	it('clicar em efetivar-um chama onEfetivarUm com o lançamento aberto', async () => {
		auth.hasPerfilMinimo.mockReturnValue(true); // Operador
		const onEfetivarUm = vi.fn();
		render(<LoteLancamentosModal lote={LOTE} onEfetivarUm={onEfetivarUm} onFechar={() => {}} />);
		await screen.findByText('Cliente Aberto');
		fireEvent.click(screen.getByTitle('Efetivar este lançamento'));
		expect(onEfetivarUm).toHaveBeenCalledTimes(1);
		expect(onEfetivarUm.mock.calls[0][0].id_lancamento).toBe(ABERTO.id_lancamento);
	});

	it('clicar no ✕ chama onFechar', async () => {
		const onFechar = vi.fn();
		render(<LoteLancamentosModal lote={LOTE} onFechar={onFechar} />);
		await screen.findByText('Cliente Aberto');
		fireEvent.click(screen.getByText('✕'));
		expect(onFechar).toHaveBeenCalledTimes(1);
	});
});
