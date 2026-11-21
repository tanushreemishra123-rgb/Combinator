import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { cleanup, render, type RenderResult } from '@testing-library/react';
import { Provider } from 'react-redux';
import { mutate, SWRConfig } from 'swr';
import { afterEach, vi } from 'vitest';
import { createApp, type App } from '../../../apps/api/src/app.ts';
import { AppBootstrap } from '../../../apps/learner-ui/src/app/AppBootstrap.tsx';
import { ErrorBoundary } from '../../../apps/learner-ui/src/app/ErrorBoundary.tsx';
import {
  createAppStore,
  type AppStore,
} from '../../../apps/learner-ui/src/store/index.ts';

const LEARNER_ID_STORAGE_KEY = 'learner-ui.learner-id.v1';
const missionDataDir = resolve(process.cwd(), 'fixtures', 'mission-data');
const nativeNodeFetch = globalThis.fetch;

export interface IntegrationApp {
  app: App;
  baseUrl: string;
  learnerId: string;
  requestUrls: string[];
  serverLog: string[];
  rendered: RenderResult;
  store: AppStore;
  apiFetch: typeof fetch;
  swrCache: Map<unknown, unknown>;
  close: () => Promise<void>;
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('The integration API did not bind to a TCP port.'));
        return;
      }
      resolve(address.port);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  server.closeAllConnections?.();
  server.closeIdleConnections?.();
  return new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}

export interface RenderIntegrationOptions {
  learnerId?: string | null;
  deferRender?: boolean;
}

const createEmptySwrCache = () => new Map();

export async function renderIntegrationApp(
  options: RenderIntegrationOptions = {},
): Promise<IntegrationApp> {
  const { learnerId = `learner-integration-${randomUUID()}`, deferRender = false } = options;
  const app = createApp({
    host: '127.0.0.1',
    port: 0,
    databaseFile: ':memory:',
    missionDataDir,
    corsOrigin: '*',
    bodyLimitBytes: 256 * 1024,
    schemaVersion: 1,
  });
  const server = createServer((req, res) => {
    serverLog.push(`${req.method ?? 'GET'} ${req.url ?? '/'}`);
    app.handler(req, res);
  });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  const requestUrls: string[] = [];
  const serverLog: string[] = [];
  const apiFetch: typeof fetch = (input, init) => {
    const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requestUrls.push(target);
    if (target.startsWith('/api/v1')) return nativeNodeFetch(`${baseUrl}${target}`, { ...init, cache: 'no-store' });
    if (target.startsWith(baseUrl)) return nativeNodeFetch(target, { ...init, cache: 'no-store' });
    throw new Error(`Unexpected external request in learner integration test: ${target}`);
  };

  vi.stubGlobal('fetch', apiFetch);
  if (learnerId !== null) {
    localStorage.setItem(
      LEARNER_ID_STORAGE_KEY,
      JSON.stringify({ version: 1, learnerId }),
    );
  }

  let rendered: RenderResult | undefined;
  let store: AppStore | undefined;
  if (!deferRender) {
    store = createAppStore();
    rendered = render(
      <Provider store={store}>
        <SWRConfig value={{ provider: createEmptySwrCache, dedupingInterval: 0 }}>
          <ErrorBoundary>
            <AppBootstrap />
          </ErrorBoundary>
        </SWRConfig>
      </Provider>,
    );
  }

  const runtime: IntegrationApp = {
    app,
    baseUrl,
    learnerId: learnerId ?? 'learner-integration-1',
    requestUrls,
    serverLog,
    rendered: rendered as RenderResult,
    store: store as AppStore,
    apiFetch,
    swrCache: (cache as Map<unknown, unknown>),
    close: async () => {
      runtime.rendered?.unmount();
      vi.unstubAllGlobals();
      (cache as Map<unknown, unknown>).clear();
      (defaultConfig.cache as Map<unknown, unknown>).clear();
      await closeServer(server);
      app.close();
    },
  };
  return runtime;
}

export function remountApp(runtime: IntegrationApp): void {
  runtime.rendered?.unmount();
  const store = createAppStore();
  const rendered = render(
    <Provider store={store}>
      <SWRConfig value={{ provider: createEmptySwrCache, dedupingInterval: 0 }}>
        <ErrorBoundary>
          <AppBootstrap />
        </ErrorBoundary>
      </SWRConfig>
    </Provider>,
  );
  runtime.rendered = rendered;
  runtime.store = store;
}

import { cache, defaultConfig } from 'swr/_internal';
import { resetPreviewMode } from '../../../apps/learner-ui/src/preview/previewMode.ts';
import { resetLiveAnnouncement } from '../../../apps/learner-ui/src/hooks/ui/useLiveAnnouncement.ts';

Element.prototype.scrollIntoView = vi.fn();

afterEach(async () => {
  cleanup();
  resetPreviewMode();
  resetLiveAnnouncement();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  (cache as Map<unknown, unknown>).clear();
  (defaultConfig.cache as Map<unknown, unknown>).clear();
  await mutate(() => true, undefined, { revalidate: false });
});
