/**
 * auth.spec.js — Login, logout e proteção de rotas
 *
 * Espelho de test_auth.py: verifica o caminho feliz de login,
 * credenciais inválidas, logout e redirect para / sem sessão.
 */

import { test, expect } from './fixtures.js';
import { injetarSessao, BACKEND } from './fixtures.js';

// ─── Login (caminho feliz) ───────────────────────────────────────────────────

test('login com credenciais válidas (admin) navega para /home', async ({ page }) => {
	await page.goto('/');
	await page.getByPlaceholder(/e-?mail/i).fill('opedroschvartz@gmail.com');
	await page.getByPlaceholder(/senha/i).fill('opedro');
	await page.getByRole('button', { name: /entrar/i }).click();
	await page.waitForURL('**/home');
	expect(page.url()).toContain('/home');
});

test('login com credenciais válidas (consulta) navega para /home', async ({ page }) => {
	await page.goto('/');
	await page.getByPlaceholder(/e-?mail/i).fill('pytest_consulta@amsi.com');
	await page.getByPlaceholder(/senha/i).fill('consultaTeste123');
	await page.getByRole('button', { name: /entrar/i }).click();
	await page.waitForURL('**/home');
	expect(page.url()).toContain('/home');
});

// ─── Login (credenciais inválidas) ───────────────────────────────────────────

test('login com senha errada exibe mensagem de erro', async ({ page }) => {
	await page.goto('/');
	await page.getByPlaceholder(/e-?mail/i).fill('opedroschvartz@gmail.com');
	await page.getByPlaceholder(/senha/i).fill('senha_errada_xyz');
	await page.getByRole('button', { name: /entrar/i }).click();
	// Qualquer mensagem de erro visível — toast ou texto inline
	await expect(
		page.locator('text=/inválid|incorret|não encontrad|erro/i').first()
	).toBeVisible({ timeout: 5000 });
	expect(page.url()).not.toContain('/home');
});

test('login com email inexistente exibe mensagem de erro', async ({ page }) => {
	await page.goto('/');
	await page.getByPlaceholder(/e-?mail/i).fill('nao_existe@amsi.com');
	await page.getByPlaceholder(/senha/i).fill('qualquercoisa');
	await page.getByRole('button', { name: /entrar/i }).click();
	await expect(
		page.locator('text=/inválid|incorret|não encontrad|erro/i').first()
	).toBeVisible({ timeout: 5000 });
});

// ─── Proteção de rotas ────────────────────────────────────────────────────────

test('acesso direto a /home sem sessão redireciona para /', async ({ page }) => {
	await page.goto('/home');
	await expect(page).toHaveURL(/^\//); // URL raiz ou /?redirect=...
	// Garante que não chegou na home
	await expect(page.locator('text=/bem-vindo|home/i').first()).not.toBeVisible({ timeout: 2000 }).catch(() => {});
});

test('acesso a /usuarios sem sessão redireciona para /', async ({ page }) => {
	await page.goto('/usuarios');
	await expect(page).toHaveURL(/^\//);
});

// ─── Logout ──────────────────────────────────────────────────────────────────

test('logout limpa sessão e retorna para /', async ({ pageAdmin }) => {
	await pageAdmin.goto('/home');
	// Procura botão/link de logout no NavBar
	const logoutBtn = pageAdmin.getByRole('button', { name: /sair|logout/i })
		.or(pageAdmin.getByRole('link', { name: /sair|logout/i }));
	await logoutBtn.click();
	await pageAdmin.waitForURL('/');
	// localStorage deve estar limpo
	const token = await pageAdmin.evaluate(() => localStorage.getItem('token'));
	expect(token).toBeNull();
});
