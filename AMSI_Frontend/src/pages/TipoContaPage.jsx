import { useState, useEffect } from 'react';
import { getTiposConta, createTipoConta, updateTipoConta, deleteTipoConta } from '../services/api';
import ToastStack, { useToast } from '../components/ToastStack.jsx';
import ModalConfirm from '../components/ModalConfirm.jsx';

const FORM_INICIAL = { descricao_conta: '', natureza_conta: 'Credito', observacao: '' };

function TipoContaPage() {
	const { toasts, mostrarToast, removerToast } = useToast();
	const [tipos, setTipos] = useState([]);
	const [loading, setLoading] = useState(true);

	const [modalAberto, setModalAberto] = useState(false);
	const [editando, setEditando] = useState(null);
	const [form, setForm] = useState(FORM_INICIAL);

	const [confirmarDeletar, setConfirmarDeletar] = useState(null);

	useEffect(() => {
		carregar();
	}, []);

	const carregar = async () => {
		try {
			setLoading(true);
			const data = await getTiposConta();
			setTipos(data);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao carregar tipos de conta', 'erro');
		} finally {
			setLoading(false);
		}
	};

	const abrirNovo = () => {
		setEditando(null);
		setForm(FORM_INICIAL);
		setModalAberto(true);
	};

	const abrirEditar = (t) => {
		setEditando(t);
		setForm({ descricao_conta: t.descricao_conta, natureza_conta: t.natureza_conta, observacao: t.observacao || '' });
		setModalAberto(true);
	};

	const handleSalvar = async (e) => {
		e.preventDefault();
		try {
			const payload = {
				descricao_conta: form.descricao_conta,
				natureza_conta: form.natureza_conta,
				observacao: form.observacao || null
			};
			if (editando) {
				await updateTipoConta(editando.id_tipo_conta, payload);
				mostrarToast('Tipo de conta atualizado com sucesso.');
			} else {
				await createTipoConta(payload);
				mostrarToast('Tipo de conta criado com sucesso.');
			}
			setModalAberto(false);
			carregar();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao salvar tipo de conta', 'erro');
		}
	};

	const handleDeletar = async () => {
		try {
			await deleteTipoConta(confirmarDeletar.id_tipo_conta);
			mostrarToast('Tipo de conta excluído com sucesso.');
			setConfirmarDeletar(null);
			carregar();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao excluir tipo de conta', 'erro');
			setConfirmarDeletar(null);
		}
	};

	return (
		<div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
			<ToastStack toasts={toasts} onRemover={removerToast} />

			{confirmarDeletar && (
				<ModalConfirm
					titulo="Excluir Tipo de Conta"
					mensagem={`Tem certeza que deseja excluir "${confirmarDeletar.descricao_conta}"? Caso esteja em uso em lançamentos, a exclusão será bloqueada.`}
					textoBotaoConfirmar="Excluir"
					textoBotaoCancelar="Cancelar"
					onConfirmar={handleDeletar}
					onCancelar={() => setConfirmarDeletar(null)}
					variante="perigo"
				/>
			)}

			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
				<h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>Tipos de Conta</h2>
				<button
					onClick={abrirNovo}
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
					+ Novo Tipo
				</button>
			</div>

			{loading ? (
				<p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
			) : tipos.length === 0 ? (
				<p style={{ color: 'var(--text-muted)' }}>Nenhum tipo de conta cadastrado.</p>
			) : (
				<div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
					<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
						<thead>
							<tr style={{ background: 'var(--input-bg)', borderBottom: '1px solid var(--border)' }}>
								<th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Cód.</th>
								<th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Descrição</th>
								<th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Natureza</th>
								<th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Observação</th>
								<th style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Ações</th>
							</tr>
						</thead>
						<tbody>
							{tipos.map((t, i) => (
								<tr
									key={t.id_tipo_conta}
									style={{ borderBottom: i < tipos.length - 1 ? '1px solid var(--border)' : 'none' }}
								>
									<td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{t.id_tipo_conta}</td>
									<td style={{ padding: '10px 14px', fontWeight: 500 }}>{t.descricao_conta}</td>
									<td style={{ padding: '10px 14px' }}>
										<span
											style={{
												padding: '2px 10px',
												borderRadius: 12,
												fontSize: '0.78rem',
												fontWeight: 600,
												background: t.natureza_conta === 'Credito' ? '#dcfce7' : '#fee2e2',
												color: t.natureza_conta === 'Credito' ? '#16a34a' : '#b91c1c'
											}}
										>
											{t.natureza_conta === 'Credito' ? 'Crédito' : 'Débito'}
										</span>
									</td>
									<td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
										{t.observacao || '—'}
									</td>
									<td style={{ padding: '10px 14px', textAlign: 'center' }}>
										<div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
											<button
												onClick={() => abrirEditar(t)}
												style={{
													padding: '4px 12px',
													borderRadius: 6,
													border: '1px solid var(--border)',
													background: 'transparent',
													color: 'var(--text)',
													cursor: 'pointer',
													fontSize: '0.8rem'
												}}
											>
												<i className="bi bi-pencil"></i> Editar
											</button>
											<button
												onClick={() => setConfirmarDeletar(t)}
												style={{
													padding: '4px 10px',
													borderRadius: 6,
													border: '1px solid #ef4444',
													background: 'transparent',
													color: '#ef4444',
													cursor: 'pointer',
													fontSize: '0.8rem'
												}}
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

			{/* Modal criar/editar */}
			{modalAberto && (
				<div
					style={{
						position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
						display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 20
					}}
					onClick={() => setModalAberto(false)}
				>
					<div
						style={{
							background: 'var(--bg-card)', borderRadius: 14, maxWidth: 460, width: '100%',
							padding: '28px 32px', boxShadow: '0 16px 48px var(--shadow)'
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<h3 style={{ margin: '0 0 20px', fontFamily: 'var(--font-display)' }}>
							{editando ? 'Editar Tipo de Conta' : 'Novo Tipo de Conta'}
						</h3>

						<form onSubmit={handleSalvar}>
							<div style={{ marginBottom: 14 }}>
								<label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
									Descrição *
								</label>
								<input
									type="text"
									value={form.descricao_conta}
									onChange={(e) => setForm({ ...form, descricao_conta: e.target.value })}
									required
									style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box' }}
								/>
							</div>

							<div style={{ marginBottom: 14 }}>
								<label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
									Natureza *
								</label>
								<select
									value={form.natureza_conta}
									onChange={(e) => setForm({ ...form, natureza_conta: e.target.value })}
									required
									style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
								>
									<option value="Credito">Crédito</option>
									<option value="Debito">Débito</option>
								</select>
							</div>

							<div style={{ marginBottom: 20 }}>
								<label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
									Observação
								</label>
								<textarea
									value={form.observacao}
									onChange={(e) => setForm({ ...form, observacao: e.target.value })}
									rows="2"
									style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box' }}
								/>
							</div>

							<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
								<button
									type="button"
									onClick={() => setModalAberto(false)}
									style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}
								>
									Cancelar
								</button>
								<button
									type="submit"
									style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
								>
									{editando ? 'Salvar' : 'Criar'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

export default TipoContaPage;
