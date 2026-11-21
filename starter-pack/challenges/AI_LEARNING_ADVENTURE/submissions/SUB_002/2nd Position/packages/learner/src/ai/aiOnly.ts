import type {
  AiContextPacket,
  AiConversationTurn,
  AiOnlyWalkthroughStep,
  MissionDetail,
  MissionId,
  MissionStep,
  ProgressProjection,
} from '@ai-learning-adventure/types';
import { contextSearchText } from './context.ts';

export const AI_ONLY_MAX_CONTEXT_MISSIONS = 4;
export const AI_ONLY_MAX_HISTORY_TURNS = 8;
export const AI_ONLY_MAX_HISTORY_CHARACTERS = 6000;

export const AI_ONLY_WALKTHROUGH_STEPS: readonly AiOnlyWalkthroughStep[] = [
  'objective',
  'lesson',
  'example',
  'checkpoint',
];

export interface AiOnlyTopic {
  topic: string;
  missionIds: MissionId[];
}

function missionPacket(mission: MissionDetail): NonNullable<AiContextPacket['mission']> {
  return {
    id: mission.id,
    title: mission.title,
    objective: mission.objective,
    levelTrack: mission.levelTrack,
    lesson: mission.lesson,
    example: mission.example,
  };
}

function searchTerms(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter((term) => term.length >= 3),
  );
}

export function selectAiOnlyGroundingMissions(
  missions: readonly MissionDetail[],
  query: string,
  limit = AI_ONLY_MAX_CONTEXT_MISSIONS,
): MissionDetail[] {
  const terms = searchTerms(query);
  if (terms.size === 0) return missions.slice(0, limit);
  return missions
    .map((mission, index) => {
      const searchable = searchTerms(
        contextSearchText({ mission: missionPacket(mission) }),
      );
      let score = 0;
      for (const term of terms) {
        if (searchable.has(term)) score += 1;
      }
      return { mission, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ mission }) => mission);
}

export function buildAiOnlyContext(input: {
  missions: readonly MissionDetail[];
  progress: Pick<ProgressProjection, 'completionPercent' | 'currentLevel' | 'weakTopics'>;
  missionId?: MissionId;
  topic?: string;
  query?: string;
}): AiContextPacket {
  let scoped = [...input.missions];
  if (input.missionId !== undefined) {
    scoped = scoped.filter((mission) => mission.id === input.missionId);
  } else if (input.topic !== undefined) {
    const normalizedTopic = input.topic.toLocaleLowerCase();
    scoped = scoped.filter((mission) =>
      mission.questions.some((question) =>
        question.conceptTags.some((tag) => tag.toLocaleLowerCase() === normalizedTopic),
      ) ||
      mission.flashcards.some((card) =>
        card.conceptTags.some((tag) => tag.toLocaleLowerCase() === normalizedTopic) ||
        card.concept.toLocaleLowerCase() === normalizedTopic,
      ) ||
      mission.lesson.some(
        (block) => block.type === 'key_term' && block.term.toLocaleLowerCase() === normalizedTopic,
      ),
    );
  }
  const selected = selectAiOnlyGroundingMissions(scoped, input.query ?? input.topic ?? '');
  const mission = input.missionId !== undefined ? selected[0] : undefined;
  return {
    ...(mission !== undefined ? { mission: missionPacket(mission) } : {}),
    sourceMissions: selected.map(missionPacket),
    ...(input.topic !== undefined ? { scopeTopic: input.topic } : {}),
    progress: input.progress,
  };
}

export function deriveAiOnlyTopics(missions: readonly MissionDetail[]): AiOnlyTopic[] {
  const topics = new Map<string, { topic: string; missionIds: Set<MissionId> }>();
  for (const mission of missions) {
    const labels = [
      ...mission.questions.flatMap((question) => question.conceptTags),
      ...mission.flashcards.flatMap((card) => [card.concept, ...card.conceptTags]),
      ...mission.lesson.flatMap((block) => (block.type === 'key_term' ? [block.term] : [])),
    ];
    for (const label of labels) {
      const topic = label.trim();
      if (topic.length === 0) continue;
      const key = topic.toLocaleLowerCase();
      const existing = topics.get(key) ?? { topic, missionIds: new Set<MissionId>() };
      existing.missionIds.add(mission.id);
      topics.set(key, existing);
    }
  }
  return [...topics.values()]
    .map(({ topic, missionIds }) => ({ topic, missionIds: [...missionIds] }))
    .sort((a, b) => a.topic.localeCompare(b.topic));
}

export function boundAiConversationHistory(
  turns: readonly AiConversationTurn[],
  maxTurns = AI_ONLY_MAX_HISTORY_TURNS,
  maxCharacters = AI_ONLY_MAX_HISTORY_CHARACTERS,
): AiConversationTurn[] {
  const bounded: AiConversationTurn[] = [];
  let characters = 0;
  for (let index = turns.length - 1; index >= 0 && bounded.length < maxTurns; index -= 1) {
    const turn = turns[index]; // nosemgrep: gitlab.eslint.detect-object-injection
    if (turn === undefined) continue;
    const text = turn.text.trim();
    if (text.length === 0) continue;
    const remaining = maxCharacters - characters;
    if (remaining <= 0) break;
    const clipped = text.length > remaining ? text.slice(text.length - remaining) : text;
    bounded.push({ role: turn.role, text: clipped });
    characters += clipped.length;
  }
  return bounded.reverse();
}

export function nextAiOnlyWalkthroughStep(
  step: AiOnlyWalkthroughStep,
): AiOnlyWalkthroughStep | undefined {
  const index = AI_ONLY_WALKTHROUGH_STEPS.indexOf(step);
  return index >= 0 ? AI_ONLY_WALKTHROUGH_STEPS[index + 1] : undefined; // nosemgrep: gitlab.eslint.detect-object-injection
}

export function walkthroughStepToMissionStep(step: AiOnlyWalkthroughStep): MissionStep {
  switch (step) {
    case 'objective':
    case 'lesson':
      return 'lesson';
    case 'example':
      return 'example';
    case 'checkpoint':
      return 'checkpoint';
  }
}
