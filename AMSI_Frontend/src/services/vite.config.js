export default {
  server: {
    proxy: {
      '/api': {
        target: 'https://bienvenu-meningitic-alejandra.ngrok-free.dev',
        changeOrigin: true,
        secure: false,
      }
    }
  }
}