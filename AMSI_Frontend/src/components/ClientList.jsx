import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClifors, getSaldosClifors, deleteClifor } from '../services/api.js';
import { useToast } from './ToastStack.jsx';
import ModalConfirm from './ModalConfirm.jsx';
import CliforResumoPopup from './CliforResumoPopup.jsx';
import { isAdmin, isConsulta } from '../services/auth.js';
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
	const { mostrarToast } = useToast();
	const admin = isAdmin();
	const consulta = isConsulta();

	const [clifors, setClifors] = useState([]);
	const [saldos, setSaldos] = useState({});
	const [loading, setLoading] = useState(true);
	const [cpfVisivel, setCpfVisivel] = useState({});
	const [confirmarDeletar, setConfirmarDeletar] = useState(null);
	const [cliforDetalhe, setCliforDetalhe] = useState(null);

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
			for (const s of saldosData)
				mapa[s.id_clifor] = {
					total_a_receber: s.total_a_receber,
					total_a_pagar: s.total_a_pagar
				};
			setSaldos(mapa);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao carregar clientes/fornecedores', 'erro');
		} finally {
			setLoading(false);
		}
	};

	const toggleCpf = (id) => setCpfVisivel((prev) => ({ ...prev, [id]: !prev[id] }));

	const handleDeletar = async () => {
		try {
			await deleteClifor(confirmarDeletar.id_clifor);
			mostrarToast('Cliente/Fornecedor excluído com sucesso.');
			setConfirmarDeletar(null);
			carregar();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao excluir cliente/fornecedor', 'erro');
			setConfirmarDeletar(null);
		}
	};

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
			{confirmarDeletar && (
				<ModalConfirm
					titulo="Excluir Cliente/Fornecedor"
					mensagem={`Tem certeza que deseja excluir "${confirmarDeletar.nome}"? Esta ação não pode ser desfeita. Caso possua lançamentos vinculados, a exclusão será bloqueada.`}
					textoBotaoConfirmar="Excluir"
					textoBotaoCancelar="Cancelar"
					onConfirmar={handleDeletar}
					onCancelar={() => setConfirmarDeletar(null)}
					variante="perigo"
				/>
			)}

			{cliforDetalhe && (
				<CliforResumoPopup
					clifor={cliforDetalhe}
					onFechar={() => setCliforDetalhe(null)}
				/>
			)}

			<div className="cl-header">
				<h2 className="cl-title">Clientes / Fornecedores</h2>
				{!consulta && (
					<button className="cl-btn-novo" onClick={() => navigate('/cliente_fornecedor/novo')}>
						+ Novo
					</button>
				)}
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
								<th>
									<span className="cl-th-info">
										A Receber
										<span className="cl-th-icon">ℹ</span>
										<span className="cl-tooltip-box">
											Soma dos créditos em aberto (o que esta entidade deve à associação)
										</span>
									</span>
								</th>
								<th>
									<span className="cl-th-info">
										A Pagar
										<span className="cl-th-icon">ℹ</span>
										<span className="cl-tooltip-box">
											Soma dos débitos em aberto (o que a associação deve a esta entidade)
										</span>
									</span>
								</th>
								<th>Ações</th>
							</tr>
						</thead>
						<tbody>
							{cliforsFiltrados.map((c) => {
								const saldo = saldos[c.id_clifor];
								const totalReceber = saldo ? parseFloat(saldo.total_a_receber) : null;
								const totalPagar = saldo ? parseFloat(saldo.total_a_pagar) : null;
								return (
									<tr
										key={c.id_clifor}
										className="cl-row-clicavel"
										onClick={() => setCliforDetalhe(c)}
									>
										<td>{c.nome}</td>
										<td>{TIPO_LABEL[c.tipo_clifor] ?? c.tipo_clifor}</td>
										<td onClick={(e) => e.stopPropagation()}>
											<span
												className={`cl-doc${consulta ? '' : ' cl-rasurado'}`}
												title={consulta ? 'Dado protegido' : cpfVisivel[c.id_clifor] ? 'Clique para ocultar' : 'Clique para revelar'}
												onClick={() => !consulta && toggleCpf(c.id_clifor)}
												style={consulta ? {} : { cursor: 'pointer' }}
											>
												{!consulta && cpfVisivel[c.id_clifor] ? c.cpf_cnpj || '—' : rassurarCpfCnpj(c.cpf_cnpj)}
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
											{totalReceber != null ? (
												<span className="cl-saldo cl-saldo--positivo">
													{totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
												</span>
											) : (
												<span className="cl-saldo" style={{ color: 'var(--text-muted)' }}>—</span>
											)}
										</td>
										<td>
											{totalPagar != null ? (
												<span className="cl-saldo cl-saldo--negativo">
													{totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
												</span>
											) : (
												<span className="cl-saldo" style={{ color: 'var(--text-muted)' }}>—</span>
											)}
										</td>
										<td style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
											{!consulta && (
												<button
													className="cl-btn-editar"
													onClick={() => navigate(`/cliente_fornecedor/${c.id_clifor}/editar`)}
												>
													<i className="bi bi-pencil"></i> Editar
												</button>
											)}
											{admin && (
												<button
													className="cl-btn-editar"
													style={{ background: '#ef4444', borderColor: '#ef4444' }}
													onClick={() => setConfirmarDeletar(c)}
													title="Excluir cliente/fornecedor"
												>
													<i className="bi bi-trash"></i>
												</button>
											)}
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
