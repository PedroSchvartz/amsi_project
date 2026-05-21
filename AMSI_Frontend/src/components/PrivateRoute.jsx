import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated, hasPerfilMinimo } from "../services/auth";
import NotFoundPage from "../pages/NotFoundPage";

function PrivateRoute({ children, adminOnly = false, minPerfil = null }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    const from = location.pathname + location.search;
    return <Navigate to={`/?redirect=${encodeURIComponent(from)}`} replace />;
  }
  if (adminOnly && !hasPerfilMinimo('Administrador')) return <NotFoundPage />;
  if (minPerfil && !hasPerfilMinimo(minPerfil)) return <NotFoundPage />;
  return children;
}

export default PrivateRoute;