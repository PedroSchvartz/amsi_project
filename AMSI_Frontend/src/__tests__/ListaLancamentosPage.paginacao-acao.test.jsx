/**
 * Paginação × ações de linha: uma ação (efetivar/aprovar/editar/excluir/reverter) tem de
 * recarregar a PÁGINA ATUAL, não voltar à página 1.
 *
 * Regressão real que isto trava: `buscar(f = filtros, pag = 1)` + chamadas `buscar()` nos
 * handlers faziam toda ação jogar a lista de volta à página 1. Com a correção, os handlers
 * chamam `buscar(filtrosAplicados, pagina)`.
 *
 * Caminho exercido (perfil Admin, pois só ele vê o lápis de Editar): pesquisa → página 2 →
 * lápis de Editar → "Salvar" (handleConfirmarEditar). O editarLancamento é mockado; o que
 * importa é o skip da rechamada ao backend logo depois.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ListaLancamentosPage from '../pages/ListaLancamentosPage.jsx';
import * as api from '../services/api.js';

const ROW = {
	id_lancamento: 1,
	id_clifor_relacionado_fk: 10,
	nome_clifor: 'Marcio Luiz Silva Schvartz - L 16',
	id_tipo_conta_fk: 23,
	descricao_tipo_conta: 'Mensalidade',
	natureza_lancamento: 'Credito',
	data_vencimento: '2026-05-20',
	data_pagamento: '2026-05-14',
	valor: 100,
	valor_pago: 100,
	multa: null,
	juros: null,
	situacao: 'Pago',
	tem_comprovante: false,
	estorno: false
};

const TOTAL = 120; // > POR_PAGINA (50) → 3 páginas

vi.mock('../services/api.js', () => ({
	getLancamentosPaginado: vi.fn(() => Promise.resolve({ itens: [{ ...ROW }], total: TOTAL })),
	getCliforDoUsuario: vi.fn(() => Promise.resolve(null)),
	getTiposConta: vi.fn(() => Promise.resolve([])),
	getClifors: vi.fn(() => Promise.resolve([])),
	getLotesClifor: vi.fn(() => Promise.resolve([])),
	fecharLancamento: vi.fn(),
	aprovarLancamento: vi.fn(),
	editarLancamento: vi.fn(() => Promise.resolve({})),
	deleteLancamento: vi.fn(() => Promise.resolve({})),
	anexarComprovante: vi.fn(),
	baixarComprovante: vi.fn(),
	removerComprovante: vi.fn(),
	getUser: vi.fn()
}));

vi.mock('../services/auth', () => ({
	isAdmin: () => true,
	isConsulta: () => false,
	hasPerfilMinimo: () => true,
	getUserFromToken: () => ({ sub: '1' })
}));

vi.mock('../services/cache', () => ({
	getCache: () => null,
	setCache: vi.fn()
}));

vi.mock('react-router-dom', () => ({
	useSearchParams: () => [new URLSearchParams()]
}));

vi.mock('../components/ToastStack.jsx', () => ({
	useToast: () => ({ mostrarToast: vi.fn() })
}));

vi.mock('../services/exportacaoContext.jsx', () => ({
	useExportacao: () => ({ iniciar: vi.fn() })
}));

vi.mock('../components/LancamentoModal.jsx', () => ({ default: () => null }));
vi.mock('../components/LoteLancamentosModal.jsx', () => ({ default: () => null }));
vi.mock('../components/ModalConfirm.jsx', () => ({ default: () => null }));
vi.mock('../components/PerfilCompletoPopup.jsx', () => ({ default: () => null }));
vi.mock('../components/ExportarLancamentosModal.jsx', () => ({ default: () => null }));
vi.mock('../components/SituacaoBadge.jsx', () => ({
	default: ({ situacao }) => <span>{situacao}</span>,
	CLASSE_SITUACAO: {
		Estorno: 'badge-estorno',
		Pago: 'badge-pago',
		'Em análise': 'badge-analise',
		Vencido: 'badge-vencido',
		Aberto: 'badge-aberto'
	}
}));
vi.mock('../components/TimelineLancamentoModal.jsx', () => ({
	default: () => null,
	ultimaInteracao: () => null,
	formatarCarimbo: () => ''
}));

beforeEach(() => {
	vi.clearAllMocks();
	api.getLancamentosPaginado.mockResolvedValue({ itens: [{ ...ROW }], total: TOTAL });
	api.editarLancamento.mockResolvedValue({});
});

describe('ListaLancamentosPage — filtro de Natureza', () => {
	it('o filtro de Natureza oferece a opção "Resultado" (natureza neutra)', async () => {
		render(<ListaLancamentosPage />);
		// Card de filtros do Admin já está na tela (tem o botão Pesquisar).
		await screen.findByRole('button', { name: /Pesquisar/ });
		expect(screen.getByRole('option', { name: 'Resultado' })).toBeInTheDocument();
	});
});

describe('ListaLancamentosPage — ação preserva a página', () => {
	it('editar na página 2 recarrega a página 2 (skip=50), não a 1', async () => {
		render(<ListaLancamentosPage />);

		// Admin não pesquisa sozinho → clicar "Pesquisar" (página 1, skip=0).
		fireEvent.click(await screen.findByRole('button', { name: /Pesquisar/ }));
		await waitFor(() => expect(api.getLancamentosPaginado).toHaveBeenCalled());

		// Ir para a página 2 (skip=50).
		fireEvent.click(await screen.findByRole('button', { name: '2' }));
		await waitFor(() =>
			expect(api.getLancamentosPaginado.mock.calls.at(-1)[0]).toEqual(
				expect.objectContaining({ skip: 50 })
			)
		);

		// Abrir o Editar da linha e salvar (dispara handleConfirmarEditar).
		fireEvent.click(await screen.findByTitle('Editar lançamento (admin)'));
		fireEvent.click(await screen.findByRole('button', { name: 'Salvar' }));

		// A ação chamou o backend e recarregou — a recarga tem de ser na página 2 (skip=50),
		// não um reset para a página 1 (skip=0).
		await waitFor(() => expect(api.editarLancamento).toHaveBeenCalled());
		await waitFor(() =>
			expect(api.getLancamentosPaginado.mock.calls.at(-1)[0]).toEqual(
				expect.objectContaining({ skip: 50 })
			)
		);
	});
});
