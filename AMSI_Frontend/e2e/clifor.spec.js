/**
 * clifor.spec.js — CRUD de cliente/fornecedor
 *
 * Espelho de test_clifor.py. O cadastro pela UI preenche o formulário
 * COMPLETO (o ClientRegister valida CPF com dígitos verificadores,
 * endereço completo, telefone e email antes de submeter).
 *
 * Limpeza: DELETE via API ao final de cada teste que cria dados.
 */

import { test, expect, BACKEND, authHeaders } from './fixtures.js';

const NOME_CLIFOR = `PW CliFor ${Date.now()}`;
const CPF_VALIDO  = '529.982.247-25'; // CPF de teste que passa na validação de dígitos

async function deletarCliforPorNome(page, nome) {
	const auth = await authHeaders(page);
	const res = await page.request.get(`${BACKEND}/cliente_fornecedor/`, { headers: auth });
	if (!res.ok()) return;
	for (const cf of await res.json()) {
		if (cf.nome === nome) {
			await page.request.delete(`${BACKEND}/cliente_fornecedor/${cf.id_clifor}`, { headers: auth });
		}
	}
}

test.describe('Cliente/Fornecedor', () => {
	test.afterEach(async ({ pageAdmin }) => {
		await deletarCliforPorNome(pageAdmin, NOME_CLIFOR);
	});

	// ── Consulta: só leitura ──────────────────────────────────────────────────

	test('consulta vê a lista de clifors', async ({ pageConsulta }) => {
		await pageConsulta.goto('/cliente_fornecedor');
		await expect(
			pageConsulta.getByRole('heading', { name: 'Clientes / Fornecedores' })
		).toBeVisible({ timeout: 8000 });
	});

	test('consulta NÃO vê o botão "+ Novo"', async ({ pageConsulta }) => {
		await pageConsulta.goto('/cliente_fornecedor');
		await expect(
			pageConsulta.getByRole('heading', { name: 'Clientes / Fornecedores' })
		).toBeVisible({ timeout: 8000 });
		// Render condicional {!consulta && <button class="cl-btn-novo">}: o nó não existe
		await expect(pageConsulta.locator('.cl-btn-novo')).toHaveCount(0);
	});

	test('admin vê o botão "+ Novo"', async ({ pageAdmin }) => {
		await pageAdmin.goto('/cliente_fornecedor');
		await expect(pageAdmin.locator('.cl-btn-novo')).toBeVisible({ timeout: 8000 });
	});

	// ── Operador: cadastra pela UI (formulário completo) ─────────────────────

	test('operador cadastra clifor pessoa física pela UI', async ({ pageOperador }) => {
		await pageOperador.goto('/cliente_fornecedor/novo');
		await expect(
			pageOperador.getByRole('heading', { name: 'Novo Cliente / Fornecedor' })
		).toBeVisible({ timeout: 8000 });

		// ── Informações básicas ──
		await pageOperador.locator('#tipo_A').check(); // Ambos
		await pageOperador.locator('#pf_true').check(); // Pessoa Física (default, garante)
		await pageOperador.getByPlaceholder('Nome completo').fill(NOME_CLIFOR);
		await pageOperador.getByPlaceholder('000.000.000-00').fill(CPF_VALIDO);
		await pageOperador.locator('input[name="rg_inscricaoestadual"]').fill('12.345.678-9');
		await pageOperador.locator('input[name="datanascimento"]').fill('1990-01-01');

		// ── Endereço (todos obrigatórios; CEP sem cadastro no ViaCEP é ignorado) ──
		const cardEndereco = pageOperador.locator('.client-form-card').filter({ hasText: 'Endereços' });
		const inputsEnd = cardEndereco.locator('input');
		await inputsEnd.nth(0).fill('Rua dos Testes');        // logradouro
		await inputsEnd.nth(1).fill('123');                    // número
		await cardEndereco.getByPlaceholder('00000-000').fill('99999-999'); // cep
		await inputsEnd.nth(4).fill('Bairro Playwright');      // bairro
		await inputsEnd.nth(5).fill('Santa Isabel');           // cidade
		await cardEndereco.locator('select').selectOption('SP');

		// ── Telefone e email ──
		await pageOperador.getByPlaceholder('(00) 00000-0000').fill('(11) 99999-8888');
		const cardEmail = pageOperador.locator('.client-form-card').filter({ hasText: 'Emails' });
		await cardEmail.locator('input').first().fill('pw_clifor@playwright.amsi.com');

		// ── Submete ──
		await pageOperador.getByRole('button', { name: 'Cadastrar' }).click();
		await expect(
			pageOperador.getByText('Cliente/Fornecedor cadastrado com sucesso!')
		).toBeVisible({ timeout: 10000 });

		// Redireciona para a lista e o registro aparece
		await pageOperador.waitForURL('**/cliente_fornecedor', { timeout: 8000 });
		await expect(pageOperador.getByText(NOME_CLIFOR)).toBeVisible({ timeout: 8000 });
	});

	// ── Admin: exclui pela UI ─────────────────────────────────────────────────

	test('admin exclui clifor pela UI', async ({ pageAdmin }) => {
		// Cria via API para não depender do teste anterior
		const auth = await authHeaders(pageAdmin);
		const res = await pageAdmin.request.post(`${BACKEND}/cliente_fornecedor/`, {
			data: {
				nome: NOME_CLIFOR,
				pessoafisica_juridica: true,
				cpf_cnpj: '52998224725',
				rg_inscricaoestadual: '123456789',
				datanascimento: '1990-01-01',
				tipo_clifor: 'A',
				ativo: true,
			},
			headers: auth,
		});
		expect(res.ok()).toBeTruthy();

		await pageAdmin.goto('/cliente_fornecedor');
		const linha = pageAdmin.locator('tr').filter({ hasText: NOME_CLIFOR });
		await linha.locator('button:has(i.bi-trash)').click();

		// ModalConfirm com textoBotaoConfirmar="Excluir"
		await pageAdmin.getByRole('button', { name: 'Excluir' }).click();

		await expect(pageAdmin.locator('tr').filter({ hasText: NOME_CLIFOR })).toHaveCount(0, { timeout: 8000 });
	});
});
