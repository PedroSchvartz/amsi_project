/**
 * Fixtures compartilhadas para os testes E2E do AMSI Frontend.
 *
 * Espelho das fixtures session-scoped do conftest.py:
 *   - pageAdmin    → equivale a headers_admin
 *   - pageConsulta → equivale a headers_consulta
 *   - pageOperador → equivale a headers_operador
 *
 * Em vez de injetar headers HTTP, injetamos token + expiresAt no localStorage
 * da página do Playwright — que é exatamente o que o frontend espera.
 *
 * ── TRAVA DE SEGURANÇA ──────────────────────────────────────────────────────
 * Esta suíte cria usuários, faz HARD DELETE e altera dados reais. Por isso:
 *   1. O backend alvo SÓ pode ser localhost (verificado aqui, em module load).
 *   2. O APP_ENV do backend SÓ pode ser development ou demo (verificado no
 *      global-setup.js antes de qualquer teste). Produção → aborta tudo.
 * Não existe variável de escape: para rodar contra outro alvo é preciso
 * editar este arquivo conscientemente.
 */

import { test as base, expect } from '@playwright/test';

export const BACKEND = process.env.AMSI_BACKEND_URL || 'http://localhost:8000';

// Trava 1: recusa qualquer backend que não seja local.
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;
if (!LOCALHOST_RE.test(BACKEND)) {
	throw new Error(
		`[E2E bloqueado] AMSI_BACKEND_URL aponta para "${BACKEND}". ` +
		`Esta suíte cria e DELETA dados reais — só roda contra localhost. ` +
		`Suba o backend local (uvicorn main:app) e remova a variável.`
	);
}

// Credenciais espelhando conftest.py / bootstrap.py / config.py.
// Sobrescrevíveis por env (ex.: arquivo .env.test gitignored) para não
// depender de senha hardcoded no repositório.
export const USUARIOS = {
	admin: {
		email: process.env.AMSI_ADMIN_EMAIL || 'opedroschvartz@gmail.com',
		senha: process.env.AMSI_ADMIN_SENHA || 'opedro',
	},
	consulta: {
		email: process.env.CONSULTA_TESTE_EMAIL || 'pytest_consulta@amsi.com',
		senha: process.env.CONSULTA_TESTE_SENHA || 'consultaTeste123',
	},
	operador: {
		email: process.env.OPERADOR_TESTE_EMAIL || 'pytest_operador@amsi.com',
		senha: process.env.OPERADOR_TESTE_SENHA || 'operadorTeste123',
	},
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
			`Login falhou para '${perfil}' (${res.status()}): ${await res.text()}\n` +
			`Verifique se o bootstrap foi executado: python -X utf8 utils/bootstrap.py`
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

/** Token atual do localStorage da página. */
export async function getToken(page) {
	return page.evaluate(() => localStorage.getItem('token'));
}

/** Headers de autorização a partir do token da página. */
export async function authHeaders(page) {
	return { Authorization: `Bearer ${await getToken(page)}` };
}

/**
 * Asserção de "acesso negado por perfil": o PrivateRoute renderiza a
 * NotFoundPage no lugar do conteúdo (não redireciona).
 */
export async function esperaPaginaNaoEncontrada(page) {
	await expect(page.getByText('Página não encontrada')).toBeVisible({ timeout: 8000 });
}

// Extensão base com páginas pré-autenticadas por perfil
export const test = base.extend({
	pageAdmin: async ({ page }, use) => {
		await page.goto('/');
		await injetarSessao(page, 'admin');
		await use(page);
	},

	pageConsulta: async ({ page }, use) => {
		await page.goto('/');
		await injetarSessao(page, 'consulta');
		await use(page);
	},

	pageOperador: async ({ page }, use) => {
		await page.goto('/');
		await injetarSessao(page, 'operador');
		await use(page);
	},
});

export { expect };
