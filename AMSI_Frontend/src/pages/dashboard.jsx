import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
	getLancamentosResumo,
	getResumoPorTipo,
	getClifors,
	getSaldosClifors
} from '../services/api';
import '../styles/dashboard.css';

function formatarValor(v) {
	if (v == null || isNaN(v)) return '0,00';
	return parseFloat(v)
		.toFixed(2)
		.replace('.', ',')
		.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const PERIODOS = [
	{
		label: 'Último mês',
		de: () => {
			const d = new Date();
			d.setMonth(d.getMonth() - 1);
			return d.toISOString().split('T')[0];
		},
		ate: () => new Date().toISOString().split('T')[0]
	},
	{
		label: 'Últimos 6 meses',
		de: () => {
			const d = new Date();
			d.setMonth(d.getMonth() - 6);
			return d.toISOString().split('T')[0];
		},
		ate: () => new Date().toISOString().split('T')[0]
	},
	{
		label: 'Ano atual',
		de: () => `${new Date().getFullYear()}-01-01`,
		ate: () => new Date().toISOString().split('T')[0]
	},
	{ label: 'Desde sempre', de: () => null, ate: () => null }
];

function mesParaDia(mesAno, fim = false) {
	if (!mesAno) return undefined;
	const [ano, mes] = mesAno.split('-').map(Number);
	if (fim) {
		const ultimo = new Date(ano, mes, 0).getDate();
		return `${ano}-${String(mes).padStart(2, '0')}-${ultimo}`;
	}
	return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

// ── Definições de cada KPI ──────────────────────────────────────────────────
const KPI_INFO = {
	receita_recebida: {
		tooltip: 'Total de créditos efetivamente recebidos no período.',
		titulo: 'Total Receitas',
		descricao:
			'Soma de todos os lançamentos de natureza Crédito que foram quitados (com data de pagamento registrada) dentro do período selecionado. Inclui mensalidades, taxas e outras entradas confirmadas. Estornos/reembolsos são contabilizados separadamente e não entram neste valor.'
	},
	despesa_paga: {
		tooltip: 'Total de débitos efetivamente pagos no período.',
		titulo: 'Total Despesas',
		descricao:
			'Soma de todos os lançamentos de natureza Débito que foram quitados (com data de pagamento registrada) dentro do período selecionado. Inclui contas de água, luz, manutenção e outros custos confirmados. Estornos/reembolsos não entram neste valor.'
	},
	saldo_periodo: {
		tooltip: 'Total Receitas menos Total Despesas no período.',
		titulo: 'Saldo do Período',
		descricao:
			'Resultado líquido do período: Total Receitas menos Total Despesas. Um valor positivo indica superávit — a associação recebeu mais do que gastou. Um valor negativo indica déficit. Este saldo considera apenas lançamentos quitados e ignora estornos/reembolsos e lançamentos em aberto.'
	},
	reembolsos: {
		tooltip: 'Total de estornos e reembolsos no período (respeita natureza inversa).',
		titulo: 'Estornos / Reembolsos',
		descricao:
			'Soma de todos os lançamentos marcados como estorno que foram quitados no período, respeitando a natureza inversa do tipo de conta: lançamentos de Crédito subtraem (devolução ao associado), lançamentos de Débito somam (ressarcimento recebido). Exemplo: reembolso de mensalidade (Crédito) = −100,00; reembolso de energia (Débito) = +50,00.'
	},
	a_receber: {
		tooltip: 'Total de créditos em aberto, ainda não recebidos.',
		titulo: 'Total a Receber',
		descricao:
			'Soma de todos os lançamentos de natureza Crédito que ainda não foram pagos (sem data de pagamento) e não são estornos. Representa o valor que a associação tem a receber de clientes e associados, independentemente do período selecionado. Inclui tanto lançamentos dentro do prazo quanto vencidos.'
	},
	a_pagar: {
		tooltip: 'Total de débitos em aberto, ainda não pagos.',
		titulo: 'Total a Pagar',
		descricao:
			'Soma de todos os lançamentos de natureza Débito que ainda não foram pagos (sem data de pagamento) e não são estornos. Representa compromissos financeiros pendentes da associação com fornecedores e prestadores. Inclui tanto lançamentos dentro do prazo quanto vencidos.'
	},
	inadimplencia: {
		tooltip: 'Total de créditos vencidos e não pagos (inadimplência).',
		titulo: 'Total Inadimplência',
		descricao:
			'Soma de todos os lançamentos de Crédito que estão vencidos e ainda não foram pagos. Representa o total financeiro em atraso, ou seja, valores que a associação deveria ter recebido mas ainda não recebeu. Clientes com lançamentos nesta condição são marcados como inadimplentes no sistema.'
	},
	inadimplentes: {
		tooltip: 'Número de clientes com cobranças vencidas e não pagas.',
		titulo: 'Inadimplentes',
		descricao:
			'Quantidade de clientes/fornecedores marcados como inadimplentes no sistema. Um clifor é considerado inadimplente quando possui pelo menos um lançamento de Crédito vencido, não pago e não estornado. Esta marcação é atualizada automaticamente pelo sistema a cada criação, edição ou exclusão de lançamento.'
	}
};

// ── Filtros que cada KPI pré-aplica ao navegar para a lista ─────────────────
const KPI_FILTROS = {
	receita_recebida: { natureza: 'Credito', apenas_quitados: 'true', estorno: 'false', usarData: true },
	despesa_paga:     { natureza: 'Debito',  apenas_quitados: 'true', estorno: 'false', usarData: true },
	saldo_periodo:    { natureza: '',        apenas_quitados: 'true', estorno: 'false', usarData: true },
	reembolsos:       { natureza: '',        apenas_quitados: 'true', estorno: 'true',  usarData: true },
	a_receber:        { natureza: 'Credito', apenas_abertos: 'true',  estorno: 'false', usarData: false },
	a_pagar:          { natureza: 'Debito',  apenas_abertos: 'true',  estorno: 'false', usarData: false },
	inadimplencia:    { natureza: 'Credito', apenas_vencidos: 'true', estorno: 'false', usarData: false },
	inadimplentes:    { natureza: 'Credito', apenas_vencidos: 'true', estorno: 'false', usarData: false }
};

// ── Componente KpiCard com tooltip e popup ──────────────────────────────────
function KpiCard({ infoKey, icon, iconClass, label, value, valueClass, children, onDiscriminar }) {
	const [hover, setHover] = useState(false);
	const [popup, setPopup] = useState(false);
	const cardRef = useRef(null);
	const info = KPI_INFO[infoKey];

	return (
		<>
			<div
				ref={cardRef}
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
				{children}

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
								<i className="bi bi-list-ul" /> Discriminar itens em consideração
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
	const [carregando, setCarregando] = useState(true);
	const [erro, setErro] = useState('');

	// Últimos params efetivamente carregados — usados pelo Discriminar
	const [filtrosAplicados, setFiltrosAplicados] = useState(() => {
		const p = PERIODOS[1];
		return { data_pagamento_de: p.de(), data_pagamento_ate: p.ate() };
	});

	// Estado de seleção (rascunho) — só vira filtro ao clicar "Aplicar"
	const [periodoSelecionado, setPeriodoSelecionado] = useState(1);
	const [rascunhoDe, setRascunhoDe] = useState('');
	const [rascunhoAte, setRascunhoAte] = useState('');
	const [pendente, setPendente] = useState(false);
	// Último período efetivamente aplicado (1 = "Últimos 6 meses", carregado na montagem)
	const [periodoAplicado, setPeriodoAplicado] = useState(1);

	const carregarDados = useCallback(async (params) => {
		setCarregando(true);
		setErro('');
		try {
			const [res, despesas, receitas, clifors] = await Promise.all([
				getLancamentosResumo(params),
				getResumoPorTipo({ ...params, natureza: 'Debito' }),
				getResumoPorTipo({ ...params, natureza: 'Credito' }),
				getClifors({ inadimplente: true })
			]);
			setResumo(res);
			setPorTipoDespesa(despesas.slice(0, 5));
			setPorTipoReceita(receitas.slice(0, 5));
			setInadimplentes(clifors);
		} catch (err) {
			if (err.message !== 'sessao-expirada')
				setErro(err.message || 'Erro ao carregar dados do dashboard.');
		} finally {
			setCarregando(false);
		}
	}, []);

	// Carrega apenas na montagem, com o período padrão (Últimos 6 meses)
	useEffect(() => {
		const p = PERIODOS[1];
		const de = p.de();
		const ate = p.ate();
		const params = {};
		if (de) params.data_pagamento_de = de;
		if (ate) params.data_pagamento_ate = ate;
		setFiltrosAplicados(params);
		carregarDados(params);
	}, [carregarDados]);

	const computarParams = () => {
		if (rascunhoDe || rascunhoAte)
			return {
				data_pagamento_de: mesParaDia(rascunhoDe, false),
				data_pagamento_ate: mesParaDia(rascunhoAte, true)
			};
		if (periodoSelecionado !== null) {
			const p = PERIODOS[periodoSelecionado];
			const de = p.de();
			const ate = p.ate();
			const params = {};
			if (de) params.data_pagamento_de = de;
			if (ate) params.data_pagamento_ate = ate;
			return params;
		}
		return {};
	};

	const handlePeriodoRapido = (idx) => {
		setPeriodoSelecionado(idx);
		setRascunhoDe('');
		setRascunhoAte('');
		// Só fica pendente se for diferente do período já aplicado
		setPendente(idx !== periodoAplicado);
	};

	const handleDataChange = (campo, valor) => {
		setPeriodoSelecionado(null);
		if (campo === 'de') setRascunhoDe(valor);
		else setRascunhoAte(valor);
		setPendente(true);
	};

	const aplicar = () => {
		const params = computarParams();
		setFiltrosAplicados(params);
		carregarDados(params);
		setPendente(false);
		setPeriodoAplicado(periodoSelecionado); // null se datas customizadas
	};

	const discriminar = (infoKey) => {
		const cfg = KPI_FILTROS[infoKey];
		const q = new URLSearchParams({ origemDashboard: '1' });
		if (cfg.natureza) q.set('natureza', cfg.natureza);
		if (cfg.apenas_abertos) q.set('apenas_abertos', cfg.apenas_abertos);
		if (cfg.apenas_vencidos) q.set('apenas_vencidos', cfg.apenas_vencidos);
		if (cfg.apenas_quitados) q.set('apenas_quitados', cfg.apenas_quitados);
		if (cfg.estorno) q.set('estorno', cfg.estorno);
		if (cfg.usarData && filtrosAplicados.data_pagamento_de)
			q.set('data_pagamento_de', filtrosAplicados.data_pagamento_de);
		if (cfg.usarData && filtrosAplicados.data_pagamento_ate)
			q.set('data_pagamento_ate', filtrosAplicados.data_pagamento_ate);
		navigate(`/lancamentos?${q.toString()}`);
	};

	if (carregando)
		return (
			<div className="dash-container">
				<div className="dash-loading">
					<i className="bi bi-arrow-repeat" /> Carregando dados...
				</div>
			</div>
		);
	if (erro)
		return (
			<div className="dash-container">
				<div className="dash-erro">
					<i className="bi bi-exclamation-triangle" />
					{erro}
				</div>
			</div>
		);

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
					<span className="dash-periodo__label">Data de pagamento</span>
					{PERIODOS.map((p, i) => (
						<button
							key={i}
							className={`dash-periodo__btn${
								periodoSelecionado === i
									? pendente
										? ' dash-periodo__btn--pendente'
										: ' dash-periodo__btn--ativo'
									: ''
							}`}
							onClick={() => handlePeriodoRapido(i)}
						>
							{p.label}
						</button>
					))}
				</div>
				<div className="dash-periodo__livre">
					<input
						type="month"
						value={rascunhoDe}
						onChange={(e) => handleDataChange('de', e.target.value)}
						className="dash-periodo__input"
					/>
					<span className="dash-periodo__sep">até</span>
					<input
						type="month"
						value={rascunhoAte}
						onChange={(e) => handleDataChange('ate', e.target.value)}
						className="dash-periodo__input"
					/>
					<button
						onClick={aplicar}
						className={`dash-periodo__btn${pendente ? ' dash-periodo__btn--pendente' : ' dash-periodo__btn--ativo'}`}
						title="Aplicar filtros"
					>
						{pendente ? '⚠ Aplicar' : 'Aplicar'}
					</button>
				</div>
			</div>

			{/* ── KPIs realizados ── */}
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

			{/* ── KPIs pendentes ── */}
			<div className="dash-kpi-grid">
				<KpiCard
					infoKey="a_receber"
					icon="bi-hourglass-split"
					iconClass="dash-kpi-card__icon--receita"
					label="Total a Receber"
					value={formatarValor(resumo?.total_a_receber)}
					valueClass="dash-kpi-card__value--positivo"
					onDiscriminar={() => discriminar('a_receber')}
				/>
				<KpiCard
					infoKey="a_pagar"
					icon="bi-hourglass-split"
					iconClass="dash-kpi-card__icon--despesa"
					label="Total a Pagar"
					value={formatarValor(resumo?.total_a_pagar)}
					valueClass="dash-kpi-card__value--negativo"
					onDiscriminar={() => discriminar('a_pagar')}
				/>
				<KpiCard
					infoKey="inadimplencia"
					icon="bi-person-x"
					iconClass="dash-kpi-card__icon--inadimplente"
					label="Total Inadimplência"
					value={formatarValor(resumo?.total_inadimplencia)}
					valueClass="dash-kpi-card__value--negativo"
					onDiscriminar={() => discriminar('inadimplencia')}
				/>
				<KpiCard
					infoKey="inadimplentes"
					icon="bi-exclamation-circle"
					iconClass="dash-kpi-card__icon--inadimplente"
					label="Inadimplentes"
					value={resumo?.quantidade_inadimplentes ?? 0}
					onDiscriminar={() => discriminar('inadimplentes')}
				/>
			</div>

			{/* ── Rankings ── */}
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
		</div>
	);
}

export default Dashboard;
