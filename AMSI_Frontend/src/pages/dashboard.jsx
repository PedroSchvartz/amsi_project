import { useState, useEffect } from 'react';
import { getLancamentos, getLancamentosResumo, getClifors, getTiposConta } from '../services/api';
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell
} from 'recharts';

const FILTROS_INICIAL = {
	natureza: '',
	id_clifor: '',
	id_tipo_conta: '',
	data_vencimento_de: '',
	data_vencimento_ate: ''
};

const CORES_PIE = ['#ffc107', '#198754', '#dc3545'];

function Dashboard() {
	const [filtros, setFiltros] = useState(FILTROS_INICIAL);
	const [resumo, setResumo] = useState(null);
	const [lancamentos, setLancamentos] = useState([]);
	const [clifors, setClifors] = useState([]);
	const [tiposConta, setTiposConta] = useState([]);
	const [inadimplentes, setInadimplentes] = useState(0);
	const [erro, setErro] = useState('');

	useEffect(() => {
		carregarAuxiliares();
		buscar(FILTROS_INICIAL);
	}, []);

	const carregarAuxiliares = async () => {
		try {
			const [cs, ts, inadimp] = await Promise.all([
				getClifors(),
				getTiposConta(),
				getClifors({ inadimplente: true })
			]);
			setClifors(cs);
			setTiposConta(ts);
			setInadimplentes(inadimp.length);
		} catch {}
	};

	const buscar = async (f = filtros) => {
		setErro('');
		try {
			const params = {};
			if (f.natureza) params.natureza = f.natureza;
			if (f.id_clifor) params.id_clifor = parseInt(f.id_clifor);
			if (f.id_tipo_conta) params.id_tipo_conta = parseInt(f.id_tipo_conta);
			if (f.data_vencimento_de) params.data_vencimento_de = f.data_vencimento_de;
			if (f.data_vencimento_ate) params.data_vencimento_ate = f.data_vencimento_ate;

			const [res, lancs] = await Promise.all([
				getLancamentosResumo(params),
				getLancamentos(params)
			]);
			setResumo(res);
			setLancamentos(lancs);
		} catch (err) {
			setErro(err.message || 'Erro ao carregar dashboard');
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

	const formatarValor = (v) =>
		parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

	const formatarData = (iso) => {
		if (!iso) return '—';
		return iso.split('T')[0].split('-').reverse().join('/');
	};

	const dadosBarras = () => {
		const meses = {};
		lancamentos.forEach((l) => {
			const mes = l.data_lancamento?.slice(0, 7) || l.data_vencimento?.slice(0, 7);
			if (!mes) return;
			if (!meses[mes]) meses[mes] = { mes, Débito: 0, Crédito: 0 };
			if (l.natureza_lancamento === 'Debito') meses[mes].Débito += parseFloat(l.valor || 0);
			else meses[mes].Crédito += parseFloat(l.valor || 0);
		});
		return Object.values(meses)
			.sort((a, b) => a.mes.localeCompare(b.mes))
			.slice(-6);
	};

	const dadosPizza = () => {
		const hoje = new Date().toISOString().split('T')[0];
		let abertos = 0,
			pagos = 0,
			vencidos = 0;
		lancamentos.forEach((l) => {
			if (l.data_pagamento || l.estorno) pagos++;
			else if (l.data_vencimento < hoje) vencidos++;
			else abertos++;
		});
		return [
			{ name: 'Em aberto', value: abertos },
			{ name: 'Pagos', value: pagos },
			{ name: 'Vencidos', value: vencidos }
		];
	};

	const proximosVencer = lancamentos
		.filter((l) => !l.data_pagamento && !l.estorno)
		.sort((a, b) => a.data_vencimento?.localeCompare(b.data_vencimento))
		.slice(0, 5);

	const nomeCliffor = (id) => clifors.find((c) => c.id_clifor === id)?.nome || id;

	const cards = resumo
		? [
				{ label: 'A Receber', valor: formatarValor(resumo.total_a_receber), cor: 'text-success' },
				{ label: 'A Pagar', valor: formatarValor(resumo.total_a_pagar), cor: 'text-danger' },
				{
					label: 'Saldo Líquido',
					valor: formatarValor(resumo.saldo_liquido),
					cor: parseFloat(resumo.saldo_liquido) >= 0 ? 'text-success' : 'text-danger'
				},
				{ label: 'Em Aberto', valor: resumo.quantidade_abertos, cor: 'text-dark' },
				{ label: 'Vencidos', valor: resumo.quantidade_vencidos, cor: 'text-warning' },
				{
					label: 'Vencido a Receber',
					valor: formatarValor(resumo.total_vencido_a_receber),
					cor: 'text-success'
				},
				{
					label: 'Vencido a Pagar',
					valor: formatarValor(resumo.total_vencido_a_pagar),
					cor: 'text-danger'
				},
				{ label: 'Inadimplentes', valor: inadimplentes, cor: 'text-danger' }
			]
		: [];

	return (
		<div className="p-4" style={{ background: '#f8f9fa', minHeight: '100vh' }}>
			<h4 className="fw-bold mb-4">Dashboard</h4>

			{/* FILTROS */}
			<div className="card border-0 shadow-sm mb-4">
				<div className="card-body">
					<form onSubmit={handleAplicar}>
						<div className="row g-2 align-items-end">
							<div className="col-12 col-sm-6 col-lg-2">
								<label className="form-label small mb-1">Natureza</label>
								<select
									className="form-select form-select-sm"
									name="natureza"
									value={filtros.natureza}
									onChange={handleFiltroChange}
								>
									<option value="">Todas</option>
									<option value="Debito">Débito</option>
									<option value="Credito">Crédito</option>
								</select>
							</div>
							<div className="col-12 col-sm-6 col-lg-2">
								<label className="form-label small mb-1">Cliente / Fornecedor</label>
								<select
									className="form-select form-select-sm"
									name="id_clifor"
									value={filtros.id_clifor}
									onChange={handleFiltroChange}
								>
									<option value="">Todos</option>
									{clifors.map((c) => (
										<option key={c.id_clifor} value={c.id_clifor}>
											{c.nome}
										</option>
									))}
								</select>
							</div>
							<div className="col-12 col-sm-6 col-lg-2">
								<label className="form-label small mb-1">Tipo de Conta</label>
								<select
									className="form-select form-select-sm"
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
							<div className="col-12 col-sm-6 col-lg-2">
								<label className="form-label small mb-1">Vencimento de</label>
								<input
									type="date"
									className="form-control form-control-sm"
									name="data_vencimento_de"
									value={filtros.data_vencimento_de}
									onChange={handleFiltroChange}
								/>
							</div>
							<div className="col-12 col-sm-6 col-lg-2">
								<label className="form-label small mb-1">Vencimento até</label>
								<input
									type="date"
									className="form-control form-control-sm"
									name="data_vencimento_ate"
									value={filtros.data_vencimento_ate}
									onChange={handleFiltroChange}
								/>
							</div>
							<div className="col-12 col-sm-6 col-lg-2">
								<div className="d-flex gap-2">
									<button
										type="button"
										className="btn btn-outline-secondary btn-sm flex-fill"
										onClick={handleLimpar}
									>
										Limpar
									</button>
									<button type="submit" className="btn btn-dark btn-sm flex-fill">
										Aplicar
									</button>
								</div>
							</div>
						</div>
					</form>
				</div>
			</div>

			{erro && <div className="alert alert-danger">{erro}</div>}

			{/* CARDS RESUMO */}
			<div className="row g-3 mb-4">
				{cards.map((card, i) => (
					<div key={i} className="col-6 col-md-3">
						<div className="card border-0 shadow-sm h-100 text-center p-3">
							<div className={`fw-bold ${card.cor}`} style={{ fontSize: 20 }}>
								{card.valor}
							</div>
							<div className="text-muted small mt-1">{card.label}</div>
						</div>
					</div>
				))}
			</div>

			{/* GRÁFICOS */}
			<div className="row g-3 mb-4">
				<div className="col-12 col-md-8">
					<div className="card border-0 shadow-sm h-100">
						<div className="card-body">
							<h6 className="fw-semibold mb-3">Lançamentos por Mês</h6>
							<ResponsiveContainer width="100%" height={250}>
								<BarChart data={dadosBarras()}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="mes" tick={{ fontSize: 12 }} />
									<YAxis tick={{ fontSize: 12 }} />
									<Tooltip formatter={(v) => formatarValor(v)} />
									<Legend />
									<Bar dataKey="Débito" fill="#dc3545" radius={[4, 4, 0, 0]} />
									<Bar dataKey="Crédito" fill="#198754" radius={[4, 4, 0, 0]} />
								</BarChart>
							</ResponsiveContainer>
						</div>
					</div>
				</div>
				<div className="col-12 col-md-4">
					<div className="card border-0 shadow-sm h-100">
						<div className="card-body">
							<h6 className="fw-semibold mb-3">Status dos Lançamentos</h6>
							<ResponsiveContainer width="100%" height={250}>
								<PieChart>
									<Pie
										data={dadosPizza()}
										dataKey="value"
										nameKey="name"
										cx="50%"
										cy="50%"
										outerRadius={90}
										label={({ name, value }) => `${name}: ${value}`}
									>
										{dadosPizza().map((_, i) => (
											<Cell key={i} fill={CORES_PIE[i]} />
										))}
									</Pie>
									<Tooltip />
								</PieChart>
							</ResponsiveContainer>
						</div>
					</div>
				</div>
			</div>

			{/* PRÓXIMOS A VENCER */}
			<div className="card border-0 shadow-sm">
				<div className="card-body">
					<h6 className="fw-semibold mb-3">Próximos a Vencer</h6>
					{proximosVencer.length === 0 ? (
						<p className="text-muted small mb-0">Nenhum lançamento em aberto.</p>
					) : (
						<div className="table-responsive">
							<table className="table table-sm table-hover mb-0">
								<thead className="table-light">
									<tr>
										<th>Cliente / Fornecedor</th>
										<th>Vencimento</th>
										<th>Valor</th>
										<th>Natureza</th>
									</tr>
								</thead>
								<tbody>
									{proximosVencer.map((l) => (
										<tr key={l.id_lancamento}>
											<td>{nomeCliffor(l.id_clifor_relacionado_fk)}</td>
											<td>{formatarData(l.data_vencimento)}</td>
											<td>{formatarValor(l.valor)}</td>
											<td>
												<span
													className={`badge ${l.natureza_lancamento === 'Credito' ? 'bg-success' : 'bg-danger'}`}
												>
													{l.natureza_lancamento}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default Dashboard;
