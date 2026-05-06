import { useState, useEffect } from 'react';
import { getLancamentosPorUsuario, getLoginsPorUsuario, trocarSenha } from '../services/api';

const s = {
	overlay: {
		position: 'fixed',
		inset: 0,
		background: 'rgba(0,0,0,0.55)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 9990,
		animation: 'fadeIn 0.2s ease'
	},
	box: {
		background: 'var(--bg-card)',
		color: 'var(--text)',
		borderRadius: 14,
		width: '100%',
		maxWidth: 520,
		maxHeight: '88vh',
		overflowY: 'auto',
		padding: '32px 36px',
		boxShadow: '0 16px 48px var(--shadow)',
		animation: 'fadeInDown 0.25s ease'
	},
	header: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20
	},
	title: {
		fontFamily: 'var(--font-display)',
		fontSize: '1.35rem',
		fontWeight: 700,
		color: 'var(--primary)',
		margin: 0
	},
	closeBtn: {
		background: 'transparent',
		border: 'none',
		cursor: 'pointer',
		fontSize: '1.2rem',
		color: 'var(--text-muted)',
		lineHeight: 1,
		padding: '2px 6px',
		borderRadius: 6
	},
	divider: {
		border: 'none',
		borderTop: '1px solid var(--border)',
		margin: '16px 0'
	},
	label: {
		fontWeight: 600,
		color: 'var(--text)'
	},
	muted: {
		fontSize: 13,
		color: 'var(--text-muted)'
	},
	statBox: (highlight) => ({
		flex: 1,
		textAlign: 'center',
		padding: '10px 8px',
		borderRadius: 10,
		background: highlight ? 'var(--accent)' : 'var(--bg)'
	}),
	statNum: {
		fontSize: 22,
		fontWeight: 700,
		color: 'var(--text)'
	},
	statLabel: {
		fontSize: 12,
		color: 'var(--text-muted)',
		marginTop: 2
	},
	input: {
		width: '100%',
		padding: '8px 12px',
		borderRadius: 8,
		border: '1px solid var(--border)',
		background: 'var(--input-bg)',
		color: 'var(--text)',
		fontSize: '0.875rem',
		marginBottom: 10,
		outline: 'none'
	},
	btnPrimary: {
		flex: 1,
		padding: '9px 0',
		borderRadius: 8,
		border: 'none',
		background: 'var(--primary)',
		color: '#fff',
		fontWeight: 600,
		cursor: 'pointer',
		fontSize: '0.875rem'
	},
	btnSecondary: {
		flex: 1,
		padding: '9px 0',
		borderRadius: 8,
		border: '1px solid var(--border)',
		background: 'transparent',
		color: 'var(--text)',
		fontWeight: 500,
		cursor: 'pointer',
		fontSize: '0.875rem'
	},
	btnOutline: {
		width: '100%',
		padding: '9px 0',
		borderRadius: 8,
		border: '1px solid var(--border)',
		background: 'transparent',
		color: 'var(--text)',
		fontWeight: 500,
		cursor: 'pointer',
		fontSize: '0.875rem'
	},
	badge: (credito) => ({
		display: 'inline-block',
		padding: '2px 8px',
		borderRadius: 50,
		fontSize: 11,
		fontWeight: 600,
		background: credito ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)',
		color: credito ? '#16a34a' : '#dc2626'
	}),
	th: {
		fontSize: 12,
		fontWeight: 600,
		color: 'var(--text-muted)',
		padding: '6px 8px',
		borderBottom: '1px solid var(--border)',
		textAlign: 'left'
	},
	td: {
		fontSize: 13,
		color: 'var(--text)',
		padding: '6px 8px',
		borderBottom: '1px solid var(--border)'
	}
};

