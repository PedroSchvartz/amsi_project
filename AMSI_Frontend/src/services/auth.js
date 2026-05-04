const BASE_URL = import.meta.env.VITE_API_URL;

export const getToken = () => {
	return localStorage.getItem('token');
};

export const getUserFromToken = () => {
	const token = getToken();
	if (!token) return null;
	try {
		return JSON.parse(atob(token.split('.')[1]));
	} catch {
		return null;
	}
};

export const getPerfil = () => {
	const user = getUserFromToken();
	return user?.perfil ?? null;
};

export const isConsulta = () => {
	return getPerfil() === 'Consulta';
};

export const isAdmin = () => {
	const user = getUserFromToken();
	if (!user) return false;
	return user.perfil === 'Administrador';
};

export const isAuthenticated = () => {
	const token = getToken();
	const expiresAt = localStorage.getItem('expiresAt');
	if (!token) return false;
	// Usa expiresAt (sliding session) se disponível, senão fallback para JWT exp
	if (expiresAt) {
		return Date.now() <= parseInt(expiresAt);
	}
	const user = getUserFromToken();
	if (!user) return false;
	return Date.now() <= user.exp * 1000;
};

export const logout = () => {
	const token = getToken();
	if (token) {
		fetch(`${BASE_URL}/auth/logout`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			}
		}).catch(() => {});
	}
	localStorage.clear();
};
