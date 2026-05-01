import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import '../styles/userregister.css';
import { createUser } from '../services/api';
import { isAdmin } from '../services/auth';

function UserRegister() {
	if (!isAdmin()) {
		return <Navigate to="/home" />;
	}

	const [form, setForm] = useState({
		nome: '',
		email: '',
		cargo: '',
		perfil_de_acesso: ''
	});

	const [erro, setErro] = useState('');
	const [sucesso, setSucesso] = useState('');

	const handleChange = (e) => {
		setForm({ ...form, [e.target.name]: e.target.value });
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setErro('');
		setSucesso('');

		try {
			await createUser(form);
			setSucesso('Usuário cadastrado com sucesso!');
			setForm({ nome: '', email: '', cargo: '', perfil_de_acesso: '' });
		} catch (err) {
			console.log(err);
			setErro(err.message || 'Erro ao cadastrar usuário');
		}
	};

	const limpar = () => setForm({ nome: '', email: '', cargo: '', perfil_de_acesso: '' });

	return (
		<div className="container">
			<div className="box">
				<h2>Cadastro de Usuários</h2>

				<form onSubmit={handleSubmit}>
					<label>Nome Completo</label>
					<input name="nome" value={form.nome} onChange={handleChange} required />

					<label>Email</label>
					<input type="email" name="email" value={form.email} onChange={handleChange} required />

					<label>Cargo</label>
					<select name="cargo" value={form.cargo} onChange={handleChange} required>
						<option value="">Selecione</option>
						<option value="Diretor">Diretor</option>
						<option value="Tesoureiro">Tesoureiro</option>
						<option value="Secretário">Secretário</option>
						<option value="Conselheiro">Conselheiro</option>
						<option value="Associado">Associado</option>
					</select>

					<label>Perfil de Acesso</label>
					<select
						name="perfil_de_acesso"
						value={form.perfil_de_acesso}
						onChange={handleChange}
						required
					>
						<option value="">Selecione</option>
						<option value="Administrador">Administrador</option>
						<option value="Consulta">Consulta</option>
					</select>

					<div className="buttons">
						<button type="button" className="cancel" onClick={limpar}>
							Cancelar
						</button>
						<button type="submit" className="save">
							Salvar
						</button>
					</div>
				</form>

				{erro && <p className="erro">{erro}</p>}
				{sucesso && <p className="sucesso">{sucesso}</p>}
			</div>
		</div>
	);
}

export default UserRegister;
