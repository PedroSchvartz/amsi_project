import { useState, useEffect, useMemo } from 'react';
import LancamentoModal from '../components/LancamentoModal.jsx';
import LoteLancamentosModal from '../components/LoteLancamentosModal.jsx';
import { useSearchParams } from 'react-router-dom';
import ModalConfirm from '../components/ModalConfirm.jsx';
import PerfilCompletoPopup from '../components/PerfilCompletoPopup.jsx';
import SituacaoBadge from '../components/SituacaoBadge.jsx';
import TimelineLancamentoModal, {
	ultimaInteracao,
	formatarCarimbo
} from '../components/TimelineLancamentoModal.jsx';
import { useToast } from '../components/ToastStack.jsx';
import ExportarLancamentosModal from '../components/ExportarLancamentosModal.jsx';
import { useExportacao } from '../services/exportacaoContext.jsx';
import { getCache, setCache } from '../services/cache';
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
	lote_clifor: '',
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
	valor_maximo: '',
	// Como os status marcados se combinam: 'inclusivo' = OU/união (padrão),
	// 'exclusivo' = E/interseção. Só na sessão — Limpar/recarregar volta a inclusivo.
	status_modo: 'inclusivo'
};

// Converte o estado cru do formulário (strings, '' = vazio, vírgula decimal) no objeto
// de parâmetros da API — só chaves preenchidas e já tipadas. Usado pela busca e pela
// exportação, para as duas enviarem exatamente os mesmos filtros.
function filtrosParaParams(f) {
	const params = {};
	if (f.id_clifor) params.id_clifor = parseInt(f.id_clifor);
	if (f.lote_clifor) params.lote_clifor = f.lote_clifor;
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
	if (f.status_modo) params.status_modo = f.status_modo;
	return params;
}

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
	// Qual lado ('de'/'ate') de cada par de datas foi preenchido primeiro. A âncora fica
	// livre; só o segundo campo recebe o limite relativo (ver handleDataChange/limiteData).
	const [ancoraData, setAncoraData] = useState({ vencimento: null, lancamento: null, pagamento: null });
	// Nome do último campo (data ou valor) tocado — decide em qual campo a mensagem de
	// falha aparece quando há mais de um par inválido ao mesmo tempo.
	const [ultimoCampoTocado, setUltimoCampoTocado] = useState(null);
	const [populado, setPopulado] = useState(false); // true após a 1ª busca — só troca a mensagem de vazio
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
	const [modalExportar, setModalExportar] = useState(false);
	const { iniciar: iniciarExportacao } = useExportacao();

	const admin = isAdmin();

	// Lotes distintos dos clifors carregados — alimentam o dropdown do filtro "Lote do Associado".
	// Client-side: `clifors` já vem completo (com `.lote`), então não há fetch novo.
	const lotesDisponiveis = useMemo(
		() => [...new Set(clifors.map((c) => c.lote).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
		[clifors]
	);

	useEffect(() => {
		carregarAuxiliares();
		// Drill-down do Dashboard: filtros chegam prontos e a intenção do clique é ver os
		// itens — busca sozinho (e sobrescreve o cache).
		if (searchParams.has('origemDashboard')) {
			const f = { ...FILTROS_INICIAL };
			for (const [key, val] of searchParams.entries()) {
				if (key !== 'origemDashboard' && key in FILTROS_INICIAL) f[key] = val;
			}
			setFiltros(f);
			buscar(f);
			return;
		}
		// Fora do drill-down: não busca ao abrir. Se já houve uma pesquisa nesta sessão,
		// reidrata o resultado do cache (persiste a navegação); senão fica vazio aguardando
		// o botão "Pesquisar". Ver 3.13.
		const cache = getCache('lancamentos');
		if (cache) {
			setLancamentos(cache.lancamentos);
			setFiltros(cache.filtros);
			setFiltrosAplicados(cache.filtros);
			setPopulado(true);
		}
	}, []);

	// Dados dos selects de filtro (clifors + tipos de conta). Carrega em silêncio (sem o
	// overlay de "carregando") e guarda no cache: abrir a tela não deve mostrar loading —
	// só o botão "Pesquisar" mostra. Ao voltar à tela, reidrata do cache sem rebuscar. 3.13.
	const carregarAuxiliares = async () => {
		const aux = getCache('lancamentos-aux');
		if (aux) {
			setClifors(aux.clifors);
			setTiposConta(aux.tiposConta);
			return;
		}
		try {
			const [cs, ts] = await Promise.all([
				getClifors({}, { silencioso: true }),
				getTiposConta({ silencioso: true })
			]);
			setClifors(cs);
			setTiposConta(ts);
			setCache('lancamentos-aux', { clifors: cs, tiposConta: ts });
		} catch {}
	};

	const buscar = async (f = filtros) => {
		try {
			const data = await getLancamentos(filtrosParaParams(f));
			setLancamentos(data);
			setFiltrosAplicados(f);
			setPopulado(true);
			setCache('lancamentos', { lancamentos: data, filtros: f });
		} catch (err) {
			if (err.message !== 'sessao-expirada')
				mostrarToast(err.message || 'Erro ao buscar lançamentos', 'erro');
		}
	};

	const handleFiltroChange = (e) => {
		const { name, value } = e.target;
		const monetarios = ['valor_minimo', 'valor_maximo'];
		if (monetarios.includes(name)) setUltimoCampoTocado(name);
		setFiltros({
			...filtros,
			[name]: monetarios.includes(name) ? value.replace(/[^0-9,]/g, '') : value
		});
	};

	const exclusivo = filtros.status_modo === 'exclusivo';

	// Datas "de/até": a restrição relativa trava só o campo preenchido por ÚLTIMO. O
	// primeiro vira âncora e fica livre (pode até inverter a faixa); quem cede é o segundo.
	// Sem âncora (ex.: filtros vindos da URL) cai no limite mútuo simétrico.
	const handleDataChange = (e) => {
		const { name, value } = e.target;
		const [, par, lado] = name.match(/^data_(vencimento|lancamento|pagamento)_(de|ate)$/);
		const outroLado = lado === 'de' ? 'ate' : 'de';
		const parceiroPreenchido = !!filtros[`data_${par}_${outroLado}`];

		let ancora = ancoraData[par];
		if (value && !parceiroPreenchido) {
			ancora = lado; // preencheu com o parceiro vazio → é o primeiro
		} else if (!value && ancoraData[par] === lado) {
			ancora = parceiroPreenchido ? outroLado : null; // limpou a âncora → passa ao parceiro
		}

		setAncoraData({ ...ancoraData, [par]: ancora });
		setUltimoCampoTocado(name);
		setFiltros({ ...filtros, [name]: value });
	};

	// max do "de" / min do "até": undefined no campo-âncora (livre), limite do parceiro no
	// outro. Só vale no modo exclusivo; no inclusivo as datas ficam soltas.
	const limiteData = (par, lado) => {
		if (!exclusivo) return undefined;
		if (ancoraData[par] === lado) return undefined;
		return (lado === 'de' ? filtros[`data_${par}_ate`] : filtros[`data_${par}_de`]) || undefined;
	};

	// Falha prevista: pares de data e valor SEMPRE filtram por intervalo (de E até, mín E
	// máx), independente do modo — então uma faixa invertida garante busca vazia mesmo no
	// inclusivo. Por isso o aviso vale nos DOIS modos: linha vermelha em TODOS os campos
	// envolvidos + mensagem única no último campo tocado (senão no primeiro inválido).
	const PARES_DATA = ['vencimento', 'lancamento', 'pagamento'];
	const dataInvalida = (par) => {
		const de = filtros[`data_${par}_de`];
		const ate = filtros[`data_${par}_ate`];
		return !!de && !!ate && de > ate; // ISO yyyy-mm-dd compara lexicograficamente
	};
	const parseValor = (s) => {
		if (!s) return null;
		const n = parseFloat(String(s).replace(',', '.'));
		return Number.isNaN(n) ? null : n;
	};
	const valorInvalido = (() => {
		const min = parseValor(filtros.valor_minimo);
		const max = parseValor(filtros.valor_maximo);
		return min !== null && max !== null && min > max;
	})();
	const paresInvalidos = PARES_DATA.filter(dataInvalida);
	const valorFalha = valorInvalido;
	const camposComLinha = new Set([
		...paresInvalidos.flatMap((par) => [`data_${par}_de`, `data_${par}_ate`]),
		...(valorFalha ? ['valor_minimo', 'valor_maximo'] : [])
	]);
	const falhaPrevista = camposComLinha.size > 0;
	const campoMensagem = camposComLinha.has(ultimoCampoTocado)
		? ultimoCampoTocado
		: [...camposComLinha][0] || null;
	const textoFalha = (name) =>
		name?.startsWith('valor_')
			? 'O mínimo não pode ser maior que o máximo.'
			: 'O início não pode ser depois do fim.';

	// No modo exclusivo (interseção) o ciclo Aberto/Em análise/Pago é excludente: dois
	// ao mesmo tempo dariam vazio. Vira single-select — marcar um limpa os outros dois;
	// remarcar o já ativo desliga (não trava num estado impossível de zerar).
	const CICLO = ['apenas_abertos', 'apenas_em_analise', 'apenas_quitados'];

	const marcarCiclo = (campo, marcado) => {
		if (exclusivo) {
			setFiltros({
				...filtros,
				apenas_abertos: '',
				apenas_em_analise: '',
				apenas_quitados: '',
				[campo]: marcado ? 'true' : ''
			});
		} else {
			setFiltros({ ...filtros, [campo]: marcado ? 'true' : '' });
		}
	};

	// Troca de modo. Ao ENTRAR no exclusivo com mais de um do ciclo marcado, mantém só
	// o primeiro — senão o filtro já nasceria vazio.
	const trocarModo = (modo) => {
		if (modo === 'exclusivo') {
			const marcados = CICLO.filter((k) => filtros[k] === 'true');
			if (marcados.length > 1) {
				const manter = marcados[0];
				setFiltros({
					...filtros,
					status_modo: modo,
					apenas_abertos: manter === 'apenas_abertos' ? 'true' : '',
					apenas_em_analise: manter === 'apenas_em_analise' ? 'true' : '',
					apenas_quitados: manter === 'apenas_quitados' ? 'true' : ''
				});
				return;
			}
		}
		setFiltros({ ...filtros, status_modo: modo });
	};

	const handleAplicar = (e) => {
		e.preventDefault();
		buscar(filtros);
	};

	const handleLimpar = () => {
		setFiltros(FILTROS_INICIAL);
		setAncoraData({ vencimento: null, lancamento: null, pagamento: null });
		setUltimoCampoTocado(null);
		buscar(FILTROS_INICIAL);
	};

	// Inicia a exportação (nova pesquisa no banco com os filtros já aplicados) e abre a
	// modal de acompanhamento. A entrega padrão é download automático — trocável na modal.
	const handleExportar = async () => {
		const ok = await iniciarExportacao(filtrosParaParams(filtrosAplicados), 'download-auto');
		if (ok) setModalExportar(true);
	};

	const filtrosPendentes = JSON.stringify(filtros) !== JSON.stringify(filtrosAplicados);

	// O botão sempre diz "Pesquisar"; quando já houve uma busca e o usuário mexeu num
	// filtro sem reaplicar, pulsa amarelo (pendência). Havendo falha prevista (só no modo
	// exclusivo), a mesma pulsação vira vermelha — precede a pendência.
	const buscarPendente = populado && filtrosPendentes;
	const rotuloBuscar = buscarPendente || falhaPrevista ? '⚠ Pesquisar ⚠' : 'Pesquisar';
	const classeBuscar = `ll-btn-filtrar${
		falhaPrevista ? ' ll-btn-filtrar--falha' : buscarPendente ? ' ll-btn-filtrar--pendente' : ''
	}`;

	// ── Helpers de nome com fallback local ─────────────────────────────────────
	const nomeClifor = (l) =>
		l.nome_clifor || clifors.find((c) => c.id_clifor === l.id_clifor_relacionado_fk)?.nome || '—';

	const nomeTipo = (l) => {
		const desc =
			l.descricao_tipo_conta ||
			tiposConta.find((t) => t.id_tipo_conta === l.id_tipo_conta_fk)?.descricao_conta;
		return desc ? `${l.id_tipo_conta_fk} - ${desc}` : l.id_tipo_conta_fk;
	};

	const formatarTotal = (l) => {
		if (l.valor_pago == null) return '—';
		const total =
			(parseFloat(l.valor_pago) || 0) + (parseFloat(l.multa) || 0) + (parseFloat(l.juros) || 0);
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
			valor_pago: l.valor_pago
				? String(l.valor_pago).replace('.', ',')
				: String(l.valor).replace('.', ',')
		});
		setComprovante(null);
	};

	const aprovando = !!modalAprovar;

	const fecharModalEfetivacao = () => {
		setModalFechar(null);
		setModalAprovar(null);
	};

	// Vitrine, não formulário: no modo aprovar os campos da efetivação só mostram.
	const travado = aprovando
		? { disabled: true, style: { background: 'var(--input-bg)', opacity: 0.7 } }
		: {};

	// Aprovar reusa a modal de Efetivar em vez de ter a sua: o admin aprova o que foi
	// efetivado, então o que ele precisa ver é exatamente o que a efetivação gravou.
	// Vem tudo travado porque POST /aprovar não aceita corpo — campo editável aqui seria
	// mentira, o valor digitado sumiria em silêncio. Quem edita é a modal de Editar.
	const abrirModalAprovar = (l) => {
		setModalAprovar(l.id_lancamento);
		setLancamentoSelecionado(l);
		setFormFechar({
			...FECHAR_INICIAL,
			data_pagamento: l.data_pagamento ? l.data_pagamento.split('T')[0] : '',
			valor_pago: l.valor_pago ? String(l.valor_pago).replace('.', ',') : '',
			multa: l.multa ? String(l.multa).replace('.', ',') : '',
			juros: l.juros ? String(l.juros).replace('.', ',') : '',
			observacao_pagamento: l.observacao_pagamento || '',
			estorno: l.estorno || false
		});
		setComprovante(null);
	};

	const handleRemoverComprovante = async () => {
		try {
			await removerComprovante(lancamentoSelecionado.id_lancamento);
			setLancamentoSelecionado({
				...lancamentoSelecionado,
				tem_comprovante: false,
				comprovante_nome: null
			});
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
		const val =
			type === 'checkbox'
				? checked
				: monetarios.includes(name)
					? value.replace(/[^0-9,]/g, '')
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
				valor_pago: formFechar.valor_pago
					? parseFloat(formFechar.valor_pago.replace(',', '.'))
					: null,
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
			mostrarToast(
				admin
					? 'Lançamento efetivado com sucesso.'
					: 'Lançamento enviado para análise. Aguarde a aprovação de um administrador.'
			);
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
	const handleAprovar = async (e) => {
		e.preventDefault();
		try {
			await aprovarLancamento(modalAprovar);
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
		const val =
			type === 'checkbox'
				? checked
				: monetarios.includes(name)
					? value.replace(/[^0-9,]/g, '')
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
			if (formEditar.natureza_lancamento)
				payload.natureza_lancamento = formEditar.natureza_lancamento;
			if (formEditar.observacao !== undefined) payload.observacao = formEditar.observacao || null;
			payload.estorno = formEditar.estorno;
			if (formEditar.data_pagamento) payload.data_pagamento = formEditar.data_pagamento;
			if (formEditar.valor_pago)
				payload.valor_pago = parseFloat(formEditar.valor_pago.replace(',', '.'));
			if (formEditar.multa) payload.multa = parseFloat(formEditar.multa.replace(',', '.'));
			if (formEditar.juros) payload.juros = parseFloat(formEditar.juros.replace(',', '.'));
			if (formEditar.observacao_pagamento !== undefined)
				payload.observacao_pagamento = formEditar.observacao_pagamento || null;
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

	// ── Reverter: desfaz o fluxo um passo (Pago → Em análise → Aberto). Só admin; vive
	//    dentro da modal de histórico. O backend valida a transição e apaga os carimbos
	//    do passo desfeito, inclusive o rastro de edição. ────────────────────────────
	const handleReverterTimeline = async (para) => {
		const id = timelineModal?.id_lancamento;
		if (!id) return;
		try {
			await editarLancamento(id, { reverter_para: para });
			mostrarToast(
				para === 'aberto'
					? 'Lançamento revertido para Aberto.'
					: 'Aprovação desfeita — lançamento voltou para Em análise.'
			);
			setTimelineModal(null);
			buscar();
			setLoteRefresh((x) => x + 1);
		} catch (err) {
			if (err.message !== 'sessao-expirada')
				mostrarToast(err.message || 'Erro ao reverter lançamento', 'erro');
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

	// Cor do pill da ação: cada uma reusa o badge da situação que ela PRODUZ — lançar
	// abre, efetivar manda para análise, aprovar paga. Não é coincidência de paleta, é
	// a mesma informação, então mudar a cor de uma situação deve mudar a da ação junto.
	// Editar não muda situação nenhuma, e por isso é o único neutro.
	const CLASSE_ACAO = {
		Lançado: 'badge-aberto',
		Efetivado: 'badge-analise',
		Aprovado: 'badge-pago',
		Editado: 'badge-editado'
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
				<span className={`badge ${CLASSE_ACAO[evento.acao] || 'badge-editado'}`}>
					{evento.acao}
				</span>
				<span className="ll-ultima-interacao-detalhe">
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
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 8,
								padding: '8px 12px',
								marginTop: 12,
								background: 'rgba(163, 177, 138, 0.12)',
								borderRadius: 6,
								fontSize: '0.82rem',
								color: 'var(--primary)'
							}}
						>
							<i className="bi bi-funnel-fill" />
							Filtros pré-carregados do Dashboard — confira e ajuste se necessário.
						</div>
					)}

					<form onSubmit={handleAplicar}>
						<h4>FILTROS</h4>

						<div className="ll-row">
							<div className="ll-field ll-field--cliente">
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

							{/* Lote do Associado (terreno) — filtra os lançamentos pelo lote do
							    cliente/fornecedor relacionado. Opções = lotes distintos dos clifors. */}
							<div className="ll-field">
								<label>Lote do Associado</label>
								<select
									name="lote_clifor"
									value={filtros.lote_clifor}
									onChange={handleFiltroChange}
								>
									<option value="">Todos</option>
									{lotesDisponiveis.map((lote) => (
										<option key={lote} value={lote}>
											{lote}
										</option>
									))}
								</select>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Vencimento de</label>
								<input
									type="date"
									name="data_vencimento_de"
									className={camposComLinha.has('data_vencimento_de') ? 'll-input-erro' : undefined}
									value={filtros.data_vencimento_de}
									max={limiteData('vencimento', 'de')}
									onChange={handleDataChange}
								/>
								{campoMensagem === 'data_vencimento_de' && (
									<span className="ll-erro-data">O início não pode ser depois do fim.</span>
								)}
							</div>
							<div className="ll-field">
								<label>Vencimento até</label>
								<input
									type="date"
									name="data_vencimento_ate"
									className={camposComLinha.has('data_vencimento_ate') ? 'll-input-erro' : undefined}
									value={filtros.data_vencimento_ate}
									min={limiteData('vencimento', 'ate')}
									onChange={handleDataChange}
								/>
								{campoMensagem === 'data_vencimento_ate' && (
									<span className="ll-erro-data">O início não pode ser depois do fim.</span>
								)}
							</div>
							<div className="ll-field">
								<label>Lançamento de</label>
								<input
									type="date"
									name="data_lancamento_de"
									className={camposComLinha.has('data_lancamento_de') ? 'll-input-erro' : undefined}
									value={filtros.data_lancamento_de}
									max={limiteData('lancamento', 'de')}
									onChange={handleDataChange}
								/>
								{campoMensagem === 'data_lancamento_de' && (
									<span className="ll-erro-data">O início não pode ser depois do fim.</span>
								)}
							</div>
							<div className="ll-field">
								<label>Lançamento até</label>
								<input
									type="date"
									name="data_lancamento_ate"
									className={camposComLinha.has('data_lancamento_ate') ? 'll-input-erro' : undefined}
									value={filtros.data_lancamento_ate}
									min={limiteData('lancamento', 'ate')}
									onChange={handleDataChange}
								/>
								{campoMensagem === 'data_lancamento_ate' && (
									<span className="ll-erro-data">O início não pode ser depois do fim.</span>
								)}
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Status</label>
								<div className="ll-status-checks">
									<div className="ll-status-grupo">
										<label>
											<input
												type="checkbox"
												className={exclusivo ? 'll-checkbox-round' : ''}
												checked={filtros.apenas_abertos === 'true'}
												onChange={(e) => marcarCiclo('apenas_abertos', e.target.checked)}
											/>
											Aberto
										</label>
										<label>
											<input
												type="checkbox"
												className={exclusivo ? 'll-checkbox-round' : ''}
												checked={filtros.apenas_em_analise === 'true'}
												onChange={(e) => marcarCiclo('apenas_em_analise', e.target.checked)}
											/>
											Em análise
										</label>
										<label>
											<input
												type="checkbox"
												className={exclusivo ? 'll-checkbox-round' : ''}
												checked={filtros.apenas_quitados === 'true'}
												onChange={(e) => marcarCiclo('apenas_quitados', e.target.checked)}
											/>
											Pago
										</label>
									</div>
									<span className="ll-status-sep" />
									<div className="ll-status-grupo">
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
												checked={filtros.estorno === 'true'}
												onChange={(e) =>
													setFiltros({ ...filtros, estorno: e.target.checked ? 'true' : '' })
												}
											/>
											Reembolso
										</label>
									</div>
									<span className="ll-status-sep" />
									<div className="ll-status-grupo">
										<label>
											<input
												type="checkbox"
												className={exclusivo ? 'll-checkbox-round' : ''}
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
												className={exclusivo ? 'll-checkbox-round' : ''}
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
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Pagamento de</label>
								<input
									type="date"
									name="data_pagamento_de"
									className={camposComLinha.has('data_pagamento_de') ? 'll-input-erro' : undefined}
									value={filtros.data_pagamento_de}
									max={limiteData('pagamento', 'de')}
									onChange={handleDataChange}
								/>
								{campoMensagem === 'data_pagamento_de' && (
									<span className="ll-erro-data">O início não pode ser depois do fim.</span>
								)}
							</div>
							<div className="ll-field">
								<label>Pagamento até</label>
								<input
									type="date"
									name="data_pagamento_ate"
									className={camposComLinha.has('data_pagamento_ate') ? 'll-input-erro' : undefined}
									value={filtros.data_pagamento_ate}
									min={limiteData('pagamento', 'ate')}
									onChange={handleDataChange}
								/>
								{campoMensagem === 'data_pagamento_ate' && (
									<span className="ll-erro-data">O início não pode ser depois do fim.</span>
								)}
							</div>
							<div className="ll-field">
								<label>Valor mínimo</label>
								<input
									type="text"
									inputMode="decimal"
									name="valor_minimo"
									className={camposComLinha.has('valor_minimo') ? 'll-input-erro' : undefined}
									value={filtros.valor_minimo}
									onChange={handleFiltroChange}
									placeholder="0,00"
								/>
								{campoMensagem === 'valor_minimo' && (
									<span className="ll-erro-data">{textoFalha('valor_minimo')}</span>
								)}
							</div>
							<div className="ll-field">
								<label>Valor máximo</label>
								<input
									type="text"
									inputMode="decimal"
									name="valor_maximo"
									className={camposComLinha.has('valor_maximo') ? 'll-input-erro' : undefined}
									value={filtros.valor_maximo}
									onChange={handleFiltroChange}
									placeholder="0,00"
								/>
								{campoMensagem === 'valor_maximo' && (
									<span className="ll-erro-data">{textoFalha('valor_maximo')}</span>
								)}
							</div>
						</div>

						<div className="ll-buttons">
							{/* À esquerda, alinhado com o título: modo de combinação dos status
							    (só na sessão). Inclusivo (OU) é o padrão; Exclusivo (E) exige todos.
							    A nota fica na mesma linha, logo à direita do toggle. */}
							<div className="ll-modo-grupo">
								<div
									className="ll-status-modo"
									role="group"
									aria-label="Modo de combinação dos status"
								>
									<button
										type="button"
										className={!exclusivo ? 'is-ativo' : ''}
										aria-pressed={!exclusivo}
										onClick={() => trocarModo('inclusivo')}
										title="União: traz quem está em QUALQUER status marcado"
									>
										Inclusivo
									</button>
									<button
										type="button"
										className={exclusivo ? 'is-ativo' : ''}
										aria-pressed={exclusivo}
										onClick={() => trocarModo('exclusivo')}
										title="Interseção: só quem satisfaz TODOS os status marcados"
									>
										Exclusivo
									</button>
								</div>
								<p className="ll-modo-nota">O modo vale só para os status.</p>
							</div>
							<div className="ll-buttons-acoes">
								<button type="button" className="ll-btn-limpar" onClick={handleLimpar}>
									Limpar
								</button>
								<button type="submit" className={classeBuscar}>
									{rotuloBuscar}
								</button>
							</div>
						</div>
					</form>
				</div>

				{/* TABELA */}
				<div className="ll-card">
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<h4 style={{ margin: 0 }}>TRANSAÇÕES ({lancamentos.length})</h4>
						<button
							type="button"
							onClick={handleExportar}
							disabled={lancamentos.length === 0}
							title={
								lancamentos.length === 0
									? 'Pesquise lançamentos para exportar'
									: 'Exportar o resultado em .xlsx'
							}
							style={{
								padding: '7px 16px',
								borderRadius: 8,
								border: 'none',
								background: lancamentos.length === 0 ? 'var(--border)' : 'var(--primary)',
								color: '#fff',
								fontWeight: 600,
								fontSize: '0.82rem',
								cursor: lancamentos.length === 0 ? 'not-allowed' : 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: 6
							}}
						>
							<i className="bi bi-file-earmark-spreadsheet" />
							Exportar
						</button>
					</div>
					<div className="ll-table-wrapper" style={{ marginTop: 12 }}>
						<table className="ll-table">
							<thead>
								<tr>
									<th data-tooltip="CPF ou CNPJ do cliente / fornecedor">CPF/CNPJ</th>
									<th data-tooltip="Nome do cliente ou razão social do fornecedor">
										Nome / Razão Social
									</th>
									<th data-tooltip="Categoria do lançamento">Tipo de Conta</th>
									<th data-tooltip="Crédito (entrada) ou Débito (saída)">Natureza</th>
									<th data-tooltip="Data limite para pagamento">Vencimento</th>
									<th data-tooltip="Data em que o pagamento foi efetivado">Pagamento</th>
									<th data-tooltip="Valor original registrado no lançamento">Vl. Lançamento</th>
									<th data-tooltip="Total efetivamente pago: valor pago + multa + juros">
										Vl. Pagamento
									</th>
									<th data-tooltip="Situação do lançamento: Pago, Em análise, Em aberto ou Vencido">
										Status
									</th>
									<th data-tooltip="Ações disponíveis: editar, comprovante, efetivar">Ações</th>
								</tr>
							</thead>
							<tbody>
								{lancamentos.length === 0 ? (
									<tr>
										<td colSpan="10" className="ll-empty">
											{populado
												? 'Nenhum lançamento encontrado'
												: 'Clique em "Pesquisar" para buscar os lançamentos.'}
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
														title={
															cpfVisivelLanc[l.id_lancamento]
																? 'Clique para ocultar'
																: 'Clique para revelar'
														}
														onClick={() =>
															setCpfVisivelLanc((prev) => ({
																...prev,
																[l.id_lancamento]: !prev[l.id_lancamento]
															}))
														}
														style={{ cursor: 'pointer' }}
													>
														{cpfVisivelLanc[l.id_lancamento]
															? l.cpf_cnpj_clifor || '—'
															: rassurarCpfCnpj(l.cpf_cnpj_clifor)}
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
											<td>{statusLabel(l)}</td>
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
															title={
																admin ? 'Efetivar lançamento' : 'Efetivar e enviar para análise'
															}
														>
															<i className="bi bi-journal-check"></i>
														</button>
													)}
													{admin && l.data_efetivacao && !l.data_aprovacao && !l.estorno && (
														<button
															className="ll-btn-acao aprovar"
															onClick={() => abrirModalAprovar(l)}
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

				{/* MODAL FECHAR — serve Efetivar e Aprovar; ver abrirModalAprovar. */}
				{(modalFechar || modalAprovar) && (
					<div
						className="ll-overlay"
						style={{ zIndex: loteAcima ? 9998 : 10000 }}
						onClick={fecharModalEfetivacao}
					>
						<div className="ll-modal ll-modal--duplo" onClick={(e) => e.stopPropagation()}>
							<h3>{aprovando ? 'Aprovar Lançamento' : 'Efetivar Lançamento'}</h3>

							<form onSubmit={aprovando ? handleAprovar : handleConfirmarFechar}>
								<div className="ll-efetiva-layout">
									{/* coluna esquerda — informações do lançamento */}
									<div className="ll-efetiva-col">
										<div className="ll-col-titulo">
											<i className="bi bi-lock" />
											Dados do Lançamento
										</div>
										<div className="ll-field">
											<label>Cliente / Fornecedor</label>
											<div
												style={{
													padding: '6px 10px',
													background: 'var(--input-bg)',
													borderRadius: 6,
													fontSize: '0.875rem',
													color: 'var(--text-muted)'
												}}
											>
												{nomeClifor(lancamentoSelecionado)}
											</div>
										</div>
										{/* Mesmo pareamento do modal de Editar: os dois mostram os mesmos dados. */}
										<div className="ll-row">
											<div className="ll-field">
												<label>Tipo de Conta</label>
												<div
													style={{
														padding: '6px 10px',
														background: 'var(--input-bg)',
														borderRadius: 6,
														fontSize: '0.875rem',
														color: 'var(--text-muted)'
													}}
												>
													{nomeTipo(lancamentoSelecionado)}
												</div>
											</div>
											<div className="ll-field">
												<label>Natureza</label>
												<div
													style={{
														padding: '6px 10px',
														background: 'var(--input-bg)',
														borderRadius: 6,
														fontSize: '0.875rem',
														color: 'var(--text-muted)'
													}}
												>
													{lancamentoSelecionado?.natureza_lancamento}
												</div>
											</div>
										</div>
										<div className="ll-row">
											<div className="ll-field">
												<label>Vl. Lançamento</label>
												<div
													style={{
														padding: '6px 10px',
														background: 'var(--input-bg)',
														borderRadius: 6,
														fontSize: '0.875rem',
														color: 'var(--text-muted)'
													}}
												>
													{formatarValor(lancamentoSelecionado?.valor)}
												</div>
											</div>
											<div className="ll-field">
												<label>Data de Vencimento</label>
												<div
													style={{
														padding: '6px 10px',
														background: 'var(--input-bg)',
														borderRadius: 6,
														fontSize: '0.875rem',
														color: 'var(--text-muted)'
													}}
												>
													{formatarData(lancamentoSelecionado?.data_vencimento)}
												</div>
											</div>
										</div>
										<div className="ll-field">
											<label>Observação do Lançamento</label>
											<div
												style={{
													padding: '6px 10px',
													background: 'var(--input-bg)',
													borderRadius: 6,
													fontSize: '0.875rem',
													color: 'var(--text-muted)'
												}}
											>
												{lancamentoSelecionado?.observacao || '—'}
											</div>
										</div>
										{/* Linha inteira: é a largura que faz o "por {nome} · {data}" caber sem quebrar. */}
										<div className="ll-field">
											<label>Última interação</label>
											<div>{ultimaInteracaoChip(lancamentoSelecionado)}</div>
										</div>
										<div className="ll-row">
											<div className="ll-field" style={{ flex: 'none' }}>
												<label>Origem</label>
												<div style={{ padding: '4px 0' }}>
													{origemChip(lancamentoSelecionado, true)}
												</div>
											</div>
											<div className="ll-field" style={{ flex: 'none' }}>
												<label style={{ visibility: 'hidden' }}>_</label>
												<label
													style={{
														display: 'flex',
														alignItems: 'center',
														gap: 8,
														textTransform: 'none',
														letterSpacing: 0,
														fontSize: '0.85rem',
														cursor: 'pointer',
														padding: '6px 0'
													}}
												>
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
									</div>

									{/* divisor vertical */}
									<div className="ll-efetiva-divider" />

									{/* coluna direita — efetivação */}
									<div className="ll-efetiva-col">
										<div className="ll-col-titulo">
											<i className="bi bi-pencil-square" />
											Efetivação
											<span className="ll-col-titulo-status">
												{statusLabel(lancamentoSelecionado)}
											</span>
										</div>
										<div className="ll-field">
											<label>Data de Pagamento</label>
											<input
												type="date"
												name="data_pagamento"
												value={formFechar.data_pagamento}
												onChange={handleFecharChange}
												{...travado}
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
												style={
													lancamentoSelecionado?.valor_pago
														? { background: 'var(--input-bg)', opacity: 0.7 }
														: {}
												}
												{...travado}
											/>
										</div>
										<div className="ll-row">
											<div className="ll-field">
												<label>Multa</label>
												<input
													type="text"
													name="multa"
													value={formFechar.multa}
													onChange={handleFecharChange}
													{...travado}
												/>
											</div>
											<div className="ll-field">
												<label>Juros</label>
												<input
													type="text"
													name="juros"
													value={formFechar.juros}
													onChange={handleFecharChange}
													{...travado}
												/>
											</div>
										</div>

										{(formFechar.multa || formFechar.juros) && (
											<div className="ll-field">
												<label>Total Pago</label>
												<div
													style={{
														padding: '6px 10px',
														background: 'var(--input-bg)',
														borderRadius: 6,
														fontSize: '0.95rem',
														fontWeight: 600,
														color: 'var(--primary)'
													}}
												>
													{formatarValor(totalPago())}
												</div>
											</div>
										)}

										<div className="ll-field">
											<label>Observação do Pagamento</label>
											<textarea
												name="observacao_pagamento"
												value={formFechar.observacao_pagamento}
												onChange={handleFecharChange}
												rows="2"
												{...travado}
											/>
										</div>

										{lancamentoSelecionado?.tem_comprovante && (
											<div className="ll-field">
												<label>Comprovante Atual</label>
												<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
													<span style={{ fontSize: 13, color: 'var(--text)' }}>
														<i className="bi bi-file-earmark-pdf" style={{ marginRight: 6 }}></i>
														{lancamentoSelecionado.comprovante_nome || 'comprovante.pdf'}
													</span>
													{/* Aprovar não mexe no lançamento: ver o comprovante faz parte, apagar não. */}
													{!aprovando && (
														<button
															type="button"
															onClick={() => setConfirmarRemoverComprovante(true)}
															style={{
																padding: '4px 10px',
																borderRadius: 6,
																border: '1px solid #ef4444',
																background: 'transparent',
																color: '#ef4444',
																cursor: 'pointer',
																fontSize: 12
															}}
														>
															Remover
														</button>
													)}
												</div>
											</div>
										)}

										{!aprovando && !lancamentoSelecionado?.tem_comprovante && (
											<div className="ll-field">
												<label>
													Comprovante de Pagamento (PDF){' '}
													<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
														— opcional
													</span>
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
													<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
														{comprovante.name}
													</span>
												)}
											</div>
										)}
									</div>
								</div>

								<div className="ll-buttons">
									<button type="button" className="ll-btn-limpar" onClick={fecharModalEfetivacao}>
										Cancelar
									</button>
									<button type="submit" className="ll-btn-filtrar">
										{aprovando ? 'Aprovar' : 'Confirmar'}
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
					<div
						className="ll-overlay"
						style={{ zIndex: loteAcima ? 9998 : 10000 }}
						onClick={() => setModalEditar(null)}
					>
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
											<select
												name="id_clifor_relacionado_fk"
												value={formEditar.id_clifor_relacionado_fk}
												onChange={handleEditarChange}
											>
												{clifors.map((c) => (
													<option key={c.id_clifor} value={c.id_clifor}>
														{c.nome}
													</option>
												))}
											</select>
										</div>
										<div className="ll-row">
											<div className="ll-field">
												<label>Tipo de Conta</label>
												<select
													name="id_tipo_conta_fk"
													value={formEditar.id_tipo_conta_fk}
													onChange={handleEditarChange}
												>
													{tiposConta.map((t) => (
														<option key={t.id_tipo_conta} value={t.id_tipo_conta}>
															{t.descricao_conta}
														</option>
													))}
												</select>
											</div>
											<div className="ll-field">
												<label>Natureza</label>
												<select
													name="natureza_lancamento"
													value={formEditar.natureza_lancamento}
													onChange={handleEditarChange}
												>
													<option value="Credito">Crédito</option>
													<option value="Debito">Débito</option>
												</select>
											</div>
										</div>
										<div className="ll-row">
											<div className="ll-field">
												<label>Vl. Lançamento</label>
												<input
													type="text"
													inputMode="decimal"
													name="valor"
													value={formEditar.valor}
													onChange={handleEditarChange}
													placeholder="0,00"
												/>
											</div>
											<div className="ll-field">
												<label>Data de Vencimento</label>
												<input
													type="date"
													name="data_vencimento"
													value={formEditar.data_vencimento}
													onChange={handleEditarChange}
												/>
											</div>
										</div>
										<div className="ll-field">
											<label>Observação do Lançamento</label>
											<textarea
												name="observacao"
												value={formEditar.observacao}
												onChange={handleEditarChange}
												rows="2"
											/>
										</div>
										{/* Linha inteira: é a largura que faz o "por {nome} · {data}" caber sem quebrar. */}
										<div className="ll-field">
											<label>Última interação</label>
											<div>{ultimaInteracaoChip(lancamentoSelecionado)}</div>
										</div>
										<div className="ll-row">
											<div className="ll-field" style={{ flex: 'none' }}>
												<label>Origem</label>
												<div style={{ padding: '4px 0' }}>
													{origemChip(lancamentoSelecionado, true)}
												</div>
											</div>
											<div className="ll-field" style={{ flex: 'none' }}>
												<label style={{ visibility: 'hidden' }}>_</label>
												<label
													style={{
														display: 'flex',
														alignItems: 'center',
														gap: 8,
														textTransform: 'none',
														letterSpacing: 0,
														fontSize: '0.85rem',
														cursor: 'pointer',
														padding: '6px 0'
													}}
												>
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
									</div>

									{/* divisor vertical */}
									<div className="ll-efetiva-divider" />

									{/* coluna direita — efetivação */}
									<div className="ll-efetiva-col">
										<div className="ll-col-titulo">
											<i className="bi bi-pencil-square" />
											Efetivação
											<span className="ll-col-titulo-status">
												{statusLabel(lancamentoSelecionado)}
											</span>
										</div>
										<div className="ll-field">
											<label>Data de Pagamento</label>
											<input
												type="date"
												name="data_pagamento"
												value={formEditar.data_pagamento}
												onChange={handleEditarChange}
											/>
										</div>
										<div className="ll-field">
											<label>Valor Pago</label>
											<input
												type="text"
												inputMode="decimal"
												name="valor_pago"
												value={formEditar.valor_pago}
												onChange={handleEditarChange}
												placeholder="0,00"
											/>
										</div>
										<div className="ll-row">
											<div className="ll-field">
												<label>Multa</label>
												<input
													type="text"
													inputMode="decimal"
													name="multa"
													value={formEditar.multa}
													onChange={handleEditarChange}
													placeholder="0,00"
												/>
											</div>
											<div className="ll-field">
												<label>Juros</label>
												<input
													type="text"
													inputMode="decimal"
													name="juros"
													value={formEditar.juros}
													onChange={handleEditarChange}
													placeholder="0,00"
												/>
											</div>
										</div>
										{(formEditar.multa || formEditar.juros) && (
											<div className="ll-field">
												<label>Total Pago</label>
												<div
													style={{
														padding: '6px 10px',
														background: 'var(--input-bg)',
														borderRadius: 6,
														fontSize: '0.95rem',
														fontWeight: 600,
														color: 'var(--primary)'
													}}
												>
													{formatarValor(totalPagoEditar())}
												</div>
											</div>
										)}
										<div className="ll-field">
											<label>Observação do Pagamento</label>
											<textarea
												name="observacao_pagamento"
												value={formEditar.observacao_pagamento}
												onChange={handleEditarChange}
												rows="2"
											/>
										</div>
										{lancamentoSelecionado?.tem_comprovante && (
											<div className="ll-field">
												<label>Comprovante Atual</label>
												<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
													<span style={{ fontSize: 13, color: 'var(--text)' }}>
														<i className="bi bi-file-earmark-pdf" style={{ marginRight: 6 }}></i>
														{lancamentoSelecionado.comprovante_nome || 'comprovante.pdf'}
													</span>
													<button
														type="button"
														onClick={() => setConfirmarRemoverComprovante(true)}
														style={{
															padding: '4px 10px',
															borderRadius: 6,
															border: '1px solid #ef4444',
															background: 'transparent',
															color: '#ef4444',
															cursor: 'pointer',
															fontSize: 12
														}}
													>
														Remover
													</button>
												</div>
											</div>
										)}
										{!lancamentoSelecionado?.tem_comprovante && (
											<div className="ll-field">
												<label>
													Comprovante de Pagamento (PDF){' '}
													<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
														— opcional
													</span>
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
													<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
														{comprovante.name}
													</span>
												)}
											</div>
										)}
									</div>
								</div>

								<div className="ll-buttons" style={{ justifyContent: 'space-between' }}>
									<button
										type="button"
										onClick={() => setConfirmarDeletar(true)}
										style={{
											padding: '7px 14px',
											borderRadius: 8,
											border: '1px solid #dc2626',
											background: 'transparent',
											color: '#dc2626',
											fontSize: '0.85rem',
											fontWeight: 500,
											cursor: 'pointer'
										}}
									>
										<i className="bi bi-trash" /> Excluir
									</button>
									<div style={{ display: 'flex', gap: 8 }}>
										<button
											type="button"
											className="ll-btn-limpar"
											onClick={() => setModalEditar(null)}
										>
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
					<div
						className="ll-modal"
						style={{ maxHeight: '90vh', overflowY: 'auto' }}
						onClick={(e) => e.stopPropagation()}
					>
						<h3>Detalhes do Lançamento #{modalVer.id_lancamento}</h3>

						<div className="ll-row">
							<div className="ll-field">
								<label>Cliente / Fornecedor</label>
								<div
									style={{
										padding: '6px 10px',
										background: 'var(--input-bg)',
										borderRadius: 6,
										fontSize: '0.875rem'
									}}
								>
									{nomeClifor(modalVer)}
								</div>
							</div>
							<div className="ll-field">
								<label>Tipo de Conta</label>
								<div
									style={{
										padding: '6px 10px',
										background: 'var(--input-bg)',
										borderRadius: 6,
										fontSize: '0.875rem'
									}}
								>
									{nomeTipo(modalVer)}
								</div>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Natureza</label>
								<div
									style={{
										padding: '6px 10px',
										background: 'var(--input-bg)',
										borderRadius: 6,
										fontSize: '0.875rem'
									}}
								>
									{modalVer.natureza_lancamento}
								</div>
							</div>
							<div className="ll-field">
								<label>Valor</label>
								<div
									style={{
										padding: '6px 10px',
										background: 'var(--input-bg)',
										borderRadius: 6,
										fontSize: '0.875rem'
									}}
								>
									{formatarValor(modalVer.valor)}
								</div>
							</div>
						</div>

						<div className="ll-row">
							<div className="ll-field">
								<label>Vencimento</label>
								<div
									style={{
										padding: '6px 10px',
										background: 'var(--input-bg)',
										borderRadius: 6,
										fontSize: '0.875rem'
									}}
								>
									{formatarData(modalVer.data_vencimento)}
								</div>
							</div>
							<div className="ll-field">
								<label>Status</label>
								<div style={{ padding: '4px 0' }}>
									{statusLabel(modalVer)} {origemChip(modalVer, true)}
								</div>
							</div>
						</div>

						{modalVer.data_efetivacao && (
							<div className="ll-row">
								<div className="ll-field">
									<label>Efetivado por</label>
									<div
										style={{
											padding: '6px 10px',
											background: 'var(--input-bg)',
											borderRadius: 6,
											fontSize: '0.875rem'
										}}
									>
										{modalVer.nome_usuario_efetivacao || '—'} ·{' '}
										{formatarCarimbo(modalVer.data_efetivacao)}
									</div>
								</div>
								<div className="ll-field">
									<label>Aprovado por</label>
									<div
										style={{
											padding: '6px 10px',
											background: 'var(--input-bg)',
											borderRadius: 6,
											fontSize: '0.875rem'
										}}
									>
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
										<div
											style={{
												padding: '6px 10px',
												background: 'var(--input-bg)',
												borderRadius: 6,
												fontSize: '0.875rem'
											}}
										>
											{formatarData(modalVer.data_pagamento)}
										</div>
									</div>
									<div className="ll-field">
										<label>Valor Pago</label>
										<div
											style={{
												padding: '6px 10px',
												background: 'var(--input-bg)',
												borderRadius: 6,
												fontSize: '0.875rem'
											}}
										>
											{formatarValor(modalVer.valor_pago)}
										</div>
									</div>
								</div>
								{(modalVer.multa || modalVer.juros) && (
									<div className="ll-row">
										<div className="ll-field">
											<label>Multa</label>
											<div
												style={{
													padding: '6px 10px',
													background: 'var(--input-bg)',
													borderRadius: 6,
													fontSize: '0.875rem'
												}}
											>
												{formatarValor(modalVer.multa)}
											</div>
										</div>
										<div className="ll-field">
											<label>Juros</label>
											<div
												style={{
													padding: '6px 10px',
													background: 'var(--input-bg)',
													borderRadius: 6,
													fontSize: '0.875rem'
												}}
											>
												{formatarValor(modalVer.juros)}
											</div>
										</div>
									</div>
								)}
								<div className="ll-field">
									<label>Total Pago</label>
									<div
										style={{
											padding: '6px 10px',
											background: 'var(--input-bg)',
											borderRadius: 6,
											fontSize: '0.95rem',
											fontWeight: 600,
											color: 'var(--primary)'
										}}
									>
										{formatarTotal(modalVer)}
									</div>
								</div>
							</>
						)}

						{modalVer.observacao && (
							<div className="ll-field">
								<label>Observação do Lançamento</label>
								<div
									style={{
										padding: '6px 10px',
										background: 'var(--input-bg)',
										borderRadius: 6,
										fontSize: '0.875rem',
										color: 'var(--text-muted)'
									}}
								>
									{modalVer.observacao}
								</div>
							</div>
						)}

						{modalVer.observacao_pagamento && (
							<div className="ll-field">
								<label>Observação do Pagamento</label>
								<div
									style={{
										padding: '6px 10px',
										background: 'var(--input-bg)',
										borderRadius: 6,
										fontSize: '0.875rem',
										color: 'var(--text-muted)'
									}}
								>
									{modalVer.observacao_pagamento}
								</div>
							</div>
						)}

						{modalVer.tem_comprovante && (
							<div className="ll-field">
								<label>Comprovante</label>
								<button
									type="button"
									onClick={() => baixarComprovante(modalVer.id_lancamento)}
									style={{
										background: 'transparent',
										border: '1px solid var(--border)',
										borderRadius: 6,
										padding: '6px 12px',
										cursor: 'pointer',
										fontSize: '0.85rem',
										display: 'flex',
										alignItems: 'center',
										gap: 6,
										color: 'var(--text)'
									}}
								>
									<i className="bi bi-file-earmark-pdf" /> Baixar PDF
								</button>
							</div>
						)}

						<div className="ll-buttons">
							<button className="ll-btn-filtrar" onClick={() => setModalVer(null)}>
								Fechar
							</button>
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
					podeReverter={admin}
					onReverter={handleReverterTimeline}
				/>
			)}

			{perfilUsuario && (
				<PerfilCompletoPopup usuario={perfilUsuario} onFechar={() => setPerfilUsuario(null)} />
			)}

			{modalExportar && <ExportarLancamentosModal onFechar={() => setModalExportar(false)} />}
		</>
	);
}

export default ListaLancamentosPage;
