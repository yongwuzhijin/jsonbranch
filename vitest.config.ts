import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@jsonbranch/json-core': path.resolve('packages/json-core/src/index.ts'),
      '@jsonbranch/json-view': path.resolve('packages/json-view/src/index.ts')
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'packages/**/*.test.ts', 'packages/**/*.test.tsx', 'apps/**/*.test.ts', 'apps/**/*.test.tsx'],
    exclude: ['**/*.e2e.ts', '**/dist/**', '**/node_modules/**', '**/release/**']
  }
})
