import { useMemo } from 'react';
import logo from '../assets/AMSI_Logo.png';
import '../styles/home.css';

/*
  Home.jsx — Tela de boas-vindas
  Saudação personalizada, data, logo e frase institucional.
  Futuro: área de notícias da cidade.
*/

function getSaudacao() {
	const hora = new Date().getHours();
	if (hora < 12) return 'Bom dia';
	if (hora < 18) return 'Boa tarde';
	return 'Boa noite';
}

function getDataFormatada() {
	return new Date().toLocaleDateString('pt-BR', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

function Home() {
	const saudacao = useMemo(() => getSaudacao(), []);
	const data     = useMemo(() => getDataFormatada(), []);

	const usuarioLocal = JSON.parse(localStorage.getItem('user') || 'null');
	const nomeUsuario  = usuarioLocal?.nome?.split(' ')[0] || 'Usuário';
	const cargo        = usuarioLocal?.cargo || '';

	return (
		<div className="home-bv-container">

			{/* Logo */}
			<div className="home-bv-logo-wrap">
				<img src={logo} alt="AMSI Logo" className="home-bv-logo" />
			</div>

			{/* Saudação */}
			<div className="home-bv-saudacao">
				<h1 className="home-bv-titulo">
					{saudacao}, {nomeUsuario}!
				</h1>
				{cargo && <span className="home-bv-cargo">{cargo}</span>}
				<p className="home-bv-data">{data}</p>
			</div>

			{/* Divisor */}
			<div className="home-bv-divider" />

			{/* Frase institucional */}
			<div className="home-bv-institucional">
				<p className="home-bv-frase">
					"Trabalhando juntos pelo bem-estar e desenvolvimento
					da nossa comunidade."
				</p>
				<span className="home-bv-nome-assoc">
					Associação de Moradores de Santa Isabel
				</span>
			</div>

		</div>
	);
}

export default Home;
