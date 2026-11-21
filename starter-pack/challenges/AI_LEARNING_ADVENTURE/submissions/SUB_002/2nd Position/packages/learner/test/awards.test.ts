import { describe, expect, it } from 'vitest';
import type { AwardDefinition, AwardId, CatalogDto, QuizAttempt } from '@ai-learning-adventure/types';
import {
  awardListItems,
  awardUnlockCondition,
  completionPercentFor,
  countEarnedByKind,
  isAwardRuleSatisfied,
  longestCompletionStreak,
  milestoneProgressFor,
} from '../src/awards.ts';
import { makeCatalog, makeMission, makeMissionProgress, makeSnapshot } from './fixtures.ts';

function award(partial: Omit<AwardDefinition, 'icon' | 'description'>): AwardDefinition {
  return {
    icon: 'icon',
    description: 'description',
    ...partial,
  };
}

function catalogWithMissions(): CatalogDto {
  return makeCatalog([
    makeMission({ id: 'm-1', levelTrack: 'beginner', trackOrder: 1 }),
    makeMission({ id: 'm-2', levelTrack: 'beginner', trackOrder: 2 }),
    makeMission({ id: 'm-3', levelTrack: 'basic_understanding', trackOrder: 1 }),
    makeMission({ id: 'm-4', levelTrack: 'basic_understanding', trackOrder: 2 }),
  ]);
}

function attemptWithScore(id: string, missionIdValue: string, scorePercent: number): QuizAttempt {
  return {
    id,
    missionId: missionIdValue as never,
    contentVersion: 1,
    answers: [],
    scorePercent,
    correctCount: Math.round(scorePercent / 20),
    questionCount: 5,
    result: scorePercent >= 70 ? 'passed' : 'needs_review',
    weakTopics: [],
    startedAt: '2026-08-01T00:00:00.000Z' as never,
    completedAt: '2026-08-01T00:10:00.000Z' as never,
  };
}

