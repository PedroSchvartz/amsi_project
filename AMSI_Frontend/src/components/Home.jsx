import "../styles/home.css";

function Home() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const nome = user?.nome || "Usuário";

  return (
    <div className="home-content">
      <div className="home-welcome">
        <h1>Olá, {nome} 👋</h1>
        <p>Bem-vindo ao sistema de gestão financeira da AMSI.</p>
        <p className="home-hint">Use o menu acima para navegar pelo sistema.</p>
      </div>
    </div>
  );
}

export default Home;
