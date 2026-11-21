/**
 * Drives a seed scenario through every engine stage in mock AI mode, exactly in the order the UI
 * does (analyse -> approve -> PRD -> architecture -> strategies -> estimate -> quality gate).
 * Shared by the end-to-end tests so they all exercise the same, real pipeline.
 */
import { createMockProvider } from '../ai';
import type { TaskRunOptions } from '../ai';
import { analyzeRequirements } from '../analysis';
import { generateArchitecture } from '../architecture';
import { createSession } from '../domain';
import type { GenerationMeta, ScopingSession, SectionState } from '../domain';
import { generateEstimate } from '../estimation';
import { normalizeRequirements } from '../ingestion';
import { generatePrd } from '../prd';
import { runQualityGate } from '../quality';
import { approveAllPending, approveScope } from '../scope';
import { createDefaultEstimationConfig } from '../seed';
import type { SeedScenario } from '../seed';
import { generateAiStrategy, generateDataIntegration } from '../strategy';

export const PIPELINE_NOW = '2026-09-19T00:00:00.000Z';

function current<T>(data: T, meta: GenerationMeta): SectionState<T> {
  return { data, status: 'current', reviewed: false, meta, staleReasons: [] };
}

/** Analyses the scenario and approves the whole extracted scope, as a reviewer would. */
export async function analyseAndApprove(scenario: SeedScenario): Promise<ScopingSession> {
  const provider = createMockProvider();
  const document = normalizeRequirements(scenario.requirementsText);
  const { scope } = await analyzeRequirements(
    { document, customer: scenario.customer, scenarioId: scenario.id },
    { provider, fallback: null, scopeVersion: 0 },
  );
  const session = createSession({
    id: `session-${scenario.id}`,
    name: scenario.name,
    now: PIPELINE_NOW,
    config: { ...scenario.config },
    estimationConfig: createDefaultEstimationConfig(),
  });
  return {
    ...session,
    customer: scenario.customer,
    input: { rawText: scenario.requirementsText, documents: [], normalized: document, scenarioId: scenario.id },
    scope: approveScope(approveAllPending(scope), PIPELINE_NOW),
  };
}

/** Runs every downstream stage on a session whose scope is approved. */
export async function generateAllStages(session: ScopingSession): Promise<ScopingSession> {
  const scope = session.scope;
  if (scope === null) {
    throw new Error('generateAllStages needs an analysed scope');
  }
  const run: TaskRunOptions = { provider: createMockProvider(), fallback: null, scopeVersion: scope.version };
  const base = { scope, customer: session.customer, config: session.config };

  const prd = await generatePrd(base, run);
  const architecture = await generateArchitecture(
    { ...base, capabilities: prd.bundle.functionalScope.capabilities },
    run,
  );
  const config = { ...session.config, cloudPlatform: architecture.design.platform };
  const strategyInput = { scope, customer: session.customer, config, design: architecture.design };
  const dataIntegration = await generateDataIntegration(strategyInput, run);
  const aiStrategy = await generateAiStrategy(strategyInput, run);
  const estimate = await generateEstimate(
    {
      scope,
      customer: session.customer,
      config,
      estimationConfig: session.estimationConfig,
      prd: prd.bundle,
      design: architecture.design,
      dataIntegration: dataIntegration.plan,
      aiStrategy: aiStrategy.strategy,
      overrides: [],
    },
    run,
  );

  const generated: ScopingSession = {
    ...session,
    config,
    outputs: {
      prd: current(prd.bundle, prd.meta),
      architecture: current(architecture.design, architecture.meta),
      dataIntegration: current(dataIntegration.plan, dataIntegration.meta),
      aiStrategy: current(aiStrategy.strategy, aiStrategy.meta),
      estimate: current(estimate.bundle, estimate.meta),
    },
  };
  return { ...generated, quality: runQualityGate(generated, PIPELINE_NOW) };
}

export async function runFullPipeline(scenario: SeedScenario): Promise<ScopingSession> {
  return generateAllStages(await analyseAndApprove(scenario));
}
