import { Navigate } from "react-router-dom";
import { isAuthenticated, isConsulta } from "../services/auth";

function PrivateRoute({ children, adminOnly = false }) {
  if (!isAuthenticated()) return <Navigate to="/" />;
  if (adminOnly && isConsulta()) return <Navigate to="/home" />;
  return children;
}

export default PrivateRoute;