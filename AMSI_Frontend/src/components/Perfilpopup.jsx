import { useState, useEffect } from 'react';
import {
	getUser,
	getLancamentosPorUsuario,
	getLoginsPorUsuario,
	trocarSenha
} from '../services/api';

function PerfilPopup({ onFechar }) {
	const usuarioLocal = JSON.parse(localStorage.getItem('user') || 'null');
	const idUsuario = usuarioLocal?.id_usuario;

	const [lancamentos, setLancamentos] = useState([]);
	const [ultimoLogin, setUltimoLogin] = useState(null);
	const [carregando, setCarregando] = useState(true);

	// Trocar senha
	const [trocandoSenha, setTrocandoSenha] = useState(false);
	const [senhaAtual, setSenhaAtual] = useState('');
	const [senhaNova, setSenhaNova] = useState('');
	const [senhaConfirm, setSenhaConfirm] = useState('');
	const [erroSenha, setErroSenha] = useState('');
	const [sucessoSenha, setSucessoSenha] = useState('');

	useEffect(() => {
		if (!idUsuario) return;
		Promise.all([
			getLancamentosPorUsuario(idUsuario).catch(() => []),
			getLoginsPorUsuario(idUsuario).catch(() => [])
		]).then(([lancs, logins]) => {
			setLancamentos(Array.isArray(lancs) ? lancs : []);
			if (Array.isArray(logins) && logins.length > 0) {
				const sorted = [...logins].sort((a, b) => new Date(b.data_login) - new Date(a.data_login));
				setUltimoLogin(sorted[0]);
			}
			setCarregando(false);
		});
	}, [idUsuario]);

	const abertos = lancamentos.filter((l) => !l.data_pagamento && !l.estorno);
	const fechados = lancamentos.filter((l) => l.data_pagamento || l.estorno);
	const valorEmAberto = abertos.reduce((acc, l) => acc + parseFloat(l.valor || 0), 0);

	const handleTrocarSenha = async (e) => {
		e.preventDefault();
		setErroSenha('');
		setSucessoSenha('');
		if (senhaNova !== senhaConfirm) {
			setErroSenha('As senhas não coincidem.');
			return;
		}
		try {
			await trocarSenha({ senha_atual: senhaAtual, nova_senha: senhaNova });
			setSucessoSenha('Senha alterada com sucesso!');
			setSenhaAtual('');
			setSenhaNova('');
			setSenhaConfirm('');
			setTimeout(() => setTrocandoSenha(false), 1500);
		} catch (err) {
			setErroSenha(err.message || 'Erro ao trocar senha.');
		}
	};

	const formatData = (str) => {
		if (!str) return '—';
		return new Date(str).toLocaleString('pt-BR');
	};

	const formatValor = (v) =>
		parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

	return (
		<div
			onClick={onFechar}
			style={{
				position: 'fixed',
				inset: 0,
				background: 'rgba(0,0,0,0.45)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 9990
			}}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					background: '#fff',
					borderRadius: 12,
					width: '100%',
					maxWidth: 560,
					maxHeight: '85vh',
					overflowY: 'auto',
					padding: '32px 36px',
					boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
				}}
			>
				{/* Header */}
				<div className="d-flex justify-content-between align-items-center mb-3">
					<h5 className="mb-0 fw-bold">Meu Perfil</h5>
					<button className="btn-close" onClick={onFechar} />
				</div>

				{/* Dados do usuário */}
				<div className="mb-3">
					<p className="mb-1">
						<strong>Nome:</strong> {usuarioLocal?.nome || '—'}
					</p>
					<p className="mb-1">
						<strong>Email:</strong> {usuarioLocal?.email || '—'}
					</p>
					<p className="mb-1">
						<strong>Cargo:</strong> {usuarioLocal?.cargo || '—'}
					</p>
					<p className="mb-1">
						<strong>Perfil:</strong> {usuarioLocal?.perfil_de_acesso || '—'}
					</p>
					{ultimoLogin && (
						<p className="mb-1 text-muted" style={{ fontSize: 13 }}>
							<strong>Último login:</strong> {formatData(ultimoLogin.data_login)}
						</p>
					)}
				</div>

				<hr />

				{/* Resumo lançamentos */}
				{carregando ? (
					<p className="text-muted text-center">Carregando lançamentos...</p>
				) : (
					<>
						<h6 className="fw-semibold mb-2">Resumo de Lançamentos</h6>
						<div className="d-flex gap-3 mb-3">
							<div className="flex-fill text-center p-2 rounded" style={{ background: '#f8f9fa' }}>
								<div style={{ fontSize: 22, fontWeight: 700 }}>{abertos.length}</div>
								<div style={{ fontSize: 12, color: '#666' }}>Em aberto</div>
							</div>
							<div className="flex-fill text-center p-2 rounded" style={{ background: '#f8f9fa' }}>
								<div style={{ fontSize: 22, fontWeight: 700 }}>{fechados.length}</div>
								<div style={{ fontSize: 12, color: '#666' }}>Fechados</div>
							</div>
							<div className="flex-fill text-center p-2 rounded" style={{ background: '#fff3cd' }}>
								<div style={{ fontSize: 16, fontWeight: 700 }}>{formatValor(valorEmAberto)}</div>
								<div style={{ fontSize: 12, color: '#666' }}>Total em aberto</div>
							</div>
						</div>

						{abertos.length > 0 && (
							<>
								<h6 className="fw-semibold mb-2">Lançamentos em Aberto</h6>
								<div style={{ maxHeight: 180, overflowY: 'auto' }}>
									<table className="table table-sm table-hover mb-0">
										<thead className="table-light">
											<tr>
												<th>Vencimento</th>
												<th>Valor</th>
												<th>Natureza</th>
											</tr>
										</thead>
										<tbody>
											{abertos.map((l) => (
												<tr key={l.id_lancamento}>
													<td>{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</td>
													<td>{formatValor(l.valor)}</td>
													<td>
														<span
															className={`badge ${l.natureza_lancamento === 'Credito' ? 'bg-success' : 'bg-danger'}`}
														>
															{l.natureza_lancamento}
														</span>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</>
						)}
					</>
				)}

				<hr />

				{/* Trocar senha */}
				{!trocandoSenha ? (
					<button
						className="btn btn-outline-secondary btn-sm w-100"
						onClick={() => setTrocandoSenha(true)}
					>
						Trocar Senha
					</button>
				) : (
					<form onSubmit={handleTrocarSenha}>
						<h6 className="fw-semibold mb-2">Trocar Senha</h6>
						<input
							type="password"
							className="form-control form-control-sm mb-2"
							placeholder="Senha atual"
							value={senhaAtual}
							onChange={(e) => setSenhaAtual(e.target.value)}
							required
						/>
						<input
							type="password"
							className="form-control form-control-sm mb-2"
							placeholder="Nova senha"
							value={senhaNova}
							onChange={(e) => setSenhaNova(e.target.value)}
							required
						/>
						<input
							type="password"
							className="form-control form-control-sm mb-2"
							placeholder="Confirmar nova senha"
							value={senhaConfirm}
							onChange={(e) => setSenhaConfirm(e.target.value)}
							required
						/>
						{erroSenha && <p className="text-danger small mb-1">{erroSenha}</p>}
						{sucessoSenha && <p className="text-success small mb-1">{sucessoSenha}</p>}
						<div className="d-flex gap-2">
							<button type="submit" className="btn btn-sm btn-dark flex-fill">
								Salvar
							</button>
							<button
								type="button"
								className="btn btn-sm btn-outline-secondary flex-fill"
								onClick={() => setTrocandoSenha(false)}
							>
								Cancelar
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}

export default PerfilPopup;
