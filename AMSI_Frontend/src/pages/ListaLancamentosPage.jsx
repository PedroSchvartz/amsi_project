import "../styles/listaLancamentos.css";

function ListaLancamentosPage() {
  return (
    <div className="container">
      {/* HEADER */}
      <div className="header">
        <div className="logo">LOGO</div>
        <h2>Associação de Moradores de Santa Isabel</h2>
      </div>

      {/* MENU */}
      <div className="menu">
        <span>Lista Lançamentos</span>
        <span>Cadastro Lançamentos</span>
        <span>Cadastro Cliente / Fornecedor</span>
        <span>Cadastro Usuário</span>
      </div>

      {/* CONTEÚDO */}
      <div className="content">
        <h2>Lista de Lançamentos</h2>

        {/* FILTROS */}
        <h4>FILTROS</h4>
        <div className="filtros">
          <input placeholder="Data inicial" />
          <input placeholder="Tipo de Conta" />
          <input placeholder="Natureza" />
          <input placeholder="Data até" />
        </div>

        <div className="filtros">
          <input placeholder="Data inicial" />
          <input placeholder="Tipo de Conta" />
          <input placeholder="Natureza" />
          <input placeholder="Data até" />
        </div>

        <div className="filtros-secundario">
          <input placeholder="Status" />
          <input placeholder="Cliente / Fornecedor" />
        </div>

        <button className="btn-filtrar">Aplicar Filtros</button>

        {/* TABELA */}
        <h4>TRANSAÇÕES</h4>
        <table>
          <thead>
            <tr>
              <th>Cliente / Fornecedor</th>
              <th>Grupo</th>
              <th>Tipo de Conta</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="7" className="empty">
                Nenhum lançamento encontrado
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ListaLancamentosPage;