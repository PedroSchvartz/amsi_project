/**
 * Testes unitários para src/services/auth.js
 * Espelho dos testes de autenticação do pytest — exercita a lógica pura
 * de decode de token, verificação de sessão e hierarquia de perfis.
 */

import {
	getUserFromToken,
	getPerfil,
	isAuthenticated,
	isAdmin,
	isOperador,
	isConsulta,
	hasPerfilMinimo,
} from '../services/auth';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeToken(payload) {
	// JWT simples sem assinatura real — decodificado via atob() pelo auth.js
	const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const body    = btoa(JSON.stringify(payload));
	const sig     = 'fake-sig';
	return `${header}.${body}.${sig}`;
}

function futureSec(minutes = 60) {
	return Math.floor(Date.now() / 1000) + minutes * 60;
}

function pastSec(minutes = 60) {
	return Math.floor(Date.now() / 1000) - minutes * 60;
}

function setAuth(payload, expiresAtMs = null) {
	const token = makeToken(payload);
	localStorage.setItem('token', token);
	if (expiresAtMs !== null) {
		localStorage.setItem('expiresAt', String(expiresAtMs));
	}
}

// ─── getUserFromToken ────────────────────────────────────────────────────────

describe('getUserFromToken', () => {
	it('retorna payload quando token é válido', () => {
		setAuth({ sub: '1', perfil: 'Administrador', exp: futureSec() });
		const user = getUserFromToken();
		expect(user).not.toBeNull();
		expect(user.perfil).toBe('Administrador');
	});

	it('retorna null quando não há token', () => {
		expect(getUserFromToken()).toBeNull();
	});

	it('retorna null quando token é malformado', () => {
		localStorage.setItem('token', 'nao.e.jwt');
		expect(getUserFromToken()).toBeNull();
	});

	it('retorna null quando payload não é JSON válido', () => {
		localStorage.setItem('token', 'header.!!!.sig');
		expect(getUserFromToken()).toBeNull();
	});
});

// ─── getPerfil ───────────────────────────────────────────────────────────────

describe('getPerfil', () => {
	it('retorna o perfil do token', () => {
		setAuth({ perfil: 'Operador' });
		expect(getPerfil()).toBe('Operador');
	});

	it('retorna null sem token', () => {
		expect(getPerfil()).toBeNull();
	});
});

// ─── isAuthenticated ─────────────────────────────────────────────────────────

describe('isAuthenticated', () => {
	it('true quando token presente e expiresAt no futuro', () => {
		setAuth({ perfil: 'Consulta', exp: futureSec() }, Date.now() + 60_000);
		expect(isAuthenticated()).toBe(true);
	});

	it('false quando expiresAt no passado', () => {
		setAuth({ perfil: 'Consulta', exp: futureSec() }, Date.now() - 1000);
		expect(isAuthenticated()).toBe(false);
	});

	it('fallback para JWT exp quando expiresAt ausente — token válido', () => {
		setAuth({ perfil: 'Consulta', exp: futureSec() });
		expect(isAuthenticated()).toBe(true);
	});

	it('fallback para JWT exp quando expiresAt ausente — token expirado', () => {
		setAuth({ perfil: 'Consulta', exp: pastSec() });
		expect(isAuthenticated()).toBe(false);
	});

	it('false sem token', () => {
		expect(isAuthenticated()).toBe(false);
	});
});

// ─── verificadores de perfil ─────────────────────────────────────────────────

describe('isAdmin / isOperador / isConsulta', () => {
	it.each([
		['Administrador', true, false, false],
		['Operador',      false, true,  false],
		['Consulta',      false, false, true ],
	])('perfil=%s → isAdmin=%s isOperador=%s isConsulta=%s', (perfil, admin, op, con) => {
		setAuth({ perfil });
		expect(isAdmin()).toBe(admin);
		expect(isOperador()).toBe(op);
		expect(isConsulta()).toBe(con);
	});

	it('isAdmin retorna false sem token', () => {
		expect(isAdmin()).toBe(false);
	});
});

// ─── hasPerfilMinimo ─────────────────────────────────────────────────────────

describe('hasPerfilMinimo', () => {
	// Hierarquia: Consulta < Operador < Administrador
	it.each([
		// [perfil atual, perfil requerido, esperado]
		['Administrador', 'Administrador', true ],
		['Administrador', 'Operador',      true ],
		['Administrador', 'Consulta',      true ],
		['Operador',      'Administrador', false],
		['Operador',      'Operador',      true ],
		['Operador',      'Consulta',      true ],
		['Consulta',      'Administrador', false],
		['Consulta',      'Operador',      false],
		['Consulta',      'Consulta',      true ],
	])('%s >= %s → %s', (atual, requerido, esperado) => {
		setAuth({ perfil: atual });
		expect(hasPerfilMinimo(requerido)).toBe(esperado);
	});
});
