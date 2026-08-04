import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getLancamentosResumo, getResumoPorTipo, getClifors } from '../services/api';
import { getCache, setCache } from '../services/cache';
import '../styles/dashboard.css';

function formatarValor(v) {
	if (v == null || isNaN(v)) return '0,00';
	return parseFloat(v)
		.toFixed(2)
		.replace('.', ',')
		.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ── Períodos rápidos, alinhados a mês-calendário ────────────────────────────
// A fonte única de verdade do seletor é o par (mesDe, mesAte) — dois <input type="month">.
// Cada botão apenas PREENCHE esse par; assim o intervalo aplicado fica sempre visível,
// nunca escondido atrás de um rótulo. `mesParaDia` resolve o mês no 1º/último dia.
function ym(offsetMeses = 0) {
	const d = new Date();
	d.setDate(1); // trava no dia 1 antes de deslocar, senão 31→mês seguinte
	d.setMonth(d.getMonth() + offsetMeses);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const PERIODOS = [
	{ label: 'Último mês', de: () => ym(-1), ate: () => ym(-1) },
	{ label: 'Últimos 6 meses', de: () => ym(-5), ate: () => ym(0) },
	{ label: 'Ano atual', de: () => `${new Date().getFullYear()}-01`, ate: () => ym(0) },
	{ label: 'Desde sempre', de: () => '', ate: () => '' }
];
const PERIODO_PADRAO = 0; // Último mês (mês-calendário anterior)

function mesParaDia(mesAno, fim = false) {
	if (!mesAno) return undefined;
	const [ano, mes] = mesAno.split('-').map(Number);
	if (fim) {
		const ultimo = new Date(ano, mes, 0).getDate();
		return `${ano}-${String(mes).padStart(2, '0')}-${ultimo}`;
	}
	return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

function computarParams(mesDe, mesAte) {
	const params = {};
	const de = mesParaDia(mesDe, false);
	const ate = mesParaDia(mesAte, true);
	if (de) params.data_pagamento_de = de;
	if (ate) params.data_pagamento_ate = ate;
	return params;
}

function faixaTexto(de, ate) {
	if (!de && !ate) return 'todo o histórico';
	const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '…');
	return `${fmt(de)} a ${fmt(ate)}`;
}

// ── Definições de cada KPI ──────────────────────────────────────────────────
// A descrição precisa bater com o backend: realizados = APROVADO pelo admin (o que
// virou caixa); pendentes = EM ABERTO (ainda não efetivado); "em análise" = efetivado
// aguardando aprovação (não é caixa nem aberto). Ver /lancamento/resumo.
const KPI_INFO = {
	receita_recebida: {
		tooltip: 'Créditos aprovados cujo pagamento caiu no período.',
		titulo: 'Total Receitas',
		descricao:
			'Soma dos lançamentos de natureza Crédito já APROVADOS pelo administrador, com pagamento dentro do período selecionado (recorte pela data de pagamento). Só o que o admin aprovou conta como caixa — lançamentos ainda "Em análise" não entram aqui. Estornos/reembolsos são contabilizados à parte.'
	},
	despesa_paga: {
		tooltip: 'Débitos aprovados cujo pagamento caiu no período.',
		titulo: 'Total Despesas',
		descricao:
			'Soma dos lançamentos de natureza Débito já APROVADOS pelo administrador, com pagamento dentro do período selecionado. Só o que foi aprovado conta como saída de caixa — lançamentos "Em análise" não entram. Estornos/reembolsos são contabilizados à parte.'
	},
	saldo_periodo: {
		tooltip: 'Total Receitas menos Total Despesas no período.',
		titulo: 'Saldo do Período',
		descricao:
			'Resultado líquido do período: Total Receitas menos Total Despesas, considerando apenas lançamentos aprovados. Positivo indica superávit (entrou mais do que saiu); negativo, déficit. Ignora estornos e tudo que ainda não foi aprovado.'
	},
	reembolsos: {
		tooltip: 'Estornos aprovados no período (natureza inversa).',
		titulo: 'Estornos / Reembolsos',
		descricao:
			'Soma dos lançamentos marcados como estorno já aprovados no período, respeitando a natureza inversa: Crédito subtrai (devolução ao associado) e Débito soma (ressarcimento recebido). Ex.: reembolso de mensalidade (Crédito) = −100,00; reembolso de energia (Débito) = +50,00.'
	},
	a_receber: {
		tooltip: 'Créditos em aberto, ainda não efetivados.',
		titulo: 'A Receber',
		descricao:
			'Soma dos lançamentos de natureza Crédito ainda EM ABERTO (nunca efetivados) e que não são estorno. É o que a associação tem a receber, independentemente do período. Não inclui os que já estão "Em análise" — esses aparecem no card Em Análise.'
	},
	a_pagar: {
		tooltip: 'Débitos em aberto, ainda não efetivados.',
		titulo: 'A Pagar',
		descricao:
			'Soma dos lançamentos de natureza Débito ainda EM ABERTO (nunca efetivados) e que não são estorno. São compromissos pendentes da associação, independentemente do período. Não inclui os que já estão "Em análise".'
	},
	em_analise: {
		tooltip: 'Lançamentos efetivados aguardando aprovação do admin.',
		titulo: 'Em Análise',
		descricao:
			'Quantidade de lançamentos que já foram efetivados (alguém registrou o pagamento) mas ainda aguardam a aprovação do administrador. Enquanto não aprovados, NÃO contam como caixa — por isso ficam fora de Receitas/Despesas e também de A Receber/A Pagar. É a fila de aprovação.'
	},
	inadimplencia: {
		tooltip: 'Créditos em aberto e vencidos.',
		titulo: 'Inadimplência',
		descricao:
			'Soma dos lançamentos de Crédito ainda EM ABERTO cuja data de vencimento já passou. É o valor que deveria ter entrado e não entrou. Lançamentos "Em análise" não contam: alguém já registrou o pagamento, então não se cobra de novo.'
	}
};

// ── Filtros que cada KPI pré-aplica ao navegar para a lista ─────────────────
// Cada linha espelha EXATAMENTE o recorte do backend, para o total do card bater com
// a soma da lista ao clicar "Discriminar". Realizados usam a data do período; a posição
// atual (aberto / em análise / vencido) independe do período.
const KPI_FILTROS = {
	receita_recebida: { natureza: 'Credito', apenas_quitados: 'true', estorno: 'false', usarData: true },
	despesa_paga:     { natureza: 'Debito',  apenas_quitados: 'true', estorno: 'false', usarData: true },
	saldo_periodo:    { natureza: '',        apenas_quitados: 'true', estorno: 'false', usarData: true },
	reembolsos:       { natureza: '',        apenas_quitados: 'true', estorno: 'true',  usarData: true },
	a_receber:        { natureza: 'Credito', apenas_abertos: 'true',    estorno: 'false', usarData: false },
	a_pagar:          { natureza: 'Debito',  apenas_abertos: 'true',    estorno: 'false', usarData: false },
	em_analise:       { natureza: '',        apenas_em_analise: 'true', estorno: 'false', usarData: false },
	inadimplencia:    { natureza: 'Credito', apenas_vencidos: 'true',   estorno: 'false', usarData: false }
};

// ── Componente KpiCard com tooltip e popup ──────────────────────────────────
function KpiCard({ infoKey, icon, iconClass, label, value, sub, valueClass, onDiscriminar }) {
	const [hover, setHover] = useState(false);
	const [popup, setPopup] = useState(false);
	const info = KPI_INFO[infoKey];

	return (
		<>
			<div
				className="dash-kpi-card dash-kpi-card--interativo"
				onMouseEnter={() => setHover(true)}
				onMouseLeave={() => setHover(false)}
				onClick={() => setPopup(true)}
				style={{ cursor: 'pointer', position: 'relative' }}
			>
				<div className={`dash-kpi-card__icon ${iconClass}`}>
					<i className={`bi ${icon}`} />
				</div>
				<span className="dash-kpi-card__label">{label}</span>
				<span className={`dash-kpi-card__value${valueClass ? ` ${valueClass}` : ''}`}>{value}</span>
				{sub && <span className="dash-kpi-card__sub">{sub}</span>}

				{hover && <div className="dash-kpi-tooltip">{info.tooltip}</div>}
			</div>

			{popup && (
				<div
					style={{
						position: 'fixed',
						inset: 0,
						background: 'rgba(0,0,0,0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 9990,
						padding: 20
					}}
					onClick={() => setPopup(false)}
				>
					<div
						style={{
							background: 'var(--bg-card)',
							borderRadius: 14,
							maxWidth: 480,
							width: '100%',
							padding: '32px 36px',
							boxShadow: '0 16px 48px var(--shadow)'
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<div
							style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								marginBottom: 16
							}}
						>
							<h4
								style={{
									margin: 0,
									fontFamily: 'var(--font-display)',
									color: 'var(--primary)',
									fontWeight: 700
								}}
							>
								{info.titulo}
							</h4>
							<button
								onClick={() => setPopup(false)}
								style={{
									background: 'transparent',
									border: 'none',
									cursor: 'pointer',
									fontSize: '1.2rem',
									color: 'var(--text-muted)'
								}}
							>
								✕
							</button>
						</div>
						<p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.7 }}>
							{info.descricao}
						</p>
						<div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16, textAlign: 'right' }}>
							<button
								onClick={() => { setPopup(false); onDiscriminar(); }}
								style={{
									padding: '8px 16px',
									borderRadius: 8,
									border: 'none',
									background: 'var(--primary)',
									color: '#fff',
									fontWeight: 600,
									fontSize: '0.82rem',
									cursor: 'pointer',
									display: 'inline-flex',
									alignItems: 'center',
									gap: 6
								}}
							>
								<i className="bi bi-list-ul" /> Ver os lançamentos deste indicador
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard() {
	const navigate = useNavigate();
	const [resumo, setResumo] = useState(null);
	const [porTipoDespesa, setPorTipoDespesa] = useState([]);
	const [porTipoReceita, setPorTipoReceita] = useState([]);
	const [inadimplentes, setInadimplentes] = useState([]);
	const [carregando, setCarregando] = useState(false);
	const [erro, setErro] = useState('');
	const [populado, setPopulado] = useState(false); // true após a 1ª busca

	// Seleção do período (rascunho) — dois inputs de mês, fonte única de verdade.
	const [mesDe, setMesDe] = useState(PERIODOS[PERIODO_PADRAO].de());
	const [mesAte, setMesAte] = useState(PERIODOS[PERIODO_PADRAO].ate());
	// Range efetivamente carregado (dias) — usado pelo cabeçalho e pelo "Discriminar".
	const [aplicado, setAplicado] = useState({ data_pagamento_de: undefined, data_pagamento_ate: undefined });
	const [pendente, setPendente] = useState(false);

	// `meta` viaja junto no cache para que resultado E controles reidratem juntos ao voltar.
	const carregarDados = useCallback(async (params, meta) => {
		setCarregando(true);
		setErro('');
		try {
			const [res, despesas, receitas, clifors] = await Promise.all([
				getLancamentosResumo(params),
				getResumoPorTipo({ ...params, natureza: 'Debito' }),
				getResumoPorTipo({ ...params, natureza: 'Credito' }),
				getClifors({ inadimplente: true })
			]);
			const despesasTop = despesas.slice(0, 5);
			const receitasTop = receitas.slice(0, 5);
			setResumo(res);
			setPorTipoDespesa(despesasTop);
			setPorTipoReceita(receitasTop);
			setInadimplentes(clifors);
			setPopulado(true);
			setCache('dashboard', {
				resumo: res,
				porTipoDespesa: despesasTop,
				porTipoReceita: receitasTop,
				inadimplentes: clifors,
				...meta
			});
		} catch (err) {
			if (err.message !== 'sessao-expirada')
				setErro(err.message || 'Erro ao carregar dados do dashboard.');
		} finally {
			setCarregando(false);
		}
	}, []);

	// Não busca ao abrir: a busca é disparada no botão "Pesquisar". Mas se já houve uma
	// pesquisa nesta sessão, reidrata o resultado (e a seleção) do cache.
	useEffect(() => {
		const cache = getCache('dashboard');
		if (!cache) return;
		setResumo(cache.resumo);
		setPorTipoDespesa(cache.porTipoDespesa);
		setPorTipoReceita(cache.porTipoReceita);
		setInadimplentes(cache.inadimplentes);
		setAplicado(cache.aplicado);
		setMesDe(cache.mesDe);
		setMesAte(cache.mesAte);
		setPendente(false);
		setPopulado(true);
	}, []);

	// Qual botão rápido corresponde à seleção atual (para destacá-lo). null = intervalo livre.
	const periodoAtivo = PERIODOS.findIndex((p) => p.de() === mesDe && p.ate() === mesAte);

	const handlePeriodoRapido = (idx) => {
		const p = PERIODOS[idx];
		setMesDe(p.de());
		setMesAte(p.ate());
		setPendente(true);
	};

	const handleDataChange = (campo, valor) => {
		if (campo === 'de') setMesDe(valor);
		else setMesAte(valor);
		setPendente(true);
	};

	const aplicar = () => {
		const params = computarParams(mesDe, mesAte);
		const aplicadoNovo = {
			data_pagamento_de: params.data_pagamento_de,
			data_pagamento_ate: params.data_pagamento_ate
		};
		setAplicado(aplicadoNovo);
		carregarDados(params, { aplicado: aplicadoNovo, mesDe, mesAte });
		setPendente(false);
	};

	const botaoPendente = populado && pendente;
	const rotuloAplicar = botaoPendente ? '⚠ Pesquisar' : 'Pesquisar';

	const discriminar = (infoKey) => {
		const cfg = KPI_FILTROS[infoKey];
		const q = new URLSearchParams({ origemDashboard: '1' });
		if (cfg.natureza) q.set('natureza', cfg.natureza);
		if (cfg.apenas_abertos) q.set('apenas_abertos', cfg.apenas_abertos);
		if (cfg.apenas_vencidos) q.set('apenas_vencidos', cfg.apenas_vencidos);
		if (cfg.apenas_em_analise) q.set('apenas_em_analise', cfg.apenas_em_analise);
		if (cfg.apenas_quitados) q.set('apenas_quitados', cfg.apenas_quitados);
		if (cfg.estorno) q.set('estorno', cfg.estorno);
		if (cfg.usarData && aplicado.data_pagamento_de)
			q.set('data_pagamento_de', aplicado.data_pagamento_de);
		if (cfg.usarData && aplicado.data_pagamento_ate)
			q.set('data_pagamento_ate', aplicado.data_pagamento_ate);
		navigate(`/lancamentos?${q.toString()}`);
	};

	return (
		<div className="dash-container">
			<div className="dash-header">
				<div>
					<h1 className="dash-header__title">Dashboard</h1>
					<p className="dash-header__subtitle">Visão geral financeira da associação</p>
				</div>
			</div>

			<div className="dash-periodo">
				<div className="dash-periodo__rapido">
					<span className="dash-periodo__label">Período (data de pagamento)</span>
					{PERIODOS.map((p, i) => (
						<button
							key={i}
							className={`dash-periodo__btn${periodoAtivo === i ? ' dash-periodo__btn--ativo' : ''}`}
							onClick={() => handlePeriodoRapido(i)}
						>
							{p.label}
						</button>
					))}
				</div>
				<div className="dash-periodo__livre">
					<input
						type="month"
						value={mesDe}
						onChange={(e) => handleDataChange('de', e.target.value)}
						className="dash-periodo__input"
						aria-label="Mês inicial"
					/>
					<span className="dash-periodo__sep">até</span>
					<input
						type="month"
						value={mesAte}
						onChange={(e) => handleDataChange('ate', e.target.value)}
						className="dash-periodo__input"
						aria-label="Mês final"
					/>
					<button
						onClick={aplicar}
						className={`dash-periodo__btn${botaoPendente ? ' dash-periodo__btn--pendente' : ' dash-periodo__btn--ativo'}`}
						title="Aplicar filtros"
					>
						{rotuloAplicar}
					</button>
				</div>
			</div>

			{erro && (
				<div className="dash-erro">
					<i className="bi bi-exclamation-triangle" />
					{erro}
				</div>
			)}

			{carregando ? (
				<div className="dash-loading">
					<i className="bi bi-arrow-repeat" /> Carregando dados...
				</div>
			) : !populado ? (
				<div className="dash-vazio">
					<i className="bi bi-bar-chart-line" />
					<p>Escolha um período e clique em <strong>Pesquisar</strong> para carregar os indicadores.</p>
				</div>
			) : (
				<>
					{/* ── No período (dinheiro realizado = aprovado) ── */}
					<section className="dash-bloco">
						<div className="dash-bloco__head">
							<h2 className="dash-bloco__titulo">No período</h2>
							<span className="dash-bloco__faixa">
								<i className="bi bi-calendar3" /> {faixaTexto(aplicado.data_pagamento_de, aplicado.data_pagamento_ate)}
							</span>
						</div>
						<div className="dash-kpi-grid">
							<KpiCard
								infoKey="receita_recebida"
								icon="bi-arrow-down-circle"
								iconClass="dash-kpi-card__icon--receita"
								label="Total Receitas"
								value={formatarValor(resumo?.total_recebido)}
								valueClass="dash-kpi-card__value--positivo"
								onDiscriminar={() => discriminar('receita_recebida')}
							/>
							<KpiCard
								infoKey="despesa_paga"
								icon="bi-arrow-up-circle"
								iconClass="dash-kpi-card__icon--despesa"
								label="Total Despesas"
								value={formatarValor(resumo?.total_pago)}
								valueClass="dash-kpi-card__value--negativo"
								onDiscriminar={() => discriminar('despesa_paga')}
							/>
							<KpiCard
								infoKey="saldo_periodo"
								icon="bi-wallet2"
								iconClass="dash-kpi-card__icon--saldo"
								label="Saldo do Período"
								value={formatarValor(resumo?.saldo_total)}
								valueClass={
									parseFloat(resumo?.saldo_total ?? 0) >= 0
										? 'dash-kpi-card__value--positivo'
										: 'dash-kpi-card__value--negativo'
								}
								onDiscriminar={() => discriminar('saldo_periodo')}
							/>
							<KpiCard
								infoKey="reembolsos"
								icon="bi-arrow-left-right"
								iconClass="dash-kpi-card__icon--reembolso"
								label="Estornos / Reembolsos"
								value={formatarValor(resumo?.total_reembolsado)}
								onDiscriminar={() => discriminar('reembolsos')}
							/>
						</div>

						{/* ── Rankings por tipo (dentro do período) ── */}
						<div className="dash-cols">
							<div className="dash-section">
								<div className="dash-section__header">
									<h2 className="dash-section__title">
										<i className="bi bi-arrow-up-circle me-2" style={{ color: '#b91c1c' }} />
										Top Despesas
									</h2>
									{porTipoDespesa.length > 0 && (
										<span className="dash-section__badge">{porTipoDespesa.length}</span>
									)}
								</div>
								{porTipoDespesa.length === 0 ? (
									<p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
										<i className="bi bi-check-circle me-2" style={{ color: '#16a34a' }} />
										Nenhuma despesa no período.
									</p>
								) : (
									<table className="dash-table">
										<thead>
											<tr>
												<th>Tipo</th>
												<th>Total</th>
												<th>Qtd</th>
											</tr>
										</thead>
										<tbody>
											{porTipoDespesa.map((t) => (
												<tr key={t.id_tipo_conta}>
													<td style={{ fontWeight: 500 }}>{t.descricao_conta}</td>
													<td className="dash-valor--negativo">{formatarValor(t.total)}</td>
													<td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
														{t.quantidade}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								)}
							</div>

							<div className="dash-section">
								<div className="dash-section__header">
									<h2 className="dash-section__title">
										<i className="bi bi-arrow-down-circle me-2" style={{ color: '#16a34a' }} />
										Top Receitas
									</h2>
									{porTipoReceita.length > 0 && (
										<span className="dash-section__badge">{porTipoReceita.length}</span>
									)}
								</div>
								{porTipoReceita.length === 0 ? (
									<p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
										<i className="bi bi-check-circle me-2" style={{ color: '#16a34a' }} />
										Nenhuma receita no período.
									</p>
								) : (
									<table className="dash-table">
										<thead>
											<tr>
												<th>Tipo</th>
												<th>Total</th>
												<th>Qtd</th>
											</tr>
										</thead>
										<tbody>
											{porTipoReceita.map((t) => (
												<tr key={t.id_tipo_conta}>
													<td style={{ fontWeight: 500 }}>{t.descricao_conta}</td>
													<td className="dash-valor--positivo">{formatarValor(t.total)}</td>
													<td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
														{t.quantidade}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								)}
							</div>
						</div>
					</section>

					{/* ── Posição atual (fotografia de hoje; independe do período) ── */}
					<section className="dash-bloco">
						<div className="dash-bloco__head">
							<h2 className="dash-bloco__titulo">Posição atual</h2>
							<span className="dash-bloco__faixa">
								<i className="bi bi-clock-history" /> fotografia de hoje · independe do período
							</span>
						</div>
						<div className="dash-kpi-grid">
							<KpiCard
								infoKey="a_receber"
								icon="bi-hourglass-split"
								iconClass="dash-kpi-card__icon--receita"
								label="A Receber"
								value={formatarValor(resumo?.total_a_receber)}
								valueClass="dash-kpi-card__value--positivo"
								onDiscriminar={() => discriminar('a_receber')}
							/>
							<KpiCard
								infoKey="a_pagar"
								icon="bi-hourglass-split"
								iconClass="dash-kpi-card__icon--despesa"
								label="A Pagar"
								value={formatarValor(resumo?.total_a_pagar)}
								valueClass="dash-kpi-card__value--negativo"
								onDiscriminar={() => discriminar('a_pagar')}
							/>
							<KpiCard
								infoKey="inadimplencia"
								icon="bi-person-x"
								iconClass="dash-kpi-card__icon--inadimplente"
								label="Inadimplência"
								value={formatarValor(resumo?.total_inadimplencia)}
								valueClass="dash-kpi-card__value--negativo"
								onDiscriminar={() => discriminar('inadimplencia')}
							/>
							<KpiCard
								infoKey="em_analise"
								icon="bi-hourglass-top"
								iconClass="dash-kpi-card__icon--analise"
								label="Em Análise"
								value={resumo?.quantidade_em_analise ?? 0}
								sub="aguardando aprovação"
								onDiscriminar={() => discriminar('em_analise')}
							/>
						</div>

						{/* ── Inadimplentes ── */}
						<div className="dash-section">
							<div className="dash-section__header">
								<h2 className="dash-section__title">
									<i className="bi bi-person-x me-2" style={{ color: 'var(--primary)' }} />
									Inadimplentes
								</h2>
								{inadimplentes.length > 0 && (
									<span className="dash-section__badge">{inadimplentes.length}</span>
								)}
							</div>
							{inadimplentes.length === 0 ? (
								<p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
									<i className="bi bi-check-circle me-2" style={{ color: '#16a34a' }} />
									Nenhum cliente inadimplente.
								</p>
							) : (
								<table className="dash-table">
									<thead>
										<tr>
											<th>Nome</th>
											<th>Tipo</th>
											<th>Status</th>
										</tr>
									</thead>
									<tbody>
										{inadimplentes.slice(0, 8).map((c) => (
											<tr key={c.id_clifor}>
												<td style={{ fontWeight: 500 }}>{c.nome}</td>
												<td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
													{c.tipo_clifor === 'C'
														? 'Cliente'
														: c.tipo_clifor === 'F'
															? 'Fornecedor'
															: 'Associado'}
												</td>
												<td>
													<span className="dash-badge-inadimplente">
														<i className="bi bi-exclamation-circle" /> Inadimplente
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
							{inadimplentes.length > 8 && (
								<div style={{ marginTop: 12, textAlign: 'right' }}>
									<Link
										to="/cliente_fornecedor"
										style={{
											fontSize: '0.8rem',
											color: 'var(--primary)',
											textDecoration: 'none',
											fontWeight: 600
										}}
									>
										Ver todos ({inadimplentes.length}) →
									</Link>
								</div>
							)}
						</div>
					</section>
				</>
			)}
		</div>
	);
}

export default Dashboard;
