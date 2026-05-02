import { useState } from "react";
import "../styles/clientRegister.css";

function ClientRegister() {
  const [form, setForm] = useState({
    tipo: "",
    nome: "",
    documento: "",
    obs: "",
    emails: [{ email: "", principal: true }],
    telefones: [{ numero: "", principal: true }],
    enderecos: [
      {
        rua: "",
        numero: "",
        complemento: "",
        estado: "",
        cidade: "",
        principal: true,
      },
    ],
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 📞 FORMATADOR
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

  const limparTelefone = (tel) => tel.replace(/\D/g, "");

  // ✅ HELPERS de validação para liberar o botão +
  const ultimoTelefonePreenchido = () => {
    const ultimo = form.telefones[form.telefones.length - 1];
    return limparTelefone(ultimo.numero).length >= 10;
  };

  const ultimoEmailPreenchido = () => {
    const ultimo = form.emails[form.emails.length - 1];
    return ultimo.email.trim() !== "";
  };

  const ultimoEnderecoPreenchido = () => {
    const ultimo = form.enderecos[form.enderecos.length - 1];
    return ultimo.rua.trim() !== "";
  };

  // 📞 TELEFONES
  const handleTelefoneChange = (index, value) => {
    const novos = [...form.telefones];
    novos[index].numero = formatTelefone(value);
    setForm({ ...form, telefones: novos });
  };

  const setTelefonePrincipal = (index) => {
    // Move o favorito para o início
    const novos = form.telefones.map((tel, i) => ({
      ...tel,
      principal: i === index,
    }));
    const [favorito] = novos.splice(index, 1);
    setForm({ ...form, telefones: [favorito, ...novos] });
  };

  const addTelefone = () => {
    setForm({
      ...form,
      telefones: [...form.telefones, { numero: "", principal: false }],
    });
  };

  const removeTelefone = (index) => {
    const novos = form.telefones.filter((_, i) => i !== index);
    setForm({ ...form, telefones: novos });
  };

  // 📧 EMAILS
  const handleEmailChange = (index, value) => {
    const novos = [...form.emails];
    novos[index].email = value;
    setForm({ ...form, emails: novos });
  };

  const setEmailPrincipal = (index) => {
    const novos = form.emails.map((e, i) => ({ ...e, principal: i === index }));
    const [favorito] = novos.splice(index, 1);
    setForm({ ...form, emails: [favorito, ...novos] });
  };

  const addEmail = () => {
    setForm({
      ...form,
      emails: [...form.emails, { email: "", principal: false }],
    });
  };

  const removeEmail = (index) => {
    const novos = form.emails.filter((_, i) => i !== index);
    setForm({ ...form, emails: novos });
  };

  // 🏠 ENDEREÇOS
  const handleEnderecoChange = (index, field, value) => {
    const novos = [...form.enderecos];
    novos[index][field] = value;
    setForm({ ...form, enderecos: novos });
  };

  const setEnderecoPrincipal = (index) => {
    const novos = form.enderecos.map((end, i) => ({
      ...end,
      principal: i === index,
    }));
    const [favorito] = novos.splice(index, 1);
    setForm({ ...form, enderecos: [favorito, ...novos] });
  };

  const addEndereco = () => {
    setForm({
      ...form,
      enderecos: [
        ...form.enderecos,
        {
          rua: "",
          numero: "",
          complemento: "",
          estado: "",
          cidade: "",
          principal: false,
        },
      ],
    });
  };

  const removeEndereco = (index) => {
    const novos = form.enderecos.filter((_, i) => i !== index);
    setForm({ ...form, enderecos: novos });
  };

  // 🚀 SUBMIT
  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      telefones: form.telefones.map((t) => ({
        numero: limparTelefone(t.numero),
        principal: t.principal,
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
          <h4>Informações Básicas</h4>

          <input
            className="form-control mb-2"
            placeholder="Nome"
            name="nome"
            onChange={handleChange}
          />

          {/* TELEFONES */}
          <h4>Telefones</h4>

          {form.telefones.map((tel, index) => (
            <div key={index} className="d-flex align-items-end gap-2 mb-2">
              <input
                className="form-control"
                placeholder="(11) 91234-5678"
                value={tel.numero}
                onChange={(e) => handleTelefoneChange(index, e.target.value)}
              />

              <button
                type="button"
                className={`btn btn-sm icon-btn ${
                  tel.principal ? "btn-success" : "btn-outline-secondary"
                }`}
                onClick={() => setTelefonePrincipal(index)}
              >
                <i className="bi bi-star-fill"></i>
              </button>

              {index > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger icon-btn"
                  onClick={() => removeTelefone(index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}

          {/* Botão + só aparece se o último telefone estiver preenchido */}
          {ultimoTelefonePreenchido() && (
            <div className="text-center mt-1">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary icon-btn"
                onClick={addTelefone}
              >
                <i className="bi bi-plus"></i>
              </button>
            </div>
          )}

          {/* EMAIL */}
          <h4 className="mt-3">Emails</h4>

          {form.emails.map((e, index) => (
            <div key={index} className="d-flex align-items-end gap-2 mb-2">
              <input
                className="form-control"
                placeholder="email@email.com"
                value={e.email}
                onChange={(ev) => handleEmailChange(index, ev.target.value)}
              />

              <button
                type="button"
                className={`btn btn-sm icon-btn ${
                  e.principal ? "btn-success" : "btn-outline-secondary"
                }`}
                onClick={() => setEmailPrincipal(index)}
              >
                <i className="bi bi-star-fill"></i>
              </button>

              {index > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger icon-btn"
                  onClick={() => removeEmail(index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}

          {/* Botão + só aparece se o último email estiver preenchido */}
          {ultimoEmailPreenchido() && (
            <div className="text-center mt-1">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary icon-btn"
                onClick={addEmail}
              >
                <i className="bi bi-plus"></i>
              </button>
            </div>
          )}

          {/* ENDEREÇOS */}
          <h4 className="mt-3">Endereços</h4>

          {form.enderecos.map((end, index) => (
            <div key={index} className="box-endereco mb-3">
              <div className="d-flex justify-content-between mb-2">
                <span>Endereço {index + 1}</span>

                <div className="d-flex gap-1">
                  <button
                    type="button"
                    className={`btn btn-sm icon-btn ${
                      end.principal ? "btn-success" : "btn-outline-secondary"
                    }`}
                    onClick={() => setEnderecoPrincipal(index)}
                  >
                    <i className="bi bi-star-fill"></i>
                  </button>

                  {index > 0 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger icon-btn"
                      onClick={() => removeEndereco(index)}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  )}
                </div>
              </div>

              <input
                className="form-control mb-2"
                placeholder="Rua"
                value={end.rua}
                onChange={(e) =>
                  handleEnderecoChange(index, "rua", e.target.value)
                }
              />

              <div className="d-flex gap-2 mb-2">
                <input
                  className="form-control"
                  placeholder="Número"
                  value={end.numero}
                  onChange={(e) =>
                    handleEnderecoChange(index, "numero", e.target.value)
                  }
                />
                <input
                  className="form-control"
                  placeholder="Complemento"
                  value={end.complemento}
                  onChange={(e) =>
                    handleEnderecoChange(index, "complemento", e.target.value)
                  }
                />
              </div>

              <div className="d-flex gap-2">
                <input
                  className="form-control"
                  placeholder="Estado"
                  value={end.estado}
                  onChange={(e) =>
                    handleEnderecoChange(index, "estado", e.target.value)
                  }
                />
                <input
                  className="form-control"
                  placeholder="Cidade"
                  value={end.cidade}
                  onChange={(e) =>
                    handleEnderecoChange(index, "cidade", e.target.value)
                  }
                />
              </div>
            </div>
          ))}

          {/* Botão + só aparece se o último endereço tiver rua preenchida */}
          {ultimoEnderecoPreenchido() && (
            <div className="text-center mt-1">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary icon-btn"
                onClick={addEndereco}
              >
                <i className="bi bi-plus"></i>
              </button>
            </div>
          )}

          <br />

          <button className="btn btn-dark w-100" type="submit">
            Salvar
          </button>
        </form>
      </div>
    </div>
  );
}

export default ClientRegister;