import { afterEach } from 'vitest';
import {
  remountAdminPage,
  renderAdminPage,
  type AdminIntegrationRuntime,
  type RenderAdminOptions,
} from '../harness.tsx';

export function integrationTestContext() {
  const runtimes: AdminIntegrationRuntime[] = [];

  afterEach(async () => {
    for (const runtime of runtimes.splice(0).reverse()) await runtime.close();
  });

  async function create(options: RenderAdminOptions = {}): Promise<AdminIntegrationRuntime> {
    const runtime = await renderAdminPage(options);
    runtimes.push(runtime);
    return runtime;
  }

  function mount(runtime: AdminIntegrationRuntime, route = runtime.currentPath): void {
    remountAdminPage(runtime, route);
  }

  return { create, mount };
}
