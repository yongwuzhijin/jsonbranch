import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: path.resolve('apps/macos/src/renderer'),
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    outDir: path.resolve('apps/macos/dist/renderer'),
    emptyOutDir: true
  }
})
