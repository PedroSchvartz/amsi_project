import { getToken, logout } from './auth';
import { loadingBus } from './LoadingContext';

const BASE_URL = 'https://amsi-project-chzs.vercel.app';

async function fetchComLoading(url, options) {
	loadingBus.iniciar();
	try {
		return await fetch(url, options);
	} finally {
		loadingBus.finalizar();
	}
}

// ─── Utilitário interno ────────────────────────────────────────────────────

function authHeaders() {
	return {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${getToken()}`
	};
}

async function handleResponse(response, { noLogout = false } = {}) {
	if (response.status === 401) {
		if (!noLogout) {
			logout();
			window.location.href = '/';
			return;
		}
	}
	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		const detail = error.detail;
		const message = Array.isArray(detail)
			? detail.map((e) => e.msg).join(', ')
			: detail || `Erro ${response.status}`;
		throw new Error(message);
	}
	return response.json();
}

// ======================
// 🔐 AUTH
// response POST /auth/token: { access_token, token_type, primeiro_acesso }
// ======================

export const loginUser = async (email, senha) => {
	const response = await fetchComLoading(`${BASE_URL}/auth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, senha })
	});
	const data = await response.json();
	if (!response.ok) {
		const message = data?.detail?.[0]?.msg || 'Usuário ou Senha inválidos';
		throw new Error(message);
	}
	return data;
};

