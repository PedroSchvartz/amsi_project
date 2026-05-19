import { Navigate } from "react-router-dom";
import { isAuthenticated, hasPerfilMinimo } from "../services/auth";
import NotFoundPage from "../pages/NotFoundPage";

function PrivateRoute({ children, adminOnly = false, minPerfil = null }) {
  if (!isAuthenticated()) return <Navigate to="/" />;
  if (adminOnly && !hasPerfilMinimo('Administrador')) return <NotFoundPage />;
  if (minPerfil && !hasPerfilMinimo(minPerfil)) return <NotFoundPage />;
  return children;
}

export default PrivateRoute;