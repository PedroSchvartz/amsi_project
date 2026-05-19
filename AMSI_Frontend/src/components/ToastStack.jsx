import { useState, useRef, createContext, useContext } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
	const [toasts, setToasts] = useState([]);
	const counter = useRef(0);

	const mostrarToast = (mensagem, tipo = 'sucesso', duracao = 5000) => {
		if (!mensagem) return;
		const id = ++counter.current;
		setToasts((prev) => {
			if (prev.some((t) => t.mensagem === mensagem && t.tipo === tipo)) return prev;
			setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), duracao);
			return [...prev, { id, mensagem, tipo }];
		});
	};

	const mostrarToasts = (mensagens, tipo = 'erro') => {
		setToasts([]);
		const lista = Array.isArray(mensagens) ? mensagens : [mensagens];
		const novos = lista.map((mensagem, i) => ({
			id: ++counter.current,
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

	return (
		<ToastContext.Provider value={{ toasts, mostrarToast, mostrarToasts, removerToast }}>
			{children}
			<ToastStackInternal toasts={toasts} onRemover={removerToast} />
		</ToastContext.Provider>
	);
}

export function useToast() {
	return useContext(ToastContext);
}

function ToastStackInternal({ toasts, onRemover }) {
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
						background:
							t.tipo === 'erro' ? '#dc2626' : t.tipo === 'aviso' ? '#d97706' : '#16a34a',
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
