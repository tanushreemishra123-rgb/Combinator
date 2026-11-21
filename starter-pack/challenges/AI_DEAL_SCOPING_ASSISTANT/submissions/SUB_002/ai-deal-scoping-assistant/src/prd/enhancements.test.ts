import { describe, expect, it } from 'vitest';
import { fixtureScope } from '../test/fixtures';
import { buildRecommendedEnhancements } from './enhancements';

describe('buildRecommendedEnhancements', () => {
  it('triggers between two and four enhancements for a scope that exercises several signal groups', () => {
    const enhancements = buildRecommendedEnhancements(fixtureScope().items);
    expect(enhancements.length).toBeGreaterThanOrEqual(2);
    expect(enhancements.length).toBeLessThanOrEqual(4);
  });

  it('labels every enhancement recommended-enhancement and cites the requirement ids that motivated it', () => {
    const enhancements = buildRecommendedEnhancements(fixtureScope().items);
    for (const enhancement of enhancements) {
      expect(enhancement.label).toBe('recommended-enhancement');
      expect(enhancement.requirementIds.length).toBeGreaterThan(0);
      expect(enhancement.scope).toContain(enhancement.requirementIds.at(0));
    }
  });

  it('triggers the AI feedback loop only when an answer-generating ai:* signal is present, citing the AI requirement', () => {
    const enhancements = buildRecommendedEnhancements(fixtureScope().items);
    const aiLoop = enhancements.find((enhancement) => enhancement.name === 'AI Answer Quality Feedback Loop');
    expect(aiLoop?.requirementIds).toEqual(['FR_03']);
  });

  it('never triggers a rule when no requirement carries a matching signal', () => {
    const scope = fixtureScope();
    const noAiRequirements = scope.items.filter((item) => !item.signals.some((signal) => signal.startsWith('ai:')));
    const enhancements = buildRecommendedEnhancements(noAiRequirements);
    expect(enhancements.some((enhancement) => enhancement.name === 'AI Answer Quality Feedback Loop')).toBe(false);
  });

  it('does not recommend an AI answer feedback loop for a non-answer-generating AI use case', () => {
    const scope = fixtureScope();
    // FR_03 becomes a forecasting/classification use case instead of a conversational assistant.
    const noAnswerAi = scope.items.map((item) => (item.id === 'FR_03' ? { ...item, signals: ['ai:forecasting'] } : item));
    const enhancements = buildRecommendedEnhancements(noAnswerAi);
    expect(enhancements.some((enhancement) => enhancement.name === 'AI Answer Quality Feedback Loop')).toBe(false);
  });

  it('only recommends an accessibility audit for an explicit accessibility requirement, not merely a portal or mobile capability', () => {
    const scope = fixtureScope();
    const portalOnly = scope.items.map((item) => (item.id === 'FR_02' ? { ...item, signals: ['capability:portal', 'capability:mobile'] } : item));
    expect(buildRecommendedEnhancements(portalOnly).some((enhancement) => enhancement.name === 'Accessibility Compliance Audit')).toBe(false);

    const withAccessibility = scope.items.map((item) => (item.id === 'FR_02' ? { ...item, signals: ['nfr:accessibility'] } : item));
    const enhancements = buildRecommendedEnhancements(withAccessibility);
    const audit = enhancements.find((enhancement) => enhancement.name === 'Accessibility Compliance Audit');
    expect(audit?.requirementIds).toEqual(['FR_02']);
  });

  it('returns no enhancements for an empty requirement list', () => {
    expect(buildRecommendedEnhancements([])).toEqual([]);
  });

  it('is deterministic for the same requirements', () => {
    const requirements = fixtureScope().items;
    expect(buildRecommendedEnhancements(requirements)).toEqual(buildRecommendedEnhancements(requirements));
  });
});
