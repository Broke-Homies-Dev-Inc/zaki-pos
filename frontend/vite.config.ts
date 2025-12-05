import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // This is the important change:
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5172,
    strictPort: true,
    allowedHosts: ['hdz.stevefez.com']
  }
})
