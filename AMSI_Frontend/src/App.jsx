import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './components/Home';
import UserRegisterPage from './pages/UserRegisterPage';
import UserListPage from './pages/UserListPage';
import ClientRegisterPage from './pages/ClientRegisterPage';
import LancamentoPage from './pages/LancamentoPage';
import ListaLancamentosPage from './pages/ListaLancamentosPage';
import TrocarSenhaPage from './pages/TrocarSenhaPage';
import 'bootstrap-icons/font/bootstrap-icons.css';

import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import { LoadingProvider, useLoading } from './services/LoadingContext';
import { logout } from './services/auth';
import Dashboard from './pages/dashboard';

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
					border: '5px solid #fff',
					borderTop: '5px solid #8da87c',
					borderRadius: '50%',
					animation: 'spin 0.7s linear infinite'
				}}
			/>
			<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
		</div>
	);
}

function MonitorSessao() {
	const [expirado, setExpirado] = useState(false);
	const navigate = useNavigate();
	const intervalRef = useRef(null);

	useEffect(() => {
		intervalRef.current = setInterval(() => {
			const token = localStorage.getItem('token');
			const expiresAt = localStorage.getItem('expiresAt');
			if (!token || !expiresAt) return;
			if (Date.now() > parseInt(expiresAt)) {
				logout();
				setExpirado(true);
				clearInterval(intervalRef.current);
			}
		}, 10000);

		return () => clearInterval(intervalRef.current);
	}, []);

	const handleFechar = () => {
		setExpirado(false);
		navigate('/');
	};

	if (!expirado) return null;

	return (
		<div
			onClick={handleFechar}
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
				onClick={(e) => e.stopPropagation()}
				style={{
					background: '#fff',
					borderRadius: 12,
					padding: '40px 50px',
					textAlign: 'center',
					boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
					maxWidth: 360
				}}
			>
				<h3 style={{ marginBottom: 10 }}>Sessão expirada</h3>
				<p style={{ color: '#666', marginBottom: 24 }}>
					Sua sessão foi encerrada por inatividade. Faça login novamente para continuar.
				</p>
				<button
					onClick={handleFechar}
					style={{
						background: '#8da87c',
						color: '#fff',
						border: 'none',
						borderRadius: 6,
						padding: '10px 24px',
						cursor: 'pointer',
						fontWeight: 600
					}}
				>
					Ir para o Login
				</button>
			</div>
		</div>
	);
}

function App() {
	return (
		<LoadingProvider>
			<Spinner />
			<BrowserRouter>
				<MonitorSessao />
				<Routes>
					<Route path="/" element={<LoginPage />} />

					{/* primeiro acesso — sem navbar */}
					<Route
						path="/trocar-senha"
						element={
							<PrivateRoute>
								<TrocarSenhaPage />
							</PrivateRoute>
						}
					/>

					{/* protegidas — com navbar via Layout */}
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
									<ClientRegisterPage />
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
						<Route
							path="/lancamento"
							element={
								<AdminRoute>
									<LancamentoPage />
								</AdminRoute>
							}
						/>
						<Route
							path="/cadastro"
							element={
								<AdminRoute>
									<UserRegisterPage />
								</AdminRoute>
							}
						/>
					</Route>
				</Routes>
			</BrowserRouter>
		</LoadingProvider>
	);
}

export default App;
