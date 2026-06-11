/**
 * dashboard.spec.js — Página de dashboard financeiro
 *
 * Verifica que o dashboard carrega para os perfis com acesso (Consulta+)
 * e exibe os elementos visuais esperados.
 */

import { test, expect } from './fixtures.js';

test.describe('Dashboard', () => {
	test('admin vê o dashboard', async ({ pageAdmin }) => {
		await pageAdmin.goto('/dashboard');
		// Deve ter algum elemento de resumo/gráfico (card de saldo, tabela, etc.)
		await expect(
			pageAdmin.locator('text=/saldo|lançamento|crédito|débito|período/i').first()
		).toBeVisible({ timeout: 10000 });
	});

	test('consulta vê o dashboard', async ({ pageConsulta }) => {
		await pageConsulta.goto('/dashboard');
		await expect(
			pageConsulta.locator('text=/saldo|lançamento|crédito|débito|período/i').first()
		).toBeVisible({ timeout: 10000 });
	});

	test('operador vê o dashboard', async ({ pageOperador }) => {
		await pageOperador.goto('/dashboard');
		await expect(
			pageOperador.locator('text=/saldo|lançamento|crédito|débito|período/i').first()
		).toBeVisible({ timeout: 10000 });
	});

	test('dashboard tem seletor de período', async ({ pageConsulta }) => {
		await pageConsulta.goto('/dashboard');
		// O componente tem PERIODOS com labels como "Último mês", "Últimos 6 meses", etc.
		await expect(
			pageConsulta.locator('text=/último mês|últimos 6|ano atual/i').first()
		).toBeVisible({ timeout: 10000 });
	});

	test('dashboard tem link ou acesso para lançamentos', async ({ pageConsulta }) => {
		await pageConsulta.goto('/dashboard');
		const linkLancamentos = pageConsulta.getByRole('link', { name: /lançamentos|ver todos/i })
			.or(pageConsulta.locator('a[href*="lancamentos"]').first());
		await expect(linkLancamentos.first()).toBeVisible({ timeout: 10000 });
	});
});
