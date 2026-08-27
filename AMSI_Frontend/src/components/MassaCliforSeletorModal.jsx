import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getClifors } from '../services/api.js';
import { useToast } from './ToastStack.jsx';
import CliforFiltros, { useCliforFiltros } from './CliforFiltros.jsx';
import '../styles/clientList.css';

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

	const { valores, setters, filtrar } = useCliforFiltros();

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

	const cliforsFiltrados = filtrar(clifors);

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
				<CliforFiltros
					valores={valores}
					setters={setters}
					estiloLinha1={{ padding: '16px 24px 0', marginBottom: 0 }}
					estiloLinha2={{ padding: '12px 24px 0', marginBottom: 0 }}
				/>

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
										<th>Lote</th>
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
											<td>{c.lote || '—'}</td>
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
