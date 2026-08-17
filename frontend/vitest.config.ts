/// <reference types="vitest" />
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // e2e/ holds Playwright specs, which must not be collected by vitest
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
