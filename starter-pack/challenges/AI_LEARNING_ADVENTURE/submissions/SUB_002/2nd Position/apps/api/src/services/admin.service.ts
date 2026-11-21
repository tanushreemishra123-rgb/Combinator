import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AdminAwardDoc,
  AdminBulkActionRequest,
  AdminBulkActionResult,
  AdminContentBundle,
  AdminContentItem,
  AdminContentListDto,
  AdminEntityType,
  AdminFlashcardDoc,
  AdminImportReport,
  AdminLifecycleStatus,
  AdminMissionDoc,
  AdminPublishHistoryEntry,
  AdminPublishResult,
  AdminQuestionDoc,
  AdminSeedIntegrityRow,
  AdminSeedStatusDto,
  AdminValidationIssue,
  AdminValidationReport,
  AwardDefinition,
  AwardId,
  Flashcard as FlashcardDto,
  FlashcardId,
  IsoDateTime,
  LevelTrack,
  MissionDetail,
  MissionId,
  MissionSummary,
  QuestionId,
  QuizQuestion as QuizQuestionDto,
} from '@ai-learning-adventure/types';
import type { QueryClient } from '../db/client.ts';
import * as adminRepo from '../db/repositories/admin.repository.ts';
import * as contentRepo from '../db/repositories/content.repository.ts';
import * as schema from '../db/schema.ts';
import { ApiHttpError, badRequest, conflict, notFound } from '../http/errors.ts';
import { toAwardDefinition, toAwardRule, toFlashcardDto, toMissionSummary, toQuizQuestionDto } from './catalog.service.ts';

const ENTITY_TYPES: readonly AdminEntityType[] = ['mission', 'question', 'flashcard', 'award'];

const LEVEL_TRACKS: readonly LevelTrack[] = [
  'beginner',
  'basic_understanding',
  'applied_practice',
  'responsible_use',
  'builder_mindset',
];

export function nowIso(): IsoDateTime {
  return new Date().toISOString() as IsoDateTime;
}

export function requireEntityType(value: string): AdminEntityType {
  if (!(ENTITY_TYPES as readonly string[]).includes(value)) {
    throw badRequest(`Entity type must be one of: ${ENTITY_TYPES.join(', ')}.`);
  }
  return value as AdminEntityType;
}

function issue(
  severity: AdminValidationIssue['severity'],
  code: string,
  message: string,
  field?: string,
): AdminValidationIssue {
  return field === undefined ? { severity, code, message } : { severity, code, message, field };
}

function deriveStatus(item: schema.ContentItem): AdminLifecycleStatus {
  if (!item.isPublished) return 'draft';
  return item.publishedRevision === item.revision ? 'published' : 'published_changed';
}

function parseDoc<T>(item: schema.ContentItem): T {
  try {
    const doc = JSON.parse(item.docJson);
    if (item.entityType === 'award' && doc && typeof doc === 'object') {
      const award = doc as Partial<AdminAwardDoc>;
      if (award.kind === 'badge') {
        if (!award.rule || typeof award.rule !== 'object' || !('type' in award.rule) || !award.rule.type) {
          award.rule = {
            type: 'mission_completed',
            missionId: (award.missionId ?? '') as never,
          };
        }
      } else if (award.rule && typeof award.rule === 'object' && !('type' in award.rule)) {
        const rule = award.rule as Record<string, unknown>;
        if (rule.levelTrack) rule.type = 'track_completed';
        else if (rule.minScorePercent !== undefined) rule.type = 'score_threshold';
        else if (rule.length !== undefined) rule.type = 'streak';
        else if (rule.minPercent !== undefined) rule.type = 'percent_complete';
        else rule.type = 'percent_complete';
      }
    }
    return doc as T;
  } catch {
    throw new ApiHttpError(500, 'content_parse_error', `Stored document for "${item.entityId}" is not valid JSON.`);
  }
}

export function toAdminContentItem<T>(item: schema.ContentItem): AdminContentItem<T> {
  return {
    entityType: item.entityType,
    id: item.entityId,
    doc: parseDoc<T>(item),
    revision: item.revision,
    publishedRevision: item.publishedRevision,
    status: deriveStatus(item),
    enabled: item.enabled,
    archived: item.archived,
    updatedAt: item.updatedAt as IsoDateTime,
  };
}

function requireItem(db: QueryClient, entityType: AdminEntityType, entityId: string): schema.ContentItem {
  const item = adminRepo.getContentItem(db, entityType, entityId);
  if (!item) throw notFound(`${entityType} "${entityId}" was not found.`);
  return item;
}

function requireActiveItem(db: QueryClient, entityType: AdminEntityType, entityId: string): schema.ContentItem {
  const item = requireItem(db, entityType, entityId);
  if (item.archived) throw notFound(`${entityType} "${entityId}" was archived.`);
  return item;
}

function checkRevision(item: schema.ContentItem, expectedRevision: number): void {
  if (item.revision !== expectedRevision) {
    throw conflict(
      'revision_mismatch',
      `The content item changed since it was loaded (expected revision ${expectedRevision}, current ${item.revision}).`,
    );
  }
}

function newId(entityType: AdminEntityType, slug?: string): string {
  const suffix = randomUUID().slice(0, 8);
  if (entityType === 'mission' && slug !== undefined && slug.length > 0) {
    return `mission-${slug}`;
  }
  return `${entityType}-${suffix}`;
}

