import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['electron/**/*.test.ts', 'electron/**/__tests__/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      enabled: false
    }
  },
  resolve: {
    alias: {
      '@common': path.resolve(__dirname, './common')
    }
  }
});
