import { describe, expect, it } from 'vitest';
import * as architecture from './index';

/** Guards against accidentally dropping a contract export while splitting the module into files. */
describe('architecture module public API', () => {
  it('still exposes every export named in the original contract stub', () => {
    expect(architecture.CLOUD_SERVICE_CATALOG).toBeInstanceOf(Array);
    expect(typeof architecture.platformLabel).toBe('function');
    expect(typeof architecture.getCatalogService).toBe('function');
    expect(typeof architecture.servicesForPlatform).toBe('function');
    expect(typeof architecture.recommendPlatform).toBe('function');
    expect(typeof architecture.generateArchitecture).toBe('function');
    expect(typeof architecture.planArchitecture).toBe('function');
    expect(typeof architecture.buildArchitectureDiagram).toBe('function');
  });
});
