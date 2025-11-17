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
        // Serve docs files directly
        let filePath = path.join(__dirname, 'public', req.url)
        
        // Handle directory requests - redirect to trailing slash or serve index.html
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          // If URL doesn't end with /, redirect to add trailing slash
          // This preserves the correct base path for relative URLs in HTML
          if (!req.url.endsWith('/')) {
            res.writeHead(301, { 'Location': req.url + '/' })
            res.end()
            return
          }
          // Otherwise serve the index.html from the directory
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
      // Inside Docker container: use 'api:8000' (Docker service name)
      '/api': {
        target: 'http://api:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Dev proxy for logo requests - route through our API for ETF SVG support
      '/logos': {
        target: 'http://api:8000',
        changeOrigin: true,
        secure: false,
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
