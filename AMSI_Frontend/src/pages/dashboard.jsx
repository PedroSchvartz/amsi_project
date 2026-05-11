import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
	getLancamentosResumo,
	getResumoPorTipo,
	getClifors,
	getSaldosClifors
} from '../services/api';
import '../styles/dashboard.css';

function formatarValor(v) {
	if (v == null || isNaN(v)) return 'R$ 0,00';
	return `R$ ${parseFloat(v)
		.toFixed(2)
		.replace('.', ',')
		.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

const hoje = new Date();
const PERIODOS = [
	{
		label: 'Último mês',
		de: () => {
			const d = new Date(hoje);
			d.setMonth(d.getMonth() - 1);
			return d.toISOString().split('T')[0];
		},
		ate: () => hoje.toISOString().split('T')[0]
	},
	{
		label: 'Últimos 6 meses',
		de: () => {
			const d = new Date(hoje);
			d.setMonth(d.getMonth() - 6);
			return d.toISOString().split('T')[0];
		},
		ate: () => hoje.toISOString().split('T')[0]
	},
	{
		label: 'Ano atual',
		de: () => `${hoje.getFullYear()}-01-01`,
		ate: () => hoje.toISOString().split('T')[0]
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
		titulo: 'Receita Recebida',
		descricao:
			'Soma de todos os lançamentos de natureza Crédito que foram quitados (com data de pagamento registrada) dentro do período selecionado. Inclui mensalidades, taxas e outras entradas confirmadas. Reembolsos são contabilizados separadamente e não entram neste valor.'
	},
	despesa_paga: {
		tooltip: 'Total de débitos efetivamente pagos no período.',
		titulo: 'Despesa Paga',
		descricao:
			'Soma de todos os lançamentos de natureza Débito que foram quitados (com data de pagamento registrada) dentro do período selecionado. Inclui contas de água, luz, manutenção e outros custos confirmados. Reembolsos não entram neste valor.'
	},
	saldo_periodo: {
		tooltip: 'Receita recebida menos despesa paga no período.',
		titulo: 'Saldo do Período',
		descricao:
			'Resultado líquido do período: Receita Recebida menos Despesa Paga. Um valor positivo indica superávit — a associação recebeu mais do que gastou. Um valor negativo indica déficit. Este saldo considera apenas lançamentos quitados e ignora reembolsos e lançamentos em aberto.'
	},
	reembolsos: {
		tooltip: 'Total devolvido a clientes ou fornecedores no período.',
		titulo: 'Reembolsos',
		descricao:
			'Soma de todos os lançamentos marcados como estorno que foram quitados no período. Um reembolso representa a devolução de um valor pago anteriormente — por exemplo, uma cobrança indevida que foi corrigida. Estes valores são contabilizados separadamente para não distorcer as métricas de receita e despesa.'
	},
	a_receber: {
		tooltip: 'Total de créditos em aberto, ainda não recebidos.',
		titulo: 'A Receber',
		descricao:
			'Soma de todos os lançamentos de natureza Crédito que ainda não foram pagos (sem data de pagamento) e não são estornos. Representa o valor que a associação tem a receber de clientes e associados, independentemente do período selecionado. Inclui tanto lançamentos dentro do prazo quanto vencidos.'
	},
	a_pagar: {
		tooltip: 'Total de débitos em aberto, ainda não pagos.',
		titulo: 'A Pagar',
		descricao:
			'Soma de todos os lançamentos de natureza Débito que ainda não foram pagos (sem data de pagamento) e não são estornos. Representa compromissos financeiros pendentes da associação com fornecedores e prestadores. Inclui tanto lançamentos dentro do prazo quanto vencidos.'
	},
	a_receber_excl: {
		tooltip: 'A receber considerando apenas clientes adimplentes.',
		titulo: 'A Receber (excl. inadimplentes)',
		descricao:
			'Soma de lançamentos de Crédito em aberto, excluindo aqueles vinculados a clientes ou associados marcados como inadimplentes. Este valor representa uma estimativa mais realista do que a associação tem chance concreta de receber, desconsiderando devedores com histórico de atraso.'
	},
	inadimplentes: {
		tooltip: 'Número de clientes com cobranças vencidas e não pagas.',
		titulo: 'Inadimplentes',
		descricao:
			'Quantidade de clientes/fornecedores marcados como inadimplentes no sistema. Um clifor é considerado inadimplente quando possui pelo menos um lançamento de Crédito vencido, não pago e não estornado. Esta marcação é atualizada automaticamente pelo sistema a cada criação, edição ou exclusão de lançamento.'
	}
};

// ── Componente KpiCard com tooltip e popup ──────────────────────────────────
function KpiCard({ infoKey, icon, iconClass, label, value, valueClass, children }) {
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
					</div>
				</div>
			)}
		</>
	);
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard() {
	const [resumo, setResumo] = useState(null);
	const [porTipoDespesa, setPorTipoDespesa] = useState([]);
	const [porTipoReceita, setPorTipoReceita] = useState([]);
	const [inadimplentes, setInadimplentes] = useState([]);
	const [carregando, setCarregando] = useState(true);
	const [erro, setErro] = useState('');

	const [periodoAtivo, setPeriodoAtivo] = useState(1);
	const [datasDe, setDatasDe] = useState('');
	const [datasAte, setDatasAte] = useState('');

	const periodoParams = useCallback(() => {
		if (datasDe || datasAte)
			return {
				data_pagamento_de: mesParaDia(datasDe, false),
				data_pagamento_ate: mesParaDia(datasAte, true)
			};
		if (periodoAtivo !== null) {
			const p = PERIODOS[periodoAtivo];
			const de = p.de();
			const ate = p.ate();
			const params = {};
			if (de) params.data_pagamento_de = de;
			if (ate) params.data_pagamento_ate = ate;
			return params;
		}
		return {};
	}, [periodoAtivo, datasDe, datasAte]);

	const carregarDados = useCallback(async () => {
		setCarregando(true);
		setErro('');
		try {
			const params = periodoParams();
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
			setErro(err.message || 'Erro ao carregar dados do dashboard.');
		} finally {
			setCarregando(false);
		}
	}, [periodoParams]);

	useEffect(() => {
		carregarDados();
	}, [carregarDados]);

	const handlePeriodoRapido = (idx) => {
		setPeriodoAtivo(idx);
		setDatasDe('');
		setDatasAte('');
	};
	const handleDataChange = (campo, valor) => {
		setPeriodoAtivo(null);
		if (campo === 'de') setDatasDe(valor);
		else setDatasAte(valor);
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
				<button className="dash-btn-atualizar" onClick={carregarDados}>
					<i className="bi bi-arrow-clockwise" /> Atualizar
				</button>
			</div>

			<div className="dash-periodo">
				<div className="dash-periodo__rapido">
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
						value={datasDe}
						onChange={(e) => handleDataChange('de', e.target.value)}
						className="dash-periodo__input"
					/>
					<span className="dash-periodo__sep">até</span>
					<input
						type="month"
						value={datasAte}
						onChange={(e) => handleDataChange('ate', e.target.value)}
						className="dash-periodo__input"
					/>
				</div>
			</div>

			{/* ── KPIs realizados ── */}
			<div className="dash-kpi-grid">
				<KpiCard
					infoKey="receita_recebida"
					icon="bi-arrow-down-circle"
					iconClass="dash-kpi-card__icon--receita"
					label="Receita Recebida"
					value={formatarValor(resumo?.total_recebido)}
					valueClass="dash-kpi-card__value--positivo"
				/>
				<KpiCard
					infoKey="despesa_paga"
					icon="bi-arrow-up-circle"
					iconClass="dash-kpi-card__icon--despesa"
					label="Despesa Paga"
					value={formatarValor(resumo?.total_pago)}
					valueClass="dash-kpi-card__value--negativo"
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
				/>
				<KpiCard
					infoKey="reembolsos"
					icon="bi-arrow-left-right"
					iconClass="dash-kpi-card__icon--reembolso"
					label="Reembolsos"
					value={formatarValor(resumo?.total_reembolsado)}
				/>
			</div>

			{/* ── KPIs pendentes ── */}
			<div className="dash-kpi-grid">
				<KpiCard
					infoKey="a_receber"
					icon="bi-hourglass-split"
					iconClass="dash-kpi-card__icon--receita"
					label="A Receber"
					value={formatarValor(resumo?.total_a_receber)}
					valueClass="dash-kpi-card__value--positivo"
				/>
				<KpiCard
					infoKey="a_pagar"
					icon="bi-hourglass-split"
					iconClass="dash-kpi-card__icon--despesa"
					label="A Pagar"
					value={formatarValor(resumo?.total_a_pagar)}
					valueClass="dash-kpi-card__value--negativo"
				/>
				<KpiCard
					infoKey="a_receber_excl"
					icon="bi-person-x"
					iconClass="dash-kpi-card__icon--inadimplente"
					label="A Receber (excl. inadimplentes)"
					value={formatarValor(resumo?.total_a_receber_excluindo_inadimplentes)}
					valueClass="dash-kpi-card__value--positivo"
				/>
				<KpiCard
					infoKey="inadimplentes"
					icon="bi-exclamation-circle"
					iconClass="dash-kpi-card__icon--inadimplente"
					label="Inadimplentes"
					value={resumo?.quantidade_inadimplentes ?? 0}
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
