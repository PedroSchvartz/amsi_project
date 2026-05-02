import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const LoadingContext = createContext(null);

// Singleton para o api.js chamar sem acesso ao contexto React
export const loadingBus = {
	iniciar: () => {},
	finalizar: () => {}
};

export function LoadingProvider({ children }) {
	const [contagem, setContagem] = useState(0);

	const iniciar = useCallback(() => setContagem((n) => n + 1), []);
	const finalizar = useCallback(() => setContagem((n) => Math.max(0, n - 1)), []);

	useEffect(() => {
		loadingBus.iniciar = iniciar;
		loadingBus.finalizar = finalizar;
	}, [iniciar, finalizar]);

	return (
		<LoadingContext.Provider value={{ carregando: contagem > 0 }}>
			{children}
		</LoadingContext.Provider>
	);
}

export function useLoading() {
	return useContext(LoadingContext);
}
