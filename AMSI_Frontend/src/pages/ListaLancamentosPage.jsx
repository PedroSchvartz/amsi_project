import { useState, useEffect } from 'react';
import LancamentoModal from '../components/LancamentoModal.jsx';
import { useSearchParams } from 'react-router-dom';
import ModalConfirm from '../components/ModalConfirm.jsx';
import ToastStack, { useToast } from '../components/ToastStack.jsx';
import '../styles/listaLancamentos.css';
import {
	getLancamentos,
	fecharLancamento,
	editarLancamento,
	getClifors,
	getTiposConta,
	anexarComprovante,
	baixarComprovante,
	removerComprovante
} from '../services/api';
import { getUserFromToken, isAdmin } from '../services/auth';

const FILTROS_INICIAL = {
	id_clifor: '',
	id_tipo_conta: '',
	natureza: '',
	apenas_abertos: '',
	apenas_vencidos: '',
	apenas_quitados: '',
	apenas_com_comprovante: '',
	apenas_sem_comprovante: '',
	data_vencimento_de: '',
	data_vencimento_ate: '',
	data_lancamento_de: '',
	data_lancamento_ate: '',
	data_pagamento_de: '',
	data_pagamento_ate: '',
	estorno: '',
	valor_minimo: '',
	valor_maximo: ''
};

const FECHAR_INICIAL = {
	data_pagamento: '',
	valor_pago: '',
	multa: '',
	juros: '',
	observacao_pagamento: '',
	estorno: false
};

const EDITAR_INICIAL = {
	id_clifor_relacionado_fk: '',
	id_tipo_conta_fk: '',
	valor: '',
	data_vencimento: '',
	natureza_lancamento: '',
	observacao: '',
	observacao_pagamento: ''
};

