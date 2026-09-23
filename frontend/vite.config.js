import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // .env lives at the project root, shared with backend/, instead of one
  // copy per package.
  envDir: '..',
  server: {
    proxy: {
      // Forward API calls to the Express backend during development.
      '/api': 'http://localhost:3001',
    },
  },
})
