import { parseChangelog } from '../utils/parseChangelog.js';
import changelogMd from '../data/changelog.md?raw';

describe('parseChangelog — parser', () => {
	it('monta deploy → pontos → {titulo, detalhe} a partir do markdown', () => {
		const md = [
			'<!-- comentário ignorado -->',
			'# Título solto (ignorado)',
			'',
			'## 2026-10-14',
			'',
			'### Primeiro ponto',
			'Linha um do detalhe',
			'e linha dois, unidas por espaço.',
			'',
			'### Segundo ponto',
			'Detalhe curto.',
			'',
			'## 2026-10-01',
			'',
			'### Ponto do deploy antigo',
			'Outro detalhe.',
		].join('\n');

		const deploys = parseChangelog(md);

		expect(deploys.map((d) => d.data)).toEqual(['2026-10-14', '2026-10-01']);
		expect(deploys[0].pontos).toHaveLength(2);
		expect(deploys[0].pontos[0]).toEqual({
			titulo: 'Primeiro ponto',
			detalhe: 'Linha um do detalhe e linha dois, unidas por espaço.',
		});
		expect(deploys[1].pontos).toEqual([{ titulo: 'Ponto do deploy antigo', detalhe: 'Outro detalhe.' }]);
	});

	it('ignora texto antes do primeiro deploy e normaliza espaços', () => {
		const deploys = parseChangelog('solto\n\n## 2026-01-01\n### P\n  a   b  \n  c  ');
		expect(deploys).toEqual([{ data: '2026-01-01', pontos: [{ titulo: 'P', detalhe: 'a b c' }] }]);
	});
});

describe('parseChangelog — conteúdo real (src/data/changelog.md)', () => {
	const deploys = parseChangelog(changelogMd);

	it('traz os 3 deploys na ordem da tela (mais recente primeiro)', () => {
		expect(deploys.map((d) => d.data)).toEqual(['2026-10-14', '2026-10-12', '2026-10-01']);
	});

	it('conta os pontos de cada deploy', () => {
		expect(deploys.map((d) => d.pontos.length)).toEqual([3, 3, 10]);
	});

	it('preserva título e detalhe exatos do primeiro ponto', () => {
		expect(deploys[0].pontos[0]).toEqual({
			titulo: 'Painel mais limpo e sem rolar de lado no celular',
			detalhe:
				'O painel foi reorganizado para caber na tela do celular sem rolagem horizontal. Os totais de ' +
				'Receitas, Despesas e Saldo do período ficam sempre lado a lado, e as listas quebram em linhas ' +
				'em vez de esticar para o lado.',
		});
	});

	it('nenhum detalhe fica vazio, com espaço duplo ou sobra nas pontas', () => {
		for (const d of deploys)
			for (const p of d.pontos) {
				expect(p.detalhe).toBeTruthy();
				expect(p.detalhe).toBe(p.detalhe.trim());
				expect(p.detalhe).not.toMatch(/ {2}/);
			}
	});
});
