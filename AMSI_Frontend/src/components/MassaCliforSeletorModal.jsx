import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getClifors } from '../services/api.js';
import { useToast } from './ToastStack.jsx';
import '../styles/clientList.css';

const TIPO_LABEL = { C: 'Cliente', F: 'Fornecedor', A: 'Ambos' };

function rassurarCpfCnpj(doc) {
	if (!doc) return '—';
	const d = doc.replace(/\D/g, '');
	if (d.length === 11) return `***.***.${d.slice(6, 9)}-**`;
	if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****.${d.slice(12)}`;
	return doc;
}

/**
 * Modal-seletor de clifors para lançamento em massa.
 * Reaproveita a lista + filtros do ClientList. Não cria nada: ao confirmar,
 * devolve os ids selecionados via onConfirmar(ids) e fecha.
 *
 * Props:
 *  - selecionados: array de ids já marcados (persiste a seleção / pré-marca o clifor único)
 *  - onConfirmar(ids): aplica a seleção e volta ao Novo Lançamento
 *  - onFechar(): fecha sem alterar a seleção
 */
function MassaCliforSeletorModal({ selecionados = [], onConfirmar, onFechar }) {
	const { mostrarToast } = useToast();
	const [clifors, setClifors] = useState([]);
	const [loading, setLoading] = useState(true);
	const [marcados, setMarcados] = useState(() => new Set(selecionados));

	const [busca, setBusca] = useState('');
	const [filtroTipo, setFiltroTipo] = useState('');
	const [filtroStatus, setFiltroStatus] = useState('');

	useEffect(() => {
		(async () => {
			try {
				setLoading(true);
				const lista = await getClifors();
				setClifors(lista);
			} catch (err) {
				mostrarToast(err.message || 'Erro ao carregar clientes/fornecedores', 'erro');
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const cliforsFiltrados = clifors.filter((c) => {
		if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
		if (filtroTipo && c.tipo_clifor !== filtroTipo) return false;
		if (filtroStatus === 'ativo' && !c.ativo) return false;
		if (filtroStatus === 'inativo' && c.ativo) return false;
		if (filtroStatus === 'inadimplente' && !c.inadimplente) return false;
		return true;
	});

	const toggle = (id) =>
		setMarcados((prev) => {
			const proximo = new Set(prev);
			if (proximo.has(id)) proximo.delete(id);
			else proximo.add(id);
			return proximo;
		});

	const selecionarTodos = () =>
		setMarcados((prev) => {
			const proximo = new Set(prev);
			cliforsFiltrados.forEach((c) => proximo.add(c.id_clifor));
			return proximo;
		});

	const limpar = () =>
		setMarcados((prev) => {
			const proximo = new Set(prev);
			cliforsFiltrados.forEach((c) => proximo.delete(c.id_clifor));
			return proximo;
		});

	const selecionadosNoFiltro = cliforsFiltrados.filter((c) => marcados.has(c.id_clifor)).length;

	return createPortal(
		<div
			className="popup-overlay"
			style={{ zIndex: 9995, padding: 20 }}
			onClick={onFechar}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					background: 'var(--bg-card)',
					border: '1px solid var(--border)',
					borderRadius: 14,
					width: '100%',
					maxWidth: 880,
					maxHeight: '88vh',
					display: 'flex',
					flexDirection: 'column',
					boxShadow: '0 16px 48px var(--shadow)'
				}}
			>
				{/* Cabeçalho */}
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						padding: '20px 24px 0'
					}}
				>
					<h2 className="cl-title">Lista de Clientes/Fornecedores</h2>
					<button type="button" className="lm-fechar" onClick={onFechar}>
						✕
					</button>
				</div>

				{/* Filtros */}
				<div className="cl-filtros" style={{ padding: '16px 24px 0', marginBottom: 0 }}>
					<input
						className="cl-busca"
						type="text"
						placeholder="Buscar por nome..."
						value={busca}
						onChange={(e) => setBusca(e.target.value)}
					/>
					<select className="cl-select" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
						<option value="">Todos os tipos</option>
						<option value="C">Cliente</option>
						<option value="F">Fornecedor</option>
						<option value="A">Ambos</option>
					</select>
					<select className="cl-select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
						<option value="">Todos os status</option>
						<option value="ativo">Ativo</option>
						<option value="inativo">Inativo</option>
						<option value="inadimplente">Inadimplente</option>
					</select>
				</div>

				{/* Corpo rolável — tabela */}
				<div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
					{loading ? (
						<p className="cl-loading">Carregando...</p>
					) : cliforsFiltrados.length === 0 ? (
						<p className="cl-vazio">Nenhum cliente/fornecedor encontrado.</p>
					) : (
						<div className="cl-table-wrapper">
							<table className="cl-table">
								<thead>
									<tr>
										<th style={{ width: 44 }} />
										<th>Nome</th>
										<th>Tipo</th>
										<th>Documento</th>
										<th>Status</th>
										<th>Inadimplente</th>
									</tr>
								</thead>
								<tbody>
									{cliforsFiltrados.map((c) => (
										<tr
											key={c.id_clifor}
											className="cl-row-clicavel"
											onClick={() => toggle(c.id_clifor)}
										>
											<td>
												<input
													type="checkbox"
													checked={marcados.has(c.id_clifor)}
													onChange={() => {}}
													style={{ width: 'auto', accentColor: 'var(--primary)', cursor: 'pointer' }}
												/>
											</td>
											<td>{c.nome}</td>
											<td>{TIPO_LABEL[c.tipo_clifor] ?? c.tipo_clifor}</td>
											<td>
												<span className="cl-doc">{rassurarCpfCnpj(c.cpf_cnpj)}</span>
											</td>
											<td>
												<span className={`cl-badge ${c.ativo ? 'cl-badge--ativo' : 'cl-badge--inativo'}`}>
													{c.ativo ? 'Ativo' : 'Inativo'}
												</span>
											</td>
											<td>
												<span className={`cl-badge ${c.inadimplente ? 'cl-badge--inadimplente' : 'cl-badge--ok'}`}>
													{c.inadimplente ? 'Sim' : 'Não'}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>

				{/* Rodapé fixo */}
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
					<button type="button" className="cl-btn-editar" onClick={selecionarTodos}>
						Selecionar todos
					</button>
					<button type="button" className="cl-btn-editar" onClick={limpar}>
						Limpar
					</button>
					<span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
						{selecionadosNoFiltro} de {cliforsFiltrados.length} selecionados
					</span>
					<div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
						<button type="button" className="cancel" onClick={onFechar}>
							CANCELAR
						</button>
						<button type="button" className="save" onClick={() => onConfirmar([...marcados])}>
							Confirmar seleção
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body
	);
}

export default MassaCliforSeletorModal;
