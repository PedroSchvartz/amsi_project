import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import { loginUser } from "../services/api.js";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    const data = await loginUser(email, senha);

    const token = data.access_token || data.token;

    if (!token) {
      throw new Error("Token não recebido");
    }

    // 🔐 salva token
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(data));

    // 🧠 tenta pegar expiração real do JWT
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const exp = payload.exp * 1000; // converte para ms

      localStorage.setItem("expiresAt", exp);
    } catch {
      // fallback caso não seja JWT
      const expiresIn = 240 * 240 * 1000; // 1 hora
      const expiresAt = Date.now() + expiresIn;

      localStorage.setItem("expiresAt", expiresAt);
    }

    navigate("/home");
  } catch (err) {
    setErro(err.message || "Erro ao fazer login");
  }
};

  useEffect(() => {
    if (erro) {
      const timer = setTimeout(() => setErro(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [erro]);

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Login</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />

          <button type="submit">Entrar</button>

          {erro && <p style={{ color: "red" }}>{erro}</p>}
        </form>
      </div>
    </div>
  );
}

export default Login;