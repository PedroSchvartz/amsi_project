import { useState, useEffect } from 'react';
import ToastStack, { useToast } from '../components/ToastStack.jsx';
import { createLancamento, getClifors, getTiposConta, createTipoConta } from '../services/api';
import { getUserFromToken } from '../services/auth';

const FORM_INICIAL = {
	id_clifor_relacionado_fk: '',
	id_tipo_conta_fk: '',
	valor: '',
	data_vencimento: '',
	observacao: '',
	estorno: false
};

function LancamentoModal({ onFechar }) {
	const [clifors, setClifors] = useState([]);
	const [tiposConta, setTiposConta] = useState([]);
	const { toasts, mostrarToast, removerToast } = useToast();
	const [form, setForm] = useState(FORM_INICIAL);
	const [popup, setPopup] = useState(false);
	const [novoTipo, setNovoTipo] = useState({
		descricao_conta: '',
		natureza_conta: '',
		observacao: ''
	});

	useEffect(() => {
		carregarDados();
	}, []);

	const carregarDados = async () => {
		try {
			const [cs, ts] = await Promise.all([getClifors(), getTiposConta()]);
			setClifors(cs);
			setTiposConta(ts);
		} catch (err) {
			mostrarToast('Erro ao carregar dados: ' + err.message, 'erro');
		}
	};

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const usuario = getUserFromToken();
		if (!usuario) {
			mostrarToast('Sessão expirada.', 'erro');
			return;
		}

		const tipoSelecionado = tiposConta.find(
			(t) => t.id_tipo_conta === parseInt(form.id_tipo_conta_fk)
		);
		let natureza = tipoSelecionado?.natureza_conta;
		if (form.estorno) natureza = natureza === 'Debito' ? 'Credito' : 'Debito';

		try {
			await createLancamento({
				id_usuario_fk_lancamento: usuario.sub,
				id_clifor_relacionado_fk: parseInt(form.id_clifor_relacionado_fk),
				id_tipo_conta_fk: parseInt(form.id_tipo_conta_fk),
				valor: parseFloat(form.valor),
				data_vencimento: form.data_vencimento,
				natureza_lancamento: natureza,
				observacao: form.observacao || null,
				estorno: form.estorno
			});
			mostrarToast('Lançamento criado com sucesso!');
			setForm(FORM_INICIAL);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao criar lançamento', 'erro');
		}
	};

	const handleNovoTipoChange = (e) => setNovoTipo({ ...novoTipo, [e.target.name]: e.target.value });

	const handleSalvarTipo = async (e) => {
		e.preventDefault();
		try {
			const criado = await createTipoConta(novoTipo);
			const atualizado = await getTiposConta();
			setTiposConta(atualizado);
			setForm({ ...form, id_tipo_conta_fk: String(criado.id_tipo_conta) });
			setPopup(false);
			setNovoTipo({ descricao_conta: '', natureza_conta: '', observacao: '' });
		} catch (err) {
			mostrarToast(err.message || 'Erro ao criar tipo de conta', 'erro');
		}
	};

	const tipoSelecionado = tiposConta.find(
		(t) => t.id_tipo_conta === parseInt(form.id_tipo_conta_fk)
	);
	const naturezaExibida = tipoSelecionado
		? form.estorno
			? tipoSelecionado.natureza_conta === 'Debito'
				? 'Crédito (reembolso)'
				: 'Débito (reembolso)'
			: tipoSelecionado.natureza_conta
		: '—';

	return (
		<>
			<ToastStack toasts={toasts} onRemover={removerToast} />

			{/* Overlay principal */}
			<div
				style={{
					position: 'fixed',
					inset: 0,
					background: 'rgba(0,0,0,0.55)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 9980,
					overflowY: 'auto',
					padding: '20px'
				}}
				onClick={onFechar}
			>
				<div
					style={{
						background: 'var(--bg-card)',
						borderRadius: 14,
						width: '100%',
						maxWidth: 560,
						maxHeight: '90vh',
						overflowY: 'auto',
						padding: '32px 36px',
						boxShadow: '0 16px 48px var(--shadow)'
					}}
					onClick={(e) => e.stopPropagation()}
				>
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							marginBottom: 20
						}}
					>
						<h4
							style={{
								margin: 0,
								fontFamily: 'var(--font-display)',
								color: 'var(--primary)',
								fontWeight: 700
							}}
						>
							Novo Lançamento
						</h4>
						<button
							onClick={onFechar}
							style={{
								background: 'transparent',
								border: 'none',
								cursor: 'pointer',
								fontSize: '1.2rem',
								color: 'var(--text-muted)'
							}}
						>
							✕
						</button>
					</div>

					<form onSubmit={handleSubmit}>
						<div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
							<label
								style={{
									fontSize: '0.72rem',
									fontWeight: 500,
									color: 'var(--text-muted)',
									letterSpacing: '0.06em',
									textTransform: 'uppercase',
									marginBottom: 5
								}}
							>
								Cliente / Fornecedor
							</label>
							<select
								name="id_clifor_relacionado_fk"
								value={form.id_clifor_relacionado_fk}
								onChange={handleChange}
								required
							>
								<option value="">Selecione</option>
								{clifors.map((c) => (
									<option key={c.id_clifor} value={c.id_clifor}>
										{c.nome}
									</option>
								))}
							</select>
						</div>

						<div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
							<label
								style={{
									fontSize: '0.72rem',
									fontWeight: 500,
									color: 'var(--text-muted)',
									letterSpacing: '0.06em',
									textTransform: 'uppercase',
									marginBottom: 5
								}}
							>
								Tipo de Conta
							</label>
							<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
								<select
									name="id_tipo_conta_fk"
									value={form.id_tipo_conta_fk}
									onChange={handleChange}
									required
									style={{ flex: 1 }}
								>
									<option value="">Selecione</option>
									{tiposConta.map((t) => (
										<option key={t.id_tipo_conta} value={t.id_tipo_conta}>
											{t.descricao_conta}
										</option>
									))}
								</select>
								<button
									type="button"
									style={{
										padding: '8px 12px',
										borderRadius: 8,
										border: '1px solid var(--border)',
										background: 'var(--primary)',
										color: '#fff',
										fontWeight: 600,
										cursor: 'pointer',
										fontSize: '0.8rem',
										whiteSpace: 'nowrap'
									}}
									onClick={() => setPopup(true)}
								>
									+ Novo Tipo
								</button>
							</div>
						</div>

						<div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
							<label
								style={{
									fontSize: '0.72rem',
									fontWeight: 500,
									color: 'var(--text-muted)',
									letterSpacing: '0.06em',
									textTransform: 'uppercase',
									marginBottom: 5
								}}
							>
								Natureza
							</label>
							<input value={naturezaExibida} readOnly />
						</div>

						<div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
							<label
								style={{
									fontSize: '0.72rem',
									fontWeight: 500,
									color: 'var(--text-muted)',
									letterSpacing: '0.06em',
									textTransform: 'uppercase',
									marginBottom: 5
								}}
							>
								Descrição
							</label>
							<textarea
								name="observacao"
								value={form.observacao}
								onChange={handleChange}
								rows="3"
							/>
						</div>

						<div
							style={{
								display: 'grid',
								gridTemplateColumns: '1fr 1fr',
								gap: 12,
								alignItems: 'end',
								marginBottom: 14
							}}
						>
							<div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
								<label
									style={{
										fontSize: '0.72rem',
										fontWeight: 500,
										color: 'var(--text-muted)',
										letterSpacing: '0.06em',
										textTransform: 'uppercase',
										marginBottom: 5
									}}
								>
									Data de Vencimento
								</label>
								<input
									type="date"
									name="data_vencimento"
									value={form.data_vencimento}
									onChange={handleChange}
									required
								/>
							</div>
							<div style={{ display: 'flex', flexDirection: 'column' }}>
								<label
									style={{
										fontSize: '0.72rem',
										fontWeight: 500,
										color: 'var(--text-muted)',
										letterSpacing: '0.06em',
										textTransform: 'uppercase',
										marginBottom: 5
									}}
								>
									Valor
								</label>
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 8,
										border: '1px solid var(--border)',
										borderRadius: 8,
										padding: '0 10px',
										background: 'var(--input-bg)'
									}}
								>
									<span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>R$</span>
									<input
										type="number"
										name="valor"
										value={form.valor}
										onChange={handleChange}
										min="0"
										step="0.01"
										required
									/>
								</div>
							</div>
						</div>

						<div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
							<input
								type="checkbox"
								name="estorno"
								id="estorno"
								checked={form.estorno}
								onChange={handleChange}
								style={{ width: 'auto' }}
							/>
							<label htmlFor="estorno" style={{ marginBottom: 0 }}>
								Reembolso (inverte a natureza)
							</label>
						</div>

						<div
							style={{
								display: 'flex',
								justifyContent: 'flex-end',
								gap: 10,
								marginTop: 20,
								paddingTop: 16,
								borderTop: '1px solid var(--border)'
							}}
						>
							<button
								type="button"
								style={{
									padding: '8px 18px',
									borderRadius: 8,
									border: '1px solid var(--border)',
									background: 'transparent',
									color: 'var(--text)',
									fontWeight: 500,
									cursor: 'pointer'
								}}
								onClick={onFechar}
							>
								CANCELAR
							</button>
							<button
								type="submit"
								style={{
									padding: '8px 18px',
									borderRadius: 8,
									border: 'none',
									background: 'var(--primary)',
									color: '#fff',
									fontWeight: 600,
									cursor: 'pointer'
								}}
							>
								SALVAR
							</button>
						</div>
					</form>
				</div>
			</div>

			{/* Popup novo tipo de conta */}
			{popup && (
				<div className="popup-overlay" style={{ zIndex: 9990 }} onClick={() => setPopup(false)}>
					<div className="popup-box" onClick={(e) => e.stopPropagation()}>
						<h3>Novo Tipo de Conta</h3>
						<form onSubmit={handleSalvarTipo}>
							<div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
								<label
									style={{
										fontSize: '0.72rem',
										fontWeight: 500,
										color: 'var(--text-muted)',
										letterSpacing: '0.06em',
										textTransform: 'uppercase',
										marginBottom: 5
									}}
								>
									Nome da conta
								</label>
								<input
									name="descricao_conta"
									value={novoTipo.descricao_conta}
									onChange={handleNovoTipoChange}
									required
								/>
							</div>
							<div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
								<label
									style={{
										fontSize: '0.72rem',
										fontWeight: 500,
										color: 'var(--text-muted)',
										letterSpacing: '0.06em',
										textTransform: 'uppercase',
										marginBottom: 5
									}}
								>
									Natureza
								</label>
								<select
									name="natureza_conta"
									value={novoTipo.natureza_conta}
									onChange={handleNovoTipoChange}
									required
								>
									<option value="">Selecione</option>
									<option value="Debito">Débito</option>
									<option value="Credito">Crédito</option>
								</select>
							</div>
							<div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
								<label
									style={{
										fontSize: '0.72rem',
										fontWeight: 500,
										color: 'var(--text-muted)',
										letterSpacing: '0.06em',
										textTransform: 'uppercase',
										marginBottom: 5
									}}
								>
									Descrição
								</label>
								<textarea
									name="observacao"
									value={novoTipo.observacao}
									onChange={handleNovoTipoChange}
									rows="2"
								/>
							</div>
							<div
								style={{
									display: 'flex',
									justifyContent: 'flex-end',
									gap: 10,
									marginTop: 20,
									paddingTop: 16,
									borderTop: '1px solid var(--border)'
								}}
							>
								<button
									type="button"
									style={{
										padding: '8px 18px',
										borderRadius: 8,
										border: '1px solid var(--border)',
										background: 'transparent',
										color: 'var(--text)',
										fontWeight: 500,
										cursor: 'pointer'
									}}
									onClick={() => setPopup(false)}
								>
									CANCELAR
								</button>
								<button
									type="submit"
									style={{
										padding: '8px 18px',
										borderRadius: 8,
										border: 'none',
										background: 'var(--primary)',
										color: '#fff',
										fontWeight: 600,
										cursor: 'pointer'
									}}
								>
									SALVAR
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>
	);
}

export default LancamentoModal;
