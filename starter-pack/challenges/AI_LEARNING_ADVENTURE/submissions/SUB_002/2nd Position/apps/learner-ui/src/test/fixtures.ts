import { vi } from 'vitest';
import type {
  AwardDefinition,
  AwardId,
  CatalogDto,
  Checkpoint,
  Flashcard,
  IsoDateTime,
  LessonBlock,
  MissionDetail,
  MissionExample,
  MissionId,
  MissionProgress,
  MissionProgressStatus,
  MissionStep,
  MissionSummary,
  ProgressSnapshot,
  QuizAttempt,
  QuizQuestion,
  RateFlashcardRequest,
  RecordQuizAttemptRequest,
  UpdateMissionProgressRequest,
} from '@ai-learning-adventure/types';
import { buildQuizAttempt, isAwardRuleSatisfied, stepRank } from '@ai-learning-adventure/learner';

export function missionId(value: string): MissionId {
  return value as MissionId;
}

function iso(value: string): IsoDateTime {
  return value as IsoDateTime;
}

export function makeMission(input: {
  id: string;
  title?: string;
  difficulty?: MissionSummary['difficulty'];
  levelTrack?: MissionSummary['levelTrack'];
  trackOrder?: number;
  prerequisiteMissionId?: string;
  estimatedMinutes?: number;
}): MissionSummary {
  return {
    id: missionId(input.id),
    title: input.title ?? `Mission ${input.id}`,
    difficulty: input.difficulty ?? 'beginner',
    levelTrack: input.levelTrack ?? 'beginner',
    trackOrder: input.trackOrder ?? 1,
    objective: `Objective for ${input.id}`,
    ...(input.prerequisiteMissionId !== undefined
      ? { prerequisiteMissionId: missionId(input.prerequisiteMissionId) }
      : {}),
    estimatedMinutes: input.estimatedMinutes ?? 10,
    contentVersion: 1,
  };
}

export function makeAward(id: string, missionIdValue: string): AwardDefinition {
  return {
    id: id as AwardId,
    kind: 'badge',
    name: `Badge for ${missionIdValue}`,
    icon: `badge-${missionIdValue}`,
    description: 'Awarded for completing the mission.',
    missionId: missionId(missionIdValue),
    rule: { type: 'mission_completed', missionId: missionId(missionIdValue) },
  };
}

export function makeCatalog(missions: MissionSummary[]): CatalogDto {
  return {
    contentVersion: 'test',
    missions,
    awards: missions.map((mission) => makeAward(`award-${mission.id}`, mission.id)),
  };
}

export function makeMissionProgress(
  id: string,
  input: { status: MissionProgressStatus; furthestStep?: MissionStep; checkpointCompleted?: boolean },
): MissionProgress {
  return {
    missionId: missionId(id),
    status: input.status,
    furthestStep: input.furthestStep ?? 'lesson',
    checkpointCompleted: input.checkpointCompleted ?? false,
    startedAt: iso('2026-08-01T00:00:00.000Z'),
    ...(input.status === 'completed' ? { completedAt: iso('2026-08-02T00:00:00.000Z') } : {}),
  };
}

export function makeMultipleChoiceQuestions(ids: string[]): QuizQuestion[] {
  return ids.map((id, index) => ({
    id: id as never,
    missionId: missionId('mission-1'),
    type: 'multiple_choice',
    stem: `Question ${index + 1}: choose the best answer.`,
    selectionMode: 'single',
    options: [
      { id: `${id}-a`, text: `Correct answer ${index + 1}`, isCorrect: true },
      { id: `${id}-b`, text: `Wrong answer ${index + 1}`, isCorrect: false },
    ],
    correctExplanation: `Explanation for question ${index + 1} (correct).`,
    incorrectExplanation: `Explanation for question ${index + 1} (incorrect).`,
    conceptTags: ['topic-a'],
  }));
}

export function makeTrueFalseQuestion(id: string): QuizQuestion {
  return {
    id: id as never,
    missionId: missionId('mission-1'),
    type: 'true_false',
    stem: 'AI systems are always human-like.',
    selectionMode: 'single',
    options: [
      { id: `${id}-false`, text: 'False', isCorrect: true },
      { id: `${id}-true`, text: 'True', isCorrect: false },
    ],
    correctExplanation: 'Most AI systems are narrow.',
    incorrectExplanation: 'AI does not need to be human-like.',
    conceptTags: ['topic-a'],
  };
}

