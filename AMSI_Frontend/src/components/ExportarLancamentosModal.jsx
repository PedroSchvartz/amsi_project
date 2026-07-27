import { useState, useEffect } from 'react';
import { useExportacao } from '../services/exportacaoContext';
import ModalConfirm from './ModalConfirm';

const s = {
	overlay: {
		position: 'fixed',
		inset: 0,
		background: 'rgba(0,0,0,0.55)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 10000
	},
	box: {
		background: 'var(--bg-card)',
		color: 'var(--text)',
		borderRadius: 12,
		padding: '28px 32px',
		width: '100%',
		maxWidth: 460,
		boxShadow: '0 16px 48px var(--shadow)'
	},
	titulo: {
		fontFamily: 'var(--font-display)',
		fontSize: '1.35rem',
		fontWeight: 700,
		color: 'var(--primary)',
		margin: '0 0 10px'
	},
	texto: { fontSize: '0.88rem', color: 'var(--text)', margin: '0 0 18px' },
	opcao: {
		display: 'flex',
		alignItems: 'flex-start',
		gap: 10,
		padding: '10px 12px',
		border: '1px solid var(--border)',
		borderRadius: 8,
		marginBottom: 8,
		cursor: 'pointer'
	},
	opcaoAtiva: { borderColor: 'var(--primary)', background: 'var(--input-bg)' },
	opcaoTitulo: { fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' },
	opcaoDesc: { fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 },
	status: {
		display: 'flex',
		alignItems: 'center',
		gap: 10,
		fontSize: '0.85rem',
		color: 'var(--text-muted)',
		margin: '4px 0 18px'
	},
	botoes: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
	btnCancelar: {
		padding: '8px 18px',
		borderRadius: 8,
		border: '1px solid var(--border)',
		background: 'transparent',
		color: 'var(--text)',
		fontWeight: 500,
		cursor: 'pointer',
		fontSize: '0.875rem'
	},
	btnPrimario: {
		padding: '8px 18px',
		borderRadius: 8,
		border: 'none',
		background: 'var(--primary)',
		color: '#fff',
		fontWeight: 600,
		cursor: 'pointer',
		fontSize: '0.875rem'
	}
};

const OPCOES = [
	{
		valor: 'download-auto',
		titulo: 'Baixar automaticamente ao terminar',
		desc: 'O download começa sozinho quando a planilha ficar pronta. Você pode fechar esta janela e continuar navegando.'
	},
	{
		valor: 'download-botao',
		titulo: 'Habilitar botão de download aqui',
		desc: 'Um botão "Baixar" aparece nesta janela ao terminar. Requer manter a janela aberta.'
	},
	{
		valor: 'email',
		titulo: 'Enviar por e-mail (.zip)',
		desc: 'A planilha é enviada ao seu e-mail em um arquivo .zip. Você pode fechar esta janela e continuar navegando.'
	}
];

function ExportarLancamentosModal({ onFechar }) {
	const { job, trocarEntrega, cancelar, baixarAgora } = useExportacao();
	const [confirmarCancelar, setConfirmarCancelar] = useState(false);

	// Job entregue/cancelado/erro em outro lugar (provider zerou) → fecha a janela.
	useEffect(() => {
		if (!job) onFechar();
	}, [job, onFechar]);

	if (!job) return null;

	const processando = job.status === 'processando';
	const prontoParaBaixar = job.status === 'concluido' && job.entrega === 'download-botao';

	// Só a opção "botão de download" prende a janela: fechar com ela antes de baixar
	// aborta e avisa o backend. Nas demais, fechar apenas segue em background.
	const tentarFechar = () => {
		if (job.entrega === 'download-botao') setConfirmarCancelar(true);
		else onFechar();
	};

	const confirmarSim = async () => {
		setConfirmarCancelar(false);
		await cancelar();
		onFechar();
	};

	return (
		<>
			<div style={s.overlay} onClick={tentarFechar}>
				<div style={s.box} onClick={(e) => e.stopPropagation()}>
					<h5 style={s.titulo}>Exportar lançamentos</h5>
					<p style={s.texto}>
						A pesquisa foi iniciada. Escolha como deseja receber o arquivo <strong>.xlsx</strong>:
					</p>

					{OPCOES.map((o) => (
						<label
							key={o.valor}
							style={{ ...s.opcao, ...(job.entrega === o.valor ? s.opcaoAtiva : {}) }}
						>
							<input
								type="radio"
								name="entrega"
								value={o.valor}
								checked={job.entrega === o.valor}
								onChange={() => trocarEntrega(o.valor)}
								disabled={!processando}
								style={{ marginTop: 3 }}
							/>
							<span>
								<span style={s.opcaoTitulo}>{o.titulo}</span>
								<span style={s.opcaoDesc}>{o.desc}</span>
							</span>
						</label>
					))}

					<div style={s.status}>
						{processando ? (
							<>
								<span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
								Gerando a planilha…
							</>
						) : (
							<>✓ Planilha pronta.</>
						)}
					</div>

					<div style={s.botoes}>
						<button style={s.btnCancelar} onClick={tentarFechar}>
							Fechar
						</button>
						{prontoParaBaixar && (
							<button style={s.btnPrimario} onClick={baixarAgora}>
								<i className="bi bi-download" style={{ marginRight: 6 }} />
								Baixar
							</button>
						)}
					</div>
				</div>
			</div>

			{confirmarCancelar && (
				<ModalConfirm
					titulo="Cancelar exportação"
					mensagem="Tem certeza que quer cancelar essa operação? A geração da planilha será interrompida."
					textoBotaoConfirmar="Sim"
					textoBotaoCancelar="Não"
					onConfirmar={confirmarSim}
					onCancelar={() => setConfirmarCancelar(false)}
					variante="perigo"
				/>
			)}
		</>
	);
}

export default ExportarLancamentosModal;
