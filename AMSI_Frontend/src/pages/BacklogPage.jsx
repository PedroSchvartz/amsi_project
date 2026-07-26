import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MarkdownSessionExplorer from '../components/markdown/MarkdownSessionExplorer.jsx';
import backlogMeta from 'virtual:backlog-meta';
import '../components/markdown/styles.css';
import 'highlight.js/styles/atom-one-dark.css';
import '../styles/backlog.css';

// Raiz das anotações. O escopo do glob É a trava de segurança pedida ("não voltar além
// da raiz"): o import.meta.glob só enxerga arquivos DENTRO de src/backlog/, e todo
// relPath/folder é calculado relativo a essa raiz — nada acima dela é representável.
// Para adicionar um documento ao viewer, basta soltar um .md aqui (ou numa subpasta).
const ROOT = '../backlog/';
const modulos = import.meta.glob('../backlog/**/*.md', {
	query: '?raw',
	import: 'default',
	eager: true,
});

function extrairTitulo(conteudo, nomeArquivo) {
	const h1 = conteudo.match(/^\s*#\s+(.+?)\s*$/m);
	return (h1 ? h1[1] : nomeArquivo.replace(/\.md$/, '')).trim();
}

function montarItens() {
	return Object.entries(modulos).map(([chave, conteudo]) => {
		const relPath = chave.startsWith(ROOT) ? chave.slice(ROOT.length) : chave;
		const barra = relPath.lastIndexOf('/');
		const folder = barra === -1 ? '.' : relPath.slice(0, barra);
		const nomeArquivo = barra === -1 ? relPath : relPath.slice(barra + 1);
		const meta = backlogMeta[relPath] || {};
		return {
			path: chave,
			relPath,
			folder,
			title: extrairTitulo(conteudo, nomeArquivo),
			content: conteudo,
			size: meta.size ?? conteudo.length,
			birthtime: meta.birthtime ?? 0,
			mtime: meta.mtime ?? 0,
		};
	});
}

export default function BacklogPage() {
	const navigate = useNavigate();
	const itens = useMemo(montarItens, []);

	return (
		<div className="backlog-page">
			<div className="backlog-page__head">
				<div>
					<h2 className="backlog-page__title">Backlog &amp; Anotações</h2>
					<p className="backlog-page__subtitle">
						Documentos de planejamento em <code>.md</code> versionados no frontend.
					</p>
				</div>
				<button
					className="btn-acao-editar"
					onClick={() => navigate('/usuarios')}
					style={{ padding: '8px 18px', fontSize: '0.875rem' }}
					title="Voltar para Usuários"
				>
					<i className="bi bi-arrow-left" /> Voltar
				</button>
			</div>

			{itens.length === 0 ? (
				<p className="backlog-page__empty">Nenhum documento .md encontrado na pasta de anotações.</p>
			) : (
				<MarkdownSessionExplorer items={itens} />
			)}
		</div>
	);
}
