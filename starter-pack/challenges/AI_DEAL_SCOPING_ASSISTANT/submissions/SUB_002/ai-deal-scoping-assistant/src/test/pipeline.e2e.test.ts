/**
 * End-to-end checks over the four seeded scenarios in mock AI mode - the path a reviewer takes
 * without any AI key. Each assertion maps to a challenge constraint (traceability, cloud-specific
 * services, reproducible estimation, change impact, quality gate, mandatory export statement).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { servicesForPlatform } from '../architecture';
import { EXPORT_DISCLAIMER, PACKAGE_SECTION_IDS, REQUIREMENT_KINDS } from '../domain';
import type { ScopingSession } from '../domain';
import { buildPackage, toMarkdown } from '../export';
import { analyzeImpact, applyImpactReport, describeChanges } from '../impact';
import { SEED_SCENARIOS } from '../seed';
import type { SeedScenario } from '../seed';
import { buildCoverageReport } from '../traceability';
import { PIPELINE_NOW, runFullPipeline } from './pipelineHarness';

const sessions = new Map<string, ScopingSession>();

function sessionFor(scenario: SeedScenario): ScopingSession {
  const session = sessions.get(scenario.id);
  if (session === undefined) {
    throw new Error(`Pipeline did not run for ${scenario.id}`);
  }
  return session;
}

function scenarioOfCategory(category: SeedScenario['category']): SeedScenario {
  const scenario = SEED_SCENARIOS.find((candidate) => candidate.category === category);
  if (scenario === undefined) {
    throw new Error(`No seed scenario for ${category}`);
  }
  return scenario;
}

beforeAll(async () => {
  for (const scenario of SEED_SCENARIOS) {
    sessions.set(scenario.id, await runFullPipeline(scenario));
  }
});

describe.each(SEED_SCENARIOS.map((scenario) => [scenario.name, scenario] as const))('seed scenario: %s', (_name, scenario) => {
  it('extracts a traceable scope model with verified customer sources', () => {
    const scope = sessionFor(scenario).scope;
    expect(scope).not.toBeNull();
    const items = scope?.items ?? [];
    const requirementKinds = new Set(items.filter((item) => REQUIREMENT_KINDS.includes(item.kind)).map((item) => item.kind));
    expect(requirementKinds.size).toBeGreaterThanOrEqual(3);
    const customerStated = items.filter((item) => item.provenance === 'customer-stated');
    expect(customerStated.length).toBeGreaterThan(5);
    for (const item of customerStated) {
      expect(item.source?.verified, `${item.id} must point at verified customer text`).toBe(true);
      expect(item.source?.lineStart ?? 0).toBeGreaterThan(0);
    }
    expect(items.some((item) => item.kind === 'question')).toBe(true);
  });

  it('covers every high-priority requirement and reports no unsupported additions', () => {
    const coverage = buildCoverageReport(sessionFor(scenario));
    expect(coverage.totalRequirements).toBeGreaterThan(0);
    expect(coverage.highPriorityCoveragePct).toBe(100);
    expect(coverage.coveragePct).toBeGreaterThanOrEqual(90);
    expect(coverage.unsupportedAdditions).toEqual([]);
  });

  it('uses only services of the selected cloud platform, each justified by a requirement or assumption', () => {
    const design = sessionFor(scenario).outputs.architecture.data;
    expect(design).not.toBeNull();
    const allowed = servicesForPlatform(design?.platform ?? 'aws');
    for (const component of design?.components ?? []) {
      expect(allowed.has(component.service), `${component.service} is not a ${design?.platform} service`).toBe(true);
      expect(component.requirementIds.length + component.assumptionIds.length).toBeGreaterThan(0);
    }
  });

  it('links every integration and AI use case to reviewed requirements', () => {
    const session = sessionFor(scenario);
    for (const integration of session.outputs.dataIntegration.data?.integrations ?? []) {
      expect(integration.requirementIds.length, integration.name).toBeGreaterThan(0);
    }
    for (const useCase of session.outputs.aiStrategy.data?.useCases ?? []) {
      expect(useCase.requirementIds.length, useCase.name).toBeGreaterThan(0);
      expect(useCase.evaluation.length * useCase.safety.length * useCase.privacy.length * useCase.humanReview.length).toBeGreaterThan(0);
    }
  });

  it('produces an estimate whose totals reconcile with its workstreams', () => {
    const result = sessionFor(scenario).outputs.estimate.data?.result;
    expect(result).toBeDefined();
    const likelyDays = (result?.workstreams ?? []).reduce((sum, workstream) => sum + workstream.effortDays.likely, 0);
    expect(result?.totals.effortDays.likely).toBe(likelyDays);
    expect(result?.totals.rom).not.toBeNull();
    for (const workstream of result?.workstreams ?? []) {
      expect(workstream.calculation.length, workstream.name).toBeGreaterThan(0);
    }
  });

  it('passes the structural quality checks and stamps an export status', () => {
    const quality = sessionFor(scenario).quality;
    expect(quality).not.toBeNull();
    const failed = (quality?.checks ?? []).filter((check) => check.status === 'fail').map((check) => check.id);
    expect(failed).toEqual([]);
    expect(['Ready', 'Review Required']).toContain(quality?.summary.exportStatus);
  });

  it('exports a complete package with the mandatory statement and no raw placeholders', () => {
    const doc = buildPackage(sessionFor(scenario), { aiModeLabel: 'Mock AI mode', generatedAt: PIPELINE_NOW });
    expect(doc.sections.map((section) => section.id)).toEqual([...PACKAGE_SECTION_IDS]);
    const markdown = toMarkdown(doc);
    expect(markdown).toContain(EXPORT_DISCLAIMER);
    expect(markdown).not.toMatch(/undefined|\bnull\b|NaN|\[object/);
  });
});

describe('cross-scenario behaviour', () => {
  it('produces materially different deliverables per scenario', () => {
    const platforms = new Set(SEED_SCENARIOS.map((scenario) => sessionFor(scenario).outputs.architecture.data?.platform));
    const capabilitySets = new Set(
      SEED_SCENARIOS.map((scenario) =>
        (sessionFor(scenario).outputs.prd.data?.functionalScope.capabilities ?? []).map((capability) => capability.name).join('|'),
      ),
    );
    expect(platforms.size).toBeGreaterThanOrEqual(2);
    expect(capabilitySets.size).toBe(SEED_SCENARIOS.length);
  });

  it('lowers confidence and lists missing inputs for the missing-information scenario', () => {
    const result = sessionFor(scenarioOfCategory('missing-information')).outputs.estimate.data?.result;
    expect(result?.confidence).toBe('Low');
    expect(result?.missingInputs.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('plans AI use cases for the AI-enabled scenario', () => {
    const strategy = sessionFor(scenarioOfCategory('ai-enabled')).outputs.aiStrategy.data;
    expect(strategy?.applicable).toBe(true);
    expect(strategy?.useCases.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(new Set((strategy?.boundaries ?? []).map((boundary) => boundary.type)).size).toBe(3);
  });

  it('is deterministic: the same seed yields identical deliverables', async () => {
    const scenario = scenarioOfCategory('application-modernization');
    const again = await runFullPipeline(scenario);
    const first = sessionFor(scenario);
    expect(again.scope?.items).toEqual(first.scope?.items);
    expect(again.outputs.prd.data).toEqual(first.outputs.prd.data);
    expect(again.outputs.architecture.data).toEqual(first.outputs.architecture.data);
    expect(again.outputs.estimate.data?.result.totals).toEqual(first.outputs.estimate.data?.result.totals);
  });
});

describe('change impact on a generated package', () => {
  it('a contingency change affects only the commercials and preserves every other section by reference', () => {
    const before = sessionFor(scenarioOfCategory('data-integration'));
    const after: ScopingSession = { ...before, estimationConfig: { ...before.estimationConfig, contingencyPct: 25 } };
    const changes = describeChanges(before, after);
    expect(changes.map((change) => change.kind)).toEqual(['contingency']);
    const change = changes.at(0);
    if (change === undefined) {
      throw new Error('expected a contingency change');
    }
    const impact = analyzeImpact(after, change);
    expect(new Set(impact.affected.map((entry) => entry.section))).toEqual(new Set(['commercials']));
    const applied = applyImpactReport(after, {
      id: 'impact-1',
      change,
      affected: impact.affected,
      unaffected: impact.unaffected,
      explanation: 'Contingency changed.',
      createdAt: PIPELINE_NOW,
      resolvedSections: [],
    });
    expect(applied.outputs.estimate.status).toBe('stale');
    expect(applied.outputs.prd).toBe(after.outputs.prd);
    expect(applied.outputs.architecture).toBe(after.outputs.architecture);
    expect(applied.outputs.dataIntegration).toBe(after.outputs.dataIntegration);
    expect(applied.outputs.aiStrategy).toBe(after.outputs.aiStrategy);
  });

  it('a cloud platform change re-opens the architecture but leaves the PRD untouched', () => {
    const before = sessionFor(scenarioOfCategory('application-modernization'));
    const nextPlatform = before.config.cloudPlatform === 'aws' ? 'gcp' : 'aws';
    const after: ScopingSession = {
      ...before,
      config: { ...before.config, cloudPlatform: nextPlatform, cloudSelectionMode: 'user-selected' },
    };
    const change = describeChanges(before, after).find((candidate) => candidate.kind === 'cloud-platform');
    expect(change).toBeDefined();
    if (change === undefined) {
      return;
    }
    const impact = analyzeImpact(after, change);
    const affectedSections = new Set(impact.affected.map((entry) => entry.section));
    expect(affectedSections.has('architecture')).toBe(true);
    expect(affectedSections.has('prd')).toBe(false);
    expect(impact.unaffected.some((entry) => entry.section === 'prd')).toBe(true);
  });
});
