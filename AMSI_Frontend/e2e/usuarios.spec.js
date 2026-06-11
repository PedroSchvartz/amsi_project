/**
 * usuarios.spec.js — CRUD de usuários (rota adminOnly)
 *
 * Espelho de test_usuarios.py: cria pela UI, lista, exclui pela UI.
 * Inclui o teste da regra de segurança "apenas Desenvolvedor cadastra
 * Desenvolvedor" — exercitada com um admin comum criado via /demo/registro
 * quando o backend está em modo demo.
 *
 * Limpeza: hard delete (cascade) via API — espelho do _limpar_usuario_demo.
 */

import { test, expect, BACKEND, authHeaders, injetarSessao } from './fixtures.js';

const EMAIL_TESTE = `pw_e2e_${Date.now()}@playwright.amsi.com`;
const NOME_TESTE  = 'Usuário Playwright E2E';

async function hardDeletePorEmail(page, email) {
	const auth = await authHeaders(page);
	const res = await page.request.get(`${BACKEND}/usuarios/?incluir_excluidos=True`, { headers: auth });
	if (!res.ok()) return;
	for (const u of await res.json()) {
		if (u.email === email) {
			await page.request.delete(`${BACKEND}/usuarios/${u.id_usuario}/hard`, { headers: auth });
		}
	}
}

test.describe('Usuários — CRUD (admin)', () => {
	test.afterEach(async ({ pageAdmin }) => {
		await hardDeletePorEmail(pageAdmin, EMAIL_TESTE);
	});

	test('página de usuários lista o admin', async ({ pageAdmin }) => {
		await pageAdmin.goto('/usuarios');
		await expect(pageAdmin.getByText('opedroschvartz@gmail.com').first()).toBeVisible({ timeout: 8000 });
	});

	test('cadastrar novo usuário pela UI', async ({ pageAdmin }) => {
		await pageAdmin.goto('/usuarios');
		await pageAdmin.getByRole('button', { name: 'Novo Usuário' }).click();

		// Formulário do UserRegisterModal (inputs com atributo name)
		await pageAdmin.locator('input[name="nome"]').fill(NOME_TESTE);
		await pageAdmin.locator('input[name="email"]').fill(EMAIL_TESTE);
		await pageAdmin.locator('select[name="cargo"]').selectOption('Associado');
		await pageAdmin.locator('select[name="perfil_de_acesso"]').selectOption('Consulta');
		await pageAdmin.getByRole('button', { name: 'Salvar' }).click();

		await expect(
			pageAdmin.getByText('Usuário cadastrado com sucesso!')
		).toBeVisible({ timeout: 8000 });
	});

	test('usuário criado aparece na lista', async ({ pageAdmin }) => {
		// Cria via API (a UI de criação já foi exercitada no teste anterior)
		const auth = await authHeaders(pageAdmin);
		const res = await pageAdmin.request.post(`${BACKEND}/usuarios/`, {
			data: {
				nome: NOME_TESTE,
				email: EMAIL_TESTE,
				cargo: 'Associado',
				perfil_de_acesso: 'Consulta',
				notificacao: false,
			},
			headers: auth,
		});
		expect(res.ok()).toBeTruthy();

		await pageAdmin.goto('/usuarios');
		await expect(pageAdmin.getByText(EMAIL_TESTE)).toBeVisible({ timeout: 8000 });
	});

	test('excluir (soft delete) usuário pela UI', async ({ pageAdmin }) => {
		const auth = await authHeaders(pageAdmin);
		await pageAdmin.request.post(`${BACKEND}/usuarios/`, {
			data: { nome: NOME_TESTE, email: EMAIL_TESTE, cargo: 'Associado', perfil_de_acesso: 'Consulta', notificacao: false },
			headers: auth,
		});

		await pageAdmin.goto('/usuarios');
		const linha = pageAdmin.locator('tr').filter({ hasText: EMAIL_TESTE });
		await linha.locator('button[title="Remover usuário"]').click();

		// ModalConfirm: botão "Remover"
		await pageAdmin.getByRole('button', { name: 'Remover' }).click();

		await expect(
			pageAdmin.getByText('Usuário removido com sucesso.')
		).toBeVisible({ timeout: 8000 });
		await expect(pageAdmin.locator('tr').filter({ hasText: EMAIL_TESTE })).toHaveCount(0);
	});
});

test.describe('Usuários — regra Desenvolvedor', () => {
	const EMAIL_ADMIN_COMUM = `pw_admin_comum_${Date.now()}@playwright.amsi.com`;
	const SENHA_ADMIN_COMUM = 'senhaPwTeste123';

	test.afterEach(async ({ pageAdmin }) => {
		await hardDeletePorEmail(pageAdmin, EMAIL_ADMIN_COMUM);
		await hardDeletePorEmail(pageAdmin, EMAIL_TESTE);
	});

	test('admin sem cargo Desenvolvedor recebe 403 ao cadastrar Desenvolvedor', async ({ pageAdmin, page }) => {
		// Só executável em modo demo: precisamos criar um admin "comum"
		// (cargo Associado) com senha conhecida, e /demo/registro permite isso.
		const status = await (await page.request.get(`${BACKEND}/demo/status`)).json();
		test.skip(!status.demo_ativo, 'Requer APP_ENV=demo para criar admin comum com senha conhecida');

		const reg = await page.request.post(`${BACKEND}/demo/registro`, {
			data: {
				nome: 'Admin Comum PW',
				email: EMAIL_ADMIN_COMUM,
				senha: SENHA_ADMIN_COMUM,
				cargo: 'Associado',
				perfil_de_acesso: 'Administrador',
			},
		});
		expect(reg.ok()).toBeTruthy();

		// Autentica como o admin comum
		const loginRes = await page.request.post(`${BACKEND}/auth/token`, {
			data: { email: EMAIL_ADMIN_COMUM, senha: SENHA_ADMIN_COMUM },
		});
		expect(loginRes.ok()).toBeTruthy();
		const { access_token } = await loginRes.json();

		// Admin comum tenta cadastrar um Desenvolvedor → 403
		const tentativa = await page.request.post(`${BACKEND}/usuarios/`, {
			data: { nome: 'Dev PW', email: EMAIL_TESTE, cargo: 'Desenvolvedor', perfil_de_acesso: 'Administrador', notificacao: false },
			headers: { Authorization: `Bearer ${access_token}` },
		});
		expect(tentativa.status()).toBe(403);

		// O admin seed (cargo Desenvolvedor) PODE cadastrar Desenvolvedor.
		// Re-login do seed: o login do admin comum não afeta a sessão dele,
		// mas a fixture pageAdmin pode ter sido revogada por logins paralelos —
		// renova por segurança.
		await injetarSessao(pageAdmin, 'admin');
		const authSeed = await authHeaders(pageAdmin);
		const permitida = await pageAdmin.request.post(`${BACKEND}/usuarios/`, {
			data: { nome: 'Dev PW', email: EMAIL_TESTE, cargo: 'Desenvolvedor', perfil_de_acesso: 'Administrador', notificacao: false },
			headers: authSeed,
		});
		expect(permitida.status()).toBe(200);
	});
});
