import { useState, useRef, useEffect } from 'react';

// Os quatro eventos do lançamento que carregam ator + carimbo de servidor.
// `ordem` é o desempate: quando o admin efetiva, o backend carimba data_efetivacao e
// data_aprovacao no MESMO instante, e sem isto os dois sairiam em ordem aleatória.
const EVENTOS = [
	{ acao: 'Lançado', ordem: 0, icone: 'bi-plus-circle', campoData: 'data_lancamento', campoNome: 'nome_usuario_lancamento', campoId: 'id_usuario_fk_lancamento' },
	{ acao: 'Efetivado', ordem: 1, icone: 'bi-hourglass-split', campoData: 'data_efetivacao', campoNome: 'nome_usuario_efetivacao', campoId: 'id_usuario_fk_efetivacao' },
	{ acao: 'Aprovado', ordem: 2, icone: 'bi-check-circle', campoData: 'data_aprovacao', campoNome: 'nome_usuario_aprovacao', campoId: 'id_usuario_fk_aprovacao' },
	{ acao: 'Editado', ordem: 3, icone: 'bi-pencil', campoData: 'data_edicao', campoNome: 'nome_usuario_edicao', campoId: 'id_usuario_fk_edicao' },
];

// Carimbos do servidor vêm em UTC e sem sufixo de fuso ("2026-07-15T18:00:06").
// Sem o 'Z' o JS leria como hora local e o horário sairia 3h adiantado.
// Só serve para os quatro campos acima: data_vencimento é DATE e data_pagamento é
// digitada pelo usuário — converter fuso nelas jogaria a data para o dia anterior.
const paraDataLocal = (iso) => {
	if (!iso) return null;
	const temFuso = iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso);
	return new Date(temFuso ? iso : `${iso}Z`);
};

