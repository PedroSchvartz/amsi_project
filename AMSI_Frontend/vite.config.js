import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./src/__tests__/setup.js'],
		include: ['src/**/*.test.{js,jsx}'],
		// Sem isto o histórico de chamadas vaza de um teste para o outro e um
		// not.toHaveBeenCalled() falha por chamada de teste anterior.
		clearMocks: true,
	},
});
