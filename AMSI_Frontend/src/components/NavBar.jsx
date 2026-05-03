import { Link, useNavigate } from 'react-router-dom';
import { getUserFromToken, logout, isAdmin } from '../services/auth';
import { logoutUser } from '../services/api';

function Navbar() {
	const navigate = useNavigate();
	const payload = getUserFromToken();
	const usuarioLocal = JSON.parse(localStorage.getItem('user') || 'null');
	const nomeExibido = usuarioLocal?.nome || payload?.sub || 'Usuário';

	const handleSair = async () => {
		try {
			await logoutUser();
		} catch {}
		logout();
		navigate('/');
	};

	return (
		<nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm px-4">
			<div className="container-fluid">
				<Link className="navbar-brand fw-bold" to="/home">
					AMSI Project
				</Link>

				{isAdmin() && (
					<>
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
								<li className="nav-item">
									<Link className="nav-link" to="/usuarios">
										Usuários
									</Link>
								</li>
								<li className="nav-item">
									<Link className="nav-link" to="/cadastro">
										Cadastrar
									</Link>
								</li>
								<li className="nav-item">
									<Link className="nav-link" to="/lancamento">
										Lançamentos
									</Link>
								</li>
								<li className="nav-item">
									<Link className="nav-link" to="/cliente_fornecedor">
										Clientes / Fornecedores
									</Link>
								</li>
							</ul>

							<div className="d-flex align-items-center gap-3 ms-auto">
								<span className="text-light small" style={{ whiteSpace: 'nowrap' }}>
									{nomeExibido}
								</span>
								<button className="btn btn-outline-light btn-sm" onClick={handleSair}>
									Sair
								</button>
							</div>
						</div>
					</>
				)}
			</div>
		</nav>
	);
}

export default Navbar;
