const s = {
	overlay: {
		position: 'fixed',
		inset: 0,
		background: 'rgba(0,0,0,0.55)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		// Confirmação fica acima de qualquer modal do app (perfil 10001, lançamento até 10000)
		// e abaixo do ToastStack (99999).
		zIndex: 10002
	},
	box: {
		background: 'var(--bg-card)',
		color: 'var(--text)',
		borderRadius: 12,
		padding: '28px 32px',
		width: '100%',
		maxWidth: 420,
		boxShadow: '0 16px 48px var(--shadow)'
	},
	titulo: {
		fontFamily: 'var(--font-display)',
		fontSize: '1.35rem',
		fontWeight: 700,
		color: 'var(--primary)',
		margin: '0 0 10px'
	},
	mensagem: {
		fontSize: '0.88rem',
		color: 'var(--text)',
		margin: '0 0 20px'
	},
	botoes: {
		display: 'flex',
		gap: 10,
		justifyContent: 'flex-end'
	},
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
	btnPerigo: {
		padding: '8px 18px',
		borderRadius: 8,
		border: 'none',
		background: '#dc2626',
		color: '#fff',
		fontWeight: 600,
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

function ModalConfirm({
	titulo = 'Confirmar',
	mensagem,
	textoBotaoConfirmar = 'Confirmar',
	textoBotaoCancelar = 'Cancelar',
	onConfirmar,
	onCancelar,
	variante = 'perigo',
	desabilitado = false
}) {
	return (
		<div style={s.overlay} onClick={onCancelar}>
			<div style={s.box} onClick={(e) => e.stopPropagation()}>
				{titulo && <h5 style={s.titulo}>{titulo}</h5>}
				{mensagem && <p style={s.mensagem}>{mensagem}</p>}
				<div style={s.botoes}>
					<button style={s.btnCancelar} onClick={onCancelar}>
						{textoBotaoCancelar}
					</button>
					<button
						style={variante === 'perigo' ? s.btnPerigo : s.btnPrimario}
						onClick={onConfirmar}
						disabled={desabilitado}
					>
						{textoBotaoConfirmar}
					</button>
				</div>
			</div>
		</div>
	);
}

export default ModalConfirm;
