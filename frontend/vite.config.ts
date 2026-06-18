import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@vladmandic/face-api') || id.includes('@tensorflow')) {
            return 'face-api'
          }
          if (id.includes('recharts')) {
            return 'recharts'
          }
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/')) {
              return 'vendor-react'
            }
            if (id.includes('react-router')) {
              return 'vendor-router'
            }
            if (id.includes('lucide-react')) {
              return 'icons'
            }
            if (id.includes('axios')) {
              return 'vendor-axios'
            }
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:5001',
      '/uploads': 'http://127.0.0.1:5001',
    },
  },
})
