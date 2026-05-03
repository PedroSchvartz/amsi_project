const BASE_URL = 'https://amsi-project-chzs.vercel.app';

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
	const user = getUserFromToken();
	if (!token || !user) return false;
	if (Date.now() > user.exp * 1000) {
		logout();
		return false;
	}
	return true;
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
