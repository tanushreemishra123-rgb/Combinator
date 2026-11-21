import { createHash } from 'node:crypto';
import type {
  AwardDefinition,
  AwardId,
  AwardRule,
  CatalogDto,
  Checkpoint,
  Flashcard as FlashcardDto,
  FlashcardId,
  LevelTrack,
  LessonBlock,
  MissionDetail,
  MissionDetailDto,
  MissionExample,
  MissionId,
  MissionSummary,
  QuestionId,
  QuizQuestion as QuizQuestionDto,
} from '@ai-learning-adventure/types';
import type { QueryClient } from '../db/client.ts';
import * as contentRepo from '../db/repositories/content.repository.ts';
import type { Award, Flashcard, Mission, QuizQuestion } from '../db/schema.ts';
import { ApiHttpError, notFound } from '../http/errors.ts';

export interface CatalogInclude {
  missions: boolean;
  awards: boolean;
}

export interface CatalogResult {
  dto: CatalogDto;
  etag: string;
}

const LEVEL_TRACKS: readonly LevelTrack[] = [
  'beginner',
  'basic_understanding',
  'applied_practice',
  'responsible_use',
  'builder_mindset',
];

function parseJsonColumn<T>(raw: string, column: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiHttpError(500, 'content_parse_error', `Stored column "${column}" is not valid JSON.`);
  }
}

export function toMissionSummary(row: Mission): MissionSummary {
  return {
    id: row.id as MissionId,
    title: row.title,
    difficulty: row.difficulty,
    levelTrack: row.levelTrack,
    trackOrder: row.trackOrder,
    objective: row.objective,
    ...(row.prerequisiteMissionId
      ? { prerequisiteMissionId: row.prerequisiteMissionId as MissionId }
      : {}),
    estimatedMinutes: row.estimatedMinutes,
    contentVersion: row.contentVersion,
  };
}

function requireRuleString(params: Record<string, unknown>, field: string): string {
  const value = params[field]; // nosemgrep: gitlab.eslint.detect-object-injection
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiHttpError(500, 'content_parse_error', `Award rule is missing "${field}".`);
  }
  return value;
}

function requireRuleNumber(params: Record<string, unknown>, field: string): number {
  const value = params[field]; // nosemgrep: gitlab.eslint.detect-object-injection
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiHttpError(500, 'content_parse_error', `Award rule is missing numeric "${field}".`);
  }
  return value;
}

export function toAwardRule(ruleType: Award['ruleType'], ruleJson: string): AwardRule {
  const params = parseJsonColumn<Record<string, unknown>>(ruleJson, 'awards.rule_json');
  switch (ruleType) {
    case 'mission_completed':
      return { type: ruleType, missionId: requireRuleString(params, 'missionId') as MissionId };
    case 'track_completed': {
      const levelTrack = requireRuleString(params, 'levelTrack');
      if (!LEVEL_TRACKS.includes(levelTrack as LevelTrack)) {
        throw new ApiHttpError(500, 'content_parse_error', `Award rule has unknown levelTrack "${levelTrack}".`);
      }
      return { type: ruleType, levelTrack: levelTrack as LevelTrack };
    }
    case 'score_threshold': {
      const rule: AwardRule = {
        type: ruleType,
        minScorePercent: requireRuleNumber(params, 'minScorePercent'),
      };
      if (typeof params.missionId === 'string' && params.missionId.length > 0) {
        return { ...rule, missionId: params.missionId as MissionId };
      }
      return rule;
    }
    case 'streak':
      return { type: ruleType, length: requireRuleNumber(params, 'length') };
    case 'percent_complete':
      return { type: ruleType, minPercent: requireRuleNumber(params, 'minPercent') };
  }
}

export function toAwardDefinition(row: Award): AwardDefinition {
  return {
    id: row.id as AwardId,
    kind: row.kind,
    name: row.name,
    icon: row.icon,
    description: row.description,
    ...(row.missionId ? { missionId: row.missionId as MissionId } : {}),
    rule: toAwardRule(row.ruleType, row.ruleJson),
  };
}

export function toQuizQuestionDto(row: QuizQuestion): QuizQuestionDto {
  const base = {
    id: row.id as QuestionId,
    missionId: row.missionId as MissionId,
    stem: row.stem,
    selectionMode: row.selectionMode,
    options: parseJsonColumn<QuizQuestionDto['options']>(row.optionsJson, 'quiz_questions.options_json'),
    correctExplanation: row.correctExplanation,
    incorrectExplanation: row.incorrectExplanation,
    conceptTags: parseJsonColumn<string[]>(row.conceptTagsJson, 'quiz_questions.concept_tags_json'),
  };
  if (row.type === 'scenario') {
    return {
      ...base,
      type: 'scenario',
      scenario: row.scenario ?? '',
      allowsReasoning: row.allowsReasoning,
    };
  }
  return { ...base, type: row.type };
}

export function toFlashcardDto(row: Flashcard): FlashcardDto {
  return {
    id: row.id as FlashcardId,
    missionId: row.missionId as MissionId,
    concept: row.concept,
    definition: row.definition,
    example: row.example,
    ...(row.commonMistake ? { commonMistake: row.commonMistake } : {}),
    ...(row.learningTip ? { learningTip: row.learningTip } : {}),
    conceptTags: parseJsonColumn<string[]>(row.conceptTagsJson, 'flashcards.concept_tags_json'),
  };
}

export function getCatalog(db: QueryClient, include: CatalogInclude): CatalogResult {
  const missionRows = contentRepo.listVisibleMissions(db);
  const awardRows = contentRepo.listVisibleAwards(db);

  const hash = createHash('sha256');
  for (const mission of missionRows) {
    hash.update(`mission:${mission.id}:${mission.contentVersion};`);
  }
  for (const award of awardRows) {
    hash.update(`award:${award.id}:${award.updatedAt};`);
  }
  const contentVersion = hash.digest('hex').slice(0, 24);

  return {
    dto: {
      contentVersion,
      missions: include.missions ? missionRows.map(toMissionSummary) : [],
      awards: include.awards ? awardRows.map(toAwardDefinition) : [],
    },
    etag: `"cv-${contentVersion}"`,
  };
}

export function getMissionDetail(db: QueryClient, missionId: string): MissionDetailDto {
  const mission = contentRepo.getVisibleMission(db, missionId);
  if (!mission) {
    throw notFound('Mission not found.');
  }
  const questions = contentRepo.listVisibleQuestions(db, mission.id);
  const flashcards = contentRepo.listVisibleFlashcards(db, mission.id);
  const awards = contentRepo.listVisibleAwardsForMission(db, mission.id);

  const detail: MissionDetail = {
    ...toMissionSummary(mission),
    lesson: parseJsonColumn<LessonBlock[]>(mission.lessonJson, 'missions.lesson_json'),
    example: parseJsonColumn<MissionExample>(mission.exampleJson, 'missions.example_json'),
    checkpoint: parseJsonColumn<Checkpoint>(mission.checkpointJson, 'missions.checkpoint_json'),
    questions: questions.map(toQuizQuestionDto),
    flashcards: flashcards.map(toFlashcardDto),
    awards: awards.map(toAwardDefinition),
    passThreshold: mission.passThreshold,
  };
  return { mission: detail };
}
