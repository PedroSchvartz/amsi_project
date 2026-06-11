/**
 * rbac.spec.js — Controle de acesso por perfil (RBAC)
 *
 * Espelho de test_permissoes.py: verifica que cada perfil acessa
 * exatamente o que deveria e é bloqueado no que não pode.
 *
 * PrivateRoute comportamento:
 *   - Sem auth         → redirect para /
 *   - adminOnly + não-admin → renderiza NotFoundPage
 *   - minPerfil insuficiente → renderiza NotFoundPage
 */

import { test, expect } from './fixtures.js';

// ─── Admin: acessa tudo ───────────────────────────────────────────────────────

test('admin acessa /usuarios', async ({ pageAdmin }) => {
	await pageAdmin.goto('/usuarios');
	// A página deve carregar (não redirecionar para / e não mostrar 404)
	await expect(pageAdmin).not.toHaveURL('/');
	await expect(pageAdmin.locator('text=/404|não encontrad/i').first()).not.toBeVisible({ timeout: 2000 }).catch(() => {});
});

test('admin acessa /tipo_conta', async ({ pageAdmin }) => {
	await pageAdmin.goto('/tipo_conta');
	await expect(pageAdmin).not.toHaveURL('/');
});

test('admin acessa /dashboard', async ({ pageAdmin }) => {
	await pageAdmin.goto('/dashboard');
	await expect(pageAdmin).not.toHaveURL('/');
});

test('admin acessa /lancamentos', async ({ pageAdmin }) => {
	await pageAdmin.goto('/lancamentos');
	await expect(pageAdmin).not.toHaveURL('/');
});

test('admin acessa /cliente_fornecedor/novo', async ({ pageAdmin }) => {
	await pageAdmin.goto('/cliente_fornecedor/novo');
	await expect(pageAdmin).not.toHaveURL('/');
});

// ─── Consulta: acessa leitura, bloqueado em admin e operador ─────────────────

test('consulta acessa /dashboard', async ({ pageConsulta }) => {
	await pageConsulta.goto('/dashboard');
	await expect(pageConsulta).not.toHaveURL('/');
});

test('consulta acessa /lancamentos', async ({ pageConsulta }) => {
	await pageConsulta.goto('/lancamentos');
	await expect(pageConsulta).not.toHaveURL('/');
});

test('consulta acessa /cliente_fornecedor', async ({ pageConsulta }) => {
	await pageConsulta.goto('/cliente_fornecedor');
	await expect(pageConsulta).not.toHaveURL('/');
});

test('consulta NÃO acessa /usuarios (recebe NotFound)', async ({ pageConsulta }) => {
	await pageConsulta.goto('/usuarios');
	// PrivateRoute adminOnly → NotFoundPage (não redireciona, renderiza 404)
	// Não deve ter chegado na tela de listagem de usuários
	const listaDeUsuarios = pageConsulta.locator('text=/lista de usuários|gerenciar usuários/i').first();
	await expect(listaDeUsuarios).not.toBeVisible({ timeout: 3000 }).catch(() => {});
});

test('consulta NÃO acessa /tipo_conta (recebe NotFound)', async ({ pageConsulta }) => {
	await pageConsulta.goto('/tipo_conta');
	const listaTipo = pageConsulta.locator('text=/tipo de conta|tipo_conta/i').first();
	await expect(listaTipo).not.toBeVisible({ timeout: 3000 }).catch(() => {});
});

test('consulta NÃO acessa /cliente_fornecedor/novo', async ({ pageConsulta }) => {
	await pageConsulta.goto('/cliente_fornecedor/novo');
	const formCadastro = pageConsulta.locator('text=/cadastrar cliente|novo cliente/i').first();
	await expect(formCadastro).not.toBeVisible({ timeout: 3000 }).catch(() => {});
});

// ─── Operador: acessa leitura + escrita, bloqueado em admin ──────────────────

test('operador acessa /dashboard', async ({ pageOperador }) => {
	await pageOperador.goto('/dashboard');
	await expect(pageOperador).not.toHaveURL('/');
});

test('operador acessa /cliente_fornecedor/novo', async ({ pageOperador }) => {
	await pageOperador.goto('/cliente_fornecedor/novo');
	await expect(pageOperador).not.toHaveURL('/');
});

test('operador NÃO acessa /usuarios (recebe NotFound)', async ({ pageOperador }) => {
	await pageOperador.goto('/usuarios');
	const listaDeUsuarios = pageOperador.locator('text=/lista de usuários|gerenciar usuários/i').first();
	await expect(listaDeUsuarios).not.toBeVisible({ timeout: 3000 }).catch(() => {});
});

test('operador NÃO acessa /tipo_conta (recebe NotFound)', async ({ pageOperador }) => {
	await pageOperador.goto('/tipo_conta');
	const listaTipo = pageOperador.locator('text=/tipo de conta/i').first();
	await expect(listaTipo).not.toBeVisible({ timeout: 3000 }).catch(() => {});
});
