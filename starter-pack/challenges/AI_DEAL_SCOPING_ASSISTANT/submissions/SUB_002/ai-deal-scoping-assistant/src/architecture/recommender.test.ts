import { describe, expect, it } from 'vitest';
import { fixtureConfig, fixtureScope } from '../test/fixtures';
import type { ScopeItem, ScopeModel } from '../domain';
import { CLOUD_SIGNAL_POINTS, KEYWORD_MATCH_POINTS, PLATFORM_ORDER, recommendPlatform } from './recommender';

function emptyScope(): ScopeModel {
  return { summary: 'Empty scope', items: [], version: 1, approvedAt: null, approvedVersion: null, issues: [] };
}

function technologyItem(overrides: Partial<ScopeItem> & Pick<ScopeItem, 'id' | 'title' | 'description'>): ScopeItem {
  return {
    kind: 'technology',
    priority: 'Medium',
    provenance: 'customer-stated',
    source: null,
    relatedIds: [],
    affectsInputs: [],
    critical: false,
    signals: [],
    review: 'approved',
    inScope: true,
    userEdited: false,
    resolved: false,
    resolution: '',
    ...overrides,
  };
}

describe('recommendPlatform', () => {
  it('recommends Azure for the fixture scope, citing TECH_01 (cloud:azure)', () => {
    const recommendation = recommendPlatform(fixtureScope(), fixtureConfig());
    expect(recommendation.recommended).toBe('azure');
    const azureScore = recommendation.scores.find((score) => score.platform === 'azure');
    const citedIds = azureScore?.reasons.flatMap((reason) => reason.refs) ?? [];
    expect(citedIds).toContain('TECH_01');
    expect(recommendation.explanation).toContain('AI-generated recommendation');
  });

  it('produces a score entry for every supported platform, in a stable order', () => {
    const recommendation = recommendPlatform(fixtureScope(), fixtureConfig());
    expect(recommendation.scores.map((score) => score.platform)).toEqual([...PLATFORM_ORDER]);
  });

  it('ties deterministically on AWS when nothing in the scope signals a platform', () => {
    const recommendation = recommendPlatform(emptyScope(), fixtureConfig({ cloudPlatform: null, aiProviderPreference: 'no-preference' }));
    expect(recommendation.recommended).toBe('aws');
    expect(recommendation.scores.every((score) => score.score === 0)).toBe(true);
    expect(recommendation.explanation).toContain('evaluation order');
  });

  it('every reason cites either a scope item id or is explicitly platform-neutral (0 points)', () => {
    const recommendation = recommendPlatform(fixtureScope(), fixtureConfig());
    for (const score of recommendation.scores) {
      for (const reason of score.reasons) {
        if (reason.points > 0) {
          expect(reason.refs.length, reason.text).toBeGreaterThan(0);
        }
      }
    }
  });

  it('biases toward AWS when the scope mentions an existing AWS/Bedrock footprint', () => {
    const scope = emptyScope();
    scope.items.push({
      id: 'TECH_02',
      kind: 'technology',
      title: 'Existing AWS footprint',
      description: 'The customer already runs workloads on AWS and uses Amazon Bedrock for a pilot.',
      priority: 'Medium',
      provenance: 'customer-stated',
      source: null,
      relatedIds: [],
      affectsInputs: [],
      critical: false,
      signals: [],
      review: 'approved',
      inScope: true,
      userEdited: false,
      resolved: false,
      resolution: '',
    });
    const recommendation = recommendPlatform(scope, fixtureConfig({ cloudPlatform: null, aiProviderPreference: 'no-preference' }));
    expect(recommendation.recommended).toBe('aws');
  });

  it('applies the configured AI provider preference toward the matching platform', () => {
    const scope = emptyScope();
    const recommendation = recommendPlatform(scope, fixtureConfig({ cloudPlatform: null, aiProviderPreference: 'openai' }));
    expect(recommendation.recommended).toBe('azure');
  });

  it('prints a platform-neutral observation (e.g. compliance/residency) exactly once, not once per platform', () => {
    // fixtureScope's SEC_01 carries a compliance:gdpr signal, which scoreComplianceResidency turns
    // into a neutral, non-scoring observation - it must appear only against the recommended
    // platform's reasons, never duplicated verbatim across all three.
    const recommendation = recommendPlatform(fixtureScope(), fixtureConfig());
    const neutralText = 'do not change the recommendation';
    const occurrences = recommendation.scores.flatMap((score) => score.reasons).filter((reason) => reason.text.includes(neutralText));
    expect(occurrences).toHaveLength(1);
    expect(occurrences.at(0)?.refs).toContain('SEC_01');

    const winner = recommendation.scores.find((score) => score.platform === recommendation.recommended);
    expect(winner?.reasons.some((reason) => reason.text.includes(neutralText))).toBe(true);
  });

  it('states plainly that the platform is a default pending more information when no signal favors any platform', () => {
    const recommendation = recommendPlatform(emptyScope(), fixtureConfig({ cloudPlatform: null, aiProviderPreference: 'no-preference' }));
    expect(recommendation.explanation).toContain('default pending more information');
    expect(recommendation.explanation).not.toContain('Key factors:');
  });

  it('does not use the default-pending wording once a real scoring signal exists', () => {
    const recommendation = recommendPlatform(fixtureScope(), fixtureConfig());
    expect(recommendation.explanation).not.toContain('default pending more information');
    expect(recommendation.explanation).toContain('Key factors:');
  });

  it('merges one item’s explicit preference and its own keyword matches into a single reason, not three', () => {
    const scope = emptyScope();
    scope.items.push(technologyItem({ id: 'TECH_01', title: 'AWS preferred', description: 'Customer already runs on Amazon and prefers AWS.', signals: ['cloud:aws'] }));
    const recommendation = recommendPlatform(scope, fixtureConfig({ cloudPlatform: null, aiProviderPreference: 'no-preference' }));
    const aws = recommendation.scores.find((score) => score.platform === 'aws');
    const tech01Reasons = aws?.reasons.filter((reason) => reason.refs.includes('TECH_01')) ?? [];
    // The item states a direct preference (30) AND matches two keyword rules (18 each); merged, it
    // contributes exactly one reason worth the highest single match (30), never 30 + 18 + 18 = 66.
    expect(tech01Reasons).toHaveLength(1);
    expect(tech01Reasons.at(0)?.points).toBe(CLOUD_SIGNAL_POINTS);
    expect(aws?.score).toBe(CLOUD_SIGNAL_POINTS);
  });

  it('merges several keyword matches on the same item and platform into one reason, keeping the higher score', () => {
    const scope = emptyScope();
    scope.items.push(technologyItem({ id: 'TECH_05', title: 'Microsoft Active Directory', description: 'The customer already runs Microsoft Active Directory for identity.' }));
    const recommendation = recommendPlatform(scope, fixtureConfig({ cloudPlatform: null, aiProviderPreference: 'no-preference' }));
    const azure = recommendation.scores.find((score) => score.platform === 'azure');
    const tech05Reasons = azure?.reasons.filter((reason) => reason.refs.includes('TECH_05')) ?? [];
    expect(tech05Reasons).toHaveLength(1);
    expect(tech05Reasons.at(0)?.points).toBe(KEYWORD_MATCH_POINTS);
  });

  it('never produces the "a Amazon..." article grammar bug for a vowel-leading platform label', () => {
    const scope = emptyScope();
    scope.items.push(technologyItem({ id: 'TECH_09', title: 'Amazon footprint', description: 'The team already runs services on Amazon and AWS.' }));
    const recommendation = recommendPlatform(scope, fixtureConfig({ cloudPlatform: null, aiProviderPreference: 'no-preference' }));
    const allText = recommendation.scores.flatMap((score) => score.reasons.map((reason) => reason.text)).join(' ');
    expect(allText).not.toMatch(/\ba Amazon\b/);
    expect(allText).toContain('indicating an affinity for Amazon Web Services (AWS)');
  });
});