function PerfilPopup({ onFechar }) {
	const usuarioLocal = JSON.parse(localStorage.getItem('user') || 'null');
	const idUsuario = usuarioLocal?.id_usuario;

	const [lancamentos, setLancamentos] = useState([]);
	const [ultimoLogin, setUltimoLogin] = useState(null);
	const [carregando, setCarregando] = useState(true);

	const [trocandoSenha, setTrocandoSenha] = useState(false);
	const [senhaAtual, setSenhaAtual] = useState('');
	const [senhaNova, setSenhaNova] = useState('');
	const [senhaConfirm, setSenhaConfirm] = useState('');
	const [erroSenha, setErroSenha] = useState('');
	const [sucessoSenha, setSucessoSenha] = useState('');

	useEffect(() => {
		if (!idUsuario) return;
		Promise.all([
			getLancamentosPorUsuario(idUsuario).catch(() => []),
			getLoginsPorUsuario(idUsuario).catch(() => [])
		]).then(([lancs, logins]) => {
			setLancamentos(Array.isArray(lancs) ? lancs : []);
			if (Array.isArray(logins) && logins.length > 0) {
				const sorted = [...logins].sort((a, b) => new Date(b.data_login) - new Date(a.data_login));
				setUltimoLogin(sorted[0]);
			}
			setCarregando(false);
		});
	}, [idUsuario]);

	const abertos = lancamentos.filter((l) => !l.data_pagamento && !l.estorno);
	const fechados = lancamentos.filter((l) => l.data_pagamento || l.estorno);
	const valorEmAberto = abertos.reduce((acc, l) => acc + parseFloat(l.valor || 0), 0);

	const handleTrocarSenha = async (e) => {
		e.preventDefault();
		setErroSenha('');
		setSucessoSenha('');
		if (senhaNova !== senhaConfirm) {
			setErroSenha('As senhas não coincidem.');
			return;
		}
		try {
			await trocarSenha({ senha_atual: senhaAtual, nova_senha: senhaNova });
			setSucessoSenha('Senha alterada com sucesso!');
			setSenhaAtual('');
			setSenhaNova('');
			setSenhaConfirm('');
			setTimeout(() => setTrocandoSenha(false), 1500);
		} catch (err) {
			setErroSenha(err.message || 'Erro ao trocar senha.');
		}
	};

	const formatData = (str) => {
		if (!str) return '—';
		return new Date(str).toLocaleString('pt-BR');
	};

	const formatValor = (v) =>
		parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

	return (
		<div onClick={onFechar} style={s.overlay}>
			<div onClick={(e) => e.stopPropagation()} style={s.box}>
				{/* Header */}
				<div style={s.header}>
					<h5 style={s.title}>Meu Perfil</h5>
					<button style={s.closeBtn} onClick={onFechar}>
						✕
					</button>
				</div>

				{/* Dados do usuário */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
					<p style={{ margin: 0 }}>
						<span style={s.label}>Nome:</span> {usuarioLocal?.nome || '—'}
					</p>
					<p style={{ margin: 0 }}>
						<span style={s.label}>Email:</span> {usuarioLocal?.email || '—'}
					</p>
					<p style={{ margin: 0 }}>
						<span style={s.label}>Cargo:</span> {usuarioLocal?.cargo || '—'}
					</p>
					<p style={{ margin: 0 }}>
						<span style={s.label}>Perfil:</span> {usuarioLocal?.perfil_de_acesso || '—'}
					</p>
					{ultimoLogin && (
						<p style={{ margin: 0, ...s.muted }}>
							<span style={s.label}>Último login:</span> {formatData(ultimoLogin.data_login)}
						</p>
					)}
				</div>

				<hr style={s.divider} />

				{/* Resumo lançamentos */}
				{carregando ? (
					<p style={{ ...s.muted, textAlign: 'center' }}>Carregando lançamentos...</p>
				) : (
					<>
						<p style={{ fontWeight: 600, marginBottom: 10, color: 'var(--text)' }}>
							Resumo de Lançamentos
						</p>
						<div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
							<div style={s.statBox(false)}>
								<div style={s.statNum}>{abertos.length}</div>
								<div style={s.statLabel}>Em aberto</div>
							</div>
							<div style={s.statBox(false)}>
								<div style={s.statNum}>{fechados.length}</div>
								<div style={s.statLabel}>Fechados</div>
							</div>
							<div style={s.statBox(true)}>
								<div style={{ ...s.statNum, fontSize: 16 }}>{formatValor(valorEmAberto)}</div>
								<div style={s.statLabel}>Total em aberto</div>
							</div>
						</div>

						{abertos.length > 0 && (
							<>
								<p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
									Lançamentos em Aberto
								</p>
								<div
									style={{
										maxHeight: 180,
										overflowY: 'auto',
										borderRadius: 8,
										border: '1px solid var(--border)'
									}}
								>
									<table style={{ width: '100%', borderCollapse: 'collapse' }}>
										<thead>
											<tr>
												<th style={s.th}>Vencimento</th>
												<th style={s.th}>Valor</th>
												<th style={s.th}>Natureza</th>
											</tr>
										</thead>
										<tbody>
											{abertos.map((l) => (
												<tr key={l.id_lancamento}>
													<td style={s.td}>
														{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}
													</td>
													<td style={s.td}>{formatValor(l.valor)}</td>
													<td style={s.td}>
														<span style={s.badge(l.natureza_lancamento === 'Credito')}>
															{l.natureza_lancamento}
														</span>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</>
						)}
					</>
				)}

				<hr style={s.divider} />

				{/* Trocar senha */}
				{!trocandoSenha ? (
					<button style={s.btnOutline} onClick={() => setTrocandoSenha(true)}>
						Trocar Senha
					</button>
				) : (
					<form onSubmit={handleTrocarSenha}>
						<p style={{ fontWeight: 600, marginBottom: 10, color: 'var(--text)' }}>Trocar Senha</p>
						<input
							style={s.input}
							type="password"
							placeholder="Senha atual"
							value={senhaAtual}
							onChange={(e) => setSenhaAtual(e.target.value)}
							required
						/>
						<input
							style={s.input}
							type="password"
							placeholder="Nova senha"
							value={senhaNova}
							onChange={(e) => setSenhaNova(e.target.value)}
							required
						/>
						<input
							style={s.input}
							type="password"
							placeholder="Confirmar nova senha"
							value={senhaConfirm}
							onChange={(e) => setSenhaConfirm(e.target.value)}
							required
						/>
						{erroSenha && (
							<p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{erroSenha}</p>
						)}
						{sucessoSenha && (
							<p style={{ color: '#16a34a', fontSize: 13, marginBottom: 8 }}>{sucessoSenha}</p>
						)}
						<div style={{ display: 'flex', gap: 8 }}>
							<button type="submit" style={s.btnPrimary}>
								Salvar
							</button>
							<button type="button" style={s.btnSecondary} onClick={() => setTrocandoSenha(false)}>
								Cancelar
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}

export default PerfilPopup;
