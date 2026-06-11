/**
 * lancamentos.spec.js — Lançamentos financeiros
 *
 * Espelho de test_lancamento.py: cria via API (o schema exige clifor e
 * usuário lançador), verifica na UI, fecha (PUT com data_pagamento) e exclui.
 *
 * Dados base (tipo de conta / clifor) são criados se não existirem e
 * removidos no afterAll — espelho das fixtures *_base do conftest.py.
 */

import { test, expect, BACKEND, authHeaders, getToken, injetarSessao } from './fixtures.js';

const VALOR_UNICO = 753.19; // valor improvável de colidir com dados reais na UI
const criados = { tipo: null, clifor: null, lancamentos: [] };

function idDoToken(token) {
	const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
	return parseInt(payload.sub);
}

async function dadosBase(page) {
	const auth = await authHeaders(page);

	let tipos = await (await page.request.get(`${BACKEND}/tipo_conta/`, { headers: auth })).json();
	let idTipo;
	if (tipos.length > 0) {
		idTipo = tipos[0].id_tipo_conta;
	} else {
		const novo = await page.request.post(`${BACKEND}/tipo_conta/`, {
			data: { descricao_conta: 'PW Tipo Base', natureza_conta: 'Debito', observacao: null },
			headers: auth,
		});
		idTipo = (await novo.json()).id_tipo_conta;
		criados.tipo = idTipo;
	}

	let clifors = await (await page.request.get(`${BACKEND}/cliente_fornecedor/`, { headers: auth })).json();
	let idClifor;
	if (clifors.length > 0) {
		idClifor = clifors[0].id_clifor;
	} else {
		const novo = await page.request.post(`${BACKEND}/cliente_fornecedor/`, {
			data: {
				nome: 'PW CliFor Base', pessoafisica_juridica: true, cpf_cnpj: '52998224725',
				rg_inscricaoestadual: '123456789', datanascimento: '1990-01-01', tipo_clifor: 'A', ativo: true,
			},
			headers: auth,
		});
		idClifor = (await novo.json()).id_clifor;
		criados.clifor = idClifor;
	}

	return { idTipo, idClifor };
}

async function criarLancamento(page, { valor = VALOR_UNICO } = {}) {
	const auth = await authHeaders(page);
	const { idTipo, idClifor } = await dadosBase(page);
	const hoje = new Date().toISOString().split('T')[0];

	const res = await page.request.post(`${BACKEND}/lancamento/`, {
		data: {
			id_usuario_fk_lancamento: idDoToken(await getToken(page)),
			id_clifor_relacionado_fk: idClifor,
			id_tipo_conta_fk: idTipo,
			valor,
			data_vencimento: hoje,
			natureza_lancamento: 'Debito',
			observacao: 'criado pelo Playwright',
		},
		headers: auth,
	});
	expect(res.ok(), `POST /lancamento falhou: ${await res.text()}`).toBeTruthy();
	const lancamento = await res.json();
	criados.lancamentos.push(lancamento.id_lancamento);
	return lancamento;
}

test.describe('Lançamentos', () => {
	test.afterAll(async ({ browser }) => {
		// Limpeza de tudo que a spec criou (espelho do teardown das fixtures base)
		const page = await browser.newPage();
		await page.goto('http://localhost:5173/');
		await injetarSessao(page, 'admin');
		const auth = await authHeaders(page);

		for (const id of criados.lancamentos) {
			await page.request.delete(`${BACKEND}/lancamento/${id}`, { headers: auth });
		}
		if (criados.clifor) {
			await page.request.delete(`${BACKEND}/cliente_fornecedor/${criados.clifor}`, { headers: auth });
		}
		if (criados.tipo) {
			await page.request.delete(`${BACKEND}/tipo_conta/${criados.tipo}`, { headers: auth });
		}
		await page.close();
	});

	test('página de lançamentos carrega', async ({ pageConsulta }) => {
		await pageConsulta.goto('/lancamentos');
		await expect(
			pageConsulta.getByRole('heading', { name: 'Lista de Lançamentos' })
		).toBeVisible({ timeout: 8000 });
	});

	test('consulta NÃO vê botão de novo lançamento', async ({ pageConsulta }) => {
		await pageConsulta.goto('/lancamentos');
		await expect(
			pageConsulta.getByRole('heading', { name: 'Lista de Lançamentos' })
		).toBeVisible({ timeout: 8000 });
		// Render condicional hasPerfilMinimo('Operador'): o botão não existe no DOM
		await expect(pageConsulta.getByRole('button', { name: /novo lançamento/i })).toHaveCount(0);
	});

	test('operador vê botão de novo lançamento', async ({ pageOperador }) => {
		await pageOperador.goto('/lancamentos');
		await expect(
			pageOperador.getByRole('button', { name: /novo lançamento/i })
		).toBeVisible({ timeout: 8000 });
	});

	test('lançamento criado aparece na lista da UI', async ({ pageAdmin }) => {
		await criarLancamento(pageAdmin);
		await pageAdmin.goto('/lancamentos');
		// Valor formatado pt-BR: 753,19
		await expect(pageAdmin.getByText('753,19').first()).toBeVisible({ timeout: 8000 });
	});

	test('fechar lançamento registra pagamento', async ({ pageAdmin }) => {
		const lancamento = await criarLancamento(pageAdmin, { valor: 211.37 });
		const auth = await authHeaders(pageAdmin);

		const res = await pageAdmin.request.put(`${BACKEND}/lancamento/${lancamento.id_lancamento}`, {
			data: {
				data_pagamento: new Date().toISOString(),
				valor_pago: 211.37,
				id_usuario_fk_fechamento: idDoToken(await getToken(pageAdmin)),
			},
			headers: auth,
		});
		expect(res.ok(), await res.text()).toBeTruthy();
		const fechado = await res.json();
		expect(fechado.data_pagamento).not.toBeNull();
	});

	test('excluir lançamento', async ({ pageAdmin }) => {
		const lancamento = await criarLancamento(pageAdmin, { valor: 99.45 });
		const auth = await authHeaders(pageAdmin);

		const del = await pageAdmin.request.delete(`${BACKEND}/lancamento/${lancamento.id_lancamento}`, { headers: auth });
		expect(del.ok()).toBeTruthy();
		criados.lancamentos = criados.lancamentos.filter((id) => id !== lancamento.id_lancamento);

		const busca = await pageAdmin.request.get(`${BACKEND}/lancamento/${lancamento.id_lancamento}`, { headers: auth });
		expect(busca.status()).toBe(404);
	});
});
