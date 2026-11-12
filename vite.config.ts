import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Caminhos relativos: o mesmo build funciona em qualquer subpasta (GitHub Pages, GitLab Pages…).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
