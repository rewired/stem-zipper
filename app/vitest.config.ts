import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: [
      'electron/**/*.test.ts',
      'electron/**/__tests__/**/*.{test,spec}.ts',
      'scripts/**/__tests__/**/*.{test,spec}.ts',
      'common/**/__tests__/**/*.{test,spec}.ts',
      'src/**/__tests__/**/*.{test,spec}.ts',
      'src/**/__tests__/**/*.{test,spec}.tsx'
    ],
    environmentMatchGlobs: [
      ['src/**', 'jsdom']
    ],
    coverage: {
      reporter: ['text', 'html'],
      enabled: false
    }
  },
  resolve: {
    alias: {
      '@common': path.resolve(__dirname, './common'),
      'wavesurfer.js': path.resolve(__dirname, './src/__mocks__/wavesurfer.ts')
    }
  }
});
