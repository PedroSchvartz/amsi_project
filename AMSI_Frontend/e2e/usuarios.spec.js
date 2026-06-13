/**
 * usuarios.spec.js — CRUD de usuários (rota adminOnly)
 *
 * Espelho de test_usuarios.py: cria pela UI, lista, exclui pela UI.
 * Inclui o teste da regra de segurança "apenas Desenvolvedor cadastra
 * Desenvolvedor" — exercitada com um admin comum criado via /demo/registro
 * quando o backend está em modo demo.
 *
 * Limpeza: hard delete (cascade) via API — espelho do _limpar_usuario_demo.
 */

import { test, expect, BACKEND, authHeaders, injetarSessao } from './fixtures.js';

const EMAIL_TESTE = `pw_e2e_${Date.now()}@playwright.amsi.com`;
const NOME_TESTE  = 'Usuário Playwright E2E';

async function hardDeletePorEmail(page, email) {
	const auth = await authHeaders(page);
	const res = await page.request.get(`${BACKEND}/usuarios/?incluir_excluidos=True`, { headers: auth });
	if (!res.ok()) return;
	for (const u of await res.json()) {
		if (u.email === email) {
			await page.request.delete(`${BACKEND}/usuarios/${u.id_usuario}/hard`, { headers: auth });
		}
	}
}

test.describe('Usuários — CRUD (admin)', () => {
	test.afterEach(async ({ pageAdmin }) => {
		await hardDeletePorEmail(pageAdmin, EMAIL_TESTE);
	});

	test('página de usuários lista o admin', async ({ pageAdmin }) => {
		await pageAdmin.goto('/usuarios');
		await expect(pageAdmin.getByText('opedroschvartz@gmail.com').first()).toBeVisible({ timeout: 8000 });
	});

	test('cadastrar novo usuário pela UI', async ({ pageAdmin }) => {
		await pageAdmin.goto('/usuarios');
		await pageAdmin.getByRole('button', { name: 'Novo Usuário' }).click();

		// Formulário do UserRegisterModal (inputs com atributo name)
		await pageAdmin.locator('input[name="nome"]').fill(NOME_TESTE);
		await pageAdmin.locator('input[name="email"]').fill(EMAIL_TESTE);
		await pageAdmin.locator('select[name="cargo"]').selectOption('Associado');
		await pageAdmin.locator('select[name="perfil_de_acesso"]').selectOption('Consulta');
		await pageAdmin.getByRole('button', { name: 'Salvar' }).click();

		await expect(
			pageAdmin.getByText('Usuário cadastrado com sucesso!')
		).toBeVisible({ timeout: 8000 });
	});

	test('usuário criado aparece na lista', async ({ pageAdmin }) => {
		// Cria via API (a UI de criação já foi exercitada no teste anterior)
		const auth = await authHeaders(pageAdmin);
		const res = await pageAdmin.request.post(`${BACKEND}/usuarios/`, {
			data: {
				nome: NOME_TESTE,
				email: EMAIL_TESTE,
				cargo: 'Associado',
				perfil_de_acesso: 'Consulta',
				notificacao: false,
			},
			headers: auth,
		});
		expect(res.ok()).toBeTruthy();

		await pageAdmin.goto('/usuarios');
		await expect(pageAdmin.getByText(EMAIL_TESTE)).toBeVisible({ timeout: 8000 });
	});

	test('excluir (soft delete) usuário pela UI', async ({ pageAdmin }) => {
		const auth = await authHeaders(pageAdmin);
		await pageAdmin.request.post(`${BACKEND}/usuarios/`, {
			data: { nome: NOME_TESTE, email: EMAIL_TESTE, cargo: 'Associado', perfil_de_acesso: 'Consulta', notificacao: false },
			headers: auth,
		});

		await pageAdmin.goto('/usuarios');
		const linha = pageAdmin.locator('tr').filter({ hasText: EMAIL_TESTE });
		await linha.locator('button[title="Remover usuário"]').click();

		// ModalConfirm: botão "Remover"
		await pageAdmin.getByRole('button', { name: 'Remover' }).click();

		await expect(
			pageAdmin.getByText('Usuário removido com sucesso.')
		).toBeVisible({ timeout: 8000 });
		await expect(pageAdmin.locator('tr').filter({ hasText: EMAIL_TESTE })).toHaveCount(0);
	});
});

