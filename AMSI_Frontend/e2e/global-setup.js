/**
 * global-setup.js — Gate de segurança + snapshot do banco (espelho do db_snapshot).
 *
 * Roda UMA VEZ antes de toda a suíte E2E. Aborta tudo se:
 *   1. O backend alvo não for localhost (também travado em fixtures.js).
 *   2. O APP_ENV do backend não for "development" nem "demo" (produção NUNCA).
 *   3. Algum arquivo .env do Vite apontar VITE_API_URL para fora de localhost
 *      (o webServer do Playwright força localhost, mas um dev server reaproveitado
 *      usaria o valor do arquivo — então validamos o arquivo também).
 *
 * Depois grava um snapshot (contagens de tabelas via API + ids de login dos
 * usuários seed) em .e2e-state.json para o global-teardown comparar e limpar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONT_DIR = path.resolve(__dirname, '..');
const STATE_FILE = path.join(__dirname, '.e2e-state.json');

const BACKEND = process.env.AMSI_BACKEND_URL || 'http://localhost:8000';
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

const ADMIN = {
	email: process.env.AMSI_ADMIN_EMAIL || 'pytest_admin@amsi.com',
	senha: process.env.AMSI_ADMIN_SENHA || 'adminTeste123',
};
const SEED_EMAILS = [
	ADMIN.email,
	process.env.CONSULTA_TESTE_EMAIL || 'pytest_consulta@amsi.com',
	process.env.OPERADOR_TESTE_EMAIL || 'pytest_operador@amsi.com',
];

async function getJson(url, headers = {}) {
	const res = await fetch(url, { headers });
	if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`);
	return res.json();
}

export default async function globalSetup() {
	// ── Trava 1: backend precisa ser local ─────────────────────────────────
	if (!LOCALHOST_RE.test(BACKEND)) {
		throw new Error(
			`[E2E bloqueado] Backend "${BACKEND}" não é localhost. ` +
			`Esta suíte cria e DELETA dados reais.`
		);
	}

	// ── Trava 2: arquivos .env do Vite não podem apontar para fora ─────────
	for (const nome of ['.env', '.env.local', '.env.development', '.env.development.local']) {
		const arquivo = path.join(FRONT_DIR, nome);
		if (!fs.existsSync(arquivo)) continue;
		const conteudo = fs.readFileSync(arquivo, 'utf-8');
		const m = conteudo.match(/^\s*VITE_API_URL\s*=\s*(\S+)/m);
		if (m && !LOCALHOST_RE.test(m[1])) {
			throw new Error(
				`[E2E bloqueado] ${nome} define VITE_API_URL=${m[1]} (não-local). ` +
				`Os testes de UI iriam disparar requisições reais contra esse servidor. ` +
				`Aponte para http://localhost:8000 antes de rodar a suíte.`
			);
		}
	}

	// ── Trava 3: APP_ENV do backend precisa ser development ou demo ────────
	let raiz;
	try {
		raiz = await getJson(`${BACKEND}/`);
	} catch (e) {
		throw new Error(
			`[E2E bloqueado] Backend não respondeu em ${BACKEND}. ` +
			`Suba-o com: cd backend && uvicorn main:app\n(${e.message})`
		);
	}
	const ambiente = raiz.ambiente;
	if (!ambiente) {
		throw new Error(
			`[E2E bloqueado] O backend em ${BACKEND} não informa "ambiente" no GET /. ` +
			`Ele está rodando uma versão antiga do main.py — reinicie o servidor.`
		);
	}
	if (ambiente !== 'development' && ambiente !== 'demo') {
		throw new Error(
			`[E2E bloqueado] APP_ENV do backend é "${ambiente}". ` +
			`A suíte E2E só roda com APP_ENV=development ou demo — nunca em produção.`
		);
	}
	console.log(`[E2E] Backend local OK (APP_ENV=${ambiente})`);

	// ── Snapshot do banco (espelho do db_snapshot do conftest.py) ──────────
	const loginRes = await fetch(`${BACKEND}/auth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(ADMIN),
	});
	if (!loginRes.ok) {
		throw new Error(
			`[E2E bloqueado] Login do admin falhou (${loginRes.status}). ` +
			`Execute o bootstrap: cd backend && python -X utf8 utils/bootstrap.py`
		);
	}
	const { access_token } = await loginRes.json();
	const auth = { Authorization: `Bearer ${access_token}` };

	const [usuarios, clifors, lancamentos, tipos] = await Promise.all([
		getJson(`${BACKEND}/usuarios/`, auth),
		getJson(`${BACKEND}/cliente_fornecedor/`, auth),
		getJson(`${BACKEND}/lancamento/`, auth),
		getJson(`${BACKEND}/tipo_conta/`, auth),
	]);

	// Ids de login pré-existentes dos usuários seed (para limpar só os novos)
	const loginsAntes = {};
	for (const email of SEED_EMAILS) {
		const u = usuarios.find((x) => x.email === email);
		if (!u) continue;
		try {
			const logins = await getJson(`${BACKEND}/login/por-usuario/${u.id_usuario}`, auth);
			loginsAntes[u.id_usuario] = logins.map((l) => l.id_login);
		} catch {
			loginsAntes[u.id_usuario] = [];
		}
	}

	const estado = {
		ambiente,
		contagens: {
			usuario: usuarios.length,
			clientefornecedor: clifors.length,
			lancamento: lancamentos.length,
			tipo_conta: tipos.length,
		},
		loginsAntes,
	};
	fs.writeFileSync(STATE_FILE, JSON.stringify(estado, null, 2));
	console.log(`[E2E] Snapshot do banco gravado:`, estado.contagens);
}