export const formatarCarimbo = (iso) => {
	const d = paraDataLocal(iso);
	if (!d || Number.isNaN(d.getTime())) return '—';
	return d.toLocaleString('pt-BR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
};

// Eventos que de fato aconteceram, do mais antigo para o mais recente.
//
// Lançado → Efetivado → Aprovado têm ordem causal: não se efetiva o que não foi
// cadastrado, e o backend recusa aprovar sem efetivar. Ordenar esses três só pela data
// seria confiar num carimbo que às vezes não é carimbo: o backfill do fluxo antigo
// gravou data_efetivacao = data_pagamento, que é data digitada à meia-noite e pode ser
// ANTERIOR ao data_lancamento — o que faria "Efetivado" aparecer antes de "Lançado"
// num lançamento Pago. Por isso o instante que ORDENA um evento de fluxo nunca recua:
// é o dele ou o do evento anterior, o que for maior. A data EXIBIDA continua sendo a
// crua — quem ordena é o piso, quem informa é o dado.
//
// "Editado" não tem posição fixa no fluxo (dá para editar antes ou depois de efetivar),
// então ele é o único que se posiciona pela própria data.
export const eventosDoLancamento = (l) => {
	if (!l) return [];
	const presentes = EVENTOS.filter((e) => l[e.campoData]).map((e) => ({
		acao: e.acao,
		ordem: e.ordem,
		icone: e.icone,
		data: l[e.campoData],
		nome: l[e.campoNome] || '—',
		idUsuario: l[e.campoId] || null,
	}));

	const EDITADO = 3;
	let piso = -Infinity;
	presentes.forEach((e) => {
		const instante = paraDataLocal(e.data).getTime();
		if (e.ordem === EDITADO) {
			e.instanteOrdem = instante;
			return;
		}
		piso = Math.max(piso, instante);
		e.instanteOrdem = piso;
	});

	return presentes.sort((a, b) =>
		a.instanteOrdem !== b.instanteOrdem ? a.instanteOrdem - b.instanteOrdem : a.ordem - b.ordem
	);
};

export const ultimaInteracao = (l) => {
	const eventos = eventosDoLancamento(l);
	return eventos.length ? eventos[eventos.length - 1] : null;
};

// `onAbrirPerfil` é opcional: sem ele o nome é texto puro. Quem decide se o perfil pode
// ser aberto é a página (hoje, só admin) — o modal não repete essa regra.
//
// zIndex abaixo do PerfilCompletoPopup (10001), que abre POR CIMA deste, e acima da
// modal de Editar/Efetivar (1000), sobre a qual este abre.
// Quanto tempo o "Confirmar" precisa ficar segurado antes de disparar. Reverter apaga
// carimbos e some com a data de pagamento — segurar evita o clique acidental sem prender
// o usuário num modal de confirmação.
const HOLD_MS = 1000;

function TimelineLancamentoModal({ lancamento, onFechar, onAbrirPerfil, podeReverter, onReverter }) {
	const eventos = eventosDoLancamento(lancamento);

	// Um passo de undo por vez: o estado atual só pode voltar para o imediatamente
	// anterior. Pago → Em análise; Em análise → Aberto; o resto não tem o que desfazer.
	const alvoRevert =
		lancamento?.situacao === 'Pago' ? 'em_analise'
			: lancamento?.situacao === 'Em análise' ? 'aberto'
				: null;
	const mostrarReverter = !!podeReverter && !!alvoRevert;
	const rotuloDestino = alvoRevert === 'em_analise' ? 'Em análise' : 'Aberto';

	// "Voltar" arma a ação; "Confirmar" só fica ativo (e segurável) enquanto armado.
	const [armado, setArmado] = useState(false);
	const [progresso, setProgresso] = useState(0); // 0..1, preenchimento do hold
	const rafRef = useRef(null);
	const inicioRef = useRef(0);

	const pararRaf = () => {
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		rafRef.current = null;
	};

	// Limpa o rAF se a modal desmontar no meio de um hold (ex.: revert dispara e a
	// página fecha a modal).
	useEffect(() => () => pararRaf(), []);

	const cancelarHold = () => {
		pararRaf();
		setProgresso(0);
	};

	const alternarArmado = () => {
		setArmado((a) => {
			if (a) cancelarHold();
			return !a;
		});
	};

	const iniciarHold = () => {
		if (!armado) return;
		inicioRef.current = performance.now();
		pararRaf();
		const tick = (agora) => {
			const p = Math.min(1, (agora - inicioRef.current) / HOLD_MS);
			setProgresso(p);
			if (p >= 1) {
				pararRaf();
				setProgresso(0);
				setArmado(false);
				onReverter?.(alvoRevert);
			} else {
				rafRef.current = requestAnimationFrame(tick);
			}
		};
		rafRef.current = requestAnimationFrame(tick);
	};

	return (
		<div className="ll-overlay" style={{ zIndex: 10000 }} onClick={onFechar}>
			<div className="ll-modal" onClick={(e) => e.stopPropagation()}>
				<h3>Histórico do Lançamento</h3>

				<ol className="ll-timeline">
					{eventos.map((e) => (
						<li className="ll-timeline-item" key={e.acao}>
							<span className="ll-timeline-marcador">
								<i className={`bi ${e.icone}`} />
							</span>
							<div className="ll-timeline-conteudo">
								<span className="ll-timeline-acao">{e.acao}</span>
								{onAbrirPerfil && e.idUsuario ? (
									<button
										type="button"
										className="ll-timeline-nome ll-timeline-nome--link"
										title="Ver perfil do usuário"
										onClick={() => onAbrirPerfil(e.idUsuario)}
									>
										por {e.nome}
									</button>
								) : (
									<span className="ll-timeline-nome">por {e.nome}</span>
								)}
								<span className="ll-timeline-data">{formatarCarimbo(e.data)}</span>
							</div>
						</li>
					))}
				</ol>

				<div className="ll-buttons" style={{ justifyContent: 'space-between' }}>
					<div className="ll-reverter-grupo">
						{mostrarReverter && (
							<>
								<button
									type="button"
									className={`ll-btn-voltar ${armado ? 'is-armado' : ''}`}
									onClick={alternarArmado}
									aria-pressed={armado}
								>
									<i className="bi bi-arrow-counterclockwise" /> Voltar para {rotuloDestino}
								</button>
								<button
									type="button"
									className={`ll-btn-confirmar-hold ${armado ? 'is-armado' : ''}`}
									disabled={!armado}
									onPointerDown={iniciarHold}
									onPointerUp={cancelarHold}
									onPointerLeave={cancelarHold}
									onPointerCancel={cancelarHold}
									title={armado ? 'Segure para confirmar a reversão' : 'Selecione "Voltar" primeiro'}
								>
									<span>Confirmar</span>
									<span className="ll-hold-progresso" style={{ width: `${progresso * 100}%` }} />
								</button>
							</>
						)}
					</div>
					<button type="button" className="ll-btn-limpar" onClick={onFechar}>
						Fechar
					</button>
				</div>
			</div>
		</div>
	);
}

export default TimelineLancamentoModal;
