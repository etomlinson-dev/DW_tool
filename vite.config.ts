import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // KYI backend runs on port 5050
      '/api/kyi': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
      // Main DW Outreach backend runs on port 5001
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
