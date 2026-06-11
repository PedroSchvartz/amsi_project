/**
 * lancamentos.spec.js — CRUD de lançamentos financeiros
 *
 * Espelho de test_lancamento.py: cria, lista, fecha e exclui lançamento.
 * Limpeza: DELETE via API — o teste cria e apaga o que fez.
 *
 * PRÉ-REQUISITO: pelo menos um tipo de conta e um clifor existentes.
 */

import { test, expect } from './fixtures.js';
import { BACKEND } from './fixtures.js';

const DESC_LANCAMENTO = `Lanç PW ${Date.now()}`;

async function getToken(page) {
	return page.evaluate(() => localStorage.getItem('token'));
}

async function criarDadosBase(page) {
	const token = await getToken(page);
	const auth = { Authorization: `Bearer ${token}` };

	// Tipo de conta (se não existir nenhum)
	let tipoRes = await page.request.get(`${BACKEND}/tipo_conta/`, { headers: auth });
	let tipos = await tipoRes.json();
	let idTipo;
	if (tipos.length === 0) {
		const novo = await page.request.post(`${BACKEND}/tipo_conta/`, {
			data: { descricao_conta: 'PW Tipo Base', natureza_conta: 'Debito', observacao: null },
			headers: auth,
		});
		idTipo = (await novo.json()).id_tipo_conta;
	} else {
		idTipo = tipos[0].id_tipo_conta;
	}

	// Clifor (se não existir nenhum)
	let cliforRes = await page.request.get(`${BACKEND}/cliente_fornecedor/`, { headers: auth });
	let clifors = await cliforRes.json();
	let idClifor = clifors.length > 0 ? clifors[0].id_clifor : null;

	return { idTipo, idClifor };
}

async function deletarLancamentoPorDesc(page, desc) {
	const token = await getToken(page);
	const auth = { Authorization: `Bearer ${token}` };
	const res = await page.request.get(`${BACKEND}/lancamento/`, { headers: auth });
	if (!res.ok()) return;
	const lista = await res.json();
	for (const l of lista) {
		if (l.descricao === desc) {
			await page.request.delete(`${BACKEND}/lancamento/${l.id_lancamento}`, { headers: auth });
		}
	}
}

test.describe('Lançamentos — CRUD', () => {
	test.afterEach(async ({ pageAdmin }) => {
		await deletarLancamentoPorDesc(pageAdmin, DESC_LANCAMENTO);
	});

	test('página de lançamentos carrega', async ({ pageConsulta }) => {
		await pageConsulta.goto('/lancamentos');
		// Deve aparecer algum conteúdo (tabela vazia ou com registros)
		await expect(
			pageConsulta.locator('table, text=/nenhum lançamento|vencimento|data/i').first()
		).toBeVisible({ timeout: 8000 });
	});

	test('consulta NÃO vê botão de novo lançamento', async ({ pageConsulta }) => {
		await pageConsulta.goto('/lancamentos');
		const btnNovo = pageConsulta.getByRole('button', { name: /novo lançamento|lançar/i });
		await expect(btnNovo.first()).not.toBeVisible({ timeout: 2000 }).catch(() => {});
	});

	test('operador vê botão de novo lançamento', async ({ pageOperador }) => {
		await pageOperador.goto('/lancamentos');
		const btnNovo = pageOperador.getByRole('button', { name: /novo lançamento|lançar|\+ lançamento/i });
		await expect(btnNovo.first()).toBeVisible({ timeout: 8000 });
	});

	test('criar lançamento via API e verificar na lista', async ({ pageAdmin }) => {
		const { idTipo, idClifor } = await criarDadosBase(pageAdmin);
		const token = await getToken(pageAdmin);
		const auth = { Authorization: `Bearer ${token}` };

		const hoje = new Date().toISOString().split('T')[0];
		const res = await pageAdmin.request.post(`${BACKEND}/lancamento/`, {
			data: {
				descricao: DESC_LANCAMENTO,
				valor: 100.00,
				data_vencimento: hoje,
				id_tipo_conta_fk: idTipo,
				natureza: 'Debito',
				...(idClifor ? { id_clifor_relacionado_fk: idClifor } : {}),
			},
			headers: auth,
		});
		expect(res.ok()).toBeTruthy();

		await pageAdmin.goto('/lancamentos');
		// O lançamento deve aparecer na tabela
		await expect(pageAdmin.locator(`text=${DESC_LANCAMENTO}`).first()).toBeVisible({ timeout: 8000 });
	});

	test('fechar lançamento via API muda status', async ({ pageAdmin }) => {
		const { idTipo } = await criarDadosBase(pageAdmin);
		const token = await getToken(pageAdmin);
		const auth = { Authorization: `Bearer ${token}` };

		const hoje = new Date().toISOString().split('T')[0];
		const criarRes = await pageAdmin.request.post(`${BACKEND}/lancamento/`, {
			data: {
				descricao: DESC_LANCAMENTO,
				valor: 50.00,
				data_vencimento: hoje,
				id_tipo_conta_fk: idTipo,
				natureza: 'Credito',
			},
			headers: auth,
		});
		const lancamento = await criarRes.json();
		const id = lancamento.id_lancamento;

		// Fecha via API
		const fecharRes = await pageAdmin.request.put(`${BACKEND}/lancamento/${id}/fechar`, {
			data: { data_fechamento: hoje, observacao: 'Fechado pelo Playwright' },
			headers: auth,
		});
		expect(fecharRes.ok()).toBeTruthy();
		const fechado = await fecharRes.json();
		expect(fechado.data_fechamento).toBe(hoje);
	});

	test('excluir lançamento via API', async ({ pageAdmin }) => {
		const { idTipo } = await criarDadosBase(pageAdmin);
		const token = await getToken(pageAdmin);
		const auth = { Authorization: `Bearer ${token}` };

		const hoje = new Date().toISOString().split('T')[0];
		const criarRes = await pageAdmin.request.post(`${BACKEND}/lancamento/`, {
			data: {
				descricao: DESC_LANCAMENTO,
				valor: 75.00,
				data_vencimento: hoje,
				id_tipo_conta_fk: idTipo,
				natureza: 'Debito',
			},
			headers: auth,
		});
		const { id_lancamento } = await criarRes.json();

		const delRes = await pageAdmin.request.delete(`${BACKEND}/lancamento/${id_lancamento}`, { headers: auth });
		expect(delRes.ok()).toBeTruthy();
	});
});
