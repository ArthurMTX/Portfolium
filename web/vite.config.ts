import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Plugin to serve docs directory
const docsPlugin = (): Plugin => ({
  name: 'docs-server',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/docs')) {
        // Handle /docs -> /docs/ redirect (to preserve base path for relative URLs)
        if (req.url === '/docs') {
          res.writeHead(301, { 'Location': '/docs/' })
          res.end()
          return
        }
        
        // Handle /docs/ -> serve index.html
        if (req.url === '/docs/') {
          const indexPath = path.join(__dirname, 'public/docs/index.html')
          if (fs.existsSync(indexPath)) {
            res.setHeader('Content-Type', 'text/html')
            res.end(fs.readFileSync(indexPath))
            return
          }
        }
        
        // Serve docs files directly
        let filePath = path.join(__dirname, 'public', req.url)
        
        // Handle directory requests - serve index.html
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html')
        }
        
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath)
          const contentTypes: Record<string, string> = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.xml': 'application/xml',
            '.gz': 'application/gzip'
          }
          
          res.setHeader('Content-Type', contentTypes[ext] || 'text/plain')
          res.end(fs.readFileSync(filePath))
          return
        }
      }
      next()
    })
  }
})

export default defineConfig({
  plugins: [react(), docsPlugin()],
  publicDir: 'public',
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
      // Dev proxy for logo requests - route through our API for ETF SVG support
      '/logos': {
        target: 'http://api:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/logos/, '/assets/logo'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
