import { useEffect, useState } from "react";
import { getUsers } from "../services/api.js";
import { useNavigate } from "react-router-dom";
import "../styles/userList.css";

function UserList() {
  const [usuarios, setUsuarios] = useState([]);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);


  const navigate = useNavigate();

  useEffect(() => {
    async function fetchUsers() {
      try {
        const data = await getUsers();
        setUsuarios(data);
      } catch (err) {
        setErro("Erro ao carregar usuários");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  const handleEdit = (user) => {
    navigate(`/usuarios/editar/${user.id_usuario}`);
  };

  const handleDelete = (id) => {
    const confirmDelete = window.confirm("Deseja excluir este usuário?");
    if (!confirmDelete) return;

    console.log("Excluir usuário:", id);
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
                >
                  <i className="bi bi-pencil"></i>
                </button>

                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleDelete(user.id_usuario)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UserList;