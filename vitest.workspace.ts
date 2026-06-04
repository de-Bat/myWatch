import { defineWorkspace } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineWorkspace([
  {
    test: {
      name: 'packages-and-api',
      include: [
        'packages/*/tests/**/*.test.ts',
        'apps/api/tests/**/*.test.ts',
      ],
      globals: true,
      environment: 'node',
    },
  },
  {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'apps/web/src'),
      },
    },
    test: {
      name: 'web',
      include: ['apps/web/tests/**/*.test.ts'],
      globals: true,
      environment: 'jsdom',
      setupFiles: [path.resolve(__dirname, 'apps/web/tests/setup.ts')],
    },
  },
])
