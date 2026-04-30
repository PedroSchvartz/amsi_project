import { Navigate } from "react-router-dom";

const isAdmin = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  return user?.perfil === "ADMIN";
};

function AdminRoute({ children }) {
  return isAdmin() ? children : <Navigate to="/home" />;
}

export default AdminRoute;