import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true
    },
    proxy: {
      // Dev proxy for API requests to backend
      // Try Docker hostname first, fall back to localhost
      '/api': {
        target: 'http://api:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Dev proxy for logo requests to avoid CORS and mimic prod path
      '/logos': {
        target: 'https://cdn.brandfetch.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/logos/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
