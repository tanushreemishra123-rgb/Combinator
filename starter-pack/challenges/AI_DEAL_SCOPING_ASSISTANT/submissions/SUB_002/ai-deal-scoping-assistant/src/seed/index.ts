/**
 * Seed content: sample customer requirements and opportunity context, configurable estimation
 * assumptions, example role rates and commercial configurations, recorded mock-AI responses,
 * expected structured-output schemas and expected document structures (spec "Deliverables 3.
 * Seed Content"). Four scenarios cover the required categories - application modernisation, data
 * and integration, AI-enabled and one with deliberately missing information.
 */
import type {
  AnalysisOutput,
  CustomerContext,
  EstimationConfig,
  HistoricalProjectReference,
  SolutionConfig,
} from '../domain';
import { getRecordedAnalysis as lookupRecordedAnalysis } from './mockResponses';
import { SCENARIOS } from './scenarios';

export { createDefaultEstimationConfig, createDefaultSolutionConfig, DEFAULT_ROLE_RATES } from './estimationDefaults';
export { COMMERCIAL_PRESETS } from './commercialPresets';
export { HISTORICAL_PROJECTS } from './historicalProjects';
export {
  applicationModernizationScenario,
  dataIntegrationScenario,
  aiEnabledScenario,
  missingInformationScenario,
} from './scenarios';
export * from './documentStructures';
export { EXPECTED_SCHEMAS, SCHEMA_FILE_NAMES } from './schemas/expectedSchemas';
export type { ExpectedSchemaName } from './schemas/expectedSchemas';

export type ScenarioCategory = 'application-modernization' | 'data-integration' | 'ai-enabled' | 'missing-information';

export interface SeedScenario {
  id: string;
  name: string;
  category: ScenarioCategory;
  tagline: string;
  customer: CustomerContext;
  /** Multi-section customer requirements text (RFP / discovery notes). */
  requirementsText: string;
  /** Suggested user configuration for the walkthrough (unknown inputs stay null). */
  config: SolutionConfig;
}

export interface CommercialPreset {
  id: string;
  label: string;
  description: string;
  apply(config: EstimationConfig): EstimationConfig;
}

export const SEED_SCENARIOS: readonly SeedScenario[] = SCENARIOS;

const SCENARIOS_BY_ID: ReadonlyMap<string, SeedScenario> = new Map(SEED_SCENARIOS.map((scenario) => [scenario.id, scenario]));

/** Looks up one of the four seed scenarios by id. */
export function getScenario(id: string): SeedScenario | undefined {
  return SCENARIOS_BY_ID.get(id);
}

/**
 * Recorded mock-AI analysis for an unmodified seed scenario, or `undefined` when `requirementsText`
 * has been edited (or is not a seed scenario at all) - in which case the caller should run the real
 * heuristic analysis engine instead of a canned response.
 */
export function getRecordedAnalysis(scenarioId: string, requirementsText: string): AnalysisOutput | undefined {
  return lookupRecordedAnalysis(scenarioId, requirementsText);
}

export type { HistoricalProjectReference };
