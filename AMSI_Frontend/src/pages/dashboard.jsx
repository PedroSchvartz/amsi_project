import { useState, useEffect, useCallback } from 'react';
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

function formatarData(iso) {
	if (!iso) return '—';
	return iso.split('T')[0].split('-').reverse().join('/');
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

function Dashboard() {
	const [resumo, setResumo] = useState(null);
	const [porTipoDespesa, setPorTipoDespesa] = useState([]);
	const [porTipoReceita, setPorTipoReceita] = useState([]);
	const [inadimplentes, setInadimplentes] = useState([]);
	const [lancamentosVencidos, setLancamentosVencidos] = useState([]);
	const [carregando, setCarregando] = useState(true);
	const [erro, setErro] = useState('');

	const [periodoAtivo, setPeriodoAtivo] = useState(1); // Últimos 6 meses por padrão
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
			const [res, despesas, receitas, clifors, saldos] = await Promise.all([
				getLancamentosResumo(params),
				getResumoPorTipo({ ...params, natureza: 'Debito' }),
				getResumoPorTipo({ ...params, natureza: 'Credito' }),
				getClifors({ inadimplente: true }),
				getSaldosClifors()
			]);
			setResumo(res);
			setPorTipoDespesa(despesas.slice(0, 5));
			setPorTipoReceita(receitas.slice(0, 5));
			setInadimplentes(clifors);

			// Lançamentos vencidos calculados a partir dos saldos não — precisamos de getLancamentos
			// Usamos o resumo para o count, lista vem de clifors inadimplentes
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
			{/* ── Cabeçalho ── */}
			<div className="dash-header">
				<div>
					<h1 className="dash-header__title">Dashboard</h1>
					<p className="dash-header__subtitle">Visão geral financeira da associação</p>
				</div>
				<button className="dash-btn-atualizar" onClick={carregarDados}>
					<i className="bi bi-arrow-clockwise" /> Atualizar
				</button>
			</div>

			{/* ── Seletor de período ── */}
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

			{/* ── KPIs ── */}
			<div className="dash-kpi-grid">
				<div className="dash-kpi-card">
					<div className="dash-kpi-card__icon dash-kpi-card__icon--receita">
						<i className="bi bi-arrow-down-circle" />
					</div>
					<span className="dash-kpi-card__label">Receita Recebida</span>
					<span className="dash-kpi-card__value dash-kpi-card__value--positivo">
						{formatarValor(resumo?.total_recebido)}
					</span>
				</div>

				<div className="dash-kpi-card">
					<div className="dash-kpi-card__icon dash-kpi-card__icon--despesa">
						<i className="bi bi-arrow-up-circle" />
					</div>
					<span className="dash-kpi-card__label">Despesa Paga</span>
					<span className="dash-kpi-card__value dash-kpi-card__value--negativo">
						{formatarValor(resumo?.total_pago)}
					</span>
				</div>

				<div className="dash-kpi-card">
					<div className="dash-kpi-card__icon dash-kpi-card__icon--saldo">
						<i className="bi bi-wallet2" />
					</div>
					<span className="dash-kpi-card__label">Saldo do Período</span>
					<span
						className={`dash-kpi-card__value ${parseFloat(resumo?.saldo_total ?? 0) >= 0 ? 'dash-kpi-card__value--positivo' : 'dash-kpi-card__value--negativo'}`}
					>
						{formatarValor(resumo?.saldo_total)}
					</span>
				</div>

				<div className="dash-kpi-card">
					<div className="dash-kpi-card__icon dash-kpi-card__icon--reembolso">
						<i className="bi bi-arrow-left-right" />
					</div>
					<span className="dash-kpi-card__label">Reembolsos</span>
					<span className="dash-kpi-card__value">{formatarValor(resumo?.total_reembolsado)}</span>
				</div>
			</div>

			{/* ── Pendências ── */}
			<div className="dash-kpi-grid">
				<div className="dash-kpi-card">
					<div className="dash-kpi-card__icon dash-kpi-card__icon--receita">
						<i className="bi bi-hourglass-split" />
					</div>
					<span className="dash-kpi-card__label">A Receber</span>
					<span className="dash-kpi-card__value dash-kpi-card__value--positivo">
						{formatarValor(resumo?.total_a_receber)}
					</span>
				</div>

				<div className="dash-kpi-card">
					<div className="dash-kpi-card__icon dash-kpi-card__icon--despesa">
						<i className="bi bi-hourglass-split" />
					</div>
					<span className="dash-kpi-card__label">A Pagar</span>
					<span className="dash-kpi-card__value dash-kpi-card__value--negativo">
						{formatarValor(resumo?.total_a_pagar)}
					</span>
				</div>

				<div className="dash-kpi-card">
					<div className="dash-kpi-card__icon dash-kpi-card__icon--inadimplente">
						<i className="bi bi-person-x" />
					</div>
					<span className="dash-kpi-card__label">A Receber (excl. inadimplentes)</span>
					<span className="dash-kpi-card__value dash-kpi-card__value--positivo">
						{formatarValor(resumo?.total_a_receber_excluindo_inadimplentes)}
					</span>
				</div>

				<div className="dash-kpi-card">
					<div className="dash-kpi-card__icon dash-kpi-card__icon--inadimplente">
						<i className="bi bi-exclamation-circle" />
					</div>
					<span className="dash-kpi-card__label">Inadimplentes</span>
					<span className="dash-kpi-card__value">{resumo?.quantidade_inadimplentes ?? 0}</span>
				</div>
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
