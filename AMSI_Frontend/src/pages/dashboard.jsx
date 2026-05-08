import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getLancamentos, getSaldosClifors, getClifors } from '../services/api';
import '../styles/dashboard.css';

/*
  Dashboard.jsx — Painel administrativo financeiro
  Exibe KPIs de receita, despesa, saldo e inadimplência.
  Toda a lógica de dados foi preservada — apenas o JSX foi
  refatorado para usar as classes do dashboard.css.
*/

// Formata valor monetário: R$ 1.234,56
function formatarValor(v) {
	if (v == null || isNaN(v)) return 'R$ 0,00';
	return `R$ ${parseFloat(v)
		.toFixed(2)
		.replace('.', ',')
		.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

// Formata data ISO para DD/MM/AAAA
function formatarData(iso) {
	if (!iso) return '—';
	return iso.split('T')[0].split('-').reverse().join('/');
}

function Dashboard() {
	const [lancamentos, setLancamentos] = useState([]);
	const [saldos, setSaldos] = useState([]);
	const [clifors, setClifors] = useState([]);
	const [carregando, setCarregando] = useState(true);
	const [erro, setErro] = useState('');

	useEffect(() => {
		carregarDados();
	}, []);

	const carregarDados = async () => {
		setCarregando(true);
		setErro('');
		try {
			const [ls, ss, cs] = await Promise.all([
				getLancamentos({}),
				getSaldosClifors(),
				getClifors(),
			]);
			setLancamentos(ls);
			setSaldos(Array.isArray(ss) ? ss : []);
			setClifors(Array.isArray(cs) ? cs : []);
		} catch (err) {
			setErro(err.message || 'Erro ao carregar dados do dashboard.');
		} finally {
			setCarregando(false);
		}
	};

	// ── Cálculos dos KPIs ──
	const hoje = new Date().toISOString().split('T')[0];

	const totalReceita = lancamentos
		.filter((l) => l.natureza_lancamento === 'Credito' && l.data_pagamento)
		.reduce((acc, l) => acc + parseFloat(l.valor_pago ?? l.valor ?? 0), 0);

	const totalDespesa = lancamentos
		.filter((l) => l.natureza_lancamento === 'Debito' && l.data_pagamento)
		.reduce((acc, l) => acc + parseFloat(l.valor_pago ?? l.valor ?? 0), 0);

	const saldoLiquido = totalReceita - totalDespesa;

	const inadimplentes = clifors.filter((c) => c.inadimplente);

	const lancamentosVencidos = lancamentos.filter(
		(l) => !l.data_pagamento && !l.estorno && l.data_vencimento < hoje
	);

	// ── Estado de carregamento ──
	if (carregando) {
		return (
			<div className="dash-container">
				<div className="dash-loading">
					<i className="bi bi-arrow-repeat" />
					Carregando dados...
				</div>
			</div>
		);
	}

	// ── Estado de erro ──
	if (erro) {
		return (
			<div className="dash-container">
				<div className="dash-erro">
					<i className="bi bi-exclamation-triangle" />
					{erro}
				</div>
			</div>
		);
	}

	return (
		<div className="dash-container">

			{/* ════════════════════════
			    CABEÇALHO
			    ════════════════════════ */}
			<div className="dash-header">
				<div>
					<h1 className="dash-header__title">Dashboard</h1>
					<p className="dash-header__subtitle">
						Visão geral financeira da associação
					</p>
				</div>
				<button
					onClick={carregarDados}
					style={{
						background: 'transparent',
						border: '1px solid var(--border)',
						borderRadius: 8,
						padding: '7px 14px',
						color: 'var(--text-muted)',
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						gap: 6,
						fontSize: '0.82rem',
						transition: 'background 0.2s ease, color 0.2s ease',
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = 'var(--input-bg)';
						e.currentTarget.style.color = 'var(--text)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = 'transparent';
						e.currentTarget.style.color = 'var(--text-muted)';
					}}
				>
					<i className="bi bi-arrow-clockwise" />
					Atualizar
				</button>
			</div>

			{/* ════════════════════════
			    KPIs
			    ════════════════════════ */}
			<div className="dash-kpi-grid">

				{/* Receita */}
				<div className="dash-kpi-card">
					<div className="dash-kpi-card__icon dash-kpi-card__icon--receita">
						<i className="bi bi-arrow-down-circle" />
					</div>
					<span className="dash-kpi-card__label">Receita Recebida</span>
					<span className={`dash-kpi-card__value dash-kpi-card__value--positivo`}>
						{formatarValor(totalReceita)}
					</span>
				</div>

				{/* Despesa */}
				<div className="dash-kpi-card">
					<div className="dash-kpi-card__icon dash-kpi-card__icon--despesa">
						<i className="bi bi-arrow-up-circle" />
					</div>
					<span className="dash-kpi-card__label">Despesa Paga</span>
					<span className="dash-kpi-card__value dash-kpi-card__value--negativo">
						{formatarValor(totalDespesa)}
					</span>
				</div>

				{/* Saldo líquido */}
				<div className="dash-kpi-card">
					<div className="dash-kpi-card__icon dash-kpi-card__icon--saldo">
						<i className="bi bi-wallet2" />
					</div>
					<span className="dash-kpi-card__label">Saldo Líquido</span>
					<span className={`dash-kpi-card__value ${saldoLiquido >= 0 ? 'dash-kpi-card__value--positivo' : 'dash-kpi-card__value--negativo'}`}>
						{formatarValor(saldoLiquido)}
					</span>
				</div>

				{/* Inadimplentes */}
				<div className="dash-kpi-card">
					<div className="dash-kpi-card__icon dash-kpi-card__icon--inadimplente">
						<i className="bi bi-exclamation-circle" />
					</div>
					<span className="dash-kpi-card__label">Inadimplentes</span>
					<span className="dash-kpi-card__value">
						{inadimplentes.length}
					</span>
				</div>
			</div>

			{/* ════════════════════════
			    GRID DE SEÇÕES
			    ════════════════════════ */}
			<div className="dash-cols">

				{/* ── Lançamentos vencidos ── */}
				<div className="dash-section">
					<div className="dash-section__header">
						<h2 className="dash-section__title">
							<i className="bi bi-calendar-x me-2" style={{ color: 'var(--primary)' }} />
							Lançamentos Vencidos
						</h2>
						{lancamentosVencidos.length > 0 && (
							<span className="dash-section__badge">{lancamentosVencidos.length}</span>
						)}
					</div>

					{lancamentosVencidos.length === 0 ? (
						<p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
							<i className="bi bi-check-circle me-2" style={{ color: '#16a34a' }} />
							Nenhum lançamento vencido.
						</p>
					) : (
						<table className="dash-table">
							<thead>
								<tr>
									<th>Vencimento</th>
									<th>Valor</th>
									<th>Natureza</th>
								</tr>
							</thead>
							<tbody>
								{lancamentosVencidos.slice(0, 8).map((l) => (
									<tr key={l.id_lancamento}>
										<td>{formatarData(l.data_vencimento)}</td>
										<td className={l.natureza_lancamento === 'Credito' ? 'dash-valor--positivo' : 'dash-valor--negativo'}>
											{formatarValor(l.valor)}
										</td>
										<td>{l.natureza_lancamento}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}

					{lancamentosVencidos.length > 8 && (
						<div style={{ marginTop: 12, textAlign: 'right' }}>
							<Link
								to="/tipo_lancamento"
								style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
							>
								Ver todos ({lancamentosVencidos.length}) →
							</Link>
						</div>
					)}
				</div>

				{/* ── Clientes inadimplentes ── */}
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
											{c.tipo_clifor === 'C' ? 'Cliente'
												: c.tipo_clifor === 'F' ? 'Fornecedor'
												: 'Associado'}
										</td>
										<td>
											<span className="dash-badge-inadimplente">
												<i className="bi bi-exclamation-circle" />
												Inadimplente
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
								style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
							>
								Ver todos ({inadimplentes.length}) →
							</Link>
						</div>
					)}
				</div>
			</div>

			{/* ════════════════════════
			    SALDOS POR CLIFOR
			    ════════════════════════ */}
			{saldos.length > 0 && (
				<div className="dash-section">
					<div className="dash-section__header">
						<h2 className="dash-section__title">
							<i className="bi bi-people me-2" style={{ color: 'var(--primary)' }} />
							Saldo por Cliente / Fornecedor
						</h2>
						<span className="dash-section__badge">{saldos.length}</span>
					</div>

					<table className="dash-table">
						<thead>
							<tr>
								<th>Nome</th>
								<th>Saldo Líquido</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{saldos.map((s) => (
								<tr key={s.id_clifor}>
									<td style={{ fontWeight: 500 }}>{s.nome}</td>
									<td className={parseFloat(s.saldo_liquido) >= 0 ? 'dash-valor--positivo' : 'dash-valor--negativo'}>
										{formatarValor(s.saldo_liquido)}
									</td>
									<td>
										{s.inadimplente ? (
											<span className="dash-badge-inadimplente">
												<i className="bi bi-exclamation-circle" />
												Inadimplente
											</span>
										) : (
											<span style={{
												fontSize: '0.72rem',
												fontWeight: 600,
												padding: '2px 8px',
												borderRadius: '50px',
												background: 'rgba(34,197,94,0.1)',
												color: '#16a34a',
												border: '1px solid rgba(34,197,94,0.2)',
											}}>
												Regular
											</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

		</div>
	);
}

export default Dashboard;
