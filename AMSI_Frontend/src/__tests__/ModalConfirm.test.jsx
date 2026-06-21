/**
 * Testes unitários para src/components/ModalConfirm.jsx
 * Cobre: render de título/mensagem/botões (defaults e custom), callbacks
 * confirmar/cancelar, clique no overlay = cancelar (mas clique na caixa não,
 * por stopPropagation) e o estado desabilitado do botão de confirmar.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import ModalConfirm from '../components/ModalConfirm';

describe('ModalConfirm — render', () => {
	it('mostra título, mensagem e os textos padrão dos botões', () => {
		render(<ModalConfirm mensagem="Tem certeza?" />);
		expect(screen.getByRole('heading', { name: 'Confirmar' })).toBeInTheDocument(); // título padrão (h5)
		expect(screen.getByText('Tem certeza?')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
	});

	it('respeita textos customizados de título e botões', () => {
		render(
			<ModalConfirm
				titulo="Excluir lançamento"
				mensagem="Essa ação não pode ser desfeita."
				textoBotaoConfirmar="Excluir"
				textoBotaoCancelar="Voltar"
			/>
		);
		expect(screen.getByText('Excluir lançamento')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
	});
});

describe('ModalConfirm — interações', () => {
	it('clicar em confirmar dispara onConfirmar (e não onCancelar)', () => {
		const onConfirmar = vi.fn();
		const onCancelar = vi.fn();
		render(<ModalConfirm mensagem="x" onConfirmar={onConfirmar} onCancelar={onCancelar} />);
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
		expect(onConfirmar).toHaveBeenCalledTimes(1);
		expect(onCancelar).not.toHaveBeenCalled();
	});

	it('clicar em cancelar dispara onCancelar', () => {
		const onCancelar = vi.fn();
		render(<ModalConfirm mensagem="x" onCancelar={onCancelar} />);
		fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
		expect(onCancelar).toHaveBeenCalledTimes(1);
	});

	it('clicar no overlay (fora da caixa) dispara onCancelar', () => {
		const onCancelar = vi.fn();
		const { container } = render(<ModalConfirm mensagem="x" onCancelar={onCancelar} />);
		fireEvent.click(container.firstChild); // o overlay externo
		expect(onCancelar).toHaveBeenCalledTimes(1);
	});

	it('clicar dentro da caixa NÃO dispara onCancelar (stopPropagation)', () => {
		const onCancelar = vi.fn();
		render(<ModalConfirm titulo="Título" mensagem="x" onCancelar={onCancelar} />);
		fireEvent.click(screen.getByText('Título')); // dentro da caixa, não é botão
		expect(onCancelar).not.toHaveBeenCalled();
	});
});

describe('ModalConfirm — desabilitado', () => {
	it('quando desabilitado, o botão de confirmar fica disabled e não dispara onConfirmar', () => {
		const onConfirmar = vi.fn();
		render(<ModalConfirm mensagem="x" onConfirmar={onConfirmar} desabilitado />);
		const btn = screen.getByRole('button', { name: 'Confirmar' });
		expect(btn).toBeDisabled();
		fireEvent.click(btn);
		expect(onConfirmar).not.toHaveBeenCalled();
	});
});
