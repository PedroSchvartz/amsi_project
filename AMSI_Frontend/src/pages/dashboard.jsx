import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { isAdmin } from "../services/auth"; // ajusta o caminho

// 🔥 definição central dos cards
const TODOS_OS_CARDS = [
  {
    id: "dashboard",
    titulo: "Dashboard",
    descricao: "Visualize dados e métricas do sistema.",
    link: "/dashboard/",
    btnLabel: "Alterar dashboard",
  },
  {
    id: "usuarios",
    titulo: "Usuários",
    descricao: "Gerencie os usuários cadastrados.",
    link: "/usuarios/",
    btnLabel: "Ver lista",
  },
  {
    id: "configuracoes",
    titulo: "Configurações",
    descricao: "Ajuste preferências do sistema.",
    link: "/dashboard/",
    btnLabel: "Cadastrar usuários",
  },
  {
    id: "cadastro",
    titulo: "Cadastrar usuários",
    descricao: "Cadastre seus usuários.",
    link: "/cadastro/",
    btnLabel: "Cadastrar usuários",
  },
];

const STORAGE_KEY = "cards_visiveis_consulta";

// quais cards o perfil Consulta vê por padrão
const DEFAULT_VISIBILIDADE = {
  dashboard: true,
  usuarios: false,
  configuracoes: false,
  cadastro: false,
};

function Home() {
  const admin = isAdmin();

  // carrega preferências do localStorage
  const [visibilidade, setVisibilidade] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      return salvo ? JSON.parse(salvo) : DEFAULT_VISIBILIDADE;
    } catch {
      return DEFAULT_VISIBILIDADE;
    }
  });

  const [modalAberto, setModalAberto] = useState(false);
  const [tempVisibilidade, setTempVisibilidade] = useState(visibilidade);

  // filtra cards conforme perfil
  const cardsVisiveis = admin
    ? TODOS_OS_CARDS
    : TODOS_OS_CARDS.filter((card) => visibilidade[card.id]);

  const handleAbrirModal = () => {
    setTempVisibilidade(visibilidade);
    setModalAberto(true);
  };

  const handleFecharModal = () => setModalAberto(false);

  const handleToggle = (id) => {
    setTempVisibilidade((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSalvar = () => {
    setVisibilidade(tempVisibilidade);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tempVisibilidade));
    setModalAberto(false);
  };

  return (
    <div>
      {/* 🔥 botão de config — só admin vê */}
      {admin && (
        <div className="d-flex justify-content-end px-4 pt-3">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={handleAbrirModal}
          >
            <i className="bi bi-gear me-1"></i> Configurar visibilidade
          </button>
        </div>
      )}

      <div className="container py-4">
        <div className="row g-4">
          {cardsVisiveis.map((card) => (
            <div className="col-md-4" key={card.id}>
              <div className="card shadow-sm border-0 rounded-4 h-100">
                {/* 🔥 badge de visibilidade — só admin vê */}
                {admin && (
                  <div className="px-3 pt-2">
                    <span
                      className={`badge ${
                        visibilidade[card.id] ? "bg-success" : "bg-secondary"
                      }`}
                    >
                      {visibilidade[card.id]
                        ? "Visível para Consulta"
                        : "Oculto para Consulta"}
                    </span>
                  </div>
                )}
                <div className="card-body">
                  <h5 className="card-title">{card.titulo}</h5>
                  <p className="card-text">{card.descricao}</p>
                  <Link to={card.link} className="btn btn-dark w-100">
                    {card.btnLabel}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 🔥 MODAL DE CONFIGURAÇÃO */}
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
                  <h5 className="modal-title">
                    <i className="bi bi-eye me-2"></i>
                    Visibilidade para perfil Consulta
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={handleFecharModal}
                  />
                </div>

                <div className="modal-body">
                  <p className="text-muted small mb-3">
                    Selecione quais cards o perfil <strong>Consulta</strong> pode visualizar.
                  </p>

                  {TODOS_OS_CARDS.map((card) => (
                    <div
                      key={card.id}
                      className="form-check form-switch mb-3 d-flex align-items-center gap-2"
                    >
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id={`toggle-${card.id}`}
                        checked={tempVisibilidade[card.id]}
                        onChange={() => handleToggle(card.id)}
                      />
                      <label
                        className="form-check-label"
                        htmlFor={`toggle-${card.id}`}
                      >
                        <strong>{card.titulo}</strong>
                        <span className="text-muted ms-2 small">
                          {card.descricao}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={handleFecharModal}
                  >
                    Cancelar
                  </button>
                  <button className="btn btn-primary" onClick={handleSalvar}>
                    <i className="bi bi-check2 me-1"></i> Salvar
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

export default Home;