import { useState } from "react";
import "../styles/clientRegister.css";

function ClientRegister() {
  const [form, setForm] = useState({
    tipo: "",
    nome: "",
    documento: "",
    email: "",
    obs: "",
    telefones: [{ numero: "" }],
    enderecos: [{ rua: "", estado: "", cidade: "" }],
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // 📞 FORMATADOR (visual)
  const formatTelefone = (value) => {
    value = value.replace(/\D/g, "");

    if (value.length <= 10) {
      return value
        .replace(/^(\d{2})(\d)/g, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    } else {
      return value
        .replace(/^(\d{2})(\d)/g, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2");
    }
  };

  // 🔥 LIMPAR PRA API
  const limparTelefone = (tel) => tel.replace(/\D/g, "");

  // 📞 TELEFONES
  const handleTelefoneChange = (index, value) => {
    const novos = [...form.telefones];
    novos[index].numero = formatTelefone(value);
    setForm({ ...form, telefones: novos });
  };

  const addTelefone = () => {
    setForm({
      ...form,
      telefones: [...form.telefones, { numero: "" }],
    });
  };

  const removeTelefone = (index) => {
    const novos = form.telefones.filter((_, i) => i !== index);
    setForm({ ...form, telefones: novos });
  };

  // 🏠 ENDEREÇOS
  const handleEnderecoChange = (index, field, value) => {
    const novos = [...form.enderecos];
    novos[index][field] = value;
    setForm({ ...form, enderecos: novos });
  };

  const addEndereco = () => {
    setForm({
      ...form,
      enderecos: [...form.enderecos, { rua: "", estado: "", cidade: "" }],
    });
  };

  const removeEndereco = (index) => {
    const novos = form.enderecos.filter((_, i) => i !== index);
    setForm({ ...form, enderecos: novos });
  };

  // 🚀 SUBMIT PROFISSIONAL
  const handleSubmit = (e) => {
    e.preventDefault();

    const data = {
      ...form,
      telefones: form.telefones.map((t) => ({
        numero: limparTelefone(t.numero),
      })),
    };

    console.log("ENVIANDO:", data);
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

          {/* INFO */}
          <h4>INFORMAÇÕES BÁSICAS</h4>

          <label>Nome Completo / Razão Social</label>
          <input name="nome" onChange={handleChange} />

          <label>CPF / CNPJ</label>
          <input name="documento" onChange={handleChange} />

          {/* CONTATOS */}
          <h4>CONTATOS</h4>

          {form.telefones.map((tel, index) => (
            <div key={index} className="d-flex align-items-end gap-2 mb-2">
              <div style={{ flex: 1 }}>
                <label>Telefone</label>
                <input
                  placeholder="(11) 91234-5678"
                  value={tel.numero}
                  onChange={(e) => handleTelefoneChange(index, e.target.value)}
                />
              </div>
              {index > 0 &&(
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger p-1"
                  style={{ height: "30px", width: "30px" }}
                  onClick={() => removeTelefone(index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={addTelefone}>
            + Adicionar Telefone
          </button>

          <label>Email</label>
          <input name="email" onChange={handleChange} />

          {/* ENDEREÇOS */}
          <h4>ENDEREÇOS</h4>

          {form.enderecos.map((end, index) => (
            <div key={index} className="box-endereco mb-3">

              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="m-0">Endereço {index + 1}</h6>
                {index > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger p-1"
                    style={{ height: "30px", width: "30px" }}
                    onClick={() => removeEndereco(index)}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                )}
              </div>

              <label>Rua</label>
              <input
                value={end.rua}
                onChange={(e) =>
                  handleEnderecoChange(index, "rua", e.target.value)
                }
              />

              <div className="row">
                <div>
                  <label>Estado</label>
                  <input
                    value={end.estado}
                    onChange={(e) =>
                      handleEnderecoChange(index, "estado", e.target.value)
                    }
                  />
                </div>

                <div>
                  <label>Cidade</label>
                  <input
                    value={end.cidade}
                    onChange={(e) =>
                      handleEnderecoChange(index, "cidade", e.target.value)
                    }
                  />
                </div>
              </div>

            </div>
          ))}

          <button type="button" onClick={addEndereco}>
            + Adicionar Endereço
          </button>

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