import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const LoadingContext = createContext(null);

// Singleton para o api.js chamar sem acesso ao contexto React
export const loadingBus = {
	iniciar: () => {},
	finalizar: () => {}
};

export function LoadingProvider({ children }) {
	const [contagem, setContagem] = useState(0);
	const [carregando, setCarregando] = useState(false);
	const timerRef = useRef(null);

	const iniciar = useCallback(() => setContagem((n) => n + 1), []);
	const finalizar = useCallback(() => setContagem((n) => Math.max(0, n - 1)), []);

	// Só mostra o spinner se a requisição durar mais de 300 ms —
	// evita piscar o overlay escuro em navegações rápidas entre rotas.
	useEffect(() => {
		if (contagem > 0) {
			timerRef.current = setTimeout(() => setCarregando(true), 300);
		} else {
			clearTimeout(timerRef.current);
			setCarregando(false);
		}
		return () => clearTimeout(timerRef.current);
	}, [contagem]);

	useEffect(() => {
		loadingBus.iniciar = iniciar;
		loadingBus.finalizar = finalizar;
	}, [iniciar, finalizar]);

	return (
		<LoadingContext.Provider value={{ carregando }}>
			{children}
		</LoadingContext.Provider>
	);
}

export function useLoading() {
	return useContext(LoadingContext);
}
