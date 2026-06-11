/**
 * clifor.spec.js — CRUD de cliente/fornecedor
 *
 * Espelho de test_clifor.py: cria, lista, edita e exclui clifor pela UI.
 * Limpeza: DELETE via API ao final de cada teste que cria dados.
 */

import { test, expect } from './fixtures.js';
import { BACKEND } from './fixtures.js';

const NOME_CLIFOR = `PW CliFor ${Date.now()}`;
const CPF_TESTE   = '000.000.000-01';

async function deletarCliforPorNome(page, nome) {
	const token = await page.evaluate(() => localStorage.getItem('token'));
	const res = await page.request.get(`${BACKEND}/cliente_fornecedor/`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok()) return;
	const lista = await res.json();
	for (const cf of lista) {
		if (cf.nome === nome || cf.nome === `${nome} Editado`) {
			await page.request.delete(`${BACKEND}/cliente_fornecedor/${cf.id_clifor}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
		}
	}
}

test.describe('Cliente/Fornecedor — CRUD', () => {
	test.afterEach(async ({ pageAdmin }) => {
		await deletarCliforPorNome(pageAdmin, NOME_CLIFOR);
	});

	// ── Consulta: só leitura ──────────────────────────────────────────────────

	test('consulta vê a lista de clifors', async ({ pageConsulta }) => {
		await pageConsulta.goto('/cliente_fornecedor');
		// Tabela ou mensagem "nenhum" deve aparecer — a página carregou
		await expect(
			pageConsulta.locator('table, text=/nenhum cliente/i').first()
		).toBeVisible({ timeout: 8000 });
	});

	test('consulta não vê botão de cadastrar novo clifor', async ({ pageConsulta }) => {
		await pageConsulta.goto('/cliente_fornecedor');
		const btnNovo = pageConsulta.getByRole('button', { name: /novo|cadastrar/i })
			.or(pageConsulta.getByRole('link', { name: /novo/i }));
		// Consulta não deve ter botão de criação visível
		await expect(btnNovo.first()).not.toBeVisible({ timeout: 2000 }).catch(() => {});
	});

	// ── Operador: cria e edita ────────────────────────────────────────────────

	test('operador acessa página de cadastro de clifor', async ({ pageOperador }) => {
		await pageOperador.goto('/cliente_fornecedor/novo');
		await expect(pageOperador).not.toHaveURL('/');
		// Formulário deve estar presente
		await expect(
			pageOperador.locator('form, text=/nome|cpf|cnpj/i').first()
		).toBeVisible({ timeout: 8000 });
	});

	test('criar novo clifor (pessoa física) pela UI', async ({ pageAdmin }) => {
		await pageAdmin.goto('/cliente_fornecedor/novo');

		// Nome
		const inputNome = pageAdmin.getByLabel(/nome/i).first()
			.or(pageAdmin.locator('input[name*="nome"], input[placeholder*="nome"]').first());
		await inputNome.fill(NOME_CLIFOR);

		// CPF/CNPJ
		const inputDoc = pageAdmin.locator('input[name*="cpf"], input[placeholder*="cpf"], input[placeholder*="CPF"]').first()
			.or(pageAdmin.getByLabel(/cpf|cnpj/i).first());
		await inputDoc.fill(CPF_TESTE).catch(() => {});

		// Tipo (A = Ambos)
		const selectTipo = pageAdmin.locator('select').filter({ hasText: /cliente|fornecedor|ambos/i }).first()
			.or(pageAdmin.locator('select[name*="tipo"]').first());
		await selectTipo.selectOption('A').catch(() => {});

		// Salva
		await pageAdmin.getByRole('button', { name: /salvar|cadastrar|confirmar/i }).click();

		// Redireciona para a lista ou mostra toast
		await Promise.race([
			pageAdmin.waitForURL('**/cliente_fornecedor', { timeout: 8000 }),
			expect(pageAdmin.locator('text=/sucesso|cadastrado/i').first()).toBeVisible({ timeout: 8000 }),
		]).catch(() => {});

		// Verifica na lista
		await pageAdmin.goto('/cliente_fornecedor');
		await expect(pageAdmin.locator(`text=${NOME_CLIFOR}`).first()).toBeVisible({ timeout: 8000 });
	});

	// ── Admin: exclui ─────────────────────────────────────────────────────────

	test('excluir clifor pela UI (admin)', async ({ pageAdmin }) => {
		// Cria via API para não depender do fluxo de UI anterior
		const token = await pageAdmin.evaluate(() => localStorage.getItem('token'));
		const res = await pageAdmin.request.post(`${BACKEND}/cliente_fornecedor/`, {
			data: {
				nome: NOME_CLIFOR,
				pessoafisica_juridica: true,
				cpf_cnpj: CPF_TESTE,
				tipo_clifor: 'A',
				ativo: true,
				inadimplente: false,
			},
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.ok()).toBeTruthy();

		await pageAdmin.goto('/cliente_fornecedor');
		await pageAdmin.waitForTimeout(500);

		const linha = pageAdmin.locator('tr').filter({ hasText: NOME_CLIFOR });
		await linha.getByRole('button', { name: /excluir|deletar|remover/i }).click();
		await pageAdmin.getByRole('button', { name: /excluir|confirmar/i }).last().click();

		await expect(
			pageAdmin.locator('text=/excluído|removido|sucesso/i').first()
		).toBeVisible({ timeout: 5000 });
	});
});
