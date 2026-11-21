import type {
  AiContextPacket,
  AiQuestionContext,
  ExplanationLevel,
  ProgressProjection,
} from '@ai-learning-adventure/types';
import type {
  Checkpoint,
  Flashcard,
  LevelTrack,
  MissionDetail,
  MissionStep,
  QuizQuestion,
} from '@ai-learning-adventure/types';

function missionPacket(mission: MissionDetail): AiContextPacket['mission'] {
  return {
    id: mission.id,
    title: mission.title,
    objective: mission.objective,
    levelTrack: mission.levelTrack,
    lesson: mission.lesson,
    example: mission.example,
  };
}

export function buildMissionContext(mission: MissionDetail): AiContextPacket {
  return { mission: missionPacket(mission) };
}

export function buildMissionStepContext(
  mission: MissionDetail,
  step: MissionStep,
): AiContextPacket {
  return { ...buildMissionContext(mission), step };
}

export function buildQuestionContext(
  mission: MissionDetail,
  question: QuizQuestion,
  progress?: Pick<ProgressProjection, 'completionPercent' | 'currentLevel' | 'weakTopics'>,
): AiContextPacket {
  const questionContext: AiQuestionContext = {
    id: question.id,
    missionId: question.missionId,
    type: question.type,
    stem: question.stem,
    selectionMode: question.selectionMode,
    options: question.options.map(({ id, text }) => ({ id, text })),
    conceptTags: question.conceptTags,
    ...(question.type === 'scenario'
      ? { scenario: question.scenario, allowsReasoning: question.allowsReasoning }
      : {}),
  };
  return {
    mission: missionPacket(mission),
    step: 'quiz',
    question: questionContext,
    ...(progress !== undefined ? { progress } : {}),
  };
}

export function buildCheckpointContext(
  mission: MissionDetail,
  checkpoint: Checkpoint,
): AiContextPacket {
  return {
    mission: missionPacket(mission),
    step: 'checkpoint',
    checkpoint: { kind: checkpoint.kind, prompt: checkpoint.prompt },
    ...(checkpoint.kind === 'single_question'
      ? {
          question: {
            id: `${mission.id}-checkpoint` as QuizQuestion['id'],
            missionId: mission.id,
            type: 'multiple_choice' as const,
            stem: checkpoint.prompt,
            selectionMode: 'single' as const,
            options: checkpoint.options.map(({ id, text }) => ({ id, text })),
            conceptTags: [],
          },
        }
      : {}),
  };
}

export function buildFlashcardContext(
  mission: MissionDetail,
  flashcard: Flashcard,
): AiContextPacket {
  return { mission: missionPacket(mission), step: 'lesson', flashcard };
}

export function buildWeakTopicContext(
  mission: MissionDetail | undefined,
  topics: Array<{ topic: string; weight: number; sources: string[] }>,
): AiContextPacket {
  return {
    ...(mission !== undefined ? { mission: missionPacket(mission) } : {}),
    progress: {
      completionPercent: 0,
      currentLevel: mission?.levelTrack ?? 'beginner',
      weakTopics: topics,
    },
  };
}

export function explanationLevelForTrack(levelTrack: LevelTrack): ExplanationLevel {
  switch (levelTrack) {
    case 'beginner':
      return 'simple';
    case 'basic_understanding':
    case 'applied_practice':
      return 'standard';
    case 'responsible_use':
    case 'builder_mindset':
      return 'deeper';
  }
}

export function contextMissionIds(context: AiContextPacket): string[] {
  const ids = new Set<string>();
  if (context.mission !== undefined) ids.add(context.mission.id as string);
  for (const mission of context.sourceMissions ?? []) ids.add(mission.id as string);
  if (context.question !== undefined) ids.add(context.question.missionId as string);
  if (context.flashcard !== undefined) ids.add(context.flashcard.missionId as string);
  if (context.progress !== undefined) {
    for (const topic of context.progress.weakTopics) {
      for (const source of topic.sources) {
        if (source.startsWith('quiz:')) ids.add(source.slice('quiz:'.length));
      }
    }
  }
  return [...ids];
}

export function contextSearchText(context: AiContextPacket): string {
  const parts: string[] = [];
  const missions = context.sourceMissions ?? (context.mission !== undefined ? [context.mission] : []);
  const seenMissionIds = new Set<string>();
  for (const mission of missions) {
    if (seenMissionIds.has(mission.id as string)) continue;
    seenMissionIds.add(mission.id as string);
    parts.push(mission.title, mission.objective);
    for (const block of mission.lesson) {
      if (block.type === 'paragraph' || block.type === 'callout') parts.push(block.text);
      if (block.type === 'list') parts.push(...block.items);
      if (block.type === 'key_term') parts.push(block.term);
    }
    if (mission.example.type === 'worked_example') {
      parts.push(mission.example.before, mission.example.after);
      parts.push(...mission.example.annotations);
    } else {
      parts.push(
        mission.example.narrative,
        mission.example.reflectionPrompt,
        mission.example.takeaway,
      );
    }
  }
  if (context.scopeTopic !== undefined) parts.push(context.scopeTopic);
  if (context.question !== undefined) {
    parts.push(context.question.stem, ...context.question.options.map((option) => option.text));
    if (context.question.type === 'scenario' && context.question.scenario !== undefined) {
      parts.push(context.question.scenario);
    }
  }
  if (context.checkpoint !== undefined) parts.push(context.checkpoint.prompt);
  if (context.flashcard !== undefined) {
    parts.push(
      context.flashcard.concept,
      context.flashcard.definition,
      context.flashcard.example,
      context.flashcard.commonMistake ?? '',
      context.flashcard.learningTip ?? '',
    );
  }
  if (context.progress !== undefined) parts.push(...context.progress.weakTopics.map((topic) => topic.topic));
  return parts.join(' ');
}
