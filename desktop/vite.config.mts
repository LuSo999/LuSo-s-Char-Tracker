// The desktop app's renderer: a React page built from desktop/renderer, sharing the export
// engine and the mapping editor with the web app (../src).
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const here = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: here,
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom', 'react-i18next', 'i18next', 'zod', 'pdf-lib', 'pdfjs-dist'] },
  server: { port: 5299, strictPort: true, fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2023', chunkSizeWarningLimit: 4000 },
})
