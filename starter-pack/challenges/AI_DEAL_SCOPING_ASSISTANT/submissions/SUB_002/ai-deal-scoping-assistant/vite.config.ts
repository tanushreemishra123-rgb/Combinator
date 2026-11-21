/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Folders whose tests need browser APIs (DOM, File, Blob, storage). Everything else is pure logic. */
const BROWSER_TEST_GLOBS = [
  'src/ui/**/*.test.{ts,tsx}',
  'src/app/**/*.test.{ts,tsx}',
  'src/state/**/*.test.{ts,tsx}',
  'src/ai/**/*.test.ts',
  'src/ingestion/**/*.test.ts',
  'src/export/**/*.test.ts',
];

/** Origins the optional live AI mode may call; keep in step with the endpoints in src/ai/providers/liveProvider.ts. */
const LIVE_AI_ORIGINS = ['https://generativelanguage.googleapis.com', 'https://api.groq.com', 'https://openrouter.ai'];

/**
 * The app is static and keeps a live-mode API key in the tab's sessionStorage, so the production
 * page only runs its own scripts and may only connect to itself and the three AI providers - an
 * injected script could neither load nor send the key anywhere else.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${LIVE_AI_ORIGINS.join(' ')}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/** Build-only: the dev server relies on inline scripts and a websocket for hot reload, which this policy would block. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'adsa-content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' }],
  };
}

// Single config for the dev server, the production build, and the Vitest runner.
export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 },
  build: {
    rolldownOptions: {
      output: {
        // Keep the UI shell small: third-party code, seed content and the pure engine load as separate chunks.
        advancedChunks: {
          groups: [
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|scheduler|zod)[\\/]/ },
            { name: 'seed', test: /src[\\/]seed[\\/]/ },
            {
              name: 'engine',
              test: /src[\\/](analysis|architecture|strategy|estimation|prd|impact|quality|export|traceability|scope|ingestion|ai|diagram|markup|domain)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'engine',
          globals: true,
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: BROWSER_TEST_GLOBS,
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          globals: true,
          environment: 'happy-dom',
          setupFiles: ['./src/test/setup.ts'],
          include: BROWSER_TEST_GLOBS,
          css: false,
        },
      },
    ],
  },
});
