import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Módulo virtual `virtual:backlog-meta`: mapa relPath -> { birthtime, mtime, size } dos
// .md em src/backlog/. O glob '?raw' entrega o conteúdo mas não as datas do arquivo, e
// a data é o que a ordenação "criação/edição" precisa. As datas saem do git (estáveis
// entre máquinas/deploys); enquanto o arquivo não está commitado, cai no timestamp do
// filesystem. Tudo roda em build-time (Node), nunca no cliente.
function backlogMeta() {
	const virtualId = 'virtual:backlog-meta';
	const resolvedId = '\0' + virtualId;
	const root = fileURLToPath(new URL('./src/backlog', import.meta.url));

	function datasArquivo(file) {
		const s = statSync(file);
		let birthtime = s.birthtimeMs;
		let mtime = s.mtimeMs;
		try {
			const editado = execFileSync('git', ['log', '-1', '--format=%at', '--', file], {
				encoding: 'utf8',
			}).trim();
			if (editado) {
				mtime = Number(editado) * 1000;
				const criados = execFileSync(
					'git',
					['log', '--follow', '--diff-filter=A', '--format=%at', '--', file],
					{ encoding: 'utf8' },
				)
					.trim()
					.split('\n')
					.filter(Boolean);
				const criado = criados[criados.length - 1];
				birthtime = (criado ? Number(criado) : Number(editado)) * 1000;
			}
		} catch {
			// git ausente ou arquivo ainda não versionado — fica com os tempos do filesystem.
		}
		return { birthtime, mtime, size: s.size };
	}

	function coletar(dir, meta) {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) coletar(full, meta);
			else if (entry.name.endsWith('.md')) {
				const rel = relative(root, full).split('\\').join('/');
				meta[rel] = datasArquivo(full);
			}
		}
	}

	return {
		name: 'backlog-meta',
		resolveId(id) {
			if (id === virtualId) return resolvedId;
		},
		load(id) {
			if (id !== resolvedId) return;
			const meta = {};
			try {
				coletar(root, meta);
			} catch {
				// pasta inexistente — devolve mapa vazio.
			}
			return `export default ${JSON.stringify(meta)};`;
		},
	};
}

export default defineConfig({
	plugins: [react(), backlogMeta()],
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./src/__tests__/setup.js'],
		include: ['src/**/*.test.{js,jsx}'],
		// Sem isto o histórico de chamadas vaza de um teste para o outro e um
		// not.toHaveBeenCalled() falha por chamada de teste anterior.
		clearMocks: true,
	},
});
