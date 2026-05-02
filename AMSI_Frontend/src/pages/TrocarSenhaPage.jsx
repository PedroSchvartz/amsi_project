import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trocarSenha } from '../services/api.js';
import '../styles/login.css';
import logo from '../assets/AMSI_Logo.png';

function TrocarSenhaPage() {
  const navigate = useNavigate();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [tema, setTema] = useState(
    () => localStorage.getItem('amsi_tema') || 'verde'
  );

  useEffect(() => {
    if (tema === 'corporativo') {
      document.documentElement.setAttribute('data-theme', 'corporativo');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('amsi_tema', tema);
  }, [tema]);

  const toggleTema = () => setTema((t) => (t === 'verde' ? 'corporativo' : 'verde'));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (senhaNova !== confirma) {
      setErro('As senhas não coincidem');
      return;
    }

    setCarregando(true);
    try {
      await trocarSenha({ senha_atual: senhaAtual, nova_senha: senhaNova });
      navigate('/home');
    } catch (err) {
      setErro(err.message || 'Erro ao trocar senha');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (erro) {
      const timer = setTimeout(() => setErro(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [erro]);

  return (
    <>
      <button className="theme-toggle" onClick={toggleTema}>
        <span className="dot" />
        {tema === 'verde' ? 'Tema Corporativo' : 'Tema Verde'}
      </button>

      <div className="login-container">
        {/* Lado esquerdo — branding */}
        <div className="login-branding">
          <img src={logo} alt="AMSI Logo" className="branding-logo" />
          <h1 className="branding-title">AMSI</h1>
          <p className="branding-subtitle">Associação de Moradores de Santa Isabel</p>
          <div className="branding-divider" />
          <p className="branding-tagline">
            Defina sua senha para continuar acessando o sistema.
          </p>
        </div>

        {/* Lado direito — formulário */}
        <div className="login-form-side">
          <div className="login-box">
            <h2>Trocar de Senha </h2>
            <p className="login-welcome">
              Este é seu primeiro acesso. Defina uma nova senha para continuar.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label htmlFor="senhaAtual">Senha atual</label>
                <input
                  id="senhaAtual"
                  type="password"
                  placeholder="••••••••"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="senhaNova">Nova senha</label>
                <input
                  id="senhaNova"
                  type="password"
                  placeholder="••••••••"
                  value={senhaNova}
                  onChange={(e) => setSenhaNova(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="confirma">Confirmar nova senha</label>
                <input
                  id="confirma"
                  type="password"
                  placeholder="••••••••"
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                  required
                />
              </div>

              <button type="submit" disabled={carregando}>
                {carregando ? 'Salvando...' : 'Salvar'}
              </button>

              {erro && <p className="login-erro">{erro}</p>}
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default TrocarSenhaPage;
