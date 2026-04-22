import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Deterministic, relative asset paths so the dist folder works behind
    // any IPFS gateway and when loaded via the native ipfs:// scheme.
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    target: 'es2022',
    modulePreload: {
      polyfill: false,
    },
  },
  base: './',
  server: {
    port: 5180,
  },
  preview: {
    port: 5180,
  },
});
