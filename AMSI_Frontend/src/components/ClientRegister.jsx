import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClifor, getUsers } from '../services/api';
import { useToast } from './ToastStack.jsx';
import '../styles/clientForm.css'; /* suporte completo aos dois temas */

/* ════════════════════════════════════════
   HELPERS — Validação e Formatação
   ════════════════════════════════════════ */
const ENDERECO_VAZIO = {
	logradouro: '',
	numero: '',
	complemento: '',
	bairro: '',
	cidade: '',
	uf: '',
	cep: '',
	endereco_primario: true
};

const CONTATO_VAZIO = { tipo_contato: 'Email', info_do_contato: '', contato_principal: true };

const FORM_INICIAL = {
	tipo_clifor: '',
	pessoafisica_juridica: 'true',
	nome: '',
	cpf_cnpj: '',
	rg_inscricaoestadual: '',
	datanascimento: '',
	id_usuario_fk: '',
	ativo: true
};

const validarCPF = (cpf) => {
	const n = cpf.replace(/\D/g, '');
	if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
	let sum = 0;
	for (let i = 0; i < 9; i++) sum += parseInt(n[i]) * (10 - i);
	let r = (sum * 10) % 11;
	if (r === 10 || r === 11) r = 0;
	if (r !== parseInt(n[9])) return false;
	sum = 0;
	for (let i = 0; i < 10; i++) sum += parseInt(n[i]) * (11 - i);
	r = (sum * 10) % 11;
	if (r === 10 || r === 11) r = 0;
	return r === parseInt(n[10]);
};

const validarCNPJ = (cnpj) => {
	const n = cnpj.replace(/\D/g, '');
	if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
	const calc = (len) => {
		let sum = 0,
			pos = len - 7;
		for (let i = len; i >= 1; i--) {
			sum += parseInt(n[len - i]) * pos--;
			if (pos < 2) pos = 9;
		}
		return sum % 11 < 2 ? 0 : 11 - (sum % 11);
	};
	return calc(12) === parseInt(n[12]) && calc(13) === parseInt(n[13]);
};

