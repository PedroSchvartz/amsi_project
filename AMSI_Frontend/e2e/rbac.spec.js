/**
 * rbac.spec.js — Controle de acesso por perfil (RBAC)
 *
 * Espelho de test_permissoes.py: cada perfil acessa exatamente o que deveria.
 *
 * Asserções DETERMINÍSTICAS:
 *   - Acesso concedido → marcador único da página é visível.
 *   - Acesso negado    → PrivateRoute renderiza a NotFoundPage
 *                        ("Página não encontrada") no lugar do conteúdo.
 */

import { test, expect, esperaPaginaNaoEncontrada } from './fixtures.js';

// Marcadores únicos de cada página (extraídos dos componentes reais)
const MARCADOR = {
	usuarios:      (p) => expect(p.getByRole('button', { name: 'Novo Usuário' })).toBeVisible({ timeout: 8000 }),
	tipoConta:     (p) => expect(p.getByRole('heading', { name: 'Tipos de Conta' })).toBeVisible({ timeout: 8000 }),
	dashboard:     (p) => expect(p.getByText('Último mês').first()).toBeVisible({ timeout: 8000 }),
	lancamentos:   (p) => expect(p.getByRole('heading', { name: 'Lista de Lançamentos' })).toBeVisible({ timeout: 8000 }),
	clifor:        (p) => expect(p.getByRole('heading', { name: 'Clientes / Fornecedores' })).toBeVisible({ timeout: 8000 }),
	cliforNovo:    (p) => expect(p.getByRole('button', { name: 'Cadastrar' })).toBeVisible({ timeout: 8000 }),
};

// ─── Admin: acessa tudo ───────────────────────────────────────────────────────

test('admin acessa /usuarios', async ({ pageAdmin }) => {
	await pageAdmin.goto('/usuarios');
	await MARCADOR.usuarios(pageAdmin);
});

test('admin acessa /tipo_conta', async ({ pageAdmin }) => {
	await pageAdmin.goto('/tipo_conta');
	await MARCADOR.tipoConta(pageAdmin);
});

test('admin acessa /dashboard', async ({ pageAdmin }) => {
	await pageAdmin.goto('/dashboard');
	await MARCADOR.dashboard(pageAdmin);
});

test('admin acessa /lancamentos', async ({ pageAdmin }) => {
	await pageAdmin.goto('/lancamentos');
	await MARCADOR.lancamentos(pageAdmin);
});

test('admin acessa /cliente_fornecedor/novo', async ({ pageAdmin }) => {
	await pageAdmin.goto('/cliente_fornecedor/novo');
	await MARCADOR.cliforNovo(pageAdmin);
});

// ─── Consulta: leitura sim, admin/escrita não ────────────────────────────────

test('consulta acessa /dashboard', async ({ pageConsulta }) => {
	await pageConsulta.goto('/dashboard');
	await MARCADOR.dashboard(pageConsulta);
});

test('consulta acessa /lancamentos', async ({ pageConsulta }) => {
	await pageConsulta.goto('/lancamentos');
	await MARCADOR.lancamentos(pageConsulta);
});

test('consulta acessa /cliente_fornecedor', async ({ pageConsulta }) => {
	await pageConsulta.goto('/cliente_fornecedor');
	await MARCADOR.clifor(pageConsulta);
});

test('consulta NÃO acessa /usuarios (NotFound)', async ({ pageConsulta }) => {
	await pageConsulta.goto('/usuarios');
	await esperaPaginaNaoEncontrada(pageConsulta);
});

test('consulta NÃO acessa /tipo_conta (NotFound)', async ({ pageConsulta }) => {
	await pageConsulta.goto('/tipo_conta');
	await esperaPaginaNaoEncontrada(pageConsulta);
});

test('consulta NÃO acessa /cliente_fornecedor/novo (NotFound)', async ({ pageConsulta }) => {
	await pageConsulta.goto('/cliente_fornecedor/novo');
	await esperaPaginaNaoEncontrada(pageConsulta);
});

// ─── Operador: leitura + escrita sim, admin não ──────────────────────────────

test('operador acessa /dashboard', async ({ pageOperador }) => {
	await pageOperador.goto('/dashboard');
	await MARCADOR.dashboard(pageOperador);
});

test('operador acessa /cliente_fornecedor/novo', async ({ pageOperador }) => {
	await pageOperador.goto('/cliente_fornecedor/novo');
	await MARCADOR.cliforNovo(pageOperador);
});

test('operador NÃO acessa /usuarios (NotFound)', async ({ pageOperador }) => {
	await pageOperador.goto('/usuarios');
	await esperaPaginaNaoEncontrada(pageOperador);
});

test('operador NÃO acessa /tipo_conta (NotFound)', async ({ pageOperador }) => {
	await pageOperador.goto('/tipo_conta');
	await esperaPaginaNaoEncontrada(pageOperador);
});
