import { defineConfig, devices } from '@playwright/test';

const BACKEND = process.env.AMSI_BACKEND_URL || 'http://localhost:8000';

export default defineConfig({
	testDir: './e2e',
	timeout: 20_000,
	retries: 1,
	workers: 1, // sequencial — o backend permite UMA sessão por usuário (login revoga o token anterior)

	// Gate de segurança (ambiente do backend) + snapshot/limpeza do banco
	globalSetup: './e2e/global-setup.js',
	globalTeardown: './e2e/global-teardown.js',

	use: {
		baseURL: 'http://localhost:5173',
		headless: true,
		screenshot: 'only-on-failure',
		trace: 'on-first-retry', // trace viewer: npx playwright show-trace
		video: 'off',
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],

	// Sobe o servidor de dev antes de rodar os testes.
	// VITE_API_URL é forçada para o backend local — variável de processo
	// vence os arquivos .env do Vite, garantindo que a UI nunca mire produção.
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: true,
		timeout: 30_000,
		env: { ...process.env, VITE_API_URL: BACKEND },
	},
});
