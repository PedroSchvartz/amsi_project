// Data da última versão estável, mantida MANUALMENTE (não é build-stamp automático).
// Atualize para o dia do deploy sempre que concluir que a versão está estável.
// A skill /sobe (deploy) atualiza esta constante para a data do dia antes de subir.
// Formato: ISO 'AAAA-MM-DD' (o cabeçalho exibe como dd/mm/aa).
export const DATA_ULTIMA_ATUALIZACAO = '2026-09-18';

// 'AAAA-MM-DD' → 'dd/mm/aa' sem depender de fuso (evita o -1 dia do Date em UTC).
export function dataAtualizacaoFormatada() {
	const [ano, mes, dia] = DATA_ULTIMA_ATUALIZACAO.split('-');
	return `${dia}/${mes}/${ano.slice(2)}`;
}
