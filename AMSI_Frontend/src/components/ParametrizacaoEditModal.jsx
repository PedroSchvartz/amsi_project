import { useState } from 'react';
import { createPortal } from 'react-dom';
import { createParametrizacao, updateParametrizacao } from '../services/api';
import { useToast } from './ToastStack.jsx';
import MassaCliforSeletorModal from './MassaCliforSeletorModal.jsx';

/**
 * Cria ou edita uma parametrização (seleção nomeada de clifors + valor opcional,
 * atrelada a um Tipo de Conta). A mesma modal serve para "Novo" e "Editar" —
 * `parametrizacao` null = criação. Os clifors saem do mesmo MassaCliforSeletorModal
 * da lista de clientes/fornecedores.
 *
 * Props:
 *  - parametrizacao: objeto a editar, ou null para criar
 *  - tiposConta: lista de tipos de conta (para o select)
 *  - onSalvar(): chamado após salvar com sucesso (o pai recarrega a lista)
 *  - onFechar(): fecha sem salvar
 */
function ParametrizacaoEditModal({ parametrizacao = null, tiposConta = [], onSalvar, onFechar }) {
	const { mostrarToast } = useToast();
	const editando = parametrizacao != null;

	const [nome, setNome] = useState(parametrizacao?.nome || '');
	const [idTipoConta, setIdTipoConta] = useState(
		parametrizacao?.id_tipo_conta_fk != null ? String(parametrizacao.id_tipo_conta_fk) : ''
	);
	const [valor, setValor] = useState(
		parametrizacao?.valor != null ? String(parametrizacao.valor).replace('.', ',') : ''
	);
	const [idsClifor, setIdsClifor] = useState(parametrizacao?.ids_clifor || []);
	const [seletorAberto, setSeletorAberto] = useState(false);
	const [salvando, setSalvando] = useState(false);

	const handleSalvar = async (e) => {
		e.preventDefault();
		if (!nome.trim()) {
			mostrarToast('Informe o nome da parametrização.', 'aviso');
			return;
		}
		if (!idTipoConta) {
			mostrarToast('Selecione o tipo de conta.', 'aviso');
			return;
		}
		if (idsClifor.length === 0) {
			mostrarToast('Selecione ao menos um cliente/fornecedor.', 'aviso');
			return;
		}
		const payload = {
			nome: nome.trim(),
			id_tipo_conta_fk: parseInt(idTipoConta),
			valor: valor.trim() ? parseFloat(valor.replace(',', '.')) : null,
			ids_clifor: idsClifor
		};
		try {
			setSalvando(true);
			if (editando) {
				await updateParametrizacao(parametrizacao.id_parametrizacao, payload);
				mostrarToast('Parametrização atualizada com sucesso.');
			} else {
				await createParametrizacao(payload);
				mostrarToast('Parametrização criada com sucesso.');
			}
			onSalvar();
		} catch (err) {
			mostrarToast(err.message || 'Erro ao salvar parametrização', 'erro');
		} finally {
			setSalvando(false);
		}
	};

	return createPortal(
		<>
			<div
				className="popup-overlay"
				style={{ zIndex: 9992, padding: 20 }}
				onClick={onFechar}
			>
				<div
					onClick={(e) => e.stopPropagation()}
					style={{
						background: 'var(--bg-card)',
						border: '1px solid var(--border)',
						borderRadius: 14,
						width: '100%',
						maxWidth: 460,
						padding: '28px 32px',
						boxShadow: '0 16px 48px var(--shadow)'
					}}
				>
					<h3 style={{ margin: '0 0 20px', fontFamily: 'var(--font-display)' }}>
						{editando ? 'Editar Parametrização' : 'Nova Parametrização'}
					</h3>

					<form onSubmit={handleSalvar}>
						<div style={{ marginBottom: 14 }}>
							<label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
								Nome *
							</label>
							<input
								type="text"
								value={nome}
								onChange={(e) => setNome(e.target.value)}
								required
								style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box' }}
							/>
						</div>

						<div style={{ marginBottom: 14 }}>
							<label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
								Tipo de Conta *
							</label>
							<select
								value={idTipoConta}
								onChange={(e) => setIdTipoConta(e.target.value)}
								required
								style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
							>
								<option value="">Selecione</option>
								{tiposConta.map((t) => (
									<option key={t.id_tipo_conta} value={t.id_tipo_conta}>
										{t.descricao_conta}
									</option>
								))}
							</select>
						</div>

						<div style={{ marginBottom: 14 }}>
							<label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
								Valor sugerido (opcional)
							</label>
							<input
								type="text"
								inputMode="decimal"
								value={valor}
								onChange={(e) => setValor(e.target.value.replace(/[^0-9,]/g, ''))}
								placeholder="0,00"
								style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box' }}
							/>
						</div>

						<div style={{ marginBottom: 20 }}>
							<label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
								Clientes / Fornecedores *
							</label>
							<button
								type="button"
								onClick={() => setSeletorAberto(true)}
								style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
							>
								<i className="bi bi-people-fill" style={{ color: 'var(--primary)' }} />
								{idsClifor.length > 0
									? `${idsClifor.length} selecionado(s) — clique para editar`
									: 'Selecionar clientes/fornecedores'}
							</button>
						</div>

						<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
							<button
								type="button"
								onClick={onFechar}
								style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}
							>
								Cancelar
							</button>
							<button
								type="submit"
								disabled={salvando}
								style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.7 : 1 }}
							>
								{editando ? 'Salvar' : 'Criar'}
							</button>
						</div>
					</form>
				</div>
			</div>

			{seletorAberto && (
				<MassaCliforSeletorModal
					selecionados={idsClifor}
					onConfirmar={(ids) => {
						setIdsClifor(ids);
						setSeletorAberto(false);
					}}
					onFechar={() => setSeletorAberto(false)}
				/>
			)}
		</>,
		document.body
	);
}

export default ParametrizacaoEditModal;
