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

	// Invariantes agnósticas de conteúdo: o changelog.md é editado a cada deploy, então
	// cravar datas/contagens/strings aqui re-quebra o teste sem o parser ter mudado. A
	// extração EXATA de {titulo, detalhe} já fica pinada no describe sintético acima.
	it('tem ao menos um deploy e todos com data ISO', () => {
		expect(deploys.length).toBeGreaterThan(0);
		for (const d of deploys) expect(d.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('datas em ordem decrescente e sem repetição (mais recente primeiro)', () => {
		const datas = deploys.map((d) => d.data);
		// Contrato da tela: o arquivo lista do mais novo ao mais antigo (ISO ordena
		// lexicograficamente = cronologicamente), sem data repetida.
		expect(datas).toEqual([...datas].sort().reverse());
		expect(new Set(datas).size).toBe(datas.length);
	});

	it('todo deploy tem ao menos um ponto', () => {
		for (const d of deploys) expect(d.pontos.length).toBeGreaterThan(0);
	});

	it('todo ponto: título e detalhe não-vazios, trimados e sem espaço duplo', () => {
		for (const d of deploys)
			for (const p of d.pontos) {
				expect(p.titulo).toBeTruthy();
				expect(p.titulo).toBe(p.titulo.trim());
				expect(p.detalhe).toBeTruthy();
				expect(p.detalhe).toBe(p.detalhe.trim());
				expect(p.detalhe).not.toMatch(/ {2}/);
			}
	});
});
