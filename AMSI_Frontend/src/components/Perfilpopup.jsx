import { useState, useEffect } from 'react';
import {
	getCliforDoUsuario,
	getSugestaoClifor,
	associarCliforAoUsuario,
	desvincularCliforDoUsuario
} from '../services/api.js';
import ModalConfirm from './ModalConfirm.jsx';

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
		maxWidth: 560,
		maxHeight: '88vh',
		overflowY: 'auto',
		padding: '32px 36px',
		boxShadow: '0 16px 48px var(--shadow)'
	},
	header: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20
	},
	title: {
		fontFamily: 'var(--font-display)',
		fontSize: '1.25rem',
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
		padding: '2px 6px',
		borderRadius: 6
	},
	divider: { border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' },
	label: { fontWeight: 600, color: 'var(--text)' },
	muted: { fontSize: 13, color: 'var(--text-muted)' },
	sectionTitle: { fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)', marginBottom: 10 },
	fieldRow: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 6
	},
	fieldLabel: { fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 },
	fieldValue: { fontSize: 13, color: 'var(--text)' },
	rasura: {
		fontSize: 13,
		color: 'var(--text-muted)',
		background: 'var(--border)',
		borderRadius: 4,
		padding: '2px 8px',
		letterSpacing: 2,
		cursor: 'pointer',
		userSelect: 'none'
	},
	input: {
		width: '100%',
		padding: '8px 12px',
		borderRadius: 8,
		border: '1px solid var(--border)',
		background: 'var(--input-bg)',
		color: 'var(--text)',
		fontSize: '0.875rem',
		marginBottom: 8,
		outline: 'none',
		boxSizing: 'border-box'
	},
	btnPrimary: {
		padding: '8px 18px',
		borderRadius: 8,
		border: 'none',
		background: 'var(--primary)',
		color: '#fff',
		fontWeight: 600,
		cursor: 'pointer',
		fontSize: '0.875rem'
	},
	btnSecondary: {
		padding: '8px 18px',
		borderRadius: 8,
		border: '1px solid var(--border)',
		background: 'transparent',
		color: 'var(--text)',
		fontWeight: 500,
		cursor: 'pointer',
		fontSize: '0.875rem'
	},
	sugestaoItem: {
		padding: '8px 12px',
		borderRadius: 8,
		border: '1px solid var(--border)',
		background: 'var(--bg)',
		cursor: 'pointer',
		marginBottom: 6,
		fontSize: 13,
		color: 'var(--text)',
		transition: 'background 0.15s'
	},
	badge: (ok) => ({
		display: 'inline-block',
		padding: '2px 8px',
		borderRadius: 50,
		fontSize: 11,
		fontWeight: 600,
		background: ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)',
		color: ok ? '#16a34a' : '#dc2626'
	})
};

function CampoRasurado({ valor, label }) {
	const [visivel, setVisivel] = useState(false);
	return (
		<div style={s.fieldRow}>
			<span style={s.fieldLabel}>{label}</span>
			{visivel ? (
				<span style={{ ...s.fieldValue, cursor: 'pointer' }} onClick={() => setVisivel(false)}>
					{valor}
				</span>
			) : (
				<span style={s.rasura} onClick={() => setVisivel(true)} title="Clique para exibir">
					••••••••
				</span>
			)}
		</div>
	);
}

