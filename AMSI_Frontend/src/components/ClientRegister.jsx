import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClifor, getUsers } from '../services/api';
import { useToast } from './ToastStack.jsx';
import '../styles/clientForm.css'; /* suporte completo aos dois temas */

/* ════════════════════════════════════════
   HELPERS — Validação e Formatação
   Idênticos ao ClientEdit para consistência
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
	const [telefones, setTelefones] = useState([
		{ tipo_contato: 'Telefone', info_do_contato: '', contato_principal: true }
	]);
	const [emails, setEmails] = useState([
		{ tipo_contato: 'Email', info_do_contato: '', contato_principal: true }
	]);
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
		setEmails([{ tipo_contato: 'Email', info_do_contato: u.email, contato_principal: true }]);
	};

	const togglePrincipal = (list, setList, index) => {
		if (list[index].contato_principal && list.length === 1) return;
		setList(list.map((item, i) => ({ ...item, contato_principal: i === index })));
	};

	const toggleEnderecoPrimario = (index) => {
		if (enderecos[index].endereco_primario && enderecos.length === 1) return;
		setEnderecos(enderecos.map((end, i) => ({ ...end, endereco_primario: i === index })));
	};

	const atualizarEndereco = (index, field, value) => {
		const novos = [...enderecos];
		novos[index] = { ...novos[index], [field]: value };
		setEnderecos(novos);
		setErros((prev) => ({ ...prev, [`end_${field}_${index}`]: '' }));
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
		if (isPF) {
			if (!doc) e.cpf_cnpj = 'CPF obrigatório.';
			else if (!validarCPF(doc)) e.cpf_cnpj = 'CPF inválido.';
		}
		if (!isPF && form.pessoafisica_juridica !== '') {
			if (!doc) e.cpf_cnpj = 'CNPJ obrigatório.';
			else if (!validarCNPJ(doc)) e.cpf_cnpj = 'CNPJ inválido.';
		}
		enderecos.forEach((end, i) => {
			const n = enderecos.length > 1 ? ` (Endereço ${i + 1})` : '';
			if (!end.logradouro.trim()) e[`end_logradouro_${i}`] = `Logradouro obrigatório${n}.`;
			if (!end.numero.trim()) e[`end_numero_${i}`] = `Número obrigatório${n}.`;
			if (!end.bairro.trim()) e[`end_bairro_${i}`] = `Bairro obrigatório${n}.`;
			if (!end.cidade.trim()) e[`end_cidade_${i}`] = `Cidade obrigatória${n}.`;
			if (!end.uf) e[`end_uf_${i}`] = `UF obrigatória${n}.`;
			if (end.cep.replace(/\D/g, '').length !== 8) e[`end_cep_${i}`] = `CEP inválido${n}.`;
		});
		telefones.forEach((t, i) => {
			if (t.info_do_contato.replace(/\D/g, '').length < 10) e[`tel_${i}`] = 'Telefone inválido.';
		});
		emails.forEach((em, i) => {
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.info_do_contato.trim()))
				e[`email_${i}`] = 'Email inválido.';
		});
		setErros(e);
		if (Object.keys(e).length > 0) mostrarToasts(Object.values(e));
		return Object.keys(e).length === 0;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!validar()) return;
		const payload = {
			tipo_clifor: form.tipo_clifor,
			pessoafisica_juridica: isPF,
			nome: form.nome.trim(),
			cpf_cnpj: form.cpf_cnpj.replace(/\D/g, ''),
			rg_inscricaoestadual: form.rg_inscricaoestadual.trim(),
			datanascimento: form.datanascimento,
			ativo: form.ativo,
			id_usuario_fk: form.id_usuario_fk ? parseInt(form.id_usuario_fk) : null,
			enderecos: enderecos.map((end) => ({
				logradouro: end.logradouro.trim(),
				numero: end.numero.trim(),
				complemento: end.complemento.trim() || null,
				bairro: end.bairro.trim(),
				cidade: end.cidade.trim(),
				uf: end.uf,
				cep: end.cep.replace(/\D/g, ''),
				enderecoprimario: end.endereco_primario
			})),
			contatos: [
				...telefones.map((t) => ({
					tipocontato: 'Telefone',
					info_do_contato: t.info_do_contato.replace(/\D/g, ''),
					contato_principal: t.contato_principal
				})),
				...emails.map((em) => ({
					tipocontato: 'Email',
					info_do_contato: em.info_do_contato.trim(),
					contato_principal: em.contato_principal
				}))
			]
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
									{isPF ? 'RG' : 'Inscrição Estadual'} <span className="text-danger">*</span>
								</label>
								<input
									className={`form-control ${erros.rg_inscricaoestadual ? 'is-invalid' : ''}`}
									name="rg_inscricaoestadual"
									value={form.rg_inscricaoestadual}
									onChange={handleChange}
								/>
								{erros.rg_inscricaoestadual && (
									<div className="invalid-feedback">{erros.rg_inscricaoestadual}</div>
								)}
							</div>
							<div className="col-12 col-md-3">
								<label className="form-label">
									{isPF ? 'Data de Nascimento' : 'Data de Fundação'} <span className="text-danger">*</span>
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

				{/* ── ENDEREÇOS ── */}
				<div className="client-form-card">
					<div className="client-form-card__header">
						<span className="client-form-card__header-title">
							<i className="bi bi-geo-alt me-2" style={{ color: 'var(--primary)' }} />
							Endereços
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
										<label className="form-label">
											Logradouro <span className="text-danger">*</span>
										</label>
										<input
											className={`form-control ${erros[`end_logradouro_${i}`] ? 'is-invalid' : ''}`}
											value={end.logradouro}
											onChange={(e) => atualizarEndereco(i, 'logradouro', e.target.value)}
										/>
										{erros[`end_logradouro_${i}`] && (
											<div className="invalid-feedback">{erros[`end_logradouro_${i}`]}</div>
										)}
									</div>
									<div className="col-6 col-md-2">
										<label className="form-label">
											Número <span className="text-danger">*</span>
										</label>
										<input
											className={`form-control ${erros[`end_numero_${i}`] ? 'is-invalid' : ''}`}
											value={end.numero}
											onChange={(e) => atualizarEndereco(i, 'numero', e.target.value)}
										/>
										{erros[`end_numero_${i}`] && (
											<div className="invalid-feedback">{erros[`end_numero_${i}`]}</div>
										)}
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
										<label className="form-label">
											CEP <span className="text-danger">*</span>
										</label>
										<input
											className={`form-control ${erros[`end_cep_${i}`] ? 'is-invalid' : ''}`}
											value={end.cep}
											onChange={(e) => atualizarEndereco(i, 'cep', formatarCEP(e.target.value))}
											placeholder="00000-000"
										/>
										{erros[`end_cep_${i}`] && (
											<div className="invalid-feedback">{erros[`end_cep_${i}`]}</div>
										)}
									</div>
									<div className="col-12 col-md-4">
										<label className="form-label">
											Bairro <span className="text-danger">*</span>
										</label>
										<input
											className={`form-control ${erros[`end_bairro_${i}`] ? 'is-invalid' : ''}`}
											value={end.bairro}
											onChange={(e) => atualizarEndereco(i, 'bairro', e.target.value)}
										/>
										{erros[`end_bairro_${i}`] && (
											<div className="invalid-feedback">{erros[`end_bairro_${i}`]}</div>
										)}
									</div>
									<div className="col-12 col-md-4">
										<label className="form-label">
											Cidade <span className="text-danger">*</span>
										</label>
										<input
											className={`form-control ${erros[`end_cidade_${i}`] ? 'is-invalid' : ''}`}
											value={end.cidade}
											onChange={(e) => atualizarEndereco(i, 'cidade', e.target.value)}
										/>
										{erros[`end_cidade_${i}`] && (
											<div className="invalid-feedback">{erros[`end_cidade_${i}`]}</div>
										)}
									</div>
									<div className="col-6 col-md-2">
										<label className="form-label">
											UF <span className="text-danger">*</span>
										</label>
										<select
											className={`form-select ${erros[`end_uf_${i}`] ? 'is-invalid' : ''}`}
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
										{erros[`end_uf_${i}`] && (
											<div className="invalid-feedback">{erros[`end_uf_${i}`]}</div>
										)}
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

				{/* ── TELEFONES ── */}
				<div className="client-form-card">
					<div className="client-form-card__header">
						<span className="client-form-card__header-title">
							<i className="bi bi-telephone me-2" style={{ color: 'var(--primary)' }} />
							Telefones
						</span>
					</div>
					<div className="client-form-card__body">
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
											setErros((p) => ({ ...p, [`tel_${i}`]: '' }));
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
										<i className="bi bi-star-fill" />
									</button>
								</div>
								{telefones.length > 1 && (
									<div className="col-auto">
										<button
											type="button"
											className="btn btn-sm btn-outline-danger"
											onClick={() => {
												const novos = telefones.filter((_, j) => j !== i);
												if (novos.length > 0 && !novos.some((t) => t.contato_principal))
													novos[0] = { ...novos[0], contato_principal: true };
												setTelefones(novos);
											}}
										>
											<i className="bi bi-trash" />
										</button>
									</div>
								)}
							</div>
						))}
						<button
							type="button"
							className="client-form-btn-add"
							onClick={() =>
								setTelefones([
									...telefones,
									{ tipo_contato: 'Telefone', info_do_contato: '', contato_principal: false }
								])
							}
						>
							<i className="bi bi-plus-circle" /> Adicionar Telefone
						</button>
					</div>
				</div>

				{/* ── EMAILS ── */}
				<div className="client-form-card">
					<div className="client-form-card__header">
						<span className="client-form-card__header-title">
							<i className="bi bi-envelope me-2" style={{ color: 'var(--primary)' }} />
							Emails
						</span>
					</div>
					<div className="client-form-card__body">
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
											setErros((p) => ({ ...p, [`email_${i}`]: '' }));
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
										<i className="bi bi-star-fill" />
									</button>
								</div>
								{emails.length > 1 && (
									<div className="col-auto">
										<button
											type="button"
											className="btn btn-sm btn-outline-danger"
											onClick={() => {
												const novos = emails.filter((_, j) => j !== i);
												if (novos.length > 0 && !novos.some((e) => e.contato_principal))
													novos[0] = { ...novos[0], contato_principal: true };
												setEmails(novos);
											}}
										>
											<i className="bi bi-trash" />
										</button>
									</div>
								)}
							</div>
						))}
						<button
							type="button"
							className="client-form-btn-add"
							onClick={() =>
								setEmails([
									...emails,
									{ tipo_contato: 'Email', info_do_contato: '', contato_principal: false }
								])
							}
						>
							<i className="bi bi-plus-circle" /> Adicionar Email
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
