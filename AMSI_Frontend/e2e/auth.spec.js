/**
 * auth.spec.js — Login, logout e proteção de rotas
 *
 * Espelho de test_auth.py: caminho feliz de login pela tela,
 * credenciais inválidas, redirect sem sessão e logout.
 *
 * Seletores reais do Login.jsx: labels "Email"/"Senha" (htmlFor),
 * botão "Entrar", erro renderizado em <p class="login-erro">.
 */

import { test, expect, USUARIOS } from './fixtures.js';

// ─── Login (caminho feliz) ───────────────────────────────────────────────────

test('login com credenciais válidas (admin) navega para /home', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Email').fill(USUARIOS.admin.email);
	await page.getByLabel('Senha').fill(USUARIOS.admin.senha);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForURL('**/home');
	expect(page.url()).toContain('/home');
});

test('login com credenciais válidas (consulta) navega para /home', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Email').fill(USUARIOS.consulta.email);
	await page.getByLabel('Senha').fill(USUARIOS.consulta.senha);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForURL('**/home');
	expect(page.url()).toContain('/home');
});

// ─── Login (credenciais inválidas) ───────────────────────────────────────────

test('login com senha errada exibe mensagem de erro e não navega', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Email').fill(USUARIOS.admin.email);
	await page.getByLabel('Senha').fill('senha_errada_xyz');
	await page.getByRole('button', { name: 'Entrar' }).click();
	await expect(page.locator('.login-erro')).toBeVisible({ timeout: 5000 });
	expect(page.url()).not.toContain('/home');
});

test('login com email inexistente exibe mensagem de erro', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Email').fill('nao_existe@amsi.com');
	await page.getByLabel('Senha').fill('qualquercoisa');
	await page.getByRole('button', { name: 'Entrar' }).click();
	await expect(page.locator('.login-erro')).toBeVisible({ timeout: 5000 });
});

// ─── Proteção de rotas ────────────────────────────────────────────────────────

test('acesso direto a /home sem sessão volta para a tela de login', async ({ page }) => {
	await page.goto('/home');
	// PrivateRoute redireciona para /?redirect=/home — o form de login aparece
	await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 5000 });
	expect(new URL(page.url()).pathname).toBe('/');
});

test('acesso direto a /usuarios sem sessão volta para a tela de login', async ({ page }) => {
	await page.goto('/usuarios');
	await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 5000 });
	expect(new URL(page.url()).pathname).toBe('/');
});

// ─── Logout ──────────────────────────────────────────────────────────────────

test('logout pelo menu limpa a sessão e retorna para /', async ({ pageAdmin }) => {
	await pageAdmin.goto('/home');
	// Botão "Sair" do menu desktop (o mobile fica oculto no viewport padrão)
	await pageAdmin.locator('.layout-menu-desktop__sair').click();
	await pageAdmin.waitForURL('/');
	const token = await pageAdmin.evaluate(() => localStorage.getItem('token'));
	expect(token).toBeNull();
});
