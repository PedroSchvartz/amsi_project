import { useState, useEffect } from 'react';
import '../styles/ListaLancamentos.css';
import { getLancamentos, fecharLancamento, getClifors, getTiposConta } from '../services/api';
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
	const [lancamentos, setLancamentos] = useState([]);
	const [clifors, setClifors] = useState([]);
	const [tiposConta, setTiposConta] = useState([]);
	const [filtros, setFiltros] = useState(FILTROS_INICIAL);
	const [erro, setErro] = useState('');
	const [sucesso, setSucesso] = useState('');

	const [modalFechar, setModalFechar] = useState(null); // id_lancamento
	const [formFechar, setFormFechar] = useState(FECHAR_INICIAL);
	const [erroModal, setErroModal] = useState('');

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
		setErro('');
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
			setErro(err.message || 'Erro ao buscar lançamentos');
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

	const abrirModalFechar = (id) => {
		setModalFechar(id);
		setFormFechar({ ...FECHAR_INICIAL, id_usuario_fk_fechamento: usuario?.sub });
		setErroModal('');
	};

	const handleFecharChange = (e) => {
		const { name, value, type, checked } = e.target;
		setFormFechar({ ...formFechar, [name]: type === 'checkbox' ? checked : value });
	};

	const handleConfirmarFechar = async (e) => {
		e.preventDefault();
		setErroModal('');
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
			await fecharLancamento(modalFechar, payload);
			setSucesso('Lançamento fechado com sucesso.');
			setModalFechar(null);
			buscar();
		} catch (err) {
			setErroModal(err.message || 'Erro ao fechar lançamento');
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
		<div className="ll-container">
			{/* FILTROS */}
			<div className="ll-card">
				<h2>Lista de Lançamentos</h2>

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

			{/* FEEDBACK */}
			{erro && <p className="ll-erro">{erro}</p>}
			{sucesso && <p className="ll-sucesso">{sucesso}</p>}

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
														onClick={() => abrirModalFechar(l.id_lancamento)}
														title="Fechar lançamento"
													>
														✓
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
							<div className="ll-field ll-checkbox">
								<input
									type="checkbox"
									name="estorno"
									id="estorno_fechar"
									checked={formFechar.estorno}
									onChange={handleFecharChange}
								/>
								<label htmlFor="estorno_fechar">Marcar como reembolso</label>
							</div>

							{erroModal && <p className="ll-erro">{erroModal}</p>}

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
	);
}

export default ListaLancamentosPage;
