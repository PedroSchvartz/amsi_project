import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUserFromToken, logout, isAdmin } from '../services/auth';
import { logoutUser } from '../services/api';
import PerfilPopup from './Perfilpopup';

function Navbar() {
	const navigate = useNavigate();
	const payload = getUserFromToken();
	const usuarioLocal = JSON.parse(localStorage.getItem('user') || 'null');
	const nomeExibido = usuarioLocal?.nome || payload?.sub || 'Usuário';
	const [perfilAberto, setPerfilAberto] = useState(false);
	const admin = isAdmin();

	const handleSair = async () => {
		try {
			await logoutUser();
		} catch {}
		logout();
		navigate('/');
	};

	return (
		<>
			{perfilAberto && <PerfilPopup onFechar={() => setPerfilAberto(false)} />}

			<nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm px-4">
				<div className="container-fluid">
					<Link className="navbar-brand fw-bold" to="/home">
						AMSI Project
					</Link>

					<button
						className="navbar-toggler"
						type="button"
						data-bs-toggle="collapse"
						data-bs-target="#navbarNav"
					>
						<span className="navbar-toggler-icon"></span>
					</button>

					<div className="collapse navbar-collapse" id="navbarNav">
						<ul className="navbar-nav">
							{admin && (
								<li className="nav-item">
									<Link className="nav-link" to="/dashboard">
										Dashboard
									</Link>
								</li>
							)}
							{admin && (
								<li className="nav-item">
									<Link className="nav-link" to="/tipo_lancamento">
										Lista de Lançamentos
									</Link>
								</li>
							)}
							{admin && (
								<li className="nav-item">
									<Link className="nav-link" to="/lancamento">
										Novo Lançamento
									</Link>
								</li>
							)}
							{admin && (
								<li className="nav-item">
									<Link className="nav-link" to="/cliente_fornecedor">
										Clientes / Fornecedores
									</Link>
								</li>
							)}
							{admin && (
								<li className="nav-item">
									<Link className="nav-link" to="/usuarios">
										Usuários
									</Link>
								</li>
							)}
							{admin && (
								<li className="nav-item">
									<Link className="nav-link" to="/cadastro">
										Cadastrar Usuário
									</Link>
								</li>
							)}
						</ul>

						<div className="d-flex align-items-center gap-3 ms-auto">
							<span
								className="text-light small"
								style={{
									whiteSpace: 'nowrap',
									cursor: 'pointer',
									textDecoration: 'underline dotted'
								}}
								onClick={() => setPerfilAberto(true)}
								title="Ver perfil"
							>
								{nomeExibido}
							</span>
							<button className="btn btn-outline-light btn-sm" onClick={handleSair}>
								Sair
							</button>
						</div>
					</div>
				</div>
			</nav>
		</>
	);
}

export default Navbar;