export function makeScenarioQuestion(id: string): QuizQuestion {
  return {
    id: id as never,
    missionId: missionId('mission-1'),
    type: 'scenario',
    stem: 'What is the best next step?',
    scenario: 'A teammate pastes a customer email into a public chatbot.',
    selectionMode: 'single',
    options: [
      { id: `${id}-stop`, text: 'Stop and flag the data risk', isCorrect: true },
      {
        id: `${id}-ignore`,
        text: 'Ignore it once',
        isCorrect: false,
        incorrectReason: 'The risk repeats every time.',
      },
    ],
    correctExplanation: 'Personal data must never be shared with logging tools.',
    incorrectExplanation: 'Even a single paste can leak customer data.',
    conceptTags: ['topic-a'],
    allowsReasoning: true,
  };
}

export function makeSnapshot(input: {
  missions?: Record<string, MissionProgress>;
  attempts?: QuizAttempt[];
  earnedAwardIds?: string[];
  flashcardRatings?: ProgressSnapshot['flashcardRatings'];
} = {}): ProgressSnapshot {
  return {
    learnerId: 'learner-test',
    schemaVersion: 1,
    revision: iso('2026-08-01T00:00:00.000Z'),
    missions: input.missions ?? {},
    attempts: input.attempts ?? [],
    flashcardRatings: input.flashcardRatings ?? {},
    earnedAwards: (input.earnedAwardIds ?? []).map((awardId) => ({
      awardId: awardId as AwardId,
      earnedAt: iso('2026-08-02T00:00:00.000Z'),
    })),
  };
}

export function makeAttempt(
  id: string,
  missionIdValue: string,
  scorePercent: number,
): QuizAttempt {
  return {
    id,
    missionId: missionId(missionIdValue),
    contentVersion: 1,
    answers: [],
    scorePercent,
    correctCount: Math.round(scorePercent / 20),
    questionCount: 5,
    result: scorePercent >= 70 ? 'passed' : 'needs_review',
    weakTopics: [],
    startedAt: iso('2026-08-01T00:00:00.000Z'),
    completedAt: iso('2026-08-01T00:10:00.000Z'),
  };
}

export function defaultLesson(): LessonBlock[] {
  return [
    { type: 'paragraph', text: 'AI is a broad field of computer science.' },
    { type: 'list', items: ['AI learns from data', 'AI automates decisions'] },
    { type: 'callout', tone: 'key_idea', text: 'Models are only as good as their data.' },
    { type: 'key_term', term: 'model', flashcardId: 'flashcard-model' as never },
  ];
}

export function defaultExample(): MissionExample {
  return {
    type: 'worked_example',
    before: 'Write something about dogs.',
    after: 'List 3 fun facts about golden retrievers for a 10-year-old.',
    annotations: ['The rewrite names a clear audience', 'It asks for a specific format'],
  };
}

export function scenarioExample(): MissionExample {
  return {
    type: 'scenario',
    narrative: 'A teammate pastes a customer email into a public chatbot.',
    reflectionPrompt: 'What could go wrong here?',
    takeaway: 'Personal data should never be shared with tools that log it.',
  };
}

export function singleQuestionCheckpoint(): Checkpoint {
  return {
    kind: 'single_question',
    prompt: 'Which prompt is the strongest?',
    options: [
      { id: 'opt-weak', text: 'Write something', isCorrect: false, incorrectReason: 'Too vague.' },
      { id: 'opt-strong', text: 'Write a 3-line summary for a beginner', isCorrect: true },
    ],
    explanation: 'Specific prompts give the model a clear goal.',
  };
}

export function writeResponseCheckpoint(): Checkpoint {
  return { kind: 'write_response', prompt: 'In one sentence, what is an AI model?' };
}

export function sortCheckpoint(): Checkpoint {
  return {
    kind: 'sort_into_buckets',
    prompt: 'Sort these prompts into strong and weak.',
    buckets: ['strong', 'weak'],
    items: [
      { id: 'item-clear', text: 'Names a clear goal', correctBucket: 'strong' },
      { id: 'item-vague', text: 'Says “do the thing”', correctBucket: 'weak' },
    ],
  };
}

export function spotCheckpoint(): Checkpoint {
  return {
    kind: 'spot_the_problem',
    prompt: 'Highlight the risky part of the sentence.',
    passage: 'Please email my password to everyone.',
    answerRange: { start: 13, end: 24 },
  };
}

export function defaultQuestions(id: string): QuizQuestion[] {
  return [
    {
      id: `${id}-q1` as never,
      missionId: missionId(id),
      type: 'multiple_choice',
      stem: 'What does AI learn from?',
      selectionMode: 'single',
      options: [
        { id: 'q1-data', text: 'Data', isCorrect: true },
        { id: 'q1-guesses', text: 'Guesses', isCorrect: false },
      ],
      correctExplanation: 'AI systems learn patterns from data.',
      incorrectExplanation: 'AI systems learn patterns from data.',
      conceptTags: ['ai-basics'],
    },
  ];
}

