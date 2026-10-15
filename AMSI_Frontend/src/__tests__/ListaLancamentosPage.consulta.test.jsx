/**
 * Testes da ListaLancamentosPage para o perfil CONSULTA.
 *
 * Diferente dos demais perfis, o Consulta:
 *  - pesquisa SOZINHO ao abrir a tela (sem card de filtros nem botão "Pesquisar");
 *  - na tabela, não vê as colunas "Nome / Razão Social", "Natureza" e "Vl. Pagamento".
 *
 * O escopo já é o próprio clifor (filtro travado em meuClifor) — isso é testado via o
 * getCliforDoUsuario mockado alimentando a busca automática.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import ListaLancamentosPage from '../pages/ListaLancamentosPage.jsx';
import * as api from '../services/api.js';

const MEU_CLIFOR = { id_clifor: 10, nome: 'Marcio Luiz Silva Schvartz - L 16' };

const LANCAMENTOS = [
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
	},
	{
		id_lancamento: 2,
		id_clifor_relacionado_fk: 10,
		nome_clifor: MEU_CLIFOR.nome,
		id_tipo_conta_fk: 30,
		descricao_tipo_conta: 'Rateio manutenção rua - R$ 30,00',
		natureza_lancamento: 'Debito',
		data_vencimento: '2026-07-21',
		data_pagamento: null,
		valor: 30,
		valor_pago: null,
		multa: null,
		juros: null,
		situacao: 'Vencido',
		tem_comprovante: false,
		estorno: false
	}
];

vi.mock('../services/api.js', () => ({
	getLancamentos: vi.fn(() => Promise.resolve(LANCAMENTOS.map((l) => ({ ...l })))),
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
	hasPerfilMinimo: () => false, // Consulta não é Operador
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

// Child modals: só aparecem com estado aberto (nunca neste teste). No-ops para evitar deps.
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
});

describe('ListaLancamentosPage — perfil Consulta', () => {
	it('pesquisa sozinho ao abrir (sem clicar em nada)', async () => {
		render(<ListaLancamentosPage />);
		await waitFor(() => expect(api.getLancamentos).toHaveBeenCalled());
	});

	it('não mostra o card de filtros (título "Lista de Lançamentos" nem botão "Pesquisar")', async () => {
		render(<ListaLancamentosPage />);
		await waitFor(() => expect(api.getLancamentos).toHaveBeenCalled());
		expect(screen.queryByRole('heading', { name: 'Lista de Lançamentos' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Pesquisar/ })).not.toBeInTheDocument();
	});

	it('esconde as colunas Nome/Razão Social, Natureza e Vl. Pagamento; mantém as demais', async () => {
		render(<ListaLancamentosPage />);
		await waitFor(() => expect(api.getLancamentos).toHaveBeenCalled());

		const cabecalhos = () => screen.getAllByRole('columnheader').map((th) => th.textContent.trim());
		await waitFor(() => expect(cabecalhos()).toContain('Tipo de Conta'));

		const heads = cabecalhos();
		expect(heads).not.toContain('Nome / Razão Social');
		expect(heads).not.toContain('Natureza');
		expect(heads).not.toContain('Vl. Pagamento');
		expect(heads).toHaveLength(5);
		expect(heads.slice(0, 4)).toEqual(['Tipo de Conta', 'Vencimento', 'Pagamento', 'Vl. Lançamento']);
		// Status tem dual-span (longo 'Status' + curto 'S' p/ o mobile) → 'StatusS' no DOM.
		expect(heads[4]).toContain('Status');
	});

	it('a linha do lançamento não traz nome do clifor nem a natureza', async () => {
		render(<ListaLancamentosPage />);
		await screen.findByText('23 - Mensalidade');
		expect(screen.queryByText(MEU_CLIFOR.nome)).not.toBeInTheDocument();
		expect(screen.queryByText('Credito')).not.toBeInTheDocument();
	});

	// A classe é o gancho do CSS que corrige o alinhamento das colunas na ordem de 5
	// colunas (o alinhamento em si é CSS, não testável por unidade).
	it('marca a tabela com a classe ll-table--consulta', async () => {
		const { container } = render(<ListaLancamentosPage />);
		await screen.findByText('23 - Mensalidade');
		expect(container.querySelector('table.ll-table--consulta')).toBeInTheDocument();
	});

	// Efeito só de visualização: ambas as formas (longa e curta) ficam no DOM; o CSS
	// (media query) escolhe qual mostrar. jsdom não aplica media, então testo o CONTEÚDO
	// das variantes curtas, não a visibilidade.
	it('mobile: Tipo de Conta sem id, datas curtas, Status "S" e legenda de cores', async () => {
		const { container } = render(<ListaLancamentosPage />);
		await screen.findByText('23 - Mensalidade');

		// Tipo de Conta curto: sem o prefixo '<id> - ', preservando traço interno do nome.
		const tiposCurtos = [...container.querySelectorAll('.ll-tipo-curto')].map((e) => e.textContent);
		expect(tiposCurtos).toContain('Mensalidade');
		expect(tiposCurtos).toContain('Rateio manutenção rua - R$ 30,00');

		// Datas curtas dd/mm/aa (2026-05-20 → 20/05/26).
		const datasCurtas = [...container.querySelectorAll('.ll-data-curta')].map((e) => e.textContent);
		expect(datasCurtas).toContain('20/05/26');

		// Cabeçalho do Status tem a versão curta 'S'.
		expect(container.querySelector('.ll-th-curto')?.textContent).toBe('S');

		// Forma original preservada no DOM (reversível ao crescer a tela).
		const tiposLongos = [...container.querySelectorAll('.ll-tipo-longo')].map((e) => e.textContent);
		expect(tiposLongos).toContain('23 - Mensalidade');

		// Legenda lista os status presentes no resultado.
		const legenda = container.querySelector('.ll-legenda-status');
		expect(legenda).toBeInTheDocument();
		expect(legenda.textContent).toContain('Pago');
		expect(legenda.textContent).toContain('Vencido');
	});
});
