import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/koenig-api': {
        target: 'https://api.koenig-solutions.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/koenig-api/, ''),
      },
    },
  },
})
