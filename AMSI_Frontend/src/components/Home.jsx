import '../styles/home.css';
import { Link } from 'react-router-dom';
import { isAdmin } from '../services/auth';

function Home() {
	const admin = isAdmin();

	return (
		<div className="bg-light min-vh-100">
			{/* CONTEÚDO */}
			<div className="container py-5">
				<div className="row g-4">
					{/* CARD 1 */}
					<div className="col-md-4">
						<div className="card shadow-sm border-0 rounded-4 h-100">
							<div className="card-body">
								<h5 className="card-title">Dashboard</h5>
								<p className="card-text">Visualize dados e métricas do sistema.</p>
								<Link to="/dashboard/" className="btn btn-dark w-100">
									Alterar dashboard
								</Link>
							</div>
						</div>
					</div>

					{/* CARD ADMIN - LANÇAMENTO */}
					{admin && (
						<div className="col-md-4">
							<div className="card shadow-sm border-0 rounded-4 h-100">
								<div className="card-body">
									<h5 className="card-title">Novo Lançamento</h5>
									<p className="card-text">Cadastre um novo lançamento financeiro.</p>
									<Link to="/lancamento" className="btn btn-dark w-100">
										Cadastrar Lançamento
									</Link>
								</div>
							</div>
						</div>
					)}

					{/* CLIENTES */}
					<div className="col-md-4">
						<div className="card shadow-sm border-0 rounded-4 h-100">
							<div className="card-body">
								<h5 className="card-title">Clientes / Fornecedores</h5>
								<p className="card-text">Gerencie os clientes e fornecedores cadastrados.</p>
								<Link to="/cliente_fornecedor" className="btn btn-dark w-100">
									Ver lista
								</Link>
							</div>
						</div>
					</div>

					{/* USUÁRIOS */}
					<div className="col-md-4">
						<div className="card shadow-sm border-0 rounded-4 h-100">
							<div className="card-body">
								<h5 className="card-title">Usuários</h5>
								<p className="card-text">Gerencie os usuários do sistema.</p>
								<Link to="/usuarios" className="btn btn-dark w-100">
									Ver lista
								</Link>
							</div>
						</div>
					</div>

					{/* CARD ADMIN - CADASTRO */}
					{admin && (
						<div className="col-md-4">
							<div className="card shadow-sm border-0 rounded-4 h-100">
								<div className="card-body">
									<h5 className="card-title">Cadastrar Usuário</h5>
									<p className="card-text">Adicione novos usuários ao sistema.</p>
									<Link to="/cadastro" className="btn btn-dark w-100">
										Cadastrar Usuário
									</Link>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default Home;
