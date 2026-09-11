import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: root + 'pages',
  base: './',
  publicDir: root + 'public',
  plugins: [react()],
  resolve: { alias: { '@': root } },
  build: { outDir: root + 'github-pages', emptyOutDir: true, sourcemap: false },
});
