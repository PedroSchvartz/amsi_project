/**
 * trocar_senha.spec.js — Página de troca de senha
 *
 * Exercita as VALIDAÇÕES LOCAIS do formulário (mensagens exatas do
 * TrocarSenhaPage.jsx). Nenhum teste submete uma troca válida — a senha
 * real dos usuários seed nunca é alterada.
 *
 * Inputs reais: name="senha_atual" / "nova_senha" / "confirmar_senha".
 * Botão de submit: "Salvar senha".
 */

import { test, expect } from './fixtures.js';

test.describe('Trocar Senha', () => {
	test('página acessível com sessão autenticada', async ({ pageAdmin }) => {
		await pageAdmin.goto('/trocar-senha');
		await expect(pageAdmin.locator('input[name="senha_atual"]')).toBeVisible({ timeout: 8000 });
		await expect(pageAdmin.getByRole('button', { name: 'Salvar senha' })).toBeVisible();
	});

	test('erro: nova senha com menos de 6 caracteres', async ({ pageAdmin }) => {
		await pageAdmin.goto('/trocar-senha');
		await pageAdmin.locator('input[name="senha_atual"]').fill('qualquer-coisa');
		await pageAdmin.locator('input[name="nova_senha"]').fill('abc');
		await pageAdmin.locator('input[name="confirmar_senha"]').fill('abc');
		await pageAdmin.getByRole('button', { name: 'Salvar senha' }).click();

		await expect(
			pageAdmin.getByText('A nova senha deve ter pelo menos 6 caracteres.')
		).toBeVisible({ timeout: 5000 });
	});

	test('erro: senhas não conferem', async ({ pageAdmin }) => {
		await pageAdmin.goto('/trocar-senha');
		await pageAdmin.locator('input[name="senha_atual"]').fill('qualquer-coisa');
		await pageAdmin.locator('input[name="nova_senha"]').fill('novaSenha123');
		await pageAdmin.locator('input[name="confirmar_senha"]').fill('outraSenha456');
		await pageAdmin.getByRole('button', { name: 'Salvar senha' }).click();

		await expect(
			pageAdmin.getByText('As senhas não conferem.')
		).toBeVisible({ timeout: 5000 });
	});

	test('erro: nova senha igual à atual', async ({ pageAdmin }) => {
		await pageAdmin.goto('/trocar-senha');
		await pageAdmin.locator('input[name="senha_atual"]').fill('mesmaSenha123');
		await pageAdmin.locator('input[name="nova_senha"]').fill('mesmaSenha123');
		await pageAdmin.locator('input[name="confirmar_senha"]').fill('mesmaSenha123');
		await pageAdmin.getByRole('button', { name: 'Salvar senha' }).click();

		await expect(
			pageAdmin.getByText('A nova senha deve ser diferente da atual.')
		).toBeVisible({ timeout: 5000 });
	});

	test('sem autenticação redireciona para o login', async ({ page }) => {
		await page.goto('/trocar-senha');
		await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 5000 });
		expect(new URL(page.url()).pathname).toBe('/');
	});
});
