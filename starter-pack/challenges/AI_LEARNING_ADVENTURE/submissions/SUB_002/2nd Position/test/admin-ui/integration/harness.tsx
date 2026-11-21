import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, type RenderResult } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, vi } from 'vitest';
import { createApp, type App } from '../../../apps/api/src/app.ts';
import { AdminRoute } from './AdminRoute.tsx';
import { TestRouterProvider } from './helpers/router.tsx';

function resolveMissionDataDir(): string {
  const candidates = [
    resolve(process.cwd(), 'apps/api/mission-data'),
    resolve(process.cwd(), '../../apps/api/mission-data'),
    resolve(process.cwd(), '../../../apps/api/mission-data'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return resolve(process.cwd(), 'apps/api/mission-data');
}

const missionDataDir = resolveMissionDataDir();
const nativeNodeFetch = globalThis.fetch;

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('The admin integration API did not bind to a TCP port.'));
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

export interface RenderAdminOptions {
  route?: string;
  deferRender?: boolean;
}

export interface AdminIntegrationRuntime {
  app: App;
  baseUrl: string;
  apiFetch: typeof fetch;
  requestUrls: string[];
  serverLog: string[];
  routeHistory: string[];
  currentPath: string;
  rendered: RenderResult | undefined;
  swrCache: Map<string, any>;
  close: () => Promise<void>;
}

function renderRuntime(runtime: AdminIntegrationRuntime, route: string): RenderResult {
  runtime.currentPath = route;
  runtime.swrCache.clear();
  return render(
    <SWRConfig
      value={{
        provider: () => runtime.swrCache,
        dedupingInterval: 0,
        errorRetryCount: 0,
        shouldRetryOnError: false,
      }}
    >
      <TestRouterProvider
        initialPath={route}
        onNavigate={(next) => {
          runtime.currentPath = next;
          runtime.routeHistory.push(next);
        }}
      >
        <AdminRoute />
      </TestRouterProvider>
    </SWRConfig>,
  );
}

export async function renderAdminPage(
  options: RenderAdminOptions = {},
): Promise<AdminIntegrationRuntime> {
  const route = options.route ?? '/missions';
  const app = createApp({
    host: '127.0.0.1',
    port: 0,
    databaseFile: ':memory:',
    missionDataDir,
    corsOrigin: '*',
    bodyLimitBytes: 2 * 1024 * 1024,
    schemaVersion: 1,
  });
  const serverLog: string[] = [];
  const server = createServer((req, res) => {
    serverLog.push(`${req.method ?? 'GET'} ${req.url ?? '/'}`);
    app.handler(req, res);
  });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  const requestUrls: string[] = [];
  const apiFetch: typeof fetch = (input, init) => {
    const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requestUrls.push(target);
    if (target.startsWith('/api/v1')) {
      return nativeNodeFetch(`${baseUrl}${target}`, { ...init, cache: 'no-store' });
    }
    if (target.startsWith(baseUrl)) {
      return nativeNodeFetch(target, { ...init, cache: 'no-store' });
    }
    throw new Error(`Unexpected external request in admin integration test: ${target}`);
  };
  vi.stubGlobal('fetch', apiFetch);

  const runtime: AdminIntegrationRuntime = {
    app,
    baseUrl,
    apiFetch,
    requestUrls,
    serverLog,
    routeHistory: [route],
    currentPath: route,
    rendered: undefined,
    swrCache: new Map(),
    close: async () => {
      runtime.rendered?.unmount();
      runtime.swrCache.clear();
      vi.unstubAllGlobals();
      await closeServer(server);
      app.close();
    },
  };

  if (options.deferRender !== true) runtime.rendered = renderRuntime(runtime, route);
  return runtime;
}

export function remountAdminPage(runtime: AdminIntegrationRuntime, route = runtime.currentPath): void {
  runtime.rendered?.unmount();
  runtime.rendered = renderRuntime(runtime, route);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