export const logoutUser = async () => {
	const response = await fetchComLoading(`${BASE_URL}/auth/logout`, {
		method: 'POST',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// body: { senha_atual, senha_nova }
export const trocarSenha = async ({ senha_atual, nova_senha }) => {
	const response = await fetchComLoading(`${BASE_URL}/auth/trocar-senha`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({ senha_atual, senha_nova: nova_senha })
	});
	return handleResponse(response, { noLogout: true });
};

// ======================
// 👤 USUÁRIOS
// ======================

export const getUsers = async () => {
	const response = await fetchComLoading(`${BASE_URL}/usuarios/`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const getUser = async (id_usuario) => {
	const response = await fetchComLoading(`${BASE_URL}/usuarios/${id_usuario}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// body: { nome, email, cargo, perfil_de_acesso, notificacao? }
export const createUser = async (data) => {
	const response = await fetchComLoading(`${BASE_URL}/usuarios/`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({
			nome: data.nome,
			email: data.email,
			cargo: data.cargo,
			perfil_de_acesso: data.perfil_de_acesso,
			notificacao: data.notificacao ?? false
		})
	});
	return handleResponse(response);
};

export const updateUser = async (id_usuario, data) => {
	const response = await fetchComLoading(`${BASE_URL}/usuarios/${id_usuario}`, {
		method: 'PUT',
		headers: authHeaders(),
		body: JSON.stringify(data)
	});
	return handleResponse(response);
};

export const deleteUser = async (id_usuario) => {
	const response = await fetchComLoading(`${BASE_URL}/usuarios/${id_usuario}`, {
		method: 'DELETE',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const resetarSenhaUsuario = async (id_usuario) => {
	const response = await fetchComLoading(`${BASE_URL}/usuarios/${id_usuario}/resetar-senha`, {
		method: 'POST',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// ======================
// 🏢 CLIENTE / FORNECEDOR
// ======================

export const getClifors = async (filtros = {}) => {
	const params = new URLSearchParams();
	if (filtros.nome) params.append('nome', filtros.nome);
	if (filtros.tipo_clifor) params.append('tipo_clifor', filtros.tipo_clifor);
	if (filtros.ativo != null) params.append('ativo', filtros.ativo);
	if (filtros.inadimplente != null) params.append('inadimplente', filtros.inadimplente);
	if (filtros.apenas_pendentes != null) params.append('apenas_pendentes', filtros.apenas_pendentes);
	if (filtros.pessoafisica_juridica != null)
		params.append('pessoafisica_juridica', filtros.pessoafisica_juridica);
	const query = params.toString() ? `?${params.toString()}` : '';
	const response = await fetchComLoading(`${BASE_URL}/cliente_fornecedor/${query}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const getClifor = async (id_clifor) => {
	const response = await fetchComLoading(`${BASE_URL}/cliente_fornecedor/${id_clifor}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const getCliforResumo = async (id_clifor) => {
	const response = await fetchComLoading(`${BASE_URL}/cliente_fornecedor/${id_clifor}/resumo`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// body: { pessoafisica_juridica, cpf_cnpj, rg_inscricaoestadual, nome, datanascimento,
//         tipo_clifor ("C"|"F"|"A"), ativo?, inadimplente?, id_usuario_fk? }
export const createClifor = async (data) => {
	const response = await fetchComLoading(`${BASE_URL}/cliente_fornecedor/`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(data)
	});
	return handleResponse(response);
};

export const updateClifor = async (id_clifor, data) => {
	const response = await fetchComLoading(`${BASE_URL}/cliente_fornecedor/${id_clifor}`, {
		method: 'PUT',
		headers: authHeaders(),
		body: JSON.stringify(data)
	});
	return handleResponse(response);
};

export const deleteClifor = async (id_clifor) => {
	const response = await fetchComLoading(`${BASE_URL}/cliente_fornecedor/${id_clifor}`, {
		method: 'DELETE',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// ======================
// 📍 ENDEREÇO
// ======================

export const getEnderecos = async () => {
	const response = await fetchComLoading(`${BASE_URL}/endereco/`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const getEndereco = async (id_endereco) => {
	const response = await fetchComLoading(`${BASE_URL}/endereco/${id_endereco}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const getEnderecosPorClifor = async (id_clifor) => {
	const response = await fetchComLoading(`${BASE_URL}/endereco/por-clifor/${id_clifor}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// body: { id_clifor_fk, logradouro, numero, bairro, cidade, uf, cep,
//         enderecoprimario?, complemento? }
export const createEndereco = async (data) => {
	const response = await fetchComLoading(`${BASE_URL}/endereco/`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(data)
	});
	return handleResponse(response);
};

export const updateEndereco = async (id_endereco, data) => {
	const response = await fetchComLoading(`${BASE_URL}/endereco/${id_endereco}`, {
		method: 'PUT',
		headers: authHeaders(),
		body: JSON.stringify(data)
	});
	return handleResponse(response);
};

export const deleteEndereco = async (id_endereco) => {
	const response = await fetchComLoading(`${BASE_URL}/endereco/${id_endereco}`, {
		method: 'DELETE',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// ======================
// 📞 CONTATO
// ======================

export const getContatos = async () => {
	const response = await fetchComLoading(`${BASE_URL}/contato/`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const getContato = async (id_contato) => {
	const response = await fetchComLoading(`${BASE_URL}/contato/${id_contato}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const getContatosPorClifor = async (id_clifor) => {
	const response = await fetchComLoading(`${BASE_URL}/contato/por-clifor/${id_clifor}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// body: { id_clifor_fk, tipocontato, info_do_contato, contato_principal? }
export const createContato = async (data) => {
	const response = await fetchComLoading(`${BASE_URL}/contato/`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(data)
	});
	return handleResponse(response);
};

export const updateContato = async (id_contato, data) => {
	const response = await fetchComLoading(`${BASE_URL}/contato/${id_contato}`, {
		method: 'PUT',
		headers: authHeaders(),
		body: JSON.stringify(data)
	});
	return handleResponse(response);
};

export const deleteContato = async (id_contato) => {
	const response = await fetchComLoading(`${BASE_URL}/contato/${id_contato}`, {
		method: 'DELETE',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// ======================
// 💰 LANÇAMENTO
// ======================

// Filtros disponíveis (todos opcionais):
//   id_clifor, id_tipo_conta — number
//   natureza — "Debito" | "Credito"
//   apenas_abertos, apenas_vencidos, estorno — boolean
//   data_vencimento_de, data_vencimento_ate,
//   data_lancamento_de, data_lancamento_ate — string ISO (YYYY-MM-DD)
//   valor_minimo, valor_maximo — number

export const getLancamentos = async (filtros = {}) => {
	const params = new URLSearchParams();
	if (filtros.id_clifor != null) params.append('id_clifor', filtros.id_clifor);
	if (filtros.id_tipo_conta != null) params.append('id_tipo_conta', filtros.id_tipo_conta);
	if (filtros.natureza) params.append('natureza', filtros.natureza);
	if (filtros.apenas_abertos != null) params.append('apenas_abertos', filtros.apenas_abertos);
	if (filtros.apenas_vencidos != null) params.append('apenas_vencidos', filtros.apenas_vencidos);
	if (filtros.data_vencimento_de) params.append('data_vencimento_de', filtros.data_vencimento_de);
	if (filtros.data_vencimento_ate)
		params.append('data_vencimento_ate', filtros.data_vencimento_ate);
	if (filtros.data_lancamento_de) params.append('data_lancamento_de', filtros.data_lancamento_de);
	if (filtros.data_lancamento_ate)
		params.append('data_lancamento_ate', filtros.data_lancamento_ate);
	if (filtros.estorno != null) params.append('estorno', filtros.estorno);
	if (filtros.valor_minimo != null) params.append('valor_minimo', filtros.valor_minimo);
	if (filtros.valor_maximo != null) params.append('valor_maximo', filtros.valor_maximo);
	const query = params.toString() ? `?${params.toString()}` : '';
	const response = await fetchComLoading(`${BASE_URL}/lancamento/${query}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// response: { total_a_receber, total_a_pagar, saldo_liquido,
//             total_vencido_a_receber, total_vencido_a_pagar,
//             quantidade_abertos, quantidade_vencidos }
export const getLancamentosResumo = async (filtros = {}) => {
	const params = new URLSearchParams();
	if (filtros.id_clifor != null) params.append('id_clifor', filtros.id_clifor);
	if (filtros.id_tipo_conta != null) params.append('id_tipo_conta', filtros.id_tipo_conta);
	if (filtros.natureza) params.append('natureza', filtros.natureza);
	if (filtros.apenas_abertos != null) params.append('apenas_abertos', filtros.apenas_abertos);
	if (filtros.data_vencimento_de) params.append('data_vencimento_de', filtros.data_vencimento_de);
	if (filtros.data_vencimento_ate)
		params.append('data_vencimento_ate', filtros.data_vencimento_ate);
	if (filtros.data_lancamento_de) params.append('data_lancamento_de', filtros.data_lancamento_de);
	if (filtros.data_lancamento_ate)
		params.append('data_lancamento_ate', filtros.data_lancamento_ate);
	if (filtros.estorno != null) params.append('estorno', filtros.estorno);
	if (filtros.valor_minimo != null) params.append('valor_minimo', filtros.valor_minimo);
	if (filtros.valor_maximo != null) params.append('valor_maximo', filtros.valor_maximo);
	const query = params.toString() ? `?${params.toString()}` : '';
	const response = await fetchComLoading(`${BASE_URL}/lancamento/resumo${query}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const getLancamento = async (id_lancamento) => {
	const response = await fetchComLoading(`${BASE_URL}/lancamento/${id_lancamento}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const getLancamentosPorClifor = async (id_clifor) => {
	const response = await fetchComLoading(`${BASE_URL}/lancamento/por-clifor/${id_clifor}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const getLancamentosPorUsuario = async (id_usuario) => {
	const response = await fetchComLoading(`${BASE_URL}/lancamento/por-usuario/${id_usuario}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// body: { id_usuario_fk_lancamento, id_clifor_relacionado_fk, id_tipo_conta_fk,
//         valor, data_vencimento, natureza_lancamento ("Debito"|"Credito"), observacao? }
export const createLancamento = async (data) => {
	const response = await fetchComLoading(`${BASE_URL}/lancamento/`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(data)
	});
	return handleResponse(response);
};

// body: { id_usuario_fk_fechamento?, data_pagamento?, valor_pago?,
//         multa?, juros?, observacao?, estorno? }
export const fecharLancamento = async (id_lancamento, data) => {
	const response = await fetchComLoading(`${BASE_URL}/lancamento/${id_lancamento}`, {
		method: 'PUT',
		headers: authHeaders(),
		body: JSON.stringify(data)
	});
	return handleResponse(response);
};

export const deleteLancamento = async (id_lancamento) => {
	const response = await fetchComLoading(`${BASE_URL}/lancamento/${id_lancamento}`, {
		method: 'DELETE',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// ======================
// 🏷️ TIPO DE CONTA
// ======================

export const getTiposConta = async () => {
	const response = await fetchComLoading(`${BASE_URL}/tipo_conta/`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const getTipoConta = async (id_tipo_conta) => {
	const response = await fetchComLoading(`${BASE_URL}/tipo_conta/${id_tipo_conta}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// body: { descricao_conta, natureza_conta ("Debito"|"Credito"), observacao? }
export const createTipoConta = async (data) => {
	const response = await fetchComLoading(`${BASE_URL}/tipo_conta/`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(data)
	});
	return handleResponse(response);
};

export const updateTipoConta = async (id_tipo_conta, data) => {
	const response = await fetchComLoading(`${BASE_URL}/tipo_conta/${id_tipo_conta}`, {
		method: 'PUT',
		headers: authHeaders(),
		body: JSON.stringify(data)
	});
	return handleResponse(response);
};

export const deleteTipoConta = async (id_tipo_conta) => {
	const response = await fetchComLoading(`${BASE_URL}/tipo_conta/${id_tipo_conta}`, {
		method: 'DELETE',
		headers: authHeaders()
	});
	return handleResponse(response);
};

// ======================
// 📋 LOGIN / SESSÕES
// ======================

export const getLogins = async () => {
	const response = await fetchComLoading(`${BASE_URL}/login/`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};

export const getLoginsPorUsuario = async (id_usuario) => {
	const response = await fetchComLoading(`${BASE_URL}/login/por-usuario/${id_usuario}`, {
		method: 'GET',
		headers: authHeaders()
	});
	return handleResponse(response);
};
