import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClifors, getSaldosClifors } from '../services/api';
import ToastStack, { useToast } from './ToastStack.jsx';
import '../styles/clientList.css';

function CpfRasurado({ valor }) {
	const [visivel, setVisivel] = useState(false);
	if (!valor) return <span className="cl-doc">—</span>;
	return (
		<span
			className="cl-doc cl-rasurado"
			onClick={() => setVisivel((v) => !v)}
			title={visivel ? 'Clique para ocultar' : 'Clique para exibir'}
		>
			{visivel ? valor : '••••••••'}
		</span>
	);
}

function ClientList() {
	const navigate = useNavigate();
	const { toasts, mostrarToast, removerToast } = useToast();
	const [clifors, setClifors] = useState([]);
	const [saldos, setSaldos] = useState({});
	const [loading, setLoading] = useState(true);
	const [busca, setBusca] = useState('');
	const [filtroTipo, setFiltroTipo] = useState('');
	const [filtroAtivo, setFiltroAtivo] = useState('');

	useEffect(() => {
		carregar();
	}, []);

	async function carregar() {
		setLoading(true);
		try {
			const [data, saldosData] = await Promise.all([getClifors(), getSaldosClifors()]);
			setClifors(data);
			const mapa = {};
			saldosData.forEach((s) => {
				mapa[s.id_clifor] = parseFloat(s.saldo_liquido);
			});
			setSaldos(mapa);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao carregar', 'erro');
		} finally {
			setLoading(false);
		}
	}

	const filtrados = clifors.filter((c) => {
		const buscaOk = !busca || c.nome.toLowerCase().includes(busca.toLowerCase());
		const tipoOk =
			!filtroTipo || filtroTipo === 'C'
				? c.tipo_clifor === 'C' || c.tipo_clifor === 'A'
				: filtroTipo === 'F'
					? c.tipo_clifor === 'F' || c.tipo_clifor === 'A'
					: true;
		const ativoOk = filtroAtivo === '' || String(c.ativo) === filtroAtivo;
		return buscaOk && tipoOk && ativoOk;
	});

	const tipoLabel = (t) => (t === 'C' ? 'Cliente' : t === 'F' ? 'Fornecedor' : 'Ambos');

	const formatValor = (v) =>
		parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

	return (
		<div className="cl-container">
			<ToastStack toasts={toasts} onRemover={removerToast} />

			<div className="cl-header">
				<h4 className="cl-title">Clientes / Fornecedores</h4>
				<button className="cl-btn-novo" onClick={() => navigate('/cliente_fornecedor/novo')}>
					+ Novo
				</button>
			</div>

			<div className="cl-filtros">
				<input
					className="cl-busca"
					placeholder="Buscar por nome..."
					value={busca}
					onChange={(e) => setBusca(e.target.value)}
				/>
				<select
					className="cl-select"
					value={filtroTipo}
					onChange={(e) => setFiltroTipo(e.target.value)}
				>
					<option value="">Tipo</option>
					<option value="C">Clientes</option>
					<option value="F">Fornecedores</option>
					<option value="A">Ambos</option>
				</select>
				<select
					className="cl-select"
					value={filtroAtivo}
					onChange={(e) => setFiltroAtivo(e.target.value)}
				>
					<option value="">Status</option>
					<option value="true">Ativos</option>
					<option value="false">Inativos</option>
				</select>
			</div>

			{loading ? (
				<p className="cl-loading">Carregando...</p>
			) : filtrados.length === 0 ? (
				<p className="cl-vazio">Nenhum resultado encontrado.</p>
			) : (
				<div className="cl-table-wrapper">
					<table className="cl-table">
						<thead>
							<tr>
								<th>Nome</th>
								<th>Tipo</th>
								<th>CPF / CNPJ</th>
								<th>Status</th>
								<th>Saldo</th>
								<th>Ações</th>
							</tr>
						</thead>
						<tbody>
							{filtrados.map((c) => {
								const saldo = saldos[c.id_clifor] ?? null;
								return (
									<tr key={c.id_clifor}>
										<td>{c.nome}</td>
										<td>{tipoLabel(c.tipo_clifor)}</td>
										<td>
											<CpfRasurado valor={c.cpf_cnpj} />
										</td>
										<td>
											<span
												className={`cl-badge ${c.ativo ? 'cl-badge--ativo' : 'cl-badge--inativo'}`}
											>
												{c.ativo ? 'Ativo' : 'Inativo'}
											</span>
										</td>
										<td>
											{saldo === null ? (
												<span className="cl-doc">—</span>
											) : (
												<span
													className={`cl-saldo ${saldo >= 0 ? 'cl-saldo--positivo' : 'cl-saldo--negativo'}`}
												>
													{formatValor(saldo)}
												</span>
											)}
										</td>
										<td>
											<button
												className="cl-btn-editar"
												onClick={() => navigate(`/cliente_fornecedor/${c.id_clifor}/editar`)}
											>
												<i className="bi bi-pencil"></i> Editar
											</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

export default ClientList;
