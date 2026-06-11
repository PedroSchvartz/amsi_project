/**
 * Fixtures compartilhadas para os testes E2E do AMSI Frontend.
 *
 * Espelho das fixtures session-scoped do conftest.py:
 *   - loginAdmin()  → equivale a headers_admin
 *   - loginConsulta() → equivale a headers_consulta
 *   - loginOperador() → equivale a headers_operador
 *
 * Em vez de injetar headers HTTP, injetamos token + expiresAt no localStorage
 * da página do Playwright — que é exatamente o que o frontend espera.
 *
 * PRÉ-REQUISITO: backend rodando em BACKEND_URL com usuários seed do bootstrap.
 */

import { test as base, expect } from '@playwright/test';

export const BACKEND = process.env.AMSI_BACKEND_URL || 'http://localhost:8000';

// Credenciais espelhando o conftest.py e o bootstrap.py
const USUARIOS = {
	admin:    { email: 'opedroschvartz@gmail.com', senha: 'opedro' },
	consulta: { email: 'pytest_consulta@amsi.com', senha: 'consultaTeste123' },
	operador: { email: 'pytest_operador@amsi.com', senha: 'operadorTeste123' },
};

/**
 * Faz login via API e injeta o token no localStorage da página.
 * @param {import('@playwright/test').Page} page
 * @param {'admin'|'consulta'|'operador'} perfil
 */
export async function injetarSessao(page, perfil) {
	const creds = USUARIOS[perfil];
	const res = await page.request.post(`${BACKEND}/auth/token`, {
		data: { email: creds.email, senha: creds.senha },
	});
	if (!res.ok()) {
		throw new Error(
			`Login falhou para '${perfil}' (${res.status()}): ${await res.text()}`
		);
	}
	const { access_token } = await res.json();

	// expiresAt = 55 min a partir de agora (margem segura para os testes)
	const expiresAt = String(Date.now() + 55 * 60 * 1000);

	await page.evaluate(
		({ token, expiresAt }) => {
			localStorage.setItem('token', token);
			localStorage.setItem('expiresAt', expiresAt);
		},
		{ token: access_token, expiresAt }
	);
}

/**
 * Faz uma requisição autenticada à API e retorna o JSON.
 * Usado para setup/teardown de dados de teste sem passar pela UI.
 */
export async function apiAutenticada(page, method, path, body = null) {
	const res = await page.request[method.toLowerCase()](`${BACKEND}${path}`, {
		...(body ? { data: body } : {}),
		headers: { Authorization: await getTokenHeader(page) },
	});
	return res;
}

async function getTokenHeader(page) {
	const token = await page.evaluate(() => localStorage.getItem('token'));
	return `Bearer ${token}`;
}

// Extensão base com helpers prontos para todos os spec
export const test = base.extend({
	// fixture: página pré-autenticada como admin
	pageAdmin: async ({ page }, use) => {
		await page.goto('/');
		await injetarSessao(page, 'admin');
		await use(page);
	},

	// fixture: página pré-autenticada como consulta
	pageConsulta: async ({ page }, use) => {
		await page.goto('/');
		await injetarSessao(page, 'consulta');
		await use(page);
	},

	// fixture: página pré-autenticada como operador
	pageOperador: async ({ page }, use) => {
		await page.goto('/');
		await injetarSessao(page, 'operador');
		await use(page);
	},
});

export { expect };
