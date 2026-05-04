import { useState, useEffect } from 'react';
import { createClifor, getUsers } from '../services/api';

const FORM_INICIAL = {
	tipo_clifor: '',
	pessoafisica_juridica: '',
	nome: '',
	cpf_cnpj: '',
	rg_inscricaoestadual: '',
	datanascimento: '',
	id_usuario_fk: '',
	ativo: true,
	inadimplente: false
};

const ENDERECO_INICIAL = {
	logradouro: '',
	numero: '',
	complemento: '',
	bairro: '',
	cidade: '',
	uf: '',
	cep: '',
	endereco_primario: true
};

const novoContato = (tipo) => ({
	tipo_contato: tipo,
	info_do_contato: '',
	contato_principal: false
});

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

function ClientRegister() {
	const [form, setForm] = useState(FORM_INICIAL);
	const [enderecos, setEnderecos] = useState([{ ...ENDERECO_INICIAL }]);
	const [telefones, setTelefones] = useState([
		{ tipo_contato: 'Telefone', info_do_contato: '', contato_principal: true }
	]);
	const [emails, setEmails] = useState([
		{ tipo_contato: 'Email', info_do_contato: '', contato_principal: true }
	]);
	const [usuarios, setUsuarios] = useState([]);
	const [erros, setErros] = useState({});
	const [erro, setErro] = useState('');
	const [sucesso, setSucesso] = useState('');

	useEffect(() => {
		getUsers()
			.then(setUsuarios)
			.catch(() => {});
	}, []);

	const isPF = form.pessoafisica_juridica === 'true' || form.pessoafisica_juridica === true;

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
		setErros((prev) => ({ ...prev, [name]: '' }));
	};

	const togglePrincipal = (list, setList, index) => {
		const jaE = list[index].contato_principal;
		setList(
			list.map((item, i) => ({
				...item,
				contato_principal: jaE ? false : i === index
			}))
		);
	};

	const toggleEnderecoPrimario = (index) => {
		const jaE = enderecos[index].endereco_primario;
		setEnderecos(
			enderecos.map((end, i) => ({
				...end,
				endereco_primario: jaE ? false : i === index
			}))
		);
	};

	const atualizarEndereco = (index, field, value) => {
		const novos = [...enderecos];
		novos[index] = { ...novos[index], [field]: value };
		setEnderecos(novos);
		setErros((prev) => ({ ...prev, [`end_${field}_${index}`]: '' }));
	};

	const validar = () => {
		const e = {};
		if (!form.tipo_clifor) e.tipo_clifor = 'Selecione o tipo.';
		if (form.pessoafisica_juridica === '')
			e.pessoafisica_juridica = 'Selecione pessoa física ou jurídica.';
		if (!form.nome.trim() || form.nome.trim().length < 3)
			e.nome = 'Nome deve ter pelo menos 3 caracteres.';
		if (!form.datanascimento) e.datanascimento = 'Data de nascimento obrigatória.';
		if (!form.rg_inscricaoestadual.trim())
			e.rg_inscricaoestadual = isPF ? 'RG obrigatório.' : 'Inscrição Estadual obrigatória.';

		const doc = form.cpf_cnpj.replace(/\D/g, '');
		if (isPF && !validarCPF(doc)) e.cpf_cnpj = 'CPF inválido.';
		if (!isPF && form.pessoafisica_juridica !== '' && !validarCNPJ(doc))
			e.cpf_cnpj = 'CNPJ inválido.';

		enderecos.forEach((end, i) => {
			if (!end.logradouro.trim()) e[`end_logradouro_${i}`] = 'Obrigatório.';
			if (!end.numero.trim()) e[`end_numero_${i}`] = 'Obrigatório.';
			if (!end.bairro.trim()) e[`end_bairro_${i}`] = 'Obrigatório.';
			if (!end.cidade.trim()) e[`end_cidade_${i}`] = 'Obrigatório.';
			if (!end.uf) e[`end_uf_${i}`] = 'Obrigatório.';
			if (end.cep.replace(/\D/g, '').length !== 8) e[`end_cep_${i}`] = 'CEP inválido.';
		});

		telefones.forEach((t, i) => {
			if (t.info_do_contato.replace(/\D/g, '').length < 10) e[`tel_${i}`] = 'Telefone inválido.';
		});

		emails.forEach((em, i) => {
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.info_do_contato.trim()))
				e[`email_${i}`] = 'Email inválido.';
		});

		setErros(e);
		return Object.keys(e).length === 0;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setErro('');
		setSucesso('');
		if (!validar()) return;

		const payload = {
			tipo_clifor: form.tipo_clifor,
			pessoafisica_juridica: isPF,
			nome: form.nome.trim(),
			cpf_cnpj: form.cpf_cnpj.replace(/\D/g, ''),
			rg_inscricaoestadual: form.rg_inscricaoestadual.trim(),
			datanascimento: form.datanascimento,
			ativo: form.ativo,
			inadimplente: form.inadimplente,
			id_usuario_fk: form.id_usuario_fk ? parseInt(form.id_usuario_fk) : null,
			enderecos: enderecos.map((end) => ({
				logradouro: end.logradouro.trim(),
				numero: end.numero.trim(),
				complemento: end.complemento.trim() || null,
				bairro: end.bairro.trim(),
				cidade: end.cidade.trim(),
				uf: end.uf,
				cep: end.cep.replace(/\D/g, ''),
				endereco_primario: end.endereco_primario
			})),
			contatos: [
				...telefones.map((t) => ({
					tipo_contato: 'Telefone',
					info_do_contato: t.info_do_contato.replace(/\D/g, ''),
					contato_principal: t.contato_principal
				})),
				...emails.map((em) => ({
					tipo_contato: 'Email',
					info_do_contato: em.info_do_contato.trim(),
					contato_principal: em.contato_principal
				}))
			]
		};

		try {
			await createClifor(payload);
			setSucesso('Cliente/Fornecedor cadastrado com sucesso!');
			setForm(FORM_INICIAL);
			setEnderecos([{ ...ENDERECO_INICIAL }]);
			setTelefones([{ tipo_contato: 'Telefone', info_do_contato: '', contato_principal: true }]);
			setEmails([{ tipo_contato: 'Email', info_do_contato: '', contato_principal: true }]);
			setErros({});
		} catch (err) {
			setErro(err.message || 'Erro ao cadastrar.');
		}
	};

	const limpar = () => {
		setForm(FORM_INICIAL);
		setEnderecos([{ ...ENDERECO_INICIAL }]);
		setTelefones([{ tipo_contato: 'Telefone', info_do_contato: '', contato_principal: true }]);
		setEmails([{ tipo_contato: 'Email', info_do_contato: '', contato_principal: true }]);
		setErros({});
		setErro('');
		setSucesso('');
	};

	return (
		<div
			className="container-fluid py-4 px-3 px-md-4"
			style={{ background: '#f8f9fa', minHeight: '100vh' }}
		>
			<h4 className="fw-bold mb-4">Cadastro de Cliente / Fornecedor</h4>

			{sucesso && <div className="alert alert-success alert-dismissible">{sucesso}</div>}
			{erro && <div className="alert alert-danger alert-dismissible">{erro}</div>}

			<form onSubmit={handleSubmit}>
				{/* INFORMAÇÕES BÁSICAS */}
				<div className="card border-0 shadow-sm mb-4">
					<div className="card-header bg-white border-bottom py-3 px-4">
						<h6 className="fw-semibold mb-0">Informações Básicas</h6>
					</div>
					<div className="card-body p-4">
						{/* Tipo CliFor + Pessoa Física/Jurídica na mesma linha */}
						<div className="row g-4 mb-4">
							<div className="col-12 col-md-auto">
								<label className="form-label small fw-semibold">
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
								<label className="form-label small fw-semibold">
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

						<div className="row g-3">
							<div className="col-12 col-md-6">
								<label className="form-label small fw-semibold">
									Nome Completo / Razão Social <span className="text-danger">*</span>
								</label>
								<input
									className={`form-control ${erros.nome ? 'is-invalid' : ''}`}
									name="nome"
									value={form.nome}
									onChange={handleChange}
									placeholder="Nome completo ou razão social"
								/>
								{erros.nome && <div className="invalid-feedback">{erros.nome}</div>}
							</div>

							<div className="col-12 col-md-3">
								<label className="form-label small fw-semibold">
									{isPF ? 'CPF' : 'CNPJ'} <span className="text-danger">*</span>
								</label>
								<input
									className={`form-control ${erros.cpf_cnpj ? 'is-invalid' : ''}`}
									name="cpf_cnpj"
									value={form.cpf_cnpj}
									onChange={(e) => {
										const val = isPF ? formatarCPF(e.target.value) : formatarCNPJ(e.target.value);
										setForm((prev) => ({ ...prev, cpf_cnpj: val }));
										setErros((prev) => ({ ...prev, cpf_cnpj: '' }));
									}}
									placeholder={isPF ? '000.000.000-00' : '00.000.000/0000-00'}
								/>
								{erros.cpf_cnpj && <div className="invalid-feedback">{erros.cpf_cnpj}</div>}
							</div>

							<div className="col-12 col-md-3">
								<label className="form-label small fw-semibold">
									{isPF ? 'RG' : 'Inscrição Estadual'} <span className="text-danger">*</span>
								</label>
								<input
									className={`form-control ${erros.rg_inscricaoestadual ? 'is-invalid' : ''}`}
									name="rg_inscricaoestadual"
									value={form.rg_inscricaoestadual}
									onChange={handleChange}
									placeholder={isPF ? 'RG' : 'Inscrição Estadual'}
								/>
								{erros.rg_inscricaoestadual && (
									<div className="invalid-feedback">{erros.rg_inscricaoestadual}</div>
								)}
							</div>

							<div className="col-12 col-md-3">
								<label className="form-label small fw-semibold">
									Data de Nascimento <span className="text-danger">*</span>
								</label>
								<input
									type="date"
									className={`form-control ${erros.datanascimento ? 'is-invalid' : ''}`}
									name="datanascimento"
									value={form.datanascimento}
									onChange={handleChange}
								/>
								{erros.datanascimento && (
									<div className="invalid-feedback">{erros.datanascimento}</div>
								)}
							</div>

							<div className="col-12 col-md-5">
								<label className="form-label small fw-semibold">
									Vincular a Usuário <span className="text-muted fw-normal">(opcional)</span>
								</label>
								<select
									className="form-select"
									name="id_usuario_fk"
									value={form.id_usuario_fk}
									onChange={handleChange}
								>
									<option value="">Nenhum</option>
									{usuarios.map((u) => (
										<option key={u.id_usuario} value={u.id_usuario}>
											{u.nome} ({u.email})
										</option>
									))}
								</select>
							</div>

							<div className="col-12 col-md-4 d-flex align-items-end gap-4 pb-1">
								<div className="form-check">
									<input
										type="checkbox"
										className="form-check-input"
										id="ativo"
										name="ativo"
										checked={form.ativo}
										onChange={handleChange}
									/>
									<label className="form-check-label" htmlFor="ativo">
										Ativo
									</label>
								</div>
								<div className="form-check">
									<input
										type="checkbox"
										className="form-check-input"
										id="inadimplente"
										name="inadimplente"
										checked={form.inadimplente}
										onChange={handleChange}
									/>
									<label className="form-check-label" htmlFor="inadimplente">
										Inadimplente
									</label>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* ENDEREÇOS */}
				<div className="card border-0 shadow-sm mb-4">
					<div className="card-header bg-white border-bottom py-3 px-4">
						<h6 className="fw-semibold mb-0">Endereços</h6>
					</div>
					<div className="card-body p-4">
						{enderecos.map((end, i) => (
							<div
								key={i}
								className={`p-3 mb-3 rounded border ${end.endereco_primario ? 'border-dark' : ''}`}
							>
								<div className="d-flex justify-content-between align-items-center mb-3">
									<span className="small fw-semibold">
										Endereço {i + 1}
										{end.endereco_primario && <span className="badge bg-dark ms-2">Principal</span>}
									</span>
									<div className="d-flex gap-2">
										<button
											type="button"
											className={`btn btn-sm ${end.endereco_primario ? 'btn-warning' : 'btn-outline-secondary'}`}
											style={{ width: 38 }}
											onClick={() => toggleEnderecoPrimario(i)}
											title="Marcar como principal"
										>
											<i className="bi bi-star-fill"></i>
										</button>
										{enderecos.length > 1 && (
											<button
												type="button"
												className="btn btn-sm btn-outline-danger"
												onClick={() => setEnderecos(enderecos.filter((_, j) => j !== i))}
											>
												<i className="bi bi-trash"></i>
											</button>
										)}
									</div>
								</div>

								<div className="row g-2">
									<div className="col-12 col-md-7">
										<label className="form-label small">
											Logradouro <span className="text-danger">*</span>
										</label>
										<input
											className={`form-control form-control-sm ${erros[`end_logradouro_${i}`] ? 'is-invalid' : ''}`}
											value={end.logradouro}
											onChange={(e) => atualizarEndereco(i, 'logradouro', e.target.value)}
											placeholder="Rua, Avenida..."
										/>
										{erros[`end_logradouro_${i}`] && (
											<div className="invalid-feedback">{erros[`end_logradouro_${i}`]}</div>
										)}
									</div>
									<div className="col-6 col-md-2">
										<label className="form-label small">
											Número <span className="text-danger">*</span>
										</label>
										<input
											className={`form-control form-control-sm ${erros[`end_numero_${i}`] ? 'is-invalid' : ''}`}
											value={end.numero}
											onChange={(e) => atualizarEndereco(i, 'numero', e.target.value)}
										/>
										{erros[`end_numero_${i}`] && (
											<div className="invalid-feedback">{erros[`end_numero_${i}`]}</div>
										)}
									</div>
									<div className="col-6 col-md-3">
										<label className="form-label small">Complemento</label>
										<input
											className="form-control form-control-sm"
											value={end.complemento}
											onChange={(e) => atualizarEndereco(i, 'complemento', e.target.value)}
											placeholder="Apto, Sala..."
										/>
									</div>
									<div className="col-12 col-md-4">
										<label className="form-label small">
											Bairro <span className="text-danger">*</span>
										</label>
										<input
											className={`form-control form-control-sm ${erros[`end_bairro_${i}`] ? 'is-invalid' : ''}`}
											value={end.bairro}
											onChange={(e) => atualizarEndereco(i, 'bairro', e.target.value)}
										/>
										{erros[`end_bairro_${i}`] && (
											<div className="invalid-feedback">{erros[`end_bairro_${i}`]}</div>
										)}
									</div>
									<div className="col-12 col-md-4">
										<label className="form-label small">
											Cidade <span className="text-danger">*</span>
										</label>
										<input
											className={`form-control form-control-sm ${erros[`end_cidade_${i}`] ? 'is-invalid' : ''}`}
											value={end.cidade}
											onChange={(e) => atualizarEndereco(i, 'cidade', e.target.value)}
										/>
										{erros[`end_cidade_${i}`] && (
											<div className="invalid-feedback">{erros[`end_cidade_${i}`]}</div>
										)}
									</div>
									<div className="col-4 col-md-2">
										<label className="form-label small">
											UF <span className="text-danger">*</span>
										</label>
										<select
											className={`form-select form-select-sm ${erros[`end_uf_${i}`] ? 'is-invalid' : ''}`}
											value={end.uf}
											onChange={(e) => atualizarEndereco(i, 'uf', e.target.value)}
										>
											<option value="">UF</option>
											{UFS.map((uf) => (
												<option key={uf} value={uf}>
													{uf}
												</option>
											))}
										</select>
										{erros[`end_uf_${i}`] && (
											<div className="invalid-feedback">{erros[`end_uf_${i}`]}</div>
										)}
									</div>
									<div className="col-8 col-md-2">
										<label className="form-label small">
											CEP <span className="text-danger">*</span>
										</label>
										<input
											className={`form-control form-control-sm ${erros[`end_cep_${i}`] ? 'is-invalid' : ''}`}
											value={end.cep}
											onChange={(e) => atualizarEndereco(i, 'cep', formatarCEP(e.target.value))}
											placeholder="00000-000"
										/>
										{erros[`end_cep_${i}`] && (
											<div className="invalid-feedback">{erros[`end_cep_${i}`]}</div>
										)}
									</div>
								</div>
							</div>
						))}
						<button
							type="button"
							className="btn btn-outline-dark btn-sm mt-2"
							onClick={() =>
								setEnderecos([...enderecos, { ...ENDERECO_INICIAL, endereco_primario: false }])
							}
						>
							<i className="bi bi-plus me-1"></i>Adicionar Endereço
						</button>
					</div>
				</div>

				{/* TELEFONES */}
				<div className="card border-0 shadow-sm mb-4">
					<div className="card-header bg-white border-bottom py-3 px-4">
						<h6 className="fw-semibold mb-0">Telefones</h6>
					</div>
					<div className="card-body p-4">
						{telefones.map((tel, i) => (
							<div key={i} className="row g-2 align-items-center mb-3">
								<div className="col">
									<input
										className={`form-control ${erros[`tel_${i}`] ? 'is-invalid' : ''}`}
										value={tel.info_do_contato}
										onChange={(e) => {
											const n = [...telefones];
											n[i] = { ...n[i], info_do_contato: formatarTelefone(e.target.value) };
											setTelefones(n);
											setErros((prev) => ({ ...prev, [`tel_${i}`]: '' }));
										}}
										placeholder="(00) 00000-0000"
									/>
									{erros[`tel_${i}`] && (
										<div className="invalid-feedback d-block">{erros[`tel_${i}`]}</div>
									)}
								</div>
								<div className="col-auto">
									<button
										type="button"
										className={`btn btn-sm ${tel.contato_principal ? 'btn-warning' : 'btn-outline-secondary'}`}
										style={{ width: 38 }}
										onClick={() => togglePrincipal(telefones, setTelefones, i)}
										title="Marcar como principal"
									>
										<i className="bi bi-star-fill"></i>
									</button>
								</div>
								{telefones.length > 1 && (
									<div className="col-auto">
										<button
											type="button"
											className="btn btn-sm btn-outline-danger"
											onClick={() => setTelefones(telefones.filter((_, j) => j !== i))}
										>
											<i className="bi bi-trash"></i>
										</button>
									</div>
								)}
							</div>
						))}
						<button
							type="button"
							className="btn btn-outline-dark btn-sm mt-2"
							onClick={() => setTelefones([...telefones, novoContato('Telefone')])}
						>
							<i className="bi bi-plus me-1"></i>Adicionar Telefone
						</button>
					</div>
				</div>

				{/* EMAILS */}
				<div className="card border-0 shadow-sm mb-4">
					<div className="card-header bg-white border-bottom py-3 px-4">
						<h6 className="fw-semibold mb-0">Emails</h6>
					</div>
					<div className="card-body p-4">
						{emails.map((em, i) => (
							<div key={i} className="row g-2 align-items-center mb-3">
								<div className="col">
									<input
										type="email"
										className={`form-control ${erros[`email_${i}`] ? 'is-invalid' : ''}`}
										value={em.info_do_contato}
										onChange={(e) => {
											const n = [...emails];
											n[i] = { ...n[i], info_do_contato: e.target.value };
											setEmails(n);
											setErros((prev) => ({ ...prev, [`email_${i}`]: '' }));
										}}
										placeholder="email@exemplo.com"
									/>
									{erros[`email_${i}`] && (
										<div className="invalid-feedback d-block">{erros[`email_${i}`]}</div>
									)}
								</div>
								<div className="col-auto">
									<button
										type="button"
										className={`btn btn-sm ${em.contato_principal ? 'btn-warning' : 'btn-outline-secondary'}`}
										style={{ width: 38 }}
										onClick={() => togglePrincipal(emails, setEmails, i)}
										title="Marcar como principal"
									>
										<i className="bi bi-star-fill"></i>
									</button>
								</div>
								{emails.length > 1 && (
									<div className="col-auto">
										<button
											type="button"
											className="btn btn-sm btn-outline-danger"
											onClick={() => setEmails(emails.filter((_, j) => j !== i))}
										>
											<i className="bi bi-trash"></i>
										</button>
									</div>
								)}
							</div>
						))}
						<button
							type="button"
							className="btn btn-outline-dark btn-sm mt-2"
							onClick={() => setEmails([...emails, novoContato('Email')])}
						>
							<i className="bi bi-plus me-1"></i>Adicionar Email
						</button>
					</div>
				</div>

				{/* BOTÕES */}
				<div className="d-flex flex-column flex-sm-row justify-content-end gap-3 mb-4">
					<button type="button" className="btn btn-outline-secondary px-4" onClick={limpar}>
						Limpar
					</button>
					<button type="submit" className="btn btn-dark px-5">
						Salvar
					</button>
				</div>
			</form>
		</div>
	);
}

export default ClientRegister;
