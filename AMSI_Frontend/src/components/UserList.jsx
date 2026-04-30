import { useEffect, useState } from "react";
import { getUsers } from "../services/api.js";
import "../styles/userList.css";

function UserList() {
  const [usuarios, setUsuarios] = useState([]);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const data = await getUsers();
        console.log(data);
        setUsuarios(data);
      } catch (err) {
        setErro("Erro ao carregar usuários");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  if (loading) return <p>Carregando...</p>;
  if (erro) return <p className="erro">{erro}</p>;

  return (
    <div className="user-list-container">
      <h2>Lista de Usuários</h2>

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Login</th>
            <th>Email</th>
            <th>Cargo</th>
            <th>Perfil</th>
          </tr>
        </thead>

        <tbody>
          {usuarios.map((user) => (
            <tr key={user.id_usuario}>
              <td>{user.nome}</td>
              <td>{user.email}</td>
              <td>{user.cargo}</td>
              <td>{user.perfil_de_acesso}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UserList;