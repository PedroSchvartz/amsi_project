import { useState } from 'react';

/**
 * Modal de restauração de usuário SEM e-mail. Separa o fluxo de reativação do envio de
 * notificação (o backend reativa de qualquer jeito):
 *   - "Salvar": valida o e-mail digitado e chama onRestaurar(email) → backend cadastra o
 *     e-mail e notifica.
 *   - "Cadastrar depois": chama onRestaurar() sem e-mail → backend só reativa, sem notificar.
 *   - ✕ / clique no fundo: onFechar (cancela, nada acontece).
 */
function RestaurarUsuarioModal({ usuario, onRestaurar, onFechar }) {
	const [email, setEmail] = useState('');
	const emailValido = email.trim().length > 0;

	const salvar = () => {
		if (!emailValido) return;
		onRestaurar(email.trim());
	};

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				background: 'rgba(0,0,0,0.55)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 9980,
				padding: 20
			}}
			onClick={onFechar}
		>
			<div
				style={{
					background: 'var(--bg-card)',
					borderRadius: 14,
					width: '100%',
					maxWidth: 440,
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
						Restaurar usuário
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
						aria-label="Fechar"
					>
						✕
					</button>
				</div>

				<p style={{ color: 'var(--text)', textAlign: 'center', margin: '0 0 6px' }}>
					<strong>{usuario.nome}</strong> não tem e-mail para ser notificado.
				</p>
				<p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 20px', fontSize: '0.9rem' }}>
					Cadastrar um e-mail agora?
				</p>

				<input
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="e-mail para notificação"
					style={{
						width: '100%',
						padding: '10px 12px',
						borderRadius: 8,
						border: '1px solid var(--border)',
						background: 'var(--input-bg)',
						color: 'var(--text)',
						fontSize: '0.9rem',
						outline: 'none',
						textAlign: 'center'
					}}
				/>

				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						gap: 10,
						marginTop: 24
					}}
				>
					<button
						type="button"
						onClick={() => onRestaurar()}
						style={{
							padding: '8px 18px',
							borderRadius: 8,
							border: '1px solid var(--border)',
							background: 'transparent',
							color: 'var(--text)',
							fontWeight: 500,
							cursor: 'pointer'
						}}
					>
						Cadastrar depois
					</button>
					<button
						type="button"
						onClick={salvar}
						disabled={!emailValido}
						style={{
							padding: '8px 18px',
							borderRadius: 8,
							border: 'none',
							background: 'var(--primary)',
							color: '#fff',
							fontWeight: 600,
							cursor: emailValido ? 'pointer' : 'not-allowed',
							opacity: emailValido ? 1 : 0.6
						}}
					>
						Salvar
					</button>
				</div>
			</div>
		</div>
	);
}

export default RestaurarUsuarioModal;
