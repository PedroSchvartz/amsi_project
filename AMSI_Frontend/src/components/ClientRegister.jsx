import { useState } from "react";
import "../styles/clientRegister.css";

function ClientRegister() {
  const [form, setForm] = useState({
    tipo: "",
    nome: "",
    documento: "",
    telefone: "",
    email: "",
    rua: "",
    estado: "",
    cidade: "",
    obs: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(form);
    alert("Cadastro realizado!");
  };

  return (
    <div className="container">
      <div className="box">
        <h2>Cadastro Cliente / Fornecedor</h2>

        <form onSubmit={handleSubmit}>
          {/* TIPO */}
          <div className="tipo">
            <label>
              <input type="radio" name="tipo" value="Cliente" onChange={handleChange} />
              Cliente
            </label>

            <label>
              <input type="radio" name="tipo" value="Fornecedor" onChange={handleChange} />
              Fornecedor
            </label>

            <label>
              <input type="radio" name="tipo" value="Juridica" onChange={handleChange} />
              Jurídica
            </label>
          </div>

          {/* INFORMAÇÕES */}
          <h4>INFORMAÇÕES BÁSICAS</h4>

          <label>Nome Completo / Razão Social</label>
          <input name="nome" onChange={handleChange} />

          <label>CPF / CNPJ</label>
          <input name="documento" onChange={handleChange} />

          {/* CONTATOS */}
          <h4>CONTATOS</h4>

          <div className="row">
            <div>
              <label>Telefone</label>
              <input name="telefone" onChange={handleChange} />
            </div>

            <div>
              <label>Email</label>
              <input name="email" onChange={handleChange} />
            </div>
          </div>

          {/* ENDEREÇO */}
          <h4>ENDEREÇOS</h4>

          <label>Rua</label>
          <input name="rua" onChange={handleChange} />

          <div className="row">
            <div>
              <label>Estado</label>
              <input name="estado" onChange={handleChange} />
            </div>

            <div>
              <label>Cidade</label>
              <input name="cidade" onChange={handleChange} />
            </div>
          </div>

          {/* OBS */}
          <label>Observações</label>
          <textarea name="obs" onChange={handleChange}></textarea>

          {/* BOTÕES */}
          <div className="buttons">
            <button type="button" className="cancel">
              Cancelar
            </button>

            <button type="submit" className="save">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ClientRegister;