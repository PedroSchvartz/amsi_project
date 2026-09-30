/**
 * Testes unitários para src/components/RestaurarUsuarioModal.jsx
 *
 * A modal separa a reativação do envio da notificação:
 *   - "Salvar" com e-mail → onRestaurar(email) (backend cadastra + notifica)
 *   - "Cadastrar depois" → onRestaurar() sem e-mail (só reativa)
 *   - "Salvar" vazio → não chama (botão desabilitado)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import RestaurarUsuarioModal from '../components/RestaurarUsuarioModal.jsx';

const USUARIO = { id_usuario: 7, nome: 'Fulano Sem Email' };

const campoEmail = () => screen.getByPlaceholderText(/e-mail para notificação/i);
const btnSalvar = () => screen.getByRole('button', { name: 'Salvar' });
const btnDepois = () => screen.getByRole('button', { name: /Cadastrar depois/i });

describe('RestaurarUsuarioModal', () => {
	it('"Salvar" com e-mail chama onRestaurar(email)', () => {
		const onRestaurar = vi.fn();
		render(<RestaurarUsuarioModal usuario={USUARIO} onRestaurar={onRestaurar} onFechar={() => {}} />);
		fireEvent.change(campoEmail(), { target: { value: 'novo@amsi.com' } });
		fireEvent.click(btnSalvar());
		expect(onRestaurar).toHaveBeenCalledWith('novo@amsi.com');
	});

	it('"Cadastrar depois" chama onRestaurar() sem e-mail', () => {
		const onRestaurar = vi.fn();
		render(<RestaurarUsuarioModal usuario={USUARIO} onRestaurar={onRestaurar} onFechar={() => {}} />);
		fireEvent.click(btnDepois());
		expect(onRestaurar).toHaveBeenCalledTimes(1);
		expect(onRestaurar).toHaveBeenCalledWith();
	});

	it('"Salvar" vazio não chama onRestaurar', () => {
		const onRestaurar = vi.fn();
		render(<RestaurarUsuarioModal usuario={USUARIO} onRestaurar={onRestaurar} onFechar={() => {}} />);
		fireEvent.click(btnSalvar());
		expect(onRestaurar).not.toHaveBeenCalled();
	});
});
