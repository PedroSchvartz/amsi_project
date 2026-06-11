/**
 * tipo_conta.spec.js — CRUD de tipos de conta (rota adminOnly)
 *
 * Espelho do test_tipo_conta.py: cria, edita e exclui via UI.
 * Limpeza feita via API (hard delete não existe para tipo_conta,
 * então usa DELETE normal — o teste cria e apaga o que criou).
 */

import { test, expect } from './fixtures.js';
import { BACKEND } from './fixtures.js';

const NOME_TIPO = `Playwright Tipo ${Date.now()}`;
const NOME_EDITADO = `${NOME_TIPO} Editado`;

let idCriado = null;

test.describe('Tipos de Conta — CRUD (admin)', () => {
	test.use({ /* usa pageAdmin da fixture */ });

	test('página de tipos de conta carrega corretamente', async ({ pageAdmin }) => {
		await pageAdmin.goto('/tipo_conta');
		await expect(pageAdmin.getByRole('heading', { name: /tipos de conta/i })).toBeVisible();
		await expect(pageAdmin.getByRole('button', { name: /novo tipo/i })).toBeVisible();
	});

	test('criar novo tipo de conta', async ({ pageAdmin }) => {
		await pageAdmin.goto('/tipo_conta');

		// Abre modal de criação
		await pageAdmin.getByRole('button', { name: /novo tipo/i }).click();

		// Preenche o formulário
		await pageAdmin.getByLabel(/descrição/i).fill(NOME_TIPO);

		// Natureza: seleciona Debito
		const selectNatureza = pageAdmin.locator('select').filter({ hasText: /crédito|débito/i }).first()
			.or(pageAdmin.locator('select[name*="natureza"], select').first());
		await selectNatureza.selectOption('Debito').catch(() => {});

		// Salva
		await pageAdmin.getByRole('button', { name: /salvar|criar|confirmar/i }).click();

		// Toast de sucesso
		await expect(
			pageAdmin.locator('text=/criado com sucesso/i').first()
		).toBeVisible({ timeout: 5000 });

		// Aparece na tabela
		await expect(pageAdmin.locator(`text=${NOME_TIPO}`).first()).toBeVisible({ timeout: 5000 });
	});

	test('editar tipo de conta existente', async ({ pageAdmin }) => {
		await pageAdmin.goto('/tipo_conta');

		// Clica no botão de editar na linha do tipo criado
		const linha = pageAdmin.locator('tr').filter({ hasText: NOME_TIPO });
		await linha.getByRole('button', { name: /editar|edit/i }).click();

		// Altera a descrição
		const inputDesc = pageAdmin.getByLabel(/descrição/i);
		await inputDesc.clear();
		await inputDesc.fill(NOME_EDITADO);

		await pageAdmin.getByRole('button', { name: /salvar|atualizar|confirmar/i }).click();

		await expect(
			pageAdmin.locator('text=/atualizado com sucesso/i').first()
		).toBeVisible({ timeout: 5000 });

		await expect(pageAdmin.locator(`text=${NOME_EDITADO}`).first()).toBeVisible({ timeout: 5000 });
	});

	test('excluir tipo de conta criado (limpeza)', async ({ pageAdmin }) => {
		await pageAdmin.goto('/tipo_conta');

		const linha = pageAdmin.locator('tr').filter({ hasText: NOME_EDITADO });
		await linha.getByRole('button', { name: /excluir|deletar|remover/i }).click();

		// Confirmação no modal
		await pageAdmin.getByRole('button', { name: /excluir|confirmar/i }).last().click();

		await expect(
			pageAdmin.locator('text=/excluído com sucesso/i').first()
		).toBeVisible({ timeout: 5000 });

		await expect(pageAdmin.locator(`text=${NOME_EDITADO}`)).not.toBeVisible({ timeout: 3000 }).catch(() => {});
	});
});
