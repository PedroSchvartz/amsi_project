import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseChangelog } from '../utils/parseChangelog';
import changelogMd from '../data/changelog.md?raw';
import '../styles/changelog.css';

// Changelog do sistema. O conteúdo mora em src/data/changelog.md (fácil de editar,
// sem mexer em código); aqui só interpretamos. Cada entrada é um DEPLOY (a data só
// aparece por deploy); dentro dele, cada ponto corresponde a um commit que subiu
// naquela versão. Para publicar um novo deploy, edite o .md (mais recente no topo).
const DEPLOYS = parseChangelog(changelogMd);

// 'AAAA-MM-DD' → 'dd/mm/aaaa' sem depender de fuso (evita o -1 dia do Date em UTC).
function formatarData(iso) {
	const [ano, mes, dia] = iso.split('-');
	return `${dia}/${mes}/${ano}`;
}

export default function ChangelogPage() {
	const navigate = useNavigate();
	// Todos os deploys começam colapsados, menos o mais recente (o primeiro da lista).
	const [abertos, setAbertos] = useState(() => new Set(DEPLOYS.length ? [DEPLOYS[0].data] : []));

	const alternar = (data) =>
		setAbertos((prev) => {
			const novo = new Set(prev);
			if (novo.has(data)) novo.delete(data);
			else novo.add(data);
			return novo;
		});

	return (
		<div className="changelog-page">
			<div className="changelog-page__head">
				<div>
					<h2 className="changelog-page__title">Novidades &amp; Atualizações</h2>
					<p className="changelog-page__subtitle">
						O que mudou no sistema a cada versão publicada.
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

			{DEPLOYS.map((deploy) => {
				const aberto = abertos.has(deploy.data);
				return (
					<section key={deploy.data} className="changelog-deploy">
						<button
							type="button"
							className="changelog-deploy__data"
							aria-expanded={aberto}
							onClick={() => alternar(deploy.data)}
						>
							<i className={`bi ${aberto ? 'bi-chevron-down' : 'bi-chevron-right'}`} />
							<i className="bi bi-rocket-takeoff" /> {formatarData(deploy.data)}
						</button>
						{aberto && (
							<ul className="changelog-deploy__pontos">
								{deploy.pontos.map((ponto) => (
									<li key={ponto.titulo} className="changelog-ponto">
										<span className="changelog-ponto__titulo">{ponto.titulo}</span>
										<span className="changelog-ponto__detalhe">{ponto.detalhe}</span>
									</li>
								))}
							</ul>
						)}
					</section>
				);
			})}
		</div>
	);
}
