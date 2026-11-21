/**
 * Explains, before the reviewer clicks "Run AI-assisted requirement analysis", which path will
 * actually produce the result (forum ruling: mock mode fully supports the four seeded scenarios;
 * edited or custom text is analyzed by the deterministic heuristic engine instead, and the UI must
 * always say which one ran and keep the "Mock AI mode" label visible).
 */
import type { AiSettings } from '../../ai';
import { describeAiMode } from '../../ai';
import { getRecordedAnalysis, getScenario } from '../../seed';

export interface AnalysisPathDescription {
  /** Always shown so "Mock AI mode" (or the live provider) stays visible per the forum ruling. */
  modeLabel: string;
  detail: string;
}

export function describeAnalysisPath(aiSettings: AiSettings, rawText: string, scenarioId: string | null): AnalysisPathDescription {
  const modeLabel = describeAiMode(aiSettings);
  if (aiSettings.mode === 'live') {
    return { modeLabel, detail: 'Sends the requirements text to the configured live provider, and falls back to the mock heuristic engine automatically if that call fails.' };
  }
  const scenario = scenarioId === null ? undefined : getScenario(scenarioId);
  const recorded = scenarioId === null ? undefined : getRecordedAnalysis(scenarioId, rawText);
  if (scenario !== undefined && recorded !== undefined) {
    return { modeLabel, detail: `Uses the recorded analysis for the "${scenario.name}" seed scenario, so results are identical every run.` };
  }
  return {
    modeLabel,
    detail: 'Analyzes this text with the deterministic heuristic engine (works for any input, not only the seeded scenarios).',
  };
}
