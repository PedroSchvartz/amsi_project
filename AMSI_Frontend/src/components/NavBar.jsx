import { Link, useNavigate } from 'react-router-dom';
import { getUserFromToken, logout, isAdmin } from '../services/auth';
import { logoutUser } from '../services/api';

function Navbar() {
  const navigate = useNavigate();
  const usuario = getUserFromToken();
  const admin = isAdmin();

  const handleSair = async () => {
    try {
      await logoutUser();
    } catch {
      // mesmo com erro, limpa sessão local
    }
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm px-4">
      <div className="container-fluid">
        <Link className="navbar-brand fw-bold" to="/home">
          AMSI Project
        </Link>

        {admin && (
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
              <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                <li className="nav-item">
                  <Link className="nav-link" to="/usuarios">Usuários</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/cadastro">Cadastrar</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/lancamento">Lançamentos</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/cliente_fornecedor">Clientes / Fornecedores</Link>
                </li>
              </ul>
            </div>
          </>
        )}

        <div className="d-flex align-items-center gap-3 ms-auto">
          <span className="text-light">{usuario?.nome || usuario?.sub || 'Usuário'}</span>
          <button className="btn btn-outline-light btn-sm" onClick={handleSair}>
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;