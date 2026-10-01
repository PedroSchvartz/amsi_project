import { useState } from 'react';
import { trocarSenha, cadastrarEmail } from '../services/api.js';
import { useToast } from './ToastStack';

/**
 * Modal "Trocar Senha" (autoatendimento, acessível ao lado do botão Sair).
 * Campos: Nova senha, Confirmar nova senha e E-mail. A senha atual NÃO é pedida — a sessão
 * já está autenticada (decisão registrada no changelog).
 *
 * E-mail:
 *   - Se o usuário JÁ tem e-mail, o campo vem preenchido e só serve de confirmação (trocar
 *     e-mail existente é outro fluxo, fora de escopo).
 *   - Se NÃO tem, o campo fica editável e, ao Confirmar, cadastra o e-mail antes de salvar.
 *
 * Validação no Confirmar: e-mail não-vazio, senhas iguais e mínimo de 6 caracteres.
 */
function TrocarSenhaModal({ usuario, onFechar }) {
	const { mostrarToast } = useToast();
	const temEmail = Boolean(usuario?.email);

	const [nova, setNova] = useState('');
	const [confirmar, setConfirmar] = useState('');
	const [email, setEmail] = useState(usuario?.email || '');
	const [erros, setErros] = useState({});
	const [salvando, setSalvando] = useState(false);

	const validar = () => {
		const e = {};
		if (!email.trim()) e.email = 'Informe um e-mail.';
		if (nova.length < 6) e.nova = 'A senha deve ter pelo menos 6 caracteres.';
		if (nova !== confirmar) e.confirmar = 'As senhas não coincidem.';
		setErros(e);
		return Object.keys(e).length === 0;
	};

	const confirmarTroca = async () => {
		if (!validar()) return;
		setSalvando(true);
		try {
			// Só cadastra e-mail quando o usuário ainda não tinha um e digitou agora.
			if (!temEmail && email.trim()) {
				const res = await cadastrarEmail(email.trim());
				const atual = JSON.parse(localStorage.getItem('user') || '{}');
				localStorage.setItem('user', JSON.stringify({ ...atual, email: res.email }));
			}
			await trocarSenha({ nova_senha: nova });
			mostrarToast('Senha alterada com sucesso.', 'sucesso');
			onFechar();
		} catch (err) {
			mostrarToast(err.message || 'Não foi possível trocar a senha.', 'erro');
		} finally {
			setSalvando(false);
		}
	};

	const estiloInput = (campo) => ({
		width: '100%',
		padding: '10px 12px',
		borderRadius: 8,
		border: `1px solid ${erros[campo] ? '#dc2626' : 'var(--border)'}`,
		background: 'var(--input-bg)',
		color: 'var(--text)',
		fontSize: '0.9rem',
		outline: 'none'
	});

	const estiloErro = { color: '#dc2626', fontSize: '0.78rem', margin: '4px 0 0' };
	const estiloLabel = {
		display: 'block',
		fontSize: '0.8rem',
		fontWeight: 600,
		color: 'var(--text)',
		margin: '0 0 6px'
	};

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				background: 'rgba(0,0,0,0.55)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 9980,
				padding: 20
			}}
			onClick={onFechar}
		>
			<div
				style={{
					background: 'var(--bg-card)',
					borderRadius: 14,
					width: '100%',
					maxWidth: 420,
					padding: '32px 36px',
					boxShadow: '0 16px 48px var(--shadow)'
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						marginBottom: 20
					}}
				>
					<h4
						style={{
							margin: 0,
							fontFamily: 'var(--font-display)',
							color: 'var(--primary)',
							fontWeight: 700
						}}
					>
						Trocar Senha
					</h4>
					<button
						onClick={onFechar}
						style={{
							background: 'transparent',
							border: 'none',
							cursor: 'pointer',
							fontSize: '1.2rem',
							color: 'var(--text-muted)'
						}}
						aria-label="Fechar"
					>
						✕
					</button>
				</div>

				<div style={{ marginBottom: 16 }}>
					<label htmlFor="ts-nova" style={estiloLabel}>Nova senha</label>
					<input
						id="ts-nova"
						type="password"
						value={nova}
						onChange={(e) => setNova(e.target.value)}
						placeholder="••••••••"
						style={estiloInput('nova')}
					/>
					{erros.nova && <p style={estiloErro}>{erros.nova}</p>}
				</div>

				<div style={{ marginBottom: 16 }}>
					<label htmlFor="ts-confirmar" style={estiloLabel}>Confirmar nova senha</label>
					<input
						id="ts-confirmar"
						type="password"
						value={confirmar}
						onChange={(e) => setConfirmar(e.target.value)}
						placeholder="••••••••"
						style={estiloInput('confirmar')}
					/>
					{erros.confirmar && <p style={estiloErro}>{erros.confirmar}</p>}
				</div>

				<div style={{ marginBottom: 8 }}>
					<label htmlFor="ts-email" style={estiloLabel}>E-mail</label>
					<input
						id="ts-email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="seu@email.com"
						disabled={temEmail}
						style={{ ...estiloInput('email'), opacity: temEmail ? 0.7 : 1 }}
					/>
					{erros.email && <p style={estiloErro}>{erros.email}</p>}
				</div>

				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						gap: 10,
						marginTop: 24
					}}
				>
					<button
						type="button"
						onClick={onFechar}
						style={{
							padding: '8px 18px',
							borderRadius: 8,
							border: '1px solid var(--border)',
							background: 'transparent',
							color: 'var(--text)',
							fontWeight: 500,
							cursor: 'pointer'
						}}
					>
						Retornar
					</button>
					<button
						type="button"
						onClick={confirmarTroca}
						disabled={salvando}
						style={{
							padding: '8px 18px',
							borderRadius: 8,
							border: 'none',
							background: 'var(--primary)',
							color: '#fff',
							fontWeight: 600,
							cursor: salvando ? 'not-allowed' : 'pointer',
							opacity: salvando ? 0.6 : 1
						}}
					>
						{salvando ? 'Salvando…' : 'Confirmar'}
					</button>
				</div>
			</div>
		</div>
	);
}

export default TrocarSenhaModal;
