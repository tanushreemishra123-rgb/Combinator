/**
 * Deterministic, offline AI provider. Every structured task delegates to that feature's
 * rule-based planner (so mock output travels through the exact same JSON-parse + Zod-validate
 * path a live response would); the two free-text tasks return the planner's text directly.
 */
import { planAnalysis } from '../../analysis';
import { planArchitecture } from '../../architecture';
import type { AnalysisOutput } from '../../domain';
import { planExecutiveSummary } from '../../export';
import { planEstimateInputs } from '../../estimation';
import { planImpactExplanation } from '../../impact';
import { normalizeRequirements } from '../../ingestion';
import { planPrd } from '../../prd';
import { getRecordedAnalysis, getScenario } from '../../seed';
import { planAiSolution, planDataIntegration } from '../../strategy';
import type { AiProvider, AiRequest, AiTaskContext, AnalyzeContext } from '../types';

export const MOCK_PROVIDER_ID = 'mock';
export const MOCK_PROVIDER_LABEL = 'Mock AI (deterministic, offline)';

/** A recorded scenario response is used only when the input is the scenario's own, unedited text. */
function findRecordedAnalysis(context: AnalyzeContext): AnalysisOutput | undefined {
  if (context.scenarioId === null) {
    return undefined;
  }
  const scenario = getScenario(context.scenarioId);
  if (scenario === undefined) {
    return undefined;
  }
  const normalized = normalizeRequirements(scenario.requirementsText);
  if (normalized.text !== context.document.text) {
    return undefined;
  }
  return getRecordedAnalysis(context.scenarioId, scenario.requirementsText);
}

function planAnalyzeRequirements(context: AnalyzeContext): AnalysisOutput {
  return findRecordedAnalysis(context) ?? planAnalysis(context);
}

function dispatchMockTask(context: AiTaskContext): string {
  switch (context.task) {
    case 'analyze-requirements':
      return JSON.stringify(planAnalyzeRequirements(context));
    case 'generate-prd':
      return JSON.stringify(planPrd(context));
    case 'design-architecture':
      return JSON.stringify(planArchitecture(context));
    case 'plan-data-integration':
      return JSON.stringify(planDataIntegration(context));
    case 'plan-ai-solution':
      return JSON.stringify(planAiSolution(context));
    case 'suggest-estimate-inputs':
      return JSON.stringify(planEstimateInputs(context));
    case 'explain-change-impact':
      return planImpactExplanation(context);
    case 'summarize-package':
      return planExecutiveSummary(context);
  }
}

async function wait(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export interface MockProviderOptions {
  /** Optional artificial delay (ms) so the UI can exercise its loading states; default 0. */
  latencyMs?: number;
}

/** Builds the offline mock `AiProvider`: every task resolves through a deterministic planner. */
export function createMockProvider(options: MockProviderOptions = {}): AiProvider {
  const latencyMs = options.latencyMs ?? 0;
  return {
    id: MOCK_PROVIDER_ID,
    label: MOCK_PROVIDER_LABEL,
    mode: 'mock',
    async complete(request: AiRequest): Promise<string> {
      await wait(latencyMs);
      return dispatchMockTask(request.context);
    },
  };
}
