import awards from '../../../../apps/api/mission-data/awards.json';
import flashcards from '../../../../apps/api/mission-data/flashcards.json';
import missions from '../../../../apps/api/mission-data/missions.json';
import questions from '../../../../apps/api/mission-data/questions.json';
import type {
  AdminAwardDoc,
  AdminContentBundle,
  AdminEntityType,
  AdminFlashcardDoc,
  AdminMissionDoc,
  AdminQuestionDoc,
  IsoDateTime,
} from '@ai-learning-adventure/types';

export const seededMissions = missions;
export const seededQuestions = questions;
export const seededFlashcards = flashcards;
export const seededAwards = awards;

export const firstMission = seededMissions[0]!;
export const secondMission = seededMissions[1]!;
export const firstQuestion = seededQuestions[0]!;
export const secondQuestion = seededQuestions[1]!;
export const firstFlashcard = seededFlashcards[0]!;
export const secondFlashcard = seededFlashcards[1]!;
export const firstAward = seededAwards[0]!;

export const FIXED_TIME = '2026-08-15T10:00:00.000Z' as IsoDateTime;

export const inventoryCases: ReadonlyArray<{
  entityType: AdminEntityType;
  route: string;
  heading: string;
  seededTitle: string;
  secondTitle: string;
}> = [
  {
    entityType: 'mission',
    route: '/missions',
    heading: 'Missions',
    seededTitle: firstMission.title,
    secondTitle: secondMission.title,
  },
  {
    entityType: 'question',
    route: '/questions',
    heading: 'Questions',
    seededTitle: firstQuestion.stem,
    secondTitle: secondQuestion.stem,
  },
  {
    entityType: 'flashcard',
    route: '/flashcards',
    heading: 'Flashcards',
    seededTitle: firstFlashcard.concept,
    secondTitle: secondFlashcard.concept,
  },
  {
    entityType: 'award',
    route: '/badges',
    heading: 'Badges & Milestones',
    seededTitle: firstAward.name,
    secondTitle: seededAwards[1]!.name,
  },
];

export function makeMissionDoc(
  id: string,
  overrides: Partial<AdminMissionDoc> = {},
): AdminMissionDoc {
  return {
    id,
    slug: `integration-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    title: 'Integration Mission',
    difficulty: 'beginner',
    levelTrack: 'builder_mindset',
    trackOrder: 90,
    objective: 'Verify an administrator can manage a complete mission draft.',
    lesson: [{ type: 'paragraph', text: 'A complete integration-test lesson.' }],
    example: {
      type: 'scenario',
      narrative: 'An administrator prepares a mission for review.',
      reflectionPrompt: 'What must be checked before publishing?',
      takeaway: 'Review every learner-facing field.',
    },
    checkpoint: {
      kind: 'single_question',
      prompt: 'Which action is required?',
      options: [
        { id: 'review', text: 'Review the content', isCorrect: true },
        { id: 'skip', text: 'Skip validation', isCorrect: false },
      ],
      explanation: 'Content should be reviewed before publication.',
    },
    estimatedMinutes: 12,
    passThreshold: 70,
    ...overrides,
  };
}

export function makeQuestionDoc(
  id: string,
  overrides: Partial<AdminQuestionDoc> = {},
): AdminQuestionDoc {
  return {
    id,
    missionId: firstMission.id,
    type: 'multiple_choice',
    stem: 'Which integration answer is correct?',
    selectionMode: 'single',
    options: [
      { id: 'correct', text: 'The reviewed answer', isCorrect: true },
      { id: 'incorrect', text: 'The unreviewed answer', isCorrect: false },
    ],
    correctExplanation: 'The reviewed answer is correct.',
    incorrectExplanation: 'The unreviewed answer is not correct.',
    conceptTags: ['integration'],
    difficulty: 'beginner',
    allowsReasoning: false,
    displayOrder: 99,
    ...overrides,
  };
}

export function makeFlashcardDoc(
  id: string,
  overrides: Partial<AdminFlashcardDoc> = {},
): AdminFlashcardDoc {
  return {
    id,
    missionId: firstMission.id,
    concept: 'Integration concept',
    definition: 'A concept used to verify the admin integration data flow.',
    example: 'An administrator saves and reloads this card.',
    commonMistake: 'Assuming an unsaved card is already persisted.',
    learningTip: 'Save and verify through the API.',
    conceptTags: ['integration'],
    difficulty: 'beginner',
    displayOrder: 99,
    ...overrides,
  };
}

export function makeAwardDoc(
  id: string,
  overrides: Partial<AdminAwardDoc> = {},
): AdminAwardDoc {
  return {
    id,
    kind: 'badge',
    name: 'Integration Badge',
    icon: 'badge-integration',
    description: 'Awarded by an integration-test mission.',
    missionId: firstMission.id,
    rule: { type: 'mission_completed', missionId: firstMission.id as never },
    ...overrides,
  };
}

export function validDocFor(entityType: AdminEntityType, id: string): unknown {
  switch (entityType) {
    case 'mission':
      return makeMissionDoc(id);
    case 'question':
      return makeQuestionDoc(id);
    case 'flashcard':
      return makeFlashcardDoc(id);
    case 'award':
      return makeAwardDoc(id);
  }
}

export function makeImportBundle(
  overrides: Partial<AdminContentBundle> = {},
): AdminContentBundle {
  return {
    bundleVersion: 1,
    exportedAt: FIXED_TIME,
    missions: [],
    questions: [],
    flashcards: [],
    awards: [],
    ...overrides,
  };
}
