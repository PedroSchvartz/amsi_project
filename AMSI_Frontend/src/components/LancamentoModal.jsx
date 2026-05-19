import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../components/ToastStack.jsx';
import { createLancamento, getClifors, getTiposConta, createTipoConta } from '../services/api';
import { getUserFromToken, isAdmin } from '../services/auth';
import '../styles/lancamento.css';

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
	const { mostrarToast } = useToast();
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
		const val = type === 'checkbox' ? checked
			: name === 'valor' ? value.replace(/[^0-9,]/g, '')
			: value;
		setForm({ ...form, [name]: val });
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
				valor: parseFloat(form.valor.replace(',', '.')),
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

	return createPortal(
		<>
			<div className="lm-wrapper" onClick={onFechar}>
				<div className="lm-container" onClick={(e) => e.stopPropagation()}>
					<div className="lm-header">
						<h2>Novo Lançamento</h2>
						<button type="button" className="lm-fechar" onClick={onFechar}>
							✕
						</button>
					</div>

					<form onSubmit={handleSubmit} className="box">
						<label>Cliente / Fornecedor</label>
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

						<div className="lm-tipo-row">
						<div>
							<label>Tipo de Conta</label>
							<select
								name="id_tipo_conta_fk"
								value={form.id_tipo_conta_fk}
								onChange={handleChange}
								required
							>
								<option value="">Selecione</option>
								{tiposConta.map((t) => (
									<option key={t.id_tipo_conta} value={t.id_tipo_conta}>
										{t.descricao_conta}
									</option>
								))}
							</select>
						</div>
						<div>
							<label>Natureza</label>
							<input value={naturezaExibida} readOnly />
						</div>
					</div>

					<div className="lm-row3">
						<div>
							<label>Data de Vencimento</label>
							<input
								type="date"
								name="data_vencimento"
								value={form.data_vencimento}
								onChange={handleChange}
								required
							/>
						</div>
						<div>
							<label>Valor</label>
							<div className="input-valor">
								<input
									type="text"
									inputMode="decimal"
									name="valor"
									value={form.valor}
									onChange={handleChange}
									placeholder="0,00"
									required
								/>
							</div>
						</div>
						<div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
							<label>Reembolso</label>
							<label style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
								<input
									type="checkbox"
									name="estorno"
									checked={form.estorno}
									onChange={handleChange}
									style={{ width: 'auto', accentColor: 'var(--primary)' }}
								/>
								Inverte natureza
							</label>
						</div>
					</div>

					<div>
						<label>Descrição</label>
						<textarea name="observacao" value={form.observacao} onChange={handleChange} rows="2" />
					</div>

					<hr style={{ margin: '20px 0 0', border: 'none', borderTop: '1px solid var(--border)' }} />
					<div className="lm-footer">
						<div>
							{isAdmin() && (
								<button type="button" className="novo-tipo" onClick={() => setPopup(true)}>
									+ Novo Tipo
								</button>
							)}
						</div>
						<div className="lm-footer-right">
							<button type="button" className="cancel" onClick={onFechar}>
								CANCELAR
							</button>
							<button type="submit" className="save">
								SALVAR
							</button>
						</div>
					</div>
					</form>
				</div>
			</div>

			{popup && (
				<div className="popup-overlay" style={{ zIndex: 9990 }} onClick={() => setPopup(false)}>
					<div className="popup-box" onClick={(e) => e.stopPropagation()}>
						<h3>Novo Tipo de Conta</h3>
						<form onSubmit={handleSalvarTipo} className="box">
							<label>Nome da conta</label>
							<input
								name="descricao_conta"
								value={novoTipo.descricao_conta}
								onChange={handleNovoTipoChange}
								required
							/>

							<label>Natureza</label>
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

							<label>Descrição</label>
							<textarea
								name="observacao"
								value={novoTipo.observacao}
								onChange={handleNovoTipoChange}
								rows="2"
							/>

							<div className="buttons">
								<button type="button" className="cancel" onClick={() => setPopup(false)}>
									CANCELAR
								</button>
								<button type="submit" className="save">
									SALVAR
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>,
		document.body
	);
}

export default LancamentoModal;