test.describe('Usuários — regra Desenvolvedor', () => {
	const EMAIL_ADMIN_COMUM = `pw_admin_comum_${Date.now()}@playwright.amsi.com`;
	const SENHA_ADMIN_COMUM = 'senhaPwTeste123';

	test.afterEach(async ({ pageAdmin }) => {
		await hardDeletePorEmail(pageAdmin, EMAIL_ADMIN_COMUM);
		await hardDeletePorEmail(pageAdmin, EMAIL_TESTE);
	});

	test('admin sem cargo Desenvolvedor recebe 403 ao cadastrar Desenvolvedor', async ({ pageAdmin, page }) => {
		// Só executável em modo demo: precisamos criar um admin "comum"
		// (cargo Associado) com senha conhecida, e /demo/registro permite isso.
		const status = await (await page.request.get(`${BACKEND}/demo/status`)).json();
		test.skip(!status.demo_ativo, 'Requer APP_ENV=demo para criar admin comum com senha conhecida');

		const reg = await page.request.post(`${BACKEND}/demo/registro`, {
			data: {
				nome: 'Admin Comum PW',
				email: EMAIL_ADMIN_COMUM,
				senha: SENHA_ADMIN_COMUM,
				cargo: 'Associado',
				perfil_de_acesso: 'Administrador',
			},
		});
		expect(reg.ok()).toBeTruthy();

		// Autentica como o admin comum
		const loginRes = await page.request.post(`${BACKEND}/auth/token`, {
			data: { email: EMAIL_ADMIN_COMUM, senha: SENHA_ADMIN_COMUM },
		});
		expect(loginRes.ok()).toBeTruthy();
		const { access_token } = await loginRes.json();

		// Admin comum tenta cadastrar um Desenvolvedor → 403
		const tentativa = await page.request.post(`${BACKEND}/usuarios/`, {
			data: { nome: 'Dev PW', email: EMAIL_TESTE, cargo: 'Desenvolvedor', perfil_de_acesso: 'Administrador', notificacao: false },
			headers: { Authorization: `Bearer ${access_token}` },
		});
		expect(tentativa.status()).toBe(403);

		// O admin seed (cargo Desenvolvedor) PODE cadastrar Desenvolvedor.
		// Re-login do seed: o login do admin comum não afeta a sessão dele,
		// mas a fixture pageAdmin pode ter sido revogada por logins paralelos —
		// renova por segurança.
		await injetarSessao(pageAdmin, 'admin');
		const authSeed = await authHeaders(pageAdmin);
		const permitida = await pageAdmin.request.post(`${BACKEND}/usuarios/`, {
			data: { nome: 'Dev PW', email: EMAIL_TESTE, cargo: 'Desenvolvedor', perfil_de_acesso: 'Administrador', notificacao: false },
			headers: authSeed,
		});
		expect(permitida.status()).toBe(200);
	});
});

