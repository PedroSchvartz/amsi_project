import { useState, useRef } from 'react';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast() {
	const [toasts, setToasts] = useState([]);
	const counterRef = useRef(0);

	const mostrarToast = (mensagem, tipo = 'sucesso', duracao = 5000) => {
		const id = ++counterRef.current;
		setToasts((prev) => [...prev, { id, mensagem, tipo }]);
		setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duracao);
	};

	const mostrarToasts = (mensagens, tipo = 'erro') => {
		setToasts([]);
		const lista = Array.isArray(mensagens) ? mensagens : [mensagens];
		const novos = lista.map((mensagem, i) => ({
			id: ++counterRef.current,
			mensagem,
			tipo,
			duracao: (5 + i) * 1000
		}));
		setToasts(novos);
		novos.forEach((t) => {
			setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), t.duracao);
		});
	};

	const removerToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

	return { toasts, mostrarToast, mostrarToasts, removerToast };
}

// ── Componente ────────────────────────────────────────────────────────────────

function ToastStack({ toasts, onRemover }) {
	if (!toasts.length) return null;

	return (
		<div
			style={{
				position: 'fixed',
				top: 20,
				right: 20,
				display: 'flex',
				flexDirection: 'column',
				gap: 8,
				zIndex: 99999,
				maxWidth: 320,
				width: '90vw'
			}}
		>
			{toasts.map((t) => (
				<div
					key={t.id}
					style={{
						background: t.tipo === 'erro' ? '#dc2626' : t.tipo === 'aviso' ? '#d97706' : '#16a34a',
						color: '#fff',
						padding: '10px 16px',
						borderRadius: 8,
						boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
						fontSize: '0.85rem',
						fontWeight: 500,
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						gap: 12
					}}
				>
					<span>{t.mensagem}</span>
					<button
						onClick={() => onRemover(t.id)}
						style={{
							background: 'transparent',
							border: 'none',
							color: '#fff',
							cursor: 'pointer',
							fontSize: '1rem',
							lineHeight: 1,
							flexShrink: 0
						}}
					>
						×
					</button>
				</div>
			))}
		</div>
	);
}

export default ToastStack;
