import { afterEach } from 'vitest';
import type { PortableProgressSnapshot } from '@ai-learning-adventure/types';
import {
  remountApp,
  renderIntegrationApp,
  type IntegrationApp,
  type RenderIntegrationOptions,
} from '../harness.tsx';
import { importProgress } from './api.ts';

export function integrationTestContext() {
  const runtimes: IntegrationApp[] = [];

  afterEach(async () => {
    for (const runtime of runtimes.splice(0).reverse()) {
      await runtime.close();
    }
  });

  async function create(options: RenderIntegrationOptions = {}): Promise<IntegrationApp> {
    const runtime = await renderIntegrationApp(options);
    runtimes.push(runtime);
    return runtime;
  }

  async function createWithProgress(
    snapshot: PortableProgressSnapshot,
    options: Omit<RenderIntegrationOptions, 'deferRender'> = {},
  ): Promise<IntegrationApp> {
    const runtime = await create({ ...options, deferRender: true });
    await importProgress(runtime, snapshot);
    remountApp(runtime);
    return runtime;
  }

  return { create, createWithProgress, mount: remountApp };
}
