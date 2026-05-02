import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "../styles/layout.css";
import logo from "../assets/AMSI_Logo.png";

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tema, setTema] = useState(
    () => localStorage.getItem("amsi_tema") || "verde"
  );
  const [menuAberto, setMenuAberto] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (tema === "corporativo") {
      document.documentElement.setAttribute("data-theme", "corporativo");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("amsi_tema", tema);
  }, [tema]);

  const toggleTema = () => setTema((t) => (t === "verde" ? "corporativo" : "verde"));
  const toggleMenu = () => setMenuAberto((v) => !v);

  const handleSair = () => {
    localStorage.clear();
    navigate("/");
  };

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const nomeUsuario = user?.nome || "Usuário";
  const isActive = (path) => location.pathname === path;

  const menuLinks = [
    { to: "/home",               label: "Dashboard",             icon: "📊" },
    { to: "/usuarios",           label: "Usuários",              icon: "👥" },
    { to: "/cliente_fornecedor", label: "Clientes/Fornecedores", icon: "🏢" },
    { to: "/lancamento",         label: "Lançamentos",           icon: "💰" },
    { to: "/tipo_lancamento",    label: "Lista Lançamentos",     icon: "📋" },
    { to: "/cadastro",           label: "Cadastrar Usuário",     icon: "➕" },
  ];

  const corPrimaria = "var(--primary)";

  return (
    <div className="layout-wrapper">

      {/* ── Topbar ── */}
      <header style={{
        background: corPrimaria,
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        width: "100%",
        boxSizing: "border-box",
      }}>
        {/* Lado esquerdo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logo} alt="AMSI Logo" style={{
            width: "44px", height: "44px", objectFit: "contain",
            borderRadius: "8px", background: "white", padding: "4px", flexShrink: 0
          }} />
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: isMobile ? "0.72rem" : "1rem",
            fontWeight: 600,
            color: "#ffffff",
            letterSpacing: "0.02em",
          }}>
            Associação de Moradores de Santa Isabel
          </span>
        </div>

        {/* Lado direito */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {!isMobile && (
            <>
              <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>
                👤 {nomeUsuario}
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>/</span>
              <button onClick={toggleTema} style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: "50px",
                padding: "5px 14px",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 500,
                color: "rgba(255,255,255,0.85)",
                whiteSpace: "nowrap",
              }}>
                {tema === "verde" ? "Corporativo" : "Verde"}
              </button>
            </>
          )}
          {isMobile && (
            <button onClick={toggleMenu} style={{
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", gap: "5px", padding: "4px"
            }}>
              <span style={{ display: "block", width: "22px", height: "2px", background: "#fff", borderRadius: "2px" }} />
              <span style={{ display: "block", width: "22px", height: "2px", background: "#fff", borderRadius: "2px" }} />
              <span style={{ display: "block", width: "22px", height: "2px", background: "#fff", borderRadius: "2px" }} />
            </button>
          )}
        </div>
      </header>

      {/* ── Menu mobile dropdown ── */}
      {isMobile && (
        <div className={`menu-mobile ${menuAberto ? "aberto" : ""}`}>
          {menuLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`menu-mobile-item ${isActive(link.to) ? "active" : ""}`}
              onClick={() => setMenuAberto(false)}
            >
              <span className="menu-icon">{link.icon}</span>
              {link.label}
            </Link>
          ))}
          <button className="menu-mobile-item menu-mobile-sair" onClick={handleSair}>
            🚪 Sair
          </button>
        </div>
      )}

      {/* ── Menu horizontal desktop ── */}
      {!isMobile && (
        <nav className="menu-horizontal">
          <div className="menu-links">
            {menuLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`menu-item ${isActive(link.to) ? "active" : ""}`}
              >
                <span className="menu-icon">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
          <button className="menu-sair" onClick={handleSair}>
            🚪 Sair
          </button>
        </nav>
      )}

      {/* ── Conteúdo ── */}
      <main className="layout-content">
        {children}
      </main>

      {/* ── Rodapé ── */}
      <footer style={{
        background: corPrimaria,
        color: "rgba(255,255,255,0.55)",
        padding: "14px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: isMobile ? "0.65rem" : "0.75rem",
      }}>
        <span>{isMobile ? "AMSI" : "AMSI — Associação de Moradores de Santa Isabel"}</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>

    </div>
  );
}

export default Layout;
