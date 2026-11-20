import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: path.resolve('apps/macos/src/main/index.ts'),
    outDir: path.resolve('apps/macos/dist/main'),
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron']
    }
  }
})
