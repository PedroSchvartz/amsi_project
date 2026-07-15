import { useState, useEffect } from 'react';
import LancamentoModal from '../components/LancamentoModal.jsx';
import LoteLancamentosModal from '../components/LoteLancamentosModal.jsx';
import { useSearchParams } from 'react-router-dom';
import ModalConfirm from '../components/ModalConfirm.jsx';
import PerfilCompletoPopup from '../components/PerfilCompletoPopup.jsx';
import SituacaoBadge from '../components/SituacaoBadge.jsx';
import TimelineLancamentoModal, { ultimaInteracao, formatarCarimbo } from '../components/TimelineLancamentoModal.jsx';
import { useToast } from '../components/ToastStack.jsx';
import '../styles/listaLancamentos.css';
import {
	getLancamentos,
	fecharLancamento,
	aprovarLancamento,
	editarLancamento,
	deleteLancamento,
	getClifors,
	getTiposConta,
	anexarComprovante,
	baixarComprovante,
	removerComprovante,
	getUser
} from '../services/api';
import { isAdmin, isConsulta, hasPerfilMinimo } from '../services/auth';

function rassurarCpfCnpj(doc) {
	if (!doc) return '—';
	const d = doc.replace(/\D/g, '');
	if (d.length === 11) return `***.***.${d.slice(6, 9)}-**`;
	if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****.${d.slice(12)}`;
	return doc;
}

// Data de hoje no fuso local (YYYY-MM-DD). Não usar toISOString aqui: em UTC-3 à noite
// ele já retorna o dia seguinte, o que pré-preencheria a data de pagamento errada.
function hojeLocal() {
	const d = new Date();
	const mes = String(d.getMonth() + 1).padStart(2, '0');
	const dia = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${mes}-${dia}`;
}

const FILTROS_INICIAL = {
	id_clifor: '',
	id_tipo_conta: '',
	natureza: '',
	apenas_abertos: '',
	apenas_vencidos: '',
	apenas_em_analise: '',
	apenas_quitados: '',
	apenas_com_comprovante: '',
	apenas_sem_comprovante: '',
	data_vencimento_de: '',
	data_vencimento_ate: '',
	data_lancamento_de: '',
	data_lancamento_ate: '',
	data_pagamento_de: '',
	data_pagamento_ate: '',
	estorno: '',
	valor_minimo: '',
	valor_maximo: ''
};

const FECHAR_INICIAL = {
	data_pagamento: '',
	valor_pago: '',
	multa: '',
	juros: '',
	observacao_pagamento: '',
	estorno: false
};

const EDITAR_INICIAL = {
	id_clifor_relacionado_fk: '',
	id_tipo_conta_fk: '',
	valor: '',
	data_vencimento: '',
	natureza_lancamento: '',
	observacao: '',
	estorno: false,
	data_pagamento: '',
	valor_pago: '',
	multa: '',
	juros: '',
	observacao_pagamento: ''
};

