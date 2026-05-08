import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './components/Home';
import UserListPage from './pages/UserListPage';
import ClientRegisterPage from './pages/ClientRegisterPage';
import ClientListPage from './pages/ClientListPage';
import ClientEditPage from './pages/ClientEditPage';
import ListaLancamentosPage from './pages/ListaLancamentosPage';
import TrocarSenhaPage from './pages/TrocarSenhaPage';
import 'bootstrap-icons/font/bootstrap-icons.css';

import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import { LoadingProvider, useLoading } from './services/loadingContext';
import { logout } from './services/auth';
import Dashboard from './pages/dashboard';

/* ════════════════════════════════════════
   SPINNER GLOBAL DE CARREGAMENTO
   Corrigido: cor hardcoded #8da87c → var(--primary)
   ════════════════════════════════════════ */
function Spinner() {
	const { carregando } = useLoading();
	if (!carregando) return null;

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				background: 'rgba(0,0,0,0.25)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 9999
			}}
		>
			<div
				style={{
					width: 48,
					height: 48,
					border: '5px solid rgba(255,255,255,0.3)',
					/* Usa variável CSS do tema em vez de cor hardcoded */
					borderTop: '5px solid var(--primary)',
					borderRadius: '50%',
					animation: 'spin 0.7s linear infinite'
				}}
			/>
			<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
		</div>
	);
}

/* ════════════════════════════════════════
   MONITOR DE SESSÃO EXPIRADA
   ════════════════════════════════════════ */
function MonitorSessao() {
	const [expirado, setExpirado] = useState(false);
	const navigate = useNavigate();
	const location = useLocation();
	const intervalRef = useRef(null);

	useEffect(() => {
		const handleExpirado = () => {
			if (location.pathname === '/') return;
			setExpirado(true);
			clearInterval(intervalRef.current);
		};

		window.addEventListener('sessao-expirada', handleExpirado);

		intervalRef.current = setInterval(() => {
			const token = localStorage.getItem('token');
			const expiresAt = localStorage.getItem('expiresAt');
			if (!token || !expiresAt) return;
			if (location.pathname === '/') return;
			if (Date.now() > Number(expiresAt)) {
				window.dispatchEvent(new Event('sessao-expirada'));
			}
		}, 30000);

		return () => {
			window.removeEventListener('sessao-expirada', handleExpirado);
			clearInterval(intervalRef.current);
		};
	}, [location.pathname]);

	const handleFechar = () => {
		setExpirado(false);
		logout();
		navigate('/');
	};

	if (!expirado) return null;

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				background: 'rgba(0,0,0,0.5)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 9998
			}}
		>
			<div
				style={{
					background: 'var(--bg-card)',
					padding: '32px',
					borderRadius: '12px',
					maxWidth: '360px',
					width: '90%',
					textAlign: 'center',
					border: '1px solid var(--border)',
					boxShadow: '0 16px 40px rgba(0,0,0,0.2)'
				}}
			>
				<i
					className="bi bi-shield-lock"
					style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: '12px', display: 'block' }}
				/>
				<h3
					style={{
						fontFamily: 'var(--font-display)',
						fontSize: '1.2rem',
						color: 'var(--text)',
						marginBottom: '8px'
					}}
				>
					Sessão expirada
				</h3>
				<p
					style={{
						fontSize: '0.875rem',
						color: 'var(--text-muted)',
						marginBottom: '24px'
					}}
				>
					Faça login novamente para continuar.
				</p>
				<button
					onClick={handleFechar}
					style={{
						background: 'var(--primary)',
						color: '#fff',
						border: 'none',
						borderRadius: '6px',
						padding: '10px 24px',
						cursor: 'pointer',
						fontWeight: 600,
						fontSize: '0.875rem',
						transition: 'background 0.2s ease'
					}}
				>
					Ir para o Login
				</button>
			</div>
		</div>
	);
}

/* ════════════════════════════════════════
   APP — Roteamento principal
   ════════════════════════════════════════ */
function App() {
	return (
		<LoadingProvider>
			<Spinner />
			<BrowserRouter>
				<MonitorSessao />
				<Routes>
					{/* Página pública */}
					<Route path="/" element={<LoginPage />} />

					{/* Primeiro acesso — sem navbar */}
					<Route
						path="/trocar-senha"
						element={
							<PrivateRoute>
								<TrocarSenhaPage />
							</PrivateRoute>
						}
					/>

					{/* Rotas protegidas — com Layout (topbar + menu + footer) */}
					<Route
						element={
							<PrivateRoute>
								<Layout />
							</PrivateRoute>
						}
					>
						<Route path="/home" element={<HomePage />} />

						<Route
							path="/dashboard"
							element={
								<AdminRoute>
									<Dashboard />
								</AdminRoute>
							}
						/>

						<Route
							path="/usuarios"
							element={
								<PrivateRoute adminOnly>
									<UserListPage />
								</PrivateRoute>
							}
						/>

						<Route
							path="/cliente_fornecedor"
							element={
								<PrivateRoute adminOnly>
									<ClientListPage />
								</PrivateRoute>
							}
						/>

						<Route
							path="/cliente_fornecedor/novo"
							element={
								<PrivateRoute adminOnly>
									<ClientRegisterPage />
								</PrivateRoute>
							}
						/>

						<Route
							path="/cliente_fornecedor/:id/editar"
							element={
								<PrivateRoute adminOnly>
									<ClientEditPage />
								</PrivateRoute>
							}
						/>

						<Route
							path="/tipo_lancamento"
							element={
								<PrivateRoute adminOnly>
									<ListaLancamentosPage />
								</PrivateRoute>
							}
						/>
					</Route>
				</Routes>
			</BrowserRouter>
		</LoadingProvider>
	);
}

export default App;
