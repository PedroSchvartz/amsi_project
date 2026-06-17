import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../components/ToastStack.jsx';
import { createLancamento, createLancamentoMassa, getClifors, getTiposConta, createTipoConta } from '../services/api';
import { getUserFromToken, isAdmin, hasPerfilMinimo } from '../services/auth';
import MassaCliforSeletorModal from './MassaCliforSeletorModal.jsx';
import '../styles/lancamento.css';

const FORM_INICIAL = {
	id_tipo_conta_fk: '',
	valor: '',
	data_vencimento: '',
	observacao: '',
	estorno: false
};

function rassurarCpfCnpj(doc) {
	if (!doc) return '—';
	const d = doc.replace(/\D/g, '');
	if (d.length === 11) return `***.***.${d.slice(6, 9)}-**`;
	if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****.${d.slice(12)}`;
	return doc;
}

function LancamentoModal({ onFechar }) {
	const [clifors, setClifors] = useState([]);
	const [tiposConta, setTiposConta] = useState([]);
	const { mostrarToast } = useToast();
	const [form, setForm] = useState(FORM_INICIAL);
	const [clifforsSelecionados, setClifforsSelecionados] = useState([]);
	const [seletorAberto, setSeletorAberto] = useState(false);
	const [confirmarMassa, setConfirmarMassa] = useState(false);
	const [cpfRevelado, setCpfRevelado] = useState({});
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

	const modoMassa = clifforsSelecionados.length >= 2;

	// Natureza efetiva (tipo de conta + flip de reembolso) — usada na criação
	const calcularNatureza = () => {
		const tipoSelecionado = tiposConta.find(
			(t) => t.id_tipo_conta === parseInt(form.id_tipo_conta_fk)
		);
		let natureza = tipoSelecionado?.natureza_conta;
		if (form.estorno) natureza = natureza === 'Debito' ? 'Credito' : 'Debito';
		return natureza;
	};

	// Validações comuns a ambos os fluxos; retorna o usuário ou null
	const validar = () => {
		const usuario = getUserFromToken();
		if (!usuario) {
			mostrarToast('Sessão expirada.', 'erro');
			return null;
		}
		if (clifforsSelecionados.length === 0) {
			mostrarToast('Selecione o cliente/fornecedor.', 'aviso');
			return null;
		}
		if (!form.id_tipo_conta_fk) {
			mostrarToast('Selecione o tipo de conta.', 'aviso');
			return null;
		}
		if (!form.valor || parseFloat(form.valor.replace(',', '.')) <= 0) {
			mostrarToast('Informe um valor válido.', 'aviso');
			return null;
		}
		if (!form.data_vencimento) {
			mostrarToast('Informe a data de vencimento.', 'aviso');
			return null;
		}
		return usuario;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const usuario = validar();
		if (!usuario) return;

		// 2+ selecionados → confirmação antes de criar em massa
		if (modoMassa) {
			setCpfRevelado({});
			setConfirmarMassa(true);
			return;
		}

		// 1 selecionado → fluxo único (inalterado)
		try {
			await createLancamento({
				id_usuario_fk_lancamento: usuario.sub,
				id_clifor_relacionado_fk: clifforsSelecionados[0],
				id_tipo_conta_fk: parseInt(form.id_tipo_conta_fk),
				valor: parseFloat(form.valor.replace(',', '.')),
				data_vencimento: form.data_vencimento,
				natureza_lancamento: calcularNatureza(),
				observacao: form.observacao || null,
				estorno: form.estorno
			});
			mostrarToast('Lançamento criado com sucesso!');
			setForm(FORM_INICIAL);
			setClifforsSelecionados([]);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao criar lançamento', 'erro');
		}
	};

	const handleConfirmarMassa = async () => {
		const usuario = getUserFromToken();
		if (!usuario) {
			mostrarToast('Sessão expirada.', 'erro');
			return;
		}
		try {
			const resultado = await createLancamentoMassa({
				id_usuario_fk_lancamento: usuario.sub,
				ids_clifor: clifforsSelecionados,
				id_tipo_conta_fk: parseInt(form.id_tipo_conta_fk),
				valor: parseFloat(form.valor.replace(',', '.')),
				data_vencimento: form.data_vencimento,
				natureza_lancamento: calcularNatureza(),
				observacao: form.observacao || null
			});
			mostrarToast(`${resultado.total_criados} lançamentos criados com sucesso!`);
			setConfirmarMassa(false);
			setForm(FORM_INICIAL);
			setClifforsSelecionados([]);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao criar lançamentos em massa', 'erro');
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

	const clifsSelecionados = clifforsSelecionados.map((id) => {
		const c = clifors.find((x) => x.id_clifor === id);
		return {
			id,
			nome: c?.nome || `#${id}`,
			cpf: c?.cpf_cnpj || null,
			doc: rassurarCpfCnpj(c?.cpf_cnpj)
		};
	});
	const valorNumerico = parseFloat((form.valor || '').replace(',', '.')) || 0;
	const totalMassa = valorNumerico * clifforsSelecionados.length;
	const fmtBRL = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	return createPortal(
		<>
			<div className="lm-wrapper" onClick={onFechar}>
				<div className="lm-container" onClick={(e) => e.stopPropagation()}>
					<div className="lm-header">
						<h2>{modoMassa ? 'Novo Lançamento em Massa' : 'Novo Lançamento'}</h2>
						<button type="button" className="lm-fechar" onClick={onFechar}>
							✕
						</button>
					</div>

					<form onSubmit={handleSubmit} className="box">
						<label>Cliente / Fornecedor</label>
						<div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
							{modoMassa ? (
								<input
									style={{ flex: 1, minWidth: 0 }}
									value={`${clifforsSelecionados.length} clientes/fornecedores selecionados`}
									readOnly
									title="Clique em 'Editar seleção' para alterar"
								/>
							) : (
								<select
									style={{ flex: 1, minWidth: 0 }}
									name="id_clifor_relacionado_fk"
									value={clifforsSelecionados[0] != null ? String(clifforsSelecionados[0]) : ''}
									onChange={(e) => {
										const v = e.target.value;
										setClifforsSelecionados(v ? [parseInt(v)] : []);
									}}
									required
								>
									<option value="">Selecione</option>
									{clifors.map((c) => (
										<option key={c.id_clifor} value={c.id_clifor}>
											{c.nome}
										</option>
									))}
								</select>
							)}
							{hasPerfilMinimo('Operador') && (
								<button
									type="button"
									className="save"
									style={{ flex: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}
									onClick={() => setSeletorAberto(true)}
								>
									<i className="bi bi-people-fill" />
									{modoMassa ? 'Editar seleção' : 'Vários'}
								</button>
							)}
						</div>

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
							<input value={naturezaExibida} readOnly title="Preenchido automaticamente ao selecionar o Tipo de Conta" />
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

			{seletorAberto && (
				<MassaCliforSeletorModal
					selecionados={clifforsSelecionados}
					onConfirmar={(ids) => {
						setClifforsSelecionados(ids);
						setSeletorAberto(false);
					}}
					onFechar={() => setSeletorAberto(false)}
				/>
			)}

			{confirmarMassa && (
				<div className="popup-overlay" style={{ zIndex: 9996 }} onClick={() => setConfirmarMassa(false)}>
					<div className="popup-box" onClick={(e) => e.stopPropagation()}>
						<h3>Confirmar lançamento em massa</h3>
						<p style={{ fontSize: '0.9rem', color: 'var(--text)', margin: '0 0 12px' }}>
							Serão criados <strong>{clifforsSelecionados.length} lançamentos</strong> de{' '}
							<strong>R$ {fmtBRL(valorNumerico)}</strong> cada.
						</p>
						<p style={{ fontSize: '0.95rem', color: 'var(--primary)', fontWeight: 600, margin: '0 0 14px' }}>
							Valor total: R$ {fmtBRL(totalMassa)}
						</p>
						<details style={{ marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
							<summary style={{ cursor: 'pointer' }}>Ver clientes/fornecedores selecionados</summary>
							<ul style={{ margin: '8px 0 0', paddingLeft: 20, maxHeight: 180, overflowY: 'auto' }}>
								{clifsSelecionados.map((c) => (
									<li key={c.id}>
										{c.nome}{' '}
										<span
											onClick={() => c.cpf && setCpfRevelado((p) => ({ ...p, [c.id]: !p[c.id] }))}
											title={c.cpf ? (cpfRevelado[c.id] ? 'Clique para ocultar' : 'Clique para conferir o documento completo') : 'Sem documento'}
											style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.8rem', cursor: c.cpf ? 'pointer' : 'default' }}
										>
											— {cpfRevelado[c.id] ? (c.cpf || '—') : c.doc}
										</span>
									</li>
								))}
							</ul>
						</details>
						<div className="buttons" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
							<button type="button" className="cancel" onClick={() => setConfirmarMassa(false)}>
								CANCELAR
							</button>
							<button type="button" className="save" onClick={handleConfirmarMassa}>
								CRIAR {clifforsSelecionados.length}
							</button>
						</div>
					</div>
				</div>
			)}

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
