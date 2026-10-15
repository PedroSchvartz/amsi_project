/**
 * Badge da situação do lançamento.
 *
 * A REGRA não mora aqui: a prioridade (Estorno > Pago > Em análise > Vencido > Aberto)
 * é decidida no backend, em Lancamento.situacao, e chega pronta no campo `situacao`.
 * Aqui só se escolhe a cor. Antes disso a regra estava copiada na ListaLancamentosPage
 * e no LoteLancamentosModal, e as duas cópias precisavam aprender qualquer mudança
 * em sincronia.
 */
// Exportado: a legenda de cores (mobile) reusa este mapa como fonte única.
// A ordem das chaves é a de prioridade e serve para ordenar a legenda.
export const CLASSE_SITUACAO = {
	'Estorno': 'badge-estorno',
	'Pago': 'badge-pago',
	'Em análise': 'badge-analise',
	'Vencido': 'badge-vencido',
	'Aberto': 'badge-aberto',
};

function SituacaoBadge({ situacao }) {
	// title: no mobile o badge vira só uma bolinha de cor (CSS) — o title nomeia o
	// status para não ficar "só cor" (acessibilidade). Inofensivo no desktop.
	return (
		<span className={`badge ${CLASSE_SITUACAO[situacao] || 'badge-aberto'}`} title={situacao}>
			{situacao}
		</span>
	);
}

export default SituacaoBadge;
