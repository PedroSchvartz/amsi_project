// Converte o changelog em Markdown no formato consumido pela ChangelogPage.
//
// Formato (ver src/data/changelog.md):
//   ## AAAA-MM-DD        -> um deploy (data ISO; a ordem do arquivo é a da tela,
//                           mais recente primeiro).
//   ### Título do ponto  -> um ponto (em geral, um commit) dentro do deploy.
//   texto...             -> detalhe do ponto; linhas seguidas viram um só parágrafo
//                           (unidas por espaço). Linha em branco separa.
// Qualquer linha fora disso (comentário, título solto) é ignorada.
//
// Retorna: [{ data, pontos: [{ titulo, detalhe }] }].
export function parseChangelog(md) {
	const deploys = [];
	let deploy = null;
	let ponto = null;
	let buffer = [];

	const fecharPonto = () => {
		if (ponto) ponto.detalhe = buffer.join(' ').replace(/\s+/g, ' ').trim();
		ponto = null;
		buffer = [];
	};

	// Remove blocos de comentário (<!-- ... -->) antes de ler: eles podem conter
	// linhas iniciadas por ## / ### (a própria ajuda de edição do .md) que senão
	// seriam confundidas com deploys/pontos.
	const semComentarios = md.replace(/<!--[\s\S]*?-->/g, '');

	for (const bruta of semComentarios.split(/\r?\n/)) {
		const linha = bruta.trim();
		if (linha.startsWith('### ')) {
			fecharPonto();
			ponto = { titulo: linha.slice(4).trim(), detalhe: '' };
			if (deploy) deploy.pontos.push(ponto);
		} else if (linha.startsWith('## ')) {
			fecharPonto();
			deploy = { data: linha.slice(3).trim(), pontos: [] };
			deploys.push(deploy);
		} else if (linha && ponto) {
			buffer.push(linha);
		}
	}
	fecharPonto();
	return deploys;
}
