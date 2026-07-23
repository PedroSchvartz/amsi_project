/**
 * Testes unitários para src/components/ToastStack.jsx (ToastProvider + useToast).
 *
 * Cobre o comportamento que o componente decide sozinho:
 *   - mostrarToast renderiza um toast (sucesso/erro) e some sozinho após a duração
 *   - mostrarToast ignora mensagem vazia e deduplica (mesma mensagem + tipo)
 *   - removerToast (clique no ×) tira o toast antes do timeout
 *   - mostrarToasts renderiza a lista e some escalonado
 *
 * Sem mocks de api/auth: o componente é autocontido. Usa fake timers para os
 * setTimeout de auto-dismiss.
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../components/ToastStack.jsx';

// Componente auxiliar: expõe os métodos do contexto via botões clicáveis.
function Harness({ onReady }) {
	const ctx = useToast();
	onReady?.(ctx);
	return (
		<div>
			<button onClick={() => ctx.mostrarToast('Salvo!', 'sucesso')}>add-sucesso</button>
			<button onClick={() => ctx.mostrarToast('Falhou!', 'erro')}>add-erro</button>
			<button onClick={() => ctx.mostrarToast('', 'sucesso')}>add-vazio</button>
			<button onClick={() => ctx.mostrarToasts(['E1', 'E2'], 'erro')}>add-lista</button>
		</div>
	);
}

function renderComProvider() {
	return render(
		<ToastProvider>
			<Harness />
		</ToastProvider>
	);
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.runOnlyPendingTimers();
	vi.useRealTimers();
});

describe('ToastStack — render e useToast', () => {
	it('não renderiza nada quando não há toasts', () => {
		renderComProvider();
		expect(screen.queryByText('Salvo!')).not.toBeInTheDocument();
	});

	it('mostrarToast adiciona um toast de sucesso', () => {
		renderComProvider();
		act(() => fireEvent.click(screen.getByText('add-sucesso')));
		expect(screen.getByText('Salvo!')).toBeInTheDocument();
	});

	it('mostrarToast adiciona um toast de erro', () => {
		renderComProvider();
		act(() => fireEvent.click(screen.getByText('add-erro')));
		expect(screen.getByText('Falhou!')).toBeInTheDocument();
	});

	it('ignora mensagem vazia', () => {
		renderComProvider();
		act(() => fireEvent.click(screen.getByText('add-vazio')));
		// nenhum toast renderizado: só os botões do harness existem
		expect(screen.queryByText('×')).not.toBeInTheDocument();
	});

	it('deduplica mensagem+tipo iguais', () => {
		renderComProvider();
		act(() => fireEvent.click(screen.getByText('add-sucesso')));
		act(() => fireEvent.click(screen.getByText('add-sucesso')));
		expect(screen.getAllByText('Salvo!')).toHaveLength(1);
	});
});

describe('ToastStack — auto-dismiss e remoção manual', () => {
	it('some sozinho após a duração padrão (5000ms)', () => {
		renderComProvider();
		act(() => fireEvent.click(screen.getByText('add-sucesso')));
		expect(screen.getByText('Salvo!')).toBeInTheDocument();
		act(() => vi.advanceTimersByTime(5000));
		expect(screen.queryByText('Salvo!')).not.toBeInTheDocument();
	});

	it('clicar no × remove o toast antes do timeout', () => {
		renderComProvider();
		act(() => fireEvent.click(screen.getByText('add-erro')));
		expect(screen.getByText('Falhou!')).toBeInTheDocument();
		act(() => fireEvent.click(screen.getByText('×')));
		expect(screen.queryByText('Falhou!')).not.toBeInTheDocument();
	});

	it('mostrarToasts renderiza a lista e some escalonado', () => {
		renderComProvider();
		act(() => fireEvent.click(screen.getByText('add-lista')));
		expect(screen.getByText('E1')).toBeInTheDocument();
		expect(screen.getByText('E2')).toBeInTheDocument();
		// E1 dura 5s, E2 dura 6s
		act(() => vi.advanceTimersByTime(5000));
		expect(screen.queryByText('E1')).not.toBeInTheDocument();
		expect(screen.getByText('E2')).toBeInTheDocument();
		act(() => vi.advanceTimersByTime(1000));
		expect(screen.queryByText('E2')).not.toBeInTheDocument();
	});
});
