import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

function App() {
	return (
		<LoadingProvider>
			<Spinner />
			<BrowserRouter>
				<Routes>
					{/* pública */}
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
						<Route path="/usuarios" element={<UserListPage />} />
						<Route path="/cliente_fornecedor" element={<ClientRegisterPage />} />
						<Route path="/tipo_lancamento" element={<ListaLancamentosPage />} />

						{/* admin only */}
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