function ListaLancamentosPage() {
	const [searchParams] = useSearchParams();
	const [modalAberto, setModalAberto] = useState(false);
	const [lancamentos, setLancamentos] = useState([]);
	const [clifors, setClifors] = useState([]);
	const [tiposConta, setTiposConta] = useState([]);
	const [filtros, setFiltros] = useState(FILTROS_INICIAL);
	const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_INICIAL);
	const { toasts, mostrarToast, removerToast } = useToast();

	const [modalFechar, setModalFechar] = useState(null);
	const [formFechar, setFormFechar] = useState(FECHAR_INICIAL);
	const [comprovante, setComprovante] = useState(null);
	const [lancamentoSelecionado, setLancamentoSelecionado] = useState(null);
	const [confirmarRemoverComprovante, setConfirmarRemoverComprovante] = useState(false);

	const [modalEditar, setModalEditar] = useState(null);
	const [formEditar, setFormEditar] = useState(EDITAR_INICIAL);

	const usuario = getUserFromToken();
	const admin = isAdmin();

	useEffect(() => {
		carregarAuxiliares();
		if (searchParams.has('origemDashboard')) {
			const f = { ...FILTROS_INICIAL };
			for (const [key, val] of searchParams.entries()) {
				if (key !== 'origemDashboard' && key in FILTROS_INICIAL) f[key] = val;
			}
			setFiltros(f);
			buscar(f);
		} else {
			buscar();
		}
	}, []);

	const carregarAuxiliares = async () => {
		try {
			const [cs, ts] = await Promise.all([getClifors(), getTiposConta()]);
			setClifors(cs);
			setTiposConta(ts);
		} catch {}
	};

	const buscar = async (f = filtros) => {
		try {
			const params = {};
			if (f.id_clifor) params.id_clifor = parseInt(f.id_clifor);
			if (f.id_tipo_conta) params.id_tipo_conta = parseInt(f.id_tipo_conta);
			if (f.natureza) params.natureza = f.natureza;
			if (f.apenas_abertos !== '') params.apenas_abertos = f.apenas_abertos === 'true';
			if (f.apenas_vencidos !== '') params.apenas_vencidos = f.apenas_vencidos === 'true';
			if (f.apenas_quitados !== '') params.apenas_quitados = f.apenas_quitados === 'true';
			if (f.apenas_com_comprovante !== '')
				params.apenas_com_comprovante = f.apenas_com_comprovante === 'true';
			if (f.apenas_sem_comprovante !== '')
				params.apenas_sem_comprovante = f.apenas_sem_comprovante === 'true';
			if (f.data_vencimento_de) params.data_vencimento_de = f.data_vencimento_de;
			if (f.data_vencimento_ate) params.data_vencimento_ate = f.data_vencimento_ate;
			if (f.data_lancamento_de) params.data_lancamento_de = f.data_lancamento_de;
			if (f.data_lancamento_ate) params.data_lancamento_ate = f.data_lancamento_ate;
			if (f.data_pagamento_de) params.data_pagamento_de = f.data_pagamento_de;
			if (f.data_pagamento_ate) params.data_pagamento_ate = f.data_pagamento_ate;
			if (f.estorno !== '') params.estorno = f.estorno === 'true';
			if (f.valor_minimo) params.valor_minimo = parseFloat(f.valor_minimo);
			if (f.valor_maximo) params.valor_maximo = parseFloat(f.valor_maximo);
			const data = await getLancamentos(params);
			setLancamentos(data);
			setFiltrosAplicados(f);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao buscar lançamentos', 'erro');
		}
	};

	const handleFiltroChange = (e) => {
		setFiltros({ ...filtros, [e.target.name]: e.target.value });
	};

	const handleAplicar = (e) => {
		e.preventDefault();
		buscar(filtros);
	};

	const handleLimpar = () => {
		setFiltros(FILTROS_INICIAL);
		buscar(FILTROS_INICIAL);
	};

	const filtrosPendentes = JSON.stringify(filtros) !== JSON.stringify(filtrosAplicados);

	// ── Helpers de nome com fallback local ─────────────────────────────────────
	const nomeClifor = (l) =>
		l.nome_clifor || clifors.find((c) => c.id_clifor === l.id_clifor_relacionado_fk)?.nome || '—';

	const nomeTipo = (l) => {
		const desc = l.descricao_tipo_conta || tiposConta.find((t) => t.id_tipo_conta === l.id_tipo_conta_fk)?.descricao_conta;
		return desc ? `${l.id_tipo_conta_fk} - ${desc}` : l.id_tipo_conta_fk;
	};

	const formatarTotal = (l) => {
		if (l.valor_pago == null) return '—';
		const total = (parseFloat(l.valor_pago) || 0) + (parseFloat(l.multa) || 0) + (parseFloat(l.juros) || 0);
		return `R$ ${total.toFixed(2).replace('.', ',')}`;
	};

	// ── Modal fechar ────────────────────────────────────────────────────────────
	const abrirModalFechar = (l) => {
		setModalFechar(l.id_lancamento);
		setLancamentoSelecionado(l);
		setFormFechar({
			...FECHAR_INICIAL,
			id_usuario_fk_fechamento: usuario?.sub,
			observacao_pagamento: l.observacao_pagamento || '',
			valor_pago: l.valor_pago ? String(l.valor_pago) : String(l.valor)
		});
		setComprovante(null);
	};

	const handleRemoverComprovante = async () => {
		try {
			await removerComprovante(lancamentoSelecionado.id_lancamento);
			setLancamentoSelecionado({ ...lancamentoSelecionado, tem_comprovante: false, comprovante_nome: null });
			setConfirmarRemoverComprovante(false);
			mostrarToast('Comprovante removido com sucesso.');
		} catch (err) {
			mostrarToast(err.message || 'Erro ao remover comprovante', 'erro');
			setConfirmarRemoverComprovante(false);
		}
	};

	const handleFecharChange = (e) => {
		const { name, value, type, checked } = e.target;
		setFormFechar({ ...formFechar, [name]: type === 'checkbox' ? checked : value });
	};

	const totalPago = () => {
		const v = parseFloat(formFechar.valor_pago) || 0;
		const m = parseFloat(formFechar.multa) || 0;
		const j = parseFloat(formFechar.juros) || 0;
		return v + m + j;
	};

	const handleConfirmarFechar = async (e) => {
		e.preventDefault();
		try {
			const payload = {
				id_usuario_fk_fechamento: usuario?.sub,
				data_pagamento: formFechar.data_pagamento || null,
				valor_pago: formFechar.valor_pago ? parseFloat(formFechar.valor_pago) : null,
				multa: formFechar.multa ? parseFloat(formFechar.multa) : null,
				juros: formFechar.juros ? parseFloat(formFechar.juros) : null,
				observacao_pagamento: formFechar.observacao_pagamento || null,
				estorno: formFechar.estorno
			};
			const id = modalFechar;
			await fecharLancamento(id, payload);
			if (comprovante) {
				try {
					await anexarComprovante(id, comprovante);
				} catch {
					mostrarToast('Lançamento fechado, mas falha ao anexar comprovante.', 'aviso');
				}
			}
			mostrarToast('Lançamento fechado com sucesso.');
			setModalFechar(null);
			setComprovante(null);
			buscar();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao fechar lançamento', 'erro');
		}
	};

	// ── Modal editar (admin) ────────────────────────────────────────────────────
	const abrirModalEditar = (l) => {
		setModalEditar(l.id_lancamento);
		setLancamentoSelecionado(l);
		setFormEditar({
			id_clifor_relacionado_fk: String(l.id_clifor_relacionado_fk),
			id_tipo_conta_fk: String(l.id_tipo_conta_fk),
			valor: String(l.valor),
			data_vencimento: l.data_vencimento || '',
			natureza_lancamento: l.natureza_lancamento || '',
			observacao: l.observacao || '',
			observacao_pagamento: l.observacao_pagamento || ''
		});
	};

	const handleEditarChange = (e) => {
		setFormEditar({ ...formEditar, [e.target.name]: e.target.value });
	};

	const handleConfirmarEditar = async (e) => {
		e.preventDefault();
		try {
			const payload = {};
			if (formEditar.id_clifor_relacionado_fk)
				payload.id_clifor_relacionado_fk = parseInt(formEditar.id_clifor_relacionado_fk);
			if (formEditar.id_tipo_conta_fk)
				payload.id_tipo_conta_fk = parseInt(formEditar.id_tipo_conta_fk);
			if (formEditar.valor) payload.valor = parseFloat(formEditar.valor);
			if (formEditar.data_vencimento) payload.data_vencimento = formEditar.data_vencimento;
			if (formEditar.natureza_lancamento) payload.natureza_lancamento = formEditar.natureza_lancamento;
			if (formEditar.observacao !== undefined) payload.observacao = formEditar.observacao || null;
			if (formEditar.observacao_pagamento !== undefined) payload.observacao_pagamento = formEditar.observacao_pagamento || null;
			await editarLancamento(modalEditar, payload);
			mostrarToast('Lançamento editado com sucesso.');
			setModalEditar(null);
			buscar();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao editar lançamento', 'erro');
		}
	};

	// ── Formatação ──────────────────────────────────────────────────────────────
	const formatarData = (iso) => {
		if (!iso) return '—';
		return iso.split('T')[0].split('-').reverse().join('/');
	};

	const formatarValor = (v) => {
		if (v == null) return '—';
		return `R$ ${parseFloat(v).toFixed(2).replace('.', ',')}`;
	};

	const statusLabel = (l) => {
		if (l.estorno) return <span className="badge badge-estorno">Estorno</span>;
		if (l.data_pagamento) return <span className="badge badge-pago">Pago</span>;
		const hoje = new Date().toISOString().split('T')[0];
		if (l.data_vencimento < hoje) return <span className="badge badge-vencido">Vencido</span>;
		return <span className="badge badge-aberto">Aberto</span>;
	};

	return (
		<>
			<div className="ll-container">
				{/* FILTROS */}
				<div className="ll-card">
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							marginBottom: 16
						}}
					>
						<h2 style={{ margin: 0 }}>Lista de Lançamentos</h2>
						<button
							onClick={() => setModalAberto(true)}
							style={{
								padding: '8px 18px',
								borderRadius: 8,
								border: 'none',
								background: 'var(--primary)',
								color: '#fff',
								fontWeight: 600,
								fontSize: '0.875rem',
								cursor: 'pointer'
							}}
						>
							+ Novo Lançamento
						</button>
					</div>

					{searchParams.has('origemDashboard') && (
						<div style={{
							display: 'flex', alignItems: 'center', gap: 8,
							padding: '8px 12px', marginTop: 12,
							background: 'rgba(163, 177, 138, 0.12)',
							borderRadius: 6, fontSize: '0.82rem', color: 'var(--primary)'
						}}>
							<i className="bi bi-funnel-fill" />
							Filtros pré-carregados do Dashboard — confira e ajuste se necessário.
						</div>
					)}

					<form onSubmit={handleAplicar}>
						<h4>FILTROS</h4>

						<div className="ll-row">
							<div className="ll-field">
								<label>Cliente / Fornecedor</label>
								<select name="id_clifor" value={filtros.id_clifor} onChange={handleFiltroChange}>
									<option value="">Todos</option>
									{clifors.map((c) => (
										<option key={c.id_clifor} value={c.id_clifor}>
											{c.id_clifor} - {c.nome}
										</option>
									))}
								</select>
							</div>

							<div className="ll-field">
								<label>Tipo de Conta</label>
								<select
									name="id_tipo_conta"
									value={filtros.id_tipo_conta}
									onChange={handleFiltroChange}
								>
									<option value="">Todos</option>
									{tiposConta.map((t) => (
										<option key={t.id_tipo_conta} value={t.id_tipo_conta}>
											{t.id_tipo_conta} - {t.descricao_conta}
										</option>
									))}
								</select>
							</div>

							<div className="ll-field">
								<label>Natureza</label>
								<select name="natureza" value={filtros.natureza} onChange={handleFiltroChange}>
									<option value="">Todas</option>
									<option value="Debito">Débito</option>
									<option value="Credito">Crédito</option>
								</select>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Vencimento de</label>
								<input
									type="date"
									name="data_vencimento_de"
									value={filtros.data_vencimento_de}
									onChange={handleFiltroChange}
								/>
							</div>
							<div className="ll-field">
								<label>Vencimento até</label>
								<input
									type="date"
									name="data_vencimento_ate"
									value={filtros.data_vencimento_ate}
									onChange={handleFiltroChange}
								/>
							</div>
							<div className="ll-field">
								<label>Lançamento de</label>
								<input
									type="date"
									name="data_lancamento_de"
									value={filtros.data_lancamento_de}
									onChange={handleFiltroChange}
								/>
							</div>
							<div className="ll-field">
								<label>Lançamento até</label>
								<input
									type="date"
									name="data_lancamento_ate"
									value={filtros.data_lancamento_ate}
									onChange={handleFiltroChange}
								/>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Status</label>
								<div className="ll-status-checks">
									<label>
										<input
											type="checkbox"
											checked={filtros.apenas_abertos === 'true'}
											onChange={(e) =>
												setFiltros({ ...filtros, apenas_abertos: e.target.checked ? 'true' : '' })
											}
										/>
										Abertos
									</label>
									<label>
										<input
											type="checkbox"
											checked={filtros.apenas_vencidos === 'true'}
											onChange={(e) =>
												setFiltros({ ...filtros, apenas_vencidos: e.target.checked ? 'true' : '' })
											}
										/>
										Vencidos
									</label>
									<label>
										<input
											type="checkbox"
											checked={filtros.apenas_quitados === 'true'}
											onChange={(e) =>
												setFiltros({ ...filtros, apenas_quitados: e.target.checked ? 'true' : '' })
											}
										/>
										Quitados
									</label>
									<label>
										<input
											type="checkbox"
											checked={filtros.estorno === 'true'}
											onChange={(e) =>
												setFiltros({ ...filtros, estorno: e.target.checked ? 'true' : '' })
											}
										/>
										Reembolso
									</label>
									<span
										style={{
											borderLeft: '1px solid var(--border)',
											margin: '0 4px',
											alignSelf: 'stretch'
										}}
									/>
									<label>
										<input
											type="checkbox"
											checked={filtros.apenas_com_comprovante === 'true'}
											onChange={(e) =>
												setFiltros({
													...filtros,
													apenas_com_comprovante: e.target.checked ? 'true' : '',
													apenas_sem_comprovante: ''
												})
											}
										/>
										Com comprovante
									</label>
									<label>
										<input
											type="checkbox"
											checked={filtros.apenas_sem_comprovante === 'true'}
											onChange={(e) =>
												setFiltros({
													...filtros,
													apenas_sem_comprovante: e.target.checked ? 'true' : '',
													apenas_com_comprovante: ''
												})
											}
										/>
										Sem comprovante
									</label>
								</div>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Pagamento de</label>
								<input
									type="date"
									name="data_pagamento_de"
									value={filtros.data_pagamento_de}
									onChange={handleFiltroChange}
								/>
							</div>
							<div className="ll-field">
								<label>Pagamento até</label>
								<input
									type="date"
									name="data_pagamento_ate"
									value={filtros.data_pagamento_ate}
									onChange={handleFiltroChange}
								/>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Valor mínimo</label>
								<input
									type="number"
									name="valor_minimo"
									value={filtros.valor_minimo}
									onChange={handleFiltroChange}
									min="0"
									step="0.01"
								/>
							</div>
							<div className="ll-field">
								<label>Valor máximo</label>
								<input
									type="number"
									name="valor_maximo"
									value={filtros.valor_maximo}
									onChange={handleFiltroChange}
									min="0"
									step="0.01"
								/>
							</div>
						</div>

						<div className="ll-buttons">
							<button type="button" className="ll-btn-limpar" onClick={handleLimpar}>
								Limpar
							</button>
							<button
								type="submit"
								className={`ll-btn-filtrar${filtrosPendentes ? ' ll-btn-filtrar--pendente' : ''}`}
							>
								{filtrosPendentes ? '⚠ Aplicar Filtros ⚠' : 'Aplicar Filtros'}
							</button>
						</div>
					</form>
				</div>

				<ToastStack toasts={toasts} onRemover={removerToast} />

				{/* TABELA */}
				<div className="ll-card">
					<h4>TRANSAÇÕES ({lancamentos.length})</h4>
					<div className="ll-table-wrapper">
						<table className="ll-table">
							<thead>
								<tr>
									<th data-tooltip="Código do cliente ou fornecedor">ID</th>
									<th data-tooltip="Nome do cliente ou fornecedor vinculado ao lançamento">Cliente / Fornecedor</th>
									<th data-tooltip="Tipo de conta / categoria do lançamento">Tipo de Conta</th>
									<th data-tooltip="Código do usuário que registrou o lançamento">ID</th>
									<th data-tooltip="Nome do usuário que registrou o lançamento">Operador</th>
									<th data-tooltip="Natureza financeira: Crédito (entrada) ou Débito (saída)">Natureza</th>
									<th data-tooltip="Data limite para pagamento do lançamento">Vencimento</th>
									<th data-tooltip="Data em que o pagamento foi efetivado">Dt. Pagamento</th>
									<th data-tooltip="Valor efetivamente pago: valor pago + multa + juros">Total</th>
									<th data-tooltip="Valor original do lançamento, sem encargos">Valor</th>
									<th>Status</th>
									<th>Ações</th>
								</tr>
							</thead>
							<tbody>
								{lancamentos.length === 0 ? (
									<tr>
										<td colSpan="12" className="ll-empty">
											Nenhum lançamento encontrado
										</td>
									</tr>
								) : (
									lancamentos.map((l) => (
										<tr key={l.id_lancamento}>
											<td>{l.id_clifor_relacionado_fk}</td>
											<td>{nomeClifor(l)}</td>
											<td>{nomeTipo(l)}</td>
											<td>{l.id_usuario_fk_lancamento}</td>
											<td>{l.nome_usuario_lancamento || '—'}</td>
											<td>{l.natureza_lancamento}</td>
											<td>{formatarData(l.data_vencimento)}</td>
											<td>{formatarData(l.data_pagamento)}</td>
											<td>{formatarTotal(l)}</td>
											<td>{formatarValor(l.valor)}</td>
											<td>{statusLabel(l)}</td>
											<td>
												<div className="ll-acoes">
													{!l.data_pagamento && !l.estorno && (
														<button
															className="ll-btn-acao fechar"
															onClick={() => abrirModalFechar(l)}
															title="Fechar lançamento"
														>
															<i className="bi bi-journal-check"></i>
														</button>
													)}
													{admin && (
														<button
															className="ll-btn-acao"
															onClick={() => abrirModalEditar(l)}
															title="Editar lançamento (admin)"
														>
															<i className="bi bi-pencil"></i>
														</button>
													)}
													{l.tem_comprovante && (
														<button
															className="ll-btn-acao"
															onClick={() => baixarComprovante(l.id_lancamento)}
															title="Ver comprovante"
														>
															<i className="bi bi-file-earmark-pdf"></i>
														</button>
													)}
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* MODAL FECHAR */}
				{modalFechar && (
					<div className="ll-overlay" onClick={() => setModalFechar(null)}>
						<div className="ll-modal" onClick={(e) => e.stopPropagation()}>
							<h3>Fechar Lançamento</h3>

							<form onSubmit={handleConfirmarFechar}>
								<div className="ll-field">
									<label>Data de Pagamento</label>
									<input
										type="date"
										name="data_pagamento"
										value={formFechar.data_pagamento}
										onChange={handleFecharChange}
									/>
								</div>
								<div className="ll-field">
									<label>Valor Pago (R$)</label>
									<input
										type="text"
										name="valor_pago"
										value={formFechar.valor_pago}
										onChange={handleFecharChange}
										readOnly={!!lancamentoSelecionado?.valor_pago}
										style={
											lancamentoSelecionado?.valor_pago
												? { background: 'var(--input-bg)', opacity: 0.7 }
												: {}
										}
									/>
								</div>
								<div className="ll-row">
									<div className="ll-field">
										<label>Multa (R$)</label>
										<input
											type="text"
											name="multa"
											value={formFechar.multa}
											onChange={handleFecharChange}
										/>
									</div>
									<div className="ll-field">
										<label>Juros (R$)</label>
										<input
											type="text"
											name="juros"
											value={formFechar.juros}
											onChange={handleFecharChange}
										/>
									</div>
								</div>

								{(formFechar.multa || formFechar.juros) && (
									<div className="ll-field">
										<label>Total Pago (R$)</label>
										<div
											style={{
												padding: '6px 10px',
												background: 'var(--input-bg)',
												borderRadius: 6,
												fontSize: '0.95rem',
												fontWeight: 600,
												color: 'var(--primary)'
											}}
										>
											{formatarValor(totalPago())}
										</div>
									</div>
								)}

								{lancamentoSelecionado?.observacao && (
									<div className="ll-field">
										<label>Observação do Lançamento</label>
										<div
											style={{
												padding: '6px 10px',
												background: 'var(--input-bg)',
												borderRadius: 6,
												fontSize: '0.875rem',
												color: 'var(--text-muted)',
												opacity: 0.8
											}}
										>
											{lancamentoSelecionado.observacao}
										</div>
									</div>
								)}

								<div className="ll-field">
									<label>Observação do Pagamento</label>
									<textarea
										name="observacao_pagamento"
										value={formFechar.observacao_pagamento}
										onChange={handleFecharChange}
										rows="2"
									/>
								</div>

								{lancamentoSelecionado?.tem_comprovante && (
									<div className="ll-field">
										<label>Comprovante Atual</label>
										<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
											<span style={{ fontSize: 13, color: 'var(--text)' }}>
												<i className="bi bi-file-earmark-pdf" style={{ marginRight: 6 }}></i>
												{lancamentoSelecionado.comprovante_nome || 'comprovante.pdf'}
											</span>
											<button
												type="button"
												onClick={() => setConfirmarRemoverComprovante(true)}
												style={{
													padding: '4px 10px',
													borderRadius: 6,
													border: '1px solid #ef4444',
													background: 'transparent',
													color: '#ef4444',
													cursor: 'pointer',
													fontSize: 12
												}}
											>
												Remover
											</button>
										</div>
									</div>
								)}

								{!lancamentoSelecionado?.tem_comprovante && (
									<div className="ll-field">
										<label>
											Comprovante de Pagamento (PDF){' '}
											<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
												— opcional
											</span>
										</label>
										<input
											type="file"
											accept="application/pdf"
											onChange={(e) => {
												const arquivo = e.target.files[0] || null;
												if (arquivo && arquivo.size > 5 * 1024 * 1024) {
													mostrarToast('O arquivo excede o limite de 5MB.', 'erro');
													e.target.value = '';
													return;
												}
												setComprovante(arquivo);
											}}
											style={{ padding: '6px 0' }}
										/>
										{comprovante && (
											<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
												{comprovante.name}
											</span>
										)}
									</div>
								)}

								<div className="ll-buttons">
									<button
										type="button"
										className="ll-btn-limpar"
										onClick={() => setModalFechar(null)}
									>
										Cancelar
									</button>
									<button type="submit" className="ll-btn-filtrar">
										Confirmar
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{/* MODAL EDITAR (admin only) */}
				{modalEditar && (
					<div className="ll-overlay" onClick={() => setModalEditar(null)}>
						<div className="ll-modal" onClick={(e) => e.stopPropagation()}>
							<h3>Editar Lançamento</h3>
							<p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: -8 }}>
								Apenas administradores podem editar lançamentos realizados.
							</p>

							<form onSubmit={handleConfirmarEditar}>
								<div className="ll-field">
									<label>Cliente / Fornecedor</label>
									<select
										name="id_clifor_relacionado_fk"
										value={formEditar.id_clifor_relacionado_fk}
										onChange={handleEditarChange}
									>
										{clifors.map((c) => (
											<option key={c.id_clifor} value={c.id_clifor}>
												{c.id_clifor} - {c.nome}
											</option>
										))}
									</select>
								</div>

								<div className="ll-field">
									<label>Tipo de Conta</label>
									<select
										name="id_tipo_conta_fk"
										value={formEditar.id_tipo_conta_fk}
										onChange={handleEditarChange}
									>
										{tiposConta.map((t) => (
											<option key={t.id_tipo_conta} value={t.id_tipo_conta}>
												{t.id_tipo_conta} - {t.descricao_conta}
											</option>
										))}
									</select>
								</div>

								<div className="ll-row">
									<div className="ll-field">
										<label>Valor (R$)</label>
										<input
											type="text"
											name="valor"
											value={formEditar.valor}
											onChange={handleEditarChange}
										/>
									</div>
									<div className="ll-field">
										<label>Data de Vencimento</label>
										<input
											type="date"
											name="data_vencimento"
											value={formEditar.data_vencimento}
											onChange={handleEditarChange}
										/>
									</div>
								</div>

								<div className="ll-field">
									<label>Natureza</label>
									<select
										name="natureza_lancamento"
										value={formEditar.natureza_lancamento}
										onChange={handleEditarChange}
									>
										<option value="Credito">Crédito</option>
										<option value="Debito">Débito</option>
									</select>
								</div>

								<div className="ll-field">
									<label>Observação do Lançamento</label>
									<textarea
										name="observacao"
										value={formEditar.observacao}
										onChange={handleEditarChange}
										rows="2"
									/>
								</div>

								<div className="ll-field">
									<label>Observação do Pagamento</label>
									<textarea
										name="observacao_pagamento"
										value={formEditar.observacao_pagamento}
										onChange={handleEditarChange}
										rows="2"
									/>
								</div>

								<div className="ll-buttons">
									<button
										type="button"
										className="ll-btn-limpar"
										onClick={() => setModalEditar(null)}
									>
										Cancelar
									</button>
									<button type="submit" className="ll-btn-filtrar">
										Salvar
									</button>
								</div>
							</form>
						</div>
					</div>
				)}
			</div>

			{confirmarRemoverComprovante && (
				<ModalConfirm
					titulo="Remover comprovante"
					mensagem="Tem certeza que deseja remover o comprovante deste lançamento?"
					textoBotaoConfirmar="Remover"
					textoBotaoCancelar="Cancelar"
					onConfirmar={handleRemoverComprovante}
					onCancelar={() => setConfirmarRemoverComprovante(false)}
					variante="perigo"
				/>
			)}

			{modalAberto && (
				<LancamentoModal
					onFechar={() => {
						setModalAberto(false);
						handleAplicar({ preventDefault: () => {} });
					}}
				/>
			)}
		</>
	);
}

export default ListaLancamentosPage;
