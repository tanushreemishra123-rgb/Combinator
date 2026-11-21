/**
 * Test-only fixtures for the Estimate Workspace. Builds a realistic `EstimateBundle` through the
 * (finished, pure) calculation engine instead of hand-rolling its rich nested shape, so component
 * tests exercise real totals, roles and calculation traces. Never imported by the workspace itself.
 */
import type { ComplexityOverride, EstimateBundle, EstimationConfig, GenerationMeta, ScopingSession, SolutionConfig } from '../../domain';
import { calculateEstimate } from '../../estimation';
import { calculationInput, platformSuggestion } from '../../estimation/testing/estimateFixtures';
import { createDefaultEstimationConfig } from '../../seed';
import { FIXTURE_NOW, fixtureConfig, fixtureScope, fixtureSession } from '../../test/fixtures';

export interface EstimateBundleOptions {
  config?: Partial<SolutionConfig>;
  estimationConfig?: EstimationConfig;
  complexityOverrides?: ComplexityOverride[];
}

/** A two-workstream estimate (platform capability + integration) computed by the real engine. */
export function buildEstimateBundle(options: EstimateBundleOptions = {}): EstimateBundle {
  const suggestion = platformSuggestion();
  const overrides = options.complexityOverrides ?? [];
  const input = calculationInput({
    suggestion,
    scope: fixtureScope(),
    config: fixtureConfig(options.config),
    estimationConfig: options.estimationConfig ?? createDefaultEstimationConfig(),
    overrides,
    computedAt: FIXTURE_NOW,
  });
  return { suggestion, overrides, result: calculateEstimate(input) };
}

export function sampleGenerationMeta(overrides: Partial<GenerationMeta> = {}): GenerationMeta {
  return {
    providerId: 'mock-heuristic-estimation',
    providerLabel: 'Mock Heuristic Engine',
    mode: 'mock',
    usedFallback: false,
    generatedAt: FIXTURE_NOW,
    durationMs: 80,
    scopeVersion: 1,
    issues: [],
    ...overrides,
  };
}

/** A fixture session (approved scope) with a generated, current estimate section. */
export function sessionWithEstimate(options: EstimateBundleOptions = {}): ScopingSession {
  const base = fixtureSession();
  const config = { ...base.config, ...options.config };
  const estimationConfig = options.estimationConfig ?? base.estimationConfig;
  const bundle = buildEstimateBundle({ ...options, config, estimationConfig });
  return {
    ...base,
    config,
    estimationConfig,
    outputs: {
      ...base.outputs,
      estimate: { data: bundle, status: 'current', reviewed: false, meta: sampleGenerationMeta(), staleReasons: [] },
    },
  };
}

/** A fixture session whose scope has not been approved yet, so nothing can be generated. */
export function sessionWithoutApproval(): ScopingSession {
  const base = fixtureSession();
  const scope = base.scope === null ? null : { ...base.scope, approvedAt: null, approvedVersion: null };
  return { ...base, scope };
}

/** Marks the estimate section stale without touching its data, mirroring what `applyImpactReport` does. */
export function withStaleEstimate(session: ScopingSession, staleReasons: string[] = ['Rate card changed for Backend Engineer.']): ScopingSession {
  return { ...session, outputs: { ...session.outputs, estimate: { ...session.outputs.estimate, status: 'stale', staleReasons } } };
}

/** Same estimation config as the default, except the named role has no configured day rate. */
export function estimationConfigWithBlockedRole(roleId: EstimationConfig['rates'][number]['roleId']): EstimationConfig {
  const base = createDefaultEstimationConfig();
  return { ...base, rates: base.rates.map((rate) => (rate.roleId === roleId ? { ...rate, dayRate: null } : rate)) };
}