function ListaLancamentosPage() {
	const [searchParams] = useSearchParams();
	const [modalAberto, setModalAberto] = useState(false);
	const [cpfVisivelLanc, setCpfVisivelLanc] = useState({});
	const [loteModal, setLoteModal] = useState(null);
	const [loteRefresh, setLoteRefresh] = useState(0); // bump → refaz o fetch do LoteLancamentosModal
	// Empilhamento: o modal aberto por último fica por cima. `loteAcima` true quando o
	// modal do lote foi aberto a partir de um modal de detalhe (chip de origem); false
	// quando um modal de detalhe foi aberto a partir de uma linha do lote.
	const [loteAcima, setLoteAcima] = useState(false);
	const [lancamentos, setLancamentos] = useState([]);
	const [clifors, setClifors] = useState([]);
	const [tiposConta, setTiposConta] = useState([]);
	const [filtros, setFiltros] = useState(FILTROS_INICIAL);
	const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_INICIAL);
	const { mostrarToast } = useToast();

	const [modalFechar, setModalFechar] = useState(null);
	const [formFechar, setFormFechar] = useState(FECHAR_INICIAL);
	const [comprovante, setComprovante] = useState(null);
	const [lancamentoSelecionado, setLancamentoSelecionado] = useState(null);
	const [confirmarRemoverComprovante, setConfirmarRemoverComprovante] = useState(false);
	const [modalAprovar, setModalAprovar] = useState(null);

	const [modalEditar, setModalEditar] = useState(null);
	const [formEditar, setFormEditar] = useState(EDITAR_INICIAL);
	const [confirmarDeletar, setConfirmarDeletar] = useState(false);
	const [modalVer, setModalVer] = useState(null);
	const [timelineModal, setTimelineModal] = useState(null); // lançamento cujo histórico está aberto
	const [perfilUsuario, setPerfilUsuario] = useState(null); // usuário aberto a partir da linha do tempo

	const admin = isAdmin();

	useEffect(() => {
		carregarAuxiliares();
		if (searchParams.has('origemDashboard')) {
			const f = { ...FILTROS_INICIAL };
			for (const [key, val] of searchParams.entries()) {
				if (key !== 'origemDashboard' && key in FILTROS_INICIAL) f[key] = val;
			}
			setFiltros(f);
			buscar(f);
		} else {
			buscar();
		}
	}, []);

	const carregarAuxiliares = async () => {
		try {
			const [cs, ts] = await Promise.all([getClifors(), getTiposConta()]);
			setClifors(cs);
			setTiposConta(ts);
		} catch {}
	};

	const buscar = async (f = filtros) => {
		try {
			const params = {};
			if (f.id_clifor) params.id_clifor = parseInt(f.id_clifor);
			if (f.id_tipo_conta) params.id_tipo_conta = parseInt(f.id_tipo_conta);
			if (f.natureza) params.natureza = f.natureza;
			if (f.apenas_abertos !== '') params.apenas_abertos = f.apenas_abertos === 'true';
			if (f.apenas_vencidos !== '') params.apenas_vencidos = f.apenas_vencidos === 'true';
			if (f.apenas_em_analise !== '') params.apenas_em_analise = f.apenas_em_analise === 'true';
			if (f.apenas_quitados !== '') params.apenas_quitados = f.apenas_quitados === 'true';
			if (f.apenas_com_comprovante !== '')
				params.apenas_com_comprovante = f.apenas_com_comprovante === 'true';
			if (f.apenas_sem_comprovante !== '')
				params.apenas_sem_comprovante = f.apenas_sem_comprovante === 'true';
			if (f.data_vencimento_de) params.data_vencimento_de = f.data_vencimento_de;
			if (f.data_vencimento_ate) params.data_vencimento_ate = f.data_vencimento_ate;
			if (f.data_lancamento_de) params.data_lancamento_de = f.data_lancamento_de;
			if (f.data_lancamento_ate) params.data_lancamento_ate = f.data_lancamento_ate;
			if (f.data_pagamento_de) params.data_pagamento_de = f.data_pagamento_de;
			if (f.data_pagamento_ate) params.data_pagamento_ate = f.data_pagamento_ate;
			if (f.estorno !== '') params.estorno = f.estorno === 'true';
			if (f.valor_minimo) params.valor_minimo = parseFloat(f.valor_minimo.replace(',', '.'));
			if (f.valor_maximo) params.valor_maximo = parseFloat(f.valor_maximo.replace(',', '.'));
			const data = await getLancamentos(params);
			setLancamentos(data);
			setFiltrosAplicados(f);
		} catch (err) {
			if (err.message !== 'sessao-expirada')
				mostrarToast(err.message || 'Erro ao buscar lançamentos', 'erro');
		}
	};

	const handleFiltroChange = (e) => {
		const { name, value } = e.target;
		const monetarios = ['valor_minimo', 'valor_maximo'];
		setFiltros({ ...filtros, [name]: monetarios.includes(name) ? value.replace(/[^0-9,]/g, '') : value });
	};

	const handleAplicar = (e) => {
		e.preventDefault();
		buscar(filtros);
	};

	const handleLimpar = () => {
		setFiltros(FILTROS_INICIAL);
		buscar(FILTROS_INICIAL);
	};

	const filtrosPendentes = JSON.stringify(filtros) !== JSON.stringify(filtrosAplicados);

	// ── Helpers de nome com fallback local ─────────────────────────────────────
	const nomeClifor = (l) =>
		l.nome_clifor || clifors.find((c) => c.id_clifor === l.id_clifor_relacionado_fk)?.nome || '—';

	const nomeTipo = (l) => {
		const desc = l.descricao_tipo_conta || tiposConta.find((t) => t.id_tipo_conta === l.id_tipo_conta_fk)?.descricao_conta;
		return desc ? `${l.id_tipo_conta_fk} - ${desc}` : l.id_tipo_conta_fk;
	};

	const formatarTotal = (l) => {
		if (l.valor_pago == null) return '—';
		const total = (parseFloat(l.valor_pago) || 0) + (parseFloat(l.multa) || 0) + (parseFloat(l.juros) || 0);
		return total.toFixed(2).replace('.', ',');
	};

	// ── Modal fechar ────────────────────────────────────────────────────────────
	const abrirModalFechar = (l) => {
		setModalFechar(l.id_lancamento);
		setLancamentoSelecionado(l);
		setFormFechar({
			...FECHAR_INICIAL,
			data_pagamento: hojeLocal(),
			observacao_pagamento: l.observacao_pagamento || '',
			valor_pago: l.valor_pago ? String(l.valor_pago).replace('.', ',') : String(l.valor).replace('.', ',')
		});
		setComprovante(null);
	};

	const handleRemoverComprovante = async () => {
		try {
			await removerComprovante(lancamentoSelecionado.id_lancamento);
			setLancamentoSelecionado({ ...lancamentoSelecionado, tem_comprovante: false, comprovante_nome: null });
			setConfirmarRemoverComprovante(false);
			mostrarToast('Comprovante removido com sucesso.');
		} catch (err) {
			if (err.message !== 'sessao-expirada')
				mostrarToast(err.message || 'Erro ao remover comprovante', 'erro');
			setConfirmarRemoverComprovante(false);
		}
	};

	const handleFecharChange = (e) => {
		const { name, value, type, checked } = e.target;
		const monetarios = ['valor_pago', 'multa', 'juros'];
		const val = type === 'checkbox' ? checked
			: monetarios.includes(name) ? value.replace(/[^0-9,]/g, '')
			: value;
		setFormFechar({ ...formFechar, [name]: val });
	};

	const totalPago = () => {
		const v = parseFloat((formFechar.valor_pago || '').replace(',', '.')) || 0;
		const m = parseFloat((formFechar.multa || '').replace(',', '.')) || 0;
		const j = parseFloat((formFechar.juros || '').replace(',', '.')) || 0;
		return v + m + j;
	};

	const totalPagoEditar = () => {
		const v = parseFloat((formEditar.valor_pago || '').replace(',', '.')) || 0;
		const m = parseFloat((formEditar.multa || '').replace(',', '.')) || 0;
		const j = parseFloat((formEditar.juros || '').replace(',', '.')) || 0;
		return v + m + j;
	};

	const handleConfirmarFechar = async (e) => {
		e.preventDefault();
		if (!formFechar.data_pagamento) {
			mostrarToast('Informe a data de pagamento.', 'aviso');
			return;
		}
		try {
			const payload = {
				data_pagamento: formFechar.data_pagamento || null,
				valor_pago: formFechar.valor_pago ? parseFloat(formFechar.valor_pago.replace(',', '.')) : null,
				multa: formFechar.multa ? parseFloat(formFechar.multa.replace(',', '.')) : null,
				juros: formFechar.juros ? parseFloat(formFechar.juros.replace(',', '.')) : null,
				observacao_pagamento: formFechar.observacao_pagamento || null,
				estorno: formFechar.estorno
			};
			const id = modalFechar;
			await fecharLancamento(id, payload);
			if (comprovante) {
				try {
					await anexarComprovante(id, comprovante);
				} catch {
					mostrarToast('Lançamento efetivado, mas falha ao anexar comprovante.', 'aviso');
				}
			}
			// Admin efetiva direto para Pago; operador manda para análise.
			mostrarToast(admin
				? 'Lançamento efetivado com sucesso.'
				: 'Lançamento enviado para análise. Aguarde a aprovação de um administrador.');
			setModalFechar(null);
			setComprovante(null);
			buscar();
			setLoteRefresh((x) => x + 1);
		} catch (err) {
			if (err.message !== 'sessao-expirada')
				mostrarToast(err.message || 'Erro ao efetivar lançamento', 'erro');
		}
	};

	// ── Aprovação: Em análise → Pago (só admin) ────────────────────────────────
	const handleAprovar = async () => {
		try {
			await aprovarLancamento(modalAprovar.id_lancamento);
			mostrarToast('Lançamento aprovado com sucesso.');
			setModalAprovar(null);
			buscar();
			setLoteRefresh((x) => x + 1);
		} catch (err) {
			if (err.message !== 'sessao-expirada')
				mostrarToast(err.message || 'Erro ao aprovar lançamento', 'erro');
		}
	};

	// ── Modal ver detalhes (operador) ──────────────────────────────────────────
	const abrirModalVer = (l) => {
		setModalVer(l);
		setLancamentoSelecionado(l);
	};

	// ── Modal editar (admin) ────────────────────────────────────────────────────
	const abrirModalEditar = (l) => {
		setModalEditar(l.id_lancamento);
		setLancamentoSelecionado(l);
		setFormEditar({
			id_clifor_relacionado_fk: String(l.id_clifor_relacionado_fk),
			id_tipo_conta_fk: String(l.id_tipo_conta_fk),
			valor: String(l.valor).replace('.', ','),
			data_vencimento: l.data_vencimento || '',
			natureza_lancamento: l.natureza_lancamento || '',
			observacao: l.observacao || '',
			estorno: l.estorno || false,
			data_pagamento: l.data_pagamento ? l.data_pagamento.split('T')[0] : '',
			valor_pago: l.valor_pago ? String(l.valor_pago).replace('.', ',') : '',
			multa: l.multa ? String(l.multa).replace('.', ',') : '',
			juros: l.juros ? String(l.juros).replace('.', ',') : '',
			observacao_pagamento: l.observacao_pagamento || ''
		});
		setComprovante(null);
	};

	const handleEditarChange = (e) => {
		const { name, value, type, checked } = e.target;
		const monetarios = ['valor', 'valor_pago', 'multa', 'juros'];
		const val = type === 'checkbox' ? checked
			: monetarios.includes(name) ? value.replace(/[^0-9,]/g, '')
			: value;
		setFormEditar({ ...formEditar, [name]: val });
	};

	const handleConfirmarEditar = async (e) => {
		e.preventDefault();
		try {
			const payload = {};
			if (formEditar.id_clifor_relacionado_fk)
				payload.id_clifor_relacionado_fk = parseInt(formEditar.id_clifor_relacionado_fk);
			if (formEditar.id_tipo_conta_fk)
				payload.id_tipo_conta_fk = parseInt(formEditar.id_tipo_conta_fk);
			if (formEditar.valor) payload.valor = parseFloat(formEditar.valor.replace(',', '.'));
			if (formEditar.data_vencimento) payload.data_vencimento = formEditar.data_vencimento;
			if (formEditar.natureza_lancamento) payload.natureza_lancamento = formEditar.natureza_lancamento;
			if (formEditar.observacao !== undefined) payload.observacao = formEditar.observacao || null;
			payload.estorno = formEditar.estorno;
			if (formEditar.data_pagamento) payload.data_pagamento = formEditar.data_pagamento;
			if (formEditar.valor_pago) payload.valor_pago = parseFloat(formEditar.valor_pago.replace(',', '.'));
			if (formEditar.multa) payload.multa = parseFloat(formEditar.multa.replace(',', '.'));
			if (formEditar.juros) payload.juros = parseFloat(formEditar.juros.replace(',', '.'));
			if (formEditar.observacao_pagamento !== undefined) payload.observacao_pagamento = formEditar.observacao_pagamento || null;
			await editarLancamento(modalEditar, payload);
			if (comprovante) await uploadComprovante(modalEditar, comprovante);
			mostrarToast('Lançamento editado com sucesso.');
			setModalEditar(null);
			buscar();
			setLoteRefresh((x) => x + 1);
		} catch (err) {
			if (err.message !== 'sessao-expirada')
				mostrarToast(err.message || 'Erro ao editar lançamento', 'erro');
		}
	};

	const handleDeletar = async () => {
		const id = modalEditar;
		try {
			await deleteLancamento(id);
			mostrarToast('Lançamento excluído com sucesso.');
			setConfirmarDeletar(false);
			setModalEditar(null);
			buscar();
			setLoteRefresh((x) => x + 1);
		} catch (err) {
			if (err.message !== 'sessao-expirada')
				mostrarToast(err.message || 'Erro ao excluir lançamento', 'erro');
			setConfirmarDeletar(false);
		}
	};

	// ── Formatação ──────────────────────────────────────────────────────────────
	const formatarData = (iso) => {
		if (!iso) return '—';
		return iso.split('T')[0].split('-').reverse().join('/');
	};

	const formatarValor = (v) => {
		if (v == null) return '—';
		return parseFloat(v).toFixed(2).replace('.', ',');
	};

	const statusLabel = (l) => <SituacaoBadge situacao={l.situacao} />;

	const loteLabel = (lote) => {
		const d = new Date(lote); // ms → Date
		const dia = String(d.getDate()).padStart(2, '0');
		const mes = String(d.getMonth() + 1).padStart(2, '0');
		return `Lote ${dia}/${mes} #${String(lote).slice(-8)}`; // ex.: "Lote 14/06 #00123456"
	};

	// Origem do lançamento — todos recebem sua marcação.
	// (futuro 6.2: lançamentos recorrentes/automáticos retornam 'Automatizado')
	const origemLabel = (l) => (l.lote != null ? 'Em Lote' : 'Manual');
	const origemClasse = (l) => (l.lote != null ? 'badge-origem--lote' : 'badge-origem--manual');

	// Chip de origem. Em lote: clicar abre o modal de lançamentos do lote.
	// `detalhado` exibe o lote diretamente (modais de detalhe); na lista mostra só "Em Lote".
	const origemChip = (l, detalhado = false) => {
		if (!l) return null;
		const temLote = l.lote != null;
		const texto = temLote ? (detalhado ? loteLabel(l.lote) : origemLabel(l)) : 'Manual';
		const chip = (
			<span
				className={`badge badge-origem ${origemClasse(l)}`}
				style={temLote ? { cursor: 'pointer' } : {}}
				title={temLote ? 'Ver lançamentos deste lote' : 'Lançamento avulso'}
				onClick={
					temLote
						? (e) => {
								e.stopPropagation();
								setLoteAcima(true); // aberto a partir de um detalhe → lote por cima
								setLoteModal(l.lote);
							}
						: undefined
				}
			>
				{texto}
			</span>
		);
		return chip;
	};

	// Perfil de um ator da linha do tempo (só admin) — abre por cima do histórico.
	const abrirPerfilUsuario = async (idUsuario) => {
		if (!idUsuario) return;
		try {
			const u = await getUser(idUsuario);
			setPerfilUsuario(u);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao carregar perfil do usuário', 'erro');
		}
	};

	// Quem mexeu por último e quando — clicar abre a linha do tempo completa.
	// Substitui o "por {autor}" que ficava no chip de origem: aquele respondia
	// sempre "quem criou", que raramente é quem fez a última coisa.
	const ultimaInteracaoChip = (l) => {
		const evento = ultimaInteracao(l);
		if (!evento) return null;
		return (
			<button
				type="button"
				className="ll-ultima-interacao"
				title="Ver histórico do lançamento"
				onClick={(e) => {
					e.stopPropagation();
					setTimelineModal(l);
				}}
			>
				<span className="ll-ultima-interacao-acao">{evento.acao}</span>
				<span>
					por {evento.nome} · {formatarCarimbo(evento.data)}
				</span>
			</button>
		);
	};

	return (
		<>
			<div className="ll-container">
				{/* FILTROS */}
				<div className="ll-card">
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							marginBottom: 16
						}}
					>
						<h2 style={{ margin: 0 }}>Lista de Lançamentos</h2>
						{hasPerfilMinimo('Operador') && (
							<button
								onClick={() => setModalAberto(true)}
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
								+ Novo Lançamento
							</button>
						)}
					</div>

					{searchParams.has('origemDashboard') && (
						<div style={{
							display: 'flex', alignItems: 'center', gap: 8,
							padding: '8px 12px', marginTop: 12,
							background: 'rgba(163, 177, 138, 0.12)',
							borderRadius: 6, fontSize: '0.82rem', color: 'var(--primary)'
						}}>
							<i className="bi bi-funnel-fill" />
							Filtros pré-carregados do Dashboard — confira e ajuste se necessário.
						</div>
					)}

					<form onSubmit={handleAplicar}>
						<h4>FILTROS</h4>

						<div className="ll-row">
							<div className="ll-field">
								<label>Cliente / Fornecedor</label>
								<select name="id_clifor" value={filtros.id_clifor} onChange={handleFiltroChange}>
									<option value="">Todos</option>
									{clifors.map((c) => (
										<option key={c.id_clifor} value={c.id_clifor}>
											{c.id_clifor} - {c.nome}
										</option>
									))}
								</select>
							</div>

							<div className="ll-field">
								<label>Tipo de Conta</label>
								<select
									name="id_tipo_conta"
									value={filtros.id_tipo_conta}
									onChange={handleFiltroChange}
								>
									<option value="">Todos</option>
									{tiposConta.map((t) => (
										<option key={t.id_tipo_conta} value={t.id_tipo_conta}>
											{t.id_tipo_conta} - {t.descricao_conta}
										</option>
									))}
								</select>
							</div>

							<div className="ll-field">
								<label>Natureza</label>
								<select name="natureza" value={filtros.natureza} onChange={handleFiltroChange}>
									<option value="">Todas</option>
									<option value="Debito">Débito</option>
									<option value="Credito">Crédito</option>
								</select>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Vencimento de</label>
								<input
									type="date"
									name="data_vencimento_de"
									value={filtros.data_vencimento_de}
									onChange={handleFiltroChange}
								/>
							</div>
							<div className="ll-field">
								<label>Vencimento até</label>
								<input
									type="date"
									name="data_vencimento_ate"
									value={filtros.data_vencimento_ate}
									onChange={handleFiltroChange}
								/>
							</div>
							<div className="ll-field">
								<label>Lançamento de</label>
								<input
									type="date"
									name="data_lancamento_de"
									value={filtros.data_lancamento_de}
									onChange={handleFiltroChange}
								/>
							</div>
							<div className="ll-field">
								<label>Lançamento até</label>
								<input
									type="date"
									name="data_lancamento_ate"
									value={filtros.data_lancamento_ate}
									onChange={handleFiltroChange}
								/>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Status</label>
								<div className="ll-status-checks">
									<label>
										<input
											type="checkbox"
											checked={filtros.apenas_abertos === 'true'}
											onChange={(e) =>
												setFiltros({ ...filtros, apenas_abertos: e.target.checked ? 'true' : '' })
											}
										/>
										Abertos
									</label>
									<label>
										<input
											type="checkbox"
											checked={filtros.apenas_vencidos === 'true'}
											onChange={(e) =>
												setFiltros({ ...filtros, apenas_vencidos: e.target.checked ? 'true' : '' })
											}
										/>
										Vencidos
									</label>
									<label>
										<input
											type="checkbox"
											checked={filtros.apenas_em_analise === 'true'}
											onChange={(e) =>
												setFiltros({ ...filtros, apenas_em_analise: e.target.checked ? 'true' : '' })
											}
										/>
										Em análise
									</label>
									<label>
										<input
											type="checkbox"
											checked={filtros.apenas_quitados === 'true'}
											onChange={(e) =>
												setFiltros({ ...filtros, apenas_quitados: e.target.checked ? 'true' : '' })
											}
										/>
										Quitados
									</label>
									<label>
										<input
											type="checkbox"
											checked={filtros.estorno === 'true'}
											onChange={(e) =>
												setFiltros({ ...filtros, estorno: e.target.checked ? 'true' : '' })
											}
										/>
										Reembolso
									</label>
									<span
										style={{
											borderLeft: '1px solid var(--border)',
											margin: '0 4px',
											alignSelf: 'stretch'
										}}
									/>
									<label>
										<input
											type="checkbox"
											checked={filtros.apenas_com_comprovante === 'true'}
											onChange={(e) =>
												setFiltros({
													...filtros,
													apenas_com_comprovante: e.target.checked ? 'true' : '',
													apenas_sem_comprovante: ''
												})
											}
										/>
										Com comprovante
									</label>
									<label>
										<input
											type="checkbox"
											checked={filtros.apenas_sem_comprovante === 'true'}
											onChange={(e) =>
												setFiltros({
													...filtros,
													apenas_sem_comprovante: e.target.checked ? 'true' : '',
													apenas_com_comprovante: ''
												})
											}
										/>
										Sem comprovante
									</label>
								</div>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Pagamento de</label>
								<input
									type="date"
									name="data_pagamento_de"
									value={filtros.data_pagamento_de}
									onChange={handleFiltroChange}
								/>
							</div>
							<div className="ll-field">
								<label>Pagamento até</label>
								<input
									type="date"
									name="data_pagamento_ate"
									value={filtros.data_pagamento_ate}
									onChange={handleFiltroChange}
								/>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Valor mínimo</label>
								<input
									type="text"
									inputMode="decimal"
									name="valor_minimo"
									value={filtros.valor_minimo}
									onChange={handleFiltroChange}
									placeholder="0,00"
								/>
							</div>
							<div className="ll-field">
								<label>Valor máximo</label>
								<input
									type="text"
									inputMode="decimal"
									name="valor_maximo"
									value={filtros.valor_maximo}
									onChange={handleFiltroChange}
									placeholder="0,00"
								/>
							</div>
						</div>

						<div className="ll-buttons">
							<button type="button" className="ll-btn-limpar" onClick={handleLimpar}>
								Limpar
							</button>
							<button
								type="submit"
								className={`ll-btn-filtrar${filtrosPendentes ? ' ll-btn-filtrar--pendente' : ''}`}
							>
								{filtrosPendentes ? '⚠ Aplicar Filtros ⚠' : 'Aplicar Filtros'}
							</button>
						</div>
					</form>
				</div>

				{/* TABELA */}
				<div className="ll-card">
					<h4>TRANSAÇÕES ({lancamentos.length})</h4>
					<div className="ll-table-wrapper">
						<table className="ll-table">
							<thead>
								<tr>
									<th data-tooltip="CPF ou CNPJ do cliente / fornecedor">CPF/CNPJ</th>
									<th data-tooltip="Nome do cliente ou razão social do fornecedor">Nome / Razão Social</th>
									<th data-tooltip="Categoria do lançamento">Tipo de Conta</th>
									<th data-tooltip="Crédito (entrada) ou Débito (saída)">Natureza</th>
									<th data-tooltip="Data limite para pagamento">Vencimento</th>
									<th data-tooltip="Data em que o pagamento foi efetivado">Pagamento</th>
									<th data-tooltip="Valor original registrado no lançamento">Vl. Lançamento</th>
									<th data-tooltip="Total efetivamente pago: valor pago + multa + juros">Vl. Pagamento</th>
									<th data-tooltip="Situação do lançamento: Pago, Em análise, Em aberto ou Vencido">Status</th>
									<th data-tooltip="Ações disponíveis: editar, comprovante, efetivar">Ações</th>
								</tr>
							</thead>
							<tbody>
								{lancamentos.length === 0 ? (
									<tr>
										<td colSpan="10" className="ll-empty">
											Nenhum lançamento encontrado
										</td>
									</tr>
								) : (
									lancamentos.map((l) => (
										<tr key={l.id_lancamento}>
											<td>
											{isConsulta() ? (
												<span title="Dado protegido">{rassurarCpfCnpj(l.cpf_cnpj_clifor)}</span>
											) : (
												<span
													title={cpfVisivelLanc[l.id_lancamento] ? 'Clique para ocultar' : 'Clique para revelar'}
													onClick={() => setCpfVisivelLanc((prev) => ({ ...prev, [l.id_lancamento]: !prev[l.id_lancamento] }))}
													style={{ cursor: 'pointer' }}
												>
													{cpfVisivelLanc[l.id_lancamento] ? l.cpf_cnpj_clifor || '—' : rassurarCpfCnpj(l.cpf_cnpj_clifor)}
												</span>
											)}
										</td>
											<td>{nomeClifor(l)}</td>
											<td>{nomeTipo(l)}</td>
											<td>{l.natureza_lancamento}</td>
											<td>{formatarData(l.data_vencimento)}</td>
											<td>{formatarData(l.data_pagamento)}</td>
											<td>{formatarValor(l.valor)}</td>
											<td>{formatarTotal(l)}</td>
											<td>
												{statusLabel(l)}
												{origemChip(l)}
											</td>
											<td>
												<div className="ll-acoes">
													{admin && (
														<button
															className="ll-btn-acao"
															onClick={() => abrirModalEditar(l)}
															title="Editar lançamento (admin)"
														>
															<i className="bi bi-pencil"></i>
														</button>
													)}
													{!admin && hasPerfilMinimo('Operador') && (
														<button
															className="ll-btn-acao"
															onClick={() => abrirModalVer(l)}
															title="Ver detalhes"
														>
															<i className="bi bi-eye"></i>
														</button>
													)}
													{l.tem_comprovante && (
														<button
															className="ll-btn-acao"
															onClick={() => baixarComprovante(l.id_lancamento)}
															title="Ver comprovante"
														>
															<i className="bi bi-file-earmark-pdf"></i>
														</button>
													)}
													{!l.data_efetivacao && !l.estorno && hasPerfilMinimo('Operador') && (
														<button
															className="ll-btn-acao fechar"
															onClick={() => abrirModalFechar(l)}
															title={admin ? 'Efetivar lançamento' : 'Efetivar e enviar para análise'}
														>
															<i className="bi bi-journal-check"></i>
														</button>
													)}
													{admin && l.data_efetivacao && !l.data_aprovacao && !l.estorno && (
														<button
															className="ll-btn-acao aprovar"
															onClick={() => setModalAprovar(l)}
															title="Aprovar lançamento (admin)"
														>
															<i className="bi bi-check2-circle"></i>
														</button>
													)}
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* MODAL FECHAR */}
				{modalFechar && (
					<div className="ll-overlay" style={{ zIndex: loteAcima ? 9998 : 10000 }} onClick={() => setModalFechar(null)}>
						<div className="ll-modal ll-modal--duplo" onClick={(e) => e.stopPropagation()}>
							<h3>Efetivar Lançamento</h3>

							<form onSubmit={handleConfirmarFechar}>
								<div className="ll-efetiva-layout">
									{/* coluna esquerda — informações do lançamento */}
									<div className="ll-efetiva-col">
										<div className="ll-col-titulo">
											<i className="bi bi-lock" />
											Dados do Lançamento
										</div>
										<div className="ll-field">
											<label>Cliente / Fornecedor</label>
											<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
												{nomeClifor(lancamentoSelecionado)}
											</div>
										</div>
										<div className="ll-field">
											<label>Tipo de Conta</label>
											<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
												{nomeTipo(lancamentoSelecionado)}
											</div>
										</div>
										<div className="ll-row">
											<div className="ll-field">
												<label>Natureza</label>
												<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
													{lancamentoSelecionado?.natureza_lancamento}
												</div>
											</div>
											<div className="ll-field">
												<label>Vl. Lançamento</label>
												<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
													{formatarValor(lancamentoSelecionado?.valor)}
												</div>
											</div>
										</div>
										<div className="ll-row">
											<div className="ll-field">
												<label>Data de Vencimento</label>
												<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
													{formatarData(lancamentoSelecionado?.data_vencimento)}
												</div>
											</div>
											<div className="ll-field" style={{ flex: 'none' }}>
												<label>Status</label>
												<div style={{ padding: '4px 0' }}>
													{statusLabel(lancamentoSelecionado)}
												</div>
											</div>
										</div>
										<div className="ll-row">
											<div className="ll-field">
												<label>Última interação</label>
												<div>{ultimaInteracaoChip(lancamentoSelecionado)}</div>
											</div>
										</div>
										<div className="ll-row">
											<div className="ll-field" style={{ flex: 'none' }}>
												<label>Origem</label>
												<div style={{ padding: '4px 0' }}>{origemChip(lancamentoSelecionado, true)}</div>
											</div>
											<div className="ll-field" style={{ flex: 'none' }}>
												<label style={{ visibility: 'hidden' }}>_</label>
												<label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0, fontSize: '0.85rem', cursor: 'pointer', padding: '6px 0' }}>
													<input
														type="checkbox"
														name="estorno"
														checked={!!lancamentoSelecionado?.estorno}
														disabled
														className="ll-checkbox-round"
													/>
													Estorno
												</label>
											</div>
										</div>
										<div className="ll-field">
											<label>Observação do Lançamento</label>
											<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
												{lancamentoSelecionado?.observacao || '—'}
											</div>
										</div>
									</div>

									{/* divisor vertical */}
									<div className="ll-efetiva-divider" />

									{/* coluna direita — efetivação */}
									<div className="ll-efetiva-col">
										<div className="ll-col-titulo">
											<i className="bi bi-pencil-square" />
											Efetivação
										</div>
										<div className="ll-field">
											<label>Data de Pagamento</label>
											<input
												type="date"
												name="data_pagamento"
												value={formFechar.data_pagamento}
												onChange={handleFecharChange}
											/>
										</div>
										<div className="ll-field">
											<label>Valor Pago</label>
											<input
												type="text"
												name="valor_pago"
												value={formFechar.valor_pago}
												onChange={handleFecharChange}
												readOnly={!!lancamentoSelecionado?.valor_pago}
												style={lancamentoSelecionado?.valor_pago ? { background: 'var(--input-bg)', opacity: 0.7 } : {}}
											/>
										</div>
										<div className="ll-row">
											<div className="ll-field">
												<label>Multa</label>
												<input type="text" name="multa" value={formFechar.multa} onChange={handleFecharChange} />
											</div>
											<div className="ll-field">
												<label>Juros</label>
												<input type="text" name="juros" value={formFechar.juros} onChange={handleFecharChange} />
											</div>
										</div>

										{(formFechar.multa || formFechar.juros) && (
											<div className="ll-field">
												<label>Total Pago</label>
												<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)' }}>
													{formatarValor(totalPago())}
												</div>
											</div>
										)}

										<div className="ll-field">
											<label>Observação do Pagamento</label>
											<textarea name="observacao_pagamento" value={formFechar.observacao_pagamento} onChange={handleFecharChange} rows="2" />
										</div>

										{lancamentoSelecionado?.tem_comprovante && (
											<div className="ll-field">
												<label>Comprovante Atual</label>
												<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
													<span style={{ fontSize: 13, color: 'var(--text)' }}>
														<i className="bi bi-file-earmark-pdf" style={{ marginRight: 6 }}></i>
														{lancamentoSelecionado.comprovante_nome || 'comprovante.pdf'}
													</span>
													<button type="button" onClick={() => setConfirmarRemoverComprovante(true)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
														Remover
													</button>
												</div>
											</div>
										)}

										{!lancamentoSelecionado?.tem_comprovante && (
											<div className="ll-field">
												<label>
													Comprovante de Pagamento (PDF){' '}
													<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— opcional</span>
												</label>
												<input
													type="file"
													accept="application/pdf"
													onChange={(e) => {
														const arquivo = e.target.files[0] || null;
														if (arquivo && arquivo.size > 5 * 1024 * 1024) {
															mostrarToast('O arquivo excede o limite de 5MB.', 'erro');
															e.target.value = '';
															return;
														}
														setComprovante(arquivo);
													}}
												/>
												{comprovante && (
													<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{comprovante.name}</span>
												)}
											</div>
										)}
									</div>
								</div>

								<div className="ll-buttons">
									<button
										type="button"
										className="ll-btn-limpar"
										onClick={() => setModalFechar(null)}
									>
										Cancelar
									</button>
									<button type="submit" className="ll-btn-filtrar">
										Confirmar
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{/* MODAL EDITAR (admin only) */}
				{confirmarDeletar && (
					<ModalConfirm
						titulo="Excluir Lançamento"
						mensagem="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
						textoBotaoConfirmar="Excluir"
						textoBotaoCancelar="Cancelar"
						onConfirmar={handleDeletar}
						onCancelar={() => setConfirmarDeletar(false)}
						variante="perigo"
					/>
				)}
				{modalEditar && (
					<div className="ll-overlay" style={{ zIndex: loteAcima ? 9998 : 10000 }} onClick={() => setModalEditar(null)}>
						<div className="ll-modal ll-modal--duplo" onClick={(e) => e.stopPropagation()}>
							<h3>Editar Lançamento</h3>

							<form onSubmit={handleConfirmarEditar}>
								<div className="ll-efetiva-layout">
									{/* coluna esquerda — dados do lançamento (editáveis) */}
									<div className="ll-efetiva-col">
										<div className="ll-col-titulo">
											<i className="bi bi-pencil" />
											Dados do Lançamento
										</div>
										<div className="ll-field">
											<label>Cliente / Fornecedor</label>
											<select name="id_clifor_relacionado_fk" value={formEditar.id_clifor_relacionado_fk} onChange={handleEditarChange}>
												{clifors.map((c) => (
													<option key={c.id_clifor} value={c.id_clifor}>{c.nome}</option>
												))}
											</select>
										</div>
										<div className="ll-row">
											<div className="ll-field">
												<label>Tipo de Conta</label>
												<select name="id_tipo_conta_fk" value={formEditar.id_tipo_conta_fk} onChange={handleEditarChange}>
													{tiposConta.map((t) => (
														<option key={t.id_tipo_conta} value={t.id_tipo_conta}>{t.descricao_conta}</option>
													))}
												</select>
											</div>
											<div className="ll-field">
												<label>Natureza</label>
												<select name="natureza_lancamento" value={formEditar.natureza_lancamento} onChange={handleEditarChange}>
													<option value="Credito">Crédito</option>
													<option value="Debito">Débito</option>
												</select>
											</div>
										</div>
										<div className="ll-row">
											<div className="ll-field">
												<label>Vl. Lançamento</label>
												<input type="text" inputMode="decimal" name="valor" value={formEditar.valor} onChange={handleEditarChange} placeholder="0,00" />
											</div>
											<div className="ll-field">
												<label>Data de Vencimento</label>
												<input type="date" name="data_vencimento" value={formEditar.data_vencimento} onChange={handleEditarChange} />
											</div>
										</div>
										<div className="ll-row">
											<div className="ll-field" style={{ flex: 'none' }}>
												<label>Status</label>
												<div style={{ padding: '4px 0' }}>
													{statusLabel(lancamentoSelecionado)}
												</div>
											</div>
											<div className="ll-field">
												<label>Última interação</label>
												<div>{ultimaInteracaoChip(lancamentoSelecionado)}</div>
											</div>
										</div>
										<div className="ll-row">
											<div className="ll-field" style={{ flex: 'none' }}>
												<label>Origem</label>
												<div style={{ padding: '4px 0' }}>{origemChip(lancamentoSelecionado, true)}</div>
											</div>
											<div className="ll-field" style={{ flex: 'none' }}>
												<label style={{ visibility: 'hidden' }}>_</label>
												<label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0, fontSize: '0.85rem', cursor: 'pointer', padding: '6px 0' }}>
													<input
														type="checkbox"
														name="estorno"
														checked={formEditar.estorno}
														onChange={handleEditarChange}
														className="ll-checkbox-round"
													/>
													Estorno
												</label>
											</div>
										</div>
										<div className="ll-field">
											<label>Observação do Lançamento</label>
											<textarea name="observacao" value={formEditar.observacao} onChange={handleEditarChange} rows="2" />
										</div>
									</div>

									{/* divisor vertical */}
									<div className="ll-efetiva-divider" />

									{/* coluna direita — efetivação */}
									<div className="ll-efetiva-col">
										<div className="ll-col-titulo">
											<i className="bi bi-pencil-square" />
											Efetivação
										</div>
										<div className="ll-field">
											<label>Data de Pagamento</label>
											<input type="date" name="data_pagamento" value={formEditar.data_pagamento} onChange={handleEditarChange} />
										</div>
										<div className="ll-field">
											<label>Valor Pago</label>
											<input type="text" inputMode="decimal" name="valor_pago" value={formEditar.valor_pago} onChange={handleEditarChange} placeholder="0,00" />
										</div>
										<div className="ll-row">
											<div className="ll-field">
												<label>Multa</label>
												<input type="text" inputMode="decimal" name="multa" value={formEditar.multa} onChange={handleEditarChange} placeholder="0,00" />
											</div>
											<div className="ll-field">
												<label>Juros</label>
												<input type="text" inputMode="decimal" name="juros" value={formEditar.juros} onChange={handleEditarChange} placeholder="0,00" />
											</div>
										</div>
										{(formEditar.multa || formEditar.juros) && (
											<div className="ll-field">
												<label>Total Pago</label>
												<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)' }}>
													{formatarValor(totalPagoEditar())}
												</div>
											</div>
										)}
										<div className="ll-field">
											<label>Observação do Pagamento</label>
											<textarea name="observacao_pagamento" value={formEditar.observacao_pagamento} onChange={handleEditarChange} rows="2" />
										</div>
										{lancamentoSelecionado?.tem_comprovante && (
											<div className="ll-field">
												<label>Comprovante Atual</label>
												<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
													<span style={{ fontSize: 13, color: 'var(--text)' }}>
														<i className="bi bi-file-earmark-pdf" style={{ marginRight: 6 }}></i>
														{lancamentoSelecionado.comprovante_nome || 'comprovante.pdf'}
													</span>
													<button type="button" onClick={() => setConfirmarRemoverComprovante(true)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
														Remover
													</button>
												</div>
											</div>
										)}
										{!lancamentoSelecionado?.tem_comprovante && (
											<div className="ll-field">
												<label>
													Comprovante de Pagamento (PDF){' '}
													<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— opcional</span>
												</label>
												<input
													type="file"
													accept="application/pdf"
													onChange={(e) => {
														const arquivo = e.target.files[0] || null;
														if (arquivo && arquivo.size > 5 * 1024 * 1024) {
															mostrarToast('O arquivo excede o limite de 5MB.', 'erro');
															e.target.value = '';
															return;
														}
														setComprovante(arquivo);
													}}
												/>
												{comprovante && (
													<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{comprovante.name}</span>
												)}
											</div>
										)}
									</div>
								</div>

								<div className="ll-buttons" style={{ justifyContent: 'space-between' }}>
									<button
										type="button"
										onClick={() => setConfirmarDeletar(true)}
										style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #dc2626', background: 'transparent', color: '#dc2626', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}
									>
										<i className="bi bi-trash" /> Excluir
									</button>
									<div style={{ display: 'flex', gap: 8 }}>
										<button type="button" className="ll-btn-limpar" onClick={() => setModalEditar(null)}>
											Cancelar
										</button>
										<button type="submit" className="ll-btn-filtrar">
											Salvar
										</button>
									</div>
								</div>
							</form>
						</div>
					</div>
				)}
			</div>

			{modalVer && (
				<div className="ll-overlay" onClick={() => setModalVer(null)}>
					<div className="ll-modal" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
						<h3>Detalhes do Lançamento #{modalVer.id_lancamento}</h3>

						<div className="ll-row">
							<div className="ll-field">
								<label>Cliente / Fornecedor</label>
								<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem' }}>{nomeClifor(modalVer)}</div>
							</div>
							<div className="ll-field">
								<label>Tipo de Conta</label>
								<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem' }}>{nomeTipo(modalVer)}</div>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Natureza</label>
								<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem' }}>{modalVer.natureza_lancamento}</div>
							</div>
							<div className="ll-field">
								<label>Valor</label>
								<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem' }}>{formatarValor(modalVer.valor)}</div>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Vencimento</label>
								<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem' }}>{formatarData(modalVer.data_vencimento)}</div>
							</div>
							<div className="ll-field">
								<label>Status</label>
								<div style={{ padding: '4px 0' }}>{statusLabel(modalVer)} {origemChip(modalVer, true)}</div>
							</div>
						</div>

						{modalVer.data_efetivacao && (
							<div className="ll-row">
								<div className="ll-field">
									<label>Efetivado por</label>
									<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem' }}>
										{modalVer.nome_usuario_efetivacao || '—'} · {formatarCarimbo(modalVer.data_efetivacao)}
									</div>
								</div>
								<div className="ll-field">
									<label>Aprovado por</label>
									<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem' }}>
										{modalVer.data_aprovacao
											? `${modalVer.nome_usuario_aprovacao || '—'} · ${formatarCarimbo(modalVer.data_aprovacao)}`
											: 'Aguardando aprovação'}
									</div>
								</div>
							</div>
						)}

						{modalVer.data_pagamento && (
							<>
								<div className="ll-row">
									<div className="ll-field">
										<label>Data de Pagamento</label>
										<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem' }}>{formatarData(modalVer.data_pagamento)}</div>
									</div>
									<div className="ll-field">
										<label>Valor Pago</label>
										<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem' }}>{formatarValor(modalVer.valor_pago)}</div>
									</div>
								</div>
								{(modalVer.multa || modalVer.juros) && (
									<div className="ll-row">
										<div className="ll-field">
											<label>Multa</label>
											<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem' }}>{formatarValor(modalVer.multa)}</div>
										</div>
										<div className="ll-field">
											<label>Juros</label>
											<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem' }}>{formatarValor(modalVer.juros)}</div>
										</div>
									</div>
								)}
								<div className="ll-field">
									<label>Total Pago</label>
									<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)' }}>{formatarTotal(modalVer)}</div>
								</div>
							</>
						)}

						{modalVer.observacao && (
							<div className="ll-field">
								<label>Observação do Lançamento</label>
								<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{modalVer.observacao}</div>
							</div>
						)}

						{modalVer.observacao_pagamento && (
							<div className="ll-field">
								<label>Observação do Pagamento</label>
								<div style={{ padding: '6px 10px', background: 'var(--input-bg)', borderRadius: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{modalVer.observacao_pagamento}</div>
							</div>
						)}

						{modalVer.tem_comprovante && (
							<div className="ll-field">
								<label>Comprovante</label>
								<button
									type="button"
									onClick={() => baixarComprovante(modalVer.id_lancamento)}
									style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}
								>
									<i className="bi bi-file-earmark-pdf" /> Baixar PDF
								</button>
							</div>
						)}

						<div className="ll-buttons">
							<button className="ll-btn-filtrar" onClick={() => setModalVer(null)}>Fechar</button>
						</div>
					</div>
				</div>
			)}

			{confirmarRemoverComprovante && (
				<ModalConfirm
					titulo="Remover comprovante"
					mensagem="Tem certeza que deseja remover o comprovante deste lançamento?"
					textoBotaoConfirmar="Remover"
					textoBotaoCancelar="Cancelar"
					onConfirmar={handleRemoverComprovante}
					onCancelar={() => setConfirmarRemoverComprovante(false)}
					variante="perigo"
				/>
			)}

			{modalAprovar && (
				<ModalConfirm
					titulo="Aprovar lançamento"
					mensagem={`Aprovar o lançamento de ${nomeClifor(modalAprovar)} no valor de ${formatarValor(modalAprovar.valor_pago ?? modalAprovar.valor)}? O valor passa a contar no caixa.`}
					textoBotaoConfirmar="Aprovar"
					textoBotaoCancelar="Cancelar"
					onConfirmar={handleAprovar}
					onCancelar={() => setModalAprovar(null)}
				/>
			)}

			{modalAberto && (
				<LancamentoModal
					onFechar={() => {
						setModalAberto(false);
						handleAplicar({ preventDefault: () => {} });
					}}
				/>
			)}

			{loteModal != null && (
				<LoteLancamentosModal
					lote={loteModal}
					tiposConta={tiposConta}
					refreshSignal={loteRefresh}
					zIndex={loteAcima ? 10000 : 9997}
					onEditarUm={(l) => {
						setLoteAcima(false); // aberto a partir de uma linha do lote → detalhe por cima
						abrirModalEditar(l);
					}}
					onEfetivarUm={(l) => {
						setLoteAcima(false);
						abrirModalFechar(l);
					}}
					onFechar={() => {
						setLoteAcima(false);
						setLoteModal(null);
					}}
					onChanged={() => buscar()}
				/>
			)}

			{timelineModal && (
				<TimelineLancamentoModal
					lancamento={timelineModal}
					onFechar={() => setTimelineModal(null)}
					onAbrirPerfil={admin ? abrirPerfilUsuario : null}
				/>
			)}

			{perfilUsuario && (
				<PerfilCompletoPopup usuario={perfilUsuario} onFechar={() => setPerfilUsuario(null)} />
			)}
		</>
	);
}

export default ListaLancamentosPage;
