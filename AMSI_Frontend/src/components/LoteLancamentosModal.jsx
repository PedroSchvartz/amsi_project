import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getLancamentos, fecharLancamento, editarLancamento, deleteLancamento } from '../services/api';
import { isAdmin, hasPerfilMinimo, getUserFromToken } from '../services/auth';
import { useToast } from './ToastStack.jsx';
import '../styles/clientList.css';
import '../styles/listaLancamentos.css';

function loteLabel(lote) {
	const d = new Date(lote);
	const dia = String(d.getDate()).padStart(2, '0');
	const mes = String(d.getMonth() + 1).padStart(2, '0');
	return `Lote ${dia}/${mes} #${String(lote).slice(-8)}`;
}

function formatarData(iso) {
	if (!iso) return '—';
	return iso.split('T')[0].split('-').reverse().join('/');
}

// Data de hoje no fuso local (YYYY-MM-DD) — toISOString viraria o dia seguinte em UTC-3 à noite.
function hojeLocal() {
	const d = new Date();
	const mes = String(d.getMonth() + 1).padStart(2, '0');
	const dia = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${mes}-${dia}`;
}

function formatarValor(v) {
	if (v == null) return '—';
	return parseFloat(v).toFixed(2).replace('.', ',');
}

function statusBadge(l) {
	if (l.estorno) return <span className="badge badge-estorno">Estorno</span>;
	if (l.data_pagamento) return <span className="badge badge-pago">Pago</span>;
	const hoje = new Date().toISOString().split('T')[0];
	if (l.data_vencimento < hoje) return <span className="badge badge-vencido">Vencido</span>;
	return <span className="badge badge-aberto">Aberto</span>;
}

const EFETIVAR_INICIAL = { data_pagamento: '', multa: '', juros: '', observacao_pagamento: '' };
const EDITAR_INICIAL = { id_tipo_conta_fk: '', valor: '', data_vencimento: '', observacao: '' };

const num = (s) => (s ? parseFloat(String(s).replace(',', '.')) : null);

/**
 * Modal "Lançamentos do lote": lista todos os lançamentos que compartilham um `lote`,
 * com seleção múltipla e ações em massa (efetivar / editar / excluir) sobre os selecionados.
 * Reaproveita os endpoints unitários existentes (um por lançamento), respeitando o RBAC de cada um.
 *
 * Props: lote, tiposConta (para o editar), onFechar(), onChanged() — chamado após qualquer mutação.
 */
function LoteLancamentosModal({ lote, tiposConta = [], refreshSignal, zIndex = 9997, onEditarUm, onEfetivarUm, onFechar, onChanged }) {
	const { mostrarToast } = useToast();
	const admin = isAdmin();
	const podeEfetivar = hasPerfilMinimo('Operador');
	const usuario = getUserFromToken();

	const [lancamentos, setLancamentos] = useState([]);
	const [loading, setLoading] = useState(true);
	const [marcados, setMarcados] = useState(new Set());
	const [acao, setAcao] = useState(null); // 'efetivar' | 'editar' | 'excluir'
	const [processando, setProcessando] = useState(false);
	const [formEfetivar, setFormEfetivar] = useState(EFETIVAR_INICIAL);
	const [formEditar, setFormEditar] = useState(EDITAR_INICIAL);
	const [verDetalhe, setVerDetalhe] = useState(null); // lançamento aberto em modo só-leitura

	const boxStyle = { padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem' };

	const carregar = async () => {
		try {
			setLoading(true);
			const data = await getLancamentos({ lote });
			setLancamentos(data);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao carregar o lote', 'erro');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		carregar();
	}, [lote, refreshSignal]);

	const toggle = (id) =>
		setMarcados((prev) => {
			const n = new Set(prev);
			if (n.has(id)) n.delete(id);
			else n.add(id);
			return n;
		});
	const selecionarTodos = () => setMarcados(new Set(lancamentos.map((l) => l.id_lancamento)));
	const limpar = () => setMarcados(new Set());

	const abrirAcao = (a) => {
		setFormEfetivar({ ...EFETIVAR_INICIAL, data_pagamento: hojeLocal() });
		setFormEditar(EDITAR_INICIAL);
		setAcao(a);
	};

	// Ação sobre um único lançamento (um por um): seleciona só ele e abre o formulário.
	const acaoUm = (l, a) => {
		setMarcados(new Set([l.id_lancamento]));
		abrirAcao(a);
	};

	// Excluir o lote inteiro de uma vez.
	const excluirTodos = () => {
		if (lancamentos.length === 0) return;
		setMarcados(new Set(lancamentos.map((x) => x.id_lancamento)));
		abrirAcao('excluir');
	};

	const executar = async (fnPorId, msgOk) => {
		const ids = [...marcados];
		if (ids.length === 0) return;
		setProcessando(true);
		const results = await Promise.allSettled(ids.map((id) => fnPorId(id)));
		setProcessando(false);
		const ok = results.filter((r) => r.status === 'fulfilled').length;
		const fail = results.length - ok;
		if (fail === 0) mostrarToast(`${ok} ${msgOk}`);
		else mostrarToast(`${ok} ${msgOk} · ${fail} falharam`, ok === 0 ? 'erro' : 'aviso');
		setMarcados(new Set());
		setAcao(null);
		await carregar();
		onChanged?.();
	};

	const confirmarExcluir = () => executar((id) => deleteLancamento(id), 'lançamento(s) excluído(s)');

	const confirmarEfetivar = async () => {
		if (!formEfetivar.data_pagamento) {
			mostrarToast('Informe a data de pagamento.', 'aviso');
			return;
		}
		const base = {
			id_usuario_fk_fechamento: usuario?.sub,
			data_pagamento: formEfetivar.data_pagamento,
			multa: num(formEfetivar.multa),
			juros: num(formEfetivar.juros),
			observacao_pagamento: formEfetivar.observacao_pagamento || null
		};
		await executar((id) => {
			const l = lancamentos.find((x) => x.id_lancamento === id);
			return fecharLancamento(id, { ...base, valor_pago: parseFloat(l.valor_pago ?? l.valor) });
		}, 'lançamento(s) efetivado(s)');
	};

	const confirmarEditar = async () => {
		const payload = {};
		if (formEditar.id_tipo_conta_fk) payload.id_tipo_conta_fk = parseInt(formEditar.id_tipo_conta_fk);
		if (formEditar.valor) payload.valor = num(formEditar.valor);
		if (formEditar.data_vencimento) payload.data_vencimento = formEditar.data_vencimento;
		if (formEditar.observacao !== '') payload.observacao = formEditar.observacao || null;
		if (Object.keys(payload).length === 0) {
			mostrarToast('Preencha ao menos um campo para alterar.', 'aviso');
			return;
		}
		await executar((id) => editarLancamento(id, payload), 'lançamento(s) editado(s)');
	};

	const n = marcados.size;

	return createPortal(
		<>
		<div className="popup-overlay" style={{ zIndex, padding: 20 }} onClick={onFechar}>
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					background: 'var(--bg-card)',
					border: '1px solid var(--border)',
					borderRadius: 14,
					width: '100%',
					maxWidth: 900,
					maxHeight: '88vh',
					display: 'flex',
					flexDirection: 'column',
					boxShadow: '0 16px 48px var(--shadow)'
				}}
			>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' }}>
					<h2 className="cl-title">Lançamentos do {loteLabel(lote)}</h2>
					<button type="button" className="lm-fechar" onClick={onFechar}>
						✕
					</button>
				</div>

				<div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
					{loading ? (
						<p className="cl-loading">Carregando...</p>
					) : lancamentos.length === 0 ? (
						<p className="cl-vazio">Nenhum lançamento neste lote.</p>
					) : (
						<div className="cl-table-wrapper">
							<table className="cl-table">
								<thead>
									<tr>
										<th style={{ width: 44 }} />
										<th>Cliente / Fornecedor</th>
										<th>Tipo</th>
										<th>Vencimento</th>
										<th>Valor</th>
										<th>Status</th>
										<th style={{ width: 120 }}>Ações</th>
									</tr>
								</thead>
								<tbody>
									{lancamentos.map((l) => (
										<tr key={l.id_lancamento} className="cl-row-clicavel" onClick={() => toggle(l.id_lancamento)}>
											<td>
												<input
													type="checkbox"
													checked={marcados.has(l.id_lancamento)}
													onChange={() => {}}
													style={{ width: 'auto', accentColor: 'var(--primary)', cursor: 'pointer' }}
												/>
											</td>
											<td>{l.nome_clifor || '—'}</td>
											<td>{l.descricao_tipo_conta || l.id_tipo_conta_fk}</td>
											<td>{formatarData(l.data_vencimento)}</td>
											<td>{formatarValor(l.valor)}</td>
											<td>{statusBadge(l)}</td>
											<td onClick={(e) => e.stopPropagation()}>
												<div className="ll-acoes">
													{!admin && (
														<button
															type="button"
															className="ll-btn-acao"
															title="Ver detalhes"
															onClick={() => setVerDetalhe(l)}
														>
															<i className="bi bi-eye" />
														</button>
													)}
													{!l.data_pagamento && !l.estorno && podeEfetivar && (
														<button
															type="button"
															className="ll-btn-acao fechar"
															title="Efetivar este lançamento"
															onClick={() => onEfetivarUm?.(l)}
														>
															<i className="bi bi-journal-check" />
														</button>
													)}
													{admin && (
														<button
															type="button"
															className="ll-btn-acao"
															title="Editar este lançamento"
															onClick={() => onEditarUm?.(l)}
														>
															<i className="bi bi-pencil" />
														</button>
													)}
													{admin && (
														<button
															type="button"
															className="ll-btn-acao"
															title="Excluir este lançamento"
															onClick={() => acaoUm(l, 'excluir')}
														>
															<i className="bi bi-trash" />
														</button>
													)}
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{acao === 'efetivar' && (
						<div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
							<h4 style={{ margin: '0 0 10px' }}>Efetivar {n} selecionado(s)</h4>
							<div className="ll-row">
								<div className="ll-field">
									<label>Data de Pagamento</label>
									<input
										type="date"
										value={formEfetivar.data_pagamento}
										onChange={(e) => setFormEfetivar({ ...formEfetivar, data_pagamento: e.target.value })}
									/>
								</div>
								<div className="ll-field">
									<label>Multa</label>
									<input
										type="text"
										inputMode="decimal"
										value={formEfetivar.multa}
										onChange={(e) => setFormEfetivar({ ...formEfetivar, multa: e.target.value.replace(/[^0-9,]/g, '') })}
										placeholder="0,00"
									/>
								</div>
								<div className="ll-field">
									<label>Juros</label>
									<input
										type="text"
										inputMode="decimal"
										value={formEfetivar.juros}
										onChange={(e) => setFormEfetivar({ ...formEfetivar, juros: e.target.value.replace(/[^0-9,]/g, '') })}
										placeholder="0,00"
									/>
								</div>
							</div>
							<div className="ll-field">
								<label>Observação do Pagamento</label>
								<textarea
									rows="2"
									value={formEfetivar.observacao_pagamento}
									onChange={(e) => setFormEfetivar({ ...formEfetivar, observacao_pagamento: e.target.value })}
								/>
							</div>
							<p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
								O valor pago de cada lançamento usa o próprio valor lançado.
							</p>
						</div>
					)}

					{acao === 'editar' && (
						<div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
							<h4 style={{ margin: '0 0 10px' }}>Editar {n} selecionado(s) — só os campos preenchidos serão aplicados</h4>
							<div className="ll-row">
								<div className="ll-field">
									<label>Tipo de Conta</label>
									<select
										value={formEditar.id_tipo_conta_fk}
										onChange={(e) => setFormEditar({ ...formEditar, id_tipo_conta_fk: e.target.value })}
									>
										<option value="">(manter)</option>
										{tiposConta.map((t) => (
											<option key={t.id_tipo_conta} value={t.id_tipo_conta}>
												{t.descricao_conta}
											</option>
										))}
									</select>
								</div>
								<div className="ll-field">
									<label>Valor</label>
									<input
										type="text"
										inputMode="decimal"
										value={formEditar.valor}
										onChange={(e) => setFormEditar({ ...formEditar, valor: e.target.value.replace(/[^0-9,]/g, '') })}
										placeholder="(manter)"
									/>
								</div>
								<div className="ll-field">
									<label>Vencimento</label>
									<input
										type="date"
										value={formEditar.data_vencimento}
										onChange={(e) => setFormEditar({ ...formEditar, data_vencimento: e.target.value })}
									/>
								</div>
							</div>
							<div className="ll-field">
								<label>Descrição</label>
								<textarea
									rows="2"
									value={formEditar.observacao}
									onChange={(e) => setFormEditar({ ...formEditar, observacao: e.target.value })}
									placeholder="(manter)"
								/>
							</div>
						</div>
					)}

					{acao === 'excluir' && (
						<div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
							<p style={{ color: '#dc2626', fontWeight: 600, margin: 0 }}>
								Excluir {n} lançamento(s) selecionado(s)? Esta ação não pode ser desfeita.
							</p>
						</div>
					)}
				</div>

				{lancamentos.length > 0 && (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 12,
						padding: '14px 24px',
						borderTop: '1px solid var(--border)',
						flexWrap: 'wrap'
					}}
				>
					{!acao ? (
						<>
							<button type="button" className="cl-btn-editar" onClick={selecionarTodos}>
								Selecionar todos
							</button>
							<button type="button" className="cl-btn-editar" onClick={limpar}>
								Limpar
							</button>
							{admin && (
								<button
									type="button"
									className="cl-btn-editar"
									style={{ color: '#dc2626', borderColor: '#dc2626' }}
									disabled={lancamentos.length === 0}
									onClick={excluirTodos}
								>
									Excluir todos
								</button>
							)}
							<span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
								{n} de {lancamentos.length} selecionados
							</span>
							<div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
								{podeEfetivar && (
									<button type="button" className="save" disabled={n === 0} onClick={() => abrirAcao('efetivar')}>
										Efetivar
									</button>
								)}
								{admin && (
									<button type="button" className="save" disabled={n === 0} onClick={() => abrirAcao('editar')}>
										Editar
									</button>
								)}
								{admin && (
									<button
										type="button"
										className="save"
										style={{ background: '#dc2626' }}
										disabled={n === 0}
										onClick={() => abrirAcao('excluir')}
									>
										Excluir
									</button>
								)}
							</div>
						</>
					) : (
						<div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
							<button type="button" className="cancel" disabled={processando} onClick={() => setAcao(null)}>
								Voltar
							</button>
							<button
								type="button"
								className="save"
								style={acao === 'excluir' ? { background: '#dc2626' } : {}}
								disabled={processando}
								onClick={acao === 'excluir' ? confirmarExcluir : acao === 'efetivar' ? confirmarEfetivar : confirmarEditar}
							>
								{processando
									? 'Processando...'
									: acao === 'excluir'
										? `Excluir ${n}`
										: acao === 'efetivar'
											? `Efetivar ${n}`
											: `Editar ${n}`}
							</button>
						</div>
					)}
				</div>
				)}
			</div>
		</div>
		{verDetalhe && (
			<div className="popup-overlay" style={{ zIndex: zIndex + 1, padding: 20 }} onClick={() => setVerDetalhe(null)}>
				<div
					onClick={(e) => e.stopPropagation()}
					style={{
						background: 'var(--bg-card)',
						border: '1px solid var(--border)',
						borderRadius: 14,
						width: '100%',
						maxWidth: 560,
						maxHeight: '88vh',
						overflowY: 'auto',
						boxShadow: '0 16px 48px var(--shadow)',
						padding: '20px 24px'
					}}
				>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
						<h3 style={{ margin: 0 }}>Detalhes do Lançamento #{verDetalhe.id_lancamento}</h3>
						<button type="button" className="lm-fechar" onClick={() => setVerDetalhe(null)}>
							✕
						</button>
					</div>
					<div className="ll-row">
						<div className="ll-field">
							<label>Cliente / Fornecedor</label>
							<div style={boxStyle}>{verDetalhe.nome_clifor || '—'}</div>
						</div>
						<div className="ll-field">
							<label>Tipo de Conta</label>
							<div style={boxStyle}>{verDetalhe.descricao_tipo_conta || verDetalhe.id_tipo_conta_fk}</div>
						</div>
					</div>
					<div className="ll-row">
						<div className="ll-field">
							<label>Natureza</label>
							<div style={boxStyle}>{verDetalhe.natureza_lancamento}</div>
						</div>
						<div className="ll-field">
							<label>Valor</label>
							<div style={boxStyle}>{formatarValor(verDetalhe.valor)}</div>
						</div>
					</div>
					<div className="ll-row">
						<div className="ll-field">
							<label>Vencimento</label>
							<div style={boxStyle}>{formatarData(verDetalhe.data_vencimento)}</div>
						</div>
						<div className="ll-field">
							<label>Status</label>
							<div style={{ padding: '4px 0' }}>{statusBadge(verDetalhe)}</div>
						</div>
					</div>
					{verDetalhe.data_pagamento && (
						<>
							<div className="ll-row">
								<div className="ll-field">
									<label>Data de Pagamento</label>
									<div style={boxStyle}>{formatarData(verDetalhe.data_pagamento)}</div>
								</div>
								<div className="ll-field">
									<label>Valor Pago</label>
									<div style={boxStyle}>{formatarValor(verDetalhe.valor_pago)}</div>
								</div>
							</div>
							{(verDetalhe.multa || verDetalhe.juros) && (
								<div className="ll-row">
									<div className="ll-field">
										<label>Multa</label>
										<div style={boxStyle}>{formatarValor(verDetalhe.multa)}</div>
									</div>
									<div className="ll-field">
										<label>Juros</label>
										<div style={boxStyle}>{formatarValor(verDetalhe.juros)}</div>
									</div>
								</div>
							)}
						</>
					)}
					{verDetalhe.observacao && (
						<div className="ll-field">
							<label>Observação do Lançamento</label>
							<div style={{ ...boxStyle, color: 'var(--text-muted)' }}>{verDetalhe.observacao}</div>
						</div>
					)}
					{verDetalhe.observacao_pagamento && (
						<div className="ll-field">
							<label>Observação do Pagamento</label>
							<div style={{ ...boxStyle, color: 'var(--text-muted)' }}>{verDetalhe.observacao_pagamento}</div>
						</div>
					)}
					<div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
						<button type="button" className="save" onClick={() => setVerDetalhe(null)}>
							Fechar
						</button>
					</div>
				</div>
			</div>
		)}
		</>,
		document.body
	);
}

export default LoteLancamentosModal;
