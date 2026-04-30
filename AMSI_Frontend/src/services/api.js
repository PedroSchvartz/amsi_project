import { getToken } from "./auth";

// ======================
// 🔐 LOGIN
// ======================
const BASE_URL = "https://amsi-project-chzs.vercel.app";

export const loginUser = async (email, senha) => {
  const response = await fetch(`${BASE_URL}/auth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
      senha: senha,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = 
      data?.detail?.[0]?.msg || 
      "Usuário ou Senha inválidos";
    throw new Error(message);
  }

  return data
};

// ======================
// 👤 CRIAR USUÁRIO
// ======================

export const createUser = async (data) => {
  const response = await fetch(`${BASE_URL}/usuarios/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      login: data.login,
      senha: data.senha,
      nome: data.nome,
      email: data.email,
      cargo: data.cargo,
      perfil_de_acesso: data.perfil,
      notificacao: false,
    }),
  });

  // 🚨 TOKEN EXPIRADO
  if (response.status === 401) {
    logout();
    window.location.href = "/";
    return;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Erro ao criar usuário");
  }

  return await response.json();
};

// ======================
// 📋 LISTAR USUÁRIOS
// ======================

export const getUsers = async () => {
  const response = await fetch(`${BASE_URL}/usuarios/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  });

  // Tratamento do token
   if (response.status === 401) {
    logout();
    window.location.href = "/";
    return;
  }

  if (!response.ok) {
    throw new Error("Erro ao buscar usuários");
  }

  return await response.json();
};

export const getNews = async () => {
  const response = await fetch("https://prefeitura.sp.gov.br/web/sao_miguel_paulista");
  return await response.json();
};