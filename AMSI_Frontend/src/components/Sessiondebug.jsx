import { useState, useEffect } from 'react';

function SessionDebug() {
	const [info, setInfo] = useState({});

	useEffect(() => {
		const atualizar = () => {
			const token = localStorage.getItem('token');
			const expiresAt = localStorage.getItem('expiresAt');
			const user = localStorage.getItem('user');

			let jwtExp = null;
			let jwtExpMs = null;
			try {
				const payload = JSON.parse(atob(token.split('.')[1]));
				jwtExp = payload.exp;
				jwtExpMs = payload.exp * 1000;
			} catch {}

			const agora = Date.now();

			setInfo({
				agora,
				agoraStr: new Date(agora).toLocaleTimeString('pt-BR'),
				expiresAt: expiresAt ? parseInt(expiresAt) : null,
				expiresAtStr: expiresAt ? new Date(parseInt(expiresAt)).toLocaleTimeString('pt-BR') : 'N/A',
				expiresAtRaw: expiresAt,
				jwtExp,
				jwtExpMs,
				jwtExpStr: jwtExpMs ? new Date(jwtExpMs).toLocaleTimeString('pt-BR') : 'N/A',
				temToken: !!token,
				temUser: !!user,
				sessionExpirado: expiresAt ? agora > parseInt(expiresAt) : false,
				jwtExpirado: jwtExpMs ? agora > jwtExpMs : false,
				msParaSessionExpirar: expiresAt ? parseInt(expiresAt) - agora : null,
				msParaJwtExpirar: jwtExpMs ? jwtExpMs - agora : null
			});
		};

		atualizar();
		const interval = setInterval(atualizar, 1000);
		return () => clearInterval(interval);
	}, []);

	const fmt = (ms) => {
		if (ms === null) return 'N/A';
		if (ms < 0) return `EXPIRADO há ${Math.abs(Math.round(ms / 1000))}s`;
		return `${Math.round(ms / 1000)}s`;
	};

	return (
		<div
			style={{
				position: 'fixed',
				bottom: 16,
				right: 16,
				background: '#1a1a1a',
				color: '#00ff88',
				fontFamily: 'monospace',
				fontSize: 12,
				padding: '12px 16px',
				borderRadius: 8,
				zIndex: 99999,
				minWidth: 300,
				boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
			}}
		>
			<div style={{ color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>🔍 Session Debug</div>
			<div>Agora: {info.agoraStr}</div>
			<div style={{ marginTop: 6, color: info.sessionExpirado ? '#ff4444' : '#00ff88' }}>
				expiresAt (sliding): {info.expiresAtStr}
				<br />└ tempo restante: {fmt(info.msParaSessionExpirar)}
				<br />└ raw: {info.expiresAtRaw}
			</div>
			<div style={{ marginTop: 6, color: info.jwtExpirado ? '#ff4444' : '#ffaa00' }}>
				JWT exp: {info.jwtExpStr}
				<br />└ tempo restante: {fmt(info.msParaJwtExpirar)}
			</div>
			<div style={{ marginTop: 6 }}>
				token: {info.temToken ? '✓' : '✗'} | user: {info.temUser ? '✓' : '✗'}
			</div>
			<div style={{ marginTop: 6 }}>
				session expirada:{' '}
				<span style={{ color: info.sessionExpirado ? '#ff4444' : '#00ff88' }}>
					{info.sessionExpirado ? 'SIM' : 'não'}
				</span>
				{' | '}
				jwt expirado:{' '}
				<span style={{ color: info.jwtExpirado ? '#ff4444' : '#ffaa00' }}>
					{info.jwtExpirado ? 'SIM' : 'não'}
				</span>
			</div>
		</div>
	);
}

export default SessionDebug;
