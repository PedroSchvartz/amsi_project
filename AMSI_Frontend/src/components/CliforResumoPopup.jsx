import { useState, useEffect } from 'react';
import { getCliforResumo } from '../services/api.js';
import { useToast } from './ToastStack.jsx';

const fmt = (val) =>
	Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const s = {
	overlay: {
		position: 'fixed',
		inset: 0,
		background: 'rgba(0,0,0,0.55)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 9990
	},
	box: {
		background: 'var(--bg-card)',
		color: 'var(--text)',
		borderRadius: 14,
		width: '100%',
		maxWidth: 460,
		maxHeight: '88vh',
		overflowY: 'auto',
		padding: '28px 32px',
		boxShadow: '0 16px 48px var(--shadow)'
	},
	header: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 20
	},
	title: {
		fontFamily: 'var(--font-display)',
		fontSize: '1.1rem',
		fontWeight: 700,
		color: 'var(--primary)',
		margin: 0,
		lineHeight: 1.3
	},
	subtitle: {
		fontSize: 12,
		color: 'var(--text-muted)',
		marginTop: 4,
		display: 'block'
	},
	closeBtn: {
		background: 'transparent',
		border: 'none',
		cursor: 'pointer',
		fontSize: '1.2rem',
		color: 'var(--text-muted)',
		padding: '2px 6px',
		borderRadius: 6,
		flexShrink: 0
	},
	cardsRow: {
		display: 'grid',
		gridTemplateColumns: '1fr 1fr',
		gap: 12,
		marginBottom: 12
	},
	card: (cor) => ({
		background:
			cor === 'verde'
				? 'rgba(74,222,128,0.1)'
				: cor === 'vermelho'
				? 'rgba(248,113,113,0.1)'
				: 'var(--input-bg)',
		border: `1px solid ${
			cor === 'verde'
				? 'rgba(74,222,128,0.3)'
				: cor === 'vermelho'
				? 'rgba(248,113,113,0.3)'
				: 'var(--border)'
		}`,
		borderRadius: 10,
		padding: '14px 16px'
	}),
	cardLabel: {
		fontSize: 11,
		fontWeight: 600,
		textTransform: 'uppercase',
		letterSpacing: '0.05em',
		color: 'var(--text-muted)',
		marginBottom: 5
	},
	cardValue: (cor) => ({
		fontSize: '1.1rem',
		fontWeight: 700,
		color: cor === 'verde' ? '#16a34a' : cor === 'vermelho' ? '#dc2626' : 'var(--text)'
	}),
	divider: { border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' },
	row: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
		fontSize: 13
	},
	label: { color: 'var(--text-muted)' },
	value: { fontWeight: 600, color: 'var(--text)' },
	valueRed: { fontWeight: 600, color: '#dc2626' },
	btnFechar: {
		padding: '8px 20px',
		borderRadius: 8,
		border: '1px solid var(--border)',
		background: 'transparent',
		color: 'var(--text)',
		fontWeight: 500,
		cursor: 'pointer',
		fontSize: '0.875rem'
	}
};

function CliforResumoPopup({ clifor, onFechar }) {
	const { mostrarToast } = useToast();
	const [resumo, setResumo] = useState(null);
	const [carregando, setCarregando] = useState(true);

	useEffect(() => {
		getCliforResumo(clifor.id_clifor)
			.then(setResumo)
			.catch((err) => mostrarToast(err.message || 'Erro ao carregar resumo', 'erro'))
			.finally(() => setCarregando(false));
	}, [clifor.id_clifor]);

	const saldoLiquido = resumo ? parseFloat(resumo.saldo_liquido) : 0;
	const corSaldo = saldoLiquido >= 0 ? 'verde' : 'vermelho';

	return (
		<div style={s.overlay} onClick={onFechar}>
			<div style={s.box} onClick={(e) => e.stopPropagation()}>
				{/* Cabeçalho */}
				<div style={s.header}>
					<div>
						<h5 style={s.title}>{clifor.nome}</h5>
						<span style={s.subtitle}>Resumo financeiro — lançamentos em aberto</span>
					</div>
					<button style={s.closeBtn} onClick={onFechar} title="Fechar">
						✕
					</button>
				</div>

				{carregando ? (
					<p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
						Carregando...
					</p>
				) : !resumo ? (
					<p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
						Sem dados disponíveis.
					</p>
				) : (
					<>
						{/* Cards A Receber / A Pagar */}
						<div style={s.cardsRow}>
							<div style={s.card('verde')}>
								<div style={s.cardLabel}>A Receber</div>
								<div style={s.cardValue('verde')}>{fmt(resumo.total_a_receber)}</div>
							</div>
							<div style={s.card('vermelho')}>
								<div style={s.cardLabel}>A Pagar</div>
								<div style={s.cardValue('vermelho')}>{fmt(resumo.total_a_pagar)}</div>
							</div>
						</div>

						{/* Saldo Líquido */}
						<div style={{ ...s.card(corSaldo), marginBottom: 16 }}>
							<div style={s.cardLabel}>Saldo Líquido</div>
							<div style={s.cardValue(corSaldo)}>{fmt(resumo.saldo_liquido)}</div>
						</div>

						<hr style={s.divider} />

						{/* Vencidos */}
						<div style={s.row}>
							<span style={s.label}>Vencido a receber</span>
							<span
								style={
									parseFloat(resumo.total_vencido_a_receber) > 0 ? s.valueRed : s.value
								}
							>
								{fmt(resumo.total_vencido_a_receber)}
							</span>
						</div>
						<div style={s.row}>
							<span style={s.label}>Vencido a pagar</span>
							<span
								style={
									parseFloat(resumo.total_vencido_a_pagar) > 0 ? s.valueRed : s.value
								}
							>
								{fmt(resumo.total_vencido_a_pagar)}
							</span>
						</div>

						<hr style={s.divider} />

						{/* Quantidades */}
						<div style={s.row}>
							<span style={s.label}>Lançamentos em aberto</span>
							<span style={s.value}>{resumo.quantidade_abertos}</span>
						</div>
						<div style={s.row}>
							<span style={s.label}>Lançamentos vencidos</span>
							<span style={resumo.quantidade_vencidos > 0 ? s.valueRed : s.value}>
								{resumo.quantidade_vencidos}
							</span>
						</div>
					</>
				)}

				<hr style={s.divider} />
				<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
					<button style={s.btnFechar} onClick={onFechar}>
						Fechar
					</button>
				</div>
			</div>
		</div>
	);
}

export default CliforResumoPopup;
