import { useEffect, useState } from "react";
import { deleteUser, getUsers, updateUser, resetarSenhaUsuario } from "../services/api.js";
import "../styles/userList.css";

function UserList() {
  const [usuarios, setUsuarios] = useState([]);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [formModal, setFormModal] = useState({
    nome: "",
    email: "",
    cargo: "",
    perfil_de_acesso: "",
  });
  const [sucesso, setSucesso] = useState("");
  const [erroModal, setErroModal] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsuarios(data);
    } catch (err) {
      setErro("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (user) => {
    setUsuarioSelecionado(user);
    setFormModal({
      nome: user.nome,
      email: user.email,
      cargo: user.cargo,
      perfil_de_acesso: user.perfil_de_acesso,
    });
    setErroModal("");
    setSucesso("");
    setModalAberto(true);
  };

  const handleFecharModal = () => {
    setModalAberto(false);
    setUsuarioSelecionado(null);
  };

  const handleChangeModal = (e) => {
    setFormModal({ ...formModal, [e.target.name]: e.target.value });
  };

  const handleSalvar = async () => {
    setErroModal("");
    setSucesso("");
    try {
      await updateUser(usuarioSelecionado.id_usuario, {
        nome: formModal.nome,
        email: formModal.email,
        cargo: formModal.cargo,
        perfil_de_acesso: formModal.perfil_de_acesso,
        notificacao: usuarioSelecionado.notificacao ?? false,
      });
      setSucesso("Usuário atualizado com sucesso!");
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id_usuario === usuarioSelecionado.id_usuario
            ? { ...u, ...formModal }
            : u
        )
      );
      setTimeout(() => {
        handleFecharModal();
      }, 1200);
    } catch (err) {
      setErroModal(err.message || "Erro ao atualizar usuário");
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Deseja excluir este usuário?");
    if (!confirmDelete) return;

    try {
      await deleteUser(id);
      setUsuarios((prev) => prev.filter((u) => u.id_usuario !== id));
    } catch (err) {
      setErro(err.message || "Erro ao excluir usuário");
    }
  };

  // 🔥 resetar senha
  const handleResetSenha = async (id) => {
    const confirmar = window.confirm("Deseja resetar a senha deste usuário? Ele sreá obrigado a criar um nova senha");
    if (!confirmar) return;

    try {
      await resetarSenhaUsuario(id);
      alert("Senha resetada com sucesso! O usuário deverá criar uma senha nova no próximo login");
    } catch (err) {
      setErro(err.message || "Erro ao resetar senha");
    }
  };

  if (loading) return <p>Carregando...</p>;
  if (erro) return <p className="erro">{erro}</p>;

  return (
    <div className="user-list-container">
      <h2>Lista de Usuários</h2>

      <table className="table table-striped">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Login</th>
            <th>Email</th>
            <th>Cargo</th>
            <th>Perfil</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((user) => (
            <tr key={user.id_usuario}>
              <td>{user.nome}</td>
              <td>{user.login || user.email}</td>
              <td>{user.email}</td>
              <td>{user.cargo}</td>
              <td>{user.perfil_de_acesso}</td>
              <td className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => handleEdit(user)}
                  title="Editar"
                >
                  <i className="bi bi-pencil"></i>
                </button>

                {/* 🔥 botão resetar senha */}
                <button
                  className="btn btn-sm btn-outline-warning"
                  onClick={() => handleResetSenha(user.id_usuario)}
                  title="Resetar senha"
                >
                  <i className="bi bi-key"></i>
                </button>

                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleDelete(user.id_usuario)}
                  title="Excluir"
                >
                  <i className="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL DE EDIÇÃO */}
      {modalAberto && (
        <>
          <div
            className="modal-backdrop fade show"
            onClick={handleFecharModal}
          />
          <div className="modal fade show d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Editar Usuário</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={handleFecharModal}
                  />
                </div>

                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nome Completo</label>
                    <input
                      className="form-control"
                      name="nome"
                      value={formModal.nome}
                      onChange={handleChangeModal}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      name="email"
                      value={formModal.email}
                      onChange={handleChangeModal}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Cargo</label>
                    <select
                      className="form-select"
                      name="cargo"
                      value={formModal.cargo}
                      onChange={handleChangeModal}
                    >
                      <option value="">Selecione</option>
                      <option value="Diretor">Diretor</option>
                      <option value="Tesoureiro">Tesoureiro</option>
                      <option value="Secretário">Secretário</option>
                      <option value="Conselheiro">Conselheiro</option>
                      <option value="Associado">Associado</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Perfil de Acesso</label>
                    <select
                      className="form-select"
                      name="perfil_de_acesso"
                      value={formModal.perfil_de_acesso}
                      onChange={handleChangeModal}
                    >
                      <option value="">Selecione</option>
                      <option value="Administrador">Administrador</option>
                      <option value="Consulta">Consulta</option>
                    </select>
                  </div>

                  {erroModal && <p className="text-danger">{erroModal}</p>}
                  {sucesso && <p className="text-success">{sucesso}</p>}
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={handleFecharModal}
                  >
                    Cancelar
                  </button>
                  <button className="btn btn-primary" onClick={handleSalvar}>
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default UserList;