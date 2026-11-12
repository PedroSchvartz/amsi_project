/**
 * Paginação server-side da ListaLancamentosPage.
 *
 * O back passou a aceitar skip/limit e devolver o total no header X-Total-Count; o front
 * lê isso via getLancamentosPaginado → { itens, total }. Aqui garanto que:
 *  - o cabeçalho "TRANSAÇÕES (N)" mostra o TOTAL do conjunto, não o tamanho da página;
 *  - clicar numa página chama o back com o skip correto (page 2 → skip = POR_PAGINA).
 *
 * Uso o perfil Consulta por comodidade: ele pesquisa sozinho ao abrir (sem depender de
 * clicar em "Pesquisar"). A paginação em si é agnóstica de perfil.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ListaLancamentosPage from '../pages/ListaLancamentosPage.jsx';
import * as api from '../services/api.js';

const MEU_CLIFOR = { id_clifor: 10, nome: 'Marcio Luiz Silva Schvartz - L 16' };

// Uma página de itens (o conteúdo não importa aqui); o que dirige o pager é o `total`.
const PAGINA_ITENS = [
	{
		id_lancamento: 1,
		id_clifor_relacionado_fk: 10,
		nome_clifor: MEU_CLIFOR.nome,
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
	}
];

const TOTAL = 120; // > POR_PAGINA (50) → 3 páginas

vi.mock('../services/api.js', () => ({
	getLancamentosPaginado: vi.fn(() => Promise.resolve({ itens: PAGINA_ITENS, total: TOTAL })),
	getCliforDoUsuario: vi.fn(() => Promise.resolve({ ...MEU_CLIFOR })),
	getTiposConta: vi.fn(() => Promise.resolve([])),
	getClifors: vi.fn(() => Promise.resolve([])),
	getLotesClifor: vi.fn(() => Promise.resolve([])),
	fecharLancamento: vi.fn(),
	aprovarLancamento: vi.fn(),
	editarLancamento: vi.fn(),
	deleteLancamento: vi.fn(),
	anexarComprovante: vi.fn(),
	baixarComprovante: vi.fn(),
	removerComprovante: vi.fn(),
	getUser: vi.fn()
}));

vi.mock('../services/auth', () => ({
	isAdmin: () => false,
	isConsulta: () => true,
	hasPerfilMinimo: () => false,
	getUserFromToken: () => ({ sub: '77' })
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
	api.getLancamentosPaginado.mockResolvedValue({ itens: PAGINA_ITENS, total: TOTAL });
});

describe('ListaLancamentosPage — paginação', () => {
	it('cabeçalho mostra o TOTAL do conjunto (X-Total-Count), não o tamanho da página', async () => {
		render(<ListaLancamentosPage />);
		// 1 item na página, mas o total é 120 → cabeçalho deve dizer 120.
		expect(await screen.findByText(/TRANSAÇÕES \(120\)/)).toBeInTheDocument();
	});

	it('primeira busca pede skip=0 e limit=POR_PAGINA', async () => {
		render(<ListaLancamentosPage />);
		await waitFor(() => expect(api.getLancamentosPaginado).toHaveBeenCalled());
		const arg = api.getLancamentosPaginado.mock.calls[0][0];
		expect(arg).toEqual(expect.objectContaining({ skip: 0, limit: 50 }));
	});

	it('clicar na página 2 rebusca com skip = POR_PAGINA (50)', async () => {
		render(<ListaLancamentosPage />);
		// Espera o pager aparecer (total 120 → 3 páginas → botão "2").
		const btn2 = await screen.findByRole('button', { name: '2' });
		fireEvent.click(btn2);
		await waitFor(() => {
			const ultima = api.getLancamentosPaginado.mock.calls.at(-1)[0];
			expect(ultima).toEqual(expect.objectContaining({ skip: 50, limit: 50 }));
		});
	});
});
