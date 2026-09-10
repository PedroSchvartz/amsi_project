import { useState, useEffect } from 'react';
import { getParametrizacoes, deleteParametrizacao, getTiposConta } from '../services/api';
import { useToast } from '../components/ToastStack.jsx';
import ModalConfirm from '../components/ModalConfirm.jsx';
import ParametrizacaoEditModal from '../components/ParametrizacaoEditModal.jsx';

/**
 * Página de gestão das parametrizações de lançamentos (Parâmetros → Parametrizar
 * Lançamentos). Reaproveita a lógica que antes vivia na ParametrizacaoListaModal,
 * agora como tela própria — o CRUD em si continua no ParametrizacaoEditModal.
 * Acesso restrito a Admin (gate na rota).
 */
function ParametrizacoesPage() {
	const { mostrarToast } = useToast();
	const [lista, setLista] = useState([]);
	const [tiposConta, setTiposConta] = useState([]);
	const [loading, setLoading] = useState(true);
	const [editando, setEditando] = useState(undefined); // undefined = fechado, null = novo, obj = editar
	const [confirmarDeletar, setConfirmarDeletar] = useState(null);

	const carregar = async () => {
		try {
			setLoading(true);
			const [dados, tipos] = await Promise.all([getParametrizacoes(), getTiposConta()]);
			setLista(dados);
			setTiposConta(tipos);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao carregar parametrizações', 'erro');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		carregar();
	}, []);

	const handleDeletar = async () => {
		try {
			await deleteParametrizacao(confirmarDeletar.id_parametrizacao);
			mostrarToast('Parametrização excluída com sucesso.');
			setConfirmarDeletar(null);
			carregar();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao excluir parametrização', 'erro');
			setConfirmarDeletar(null);
		}
	};

	const fmtValor = (v) =>
		v != null && v !== ''
			? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
			: '—';

	const thStyle = (align) => ({
		padding: '10px 14px',
		textAlign: align,
		color: 'var(--text-muted)',
		fontWeight: 600,
		position: 'sticky',
		top: 0,
		background: 'var(--input-bg)',
		zIndex: 1
	});

	return (
		<div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
			{confirmarDeletar && (
				<ModalConfirm
					titulo="Excluir Parametrização"
					mensagem={`Tem certeza que deseja excluir "${confirmarDeletar.nome}"?`}
					textoBotaoConfirmar="Excluir"
					textoBotaoCancelar="Cancelar"
					onConfirmar={handleDeletar}
					onCancelar={() => setConfirmarDeletar(null)}
					variante="perigo"
				/>
			)}

			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
				<h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>Parametrizar Lançamentos</h2>
				<button
					onClick={() => setEditando(null)}
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
					+ Nova
				</button>
			</div>

			{loading ? (
				<p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
			) : lista.length === 0 ? (
				<p style={{ color: 'var(--text-muted)' }}>Nenhuma parametrização cadastrada.</p>
			) : (
				<div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'auto', maxHeight: '60vh' }}>
					<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
						<thead>
							<tr style={{ borderBottom: '1px solid var(--border)' }}>
								<th style={thStyle('left')}>Nome</th>
								<th style={thStyle('left')}>Tipo de Conta</th>
								<th style={thStyle('center')}>Clifors</th>
								<th style={thStyle('right')}>Valor</th>
								<th style={thStyle('center')}>Ações</th>
							</tr>
						</thead>
						<tbody>
							{lista.map((p, i) => (
								<tr key={p.id_parametrizacao} style={{ borderBottom: i < lista.length - 1 ? '1px solid var(--border)' : 'none' }}>
									<td style={{ padding: '10px 14px', fontWeight: 500 }}>{p.nome}</td>
									<td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{p.descricao_tipo_conta || '—'}</td>
									<td style={{ padding: '10px 14px', textAlign: 'center' }}>{p.total}</td>
									<td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtValor(p.valor)}</td>
									<td style={{ padding: '10px 14px', textAlign: 'center' }}>
										<div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
											<button
												onClick={() => setEditando(p)}
												style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8rem' }}
											>
												<i className="bi bi-pencil"></i> Editar
											</button>
											<button
												onClick={() => setConfirmarDeletar(p)}
												style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}
											>
												<i className="bi bi-trash"></i>
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{editando !== undefined && (
				<ParametrizacaoEditModal
					parametrizacao={editando}
					tiposConta={tiposConta}
					onSalvar={() => {
						setEditando(undefined);
						carregar();
					}}
					onFechar={() => setEditando(undefined)}
				/>
			)}
		</div>
	);
}

export default ParametrizacoesPage;
