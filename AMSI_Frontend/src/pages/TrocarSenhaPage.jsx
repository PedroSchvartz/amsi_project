import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trocarSenha } from '../services/api.js';

function TrocarSenhaPage() {
	const navigate = useNavigate();
	const [senhaAtual, setSenhaAtual] = useState('');
	const [senhaNova, setSenhaNova] = useState('');
	const [confirma, setConfirma] = useState('');
	const [erro, setErro] = useState('');
	const [carregando, setCarregando] = useState(false);

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

	return (
		<div className="login-container">
			<div className="login-box">
				<h2>Troca de Senha</h2>
				<p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' }}>
					Este é seu primeiro acesso. Defina uma nova senha para continuar.
				</p>

				<form onSubmit={handleSubmit}>
					<input
						type="password"
						placeholder="Senha atual"
						value={senhaAtual}
						onChange={(e) => setSenhaAtual(e.target.value)}
						required
					/>

					<input
						type="password"
						placeholder="Nova senha"
						value={senhaNova}
						onChange={(e) => setSenhaNova(e.target.value)}
						required
					/>

					<input
						type="password"
						placeholder="Confirmar nova senha"
						value={confirma}
						onChange={(e) => setConfirma(e.target.value)}
						required
					/>

					<button type="submit" disabled={carregando}>
						{carregando ? 'Salvando...' : 'Salvar'}
					</button>

					{erro && <p style={{ color: 'red' }}>{erro}</p>}
				</form>
			</div>
		</div>
	);
}

export default TrocarSenhaPage;
