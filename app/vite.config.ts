import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@common': path.resolve(__dirname, './common')
    }
  },
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
