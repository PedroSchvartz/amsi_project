/**
 * tipo_conta.spec.js — CRUD de tipos de conta (rota adminOnly), 100% pela UI
 *
 * Espelho do test_tipo_conta.py: cria, edita e exclui via interface.
 * Os testes rodam em sequência (serial) — cada um depende do anterior.
 * afterAll limpa via API qualquer sobra se um passo falhar no meio.
 */

import { test, expect, BACKEND, authHeaders } from './fixtures.js';

const NOME_TIPO    = `Playwright Tipo ${Date.now()}`;
const NOME_EDITADO = `${NOME_TIPO} Editado`;

test.describe.configure({ mode: 'serial' });

test.describe('Tipos de Conta — CRUD pela UI (admin)', () => {
	test('página carrega com cabeçalho e botão de criação', async ({ pageAdmin }) => {
		await pageAdmin.goto('/tipo_conta');
		await expect(pageAdmin.getByRole('heading', { name: 'Tipos de Conta' })).toBeVisible({ timeout: 8000 });
		await expect(pageAdmin.getByRole('button', { name: /novo tipo/i })).toBeVisible();
	});

	test('criar novo tipo de conta', async ({ pageAdmin }) => {
		await pageAdmin.goto('/tipo_conta');
		await pageAdmin.getByRole('button', { name: /novo tipo/i }).click();
		await expect(pageAdmin.getByRole('heading', { name: 'Novo Tipo de Conta' })).toBeVisible();

		// Modal: único input de texto da página + select de natureza
		await pageAdmin.locator('input[type="text"]').fill(NOME_TIPO);
		await pageAdmin.locator('select').selectOption('Debito');
		await pageAdmin.getByRole('button', { name: 'Criar' }).click();

		await expect(pageAdmin.getByText('Tipo de conta criado com sucesso.')).toBeVisible({ timeout: 8000 });
		await expect(pageAdmin.getByText(NOME_TIPO)).toBeVisible({ timeout: 8000 });
	});

	test('editar o tipo de conta criado', async ({ pageAdmin }) => {
		await pageAdmin.goto('/tipo_conta');

		const linha = pageAdmin.locator('tr').filter({ hasText: NOME_TIPO });
		await linha.getByRole('button', { name: 'Editar' }).click();
		await expect(pageAdmin.getByRole('heading', { name: 'Editar Tipo de Conta' })).toBeVisible();

		const input = pageAdmin.locator('input[type="text"]');
		await input.clear();
		await input.fill(NOME_EDITADO);
		await pageAdmin.getByRole('button', { name: 'Salvar' }).click();

		await expect(pageAdmin.getByText('Tipo de conta atualizado com sucesso.')).toBeVisible({ timeout: 8000 });
		await expect(pageAdmin.getByText(NOME_EDITADO)).toBeVisible({ timeout: 8000 });
	});

	test('excluir o tipo de conta (limpeza pela UI)', async ({ pageAdmin }) => {
		await pageAdmin.goto('/tipo_conta');

		const linha = pageAdmin.locator('tr').filter({ hasText: NOME_EDITADO });
		// Botão de excluir da linha é só o ícone de lixeira
		await linha.locator('button:has(i.bi-trash)').click();

		// ModalConfirm com textoBotaoConfirmar="Excluir"
		await pageAdmin.getByRole('button', { name: 'Excluir' }).click();

		await expect(pageAdmin.getByText('Tipo de conta excluído com sucesso.')).toBeVisible({ timeout: 8000 });
		await expect(pageAdmin.locator('tr').filter({ hasText: NOME_EDITADO })).toHaveCount(0);
	});

	test('limpeza de segurança via API (caso algum passo anterior tenha falhado)', async ({ pageAdmin }) => {
		const auth = await authHeaders(pageAdmin);
		const res = await pageAdmin.request.get(`${BACKEND}/tipo_conta/`, { headers: auth });
		expect(res.ok()).toBeTruthy();
		for (const t of await res.json()) {
			if (t.descricao_conta === NOME_TIPO || t.descricao_conta === NOME_EDITADO) {
				await pageAdmin.request.delete(`${BACKEND}/tipo_conta/${t.id_tipo_conta}`, { headers: auth });
			}
		}
	});
});
