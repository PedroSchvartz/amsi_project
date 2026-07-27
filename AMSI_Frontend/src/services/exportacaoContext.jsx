import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
	iniciarExportacao,
	statusExportacao,
	baixarExportacao,
	enviarExportacaoEmail,
	cancelarExportacao
} from './api';
import { useToast } from '../components/ToastStack';

const ExportacaoContext = createContext(null);

// Provider global da exportação de lançamentos. Fica ACIMA do BrowserRouter para o
// job sobreviver à navegação entre páginas e à modal fechada: download automático e
// e-mail seguem em background e entregam o arquivo quando a pesquisa termina.
export function ExportacaoProvider({ children }) {
	// job ativo: { jobId, entrega, status } — entrega ∈ 'download-auto'|'download-botao'|'email'
	const [job, setJob] = useState(null);
	const jobRef = useRef(null);
	const { mostrarToast } = useToast();

	useEffect(() => {
		jobRef.current = job;
	}, [job]);

	// Ao terminar o job, entrega conforme a opção escolhida (lida do ref, sempre atual).
	const finalizar = async (status) => {
		const atual = jobRef.current;
		if (!atual) return;

		if (status === 'concluido') {
			if (atual.entrega === 'email') {
				try {
					await enviarExportacaoEmail(atual.jobId);
					mostrarToast('Exportação enviada para o seu e-mail.');
				} catch (e) {
					mostrarToast(e.message || 'Falha ao enviar o e-mail.', 'erro');
				}
				setJob(null);
			} else if (atual.entrega === 'download-botao') {
				// Mantém o job para a modal exibir o botão "Baixar".
				setJob({ ...atual, status: 'concluido' });
			} else {
				// download-auto
				try {
					await baixarExportacao(atual.jobId);
					mostrarToast('Exportação concluída — download iniciado.');
				} catch (e) {
					mostrarToast(e.message || 'Falha ao baixar a exportação.', 'erro');
				}
				setJob(null);
			}
		} else if (status === 'erro') {
			mostrarToast('Falha ao gerar a exportação.', 'erro');
			setJob(null);
		} else if (status === 'cancelado') {
			setJob(null);
		}
	};

	// Polling enquanto o job está processando.
	useEffect(() => {
		if (!job || job.status !== 'processando') return;
		let ativo = true;
		const timer = setInterval(async () => {
			try {
				const { status } = await statusExportacao(job.jobId);
				if (!ativo) return;
				if (status === 'processando') return;
				clearInterval(timer);
				await finalizar(status);
			} catch {
				// Erro transitório de rede — tenta de novo no próximo tick.
			}
		}, 1500);
		return () => {
			ativo = false;
			clearInterval(timer);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [job?.jobId, job?.status]);

	// Inicia a exportação. entrega padrão = download automático. → true se começou.
	const iniciar = async (filtros, entrega = 'download-auto') => {
		try {
			const { job_id } = await iniciarExportacao(filtros);
			setJob({ jobId: job_id, entrega, status: 'processando' });
			return true;
		} catch (e) {
			if (e.message !== 'sessao-expirada')
				mostrarToast(e.message || 'Falha ao iniciar a exportação.', 'erro');
			return false;
		}
	};

	const trocarEntrega = (entrega) => setJob((j) => (j ? { ...j, entrega } : j));

	const cancelar = async () => {
		const atual = jobRef.current;
		if (!atual) return;
		try {
			await cancelarExportacao(atual.jobId);
		} catch {
			// mesmo que a chamada falhe, largamos o job local
		}
		setJob(null);
	};

	// Baixa o arquivo pronto (opção "botão de download") e encerra o job.
	const baixarAgora = async () => {
		const atual = jobRef.current;
		if (!atual) return;
		try {
			await baixarExportacao(atual.jobId);
		} catch (e) {
			mostrarToast(e.message || 'Falha ao baixar a exportação.', 'erro');
			return;
		}
		setJob(null);
	};

	return (
		<ExportacaoContext.Provider
			value={{ job, iniciar, trocarEntrega, cancelar, baixarAgora }}
		>
			{children}
		</ExportacaoContext.Provider>
	);
}

export function useExportacao() {
	return useContext(ExportacaoContext);
}
