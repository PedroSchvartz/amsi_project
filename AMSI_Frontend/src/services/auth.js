export const getToken = () => {
  return localStorage.getItem("token");
};

// 🔥 decodifica o JWT
export const getUserFromToken = () => {
  const token = getToken();

  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload;
  } catch {
    return null;
  }
};

// 🔐 verifica se é admin
export const isAdmin = () => {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user) return false;

  return user.perfil_de_acesso === "ADMIN";
};

// 🔐 verifica se está logado
export const isAuthenticated = () => {
  const token = getToken();
  const user = getUserFromToken();

  if (!token || !user) return false;

  // ⏱️ valida expiração
  if (Date.now() > user.exp * 1000) {
    logout();
    return false;
  }

  return true;
};

export const logout = () => {
  localStorage.clear();
};