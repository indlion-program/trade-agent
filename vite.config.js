import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api/screener': {
        target: 'https://scanner.tradingview.com',
        changeOrigin: true,
        rewrite: () => '/america/scan',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Origin', 'https://www.tradingview.com')
            proxyReq.setHeader('Referer', 'https://www.tradingview.com/')
          })
        },
      },
    },
  },
})
