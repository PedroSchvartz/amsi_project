import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Lancamento.css';
import { createLancamento, getClifors, getTiposConta, createTipoConta } from '../services/api';
import { getUserFromToken } from '../services/auth';

function LancamentoPage() {
	const navigate = useNavigate();

	const [clifors, setClifors] = useState([]);
	const [tiposConta, setTiposConta] = useState([]);
	const [erro, setErro] = useState('');
	const [sucesso, setSucesso] = useState('');

	const [form, setForm] = useState({
		id_clifor_relacionado_fk: '',
		id_tipo_conta_fk: '',
		valor: '',
		data_vencimento: '',
		observacao: '',
		estorno: false
	});

	const [popup, setPopup] = useState(false);
	const [novoTipo, setNovoTipo] = useState({
		descricao_conta: '',
		natureza_conta: '',
		observacao: ''
	});
	const [erroPopup, setErroPopup] = useState('');

	useEffect(() => {
		carregarDados();
	}, []);

	const carregarDados = async () => {
		try {
			const [cs, ts] = await Promise.all([getClifors(), getTiposConta()]);
			setClifors(cs);
			setTiposConta(ts);
		} catch (err) {
			setErro('Erro ao carregar dados: ' + err.message);
		}
	};

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setErro('');
		setSucesso('');

		const usuario = getUserFromToken();
		if (!usuario) {
			setErro('Sessão expirada.');
			return;
		}

		const tipoSelecionado = tiposConta.find(
			(t) => t.id_tipo_conta === parseInt(form.id_tipo_conta_fk)
		);

		let natureza = tipoSelecionado?.natureza_conta;
		if (form.estorno) {
			natureza = natureza === 'Debito' ? 'Credito' : 'Debito';
		}

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

			setSucesso('Lançamento criado com sucesso!');
			setForm({
				id_clifor_relacionado_fk: '',
				id_tipo_conta_fk: '',
				valor: '',
				data_vencimento: '',
				observacao: '',
				estorno: false
			});
		} catch (err) {
			setErro(err.message || 'Erro ao criar lançamento');
		}
	};

	const handleNovoTipoChange = (e) => {
		setNovoTipo({ ...novoTipo, [e.target.name]: e.target.value });
	};

	const handleSalvarTipo = async (e) => {
		e.preventDefault();
		setErroPopup('');

		try {
			const criado = await createTipoConta(novoTipo);
			const atualizado = await getTiposConta();
			setTiposConta(atualizado);
			setForm({ ...form, id_tipo_conta_fk: String(criado.id_tipo_conta) });
			setPopup(false);
			setNovoTipo({ descricao_conta: '', natureza_conta: '', observacao: '' });
		} catch (err) {
			setErroPopup(err.message || 'Erro ao criar tipo de conta');
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
		<div className="container">
			<div className="box">
				<h2>Cadastro de Lançamentos</h2>

				<form onSubmit={handleSubmit}>
					<h4>INFORMAÇÕES BÁSICAS</h4>

					<div className="row">
						<div className="field">
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
						</div>
					</div>

					<div className="row">
						<div className="field">
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
						<button type="button" className="novo-tipo" onClick={() => setPopup(true)}>
							+ Novo Tipo
						</button>
					</div>

					<div className="field">
						<label>Natureza</label>
						<input value={naturezaExibida} readOnly />
					</div>

					<div className="field">
						<label>Descrição</label>
						<textarea name="observacao" value={form.observacao} onChange={handleChange} rows="3" />
					</div>

					<h4>INFORMAÇÕES DO PAGAMENTO</h4>

					<div className="row">
						<div className="field">
							<label>Data de Vencimento</label>
							<input
								type="date"
								name="data_vencimento"
								value={form.data_vencimento}
								onChange={handleChange}
								required
							/>
						</div>

						<div className="field valor">
							<label>Valor</label>
							<div className="input-valor">
								<span>R$</span>
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

					<div
						className="field"
						style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}
					>
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

					<div className="buttons">
						<button type="button" className="cancel" onClick={() => navigate('/home')}>
							CANCELAR
						</button>
						<button type="submit" className="save">
							SALVAR
						</button>
					</div>
				</form>

				{erro && <p style={{ color: 'red', marginTop: '10px' }}>{erro}</p>}
				{sucesso && <p style={{ color: 'green', marginTop: '10px' }}>{sucesso}</p>}
			</div>

			{/* Popup novo tipo de conta */}
			{popup && (
				<div className="popup-overlay" onClick={() => setPopup(false)}>
					<div className="popup-box" onClick={(e) => e.stopPropagation()}>
						<h3>Novo Tipo de Conta</h3>

						<form onSubmit={handleSalvarTipo}>
							<div className="field">
								<label>Nome da conta</label>
								<input
									name="descricao_conta"
									value={novoTipo.descricao_conta}
									onChange={handleNovoTipoChange}
									required
								/>
							</div>

							<div className="field">
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
							</div>

							<div className="field">
								<label>Descrição</label>
								<textarea
									name="observacao"
									value={novoTipo.observacao}
									onChange={handleNovoTipoChange}
									rows="2"
								/>
							</div>

							{erroPopup && <p style={{ color: 'red' }}>{erroPopup}</p>}

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
		</div>
	);
}

export default LancamentoPage;
