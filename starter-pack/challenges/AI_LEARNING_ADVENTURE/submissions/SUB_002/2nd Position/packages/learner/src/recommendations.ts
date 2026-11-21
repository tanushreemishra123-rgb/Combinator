import type {
  CatalogDto,
  MissionId,
  NextStepRecommendation,
  ProgressSnapshot,
  QuizAttempt,
} from '@ai-learning-adventure/types';
import { LEVEL_TRACK_LABELS } from './tracks.ts';
import { missionStatusOf } from './missionAvailability.ts';
import { recommendNextMission } from './missionCompletion.ts';
import type { WeakTopicSignal } from './quiz.ts';

export function latestAttemptOverall(snapshot: ProgressSnapshot): QuizAttempt | undefined {
  return [...snapshot.attempts].sort( // nosemgrep: gitlab.eslint.detect-object-injection
    (a, b) => a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id),
  )[snapshot.attempts.length - 1];
}

export function quizWeakTopicSignals(snapshot: ProgressSnapshot): WeakTopicSignal[] {
  const byTopic = new Map<string, { weight: number; sources: Set<string> }>();
  for (const attempt of snapshot.attempts) {
    for (const answer of attempt.answers) {
      if (answer.isCorrect) continue;
      for (const topic of answer.conceptTags) {
        const entry = byTopic.get(topic) ?? { weight: 0, sources: new Set<string>() };
        entry.weight += 1;
        entry.sources.add(`quiz:${attempt.missionId}`);
        byTopic.set(topic, entry);
      }
    }
  }
  return [...byTopic.entries()]
    .map(([topic, entry]) => ({
      topic,
      weight: entry.weight,
      sources: [...entry.sources].sort(),
    }))
    .sort((a, b) => b.weight - a.weight || a.topic.localeCompare(b.topic));
}

export function hasStruggleSignal(snapshot: ProgressSnapshot): boolean {
  const latest = latestAttemptOverall(snapshot);
  return latest !== undefined && latest.result === 'needs_review';
}

export interface RecommendNextStepInput {
  catalog: CatalogDto;
  snapshot: ProgressSnapshot;
  excludeMissionId?: MissionId;
  weakTopics?: readonly WeakTopicSignal[];
}

export function recommendNextStep(input: RecommendNextStepInput): NextStepRecommendation {
  const weakTopics = input.weakTopics ?? quizWeakTopicSignals(input.snapshot);

  if (hasStruggleSignal(input.snapshot) && weakTopics.length > 0) {
    const strongest = weakTopics[0]!;
    return {
      kind: 'review',
      review: {
        topic: strongest.topic,
        reason:
          strongest.weight === 1
            ? 'You missed a question on this topic'
            : `You missed ${strongest.weight} questions on this topic`,
        weight: strongest.weight,
        sources: strongest.sources,
      },
    };
  }

  let mission = recommendNextMission(input.catalog, input.snapshot, input.excludeMissionId);
  if (mission === undefined) {
    mission = recommendNextMission(input.catalog, input.snapshot);
  }
  if (mission === undefined) {
    return { kind: 'journey_complete' };
  }

  const trackLabel = LEVEL_TRACK_LABELS[mission.levelTrack]; // nosemgrep: gitlab.eslint.detect-object-injection
  let reason: string;
  if (missionStatusOf(input.snapshot, mission.id) === 'in_progress') {
    reason = 'Pick up where you left off.';
  } else if (input.excludeMissionId !== undefined) {
    reason = `Next up in ${trackLabel}.`;
  } else {
    reason = `Your next step in the ${trackLabel} track.`;
  }

  return {
    kind: 'mission',
    mission: { mission, reason, source: 'deterministic' },
  };
}
