/**
 * Badge da situação do lançamento.
 *
 * A REGRA não mora aqui: a prioridade (Estorno > Pago > Em análise > Vencido > Aberto)
 * é decidida no backend, em Lancamento.situacao, e chega pronta no campo `situacao`.
 * Aqui só se escolhe a cor. Antes disso a regra estava copiada na ListaLancamentosPage
 * e no LoteLancamentosModal, e as duas cópias precisavam aprender qualquer mudança
 * em sincronia.
 */
const CLASSE_SITUACAO = {
	'Estorno': 'badge-estorno',
	'Pago': 'badge-pago',
	'Em análise': 'badge-analise',
	'Vencido': 'badge-vencido',
	'Aberto': 'badge-aberto',
};

function SituacaoBadge({ situacao }) {
	return <span className={`badge ${CLASSE_SITUACAO[situacao] || 'badge-aberto'}`}>{situacao}</span>;
}

export default SituacaoBadge;
