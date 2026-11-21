import type {
  AwardDefinition,
  AwardRule,
  CatalogDto,
  IsoDateTime,
  LevelTrack,
  MissionId,
  ProgressSnapshot,
} from '@ai-learning-adventure/types';
import { LEVEL_TRACK_LABELS } from './tracks.ts';
import { missionStatusOf } from './missionAvailability.ts';

export interface AwardEvaluationContext {
  catalog: CatalogDto;
  snapshot: ProgressSnapshot;
}

export function completionPercentFor(context: AwardEvaluationContext): number {
  const total = context.catalog.missions.length;
  if (total === 0) return 0;
  const completed = context.catalog.missions.filter(
    (mission) => missionStatusOf(context.snapshot, mission.id) === 'completed',
  ).length;
  return Math.round((completed / total) * 100);
}

export function longestCompletionStreak(context: AwardEvaluationContext): number {
  let current = 0;
  let longest = 0;
  for (const mission of context.catalog.missions) {
    if (missionStatusOf(context.snapshot, mission.id) === 'completed') {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function bestScoreForMission(context: AwardEvaluationContext, missionId: MissionId): number | undefined {
  return context.snapshot.attempts
    .filter((attempt) => attempt.missionId === missionId)
    .reduce<number | undefined>(
      (best, attempt) => (best === undefined ? attempt.scorePercent : Math.max(best, attempt.scorePercent)),
      undefined,
    );
}

function bestScoreOverall(context: AwardEvaluationContext): number | undefined {
  return context.snapshot.attempts.reduce<number | undefined>(
    (best, attempt) => (best === undefined ? attempt.scorePercent : Math.max(best, attempt.scorePercent)),
    undefined,
  );
}

export function isAwardRuleSatisfied(rule: AwardRule, context: AwardEvaluationContext): boolean {
  switch (rule.type) {
    case 'mission_completed':
      return missionStatusOf(context.snapshot, rule.missionId) === 'completed';
    case 'track_completed': {
      const trackMissions = context.catalog.missions.filter(
        (mission) => mission.levelTrack === rule.levelTrack,
      );
      return (
        trackMissions.length > 0 &&
        trackMissions.every(
          (mission) => missionStatusOf(context.snapshot, mission.id) === 'completed',
        )
      );
    }
    case 'score_threshold': {
      const best =
        rule.missionId !== undefined
          ? bestScoreForMission(context, rule.missionId)
          : bestScoreOverall(context);
      return best !== undefined && best >= rule.minScorePercent;
    }
    case 'streak':
      return longestCompletionStreak(context) >= rule.length;
    case 'percent_complete':
      return completionPercentFor(context) >= rule.minPercent;
  }
}

export interface MilestoneProgress {
  current: number;
  target: number;
}

export function milestoneProgressFor(
  award: AwardDefinition,
  context: AwardEvaluationContext,
): MilestoneProgress | undefined {
  const rule = award.rule;
  switch (rule.type) {
    case 'mission_completed':
      return {
        current: missionStatusOf(context.snapshot, rule.missionId) === 'completed' ? 1 : 0,
        target: 1,
      };
    case 'track_completed': {
      const trackMissions = context.catalog.missions.filter(
        (mission) => mission.levelTrack === rule.levelTrack,
      );
      if (trackMissions.length === 0) return undefined;
      return {
        current: trackMissions.filter(
          (mission) => missionStatusOf(context.snapshot, mission.id) === 'completed',
        ).length,
        target: trackMissions.length,
      };
    }
    case 'score_threshold': {
      const best =
        rule.missionId !== undefined
          ? bestScoreForMission(context, rule.missionId)
          : bestScoreOverall(context);
      return { current: best ?? 0, target: rule.minScorePercent };
    }
    case 'streak':
      return { current: longestCompletionStreak(context), target: rule.length };
    case 'percent_complete':
      return { current: completionPercentFor(context), target: rule.minPercent };
  }
}

export interface AwardListItem {
  award: AwardDefinition;
  earned: boolean;
  earnedAt?: IsoDateTime;
}

function earnedAwardMap(snapshot: ProgressSnapshot): Map<string, IsoDateTime> {
  return new Map(snapshot.earnedAwards.map((entry) => [entry.awardId as string, entry.earnedAt]));
}

export function awardListItems(
  catalog: CatalogDto,
  snapshot: ProgressSnapshot,
  kind: AwardDefinition['kind'],
): AwardListItem[] {
  const earned = earnedAwardMap(snapshot);
  return catalog.awards
    .filter((award) => award.kind === kind)
    .map((award) => {
      const earnedAt = earned.get(award.id as string);
      return {
        award,
        earned: earnedAt !== undefined,
        ...(earnedAt !== undefined ? { earnedAt } : {}),
      };
    });
}

export function countEarnedByKind(
  catalog: CatalogDto,
  snapshot: ProgressSnapshot,
): { badges: number; milestones: number } {
  const kindById = new Map(catalog.awards.map((award) => [award.id as string, award.kind]));
  let badges = 0;
  let milestones = 0;
  for (const entry of snapshot.earnedAwards) {
    const kind = kindById.get(entry.awardId as string);
    if (kind === 'badge') badges += 1;
    else if (kind === 'milestone') milestones += 1;
  }
  return { badges, milestones };
}

export function awardUnlockCondition(award: AwardDefinition, catalog: CatalogDto): string {
  const rule = award.rule;
  const missionTitle = (missionId: MissionId): string =>
    catalog.missions.find((mission) => mission.id === missionId)?.title ?? 'the mission';
  const trackLabel = (levelTrack: LevelTrack): string => LEVEL_TRACK_LABELS[levelTrack]; // nosemgrep: gitlab.eslint.detect-object-injection
  switch (rule.type) {
    case 'mission_completed':
      return `Complete the ${missionTitle(rule.missionId)} mission`;
    case 'track_completed':
      return `Complete every ${trackLabel(rule.levelTrack)} mission`;
    case 'score_threshold':
      return rule.missionId !== undefined
        ? `Score at least ${rule.minScorePercent}% on the ${missionTitle(rule.missionId)} quiz`
        : `Score at least ${rule.minScorePercent}% on any quiz`;
    case 'streak':
      return `Complete ${rule.length} missions in a row`;
    case 'percent_complete':
      return `Reach ${rule.minPercent}% of all missions complete`;
  }
}
