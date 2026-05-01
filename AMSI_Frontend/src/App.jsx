import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import HomePage from "./components/Home";
import UserRegisterPage from "./pages/UserRegisterPage";
import UserListPage from "./pages/UserListPage";
import ClientRegisterPage from "./pages/ClientRegisterPage";
import LancamentoPage from "./pages/LancamentoPage";
import ListaLancamentosPage from "./pages/ListaLancamentosPage";
import "bootstrap-icons/font/bootstrap-icons.css";

import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* pública */}
        <Route path="/" element={<LoginPage />} />

        {/* protegidas */}
        <Route
          path="/home"
          element={
            <PrivateRoute>
              <HomePage />
            </PrivateRoute>
          }
        />

        <Route
          path="/usuarios"
          element={
            <PrivateRoute>
              <UserListPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/cliente_fornecedor"
          element={
            <PrivateRoute>
              <ClientRegisterPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/lancamento"
          element={
            <PrivateRoute>
              <LancamentoPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/tipo_lancamento"
          element={
            <PrivateRoute>
              <ListaLancamentosPage />
            </PrivateRoute>
          }
        />

        {/* 🔐 ADMIN ONLY */}
        <Route
          path="/cadastro"
          element={
            <PrivateRoute>
              <AdminRoute>
                <UserRegisterPage />
              </AdminRoute>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;