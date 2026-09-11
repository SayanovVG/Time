import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({ root: root + 'planner', base: './', publicDir: root + 'planner/public', plugins: [react()], resolve: { alias: { '@': root } }, build: { outDir: root + 'planner-dist', emptyOutDir: true, sourcemap: false } });