function PerfilCompletoPopup({ usuario, onFechar }) {
	const [clifor, setClifor] = useState(null);
	const [carregando, setCarregando] = useState(true);
	const [semClifor, setSemClifor] = useState(false);

	// Associação
	const [busca, setBusca] = useState('');
	const [sugestoes, setSugestoes] = useState([]);
	const [carregandoSugestao, setCarregandoSugestao] = useState(false);
	const [erroAssoc, setErroAssoc] = useState('');
	const [associando, setAssociando] = useState(false);

	useEffect(() => {
		carregarClifor();
	}, [usuario.id_usuario]);

	async function carregarClifor() {
		setCarregando(true);
		try {
			const data = await getCliforDoUsuario(usuario.id_usuario);
			setClifor(data);
			setSemClifor(false);
		} catch (err) {
			if (err.message?.includes('404') || err.message?.includes('vinculado')) {
				setSemClifor(true);
				carregarSugestoes('');
			}
		} finally {
			setCarregando(false);
		}
	}

	async function carregarSugestoes(nome) {
		setCarregandoSugestao(true);
		try {
			const data = await getSugestaoClifor(usuario.id_usuario, nome || null);
			setSugestoes(Array.isArray(data) ? data : []);
		} catch {
			setSugestoes([]);
		} finally {
			setCarregandoSugestao(false);
		}
	}

	const handleBuscaChange = (e) => {
		setBusca(e.target.value);
		carregarSugestoes(e.target.value);
	};

	const handleAssociar = async (id_clifor) => {
		setAssociando(true);
		setErroAssoc('');
		try {
			await associarCliforAoUsuario(usuario.id_usuario, id_clifor);
			await carregarClifor();
		} catch (err) {
			setErroAssoc(err.message || 'Erro ao associar');
		} finally {
			setAssociando(false);
		}
	};

	const formatData = (str) => {
		if (!str) return '—';
		// date string YYYY-MM-DD
		if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
			const [y, m, d] = str.split('-');
			return `${d}/${m}/${y}`;
		}
		return str;
	};

	return (
		<div style={s.overlay} onClick={onFechar}>
			<div style={s.box} onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div style={s.header}>
					<h5 style={s.title}>Perfil Completo — {usuario.nome}</h5>
					<button style={s.closeBtn} onClick={onFechar}>
						✕
					</button>
				</div>

				{/* Dados do usuário */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
					<div style={s.fieldRow}>
						<span style={s.fieldLabel}>Email</span>
						<span style={s.fieldValue}>{usuario.email}</span>
					</div>
					<div style={s.fieldRow}>
						<span style={s.fieldLabel}>Cargo</span>
						<span style={s.fieldValue}>{usuario.cargo}</span>
					</div>
					<div style={s.fieldRow}>
						<span style={s.fieldLabel}>Perfil</span>
						<span style={s.fieldValue}>{usuario.perfil_de_acesso}</span>
					</div>
					<div style={s.fieldRow}>
						<span style={s.fieldLabel}>Status</span>
						<span style={s.badge(!usuario.bloqueado)}>
							{usuario.bloqueado ? 'Bloqueado' : 'Ativo'}
						</span>
					</div>
				</div>

				<hr style={s.divider} />

				{/* Clifor */}
				{carregando ? (
					<p style={{ ...s.muted, textAlign: 'center' }}>Carregando...</p>
				) : semClifor ? (
					<>
						<p style={{ ...s.sectionTitle, color: 'var(--text-muted)' }}>
							Nenhum Cliente/Fornecedor vinculado.
						</p>
						<p style={{ ...s.sectionTitle, marginBottom: 6 }}>Associar a um Cliente/Fornecedor?</p>
						<input
							style={s.input}
							placeholder="Buscar por nome..."
							value={busca}
							onChange={handleBuscaChange}
						/>
						{carregandoSugestao ? (
							<p style={s.muted}>Buscando...</p>
						) : sugestoes.length === 0 ? (
							<p style={s.muted}>Nenhum resultado.</p>
						) : (
							sugestoes.map((c) => (
								<div
									key={c.id_clifor}
									style={s.sugestaoItem}
									onClick={() => !associando && handleAssociar(c.id_clifor)}
								>
									<strong>{c.nome}</strong>
									<span style={{ ...s.muted, marginLeft: 8 }}>
										{c.tipo_clifor === 'C'
											? 'Cliente'
											: c.tipo_clifor === 'F'
												? 'Fornecedor'
												: 'Ambos'}
									</span>
								</div>
							))
						)}
						{erroAssoc && (
							<p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{erroAssoc}</p>
						)}
					</>
				) : clifor ? (
					<>
						<p style={s.sectionTitle}>Cliente / Fornecedor Vinculado</p>
						<div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
							<div style={s.fieldRow}>
								<span style={s.fieldLabel}>Nome</span>
								<span style={s.fieldValue}>{clifor.nome}</span>
							</div>
							<div style={s.fieldRow}>
								<span style={s.fieldLabel}>Tipo</span>
								<span style={s.fieldValue}>
									{clifor.tipo_clifor === 'C'
										? 'Cliente'
										: clifor.tipo_clifor === 'F'
											? 'Fornecedor'
											: 'Ambos'}
								</span>
							</div>
							<div style={s.fieldRow}>
								<span style={s.fieldLabel}>Data de Nascimento</span>
								<span style={s.fieldValue}>{formatData(clifor.datanascimento)}</span>
							</div>
							<CampoRasurado valor={clifor.cpf_cnpj} label="CPF / CNPJ" />
							<CampoRasurado valor={clifor.rg_inscricaoestadual} label="RG / Insc. Estadual" />
							<div style={s.fieldRow}>
								<span style={s.fieldLabel}>Inadimplente</span>
								<span style={s.badge(!clifor.inadimplente)}>
									{clifor.inadimplente ? 'Sim' : 'Não'}
								</span>
							</div>
						</div>

						{/* Endereços */}
						{clifor.enderecos?.length > 0 && (
							<>
								<hr style={s.divider} />
								<p style={s.sectionTitle}>Endereços</p>
								{clifor.enderecos.map((e) => (
									<div
										key={e.id_endereco}
										style={{
											marginBottom: 12,
											paddingBottom: 12,
											borderBottom: '1px solid var(--border)'
										}}
									>
										<div style={s.fieldRow}>
											<span style={s.fieldLabel}>Logradouro</span>
											<CampoRasurado
												valor={`${e.logradouro}, ${e.numero}${e.complemento ? ` — ${e.complemento}` : ''}`}
												label=""
											/>
										</div>
										<div style={s.fieldRow}>
											<span style={s.fieldLabel}>Bairro</span>
											<CampoRasurado valor={e.bairro} label="" />
										</div>
										<div style={s.fieldRow}>
											<span style={s.fieldLabel}>Cidade / UF</span>
											<span style={s.fieldValue}>
												{e.cidade} — {e.uf}
											</span>
										</div>
										<div style={s.fieldRow}>
											<span style={s.fieldLabel}>CEP</span>
											<CampoRasurado valor={e.cep} label="" />
										</div>
										{e.enderecoprimario && <span style={s.badge(true)}>Principal</span>}
									</div>
								))}
							</>
						)}

						{/* Contatos */}
						{clifor.contatos?.length > 0 && (
							<>
								<hr style={s.divider} />
								<p style={s.sectionTitle}>Contatos</p>
								{clifor.contatos.map((c) => (
									<div
										key={c.id_contato}
										style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}
									>
										<span style={s.fieldLabel}>{c.tipocontato}</span>
										<CampoRasurado valor={c.info_do_contato} label="" />
									</div>
								))}
							</>
						)}
					</>
				) : null}

				<hr style={s.divider} />
				<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
					<button style={s.btnSecondary} onClick={onFechar}>
						Fechar
					</button>
				</div>
			</div>
		</div>
	);
}

export default PerfilCompletoPopup;