test.describe('Usuários — vínculo com Cliente/Fornecedor (admin)', () => {
	const EMAIL_VINC = `pw_vinc_${Date.now()}@playwright.amsi.com`;
	const NOME_USUARIO_VINC = 'Usuário Vínculo PW';
	const NOME_CLIFOR_VINC = `PW Clifor Vinculo ${Date.now()}`;
	const CPF_VINC = '529.982.247-25'; // CPF que passa na validação de dígitos
	let idCliforVinc = null;

	test.afterEach(async ({ pageAdmin }) => {
		const auth = await authHeaders(pageAdmin);
		if (idCliforVinc) {
			await pageAdmin.request.delete(`${BACKEND}/cliente_fornecedor/${idCliforVinc}`, { headers: auth });
			idCliforVinc = null;
		}
		await hardDeletePorEmail(pageAdmin, EMAIL_VINC);
	});

	test('associar clifor pelo popup propaga o e-mail do usuário ao clifor', async ({ pageAdmin }) => {
		const auth = await authHeaders(pageAdmin);

		// Usuário (Consulta) e clifor livre (sem e-mail), criados via API.
		const ru = await pageAdmin.request.post(`${BACKEND}/usuarios/`, {
			data: { nome: NOME_USUARIO_VINC, email: EMAIL_VINC, cargo: 'Associado', perfil_de_acesso: 'Consulta', notificacao: false },
			headers: auth,
		});
		expect(ru.ok()).toBeTruthy();

		const rc = await pageAdmin.request.post(`${BACKEND}/cliente_fornecedor/`, {
			data: {
				pessoafisica_juridica: true, cpf_cnpj: CPF_VINC, rg_inscricaoestadual: '12.345.678-9',
				nome: NOME_CLIFOR_VINC, datanascimento: '1990-01-01', tipo_clifor: 'C',
			},
			headers: auth,
		});
		expect(rc.ok()).toBeTruthy();
		idCliforVinc = (await rc.json()).id_clifor;

		// Abre o popup Perfil Completo do usuário e associa o clifor pela busca.
		await pageAdmin.goto('/usuarios');
		const linha = pageAdmin.locator('tr').filter({ hasText: EMAIL_VINC });
		await linha.locator('button[title="Ver perfil completo"]').click();
		await expect(pageAdmin.getByRole('heading', { name: /Perfil Completo/ })).toBeVisible({ timeout: 8000 });

		await pageAdmin.getByPlaceholder('Buscar por nome...').fill(NOME_CLIFOR_VINC);
		await pageAdmin.locator('strong', { hasText: NOME_CLIFOR_VINC }).click();
		await pageAdmin.getByRole('button', { name: 'Confirmar' }).click();

		// O clifor passa a aparecer como vinculado no popup.
		await expect(pageAdmin.getByText('Cliente / Fornecedor Vinculado')).toBeVisible({ timeout: 8000 });

		// Regra central: o clifor agora carrega o e-mail do usuário nos contatos (checado via API).
		const verif = await pageAdmin.request.get(`${BACKEND}/cliente_fornecedor/${idCliforVinc}`, { headers: auth });
		const data = await verif.json();
		const emails = (data.contatos || []).filter((c) => c.tipocontato === 'Email').map((c) => c.info_do_contato);
		expect(emails).toContain(EMAIL_VINC);
	});

	test('popup mostra a seção de clifor para usuário não-Consulta (Operador)', async ({ pageAdmin }) => {
		const auth = await authHeaders(pageAdmin);
		const ru = await pageAdmin.request.post(`${BACKEND}/usuarios/`, {
			data: { nome: NOME_USUARIO_VINC, email: EMAIL_VINC, cargo: 'Associado', perfil_de_acesso: 'Operador', notificacao: false },
			headers: auth,
		});
		expect(ru.ok()).toBeTruthy();

		await pageAdmin.goto('/usuarios');
		const linha = pageAdmin.locator('tr').filter({ hasText: EMAIL_VINC });
		await linha.locator('button[title="Ver perfil completo"]').click();
		await expect(pageAdmin.getByRole('heading', { name: /Perfil Completo/ })).toBeVisible({ timeout: 8000 });

		// Antes a seção de clifor só aparecia para perfil Consulta; agora vale para qualquer perfil.
		await expect(pageAdmin.getByText('Nenhum Cliente/Fornecedor vinculado.')).toBeVisible({ timeout: 8000 });
	});
});