export function defaultFlashcards(): Flashcard[] {
  return [
    {
      id: 'flashcard-model' as never,
      missionId: 'mission-1' as never,
      concept: 'model',
      definition: 'A program trained to recognize patterns in data.',
      example: 'A spam filter trained on labelled emails.',
      commonMistake: 'Assuming a model understands like a human.',
      learningTip: 'Think “trained pattern matcher”.',
      conceptTags: ['ai-basics'],
    },
  ];
}

export interface MissionDetailInput {
  id: string;
  title?: string;
  difficulty?: MissionSummary['difficulty'];
  levelTrack?: MissionSummary['levelTrack'];
  trackOrder?: number;
  prerequisiteMissionId?: string;
  estimatedMinutes?: number;
  lesson?: LessonBlock[];
  example?: MissionExample;
  checkpoint?: Checkpoint;
  questions?: QuizQuestion[];
  flashcards?: Flashcard[];
  passThreshold?: number;
}

export function makeMissionDetail(input: MissionDetailInput): MissionDetail {
  const summary = makeMission({
    id: input.id,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
    ...(input.levelTrack !== undefined ? { levelTrack: input.levelTrack } : {}),
    ...(input.trackOrder !== undefined ? { trackOrder: input.trackOrder } : {}),
    ...(input.prerequisiteMissionId !== undefined
      ? { prerequisiteMissionId: input.prerequisiteMissionId }
      : {}),
    ...(input.estimatedMinutes !== undefined ? { estimatedMinutes: input.estimatedMinutes } : {}),
  });
  return {
    ...summary,
    lesson: input.lesson ?? defaultLesson(),
    example: input.example ?? defaultExample(),
    checkpoint: input.checkpoint ?? singleQuestionCheckpoint(),
    questions: input.questions ?? defaultQuestions(input.id),
    flashcards: input.flashcards ?? defaultFlashcards(),
    awards: [makeAward(`award-${input.id}`, input.id)],
    passThreshold: input.passThreshold ?? 70,
  };
}

export interface MockLearnerApiOptions {
  missionDetails?: Record<string, MissionDetail>;
}

