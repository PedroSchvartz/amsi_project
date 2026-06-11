/**
 * Testes unitários para src/components/PrivateRoute.jsx
 * Verifica os 3 comportamentos do guard: redirect (sem auth),
 * NotFound (perfil insuficiente) e render (acesso concedido).
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PrivateRoute from '../components/PrivateRoute';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeToken(payload) {
	const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const body   = btoa(JSON.stringify(payload));
	return `${header}.${body}.fake-sig`;
}

function setAuth(perfil) {
	const token = makeToken({ perfil, exp: Math.floor(Date.now() / 1000) + 3600 });
	localStorage.setItem('token', token);
	localStorage.setItem('expiresAt', String(Date.now() + 3_600_000));
}

function renderRota(element, initialPath = '/protegida') {
	return render(
		<MemoryRouter initialEntries={[initialPath]}>
			<Routes>
				<Route path="/" element={<div>Login Page</div>} />
				<Route path="/protegida" element={element} />
			</Routes>
		</MemoryRouter>
	);
}

// ─── sem autenticação ─────────────────────────────────────────────────────────

describe('PrivateRoute — sem autenticação', () => {
	it('redireciona para / quando não há token', () => {
		renderRota(
			<PrivateRoute>
				<div>Conteúdo protegido</div>
			</PrivateRoute>
		);
		expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
		expect(screen.getByText('Login Page')).toBeInTheDocument();
	});
});

// ─── acesso concedido ─────────────────────────────────────────────────────────

describe('PrivateRoute — acesso concedido', () => {
	it('renderiza filho quando autenticado (sem restrição de perfil)', () => {
		setAuth('Consulta');
		renderRota(
			<PrivateRoute>
				<div>Área geral</div>
			</PrivateRoute>
		);
		expect(screen.getByText('Área geral')).toBeInTheDocument();
	});

	it('adminOnly: Admin pode acessar', () => {
		setAuth('Administrador');
		renderRota(
			<PrivateRoute adminOnly>
				<div>Área admin</div>
			</PrivateRoute>
		);
		expect(screen.getByText('Área admin')).toBeInTheDocument();
	});

	it('minPerfil=Operador: Operador pode acessar', () => {
		setAuth('Operador');
		renderRota(
			<PrivateRoute minPerfil="Operador">
				<div>Área operador</div>
			</PrivateRoute>
		);
		expect(screen.getByText('Área operador')).toBeInTheDocument();
	});

	it('minPerfil=Operador: Admin também pode acessar', () => {
		setAuth('Administrador');
		renderRota(
			<PrivateRoute minPerfil="Operador">
				<div>Área operador+</div>
			</PrivateRoute>
		);
		expect(screen.getByText('Área operador+')).toBeInTheDocument();
	});

	it('minPerfil=Consulta: qualquer perfil pode acessar', () => {
		for (const perfil of ['Consulta', 'Operador', 'Administrador']) {
			localStorage.clear();
			setAuth(perfil);
			const { unmount } = renderRota(
				<PrivateRoute minPerfil="Consulta">
					<div>Área {perfil}</div>
				</PrivateRoute>
			);
			expect(screen.getByText(`Área ${perfil}`)).toBeInTheDocument();
			unmount();
		}
	});
});

// ─── acesso negado ────────────────────────────────────────────────────────────

describe('PrivateRoute — acesso negado (perfil insuficiente)', () => {
	it('adminOnly: Consulta recebe NotFound', () => {
		setAuth('Consulta');
		renderRota(
			<PrivateRoute adminOnly>
				<div>Área admin</div>
			</PrivateRoute>
		);
		expect(screen.queryByText('Área admin')).not.toBeInTheDocument();
		// NotFoundPage renderiza algum conteúdo — pelo menos não é a página protegida
	});

	it('adminOnly: Operador recebe NotFound', () => {
		setAuth('Operador');
		renderRota(
			<PrivateRoute adminOnly>
				<div>Área admin</div>
			</PrivateRoute>
		);
		expect(screen.queryByText('Área admin')).not.toBeInTheDocument();
	});

	it('minPerfil=Operador: Consulta recebe NotFound', () => {
		setAuth('Consulta');
		renderRota(
			<PrivateRoute minPerfil="Operador">
				<div>Área operador</div>
			</PrivateRoute>
		);
		expect(screen.queryByText('Área operador')).not.toBeInTheDocument();
	});

	it('minPerfil=Administrador: Operador recebe NotFound', () => {
		setAuth('Operador');
		renderRota(
			<PrivateRoute minPerfil="Administrador">
				<div>Área admin</div>
			</PrivateRoute>
		);
		expect(screen.queryByText('Área admin')).not.toBeInTheDocument();
	});
});
