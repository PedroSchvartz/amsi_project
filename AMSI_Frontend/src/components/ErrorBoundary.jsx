import { Component } from 'react';

class ErrorBoundary extends Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, errorMessage: '', errorStack: '' };
	}

	static getDerivedStateFromError(error) {
		return {
			hasError: true,
			errorMessage: error?.message || String(error),
			errorStack: error?.stack || ''
		};
	}

	componentDidCatch(error, info) {
		console.error('[ErrorBoundary]', error, info.componentStack);
	}

	render() {
		if (!this.state.hasError) return this.props.children;

		const { errorMessage, errorStack } = this.state;

		return (
			<div
				style={{
					minHeight: '60vh',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: '16px',
					padding: '40px 20px',
					textAlign: 'center'
				}}
			>
				<i
					className="bi bi-exclamation-triangle"
					style={{ fontSize: '2.5rem', color: 'var(--primary)' }}
				/>
				<h2
					style={{
						fontFamily: 'var(--font-display)',
						fontSize: '1.3rem',
						color: 'var(--text)',
						margin: 0
					}}
				>
					Algo deu errado
				</h2>
				{errorMessage && (
					<p
						style={{
							fontSize: '0.8rem',
							color: '#b91c1c',
							background: '#fee2e2',
							border: '1px solid #fecaca',
							borderRadius: '6px',
							padding: '8px 14px',
							margin: 0,
							maxWidth: '560px',
							wordBreak: 'break-word',
							fontFamily: 'monospace'
						}}
					>
						{errorMessage}
					</p>
				)}
				{errorStack && (
					<details style={{ maxWidth: '640px', textAlign: 'left' }}>
						<summary
							style={{
								cursor: 'pointer',
								fontSize: '0.78rem',
								color: 'var(--text-muted)',
								userSelect: 'none'
							}}
						>
							Stack trace
						</summary>
						<pre
							style={{
								fontSize: '0.72rem',
								color: 'var(--text-muted)',
								background: 'var(--input-bg)',
								border: '1px solid var(--border)',
								borderRadius: '6px',
								padding: '10px',
								overflow: 'auto',
								maxHeight: '200px',
								marginTop: '6px',
								textAlign: 'left'
							}}
						>
							{errorStack}
						</pre>
					</details>
				)}
				<button
					onClick={() => { window.location.href = '/home'; }}
					style={{
						background: 'var(--primary)',
						color: '#fff',
						border: 'none',
						borderRadius: '6px',
						padding: '10px 24px',
						cursor: 'pointer',
						fontWeight: 600,
						fontSize: '0.875rem'
					}}
				>
					Voltar ao início
				</button>
			</div>
		);
	}
}

export default ErrorBoundary;