describe('isAwardRuleSatisfied', () => {
  const catalog = catalogWithMissions();
  const oneComplete = makeSnapshot({
    missions: { 'm-1': makeMissionProgress('m-1', { status: 'completed' }) },
  });

  it('evaluates mission_completed rules', () => {
    const rule = award({
      id: 'a-1' as AwardId,
      kind: 'badge',
      name: 'Badge',
      missionId: 'm-1' as never,
      rule: { type: 'mission_completed', missionId: 'm-1' as never },
    });
    expect(isAwardRuleSatisfied(rule.rule, { catalog, snapshot: oneComplete })).toBe(true);
    expect(isAwardRuleSatisfied(rule.rule, { catalog, snapshot: makeSnapshot() })).toBe(false);
  });

  it('evaluates track_completed rules only when every track mission is complete', () => {
    const rule = award({
      id: 'a-2' as AwardId,
      kind: 'milestone',
      name: 'Track done',
      rule: { type: 'track_completed', levelTrack: 'beginner' },
    });
    const partial = makeSnapshot({
      missions: { 'm-1': makeMissionProgress('m-1', { status: 'completed' }) },
    });
    const full = makeSnapshot({
      missions: {
        'm-1': makeMissionProgress('m-1', { status: 'completed' }),
        'm-2': makeMissionProgress('m-2', { status: 'completed' }),
      },
    });
    expect(isAwardRuleSatisfied(rule.rule, { catalog, snapshot: partial })).toBe(false);
    expect(isAwardRuleSatisfied(rule.rule, { catalog, snapshot: full })).toBe(true);
  });

  it('evaluates score_threshold rules against best scores', () => {
    const missionScoped = award({
      id: 'a-3' as AwardId,
      kind: 'milestone',
      name: 'Ace',
      rule: { type: 'score_threshold', missionId: 'm-1' as never, minScorePercent: 100 },
    });
    const anyMission = award({
      id: 'a-4' as AwardId,
      kind: 'milestone',
      name: 'Perfect anywhere',
      rule: { type: 'score_threshold', minScorePercent: 100 },
    });
    const snapshot = makeSnapshot({ attempts: [attemptWithScore('t-1', 'm-2', 100)] });
    expect(isAwardRuleSatisfied(missionScoped.rule, { catalog, snapshot })).toBe(false);
    expect(isAwardRuleSatisfied(anyMission.rule, { catalog, snapshot })).toBe(true);
  });

  it('evaluates streak rules on consecutive completions in catalog order', () => {
    const rule = award({
      id: 'a-5' as AwardId,
      kind: 'milestone',
      name: 'Streak',
      rule: { type: 'streak', length: 2 },
    });
    const broken = makeSnapshot({
      missions: {
        'm-1': makeMissionProgress('m-1', { status: 'completed' }),
        'm-3': makeMissionProgress('m-3', { status: 'completed' }),
      },
    });
    const consecutive = makeSnapshot({
      missions: {
        'm-1': makeMissionProgress('m-1', { status: 'completed' }),
        'm-2': makeMissionProgress('m-2', { status: 'completed' }),
      },
    });
    expect(isAwardRuleSatisfied(rule.rule, { catalog, snapshot: broken })).toBe(false);
    expect(isAwardRuleSatisfied(rule.rule, { catalog, snapshot: consecutive })).toBe(true);
  });

  it('evaluates percent_complete rules', () => {
    const rule = award({
      id: 'a-6' as AwardId,
      kind: 'milestone',
      name: 'Halfway',
      rule: { type: 'percent_complete', minPercent: 50 },
    });
    const quarter = makeSnapshot({
      missions: { 'm-1': makeMissionProgress('m-1', { status: 'completed' }) },
    });
    const half = makeSnapshot({
      missions: {
        'm-1': makeMissionProgress('m-1', { status: 'completed' }),
        'm-2': makeMissionProgress('m-2', { status: 'completed' }),
      },
    });
    expect(isAwardRuleSatisfied(rule.rule, { catalog, snapshot: quarter })).toBe(false);
    expect(isAwardRuleSatisfied(rule.rule, { catalog, snapshot: half })).toBe(true);
  });
});

describe('milestoneProgressFor', () => {
  const catalog = catalogWithMissions();

  it('reports track progress as missions complete', () => {
    const milestone = award({
      id: 'a-track' as AwardId,
      kind: 'milestone',
      name: 'Beginner track',
      rule: { type: 'track_completed', levelTrack: 'beginner' },
    });
    const snapshot = makeSnapshot({
      missions: { 'm-1': makeMissionProgress('m-1', { status: 'completed' }) },
    });
    expect(milestoneProgressFor(milestone, { catalog, snapshot })).toEqual({
      current: 1,
      target: 2,
    });
  });

  it('reports percent progress toward the threshold', () => {
    const milestone = award({
      id: 'a-percent' as AwardId,
      kind: 'milestone',
      name: 'Halfway',
      rule: { type: 'percent_complete', minPercent: 50 },
    });
    const snapshot = makeSnapshot({
      missions: { 'm-1': makeMissionProgress('m-1', { status: 'completed' }) },
    });
    expect(milestoneProgressFor(milestone, { catalog, snapshot })).toEqual({
      current: 25,
      target: 50,
    });
  });

  it('reports score progress from the best attempt', () => {
    const milestone = award({
      id: 'a-score' as AwardId,
      kind: 'milestone',
      name: 'Ace',
      rule: { type: 'score_threshold', missionId: 'm-1' as never, minScorePercent: 100 },
    });
    const snapshot = makeSnapshot({
      attempts: [attemptWithScore('t-1', 'm-1', 60), attemptWithScore('t-2', 'm-1', 80)],
    });
    expect(milestoneProgressFor(milestone, { catalog, snapshot })).toEqual({
      current: 80,
      target: 100,
    });
  });
});

