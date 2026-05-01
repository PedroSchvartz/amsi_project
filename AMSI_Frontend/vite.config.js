import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})

export default defineConfig({
  server: {
    force: true, // ⚡ sempre regenera o cache ao iniciar
  },
  optimizeDeps: {
    force: true, // 🔥 força re-bundle das deps sempre
  },
})