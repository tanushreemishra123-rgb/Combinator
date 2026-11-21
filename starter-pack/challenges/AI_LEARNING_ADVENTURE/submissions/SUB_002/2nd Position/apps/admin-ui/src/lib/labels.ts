import type { AdminEntityType, AdminLifecycleStatus, Difficulty, LevelTrack } from '@ai-learning-adventure/types';

export const ENTITY_TYPE_LABELS: Record<AdminEntityType, string> = {
  mission: 'Mission',
  question: 'Question',
  flashcard: 'Flashcard',
  award: 'Badge / Milestone',
};

export const ENTITY_TYPE_PLURAL: Record<AdminEntityType, string> = {
  mission: 'Missions',
  question: 'Questions',
  flashcard: 'Flashcards',
  award: 'Badges',
};

export const STATUS_LABELS: Record<AdminLifecycleStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  published_changed: 'Published · changes',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const LEVEL_TRACK_LABELS: Record<LevelTrack, string> = {
  beginner: 'Beginner',
  basic_understanding: 'Basic Understanding',
  applied_practice: 'Applied Practice',
  responsible_use: 'Responsible Use',
  builder_mindset: 'Builder Mindset',
};

export const LEVEL_TRACK_ORDER: LevelTrack[] = [
  'beginner',
  'basic_understanding',
  'applied_practice',
  'responsible_use',
  'builder_mindset',
];

export const DIFFICULTY_ORDER: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function itemTitle(entityType: AdminEntityType, doc: unknown): string {
  const record = doc as Record<string, unknown>;
  switch (entityType) {
    case 'mission':
      return typeof record.title === 'string' && record.title.length > 0 ? record.title : '(untitled mission)';
    case 'question':
      return typeof record.stem === 'string' && record.stem.length > 0 ? record.stem : '(untitled question)';
    case 'flashcard':
      return typeof record.concept === 'string' && record.concept.length > 0 ? record.concept : '(untitled flashcard)';
    case 'award':
      return typeof record.name === 'string' && record.name.length > 0 ? record.name : '(untitled award)';
  }
}
