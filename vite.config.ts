import { defineConfig } from 'vite';

export default defineConfig({
  base: '/sunspots/',
  build: { target: 'es2020' },
  worker: { format: 'es' },
});
