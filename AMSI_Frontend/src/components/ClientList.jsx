import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClifors, getSaldosClifors } from '../services/api.js';
import ToastStack, { useToast } from './ToastStack.jsx';
import '../styles/clientList.css';

const TIPO_LABEL = { C: 'Cliente', F: 'Fornecedor', A: 'Ambos' };

function rassurarCpfCnpj(doc) {
	if (!doc) return '—';
	const d = doc.replace(/\D/g, '');
	if (d.length === 11) return `***.***.${d.slice(6, 9)}-**`;
	if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****.${d.slice(12)}`;
	return doc;
}

function ClientList() {
	const navigate = useNavigate();
	const { toasts, mostrarToast, removerToast } = useToast();

	const [clifors, setClifors] = useState([]);
	const [saldos, setSaldos] = useState({});
	const [loading, setLoading] = useState(true);
	const [cpfVisivel, setCpfVisivel] = useState({});

	const [busca, setBusca] = useState('');
	const [filtroTipo, setFiltroTipo] = useState('');
	const [filtroStatus, setFiltroStatus] = useState('');

	useEffect(() => {
		carregar();
	}, []);

	const carregar = async () => {
		try {
			setLoading(true);
			const [lista, saldosData] = await Promise.all([getClifors(), getSaldosClifors()]);
			setClifors(lista);
			const mapa = {};
			for (const s of saldosData) mapa[s.id_clifor] = s.saldo_liquido;
			setSaldos(mapa);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao carregar clientes/fornecedores', 'erro');
		} finally {
			setLoading(false);
		}
	};

	const toggleCpf = (id) => setCpfVisivel((prev) => ({ ...prev, [id]: !prev[id] }));

	const cliforsFiltrados = clifors.filter((c) => {
		if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
		if (filtroTipo && c.tipo_clifor !== filtroTipo) return false;
		if (filtroStatus === 'ativo' && !c.ativo) return false;
		if (filtroStatus === 'inativo' && c.ativo) return false;
		if (filtroStatus === 'inadimplente' && !c.inadimplente) return false;
		return true;
	});

	return (
		<div className="cl-container">
			<ToastStack toasts={toasts} onRemover={removerToast} />

			<div className="cl-header">
				<h2 className="cl-title">Clientes / Fornecedores</h2>
				<button className="cl-btn-novo" onClick={() => navigate('/cliente_fornecedor/novo')}>
					+ Novo
				</button>
			</div>

			<div className="cl-filtros">
				<input
					className="cl-busca"
					type="text"
					placeholder="Buscar por nome..."
					value={busca}
					onChange={(e) => setBusca(e.target.value)}
				/>
				<select
					className="cl-select"
					value={filtroTipo}
					onChange={(e) => setFiltroTipo(e.target.value)}
				>
					<option value="">Todos os tipos</option>
					<option value="C">Cliente</option>
					<option value="F">Fornecedor</option>
					<option value="A">Ambos</option>
				</select>
				<select
					className="cl-select"
					value={filtroStatus}
					onChange={(e) => setFiltroStatus(e.target.value)}
				>
					<option value="">Todos os status</option>
					<option value="ativo">Ativo</option>
					<option value="inativo">Inativo</option>
					<option value="inadimplente">Inadimplente</option>
				</select>
			</div>

			{loading ? (
				<p className="cl-loading">Carregando...</p>
			) : cliforsFiltrados.length === 0 ? (
				<p className="cl-vazio">Nenhum cliente/fornecedor encontrado.</p>
			) : (
				<div className="cl-table-wrapper">
					<table className="cl-table">
						<thead>
							<tr>
								<th>Nome</th>
								<th>Tipo</th>
								<th>Documento</th>
								<th>Status</th>
								<th>Inadimplente</th>
								<th>Saldo</th>
								<th>Ações</th>
							</tr>
						</thead>
						<tbody>
							{cliforsFiltrados.map((c) => {
								const saldo = saldos[c.id_clifor];
								const saldoNum = saldo != null ? parseFloat(saldo) : null;
								return (
									<tr key={c.id_clifor}>
										<td>{c.nome}</td>
										<td>{TIPO_LABEL[c.tipo_clifor] ?? c.tipo_clifor}</td>
										<td>
											<span
												className="cl-doc cl-rasurado"
												title="Clique para revelar"
												onClick={() => toggleCpf(c.id_clifor)}
											>
												{cpfVisivel[c.id_clifor] ? c.cpf_cnpj || '—' : rassurarCpfCnpj(c.cpf_cnpj)}
											</span>
										</td>
										<td>
											<span
												className={`cl-badge ${c.ativo ? 'cl-badge--ativo' : 'cl-badge--inativo'}`}
											>
												{c.ativo ? 'Ativo' : 'Inativo'}
											</span>
										</td>
										<td>
											<span
												className={`cl-badge ${c.inadimplente ? 'cl-badge--inadimplente' : 'cl-badge--ok'}`}
											>
												{c.inadimplente ? 'Sim' : 'Não'}
											</span>
										</td>
										<td>
											{saldoNum != null ? (
												<span
													className={`cl-saldo ${saldoNum >= 0 ? 'cl-saldo--positivo' : 'cl-saldo--negativo'}`}
												>
													R$ {saldoNum.toFixed(2).replace('.', ',')}
												</span>
											) : (
												<span className="cl-saldo" style={{ color: 'var(--text-muted)' }}>
													—
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
