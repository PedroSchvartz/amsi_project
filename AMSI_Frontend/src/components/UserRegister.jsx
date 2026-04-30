import { useState } from "react";
import { Navigate } from "react-router-dom";
import "../styles/userregister.css";
import { createUser } from "../services/api";
import { isAdmin } from "../services/auth";

function UserRegister() {
  // 🔐 bloqueia acesso se não for admin
  if (!isAdmin()) {
    return <Navigate to="/home" />;
  }

  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    cargo: "",
    perfil: "",
  });

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setErro("");
    setSucesso("");

    try {
      await createUser({
        login: form.email, // 🔥 importante
        senha: form.senha,
        nome: form.nome,
        email: form.email,
        cargo: form.cargo,
        perfil: form.perfil, // 🔥 corrigido
      });

      setSucesso("Usuário cadastrado com sucesso!");

      // limpa formulário
      setForm({
        nome: "",
        email: "",
        senha: "",
        cargo: "",
        perfil: "",
      });

    } catch (err) {
      console.log(err);
      setErro(err.message || "Erro ao cadastrar usuário");
    }
  };

  return (
    <div className="container">
      <div className="box">
        <h2>Cadastro de Usuários</h2>

        <form onSubmit={handleSubmit}>
          <label>Nome Completo</label>
          <input
            name="nome"
            value={form.nome}
            onChange={handleChange}
            required
          />

          <label>Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <label>Senha</label>
          <input
            type="password"
            name="senha"
            value={form.senha}
            onChange={handleChange}
            required
          />

          <label>Cargo</label>
          <select
            name="cargo"
            value={form.cargo}
            onChange={handleChange}
            required
          >
            <option value="">Selecione</option>
            <option value="Diretor">Diretor</option>
            <option value="Tesoureiro">Tesoureiro</option>
            <option value="Secretario">Secretário</option>
          </select>

          <label>Perfil de Acesso</label>
          <select
            name="perfil"
            value={form.perfil}
            onChange={handleChange}
            required
          >
            <option value="">Selecione</option>
            <option value="ADMIN">Administrador</option>
            <option value="USER">Usuário</option>
          </select>

          <div className="buttons">
            <button
              type="button"
              className="cancel"
              onClick={() =>
                setForm({
                  nome: "",
                  email: "",
                  senha: "",
                  cargo: "",
                  perfil: "",
                })
              }
            >
              Cancelar
            </button>

            <button type="submit" className="save">
              Salvar
            </button>
          </div>
        </form>

        {/* 🔥 feedback */}
        {erro && <p className="erro">{erro}</p>}
        {sucesso && <p className="sucesso">{sucesso}</p>}
      </div>
    </div>
  );
}

export default UserRegister;