describe('award list models', () => {
  it('partitions earned and locked awards with earned timestamps', () => {
    const catalog = catalogWithMissions();
    const milestone = award({
      id: 'milestone-half' as AwardId,
      kind: 'milestone',
      name: 'Halfway',
      rule: { type: 'percent_complete', minPercent: 50 },
    });
    catalog.awards = [...catalog.awards, milestone];
    const snapshot = makeSnapshot({ earnedAwardIds: ['award-m-1'] });

    const badges = awardListItems(catalog, snapshot, 'badge');
    expect(badges).toHaveLength(4);
    const earned = badges.find((item) => (item.award.id as string) === 'award-m-1');
    expect(earned?.earned).toBe(true);
    expect(earned?.earnedAt).toBeDefined();
    expect(badges.every((item) => item.award.kind === 'badge')).toBe(true);

    const milestones = awardListItems(catalog, snapshot, 'milestone');
    expect(milestones).toHaveLength(1);
    expect(milestones[0]?.earned).toBe(false);
  });

  it('counts earned badges and milestones separately', () => {
    const catalog = catalogWithMissions();
    catalog.awards = [
      ...catalog.awards,
      award({
        id: 'milestone-half' as AwardId,
        kind: 'milestone',
        name: 'Halfway',
        rule: { type: 'percent_complete', minPercent: 50 },
      }),
    ];
    const snapshot = makeSnapshot({
      earnedAwardIds: ['award-m-1', 'award-m-2', 'milestone-half', 'unknown-award'],
    });
    expect(countEarnedByKind(catalog, snapshot)).toEqual({ badges: 2, milestones: 1 });
  });
});

describe('awardUnlockCondition', () => {
  const catalog = catalogWithMissions();

  it('describes every rule type in learner-facing words', () => {
    const cases: Array<[AwardDefinition, string]> = [
      [
        award({
          id: 'a' as AwardId,
          kind: 'badge',
          name: 'B',
          rule: { type: 'mission_completed', missionId: 'm-1' as never },
        }),
        'Complete the Mission m-1 mission',
      ],
      [
        award({
          id: 'b' as AwardId,
          kind: 'milestone',
          name: 'T',
          rule: { type: 'track_completed', levelTrack: 'beginner' },
        }),
        'Complete every Beginner mission',
      ],
      [
        award({
          id: 'c' as AwardId,
          kind: 'milestone',
          name: 'S',
          rule: { type: 'score_threshold', minScorePercent: 100 },
        }),
        'Score at least 100% on any quiz',
      ],
      [
        award({
          id: 'd' as AwardId,
          kind: 'milestone',
          name: 'K',
          rule: { type: 'streak', length: 3 },
        }),
        'Complete 3 missions in a row',
      ],
      [
        award({
          id: 'e' as AwardId,
          kind: 'milestone',
          name: 'P',
          rule: { type: 'percent_complete', minPercent: 50 },
        }),
        'Reach 50% of all missions complete',
      ],
    ];
    for (const [definition, expected] of cases) {
      expect(awardUnlockCondition(definition, catalog)).toBe(expected);
    }
  });
});

describe('completion helpers', () => {
  const catalog = catalogWithMissions();

  it('computes completion percent with rounding and empty-catalog safety', () => {
    expect(completionPercentFor({ catalog: makeCatalog([]), snapshot: makeSnapshot() })).toBe(0);
    const snapshot = makeSnapshot({
      missions: { 'm-1': makeMissionProgress('m-1', { status: 'completed' }) },
    });
    expect(completionPercentFor({ catalog, snapshot })).toBe(25);
  });

  it('finds the longest completion streak', () => {
    const snapshot = makeSnapshot({
      missions: {
        'm-1': makeMissionProgress('m-1', { status: 'completed' }),
        'm-2': makeMissionProgress('m-2', { status: 'completed' }),
        'm-4': makeMissionProgress('m-4', { status: 'completed' }),
      },
    });
    expect(longestCompletionStreak({ catalog, snapshot })).toBe(2);
  });
});
