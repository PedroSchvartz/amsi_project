import { useState, useEffect } from 'react';
import LancamentoModal from '../components/LancamentoModal.jsx';
import { useNavigate } from 'react-router-dom';
import ModalConfirm from '../components/ModalConfirm.jsx';
import ToastStack, { useToast } from '../components/ToastStack.jsx';
import '../styles/listaLancamentos.css';
import {
	getLancamentos,
	fecharLancamento,
	getClifors,
	getTiposConta,
	anexarComprovante,
	baixarComprovante,
	removerComprovante
} from '../services/api';
import { getUserFromToken } from '../services/auth';

const FILTROS_INICIAL = {
	id_clifor: '',
	id_tipo_conta: '',
	natureza: '',
	apenas_abertos: '',
	apenas_vencidos: '',
	data_vencimento_de: '',
	data_vencimento_ate: '',
	data_lancamento_de: '',
	data_lancamento_ate: '',
	estorno: '',
	valor_minimo: '',
	valor_maximo: ''
};

const FECHAR_INICIAL = {
	data_pagamento: '',
	valor_pago: '',
	multa: '',
	juros: '',
	observacao: '',
	estorno: false
};

function ListaLancamentosPage() {
	const navigate = useNavigate();
	const [modalAberto, setModalAberto] = useState(false);
	const [lancamentos, setLancamentos] = useState([]);
	const [clifors, setClifors] = useState([]);
	const [tiposConta, setTiposConta] = useState([]);
	const [filtros, setFiltros] = useState(FILTROS_INICIAL);
	const { toasts, mostrarToast, removerToast } = useToast();

	const [modalFechar, setModalFechar] = useState(null); // id_lancamento
	const [formFechar, setFormFechar] = useState(FECHAR_INICIAL);
	const [comprovante, setComprovante] = useState(null);
	const [lancamentoSelecionado, setLancamentoSelecionado] = useState(null);
	const [confirmarRemoverComprovante, setConfirmarRemoverComprovante] = useState(false);

	const usuario = getUserFromToken();

	useEffect(() => {
		carregarAuxiliares();
		buscar();
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
			if (f.data_vencimento_de) params.data_vencimento_de = f.data_vencimento_de;
			if (f.data_vencimento_ate) params.data_vencimento_ate = f.data_vencimento_ate;
			if (f.data_lancamento_de) params.data_lancamento_de = f.data_lancamento_de;
			if (f.data_lancamento_ate) params.data_lancamento_ate = f.data_lancamento_ate;
			if (f.estorno !== '') params.estorno = f.estorno === 'true';
			if (f.valor_minimo) params.valor_minimo = parseFloat(f.valor_minimo);
			if (f.valor_maximo) params.valor_maximo = parseFloat(f.valor_maximo);
			const data = await getLancamentos(params);
			setLancamentos(data);
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

	const abrirModalFechar = (l) => {
		setModalFechar(l.id_lancamento);
		setLancamentoSelecionado(l);
		setFormFechar({
			...FECHAR_INICIAL,
			id_usuario_fk_fechamento: usuario?.sub,
			observacao: l.observacao || '',
			valor_pago: l.valor_pago ? String(l.valor_pago) : String(l.valor)
		});
		setComprovante(null);
	};

	const handleRemoverComprovante = async () => {
		try {
			await removerComprovante(lancamentoSelecionado.id_lancamento);
			setLancamentoSelecionado({
				...lancamentoSelecionado,
				tem_comprovante: false,
				comprovante_nome: null
			});
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

	const handleConfirmarFechar = async (e) => {
		e.preventDefault();
		try {
			const payload = {
				id_usuario_fk_fechamento: usuario?.sub,
				data_pagamento: formFechar.data_pagamento || null,
				valor_pago: formFechar.valor_pago ? parseFloat(formFechar.valor_pago) : null,
				multa: formFechar.multa ? parseFloat(formFechar.multa) : null,
				juros: formFechar.juros ? parseFloat(formFechar.juros) : null,
				observacao: formFechar.observacao || null,
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

	const nomeCliffor = (id) => clifors.find((c) => c.id_clifor === id)?.nome || id;
	const nomeTipo = (id) => tiposConta.find((t) => t.id_tipo_conta === id)?.descricao_conta || id;

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

					<form onSubmit={handleAplicar}>
						<h4>FILTROS</h4>

						<div className="ll-row">
							<div className="ll-field">
								<label>Cliente / Fornecedor</label>
								<select name="id_clifor" value={filtros.id_clifor} onChange={handleFiltroChange}>
									<option value="">Todos</option>
									{clifors.map((c) => (
										<option key={c.id_clifor} value={c.id_clifor}>
											{c.nome}
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
											{t.descricao_conta}
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
								<select
									name="apenas_abertos"
									value={filtros.apenas_abertos}
									onChange={handleFiltroChange}
								>
									<option value="">Todos</option>
									<option value="true">Apenas abertos</option>
								</select>
							</div>
							<div className="ll-field">
								<label>Vencimento</label>
								<select
									name="apenas_vencidos"
									value={filtros.apenas_vencidos}
									onChange={handleFiltroChange}
								>
									<option value="">Todos</option>
									<option value="true">Apenas vencidos</option>
								</select>
							</div>
							<div className="ll-field">
								<label>Reembolso</label>
								<select name="estorno" value={filtros.estorno} onChange={handleFiltroChange}>
									<option value="">Todos</option>
									<option value="true">Sim</option>
									<option value="false">Não</option>
								</select>
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
							<button type="submit" className="ll-btn-filtrar">
								Aplicar Filtros
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
									<th>Cliente / Fornecedor</th>
									<th>Tipo de Conta</th>
									<th>Natureza</th>
									<th>Vencimento</th>
									<th>Valor</th>
									<th>Status</th>
									<th>Ações</th>
								</tr>
							</thead>
							<tbody>
								{lancamentos.length === 0 ? (
									<tr>
										<td colSpan="7" className="ll-empty">
											Nenhum lançamento encontrado
										</td>
									</tr>
								) : (
									lancamentos.map((l) => (
										<tr key={l.id_lancamento}>
											<td>{nomeCliffor(l.id_clifor_relacionado_fk)}</td>
											<td>{nomeTipo(l.id_tipo_conta_fk)}</td>
											<td>{l.natureza_lancamento}</td>
											<td>{formatarData(l.data_vencimento)}</td>
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
										type="number"
										name="valor_pago"
										value={formFechar.valor_pago}
										onChange={handleFecharChange}
										min="0"
										step="0.01"
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
											type="number"
											name="multa"
											value={formFechar.multa}
											onChange={handleFecharChange}
											min="0"
											step="0.01"
										/>
									</div>
									<div className="ll-field">
										<label>Juros (R$)</label>
										<input
											type="number"
											name="juros"
											value={formFechar.juros}
											onChange={handleFecharChange}
											min="0"
											step="0.01"
										/>
									</div>
								</div>
								<div className="ll-field">
									<label>Observação</label>
									<textarea
										name="observacao"
										value={formFechar.observacao}
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
