/**
 * Unit tests for the pre-analysis path description (forum ruling: mock mode fully supports the
 * four seeded scenarios; edited or custom text runs the deterministic heuristic engine instead, and
 * the UI must always name which path will run while keeping "Mock AI mode" visible).
 */
import type { AiSettings } from '../../ai';
import { getScenario } from '../../seed';
import { describeAnalysisPath } from './analysisPath';

const MOCK_SETTINGS: AiSettings = { mode: 'mock', providerId: 'groq', model: 'm', apiKey: '' };
const LIVE_SETTINGS: AiSettings = { mode: 'live', providerId: 'groq', model: 'llama-3.3-70b-versatile', apiKey: 'sentinel-value' };

describe('describeAnalysisPath', () => {
  it('always keeps the mode label visible', () => {
    expect(describeAnalysisPath(MOCK_SETTINGS, 'Some free text.', null).modeLabel).toBe('Mock AI mode');
  });

  it('names the live provider and mentions the automatic mock fallback in live mode', () => {
    const description = describeAnalysisPath(LIVE_SETTINGS, 'Some free text.', null);
    expect(description.modeLabel).toContain('Groq');
    expect(description.detail.toLowerCase()).toContain('falls back');
  });

  it('names the deterministic heuristic engine for free-typed text with no scenario', () => {
    const description = describeAnalysisPath(MOCK_SETTINGS, 'Some free text.', null);
    expect(description.detail).toContain('deterministic heuristic engine');
  });

  it('names the recorded analysis when a seed scenario is unmodified', () => {
    const scenario = getScenario('app-modernization-claims-portal');
    expect(scenario).toBeDefined();
    const description = describeAnalysisPath(MOCK_SETTINGS, scenario?.requirementsText ?? '', scenario?.id ?? null);
    expect(description.detail).toContain(scenario?.name);
    expect(description.detail).toContain('recorded analysis');
  });

  it('falls back to the heuristic engine once a seed scenario\'s text has been edited', () => {
    const scenario = getScenario('app-modernization-claims-portal');
    expect(scenario).toBeDefined();
    const editedText = `${scenario?.requirementsText ?? ''}\nOne more edited line.`;
    const description = describeAnalysisPath(MOCK_SETTINGS, editedText, scenario?.id ?? null);
    expect(description.detail).toContain('deterministic heuristic engine');
  });
});