const formatarCPF = (v) => {
	const n = v.replace(/\D/g, '').slice(0, 11);
	if (n.length <= 3) return n;
	if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
	if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
	return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
};
const formatarCNPJ = (v) => {
	const n = v.replace(/\D/g, '').slice(0, 14);
	if (n.length <= 2) return n;
	if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
	if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
	if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`;
	return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
};
const formatarCEP = (v) => {
	const n = v.replace(/\D/g, '').slice(0, 8);
	if (n.length <= 5) return n;
	return `${n.slice(0, 5)}-${n.slice(5)}`;
};
const formatarTelefone = (v) => {
	const n = v.replace(/\D/g, '').slice(0, 11);
	if (n.length <= 2) return n;
	if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
	if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
	return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
};

const UFS = [
	'AC',
	'AL',
	'AM',
	'AP',
	'BA',
	'CE',
	'DF',
	'ES',
	'GO',
	'MA',
	'MG',
	'MS',
	'MT',
	'PA',
	'PB',
	'PE',
	'PI',
	'PR',
	'RJ',
	'RN',
	'RO',
	'RR',
	'RS',
	'SC',
	'SE',
	'SP',
	'TO'
];

/* ════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ════════════════════════════════════════ */
function ClientRegister() {
	const navigate = useNavigate();
	const { mostrarToast, mostrarToasts } = useToast();

	const [form, setForm] = useState(FORM_INICIAL);
	const [enderecos, setEnderecos] = useState([{ ...ENDERECO_VAZIO }]);
	const [contatos, setContatos] = useState([{ ...CONTATO_VAZIO }]);
	const [usuarios, setUsuarios] = useState([]);
	const [erros, setErros] = useState({});

	useEffect(() => {
		getUsers()
			.then(setUsuarios)
			.catch(() => {});
	}, []);

	const isPF = form.pessoafisica_juridica === 'true';

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
		setErros((prev) => ({ ...prev, [name]: '' }));
	};

	const handleUsuarioChange = (e) => {
		const id = e.target.value;
		if (!id) {
			setForm((prev) => ({ ...prev, id_usuario_fk: id }));
			return;
		}
		const u = usuarios.find((u) => String(u.id_usuario) === id);
		if (!u) return;
		setForm((prev) => ({ ...prev, id_usuario_fk: id, nome: u.nome }));
		setContatos([{ tipo_contato: 'Email', info_do_contato: u.email, contato_principal: true }]);
	};

	/* ── Contatos (telefone + email unificados, uma única estrela) ── */
	const toggleContatoPrincipal = (index) => {
		setContatos((prev) => prev.map((c, i) => ({ ...c, contato_principal: i === index })));
	};

	const mudarTipoContato = (index, tipo) => {
		setContatos((prev) => {
			const novos = [...prev];
			// troca de tipo limpa o valor (a máscara muda entre telefone e email)
			novos[index] = { ...novos[index], tipo_contato: tipo, info_do_contato: '' };
			return novos;
		});
		setErros((p) => ({ ...p, [`contato_${index}`]: '' }));
	};

	const atualizarContato = (index, value) => {
		setContatos((prev) => {
			const novos = [...prev];
			const tipo = novos[index].tipo_contato;
			novos[index] = {
				...novos[index],
				info_do_contato: tipo === 'Telefone' ? formatarTelefone(value) : value
			};
			return novos;
		});
		setErros((p) => ({ ...p, [`contato_${index}`]: '' }));
	};

	const removerContato = (index) => {
		setContatos((prev) => {
			const novos = prev.filter((_, j) => j !== index);
			// garante que sempre reste um principal entre os contatos existentes
			if (novos.length > 0 && !novos.some((c) => c.contato_principal))
				novos[0] = { ...novos[0], contato_principal: true };
			return novos;
		});
	};

	const adicionarContato = () =>
		setContatos((prev) => [
			...prev,
			{ tipo_contato: 'Email', info_do_contato: '', contato_principal: prev.length === 0 }
		]);

	/* ── Endereços (nada obrigatório) ── */
	const toggleEnderecoPrimario = (index) => {
		if (enderecos[index].endereco_primario && enderecos.length === 1) return;
		setEnderecos(enderecos.map((end, i) => ({ ...end, endereco_primario: i === index })));
	};

	const atualizarEndereco = (index, field, value) => {
		const novos = [...enderecos];
		novos[index] = { ...novos[index], [field]: value };
		setEnderecos(novos);
		if (field === 'cep') {
			const digits = value.replace(/\D/g, '');
			if (digits.length === 8) {
				fetch(`https://viacep.com.br/ws/${digits}/json/`)
					.then((r) => r.json())
					.then((data) => {
						if (data.erro) return;
						setEnderecos((prev) => {
							const atualizado = [...prev];
							atualizado[index] = {
								...atualizado[index],
								logradouro: data.logradouro || atualizado[index].logradouro,
								bairro: data.bairro || atualizado[index].bairro,
								cidade: data.localidade || atualizado[index].cidade,
								uf: data.uf || atualizado[index].uf
							};
							return atualizado;
						});
					})
					.catch(() => {});
			}
		}
	};

	/* ── Validação: só os 4 campos essenciais + formato de contatos preenchidos ── */
	const validar = () => {
		const e = {};
		if (!form.tipo_clifor) e.tipo_clifor = 'Selecione o tipo.';
		if (form.pessoafisica_juridica === '')
			e.pessoafisica_juridica = 'Selecione pessoa física ou jurídica.';
		if (!form.nome.trim() || form.nome.trim().length < 3)
			e.nome = 'Nome deve ter pelo menos 3 caracteres.';
		const doc = form.cpf_cnpj.replace(/\D/g, '');
		if (isPF) {
			if (!doc) e.cpf_cnpj = 'CPF obrigatório.';
			else if (!validarCPF(doc)) e.cpf_cnpj = 'CPF inválido.';
		}
		if (!isPF && form.pessoafisica_juridica !== '') {
			if (!doc) e.cpf_cnpj = 'CNPJ obrigatório.';
			else if (!validarCNPJ(doc)) e.cpf_cnpj = 'CNPJ inválido.';
		}
		// Contatos são opcionais; só validamos o formato dos que foram preenchidos.
		contatos.forEach((c, i) => {
			const v = c.info_do_contato.trim();
			if (!v) return;
			if (c.tipo_contato === 'Telefone' && v.replace(/\D/g, '').length < 10)
				e[`contato_${i}`] = 'Telefone inválido.';
			if (c.tipo_contato === 'Email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
				e[`contato_${i}`] = 'Email inválido.';
		});
		// Endereços: absolutamente nada obrigatório → sem validação.
		setErros(e);
		if (Object.keys(e).length > 0) mostrarToasts(Object.values(e));
		return Object.keys(e).length === 0;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!validar()) return;

		// Só envia contatos preenchidos; garante um principal entre eles.
		const contatosPreenchidos = contatos.filter((c) => c.info_do_contato.trim() !== '');
		if (contatosPreenchidos.length > 0 && !contatosPreenchidos.some((c) => c.contato_principal))
			contatosPreenchidos[0] = { ...contatosPreenchidos[0], contato_principal: true };

		// Só envia endereços com pelo menos um campo preenchido.
		const enderecosPreenchidos = enderecos.filter((end) =>
			['logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep'].some(
				(f) => (end[f] || '').trim() !== ''
			)
		);

		const payload = {
			tipo_clifor: form.tipo_clifor,
			pessoafisica_juridica: isPF,
			nome: form.nome.trim(),
			cpf_cnpj: form.cpf_cnpj.replace(/\D/g, ''),
			rg_inscricaoestadual: form.rg_inscricaoestadual.trim() || null,
			datanascimento: form.datanascimento || null,
			ativo: form.ativo,
			id_usuario_fk: form.id_usuario_fk ? parseInt(form.id_usuario_fk) : null,
			enderecos: enderecosPreenchidos.map((end) => ({
				logradouro: end.logradouro.trim(),
				numero: end.numero.trim(),
				complemento: end.complemento.trim() || null,
				bairro: end.bairro.trim(),
				cidade: end.cidade.trim(),
				uf: end.uf,
				cep: end.cep.replace(/\D/g, ''),
				enderecoprimario: end.endereco_primario
			})),
			contatos: contatosPreenchidos.map((c) => ({
				tipocontato: c.tipo_contato,
				info_do_contato:
					c.tipo_contato === 'Telefone'
						? c.info_do_contato.replace(/\D/g, '')
						: c.info_do_contato.trim(),
				contato_principal: c.contato_principal
			}))
		};
		try {
			await createClifor(payload);
			mostrarToast('Cliente/Fornecedor cadastrado com sucesso!');
			window.scrollTo({ top: 0, behavior: 'smooth' });
			setTimeout(() => navigate('/cliente_fornecedor'), 1500);
		} catch (err) {
			mostrarToast(err.message || 'Erro ao cadastrar', 'erro');
		}
	};

	/* ════════════════════════════════════════
	   RENDER
	   ════════════════════════════════════════ */
	return (
		<div className="client-form-container">
			{/* ── Cabeçalho ── */}
			<div className="client-form-header">
				<button
					type="button"
					className="client-form-header__back"
					onClick={() => navigate('/cliente_fornecedor')}
					title="Voltar"
				>
					<i className="bi bi-arrow-left" />
				</button>
				<h4 className="client-form-header__title">Novo Cliente / Fornecedor</h4>
			</div>

			<form onSubmit={handleSubmit}>
				{/* ── INFORMAÇÕES BÁSICAS ── */}
				<div className="client-form-card">
					<div className="client-form-card__header">
						<span className="client-form-card__header-title">
							<i className="bi bi-person-vcard me-2" style={{ color: 'var(--primary)' }} />
							Informações Básicas
						</span>
					</div>
					<div className="client-form-card__body">
						{/* Tipo de clifor + tipo de pessoa */}
						<div className="row g-4 mb-4">
							<div className="col-12 col-md-auto">
								<label className="form-label">
									Tipo <span className="text-danger">*</span>
								</label>
								<div className="d-flex flex-wrap gap-4">
									{[
										['C', 'Cliente'],
										['F', 'Fornecedor'],
										['A', 'Ambos']
									].map(([val, label]) => (
										<div key={val} className="form-check">
											<input
												className="form-check-input"
												type="radio"
												name="tipo_clifor"
												id={`tipo_${val}`}
												value={val}
												checked={form.tipo_clifor === val}
												onChange={handleChange}
											/>
											<label className="form-check-label" htmlFor={`tipo_${val}`}>
												{label}
											</label>
										</div>
									))}
								</div>
								{erros.tipo_clifor && (
									<div className="text-danger small mt-1">{erros.tipo_clifor}</div>
								)}
							</div>
							<div className="col-12 col-md-auto">
								<label className="form-label">
									Tipo de Pessoa <span className="text-danger">*</span>
								</label>
								<div className="d-flex flex-wrap gap-4">
									{[
										['true', 'Pessoa Física'],
										['false', 'Pessoa Jurídica']
									].map(([val, label]) => (
										<div key={val} className="form-check">
											<input
												className="form-check-input"
												type="radio"
												name="pessoafisica_juridica"
												id={`pf_${val}`}
												value={val}
												checked={form.pessoafisica_juridica === val}
												onChange={handleChange}
											/>
											<label className="form-check-label" htmlFor={`pf_${val}`}>
												{label}
											</label>
										</div>
									))}
								</div>
								{erros.pessoafisica_juridica && (
									<div className="text-danger small mt-1">{erros.pessoafisica_juridica}</div>
								)}
							</div>
						</div>

						{/* Campos principais */}
						<div className="row g-3">
							<div className="col-12 col-md-6">
								<label className="form-label">
									{isPF ? 'Nome Completo' : 'Razão Social'} <span className="text-danger">*</span>
								</label>
								<input
									className={`form-control ${erros.nome ? 'is-invalid' : ''}`}
									name="nome"
									value={form.nome}
									onChange={handleChange}
									placeholder={isPF ? 'Nome completo' : 'Razão social'}
								/>
								{erros.nome && <div className="invalid-feedback">{erros.nome}</div>}
							</div>
							<div className="col-12 col-md-3">
								<label className="form-label">
									{isPF ? 'CPF' : 'CNPJ'} <span className="text-danger">*</span>
								</label>
								<input
									className={`form-control ${erros.cpf_cnpj ? 'is-invalid' : ''}`}
									name="cpf_cnpj"
									value={form.cpf_cnpj}
									onChange={(e) => {
										const val = isPF ? formatarCPF(e.target.value) : formatarCNPJ(e.target.value);
										setForm((p) => ({ ...p, cpf_cnpj: val }));
										setErros((p) => ({ ...p, cpf_cnpj: '' }));
									}}
									placeholder={isPF ? '000.000.000-00' : '00.000.000/0000-00'}
								/>
								{erros.cpf_cnpj && <div className="invalid-feedback">{erros.cpf_cnpj}</div>}
							</div>
							<div className="col-12 col-md-3">
								<label className="form-label">
									{isPF ? 'RG' : 'Inscrição Estadual'}{' '}
									<span className="text-muted fw-normal">(opcional)</span>
								</label>
								<input
									className="form-control"
									name="rg_inscricaoestadual"
									value={form.rg_inscricaoestadual}
									onChange={handleChange}
								/>
							</div>
							<div className="col-12 col-md-3">
								<label className="form-label">
									{isPF ? 'Data de Nascimento' : 'Data de Fundação'}{' '}
									<span className="text-muted fw-normal">(opcional)</span>
								</label>
								<input
									type="date"
									className="form-control"
									name="datanascimento"
									value={form.datanascimento}
									onChange={handleChange}
								/>
							</div>
							<div className="col-12 col-md-5">
								<label className="form-label">
									Vincular a Usuário <span className="text-muted fw-normal">(opcional)</span>
								</label>
								<select
									className="form-select"
									name="id_usuario_fk"
									value={form.id_usuario_fk}
									onChange={handleUsuarioChange}
								>
									<option value="">Nenhum</option>
									{usuarios.map((u) => (
										<option key={u.id_usuario} value={u.id_usuario}>
											{u.nome} ({u.email})
										</option>
									))}
								</select>
							</div>
						</div>
					</div>
				</div>

				{/* ── ENDEREÇOS (nada obrigatório) ── */}
				<div className="client-form-card">
					<div className="client-form-card__header">
						<span className="client-form-card__header-title">
							<i className="bi bi-geo-alt me-2" style={{ color: 'var(--primary)' }} />
							Endereços <span className="text-muted fw-normal small">(opcional)</span>
						</span>
					</div>
					<div className="client-form-card__body">
						{enderecos.map((end, i) => (
							<div
								key={i}
								className={`client-form-subsection ${end.endereco_primario ? 'client-form-subsection--destaque' : ''}`}
							>
								<div className="d-flex justify-content-between align-items-center mb-3">
									<span className="small fw-semibold" style={{ color: 'var(--text)' }}>
										Endereço {i + 1}
										{end.endereco_primario && (
											<span className="client-form-badge-principal ms-2">
												<i className="bi bi-star-fill" /> Principal
											</span>
										)}
									</span>
									<div className="d-flex gap-2">
										{!end.endereco_primario && (
											<button
												type="button"
												className="btn btn-sm btn-outline-secondary"
												onClick={() => toggleEnderecoPrimario(i)}
												title="Definir como principal"
											>
												<i className="bi bi-star" />
											</button>
										)}
										{enderecos.length > 1 && !end.endereco_primario && (
											<button
												type="button"
												className="btn btn-sm btn-outline-danger"
												onClick={() => setEnderecos(enderecos.filter((_, j) => j !== i))}
											>
												<i className="bi bi-trash" />
											</button>
										)}
									</div>
								</div>
								<div className="row g-2">
									<div className="col-12 col-md-5">
										<label className="form-label">Logradouro</label>
										<input
											className="form-control"
											value={end.logradouro}
											onChange={(e) => atualizarEndereco(i, 'logradouro', e.target.value)}
										/>
									</div>
									<div className="col-6 col-md-2">
										<label className="form-label">Número</label>
										<input
											className="form-control"
											value={end.numero}
											onChange={(e) => atualizarEndereco(i, 'numero', e.target.value)}
										/>
									</div>
									<div className="col-6 col-md-3">
										<label className="form-label">Complemento</label>
										<input
											className="form-control"
											value={end.complemento}
											onChange={(e) => atualizarEndereco(i, 'complemento', e.target.value)}
										/>
									</div>
									<div className="col-12 col-md-2">
										<label className="form-label">CEP</label>
										<input
											className="form-control"
											value={end.cep}
											onChange={(e) => atualizarEndereco(i, 'cep', formatarCEP(e.target.value))}
											placeholder="00000-000"
										/>
									</div>
									<div className="col-12 col-md-4">
										<label className="form-label">Bairro</label>
										<input
											className="form-control"
											value={end.bairro}
											onChange={(e) => atualizarEndereco(i, 'bairro', e.target.value)}
										/>
									</div>
									<div className="col-12 col-md-4">
										<label className="form-label">Cidade</label>
										<input
											className="form-control"
											value={end.cidade}
											onChange={(e) => atualizarEndereco(i, 'cidade', e.target.value)}
										/>
									</div>
									<div className="col-6 col-md-2">
										<label className="form-label">UF</label>
										<select
											className="form-select"
											value={end.uf}
											onChange={(e) => atualizarEndereco(i, 'uf', e.target.value)}
										>
											<option value="">—</option>
											{UFS.map((uf) => (
												<option key={uf} value={uf}>
													{uf}
												</option>
											))}
										</select>
									</div>
								</div>
							</div>
						))}
						<button
							type="button"
							className="client-form-btn-add"
							onClick={() =>
								setEnderecos([...enderecos, { ...ENDERECO_VAZIO, endereco_primario: false }])
							}
						>
							<i className="bi bi-plus-circle" /> Adicionar Endereço
						</button>
					</div>
				</div>

				{/* ── CONTATO (telefones + emails unificados) ── */}
				<div className="client-form-card">
					<div className="client-form-card__header">
						<span className="client-form-card__header-title">
							<i className="bi bi-person-lines-fill me-2" style={{ color: 'var(--primary)' }} />
							Contato <span className="text-muted fw-normal small">(opcional)</span>
						</span>
					</div>
					<div className="client-form-card__body">
						<p className="small text-muted mb-3">
							A estrela marca o contato principal — pode ser um telefone ou um email.
						</p>
						{contatos.map((c, i) => (
							<div key={i} className="row g-2 align-items-center mb-3">
								<div className="col-12 col-sm-auto">
									<select
										className="form-select"
										style={{ minWidth: 130 }}
										value={c.tipo_contato}
										onChange={(e) => mudarTipoContato(i, e.target.value)}
									>
										<option value="Telefone">Telefone</option>
										<option value="Email">Email</option>
									</select>
								</div>
								<div className="col">
									<input
										type={c.tipo_contato === 'Email' ? 'email' : 'text'}
										className={`form-control ${erros[`contato_${i}`] ? 'is-invalid' : ''}`}
										value={c.info_do_contato}
										onChange={(e) => atualizarContato(i, e.target.value)}
										placeholder={c.tipo_contato === 'Email' ? 'email@exemplo.com' : '(00) 00000-0000'}
									/>
									{erros[`contato_${i}`] && (
										<div className="invalid-feedback d-block">{erros[`contato_${i}`]}</div>
									)}
								</div>
								<div className="col-auto">
									<button
										type="button"
										className={`btn btn-sm ${c.contato_principal ? 'btn-warning' : 'btn-outline-secondary'}`}
										style={{ width: 38 }}
										onClick={() => toggleContatoPrincipal(i)}
										title="Marcar como contato principal"
									>
										<i className="bi bi-star-fill" />
									</button>
								</div>
								{contatos.length > 1 && (
									<div className="col-auto">
										<button
											type="button"
											className="btn btn-sm btn-outline-danger"
											onClick={() => removerContato(i)}
										>
											<i className="bi bi-trash" />
										</button>
									</div>
								)}
							</div>
						))}
						<button type="button" className="client-form-btn-add" onClick={adicionarContato}>
							<i className="bi bi-plus-circle" /> Adicionar Contato
						</button>
					</div>
				</div>

				{/* ── BOTÕES DE AÇÃO ── */}
				<div className="client-form-actions">
					<button
						type="button"
						className="client-form-btn-cancelar"
						onClick={() => navigate('/cliente_fornecedor')}
					>
						Cancelar
					</button>
					<button type="submit" className="client-form-btn-salvar">
						<i className="bi bi-check-lg me-1" />
						Cadastrar
					</button>
				</div>
			</form>
		</div>
	);
}

export default ClientRegister;
