/**
 * dashboard.spec.js — Dashboard financeiro
 *
 * Verifica que o dashboard carrega para os 3 perfis e exibe os
 * elementos reais do componente (seletor de períodos, link para clifor).
 */

import { test, expect } from './fixtures.js';

test.describe('Dashboard', () => {
	test('admin vê o dashboard com seletor de período', async ({ pageAdmin }) => {
		await pageAdmin.goto('/dashboard');
		await expect(pageAdmin.getByText('Último mês').first()).toBeVisible({ timeout: 10000 });
	});

	test('consulta vê o dashboard', async ({ pageConsulta }) => {
		await pageConsulta.goto('/dashboard');
		await expect(pageConsulta.getByText('Último mês').first()).toBeVisible({ timeout: 10000 });
	});

	test('operador vê o dashboard', async ({ pageOperador }) => {
		await pageOperador.goto('/dashboard');
		await expect(pageOperador.getByText('Último mês').first()).toBeVisible({ timeout: 10000 });
	});

	test('seletor oferece os períodos esperados', async ({ pageConsulta }) => {
		await pageConsulta.goto('/dashboard');
		await expect(pageConsulta.getByText('Último mês').first()).toBeVisible({ timeout: 10000 });
		await expect(pageConsulta.getByText('Últimos 6 meses').first()).toBeVisible();
		await expect(pageConsulta.getByText('Ano atual').first()).toBeVisible();
	});

	test('dashboard tem link para clientes/fornecedores', async ({ pageConsulta }) => {
		await pageConsulta.goto('/dashboard');
		await expect(pageConsulta.getByText('Último mês').first()).toBeVisible({ timeout: 10000 });
		// O componente usa <Link to="/cliente_fornecedor">. O href aparece em vários
		// lugares (menu desktop + menu mobile, este oculto no desktop), então exigimos
		// a primeira ocorrência VISÍVEL — senão o .first() casa o item mobile escondido.
		await expect(pageConsulta.locator('a[href="/cliente_fornecedor"]:visible').first()).toBeVisible();
	});
});
