import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/helpers/setup.js'],
    include: ['test/**/*.test.js'],
    restoreMocks: false,
  },
  esbuild: { jsx: 'automatic' },
})
