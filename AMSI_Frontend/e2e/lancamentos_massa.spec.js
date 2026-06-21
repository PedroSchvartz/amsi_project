/**
 * lancamentos_massa.spec.js — Lançamento em massa (escopo 6.3)
 *
 * Espelho dos testes de massa de test_lancamento.py, mas focando no que SÓ a UI
 * exercita (e que os testes de backend não pegam):
 *   - o chip de origem "Em Lote" abre o LoteLancamentosModal com os lançamentos do lote
 *   - o modal de Efetivar já vem com a Data de Pagamento preenchida com hoje
 *   - REGRESSÃO de z-index: ao abrir o modal do lote de DENTRO de um modal de
 *     detalhe (chip de origem), o modal do lote fica POR CIMA (o ✕ dele é clicável).
 *
 * Segue o padrão de lancamentos.spec.js: cria via API e verifica/interage na UI.
 * Limpa tudo que criou no afterAll.
 */

import { test, expect, BACKEND, authHeaders, getToken, injetarSessao } from './fixtures.js';

function idDoToken(token) {
	const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
	return parseInt(payload.sub);
}

// Data de hoje no fuso local (YYYY-MM-DD) — mesma lógica do hojeLocal() da página.
function hojeLocal() {
	const d = new Date();
	const mes = String(d.getMonth() + 1).padStart(2, '0');
	const dia = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${mes}-${dia}`;
}

// CPF único por execução (o backend não valida dígito verificador, só usamos para não colidir).
function cpfUnico(offset) {
	const d = String(Date.now() + offset).slice(-11).padStart(11, '0');
	return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

const SUFIXO = Date.now();
const NOME_A = `PW Massa A ${SUFIXO}`;
const NOME_B = `PW Massa B ${SUFIXO}`;

const criados = { tipo: null, clifors: [], lancamentos: [] };

test.describe('Lançamento em massa (6.3)', () => {
	test.beforeAll(async ({ browser }) => {
		const page = await browser.newPage();
		await page.goto('http://localhost:5173/');
		await injetarSessao(page, 'admin');
		const auth = await authHeaders(page);
		const idUsuario = idDoToken(await getToken(page));

		// Tipo de conta: reaproveita o primeiro existente ou cria um.
		const tipos = await (await page.request.get(`${BACKEND}/tipo_conta/`, { headers: auth })).json();
		let idTipo;
		if (tipos.length > 0) {
			idTipo = tipos[0].id_tipo_conta;
		} else {
			const novo = await page.request.post(`${BACKEND}/tipo_conta/`, {
				data: { descricao_conta: 'PW Massa Tipo', natureza_conta: 'Debito', observacao: null },
				headers: auth,
			});
			idTipo = (await novo.json()).id_tipo_conta;
			criados.tipo = idTipo;
		}

		// Dois clifors distintos (massa exige 2+ destinatários).
		const idsClifor = [];
		for (const [i, nome] of [NOME_A, NOME_B].entries()) {
			const res = await page.request.post(`${BACKEND}/cliente_fornecedor/`, {
				data: {
					nome,
					pessoafisica_juridica: true,
					cpf_cnpj: cpfUnico(i),
					rg_inscricaoestadual: '123456789',
					datanascimento: '1990-01-01',
					tipo_clifor: 'A',
					ativo: true,
				},
				headers: auth,
			});
			expect(res.ok(), `POST /cliente_fornecedor falhou: ${await res.text()}`).toBeTruthy();
			const id = (await res.json()).id_clifor;
			idsClifor.push(id);
			criados.clifors.push(id);
		}

		// Lançamento em massa.
		const res = await page.request.post(`${BACKEND}/lancamento/massa`, {
			data: {
				id_usuario_fk_lancamento: idUsuario,
				ids_clifor: idsClifor,
				id_tipo_conta_fk: idTipo,
				valor: '150.00',
				data_vencimento: '2099-12-31',
				natureza_lancamento: 'Debito',
			},
			headers: auth,
		});
		expect(res.ok(), `POST /lancamento/massa falhou: ${await res.text()}`).toBeTruthy();
		const data = await res.json();
		expect(data.total_criados).toBe(2);
		expect(data.lote).not.toBeNull();
		criados.lancamentos = data.ids;
		await page.close();
	});

	test.afterAll(async ({ browser }) => {
		const page = await browser.newPage();
		await page.goto('http://localhost:5173/');
		await injetarSessao(page, 'admin');
		const auth = await authHeaders(page);
		for (const id of criados.lancamentos) {
			await page.request.delete(`${BACKEND}/lancamento/${id}`, { headers: auth });
		}
		for (const id of criados.clifors) {
			await page.request.delete(`${BACKEND}/cliente_fornecedor/${id}`, { headers: auth });
		}
		if (criados.tipo) {
			await page.request.delete(`${BACKEND}/tipo_conta/${criados.tipo}`, { headers: auth });
		}
		await page.close();
	});

	test('chip "Em Lote" abre o modal do lote com os lançamentos', async ({ pageAdmin }) => {
		await pageAdmin.goto('/lancamentos');
		const linha = pageAdmin.locator('tr', { hasText: NOME_A });
		await expect(linha).toBeVisible({ timeout: 8000 });

		await linha.getByTitle('Ver lançamentos deste lote').click();

		const modalLote = pageAdmin.locator('.popup-overlay');
		await expect(modalLote.getByRole('heading', { name: /Lançamentos do Lote/ })).toBeVisible();
		await expect(modalLote.getByText(NOME_A)).toBeVisible();
		await expect(modalLote.getByText(NOME_B)).toBeVisible();
	});

	test('Efetivar já vem com a Data de Pagamento preenchida com hoje', async ({ pageAdmin }) => {
		await pageAdmin.goto('/lancamentos');
		const linha = pageAdmin.locator('tr', { hasText: NOME_A });
		await expect(linha).toBeVisible({ timeout: 8000 });

		await linha.getByTitle('Efetivar lançamento').click();

		const modalEfetivar = pageAdmin.locator('.ll-modal--duplo');
		await expect(modalEfetivar.getByRole('heading', { name: 'Efetivar Lançamento' })).toBeVisible();
		await expect(modalEfetivar.locator('input[name="data_pagamento"]')).toHaveValue(hojeLocal());
	});

	test('regressão z-index: lote aberto de dentro do Efetivar fica por cima', async ({ pageAdmin }) => {
		await pageAdmin.goto('/lancamentos');
		const linha = pageAdmin.locator('tr', { hasText: NOME_A });
		await expect(linha).toBeVisible({ timeout: 8000 });

		await linha.getByTitle('Efetivar lançamento').click();
		const modalEfetivar = pageAdmin.locator('.ll-modal--duplo');
		await expect(modalEfetivar).toBeVisible();

		// Chip de origem DENTRO do modal de detalhe → abre o lote por cima.
		await modalEfetivar.getByTitle('Ver lançamentos deste lote').click();

		const modalLote = pageAdmin.locator('.popup-overlay');
		await expect(modalLote.getByRole('heading', { name: /Lançamentos do Lote/ })).toBeVisible();

		// Se o lote estiver POR CIMA, o ✕ dele recebe o clique (não é interceptado pelo
		// modal de efetivar). Se a regressão voltasse, o Playwright falharia este clique
		// por "element is not receiving pointer events". É o teste direto da regressão.
		await modalLote.locator('.lm-fechar').click();
		await expect(modalLote.getByRole('heading', { name: /Lançamentos do Lote/ })).toHaveCount(0);
	});
});
