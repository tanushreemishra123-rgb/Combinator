import { describe, expect, it, vi } from 'vitest';
import type { ArchitectureContext } from '../ai/types';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';
import { CLOUD_SERVICE_CATALOG } from './catalog/cloudServiceCatalog.data';
import { architectureTask } from './prompt';

/**
 * prompt.ts's unit tests mock the shared prompt-kit helpers in src/ai rather than depend on that
 * module's runtime behaviour, so a prompt-kit change cannot break these tests. Vitest hoists vi.mock calls
 * above every import in this file, so `./prompt` sees the mocked `../ai` when it loads.
 */
vi.mock('../ai', () => ({
  buildSystemPrompt: (role: string) => `SYSTEM:${role}`,
  describeCustomerForPrompt: () => 'CUSTOMER_BLOCK',
  describeConfigForPrompt: () => 'CONFIG_BLOCK',
  describeScopeForPrompt: () => 'SCOPE_BLOCK',
  jsonContract: () => 'JSON_CONTRACT_BLOCK',
}));

function buildContext(platform: ArchitectureContext['platform'] = 'azure'): ArchitectureContext {
  return {
    task: 'design-architecture',
    scope: fixtureScope(),
    customer: fixtureCustomer(),
    config: fixtureConfig(),
    platform,
    catalog: [...CLOUD_SERVICE_CATALOG],
    capabilities: [],
  };
}

describe('architectureTask', () => {
  it('has the expected task id and a readable label', () => {
    expect(architectureTask.id).toBe('design-architecture');
    expect(architectureTask.label).toContain('Architecture');
  });

  it('assembles the prompt from the shared prompt-kit helpers', () => {
    const { system, prompt } = architectureTask.buildPrompt(buildContext());
    expect(system).toBe('SYSTEM:solution architect');
    expect(prompt).toContain('CUSTOMER_BLOCK');
    expect(prompt).toContain('CONFIG_BLOCK');
    expect(prompt).toContain('SCOPE_BLOCK');
    expect(prompt).toContain('JSON_CONTRACT_BLOCK');
  });

  it('embeds the requested platform catalog, not another platform’s services', () => {
    const { prompt } = architectureTask.buildPrompt(buildContext('azure'));
    expect(prompt).toContain('Azure Database for PostgreSQL');
    expect(prompt).not.toContain('Amazon RDS for PostgreSQL');
  });

  it('instructs the model to set platform to the exact requested value', () => {
    const { prompt } = architectureTask.buildPrompt(buildContext('gcp'));
    expect(prompt).toContain('"gcp"');
  });
});
