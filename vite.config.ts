/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/sunspots/',
  build: { target: 'es2020' },
  worker: { format: 'es' },
  // Tests assert on style.css itself (the theme tokens live there), so CSS must not be stubbed out.
  test: { css: true },
});
