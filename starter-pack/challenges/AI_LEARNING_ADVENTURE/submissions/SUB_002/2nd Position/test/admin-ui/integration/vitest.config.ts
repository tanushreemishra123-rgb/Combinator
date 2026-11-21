import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const adminSource = fileURLToPath(new URL('../../../apps/admin-ui/src', import.meta.url));
const helpers = fileURLToPath(new URL('./helpers/', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: 'next/router', replacement: `${helpers}mock-next-router.ts` },
      { find: 'next/link', replacement: `${helpers}mock-next-link.tsx` },
      { find: /^@\//, replacement: `${adminSource}/` },
    ],
  },
  test: {
    environment: 'jsdom',
    restoreMocks: true,
    setupFiles: ['./helpers/environment.ts'],
  },
});
