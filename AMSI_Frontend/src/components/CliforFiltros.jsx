import { useState } from 'react';

/**
 * Filtros compartilhados de clifor (usado no ClientList e no MassaCliforSeletorModal).
 *
 * useCliforFiltros() — dono do estado + a função filtrar(lista):
 *   const { valores, setters, filtrar } = useCliforFiltros();
 *   const cliforsFiltrados = filtrar(clifors);
 *
 * <CliforFiltros /> — a UI (2 linhas: campo de busca + 3 filtros). As duas linhas
 * aceitam style próprio (a modal precisa de padding; a página usa o default do CSS).
 */
export function useCliforFiltros() {
	const [tipoPesquisa, setTipoPesquisa] = useState('nome');
	const [busca, setBusca] = useState('');
	const [filtroStatus, setFiltroStatus] = useState('');
	const [filtroInadimplente, setFiltroInadimplente] = useState('');
	const [filtroBloqueado, setFiltroBloqueado] = useState('');

	const filtrar = (lista) =>
		lista.filter((c) => {
			if (busca) {
				if (tipoPesquisa === 'documento') {
					const termo = busca.replace(/\D/g, '');
					if (termo && !(c.cpf_cnpj || '').replace(/\D/g, '').includes(termo)) return false;
				} else {
					const campo = tipoPesquisa === 'lote' ? c.lote || '' : c.nome;
					if (!campo.toLowerCase().includes(busca.toLowerCase())) return false;
				}
			}
			if (filtroStatus === 'ativo' && !c.ativo) return false;
			if (filtroStatus === 'inativo' && c.ativo) return false;
			if (filtroInadimplente === 'sim' && !c.inadimplente) return false;
			if (filtroInadimplente === 'nao' && c.inadimplente) return false;
			if (filtroBloqueado === 'sim' && !c.bloqueado) return false;
			if (filtroBloqueado === 'nao' && c.bloqueado) return false;
			return true;
		});

	return {
		valores: { tipoPesquisa, busca, filtroStatus, filtroInadimplente, filtroBloqueado },
		setters: { setTipoPesquisa, setBusca, setFiltroStatus, setFiltroInadimplente, setFiltroBloqueado },
		filtrar
	};
}

function CliforFiltros({ valores, setters, estiloLinha1, estiloLinha2 }) {
	const { tipoPesquisa, busca, filtroStatus, filtroInadimplente, filtroBloqueado } = valores;
	const { setTipoPesquisa, setBusca, setFiltroStatus, setFiltroInadimplente, setFiltroBloqueado } = setters;

	return (
		<>
			<div className="cl-filtros" style={estiloLinha1}>
				<span className="cl-select-wrap">
					<select
						className="cl-select"
						value={tipoPesquisa}
						onChange={(e) => setTipoPesquisa(e.target.value)}
						title="Campo de pesquisa"
					>
						<option value="nome">Nome</option>
						<option value="lote">Lote</option>
						<option value="documento">Documento</option>
					</select>
				</span>
				<input
					className="cl-busca"
					type="text"
					placeholder={
						tipoPesquisa === 'lote'
							? 'Buscar por lote...'
							: tipoPesquisa === 'documento'
								? 'Buscar por documento...'
								: 'Buscar por nome...'
					}
					value={busca}
					onChange={(e) => setBusca(e.target.value)}
				/>
			</div>
			<div className="cl-filtros" style={estiloLinha2}>
				<span className="cl-select-wrap">
					<select
						className="cl-select"
						value={filtroStatus}
						onChange={(e) => setFiltroStatus(e.target.value)}
					>
						<option value="">Status: todos</option>
						<option value="ativo">Ativo</option>
						<option value="inativo">Inativo</option>
					</select>
				</span>
				<span className="cl-select-wrap">
					<select
						className="cl-select"
						value={filtroInadimplente}
						onChange={(e) => setFiltroInadimplente(e.target.value)}
					>
						<option value="">Inadimplente: todos</option>
						<option value="sim">Sim</option>
						<option value="nao">Não</option>
					</select>
				</span>
				<span className="cl-select-wrap">
					<select
						className="cl-select"
						value={filtroBloqueado}
						onChange={(e) => setFiltroBloqueado(e.target.value)}
					>
						<option value="">Bloqueado: todos</option>
						<option value="sim">Sim</option>
						<option value="nao">Não</option>
					</select>
				</span>
			</div>
		</>
	);
}

export default CliforFiltros;
