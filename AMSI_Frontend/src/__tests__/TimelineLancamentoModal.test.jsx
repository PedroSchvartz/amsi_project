/**
 * Testes unitários para src/components/TimelineLancamentoModal.jsx.
 *
 * O que o componente decide sozinho:
 *   - a ORDEM dos eventos, que não é a ordem ingênua por data: Lançado → Efetivado →
 *     Aprovado têm ordem causal, e o backfill do fluxo antigo gravou carimbos que
 *     inverteriam essa ordem se a data mandasse sozinha
 *   - o posicionamento do "Editado", que é o único evento sem lugar fixo no fluxo
 *   - a leitura do carimbo UTC (o backend serializa sem sufixo 'Z')
 *
 * Sem mocks: o componente é autocontido, recebe o lançamento por prop.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimelineLancamentoModal, {
	eventosDoLancamento,
	ultimaInteracao,
} from '../components/TimelineLancamentoModal.jsx';

const ordem = (l) => eventosDoLancamento(l).map((e) => e.acao);

describe('ordem da linha do tempo', () => {
	it('5190 real: backfill à meia-noite não joga Efetivado antes de Lançado', () => {
		const l = {
			data_lancamento: '2026-06-17T18:33:02', nome_usuario_lancamento: 'Pedro',
			data_efetivacao: '2026-06-17T00:00:00', nome_usuario_efetivacao: 'Pedro',
			data_aprovacao: '2026-06-17T00:00:00', nome_usuario_aprovacao: 'Pedro',
		};
		expect(ordem(l)).toEqual(['Lançado', 'Efetivado', 'Aprovado']);
		expect(ultimaInteracao(l).acao).toBe('Aprovado');
	});

	it('editado DEPOIS de efetivar → última interação é Editado', () => {
		const l = {
			data_lancamento: '2026-06-17T10:00:00',
			data_efetivacao: '2026-06-17T11:00:00',
			data_edicao: '2026-06-17T12:00:00',
		};
		expect(ordem(l)).toEqual(['Lançado', 'Efetivado', 'Editado']);
		expect(ultimaInteracao(l).acao).toBe('Editado');
	});

	it('editado ANTES de efetivar → última interação é Efetivado', () => {
		const l = {
			data_lancamento: '2026-06-17T10:00:00',
			data_efetivacao: '2026-06-17T11:00:00',
			data_edicao: '2026-06-17T10:30:00',
		};
		expect(ordem(l)).toEqual(['Lançado', 'Editado', 'Efetivado']);
		expect(ultimaInteracao(l).acao).toBe('Efetivado');
	});

	it('admin efetivando carimba os dois no mesmo instante → Aprovado depois de Efetivado', () => {
		const l = {
			data_lancamento: '2026-06-17T10:00:00',
			data_efetivacao: '2026-06-17T11:00:00',
			data_aprovacao: '2026-06-17T11:00:00',
		};
		expect(ordem(l)).toEqual(['Lançado', 'Efetivado', 'Aprovado']);
		expect(ultimaInteracao(l).acao).toBe('Aprovado');
	});

	it('lançamento aberto só tem o evento de criação', () => {
		const l = { data_lancamento: '2026-06-17T10:00:00', nome_usuario_lancamento: 'Ana' };
		expect(ordem(l)).toEqual(['Lançado']);
		expect(ultimaInteracao(l).nome).toBe('Ana');
	});

	it('carimbo UTC sem sufixo Z não é lido como hora local', () => {
		// 18:00 UTC = 15:00 em São Paulo. Sem o 'Z' o JS leria 18:00 local.
		const l = { data_lancamento: '2026-07-15T18:00:00' };
		expect(ultimaInteracao(l).data).toBe('2026-07-15T18:00:00');
		expect(new Date(`${l.data_lancamento}Z`).getUTCHours()).toBe(18);
	});

	it('lançamento sem carimbo nenhum não tem última interação', () => {
		expect(eventosDoLancamento(null)).toEqual([]);
		expect(ultimaInteracao({})).toBeNull();
	});
});

describe('render do modal', () => {
	const LANCAMENTO = {
		data_lancamento: '2026-06-17T13:00:00',
		nome_usuario_lancamento: 'João José',
		data_efetivacao: '2026-06-17T14:00:00',
		nome_usuario_efetivacao: 'Maria Operadora',
		data_aprovacao: '2026-06-17T15:00:00',
		nome_usuario_aprovacao: 'Pedro Admin',
	};

	it('lista os eventos com quem fez, na ordem, e não diz o que mudou', () => {
		render(<TimelineLancamentoModal lancamento={LANCAMENTO} onFechar={() => {}} />);

		const acoes = screen.getAllByText(/^(Lançado|Efetivado|Aprovado|Editado)$/).map((n) => n.textContent);
		expect(acoes).toEqual(['Lançado', 'Efetivado', 'Aprovado']);

		expect(screen.getByText('por João José')).toBeInTheDocument();
		expect(screen.getByText('por Maria Operadora')).toBeInTheDocument();
		expect(screen.getByText('por Pedro Admin')).toBeInTheDocument();
	});

	it('evento sem nome de usuário não quebra o render', () => {
		render(
			<TimelineLancamentoModal
				lancamento={{ data_lancamento: '2026-06-17T13:00:00' }}
				onFechar={() => {}}
			/>
		);
		expect(screen.getByText('por —')).toBeInTheDocument();
	});

	it('Fechar chama onFechar', () => {
		const onFechar = vi.fn();
		render(<TimelineLancamentoModal lancamento={LANCAMENTO} onFechar={onFechar} />);
		fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
		expect(onFechar).toHaveBeenCalled();
	});
});

describe('abrir o perfil pelo nome', () => {
	const COM_IDS = {
		data_lancamento: '2026-06-17T13:00:00',
		nome_usuario_lancamento: 'João José',
		id_usuario_fk_lancamento: 487,
		data_efetivacao: '2026-06-17T14:00:00',
		nome_usuario_efetivacao: 'Maria Operadora',
		id_usuario_fk_efetivacao: 1265,
	};

	it('sem onAbrirPerfil o nome é texto puro — é assim que o não-admin vê', () => {
		render(<TimelineLancamentoModal lancamento={COM_IDS} onFechar={() => {}} />);
		expect(screen.queryByRole('button', { name: 'por João José' })).not.toBeInTheDocument();
		expect(screen.getByText('por João José')).toBeInTheDocument();
	});

	it('com onAbrirPerfil o nome chama de volta com o id daquele ator', () => {
		const onAbrirPerfil = vi.fn();
		render(
			<TimelineLancamentoModal lancamento={COM_IDS} onFechar={() => {}} onAbrirPerfil={onAbrirPerfil} />
		);
		fireEvent.click(screen.getByRole('button', { name: 'por Maria Operadora' }));
		expect(onAbrirPerfil).toHaveBeenCalledWith(1265);
	});

	it('evento sem id de usuário não vira link', () => {
		// data_edicao existe mas id_usuario_fk_edicao não: é o caso dos lançamentos
		// anteriores à migração, que não têm autor de edição para abrir.
		const l = { ...COM_IDS, data_edicao: '2026-06-17T16:00:00' };
		render(<TimelineLancamentoModal lancamento={l} onFechar={() => {}} onAbrirPerfil={vi.fn()} />);
		expect(screen.getByText('por —')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'por —' })).not.toBeInTheDocument();
	});
});