export function mockLearnerApi(
  catalog: CatalogDto,
  snapshot: ProgressSnapshot,
  options: MockLearnerApiOptions = {},
) {
  let current: ProgressSnapshot = snapshot;

  function applyAwards(occurredAt: IsoDateTime): AwardId[] {
    const earnedIds = new Set(current.earnedAwards.map((entry) => entry.awardId as string));
    const newlyEarned: AwardId[] = [];
    for (const award of catalog.awards) {
      if (earnedIds.has(award.id as string)) continue;
      if (!isAwardRuleSatisfied(award.rule, { catalog, snapshot: current })) continue;
      current = {
        ...current,
        earnedAwards: [...current.earnedAwards, { awardId: award.id, earnedAt: occurredAt }],
      };
      newlyEarned.push(award.id);
    }
    return newlyEarned;
  }

  function applyMissionProgress(missionIdValue: string, input: UpdateMissionProgressRequest): void {
    const existing = current.missions[missionIdValue] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    const furthestStep =
      existing !== undefined && stepRank(existing.furthestStep) >= stepRank(input.furthestStep)
        ? existing.furthestStep
        : input.furthestStep;
    const checkpointCompleted =
      (existing?.checkpointCompleted ?? false) || input.checkpointCompleted === true;
    const hasPassedAttempt = current.attempts.some(
      (attempt) => attempt.missionId === missionIdValue && attempt.result === 'passed',
    );
    const completed = checkpointCompleted && hasPassedAttempt;
    const nextProgress: MissionProgress = {
      missionId: missionId(missionIdValue),
      status: completed ? 'completed' : 'in_progress',
      furthestStep,
      checkpointCompleted,
      startedAt: existing?.startedAt ?? input.occurredAt,
      ...(completed || existing?.completedAt !== undefined
        ? { completedAt: existing?.completedAt ?? input.occurredAt }
        : {}),
    };
    current = {
      ...current,
      revision: input.occurredAt,
      missions: { ...current.missions, [missionIdValue]: nextProgress },
    };
  }

  function applyQuizAttempt(input: RecordQuizAttemptRequest): ProgressSnapshot {
    const detail = options.missionDetails?.[input.attempt.missionId as string] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    const questions = detail?.questions ?? [];
    const passThreshold = detail?.passThreshold ?? 70;
    const attempt = buildQuizAttempt({
      attemptId: input.attempt.id,
      missionId: input.attempt.missionId,
      contentVersion: input.attempt.contentVersion,
      questions,
      submissions: input.attempt.answers,
      passThreshold,
      startedAt: input.attempt.startedAt,
      completedAt: input.attempt.completedAt,
    });
    const existing = current.missions[attempt.missionId as string] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    const checkpointCompleted = existing?.checkpointCompleted ?? false;
    const completed = checkpointCompleted && attempt.result === 'passed';
    const progress: MissionProgress = {
      missionId: attempt.missionId,
      status: existing?.status === 'completed' || completed ? 'completed' : 'in_progress',
      furthestStep:
        existing !== undefined &&
        stepRank(existing.furthestStep) >= stepRank(attempt.result === 'passed' ? 'result' : 'quiz')
          ? existing.furthestStep
          : attempt.result === 'passed'
            ? 'result'
            : 'quiz',
      checkpointCompleted,
      startedAt: existing?.startedAt ?? attempt.startedAt,
      completedAt:
        existing?.completedAt ?? (completed ? attempt.completedAt : undefined),
    };
    return {
      ...current,
      revision: attempt.completedAt,
      attempts: [...current.attempts.filter((candidate) => candidate.id !== attempt.id), attempt],
      missions: { ...current.missions, [attempt.missionId as string]: progress },
    };
  }

  function applyFlashcardRating(
    flashcardIdValue: string,
    input: RateFlashcardRequest,
  ): ProgressSnapshot {
    const existing = current.flashcardRatings[flashcardIdValue] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    return {
      ...current,
      revision: input.occurredAt,
      flashcardRatings: {
        ...current.flashcardRatings,
        [flashcardIdValue]: {
          rating: input.rating,
          reviewCount: (existing?.reviewCount ?? 0) + 1,
          updatedAt: input.occurredAt,
        },
      },
    };
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    function json(body: unknown, status = 200): Response {
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.includes('/api/v1/catalog')) {
      return json({ data: catalog });
    }
    if (url.includes('/quiz-attempts') && method === 'POST') {
      const input = JSON.parse(String(init?.body)) as RecordQuizAttemptRequest;
      current = applyQuizAttempt(input);
      const newlyEarnedAwards = applyAwards(input.attempt.completedAt);
      const attempt = current.attempts.find((candidate) => candidate.id === input.attempt.id);
      return json({ data: { attempt, snapshot: current, newlyEarnedAwards } });
    }
    const flashcardRatingMatch = url.match(/\/flashcards\/([^/]+)\/rating$/);
    if (flashcardRatingMatch !== null && method === 'PUT') {
      const flashcardIdValue = decodeURIComponent(flashcardRatingMatch[1] ?? '');
      const input = JSON.parse(String(init?.body)) as RateFlashcardRequest;
      current = applyFlashcardRating(flashcardIdValue, input);
      const rating = current.flashcardRatings[flashcardIdValue];
      return json({
        data: {
          flashcardId: flashcardIdValue,
          rating: rating?.rating,
          reviewCount: rating?.reviewCount,
          updatedAt: rating?.updatedAt,
          weakTopics: [],
        },
      });
    }
    if (url.includes('/progress') && method === 'DELETE') {
      return json({ data: current });
    }
    const missionProgressMatch = url.match(/\/missions\/([^/]+)\/progress$/);
    if (missionProgressMatch !== null && method === 'PUT') {
      const missionIdValue = decodeURIComponent(missionProgressMatch[1] ?? '');
      const input = JSON.parse(String(init?.body)) as UpdateMissionProgressRequest;
      applyMissionProgress(missionIdValue, input);
      const newlyEarnedAwards = applyAwards(input.occurredAt);
      return json({ data: { snapshot: current, newlyEarnedAwards } });
    }
    if (url.includes('/missions/') && method === 'GET') {
      const id = decodeURIComponent(url.split('/missions/')[1] ?? '');
      const detail = options.missionDetails?.[id];
      if (detail !== undefined) {
        return json({ data: { mission: detail } });
      }
      return json({ error: { code: 'not_found', message: 'Not found', requestId: 'test' } }, 404);
    }
    if (url.includes('/learners/') && method === 'GET') {
      return json({ data: current });
    }
    return json({ error: { code: 'not_found', message: 'Not found', requestId: 'test' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function seedCatalog(): CatalogDto {
  return makeCatalog([
    makeMission({ id: 'mission-1', title: 'What Is AI?', levelTrack: 'beginner', trackOrder: 1 }),
    makeMission({
      id: 'mission-2',
      title: 'Generative AI',
      levelTrack: 'beginner',
      trackOrder: 2,
      difficulty: 'intermediate',
      prerequisiteMissionId: 'mission-1',
    }),
    makeMission({
      id: 'mission-3',
      title: 'What Is an LLM?',
      levelTrack: 'basic_understanding',
      trackOrder: 1,
      difficulty: 'intermediate',
      prerequisiteMissionId: 'mission-2',
    }),
    makeMission({
      id: 'mission-4',
      title: 'Prompt Engineering Basics',
      levelTrack: 'applied_practice',
      trackOrder: 1,
      difficulty: 'advanced',
      prerequisiteMissionId: 'mission-3',
    }),
  ]);
}

