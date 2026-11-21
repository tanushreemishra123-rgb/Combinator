/**
 * Recorded mock-AI analysis responses: one hand-authored, schema-validated `AnalysisOutput` per
 * seed scenario. `getRecordedAnalysis` returns a recording only when the caller's requirements
 * text is byte-for-byte the unmodified seed text. Any edited or pasted text falls through to the real
 * heuristic analysis engine in `src/analysis` instead, so seed scenarios stay input fixtures, not
 * a substitute for genuine text analysis.
 */
import { AnalysisOutputSchema } from '../../domain';
import type { AnalysisOutput } from '../../domain';
import { SCENARIOS } from '../scenarios';
import aiEnabledAnalysis from './ai-enabled-clinical-intake-assistant.analysis.json';
import appModernizationAnalysis from './app-modernization-claims-portal.analysis.json';
import dataIntegrationAnalysis from './data-integration-supply-chain-analytics.analysis.json';
import missingInformationAnalysis from './missing-information-member-app.analysis.json';

/** Scenario id -> the raw recorded JSON committed alongside this file. */
const RAW_RECORDINGS: ReadonlyMap<string, unknown> = new Map([
  ['app-modernization-claims-portal', appModernizationAnalysis],
  ['data-integration-supply-chain-analytics', dataIntegrationAnalysis],
  ['ai-enabled-clinical-intake-assistant', aiEnabledAnalysis],
  ['missing-information-member-app', missingInformationAnalysis],
]);

/** Parsed once at module load so a malformed recording fails fast (at import time), not on first use. */
const RECORDINGS: ReadonlyMap<string, AnalysisOutput> = new Map(
  Array.from(RAW_RECORDINGS, ([id, raw]) => [id, AnalysisOutputSchema.parse(raw)] as const),
);

/** Scenario id -> its unmodified `requirementsText`, used to detect an edited or pasted document. */
const SEED_TEXT_BY_ID: ReadonlyMap<string, string> = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario.requirementsText]));

/**
 * The recorded mock-AI analysis for `scenarioId`, but only when `requirementsText` is exactly the
 * unmodified seed text for that scenario. Any other text (including a lightly edited seed
 * document) returns `undefined` so the caller falls back to the real analysis engine.
 */
export function getRecordedAnalysis(scenarioId: string, requirementsText: string): AnalysisOutput | undefined {
  const seedText = SEED_TEXT_BY_ID.get(scenarioId);
  if (seedText === undefined || seedText !== requirementsText) return undefined;
  return RECORDINGS.get(scenarioId);
}
