import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No GitHub Pages o site fica em /<repo>/; VITE_BASE é definido no workflow de deploy.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
