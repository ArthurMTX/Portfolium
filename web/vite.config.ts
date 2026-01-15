import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
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

// Detect if running inside Docker or locally
const isDocker = process.env.DOCKER_ENV === 'true'
// Use 127.0.0.1 instead of localhost to avoid Windows DNS resolution issues
const apiTarget = isDocker ? 'http://api:8000' : 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [
    react(), 
    docsPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Portfolium - Investment Tracking',
        short_name: 'Portfolium',
        description: 'Track and analyze your investment portfolio',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\..*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false // Enable if you want to test PWA in dev mode
      }
    })
  ],
  publicDir: 'public',
  server: {
    host: true,
    port: 5173,
    watch: {
      // Only use polling inside Docker (needed for volume mounts)
      usePolling: isDocker,
      interval: 1000,
      binaryInterval: 3000,
    },
    // HMR configuration
    hmr: {
      clientPort: 5173,
      host: 'localhost',
      timeout: 30000,
    },
    proxy: {
      // Dev proxy for API requests to backend
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        xfwd: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        timeout: 60000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.log('[Proxy Error]', err.message);
            if (res && 'writeHead' in res) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ detail: 'API temporarily unavailable' }));
            }
          });
        },
      },
      // Dev proxy for logo requests - route through our API for ETF SVG support
      '/logos': {
        target: apiTarget,
        changeOrigin: true,
        xfwd: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/logos/, '/assets/logo'),
        timeout: 30000,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
