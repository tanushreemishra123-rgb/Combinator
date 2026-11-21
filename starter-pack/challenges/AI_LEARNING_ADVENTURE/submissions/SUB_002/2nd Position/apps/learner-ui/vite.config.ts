import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const proxy = {
  '/api': {
    target: 'http://127.0.0.1:4000',
    changeOrigin: true,
  },
  '/ollama-proxy': {
    target: 'https://ollama.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/ollama-proxy/, ''),
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy,
  },
  preview: {
    port: 5173,
    proxy,
  },
});

