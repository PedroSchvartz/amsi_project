// Cache de sessão em memória (NÃO usa localStorage/sessionStorage): guarda o resultado
// da última pesquisa de cada tela para que sair e voltar não perca os dados — o estado
// vive fora do componente, então sobrevive ao desmontar/remontar na navegação.
// É zerado no logout (auth.logout) e, naturalmente, num reload da aba.
// Ver docs/planos/dividas-tecnicas.md item 3.13.
const store = new Map();

export function getCache(chave) {
	return store.get(chave);
}

export function setCache(chave, valor) {
	store.set(chave, valor);
}

export function limparCache() {
	store.clear();
}