function uniqueId(db: QueryClient, entityType: AdminEntityType, desired: string): string {
  let candidate = desired;
  let counter = 2;
  while (adminRepo.getContentItem(db, entityType, candidate) !== undefined) {
    candidate = `${desired}-${counter}`;
    counter += 1;
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateMissionDoc(doc: AdminMissionDoc, allMissions: AdminMissionDoc[]): AdminValidationIssue[] {
  const issues: AdminValidationIssue[] = [];
  if (!isNonEmptyString(doc.title)) issues.push(issue('blocking', 'title_required', 'Mission title is required.', 'title'));
  if (!isNonEmptyString(doc.slug)) {
    issues.push(issue('blocking', 'slug_required', 'Mission slug is required.', 'slug'));
  // nosemgrep: ajinabraham.njsscan.dos.regex_dos.regex_dos, gitlab.nodejs_scan.javascript-dos-rule-regex_dos
  } else if (doc.slug.startsWith('-') || doc.slug.endsWith('-') || doc.slug.includes('--') || !/^[a-z0-9-]+$/.test(doc.slug)) {
    issues.push(
      issue('blocking', 'slug_format', 'Slug must use lowercase letters, numbers, and hyphens.', 'slug'),
    );
  } else if (allMissions.some((mission) => mission.id !== doc.id && mission.slug === doc.slug)) {
    issues.push(issue('blocking', 'slug_taken', `Slug "${doc.slug}" is already used by another mission.`, 'slug'));
  }
  if (!isNonEmptyString(doc.objective)) {
    issues.push(issue('blocking', 'objective_required', 'Learning objective is required.', 'objective'));
  }
  if (!Array.isArray(doc.lesson) || doc.lesson.length === 0) {
    issues.push(issue('blocking', 'lesson_required', 'At least one lesson block is required.', 'lesson'));
  }
  if (doc.example === undefined || doc.example === null) {
    issues.push(issue('blocking', 'example_required', 'An example or scenario is required.', 'example'));
  } else if (doc.example.type === 'worked_example') {
    if (!isNonEmptyString(doc.example.before) || !isNonEmptyString(doc.example.after)) {
      issues.push(issue('blocking', 'example_incomplete', 'Worked examples need both before and after text.', 'example'));
    }
  } else if (doc.example.type === 'scenario') {
    if (
      !isNonEmptyString(doc.example.narrative) ||
      !isNonEmptyString(doc.example.reflectionPrompt) ||
      !isNonEmptyString(doc.example.takeaway)
    ) {
      issues.push(
        issue('blocking', 'example_incomplete', 'Scenarios need narrative, reflection prompt, and takeaway.', 'example'),
      );
    }
  }
  if (doc.checkpoint === undefined || doc.checkpoint === null) {
    issues.push(issue('blocking', 'checkpoint_required', 'A checkpoint activity is required.', 'checkpoint'));
  } else if (!isNonEmptyString(doc.checkpoint.prompt)) {
    issues.push(issue('blocking', 'checkpoint_prompt', 'Checkpoint prompt is required.', 'checkpoint'));
  } else if (doc.checkpoint.kind === 'single_question') {
    if (doc.checkpoint.options.length < 2) {
      issues.push(issue('blocking', 'checkpoint_options', 'Checkpoint needs at least two options.', 'checkpoint'));
    } else if (!doc.checkpoint.options.some((option) => option.isCorrect)) {
      issues.push(issue('blocking', 'checkpoint_correct', 'Checkpoint needs one correct option.', 'checkpoint'));
    }
  } else if (doc.checkpoint.kind === 'sort_into_buckets') {
    if (doc.checkpoint.buckets.length === 0 || doc.checkpoint.items.length === 0) {
      issues.push(issue('blocking', 'checkpoint_sort', 'Sorting checkpoint needs buckets and items.', 'checkpoint'));
    }
  } else if (doc.checkpoint.kind === 'spot_the_problem') {
    if (!isNonEmptyString(doc.checkpoint.passage)) {
      issues.push(issue('blocking', 'checkpoint_passage', 'Spot-the-problem checkpoint needs a passage.', 'checkpoint'));
    }
  }
  if (!Number.isInteger(doc.estimatedMinutes) || doc.estimatedMinutes <= 0) {
    issues.push(issue('blocking', 'minutes_required', 'Estimated minutes must be a positive number.', 'estimatedMinutes'));
  }
  if (!Number.isInteger(doc.passThreshold) || doc.passThreshold < 1 || doc.passThreshold > 100) {
    issues.push(issue('blocking', 'pass_threshold', 'Pass threshold must be between 1 and 100.', 'passThreshold'));
  }
  if (
    doc.prerequisiteMissionId !== undefined &&
    !allMissions.some((mission) => mission.id === doc.prerequisiteMissionId)
  ) {
    issues.push(
      issue('warning', 'prerequisite_unknown', 'Prerequisite mission no longer exists.', 'prerequisiteMissionId'),
    );
  }
  return issues;
}

export function validateQuestionDoc(doc: AdminQuestionDoc): AdminValidationIssue[] {
  const issues: AdminValidationIssue[] = [];
  if (!isNonEmptyString(doc.stem)) issues.push(issue('blocking', 'stem_required', 'Question stem is required.', 'stem'));
  if (doc.missionId === null) {
    issues.push(issue('warning', 'unassigned', 'Question is not assigned to a mission.', 'missionId'));
  }
  if (!isNonEmptyString(doc.correctExplanation)) {
    issues.push(issue('blocking', 'correct_explanation_required', 'Correct-answer explanation is required.', 'correctExplanation'));
  }
  if (!isNonEmptyString(doc.incorrectExplanation)) {
    issues.push(issue('blocking', 'incorrect_explanation_required', 'Incorrect-answer explanation is required.', 'incorrectExplanation'));
  }
  if (doc.type === 'scenario' && !isNonEmptyString(doc.scenario)) {
    issues.push(issue('blocking', 'scenario_required', 'Scenario text is required for scenario questions.', 'scenario'));
  }
  const options = Array.isArray(doc.options) ? doc.options : [];
  const correctCount = options.filter((option) => option.isCorrect).length;
  if (doc.type === 'true_false') {
    const texts = options.map((option) => option.text.trim().toLowerCase()).sort();
    if (options.length !== 2 || texts[0] !== 'false' || texts[1] !== 'true') {
      issues.push(issue('blocking', 'tf_options', 'True/false questions need exactly a True and a False option.', 'options'));
    }
    if (correctCount !== 1) {
      issues.push(issue('blocking', 'tf_correct', 'True/false questions need exactly one correct option.', 'options'));
    }
  } else {
    if (options.length < 2) {
      issues.push(issue('blocking', 'options_min', 'At least two options are required.', 'options'));
    }
    if (options.some((option) => !isNonEmptyString(option.text))) {
      issues.push(issue('blocking', 'option_text', 'Every option needs text.', 'options'));
    }
    if (doc.selectionMode === 'single' && correctCount !== 1) {
      issues.push(issue('blocking', 'correct_single', 'Single-answer questions need exactly one correct option.', 'options'));
    }
    if (doc.selectionMode === 'multiple' && correctCount < 1) {
      issues.push(issue('blocking', 'correct_multiple', 'Multi-select questions need at least one correct option.', 'options'));
    }
  }
  if (doc.conceptTags.length === 0) {
    issues.push(issue('warning', 'tags_missing', 'Add concept tags so weak-topic tracking can use this question.', 'conceptTags'));
  }
  return issues;
}

export function validateFlashcardDoc(doc: AdminFlashcardDoc): AdminValidationIssue[] {
  const issues: AdminValidationIssue[] = [];
  if (!isNonEmptyString(doc.concept)) issues.push(issue('blocking', 'concept_required', 'Concept is required.', 'concept'));
  if (!isNonEmptyString(doc.definition)) issues.push(issue('blocking', 'definition_required', 'Definition is required.', 'definition'));
  if (!isNonEmptyString(doc.example)) issues.push(issue('blocking', 'example_required', 'Example is required.', 'example'));
  if (!isNonEmptyString(doc.commonMistake) && !isNonEmptyString(doc.learningTip)) {
    issues.push(
      issue('blocking', 'mistake_or_tip_required', 'A common mistake or a learning tip is required.', 'commonMistake'),
    );
  }
  if (doc.missionId === null) {
    issues.push(issue('warning', 'unassigned', 'Flashcard is not assigned to a mission.', 'missionId'));
  }
  if (doc.conceptTags.length === 0) {
    issues.push(issue('warning', 'tags_missing', 'Add concept tags so review decks can use this card.', 'conceptTags'));
  }
  return issues;
}

export function validateAwardDoc(doc: AdminAwardDoc): AdminValidationIssue[] {
  const issues: AdminValidationIssue[] = [];
  if (!isNonEmptyString(doc.name)) issues.push(issue('blocking', 'name_required', 'Award name is required.', 'name'));
  if (!isNonEmptyString(doc.icon)) issues.push(issue('blocking', 'icon_required', 'Award icon is required.', 'icon'));
  if (!isNonEmptyString(doc.description)) {
    issues.push(issue('blocking', 'description_required', 'Award description is required.', 'description'));
  }
  if (doc.kind === 'badge' && !isNonEmptyString(doc.missionId)) {
    issues.push(issue('blocking', 'badge_mission_required', 'Badges must be linked to a mission.', 'missionId'));
  }
  if (doc.rule === undefined || doc.rule === null || !isNonEmptyString(doc.rule.type)) {
    issues.push(issue('blocking', 'rule_required', 'Award rule is required.', 'rule'));
  }
  return issues;
}

export function validateDoc(
  db: QueryClient,
  entityType: AdminEntityType,
  doc: unknown,
): AdminValidationReport {
  let issues: AdminValidationIssue[];
  switch (entityType) {
    case 'mission':
      issues = validateMissionDoc(doc as AdminMissionDoc, listMissionDocs(db));
      break;
    case 'question':
      issues = validateQuestionDoc(doc as AdminQuestionDoc);
      break;
    case 'flashcard':
      issues = validateFlashcardDoc(doc as AdminFlashcardDoc);
      break;
    case 'award':
      issues = validateAwardDoc(doc as AdminAwardDoc);
      break;
  }
  return summarizeIssues(issues);
}

function summarizeIssues(issues: AdminValidationIssue[]): AdminValidationReport {
  return {
    issues,
    blockingCount: issues.filter((entry) => entry.severity === 'blocking').length,
    warningCount: issues.filter((entry) => entry.severity === 'warning').length,
  };
}

function requireValidDoc(db: QueryClient, entityType: AdminEntityType, doc: unknown): void {
  const report = validateDoc(db, entityType, doc);
  if (report.blockingCount > 0) {
    throw new ApiHttpError(422, 'validation_failed', 'The content has blocking validation issues.');
  }
}

// ---------------------------------------------------------------------------
// Listing / reads
// ---------------------------------------------------------------------------

export interface AdminListQuery {
  type: AdminEntityType;
  status?: string;
  missionId?: string;
  difficulty?: string;
  levelTrack?: string;
  q?: string;
  includeArchived?: boolean;
}

function docTitle(entityType: AdminEntityType, doc: unknown): string {
  switch (entityType) {
    case 'mission':
      return (doc as AdminMissionDoc).title;
    case 'question':
      return (doc as AdminQuestionDoc).stem;
    case 'flashcard':
      return (doc as AdminFlashcardDoc).concept;
    case 'award':
      return (doc as AdminAwardDoc).name;
  }
}

function docMissionId(entityType: AdminEntityType, doc: unknown): string | null | undefined {
  switch (entityType) {
    case 'mission':
      return undefined;
    case 'question':
      return (doc as AdminQuestionDoc).missionId;
    case 'flashcard':
      return (doc as AdminFlashcardDoc).missionId;
    case 'award':
      return (doc as AdminAwardDoc).missionId;
  }
}

function docDifficulty(entityType: AdminEntityType, doc: unknown): string | undefined {
  if (entityType === 'award') return undefined;
  return (doc as AdminMissionDoc | AdminQuestionDoc | AdminFlashcardDoc).difficulty;
}

export function listContent(db: QueryClient, query: AdminListQuery): AdminContentListDto {
  const rows = adminRepo.listContentItemsByType(db, query.type);
  const items = rows
    .filter((row) => (query.includeArchived === true ? true : !row.archived))
    .map((row) => toAdminContentItem(row))
    .filter((item) => {
      if (query.status !== undefined && item.status !== query.status) return false;
      if (query.missionId !== undefined) {
        const itemMissionId = docMissionId(query.type, item.doc);
        if (query.missionId === '__unassigned__') {
          if (itemMissionId !== null && itemMissionId !== undefined) return false;
        } else if (itemMissionId !== query.missionId) {
          return false;
        }
      }
      if (query.difficulty !== undefined && docDifficulty(query.type, item.doc) !== query.difficulty) return false;
      if (
        query.levelTrack !== undefined &&
        query.type === 'mission' &&
        (item.doc as AdminMissionDoc).levelTrack !== query.levelTrack
      ) {
        return false;
      }
      if (query.q !== undefined && query.q.trim().length > 0) {
        const haystack = docTitle(query.type, item.doc).toLowerCase();
        if (!haystack.includes(query.q.trim().toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { items, total: items.length };
}

export function getContent(db: QueryClient, entityType: AdminEntityType, entityId: string): AdminContentItem {
  return toAdminContentItem(requireActiveItem(db, entityType, entityId));
}

export function getPublishHistory(
  db: QueryClient,
  entityType: AdminEntityType,
  entityId: string,
): AdminPublishHistoryEntry[] {
  requireItem(db, entityType, entityId);
  return adminRepo.listPublishHistory(db, entityType, entityId).map((entry) => ({
    seq: entry.seq,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    ...(entry.note ? { note: entry.note } : {}),
    revision: entry.revision,
    at: entry.createdAt as IsoDateTime,
  }));
}

function listMissionDocs(db: QueryClient): AdminMissionDoc[] {
  return adminRepo
    .listContentItemsByType(db, 'mission')
    .filter((row) => !row.archived)
    .map((row) => parseDoc<AdminMissionDoc>(row));
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

function defaultDoc(entityType: AdminEntityType, id: string): unknown {
  switch (entityType) {
    case 'mission': {
      const doc: AdminMissionDoc = {
        id,
        slug: '',
        title: '',
        difficulty: 'beginner',
        levelTrack: 'beginner',
        trackOrder: 1,
        objective: '',
        lesson: [{ type: 'paragraph', text: '' }],
        example: { type: 'scenario', narrative: '', reflectionPrompt: '', takeaway: '' },
        checkpoint: { kind: 'write_response', prompt: '' },
        estimatedMinutes: 10,
        passThreshold: 70,
      };
      return doc;
    }
    case 'question': {
      const doc: AdminQuestionDoc = {
        id,
        missionId: null,
        type: 'multiple_choice',
        stem: '',
        selectionMode: 'single',
        options: [
          { id: 'a', text: '', isCorrect: true },
          { id: 'b', text: '', isCorrect: false },
        ],
        correctExplanation: '',
        incorrectExplanation: '',
        conceptTags: [],
        difficulty: 'beginner',
        allowsReasoning: false,
        displayOrder: 0,
      };
      return doc;
    }
    case 'flashcard': {
      const doc: AdminFlashcardDoc = {
        id,
        missionId: null,
        concept: '',
        definition: '',
        example: '',
        conceptTags: [],
        difficulty: 'beginner',
        displayOrder: 0,
      };
      return doc;
    }
    case 'award': {
      const doc: AdminAwardDoc = {
        id,
        kind: 'badge',
        name: '',
        icon: '',
        description: '',
        rule: { type: 'mission_completed', missionId: '' as MissionId },
      };
      return doc;
    }
  }
}

export function createContent(
  db: QueryClient,
  entityType: AdminEntityType,
  input: { id?: string; slug?: string },
): AdminContentItem {
  const desiredId = input.id !== undefined && input.id.trim().length > 0 ? input.id.trim() : newId(entityType, input.slug);
  const id = uniqueId(db, entityType, desiredId);
  const doc = defaultDoc(entityType, id);
  adminRepo.insertContentItem(db, {
    entityType,
    entityId: id,
    docJson: JSON.stringify(doc),
    revision: 1,
    publishedRevision: null,
    isPublished: false,
    enabled: true,
    archived: false,
    updatedAt: nowIso(),
  });
  return getContent(db, entityType, id);
}

export function saveContent(
  db: QueryClient,
  entityType: AdminEntityType,
  entityId: string,
  doc: unknown,
  expectedRevision: number,
  options: { lenient?: boolean } = {},
): AdminContentItem {
  const item = requireActiveItem(db, entityType, entityId);
  checkRevision(item, expectedRevision);
  const candidate = { ...(doc as Record<string, unknown>), id: entityId };
  if (entityType === 'award') {
    const awardCandidate = candidate as unknown as Partial<AdminAwardDoc>;
    if (awardCandidate.kind === 'badge') {
      if (!awardCandidate.rule || typeof awardCandidate.rule !== 'object' || !awardCandidate.rule.type) {
        awardCandidate.rule = {
          type: 'mission_completed',
          missionId: (awardCandidate.missionId ?? '') as never,
        };
      }
    }
  }
  if (options.lenient !== true) {
    requireValidDoc(db, entityType, candidate);
  }
  adminRepo.updateContentItem(db, entityType, entityId, {
    docJson: JSON.stringify(candidate),
    revision: item.revision + 1,
    updatedAt: nowIso(),
  });
  return getContent(db, entityType, entityId);
}

export function duplicateContent(db: QueryClient, entityType: AdminEntityType, entityId: string): AdminContentItem {
  const source = requireActiveItem(db, entityType, entityId);
  const sourceDoc = parseDoc<Record<string, unknown>>(source);
  const id = uniqueId(db, entityType, `${entityId}-copy`);
  const doc = { ...sourceDoc, id };
  if (entityType === 'mission') {
    const missionDoc = doc as AdminMissionDoc;
    missionDoc.title = `${missionDoc.title} (copy)`;
    missionDoc.slug = '';
  }
  if (entityType === 'question') (doc as AdminQuestionDoc).stem = `${(doc as AdminQuestionDoc).stem} (copy)`;
  if (entityType === 'flashcard') (doc as AdminFlashcardDoc).concept = `${(doc as AdminFlashcardDoc).concept} (copy)`;
  if (entityType === 'award') (doc as AdminAwardDoc).name = `${(doc as AdminAwardDoc).name} (copy)`;
  adminRepo.insertContentItem(db, {
    entityType,
    entityId: id,
    docJson: JSON.stringify(doc),
    revision: 1,
    publishedRevision: null,
    isPublished: false,
    enabled: true,
    archived: false,
    updatedAt: nowIso(),
  });
  return getContent(db, entityType, id);
}

export function archiveContent(db: QueryClient, entityType: AdminEntityType, entityId: string): void {
  const item = requireActiveItem(db, entityType, entityId);
  if (item.isPublished) {
    const doc = parseDoc<Record<string, unknown>>(item);
    const missionIds = affectedMissionIds(db, entityType, entityId, doc);
    prepareMissionChanges(db, missionIds);
    switch (entityType) {
      case 'mission':
        adminRepo.setMissionEnabled(db, entityId, false);
        break;
      case 'question':
        adminRepo.setQuestionEnabled(db, entityId, false);
        break;
      case 'flashcard':
        adminRepo.setFlashcardEnabled(db, entityId, false);
        break;
      case 'award':
        adminRepo.setAwardEnabled(db, entityId, false);
        break;
    }
    bumpMissionContentVersions(db, missionIds);
  }
  adminRepo.updateContentItem(db, entityType, entityId, {
    archived: true,
    enabled: false,
    updatedAt: nowIso(),
  });
}

// ---------------------------------------------------------------------------
// Enable / disable
// ---------------------------------------------------------------------------

export function setEnabled(
  db: QueryClient,
  entityType: AdminEntityType,
  entityId: string,
  enabled: boolean,
): AdminContentItem {
  const item = requireActiveItem(db, entityType, entityId);
  const doc = parseDoc<Record<string, unknown>>(item);
  if (item.isPublished) {
    const missionIds = affectedMissionIds(db, entityType, entityId, doc);
    prepareMissionChanges(db, missionIds);
    switch (entityType) {
      case 'mission':
        adminRepo.setMissionEnabled(db, entityId, enabled);
        break;
      case 'question':
        adminRepo.setQuestionEnabled(db, entityId, enabled);
        break;
      case 'flashcard':
        adminRepo.setFlashcardEnabled(db, entityId, enabled);
        break;
      case 'award':
        adminRepo.setAwardEnabled(db, entityId, enabled);
        break;
    }
    bumpMissionContentVersions(db, missionIds);
  }
  adminRepo.updateContentItem(db, entityType, entityId, { enabled, updatedAt: nowIso() });
  return getContent(db, entityType, entityId);
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

interface SnapshotBundle {
  passThreshold: number;
  questions: schema.QuizQuestion[];
}

function captureSnapshot(db: QueryClient, missionId: string, contentVersion: number): void {
  const questions = contentRepo.listVisibleQuestions(db, missionId);
  const missionRow = adminRepo.getMissionRow(db, missionId);
  const bundle: SnapshotBundle = {
    passThreshold: missionRow?.passThreshold ?? 70,
    questions,
  };
  adminRepo.upsertMissionSnapshot(db, {
    missionId,
    contentVersion,
    bundleJson: JSON.stringify(bundle),
    createdAt: nowIso(),
  });
}

function prepareMissionChange(db: QueryClient, missionId: string): void {
  const row = adminRepo.getMissionRow(db, missionId);
  if (!row || row.status !== 'published' || !row.enabled) return;
  if (adminRepo.getMissionSnapshot(db, missionId, row.contentVersion) !== undefined) return;
  captureSnapshot(db, missionId, row.contentVersion);
}

function bumpMissionContentVersion(db: QueryClient, missionId: string): void {
  const row = adminRepo.getMissionRow(db, missionId);
  if (!row || row.status !== 'published' || !row.enabled) return;
  const nextVersion = row.contentVersion + 1;
  adminRepo.upsertMissionRow(db, { ...row, contentVersion: nextVersion });
  captureSnapshot(db, missionId, nextVersion);
}

export function resolveGradingSource(
  db: QueryClient,
  missionId: string,
  contentVersion: number,
): { passThreshold: number; questions: schema.QuizQuestion[] } | undefined {
  const visible = contentRepo.getVisibleMission(db, missionId);
  if (visible !== undefined && visible.contentVersion === contentVersion) {
    return {
      passThreshold: visible.passThreshold,
      questions: contentRepo.listVisibleQuestions(db, missionId),
    };
  }
  const snapshot = adminRepo.getMissionSnapshot(db, missionId, contentVersion);
  if (snapshot === undefined) return undefined;
  try {
    return JSON.parse(snapshot.bundleJson) as SnapshotBundle;
  } catch {
    return undefined;
  }
}

function missionIdForLearnerChange(entityType: AdminEntityType, doc: Record<string, unknown>): string | undefined {
  if (entityType === 'mission') return typeof doc.id === 'string' ? doc.id : undefined;
  const missionId = doc.missionId;
  return typeof missionId === 'string' && missionId.length > 0 ? missionId : undefined;
}

function learnerRowMissionId(db: QueryClient, entityType: AdminEntityType, entityId: string): string | undefined {
  switch (entityType) {
    case 'mission':
      return entityId;
    case 'question':
      return adminRepo.getQuestionRow(db, entityId)?.missionId;
    case 'flashcard':
      return adminRepo.getFlashcardRow(db, entityId)?.missionId;
    case 'award':
      return adminRepo.getAwardRow(db, entityId)?.missionId ?? undefined;
  }
}

function affectedMissionIds(
  db: QueryClient,
  entityType: AdminEntityType,
  entityId: string,
  doc: Record<string, unknown>,
): string[] {
  const ids = new Set<string>();
  const rowMissionId = learnerRowMissionId(db, entityType, entityId);
  if (rowMissionId !== undefined && rowMissionId.length > 0) ids.add(rowMissionId);
  const docMissionId = missionIdForLearnerChange(entityType, doc);
  if (docMissionId !== undefined) ids.add(docMissionId);
  return [...ids];
}

function prepareMissionChanges(db: QueryClient, missionIds: string[]): void {
  for (const missionId of missionIds) prepareMissionChange(db, missionId);
}

function bumpMissionContentVersions(db: QueryClient, missionIds: string[]): void {
  for (const missionId of missionIds) bumpMissionContentVersion(db, missionId);
}

// ---------------------------------------------------------------------------
// Publish / unpublish
// ---------------------------------------------------------------------------

function projectMissionRow(
  doc: AdminMissionDoc,
  existing: schema.Mission | undefined,
  enabled: boolean,
  now: IsoDateTime,
): schema.Mission {
  return {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    difficulty: doc.difficulty,
    levelTrack: doc.levelTrack,
    trackOrder: doc.trackOrder,
    objective: doc.objective,
    lessonJson: JSON.stringify(doc.lesson),
    exampleJson: JSON.stringify(doc.example),
    checkpointJson: JSON.stringify(doc.checkpoint),
    estimatedMinutes: doc.estimatedMinutes,
    passThreshold: doc.passThreshold,
    prerequisiteMissionId: doc.prerequisiteMissionId ?? null,
    status: 'published',
    enabled,
    contentVersion: (existing?.contentVersion ?? 0) + 1,
    publishedAt: existing?.publishedAt ?? now,
    updatedAt: now,
  };
}

function projectQuestionRow(
  doc: AdminQuestionDoc,
  enabled: boolean,
  now: IsoDateTime,
): schema.QuizQuestion {
  return {
    id: doc.id,
    missionId: doc.missionId ?? '',
    type: doc.type,
    stem: doc.stem,
    scenario: doc.scenario ?? null,
    selectionMode: doc.selectionMode,
    optionsJson: JSON.stringify(doc.options),
    correctExplanation: doc.correctExplanation,
    incorrectExplanation: doc.incorrectExplanation,
    conceptTagsJson: JSON.stringify(doc.conceptTags),
    difficulty: doc.difficulty,
    allowsReasoning: doc.allowsReasoning,
    displayOrder: doc.displayOrder,
    status: 'published',
    enabled,
    updatedAt: now,
  };
}

function projectFlashcardRow(doc: AdminFlashcardDoc, enabled: boolean, now: IsoDateTime): schema.Flashcard {
  return {
    id: doc.id,
    missionId: doc.missionId ?? '',
    concept: doc.concept,
    definition: doc.definition,
    example: doc.example,
    commonMistake: doc.commonMistake ?? null,
    learningTip: doc.learningTip ?? null,
    conceptTagsJson: JSON.stringify(doc.conceptTags),
    difficulty: doc.difficulty,
    displayOrder: doc.displayOrder,
    status: 'published',
    enabled,
    updatedAt: now,
  };
}

function projectAwardRow(doc: AdminAwardDoc, enabled: boolean, now: IsoDateTime): schema.Award {
  return {
    id: doc.id,
    kind: doc.kind,
    name: doc.name,
    icon: doc.icon,
    description: doc.description,
    missionId: doc.missionId ?? null,
    ruleType: doc.rule.type,
    ruleJson: JSON.stringify(doc.rule),
    status: 'published',
    enabled,
    updatedAt: now,
  };
}

function validateMissionBundle(
  db: QueryClient,
  missionId: string,
  doc: AdminMissionDoc,
): AdminValidationReport {
  const issues = validateMissionDoc(doc, listMissionDocs(db));
  const questions = adminRepo
    .listContentItemsByType(db, 'question')
    .filter((row) => !row.archived)
    .map((row) => parseDoc<AdminQuestionDoc>(row))
    .filter((question) => question.missionId === missionId);
  const flashcards = adminRepo
    .listContentItemsByType(db, 'flashcard')
    .filter((row) => !row.archived)
    .map((row) => parseDoc<AdminFlashcardDoc>(row))
    .filter((card) => card.missionId === missionId);
  const awards = adminRepo
    .listContentItemsByType(db, 'award')
    .filter((row) => !row.archived)
    .map((row) => parseDoc<AdminAwardDoc>(row))
    .filter((award) => award.missionId === missionId);

  if (questions.length === 0) {
    issues.push(issue('blocking', 'questions_min', 'At least one quiz question must be assigned to the mission.'));
  } else if (questions.length < 5) {
    issues.push(issue('warning', 'questions_recommended', `Mission has ${questions.length} of the recommended 5 questions.`));
  }
  if (flashcards.length === 0) {
    issues.push(issue('blocking', 'flashcards_min', 'At least one flashcard must be assigned to the mission.'));
  } else if (flashcards.length < 3) {
    issues.push(issue('warning', 'flashcards_recommended', `Mission has ${flashcards.length} of the recommended 3 flashcards.`));
  }
  if (awards.length === 0) {
    issues.push(issue('warning', 'award_missing', 'Mission has no badge or milestone attached.'));
  }
  for (const question of questions) {
    for (const entry of validateQuestionDoc(question)) {
      if (entry.severity === 'blocking') {
        issues.push({
          ...entry,
          message: `Question "${question.stem || question.id}": ${entry.message}`,
        });
      }
    }
  }
  for (const card of flashcards) {
    for (const entry of validateFlashcardDoc(card)) {
      if (entry.severity === 'blocking') {
        issues.push({
          ...entry,
          message: `Flashcard "${card.concept || card.id}": ${entry.message}`,
        });
      }
    }
  }
  return summarizeIssues(issues);
}

export function validationReportFor(
  db: QueryClient,
  entityType: AdminEntityType,
  entityId: string,
): AdminValidationReport {
  const item = requireActiveItem(db, entityType, entityId);
  if (entityType === 'mission') {
    return validateMissionBundle(db, entityId, parseDoc<AdminMissionDoc>(item));
  }
  return validateDoc(db, entityType, parseDoc(item));
}

export function publishContent(
  db: QueryClient,
  entityType: AdminEntityType,
  entityId: string,
  input: { acknowledgement: boolean; note?: string; expectedRevision: number; includeDependentDrafts?: boolean },
): AdminPublishResult {
  const item = requireActiveItem(db, entityType, entityId);
  checkRevision(item, input.expectedRevision);
  if (!input.acknowledgement) {
    throw badRequest('Publishing requires the manual review acknowledgement.');
  }

  const report =
    entityType === 'mission'
      ? validateMissionBundle(db, entityId, parseDoc<AdminMissionDoc>(item))
      : validateDoc(db, entityType, parseDoc(item));
  if (report.blockingCount > 0) {
    throw new ApiHttpError(422, 'validation_failed', 'Fix the blocking issues before publishing.');
  }

  if (entityType !== 'mission') {
    const doc = parseDoc<Record<string, unknown>>(item);
    const missionId = doc.missionId;
    if (typeof missionId !== 'string' || missionId.length === 0) {
      throw badRequest('Assign the content to a mission before publishing it.');
    }
    if (adminRepo.getMissionRow(db, missionId) === undefined) {
      throw badRequest('Publish the parent mission before publishing its practice content.');
    }
  }

  const now = nowIso();
  const publishedDependentIds: string[] = [];

  if (entityType === 'mission') {
    prepareMissionChange(db, entityId);
    const doc = parseDoc<AdminMissionDoc>(item);
    const existing = adminRepo.getMissionRow(db, entityId);
    const projected = projectMissionRow(doc, existing, item.enabled, now);
    adminRepo.upsertMissionRow(db, projected);
    if (input.includeDependentDrafts === true) {
      for (const dependentType of ['question', 'flashcard', 'award'] as const) {
        const dependents = adminRepo
          .listContentItemsByType(db, dependentType)
          .filter((row) => !row.archived && !row.isPublished);
        for (const dependent of dependents) {
          const dependentDoc = parseDoc<Record<string, unknown>>(dependent);
          if (dependentDoc.missionId !== entityId) continue;
          const dependentReport = validateDoc(db, dependentType, dependentDoc);
          if (dependentReport.blockingCount > 0) {
            throw new ApiHttpError(
              422,
              'validation_failed',
              `Dependent ${dependentType} "${dependent.entityId}" has blocking validation issues.`,
            );
          }
          publishDependent(db, dependentType, dependent, dependentDoc, now);
          publishedDependentIds.push(dependent.entityId);
        }
      }
    }
    captureSnapshot(db, entityId, projected.contentVersion);
  } else {
    const doc = parseDoc<Record<string, unknown>>(item);
    const missionIds = affectedMissionIds(db, entityType, entityId, doc);
    prepareMissionChanges(db, missionIds);
    switch (entityType) {
      case 'question':
        adminRepo.upsertQuestionRow(db, projectQuestionRow(doc as unknown as AdminQuestionDoc, item.enabled, now));
        break;
      case 'flashcard':
        adminRepo.upsertFlashcardRow(db, projectFlashcardRow(doc as unknown as AdminFlashcardDoc, item.enabled, now));
        break;
      case 'award':
        adminRepo.upsertAwardRow(db, projectAwardRow(doc as unknown as AdminAwardDoc, item.enabled, now));
        break;
    }
    bumpMissionContentVersions(db, missionIds);
  }

  adminRepo.updateContentItem(db, entityType, entityId, {
    isPublished: true,
    publishedRevision: item.revision,
    updatedAt: now,
  });
  adminRepo.insertPublishHistory(db, {
    entityType,
    entityId,
    action: 'publish',
    note: input.note ?? null,
    revision: item.revision,
    createdAt: now,
  });

  return { item: getContent(db, entityType, entityId), publishedDependentIds };
}

function publishDependent(
  db: QueryClient,
  entityType: AdminEntityType,
  item: schema.ContentItem,
  doc: Record<string, unknown>,
  now: IsoDateTime,
): void {
  switch (entityType) {
    case 'question':
      adminRepo.upsertQuestionRow(db, projectQuestionRow(doc as unknown as AdminQuestionDoc, item.enabled, now));
      break;
    case 'flashcard':
      adminRepo.upsertFlashcardRow(db, projectFlashcardRow(doc as unknown as AdminFlashcardDoc, item.enabled, now));
      break;
    case 'award':
      adminRepo.upsertAwardRow(db, projectAwardRow(doc as unknown as AdminAwardDoc, item.enabled, now));
      break;
    case 'mission':
      break;
  }
  adminRepo.updateContentItem(db, entityType, item.entityId, {
    isPublished: true,
    publishedRevision: item.revision,
    updatedAt: now,
  });
  adminRepo.insertPublishHistory(db, {
    entityType,
    entityId: item.entityId,
    action: 'publish',
    note: null,
    revision: item.revision,
    createdAt: now,
  });
}

export function unpublishContent(
  db: QueryClient,
  entityType: AdminEntityType,
  entityId: string,
  input: { note?: string },
): AdminContentItem {
  const item = requireActiveItem(db, entityType, entityId);
  if (!item.isPublished) throw badRequest('Only published content can be unpublished.');
  const now = nowIso();
  const doc = parseDoc<Record<string, unknown>>(item);

  if (entityType === 'mission') {
    prepareMissionChange(db, entityId);
    adminRepo.setMissionStatus(db, entityId, 'draft');
  } else {
    const missionIds = affectedMissionIds(db, entityType, entityId, doc);
    prepareMissionChanges(db, missionIds);
    switch (entityType) {
      case 'question':
        adminRepo.setQuestionStatus(db, entityId, 'draft');
        break;
      case 'flashcard':
        adminRepo.setFlashcardStatus(db, entityId, 'draft');
        break;
      case 'award':
        adminRepo.setAwardStatus(db, entityId, 'draft');
        break;
    }
    bumpMissionContentVersions(db, missionIds);
  }

  adminRepo.updateContentItem(db, entityType, entityId, { isPublished: false, updatedAt: now });
  adminRepo.insertPublishHistory(db, {
    entityType,
    entityId,
    action: 'unpublish',
    note: input.note ?? null,
    revision: item.revision,
    createdAt: now,
  });
  return getContent(db, entityType, entityId);
}

export function bulkAction(db: QueryClient, input: AdminBulkActionRequest): AdminBulkActionResult {
  const result: AdminBulkActionResult = { succeeded: [], failed: [] };
  for (const ref of input.refs) {
    try {
      switch (input.action) {
        case 'enable':
          setEnabled(db, ref.entityType, ref.id, true);
          break;
        case 'disable':
          setEnabled(db, ref.entityType, ref.id, false);
          break;
        case 'publish':
          publishContent(db, ref.entityType, ref.id, {
            acknowledgement: input.acknowledgement === true,
            expectedRevision: requireActiveItem(db, ref.entityType, ref.id).revision,
          });
          break;
        case 'unpublish':
          unpublishContent(db, ref.entityType, ref.id, {});
          break;
      }
      result.succeeded.push(ref);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      result.failed.push({ ...ref, message });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Practice assignments (drag-and-drop support)
// ---------------------------------------------------------------------------

interface AssignmentTarget {
  entityType: 'question' | 'flashcard';
  missionId: string | null;
}

export function applyPracticeAssignments(
  db: QueryClient,
  changes: Array<{ entityType: 'question' | 'flashcard'; id: string; missionId: string | null; index: number }>,
): AdminContentItem[] {
  if (changes.length === 0) return [];
  const now = nowIso();
  const moved = new Map<string, { entityType: 'question' | 'flashcard'; id: string; index: number; from: string | null }>();
  const touchedMissions = new Map<string, Set<'question' | 'flashcard'>>();

  function markMission(missionId: string | null, entityType: 'question' | 'flashcard'): void {
    if (missionId === null) return;
    const set = touchedMissions.get(missionId) ?? new Set<'question' | 'flashcard'>();
    set.add(entityType);
    touchedMissions.set(missionId, set);
  }

  for (const change of changes) {
    if (change.entityType !== 'question' && change.entityType !== 'flashcard') {
      throw badRequest('Practice assignments only support questions and flashcards.');
    }
    const item = requireActiveItem(db, change.entityType, change.id);
    const doc = parseDoc<AdminQuestionDoc | AdminFlashcardDoc>(item);
    if (change.missionId !== null) {
      const mission = adminRepo.getContentItem(db, 'mission', change.missionId);
      if (!mission || mission.archived) throw badRequest(`Mission "${change.missionId}" was not found.`);
    }
    moved.set(`${change.entityType}:${change.id}`, {
      entityType: change.entityType,
      id: change.id,
      index: change.index,
      from: doc.missionId,
    });
    markMission(doc.missionId, change.entityType);
    markMission(change.missionId, change.entityType);
  }

  for (const [missionId, types] of touchedMissions) {
    for (const entityType of types) {
      const all = adminRepo
        .listContentItemsByType(db, entityType)
        .filter((row) => !row.archived)
        .map((row) => ({ row, doc: parseDoc<AdminQuestionDoc | AdminFlashcardDoc>(row) }));

      const staying = all
        .filter((entry) => entry.doc.missionId === missionId && !moved.has(`${entityType}:${entry.row.entityId}`))
        .sort((a, b) => a.doc.displayOrder - b.doc.displayOrder);

      const incoming = changes
        .filter((c) => c.entityType === entityType && c.missionId === missionId)
        .sort((a, b) => a.index - b.index);

      const ordered = [...staying];
      for (const change of incoming) {
        const entry = all.find((candidate) => candidate.row.entityId === change.id);
        if (entry === undefined) continue;
        const clamped = Math.max(0, Math.min(change.index, ordered.length));
        ordered.splice(clamped, 0, entry);
      }

      ordered.forEach((entry, index) => {
        const nextDoc = { ...entry.doc, missionId, displayOrder: index + 1 };
        adminRepo.updateContentItem(db, entityType, entry.row.entityId, {
          docJson: JSON.stringify(nextDoc),
          revision: entry.row.revision + 1,
          updatedAt: now,
        });
      });
    }
  }

  for (const change of changes) {
    if (change.missionId === null) {
      const item = requireActiveItem(db, change.entityType, change.id);
      const doc = parseDoc<AdminQuestionDoc | AdminFlashcardDoc>(item);
      const nextDoc = { ...doc, missionId: null, displayOrder: 0 };
      adminRepo.updateContentItem(db, change.entityType, change.id, {
        docJson: JSON.stringify(nextDoc),
        revision: item.revision + 1,
        updatedAt: now,
      });
    }
  }

  return changes.map((change) => getContent(db, change.entityType, change.id));
}

// ---------------------------------------------------------------------------
// Mission track ordering
// ---------------------------------------------------------------------------

export function reorderMissions(db: QueryClient, levelTrack: LevelTrack, orderedMissionIds: string[]): void {
  if (!LEVEL_TRACKS.includes(levelTrack)) throw badRequest('Unknown level track.');
  const now = nowIso();
  orderedMissionIds.forEach((missionId, index) => {
    const item = requireActiveItem(db, 'mission', missionId);
    const doc = parseDoc<AdminMissionDoc>(item);
    const nextDoc: AdminMissionDoc = { ...doc, levelTrack, trackOrder: index + 1 };
    adminRepo.updateContentItem(db, 'mission', missionId, {
      docJson: JSON.stringify(nextDoc),
      revision: item.revision + 1,
      updatedAt: now,
    });
    const row = adminRepo.getMissionRow(db, missionId);
    if (row && row.status === 'published') {
      prepareMissionChange(db, missionId);
      adminRepo.upsertMissionRow(db, { ...row, levelTrack, trackOrder: index + 1 });
      bumpMissionContentVersion(db, missionId);
    }
  });
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

export function exportBundle(db: QueryClient): AdminContentBundle {
  const collect = <T>(entityType: AdminEntityType): T[] =>
    adminRepo
      .listContentItemsByType(db, entityType)
      .filter((row) => !row.archived)
      .map((row) => parseDoc<T>(row));
  return {
    bundleVersion: 1,
    exportedAt: nowIso(),
    missions: collect<AdminMissionDoc>('mission'),
    questions: collect<AdminQuestionDoc>('question'),
    flashcards: collect<AdminFlashcardDoc>('flashcard'),
    awards: collect<AdminAwardDoc>('award'),
  };
}

export function importBundle(db: QueryClient, bundle: AdminContentBundle, mode: 'merge' | 'replace', dryRun: boolean): AdminImportReport {
  if (bundle === null || typeof bundle !== 'object' || bundle.bundleVersion !== 1) {
    throw badRequest('Bundle must be an admin content bundle with bundleVersion 1.');
  }
  const report: AdminImportReport = {
    dryRun,
    applied: false,
    perType: {
      mission: { added: 0, updated: 0, skipped: 0, invalid: 0 },
      question: { added: 0, updated: 0, skipped: 0, invalid: 0 },
      flashcard: { added: 0, updated: 0, skipped: 0, invalid: 0 },
      award: { added: 0, updated: 0, skipped: 0, invalid: 0 },
    },
    errors: [],
  };

  const entries: Array<{ entityType: AdminEntityType; doc: Record<string, unknown> }> = [
    ...(Array.isArray(bundle.missions) ? bundle.missions : []).map((doc) => ({ entityType: 'mission' as const, doc: doc as unknown as Record<string, unknown> })),
    ...(Array.isArray(bundle.questions) ? bundle.questions : []).map((doc) => ({ entityType: 'question' as const, doc: doc as unknown as Record<string, unknown> })),
    ...(Array.isArray(bundle.flashcards) ? bundle.flashcards : []).map((doc) => ({ entityType: 'flashcard' as const, doc: doc as unknown as Record<string, unknown> })),
    ...(Array.isArray(bundle.awards) ? bundle.awards : []).map((doc) => ({ entityType: 'award' as const, doc: doc as unknown as Record<string, unknown> })),
  ];

  const valid: Array<{ entityType: AdminEntityType; doc: Record<string, unknown> }> = [];
  for (const entry of entries) {
    const id = typeof entry.doc.id === 'string' ? entry.doc.id : '';
    if (id.length === 0) {
      report.perType[entry.entityType].invalid += 1; // nosemgrep: gitlab.eslint.detect-object-injection
      report.errors.push({ entityType: entry.entityType, message: 'Missing id.' });
      continue;
    }
    const validation = validateDoc(db, entry.entityType, entry.doc);
    const blocking = validation.issues.filter((entryIssue) => entryIssue.severity === 'blocking' && entryIssue.code !== 'slug_taken');
    if (blocking.length > 0) {
      report.perType[entry.entityType].invalid += 1; // nosemgrep: gitlab.eslint.detect-object-injection
      report.errors.push({ entityType: entry.entityType, id, message: blocking.map((entryIssue) => entryIssue.message).join(' ') });
      continue;
    }
    valid.push(entry);
  }

  for (const entry of valid) {
    const existing = adminRepo.getContentItem(db, entry.entityType, entry.doc.id as string);
    if (existing !== undefined && !existing.archived) {
      report.perType[entry.entityType].updated += 1; // nosemgrep: gitlab.eslint.detect-object-injection
    } else {
      report.perType[entry.entityType].added += 1; // nosemgrep: gitlab.eslint.detect-object-injection
    }
  }

  if (dryRun) return report;

  const now = nowIso();
  if (mode === 'replace') {
    for (const entityType of ENTITY_TYPES) {
      for (const row of adminRepo.listContentItemsByType(db, entityType)) {
        adminRepo.updateContentItem(db, entityType, row.entityId, { archived: true, updatedAt: now });
      }
    }
  }
  for (const entry of valid) {
    const id = entry.doc.id as string;
    const existing = adminRepo.getContentItem(db, entry.entityType, id);
    const doc = { ...entry.doc };
    if (entry.entityType === 'mission') {
      const missionDoc = doc as unknown as AdminMissionDoc;
      if (
        listMissionDocs(db).some((mission) => mission.id !== missionDoc.id && mission.slug === missionDoc.slug)
      ) {
        report.perType.mission.skipped += 1;
        report.errors.push({ entityType: 'mission', id, message: `Slug "${missionDoc.slug}" conflicts with an existing mission.` });
        continue;
      }
    }
    if (existing !== undefined && !existing.archived) {
      adminRepo.updateContentItem(db, entry.entityType, id, {
        docJson: JSON.stringify(doc),
        revision: existing.revision + 1,
        isPublished: false,
        updatedAt: now,
      });
    } else {
      if (existing !== undefined) adminRepo.deleteContentItem(db, entry.entityType, id);
      adminRepo.insertContentItem(db, {
        entityType: entry.entityType,
        entityId: id,
        docJson: JSON.stringify(doc),
        revision: 1,
        publishedRevision: null,
        isPublished: false,
        enabled: true,
        archived: false,
        updatedAt: now,
      });
    }
  }
  report.applied = true;
  return report;
}

// ---------------------------------------------------------------------------
// Seed status / reload
// ---------------------------------------------------------------------------

export function seedStatus(db: QueryClient): AdminSeedStatusDto {
  const missions = adminRepo.listContentItemsByType(db, 'mission').filter((row) => !row.archived);
  const questions = adminRepo
    .listContentItemsByType(db, 'question')
    .filter((row) => !row.archived)
    .map((row) => parseDoc<AdminQuestionDoc>(row));
  const flashcards = adminRepo
    .listContentItemsByType(db, 'flashcard')
    .filter((row) => !row.archived)
    .map((row) => parseDoc<AdminFlashcardDoc>(row));
  const awards = adminRepo
    .listContentItemsByType(db, 'award')
    .filter((row) => !row.archived)
    .map((row) => parseDoc<AdminAwardDoc>(row));

  const integrity: AdminSeedIntegrityRow[] = missions.map((row) => {
    const doc = parseDoc<AdminMissionDoc>(row);
    const questionCount = questions.filter((question) => question.missionId === doc.id).length;
    const flashcardCount = flashcards.filter((card) => card.missionId === doc.id).length;
    const awardCount = awards.filter((award) => award.missionId === doc.id).length;
    return {
      missionId: doc.id,
      title: doc.title,
      checks: [
        {
          rule: 'At least 5 quiz questions',
          ok: questionCount >= 5,
          detail: `${questionCount} question${questionCount === 1 ? '' : 's'} assigned`,
        },
        {
          rule: 'At least 3 flashcards',
          ok: flashcardCount >= 3,
          detail: `${flashcardCount} flashcard${flashcardCount === 1 ? '' : 's'} assigned`,
        },
        {
          rule: 'At least 1 checkpoint',
          ok: doc.checkpoint !== undefined && doc.checkpoint !== null,
          detail: doc.checkpoint ? `checkpoint kind "${doc.checkpoint.kind}"` : 'no checkpoint',
        },
        {
          rule: 'At least 1 badge or milestone',
          ok: awardCount >= 1,
          detail: `${awardCount} award${awardCount === 1 ? '' : 's'} linked`,
        },
      ],
    };
  });

  return {
    counts: {
      missions: missions.length,
      questions: questions.length,
      flashcards: flashcards.length,
      awards: awards.length,
    },
    integrity,
  };
}

function readSeedJson<T>(missionDataDir: string, file: string): T[] {
  const parsed: unknown = JSON.parse(readFileSync(join(missionDataDir, file), 'utf8'));
  if (!Array.isArray(parsed)) throw new Error(`Seed file "${file}" must contain a JSON array.`);
  return parsed as T[];
}

export function reloadSeed(db: QueryClient, missionDataDir: string): AdminSeedStatusDto {
  const missions = readSeedJson<schema.NewMission>(missionDataDir, 'missions.json');
  const questions = readSeedJson<schema.NewQuizQuestion>(missionDataDir, 'questions.json');
  const flashcards = readSeedJson<schema.NewFlashcard>(missionDataDir, 'flashcards.json');
  const awards = readSeedJson<schema.NewAward>(missionDataDir, 'awards.json');
  const now = nowIso();

  for (const row of missions) {
    adminRepo.upsertMissionRow(db, row as schema.Mission);
    adminRepo.deleteContentItem(db, 'mission', row.id);
    adminRepo.insertContentItem(db, {
      entityType: 'mission',
      entityId: row.id,
      docJson: JSON.stringify(missionRowToDoc(row as schema.Mission)),
      revision: 1,
      publishedRevision: 1,
      isPublished: row.status === 'published',
      enabled: row.enabled,
      archived: false,
      updatedAt: now,
    });
  }
  for (const row of questions) {
    adminRepo.upsertQuestionRow(db, row as schema.QuizQuestion);
    adminRepo.deleteContentItem(db, 'question', row.id);
    adminRepo.insertContentItem(db, {
      entityType: 'question',
      entityId: row.id,
      docJson: JSON.stringify(questionRowToDoc(row as schema.QuizQuestion)),
      revision: 1,
      publishedRevision: 1,
      isPublished: row.status === 'published',
      enabled: row.enabled,
      archived: false,
      updatedAt: now,
    });
  }
  for (const row of flashcards) {
    adminRepo.upsertFlashcardRow(db, row as schema.Flashcard);
    adminRepo.deleteContentItem(db, 'flashcard', row.id);
    adminRepo.insertContentItem(db, {
      entityType: 'flashcard',
      entityId: row.id,
      docJson: JSON.stringify(flashcardRowToDoc(row as schema.Flashcard)),
      revision: 1,
      publishedRevision: 1,
      isPublished: row.status === 'published',
      enabled: row.enabled,
      archived: false,
      updatedAt: now,
    });
  }
  for (const row of awards) {
    adminRepo.upsertAwardRow(db, row as schema.Award);
    adminRepo.deleteContentItem(db, 'award', row.id);
    adminRepo.insertContentItem(db, {
      entityType: 'award',
      entityId: row.id,
      docJson: JSON.stringify(awardRowToDoc(row as schema.Award)),
      revision: 1,
      publishedRevision: 1,
      isPublished: row.status === 'published',
      enabled: row.enabled,
      archived: false,
      updatedAt: now,
    });
  }
  return seedStatus(db);
}

// ---------------------------------------------------------------------------
// Row -> doc conversions (backfill, seed reload)
// ---------------------------------------------------------------------------

function missionRowToDoc(row: schema.Mission): AdminMissionDoc {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    levelTrack: row.levelTrack,
    trackOrder: row.trackOrder,
    objective: row.objective,
    lesson: JSON.parse(row.lessonJson),
    example: JSON.parse(row.exampleJson),
    checkpoint: JSON.parse(row.checkpointJson),
    estimatedMinutes: row.estimatedMinutes,
    passThreshold: row.passThreshold,
    ...(row.prerequisiteMissionId ? { prerequisiteMissionId: row.prerequisiteMissionId } : {}),
  };
}

function questionRowToDoc(row: schema.QuizQuestion): AdminQuestionDoc {
  return {
    id: row.id,
    missionId: row.missionId,
    type: row.type,
    stem: row.stem,
    ...(row.scenario ? { scenario: row.scenario } : {}),
    selectionMode: row.selectionMode,
    options: JSON.parse(row.optionsJson),
    correctExplanation: row.correctExplanation,
    incorrectExplanation: row.incorrectExplanation,
    conceptTags: JSON.parse(row.conceptTagsJson),
    difficulty: row.difficulty,
    allowsReasoning: row.allowsReasoning,
    displayOrder: row.displayOrder,
  };
}

function flashcardRowToDoc(row: schema.Flashcard): AdminFlashcardDoc {
  return {
    id: row.id,
    missionId: row.missionId,
    concept: row.concept,
    definition: row.definition,
    example: row.example,
    ...(row.commonMistake ? { commonMistake: row.commonMistake } : {}),
    ...(row.learningTip ? { learningTip: row.learningTip } : {}),
    conceptTags: JSON.parse(row.conceptTagsJson),
    difficulty: row.difficulty,
    displayOrder: row.displayOrder,
  };
}

function awardRowToDoc(row: schema.Award): AdminAwardDoc {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    icon: row.icon,
    description: row.description,
    ...(row.missionId ? { missionId: row.missionId } : {}),
    rule: toAwardRule(row.ruleType, row.ruleJson),
  };
}

export function backfillContentItems(db: QueryClient): number {
  const existing = adminRepo.listAllContentItems(db);
  if (existing.length > 0) {
    for (const item of existing) {
      if (item.entityType === 'award') {
        try {
          const doc = JSON.parse(item.docJson);
          if (doc && typeof doc === 'object' && (!doc.rule || !doc.rule.type)) {
            if (doc.kind === 'badge') {
              doc.rule = {
                type: 'mission_completed',
                missionId: (doc.missionId ?? '') as never,
              };
            } else if (doc.rule) {
              const rule = doc.rule as Record<string, unknown>;
              if (rule.levelTrack) rule.type = 'track_completed';
              else if (rule.minScorePercent !== undefined) rule.type = 'score_threshold';
              else if (rule.length !== undefined) rule.type = 'streak';
              else if (rule.minPercent !== undefined) rule.type = 'percent_complete';
              else rule.type = 'percent_complete';
            } else {
              doc.rule = { type: 'percent_complete', minPercent: 100 };
            }
            adminRepo.updateContentItem(db, 'award', item.entityId, {
              docJson: JSON.stringify(doc),
            });
          }
        } catch {
          // ignore parsing errors
        }
      }
    }
    return 0;
  }
  const now = nowIso();
  let count = 0;
  for (const row of adminRepo.listAllMissionRows(db)) {
    adminRepo.insertContentItem(db, {
      entityType: 'mission',
      entityId: row.id,
      docJson: JSON.stringify(missionRowToDoc(row)),
      revision: 1,
      publishedRevision: 1,
      isPublished: row.status === 'published',
      enabled: row.enabled,
      archived: false,
      updatedAt: now,
    });
    count += 1;
  }
  for (const row of contentRepoListAllQuestions(db)) {
    adminRepo.insertContentItem(db, {
      entityType: 'question',
      entityId: row.id,
      docJson: JSON.stringify(questionRowToDoc(row)),
      revision: 1,
      publishedRevision: 1,
      isPublished: row.status === 'published',
      enabled: row.enabled,
      archived: false,
      updatedAt: now,
    });
    count += 1;
  }
  for (const row of contentRepoListAllFlashcards(db)) {
    adminRepo.insertContentItem(db, {
      entityType: 'flashcard',
      entityId: row.id,
      docJson: JSON.stringify(flashcardRowToDoc(row)),
      revision: 1,
      publishedRevision: 1,
      isPublished: row.status === 'published',
      enabled: row.enabled,
      archived: false,
      updatedAt: now,
    });
    count += 1;
  }
  for (const row of contentRepoListAllAwards(db)) {
    adminRepo.insertContentItem(db, {
      entityType: 'award',
      entityId: row.id,
      docJson: JSON.stringify(awardRowToDoc(row)),
      revision: 1,
      publishedRevision: 1,
      isPublished: row.status === 'published',
      enabled: row.enabled,
      archived: false,
      updatedAt: now,
    });
    count += 1;
  }
  return count;
}

function contentRepoListAllQuestions(db: QueryClient): schema.QuizQuestion[] {
  return db.select().from(schema.quizQuestions).all();
}

function contentRepoListAllFlashcards(db: QueryClient): schema.Flashcard[] {
  return db.select().from(schema.flashcards).all();
}

function contentRepoListAllAwards(db: QueryClient): schema.Award[] {
  return db.select().from(schema.awards).all();
}

// ---------------------------------------------------------------------------
// Preview payload
// ---------------------------------------------------------------------------

export function buildPreviewPayload(db: QueryClient, missionId: string): { catalog: { contentVersion: string; missions: MissionSummary[]; awards: AwardDefinition[] }; mission: MissionDetail } {
  const item = requireActiveItem(db, 'mission', missionId);
  const doc = parseDoc<AdminMissionDoc>(item);
  const existingRow = adminRepo.getMissionRow(db, missionId);

  const questions = adminRepo
    .listContentItemsByType(db, 'question')
    .filter((row) => !row.archived)
    .map((row) => ({ row, doc: parseDoc<AdminQuestionDoc>(row) }))
    .filter((entry) => entry.doc.missionId === missionId)
    .sort((a, b) => a.doc.displayOrder - b.doc.displayOrder)
    .map((entry) => toQuizQuestionDto(projectQuestionRow(entry.doc, true, nowIso())));

  const flashcards = adminRepo
    .listContentItemsByType(db, 'flashcard')
    .filter((row) => !row.archived)
    .map((row) => ({ row, doc: parseDoc<AdminFlashcardDoc>(row) }))
    .filter((entry) => entry.doc.missionId === missionId)
    .sort((a, b) => a.doc.displayOrder - b.doc.displayOrder)
    .map((entry) => toFlashcardDto(projectFlashcardRow(entry.doc, true, nowIso())));

  const awards = adminRepo
    .listContentItemsByType(db, 'award')
    .filter((row) => !row.archived)
    .map((row) => parseDoc<AdminAwardDoc>(row))
    .filter((award) => award.missionId === missionId)
    .map((award) => toAwardDefinition(projectAwardRow(award, true, nowIso())));

  const previewVersion = (existingRow?.contentVersion ?? 0) + 1;
  const summary: MissionSummary = {
    id: doc.id as MissionId,
    title: doc.title,
    difficulty: doc.difficulty,
    levelTrack: doc.levelTrack,
    trackOrder: doc.trackOrder,
    objective: doc.objective,
    ...(doc.prerequisiteMissionId ? { prerequisiteMissionId: doc.prerequisiteMissionId as MissionId } : {}),
    estimatedMinutes: doc.estimatedMinutes,
    contentVersion: previewVersion,
  };

  const visibleAwards = contentRepo.listVisibleAwards(db).map(toAwardDefinition);
  const catalogAwards = [...visibleAwards];
  for (const award of awards) {
    if (!catalogAwards.some((entry) => entry.id === award.id)) catalogAwards.push(award);
  }

  return {
    catalog: {
      contentVersion: `preview-${missionId}-${previewVersion}`,
      missions: [summary],
      awards: catalogAwards,
    },
    mission: {
      ...summary,
      lesson: doc.lesson,
      example: doc.example,
      checkpoint: doc.checkpoint,
      questions: questions.map((question) => ({ ...question, missionId: question.missionId as MissionId })),
      flashcards: flashcards.map((card) => ({ ...card, missionId: card.missionId as MissionId })),
      awards,
      passThreshold: doc.passThreshold,
    },
  };
}
