/**
 * global-teardown.js — Limpeza + verificação de sujeira no banco.
 *
 * Espelho da segunda metade do db_snapshot do conftest.py:
 *   1. Apaga os registros de login criados durante a suíte para os usuários
 *      seed (admin/consulta/operador) — cada login via API cria uma linha.
 *   2. Reconta as tabelas via API e FALHA se alguma contagem divergir do
 *      snapshot inicial ("o banco ficou sujo após os testes").
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '.e2e-state.json');

const BACKEND = process.env.AMSI_BACKEND_URL || 'http://localhost:8000';

const ADMIN = {
	email: process.env.AMSI_ADMIN_EMAIL || 'opedroschvartz@gmail.com',
	senha: process.env.AMSI_ADMIN_SENHA || 'opedro',
};

async function getJson(url, headers = {}) {
	const res = await fetch(url, { headers });
	if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
	return res.json();
}

export default async function globalTeardown() {
	if (!fs.existsSync(STATE_FILE)) return; // setup abortou antes do snapshot
	const estado = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
	fs.unlinkSync(STATE_FILE);

	const loginRes = await fetch(`${BACKEND}/auth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(ADMIN),
	});
	if (!loginRes.ok) {
		console.error('[E2E teardown] Login do admin falhou — limpeza pulada.');
		return;
	}
	const { access_token } = await loginRes.json();
	const auth = { Authorization: `Bearer ${access_token}` };

	// ── 1. Limpar logins novos dos usuários seed ───────────────────────────
	for (const [idUsuario, idsAntes] of Object.entries(estado.loginsAntes)) {
		try {
			const logins = await getJson(`${BACKEND}/login/por-usuario/${idUsuario}`, auth);
			for (const l of logins) {
				if (!idsAntes.includes(l.id_login)) {
					await fetch(`${BACKEND}/login/${l.id_login}`, { method: 'DELETE', headers: auth });
				}
			}
		} catch {
			/* usuário pode não existir mais — ignora */
		}
	}

	// ── 2. Recontar e comparar (falha alto se o banco ficou sujo) ──────────
	const [usuarios, clifors, lancamentos, tipos] = await Promise.all([
		getJson(`${BACKEND}/usuarios/`, auth),
		getJson(`${BACKEND}/cliente_fornecedor/`, auth),
		getJson(`${BACKEND}/lancamento/`, auth),
		getJson(`${BACKEND}/tipo_conta/`, auth),
	]);
	const depois = {
		usuario: usuarios.length,
		clientefornecedor: clifors.length,
		lancamento: lancamentos.length,
		tipo_conta: tipos.length,
	};

	const divergencias = Object.entries(estado.contagens)
		.filter(([tabela, antes]) => antes !== depois[tabela])
		.map(([tabela, antes]) => `  ${tabela}: antes=${antes}, depois=${depois[tabela]} (diff=${depois[tabela] - antes >= 0 ? '+' : ''}${depois[tabela] - antes})`);

	if (divergencias.length > 0) {
		throw new Error(
			`O banco ficou sujo após os testes E2E. Tabelas com contagem diferente:\n` +
			divergencias.join('\n')
		);
	}
	console.log('[E2E] Banco limpo — contagens idênticas ao snapshot inicial.');
}
