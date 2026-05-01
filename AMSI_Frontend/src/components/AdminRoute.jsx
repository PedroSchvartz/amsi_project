import { Navigate } from 'react-router-dom';
import { isAdmin } from '../services/auth';

function AdminRoute({ children }) {
	return isAdmin() ? children : <Navigate to="/home" />;
}

export default AdminRoute;
