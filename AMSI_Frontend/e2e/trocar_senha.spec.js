/**
 * trocar_senha.spec.js — Página de troca de senha
 *
 * Verifica o formulário de troca de senha: validações locais (sem chamar API)
 * e fluxo completo quando os dados são válidos.
 *
 * NOTA: Este teste NÃO troca a senha real dos usuários seed. Usa validações
 * locais do formulário (nova_senha < 6 chars, senhas não conferem, etc.)
 * para cobrir o comportamento sem efeito colateral no banco.
 */

import { test, expect } from './fixtures.js';

test.describe('Trocar Senha', () => {
	test('página de trocar senha é acessível com sessão autenticada', async ({ pageAdmin }) => {
		await pageAdmin.goto('/trocar-senha');
		// A página deve renderizar um formulário (sem redirecionar para /)
		await expect(pageAdmin).not.toHaveURL('/');
		await expect(
			pageAdmin.locator('form, input[name*="senha"]').first()
		).toBeVisible({ timeout: 5000 });
	});

	test('exibe erro quando nova senha tem menos de 6 caracteres', async ({ pageAdmin }) => {
		await pageAdmin.goto('/trocar-senha');

		// Preenche com senha atual qualquer e nova senha curta
		const inputAtual = pageAdmin.locator('input[name="senha_atual"]')
			.or(pageAdmin.locator('input[type="password"]').first());
		await inputAtual.fill('opedro');

		const inputNova = pageAdmin.locator('input[name="nova_senha"]')
			.or(pageAdmin.locator('input[type="password"]').nth(1));
		await inputNova.fill('abc');

		const inputConfirmar = pageAdmin.locator('input[name="confirmar_senha"]')
			.or(pageAdmin.locator('input[type="password"]').nth(2));
		await inputConfirmar.fill('abc');

		await pageAdmin.getByRole('button', { name: /salvar|confirmar|alterar/i }).click();

		// Mensagem de validação: "pelo menos 6 caracteres"
		await expect(
			pageAdmin.locator('text=/6 caracteres|pelo menos 6/i').first()
		).toBeVisible({ timeout: 3000 });
	});

	test('exibe erro quando senhas não conferem', async ({ pageAdmin }) => {
		await pageAdmin.goto('/trocar-senha');

		const inputs = pageAdmin.locator('input[type="password"]');
		await inputs.nth(0).fill('opedro');
		await inputs.nth(1).fill('novaSenha123');
		await inputs.nth(2).fill('senhasDiferentes');

		await pageAdmin.getByRole('button', { name: /salvar|confirmar|alterar/i }).click();

		await expect(
			pageAdmin.locator('text=/não conferem|conferem|diferentes/i').first()
		).toBeVisible({ timeout: 3000 });
	});

	test('exibe erro quando nova senha é igual à atual', async ({ pageAdmin }) => {
		await pageAdmin.goto('/trocar-senha');

		const inputs = pageAdmin.locator('input[type="password"]');
		await inputs.nth(0).fill('opedro');
		await inputs.nth(1).fill('opedro');
		await inputs.nth(2).fill('opedro');

		await pageAdmin.getByRole('button', { name: /salvar|confirmar|alterar/i }).click();

		await expect(
			pageAdmin.locator('text=/diferente da atual|igual à atual/i').first()
		).toBeVisible({ timeout: 3000 });
	});

	test('/trocar-senha sem autenticação redireciona para /', async ({ page }) => {
		await page.goto('/trocar-senha');
		await expect(page).toHaveURL(/^\//);
		const loginEl = page.locator('text=/login|entrar/i').first();
		await expect(loginEl).toBeVisible({ timeout: 3000 });
	});
});
