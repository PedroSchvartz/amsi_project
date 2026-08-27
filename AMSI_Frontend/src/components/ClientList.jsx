import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClifors, getSaldosClifors, deleteClifor } from '../services/api.js';
import { useToast } from './ToastStack.jsx';
import ModalConfirm from './ModalConfirm.jsx';
import CliforResumoPopup from './CliforResumoPopup.jsx';
import CliforFiltros, { useCliforFiltros } from './CliforFiltros.jsx';
import { isAdmin, isConsulta } from '../services/auth.js';
import { getCache, setCache } from '../services/cache.js';
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
	const [loading, setLoading] = useState(false);
	const [populado, setPopulado] = useState(false); // true após a 1ª busca
	const [cpfVisivel, setCpfVisivel] = useState({});
	const [confirmarDeletar, setConfirmarDeletar] = useState(null);
	const [cliforDetalhe, setCliforDetalhe] = useState(null);

	const { valores, setters, filtrar } = useCliforFiltros();

	// Não busca ao abrir: o usuário dispara a busca no botão "Pesquisar". Mas se já houve
	// uma pesquisa nesta sessão, reidrata o resultado do cache (persiste a navegação). 3.13.
	useEffect(() => {
		const cache = getCache('clientes');
		if (!cache) return;
		setClifors(cache.clifors);
		setSaldos(cache.saldos);
		setPopulado(true);
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
			setPopulado(true);
			setCache('clientes', { clifors: lista, saldos: mapa });
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

	const cliforsFiltrados = filtrar(clifors);

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
				<div style={{ display: 'flex', gap: 8 }}>
					<button
						className="cl-btn-editar"
						onClick={carregar}
						disabled={loading}
						title="Pesquisar"
					>
						<i className="bi bi-search" />
						{loading ? ' Pesquisando...' : ' Pesquisar'}
					</button>
					{!consulta && (
						<button className="cl-btn-novo" onClick={() => navigate('/cliente_fornecedor/novo')}>
							+ Novo
						</button>
					)}
				</div>
			</div>

			<CliforFiltros valores={valores} setters={setters} />

			{loading ? (
				<p className="cl-loading">Carregando...</p>
			) : !populado ? (
				<p className="cl-vazio">Clique em "Pesquisar" para buscar os clientes/fornecedores.</p>
			) : cliforsFiltrados.length === 0 ? (
				<p className="cl-vazio">Nenhum cliente/fornecedor encontrado.</p>
			) : (
				<div className="cl-table-wrapper">
					<table className="cl-table">
						<thead>
							<tr>
								<th>Nome</th>
								<th>
									<span className="cl-th-info">
										Tipo
										<span className="cl-tooltip-box">
											Papel da entidade: Cliente (recebe da associação), Fornecedor (a associação paga) ou Ambos.
										</span>
									</span>
								</th>
								<th>
									<span className="cl-th-info">
										Documento
										<span className="cl-tooltip-box">
											CPF ou CNPJ da entidade, exibido mascarado. Clique para revelar.
										</span>
									</span>
								</th>
								<th>
									<span className="cl-th-info">
										Status
										<span className="cl-tooltip-box">
											"Ativo" indica que o cadastro está em uso; "Inativo", que foi desativado — arquivado sem ser apagado.
										</span>
									</span>
								</th>
								<th>
									<span className="cl-th-info">
										Inadimplente
										<span className="cl-tooltip-box">
											"Sim" quando a entidade tem crédito vencido e ainda não pago — ou seja, deve à associação e passou do vencimento.
										</span>
									</span>
								</th>
								<th>
									<span className="cl-th-info">
										Bloqueado
										<span className="cl-tooltip-box">
											"Sim" quando o cadastro foi bloqueado manualmente — sinaliza restrição administrativa, sem apagar o registro.
										</span>
									</span>
								</th>
								<th>
									<span className="cl-th-info">
										A Receber
										<span className="cl-tooltip-box">
											Soma dos créditos em aberto (o que esta entidade deve à associação).
										</span>
									</span>
								</th>
								<th>
									<span className="cl-th-info">
										A Pagar
										<span className="cl-tooltip-box">
											Soma dos débitos em aberto (o que a associação deve a esta entidade).
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
											<span
												className={`cl-badge ${c.bloqueado ? 'cl-badge--bloqueado' : 'cl-badge--ok'}`}
											>
												{c.bloqueado ? 'Sim' : 'Não'}
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
