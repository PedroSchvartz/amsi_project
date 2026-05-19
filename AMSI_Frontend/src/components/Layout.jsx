import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import '../styles/layout.css';
import logo from '../assets/AMSI_Logo.png';
import { getUserFromToken, logout, isAdmin, isOperador } from '../services/auth';
import { logoutUser } from '../services/api';
import PerfilPopup from './PerfilCompletoPopup.jsx';

function Layout() {
	const navigate = useNavigate();
	const location = useLocation();

	// Tema lido do localStorage; padrão verde
	const [tema, setTema] = useState(() => localStorage.getItem('amsi_tema') || 'verde');
	const [menuAberto, setMenuAberto] = useState(false);
	const [perfilAberto, setPerfilAberto] = useState(false);
	const admin = isAdmin();
	const operador = isOperador();

	// ── Aplica data-theme no <html> e persiste no localStorage ──
	useEffect(() => {
		if (tema === 'corporativo') {
			document.documentElement.setAttribute('data-theme', 'corporativo');
		} else {
			document.documentElement.removeAttribute('data-theme');
		}
		localStorage.setItem('amsi_tema', tema);
	}, [tema]);

	// Fecha o menu mobile ao redimensionar para desktop via CSS breakpoint
	// (não precisamos mais de isMobile via JS para controle visual — usamos CSS)
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth > 768) {
				setMenuAberto(false);
			}
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	const toggleTema = () => setTema((t) => (t === 'verde' ? 'corporativo' : 'verde'));

	const toggleMenu = () => {
		setMenuAberto((v) => !v);
		// Scroll to top apenas quando abrir o menu
		if (!menuAberto) window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const handleSair = async () => {
		try {
			await logoutUser();
		} catch {}
		logout();
		navigate('/');
	};

	const payload = getUserFromToken();
	const usuarioLocal = JSON.parse(localStorage.getItem('user') || 'null');
	const nomeUsuario = usuarioLocal?.nome || payload?.sub || 'Usuário';
	const isActive = (path) => location.pathname === path;

	const menuLinks = [
		(admin || operador) && { to: '/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
		admin && { to: '/usuarios', label: 'Usuários', icon: 'bi-people' },
		(admin || operador) && { to: '/lancamentos', label: 'Lançamentos', icon: 'bi-journal-text' },
		(admin || operador) && { to: '/cliente_fornecedor', label: 'Clientes / Fornecedores', icon: 'bi-person-lines-fill' }
	].filter(Boolean);

	return (
		<div className="layout-wrapper">

			{/* ── Popup de perfil ── */}
			{perfilAberto && usuarioLocal && (
				<PerfilPopup usuario={usuarioLocal} onFechar={() => setPerfilAberto(false)} />
			)}

			{/* ════════════════════════════════════════
			    TOPBAR
			    ════════════════════════════════════════ */}
			<header className="layout-topbar">

				{/* Logo + nome do sistema */}
				<Link to="/home" className="layout-topbar__brand">
					<img src={logo} alt="AMSI Logo" className="layout-topbar__logo" />
					<span className="layout-topbar__title">
						Associação de Moradores de Santa Isabel
					</span>
				</Link>

				{/* Ações do lado direito — apenas desktop */}
				<div className="layout-topbar__actions layout-topbar__actions--desktop">
					<button
						className="layout-topbar__user-btn"
						onClick={() => setPerfilAberto(true)}
						title="Ver perfil"
					>
						<i className="bi bi-person-circle" />
						<span>{nomeUsuario}</span>
					</button>

					<span className="layout-topbar__divider" aria-hidden="true" />

					{/* Botão de troca de tema com ícone */}
					<button className="layout-topbar__theme-btn" onClick={toggleTema} title="Alternar tema">
						<i className={tema === 'verde' ? 'bi bi-moon-stars' : 'bi bi-sun'} />
						<span>{tema === 'verde' ? 'Corporativo' : 'Verde'}</span>
					</button>
				</div>

				{/* Botão hamburger — apenas mobile (Bootstrap Icons) */}
				<button
					className="layout-topbar__hamburger"
					onClick={toggleMenu}
					aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
					aria-expanded={menuAberto}
				>
					{/* Alterna entre ícone de menu e X */}
					<i className={menuAberto ? 'bi bi-x-lg' : 'bi bi-list'} />
				</button>
			</header>

			{/* ════════════════════════════════════════
			    MENU MOBILE (dropdown)
			    ════════════════════════════════════════ */}
			<div className={`layout-menu-mobile ${menuAberto ? 'layout-menu-mobile--aberto' : ''}`}>

				{/* Links de navegação */}
				{menuLinks.map((link) => (
					<Link
						key={link.to}
						to={link.to}
						className={`layout-menu-mobile__item ${isActive(link.to) ? 'layout-menu-mobile__item--active' : ''}`}
						onClick={() => setMenuAberto(false)}
					>
						<i className={`bi ${link.icon}`} />
						{link.label}
					</Link>
				))}

				{/* Separador */}
				<div className="layout-menu-mobile__separator" />

				{/* Perfil do usuário */}
				<button
					className="layout-menu-mobile__item"
					onClick={() => { setMenuAberto(false); setPerfilAberto(true); }}
				>
					<i className="bi bi-person-circle" />
					{nomeUsuario}
				</button>

				{/* Troca de tema — disponível também no mobile */}
				<button className="layout-menu-mobile__item" onClick={toggleTema}>
					<i className={tema === 'verde' ? 'bi bi-moon-stars' : 'bi bi-sun'} />
					Tema: {tema === 'verde' ? 'Corporativo' : 'Verde'}
				</button>

				{/* Sair */}
				<button className="layout-menu-mobile__item layout-menu-mobile__item--sair" onClick={handleSair}>
					<i className="bi bi-box-arrow-right" />
					Sair
				</button>
			</div>

			{/* ════════════════════════════════════════
			    MENU HORIZONTAL — DESKTOP
			    ════════════════════════════════════════ */}
			<nav className="layout-menu-desktop">
				<div className="layout-menu-desktop__links">
					{menuLinks.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							className={`layout-menu-desktop__item ${isActive(link.to) ? 'layout-menu-desktop__item--active' : ''}`}
						>
							<i className={`bi ${link.icon}`} />
							{link.label}
						</Link>
					))}
				</div>

				<button className="layout-menu-desktop__sair" onClick={handleSair}>
					<i className="bi bi-box-arrow-right" />
					Sair
				</button>
			</nav>

			{/* ════════════════════════════════════════
			    CONTEÚDO PRINCIPAL
			    ════════════════════════════════════════ */}
			<main className="layout-content">
				<ErrorBoundary>
					<Outlet />
				</ErrorBoundary>
			</main>

			{/* ════════════════════════════════════════
			    RODAPÉ
			    ════════════════════════════════════════ */}
			<footer className="layout-footer">
				<span className="layout-footer__nome">
					{/* Texto abreviado no mobile via CSS */}
					<span className="d-none d-sm-inline">AMSI — Associação de Moradores de Santa Isabel</span>
					<span className="d-inline d-sm-none">AMSI</span>
				</span>
				<span>© {new Date().getFullYear()}</span>
			</footer>
		</div>
	);
}

export default Layout;
