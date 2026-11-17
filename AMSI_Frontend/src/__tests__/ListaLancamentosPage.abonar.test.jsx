/**
 * Abonado: botão "Abonar" (só Admin, só Aberto, no rodapé do modal Efetivar) e checkbox
 * "Abonado" no filtro de status. O abono dispensa o pagamento e não soma em nada.
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
	data_pagamento: null,
	valor: 100,
	valor_pago: 100,
	multa: null,
	juros: null,
	situacao: 'Aberto',
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
	abonarLancamento: vi.fn(() => Promise.resolve({})),
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
vi.mock('../components/ModalConfirm.jsx', () => ({
	default: ({ textoBotaoConfirmar, onConfirmar }) => <button onClick={onConfirmar}>{`Confirmar ${textoBotaoConfirmar}`}</button>
}));
vi.mock('../components/PerfilCompletoPopup.jsx', () => ({ default: () => null }));
vi.mock('../components/ExportarLancamentosModal.jsx', () => ({ default: () => null }));
vi.mock('../components/SituacaoBadge.jsx', () => ({
	default: ({ situacao }) => <span>{situacao}</span>,
	CLASSE_SITUACAO: {
		Estorno: 'badge-estorno',
		Pago: 'badge-pago',
		'Em análise': 'badge-analise',
		Abonado: 'badge-abonado',
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
	api.getLancamentosPaginado.mockResolvedValue({ itens: [{ ...ROW }], total: 1 });
	api.abonarLancamento.mockResolvedValue({});
});

describe('ListaLancamentosPage — Abonado', () => {
	it('Abonar no modal Efetivar confirma e chama abonarLancamento com o id', async () => {
		render(<ListaLancamentosPage />);
		fireEvent.click(await screen.findByRole('button', { name: /Pesquisar/ }));
		fireEvent.click(await screen.findByTitle('Efetivar lançamento'));
		fireEvent.click(await screen.findByRole('button', { name: 'Abonar' }));
		fireEvent.click(await screen.findByRole('button', { name: 'Confirmar Abonar' }));
		await waitFor(() => expect(api.abonarLancamento).toHaveBeenCalledWith(1));
	});

	it('o filtro "Abonado" envia apenas_abonados=true', async () => {
		render(<ListaLancamentosPage />);
		fireEvent.click(await screen.findByLabelText('Abonado'));
		fireEvent.click(await screen.findByRole('button', { name: /Pesquisar/ }));
		await waitFor(() =>
			expect(api.getLancamentosPaginado.mock.calls.at(-1)[0]).toEqual(
				expect.objectContaining({ apenas_abonados: true })
			)
		);
	});
});
