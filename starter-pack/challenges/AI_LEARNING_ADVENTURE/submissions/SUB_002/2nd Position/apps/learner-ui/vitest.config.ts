import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    restoreFetch: true,
    include: ['src/**/*.{test,spec,smoke}.?(c|m)[jt]s?(x)'],
  },
});
