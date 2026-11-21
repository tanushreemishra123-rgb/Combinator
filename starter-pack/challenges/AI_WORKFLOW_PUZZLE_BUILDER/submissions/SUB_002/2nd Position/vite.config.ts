/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite's config runs in Node. Declared locally rather than pulling in @types/node
// for a single lookup.
declare const process: { env: Record<string, string | undefined> };

// Hosts that serve from a domain root (Netlify, Vercel, a plain static server)
// need no base path. GitHub Pages serves from /<repo>/, so set BASE_PATH there:
//   BASE_PATH=/my-repo/ npm run build
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    // The app is one ~400 kB chunk; this keeps a reviewer's build output quiet.
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
