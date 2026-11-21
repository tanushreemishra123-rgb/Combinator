import { describe, expect, it, vi } from 'vitest';
import type { ArchitectureContext, TaskResult, TaskRunOptions } from '../ai/types';
import type { ArchitectureOutput } from '../domain';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';

/**
 * This test replaces src/ai's runTask with a deterministic fake that runs the real planner - the
 * same thing the mock provider does - so it exercises stage.ts without the orchestrator. stage.ts
 * only ever calls runTask with an ArchitectureContext, so the fake is typed to that directly.
 */
vi.mock('../ai', () => ({
  runTask: async (_task: unknown, context: ArchitectureContext): Promise<TaskResult<ArchitectureOutput>> => {
    const { planArchitecture } = await import('./planner');
    return {
      value: planArchitecture(context),
      meta: {
        providerId: 'mock-provider',
        providerLabel: 'Mock Provider',
        mode: 'mock',
        usedFallback: false,
        generatedAt: '2026-09-19T00:00:00.000Z',
        durationMs: 4,
        scopeVersion: context.scope.version,
        issues: [],
      },
    };
  },
}));

const { generateArchitecture } = await import('./stage');

function baseRunOptions(): TaskRunOptions {
  return {
    provider: { id: 'mock', label: 'Mock', mode: 'mock', complete: async () => '{}' },
    fallback: null,
    scopeVersion: 1,
  };
}

describe('generateArchitecture', () => {
  it('uses the user-selected platform when configured, and still attaches the recommendation', async () => {
    const { design } = await generateArchitecture(
      { scope: fixtureScope(), customer: fixtureCustomer(), config: fixtureConfig({ cloudPlatform: 'aws', cloudSelectionMode: 'user-selected' }), capabilities: [] },
      baseRunOptions(),
    );
    expect(design.platform).toBe('aws');
    expect(design.selection).toBe('user-selected');
    expect(design.recommendation.recommended).toBe('azure');
    expect(design.components.length).toBeGreaterThan(0);
  });

  it('falls back to the recommendation when the platform is not user-selected', async () => {
    const { design } = await generateArchitecture(
      { scope: fixtureScope(), customer: fixtureCustomer(), config: fixtureConfig({ cloudPlatform: null, cloudSelectionMode: 'recommend' }), capabilities: [] },
      baseRunOptions(),
    );
    expect(design.platform).toBe(design.recommendation.recommended);
    expect(design.selection).toBe('ai-recommended');
  });

  it('falls back to the recommendation when selection mode is user-selected but no platform was chosen', async () => {
    const { design } = await generateArchitecture(
      { scope: fixtureScope(), customer: fixtureCustomer(), config: fixtureConfig({ cloudPlatform: null, cloudSelectionMode: 'user-selected' }), capabilities: [] },
      baseRunOptions(),
    );
    expect(design.selection).toBe('ai-recommended');
    expect(design.platform).toBe(design.recommendation.recommended);
  });

  it('merges semantic-validation issues into the returned generation meta', async () => {
    const { meta } = await generateArchitecture(
      { scope: fixtureScope(), customer: fixtureCustomer(), config: fixtureConfig(), capabilities: [] },
      baseRunOptions(),
    );
    expect(meta.issues.filter((issue) => issue.severity === 'error')).toHaveLength(0);
    expect(meta.providerId).toBe('mock-provider');
  });

  it('produces a design whose platform matches every component service (no cross-cloud leakage)', async () => {
    const { design } = await generateArchitecture(
      { scope: fixtureScope(), customer: fixtureCustomer(), config: fixtureConfig({ cloudPlatform: 'gcp', cloudSelectionMode: 'user-selected' }), capabilities: [] },
      baseRunOptions(),
    );
    const relationalDb = design.components.find((component) => component.logicalComponent === 'managed-relational-db');
    expect(relationalDb?.service).toContain('Cloud SQL');
  });
});
